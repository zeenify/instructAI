/**
 * Reproduces the class-switch cache glitch:
 * class A -> class B -> back to class A, sampling module-card presence
 * over time to catch the disappear/reappear.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const timeline = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e.message).slice(0, 200)));
page.on('request', (r) => { if (r.url().includes(':8000') && r.method() !== 'GET') timeline.push(`req ${r.method()} ${r.url().slice(21)}`); });

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

// settle on class 20 (Smoke Test Class)
await page.goto('http://localhost:5173/dashboard/teacher/class/20');
await page.waitForTimeout(2500);
const urlOf = () => page.url();

// switch to another class via the sidebar (the second class link)
const sidebarLinks = page.locator('.db-sidebar a[href*="/class/"]');
const other = sidebarLinks.nth(1);
const otherName = await other.textContent();
await other.click();
await page.waitForTimeout(2000);
console.log('switched to:', otherName?.trim(), '|', urlOf());

// switch back
await sidebarLinks.first().click();
console.log('back to:', urlOf());

// sample module-card + toolbar presence every 250ms for 5s
const t0 = Date.now();
for (let i = 0; i < 24; i++) {
    const cards = await page.locator('.cd-mod').count();
    const toolbar = await page.locator('.cd-ctoolbar').count();
    const skeletons = await page.locator('.db-skeleton').count();
    timeline.push(`t+${String(Date.now() - t0).padStart(4)}ms  cards=${cards} toolbar=${toolbar} skel=${skeletons}`);
    if (i === 1) await page.screenshot({ path: `${OUT}/10-switch-early.png` });
    await page.waitForTimeout(i < 8 ? 100 : 300);
}

// also capture the wire for the same period already recorded
console.log('=== TIMELINE ===');
timeline.forEach((t) => console.log(t));
console.log('=== CONSOLE ERRORS ===');
errors.length ? errors.forEach((e) => console.log('- ' + e)) : console.log('(none)');
await page.screenshot({ path: `${OUT}/11-switch-final.png` });
await browser.close();
