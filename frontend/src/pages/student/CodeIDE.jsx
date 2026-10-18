import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Play, CheckCircle, CheckCircle2, XCircle, AlertCircle, RefreshCw, Terminal as TerminalIcon, Eye, Code2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import InteractiveTerminal from '../../components/student/InteractiveTerminal';
import {
    injectPreviewBridge,
    languageOf,
    resolveLanguage,
    cmExtension,
    normalizeHtmlChecks,
    normalizeChallengeCases,
    htmlCheckLabel,
    composeWebProject,
    normalizeFiles,
    parseStoredFiles,
    webFileKind,
} from '../../utils/codeLanguages';
import { html as htmlExt } from '@codemirror/lang-html';
import { css as cssExt } from '@codemirror/lang-css';
import { javascript as jsExt } from '@codemirror/lang-javascript';

function cmExtensionForFile(name, languageId) {
    const kind = webFileKind(name);
    if (kind === 'css') return cssExt();
    if (kind === 'js') return jsExt();
    if (kind === 'html') return htmlExt();
    return cmExtension(languageId);
}

const CASE_PRE_STYLE = {
    margin: '0 0 8px',
    padding: '10px 12px',
    borderRadius: '9px',
    background: 'rgba(13, 13, 26, 0.55)',
    border: '1px solid var(--accent-glow)',
    fontFamily: 'Courier New, monospace',
    fontSize: '12.5px',
    lineHeight: 1.55,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: 'var(--text-primary)',
};

const OUTPUT_COLORS = {
    compile: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⚠️ COMPILATION ERROR' },
    runtime: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', label: '⚠️ RUNTIME ERROR' },
    timeout: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⏱️ EXECUTION TIMED OUT' },
    system: { bg: 'rgba(10, 132, 255, 0.1)', border: 'rgba(10, 132, 255, 0.3)', text: '#0a84ff', label: '⚠️ SYSTEM ERROR' },
};

