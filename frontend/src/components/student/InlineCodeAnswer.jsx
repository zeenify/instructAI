// The compact code-answer editor used by quizzes (QuizDisplay/QuizRoomView),
// class activities (ActivityViewer) and any other surface where a student
// writes and runs code inside a question. Lesson-level playgrounds use the
// richer CodeIDE instead; this one is trimmed to fit inside question cards.
import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Play, Loader2, RotateCcw, Eye, Code2, Terminal as TerminalIcon, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import InteractiveTerminal from './InteractiveTerminal';
import {
    languageOf,
    cmExtension,
    injectPreviewBridge,
    htmlCheckLabel,
    normalizeHtmlChecks,
} from '../../utils/codeLanguages';

const ERROR_STYLES = {
    compile: { color: '#fca5a5', label: 'COMPILATION ERROR' },
    runtime: { color: '#fdba74', label: 'RUNTIME ERROR' },
    timeout: { color: '#f87171', label: 'EXECUTION TIMED OUT' },
    system: { color: '#7dd3a8', label: 'SYSTEM ERROR' },
};

export default function InlineCodeAnswer({
    language,
    value,
    onChange,
    boilerplate = '',
    disabled = false,
    height = '240px',
    challengeExpected = null, // when set, a matching page/output shows a success chip
    sampleTests = [],         // teacher-provided (input -> expected) pairs shown to students
    htmlChecks: htmlChecksProp = [], // structured page checks for HTML questions
    onCheckResults = null,    // (resultsById) => void — reported with the submission
}) {
    const lang = languageOf(language);
    const isHtml = lang.preview;
    const [isRunning, setIsRunning] = useState(false);
    const [output, setOutput] = useState('');
    const [errorType, setErrorType] = useState(null);
    const [meta, setMeta] = useState(null);
    const [tab, setTab] = useState('code');
    const [previewDoc, setPreviewDoc] = useState('');
    const [consoleLines, setConsoleLines] = useState([]);
    const [passed, setPassed] = useState(false);
    const [actualOutput, setActualOutput] = useState(null); // for expected-vs-actual display
    // The Terminal tab hosts the LIVE interactive terminal — input is typed
    // while the program runs, never preemptively.
    const liveTermRef = useRef(null);
    // HTML page checks: explicit structured checks win; a legacy expected-text
    // string is synthesized into a single page-text check.
    const htmlChecks = isHtml ? normalizeHtmlChecks(htmlChecksProp, challengeExpected) : [];
    const [checkResults, setCheckResults] = useState(null);
    const pendingCheckRef = useRef(null);
    const runCountRef = useRef(0);
    const containerRef = useRef(null);

    useEffect(() => { setPassed(false); setActualOutput(null); setCheckResults(null); }, [language]);

    useEffect(() => {
        if (!isHtml) return undefined;
        const handler = (event) => {
            if (!event.data || !event.data.__instructai_preview) return;
            if (event.data.type === 'console') {
                setConsoleLines((prev) => [...prev.slice(-99), { level: event.data.level, message: event.data.message }]);
            } else if (event.data.type === 'check-results' && pendingCheckRef.current) {
                pendingCheckRef.current = null;
                const results = event.data.results || [];
                setCheckResults(results);
                const byId = {};
                results.forEach((r) => { byId[r.id] = !!r.passed; });
                const allPassed = results.length > 0 && results.every((r) => r.passed);
                setPassed(allPassed);
                onCheckResults?.(byId);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHtml]);

    const handleRun = async () => {
        if (isRunning || disabled) return;
        setIsRunning(true);
        setOutput('');
        setErrorType(null);
        setMeta(null);
        setPassed(false);
        setActualOutput(null);

        if (isHtml) {
            setConsoleLines([]);
            // Identical srcDoc strings don't reload the iframe — bust it per run.
            runCountRef.current += 1;
            setPreviewDoc(injectPreviewBridge(value || boilerplate, htmlChecks) + '<!--run-' + runCountRef.current + '-->');
            pendingCheckRef.current = true;
            setTab('preview');
            setTimeout(() => {
                setIsRunning(false);
                pendingCheckRef.current = null;
            }, 3500);
            return;
        }

        try {
            const res = await api.post('/student/execute', {
                code: value || boilerplate,
                language: lang.id,
            }, { timeout: 45000 });
            const data = res.data;
            setMeta({ duration_ms: data.duration_ms, exit_code: data.exit_code });

            if (data.compile_output) {
                setErrorType('compile');
                setOutput(data.compile_output);
                liveTermRef.current?.write(`\r\n[COMPILE ERROR]\r\n${data.compile_output}\r\n`);
            } else if (data.timed_out) {
                setErrorType('timeout');
                setOutput(data.stderr || 'Execution Timed Out');
                liveTermRef.current?.write(`\r\n[EXECUTION TIMED OUT]\r\n${data.stderr || ''}\r\n`);
            } else if (data.stderr) {
                setErrorType('runtime');
                setOutput(data.stderr);
                liveTermRef.current?.write(`[RUNTIME ERROR] ${data.stderr}\r\n`);
            } else {
                const clean = (data.stdout || '').trim().replace(/\r\n/g, '\n');
                setOutput(clean || '> Program executed successfully (No output).');
                setActualOutput(clean);
                const isMatch = challengeExpected
                    ? clean === String(challengeExpected).trim().replace(/\r\n/g, '\n')
                    : false;
                if (challengeExpected) {
                    setPassed(isMatch);
                }
                // Results first, then the live terminal right below — the
                // student can keep interacting without any pre-typed input.
                setTab('terminal');
                liveTermRef.current?.write(`\r\n${clean || '(no output)'}\r\n`);
                if (challengeExpected) {
                    liveTermRef.current?.write(
                        isMatch
                            ? '> Output matches — passed!\r\n'
                            : `\r\n[EXPECTED]\r\n${String(challengeExpected).trim().replace(/\r\n/g, '\n')}\r\n`,
                    );
                }
            }
        } catch {
            setErrorType('system');
            setOutput('Could not reach the execution engine. Check your connection and try again.');
        } finally {
            setIsRunning(false);
        }
    };

    // Ctrl/Cmd + Enter runs from anywhere inside the card
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const onKey = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                handleRun();
            }
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    });

    const headerLabel = isHtml ? 'Web Page' : `${lang.label} Source Code`;

    return (
        <div ref={containerRef} tabIndex={-1} style={{ borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden', outline: 'none' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px',
                        background: `${lang.color}1f`, border: `1px solid ${lang.color}55`,
                        fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: lang.color,
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lang.color }} />
                        {lang.label}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                        {headerLabel}
                    </span>
                    {passed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '999px' }}>
                            ✓ Output matches
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {isHtml ? (
                        <>
                            <button onClick={() => setTab('code')} type="button" style={tabBtnStyle(tab === 'code')}><Code2 size={11} /> Code</button>
                            <button onClick={() => setTab('preview')} type="button" style={tabBtnStyle(tab === 'preview')}><Eye size={11} /> Preview</button>
                            <button onClick={() => setTab('console')} type="button" style={tabBtnStyle(tab === 'console')}>
                                <TerminalIcon size={11} /> Console{consoleLines.length > 0 ? ` (${consoleLines.length})` : ''}
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={() => setTab('code')} type="button" style={tabBtnStyle(tab === 'code')}><Code2 size={11} /> Code</button>
                            <button onClick={() => setTab('terminal')} type="button" style={tabBtnStyle(tab === 'terminal')}><TerminalIcon size={11} /> Terminal</button>
                        </>
                    )}
                </div>
            </div>

            {/* Sample tests: show the I/O contract for input-dependent problems */}
            {!isHtml && sampleTests.length > 0 && tab === 'code' && (
                <div style={{ padding: '10px 16px', background: 'rgba(56, 189, 248, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                    <p style={{ fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#7dd3a8', margin: '0 0 6px 0' }}>
                        Sample tests — your program must produce the expected output for the given input
                    </p>
                    {sampleTests.map((t, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'monospace', fontSize: '11px', padding: '4px 0', flexWrap: 'wrap' }}>
                            <span style={{ color: '#94a3b8' }}>Input:</span>
                            <span style={{ background: '#111127', color: '#7dd3fc', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'pre-wrap', maxWidth: '40%', overflowWrap: 'anywhere' }}>
                                {t.input === '' ? '(none)' : t.input}
                            </span>
                            <ArrowRight size={12} style={{ color: '#64748b' }} />
                            <span style={{ color: '#94a3b8' }}>Expected:</span>
                            <span style={{ background: '#111127', color: '#86efac', padding: '2px 8px', borderRadius: '6px', whiteSpace: 'pre-wrap', maxWidth: '40%', overflowWrap: 'anywhere' }}>
                                {t.expected_output}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Body */}
            {tab === 'code' && (
                <CodeMirror
                    value={value || boilerplate}
                    onChange={onChange}
                    editable={!disabled}
                    height={height}
                    extensions={[cmExtension(lang.id)]}
                    theme="dark"
                />
            )}

            {isHtml && tab === 'preview' && (
                <div style={{ background: '#fff', position: 'relative' }}>
                    <div style={{ height, position: 'relative' }}>
                        {previewDoc ? (
                            <iframe
                                title="HTML Preview"
                                srcDoc={previewDoc}
                                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'monospace', fontSize: '12px' }}>
                                Click "Run Page" to render
                            </div>
                        )}
                    </div>
                    {htmlChecks.length > 0 && (
                        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.06)', background: '#0d0d1a' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '10.5px', fontWeight: 900, letterSpacing: '.2em', color: '#7dd3a8', textTransform: 'uppercase' }}>
                                    Page Checks
                                </span>
                                {checkResults && (
                                    <span style={{
                                        fontSize: '10.5px', fontWeight: 900, padding: '2px 8px', borderRadius: '999px',
                                        color: checkResults.every((r) => r.passed) ? '#34d399' : '#fbbf24',
                                        background: checkResults.every((r) => r.passed) ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)',
                                    }}>
                                        {checkResults.filter((r) => r.passed).length}/{checkResults.length} passing
                                    </span>
                                )}
                            </div>
                            {(checkResults || htmlChecks.map((c) => ({ id: c.id, label: htmlCheckLabel(c), passed: null, detail: '' }))).map((r, i) => (
                                <div key={r.id || i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', padding: '2px 0' }}>
                                    {r.passed === null || r.passed === undefined ? (
                                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px dashed #475569', flexShrink: 0 }} />
                                    ) : r.passed ? (
                                        <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                                    ) : (
                                        <span style={{ color: '#f87171', flexShrink: 0 }}>✕</span>
                                    )}
                                    <span style={{ color: r.passed ? '#e2e8f0' : '#94a3b8' }}>
                                        {r.label || htmlCheckLabel(htmlChecks[i] || {})}
                                    </span>
                                    {!r.passed && r.detail ? <span style={{ color: '#fca5a5', fontSize: '10px' }}>— {r.detail}</span> : null}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {isHtml && tab === 'console' && (
                <div style={{ height, overflow: 'auto', padding: '12px 16px', background: '#0d0d1a', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.7' }}>
                    {consoleLines.length === 0 ? (
                        <span style={{ color: '#64748b', fontStyle: 'italic' }}>console.log() output appears here...</span>
                    ) : (
                        consoleLines.map((line, i) => (
                            <div key={i} style={{ color: line.level === 'error' ? '#f87171' : line.level === 'warn' ? '#fbbf24' : '#7dd3fc' }}>
                                <span style={{ color: '#64748b', marginRight: '8px' }}>›</span>{line.message}
                            </div>
                        ))
                    )}
                </div>
            )}

            {!isHtml && tab === 'terminal' && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Run results — shown first, above the live terminal */}
                    {(errorType || meta || (challengeExpected != null && actualOutput !== null && !errorType)) && (
                        <div style={{ padding: '12px 16px', background: '#0d0d1a', borderBottom: '1px solid rgba(148, 163, 184, 0.15)' }}>
                            {errorType && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                    <AlertCircle size={14} style={{ color: ERROR_STYLES[errorType].color }} />
                                    <span style={{ color: ERROR_STYLES[errorType].color, fontWeight: 900, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>
                                        {ERROR_STYLES[errorType].label}
                                    </span>
                                    {errorType === 'system' && (
                                        <button onClick={handleRun} type="button" style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid rgba(125, 211, 168, 0.4)', borderRadius: '6px', color: '#7dd3a8', cursor: 'pointer', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '3px 8px' }}>
                                            Retry
                                        </button>
                                    )}
                                </div>
                            )}
                            {meta && (
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                    {meta.duration_ms != null && (
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                            {(meta.duration_ms / 1000).toFixed(2)}s
                                        </span>
                                    )}
                                    {meta.exit_code != null && meta.exit_code !== 0 && (
                                        <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#f87171', background: 'rgba(248, 113, 113, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                            EXIT {meta.exit_code}
                                        </span>
                                    )}
                                </div>
                            )}
                            {/* Expected vs actual when the teacher defined an output contract */}
                            {challengeExpected != null && actualOutput !== null && !errorType && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '45%' }}>
                                        <p style={{ fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0 0 4px 0' }}>Expected</p>
                                        <div style={{ background: '#111127', border: '1px solid rgba(134, 239, 172, 0.3)', borderRadius: '8px', padding: '8px 10px', color: '#86efac', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                            {String(challengeExpected)}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: '45%' }}>
                                        <p style={{ fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0 0 4px 0' }}>Your output</p>
                                        <div style={{ background: '#111127', border: `1px solid ${passed ? 'rgba(134, 239, 172, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`, borderRadius: '8px', padding: '8px 10px', color: passed ? '#86efac' : '#fca5a5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                                            {actualOutput || '(no output)'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* The live terminal — run again here and type while the
                        program asks, exactly like the real thing */}
                    <div style={{ height }}>
                        <InteractiveTerminal
                            ref={liveTermRef}
                            code={value || boilerplate}
                            language={lang.id}
                            compact
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        {isHtml ? 'Renders in a sandboxed preview' : '⌘/Ctrl + Enter to run — type input while it runs'}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {!disabled && (
                        <button
                            onClick={() => onChange(boilerplate)}
                            type="button"
                            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', cursor: 'pointer', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                            <RotateCcw size={11} /> Reset Starter
                        </button>
                    )}
                    <button
                        onClick={handleRun}
                        disabled={isRunning || disabled}
                        type="button"
                        style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: isRunning || disabled ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', opacity: isRunning || disabled ? 0.6 : 1 }}
                    >
                        {isRunning ? <Loader2 className="animate-spin" size={13} /> : <Play size={13} />}
                        {isHtml ? 'Run Page' : 'Run'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function tabBtnStyle(active) {
    return {
        padding: '6px 12px',
        borderRadius: '8px',
        border: 'none',
        background: active ? 'rgba(10, 132, 255, 0.14)' : 'transparent',
        color: active ? '#0066cc' : 'var(--text-tertiary)',
        cursor: 'pointer',
        fontWeight: 800,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        transition: 'all 0.2s',
    };
}
