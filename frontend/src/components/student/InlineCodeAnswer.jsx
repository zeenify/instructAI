// The compact code-answer editor used by quizzes (QuizDisplay/QuizRoomView),
// class activities (ActivityViewer) and any other surface where a student
// writes and runs code inside a question. Lesson-level playgrounds use the
// richer CodeIDE instead; this one is trimmed to fit inside question cards.
import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Play, Loader2, RotateCcw, Eye, Code2, Terminal as TerminalIcon, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import {
    languageOf,
    cmExtension,
    injectPreviewBridge,
    normalizePageText,
} from '../../utils/codeLanguages';

const ERROR_STYLES = {
    compile: { color: '#fca5a5', label: 'COMPILATION ERROR' },
    runtime: { color: '#fdba74', label: 'RUNTIME ERROR' },
    timeout: { color: '#f87171', label: 'EXECUTION TIMED OUT' },
    system: { color: '#d8b4fe', label: 'SYSTEM ERROR' },
};

export default function InlineCodeAnswer({
    language,
    value,
    onChange,
    boilerplate = '',
    disabled = false,
    height = '240px',
    challengeExpected = null, // when set, a matching page/output shows a success chip
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
    const pendingCheckRef = useRef(null);

    useEffect(() => { setPassed(false); }, [language]);

    useEffect(() => {
        if (!isHtml) return undefined;
        const handler = (event) => {
            if (!event.data || !event.data.__instructai_preview) return;
            if (event.data.type === 'console') {
                setConsoleLines((prev) => [...prev.slice(-99), { level: event.data.level, message: event.data.message }]);
            } else if (event.data.type === 'page-text' && pendingCheckRef.current) {
                const check = pendingCheckRef.current;
                pendingCheckRef.current = null;
                const ok = normalizePageText(event.data.text).includes(normalizePageText(check));
                setPassed(ok);
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isHtml]);

    const handleRun = async () => {
        if (isRunning || disabled) return;
        setIsRunning(true);
        setOutput('');
        setErrorType(null);
        setMeta(null);
        setPassed(false);

        if (isHtml) {
            setConsoleLines([]);
            setPreviewDoc(injectPreviewBridge(value || boilerplate));
            pendingCheckRef.current = challengeExpected;
            setTab('preview');
            setTimeout(() => {
                setIsRunning(false);
                if (pendingCheckRef.current) {
                    pendingCheckRef.current = null;
                    setPassed(false);
                }
            }, 2500);
            return;
        }

        try {
            const res = await api.post('/student/execute', {
                code: value || boilerplate,
                language: lang.id,
            });
            const data = res.data;
            setMeta({ duration_ms: data.duration_ms, exit_code: data.exit_code });

            if (data.compile_output) {
                setErrorType('compile');
                setOutput(data.compile_output);
            } else if (data.timed_out) {
                setErrorType('timeout');
                setOutput(data.stderr || 'Execution Timed Out');
            } else if (data.stderr) {
                setErrorType('runtime');
                setOutput(data.stderr);
            } else {
                const clean = (data.stdout || '').trim().replace(/\r\n/g, '\n');
                setOutput(clean || '> Program executed successfully (No output).');
                if (challengeExpected) {
                    setPassed(clean === String(challengeExpected).trim().replace(/\r\n/g, '\n'));
                }
                setTab('output');
            }
        } catch {
            setErrorType('system');
            setOutput('Could not reach the execution engine. Check your connection and try again.');
        } finally {
            setIsRunning(false);
        }
    };

    const headerLabel = isHtml ? 'Web Page' : `${lang.label} Source Code`;

    return (
        <div style={{ borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px',
                        background: `${lang.color}1f`, border: `1px solid ${lang.color}55`,
                        fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: lang.color,
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lang.color }} />
                        {lang.label}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                        {headerLabel}
                    </span>
                    {passed && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '999px' }}>
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
                            <button onClick={() => setTab('output')} type="button" style={tabBtnStyle(tab === 'output')}><TerminalIcon size={11} /> Output</button>
                        </>
                    )}
                </div>
            </div>

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
                <div style={{ height, background: '#fff', position: 'relative' }}>
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

            {!isHtml && tab === 'output' && (
                <div style={{ height, overflow: 'auto', padding: '12px 16px', background: '#0d0d1a', fontFamily: 'monospace', fontSize: '12.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {errorType && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                            <AlertCircle size={14} style={{ color: ERROR_STYLES[errorType].color }} />
                            <span style={{ color: ERROR_STYLES[errorType].color, fontWeight: 900, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.1em' }}>
                                {ERROR_STYLES[errorType].label}
                            </span>
                        </div>
                    )}
                    {meta && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                            {meta.duration_ms != null && (
                                <span style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', background: 'rgba(148, 163, 184, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                    {(meta.duration_ms / 1000).toFixed(2)}s
                                </span>
                            )}
                            {meta.exit_code != null && (
                                <span style={{ fontSize: '9px', fontWeight: 800, color: meta.exit_code === 0 ? '#34d399' : '#f87171', background: meta.exit_code === 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(248, 113, 113, 0.12)', padding: '2px 8px', borderRadius: '999px' }}>
                                    EXIT {meta.exit_code}
                                </span>
                            )}
                        </div>
                    )}
                    <span style={{ color: errorType ? ERROR_STYLES[errorType].color : '#a5f3fc' }}>
                        {output || (isRunning ? 'Running...' : 'Click "Run" to see the output...')}
                    </span>
                </div>
            )}

            {/* Footer */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    {isHtml ? 'Renders in a sandboxed preview' : 'Runs on the InstructAI engine'}
                </span>
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
        background: active ? 'rgba(168, 85, 247, 0.14)' : 'transparent',
        color: active ? '#c084fc' : 'var(--text-tertiary)',
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
