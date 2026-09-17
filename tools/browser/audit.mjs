/**
 * Real-browser audit of the class content page (/dashboard/teacher/class/20).
 * Drives the system Edge via Playwright (channel: msedge) — not the embedded browser.
 * Captures screenshots + console errors through the key interactions.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const notes = [];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e.message).slice(0, 300)));
page.on('requestfailed', (r) => {
    if (r.url().includes(':8000')) errors.push(`REQFAILED: ${r.method()} ${r.url()} → ${r.failure()?.errorText}`);
});

// --- auth: token via API, injected before any app code runs ---
const loginRes = await fetch('http://localhost:8000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'smoketeacher@instructai.dev', password: 'SmokeTeacher123!' }),
});
const { token, user } = await loginRes.json();
if (!token) { console.error('LOGIN FAILED'); process.exit(1); }
await page.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'teacher');
    sessionStorage.setItem('user', JSON.stringify(u));
}, [token, user]);

// --- 1. early load: catch skeleton stacking ---
await page.goto('http://localhost:5173/dashboard/teacher/class/20');
await page.waitForTimeout(350);
await page.screenshot({ path: `${OUT}/01-early.png` });
const earlySkeletonCount = await page.locator('.db-skeleton').count();

// --- 2. settled load ---
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/02-settled.png`, fullPage: false });
const chip = (await page.locator('.cd-live').textContent().catch(() => null))?.trim();
notes.push(`settled: live-chip="${chip}", skeletons on page=${await page.locator('.db-skeleton').count()}`);

// --- 3. Go Live flow (reset to draft first so the action is deterministic) ---
let coursePublishState = null;
let publishAllStatus = null;
let publishAllBody = null;
page.on('response', async (res) => {
    if (res.url().includes('/teacher/courses/') && res.request().method() === 'GET') {
        try { coursePublishState = (await res.json()).is_published; } catch {}
    }
    if (res.url().includes('/publish-all')) {
        publishAllStatus = res.status();
        try { publishAllBody = (await res.text()).slice(0, 120); } catch {}
    }
});

const classId = 20;
const cls = await (await fetch(`http://localhost:8000/api/teacher/classes/${classId}`, {
    headers: { Authorization: `Bearer ${token}` },
})).json();
const courseId = cls.courses[0].id;
await fetch(`http://localhost:8000/api/teacher/courses/${courseId}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ is_published: false }),
});
await page.reload();
await page.waitForTimeout(2000);
notes.push(`pre-click: live-chip="${(await page.locator('.cd-live').textContent().catch(() => null))?.trim()}" (expect Draft)`);

const goLive = page.getByRole('button', { name: /Go Live/i });
if (await goLive.count()) {
    const wire = [];
    page.on('request', (r) => { if (r.url().includes(':8000')) wire.push(`→ ${r.method()} ${r.url().slice(21)}`); });
    page.on('response', (r) => { if (r.url().includes(':8000')) wire.push(`← ${r.status()} ${r.url().slice(21)}`); });
    await goLive.click();
    let chipAfter = null;
    for (let i = 0; i < 16; i++) {
        await page.waitForTimeout(500);
        chipAfter = (await page.locator('.cd-live').textContent().catch(() => null))?.trim();
        if (chipAfter === 'Live') break;
    }
    wire.forEach((w) => notes.push('wire ' + w));
    notes.push(`after Go Live: live-chip="${chipAfter}" (expect Live, polled up to 8s)`);
    // server-side truth, independent of the browser
    const truth = await (await fetch(`http://localhost:8000/api/teacher/courses/${courseId}`, {
        headers: { Authorization: `Bearer ${token}` },
    })).json();
    notes.push(`server truth after click: course is_published=${truth.is_published}`);
    await page.screenshot({ path: `${OUT}/03-golive.png` });
    // back to draft to leave state as found
    const unpublish = page.getByRole('button', { name: /Unpublish/i });
    if (await unpublish.count()) {
        await unpublish.click();
        let chipDraft = null;
        for (let i = 0; i < 16; i++) {
            await page.waitForTimeout(500);
            chipDraft = (await page.locator('.cd-live').textContent().catch(() => null))?.trim();
            if (chipDraft === 'Draft') break;
        }
        notes.push(`after Unpublish: live-chip="${chipDraft}" (expect Draft, polled up to 8s)`);
    }
} else {
    notes.push('Go Live button not found (course may already be live) — testing Unpublish instead');
    await page.screenshot({ path: `${OUT}/03-golive.png` });
}

// --- 4. module card expand ---
const moduleCard = page.locator('.cd-mod').first();
if (await moduleCard.count()) {
    await moduleCard.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/04-module-expanded.png` });
    const backToModules = page.getByText('Return to Modules');
    if (await backToModules.count()) { await backToModules.click(); await page.waitForTimeout(800); }
} else {
    notes.push('no .cd-mod cards found!');
}

// --- 5. tabs ---
await page.getByRole('button', { name: /Students/i }).first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-students.png` });
await page.getByRole('button', { name: /Classwork/i }).first().click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/06-classwork.png` });

// --- 6. overview revisit (context cache sanity) ---
await page.goto('http://localhost:5173/dashboard/teacher');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/07-overview.png` });

console.log('=== NOTES ===');
notes.forEach((n) => console.log('- ' + n));
console.log('=== CONSOLE ERRORS ===');
errors.length ? errors.forEach((e) => console.log('- ' + e)) : console.log('(none)');
await browser.close();
