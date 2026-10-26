const express = require('express');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json({ limit: '256kb' }));

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- LIMITS ---
const MAX_OUTPUT_BYTES = 64 * 1024;      // per-stream cap so a fork bomb can't eat memory
const REST_TIMEOUT_MS = 10 * 1000;
const WS_TIMEOUT_MS = 30 * 1000;
// Cold java compiles on the shared free-tier CPU take 10-35s, longer when
// several students compile at once — a tight cap kills javac mid-flight,
// which (before the honest compile-failure handling below) graded as a
// blank success. Env-overridable for local slow-engine tests.
const COMPILE_TIMEOUT_MS = (parseInt(process.env.COMPILE_TIMEOUT_MS, 10) || 40) * 1000;
const AVAILABILITY_TTL_MS = 30 * 1000;
// os.cpus() reports the HOST's cores on a throttled container, so cpus*2
// wildly overbooks a 512MB box with java compilers (~100-150MB each). Cap at
// 6: over-cap callers get an honest 429, which Laravel maps to engine_error
// (flagged for retake, never scored against the student).
const MAX_CONCURRENT_JOBS = Math.min(6, Math.max(2, os.cpus().length * 2));
// Students iterate: run, read the error, fix, run again. And on a Render-style
// deployment EVERY student arrives through the same proxy IP (app.set('trust
// proxy') below recovers the real client where possible), so this is a
// class-wide budget — keep it generous. Token-authenticated callers (the
// Laravel auto-grader, the AI generator's verification) bypass it entirely.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_PER_WINDOW = 600;          // per IP per minute (browser traffic)
// Interactive sessions: the kill timer is IDLE-based (reset on every keystroke)
// so an actively-used terminal lives and an abandoned one gets reaped; plus an
// absolute session cap for safety. A program paused on input costs no CPU —
// what it consumes is a concurrency slot.
const IDLE_TIMEOUT_MS = 120 * 1000;
const MAX_INTERACTIVE_MS = 10 * 60 * 1000;
const GRACE_MS = 150;                     // pipe-drain grace after the process exits

// --- AUTH (optional) ---
// Set ENGINE_TOKEN to lock the engine down; the Laravel backend then sends the
// same value as EXECUTION_ENGINE_TOKEN (header) / VITE_WS_TOKEN (WS query).
const ENGINE_TOKEN = process.env.ENGINE_TOKEN || '';

function requestAuthorized(req) {
    if (!ENGINE_TOKEN) return true;
    if (req.headers['x-engine-token'] === ENGINE_TOKEN) return true;
    try {
        return new URL(req.url, 'http://localhost').searchParams.get('token') === ENGINE_TOKEN;
    } catch {
        return false;
    }
}

