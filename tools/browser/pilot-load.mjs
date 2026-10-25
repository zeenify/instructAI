/**
 * Pilot-day load simulation — REAL browsers only.
 *
 * Drives a full class of Chromium sessions through the actual student quiz UI
 * (start → answer MC by clicking → type code into the CodeMirror editor →
 * click Run → Finish → grading screen → results) while a teacher browser
 * session loads the class page and results page during the peak. Also fires
 * one AI question-generation stream and one AI-tutor call to load the AI
 * service at the same time.
 *
 * Usage (from tools/browser/):
 *   node pilot-load.mjs
 *
 * Requires %TEMP%/pilot-students.json — entries "userId:sanctumToken".
 * Screenshots land in tools/browser/shots-pilot/ (gitignored).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'https://instruct-ai-topaz.vercel.app';
const API = 'https://instructai-backend.onrender.com/api';
const AI = 'https://instruct-ai-pnqz.onrender.com';
const TEACHER_TOKEN = process.env.TEACHER_TOKEN;
const CLASS = 6;
const ACTIVITY = 54;
const OUT = 'C:/Users/EDRICK/Desktop/instructai/tools/browser/shots-pilot';
fs.mkdirSync(OUT, { recursive: true });

const students = JSON.parse(fs.readFileSync(process.env.TEMP + '/pilot-students.json', 'utf8'))
  .map((s) => { const [id, token] = s.split(':'); return { id: Number(id), token }; });

const t0 = Date.now();
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(`[${ts()}]`, ...a);

const MC_RULES = [
  ['scores[3]', '0'],
  ['grade-classification', '"D", because Java evaluates conditions top to bottom'],
  ['missing its break', 'Execution falls through'],
  ['already almost in order', 'Insertion sort'],
  ['length - 1', 'last element is automatically sorted'],
];
const CODE = [
  ['even', `import java.util.Scanner;\npublic class EvenCounter { public static void main(String[] a){ Scanner s=new Scanner(System.in); int n=s.nextInt(); int[] v=new int[n]; for(int i=0;i<n;i++) v[i]=s.nextInt(); int c=0; for(int i=0;i<n;i++) if(v[i]%2==0) c++; System.out.println("Even count: "+c); } }`],
  ['smallest', `import java.util.Scanner;\npublic class MinFinder { public static void main(String[] a){ Scanner s=new Scanner(System.in); int n=s.nextInt(); int[] v=new int[n]; for(int i=0;i<n;i++) v[i]=s.nextInt(); int m=v[0]; for(int i=1;i<n;i++) if(v[i]<m) m=v[i]; System.out.println("Min: "+m); } }`],
  ['passing', `import java.util.Scanner;\npublic class PassingCounter { public static void main(String[] a){ Scanner s=new Scanner(System.in); int n=s.nextInt(); int[] v=new int[n]; for(int i=0;i<n;i++) v[i]=s.nextInt(); int c=0; for(int i=0;i<n;i++) if(v[i]>=60) c++; System.out.println("Passing scores: "+c+" out of "+n); } }`],
];

function ruleFor(text) {
  const t = (text || '').toLowerCase();
  for (const [needle, answer] of MC_RULES) if (t.includes(needle.toLowerCase())) return { kind: 'mc', answer };
  for (const [needle, code] of CODE) if (t.includes(needle)) return { kind: 'code', code };
  return null;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function studentFlow(browser, stu) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  const result = { id: stu.id, ok: false, score: null, steps: [], errors, failedRequests: [] };
  page.on('requestfailed', (r) => {
    if (r.url().includes('/api/')) result.failedRequests.push(`${r.method()} ${r.url().split('/api/')[1]} ${r.failure()?.errorText}`);
  });
  const step = (name, ms, extra = '') => {
    result.steps.push({ name, ms: Math.round(ms), extra });
    log(`s${stu.id} ${name} ${Math.round(ms)}ms ${extra}`);
  };

  try {
    await page.addInitScript(([t, u]) => {
      localStorage.setItem('token', t);
      localStorage.setItem('role', 'student');
      sessionStorage.setItem('user', JSON.stringify(u));
    }, [stu.token, { id: stu.id, name: `Pilot Load ${stu.id}`, email: `pilot-load-${stu.id}@example.test`, role: 'student' }]);

    let s = Date.now();
    await page.goto(`${APP}/dashboard/student/class/${CLASS}/quiz/${ACTIVITY}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.getByRole('button', { name: /start quiz/i }).waitFor({ timeout: 60000 });
    step('load quiz page', Date.now() - s);

    s = Date.now();
    await page.getByRole('button', { name: /start quiz/i }).click();
    await page.getByText(/question\s*1\s*of|of\s*8/i).first().waitFor({ timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(800);
    step('start quiz', Date.now() - s);

    for (let q = 1; q <= 8; q++) {
      const heading = await page.locator('h2').first().textContent().catch(() => '');
      const rule = ruleFor(heading || '');
      const qs = Date.now();
      if (rule?.kind === 'mc') {
        // click the option whose text contains the answer
        const btn = page.getByRole('button', { name: new RegExp(rule.answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
        await btn.click({ timeout: 15000 });
        await page.waitForTimeout(400); // let the answer autosave
        step(`q${q} mc`, Date.now() - qs, rule.answer.slice(0, 30));
      } else if (rule?.kind === 'code') {
        // focus the CodeMirror editor and type the solution
        const editor = page.locator('.cm-content').first();
        await editor.click({ timeout: 15000 });
        await page.keyboard.press('Control+A');
        await page.keyboard.insertText(rule.code);
        await page.waitForTimeout(1200); // autosave debounce
        const runBtn = page.getByRole('button', { name: /^run$/i }).first();
        await runBtn.click({ timeout: 15000 });
        const passed = await page.getByText(/ALL 3 SAMPLE TESTS PASS/i).first()
          .waitFor({ timeout: 120000 }).then(() => true).catch(() => false);
        step(`q${q} code+run`, Date.now() - qs, passed ? 'tests 3/3' : 'TESTS DID NOT PASS');
        if (!passed) result.errors.push(`q${q} sample tests did not pass`);
      } else {
        step(`q${q} unknown type`, Date.now() - qs, (heading || '').slice(0, 40));
      }
      // advance
      if (q < 8) {
        await page.getByRole('button', { name: /^next$/i }).first().click({ timeout: 15000 });
      } else {
        await page.getByRole('button', { name: /finish quiz/i }).first().click({ timeout: 15000 });
        await page.waitForTimeout(400);
        const confirm = page.getByRole('button', { name: /^finish quiz$/i }).last();
        if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
      }
      await page.waitForTimeout(300);
    }

    // grading → results
    s = Date.now();
    await page.getByText(/checking your answers/i).first().waitFor({ timeout: 30000 }).catch(() => {});
    const learned = await page.waitForFunction(
      () => {
        const h1 = document.querySelector('h1');
        return h1 && /^\d+\s*\/\s*\d+$/.test((h1.textContent || '').trim()) ? h1.textContent.trim() : null;
      },
      null, { timeout: 360000 },
    ).then((h) => h.jsonValue()).catch(() => null);
    step('finish → results', Date.now() - s, learned ? `score ${learned}` : 'NO SCORE');
    result.score = learned;
    result.ok = !!learned;
    await page.screenshot({ path: `${OUT}/student-${stu.id}-results.png`, fullPage: false });
  } catch (e) {
    result.errors.push('FLOW FAILED: ' + String(e.message).slice(0, 200));
    await page.screenshot({ path: `${OUT}/student-${stu.id}-failed.png` }).catch(() => {});
  } finally {
    await ctx.close().catch(() => {});
  }
  return result;
}

async function teacherFlow(browser, probes) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.message).slice(0, 160)));
  await page.addInitScript((t) => {
    localStorage.setItem('token', t);
    localStorage.setItem('role', 'teacher');
    sessionStorage.setItem('user', JSON.stringify({ id: 58, name: 'Teacher', email: 'teacher@gmail.com', role: 'teacher' }));
  }, TEACHER_TOKEN);

  const targets = [
    ['class', `${APP}/dashboard/teacher/class/${CLASS}`],
    ['results', `${APP}/dashboard/teacher/class/${CLASS}/activity/${ACTIVITY}/results`],
    ['submissions', `${APP}/dashboard/teacher/class/${CLASS}/activity/${ACTIVITY}/submissions`],
  ];
  for (let round = 0; round < 3; round++) {
    for (const [name, url] of targets) {
      const s = Date.now();
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForTimeout(1500);
        probes.push({ name: `teacher: ${name}`, ms: Date.now() - s });
        log(`teacher ${name} ${Date.now() - s}ms`);
        if (round === 1) await page.screenshot({ path: `${OUT}/teacher-${name}.png` }).catch(() => {});
      } catch (e) {
        probes.push({ name: `teacher: ${name}`, ms: -1, error: String(e.message).slice(0, 120) });
      }
    }
  }
  await ctx.close().catch(() => {});
  return errors;
}

async function aiGeneration() {
  const s = Date.now();
  const prep = await fetch(`${API}/teacher/activities/${ACTIVITY}/ai-generate-prepare`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TEACHER_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: { lesson_ids: [], use_curriculum: true, has_files: false },
      settings: { count: 2, difficulty: 'medium', focus: '', counts: { coding: 2 }, generate_test_cases: true },
    }),
  });
  if (!prep.ok) { log('AI GEN prepare failed', prep.status); return null; }
  const p = await prep.json();
  const form = new FormData();
  form.append('payload_json', p.payload_json);
  form.append('auth_sig', p.auth_sig);
  form.append('auth_ts', String(p.auth_ts));
  const res = await fetch(p.ai_url + '/ai/qa-questions-stream-signed', { method: 'POST', body: form });
  if (!res.ok) { log('AI GEN stream failed', res.status); return null; }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
  const questions = []; let tests = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2);
      if (!frame.startsWith('data:')) continue;
      let ev; try { ev = JSON.parse(frame.slice(5).trim()); } catch { continue; }
      if (ev.type === 'questions') for (const q of ev.data?.questions || []) { questions.push(q); tests += (q.test_cases || []).length; }
    }
  }
  const ms = Date.now() - s;
  log(`AI GEN ${ms}ms — ${questions.length} questions, ${tests} test cases`);
  for (const q of questions) log(`   gen: ${q.type} tests=${(q.test_cases || []).length} :: ${(q.question_text || '').slice(0, 100)}`);
  return { ms, questions: questions.length, tests };
}

async function aiTutor(token) {
  const s = Date.now();
  let character = 'Ate Kai';
  try {
    const chars = await (await fetch(AI + '/ai/characters')).json();
    character = (chars.characters || chars || [])[0]?.name || character;
  } catch { /* default */ }
  const res = await fetch(`${API}/student/ai/chat`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'In one short paragraph: what is insertion sort and when is it faster than selection sort?',
      class_id: CLASS,
      character_name: character,
    }),
  });
  const ms = Date.now() - s;
  const json = await res.json().catch(() => ({}));
  log(`AI TUTOR ${res.status} ${ms}ms — ${(json.answer || json.message || '').slice(0, 120)}…`);
  return { status: res.status, ms, answer: json.answer || null };
}

