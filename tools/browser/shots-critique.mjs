/** Screenshots for the teacher-eye critique: settled class 20 + a fresh empty class. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e.message).slice(0, 200)));

const loginRes = await fetch('http://localhost:8000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoketeacher@instructai.dev', password: 'SmokeTeacher123!' }),
});
const { token, user } = await loginRes.json();
await page.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'teacher');
    sessionStorage.setItem('user', JSON.stringify(u));
}, [token, user]);

// 1. settled class 20
await page.goto('http://localhost:5173/dashboard/teacher/class/20');
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/20-teachersettle.png` });

// 2. fresh empty class (auto-created course, zero modules) via API
const createRes = await fetch('http://localhost:8000/api/teacher/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'QA Empty Class', color: '#3e8e7e' }),
});
const cls = await createRes.json();
await page.goto(`http://localhost:5173/dashboard/teacher/class/${cls.id}`);
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/21-empty-class.png` });
await fetch(`http://localhost:8000/api/teacher/class/${cls.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
});

console.log('errors:', errors.length ? errors : '(none)');
await browser.close();