// --- RATE LIMIT + CONCURRENCY ---
const ipHits = new Map(); // ip -> array of timestamps inside the window
function rateLimited(ip) {
    const now = Date.now();
    if (ipHits.size > 5000) ipHits.clear(); // crude memory guard
    const hits = (ipHits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
    if (hits.length >= RATE_MAX_PER_WINDOW) {
        ipHits.set(ip, hits);
        return true;
    }
    hits.push(now);
    ipHits.set(ip, hits);
    return false;
}

let activeJobs = 0;

// --- RUNTIME DETECTION ---
// Windows ships `python`, most Linux images ship `python3` — probe once, remember.
function probe(bin, args = ['--version']) {
    try {
        const r = spawnSync(bin, args, { stdio: 'ignore', timeout: 8000 });
        return !r.error && (r.status === 0 || r.status === null);
    } catch {
        return false;
    }
}

const RUNTIMES = {
    python: ['python3', 'python'].find((bin) => probe(bin)) || null,
    node: 'node',
    javac: probe('javac') ? 'javac' : null,
    gpp: null,
};

// Windows: spawned services often inherit a stale env that misses MinGW
// installs entirely. Fall back to the well-known MinGW-w64 locations before
// declaring C++ unavailable; an absolute path also sidesteps spawn's .exe
// resolution.
function probeGpp() {
    if (probe('g++', ['--version'])) return 'g++';
    if (process.platform !== 'win32') return null;
    const known = [
        path.join(process.env.LOCALAPPDATA || '', 'mingw64', 'bin', 'g++.exe'),
        'C:\\msys64\\ucrt64\\bin\\g++.exe',
        'C:\\msys64\\mingw64\\bin\\g++.exe',
        'C:\\ProgramData\\mingw64\\mingw64\\bin\\g++.exe',
        'C:\\mingw64\\bin\\g++.exe',
    ];
    for (const exe of known) {
        try {
            if (exe && fs.existsSync(exe)) {
                const r = spawnSync(exe, ['--version'], { stdio: 'ignore', timeout: 8000 });
                if (!r.error && r.status === 0) return exe;
            }
        } catch { /* try the next location */ }
    }
    return null;
}
RUNTIMES.gpp = probeGpp();

// Same stale-env trap as g++: a spawned engine on Windows often inherits a
// PATH without the per-user Python install, which silently locks every
// python coding question. Fall back to the well-known install locations —
// an absolute path also sidesteps spawn's .exe resolution.
function probePython() {
    const fromPath = ['python3', 'python'].find((bin) => probe(bin));
    if (fromPath) return fromPath;
    if (process.platform !== 'win32') return null;
    const known = [];
    for (const ver of ['313', '312', '311', '310']) {
        known.push(path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', `Python${ver}`, 'python.exe'));
        known.push(`C:\\Python${ver}\\python.exe`);
        known.push(`C:\\Program Files\\Python${ver}\\python.exe`);
    }
    for (const exe of known) {
        try {
            if (exe && fs.existsSync(exe)) {
                const r = spawnSync(exe, ['--version'], { stdio: 'ignore', timeout: 8000 });
                if (!r.error && r.status === 0) return exe;
            }
        } catch { /* try the next location */ }
    }
    return null;
}
RUNTIMES.python = probePython();

// --- PROCESS-TREE KILL ---
// The direct child is spawned detached (its own process group on POSIX), so a
// group signal takes grandchildren with it. Windows needs taskkill /T.
function killTree(child) {
    if (!child || child.pid == null) return;
    if (process.platform === 'win32') {
        try { spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* noop */ }
    } else {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {
            try { child.kill('SIGKILL'); } catch { /* already gone */ }
        }
    }
}

// --- LANGUAGE REGISTRY ---
// Each language knows how to materialize sources into a temp folder, optionally
// compile, and produce the run command. `available()` gates execution so a box
// without a toolchain answers with a clear message instead of an ENOENT crash.
const LANGS = {
    java: {
        label: 'Java',
        available: () => !!RUNTIMES.javac && !!probe('java'),
        files(code, folder) {
            // Same extraction the backend proxy feeds us, plus the bare-class fallback
            const publicMatch = code.match(/public\s+(?:final\s+|abstract\s+)*class\s+(\w+)/);
            const anyMatch = code.match(/(?:final\s+|abstract\s+)*class\s+(\w+)/);
            const className = (publicMatch || anyMatch) ? (publicMatch || anyMatch)[1] : 'Main';
            fs.writeFileSync(path.join(folder, `${className}.java`), code);
            return { className };
        },
        compile(folder, meta) {
            return spawn('javac', [path.join(folder, `${meta.className}.java`)], { detached: process.platform !== 'win32' });
        },
        run(folder, meta) {
            return spawn('java', ['-cp', folder, meta.className], { detached: process.platform !== 'win32' });
        },
    },
    python: {
        label: 'Python 3',
        available: () => !!RUNTIMES.python,
        files(code, folder) {
            fs.writeFileSync(path.join(folder, 'main.py'), code);
            return {};
        },
        run(folder) {
            // -u / PYTHONUNBUFFERED so print() prompts appear in pipes immediately
            return spawn(RUNTIMES.python, ['-u', 'main.py'], {
                cwd: folder,
                detached: process.platform !== 'win32',
                env: { ...process.env, PYTHONUNBUFFERED: '1' },
            });
        },
    },
    javascript: {
        label: 'JavaScript',
        available: () => probe('node'),
        files(code, folder) {
            fs.writeFileSync(path.join(folder, 'main.js'), code);
            return {};
        },
        run(folder) {
            return spawn('node', ['main.js'], { cwd: folder, detached: process.platform !== 'win32' });
        },
    },
    cpp: {
        label: 'C++',
        available: () => !!RUNTIMES.gpp,
        files(code, folder) {
            fs.writeFileSync(path.join(folder, 'main.cpp'), code);
            return {};
        },
        compile(folder) {
            const exe = process.platform === 'win32' ? 'main.exe' : 'main';
            return spawn(RUNTIMES.gpp, ['-std=c++17', '-O2', '-o', exe, 'main.cpp'], { cwd: folder, detached: process.platform !== 'win32' });
        },
        run(folder) {
            const exe = process.platform === 'win32' ? 'main.exe' : 'main';
            return spawn(path.join(folder, exe), [], { cwd: folder, detached: process.platform !== 'win32' });
        },
    },
    // Web pages never touch the server — the browser sandbox IS the runtime.
    html: {
        label: 'HTML / CSS / JS',
        preview_only: true,
        available: () => false,
        files() { return {}; },
        run() { return null; },
    },
};

const SUPPORTED_IDS = Object.keys(LANGS);

// Availability probes spawn processes — cache so /languages and hot paths stay cheap.
const availabilityCache = new Map();
function isAvailable(id) {
    const lang = LANGS[id];
    if (!lang) return false;
    if (lang.preview_only) return false;
    const cached = availabilityCache.get(id);
    if (cached && Date.now() - cached.at < AVAILABILITY_TTL_MS) return cached.ok;
    const ok = lang.available();
    availabilityCache.set(id, { ok, at: Date.now() });
    return ok;
}

// Truncate on a code-point boundary so multi-byte UTF-8 never splits mid-glyph.
function cap(value) {
    if (Buffer.byteLength(value, 'utf8') <= MAX_OUTPUT_BYTES) return value;
    const sliced = Buffer.from(value, 'utf8').subarray(0, MAX_OUTPUT_BYTES).toString('utf8');
    return `${sliced}\n...[output truncated]`;
}

// Normalize CRLF pasted by Windows students into LF before feeding stdin.
function normalizeInput(input) {
    return String(input).replace(/\r\n/g, '\n');
}

/**
 * Run one job to completion: temp dir -> sources -> optional compile -> run.
 * Streams events through onEvent (WS) and hands the live child to onProcess
 * (WS stdin routing). Always resolves with the full result and cleans up.
 */
function executeJob({ language, code, input, interactive = false, timeoutMs, onEvent, onProcess, control }) {
    return new Promise((resolve) => {
        const lang = LANGS[language];
        const folderPath = path.join(os.tmpdir(), `exec-${uuidv4()}`);
        const startedAt = Date.now();
        let runChild = null;
        let compileChild = null;
        let runTimer = null;
        let compileTimer = null;
        let absoluteTimer = null;
        let timedOut = false;
        let compileTimedOut = false;
        let timeoutReason = '';
        let settled = false;

        const emit = (event) => { try { onEvent && onEvent(event); } catch { /* client gone */ } };

        // Compiler errors and tracebacks embed the absolute temp path
        // (…\Temp\exec-<uuid>\main.py). Never leak the host filesystem to
        // clients — strip the folder so students/teachers see "main.py:1".
        const scrub = (text) => {
            if (typeof text !== 'string' || !text) return text;
            return text.split(folderPath + path.sep).join('').split(folderPath).join('');
        };

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(runTimer);
            clearTimeout(compileTimer);
            clearTimeout(absoluteTimer);
            // Group-kill anything still alive (grandchildren can hold the stdio
            // pipes open — without this the job slot leaks).
            killTree(runChild);
            killTree(compileChild);
            activeJobs = Math.max(0, activeJobs - 1);
            try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch { /* best effort */ }
            for (const key of ['stdout', 'stderr', 'compile_output']) {
                result[key] = scrub(result[key]);
            }
            resolve({
                stdout: '',
                stderr: '',
                compile_output: '',
                exit_code: -1,
                duration_ms: Date.now() - startedAt,
                timed_out: false,
                ...result,
            });
        };

        try {
            fs.mkdirSync(folderPath, { recursive: true });
            activeJobs += 1;
            const meta = lang.files(code, folderPath) || {};

            const startRun = () => {
                runChild = lang.run(folderPath, meta);
                if (onProcess) onProcess('run', runChild, folderPath);

                let stdout = '';
                let stderr = '';

                runChild.stdout?.on('data', (d) => { stdout += d; emit({ type: 'output', data: d.toString() }); });
                runChild.stderr?.on('data', (d) => { stderr += d; emit({ type: 'stderr', data: d.toString() }); });

                if (input != null && input !== '') {
                    try {
                        const normalized = normalizeInput(input);
                        runChild.stdin.write(normalized.endsWith('\n') ? normalized : `${normalized}\n`);
                    } catch { /* process may have closed stdin itself */ }
                }
                // Batch mode signals EOF after piping input; interactive mode keeps
                // stdin open so the WebSocket terminal can feed it (or send EOF).
                if (!interactive) {
                    try { runChild.stdin.end(); } catch { /* noop */ }
                }

                // Batch mode: total timeout (protects the host from runaway
                // scripts). Interactive mode: IDLE timeout — typing resets the
                // clock, so an actively-used terminal lives and an abandoned
                // one gets reaped (a program paused on input costs no CPU;
                // what it holds is a concurrency slot). Plus an absolute cap.
                const killForTimeout = () => {
                    timedOut = true;
                    timeoutReason = interactive
                        ? 'Session closed after inactivity'
                        : 'Execution Timed Out';
                    emit({
                        type: 'error',
                        message: interactive
                            ? 'Session ended — no input for a while. Press Run to start again.'
                            : 'Execution Timed Out',
                    });
                    killTree(runChild);
                };
                if (interactive) {
                    const armIdle = () => {
                        clearTimeout(runTimer);
                        runTimer = setTimeout(killForTimeout, IDLE_TIMEOUT_MS);
                    };
                    armIdle();
                    if (control) control.poke = armIdle; // WS handler calls this on every keystroke
                    absoluteTimer = setTimeout(killForTimeout, MAX_INTERACTIVE_MS);
                } else {
                    runTimer = setTimeout(killForTimeout, timeoutMs);
                }

                // 'exit' (not 'close') completes the job even when a grandchild
                // keeps the stdio pipes open; a short grace collects late output.
                runChild.on('exit', (exitCode) => {
                    emit({ type: 'exit', code: exitCode ?? -1 });
                    setTimeout(() => {
                        if (timedOut) {
                            finish({
                                stdout: cap(stdout),
                                stderr: timeoutReason || 'Execution Timed Out (Possible Infinite Loop)',
                                compile_output: '',
                                exit_code: exitCode ?? -1,
                                timed_out: true,
                            });
                            return;
                        }
                        finish({
                            stdout: cap(stdout),
                            stderr: cap(stderr),
                            compile_output: '',
                            exit_code: exitCode ?? -1,
                        });
                    }, GRACE_MS);
                });

                runChild.on('error', (err) => {
                    finish({ stdout: cap(stdout), stderr: err.toString(), compile_output: '' });
                });
            };

            if (lang.compile) {
                compileChild = lang.compile(folderPath, meta);
                if (onProcess) onProcess('compile', compileChild, folderPath);

                let compileOutput = '';
                compileChild.stderr?.on('data', (d) => { compileOutput += d; });
                compileChild.stdout?.on('data', (d) => { compileOutput += d; });

                compileTimer = setTimeout(() => {
                    compileTimedOut = true;
                    killTree(compileChild);
                }, COMPILE_TIMEOUT_MS);

                compileChild.on('close', (cc) => {
                    if (cc !== 0) {
                        // A killed or blank compile must never look like a
                        // clean run with no output — graders compare stdout
                        // and would score engine slowness as a wrong answer.
                        // Timeouts and OOM-style kills (non-zero exit, nothing
                        // printed — a real syntax error ALWAYS has javac/g++
                        // diagnostics) get an honest message plus the
                        // compile_timed_out flag, which Laravel maps to
                        // engine_error: flagged for retake, never scored.
                        // Genuine compiler errors keep their diagnostics and
                        // carry NO flag — that's the student's code failing.
                        let output = cap(compileOutput);
                        let infraFailure = false;
                        if (compileTimedOut || !String(output).trim()) {
                            infraFailure = true;
                            output = compileTimedOut
                                ? 'Compilation timed out — the engine is busy. Try again in a moment.'
                                : 'The compiler failed without a diagnostic (engine busy or out of memory). Try again.';
                            emit({
                                type: 'error',
                                message: 'Compilation failed on the engine (busy) — press Run again in a moment.',
                            });
                        }
                        finish({
                            stdout: '',
                            stderr: output,
                            compile_output: output,
                            exit_code: cc ?? -1,
                            timed_out: compileTimedOut,
                            compile_timed_out: infraFailure,
                        });
                        return;
                    }
                    startRun();
                });

                compileChild.on('error', (err) => {
                    finish({ stdout: '', stderr: err.toString(), compile_output: err.toString() });
                });
            } else {
                startRun();
            }
        } catch (err) {
            console.error('Execution error:', err);
            finish({ stderr: `Server failed to process code: ${err.toString()}` });
        }
    });
}

// --- STALE TEMP SWEEP ---
// A crashed/restarted engine leaves exec-* dirs behind; sweep them hourly.
function sweepTempDirs() {
    try {
        const cutoff = Date.now() - 60 * 60 * 1000;
        for (const entry of fs.readdirSync(os.tmpdir())) {
            if (!entry.startsWith('exec-')) continue;
            const full = path.join(os.tmpdir(), entry);
            try {
                if (fs.statSync(full).mtimeMs < cutoff) {
                    fs.rmSync(full, { recursive: true, force: true });
                }
            } catch { /* gone already */ }
        }
    } catch { /* tmpdir unreadable — nothing to do */ }
}
sweepTempDirs();
setInterval(sweepTempDirs, 60 * 60 * 1000).unref();

// --- 1. CORS + AUTH + REQUEST LOGGER ---
// The browser calls /execute-batch DIRECTLY (long runs must not sit on the
// Laravel edge: parallel quiz traffic got 503'd there while a batch ran).
// The engine is tokenless by design — the WS has always been open.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Engine-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// --- 2. AUTH + REQUEST LOGGER ---
// Behind a deployment proxy (Render/Railway) every student arrives through
// the same edge IP; trust proxy lets req.ip resolve X-Forwarded-For so the
// rate budget is per-coursemate instead of per-infrastructure.
app.set('trust proxy', 1);
app.use((req, res, next) => {
    if (!requestAuthorized(req)) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }
    // Token-authenticated callers (the Laravel auto-grader, the AI generator's
    // verification) bypass the rate budget — grading a whole class's
    // submissions in a burst is legitimate authorized load.
    const internalCall = Boolean(ENGINE_TOKEN) && requestAuthorized(req);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!internalCall && rateLimited(ip)) {
        return res.status(429).json({ error: 'Too many requests — slow down and try again in a minute.' });
    }
    console.log(`>>> Incoming: ${req.method} ${req.url}`);
    next();
});

