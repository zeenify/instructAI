/** Screenshots of the lesson editor for critique rounds (dark + light). */
import { chromium } from 'playwright';

const API = 'http://localhost:8000/api';
const OUT = 'C:/Users/EDRICK/AppData/Local/Temp/module-shots';
const LESSON_URL = process.argv[2] || 'http://localhost:5173/dashboard/teacher/class/20/lesson/611';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];

const loginRes = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoketeacher@instructai.dev', password: 'SmokeTeacher123!' }),
});
const { token, user } = await loginRes.json();

for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    page.on('pageerror', (e) => errors.push(`PAGEERROR[${theme}]: ` + String(e.message).slice(0, 200)));
    await page.addInitScript(([t, u, th]) => {
        localStorage.setItem('token', t);
        localStorage.setItem('role', 'teacher');
        localStorage.setItem('theme-preference', th);
        sessionStorage.setItem('user', JSON.stringify(u));
    }, [token, user, theme]);

    await page.goto(LESSON_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.le-title-input', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${theme}-lesson-editor.png` });
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${theme}-lesson-editor-scrolled.png` });
    await page.close();
}
console.log('errors:', errors.length ? errors : '(none)');
await browser.close();
