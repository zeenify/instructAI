import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Play, CheckCircle, AlertCircle, RefreshCw, Terminal as TerminalIcon, Eye, Code2, ChevronDown, ChevronUp, Square, SquareTerminal } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import InteractiveTerminal from '../../components/student/InteractiveTerminal';
import {
    injectPreviewBridge,
    languageOf,
    resolveLanguage,
    cmExtension,
    normalizePageText,
    detectStdinUsage,
} from '../../utils/codeLanguages';

const OUTPUT_COLORS = {
    compile: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⚠️ COMPILATION ERROR' },
    runtime: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', label: '⚠️ RUNTIME ERROR' },
    timeout: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⏱️ EXECUTION TIMED OUT' },
    system: { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7', label: '⚠️ SYSTEM ERROR' },
};

export default function CodeIDE({ block, onSolve, lessonId }) {
    const { mode, code: initialCode } = block.data;
    const languageId = resolveLanguage(block.data.language, initialCode);
    const lang = languageOf(languageId);
    const isHtml = lang.preview;

    const draftKey = `instructai-code-draft-${block.id}`;
    const [code, setCode] = useState(() => {
        // Solved blocks show the server-submitted code; otherwise the local
        // draft wins over the starter so a refresh really never loses work.
        if (block.data.is_solved && initialCode) return initialCode;
        try {
            const draft = localStorage.getItem(draftKey);
            if (!block.data.is_solved && draft !== null) return draft;
        } catch { /* storage blocked */ }
        return initialCode || lang.template;
    });
    // Reads stdin? Drives the interactive-first defaults below. Must come
    // after `code` — it reads it.
    const readsInput = !isHtml && detectStdinUsage(languageId, code);
    const [output, setOutput] = useState('');
    const [stdin, setStdin] = useState('');
    const [resultMeta, setResultMeta] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [isWrong, setIsWrong] = useState(false);
    const [activeTab, setActiveTab] = useState('editor');
    const [errorType, setErrorType] = useState(null);
    const [previewSrcDoc, setPreviewSrcDoc] = useState('');
    const [consoleLines, setConsoleLines] = useState([]);
    const [showStdin, setShowStdin] = useState(false);
    const pendingCheckRef = useRef(null);
    const shellRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (block.data.is_solved) {
            setIsCorrect(true);
        }
    }, [block.data.is_solved]);

    // Interactive-first: playground code that reads stdin defaults to the live
    // shell (type input while it runs — like a real terminal). Challenges keep
    // the deterministic batch path with the stdin box pre-opened.
    useEffect(() => {
        if (!isHtml && detectStdinUsage(languageId, code)) {
            if (mode === 'challenge') {
                setShowStdin(true);
            } else {
                setActiveTab('shell');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist drafts so a refresh never loses a student's work
    useEffect(() => {
        try { localStorage.setItem(draftKey, code); } catch { /* storage full/blocked */ }
    }, [code, draftKey]);

    // Listen for console output + rendered text from the preview iframe
    useEffect(() => {
        if (!isHtml) return undefined;
        const handler = (event) => {
            if (!event.data || !event.data.__instructai_preview) return;
            if (event.data.type === 'console') {
                setConsoleLines((prev) => [...prev.slice(-199), { level: event.data.level, message: event.data.message }]);
            } else if (event.data.type === 'page-text' && pendingCheckRef.current) {
                const check = pendingCheckRef.current;
                pendingCheckRef.current = null;
                const rendered = normalizePageText(event.data.text);
                const expected = normalizePageText(check.expected);
                if (expected && rendered.includes(expected)) {
                    check.onPass();
                } else {
                    check.onFail();
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isHtml]);

    const markSolved = async () => {
        setIsCorrect(true);
        setIsWrong(false);
        try {
            await api.post(`/student/lessons/${lessonId}/submit-code`, {
                block_id: block.id,
                code,
            });
            // The server now holds the final code — drop the stale local draft
            try { localStorage.removeItem(draftKey); } catch { /* noop */ }
        } catch {
            /* keep the local solve state even if persistence hiccups */
        }
        onSolve();
        toast.success('Challenge Solved!');
    };

    const handleHtmlRun = () => {
        setIsRunning(true);
        setIsWrong(false);
        setErrorType(null);
        setConsoleLines([]);
        setActiveTab('preview');

        const check = mode === 'challenge'
            ? {
                expected: block.data.expected,
                onPass: () => markSolved(),
                onFail: () => {
                    setIsWrong(true);
                    toast.error('The page does not contain the expected text yet.');
                    setTimeout(() => setIsWrong(false), 8000);
                },
            }
            : null;

        setPreviewSrcDoc(injectPreviewBridge(code));
        // Give the iframe a beat to boot; long-running scripts resolve the check
        pendingCheckRef.current = check;
        setTimeout(() => {
            setIsRunning(false);
            if (check && pendingCheckRef.current === check) {
                pendingCheckRef.current = null;
                check.onFail();
            }
        }, 2500);
    };

    const handleCodeRun = async () => {
        setIsRunning(true);
        setIsWrong(false);
        setErrorType(null);
        setOutput('');
        setResultMeta(null);

        try {
            const res = await api.post('/student/execute', {
                code,
                language: languageId,
                input: stdin || undefined,
            });

            const data = res.data;
            setResultMeta({
                duration_ms: data.duration_ms,
                exit_code: data.exit_code,
                timed_out: data.timed_out,
            });

            if (data.compile_output) {
                setErrorType('compile');
                setOutput(data.compile_output);
                setIsCorrect(false);
                return;
            }

            if (data.timed_out || (data.stderr && data.stderr.includes('Execution Timed Out'))) {
                setErrorType('timeout');
                setOutput(data.stderr || 'Execution Timed Out');
                setIsCorrect(false);
                return;
            }

            if (data.stderr) {
                setErrorType('runtime');
                setOutput(data.stderr);
                setIsCorrect(false);
                return;
            }

            const rawOutput = (data.stdout || '').trim();
            const cleanOutput = rawOutput.replace(/\r\n/g, '\n');

            setErrorType(null);
            setOutput(cleanOutput || '> Program executed successfully (No output).');

            if (mode === 'challenge') {
                const expected = (block.data.expected || '').trim().replace(/\r\n/g, '\n');

                if (cleanOutput === expected && expected !== '') {
                    await markSolved();
                } else {
                    setIsCorrect(false);
                    setIsWrong(true);
                    toast.error('Incorrect. Look closely at the expected output.');
                    setTimeout(() => setIsWrong(false), 8000);
                }
            }
        } catch (err) {
            console.error(err);
            setErrorType('system');
            setOutput('System Error: Could not reach the execution engine. Please check your internet.');
        } finally {
            setIsRunning(false);
        }
    };

    // Latest run logic lives in a ref so the Ctrl+Enter listener below can
    // bind once without going stale.
    const runRef = useRef(null);
    runRef.current = () => {
        if (isRunning) return;
        if (isHtml) {
            handleHtmlRun();
            return;
        }
        if (readsInput && mode !== 'challenge') {
            // Interactive run: the program blocks waiting for live input
            setActiveTab('shell');
            shellRef.current?.triggerRun();
            return;
        }
        handleCodeRun();
    };

    const handleRun = () => runRef.current();

    // Ctrl/Cmd + Enter runs from anywhere inside the IDE
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const onKey = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                runRef.current();
            }
        };
        el.addEventListener('keydown', onKey);
        return () => el.removeEventListener('keydown', onKey);
    }, []);

    const handleReset = () => {
        const base = block.data.code || lang.template;
        setCode(base);
        try { localStorage.removeItem(draftKey); } catch { /* noop */ }
        toast.info('Code reset');
    };

    const getModeColor = () => {
        if (isCorrect) return { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' };
        if (isWrong) return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' };
        if (mode === 'challenge') return { bg: 'rgba(34, 211, 238, 0.08)', border: '#22d3ee', text: '#22d3ee' };
        return { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', text: '#a855f7' };
    };

    const colors = getModeColor();
    const tabs = isHtml
        ? [{ id: 'editor', label: 'Code', icon: Code2 }, { id: 'preview', label: 'Preview', icon: Eye }, { id: 'console', label: 'Console', icon: TerminalIcon }]
        : [
            { id: 'editor', label: 'Code Editor', icon: Code2 },
            { id: 'terminal', label: 'Terminal Output', icon: TerminalIcon },
            { id: 'shell', label: 'Interactive Shell', icon: SquareTerminal },
        ];

    const renderOutput = () => (
        <div style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px 24px',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#0d0d1a',
        }}>
            {errorType && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
                    padding: '12px 16px', borderRadius: '12px',
                    background: OUTPUT_COLORS[errorType].bg,
                    border: `1px solid ${OUTPUT_COLORS[errorType].border}`,
                    color: OUTPUT_COLORS[errorType].text,
                }}>
                    <AlertCircle size={18} />
                    <span style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}>
                        {OUTPUT_COLORS[errorType].label}
                    </span>
                </div>
            )}
            {resultMeta && (
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    {resultMeta.duration_ms != null && (
                        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', padding: '4px 10px', borderRadius: '999px' }}>
                            {(resultMeta.duration_ms / 1000).toFixed(2)}s
                        </span>
                    )}
                    {resultMeta.exit_code != null && (
                        <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', color: resultMeta.exit_code === 0 ? '#34d399' : '#f87171', background: resultMeta.exit_code === 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)', padding: '4px 10px', borderRadius: '999px' }}>
                            EXIT {resultMeta.exit_code}
                        </span>
                    )}
                </div>
            )}
            <div style={{ color: errorType ? OUTPUT_COLORS[errorType].text : 'var(--accent)' }}>
                {output || (isRunning ? 'Running...' : 'Click "Run Program" to see output...')}
            </div>
        </div>
    );

    return (
        <motion.div
            ref={containerRef}
            tabIndex={-1}
            animate={isWrong ? { x: [-4, 4, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            style={{
                margin: '32px 0',
                borderRadius: '24px',
                border: `1.5px solid ${colors.border}`,
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                boxShadow: `0 0 30px ${colors.border}20`,
                transition: 'all 0.5s ease',
                outline: 'none',
            }}
        >
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px 10px', borderRadius: '10px', background: `${colors.bg}`, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s' }}>
                        <Play size={14} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: colors.text, transition: 'all 0.5s' }}>
                        {isWrong ? 'Logic Error' : `${mode.toUpperCase()} Mode`}
                    </span>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '5px 12px', borderRadius: '999px',
                        background: `${lang.color}1f`, border: `1px solid ${lang.color}55`,
                        fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: lang.color,
                    }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: lang.color, boxShadow: `0 0 6px ${lang.color}` }} />
                        {lang.label}
                    </span>
                </div>

                <AnimatePresence mode="wait">
                    {isCorrect ? (
                        // initial={false}: the badge must render at full size when the
                        // block mounts already-solved (hydration), not stuck at scale 0.
                        <motion.div key="success" initial={false} animate={{ scale: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <CheckCircle size={14} /> Challenge Solved
                        </motion.div>
                    ) : isWrong ? (
                        // initial={false}: scale-0 enter animations don't run reliably in
                        // this tree — render the badge at full size immediately.
                        <motion.div key="error" initial={false} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <AlertCircle size={14} /> Incorrect Output
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Tab Switcher */}
            <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                background: 'var(--bg-tertiary)',
            }}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1,
                            padding: tab.id === 'editor' ? '16px 24px' : '16px 24px',
                            fontSize: '10px',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            border: 'none',
                            background: activeTab === tab.id ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                            color: activeTab === tab.id ? '#a855f7' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            borderBottom: activeTab === tab.id ? '2px solid #a855f7' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        <tab.icon size={13} />
                        {tab.label}
                        {tab.id === 'console' && consoleLines.length > 0 && (
                            <span style={{ background: '#a855f7', color: '#fff', borderRadius: '999px', fontSize: '9px', padding: '1px 7px', fontWeight: 900 }}>{consoleLines.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                {(activeTab === 'editor' || (!isHtml && activeTab === 'preview') || (!isHtml && activeTab === 'console')) && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <CodeMirror
                            value={code}
                            height="100%"
                            theme="dark"
                            extensions={[cmExtension(languageId)]}
                            onChange={(value) => setCode(value)}
                            className="text-sm"
                        />
                    </div>
                )}

                {isHtml && activeTab === 'preview' && (
                    <div style={{ flex: 1, background: '#fff', position: 'relative' }}>
                        {previewSrcDoc ? (
                            <iframe
                                title="HTML Preview"
                                srcDoc={previewSrcDoc}
                                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                            />
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontFamily: 'monospace', fontSize: '13px' }}>
                                Click "Run" to render your page
                            </div>
                        )}
                    </div>
                )}

                {isHtml && activeTab === 'console' && (
                    <div style={{
                        flex: 1, overflow: 'auto', padding: '20px 24px',
                        fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.7',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#0d0d1a',
                    }}>
                        {consoleLines.length === 0 ? (
                            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                console.log() output from your page will appear here...
                            </div>
                        ) : (
                            consoleLines.map((line, i) => (
                                <div key={i} style={{ color: line.level === 'error' ? '#f87171' : line.level === 'warn' ? '#fbbf24' : '#7dd3fc' }}>
                                    <span style={{ color: '#64748b', marginRight: '8px' }}>›</span>
                                    {line.message}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {!isHtml && activeTab === 'terminal' && renderOutput()}

                {!isHtml && activeTab === 'shell' && (
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#050120' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', flexShrink: 0 }}>
                            <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#a855f7' }}>
                                Interactive Shell — the program waits for your input, like a real terminal
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={() => shellRef.current?.stop()}
                                    style={{ padding: '8px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <Square size={10} /> Stop
                                </button>
                                <button
                                    onClick={() => shellRef.current?.triggerRun()}
                                    style={{ padding: '8px 14px', background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', color: '#c084fc', cursor: 'pointer', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '5px' }}
                                >
                                    <Play size={10} /> Run
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <InteractiveTerminal ref={shellRef} code={code} language={languageId} compact />
                        </div>
                    </div>
                )}

                {!isHtml && activeTab === 'editor' && showStdin && (
                    <div style={{ borderTop: '1px solid var(--border-color)', background: '#0d0d1a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 4px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: readsInput ? '#38bdf8' : '#94a3b8' }}>
                                {readsInput ? 'This program reads input — one line per read:' : 'Stdin — text fed to your program'}
                            </span>
                            <button onClick={() => setShowStdin(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                Hide <ChevronDown size={12} />
                            </button>
                        </div>
                        <textarea
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder="Lines of input for your program (e.g. answers to input()/Scanner)..."
                            rows={3}
                            style={{
                                width: 'calc(100% - 40px)', margin: '4px 20px 14px', boxSizing: 'border-box',
                                background: '#111127', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '10px',
                                color: '#e2e8f0', fontFamily: 'monospace', fontSize: '12px', padding: '10px 12px', resize: 'vertical',
                                outline: 'none',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Run Button Footer */}
            <div style={{
                padding: '16px 24px',
                background: 'var(--bg-tertiary)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {!isHtml && !showStdin && (
                        <button
                            onClick={() => { setShowStdin(true); setActiveTab('editor'); }}
                            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.3s' }}
                            title="Provide standard input"
                        >
                            <ChevronUp size={13} />
                            {readsInput ? 'Input needed' : 'Stdin'}
                        </button>
                    )}
                    {!isHtml && readsInput && mode !== 'challenge' && (
                        <button
                            onClick={() => { setActiveTab('shell'); shellRef.current?.triggerRun(); }}
                            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', transition: 'all 0.3s' }}
                            title="Type input live while the program runs"
                        >
                            <SquareTerminal size={12} />
                            Run Interactive
                        </button>
                    )}
                    <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                        ⌘/Ctrl + Enter to run
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={handleReset}
                        style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '10px', fontWeight: 900 }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                        title="Reset Code"
                    >
                        <RefreshCw size={14} />
                        Reset
                    </button>
                    <button
                        onClick={() => {
                            if (!isHtml) setActiveTab('terminal');
                            handleRun();
                        }}
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
                            transition: 'all 0.3s',
                            opacity: isRunning ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                            if (isRunning) return;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(168, 85, 247, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(168, 85, 247, 0.2)';
                        }}
                    >
                        <Play size={16} fill="currentColor" />
                        {isHtml ? 'Run Page' : 'Run Program'}
                    </button>
                </div>
            </div>


            {/* Expected Output - For Challenge Mode */}
            {mode === 'challenge' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid var(--accent-glow)', background: 'var(--accent-light)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                        {isHtml ? 'Expected On Page:' : 'Expected Output:'}
                    </p>
                    <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-glow)', padding: '16px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {block.data.expected}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
