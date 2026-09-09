const express = require('express');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const http = require('http');

const app = express();
app.use(express.json());

// Create HTTP server for both Express and WebSocket
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- LIMITS ---
const MAX_OUTPUT_BYTES = 64 * 1024;      // per-stream cap so a fork bomb can't eat memory
const REST_TIMEOUT_MS = 10 * 1000;
const WS_TIMEOUT_MS = 30 * 1000;
const COMPILE_TIMEOUT_MS = 20 * 1000;
const AVAILABILITY_TTL_MS = 30 * 1000;

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
    gpp: probe('g++', ['--version']) ? 'g++' : null,
};

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
            return spawn('javac', [path.join(folder, `${meta.className}.java`)]);
        },
        run(folder, meta) {
            return spawn('java', ['-cp', folder, meta.className]);
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
            return spawn(RUNTIMES.python, ['main.py'], { cwd: folder });
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
            return spawn('node', ['main.js'], { cwd: folder });
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
            return spawn(RUNTIMES.gpp, ['-std=c++17', '-O2', '-o', exe, 'main.cpp'], { cwd: folder });
        },
        run(folder) {
            const exe = process.platform === 'win32' ? 'main.exe' : 'main';
            return spawn(path.join(folder, exe), [], { cwd: folder });
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

const cap = (s) => (Buffer.byteLength(s) > MAX_OUTPUT_BYTES
    ? s.slice(0, MAX_OUTPUT_BYTES) + '\n...[output truncated]'
    : s);

/**
 * Run one job to completion: temp dir -> sources -> optional compile -> run.
 * Streams events through onEvent (WS) and hands the live child to onProcess
 * (WS stdin routing). Always resolves with the full result and cleans up.
 */
function executeJob({ language, code, input, interactive = false, timeoutMs, onEvent, onProcess }) {
    return new Promise((resolve) => {
        const lang = LANGS[language];
        const folderPath = path.join(os.tmpdir(), `exec-${uuidv4()}`);
        const startedAt = Date.now();
        let runChild = null;
        let compileChild = null;
        let runTimer = null;
        let compileTimer = null;
        let timedOut = false;
        let settled = false;

        const emit = (event) => { try { onEvent && onEvent(event); } catch { /* client gone */ } };

        const finish = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(runTimer);
            clearTimeout(compileTimer);
            try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch { /* best effort */ }
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
                        runChild.stdin.write(input.endsWith('\n') ? input : `${input}\n`);
                    } catch { /* process may have closed stdin itself */ }
                }
                // Batch mode signals EOF after piping input; interactive mode keeps
                // stdin open so the WebSocket terminal can feed it later.
                if (!interactive) {
                    try { runChild.stdin.end(); } catch { /* noop */ }
                }

                runTimer = setTimeout(() => {
                    timedOut = true;
                    emit({ type: 'error', message: 'Execution Timed Out' });
                    try { runChild.kill('SIGKILL'); } catch { /* noop */ }
                }, timeoutMs);

                runChild.on('close', (exitCode) => {
                    emit({ type: 'exit', code: exitCode ?? -1 });
                    if (timedOut) {
                        finish({
                            stdout: cap(stdout),
                            stderr: 'Execution Timed Out (Possible Infinite Loop)',
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
                    try { compileChild.kill('SIGKILL'); } catch { /* noop */ }
                }, COMPILE_TIMEOUT_MS);

                compileChild.on('close', (cc) => {
                    if (cc !== 0) {
                        finish({
                            stdout: '',
                            stderr: cap(compileOutput),
                            compile_output: cap(compileOutput),
                            exit_code: cc ?? -1,
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

// --- 1. REQUEST LOGGER ---
app.use((req, res, next) => {
    console.log(`>>> Incoming: ${req.method} ${req.url}`);
    next();
});

// --- 2. HEALTH / CAPABILITIES ---
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

    const result = await executeJob({ language, code, input, timeoutMs: REST_TIMEOUT_MS });
    res.json(result);
});

// --- 4. WEBSOCKET INTERACTIVE EXECUTION ---
wss.on('connection', (ws) => {
    console.log('[WS] New client connected');
    let activeChild = null;
    let activePhase = null;
    let folderPath = null;
    // Keystrokes that arrive while the job is still compiling — flushed once the
    // run process starts, so fast typers never lose input to a slow javac.
    let pendingInput = [];

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'execute') {
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

                executeJob({
                    language,
                    code: data.code,
                    input: data.input,
                    interactive: true,
                    timeoutMs: WS_TIMEOUT_MS,
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
                });
            } else if (data.type === 'input') {
                const value = data.value === '\r' ? '\n' : data.value;
                if (activeChild && activePhase === 'run' && activeChild.stdin && activeChild.stdin.writable) {
                    activeChild.stdin.write(value);
                } else {
                    pendingInput.push(value);
                }
            } else if (data.type === 'stop') {
                try { activeChild && activeChild.kill('SIGKILL'); } catch { /* noop */ }
            }
        } catch (err) {
            console.error('[WS] Parse error:', err);
            ws.send(JSON.stringify({ type: 'error', message: err.toString() }));
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        try { activeChild && activeChild.kill('SIGKILL'); } catch { /* noop */ }
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
    console.log(`[LANGS] ${SUPPORTED_IDS.map((id) => `${LANGS[id].label}${isAvailable(id) ? '' : ' (runtime missing)'}`).join(' | ')}`);
});
