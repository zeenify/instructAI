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
const ACTING_ACTIONS = new Set(['click', 'input', 'select']);

function resolveTarget(ref, ctx) {
    if (ref == null) return null;
    const entry = ctx.entries?.get?.(Number(ref));
    const el = document.querySelector(`[data-euna-ref="${Number(ref)}"]`);
    if (!entry || !el) return null;
    return { entry, el };
}

function reSnapshot(ctx) {
    const snap = ctx.buildSnapshot();
    ctx.snapshot = snap;
    return snap;
}

async function aimAt(target, { label, danger } = {}) {
    const { x, y } = overlay.centerOf(target.el);
    if (danger) overlay.setCursorMode('danger');
    await overlay.showCursor(x, y, danger ? 'danger' : 'default');
    await overlay.moveCursorTo(x, y, { label, mode: danger ? 'danger' : 'default' });
    overlay.showHighlight(target.el);
    return { x, y };
}

async function runOne(cmd, ctx) {
    const action = String(cmd.action || '').toLowerCase();
    const ref = cmd.ref != null ? Number(cmd.ref) : null;
    const value = cmd.value != null ? String(cmd.value) : '';

    if (action === 'goto') {
        const path = String(cmd.path || value || '').trim();
        if (!path.startsWith('/') || !path.startsWith(DASHBOARD_PREFIX)) {
            return { action, ok: false, message: 'goto only accepts paths inside /dashboard' };
        }
        overlay.hideHighlight();
        pilotNavigate(path);
        await sleep(900); // route render + data settle
        reSnapshot(ctx);
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
        return { action, ok: true, message: 'scrolled' };
    }

    const target = resolveTarget(ref, ctx);
    if (!target) {
        return { action, ref, ok: false, message: `ref ${ref} not found — take a snapshot first` };
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
        const { x, y } = await aimAt(target, { danger, label: ctx.batchExplain });
        await sleep(180);
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
 * (the consent gate lives in usePilotRun, not here).
 */
export async function executeBatch(commands, ctx) {
    const results = [];
    const batchExplain = ctx.batchExplain || '';
    let needsSnapshot = false;

    for (const cmd of commands) {
        const isActing = ACTING_ACTIONS.has(String(cmd.action || '').toLowerCase());
        const result = await runOne(cmd, { ...ctx, batchExplain });
        results.push({ ...result, command: cmd });
        if (isActing) needsSnapshot = true;
        if (result.blocked) break; // destructive refusal ends the batch
        if (result.ok === false && ['click', 'goto'].includes(String(cmd.action))) break;
    }

    const snap = needsSnapshot ? ctx.snapshot : null;
    return { results, snapshot: snap };
}

/** Point the cursor at the first target of a batch (cursor intro). */
export async function introCursor(commands, ctx) {
    const first = commands.find((c) => c.ref != null);
    if (!first) return;
    const target = resolveTarget(first.ref, ctx);
    if (!target) return;
    const { x, y } = overlay.centerOf(target.el);
    await overlay.showCursor(x, y, 'default');
}
