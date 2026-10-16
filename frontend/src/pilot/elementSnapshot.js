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
    // Headings are the page's wayfinding — module names, page titles,
    // section labels live here and several are clickable (a module heading
    // expands it). Without them the pilot reads controls whose meaning it
    // can't see ("two modules but I can't tell them apart").
    'h1',
    'h2',
    'h3',
    'h4',
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

    // Affordance signal: non-button elements the UI itself marks clickable
    // (cursor: pointer) — module title rows that expand, cards, selectable
    // rows. cursor inherits, so a title inside a pointer row reads pointer
    // too. Without this the pilot sees a heading and assumes it's inert.
    if (!el.matches('a,button,input,textarea,select')) {
        try {
            if (getComputedStyle(el).cursor === 'pointer') entry.clickable = true;
        } catch { /* detached — no style */ }
    }

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
    if (entry.clickable) parts.push('· clickable');
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

    // Page outline — the page's text structure (headings, list rows, column
    // headers). Controls say WHAT is actionable; the outline says what the
    // things ARE (which module, which lesson, which column). Row identities
    // are plain text, so without this the pilot sees controls it can't tell
    // apart. Bounded; text already covered by a ref is skipped.
    const outlineLines = [];
    const outlineSeen = (text) => entries.some((e) => e.name && (e.name.includes(text) || text.includes(e.name)));
    const container = document.querySelector('main') || document.body;
    for (const el of container.querySelectorAll('h1,h2,h3,h4,h5,h6,li,th,caption')) {
        if (outlineLines.length >= 40) break;
        if (el.closest('[data-euna-ignore]') || el.closest('[aria-hidden="true"]')) continue;
        if (!isVisible(el)) continue;
        // Control labels (Live / Move / Delete buttons inside rows) are
        // noise — the outline is identity only
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button,input,textarea,select,svg,[data-euna-ignore]').forEach((x) => x.remove());
        const text = (clone.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90);
        if (text.length < 2 || outlineSeen(text)) continue;
        const kind = el.tagName === 'LI' ? 'row' : el.tagName === 'TH' ? 'col' : el.tagName.toLowerCase();
        outlineLines.push(`${kind}: ${text}`);
    }
    if (outlineLines.length) {
        lines.push('');
        lines.push('PAGE OUTLINE (structure — what the things above are):');
        for (const o of outlineLines) lines.push(`  ${o}`);
    }

    return { text: lines.join('\n'), entries };
}
