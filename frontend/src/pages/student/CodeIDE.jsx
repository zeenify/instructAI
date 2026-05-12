import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { Play, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';


export default function CodeIDE({ block, onSolve, lessonId  }) {
    const { mode, code: initialCode, expected } = block.data;
    const [code, setCode] = useState(initialCode || "");
    const [output, setOutput] = useState("");
    const [isRunning, setIsRunning] = useState(false);
    const [isCorrect, setIsCorrect] = useState(false);
    const [isWrong, setIsWrong] = useState(false); 

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
                language: 'java'
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

            {/* Editor & Terminal Area */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', minHeight: '400px' }}>
                <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <CodeMirror
                        value={code}
                        height="400px"
                        theme="dark"
                        extensions={[java()]}
                        onChange={(value) => setCode(value)}
                        className="text-sm"
                    />
                </div>

                {/* Terminal Area */}
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '20px', fontFamily: 'Courier New, monospace', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '400px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', paddingBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <span>Console Output</span>
                        {isRunning && <Loader2 size={12} className="animate-spin" style={{ color: '#22d3ee' }} />}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', fontSize: '13px', color: isWrong ? '#ef4444' : '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word', transition: 'color 0.5s' }}>
                        {output || "> Ready to execute..."}
                    </div>
                </div>
            </div>

            {/* Expected Output - Separate section below */}
            {mode === 'challenge' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ padding: '20px 24px', borderTop: '1px solid rgba(34, 211, 238, 0.2)', background: 'rgba(34, 211, 238, 0.02)' }}>
                    <p style={{ fontSize: '10px', color: '#22d3ee', fontWeight: 900, textTransform: 'uppercase', marginBottom: '12px', margin: '0 0 12px 0' }}>Expected Output:</p>
                    <div style={{ background: 'rgba(34, 211, 238, 0.08)', border: '1px solid rgba(34, 211, 238, 0.2)', padding: '16px', borderRadius: '12px', color: '#a5f3fc', fontSize: '13px', fontFamily: 'Courier New, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {block.data.expected}
                    </div>
                </motion.div>
            )}

            {/* Footer Actions */}
            <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <button
                    onClick={() => setCode(initialCode)}
                    style={{ padding: '10px 12px', background: 'transparent', border: 'none', borderRadius: '10px', color: '#64748b', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={(e) => { e.currentTarget.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.color = 'white'; }}
                    onMouseLeave={(e) => { e.currentTarget.background = 'transparent'; e.currentTarget.color = '#64748b'; }}
                    title="Reset Code"
                >
                    <RefreshCw size={18} />
                </button>

                <button
                    disabled={isRunning || isCorrect}
                    onClick={handleRun}
                    style={{
                        padding: '12px 28px',
                        borderRadius: '14px',
                        fontWeight: 900,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        border: 'none',
                        cursor: isRunning || isCorrect ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.3s',
                        background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : colors.bg,
                        color: isCorrect ? '#10b981' : colors.text,
                        boxShadow: isCorrect ? 'none' : `0 10px 30px ${colors.text}20`,
                        opacity: isCorrect ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                        if (!isRunning && !isCorrect) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = `0 15px 40px ${colors.text}30`;
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (!isRunning && !isCorrect) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = `0 10px 30px ${colors.text}20`;
                        }
                    }}
                >
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                    {isCorrect ? 'Completed' : (mode === 'challenge' ? 'Verify Logic' : 'Run Program')}
                </button>
            </div>
        </motion.div>
    );
}