// --- 3. HEALTH / CAPABILITIES ---
app.get('/', (req, res) => {
    res.json({ status: 'online', service: 'InstructAI Execution Engine', languages: SUPPORTED_IDS });
});

app.get('/languages', (req, res) => {
    res.json({
        languages: SUPPORTED_IDS.map((id) => ({
            id,
            label: LANGS[id].label,
            preview_only: !!LANGS[id].preview_only,
            available: isAvailable(id),
        })),
    });
});

// --- 3. REST EXECUTION ---
app.post('/execute', async (req, res) => {
    const { language = 'java', code, input } = req.body || {};

    if (!LANGS[language]) {
        return res.status(400).json({
            error: `Unsupported language '${language}'. Supported: ${SUPPORTED_IDS.join(', ')}.`,
        });
    }
    if (LANGS[language].preview_only) {
        return res.status(400).json({
            error: `${LANGS[language].label} runs in the browser preview — nothing to execute on the server.`,
            preview_only: true,
        });
    }
    if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'code is required.' });
    }
    if (!isAvailable(language)) {
        return res.status(503).json({
            error: `${LANGS[language].label} runtime is not installed on this execution server.`,
            stdout: '',
            stderr: '',
            compile_output: '',
        });
    }
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
        return res.status(429).json({
            error: 'The engine is busy right now — try again in a few seconds.',
            stdout: '',
            stderr: '',
            compile_output: '',
        });
    }

    const result = await executeJob({ language, code, input, timeoutMs: REST_TIMEOUT_MS });
    res.json(result);
});

