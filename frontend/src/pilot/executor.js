/**
 * EUNA Pilot — command executor
 *
 * Runs the model's invoke_client command batches against the real page:
 * resolve ref → glide the cursor → highlight → act → re-snapshot. Every
 * command returns a structured result that is fed back to the model.
 *
 * Safety rules enforced here (never trusted to the model):
 *  - destructive controls ([DESTRUCTIVE] in the snapshot — any
 *    Delete/Remove/Replace-labeled button, dialog or not) are refused;
 *    the teacher's own click finishes those
 *  - goto only moves inside the teacher dashboard
 *  - refs that vanished resolve to "take a snapshot" failures, never guesses
 */

import * as overlay from './overlay';
import { pilotNavigate } from './bridge';
import { installNetWatch, netPending } from './netWatch';

// Wrap fetch/XHR once at pilot load — waitForPageSettle reads the counter
installNetWatch();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DASHBOARD_PREFIX = '/dashboard';

/**
 * Refs resolve through the snapshot's captured element — never by
 * re-querying [data-euna-ref] (DOM re-renders reassign attributes; the QA
 * repro clicked "Sign Out" when the model said "New Module" that way).
 *
 * But React re-renders REPLACE nodes (polling refetches are everywhere on
 * this dashboard), so a captured element can be detached while the SAME
 * control is still on screen. Before declaring a ref stale, re-anchor by
 * matching tag + accessible name against live elements. Nameless matches
 * are never guessed.
 */
function reAnchorToLive(entry) {
    if (!entry.name) return null;
    const selector = [
        'a[href]', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '[role="tab"]', '[role="menuitem"]',
        '[role="combobox"]', '[contenteditable="true"]',
    ].join(',');
    const wanted = entry.name.toLowerCase();

    // Pointer-row entries (div/li captured by the affordance scan) can't be
    // re-anchored through the interactive selector — and they die the most:
    // every list refetch replaces the row nodes. Re-anchor them by their
    // control-stripped name (the captured name is prefix-truncated, so the
    // live name must START WITH it, not equal it).
    const INTERACTIVE_TAGS = new Set(['a', 'button', 'input', 'textarea', 'select']);
    if (!INTERACTIVE_TAGS.has(entry.tag) && entry.role !== 'button') {
        let best = null;
        let bestDist = Infinity;
        const probe = wanted.slice(0, 24);
        for (const el of document.querySelectorAll(entry.tag)) {
            if (el.closest('[data-euna-ignore]') || el.closest('[aria-hidden="true"]')) continue;
            const r = el.getBoundingClientRect();
            if (r.width < 8 || r.height < 8) continue;
            // cheap text pre-filter before any cloning
            if (!(el.textContent || '').toLowerCase().includes(probe)) continue;
            const clone = el.cloneNode(true);
            clone.querySelectorAll('button,input,textarea,select,svg,[data-euna-ignore]').forEach((x) => x.replaceWith(' '));
            const liveName = (clone.innerHTML.replace(/<[^>]*>/g, ' ') || '')
                .replace(/\s+/g, ' ').trim().toLowerCase();
            if (!liveName || !liveName.startsWith(wanted)) continue;
            if (entry.rect) {
                const dist = Math.hypot(
                    r.x + r.width / 2 - (entry.rect.x + entry.rect.w / 2),
                    r.y + r.height / 2 - (entry.rect.y + entry.rect.h / 2)
                );
                if (dist < bestDist) {
                    bestDist = dist;
                    best = el;
                }
            } else {
                best = el;
                break;
            }
        }
        return best;
    }

    let best = null;
    let bestDist = Infinity;
    for (const el of document.querySelectorAll(selector)) {
        if (el.closest('[data-euna-ignore]') || el.closest('[aria-hidden="true"]')) continue;
        if (el.tagName.toLowerCase() !== entry.tag) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        const elName = (
            el.getAttribute('aria-label') ||
            (typeof el.innerText === 'string' ? el.innerText : '') ||
            el.getAttribute('title') ||
            el.getAttribute('placeholder') ||
            ''
        ).trim().replace(/\s+/g, ' ').toLowerCase();
        if (!elName || elName !== wanted) continue;
        // Same-named twins exist (two "Edit" buttons) — take the candidate
        // nearest where the captured element used to live
        if (entry.rect) {
            const dist = Math.hypot(
                r.x + r.width / 2 - (entry.rect.x + entry.rect.w / 2),
                r.y + r.height / 2 - (entry.rect.y + entry.rect.h / 2)
            );
            if (dist < bestDist) {
                bestDist = dist;
                best = el;
            }
        } else {
            best = el;
            break;
        }
    }
    return best;
}

