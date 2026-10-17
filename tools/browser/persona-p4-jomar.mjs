// EUNA pilot — PERSONA RUNNER TEMPLATE.
//
// Impersonates one real, clueless user using the pilot chat in one continuous
// thread, and records EVERYTHING they saw: replies, tool steps, consent cards,
// the waiting bar, URLs, notices — into a JSON transcript.
//
// USAGE FOR A PERSONA AGENT:
//   1. Copy this file to tools/browser/persona-<yourid>.mjs
//   2. Edit ONLY the PERSONA block below (id/name/steps). Keep the engine
//      byte-identical — it is the proven capture machinery.
//   3. Run from tools/browser/:  node persona-<yourid>.mjs
//   4. Read the printed JSON + the transcript file, then report impressions.
//
// step.consent: 'approve' | 'decline' | 'close-then-approve' | null
//   null = the step should NOT trigger page-driving; if a consent card shows
//   anyway, the runner declines it and records it as unexpectedConsent (that
//   itself is a finding).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// ============================= EDIT ONLY THIS =============================
const PERSONA = {
    id: 'p4-jomar', // lowercase, no spaces
    name: 'Kuya Jomar',
    // One continuous thread, in order. Write these as the real person would
    // type them — typos, shorthand and all.
    steps: [
        { text: 'yo what is this thing', consent: null },
        { text: 'wait random but whos the president of the philippines rn', consent: null },
        { text: "ok but can u make my screen pink tho. like the whole monitor. that would be so funny lol", consent: null },
        { text: 'also are you single lol', consent: null },
        { text: 'asdfghjkl', consent: null },
        { text: "ok ok real talk. which of my students is doing the worst. im doing my practicum hrs rn and i gotta know whos falling behind", consent: null },
        { text: 'ight thanks gtg', consent: null },
    ],
};
// =========================== END PERSONA BLOCK =============================

