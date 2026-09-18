/**
 * Opens a visible (headed) Edge window, pre-authenticated as the smoke student,
 * on the student class page — for the user to inspect personally.
 * The process stays alive so the browser stays open. Ctrl+C / close window to end.
 */
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: false });

const loginRes = await fetch('http://localhost:8000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smokestudent1@instructai.dev', password: 'SmokeStudent123!' }),
});
const { token, user } = await loginRes.json();

const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
await context.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'student');
    sessionStorage.setItem('user', JSON.stringify(u));
}, [token, user]);

const page = await context.newPage();
await page.goto('http://localhost:5173/dashboard/student/class/20');

// keep the process alive so the browser stays open for the user
await new Promise(() => {});