function resolveTarget(ref, ctx) {
    if (ref == null) return null;
    const entry = ctx.entries?.get?.(Number(ref));
    if (!entry) return null;
    if (entry.el && document.contains(entry.el)) return { entry, el: entry.el };
    // Captured node was replaced by a re-render — re-anchor to the same control
    const live = reAnchorToLive(entry);
    if (live) {
        entry.el = live;
        return { entry, el: live, reanchored: true };
    }
    return null;
}

function reSnapshot(ctx) {
    const snap = ctx.buildSnapshot();
    ctx.snapshot = snap;
    ctx.entries = snap.entries;
    return snap;
}

/**
 * Wait for the page to actually settle — SPA renders kick off data fetches
 * that render for a while; a fixed sleep raced them and sent the model
 * skeleton snapshots (it then answered from stale conversation history
 * instead — a 13-element shell snapshot made it "remember" the editor had
 * no add-question control). Waits until the DOM stops mutating AND the page
 * has real content, capped at 6.5s, then snapshots whatever is on screen.
 * Used after BOTH goto and click.
 */
async function waitForPageSettle(ctx) {
    const deadline = Date.now() + 6500;
    let lastMutation = Date.now();
    const observer = new MutationObserver(() => {
        lastMutation = Date.now();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // A quiet DOM is not a loaded page: routes render their shell and
    // skeletons first, then sit perfectly still while TanStack queries are
    // in flight. The old 350ms-quiescence check snapshotted exactly that
    // state — the pilot "saw" only the sidebar on a fully working class
    // page and told the teacher the page hadn't rendered.
    const contentReady = () => {
        const main = document.querySelector('main');
        if (!main) return true;
        const skeletons = main.querySelectorAll('.db-skeleton').length;
        const text = (main.innerText || '').trim();
        return skeletons === 0 && text.length > 40;
    };
    try {
        while (Date.now() < deadline) {
            // 700ms of DOM quiet AND no in-flight requests: on this box a
            // POST takes ~2.4s (remote Neon DB) and the DOM only mutates
            // when its response renders — quiescence alone snapshots
            // mid-flight states (the new row "rendered late" on every
            // create, and the creation anchor found nothing to point at).
            const quiescent = Date.now() - lastMutation >= 700 && netPending() === 0;
            if (quiescent && contentReady()) break;
            await sleep(120);
        }
        await sleep(250); // let the final mutation's renders paint
    } finally {
        observer.disconnect();
    }
    return reSnapshot(ctx);
}

function throwIfAborted(signal) {
    if (signal?.aborted) {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
    }
}

function normalizeGotoPath(path) {
    try {
        const url = new URL(path, window.location.origin);
        if (url.origin !== window.location.origin) return null;
        // '/dashboard/../login' and '/dashboard-evil' must both fail this
        return url.pathname.startsWith(`${DASHBOARD_PREFIX}/`) || url.pathname === DASHBOARD_PREFIX
            ? url.pathname
            : null;
    } catch {
        return null;
    }
}

async function aimAt(target, { label, danger } = {}) {
    const { x, y } = overlay.centerOf(target.el);
    if (danger) overlay.setCursorMode('danger');
    await overlay.moveCursorTo(x, y, { label, mode: danger ? 'danger' : 'default' });
    overlay.showHighlight(target.el);
    return { x, y };
}

async function runOne(cmd, ctx) {
    const action = String(cmd.action || '').toLowerCase();
    const ref = cmd.ref != null ? Number(cmd.ref) : null;
    const value = cmd.value != null ? String(cmd.value) : '';
    throwIfAborted(ctx.signal);

    if (action === 'goto') {
        const path = normalizeGotoPath(String(cmd.path || value || '').trim());
        if (!path) {
            return { action, ok: false, message: 'goto only accepts real paths inside /dashboard' };
        }
        overlay.hideHighlight();
        pilotNavigate(path);
        await waitForPageSettle(ctx);
        return { action, ok: true, message: `navigated to ${path}` };
    }

    if (action === 'snapshot') {
        const snap = reSnapshot(ctx);
        return { action, ok: true, message: `snapshot taken — ${snap.entries.size} elements` };
    }

    if (action === 'scroll') {
        const target = ref != null ? resolveTarget(ref, ctx) : null;
        if (cmd.ref != null && !target) {
            return { action, ref, ok: false, message: `ref ${ref} not found — take a snapshot` };
        }
        if (target) {
            target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Scroll the scrollable container nearest the viewport center —
            // modals scroll their own body and window.scrollBy never reaches
            // fields inside them (a whole turn budget died hunting the
            // points field inside the classwork modal). Popups over the
            // center are skipped: they are not the surface the model means.
            const dir = cmd.direction === 'up' ? -420 : 420;
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            let chosen = null;
            try {
                const scrollables = [...document.querySelectorAll('*')].filter((el) => {
                    if (el.closest('[data-euna-ignore]')) return false;
                    const s = getComputedStyle(el);
                    return /(auto|scroll)/.test(s.overflowY)
                        && el.scrollHeight > el.clientHeight + 4
                        && el.clientHeight > 120;
                });
                // The INNERMOST scrollable containing the viewport center —
                // the page behind a modal is also scrollable and also
                // contains the center; scrolling it moves nothing the model
                // can see.
                let bestArea = Infinity;
                for (const el of scrollables) {
                    const r = el.getBoundingClientRect();
                    if (r.width < 100 || r.height < 100) continue;
                    if (!(cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)) continue;
                    const area = r.width * r.height;
                    if (area < bestArea) {
                        bestArea = area;
                        chosen = el;
                    }
                }
            } catch { /* best effort — fall back to window */ }
            if (chosen) chosen.scrollBy({ top: dir, behavior: 'smooth' });
            else window.scrollBy({ top: dir, behavior: 'smooth' });
        }
        await sleep(450);
        throwIfAborted(ctx.signal);
        return { action, ok: true, message: 'scrolled' };
    }

    let target = resolveTarget(ref, ctx);
    if (!target) {
        // Tell the model WHAT it lost — a bare ref number gives it nothing
        // to recover with
        const stale = ctx.entries?.get?.(Number(ref));
        const was = stale?.name ? ` ("${stale.name}")` : '';
        return { action, ref, ok: false, message: `ref ${ref}${was} no longer exists — take a snapshot and use a fresh ref` };
    }

    const danger = !!target.entry.dangerous || cmd.risk === 'dangerous';

    if (action === 'hover' || action === 'point') {
        await aimAt(target, { danger });
        await sleep(150);
        return { action, ref, ok: true, message: `pointing at "${target.entry.name || ref}"` };
    }

    if (action === 'click') {
        if (target.entry.dangerous) {
            overlay.setCursorMode('danger');
            await aimAt(target, { danger: true });
            return {
                action,
                ref,
                ok: false,
                blocked: true,
                message: `BLOCKED: "${target.entry.name}" deletes or overwrites something — destructive actions stay in the teacher's hands. Do everything else the task needs, then ask them to press this one themselves.`,
            };
        }
        target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(250);
        throwIfAborted(ctx.signal);
        const { x, y } = await aimAt(target, { danger, label: ctx.batchExplain });
        await sleep(180);
        throwIfAborted(ctx.signal);
        overlay.pulseAt(x, y);
        // Toggle truth: popups (date pickers, dropdown menus) portal to the
        // body as fixed elements. Clicking a trigger can OPEN one — or CLOSE
        // the one that was already open — and the model never tracked that,
        // so it re-clicked triggers and burned the budget re-opening a
        // calendar it had just closed. State the delta in the result.
        // Best-effort only: this note must never break the click itself.
        let portalsBefore = [];
        let clickedInPortal = false;
        try {
            portalsBefore = [...document.body.children].filter((el) => {
                if (el.closest('[data-euna-ignore]')) return false;
                return getComputedStyle(el).position === 'fixed';
            });
            clickedInPortal = portalsBefore.some((p) => p.contains(target.el));
        } catch { /* best effort */ }
        target.el.click();
        // The click's result is often a fetch-and-render (route change, modal
        // with its own query) — settle like a goto, or the auto-snapshot is a
        // 13-element shell and the model answers from stale history instead
        await waitForPageSettle(ctx);
        let portalNote = '';
        try {
            const portalsAfter = [...document.body.children].filter((el) => {
                if (el.closest('[data-euna-ignore]')) return false;
                return getComputedStyle(el).position === 'fixed';
            });
            if (portalsAfter.length > portalsBefore.length) portalNote = ' — a popup/menu OPENED from this click; its controls are in the snapshot, act on them directly (do not click the trigger again)';
            else if (portalsAfter.length < portalsBefore.length && clickedInPortal) portalNote = ' — the popup closed after your selection; that is normal — the value is set, move on to the next field';
            else if (portalsAfter.length < portalsBefore.length) portalNote = ' — the popup that was open is now CLOSED (this trigger toggles it)';
        } catch { /* best effort */ }
        return { action, ref, ok: true, message: `clicked "${target.entry.name || ref}"${portalNote}` };
    }

    if (action === 'input') {
        if (!value) {
            return { action, ref, ok: false, message: 'input requires a value' };
        }
        if (target.entry.dangerous) {
            return { action, ref, ok: false, blocked: true, message: 'BLOCKED: destructive control.' };
        }
        target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(200);
        throwIfAborted(ctx.signal);
        await aimAt(target, { label: ctx.batchExplain });
        target.el.focus();

        const applyValue = (el) => {
            if (el.isContentEditable) {
                el.textContent = value;
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
            } else {
                const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        };
        applyValue(target.el);
        await sleep(250);
        // Read-back: React state updates, controlled inputs and validation
        // rules can silently reject a fill. Report what the field ACTUALLY
        // holds — the model guessing "maybe the button stayed disabled" came
        // from having no ground truth about the fill.
        const readBack = (el) =>
            String(el.isContentEditable ? el.textContent : el.value ?? '');
        let fieldReads = readBack(target.el);
        if (fieldReads !== value) {
            // One retry — the first dispatch can race a re-render that
            // replaces the node between focus and set
            const reanchored = resolveTarget(ref, ctx);
            if (reanchored) target = reanchored;
            applyValue(target.el);
            await sleep(250);
            fieldReads = readBack(target.el);
        }
        // Say BOTH the value and the field — the audit log reads like a
        // natural sentence and can't be mistaken for "it typed the placeholder"
        if (fieldReads === value) {
            return { action, ref, ok: true, message: `filled "${value}" into ${target.entry.name ? `"${target.entry.name}"` : `field ${ref}`} — verified, the field reads it back` };
        }
        return {
            action,
            ref,
            ok: false,
            message: `typed "${value}" but the field reads "${fieldReads || '(empty)'}" — it rejected or cleared the input (wrong control, readonly, or the app rewrote it). Take a snapshot, find the real input, and fill that.`,
        };
    }

    if (action === 'select') {
        if (target.el.tagName === 'SELECT') {
            const options = Array.from(target.el.options);
            const match = options.find(
                (o) => o.text.trim().toLowerCase() === value.toLowerCase() || o.value === value
            );
            if (!match) {
                return { action, ref, ok: false, message: `no option "${value}" — options: ${options.map((o) => o.text.trim()).slice(0, 8).join(' | ')}` };
            }
            const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
            setter?.call(target.el, match.value);
            target.el.dispatchEvent(new Event('change', { bubbles: true }));
            await sleep(250);
            return { action, ref, ok: true, message: `selected "${match.text.trim()}"` };
        }
        // Custom dropdown (our dd- Dropdown component): open it, then the
        // model re-snapshots and clicks the option by ref
        target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(200);
        throwIfAborted(ctx.signal);
        const { x, y } = await aimAt(target, { label: ctx.batchExplain });
        overlay.pulseAt(x, y);
        target.el.click();
        await sleep(450);
        reSnapshot(ctx);
        return { action, ref, ok: true, message: 'dropdown opened — snapshot taken; click the option by ref' };
    }

    return { action, ref, ok: false, message: `unknown action "${action}"` };
}

/**
 * Execute a batch. Mutating batches must be pre-approved by the caller
 * (the consent gate lives in usePilotRun, not here). `signal` (optional)
 * makes Stop cut the batch short at the next command boundary.
 */
export async function executeBatch(commands, ctx) {
    const results = [];
    const batchCtx = {
        ...ctx,
        entries: ctx.entries || ctx.buildSnapshot().entries,
        batchExplain: ctx.batchExplain || '',
    };

    for (const cmd of commands) {
        if (ctx.signal?.aborted) break;
        let result;
        try {
            result = await runOne(cmd, batchCtx);
        } catch (err) {
            if (err?.name === 'AbortError') break;
            result = { action: String(cmd.action || ''), ref: cmd.ref, ok: false, message: `executor error: ${err?.message || err}` };
        }
        results.push({ ...result, command: cmd });
        if (result.blocked) break; // destructive refusal ends the batch
        if (result.ok === false && ['click', 'goto'].includes(String(cmd.action))) break;
    }

    return { results };
}
