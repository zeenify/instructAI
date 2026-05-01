import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { 
    Loader2, CheckCircle2, XCircle, Send, Play, 
    Code as CodeIcon, ChevronLeft, ChevronRight, 
    Plus, Trash2, RotateCcw, Check, ClipboardList, Clock, ShieldCheck, Cpu, AlertCircle, ListOrdered
} from 'lucide-react';
import { toast } from 'sonner';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import { motion, AnimatePresence } from 'framer-motion';

export default function QuizDisplay({ quizId, onPass, isAlreadyPassed }) {
    const [quizData, setQuizData] = useState(null);
    const [attemptId, setAttemptId] = useState(null);
    const [currentIdx, setCurrentIdx] = useState(-1);
    const [answers, setAnswers] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [gradingProgress, setGradingProgress] = useState(0); 
    const [result, setResult] = useState(null);
    const [showReview, setShowReview] = useState(false);

    const [timeLeft, setTimeLeft] = useState(null);
    const timerRef = useRef(null);
    const [codeOutput, setCodeOutput] = useState("");
    const [isRunning, setIsRunning] = useState(false);

    const isAnswered = (qId) => {
        const ans = answers[qId];
        if (ans === undefined || ans === null) return false;
        if (Array.isArray(ans)) return ans.some(val => val && String(val).trim() !== "");
        return String(ans).trim() !== "";
    };

    const handleRestart = () => {
        setResult(null);
        setAnswers({});
        setAttemptId(null);
        setCurrentIdx(-1);
        setGradingProgress(0);
        setCodeOutput("");
        if (quizData && quizData.time_limit_minutes > 0) setTimeLeft(quizData.time_limit_minutes * 60);
    };

    useEffect(() => {
        if (!quizId || quizId === 'undefined') return;
        fetchQuiz();
        return () => clearInterval(timerRef.current);
    }, [quizId]);

    const fetchQuiz = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/student/quizzes/${quizId}`);
            setQuizData(res.data.quiz);
            if (res.data.existing_result) setResult(res.data.existing_result);
            if (res.data.attempt_id) {
                setAttemptId(res.data.attempt_id);
                const parsed = {};
                Object.entries(res.data.saved_answers).forEach(([id, val]) => {
                    try { parsed[id] = JSON.parse(val); } catch { parsed[id] = val; }
                });
                setAnswers(parsed);
            }
        } catch (err) { toast.error("Failed to load quiz"); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (timeLeft === 0 && !result && !submitting) submitQuiz();
        if (!timeLeft || result) return;
        timerRef.current = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft, result]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' + s : s}`;
    };

    const startQuiz = () => {
        setCurrentIdx(0);
        if (quizData.time_limit_minutes > 0) setTimeLeft(quizData.time_limit_minutes * 60);
    };

    const saveCurrentAnswer = (qId, val) => {
        setAnswers(prev => ({ ...prev, [qId]: val }));
    };

    const runCodeTest = async (code) => {
        setIsRunning(true);
        setCodeOutput("Compiling logic...");
        try {
            const res = await api.post('/student/execute', { code, language: 'java' });
            setCodeOutput(res.data.stdout || res.data.stderr || res.data.compile_output || "No output.");
        } catch (err) { setCodeOutput("Execution error."); }
        finally { setIsRunning(false); }
    };

    const submitQuiz = async () => {
        setSubmitting(true);
        setShowReview(false);
        setGradingProgress(5);
        
        let interval = setInterval(() => {
            setGradingProgress(prev => (prev < 90 ? prev + Math.random() * 10 : prev));
        }, 300);

        try {
            const res = await api.post(`/student/quizzes/${quizId}/submit`, { answers });
            setGradingProgress(100);
            setTimeout(() => {
                setResult(res.data);
                if (res.data.score >= quizData.passing_score) onPass();
                setSubmitting(false); // FIXED: Clears the loading screen
                clearInterval(interval);
            }, 800);
        } catch (err) { 
            toast.error("Submission error."); 
            setSubmitting(false); 
            clearInterval(interval);
        }
    };

    if (loading) return <QuizSkeleton />;

    // 1. SUBMITTING STATE (THE "CHECKING" UI)
    if (submitting) return (
        <div className="flex flex-col items-center justify-center py-32 space-y-8 animate-in fade-in duration-500">
            <div className="relative w-24 h-24">
                <Cpu className="text-cyan-500 absolute inset-0 m-auto animate-pulse" size={48} />
                <div className="absolute inset-0 border-4 border-cyan-500/10 border-t-cyan-500 rounded-full animate-spin" />
            </div>
            <div className="text-center">
                <h2 className="text-2xl font-black uppercase tracking-widest text-white mb-2">CHECKING ANSWERS</h2>
                <div className="w-64 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10 mx-auto">
                    <motion.div className="h-full bg-cyan-500 shadow-[0_0_15px_#22d3ee]" initial={{ width: 0 }} animate={{ width: `${gradingProgress}%` }} />
                </div>
            </div>
        </div>
    );

    // 2. RESULTS VIEW (WITH WRONG ANSWER HIGHLIGHTS)
    if (result) return (
        <div className="max-w-4xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 pb-20">
            <div className="text-center py-12 bg-white/[0.02] border border-white/5 rounded-[40px]">
                <div className="mb-6">
                    {result.score >= quizData.passing_score ? 
                        <CheckCircle2 className="text-emerald-500 mx-auto" size={80} /> : 
                        <XCircle className="text-red-500 mx-auto" size={80} />
                    }
                </div>
                <h2 className="text-4xl font-black text-white mb-2">{result.score >= quizData.passing_score ? "Success" : "Incomplete"}</h2>
                <p className="text-slate-400 font-mono text-xl">GRADE: {result.score} / {result.max_score}</p>
                {result.score < quizData.passing_score && (
                    <button onClick={handleRestart} className="btn-cyan mt-8 flex items-center gap-2 mx-auto">
                        <RotateCcw size={18} /> Re-take Assessment
                    </button>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 px-4">Performance Review</h3>
                {result.details?.map((detail, i) => (
                    <div key={i} className={`p-6 rounded-3xl border transition-all ${detail.is_correct ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.05)]'}`}>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex gap-4">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black border ${detail.is_correct ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}`}>{i + 1}</span>
                                <p className={`text-sm font-bold ${detail.is_correct ? 'text-slate-300' : 'text-white'}`}>{detail.question_text}</p>
                            </div>
                            {detail.is_correct ? <CheckCircle2 className="text-emerald-500 flex-shrink-0" size={20} /> : <XCircle className="text-red-500 flex-shrink-0" size={20} />}
                        </div>
                        {!detail.is_correct && (
                            <div className="mt-4 pl-12 animate-in slide-in-from-top-2">
                                <p className="text-[10px] font-black uppercase text-red-400 mb-1">Correct Answer Reference:</p>
                                <div className="p-3 bg-white/5 rounded-xl text-xs text-slate-400 font-medium italic border border-white/5">
                                    {Array.isArray(detail.correct_answer) ? detail.correct_answer.join(', ') : detail.correct_answer}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );

    // 3. INTRO SCREEN
    if (currentIdx === -1) return (
        <div className="text-center py-16 bg-white/[0.02] border border-white/5 rounded-[40px] max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-700">
            <div className="w-20 h-20 bg-cyan-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-cyan-500/20 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                <ShieldCheck className="text-cyan-500 animate-pulse" size={40} />
            </div>
            <h2 className="text-5xl font-black text-white mb-3 tracking-tighter">{quizData.title}</h2>
            <p className="text-slate-400 text-sm mb-12 max-w-sm mx-auto leading-relaxed">Cross the passing threshold to unlock the next chapter in your curriculum.</p>
            <div className="grid grid-cols-3 gap-4 mb-12 px-10">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col items-center">
                    <ListOrdered className="text-slate-500 mb-2" size={20} /><p className="text-xl font-bold text-white">{quizData.questions.length}</p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col items-center">
                    <CheckCircle2 className="text-emerald-500/70 mb-2" size={20} /><p className="text-xl font-bold text-white">{quizData.passing_score} <span className="text-[10px] opacity-40">pts</span></p>
                </div>
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 flex flex-col items-center">
                    <Clock className="text-amber-500/70 mb-2" size={20} /><p className="text-xl font-bold text-white">{quizData.time_limit_minutes > 0 ? `${quizData.time_limit_minutes}m` : '∞'}</p>
                </div>
            </div>
            <button onClick={startQuiz} className="group relative px-12 py-5 bg-transparent rounded-2xl border border-cyan-500/30 overflow-hidden transition-all duration-500 hover:border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.1)] border-none cursor-pointer mx-auto block">
                <div className="absolute inset-0 bg-cyan-500 translate-y-[101%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
                <div className="relative flex items-center gap-4">
                    <span className="text-cyan-500 group-hover:text-black font-black uppercase tracking-[0.3em] text-[11px] transition-colors">Begin Assessment</span>
                    <ChevronRight className="text-cyan-500 group-hover:text-black transition-transform group-hover:translate-x-1" size={20} />
                </div>
            </button>
        </div>
    );

    const q = quizData.questions[currentIdx];

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-20">
            {/* Header: Progress Pills & Timer */}
            <div className="flex items-center justify-between gap-10 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                <div className="flex gap-1.5">
                    {quizData.questions.map((_, i) => (
                        <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIdx ? 'w-8 bg-cyan-500' : i < currentIdx ? 'w-4 bg-cyan-800' : 'w-4 bg-white/5'}`} />
                    ))}
                </div>
                {timeLeft !== null && (
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border font-mono font-bold transition-all ${timeLeft < 60 ? 'bg-red-500 text-white border-red-500 animate-pulse' : 'bg-white/5 border-white/10 text-cyan-400'}`}>
                        <Clock size={16} /><span>{formatTime(timeLeft)}</span>
                    </div>
                )}
            </div>

            <div className="min-h-[400px] space-y-10">
                <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-600">Question {currentIdx + 1}</span>
                    <h3 className="text-3xl font-bold text-white tracking-tight leading-tight">{q.question_text}</h3>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
                    {q.type === 'multiple_choice' && (
                        <div className="grid gap-3">
                            {q.options?.map((opt, i) => (
                                <button key={i} onClick={() => saveCurrentAnswer(q.id, String(i))} className={`w-full p-5 rounded-2xl border text-left flex items-center gap-4 transition-all group ${answers[q.id] === String(i) ? 'border-cyan-500 bg-cyan-500/10 text-white shadow-[0_0_20px_rgba(34,211,238,0.1)]' : 'border-white/5 bg-white/[0.03] text-slate-400 hover:border-white/20'}`}>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${answers[q.id] === String(i) ? 'border-cyan-500 bg-cyan-500' : 'border-slate-800'}`}>
                                        {answers[q.id] === String(i) && <Check size={12} className="text-black font-bold" />}
                                    </div>
                                    <span className="font-medium">{opt}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div className="grid grid-cols-2 gap-4">
                            {['True', 'False'].map(val => (
                                <button key={val} onClick={() => saveCurrentAnswer(q.id, val)} className={`py-12 rounded-[32px] border text-2xl font-black transition-all ${answers[q.id] === val ? 'bg-cyan-500 border-cyan-400 text-black shadow-[0_0_30px_rgba(34,211,238,0.2)]' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>{val}</button>
                            ))}
                        </div>
                    )}

                    {q.type === 'identification' && (
                        <input value={answers[q.id] || ""} onChange={(e) => saveCurrentAnswer(q.id, e.target.value)} className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-8 text-2xl font-bold text-cyan-400 outline-none focus:border-cyan-500" placeholder="Type your answer..." />
                    )}

                    {q.type === 'enumeration' && (
                        <div className="space-y-3">
                            {(answers[q.id] || ['']).map((val, i) => (
                                <div key={i} className="flex gap-2 animate-in slide-in-from-left-4">
                                    <input value={val} onChange={(e) => { const n = [...(answers[q.id] || [''])]; n[i] = e.target.value; saveCurrentAnswer(q.id, n); }} className="flex-grow bg-white/5 border border-white/10 rounded-xl p-4 text-white font-bold outline-none" placeholder={`Item ${i+1}...`} />
                                    <button onClick={() => { const n = (answers[q.id] || ['']).filter((_, idx) => idx !== i); saveCurrentAnswer(q.id, n); }} className="p-4 text-slate-700 hover:text-red-500 border-none bg-transparent cursor-pointer"><Trash2 size={20}/></button>
                                </div>
                            ))}
                            <button onClick={() => saveCurrentAnswer(q.id, [...(answers[q.id] || []), ''])} className="flex items-center gap-2 text-cyan-500 font-bold text-xs uppercase tracking-widest mt-4 p-2 cursor-pointer bg-transparent border-none hover:text-white"><Plus size={16} /> Add Line</button>
                        </div>
                    )}

                    {q.type === 'coding' && (
                        <div className="space-y-4">
                            <div className="rounded-3xl border border-white/10 bg-black overflow-hidden shadow-2xl">
                                <div className="p-4 bg-white/5 flex justify-between items-center border-b border-white/5">
                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Logic Workspace</span>
                                    <CodeIcon size={16} className="text-cyan-500" />
                                </div>
                                <CodeMirror 
                                    // This is the correct order of priority
                                    value={answers[q.id] || q.boilerplate || ""} 
                                    height="300px" 
                                    theme="dark" 
                                    extensions={[java()]} 
                                    onChange={(val) => saveCurrentAnswer(q.id, val)} 
                                />
                            </div>
                            <button onClick={() => runCodeTest(answers[q.id] || q.boilerplate)} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-white border-none cursor-pointer">
                                {isRunning ? <Loader2 className="animate-spin" size={16}/> : <Play size={16} fill="currentColor"/>} Test Logic
                            </button>
                            {codeOutput && <div className="p-5 bg-black rounded-2xl border border-white/5 font-mono text-xs text-cyan-400 whitespace-pre-wrap max-h-40 overflow-y-auto shadow-inner">{codeOutput}</div>}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Navigation */}
            <div className="mt-20 pt-10 border-t border-white/5 flex justify-between">
                <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(currentIdx - 1)} className="flex items-center gap-2 text-slate-500 hover:text-white font-black text-xs uppercase tracking-widest disabled:opacity-0 transition-all border-none bg-transparent cursor-pointer"><ChevronLeft size={18} /> Prev</button>
                {currentIdx === quizData.questions.length - 1 ? (
                    <button onClick={() => setShowReview(true)} className="px-12 py-4 bg-white text-black font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-cyan-500 transition-all border-none cursor-pointer">Review & Finish</button>
                ) : (
                    <button onClick={() => setCurrentIdx(currentIdx + 1)} className="px-12 py-4 bg-cyan-500 text-black font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] hover:scale-105 border-none cursor-pointer shadow-lg shadow-cyan-500/20">Next Item <ChevronRight size={18} /></button>
                )}
            </div>

            {/* REVIEW MODAL */}
            <AnimatePresence>
                {showReview && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReview(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-md bg-[#05011d] border border-white/10 rounded-[32px] p-10 shadow-2xl">
                            <div className="text-center mb-8">
                                <ClipboardList className="mx-auto mb-4 text-cyan-400" size={32} />
                                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Complete Assessment?</h2>
                                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest mt-2">Questions answered: {Object.keys(answers).length}/{quizData.questions.length}</p>
                            </div>
                            <div className="grid grid-cols-5 gap-2 mb-10">
                                {quizData.questions.map((question, i) => (
                                    <button key={question.id} onClick={() => { setCurrentIdx(i); setShowReview(false); }} className={`h-10 rounded-lg flex items-center justify-center text-xs font-black border transition-all cursor-pointer ${isAnswered(question.id) ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-red-500/10 border-red-500/30 text-red-500 hover:border-red-500'}`}>{i + 1}</button>
                                ))}
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => setShowReview(false)} className="flex-1 py-4 rounded-xl bg-white/5 text-slate-500 font-bold uppercase text-[10px] border-none cursor-pointer hover:bg-white/10 transition-all">Edit</button>
                                <button onClick={submitQuiz} className="flex-1 py-4 rounded-xl bg-cyan-500 text-black font-black uppercase text-[10px] border-none cursor-pointer hover:scale-105 transition-all">Submit</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function QuizSkeleton() {
    return <div className="animate-pulse space-y-12 py-10">
        <div className="h-4 w-40 bg-white/5 rounded-full" />
        <div className="h-20 w-full bg-white/5 rounded-[32px]" />
        <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-20 w-full bg-white/5 rounded-2xl" />)}
        </div>
    </div>;
}