// --- COMPILE CACHE --------------------------------------------------------
// Compiling is the expensive half of a java run. The same student code is
// executed again and again (their own retries, grading after the quiz, a
// teacher replaying it), and a class clicking Run at once saturates the CPU.
// Cache compiled artifacts by sha1(language+code): a hit skips javac/g++.
const COMPILE_CACHE_DIR = path.join(os.tmpdir(), 'exec-cache');
const COMPILE_CACHE_MAX = 60;
const crypto = require('crypto');

function cacheKey(language, code) {
    return crypto.createHash('sha1').update(language + ' ' + code).digest('hex');
}

function cacheLookup(key) {
    try {
        const dir = path.join(COMPILE_CACHE_DIR, key);
        if (!fs.existsSync(path.join(dir, 'meta.json'))) return null;
        return dir;
    } catch { return null; }
}

function cachePopulate(key, sourceDir, meta) {
    try {
        fs.mkdirSync(COMPILE_CACHE_DIR, { recursive: true });
        const dir = path.join(COMPILE_CACHE_DIR, key);
        const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
        fs.mkdirSync(tmp, { recursive: true });
        for (const entry of fs.readdirSync(sourceDir)) {
            fs.copyFileSync(path.join(sourceDir, entry), path.join(tmp, entry));
        }
        fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify(meta || {}));
        try { fs.renameSync(tmp, dir); } catch { fs.rmSync(tmp, { recursive: true, force: true }); }
        // evict oldest beyond the cap
        const entries = fs.readdirSync(COMPILE_CACHE_DIR)
            .filter((e) => !e.includes('.tmp-'))
            .map((e) => ({ e, t: fs.statSync(path.join(COMPILE_CACHE_DIR, e)).mtimeMs }))
            .sort((a, b) => a.t - b.t);
        for (const old of entries.slice(0, Math.max(0, entries.length - COMPILE_CACHE_MAX))) {
            fs.rmSync(path.join(COMPILE_CACHE_DIR, old.e), { recursive: true, force: true });
        }
    } catch { /* cache is best-effort */ }
}

