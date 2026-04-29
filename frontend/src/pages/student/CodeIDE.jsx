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

    return (
        <motion.div 
            animate={isWrong ? { x: [-4, 4, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            className={`my-8 rounded-[32px] border overflow-hidden transition-all duration-500 
                ${isCorrect ? 'border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : 
                    isWrong ? 'border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.15)]' : 
                    'border-white/10 bg-[#010101]'}`}
        >
            {/* Header */}
            <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-colors duration-500 ${
                        isCorrect ? 'bg-emerald-500/20 text-emerald-400' : 
                        isWrong ? 'bg-red-500/20 text-red-400' : 
                        mode === 'challenge' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
                    }`}>
                        <Play size={14} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors duration-500 ${isWrong ? 'text-red-400' : ''}`}>
                        {isWrong ? 'Logic Error' : `${mode} Mode`}
                    </span>
                </div>
                
                <AnimatePresence mode="wait">
                    {isCorrect ? (
                        <motion.div key="success" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase tracking-widest">
                            <CheckCircle size={14} /> Challenge Solved
                        </motion.div>
                    ) : isWrong ? (
                        <motion.div key="error" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="flex items-center gap-2 text-red-500 font-bold text-[10px] uppercase tracking-widest">
                            <AlertCircle size={14} /> Incorrect Output
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Editor Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="border-r border-white/5">
                    <CodeMirror
                        value={code}
                        height="350px"
                        theme="dark"
                        extensions={[java()]}
                        onChange={(value) => setCode(value)}
                        className="text-sm"
                    />
                </div>

                {/* Terminal Area */}
                <div className="bg-black p-6 font-mono text-xs flex flex-col h-full min-h-[350px]">
                    <div className="flex justify-between items-center mb-4 text-slate-600 uppercase tracking-widest font-bold">
                        <span>Console Output</span>
                        {isRunning && <Loader2 size={12} className="animate-spin text-cyan-500" />}
                    </div>
                    
                    <div className={`flex-grow overflow-y-auto text-sm transition-colors duration-500 ${isWrong ? 'text-red-400' : 'text-slate-300'} whitespace-pre-wrap`}>
                        {output || "> Ready to execute..."}
                    </div>

                    {/* Comparison UI (Show only on wrong challenge) */}
                    {mode === 'challenge' && isWrong && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 pt-4 border-t border-white/10">
                            <p className="text-[10px] text-cyan-500 font-bold uppercase mb-2">Required Output:</p>
                            <div className="bg-cyan-500/5 border border-cyan-500/20 p-3 rounded-xl text-cyan-200">
                                {block.data.expected}
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-between items-center">
                <button 
                    onClick={() => setCode(initialCode)} 
                    className="p-3 text-slate-500 hover:text-white transition-all bg-transparent border-none cursor-pointer rounded-xl hover:bg-white/5"
                    title="Reset Code"
                >
                    <RefreshCw size={18} />
                </button>
                
                <button 
                    disabled={isRunning || isCorrect}
                    onClick={handleRun}
                    className={`px-10 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border-none cursor-pointer flex items-center gap-3 
                        ${isCorrect ? 'bg-emerald-500/20 text-emerald-500 cursor-default' : 
                            mode === 'challenge' ? 'bg-cyan-500 text-black hover:scale-105 shadow-lg shadow-cyan-500/20' : 
                            'bg-purple-600 text-white hover:scale-105 shadow-lg shadow-purple-500/20'}`}
                >
                    {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
                    {isCorrect ? 'Completed' : (mode === 'challenge' ? 'Verify Logic' : 'Run Program')}
                </button>
            </div>
        </motion.div>
    );
}