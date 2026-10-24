import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { Play, CheckCircle2, XCircle, AlertCircle, RefreshCw, Terminal as TerminalIcon, Eye, Code2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import InteractiveTerminal from '../../components/student/InteractiveTerminal';
import TerminalOutput from '../../components/student/TerminalOutput';
import {
    injectPreviewBridge,
    languageOf,
    resolveLanguage,
    cmExtension,
    detectStdinUsage,
    normalizeHtmlChecks,
    normalizeChallengeCases,
    htmlCheckLabel,
    composeWebProject,
    normalizeFiles,
    parseStoredFiles,
    webFileKind,
    READS_CLOSED_STDIN,
} from '../../utils/codeLanguages';
import { html as htmlExt } from '@codemirror/lang-html';
import { css as cssExt } from '@codemirror/lang-css';
import { javascript as jsExt } from '@codemirror/lang-javascript';

function cmExtensionForFile(name, languageId) {
    const kind = webFileKind(name);
    if (kind === 'css') return cssExt();
    if (kind === 'js') return jsExt();
    if (kind === 'html') {
        // Legacy blocks of real code languages kept the default index.html
        // name — the block's language outranks the file name here, so Python
        // never gets parsed (and greyed out) as HTML
        const lang = languageOf(languageId);
        if (!lang.preview) return cmExtension(languageId);
        return htmlExt();
    }
    return cmExtension(languageId);
}

const CASE_PRE_STYLE = {
    margin: 0,
    padding: '10px 12px',
    borderRadius: '10px',
    background: 'rgba(2, 6, 23, 0.72)',
    border: '1px solid rgba(148, 163, 184, 0.18)',
    fontFamily: 'Courier New, monospace',
    fontSize: '12px',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#e2e8f0',
};

const CASE_LABEL_STYLE = {
    margin: '0 0 5px',
    fontSize: '9px',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'var(--text-tertiary)',
};

const OUTPUT_COLORS = {
    compile: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⚠️ COMPILATION ERROR' },
    runtime: { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316', label: '⚠️ RUNTIME ERROR' },
    timeout: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444', label: '⏱️ EXECUTION TIMED OUT' },
    system: { bg: 'rgba(10, 132, 255, 0.1)', border: 'rgba(10, 132, 255, 0.3)', text: '#0a84ff', label: '⚠️ SYSTEM ERROR' },
};

// The scaffold's prompt lines (System.out.print("Enter a number: ")) are
// boilerplate noise, not student logic — AI-generated expected outputs
// sometimes bake them in and sometimes don't. After an exact match fails,
// compare again with every printed literal removed from BOTH sides so a
// correct solution doesn't fail over prompt-echo disagreement.
function extractPrintedLiterals(boilerplate) {
    if (!boilerplate) return [];
    const found = new Set();
    for (const re of [
        /System\.out\.print(?:ln)?\(\s*"((?:[^"\\]|\\.)*)"/g,
        /printf?\(\s*"((?:[^"\\]|\\.)*)"/g,
        /cout\s*<<\s*"((?:[^"\\]|\\.)*)"/g,
    ]) {
        let m;
        while ((m = re.exec(boilerplate)) !== null) {
            try {
                // source escapes (\n, \t, \") decode to their real characters
                found.add(JSON.parse(`"${m[1]}"`));
            } catch { /* malformed escape — skip that literal */ }
        }
    }
    return [...found].filter((s) => s.trim().length > 0);
}

function outputsMatch(actual, expected, promptLiterals) {
    if (!promptLiterals || promptLiterals.length === 0) return false;
    const strip = (s) => {
        let out = s;
        for (const lit of promptLiterals) out = out.split(lit).join('');
        return out.trim();
    };
    return strip(actual) === strip(expected) && strip(actual).length > 0;
}

