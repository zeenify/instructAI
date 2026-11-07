// UI-only feature flags.
//
// Google sign-in is hidden: the pilot school admits accounts only through the
// LRN / teacher-whitelist gate, so the Google buttons are not shown anywhere.
// The backend endpoints stay live — flipping this to true restores the buttons
// with no other change.
export const GOOGLE_SIGNIN_VISIBLE = false;
