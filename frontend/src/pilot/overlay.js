/**
 * EUNA Pilot — takeover overlay
 *
 * The "alive" layer: a virtual cursor that glides across the real page, a
 * rotating-gradient highlight around the element about to be acted on, and a
 * pulse ring on click. Pure DOM + rAF (imperative by nature), styled by
 * pilot.css. Everything is pointer-events:none — the teacher's mouse is never
 * captured.
 */

let root = null;
let cursorEl = null;
let cursorLabelEl = null;
let highlightEl = null;
let highlightInner = null;
let pulseEl = null;

let cursorPos = { x: -100, y: -100 };
let rafId = null;
let highlightSync = null;
let labelTimer = null;

const CURSOR_STEP_MS = 16;
const GLIDE_DEFAULT_MS = 720;

function ensureRoot() {
    if (root && document.body.contains(root)) return root;
    root = document.createElement('div');
    root.id = 'euna-pilot-overlay-root';
    root.setAttribute('data-euna-ignore', '');
    root.setAttribute('aria-hidden', 'true');

    cursorEl = document.createElement('div');
    cursorEl.className = 'euna-cursor';
    cursorEl.innerHTML = `
        <span class="euna-cursor__arrow">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M8 4 L32 20 L20.5 22.5 L26 33.5 L21.5 35.5 L16 24.5 L8 31 Z"
                    fill="currentColor" stroke="#fff" stroke-width="1.6"
                    stroke-linejoin="round"/>
            </svg>
            <svg class="euna-cursor__spark" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 0 L8.6 5.4 L14 7 L8.6 8.6 L7 14 L5.4 8.6 L0 7 L5.4 5.4 Z" fill="currentColor"/>
            </svg>
        </span>
        <span class="euna-cursor__label"></span>`;
    cursorLabelEl = cursorEl.querySelector('.euna-cursor__label');

    highlightEl = document.createElement('div');
    highlightEl.className = 'euna-highlight';
    highlightEl.innerHTML = `
        <svg width="100%" height="100%" preserveAspectRatio="none">
            <defs>
                <linearGradient id="euna-hl-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="220" y2="60">
                    <stop offset="0%" stop-color="#6cc5ad"/>
                    <stop offset="33%" stop-color="#5fbcff"/>
                    <stop offset="66%" stop-color="#3974ff"/>
                    <stop offset="100%" stop-color="#ff4b26"/>
                    <animateTransform attributeName="gradientTransform" type="rotate"
                        from="0 110 30" to="360 110 30" dur="4s" repeatCount="indefinite"/>
                </linearGradient>
            </defs>
            <rect class="euna-highlight__aura" x="2" y="2" rx="10" fill="none"
                stroke="url(#euna-hl-grad)" stroke-width="6"/>
            <rect class="euna-highlight__edge" x="2" y="2" rx="10" fill="none"
                stroke="url(#euna-hl-grad)" stroke-width="2.2"/>
        </svg>`;
    highlightInner = highlightEl.querySelector('.euna-highlight__aura');

    pulseEl = document.createElement('div');
    pulseEl.className = 'euna-pulse';

    root.append(highlightEl, cursorEl, pulseEl);
    document.body.appendChild(root);
    return root;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function animateCursorTo(x, y, durationMs) {
    return new Promise((resolve) => {
        const from = { ...cursorPos };
        const dist = Math.hypot(x - from.x, y - from.y);
        // A slower, more deliberate glide — the old 1.6px/ms read as a
        // teleport; a teacher watching should see WHERE it went.
        const dur = durationMs ?? Math.min(1150, Math.max(460, dist * 2.4));
        const start = performance.now();

        if (rafId) cancelAnimationFrame(rafId);
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            if (rafId) cancelAnimationFrame(rafId);
            rafId = null;
            resolve();
        };
        const step = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const e = easeOutCubic(t);
            cursorPos = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
            cursorEl.style.transform = `translate3d(${cursorPos.x}px, ${cursorPos.y}px, 0)`;
            if (t < 1) {
                rafId = requestAnimationFrame(step);
            } else {
                finish();
            }
        };
        rafId = requestAnimationFrame(step);
        // rAF is throttled to zero in hidden/backgrounded tabs — without
        // this wall-clock fallback a hidden pane wedges the entire driving
        // batch (the glide promise never resolves, and no watchdog covers
        // batch execution).
        setTimeout(finish, dur + 400);
    });
}