function cacheRestore(key, folderPath) {
    const dir = cacheLookup(key);
    if (!dir) return null;
    try {
        for (const entry of fs.readdirSync(dir)) {
            if (entry === 'meta.json') continue;
            fs.copyFileSync(path.join(dir, entry), path.join(folderPath, entry));
        }
        return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8') || '{}');
    } catch { return null; }
}

// --- BATCH EXECUTION: compile once, run every input ----------------------
// A quiz "Run" checks all sample tests; grading checks every stored test.
// Compiling per input triples the (cold, expensive) javac cost — on a cold
// engine that pushed each request past the client's timeout and the check
// failed on the first click after an idle stretch. One compile, N runs.
const BATCH_MAX_INPUTS = 10;
// Whole-call budget: keep the single HTTP response safely under proxy
// response ceilings (~50s on Render's edge).
const BATCH_TOTAL_BUDGET_MS = 40 * 1000;

function executeBatch({ language, code, inputs, timeoutMs = REST_TIMEOUT_MS }) {
    return new Promise((resolve) => {
        const lang = LANGS[language];
        const folderPath = path.join(os.tmpdir(), `exec-${uuidv4()}`);
        const startedAt = Date.now();
        // The overall budget scales with the per-run timeout: a caller asking
        // for patient runs (the auto-grader) must not trip a fixed 40s cap
        // mid-batch and get its remaining inputs back as fake timeouts.
        const totalBudgetMs = Math.max(BATCH_TOTAL_BUDGET_MS, timeoutMs * inputs.length + 5000);
        let compileChild = null;
        let compileTimer = null;
        let runChild = null;
        let runTimer = null;
        let settled = false;
        let compileTimedOut = false;

        const scrub = (text) => (typeof text !== 'string' || !text
            ? text
            : text.split(folderPath + path.sep).join('').split(folderPath).join(''));

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(compileTimer);
            clearTimeout(runTimer);
            killTree(runChild);
            killTree(compileChild);
            activeJobs = Math.max(0, activeJobs - 1);
            try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch { /* best effort */ }
            resolve({
                compile_output: scrub(result.compile_output) || '',
                compile_timed_out: !!result.compile_timed_out,
                results: result.results || [],
                duration_ms: Date.now() - startedAt,
            });
        };

        const runOne = (input) => new Promise((done) => {
            const child = lang.run(folderPath, meta);
            runChild = child;
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            child.stdout?.on('data', (d) => { stdout += d; });
            child.stderr?.on('data', (d) => { stderr += d; });
            if (input != null && input !== '') {
                try {
                    const normalized = normalizeInput(input);
                    child.stdin.write(normalized.endsWith('\n') ? normalized : `${normalized}\n`);
                } catch { /* stdin closed early */ }
            }
            try { child.stdin.end(); } catch { /* noop */ }
            runTimer = setTimeout(() => { timedOut = true; killTree(child); }, timeoutMs);
            const settle = (exitCode) => setTimeout(() => {
                clearTimeout(runTimer);
                runChild = null;
                done({
                    stdout: cap(stdout),
                    stderr: timedOut ? 'Execution Timed Out (Possible Infinite Loop)' : cap(stderr),
                    exit_code: exitCode ?? -1,
                    timed_out: timedOut,
                    duration_ms: Date.now() - startedAt,
                });
            }, GRACE_MS);
            child.on('exit', (code) => settle(code));
            child.on('error', () => settle(null));
        });

        const runAll = async () => {
            const results = [];
            for (const input of inputs) {
                if (Date.now() - startedAt > totalBudgetMs) {
                    results.push({
                        stdout: '',
                        stderr: 'Batch budget exhausted — press Run again in a moment.',
                        exit_code: -1,
                        timed_out: true,
                        duration_ms: Date.now() - startedAt,
                    });
                    break;
                }
                const r = await runOne(input);
                results.push(r);
                if (r.timed_out) break; // a hung program would burn every remaining run
            }
            finish({ results });
        };

        let meta = {};
        const cKey = lang.compile ? cacheKey(language, code) : null;
        try {
            fs.mkdirSync(folderPath, { recursive: true });
            activeJobs += 1;
            meta = lang.files(code, folderPath) || {};

            if (cKey) {
                const cachedMeta = cacheRestore(cKey, folderPath);
                if (cachedMeta) {
                    // Compiled artifacts already on disk — skip the compiler.
                    meta = cachedMeta;
                    runAll();
                    return;
                }
            }

            if (lang.compile) {
                compileChild = lang.compile(folderPath, meta);
                let compileOutput = '';
                compileChild.stderr?.on('data', (d) => { compileOutput += d; });
                compileChild.stdout?.on('data', (d) => { compileOutput += d; });
                compileTimer = setTimeout(() => {
                    compileTimedOut = true;
                    killTree(compileChild);
                }, COMPILE_TIMEOUT_MS);
                compileChild.on('close', (cc) => {
                    if (cc !== 0) {
                        // Same honest handling as the single-run path: a
                        // killed/blank compile is an engine failure, not the
                        // student's code failing.
                        let output = cap(compileOutput);
                        let infraFailure = false;
                        if (compileTimedOut || !String(output).trim()) {
                            infraFailure = true;
                            output = compileTimedOut
                                ? 'Compilation timed out — the engine is busy. Try again in a moment.'
                                : 'The compiler failed without a diagnostic (engine busy or out of memory). Try again.';
                        }
                        finish({ compile_output: output, compile_timed_out: infraFailure });
                        return;
                    }
                    if (cKey) cachePopulate(cKey, folderPath, meta);
                    runAll();
                });
                compileChild.on('error', (err) => finish({
                    compile_output: err.toString(),
                    compile_timed_out: true,
                }));
            } else {
                runAll();
            }
        } catch (err) {
            console.error('Batch execution error:', err);
            finish({
                compile_output: `Server failed to process code: ${err.toString()}`,
                compile_timed_out: true,
            });
        }
    });
}

