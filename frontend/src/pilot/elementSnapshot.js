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

export const MAX_ELEMENTS = 140;
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

// A destructive control. The executor refuses to click these — the
// teacher's own hand always finishes destructive actions. "replace" is
// here deliberately: the AI Studio's "Replace them / Replace all" commit
// wipes a class's existing modules and questions, and an agent must never
// make that choice under a general wheel consent. Marking is by LABEL, not
// by dialog: per-row "Delete" buttons sit outside dialogs and are exactly
// the ones a driving agent fat-fingers (the repro deleted a quiz while
// trying to OPEN it — "Open" was invisible, "Delete" was right there).
const DESTRUCTIVE_WORDS = /\b(delete|remove|confirm|unpublish|archive|reset|revoke|kick|sign out|logout|replace|end room)\b/i;

// Capture window: the viewport plus a generous vertical margin. Controls
// that are merely scrolled out of view still EXIST — a snapshot that omits
// them teaches the model "this page has no Add-question control" while the
// control is one scroll away (the quiz-editor repro). The executor scrolls
// before clicking, so below-fold refs are fully actionable; entryLine flags
// them so the model knows a scroll is involved.
const CAPTURE_MARGIN = 1400;

function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return false;
    if (rect.bottom < -CAPTURE_MARGIN || rect.right < 0) return false;
    if (rect.top > window.innerHeight + CAPTURE_MARGIN || rect.left > window.innerWidth + 200) return false;
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
    // Scrolled out of view but present — the executor scrolls to refs
    // before acting, so this is a "you'll need to scroll" hint, not a limit
    if (rect.y > window.innerHeight) entry.belowFold = true;

    // Affordance signal: non-button elements the UI itself marks clickable
    // (cursor: pointer) — module title rows that expand, cards, selectable
    // rows. cursor inherits, so a title inside a pointer row reads pointer
    // too. Without this the pilot sees a heading and assumes it's inert.
    if (!el.matches('a,button,input,textarea,select')) {
        try {
            if (getComputedStyle(el).cursor === 'pointer') entry.clickable = true;
        } catch { /* detached — no style */ }
    }

    // Any control whose label is a destructive verb is flagged and blocked —
    // standalone per-row "Delete" buttons don't live in dialogs but get the
    // same protection as dialog confirms.
    if ((el.tagName === 'BUTTON' || role === 'button') && DESTRUCTIVE_WORDS.test(name)) {
        entry.dangerous = true;
    }

    return entry;
}

