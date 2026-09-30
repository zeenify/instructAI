/**
 * EUNA Pilot — router bridge
 *
 * The executor is vanilla JS (it must reach elements React doesn't know
 * about), but `goto` has to move the SPA. TeacherLayout registers its
 * react-router navigate here at mount.
 */

let navigateFn = null;

export function setPilotNavigator(fn) {
    navigateFn = fn;
}

export function pilotNavigate(path) {
    if (navigateFn) {
        navigateFn(path);
        return true;
    }
    // Last resort: full navigation (conversation survives via localStorage)
    window.location.assign(path);
    return false;
}
