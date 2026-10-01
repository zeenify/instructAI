/**
 * EUNA Pilot — command executor
 *
 * Runs the model's invoke_client command batches against the real page:
 * resolve ref → glide the cursor → highlight → act → re-snapshot. Every
 * command returns a structured result that is fed back to the model.
 *
 * Safety rules enforced here (never trusted to the model):
 *  - destructive confirm controls ([DESTRUCTIVE] in the snapshot) are refused;
 *    the teacher's own click finishes those
 *  - goto only moves inside the teacher dashboard
 *  - refs that vanished resolve to "take a snapshot" failures, never guesses
 */

import * as overlay from './overlay';
import { pilotNavigate } from './bridge';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DASHBOARD_PREFIX = '/dashboard';

/**
 * Refs resolve ONLY through the snapshot's captured element — never by
 * re-querying [data-euna-ref] (DOM re-renders reassign attributes; the QA
 * repro clicked "Sign Out" when the model said "New Module" that way).
 * A captured element that has since left the document is treated as stale.
 */
function resolveTarget(ref, ctx) {
    if (ref == null) return null;
    const entry = ctx.entries?.get?.(Number(ref));
    if (!entry) return null;
    if (!entry.el || !document.contains(entry.el)) return null;
    return { entry, el: entry.el };
}

function reSnapshot(ctx) {
    const snap = ctx.buildSnapshot();
    ctx.snapshot = snap;
    ctx.entries = snap.entries;
    return snap;
}

/**
 * Wait for the route change to actually settle — SPA navigation kicks off
 * data fetches that render for a while; a fixed sleep raced them and sent
 * the model skeleton snapshots (it re-issued goto until the turn budget
 * killed the run). Waits until the DOM stops mutating for ~350ms, capped
 * at 4s, then snapshots whatever is on screen.
 */
async function gotoSettle(ctx) {
    const deadline = Date.now() + 4000;
    let lastMutation = Date.now();
    const observer = new MutationObserver(() => {
        lastMutation = Date.now();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    try {
        while (Date.now() - lastMutation < 350 && Date.now() < deadline) {
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
        await gotoSettle(ctx);
        return { action, ok: true, message: `navigated to ${path}` };
    }

    if (action === 'snapshot') {
        const snap = reSnapshot(ctx);
        return { action, ok: true, message: `snapshot taken — ${snap.entries.length} elements` };
    }

    if (action === 'scroll') {
        const target = ref != null ? resolveTarget(ref, ctx) : null;
        if (cmd.ref != null && !target) {
            return { action, ref, ok: false, message: `ref ${ref} not found — take a snapshot` };
        }
        if (target) {
            target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            window.scrollBy({ top: cmd.direction === 'up' ? -420 : 420, behavior: 'smooth' });
        }
        await sleep(450);
        throwIfAborted(ctx.signal);
        return { action, ok: true, message: 'scrolled' };
    }

    const target = resolveTarget(ref, ctx);
    if (!target) {
        return { action, ref, ok: false, message: `ref ${ref} not found or stale — take a snapshot first` };
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
                message: `BLOCKED: "${target.entry.name}" is a destructive confirmation. Ask the teacher to press it themselves and end your part of the task.`,
            };
        }
        target.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(250);
        throwIfAborted(ctx.signal);
        const { x, y } = await aimAt(target, { danger, label: ctx.batchExplain });
        await sleep(180);
        throwIfAborted(ctx.signal);
        overlay.pulseAt(x, y);
        target.el.click();
        await sleep(650); // modal / route settle
        reSnapshot(ctx);
        return { action, ref, ok: true, message: `clicked "${target.entry.name || ref}"` };
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

        if (target.el.isContentEditable) {
            target.el.textContent = value;
            target.el.dispatchEvent(new InputEvent('input', { bubbles: true }));
        } else {
            const proto = target.el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
            setter?.call(target.el, value);
            target.el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await sleep(250);
        return { action, ref, ok: true, message: `filled "${target.entry.name || ref}"` };
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