// Expected/actual stdout includes the scaffold's input prompt glued to the
// result line ("Enter a number: The number is positive.") — true output, but
// reading it as one string hides what the student is actually asked to
// produce. The prompt part renders dimmed so the required result stands out.
// Expected/actual stdout includes the scaffold's input prompt glued to the
// result line — the ENGINE doesn't echo typed keys, but the student's
// TERMINAL does (they see their own input, then the result on a new line).
// Render the same picture: dimmed prompt + the typed input echoed + the
// result starting on its own line, so the two views are comparable.
function OutputWithDimmedPrompt({ text, promptLiterals, echoInput, error }) {
    const style = error
        ? { ...CASE_PRE_STYLE, color: '#fca5a5', borderColor: 'rgba(239, 68, 68, 0.3)' }
        : CASE_PRE_STYLE;
    let litIndex = -1;
    let lit = '';
    for (const candidate of promptLiterals || []) {
        const at = text.indexOf(candidate);
        if (at !== -1 && (litIndex === -1 || at < litIndex)) {
            litIndex = at;
            lit = candidate;
        }
    }
    if (litIndex === -1) return <pre style={style}>{text}</pre>;
    const promptPart = text.slice(0, litIndex + lit.length);
    const afterPrompt = text.slice(litIndex + lit.length);
    const hasEcho = typeof echoInput === 'string' && echoInput.trim().length > 0
        && !afterPrompt.startsWith(echoInput);
    return (
        <pre style={style}>
            <span style={{ color: '#94a3b8' }} title="printed by the starter code before your input">{promptPart}</span>
            {hasEcho ? echoInput : null}
            {hasEcho ? '\n' : ''}
            {afterPrompt}
        </pre>
    );
}

