import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Play, Loader2, Square } from 'lucide-react';
import { languageOf } from '../../utils/codeLanguages';

const TERMINAL_BG = '#0d0d1a';

const InteractiveTerminal = React.forwardRef(function InteractiveTerminal({ code, language = 'java', onComplete, lessonId, blockId, mode, expected, compact = false, onRun, onRunningChange }, ref) {
    const terminalRef = useRef(null);
    const wsRef = useRef(null);
    const termRef = useRef(null);
    const fitRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const isRunningRef = useRef(false);
    // Single choke point so external listeners (e.g. a grading pane's Run
    // button) track running state through every exit path
    const setRunning = (v) => {
        isRunningRef.current = v;
        setIsRunning(v);
        onRunningChange?.(v);
    };
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const term = new Terminal({
            // rows/cols come from the FitAddon — the terminal fills its panel
            rows: 24,
            theme: {
                background: TERMINAL_BG,
                foreground: '#cbd5e1',
                cursor: '#0a84ff',
            },
            fontFamily: 'Courier New, monospace',
            fontSize: 13,
            cursorBlink: true,
            scrollback: 1000,
            convertEol: true,
        });

        term.open(terminalRef.current);
        termRef.current = term;

        // Resize to the panel — the terminal always fills what it's given.
        // Guarded: during layout transitions a container can report absurd
        // sizes (a 43k-wide mount was observed) — retry instead of trusting.
        const fit = new FitAddon();
        term.loadAddon(fit);
        fitRef.current = fit;
        let fitRetries = 0;
        const fitNow = () => {
            try {
                if (!terminalRef.current || terminalRef.current.clientWidth === 0) return;
                const dims = fit.proposeDimensions();
                if (dims && dims.cols && dims.rows && dims.cols >= 5 && dims.cols <= 400 && dims.rows >= 3 && dims.rows <= 160) {
                    fit.fit();
                    fitRetries = 0;
                } else if (fitRetries < 12) {
                    fitRetries += 1;
                    requestAnimationFrame(fitNow);
                }
            } catch { /* container hidden — next resize retries */ }
        };
        fitNow();
        const observer = new ResizeObserver(fitNow);
        observer.observe(terminalRef.current);
        window.addEventListener('resize', fitNow);

        let inputBuffer = '';
        term.onData((data) => {
            // \x7f is DEL — some terminals send it for backspace
            if (data === '\x7f' || data === '\b') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    term.write('\b \b');
                }
                return;
            }

            // Ctrl+D = EOF: closes stdin so read-until-EOF programs finish
            if (data === '\u0004') {
                term.write('\r\n[stdin closed - Ctrl+D]\r\n');
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'eof' }));
                }
                inputBuffer = '';
                return;
            }

            if (data === '\r' || data === '\n') {
                term.write('\r\n');
                inputBuffer += '\n';
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'input',
                        value: inputBuffer
                    }));
                }
                inputBuffer = '';
                return;
            }

            inputBuffer += data;
            term.write(data);
        });

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', fitNow);
            if (termRef.current) {
                termRef.current.dispose();
            }
        };
    }, []);

    React.useImperativeHandle(ref, () => ({
        triggerRun: handleRun,
        // External surfaces (challenge results, summaries) write straight into
        // the same scrollback the live session uses — one continuous terminal.
        write: (text) => {
            termRef.current?.write(String(text).replace(/\n/g, '\r\n'));
        },
        clear: () => termRef.current?.clear(),
        stop: () => {
            try {
                wsRef.current?.send(JSON.stringify({ type: 'stop' }));
            } catch { /* socket already gone */ }
        },
    }));

    const handleRun = async () => {
        if (!code || !code.trim()) {
            termRef.current?.write('\r\n> Error: No code to execute\r\n');
            return;
        }

        onRun?.();
        setRunning(true);
        setHasError(false);
        termRef.current?.clear();
        const langLabel = languageOf(language).label;
        const compiling = ['java', 'cpp'].includes(language);
        termRef.current?.write(`> ${compiling ? 'Compiling' : 'Starting'} ${langLabel} program...\r\n`);

        // localhost defaults (committed .env, dev engines) must never leak into
        // a hosted build — fall back to the deployed engine there.
        let wsBase = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
        if (wsBase.includes('localhost') && !window.location.hostname.includes('localhost')) {
            wsBase = 'wss://instruct-execute.onrender.com';
        }
        const wsToken = import.meta.env.VITE_WS_TOKEN;
        const wsUrl = wsToken ? `${wsBase}${wsBase.includes('?') ? '&' : '?'}token=${encodeURIComponent(wsToken)}` : wsBase;
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'execute',
                language: language,
                code: code
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                switch (data.type) {
                    case 'ready':
                        termRef.current?.write('\r\n> Ready for input\r\n');
                        break;

                    case 'output':
                        termRef.current?.write(data.data);
                        break;

                    case 'error':
                        setHasError(true);
                        termRef.current?.write(`\r\n[ERROR] ${data.data || data.message}\r\n`);
                        break;

                    case 'exit':
                        termRef.current?.write(`\r\n> Process exited with code ${data.code}\r\n`);
                        setRunning(false);

                        if (mode === 'challenge' && onComplete) {
                            onComplete();
                        }

                        ws.close();
                        wsRef.current = null;
                        break;
                }
            } catch (err) {
                console.error('Parse error:', err);
            }
        };

        ws.onerror = (err) => {
            setHasError(true);
            termRef.current?.write(`\r\n[CONNECTION ERROR] ${err.message}\r\n`);
            setRunning(false);
        };

        ws.onclose = () => {
            if (isRunningRef.current) {
                termRef.current?.write('\r\n> Connection closed\r\n');
                setRunning(false);
            }
        };
    };

    return (
        <div className="interactive-terminal" style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            margin: compact ? '0' : '32px 0',
            borderRadius: compact ? '0' : '24px',
            border: compact ? 'none' : '1.5px solid rgba(10, 132, 255, 0.3)',
            overflow: 'hidden',
            background: compact ? 'transparent' : TERMINAL_BG,
            boxShadow: compact ? 'none' : '0 0 30px rgba(10, 132, 255, 0.1)',
        }}>
            {/* Header */}
            {!compact && <div style={{
                padding: '20px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: 'rgba(10, 132, 255, 0.1)',
                        color: '#0a84ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Play size={14} />
                    </div>
                    <span style={{
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: '#0a84ff'
                    }}>
                        Interactive Terminal
                    </span>
                </div>
                {isRunning && <Loader2 size={14} className="animate-spin" style={{ color: '#22d3ee' }} />}
            </div>}

            {/* Terminal - stays dark per spec */}
            <div style={{
                background: TERMINAL_BG,
                padding: compact ? '8px 10px' : '16px',
                flex: 1,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden'
            }} ref={terminalRef}></div>

            {/* Footer */}
            {!compact && <div style={{
                padding: '16px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                flexShrink: 0
            }}>
                <button
                    onClick={handleRun}
                    disabled={isRunning}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '14px',
                        fontWeight: 900,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        border: 'none',
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(10, 132, 255, 0.15)',
                        color: '#0a84ff',
                        boxShadow: '0 10px 30px rgba(10, 132, 255, 0.2)',
                        opacity: isRunning ? 0.6 : 1,
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        if (!isRunning) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(10, 132, 255, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isRunning) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(10, 132, 255, 0.2)';
                        }
                    }}
                >
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                    {isRunning ? 'Running...' : 'Run Program'}
                </button>
            </div>}
        </div>
    );
});

export default InteractiveTerminal;
