/**
 * EUNA Pilot — in-flight network counter
 *
 * Counts pending fetch/XHR so the executor's settle can tell a
 * quiet-but-loading page from a genuinely idle one. On this deployment
 * every API call costs ~2.4s to the remote Neon DB — DOM quiescence alone
 * snapshots mid-fetch states (the new module row "rendered late" on every
 * create, because the settle broke before the POST's refetch landed).
 *
 * Installed once, at pilot load — it wraps window.fetch and XHR globally.
 */

let pending = 0;

export const netPending = () => pending;

let installed = false;

export function installNetWatch() {
    if (installed || typeof window === 'undefined') return;
    installed = true;

    const origFetch = window.fetch?.bind(window);
    if (origFetch) {
        window.fetch = (...args) => {
            pending += 1;
            return origFetch(...args).finally(() => {
                pending = Math.max(0, pending - 1);
            });
        };
    }

    const OrigOpen = XMLHttpRequest.prototype.open;
    const OrigSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (...args) {
        this.__eunaTracked = true;
        return OrigOpen.apply(this, args);
    };
    XMLHttpRequest.prototype.send = function (...args) {
        if (this.__eunaTracked) {
            pending += 1;
            this.addEventListener('loadend', () => {
                pending = Math.max(0, pending - 1);
            });
        }
        return OrigSend.apply(this, args);
    };
}
