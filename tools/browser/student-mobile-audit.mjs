/**
 * Student-side mobile audit — REAL browser at phone size (390x844, touch).
 * Walks every student page through the seeded throwaway class, screenshots
 * each state, and reports horizontal overflow / off-screen elements.
 *
 * Usage (from tools/browser/):  node student-mobile-audit.mjs
 * Skips the quiz flow with SKIP_QUIZ=1; skips role modal with SKIP_ROLE=1.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'https://instruct-ai-topaz.vercel.app';
const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots-mobile-student';
fs.mkdirSync(OUT, { recursive: true });
const { student, classId, courseId, assignId, quizId, lessonIds } = JSON.parse(
  fs.readFileSync(process.env.TEMP + '/mobile-qa-tokens.json', 'utf8'),
);

const VW = parseInt(process.env.VW || '390', 10);
const VH = parseInt(process.env.VH || '844', 10);
const report = [];
const save = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false }).catch(() => {});
const saveFull = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }).catch(() => {});

async function checkPage(page, label, { full = false } = {}) {
  await page.waitForTimeout(700);
  try {
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 120));
    });
  } catch { /* audio/video eval errors ignored */ }
  const data = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width > 8 && r.height > 8 && (r.right > vw + 6 || r.left < -6)) {
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && (cs.transform || '').includes('translate')) continue; // off-canvas drawers
        wide.push({ el: `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`, right: Math.round(r.right), left: Math.round(r.left), w: Math.round(r.width) });
      }
    }
    return {
      vw,
      docW: document.documentElement.scrollWidth,
      docH: document.documentElement.scrollHeight,
      hasHScroll: document.documentElement.scrollWidth > vw + 2,
      wide: wide.slice(0, 12),
      consoletitle: document.title,
    };
  });
  const errs = [];
  if (full) await saveFull(page, label); else await save(page, label);
  report.push({ label, hasHScroll: data.hasHScroll, docW: data.docW, wide: data.wide });
  console.log(`${data.hasHScroll ? '!! OVERFLOW' : '   ok      '} ${label.padEnd(22)} docW=${data.docW} vw=${data.vw}${data.wide.length ? ' beyond: ' + data.wide.slice(0, 4).map((w) => `${w.el}(r${w.right},l${w.left})`).join(' ') : ''}`);
  return data;
}

function authScript(token, id, name) {
  return [token, { id, name, email: `mobile-qa-s${id}@example.test`, role: 'student' }];
}

const CODE = `import java.util.Scanner;\npublic class EvenCounter { public static void main(String[] a){ Scanner s=new Scanner(System.in); int n=s.nextInt(); int[] v=new int[n]; for(int i=0;i<n;i++) v[i]=s.nextInt(); int c=0; for(int i=0;i<n;i++) if(v[i]%2==0) c++; System.out.println("Even count: "+c); } }`;

const browser = await chromium.launch({ channel: 'msedge', headless: true });

