/**
 * Mobile-responsiveness audit — drives the app at phone/tablet widths and
 * reports horizontal overflow, off-screen elements and console errors per page.
 * Screenshots land in tools/browser/shots-mobile/ (gitignored).
 *
 * Usage: node mobile-audit.mjs            (teacher pages, 390px + 768px)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots-mobile';
const API = 'http://localhost:8000/api';
const APP = 'http://localhost:5173';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];

// --- auth: token via API, injected before any app code runs ---
const loginRes = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoketeacher@instructai.dev', password: 'SmokeTeacher123!' }),
});
const { token, user } = await loginRes.json();
if (!token) { console.error('LOGIN FAILED', await loginRes.text().slice(0, 300)); process.exit(1); }
const H = { Authorization: `Bearer ${token}` };

// --- resolve real ids from the API (prefer a class with a populated module) ---
const classesRes = await fetch(`${API}/teacher/classes`, { headers: H }).then((r) => r.json());
const classesArr = Array.isArray(classesRes) ? classesRes : (classesRes.data || classesRes.classes || []);
let classId, mod, lesson, quiz;
for (const c of classesArr) {
    const cls = await fetch(`${API}/teacher/classes/${c.id}`, { headers: H }).then((r) => r.json());
    const m = (cls.courses || []).flatMap((co) => co.modules || []).find((mm) => (mm.lessons || []).length && (mm.quizzes || []).length);
    if (m) { classId = c.id; mod = m; lesson = m.lessons[0]; quiz = m.quizzes[0]; break; }
    if (!classId) { classId = c.id; mod = ((cls.courses || [])[0]?.modules || [])[0] || {}; }
}
if (!mod?.lessons?.length) { console.error('No populated module found — seed content first'); process.exit(1); }
console.log({ classId, moduleId: mod.id, lessonId: lesson.id, quizId: quiz.id });

const targets = [
    ['class', `${APP}/dashboard/teacher/class/${classId}`],
    ['content', `${APP}/dashboard/teacher/class/${classId}?tab=content`],
    ['module', mod.id ? `${APP}/dashboard/teacher/class/${classId}?tab=content&module=${mod.id}` : null],
    ['lesson', lesson.id ? `${APP}/dashboard/teacher/class/${classId}/lesson/${lesson.id}` : null],
    ['quiz', quiz.id ? `${APP}/dashboard/teacher/class/${classId}/quiz/${quiz.id}` : null],
].filter(([_, url]) => url);

const browser = await chromium.launch({ channel: 'msedge', headless: true });

for (const [width, height, tag] of [[390, 844, 'm'], [768, 1024, 't']]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`[${tag}] ${msg.text().slice(0, 200)}`); });
    page.on('pageerror', (e) => errors.push(`[${tag}] PAGEERROR: ${String(e.message).slice(0, 200)}`));
    await page.addInitScript(([t, u]) => {
        localStorage.setItem('token', t);
        localStorage.setItem('role', 'teacher');
        sessionStorage.setItem('user', JSON.stringify(u));
    }, [token, user]);

    for (const [name, url] of targets) {
        await page.goto(url);
        // wait for real data (skeletons gone) before measuring/shooting
        await page
            .waitForFunction(() => !document.querySelector('.db-skeleton'), null, { timeout: 15000 })
            .catch(() => console.log(`[${tag}] ${name}: skeletons still visible after 15s`));
        await page.waitForTimeout(900);
        const m = await page.evaluate(() => {
            const vw = window.innerWidth;
            const doc = document.documentElement;
            const overflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw;
            const seen = new Set();
            const wide = [];
            document.querySelectorAll('body *').forEach((el) => {
                const r = el.getBoundingClientRect();
                if (r.width < 4) return;
                if (r.right > vw + 2 || r.left < -2) {
                    const c = String(typeof el.className === 'string' ? el.className : el.className?.baseVal ?? '').trim();
                    const key = c || el.tagName;
                    if (seen.has(key)) return;
                    seen.add(key);
                    wide.push(`${el.tagName.toLowerCase()}${c ? '.' + c.split(' ').slice(0, 3).join('.') : ''} L${Math.round(r.left)} R${Math.round(r.right)} "${(el.textContent || '').trim().slice(0, 30)}"`);
                }
            });
            return { overflow, sw: Math.max(doc.scrollWidth, document.body.scrollWidth), wide: wide.slice(0, 14) };
        });
        console.log(`[${tag} ${width}] ${name}: overflowX=${m.overflow}px (scrollW=${m.sw}, vw=${width}) wideEls=${m.wide.length}`);
        m.wide.forEach((w) => console.log('   · ' + w));
        await page.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: true });
    }
    await page.close();
}

console.log('=== CONSOLE ERRORS ===');
errors.length ? errors.forEach((e) => console.log('- ' + e)) : console.log('(none)');
await browser.close();