/** Show the cursor at its current position (first appearance enters with a pop). */
export function showCursor(mode = 'default') {
    ensureRoot();
    if (mode) setCursorMode(mode);
    if (!cursorEl.classList.contains('is-shown')) {
        cursorEl.classList.add('is-shown');
        const arrow = cursorEl.querySelector('.euna-cursor__arrow');
        arrow.classList.add('is-entering');
        setTimeout(() => arrow.classList.remove('is-entering'), 320);
    }
}

export function setCursorMode(mode) {
    if (!cursorEl) return;
    cursorEl.classList.remove('euna-cursor--default', 'euna-cursor--point', 'euna-cursor--danger', 'euna-cursor--acting');
    cursorEl.classList.add(`euna-cursor--${mode}`);
}

/** Glide the cursor to a viewport point; optional label rides along. */
export async function moveCursorTo(x, y, { label, mode, durationMs } = {}) {
    showCursor(mode);
    if (label) {
        cursorLabelEl.textContent = label;
        cursorEl.classList.add('euna-cursor--labelled');
        clearTimeout(labelTimer);
        labelTimer = setTimeout(() => cursorEl.classList.remove('euna-cursor--labelled'), 2600);
    }
    await animateCursorTo(x, y, durationMs ?? (label ? GLIDE_DEFAULT_MS : undefined));
}

export async function hideCursor() {
    if (!cursorEl) return;
    cursorEl.classList.remove('is-shown', 'euna-cursor--labelled');
    cursorPos = { x: -100, y: -100 };
    cursorEl.style.transform = 'translate3d(-100px, -100px, 0)';
}

/** Draw the rotating-gradient highlight around an element (or rect). */
export function showHighlight(target) {
    ensureRoot();
    const rect = target.getBoundingClientRect();
    const pad = 3;
    positionHighlight(rect, pad);
    highlightEl.classList.add('is-visible');

    // Keep it glued to the element while visible (scroll, layout shifts)
    clearInterval(highlightSync);
    highlightSync = setInterval(() => {
        if (!document.body.contains(target)) return hideHighlight();
        positionHighlight(target.getBoundingClientRect(), pad);
    }, 120);
}

function positionHighlight(rect, pad) {
    highlightEl.style.top = `${rect.top - pad}px`;
    highlightEl.style.left = `${rect.left - pad}px`;
    highlightEl.style.width = `${rect.width + pad * 2}px`;
    highlightEl.style.height = `${rect.height + pad * 2}px`;
    highlightInner.setAttribute('rx', '12');
}

export function hideHighlight() {
    if (!highlightEl) return;
    clearInterval(highlightSync);
    highlightSync = null;
    highlightEl.classList.remove('is-visible');
}

/** Click feedback: recoil the cursor + fire the pulse ring. */
export function pulseAt(x, y) {
    ensureRoot();
    pulseEl.style.transform = `translate3d(${x - 32}px, ${y - 32}px, 0)`;
    pulseEl.classList.remove('is-firing');
    // restart the animation
    void pulseEl.offsetWidth;
    pulseEl.classList.add('is-firing');
    if (cursorEl) {
        cursorEl.classList.add('euna-cursor--acting');
        setTimeout(() => cursorEl && cursorEl.classList.remove('euna-cursor--acting'), 380);
    }
}

export function destroyOverlay() {
    clearInterval(highlightSync);
    if (rafId) cancelAnimationFrame(rafId);
    if (root) root.remove();
    root = cursorEl = highlightEl = pulseEl = highlightInner = null;
    cursorPos = { x: -100, y: -100 };
}

/** Viewport center point of an element (where the cursor tip should land). */
export function centerOf(el) {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}
