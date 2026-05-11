import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../../services/api';
import { 
    Loader2, CheckCircle2, XCircle, Send, Play, 
    Code as CodeIcon, ChevronLeft, ChevronRight, 
    Plus, Trash2, RotateCcw, Check, ClipboardList, 
    Clock, ShieldCheck, Cpu, AlertCircle, ListOrdered,
    Bot, Lock, Target, Timer
} from 'lucide-react';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuizDisplay({ quizId, onPass, onAiToggle, isAlreadyPassed, classId }) {
    const [quizData, setQuizData] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [answers, setAnswers] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [gradingProgress, setGradingProgress] = useState(0); 
    const [result, setResult] = useState(null); 
    const [previousResult, setPreviousResult] = useState(null);
    const [showReview, setShowReview] = useState(false);

    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);
    const [codeOutput, setCodeOutput] = useState("");
    const [isRunning, setIsRunning] = useState(false);

    useEffect(() => {
        if (!quizId) return;
        const fetchQuiz = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/student/quizzes/${quizId}`);
setQuizData(res.data.quiz);
                if (onAiToggle) onAiToggle(res.data.quiz.allow_ai_assistance);
                if (res.data.existing_result) setPreviousResult(res.data.existing_result);
            } catch (err) {
                toast.error("Failed to load curriculum data.");
            } finally {
                setLoading(false);
            }
        };
        fetchQuiz();
    }, [quizId]);

    useEffect(() => {
        if (timeLeft === 0 && !result && !submitting && currentIdx !== -1) {
            if (quizData.timer_mode === 'per_question' && currentIdx < questions.length - 1) {
                toast.info("Time expired for this task. Moving forward...");
                setCurrentIdx(prev => prev + 1);
            } else {
                submitQuiz();
            }
        }
        if (timeLeft === null || timeLeft <= 0 || result) return;
        timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft, result, currentIdx]);

    useEffect(() => {
        if (currentIdx === -1 || !quizData) return;
        if (quizData.timer_mode === 'per_question') {
            setTimeLeft(Math.floor(quizData.time_limit_minutes * 60));
        }
    }, [currentIdx]);

const startQuiz = () => {
        // The backend already shuffled and limited the questions via the DB!
        setQuestions(quizData.questions);
        setResult(null);
        setAnswers({});
        setCurrentIdx(0);

        if (quizData.timer_mode === 'entire_quiz') {
            setTimeLeft(Math.floor(quizData.time_limit_minutes * 60));
        }
    };

    const handleRestart = () => {
        setCurrentIdx(-1);
        setResult(null);
        setAnswers({});
    };

    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' + s : s}m`;
    };

    const saveAnswer = (qId, val) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const runCodeTest = async (code) => {
        setIsRunning(true);
        setCodeOutput("Compiling logic...");
        try {
            const res = await api.post('/student/execute', { code, language: 'java' });
            setCodeOutput(res.data.stdout || res.data.stderr || res.data.compile_output || "Execution finished.");
        } catch (err) { setCodeOutput("Logic execution failure."); }
        finally { setIsRunning(false); }
    };

    const submitQuiz = async () => {
        setSubmitting(true);
        setShowReview(false);
        setGradingProgress(10);
        const interval = setInterval(() => setGradingProgress(p => p < 95 ? p + 2 : p), 100);

try {
            // Send the exact subset of question IDs so the backend knows the max possible score
            const question_ids = questions.map(q => q.id);
            const res = await api.post(`/student/quizzes/${quizId}/submit`, { answers, question_ids });
            
            setGradingProgress(100);
            setTimeout(() => {
                setResult(res.data);
                setPreviousResult(res.data);
                if (res.data.score >= quizData.passing_score) onPass();
                setSubmitting(false);
                clearInterval(interval);
            }, 1000);
        } catch (err) { 
            toast.error("Transmission error."); 
            setSubmitting(false);
            clearInterval(interval);
        }
    };

    if (loading) return <QuizSkeleton />;

    if (submitting) return (
        <div className="flex flex-col items-center justify-center py-40 space-y-8 animate-in fade-in zoom-in-95">
            <div className="relative w-32 h-32 flex items-center justify-center">
                <Cpu className="text-cyan-500 absolute animate-pulse" size={56} />
                <div className="absolute inset-0 border-4 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin" />
            </div>
            <div className="text-center space-y-4">
                <h2 className="text-2xl font-black uppercase tracking-[0.4em] text-white">Grading Protocol</h2>
                <div className="w-72 h-2 bg-white/5 rounded-full overflow-hidden border border-white/10 mx-auto">
                    <motion.div className="h-full bg-cyan-500 shadow-[0_0_20px_#22d3ee]" initial={{ width: 0 }} animate={{ width: `${gradingProgress}%` }} />
                </div>
            </div>
        </div>
    );

    if (result) return (
        <div style={{ gap: '32px' }} className="max-w-4xl mx-auto flex flex-col animate-in fade-in duration-700 pb-32">
            <div style={{ padding: '50px 40px', textAlign: 'center' }} className="bg-[#050505] border border-white/5 rounded-[50px] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20" />
                <div style={{ marginBottom: '24px' }}>
                    {result.score >= quizData.passing_score ? 
                        <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                            <CheckCircle2 className="text-emerald-500" size={48} />
                        </div> : 
                        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
                            <XCircle className="text-red-500" size={48} />
                        </div>
                    }
                </div>
                <h2 style={{ marginBottom: '16px' }} className="text-5xl font-black text-white tracking-tighter">{result.score >= quizData.passing_score ? "Validation Successful" : "Threshold Not Met"}</h2>
                <div style={{ gap: '16px', padding: '12px 24px' }} className="inline-flex items-center bg-white/5 rounded-2xl border border-white/5">
                    <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Efficiency Rating:</span>
                    <span className="text-2xl font-mono font-black text-cyan-400">{result.score} / {result.max_score}</span>
                </div>
                <div style={{ marginTop: '24px', gap: '12px' }} className="flex justify-center">
                    <button onClick={handleRestart} style={{ padding: '14px 24px', gap: '8px' }} className="bg-white/5 hover:bg-white/10 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center border-none cursor-pointer">
                        <RotateCcw size={16} /> Return to Hub
                    </button>
                </div>
            </div>

            <div style={{ gap: '16px' }} className="flex flex-col">
                <h3 style={{ paddingLeft: '12px' }} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Curriculum Feedback</h3>
                {result.details?.map((detail, i) => (
                    <div key={i} style={{ padding: '24px 28px' }} className={`rounded-[32px] border transition-all ${detail.is_correct ? 'bg-emerald-500/[0.02] border-emerald-500/10' : 'bg-red-500/[0.02] border-red-500/10'}`}>
                        <div style={{ gap: '24px', justifyContent: 'space-between' }} className="flex items-start">
                            <div style={{ gap: '16px' }} className="flex">
                                <span style={{ padding: '8px 10px' }} className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black border flex-shrink-0 ${detail.is_correct ? 'border-emerald-500/20 text-emerald-500' : 'border-red-500/20 text-red-500'}`}>{i + 1}</span>
                                <div style={{ gap: '12px' }} className="flex flex-col">
                                    <p className="text-lg font-bold text-white leading-snug">{detail.question_text}</p>
                                    {!detail.is_correct && (
                                        <div style={{ paddingTop: '12px', gap: '8px' }} className="flex flex-col">
                                            <p className="text-[9px] font-black uppercase text-slate-500">Expected Reference:</p>
                                            <div style={{ padding: '12px 16px' }} className="bg-black/40 rounded-xl border border-white/5 font-mono text-xs text-slate-400">{detail.correct_answer}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {detail.is_correct ? <CheckCircle2 className="text-emerald-500 shrink-0" size={24} /> : <XCircle className="text-red-500 shrink-0" size={24} />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    if (currentIdx === -1) return (
        <div style={{ paddingTop: '48px', paddingBottom: '48px' }} className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <div style={{ gap: '32px', textAlign: 'center' }} className="flex flex-col">
                <div className="w-24 h-24 bg-cyan-500/10 rounded-[32px] flex items-center justify-center mx-auto border border-cyan-500/20 shadow-2xl">
                    <ShieldCheck className="text-cyan-500" size={48} />
                </div>
                <div style={{ gap: '8px' }} className="flex flex-col">
                    <h2 className="text-6xl font-black text-white tracking-tighter leading-none">{quizData.title}</h2>
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Assessment Initiation</p>
                </div>

                <div className="grid grid-cols-3 gap-6 py-12">
                    <div style={{ padding: '20px 24px', gap: '12px' }} className="bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center">
                        <ListOrdered className="text-slate-700" size={20} />
                        <p className="text-2xl font-black text-white">{quizData.questions.length}</p>
                        <span className="text-[9px] font-bold uppercase text-slate-600">Modules</span>
                    </div>
                    <div style={{ padding: '20px 24px', gap: '12px' }} className="bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center">
                        <Target className="text-emerald-500/50" size={20} />
                        <p className="text-2xl font-black text-white">{quizData.passing_score}</p>
                        <span className="text-[9px] font-bold uppercase text-slate-600">Threshold</span>
                    </div>
                    <div style={{ padding: '20px 24px', gap: '8px' }} className="bg-white/[0.02] border border-white/5 rounded-3xl flex flex-col items-center justify-center">
                        <div style={{ gap: '6px', marginBottom: '8px' }} className="flex items-center justify-center">
                            <Clock className="text-amber-500/50" size={20} />
                            <span style={{ padding: '4px 8px' }} className="text-[8px] bg-amber-500/10 text-amber-500 rounded font-black uppercase whitespace-nowrap">{quizData.timer_mode?.replace('_', ' ')}</span>
                        </div>
                        <p className="text-2xl font-black text-white">{formatTime(Math.floor(quizData.time_limit_minutes * 60))}</p>
                        <span className="text-[9px] font-bold uppercase text-slate-600">Allocated</span>
                    </div>
                </div>

                {previousResult && (
                    <div style={{ padding: '20px 24px', gap: '24px', justifyContent: 'space-between' }} className="rounded-3xl border border-white/5 bg-white/[0.01] flex items-center">
                        <div style={{ textAlign: 'left' }}>
                            <p className="text-[10px] font-black text-slate-600 uppercase">Legacy Performance</p>
                            <p className="text-xl font-black text-white">{previousResult.score} / {previousResult.max_score}</p>
                        </div>
                        <div style={{ padding: '8px 16px' }} className={`rounded-full text-[9px] font-black uppercase ${previousResult.score >= quizData.passing_score ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {previousResult.score >= quizData.passing_score ? 'Passed' : 'Not Cleared'}
                        </div>
                    </div>
                )}

                <button onClick={startQuiz} style={{ padding: '20px 24px' }} className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black uppercase tracking-[0.3em] rounded-[24px] transition-all shadow-[0_20px_40px_rgba(34,211,238,0.2)] border-none cursor-pointer">Initiate Assessment</button>
            </div>
        </div>
    );

    const q = questions[currentIdx];

    return (
        <div style={{ gap: '32px' }} className="max-w-3xl mx-auto pb-40 relative flex flex-col">
            <div style={{ padding: '16px 20px', gap: '16px', justifyContent: 'space-between' }} className="flex items-center bg-[#050505] rounded-3xl border border-white/5">
                <div style={{ gap: '8px' }} className="flex">
                    {questions.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIdx ? 'w-10 bg-cyan-500' : i < currentIdx ? 'w-4 bg-cyan-900' : 'w-4 bg-white/5'}`} />
                    ))}
                </div>
                {timeLeft !== null && (
                    <div style={{ gap: '8px', padding: '10px 16px' }} className={`flex items-center rounded-2xl font-mono font-black text-lg border transition-all ${timeLeft < 20 ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-cyan-400'}`}>
                        <Clock size={18} /> {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <div style={{ minHeight: '500px', gap: '32px' }} className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div style={{ gap: '16px' }} className="flex flex-col">
                    <span className="text-[11px] font-black uppercase tracking-[0.5em] text-cyan-600">Module Task {currentIdx + 1}</span>
                    <h3 className="text-4xl font-bold text-white tracking-tight leading-tight">{q.question_text}</h3>
                </div>

                <div style={{ gap: '16px' }} className="flex flex-col">
                    {q.type === 'multiple_choice' && (
                        <div className="grid gap-6">
                            {q.options?.map((opt, i) => (
                                <button key={i} onClick={() => saveAnswer(q.id, String(i))} style={{ padding: '16px 20px', gap: '12px' }} className={`w-full rounded-3xl border text-left flex items-center transition-all group ${answers[q.id] === String(i) ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-2xl' : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/20'}`}>
                                    <div style={{ padding: '8px' }} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${answers[q.id] === String(i) ? 'border-cyan-500 bg-cyan-500' : 'border-slate-800'}`}>{answers[q.id] === String(i) && <Check size={14} className="text-black font-black" />}</div>
                                    <span className="font-bold text-lg">{opt}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-6">
                            {['True', 'False'].map(val => <button key={val} onClick={() => saveAnswer(q.id, val)} className={`py-16 rounded-[40px] border text-3xl font-black transition-all ${answers[q.id] === val ? 'bg-cyan-500 border-cyan-400 text-black shadow-2xl scale-[1.02]' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>{val}</button>)}
                        </div>
                    )}

                    {q.type === 'identification' && <input value={answers[q.id] || ""} onChange={(e) => saveAnswer(q.id, e.target.value)} className="w-full bg-white/[0.02] border border-white/5 rounded-[32px] p-10 text-4xl font-black text-cyan-400 outline-none focus:border-cyan-500 shadow-inner" placeholder="Respond here..." />}

                    {q.type === 'enumeration' && (
                        <div className="space-y-4">
                            {(answers[q.id] || ['']).map((val, i) => (
                                <div key={i} className="flex gap-3">
                                    <input value={val} onChange={(e) => { const n = [...(answers[q.id] || [''])]; n[i] = e.target.value; saveAnswer(q.id, n); }} className="flex-grow bg-white/[0.02] border border-white/5 rounded-2xl p-6 text-white font-black outline-none focus:border-cyan-500" placeholder={`Entry ${i+1}...`} />
                                    <button onClick={() => { const n = (answers[q.id] || ['']).filter((_, idx) => idx !== i); saveAnswer(q.id, n); }} className="p-6 text-slate-700 hover:text-red-500 rounded-2xl transition-all border-none bg-transparent cursor-pointer"><Trash2 size={24}/></button>
                                </div>
                            ))}
                            {/* Enumeration Constraint: Limit based on Teacher's defined items count */}
                            {(answers[q.id] || ['']).length < (q.options?.length || 1) && (
                                <button onClick={() => saveAnswer(q.id, [...(answers[q.id] || []), ''])} className="px-8 py-4 rounded-2xl bg-white/5 text-cyan-500 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all border-none cursor-pointer mt-4">+ Append Entry ({(answers[q.id] || ['']).length} / {q.options?.length})</button>
                            )}
                        </div>
                    )}

                    {q.type === 'coding' && (
                        <div className="space-y-6">
                            <div className="rounded-[32px] border border-white/10 bg-black overflow-hidden shadow-2xl">
                                <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5"><div className="flex items-center gap-3"><CodeIcon size={16} className="text-cyan-500" /><span className="text-[10px] font-black uppercase text-slate-500">Source Environment</span></div></div>
                                <CodeMirror value={answers[q.id] || q.boilerplate || ""} height="400px" theme="dark" extensions={[java()]} onChange={(val) => saveAnswer(q.id, val)} />
                            </div>
                            <button onClick={() => runCodeTest(answers[q.id] || q.boilerplate)} className="w-full py-5 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-white border-none cursor-pointer">{isRunning ? <Loader2 className="animate-spin" size={18}/> : <Play size={18} fill="currentColor"/>} Test Logic</button>
                            {codeOutput && <div className="p-8 bg-black rounded-3xl border border-white/5 font-mono text-xs text-cyan-400 whitespace-pre-wrap shadow-inner max-h-60 overflow-y-auto">{codeOutput}</div>}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-24 flex justify-between items-center bg-[#050505] p-8 rounded-[32px] border border-white/5">
                {/* Robust Navigation: Disable Prev if in Per-Question mode to prevent timer resetting abuse */}
                <button 
                    disabled={currentIdx === 0 || quizData.timer_mode === 'per_question'} 
                    onClick={() => setCurrentIdx(currentIdx - 1)} 
                    className="flex items-center gap-3 text-slate-500 hover:text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-0 transition-all border-none bg-transparent cursor-pointer"
                >
                    <ChevronLeft size={20} /> Previous Task
                </button>
                {currentIdx === questions.length - 1 ? (
                    <button onClick={() => setShowReview(true)} className="px-12 py-5 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:bg-cyan-500 transition-all border-none cursor-pointer">Verify & Finish</button>
                ) : (
                    <button onClick={() => setCurrentIdx(currentIdx + 1)} className="px-12 py-5 bg-cyan-500 text-black font-black rounded-2xl text-[10px] uppercase tracking-[0.3em] hover:scale-105 transition-all border-none cursor-pointer">Continue <ChevronRight size={20} /></button>
                )}
            </div>

            <AnimatePresence>
                {showReview && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReview(false)} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-lg bg-[#05011d] border border-white/10 rounded-[48px] p-12 shadow-2xl">
                            <div className="text-center mb-10"><ClipboardList className="mx-auto mb-4 text-cyan-400" size={48} /><h2 className="text-3xl font-black text-white uppercase tracking-tighter">Submit?</h2><p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-3">Verified logic items: {Object.keys(answers).length} / {questions.length}</p></div>
                            {quizData.timer_mode !== 'per_question' && (
                                <div className="grid grid-cols-6 gap-3 mb-12">
                                    {questions.map((question, i) => <button key={question.id} onClick={() => { setCurrentIdx(i); setShowReview(false); }} className={`h-12 rounded-xl flex items-center justify-center text-xs font-black border transition-all cursor-pointer ${answers[question.id] ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500'}`}>{i + 1}</button>)}
                                </div>
                            )}
                            <div className="flex gap-4">
                                {quizData.timer_mode !== 'per_question' && <button onClick={() => setShowReview(false)} className="flex-1 py-5 rounded-2xl bg-white/5 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-none cursor-pointer">Modify</button>}
                                <button onClick={submitQuiz} className="flex-1 py-5 rounded-2xl bg-cyan-500 text-black font-black uppercase text-[10px] tracking-widest border-none cursor-pointer hover:scale-105 shadow-2xl">Transmit</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function QuizSkeleton() {
    return <div className="animate-pulse space-y-12 py-10 max-w-2xl mx-auto text-center"><div className="h-20 w-20 bg-white/5 rounded-[32px] mx-auto" /><div className="h-16 w-3/4 bg-white/5 rounded-3xl mx-auto" /><div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="h-24 bg-white/5 rounded-3xl" />)}</div><div className="h-16 w-full bg-white/5 rounded-[24px]" /></div>;
}