export default function CodeIDE({ block, onSolve, lessonId }) {
    const { mode, code: initialCode } = block.data;
    const languageId = resolveLanguage(block.data.language, initialCode);
    const lang = languageOf(languageId);
    const isHtml = lang.preview;

    const draftKey = `instructai-code-draft-${block.id}`;
    const starterFiles = normalizeFiles(block.data.files, initialCode || lang.template);
    const [files, setFiles] = useState(() => {
        // Solved blocks show the server-submitted code; otherwise the local
        // draft wins over the starter so a refresh really never loses work.
        if (block.data.is_solved && initialCode) {
            return parseStoredFiles(initialCode) || normalizeFiles(block.data.files, initialCode);
        }
        try {
            const draft = localStorage.getItem(draftKey);
            if (!block.data.is_solved && draft !== null) {
                return parseStoredFiles(draft) || normalizeFiles(block.data.files, draft);
            }
        } catch { /* storage blocked */ }
        return starterFiles;
    });
    const [activeFileIdx, setActiveFileIdx] = useState(0);
    const safeActiveFileIdx = Math.min(activeFileIdx, files.length - 1);
    const activeFile = files[safeActiveFileIdx] || files[0];
    // `code` mirrors the active html/main file so the run, challenge and
    // submission paths keep working for both single- and multi-file blocks.
    const code = activeFile ? activeFile.content : '';
    const setActiveFileContent = (value) => {
        setFiles((prev) => prev.map((f, i) => (i === safeActiveFileIdx ? { ...f, content: value } : f)));
    };
    const isMultiFileHtml = isHtml && files.length > 1;
    const [output, setOutput] = useState('');
    const [resultMeta, setResultMeta] = useState(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [isWrong, setIsWrong] = useState(false);
    const [activeTab, setActiveTab] = useState('editor');
    const [errorType, setErrorType] = useState(null);
    const [previewSrcDoc, setPreviewSrcDoc] = useState('');
    const [consoleLines, setConsoleLines] = useState([]);
    // The Terminal tab hosts the LIVE interactive terminal — run and type
    // while the program asks; no pre-typed stdin anywhere.
    const liveTermRef = useRef(null);
    // The terminal tab mounts lazily — a run requested before the interactive
    // terminal exists fires the moment it mounts.
    const pendingTerminalRunRef = useRef(false);
    // Challenges for HTML pages grade against structured checks (element /
    // attribute / style / text assertions) run inside the preview iframe.
    const htmlChecks = isHtml && mode === 'challenge'
        ? normalizeHtmlChecks(block.data.html_checks, block.data.expected)
        : [];
    // Non-web challenges grade against test cases: each case runs the program
    // with its own stdin and compares console output exactly. Legacy content
    // without test cases grades on the single `expected` goal (one case).
    const challengeCases = mode === 'challenge' && !isHtml
        ? normalizeChallengeCases(block.data.test_cases, block.data.expected)
        : [];
    const [caseResults, setCaseResults] = useState(null);
    const [runningCase, setRunningCase] = useState(0);
    const [checkResults, setCheckResults] = useState(null);
    const pendingCheckRef = useRef(null);
    const runCountRef = useRef(0);
    const containerRef = useRef(null);

    useEffect(() => {
        if (block.data.is_solved) {
            setIsCorrect(true);
        }
    }, [block.data.is_solved]);

    // Persist drafts so a refresh never loses a student's work
    useEffect(() => {
        try {
            localStorage.setItem(draftKey, isHtml && files.length > 0 ? JSON.stringify(files) : code);
        } catch { /* storage full/blocked */ }
    }, [files, code, draftKey, isHtml]);

    // Listen for console output + page-check results from the preview iframe
    useEffect(() => {
        if (!isHtml) return undefined;
        const handler = (event) => {
            if (!event.data || !event.data.__instructai_preview) return;
            if (event.data.type === 'console') {
                setConsoleLines((prev) => [...prev.slice(-199), { level: event.data.level, message: event.data.message }]);
            } else if (event.data.type === 'check-results' && pendingCheckRef.current) {
                const check = pendingCheckRef.current;
                pendingCheckRef.current = null;
                const results = event.data.results || [];
                setCheckResults(results);
                const allPassed = results.length > 0 && results.every((r) => r.passed);
                if (allPassed) {
                    check.onPass();
                } else {
                    check.onFail(results);
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
                code: isHtml && files.length > 0 ? JSON.stringify(files) : code,
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
                onPass: () => markSolved(),
                onFail: (results) => {
                    setIsWrong(true);
                    const failed = (results || []).filter((r) => !r.passed);
                    const first = failed[0];
                    toast.error(first && first.detail ? `Check failed: ${first.detail}` : 'The page does not pass every check yet.');
                    setTimeout(() => setIsWrong(false), 8000);
                },
            }
            : null;

        setCheckResults(null);
        // Identical srcDoc strings don't reload the iframe (no fresh document,
        // no check run) — a per-run marker forces the reload every time.
        runCountRef.current += 1;
        setPreviewSrcDoc(injectPreviewBridge(composeWebProject(files), htmlChecks) + '<!--run-' + runCountRef.current + '-->');
        // Give the iframe a beat to boot; long-running scripts resolve the check
        pendingCheckRef.current = check;
        setTimeout(() => {
            setIsRunning(false);
            if (check && pendingCheckRef.current === check) {
                pendingCheckRef.current = null;
                check.onFail([]);
            }
        }, 3500);
    };

    const handleCodeRun = async () => {
        setIsRunning(true);
        setIsWrong(false);
        setErrorType(null);
        setOutput('');
        setResultMeta(null);
        setCaseResults(null);

        try {
            if (challengeCases.length > 0) {
                // Multi-case challenge: run the program once per case with the
                // case's stdin, then compare console output exactly.
                const results = [];
                let lastData = null;

                for (let i = 0; i < challengeCases.length; i += 1) {
                    const c = challengeCases[i];
                    setRunningCase(i + 1);

                    const res = await api.post('/student/execute', {
                        code,
                        language: languageId,
                        input: c.input || undefined,
                    });
                    const data = res.data;
                    lastData = data;
                    setResultMeta({
                        duration_ms: data.duration_ms,
                        exit_code: data.exit_code,
                        timed_out: data.timed_out,
                    });

                    if (data.compile_output) {
                        setErrorType('compile');
                        setOutput(data.compile_output);
                        setIsCorrect(false);
                        if (results.length > 0) setCaseResults([...results]);

                        return;
                    }
                    if (data.timed_out || (data.stderr && data.stderr.includes('Execution Timed Out'))) {
                        setErrorType('timeout');
                        setOutput(data.stderr || 'Execution Timed Out');
                        setIsCorrect(false);
                        if (results.length > 0) setCaseResults([...results]);

                        return;
                    }
                    if (data.stderr) {
                        setErrorType('runtime');
                        setOutput(data.stderr);
                        setIsCorrect(false);
                        if (results.length > 0) setCaseResults([...results]);

                        return;
                    }

                    const cleanOutput = (data.stdout || '').trim().replace(/\r\n/g, '\n');
                    // An empty expected output means the program must print nothing
                    results.push({
                        ...c,
                        actual: cleanOutput,
                        passed: cleanOutput === c.expected_output.replace(/\r\n/g, '\n'),
                    });
                    // Land each verdict as it completes so the section fills live
                    setCaseResults([...results]);

                }

                setRunningCase(0);
                setOutput((results[results.length - 1]?.actual) || '');
                setCaseResults(results);
                const passedCount = results.filter((r) => r.passed).length;


                if (results.every((r) => r.passed) && results.length > 0) {
                    await markSolved();
                } else {
                    const failed = results.filter((r) => !r.passed).length;
                    setIsCorrect(false);
                    setIsWrong(true);
                    toast.error(`${failed} of ${results.length} test cases failed — compare your output with each case.`);
                    setTimeout(() => setIsWrong(false), 8000);
                }
                return;
            }

            // Single run — playground, or a legacy challenge with only a goal
            const res = await api.post('/student/execute', {
                code,
                language: languageId,
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
            setRunningCase(0);
        }
    };

    // The Terminal tab mounts lazily: remember a run requested before the
    // interactive terminal exists and fire it the moment it mounts.
    useEffect(() => {
        if (activeTab === 'terminal' && pendingTerminalRunRef.current && liveTermRef.current) {
            pendingTerminalRunRef.current = false;
            liveTermRef.current.triggerRun();
        }
    }, [activeTab]);

    const runInLiveTerminal = () => {
        setActiveTab('terminal');
        if (liveTermRef.current) {
            liveTermRef.current.triggerRun();
            pendingTerminalRunRef.current = false;
        } else {
            pendingTerminalRunRef.current = true;
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
        // The terminal always plays the current code live — in a playground
        // that IS the run; in a challenge it runs WHILE the test cases grade.
        runInLiveTerminal();
        if (mode === 'challenge') {
            handleCodeRun();
        }
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
        setFiles(normalizeFiles(block.data.files, block.data.code || lang.template));
        try { localStorage.removeItem(draftKey); } catch { /* noop */ }
        toast.info('Code reset');
    };

    const getModeColor = () => {
        if (isCorrect) return { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' };
        if (isWrong) return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' };
        if (mode === 'challenge') return { bg: 'rgba(34, 211, 238, 0.08)', border: '#22d3ee', text: '#22d3ee' };
        return { bg: 'rgba(10, 132, 255, 0.08)', border: '#0a84ff', text: '#0a84ff' };
    };

    const colors = getModeColor();
    // Challenge with real test cases: Run grades the code — show that clearly
    const isChecking = !isHtml && mode === 'challenge' && challengeCases.length > 0 && isRunning;
    const tabs = isHtml
        ? [{ id: 'editor', label: 'Code', icon: Code2 }, { id: 'preview', label: 'Preview', icon: Eye }, { id: 'console', label: 'Console', icon: TerminalIcon }]
        : [
            { id: 'editor', label: 'Code Editor', icon: Code2 },
            { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
        ];

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
                            background: activeTab === tab.id ? 'rgba(10, 132, 255, 0.1)' : 'transparent',
                            color: activeTab === tab.id ? '#0a84ff' : 'var(--text-tertiary)',
                            cursor: 'pointer',
                            transition: 'all 0.3s',
                            borderBottom: activeTab === tab.id ? '2px solid #0a84ff' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                        }}
                    >
                        <tab.icon size={13} />
                        {tab.label}
                        {tab.id === 'console' && consoleLines.length > 0 && (
                            <span style={{ background: '#0a84ff', color: '#fff', borderRadius: '999px', fontSize: '9px', padding: '1px 7px', fontWeight: 900 }}>{consoleLines.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                {(activeTab === 'editor' || (!isHtml && activeTab === 'preview') || (!isHtml && activeTab === 'console')) && (
                    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                        {isMultiFileHtml && (
                            <div style={{ display: 'flex', gap: '2px', padding: '8px 12px 0', background: '#0d0d1a', flexWrap: 'wrap' }}>
                                {files.map((f, i) => (
                                    <button
                                        key={f.name + i}
                                        onClick={() => setActiveFileIdx(i)}
                                        style={{
                                            padding: '7px 14px',
                                            fontSize: '10px',
                                            fontWeight: 800,
                                            fontFamily: 'monospace',
                                            border: 'none',
                                            cursor: 'pointer',
                                            borderRadius: '8px 8px 0 0',
                                            background: safeActiveFileIdx === i ? '#1a1a2e' : 'transparent',
                                            color: safeActiveFileIdx === i ? (webFileKind(f.name) === 'css' ? '#7dd3fc' : webFileKind(f.name) === 'js' ? '#fbbf24' : '#fb923c') : '#64748b',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        <CodeMirror
                            value={activeFile ? activeFile.content : ''}
                            height={isMultiFileHtml ? 'calc(100% - 37px)' : '100%'}
                            theme="dark"
                            extensions={[cmExtensionForFile(activeFile ? activeFile.name : 'index.html', languageId)]}
                            onChange={(value) => setActiveFileContent(value)}
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

                {isHtml && activeTab === 'preview' && htmlChecks.length > 0 && (
                    <div style={{ padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.06)', background: '#0d0d1a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: 0, color: '#22d3ee', textTransform: 'uppercase' }}>
                                Page Checks
                            </span>
                            {checkResults && (
                                <span style={{
                                    fontSize: '10px', fontWeight: 900, padding: '2px 10px', borderRadius: '999px',
                                    color: checkResults.every((r) => r.passed) ? '#34d399' : '#fbbf24',
                                    background: checkResults.every((r) => r.passed) ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.12)',
                                }}>
                                    {checkResults.filter((r) => r.passed).length}/{checkResults.length} passing
                                </span>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {(checkResults || htmlChecks.map((c, i) => ({ id: c.id, label: htmlCheckLabel(c), passed: null, detail: '', _i: i }))).map((r, i) => (
                                <div key={r.id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                    {r.passed === null || r.passed === undefined ? (
                                        <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '1.5px dashed #475569', flexShrink: 0 }} />
                                    ) : r.passed ? (
                                        <CheckCircle size={14} color="#34d399" style={{ flexShrink: 0 }} />
                                    ) : (
                                        <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
                                    )}
                                    <span style={{ color: r.passed ? '#e2e8f0' : '#94a3b8' }}>
                                        {r.label || htmlCheckLabel(htmlChecks[i] || {})}
                                    </span>
                                    {!r.passed && r.detail ? (
                                        <span style={{ color: '#fca5a5', fontSize: '11px' }}>— {r.detail}</span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
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

                {!isHtml && activeTab === 'terminal' && (
                    <div style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {/* The live terminal — run here and type while the
                            program asks, exactly like the real thing. Run (or
                            ⌘/Ctrl+Enter) plays the latest editor code. */}
                        <div style={{ flex: 1, minHeight: 0, width: '100%', minWidth: 0, overflow: 'hidden' }}>
                            <InteractiveTerminal
                                ref={liveTermRef}
                                code={code}
                                language={languageId}
                                mode={mode}
                                compact
                            />
                        </div>
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
                            transition: 'all 0.3s',
                            opacity: isRunning ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                            if (isRunning) return;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 15px 40px rgba(10, 132, 255, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 10px 30px rgba(10, 132, 255, 0.2)';
                        }}
                    >
                        {isChecking ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                        {isHtml ? 'Run Page' : isChecking ? 'Checking…' : 'Run Program'}
                    </button>
                </div>
            </div>


            {/* Test Cases - For non-web Challenge Mode. Before running, each
                case shows its input and the expected output; after running,
                each shows what the student's program actually printed. */}
            {mode === 'challenge' && !isHtml && challengeCases.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid var(--accent-glow)', background: 'var(--accent-light)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px 0' }}>
                        Test Cases — all must pass
                    </p>
                    {/* Live checking status — grading is running, shown outside the terminal */}
                    {isChecking && runningCase > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', padding: '10px 14px', borderRadius: '12px', background: 'rgba(10, 132, 255, 0.08)', border: '1px solid rgba(10, 132, 255, 0.3)' }}>
                            <Loader2 size={14} className="animate-spin" style={{ color: '#0a84ff', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em', color: '#0a84ff' }}>
                                Checking your code with the test cases — running case {runningCase} of {challengeCases.length}…
                            </span>
                        </div>
                    )}
                    {/* Confirmation summary + errors live HERE (outside the
                        terminal — the terminal stays a plain interactive one) */}
                    {errorType && output && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px', padding: '12px 16px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <AlertCircle size={16} style={{ color: '#f87171', flexShrink: 0, marginTop: 2 }} />
                            <div>
                                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f87171' }}>
                                    {OUTPUT_COLORS[errorType]?.label || 'ERROR'}
                                </span>
                                <pre style={{ margin: '6px 0 0', fontFamily: 'monospace', fontSize: '11.5px', color: '#fca5a5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{output}</pre>
                            </div>
                        </div>
                    )}
                    {caseResults && (
                        <p style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: caseResults.every((r) => r.passed) ? '#10b981' : '#ef4444', margin: '0 0 12px 0' }}>
                            Result: {caseResults.filter((r) => r.passed).length} of {caseResults.length} test cases passed
                            {caseResults.every((r) => r.passed) ? ' — challenge complete!' : ' — fix your program and run again.'}
                        </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {challengeCases.map((c, i) => {
                            const r = caseResults?.[i];
                            const passed = Boolean(r && r.passed);
                            const failed = Boolean(r && !r.passed);
                            return (
                                <div key={c.id || i} style={{
                                    background: 'var(--accent-light)',
                                    border: `1px solid ${r ? (passed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)') : 'var(--accent-glow)'}`,
                                    borderRadius: '12px',
                                    padding: '12px 16px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                            Case {i + 1}{c.input ? ` — reads: ${c.input}` : ' — no input'}
                                        </span>
                                        {r && (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                                                padding: '3px 10px', borderRadius: '999px',
                                                background: passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                                color: passed ? '#10b981' : '#ef4444',
                                            }}>
                                                {passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                                                {passed ? 'Passed' : 'Failed'}
                                            </span>
                                        )}
                                        {!r && isChecking && runningCase > 0 && (
                                            runningCase === i + 1 ? (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    padding: '3px 10px', borderRadius: '999px',
                                                    background: 'rgba(10, 132, 255, 0.12)', color: '#0a84ff',
                                                }}>
                                                    <Loader2 size={11} className="animate-spin" /> Checking…
                                                </span>
                                            ) : (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                    fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    padding: '3px 10px', borderRadius: '999px',
                                                    background: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-tertiary)',
                                                }}>
                                                    <span style={{ width: '11px', height: '11px', borderRadius: '50%', border: '1.5px dashed var(--border-color)' }} /> Waiting
                                                </span>
                                            )
                                        )}
                                    </div>
                                    <pre style={CASE_PRE_STYLE}>{`expected output:\n${c.expected_output}`}</pre>
                                    {r && failed && (
                                        <pre style={{ ...CASE_PRE_STYLE, color: '#f87171' }}>{`your output:\n${r.actual || '(no output)'}`}</pre>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}
        </motion.div>
    );
}
