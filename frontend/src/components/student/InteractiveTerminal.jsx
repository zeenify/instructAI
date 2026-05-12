import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { Play, Loader2, AlertCircle } from 'lucide-react';

const InteractiveTerminal = React.forwardRef(function InteractiveTerminal({ code, onComplete, lessonId, blockId, mode, expected, compact = false, onRun }, ref) {
    const terminalRef = useRef(null);
    const wsRef = useRef(null);
    const termRef = useRef(null);
    const [isRunning, setIsRunning] = useState(false);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Initialize xterm
        const term = new Terminal({
            cols: 80,
            rows: 24,
            theme: {
                background: '#050120',
                foreground: '#cbd5e1',
                cursor: '#a855f7',
            },
            fontFamily: 'Courier New, monospace',
            fontSize: 13,
            cursorBlink: true,
            scrollback: 1000
        });

        term.open(terminalRef.current);
        termRef.current = term;

        // User input handler - buffer input and send on Enter
        let inputBuffer = '';
        term.onData((data) => {
            // Handle backspace
            if (data === '' || data === '\b') {
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    term.write('\b \b'); // Backspace, space, backspace to erase
                }
                return;
            }

            // Handle Enter
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

            // Regular character - add to buffer and echo
            inputBuffer += data;
            term.write(data);
        });

        return () => {
            if (termRef.current) {
                termRef.current.dispose();
            }
        };
    }, []);

    React.useImperativeHandle(ref, () => ({
        triggerRun: handleRun
    }));

    const handleRun = async () => {
        if (!code || !code.trim()) {
            termRef.current?.write('\r\n> Error: No code to execute\r\n');
            return;
        }

        onRun?.();
        setIsRunning(true);
        setHasError(false);
        termRef.current?.clear();
        termRef.current?.write('> Connecting to execution engine...\r\n');

        // Connect WebSocket
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
        const ws = new WebSocket(wsUrl);

        wsRef.current = ws;

        ws.onopen = () => {
            termRef.current?.write('> Compiling...\r\n');
            ws.send(JSON.stringify({
                type: 'execute',
                language: 'java',
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
                        setIsRunning(false);

                        // Handle challenge verification
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
            setIsRunning(false);
        };

        ws.onclose = () => {
            if (isRunning) {
                termRef.current?.write('\r\n> Connection closed\r\n');
                setIsRunning(false);
            }
        };
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            margin: compact ? '0' : '32px 0',
            borderRadius: compact ? '0' : '24px',
            border: compact ? 'none' : '1.5px solid rgba(168, 85, 247, 0.3)',
            overflow: 'hidden',
            background: compact ? 'transparent' : 'rgba(5, 1, 29, 0.5)',
            boxShadow: compact ? 'none' : '0 0 30px rgba(168, 85, 247, 0.1)',
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
                        background: 'rgba(168, 85, 247, 0.1)',
                        color: '#a855f7',
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
                        color: '#a855f7'
                    }}>
                        Interactive Terminal
                    </span>
                </div>
                {isRunning && <Loader2 size={14} className="animate-spin" style={{ color: '#22d3ee' }} />}
            </div>}

            {/* Terminal */}
            <div style={{
                background: '#050120',
                padding: '16px',
                flex: 1,
                overflow: 'auto'
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
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#a855f7',
                        boxShadow: '0 10px 30px rgba(168, 85, 247, 0.2)',
                        opacity: isRunning ? 0.6 : 1,
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        if (!isRunning) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(168, 85, 247, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isRunning) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(168, 85, 247, 0.2)';
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
