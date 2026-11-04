import LegalShell from './LegalShell';

/**
 * Data Privacy Notice. The sign-up checkbox records acceptance of this
 * document (and the Terms) with a timestamp + version; keep the effective
 * date in sync with AuthController::CONSENT_VERSION when the substance
 * changes. Content is a school-pilot notice written around the Data
 * Privacy Act of 2012 (RA 10173).
 */
export default function PrivacyPolicyPage() {
    return (
        <LegalShell kicker="InstructAI · Data Privacy" title="Data Privacy Notice" version="4 November 2026">
            <div className="legal-note">
                <p>
                    <strong>The short version:</strong> we collect what the school needs to teach you —
                    your name, LRN, email, and the work you do in InstructAI. Your teachers see it.
                    We don't sell it, we don't run ads, and you can ask to see, correct, or delete
                    your data through your school at any time.
                </p>
            </div>

            <h2>1. Who we are</h2>
            <p>
                InstructAI is a learning platform built for <strong>Penaranda Senior High School</strong> as a
                school pilot. The school decides what is collected and why; the InstructAI team runs the
                platform for the school. This notice explains, in plain language, how your personal
                information is handled under the <strong>Data Privacy Act of 2012 (RA 10173)</strong>.
            </p>

            <h2>2. What we collect</h2>
            <ul>
                <li><strong>Account details</strong> — your name, school email address, and learner reference number (LRN). If you sign in with Google, we also receive your Google account email and profile picture.</li>
                <li><strong>Your schoolwork</strong> — the code you write and run, test-case results, quiz answers and scores, activities you submit, and lesson progress.</li>
                <li><strong>AI Tutor conversations</strong> — messages you exchange with the AI Tutor, kept so the feature works and so teachers can review how the tutor is helping.</li>
                <li><strong>Basic technical information</strong> — sign-in sessions and routine usage needed to keep the platform secure and working.</li>
            </ul>
            <p>We do not collect anything beyond what the pilot needs, and we do not use your data for advertising.</p>

            <h2>3. Why we collect it</h2>
            <ul>
                <li>To give you an account, verify you're on the school's enrollment list, and keep it secure.</li>
                <li>To teach and grade — lessons, coding exercises, quizzes, and feedback.</li>
                <li>To show you and your teachers your progress.</li>
                <li>To run your code and power the AI features you use.</li>
                <li>To let the school understand how the pilot is going, in aggregate.</li>
            </ul>

            <h2>4. Who can see it</h2>
            <ul>
                <li><strong>Your teachers</strong> see your work and results for the classes you're enrolled in.</li>
                <li><strong>The school admin</strong> manages accounts and the enrollment lists.</li>
                <li><strong>Service providers</strong> host and run the platform on our behalf (hosting, database, AI processing, file storage). They may only process data to provide those services — nothing else.</li>
            </ul>
            <p>We never sell your personal information, and we don't share it with advertisers.</p>

            <h2>5. How long we keep it</h2>
            <p>
                While you're part of the pilot and enrolled in the school, and for as long as the school
                needs it for teaching records. When the pilot ends or you leave, your data is deleted or
                anonymized, unless the school is required to keep specific records.
            </p>

            <h2>6. Your rights</h2>
            <p>Under the Data Privacy Act you have the right to:</p>
            <ul>
                <li>be told what data is collected and why (this notice);</li>
                <li>access a copy of your personal data;</li>
                <li>correct anything wrong;</li>
                <li>object to processing, or ask for erasure or blocking of your data;</li>
                <li>complain to the <strong>National Privacy Commission</strong> (privacy.gov.ph).</li>
            </ul>
            <p>
                To exercise any of these, ask your teacher or the school admin — the school handles these
                requests for the pilot. You can also reach the platform team at{' '}
                <a href="mailto:admin@instructai.dev">admin@instructai.dev</a>.
            </p>

            <h2>7. How we protect it</h2>
            <p>
                Data travels encrypted, access is limited to teachers of your classes and school
                administrators, and passwords are stored hashed — nobody, including us, can read them.
            </p>

            <h2>8. Students and consent</h2>
            <p>
                InstructAI is a school tool: registration is limited to students on Penaranda SHS's
                enrollment list, and accounts are created with an explicit consent checkbox. If you are a
                parent or guardian with questions about your child's data, please contact the school.
            </p>

            <h2>9. Changes to this notice</h2>
            <p>
                If this notice changes in a meaningful way, its version number and date change with it, and
                the school will tell you. The version shown at the top is the one that applied when you
                created your account.
            </p>
        </LegalShell>
    );
}