function entryLine(entry) {
    const parts = [`[${entry.ref}] ${entry.role}`];
    if (entry.name) parts.push(`"${entry.name}"`);
    if (entry.owner) parts.push(`↳ in "${entry.owner}"`);
    if (entry.href) parts.push(`→ ${entry.href}`);
    if (entry.clickable) parts.push('· clickable');
    if (entry.belowFold) parts.push('· below fold');
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

    // Pointer-origin cards are discovered FIRST (before refs are assigned)
    // so that every control inside them can be annotated with its owner —
    // with several draft cards on screen, four identical "Publish" buttons
    // are indistinguishable positions, and the model published the WRONG
    // draft. "[37] button Publish ↳ in Practice Task" removes the guess.
    const captured = new Set();
    const cardOwners = new Map();
    const declaresPointer = (el) => {
        try {
            if (getComputedStyle(el).cursor !== 'pointer') return false;
            const parent = el.parentElement;
            return !parent || getComputedStyle(parent).cursor !== 'pointer';
        } catch {
            return false;
        }
    };
    const cardNameOf = (el) => {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('button,input,textarea,select,svg,[data-euna-ignore]').forEach((x) => x.replaceWith(' '));
        return (clone.innerHTML.replace(/<[^>]*>/g, ' ') || '')
            .replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
    };
    for (const el of document.querySelectorAll('div,li,tr,td,span,p')) {
        if (cardOwners.size >= 24) break;
        if (el.closest('[data-euna-ignore]') || el.closest('[aria-hidden="true"]')) continue;
        if (el.matches('a,button,input,textarea,select,label,[role="button"],h1,h2,h3,h4')) continue;
        if (!isVisible(el) || !declaresPointer(el)) continue;
        // A pointer wrapper around form fields is noise — the field is the
        // actionable thing
        if (el.querySelector('input,textarea,select,[contenteditable="true"]')) continue;
        const name = cardNameOf(el);
        if (name.length < 2) continue;
        cardOwners.set(el, name);
    }
    const ownerOf = (el) => {
        let node = el.parentElement;
        while (node && node !== document.body) {
            const owner = cardOwners.get(node);
            if (owner) return owner;
            node = node.parentElement;
        }
        return null;
    };

    // Cap priority — interaction relevance, not DOM order:
    //   0. floating portals attached to body (calendars, dropdown menus —
    //      the freshest interaction surface; they render at the END of the
    //      DOM and DOM-order truncation cut exactly their day buttons)
    //   1. inside an open dialog/modal — the covered background is not
    //      what the teacher can act on right now
    //   2. the rest of the page (in-viewport before below-fold)
    const vh = window.innerHeight;
    const DIALOG_SEL = '[role="dialog"], [class*="modal"], .gen-overlay, [class*="gen-card"]';
    const rankOf = (el) => {
        const p = el.parentElement;
        if (p === document.body && getComputedStyle(el).position === 'fixed') return 0;
        if (el.closest(DIALOG_SEL)) return 1;
        return 2;
    };
    const ranked = candidates.map((el) => {
        const rect = el.getBoundingClientRect();
        return { el, rank: rankOf(el), top: rect.top };
    });
    ranked.sort(
        (a, b) =>
            a.rank - b.rank ||
            (a.top <= vh ? 0 : 1) - (b.top <= vh ? 0 : 1)
    );
    const ordered = ranked.map((c) => c.el);

    for (const el of ordered) {
        if (entries.length >= MAX_ELEMENTS) {
            // Don't just count the cut — NAME it. A bare "N more truncated"
            // hid exactly the controls the model was hunting for (the
            // add-question palette), sending it into scroll/snapshot loops
            // after a control that was in the DOM but out of its window.
            const cut = ordered.slice(entries.length);
            const names = new Map();
            for (const c of cut) {
                const n = (
                    c.getAttribute('aria-label') ||
                    (typeof c.innerText === 'string' ? c.innerText : '') ||
                    c.getAttribute('title') || c.getAttribute('placeholder') || ''
                ).trim().replace(/\s+/g, ' ').slice(0, 40);
                if (!n) continue;
                names.set(n, (names.get(n) || 0) + 1);
                if (names.size >= 6) break;
            }
            const preview = [...names.entries()].map(([n, k]) => (k > 1 ? `"${n}" ×${k}` : `"${n}"`)).join(', ').slice(0, 200);
            lines.push(`… (${cut.length} more truncated — including: ${preview || 'unnamed controls'})`);
            break;
        }
        const entry = describeElement(el, entries.length + 1);
        if (!entry.name && !entry.input && !entry.href) continue; // unnamed, unactionable
        const owner = ownerOf(el);
        if (owner) entry.owner = owner;
        entries.push(entry);
        captured.add(el);
        lines.push(entryLine(entry));
    }

    // Pointer-affordance rows get their refs here — the cards were already
    // discovered above (for owner annotation); the ROW opens the item while
    // the buttons inside it are per-item tools. Only the element that
    // DECLARES pointer (its parent doesn't inherit it) is captured, so a row
    // isn't duplicated by every child span that inherits the cursor.
    let pointerAdded = 0;
    for (const [el, name] of cardOwners) {
        if (entries.length >= MAX_ELEMENTS || pointerAdded >= 16) break;
        if (captured.has(el) || !isVisible(el)) continue;
        const entry = describeElement(el, entries.length + 1);
        entry.name = name;
        entries.push(entry);
        lines.push(entryLine(entry));
        pointerAdded += 1;
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
