const express = require('express');
const { exec, spawn } = require('child_process');
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

// --- 1. REQUEST LOGGER (Check Railway logs to see these) ---
app.use((req, res, next) => {
    console.log(`>>> Incoming: ${req.method} ${req.url}`);
    next();
});

// --- 2. ROOT ROUTE (Health Check) ---
app.get('/', (req, res) => {
    res.send('InstructAI Execution Engine is Online.');
});

// --- 3. EXECUTION ROUTE ---
app.post('/execute', (req, res) => {
    const { language, code, input } = req.body;

    if (language !== 'java') {
        return res.status(400).json({ error: "Only Java is supported currently." });
    }

    const id = uuidv4();
    const folderPath = path.join(os.tmpdir(), id);

    // Extract class name from code (look for public class ClassName)
    const classNameMatch = code.match(/public\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : 'Main';
    const filePath = path.join(folderPath, `${className}.java`);

    try {
        // 1. Create temp folder
        fs.mkdirSync(folderPath, { recursive: true });

        // 2. Write Java file
        fs.writeFileSync(filePath, code);

        // 3. Compile
        const javac = spawn('javac', [filePath]);
        let compileOutput = '';

        javac.stderr.on('data', (data) => {
            compileOutput += data.toString();
        });

        javac.on('close', (compileCode) => {
            // Cleanup on error
            if (compileCode !== 0) {
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (cleanupError) {
                    console.error("Cleanup failed:", cleanupError);
                }
                return res.json({
                    stdout: "",
                    stderr: compileOutput,
                    compile_output: compileOutput
                });
            }

            // 4. Run with timeout and stdin support
            const java = spawn('java', ['-cp', folderPath, className]);

            let stdout = '';
            let stderr = '';
            let timedOut = false;

            const timeout = setTimeout(() => {
                timedOut = true;
                java.kill('SIGTERM');
            }, 10000);

            // Send input to stdin
            if (input) {
                // Write input and signal EOF
                java.stdin.write(input, 'utf8');
                java.stdin.write('\n');  // Add newline in case input doesn't have it
            }
            java.stdin.end();

            // Capture output
            java.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            java.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            java.on('close', (exitCode) => {
                clearTimeout(timeout);

                // Cleanup files after execution
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (cleanupError) {
                    console.error("Cleanup failed:", cleanupError);
                }

                if (timedOut) {
                    return res.json({
                        stdout: stdout,
                        stderr: "Execution Timed Out (Possible Infinite Loop)",
                        compile_output: ""
                    });
                }

                res.json({
                    stdout: stdout,
                    stderr: stderr,
                    compile_output: ""
                });
            });

            java.on('error', (err) => {
                clearTimeout(timeout);
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (cleanupError) {
                    console.error("Cleanup failed:", cleanupError);
                }
                res.json({
                    stdout: stdout,
                    stderr: err.toString(),
                    compile_output: ""
                });
            });
        });
    } catch (err) {
        console.error("Internal Server Error:", err);
        res.status(500).json({ error: "Server failed to process code." });
    }
});

// --- 4. WEBSOCKET HANDLER FOR INTERACTIVE EXECUTION ---
wss.on('connection', (ws) => {
    console.log('[WS] New client connected');
    let javaProcess = null;
    let compileProcess = null;
    let folderPath = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'execute') {
                executeInteractive(ws, data, (proc, folder) => {
                    javaProcess = proc;
                    folderPath = folder;
                });
            } else if (data.type === 'input') {
                // Send input to the running Java process
                if (javaProcess && javaProcess.stdin) {
                    // xterm sends \r for Enter, convert to \n for proper line ending
                    const input = data.value === '\r' ? '\n' : data.value;
                    javaProcess.stdin.write(input);
                }
            }
        } catch (err) {
            console.error('[WS] Parse error:', err);
            ws.send(JSON.stringify({ type: 'error', message: err.toString() }));
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        // Kill process if still running
        if (javaProcess) {
            javaProcess.kill();
        }
        // Cleanup
        if (folderPath) {
            try {
                fs.rmSync(folderPath, { recursive: true, force: true });
            } catch (err) {
                console.error('[WS] Cleanup failed:', err);
            }
        }
    });

    ws.on('error', (err) => {
        console.error('[WS] Error:', err);
    });
});

// Helper function for interactive execution
function executeInteractive(ws, data, storeProcesses) {
    const { language, code } = data;

    if (language !== 'java') {
        ws.send(JSON.stringify({ type: 'error', message: 'Only Java is supported' }));
        return;
    }

    const id = uuidv4();
    const folderPath = path.join(os.tmpdir(), id);

    // Extract class name
    const classNameMatch = code.match(/public\s+class\s+(\w+)/);
    const className = classNameMatch ? classNameMatch[1] : 'Main';
    const filePath = path.join(folderPath, `${className}.java`);

    try {
        fs.mkdirSync(folderPath, { recursive: true });
        fs.writeFileSync(filePath, code);

        // Compile
        const javac = spawn('javac', [filePath]);
        let compileError = '';

        javac.stderr.on('data', (data) => {
            compileError += data.toString();
        });

        javac.on('close', (code) => {
            if (code !== 0) {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Compilation failed',
                    stderr: compileError
                }));
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (err) {}
                return;
            }

            // Compile succeeded, now run
            const java = spawn('java', ['-cp', folderPath, className]);

            let timedOut = false;
            const timeout = setTimeout(() => {
                timedOut = true;
                java.kill();
            }, 30000); // 30 second timeout

            // Send startup message
            ws.send(JSON.stringify({ type: 'ready', message: 'Ready for input' }));

            // Capture stdout
            java.stdout.on('data', (data) => {
                ws.send(JSON.stringify({
                    type: 'output',
                    data: data.toString()
                }));
            });

            // Capture stderr
            java.stderr.on('data', (data) => {
                ws.send(JSON.stringify({
                    type: 'error',
                    data: data.toString()
                }));
            });

            java.on('close', (exitCode) => {
                clearTimeout(timeout);

                if (timedOut) {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Execution Timed Out'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'exit',
                        code: exitCode
                    }));
                }

                // Cleanup
                try {
                    fs.rmSync(folderPath, { recursive: true, force: true });
                } catch (err) {}
            });

            java.on('error', (err) => {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: err.toString()
                }));
            });

            storeProcesses(java, folderPath);
        });

    } catch (err) {
        console.error('[WS] Error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.toString() }));
    }
}

// --- 5. PORT BINDING ---
// IMPORTANT: Bind to 0.0.0.0 for external access
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`[SUCCESS] Instruct-Execute live on port ${PORT}`);
    console.log(`[REST] HTTP API on :${PORT}/execute`);
    console.log(`[WS] WebSocket on ws://0.0.0.0:${PORT}`);
});