app.post('/execute-batch', async (req, res) => {
    const { language = 'java', code, inputs } = req.body || {};

    if (!LANGS[language]) {
        return res.status(400).json({
            error: `Unsupported language '${language}'. Supported: ${SUPPORTED_IDS.join(', ')}.`,
        });
    }
    if (LANGS[language].preview_only) {
        return res.status(400).json({
            error: `${LANGS[language].label} runs in the browser preview — nothing to execute on the server.`,
            preview_only: true,
        });
    }
    if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'code is required.' });
    }
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > BATCH_MAX_INPUTS) {
        return res.status(400).json({ error: `inputs must be an array of 1-${BATCH_MAX_INPUTS} strings.` });
    }
    if (!isAvailable(language)) {
        return res.status(503).json({ error: `${LANGS[language].label} runtime is not installed on this execution server.` });
    }
    if (activeJobs >= MAX_CONCURRENT_JOBS) {
        return res.status(429).json({ error: 'The engine is busy right now — try again in a few seconds.' });
    }

    // Optional explicit per-run timeout (the auto-grader asks for 25s);
    // ABSENT means the snappy default — the Floor(1000) here made every
    // browser-initiated run die ~1s after JVM start on prod.
    const requested = Number.parseInt(req.body.timeout_ms, 10);
    const runTimeoutMs = Number.isFinite(requested) && requested >= 1000
        ? Math.min(requested, 25000)
        : REST_TIMEOUT_MS;
    const result = await executeBatch({
        language,
        code,
        inputs: inputs.map((v) => (v == null ? '' : String(v))),
        timeoutMs: runTimeoutMs,
    });
    res.json(result);
});

