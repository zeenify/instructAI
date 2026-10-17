// One-shot EUNA pilot audit verification — run, report, delete.
// Covers the four reported bugs: consent-before-drive, waiting-bar stop,
// typing bubble, auto-scroll, plus the ID-leak / lookup-robustness scenario.
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:8000/api';
const SHOTS = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots';
const stamp = Date.now().toString().slice(-5);
const CLASS_NAME = `EUNA Test ${stamp}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });

const out = { scenarios: {}, consoleErrors: [] };

try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type=email]', 'smoketeacher@instructai.dev');
    await page.fill('input[type=password]', 'SmokeTeacher123!');
    await page.click('.auth-submit');
    await page.waitForURL(/dashboard/, { timeout: 25000 });
    const token = await page.evaluate(() => localStorage.getItem('token'));
    const api = async (method, url, body) => {
        const r = await fetch(API + url, {
            method,
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
            body: body ? JSON.stringify(body) : undefined,
        });
        return { status: r.status, data: await r.json().catch(() => null) };
    };

    const uiState = () => page.evaluate(() => ({
        url: location.pathname,
        bar: !!document.querySelector('.euna-drive-bar'),
        barWaiting: !!document.querySelector('.euna-drive-bar.is-waiting'),
        barLabel: document.querySelector('.euna-drive-bar__label')?.textContent?.trim() || null,
        glow: !!document.querySelector('.euna-driving-glow'),
        lock: !!document.querySelector('.euna-driving-blocker'),
        consent: !!document.querySelector('.euna-consent'),
        typing: !!document.querySelector('.euna-typing'),
        typingText: document.querySelector('.euna-typing')?.textContent?.trim() || null,
        stepsCards: document.querySelectorAll('.euna-steps').length,
        status: document.querySelector('.euna-panel__status')?.textContent?.trim() || null,
        scrollGap: (() => { const el = document.querySelector('.euna-panel__body'); return el ? el.scrollHeight - el.scrollTop - el.clientHeight : null; })(),
        messages: [...document.querySelectorAll('.euna-msg--euna .euna-msg__text')].map((n) => n.textContent.slice(0, 300)),
        notices: [...document.querySelectorAll('.euna-notice span')].map((n) => n.textContent),
    }));

    const openPanel = async () => {
        if (!(await page.evaluate(() => !!document.querySelector('.euna-panel')))) {
            await page.click('.euna-fab');
            await page.waitForSelector('.euna-panel', { timeout: 5000 });
        }
    };
    const send = async (text) => {
        await openPanel();
        await page.fill('.euna-composer textarea', text);
        await page.press('.euna-composer textarea', 'Enter');
    };
    // Wait for the run to fully end (Ready + nothing pending), with samples
    const runToCompletion = async (timeoutMs, samples) => {
        const t0 = Date.now();
        let approved = false;
        while (Date.now() - t0 < timeoutMs) {
            const s = await uiState();
            samples?.push(s);
            if (s.consent && !approved) {
                approved = true;
                await page.click('.euna-consent .euna-btn--primary');
                await sleep(400);
                continue;
            }
            if (s.status === 'Ready' && !s.bar && !s.consent && approved !== null && (approved || s.messages.length)) {
                return s;
            }
            await sleep(500);
        }
        return null;
    };

    // ================= SCENARIO A: consent BEFORE any driving =================
    {
        const s = {};
        const pre = await api('GET', '/teacher/classes');
        const beforeIds = (pre.data || []).map((c) => c.id);

        await send(`Create a new class called ${CLASS_NAME}`);
        // Sample from the very first tick: nothing may drive before consent
        const samples = [];
        let consentSeen = false;
        s.navigatedBeforeConsent = false;
        s.droveBeforeConsent = false;
        s.executedBeforeConsent = false;
        s.typingSeen = false;
        const tA = Date.now();
        while (Date.now() - tA < 180000) {
            const st = await uiState();
            samples.push(st);
            if (st.typing) s.typingSeen = true;
            if (!st.consent) {
                if (st.url !== '/dashboard/teacher') s.navigatedBeforeConsent = true;
                if (st.lock || st.glow) s.droveBeforeConsent = true;
                if (st.stepsCards > 0) s.executedBeforeConsent = true;
            } else { consentSeen = true; s.atConsent = st; break; }
            await sleep(600);
        }
        s.consentAppeared = consentSeen;
        await page.screenshot({ path: `${SHOTS}/audit-1-consent.png` }).catch(() => {});

        // Waiting bar: close the panel, the floating bar with Stop must show
        if (consentSeen) {
            await page.click('.euna-iconbtn[title="Close"]');
            await sleep(400);
            const closed = await uiState();
            s.waitingBarWhenClosed = closed.bar && closed.barWaiting;
            s.waitingBarLabel = closed.barLabel;
            s.waitingBarHasStop = await page.evaluate(() => !!document.querySelector('.euna-drive-bar__stop'));
            await page.screenshot({ path: `${SHOTS}/audit-2-waiting-bar.png` }).catch(() => {});
            // Reopen via the bar's main button
            await page.click('.euna-drive-bar__main');
            await page.waitForSelector('.euna-panel', { timeout: 5000 });
        }

        // Approve and let it finish
        const finalA = await runToCompletion(300000, null);
        s.completed = !!finalA;
        s.finalUrl = finalA?.url;
        s.finalMessages = finalA?.messages;
        s.finalNotices = finalA?.notices;
        s.scrollGapAtEnd = finalA?.scrollGap;
        s.stuckToBottom = finalA ? finalA.scrollGap !== null && finalA.scrollGap < 8 : null;
        await page.screenshot({ path: `${SHOTS}/audit-3-final.png` }).catch(() => {});

        const post = await api('GET', '/teacher/classes');
        const created = (post.data || []).find((c) => c.name === CLASS_NAME);
        s.classCreated = !!created;
        s.createdId = created?.id ?? null;
        s.beforeCount = beforeIds.length;
        if (created) {
            const del = await api('DELETE', `/teacher/class/${created.id}`);
            s.cleanup = del.status;
        }
        out.scenarios.createClass = s;
    }

    // ============ SCENARIO B: score lookup — no ID leak, asks first ============
    {
        const s = {};
        await page.evaluate(() => { try { localStorage.removeItem('euna-pilot-thread'); } catch {} });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.euna-fab', { timeout: 15000 });

        await send('Show me the score of my student in the quiz');
        const finalB = await runToCompletion(240000, null);
        s.completed = !!finalB;
        s.messages = finalB?.messages || [];
        s.notices = finalB?.notices || [];
        s.asksClarification = s.messages.some((m) => /\?/.test(m) && /which|who|class|student|quiz|name/i.test(m));
        s.idLeak = /class\s*(?:ID|id)\s*\d+|student\s+(?:id|ID)\s*\d+|\(id\s*\d+\)/.test(s.messages.join(' '));
        s.droveInsteadOfAsking = (await uiState()).stepsCards > 0;
        s.scrollGapAtEnd = (await uiState()).scrollGap;
        await page.screenshot({ path: `${SHOTS}/audit-4-lookup-ask.png` }).catch(() => {});

        // Follow-up: the exact continuation the teacher reported ("the latest")
        await send(`Nina Reyes in asd, latest quiz`);
        const finalC = await runToCompletion(240000, null);
        s.followupCompleted = !!finalC;
        s.followupMessages = finalC?.messages || [];
        const lastReply = (s.followupMessages || []).slice(-1)[0] || '';
        s.mentionsLatestScore = /15/.test(lastReply) || /Python QA/i.test(lastReply);
        s.followupIdLeak = /class\s*(?:ID|id)\s*\d+|student\s+(?:id|ID)\s*\d+|\(id\s*\d+\)/.test(s.followupMessages.join(' '));
        s.followupScrollGap = (await uiState()).scrollGap;
        await page.screenshot({ path: `${SHOTS}/audit-5-lookup-answer.png` }).catch(() => {});
        out.scenarios.scoreLookup = s;
    }

    // ============ SCENARIO D: Stop from the waiting bar works =================
    {
        const s = {};
        await page.evaluate(() => { try { localStorage.removeItem('euna-pilot-thread'); } catch {} });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.euna-fab', { timeout: 15000 });

        await send('Take me to the Progress page');
        // Wait for consent, close panel, hit Stop ON THE BAR
        const t0 = Date.now();
        let stopped = false;
        while (Date.now() - t0 < 180000) {
            const st = await uiState();
            if (st.consent) {
                await page.click('.euna-iconbtn[title="Close"]');
                await sleep(300);
                await page.click('.euna-drive-bar__stop');
                stopped = true;
                break;
            }
            await sleep(600);
        }
        s.stopButtonWorked = stopped;
        await sleep(1500);
        const after = await uiState();
        s.noNavigation = after.url === '/dashboard/teacher';
        s.runEnded = after.status === 'Ready' && !after.bar && !after.consent;
        s.stopNotice = after.notices;
        out.scenarios.stopFromBar = s;
    }

    out.consoleErrors = consoleErrors.slice(0, 10);
} catch (e) {
    out.error = e.message;
    await page.screenshot({ path: `${SHOTS}/audit-ERROR.png` }).catch(() => {});
} finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
}