// ================= RUN =================
log(`PILOT LOAD (real browsers): ${students.length} students + teacher`);
const browser = await chromium.launch({ channel: 'msedge', headless: true });

// teacher browser session during the peak
const teacherProbes = [];
const teacherPromise = (async () => {
  await new Promise((r) => setTimeout(r, 4000));
  return teacherFlow(browser, teacherProbes);
})();

// AI load at the peak (same server paths the UI calls)
await new Promise((r) => setTimeout(r, 6000));
const genPromise = aiGeneration().catch((e) => { log('AI GEN error', String(e).slice(0, 100)); return null; });
await new Promise((r) => setTimeout(r, 3000));
const tutorPromise = aiTutor(students[0].token).catch((e) => { log('AI TUTOR error', String(e).slice(0, 100)); return null; });

// Students trickle in like a real class entering the quiz (0-13s), not a
// synchronized wall — the earlier run measured the worst-case wall separately.
const results = await Promise.all(students.map((s, i) =>
  new Promise((r) => setTimeout(r, i * 1200)).then(() => studentFlow(browser, s))));
const teacherErrors = await teacherPromise;
const [gen, tutor] = await Promise.all([genPromise, tutorPromise]);
await browser.close();

// ---- report ----
console.log('\n================ PILOT LOAD REPORT (real browsers) ================');
const ok = results.filter((r) => r.ok);
console.log(`Students: ${ok.length}/${results.length} completed with a score`);
for (const r of results) {
  const score = r.score || '—';
  const failed = r.failedRequests.length ? ` failed-requests=${r.failedRequests.length} (${r.failedRequests.slice(0, 3).join(' | ')})` : '';
  const errs = r.errors.length ? ` errors=${r.errors.length} (${r.errors[0].slice(0, 60)})` : '';
  console.log(`  s${r.id}: score=${score}${failed}${errs}`);
}
const allSteps = {};
for (const r of results) for (const st of r.steps) (allSteps[st.name.replace(/q\d+ /, 'q ')] ||= []).push(st.ms);
for (const [name, arr] of Object.entries(allSteps)) {
  const lat = arr.filter((x) => x >= 0).sort((a, b) => a - b);
  const p = (q) => lat[Math.min(lat.length - 1, Math.floor(lat.length * q))];
  console.log(`  ${name.padEnd(18)} n=${arr.length} p50=${p(0.5)}ms p95=${p(0.95)}ms max=${lat[lat.length - 1]}ms`);
}
console.log('\nTeacher probes (browser page loads):');
for (const p of teacherProbes) console.log(`  ${p.name}: ${p.ms >= 0 ? p.ms + 'ms' : 'FAILED ' + (p.error || '')}`);
console.log(`Teacher console errors: ${teacherErrors.length}${teacherErrors.length ? ' — ' + teacherErrors[0].slice(0, 100) : ''}`);
if (gen) console.log(`AI generation under load: ${(gen.ms / 1000).toFixed(1)}s, ${gen.questions} questions, ${gen.tests} test cases`);
if (tutor) console.log(`AI tutor under load: HTTP ${tutor.status} in ${(tutor.ms / 1000).toFixed(1)}s`);
console.log(`Wall time: ${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.writeFileSync(`${OUT}/pilot-load-report.json`, JSON.stringify({ results, teacherProbes, teacherErrors, gen, tutor }, null, 2));
console.log(`Report JSON: ${OUT}/pilot-load-report.json`);
