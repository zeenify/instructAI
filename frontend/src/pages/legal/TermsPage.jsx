import LegalShell from './LegalShell';

/**
 * Terms of Service. Accepted together with the Data Privacy Notice via the
 * sign-up checkbox (see AuthController::CONSENT_VERSION for the version
 * stamp stored with each account).
 */
export default function TermsPage() {
    return (
        <LegalShell kicker="InstructAI · Terms" title="Terms of Service" version="4 November 2026">
            <div className="legal-note">
                <p>
                    <strong>The short version:</strong> use InstructAI for learning, do your own work, keep
                    your account to yourself, and be kind. The school can disable accounts that misuse
                    the platform.
                </p>
            </div>

            <h2>1. Accepting these terms</h2>
            <p>
                By ticking the consent checkbox and creating an account, you agree to these Terms of
                Service and to the <a href="/privacy">Data Privacy Notice</a>. If you're a student under
                18, this happens as part of a school activity with the school's supervision.
            </p>

            <h2>2. Your account</h2>
            <ul>
                <li>Register with your real details. The LRN you use must be yours and must be on the school's enrollment list.</li>
                <li>Keep your password to yourself — you're responsible for what happens on your account.</li>
                <li>One account per person. Don't create accounts for others or let others use yours.</li>
                <li>Tell your teacher or the school admin right away if you think someone else got into your account.</li>
            </ul>

            <h2>3. Using InstructAI fairly</h2>
            <p>InstructAI is a learning tool. When you use it, you agree not to:</p>
            <ul>
                <li><strong>Break academic integrity rules</strong> — including sharing quiz questions or answers with classmates who haven't taken the quiz yet. Quiz results are released by your teacher on purpose; don't work around that.</li>
                <li>Copy someone else's work and submit it as your own.</li>
                <li>Try to break, hack, overload, or probe the platform (or the code execution engine) outside of what your lessons ask you to do.</li>
                <li>Upload or generate content that is illegal, harmful, or harassing.</li>
                <li>Use the AI Tutor to do graded work for you where the activity says AI assistance isn't allowed.</li>
            </ul>

            <h2>4. Your work and school content</h2>
            <p>
                The code and answers you create are <strong>yours</strong>. You give the school permission
                to store, review, and grade them as part of teaching — that's what the platform is for.
                Lessons, quizzes, and course materials belong to the school and its teachers.
            </p>

            <h2>5. The AI Tutor</h2>
            <p>
                The AI Tutor is a study aid, not an authority — it can be wrong, and you should check its
                answers. Your conversations with it are stored (see the{' '}
                <a href="/privacy">Data Privacy Notice</a>) and may be reviewed by teachers to improve
                the feature.
            </p>

            <h2>6. Availability during the pilot</h2>
            <p>
                InstructAI is provided as-is during the school pilot. Features may change, and there may
                be downtime — especially for code execution and AI features, which depend on external
                services. Always keep your own copies of important work.
            </p>

            <h2>7. Suspension</h2>
            <p>
                The school admin can disable an account that violates these terms or is used in a way
                that harms other students or the platform.
            </p>

            <h2>8. Changes to these terms</h2>
            <p>
                If these terms change in a meaningful way, the version and date at the top change too,
                and the school will let you know. Continuing to use InstructAI after that means you
                accept the new version.
            </p>

            <h2>9. Questions</h2>
            <p>
                Ask your teacher or the school admin, or email the platform team at{' '}
                <a href="mailto:admin@instructai.dev">admin@instructai.dev</a>.
            </p>
        </LegalShell>
    );
}
