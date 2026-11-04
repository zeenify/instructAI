/**
 * The "I agree" gate every account-creation form requires (Terms of Service
 * + Data Privacy Notice, RA 10173). The server records the acceptance time
 * and policy version with the new account, so the checkbox here is the
 * user's half of that legal record — never submit without it.
 *
 * Links open in a new tab so a half-filled form is never lost, and (per the
 * HTML spec) a click on interactive content inside a <label> does not
 * toggle the checkbox.
 */
export default function ConsentCheckbox({ checked, onChange, disabled = false }) {
    return (
        <label className="auth-consent">
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                disabled={disabled}
            />
            <span className="auth-show-box" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 13 l5 5 L20 6" stroke="currentColor" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="auth-consent-text">
                I have read and agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="auth-consent-link">Terms of Service</a>
                {' '}and the{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="auth-consent-link">Data Privacy Notice</a>,
                and consent to the collection and processing of my personal data as described there.
            </span>
        </label>
    );
}
