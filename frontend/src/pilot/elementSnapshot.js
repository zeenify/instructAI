/**
 * EUNA Pilot — element snapshot
 *
 * Builds the numbered registry of interactive elements the agent addresses
 * commands by ref ("click 17"). Mirrors the pattern used by Tencent's console
 * agent and browser agents generally: enumerate → number → let the model pick.
 *
 * The panel root is excluded via [data-euna-ignore], so the pilot never
 * tries to operate itself.
 */

export const MAX_ELEMENTS = 80;
export const NAME_LIMIT = 60;

const INTERACTIVE_SELECTOR = [
    'a[href]',
    'button',
    'input',
    'textarea',
    'select',
    '[role="button"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="combobox"]',
    '[role="option"]',
    '[role="switch"]',
    '[contenteditable="true"]',
].join(',');

// A destructive confirmation control. The executor refuses to click these —
// the teacher's own hand always finishes destructive actions. "replace" is
// here deliberately: the AI Studio's "Replace them / Replace all" commit
// wipes a class's existing modules and questions, and an agent must never
// make that choice under a general wheel consent.
const DESTRUCTIVE_WORDS = /\b(delete|remove|confirm|unpublish|archive|reset|revoke|kick|sign out|logout|replace|end room)\b/i;

// The AI Studio's review modals use the gen-* class family rather than a
// modal role — without them "Replace them / Replace my class content" would
// escape the destructive marking and ride a general "Take the wheel" consent.
const isDialogish = (el) =>
    !!el.closest('[role="dialog"], [role="alertdialog"], .modal, [class*="modal"], .gen-overlay, [class*="gen-card"]');

function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    if (rect.bottom < 0 || rect.right < 0) return false;
    if (rect.top > window.innerHeight + 200 || rect.left > window.innerWidth + 200) return false;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    if (parseFloat(style.opacity) === 0) return false;
    return true;
}

function describeElement(el, ref) {
    const role =
        el.getAttribute('role') ||
        (el.tagName === 'A' ? 'link' : el.tagName === 'BUTTON' ? 'button' : el.tagName.toLowerCase());
    const name = (
        el.getAttribute('aria-label') ||
        (typeof el.innerText === 'string' ? el.innerText : '') ||
        el.getAttribute('title') ||
        el.getAttribute('placeholder') ||
        el.getAttribute('value') ||
        ''
    ).trim().replace(/\s+/g, ' ').slice(0, NAME_LIMIT);
    const rect = el.getBoundingClientRect();

    const entry = {
        ref,
        tag: el.tagName.toLowerCase(),
        role,
        name,
        // The element itself is captured with the entry — refs must NEVER be
        // re-resolved by re-querying the DOM (attributes go stale the moment
        // the page re-renders; executor resolves exclusively via this el)
        el,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
    };

    const href = el.getAttribute('href');
    if (href && href.startsWith('/')) entry.href = href;

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        entry.input = true;
        const type = (el.getAttribute('type') || 'text').toLowerCase();
        if (type !== 'password' && el.value) entry.value = String(el.value).slice(0, 40);
        if (el.disabled || el.readOnly) entry.disabled = true;
    }
    if (el.isContentEditable) entry.input = true;
    if (el.disabled) entry.disabled = true;

    // Destructive confirm controls inside dialogs are flagged and blocked
    if (
        (el.tagName === 'BUTTON' || role === 'button') &&
        isDialogish(el) &&
        DESTRUCTIVE_WORDS.test(name)
    ) {
        entry.dangerous = true;
    }

    return entry;
}

function entryLine(entry) {
    const parts = [`[${entry.ref}] ${entry.role}`];
    if (entry.name) parts.push(`"${entry.name}"`);
    if (entry.href) parts.push(`→ ${entry.href}`);
    if (entry.input) parts.push('(text input)');
    if (entry.value !== undefined) parts.push(`value: "${entry.value}"`);
    if (entry.disabled) parts.push('[disabled]');
    if (entry.dangerous) parts.push('[DESTRUCTIVE — never click]');
    return parts.join(' ');
}

/**
 * Build the snapshot. Returns { text, entries } — text goes into the model
 * prompt, entries power executor ref resolution.
 */
export function buildElementSnapshot() {
    const candidates = Array.from(document.querySelectorAll(INTERACTIVE_SELECTOR)).filter((el) => {
        if (el.closest('[data-euna-ignore]')) return false;
        if (el.closest('[aria-hidden="true"]')) return false;
        if (el.getAttribute('aria-hidden') === 'true') return false;
        return isVisible(el);
    });

    const entries = [];
    const lines = [`Page: ${document.title} — ${window.location.pathname}`];

    for (const el of candidates) {
        if (entries.length >= MAX_ELEMENTS) {
            lines.push(`… (${candidates.length - MAX_ELEMENTS} more elements truncated)`);
            break;
        }
        const entry = describeElement(el, entries.length + 1);
        if (!entry.name && !entry.input && !entry.href) continue; // unnamed, unactionable
        entries.push(entry);
        lines.push(entryLine(entry));
    }

    return { text: lines.join('\n'), entries };
}
