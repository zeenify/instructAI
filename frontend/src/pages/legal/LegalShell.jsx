import { Link } from 'react-router-dom';
import './LegalPage.css';

/**
 * Shared Paper & Ink shell for the Data Privacy Notice and Terms of Service.
 * Self-contained styling (LegalPage.css) — these routes are code-split, so
 * they must not depend on LandingPage.css being loaded first.
 */
export default function LegalShell({ kicker, title, version, children }) {
    return (
        <div className="legal-page">
            <header className="legal-top">
                <Link to="/" className="legal-logo" aria-label="Back to home">
                    <span className="legal-logo-mark">I<span className="legal-logo-dot">.</span></span>
                    <span className="legal-logo-word">InstructAI</span>
                </Link>
                <Link to="/" className="legal-back">← back to home</Link>
            </header>

            <main className="legal-doc">
                <p className="legal-kicker">{kicker}</p>
                <h1 className="legal-title">{title}</h1>
                <p className="legal-effective">
                    Effective {version} · Penaranda Senior High School · InstructAI pilot
                </p>
                <div className="legal-body">{children}</div>
            </main>

            <footer className="legal-foot">
                <Link to="/privacy" className="legal-foot-link">Data Privacy Notice</Link>
                <span className="legal-foot-sep">·</span>
                <Link to="/terms" className="legal-foot-link">Terms of Service</Link>
                <span className="legal-foot-sep">·</span>
                <Link to="/" className="legal-foot-link">Home</Link>
            </footer>
        </div>
    );
}