const BASE = 'http://localhost:5173';
const SHOTS = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots';
const OUT = `C:/Users/EDRICK/AppData/Local/Temp/euna-persona-${PERSONA.id}.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const transcript = {
    persona: { id: PERSONA.id, name: PERSONA.name },
    startedAt: new Date().toISOString(),
    steps: [],
    flags: {},
    classesSnapshot: null,
    error: null,
};

try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type=email]', 'smoketeacher@instructai.dev');
    await page.fill('input[type=password]', 'SmokeTeacher123!');
    await page.click('.auth-submit');
    await page.waitForURL(/dashboard/, { timeout: 25000 });

    await page.evaluate(() => { try { localStorage.removeItem('euna-pilot-thread'); } catch {} });
    await page.goto(BASE + '/dashboard/teacher', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.euna-fab', { timeout: 15000 });
    await page.click('.euna-fab');
    await page.waitForSelector('.euna-panel', { timeout: 5000 });

    const state = () => page.evaluate(() => ({
        url: location.pathname,
        status: document.querySelector('.euna-panel__status')?.textContent?.trim() || null,
        bar: !!document.querySelector('.euna-drive-bar'),
        barWaiting: !!document.querySelector('.euna-drive-bar.is-waiting'),
        lock: !!document.querySelector('.euna-driving-blocker'),
        consent: !!document.querySelector('.euna-consent'),
        consentText: document.querySelector('.euna-consent')?.textContent?.trim() || null,
        typing: !!document.querySelector('.euna-typing'),
        notices: [...document.querySelectorAll('.euna-notice span')].map((n) => n.textContent),
        msgs: [...document.querySelectorAll('.euna-msg--euna .euna-msg__text:not(.euna-typing)')]
            .map((n) => n.textContent.trim()),
        steps: [...document.querySelectorAll('.euna-steps__list li')].map((n) => n.textContent.trim()),
        stopBtn: [...document.querySelectorAll('.euna-drive-bar button')]
            .some((b) => /stop/i.test(b.textContent)),
        fabBadge: !!document.querySelector('.euna-fab__badge'),
    }));

    transcript.flags.droveWithoutConsent = false;
    transcript.flags.unexpectedConsent = 0;

    for (let i = 0; i < PERSONA.steps.length; i++) {
        const step = PERSONA.steps[i];
        const rec = {
            sent: step.text,
            consentPolicy: step.consent ?? null,
            replies: [], toolSteps: [], notices: [],
            consent: null, waitingBar: null, urlAfter: null, stateAfter: null,
            timedOut: false, screenshot: null,
        };

        const base = await state();
        const baseMsgs = base.msgs.length;
        const baseSteps = base.steps.length;
        const baseNotices = base.notices.length;

        await page.fill('.euna-composer textarea', step.text);
        await page.press('.euna-composer textarea', 'Enter');

        const t0 = Date.now();
        let decided = false;
        let decidedAt = 0;
        let declinedNow = false;
        while (Date.now() - t0 < 150000) {
            const st = await state();
            if (st.lock && !decided && step.consent === null) transcript.flags.droveWithoutConsent = true;

            if (st.consent && !decided) {
                decided = true;
                decidedAt = Date.now();
                rec.consent = {
                    asked: true,
                    explain: st.consentText,
                    policy: step.consent ?? null,
                    decision: null,
                };
                if (step.consent === null) {
                    rec.consent.decision = 'declined (unexpected for this step)';
                    transcript.flags.unexpectedConsent += 1;
                    declinedNow = true;
                    await page.click('.euna-consent .euna-btn:not(.euna-btn--primary)');
                    await sleep(800);
                } else if (step.consent === 'approve') {
                    rec.consent.decision = 'approved';
                    await page.click('.euna-consent .euna-btn--primary');
                    await sleep(800);
                } else if (step.consent === 'decline') {
                    rec.consent.decision = 'declined';
                    declinedNow = true;
                    await page.click('.euna-consent .euna-btn:not(.euna-btn--primary)');
                    await sleep(800);
                } else if (step.consent === 'close-then-approve') {
                    await page.click('.euna-panel [aria-label="Close"]');
                    await sleep(900);
                    const closed = await state();
                    rec.waitingBar = {
                        barVisible: closed.bar,
                        waiting: closed.barWaiting,
                        stopButton: closed.stopBtn,
                        fabBadge: closed.fabBadge,
                        url: closed.url,
                    };
                    await page.screenshot({ path: `${SHOTS}/persona-${PERSONA.id}-${i}-waitingbar.png` }).catch(() => {});
                    await page.click('.euna-drive-bar__main');
                    await sleep(600);
                    rec.consent.decision = 'approved (after closing panel)';
                    await page.click('.euna-consent .euna-btn--primary');
                    await sleep(800);
                }
                continue;
            }

            const quiet = st.status === 'Ready' && !st.bar && !st.consent && !st.typing;
            const newReply = st.msgs.length > baseMsgs;
            const declineSettled = declinedNow && quiet && Date.now() - decidedAt > 6000 && st.msgs.length >= baseMsgs;

            if (quiet && (newReply || declineSettled)) {
                // settle-beat: re-read once; a trailing turn must not slip past
                await sleep(1500);
                const st2 = await state();
                const quiet2 = st2.status === 'Ready' && !st2.bar && !st2.consent && !st2.typing;
                if (!quiet2 || st2.msgs.length < baseMsgs) continue;

                rec.replies = st2.msgs.slice(baseMsgs);
                rec.toolSteps = st2.steps.slice(baseSteps);
                rec.notices = st2.notices.slice(baseNotices);
                rec.urlAfter = st2.url;
                rec.stateAfter = { status: st2.status, bar: st2.bar, lock: st2.lock };
                break;
            }
            await sleep(600);
        }
        if (!rec.stateAfter) {
            rec.timedOut = true;
            const st = await state();
            rec.stateAfter = { status: st.status, bar: st.bar, consent: st.consent, typing: st.typing };
            rec.replies = st.msgs.slice(baseMsgs);
            rec.toolSteps = st.steps.slice(baseSteps);
            rec.notices = st.notices.slice(baseNotices);
            rec.urlAfter = st.url;
        }
        rec.screenshot = `shots/persona-${PERSONA.id}-${i}.png`;
        await page.screenshot({ path: `${SHOTS}/persona-${PERSONA.id}-${i}.png` }).catch(() => {});
        transcript.steps.push(rec);
    }

    // Ground truth for the verifier: what the teacher actually has right now
    const token = await page.evaluate(() => localStorage.getItem('token'));
    if (token) {
        transcript.classesSnapshot = await page.evaluate(async (t) => {
            try {
                const r = await fetch('http://localhost:8000/api/teacher/classes', {
                    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
                });
                const rows = await r.json();
                return (Array.isArray(rows) ? rows : rows.data || []).map((c) => ({
                    id: c.id, name: c.name, students: c.students_count ?? c.students?.length ?? null,
                    modules: c.modules_count ?? null, ungraded: c.ungraded_submissions ?? null,
                }));
            } catch { return null; }
        }, token).catch(() => null);
    }

    const allMsgs = transcript.steps.flatMap((s) => s.replies).join(' | ');
    transcript.flags.idLeak = /class\s*(?:ID|id)\s*\d+|\(id\s*\d+\)/.test(allMsgs);
    transcript.flags.refLeak = /\[\d+\]|ref \d+/i.test(allMsgs);
    transcript.finishedAt = new Date().toISOString();
    writeFileSync(OUT, JSON.stringify(transcript, null, 2));
    console.log(JSON.stringify(transcript, null, 2));
    console.log(`\n[persona] transcript written to ${OUT}`);
} catch (e) {
    transcript.error = e.message;
    try { writeFileSync(OUT, JSON.stringify(transcript, null, 2)); } catch {}
    console.log(JSON.stringify(transcript, null, 2));
    console.log(`\n[persona] ERROR: ${e.message}`);
} finally {
    await browser.close();
}