// ---------- tour 1: shell + simple pages ----------
{
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'student');
    sessionStorage.setItem('user', JSON.stringify(u));
  }, authScript(student, 49, 'Mobile QA One'));

  await page.goto(`${APP}/dashboard/student`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await checkPage(page, '01-overview', { full: true });

  // sidebar drawer
  const burger = page.locator('.sv-mobilebar button').first();
  if (await burger.isVisible().catch(() => false)) {
    await burger.click();
    await page.waitForTimeout(600);
    await checkPage(page, '01b-drawer');
    await page.mouse.click(30, 400); // tap scrim
    await page.waitForTimeout(500);
  }

  await page.goto(`${APP}/dashboard/student/class/${classId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2200);
  await checkPage(page, '02-class-modules', { full: true });

  await page.goto(`${APP}/dashboard/student/class/${classId}?tab=classwork`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2200);
  await checkPage(page, '03-class-classwork', { full: true });

  // AI tutor FAB
  const fab = page.locator('[class*="ai-tutor"], [class*="aifab"], button[aria-label*="tutor" i], [class*="aiFab"]').first();
  if (await fab.isVisible().catch(() => false)) {
    await fab.click();
    await page.waitForTimeout(1800);
    await checkPage(page, '04-ai-tutor');
  }

  await page.goto(`${APP}/dashboard/student/course/${courseId}/lesson/${lessonIds[0][0]}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await checkPage(page, '05-lesson-viewer', { full: true });

  await page.goto(`${APP}/dashboard/student/class/${classId}/activity/${assignId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(2500);
  await checkPage(page, '06-assignment', { full: true });

  await ctx.close();
}

// ---------- tour 2: full quiz flow ----------
if (!process.env.SKIP_QUIZ) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.addInitScript(([t, u]) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'student');
    sessionStorage.setItem('user', JSON.stringify(u));
  }, authScript(student, 49, 'Mobile QA One'));

  await page.goto(`${APP}/dashboard/student/class/${classId}/quiz/${quizId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: /start quiz/i }).waitFor({ timeout: 60000 }).catch(() => {});
  await checkPage(page, '07-quiz-lobby');

  const started = await page.getByRole('button', { name: /start quiz/i }).first().click({ timeout: 15000 }).then(() => true).catch(() => false);
  if (started) {
    await page.waitForTimeout(2000);
    await checkPage(page, '08-quiz-q1');
    // q1 MC: click option containing "0" (first option)
    await page.getByRole('button', { name: /^0$/ }).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^next$/i }).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await checkPage(page, '09-quiz-q2');
    // q2 TF: click "True"
    await page.getByRole('button', { name: /^true$/i }).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /^next$/i }).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await checkPage(page, '10-quiz-code-before');
    const editor = page.locator('.cm-content').first();
    await editor.click({ timeout: 15000 });
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(CODE);
    await page.waitForTimeout(1200);
    const run = page.getByRole('button', { name: /^run$/i }).first();
    await run.click({ timeout: 15000 }).catch(() => {});
    await page.getByText(/(ALL \d+ SAMPLE TESTS PASS|TESTS DID NOT PASS)/i).first().waitFor({ timeout: 100000 }).catch(() => {});
    await checkPage(page, '10b-quiz-code-after');
    await page.getByRole('button', { name: /finish quiz/i }).first().click({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await checkPage(page, '11-quiz-confirm');
    const confirmBtn = page.getByRole('button', { name: /^finish quiz$/i }).last();
    if (await confirmBtn.isVisible().catch(() => false)) await confirmBtn.click().catch(() => {});
    await page.waitForTimeout(2500);
    await checkPage(page, '12-quiz-grading');
    await page.waitForFunction(
      () => { const h1 = document.querySelector('h1'); return h1 && /\d+\s*\/\s*\d+/.test((h1.textContent || '').trim()); },
      null, { timeout: 240000 },
    ).catch(() => {});
    await page.waitForTimeout(1200);
    await checkPage(page, '13-quiz-results', { full: true });
  }
  await ctx.close();
}

// ---------- tour 3: role-choice modal (mocked Google response) ----------
if (!process.env.SKIP_ROLE) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.route('**/api/login/google', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requires_role: true, email: 'new.person@example.com' }) }));
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.getByRole('button', { name: /continue with google/i }).first().click({ timeout: 30000 });
  await page.waitForTimeout(1600);
  await checkPage(page, '14-role-modal');
  // open the student LRN sub-flow too
  const studentCard = page.locator('.auth-role-card').nth(1);
  if (await studentCard.isVisible().catch(() => false)) {
    await studentCard.click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    await checkPage(page, '15-role-modal-lrn');
  }
  await ctx.close();
}

await browser.close();
console.log(`\nreport: ${report.filter((r) => r.hasHScroll).length}/${report.length} states with horizontal overflow`);
fs.writeFileSync(`${OUT}/audit-report.json`, JSON.stringify(report, null, 2));