// --- 5. WEBSOCKET INTERACTIVE EXECUTION ---
wss.on('connection', (ws, req) => {
    if (!requestAuthorized(req)) {
        ws.close();
        return;
    }
    console.log('[WS] New client connected');
    let activeChild = null;
    let activePhase = null;
    let folderPath = null;
    let jobRunning = false;
    // Keystrokes that arrive while the job is still compiling — flushed once the
    // run process starts, so fast typers never lose input to a slow javac.
    let pendingInput = [];

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'execute') {
                if (jobRunning) {
                    ws.send(JSON.stringify({ type: 'error', message: 'A program is already running — press Stop first.' }));
                    return;
                }
                const language = data.language || 'java';
                const lang = LANGS[language];

                if (!lang) {
                    ws.send(JSON.stringify({ type: 'error', message: `Unsupported language '${language}'. Supported: ${SUPPORTED_IDS.join(', ')}` }));
                    return;
                }
                if (lang.preview_only) {
                    ws.send(JSON.stringify({ type: 'error', message: `${lang.label} runs in the browser preview — use the preview pane instead of the terminal.` }));
                    return;
                }
                if (!isAvailable(language)) {
                    ws.send(JSON.stringify({ type: 'error', message: `${lang.label} runtime is not installed on this execution server.` }));
                    return;
                }
                if (activeJobs >= MAX_CONCURRENT_JOBS) {
                    ws.send(JSON.stringify({ type: 'error', message: 'The engine is busy right now — try again in a few seconds.' }));
                    return;
                }

                jobRunning = true;
                const jobControl = {}; // run kicks in and arms poke() — every keystroke resets the idle clock
                executeJob({
                    language,
                    code: data.code,
                    input: data.input,
                    interactive: true,
                    timeoutMs: WS_TIMEOUT_MS,
                    control: jobControl,
                    onEvent: (event) => {
                        try { ws.send(JSON.stringify(event)); } catch { /* closed */ }
                    },
                    onProcess: (phase, child, folder) => {
                        activePhase = phase;
                        activeChild = child;
                        folderPath = folder;
                        if (phase === 'run') {
                            // Flush anything the student typed while compiling
                            for (const value of pendingInput) {
                                try { child.stdin.write(value === '\r' ? '\n' : value); } catch { /* noop */ }
                            }
                            pendingInput = [];
                            ws.send(JSON.stringify({ type: 'ready', message: 'Ready for input' }));
                        }
                    },
                }).finally(() => {
                    jobRunning = false;
                    activeChild = null;
                    activePhase = null;
                });
            } else if (data.type === 'input') {
                const value = data.value === '\r' ? '\n' : data.value;
                if (activeChild && activePhase === 'run' && activeChild.stdin && activeChild.stdin.writable) {
                    activeChild.stdin.write(value);
                } else {
                    pendingInput.push(value);
                }
                // Typing = the session is alive — resets the idle kill timer
                if (jobRunning) {
                    try { jobControl?.poke?.(); } catch { /* terminal between phases */ }
                }
            } else if (data.type === 'eof') {
                // Ctrl+D equivalent: close stdin so read-until-EOF programs finish
                if (activeChild && activePhase === 'run' && activeChild.stdin && activeChild.stdin.writable) {
                    try { activeChild.stdin.end(); } catch { /* noop */ }
                }
            } else if (data.type === 'stop') {
                killTree(activeChild);
            }
        } catch (err) {
            console.error('[WS] Parse error:', err);
            ws.send(JSON.stringify({ type: 'error', message: err.toString() }));
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        killTree(activeChild);
        if (folderPath) {
            try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch { /* best effort */ }
        }
    });

    ws.on('error', (err) => {
        console.error('[WS] Error:', err);
    });
});

// --- 5. PORT BINDING ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[SUCCESS] Instruct-Execute live on port ${PORT}`);
    console.log(`[REST] HTTP API on :${PORT}/execute`);
    console.log(`[WS] WebSocket on ws://0.0.0.0:${PORT}`);
    console.log(`[AUTH] ${ENGINE_TOKEN ? 'token required' : 'open (set ENGINE_TOKEN to lock down)'}`);
    console.log(`[LANGS] ${SUPPORTED_IDS.map((id) => `${LANGS[id].label}${isAvailable(id) ? '' : ' (runtime missing)'}`).join(' | ')}`);
});
