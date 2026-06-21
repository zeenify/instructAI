import { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { Play, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import InteractiveTerminal from '../../components/student/InteractiveTerminal';

export default function CodeIDE({ block, onSolve, lessonId  }) {
    const { mode, code: initialCode, expected } = block.data;
    const [code, setCode] = useState(initialCode || "");
    const [output, setOutput] = useState("");
    const [input, setInput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [isWrong, setIsWrong] = useState(false);
    const [activeTab, setActiveTab] = useState('editor');
    const [errorType, setErrorType] = useState(null);
    const terminalRef = useRef(null); 

    useEffect(() => {
        if (block.data.is_solved) {
            setIsCorrect(true);
        }
    }, [block.data.is_solved]);

    const handleRun = async () => {
        setIsRunning(true);
        setIsWrong(false); 
        setOutput("Compiling...");
        
        try {
            const res = await api.post('/student/execute', {
                code: code,
                language: 'java',
                input: input || undefined
            });

            const data = res.data;

            if (data.compile_output) {
                setErrorType('compile');
                setOutput(data.compile_output);
                setIsCorrect(false);
                return;
            }

            if (data.stderr) {
                setErrorType('runtime');
                setOutput(data.stderr);
                setIsCorrect(false);
                return;
            }

            const rawOutput = (data.stdout || "").trim();
            const cleanOutput = rawOutput.replace(/\r\n/g, '\n');

            setErrorType(null);
            setOutput(cleanOutput || "> Program executed successfully (No output).");

            if (block.data.mode === 'challenge') {
                const expected = (block.data.expected || "").trim().replace(/\r\n/g, '\n');

                if (cleanOutput === expected) {
                    setIsCorrect(true);
                    setIsWrong(false);

                    await api.post(`/student/lessons/${lessonId}/submit-code`, {
                        block_id: block.id,
                        code: code
                    });

                    onSolve();
                    toast.success("Challenge Solved!");
                } else {
                    setIsCorrect(false);
                    setIsWrong(true);
                    toast.error("Incorrect. Look closely at the expected output.");
                    setTimeout(() => setIsWrong(false), 8000);
                }
            }

        } catch (err) {
            console.error(err);
            setOutput("System Error: Could not reach the execution engine. Please check your internet.");
        } finally {
            setIsRunning(false);
        }
    };

    const getModeColor = () => {
        if (isCorrect) return { bg: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: '#10b981' };
        if (isWrong) return { bg: 'rgba(239, 68, 68, 0.1)', border: '#ef4444', text: '#ef4444' };
        if (mode === 'challenge') return { bg: 'rgba(34, 211, 238, 0.08)', border: '#22d3ee', text: '#22d3ee' };
        return { bg: 'rgba(168, 85, 247, 0.08)', border: '#a855f7', text: '#a855f7' };
    };

    const colors = getModeColor();

    return (
        <motion.div
            animate={isWrong ? { x: [-4, 4, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            style={{
                margin: '32px 0',
                borderRadius: '24px',
                border: `1.5px solid ${colors.border}`,
                overflow: 'hidden',
                background: 'var(--bg-secondary)',
                boxShadow: `0 0 30px ${colors.border}20`,
                transition: 'all 0.5s ease'
            }}
        >
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '8px 10px', borderRadius: '10px', background: `${colors.bg}`, color: colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s' }}>
                        <Play size={14} />
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: colors.text, transition: 'all 0.5s' }}>
                        {isWrong ? 'Logic Error' : `${mode.toUpperCase()} Mode`}
                    </span>
                </div>

                <AnimatePresence mode="wait">
                    {isCorrect ? (
                        <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            <CheckCircle size={14} /> Challenge Solved
                        </motion.div>
                    ) : isWrong ? (
                        <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
                gap: '0'
            }}>
                <button
                    onClick={() => setActiveTab('editor')}
                    style={{
                        flex: 1,
                        padding: '16px 24px',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: 'none',
                        background: activeTab === 'editor' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                        color: activeTab === 'editor' ? '#a855f7' : 'var(--text-tertiary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderBottom: activeTab === 'editor' ? '2px solid #a855f7' : 'none'
                    }}
                >
                    Code Editor
                </button>
                <button
                    onClick={() => setActiveTab('terminal')}
                    style={{
                        flex: 1,
                        padding: '16px 24px',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        border: 'none',
                        background: activeTab === 'terminal' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
                        color: activeTab === 'terminal' ? '#a855f7' : 'var(--text-tertiary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderBottom: activeTab === 'terminal' ? '2px solid #a855f7' : 'none'
                    }}
                >
                    Terminal Output
                </button>
            </div>

            {/* Tab Content */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '500px'
            }}>
                {/* Code Editor Tab */}
                {activeTab === 'editor' && (
                    <div style={{ flex: 1, overflow: 'auto' }}>
                        <CodeMirror
                            value={code}
                            height="100%"
                            theme="dark"
                            extensions={[java()]}
                            onChange={(value) => setCode(value)}
                            className="text-sm"
                        />
                    </div>
                )}

                {/* Terminal Tab */}
                {activeTab === 'terminal' && (
                    <div style={{
                        flex: 1,
                        overflow: 'auto',
                        padding: '20px 24px',
                        fontFamily: 'monospace',
                        fontSize: '13px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        background: '#0d0d1a'
                    }}>
                        {output ? (
                            <>
                                {errorType && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        marginBottom: '16px',
                                        padding: '12px 16px',
                                        borderRadius: '12px',
                                        background: errorType === 'compile' ? 'rgba(239, 68, 68, 0.1)' : errorType === 'runtime' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                                        border: `1px solid ${errorType === 'compile' ? 'rgba(239, 68, 68, 0.3)' : errorType === 'runtime' ? 'rgba(249, 115, 22, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                                        color: errorType === 'compile' ? '#ef4444' : errorType === 'runtime' ? '#f97316' : '#a855f7'
                                    }}>
                                        <AlertCircle size={18} />
                                        <span style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}>
                                            {errorType === 'compile' ? '⚠️ COMPILATION ERROR' : errorType === 'runtime' ? '⚠️ RUNTIME ERROR' : '⚠️ VERIFICATION ERROR'}
                                        </span>
                                    </div>
                                )}
                                <div style={{
                                    color: errorType === 'compile' ? '#fca5a5' : errorType === 'runtime' ? '#fdba74' : errorType === 'verification' ? '#d8b4fe' : 'var(--accent)'
                                }}>
                                    {output}
                                </div>
                            </>
                        ) : (
                            <div style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                Click "Run Program" to see output...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Run Button Footer */}
            <div style={{
                padding: '16px 24px',
                background: 'var(--bg-tertiary)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
            }}>
                <button
                    onClick={() => {
                        setActiveTab('terminal');
                        setTimeout(() => {
                            handleRun();
                        }, 100);
                    }}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '14px',
                        fontWeight: 900,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(168, 85, 247, 0.15)',
                        color: '#a855f7',
                        boxShadow: '0 10px 30px rgba(168, 85, 247, 0.2)',
                        transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 15px 40px rgba(168, 85, 247, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(168, 85, 247, 0.2)';
                    }}
                >
                    <Play size={16} fill="currentColor" />
                    Run Program
                </button>
            </div>

            {/* Expected Output - For Challenge Mode */}
            {mode === 'challenge' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid var(--accent-glow)', background: 'var(--accent-light)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', margin: '0 0 12px 0' }}>Expected Output:</p>
                    <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-glow)', padding: '16px', borderRadius: '12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {block.data.expected}
                    </div>
                </motion.div>
            )}

            {/* Reset Button */}
            <div style={{ padding: '16px 24px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => setCode(initialCode)}
                    style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '10px', fontWeight: 900 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-glow)'; e.currentTarget.style.color = 'var(--accent)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                    title="Reset Code"
                >
                    <RefreshCw size={14} />
                    Reset Code
                </button>
            </div>
        </motion.div>
    );
}
