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
    const terminalRef = useRef(null); 

    useEffect(() => {
        if (block.data.is_solved) {
            setIsCorrect(true);
        }
    }, [block.data.is_solved]);


    const handleRun = async () => {
        setIsRunning(true);
        setIsWrong(false); 
        setOutput("Compiling..."); // Initial feedback
        
        try {
            const res = await api.post('/student/execute', {
                code: code,
                language: 'java',
                input: input || undefined
            });

            const data = res.data;

            // 1. Check for COMPILE errors (Syntax mistakes)
            if (data.compile_output) {
                setOutput(`COMPILE ERROR:\n${data.compile_output}`);
                setIsCorrect(false);
                return;
            }

            // 2. Check for RUNTIME errors (Crashes like NullPointerException)
            if (data.stderr) {
                setOutput(`RUNTIME ERROR:\n${data.stderr}`);
                setIsCorrect(false);
                return;
            }

            // 3. Process SUCCESSFUL output
            const cleanOutput = (data.stdout || "").trim();
            
            // Show the output to the student REGARDLESS of whether it's correct
            setOutput(cleanOutput || "> Program executed successfully (No output).");

            // 4. Verification logic for Challenge Mode
            if (block.data.mode === 'challenge') {
                const expected = block.data.expected?.trim();
                
                if (cleanOutput === expected) {
                    setIsCorrect(true);
                    setIsWrong(false);

                    await api.post(`/student/lessons/${lessonId}/submit-code`, {
                        block_id: block.id,
                        code: code
                    });


                    onSolve(); // Unlock the Next button
                    toast.success("Challenge Solved!");
                } else {
                    setIsCorrect(false);
                    setIsWrong(true); 
                    // We DON'T change the output here, we just show a toast
                    toast.error("Incorrect. Look closely at the expected output.");
                    setTimeout(() => setIsWrong(false), 8000); 

                }
            }

        } catch (err) {
            // This catch block should ONLY fire if the Server is down
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
                background: 'rgba(5, 1, 29, 0.5)',
                boxShadow: `0 0 30px ${colors.border}20`,
                transition: 'all 0.5s ease'
            }}
        >
            {/* Header */}
            <div style={{ padding: '20px 24px', background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
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
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(255, 255, 255, 0.01)',
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
                        color: activeTab === 'editor' ? '#a855f7' : '#64748b',
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
                        color: activeTab === 'terminal' ? '#a855f7' : '#64748b',
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
                height: '350px'
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
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <InteractiveTerminal
                            ref={terminalRef}
                            code={code}
                            mode={mode}
                            expected={expected}
                            lessonId={lessonId}
                            blockId={block.id}
                            compact={true}
                            onRun={() => setActiveTab('terminal')}
                            onComplete={async () => {
                                setIsCorrect(true);
                                toast.success("Challenge Solved!");
                                if (mode === 'challenge') {
                                    await api.post(`/student/lessons/${lessonId}/submit-code`, {
                                        block_id: block.id,
                                        code: code
                                    });
                                    onSolve();
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Run Button Footer */}
            <div style={{
                padding: '16px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
            }}>
                <button
                    onClick={() => {
                        setActiveTab('terminal');
                        setTimeout(() => {
                            terminalRef.current?.triggerRun?.();
                        }, 0);
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
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid rgba(34, 211, 238, 0.2)', background: 'rgba(34, 211, 238, 0.02)' }}>
                    <p style={{ fontSize: '10px', color: '#22d3ee', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', margin: '0 0 12px 0' }}>Expected Output:</p>
                    <div style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '16px', borderRadius: '12px', color: '#a5f3fc', fontSize: '13px', fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {block.data.expected}
                    </div>
                </motion.div>
            )}

            {/* Reset Button */}
            <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                    onClick={() => setCode(initialCode)}
                    style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', color: '#64748b', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '10px', fontWeight: 900 }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'; e.currentTarget.style.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.color = '#64748b'; }}
                    title="Reset Code"
                >
                    <RefreshCw size={14} />
                    Reset Code
                </button>
            </div>
        </motion.div>
    );
}