// Header tab pills — same look as the quiz/activity inline code editor
function ideTabStyle(active) {
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
    // Terminal-graded challenges (stdin programs whose cases carry no stored
    // input — generated before inputs were verified): the terminal's printed
    // output IS the graded run
    const terminalOutputRef = useRef('');
    const terminalGradeRef = useRef(null);
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
    // Set when a grading run stops before every case ran (engine unreachable,
    // compile/timeout/runtime mid-loop) — the summary must never present a
    // partial run as "challenge complete!"
    const [abortedRun, setAbortedRun] = useState(null);
    // Lesson blocks keep the starter in `code`; activity-style blocks use
    // `boilerplate` — read prompts from both so the mirror display and the
    // prompt-tolerant compare always have the literals.
    const promptLiterals = extractPrintedLiterals(
        [block.data.boilerplate, block.data.code, initialCode].filter(Boolean).join('\n')
    );
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

    const markSolved = async () => {        setIsCorrect(true);
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

    // One engine call per test case, with a single retry for transient
    // failures (cold free-tier engine, dropped request). Deterministic 4xx
    // answers surface immediately — retrying bad code is just a slower no.
    const executeCaseWithRetry = async (payload, attempts = 2) => {
        let lastErr;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                return await api.post('/student/execute', payload);
            } catch (err) {
                lastErr = err;
                const status = err?.response?.status;
                if (status && status < 500 && status !== 503) throw err;
            }
            if (attempt + 1 < attempts) {
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
        throw lastErr;
    };

    const handleCodeRun = async () => {
        setIsRunning(true);
        setIsWrong(false);
        setErrorType(null);
        setOutput('');
        setResultMeta(null);
        setCaseResults(null);
        setAbortedRun(null);

        // Counted at try scope: the catch below reports how far the run got
        let casesRan = 0;
        try {
            if (challengeCases.length > 0) {
                // Multi-case challenge: run the program once per case with the
                // case's stdin, then compare console output exactly.
                const results = [];

                for (let i = 0; i < challengeCases.length; i += 1) {
                    const c = challengeCases[i];
                    setRunningCase(i + 1);

                    const res = await executeCaseWithRetry({
                        code,
                        language: languageId,
                        input: c.input || undefined,
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
                        if (results.length > 0) setCaseResults([...results]);
                        setAbortedRun({ ran: results.length, total: challengeCases.length, reason: 'compilation failed' });

                        return;
                    }
                    if (data.timed_out || (data.stderr && data.stderr.includes('Execution Timed Out'))) {
                        setErrorType('timeout');
                        setOutput(data.stderr || 'Execution Timed Out');
                        setIsCorrect(false);
                        if (results.length > 0) setCaseResults([...results]);
                        setAbortedRun({ ran: results.length, total: challengeCases.length, reason: 'the program exceeded its time limit' });

                        return;
                    }
                    if (data.stderr) {
                        setErrorType('runtime');
                        setOutput(data.stderr);
                        setIsCorrect(false);
                        if (results.length > 0) setCaseResults([...results]);
                        setAbortedRun({ ran: results.length, total: challengeCases.length, reason: 'a runtime error' });

                        return;
                    }

                    const cleanOutput = (data.stdout || '').trim().replace(/\r\n/g, '\n');
                    const expectedNorm = (c.expected_output || '').replace(/\r\n/g, '\n');
                    // An empty expected output means the program must print nothing
                    results.push({
                        ...c,
                        actual: cleanOutput,
                        passed: cleanOutput === expectedNorm || outputsMatch(cleanOutput, expectedNorm, promptLiterals),
                    });
                    casesRan = results.length;
                    // Land each verdict as it completes so the section fills live
                    setCaseResults([...results]);

                }

                setRunningCase(0);
                setOutput((results[results.length - 1]?.actual) || '');
                setCaseResults(results);


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

            if (data.stderr && READS_CLOSED_STDIN.test(data.stderr)) {
                // The quick check run feeds no stdin — an input-reading
                // program always reaches end-of-input here. That is not a
                // bug in the code; the terminal tab is where they interact.
                setErrorType('noinput');
                setOutput(
                    'This program reads input before it can print anything, and this quick run has nothing to feed it — so it stops right at the first read. That part is not a bug in your code.\n\nPress Run in the Terminal tab and type your input there while the program waits, like a real console.'
                );
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

                if ((cleanOutput === expected || outputsMatch(cleanOutput, expected, promptLiterals)) && expected !== '') {

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
            setOutput('System Error: Could not reach the execution engine. Please check your internet — the engine may still be waking up.');
            if (challengeCases.length > 0) {
                setAbortedRun({ ran: casesRan, total: challengeCases.length, reason: 'the engine stopped responding' });
            }
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

    // Terminal exit: challenges visit the terminal for the live run; when the
    // run is terminal-graded (see runRef), the collected output is compared
    // with the expected text and the case panel fills in. Exit itself never
    // moves tabs — the student may have just typed input here and the result
    // is what they came to see; going back to the editor is their click.
    const handleTerminalExit = (exitCode) => {
        if (terminalGradeRef.current) {
            const grade = terminalGradeRef.current;
            terminalGradeRef.current = null;
            if (block.data.is_solved || isCorrect) return;
            const actual = String(terminalOutputRef.current || '').replace(/\r\n/g, '\n').trim();
            const expected = String(grade.expected || '').replace(/\r\n/g, '\n').trim();
            const passed = Boolean(actual) && exitCode === 0
                && (actual === expected || outputsMatch(actual, expected, promptLiterals));
            const c = challengeCases[0] || { id: 'terminal', input: '', expected_output: expected };
            setCaseResults([{ ...c, actual, passed }]);
            if (passed) {
                markSolved();
            } else {
                setIsWrong(true);
                toast.error('The program finished but the output did not match the expected output — compare it in the case below.');
                setTimeout(() => setIsWrong(false), 8000);
            }
            return;
        }
    };

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
        // A challenge whose program reads input can't be auto-checked when
        // its cases carry no stored stdin — the run would EOF instantly and
        // the student would never type anything. Grade the LIVE terminal's
        // output instead: run here, type while the program asks, and when
        // the process exits cleanly the printed output is compared with the
        // expected text.
        if (mode === 'challenge' && challengeCases.length > 0 && detectStdinUsage(languageId, code)
            && challengeCases.every((c) => !c.input)) {
            terminalOutputRef.current = '';
            terminalGradeRef.current = { expected: challengeCases[0].expected_output || block.data.expected || '' };
            setCaseResults(null);
            runInLiveTerminal();
            toast.info('This program reads input — type while it runs in the Terminal; the run is graded when the program finishes.');
            return;
        }
        // The terminal plays the current code live — in a playground that IS
        // the run. In a challenge with stdin test cases, grading runs on its
        // own: while the case runs execute, the terminal must NOT auto-run
        // the same program too — two concurrent JVMs on the free-tier engine
        // starve each other and a graded case can come back with EMPTY output
        // (verified: same code+input passes cleanly in isolation). The
        // Terminal tab still runs manually whenever the student wants.
        if (mode === 'challenge') {
            handleCodeRun();
            if (challengeCases.length === 0 || !challengeCases.some((c) => c.input)) {
                try {
                    runInLiveTerminal();
                } catch { /* terminal is a live view only — grading already started */ }
            }
            return;
        }
        try {
            runInLiveTerminal();
        } catch { /* playground: the terminal run IS the run */ }
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
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                transition: 'all 0.5s ease',
                outline: 'none',
            }}
        >
            {/* Header — same single row as the quiz editor: language pill +
                mode on the left, tab pills on the right */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        padding: '4px 10px', borderRadius: '999px',
                        background: `${lang.color}1f`, border: `1px solid ${lang.color}55`,
                        fontSize: '10.5px', fontWeight: 900, letterSpacing: '0.1em',
                        textTransform: 'uppercase', color: lang.color,
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lang.color }} />
                        {lang.label.replace(/\s*3$/, '')}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)' }}>
                        {mode === 'challenge' ? 'Challenge' : 'Playground'}
                    </span>
                    <AnimatePresence mode="wait">
                        {isCorrect ? (
                            // initial={false}: blocks mounting already-solved must render at full size
                            <motion.span key="success" initial={false} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '999px' }}>
                                ✓ Challenge Solved
                            </motion.span>
                        ) : isWrong ? (
                            <motion.span key="error" initial={false} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: '999px' }}>
                                <AlertCircle size={11} /> Incorrect Output
                            </motion.span>
                        ) : null}
                    </AnimatePresence>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)} type="button" style={ideTabStyle(activeTab === tab.id)}>
                            <tab.icon size={11} />
                            {tab.label}
                            {tab.id === 'console' && consoleLines.length > 0 ? ` (${consoleLines.length})` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '500px' }}>
                {(activeTab === 'editor' || (!isHtml && activeTab === 'preview') || (!isHtml && activeTab === 'console')) && (
                    <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: '#0d0d1a' }}>
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
                            height={isMultiFileHtml ? 'calc(100% - 37px)' : '500px'}
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
                                        <CheckCircle2 size={14} color="#34d399" style={{ flexShrink: 0 }} />
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
                                onOutput={(chunk) => { terminalOutputRef.current += String(chunk); }}
                                onExited={handleTerminalExit}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Run Button Footer — same compact style as the quiz editor */}
            <div style={{ padding: '10px 16px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    ⌘/Ctrl + Enter to run — type input while it runs
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={handleReset}
                        type="button"
                        title="Reset Code"
                        style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.08)', color: '#60a5fa', cursor: 'pointer', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.2s' }}
                    >
                        <RefreshCw size={11} />
                        Reset
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        type="button"
                        style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: isChecking ? '#0a84ff' : '#10b981', color: 'white', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', opacity: isRunning ? 0.6 : 1, transition: 'all 0.2s' }}
                    >
                        {isChecking ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                        {isHtml ? 'Run Page' : isChecking ? 'Checking…' : 'Run'}
                    </button>
                </div>
            </div>


            {/* Test Cases - For non-web Challenge Mode. Before running, each
                case shows its input and the expected output; after running,
                each shows what the student's program actually printed. */}
            {mode === 'challenge' && !isHtml && challengeCases.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid var(--accent-glow)', background: 'var(--accent-light)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 6px 0' }}>
                        Test Cases — all must pass
                    </p>
                    <p style={{ fontSize: '10.5px', color: 'var(--text-tertiary)', margin: '0 0 12px 0' }}>
                        Gray text is the starter code's prompt. What you <em>type</em> in the terminal isn't part of the graded output — only what the program prints is.
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
                    {/* Real compiler/runtime output — verbatim from the engine */}
                    {errorType && output && (
                        <TerminalOutput
                            language={languageId}
                            kind={errorType}
                            errorText={output}
                            meta={resultMeta}
                        />
                    )}
                    {caseResults && (() => {
                        const allRan = caseResults.length === challengeCases.length;
                        const allPassed = allRan && caseResults.every((r) => r.passed);
                        if (abortedRun && !allRan) {
                            return (
                                <p style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: '#f59e0b', margin: '0 0 12px 0' }}>
                                    Result: {caseResults.filter((r) => r.passed).length} of {challengeCases.length} test cases passed — the run stopped early ({abortedRun.reason}) after case {abortedRun.ran} of {challengeCases.length}. Press Run again to grade the rest.
                                </p>
                            );
                        }
                        return (
                            <p style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.08em', color: allPassed ? '#10b981' : '#ef4444', margin: '0 0 12px 0' }}>
                                Result: {caseResults.filter((r) => r.passed).length} of {caseResults.length} test cases passed
                                {allPassed ? ' — challenge complete!' : ' — fix your program and run again.'}
                            </p>
                        );
                    })()}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {challengeCases.map((c, i) => {
                            const r = caseResults?.[i];
                            const passed = Boolean(r && r.passed);
                            const failed = Boolean(r && !r.passed);
                            return (
                                <div key={c.id || i} style={{
                                    background: 'var(--bg-secondary)',
                                    border: `1px solid ${r ? (passed ? 'rgba(16, 185, 129, 0.45)' : 'rgba(239, 68, 68, 0.45)') : 'var(--border-color)'}`,
                                    borderRadius: '12px',
                                    padding: '12px 14px',
                                    boxShadow: '0 1px 3px rgba(2, 6, 23, 0.06)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                                            Case {i + 1}
                                        </span>
                                        {c.input ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                fontSize: '10.5px', fontWeight: 700, fontFamily: 'monospace',
                                                padding: '3px 10px', borderRadius: '999px',
                                                background: 'rgba(10, 132, 255, 0.1)', color: '#60a5fa',
                                                // pre-wrap: a multi-line stdin must SHOW its line
                                                // breaks — collapsed spaces read as one command
                                                // line and mislead students about the input format
                                                whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '100%',
                                            }}>
                                                ⌨ input: {c.input}
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                                                · no input
                                            </span>
                                        )}
                                        <span style={{ flex: 1 }} />
                                        {r ? (
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
                                        ) : isChecking && runningCase > 0 ? (
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
                                        ) : null}
                                    </div>
                                                    <p style={{ ...CASE_LABEL_STYLE, marginTop: 10 }}>Expected output</p>
                                                    <OutputWithDimmedPrompt text={c.expected_output || '(nothing)'} promptLiterals={promptLiterals} echoInput={c.input || ''} />
                                                    {r && failed && (
                                                        <>
                                                            <p style={{ ...CASE_LABEL_STYLE, color: '#f87171', margin: '10px 0 5px' }}>Your output</p>
                                                            <OutputWithDimmedPrompt text={r.actual || '(no output)'} promptLiterals={promptLiterals} echoInput={c.input || ''} error />
                                                        </>
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
