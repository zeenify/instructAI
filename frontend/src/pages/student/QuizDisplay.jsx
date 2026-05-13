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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '48px', padding: '40px 24px' }}>
            <style>{`
                @keyframes spin-smooth {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 30px rgba(34, 211, 238, 0.3), 0 0 60px rgba(34, 211, 238, 0.1); }
                    50% { box-shadow: 0 0 50px rgba(34, 211, 238, 0.5), 0 0 80px rgba(34, 211, 238, 0.2); }
                }
                .grade-spinner {
                    animation: spin-smooth 2s linear infinite;
                }
                .grade-glow {
                    animation: pulse-glow 2s ease-in-out infinite;
                }
            `}</style>

            {/* ICON CONTAINER */}
            <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="grade-spinner" style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', border: '3px solid rgba(34, 211, 238, 0.1)', borderTopColor: '#22d3ee', borderRightColor: '#22d3ee' }} />
                <div className="grade-glow" style={{ position: 'absolute', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(34, 211, 238, 0.05)', backdropFilter: 'blur(10px)' }} />
                <Cpu style={{ color: '#22d3ee', position: 'relative', zIndex: 10 }} size={56} />
            </div>

            {/* TEXT & PROGRESS */}
            <div style={{ textAlign: 'center', gap: '32px', display: 'flex', flexDirection: 'column', maxWidth: '500px' }}>
                <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '32px', fontWeight: 900, color: 'white', margin: '0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Evaluating Responses</h2>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0', fontWeight: 600 }}>Processing your answers...</p>
                </div>

                {/* PROGRESS BAR */}
                <div style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '8px', width: '100%', background: 'rgba(34, 211, 238, 0.08)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(34, 211, 238, 0.15)', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                        <motion.div
                            className="h-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${gradingProgress}%` }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            style={{
                                background: 'linear-gradient(90deg, #22d3ee, #06b6d4)',
                                boxShadow: '0 0 20px rgba(34, 211, 238, 0.4)'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Progress</span>
                        <span style={{ fontSize: '13px', color: '#22d3ee', fontWeight: 900, fontFamily: 'monospace' }}>{Math.round(gradingProgress)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (result) return (
        <div style={{ gap: '32px', maxWidth: '1300px', margin: '0 auto', width: '100%' }} className="flex flex-col animate-in fade-in duration-700 pb-32">
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
                    <button onClick={handleRestart} disabled={result.score >= quizData.passing_score} style={{ padding: '14px 24px', gap: '8px', opacity: result.score >= quizData.passing_score ? 0.5 : 1, cursor: result.score >= quizData.passing_score ? 'not-allowed' : 'pointer' }} className="bg-white/5 hover:bg-white/10 rounded-2xl text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center border-none">
                        <RotateCcw size={16} /> {result.score >= quizData.passing_score ? 'Quiz Completed' : 'Return to Hub'}
                    </button>
                </div>
            </div>

            <div style={{ gap: '16px' }} className="flex flex-col">
                <h3 style={{ paddingLeft: '12px' }} className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-600">Curriculum Feedback</h3>
                {result.details?.map((detail, i) => {
                    const studentAnswer = answers[detail.question_id];
                    const hasAnswered = studentAnswer !== null && studentAnswer !== undefined && (Array.isArray(studentAnswer) ? studentAnswer.some(a => a) : studentAnswer !== '');

                    // Parse enumeration/list answers into arrays
                    const studentAnswerArray = detail.type === 'enumeration'
                        ? (Array.isArray(studentAnswer) ? studentAnswer.filter(a => a) : [])
                        : null;

                    let correctAnswerArray = null;
                    if (detail.type === 'enumeration') {
                        try {
                            // correct_answer is a JSON string array
                            correctAnswerArray = JSON.parse(detail.correct_answer);
                        } catch (e) {
                            // Fallback if not valid JSON
                            correctAnswerArray = detail.correct_answer.split(',').map(a => a.trim()).filter(a => a);
                        }
                    }

                    // Convert index to letter for multiple choice
                    const indexToLetter = (idx) => String.fromCharCode(65 + parseInt(idx));

                    return (
                        <div key={i} style={{ padding: '28px 32px' }} className={`rounded-[32px] border transition-all ${detail.is_correct ? 'bg-emerald-500/[0.05] border-emerald-500/20' : 'bg-red-500/[0.05] border-red-500/20'}`}>
                            <div style={{ gap: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ gap: '16px', display: 'flex', flex: 1 }}>
                                    <span style={{ padding: '10px 12px', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, border: `1.5px solid ${detail.is_correct ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`, color: detail.is_correct ? '#10b981' : '#ef4444', background: detail.is_correct ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', flexShrink: 0 }}>{i + 1}</span>
                                    <div style={{ gap: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <p style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: '0', lineHeight: '1.5' }}>{detail.question_text}</p>

                                        {/* STUDENT ANSWER */}
                                        <div style={{ gap: '8px', display: 'flex', flexDirection: 'column', paddingTop: '8px' }}>
                                            <p style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0' }}>Your Answer:</p>
                                            {!hasAnswered ? (
                                                <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px dashed rgba(239, 68, 68, 0.3)', fontSize: '13px', color: '#ef4444', fontWeight: 600, fontStyle: 'italic' }}>
                                                    Not answered
                                                </div>
                                            ) : studentAnswerArray ? (
                                                <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                                                    {studentAnswerArray.map((ans, idx) => (
                                                        <div key={idx} style={{ padding: '10px 14px', background: 'rgba(34, 211, 238, 0.08)', borderRadius: '10px', border: '1px solid rgba(34, 211, 238, 0.15)', fontFamily: 'monospace', fontSize: '13px', color: '#22d3ee' }}>
                                                            {ans}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : detail.type === 'multiple_choice' ? (
                                                <div style={{ padding: '12px 16px', background: 'rgba(34, 211, 238, 0.08)', borderRadius: '12px', border: '1px solid rgba(34, 211, 238, 0.15)', fontSize: '13px', color: '#22d3ee' }}>
                                                    {detail.student_answer_text}
                                                </div>
                                            ) : (
                                                <div style={{ padding: '12px 16px', background: 'rgba(34, 211, 238, 0.08)', borderRadius: '12px', border: '1px solid rgba(34, 211, 238, 0.15)', fontFamily: 'monospace', fontSize: '13px', color: '#22d3ee', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {String(studentAnswer)}
                                                </div>
                                            )}
                                        </div>

                                        {/* CORRECT ANSWER - Only show if incorrect */}
                                        {!detail.is_correct && (
                                            <div style={{ gap: '8px', display: 'flex', flexDirection: 'column', paddingTop: '8px' }}>
                                                <p style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0' }}>Expected Answer:</p>
                                                {correctAnswerArray ? (
                                                    <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                                                        {correctAnswerArray.map((ans, idx) => (
                                                            <div key={idx} style={{ padding: '10px 14px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.15)', fontFamily: 'monospace', fontSize: '13px', color: '#10b981' }}>
                                                                {ans}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : detail.type === 'multiple_choice' ? (
                                                    <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)', fontSize: '13px', color: '#10b981' }}>
                                                        {detail.correct_answer}
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)', fontFamily: 'monospace', fontSize: '13px', color: '#10b981', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                        {detail.correct_answer}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {detail.is_correct ? <CheckCircle2 style={{ color: '#10b981' }} size={28} className="shrink-0 mt-1" /> : <XCircle style={{ color: '#ef4444' }} size={28} className="shrink-0 mt-1" />}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    if (currentIdx === -1) return (
        <div style={{
            padding: '64px 16px',
            maxWidth: '100%',
            margin: '0 auto',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
        }} className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <style>{`
                @keyframes glow {
                    0%, 100% { box-shadow: 0 0 20px rgba(34, 211, 238, 0.3), 0 0 40px rgba(34, 211, 238, 0.1); }
                    50% { box-shadow: 0 0 30px rgba(34, 211, 238, 0.5), 0 0 60px rgba(34, 211, 238, 0.2); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-8px); }
                }
                .premium-card:hover {
                    animation: glow 2s ease-in-out;
                }
                .floating-icon {
                    animation: float 3s ease-in-out infinite;
                }
            `}</style>
            <div style={{ gap: '32px', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '16px', paddingRight: '16px' }}>
                {/* HEADER */}
                <div style={{ gap: '24px', display: 'flex', flexDirection: 'column', textAlign: 'center' }}>
                    <div className="floating-icon" style={{ width: '80px', height: '80px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(79, 70, 229, 0.08) 100%)', border: '1.5px solid rgba(34, 211, 238, 0.3)', boxShadow: '0 0 30px rgba(34, 211, 238, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)' }}>
                        <ShieldCheck style={{ color: '#22d3ee', filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.4))' }} size={44} />
                    </div>
                    <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                        <h2 style={{ fontSize: '48px', fontWeight: 900, color: 'white', margin: '0', letterSpacing: '-0.02em', lineHeight: '1.1' }}>{quizData.title}</h2>
                        <p style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0' }}>Ready to test your knowledge?</p>
                    </div>
                </div>

                {/* STATS GRID */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    <div className="premium-card" style={{ padding: '32px 28px', gap: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.12) 0%, rgba(6, 182, 212, 0.06) 100%)', border: '1.5px solid rgba(34, 211, 238, 0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(34, 211, 238, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)', transition: 'all 0.3s ease' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.08) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
                            <ListOrdered size={28} />
                        </div>
                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0 0 8px 0' }}>Questions</p>
                        <p style={{ fontSize: '36px', fontWeight: 900, color: 'white', margin: '0', textShadow: '0 0 20px rgba(34, 211, 238, 0.2)' }}>{quizData.questions.length}</p>
                    </div>

                    <div className="premium-card" style={{ padding: '32px 28px', gap: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.06) 100%)', border: '1.5px solid rgba(16, 185, 129, 0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)', transition: 'all 0.3s ease' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.08) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', boxShadow: '0 0 20px rgba(16, 185, 129, 0.15)' }}>
                            <Target size={28} />
                        </div>
                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0 0 8px 0' }}>Passing Score</p>
                        <p style={{ fontSize: '36px', fontWeight: 900, color: 'white', margin: '0', textShadow: '0 0 20px rgba(16, 185, 129, 0.2)' }}>{quizData.passing_score}</p>
                    </div>

                    <div className="premium-card" style={{ padding: '32px 28px', gap: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: '24px', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(194, 65, 12, 0.06) 100%)', border: '1.5px solid rgba(249, 115, 22, 0.2)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(249, 115, 22, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)', transition: 'all 0.3s ease' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.08) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f97316', boxShadow: '0 0 20px rgba(249, 115, 22, 0.15)' }}>
                            <Clock size={28} />
                        </div>
                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0 0 8px 0' }}>Time Limit</p>
                        <p style={{ fontSize: '36px', fontWeight: 900, color: 'white', margin: '0', textShadow: '0 0 20px rgba(249, 115, 22, 0.2)' }}>{formatTime(Math.floor(quizData.time_limit_minutes * 60))}</p>
                    </div>
                </div>

                {/* PREVIOUS RESULT */}
                {previousResult && (
                    <div style={{ padding: '28px 32px', gap: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '24px', border: '1.5px solid rgba(255, 255, 255, 0.1)', background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(71, 85, 105, 0.04) 100%)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)' }}>
                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Your Previous Attempt</p>
                            <p style={{ fontSize: '28px', fontWeight: 900, color: 'white', margin: '0' }}>{previousResult.score} <span style={{ fontSize: '18px', color: '#94a3b8' }}>/ {previousResult.max_score}</span></p>
                        </div>
                        <div style={{ padding: '12px 24px', borderRadius: '999px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', background: previousResult.score >= quizData.passing_score ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.1) 100%)' : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.1) 100%)', color: previousResult.score >= quizData.passing_score ? '#10b981' : '#ef4444', border: previousResult.score >= quizData.passing_score ? '1.5px solid rgba(16, 185, 129, 0.3)' : '1.5px solid rgba(239, 68, 68, 0.3)', boxShadow: previousResult.score >= quizData.passing_score ? '0 0 15px rgba(16, 185, 129, 0.15)' : '0 0 15px rgba(239, 68, 68, 0.15)' }}>
                            {previousResult.score >= quizData.passing_score ? '✓ Passed' : '✗ Not Passed'}
                        </div>
                    </div>
                )}

                {/* CTA BUTTON */}
                {isAlreadyPassed ? (
                    <div style={{ padding: '20px 32px', borderRadius: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.08) 100%)', border: '1.5px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ fontSize: '10px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>Quiz Completed</p>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0' }}>You've already passed this assessment</p>
                        </div>
                    </div>
                ) : (
                    <button onClick={startQuiz} style={{ padding: '18px 56px', borderRadius: '20px', background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)', color: '#02010a', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '13px', border: 'none', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 20px 50px rgba(34, 211, 238, 0.25)', display: 'inline-block', margin: '0 auto', width: 'auto' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 30px 60px rgba(34, 211, 238, 0.35)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 20px 50px rgba(34, 211, 238, 0.25)';
                        }}
                    >
                        Start Assessment
                    </button>
                )}
            </div>
        </div>
    );

    const q = questions[currentIdx];

    return (
        <div style={{ gap: '32px', maxWidth: '1300px', margin: '0 auto', width: '100%' }} className="pb-40 relative flex flex-col">
            <div style={{ padding: '20px 24px', gap: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)', border: '1.5px solid rgba(34, 211, 238, 0.15)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(34, 211, 238, 0.08)' }}>
                {/* LEFT: PROGRESS INDICATOR */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                    {/* Question Counter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '12px', border: '1px solid rgba(34, 211, 238, 0.2)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Progress</span>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: '#22d3ee' }}>{currentIdx + 1}/{questions.length}</span>
                    </div>

                    {/* Continuous Progress Bar */}
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(34, 211, 238, 0.1)' }}>
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #22d3ee, #06b6d4)',
                                boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)'
                            }}
                        />
                    </div>

                    {/* Percentage */}
                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#22d3ee', minWidth: '40px', textAlign: 'right' }}>{Math.round(((currentIdx + 1) / questions.length) * 100)}%</span>
                </div>

                {/* RIGHT: TIMER */}
                {timeLeft !== null && (
                    <div style={{ gap: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', borderRadius: '16px', fontFamily: 'monospace', fontWeight: 900, fontSize: '14px', border: '1.5px solid', background: timeLeft < 20 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 211, 238, 0.1)', borderColor: timeLeft < 20 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 211, 238, 0.3)', color: timeLeft < 20 ? '#ef4444' : '#22d3ee', transition: 'all 0.3s', boxShadow: timeLeft < 20 ? '0 0 15px rgba(239, 68, 68, 0.15)' : '0 0 15px rgba(34, 211, 238, 0.1)' }}>
                        <Clock size={18} /> {formatTime(timeLeft)}
                    </div>
                )}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentIdx}
                    initial={{ opacity: 0, x: 40, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, x: -40, y: -10 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    style={{ minHeight: '500px', gap: '32px', display: 'flex', flexDirection: 'column' }}
                >
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
                            {['True', 'False'].map(val => (
                                <button
                                    key={val}
                                    onClick={() => saveAnswer(q.id, val)}
                                    style={{
                                        padding: '32px 24px',
                                        borderRadius: '32px',
                                        border: answers[q.id] === val ? '2px solid #06b6d4' : '2px solid rgba(255, 255, 255, 0.1)',
                                        fontSize: '28px',
                                        fontWeight: 900,
                                        backgroundColor: answers[q.id] === val ? '#22d3ee' : 'rgba(255, 255, 255, 0.03)',
                                        color: answers[q.id] === val ? '#02010a' : '#94a3b8',
                                        transition: 'all 0.3s',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        boxShadow: answers[q.id] === val ? '0 12px 32px rgba(34, 211, 238, 0.3)' : '0 4px 12px rgba(0, 0, 0, 0.2)'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (answers[q.id] !== val) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.3)';
                                            e.currentTarget.style.color = 'white';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (answers[q.id] !== val) {
                                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.color = '#94a3b8';
                                        }
                                    }}
                                >
                                    {val}
                                </button>
                            ))}
                        </div>
                    )}

                    {q.type === 'identification' && (
                        <input
                            value={answers[q.id] || ""}
                            onChange={(e) => saveAnswer(q.id, e.target.value)}
                            style={{
                                width: '100%',
                                padding: '28px 32px',
                                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
                                border: '1.5px solid rgba(34, 211, 238, 0.2)',
                                borderRadius: '28px',
                                fontSize: '18px',
                                fontWeight: 600,
                                color: '#22d3ee',
                                outline: 'none',
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 8px 32px rgba(34, 211, 238, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                transition: 'all 0.3s',
                                caretColor: '#22d3ee'
                            }}
                            placeholder="Type your answer here..."
                            onFocus={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)';
                                e.currentTarget.style.boxShadow = '0 12px 40px rgba(34, 211, 238, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.2)';
                                e.currentTarget.style.boxShadow = '0 8px 32px rgba(34, 211, 238, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)';
                            }}
                        />
                    )}

                    {q.type === 'enumeration' && (
                        <div style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
                            {(answers[q.id] || ['']).map((val, i) => (
                                <div key={i} style={{ gap: '12px', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        value={val}
                                        onChange={(e) => { const n = [...(answers[q.id] || [''])]; n[i] = e.target.value; saveAnswer(q.id, n); }}
                                        style={{
                                            flex: 1,
                                            padding: '18px 24px',
                                            background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
                                            border: '1.5px solid rgba(34, 211, 238, 0.2)',
                                            borderRadius: '20px',
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: '#cbd5e1',
                                            outline: 'none',
                                            backdropFilter: 'blur(10px)',
                                            boxShadow: '0 4px 16px rgba(34, 211, 238, 0.06)',
                                            transition: 'all 0.3s',
                                            caretColor: '#22d3ee'
                                        }}
                                        placeholder={`Entry ${i+1}...`}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(34, 211, 238, 0.12)';
                                            e.currentTarget.style.color = '#22d3ee';
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.2)';
                                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 211, 238, 0.06)';
                                            e.currentTarget.style.color = '#cbd5e1';
                                        }}
                                    />
                                    <button
                                        onClick={() => { const n = (answers[q.id] || ['']).filter((_, idx) => idx !== i); saveAnswer(q.id, n); }}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '12px',
                                            border: '1.5px solid rgba(239, 68, 68, 0.2)',
                                            background: 'rgba(239, 68, 68, 0.05)',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                                        }}
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            ))}
                            {/* Enumeration Constraint: Limit based on Teacher's defined items count */}
                            {(answers[q.id] || ['']).length < (q.options?.length || 1) && (
                                <button
                                    onClick={() => saveAnswer(q.id, [...(answers[q.id] || []), ''])}
                                    style={{
                                        padding: '14px 24px',
                                        borderRadius: '16px',
                                        background: 'rgba(34, 211, 238, 0.1)',
                                        border: '1.5px solid rgba(34, 211, 238, 0.2)',
                                        color: '#22d3ee',
                                        fontWeight: 900,
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.1em',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        marginTop: '8px'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(34, 211, 238, 0.2)';
                                        e.currentTarget.style.boxShadow = '0 8px 20px rgba(34, 211, 238, 0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(34, 211, 238, 0.1)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    + Add Entry ({(answers[q.id] || ['']).length} / {q.options?.length})
                                </button>
                            )}
                        </div>
                    )}

                    {q.type === 'coding' && (
                        <div style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
                            {/* Code Editor */}
                            <div style={{ borderRadius: '28px', border: '1.5px solid rgba(34, 211, 238, 0.2)', background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(34, 211, 238, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)' }}>
                                {/* Header */}
                                <div style={{ padding: '16px 24px', background: 'rgba(34, 211, 238, 0.08)', borderBottom: '1.5px solid rgba(34, 211, 238, 0.15)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2) 0%, rgba(34, 211, 238, 0.08) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22d3ee', boxShadow: '0 0 20px rgba(34, 211, 238, 0.15)' }}>
                                        <CodeIcon size={18} />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#64748b', margin: '0' }}>Java Source Code</p>
                                        <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0' }}>Write and test your solution</p>
                                    </div>
                                </div>
                                {/* Editor */}
                                <div style={{ position: 'relative' }}>
                                    <CodeMirror
                                        value={answers[q.id] || q.boilerplate || ""}
                                        height="450px"
                                        theme="dark"
                                        extensions={[java()]}
                                        onChange={(val) => saveAnswer(q.id, val)}
                                        className="rounded-none"
                                    />
                                </div>
                            </div>

                            {/* Test Button */}
                            <button
                                onClick={() => runCodeTest(answers[q.id] || q.boilerplate)}
                                disabled={isRunning}
                                style={{
                                    padding: '18px 32px',
                                    background: isRunning ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(6, 182, 212, 0.08) 100%)' : 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                                    border: '1.5px solid' + (isRunning ? ' rgba(34, 211, 238, 0.3)' : ' rgba(34, 211, 238, 0.4)'),
                                    borderRadius: '24px',
                                    fontWeight: 900,
                                    fontSize: '12px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.15em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    cursor: isRunning ? 'not-allowed' : 'pointer',
                                    color: isRunning ? '#64748b' : '#02010a',
                                    transition: 'all 0.3s',
                                    boxShadow: isRunning ? '0 8px 20px rgba(34, 211, 238, 0.1)' : '0 12px 32px rgba(34, 211, 238, 0.25)',
                                    opacity: isRunning ? 0.7 : 1
                                }}
                                onMouseEnter={(e) => {
                                    if (!isRunning) {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 16px 40px rgba(34, 211, 238, 0.35)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isRunning) {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(34, 211, 238, 0.25)';
                                    }
                                }}
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        <span>Executing...</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={18} fill="currentColor" />
                                        <span>Test Logic</span>
                                    </>
                                )}
                            </button>

                            {/* Output Console */}
                            {codeOutput && (
                                <div style={{
                                    borderRadius: '24px',
                                    border: '1.5px solid rgba(34, 211, 238, 0.2)',
                                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(15, 23, 42, 0.7) 100%)',
                                    padding: '20px 24px',
                                    fontFamily: 'monospace',
                                    fontSize: '13px',
                                    color: '#22d3ee',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: '280px',
                                    overflowY: 'auto',
                                    boxShadow: '0 12px 32px rgba(34, 211, 238, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                                    backdropFilter: 'blur(10px)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(34, 211, 238, 0.15)' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 10px #22d3ee' }} />
                                        <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>Output</span>
                                    </div>
                                    {codeOutput}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                </motion.div>
            </AnimatePresence>

            <div style={{ marginTop: '32px', padding: '24px 32px', gap: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)', border: '1px solid rgba(34, 211, 238, 0.15)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 32px rgba(34, 211, 238, 0.08)' }}>
                {/* Robust Navigation: Disable Prev if in Per-Question mode to prevent timer resetting abuse */}
                <button
                    disabled={currentIdx === 0 || quizData.timer_mode === 'per_question'}
                    onClick={() => setCurrentIdx(currentIdx - 1)}
                    style={{ gap: '8px', display: 'flex', alignItems: 'center', color: currentIdx === 0 || quizData.timer_mode === 'per_question' ? '#475569' : '#94a3b8', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', border: 'none', background: 'transparent', cursor: currentIdx === 0 || quizData.timer_mode === 'per_question' ? 'not-allowed' : 'pointer', opacity: currentIdx === 0 || quizData.timer_mode === 'per_question' ? 0.4 : 1, transition: 'all 0.3s' }}
                    onMouseEnter={(e) => {
                        if (currentIdx !== 0 && quizData.timer_mode !== 'per_question') {
                            e.currentTarget.style.color = 'white';
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (currentIdx !== 0 && quizData.timer_mode !== 'per_question') {
                            e.currentTarget.style.color = '#94a3b8';
                        }
                    }}
                >
                    <ChevronLeft size={18} /> Previous
                </button>
                {currentIdx === questions.length - 1 ? (
                    <button onClick={() => setShowReview(true)} style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%)', color: '#02010a', fontWeight: 900, borderRadius: '20px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 24px rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 32px rgba(255, 255, 255, 0.15)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 255, 255, 0.1)';
                        }}
                    >
                        Verify & Finish
                    </button>
                ) : (
                    <button onClick={() => setCurrentIdx(currentIdx + 1)} style={{ padding: '16px 40px', background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)', color: '#02010a', fontWeight: 900, borderRadius: '20px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', border: 'none', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 8px 24px rgba(34, 211, 238, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 12px 32px rgba(34, 211, 238, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(34, 211, 238, 0.2)';
                        }}
                    >
                        Continue <ChevronRight size={18} />
                    </button>
                )}
            </div>

            <AnimatePresence>
                {showReview && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReview(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.95)', backdropFilter: 'blur(20px)' }} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                position: 'relative',
                                zIndex: 10,
                                width: '100%',
                                maxWidth: '480px',
                                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
                                border: '1.5px solid rgba(34, 211, 238, 0.2)',
                                borderRadius: '40px',
                                padding: '40px',
                                boxShadow: '0 20px 60px rgba(34, 211, 238, 0.15), 0 0 40px rgba(34, 211, 238, 0.1)',
                                backdropFilter: 'blur(12px)'
                            }}
                        >
                            {/* HEADER */}
                            <div style={{ textAlign: 'center', marginBottom: '32px', gap: '16px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                    <ClipboardList style={{ color: '#22d3ee' }} size={48} />
                                </div>
                                <h2 style={{ fontSize: '32px', fontWeight: 900, color: 'white', margin: '0', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Review Answers</h2>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0' }}>Answered: {Object.keys(answers).length} / {questions.length}</p>
                            </div>

                            {/* QUESTION GRID */}
                            {quizData.timer_mode !== 'per_question' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', marginBottom: '32px' }}>
                                    {questions.map((question, i) => (
                                        <button
                                            key={question.id}
                                            onClick={() => { setCurrentIdx(i); setShowReview(false); }}
                                            style={{
                                                height: '40px',
                                                borderRadius: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                fontWeight: 900,
                                                border: answers[question.id] ? '1.5px solid rgba(34, 211, 238, 0.3)' : '1.5px solid rgba(239, 68, 68, 0.3)',
                                                background: answers[question.id] ? 'rgba(34, 211, 238, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                                color: answers[question.id] ? '#22d3ee' : '#ef4444',
                                                cursor: 'pointer',
                                                transition: 'all 0.3s'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'scale(1.05)';
                                                e.currentTarget.style.boxShadow = `0 0 15px ${answers[question.id] ? 'rgba(34, 211, 238, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'scale(1)';
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* ACTION BUTTONS */}
                            <div style={{ display: 'flex', gap: '12px', flexDirection: quizData.timer_mode === 'per_question' ? 'column' : 'row' }}>
                                {quizData.timer_mode !== 'per_question' && (
                                    <button
                                        onClick={() => setShowReview(false)}
                                        style={{
                                            flex: 1,
                                            padding: '16px 24px',
                                            borderRadius: '16px',
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            color: '#94a3b8',
                                            fontWeight: 900,
                                            textTransform: 'uppercase',
                                            fontSize: '12px',
                                            letterSpacing: '0.15em',
                                            border: '1.5px solid rgba(255, 255, 255, 0.1)',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                            e.currentTarget.style.color = '#94a3b8';
                                        }}
                                    >
                                        Modify
                                    </button>
                                )}
                                <button
                                    onClick={submitQuiz}
                                    style={{
                                        flex: 1,
                                        padding: '16px 24px',
                                        borderRadius: '16px',
                                        background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
                                        color: '#02010a',
                                        fontWeight: 900,
                                        textTransform: 'uppercase',
                                        fontSize: '12px',
                                        letterSpacing: '0.15em',
                                        border: 'none',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        boxShadow: '0 8px 24px rgba(34, 211, 238, 0.25)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 12px 32px rgba(34, 211, 238, 0.35)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(34, 211, 238, 0.25)';
                                    }}
                                >
                                    Submit Quiz
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function QuizSkeleton() {
    return (
        <div style={{ padding: '60px 40px', maxWidth: '900px', margin: '0 auto' }}>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: -1000px 0; }
                    100% { background-position: 1000px 0; }
                }
                .shimmer {
                    background-image: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
                    background-size: 200px 100%;
                    animation: shimmer 2s infinite;
                }
            `}</style>

            {/* Header Icon */}
            <div style={{ height: '80px', width: '80px', borderRadius: '24px', background: 'rgba(34, 211, 238, 0.05)', margin: '0 auto 32px', border: '1px solid rgba(34, 211, 238, 0.1)' }} className="shimmer" />

            {/* Title */}
            <div style={{ height: '48px', width: '70%', borderRadius: '16px', background: 'rgba(34, 211, 238, 0.05)', margin: '0 auto 40px', border: '1px solid rgba(34, 211, 238, 0.1)' }} className="shimmer" />

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '60px' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ padding: '24px', borderRadius: '16px', background: 'rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.1)', display: 'flex', flexDirection: 'column', gap: '12px' }} className="shimmer">
                        <div style={{ height: '16px', width: '60%', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }} />
                        <div style={{ height: '28px', width: '80%', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }} />
                    </div>
                ))}
            </div>

            {/* Quiz Content Area */}
            <div style={{ padding: '40px', borderRadius: '24px', background: 'rgba(34, 211, 238, 0.03)', border: '1px solid rgba(34, 211, 238, 0.1)', display: 'flex', flexDirection: 'column', gap: '24px' }} className="shimmer">
                <div style={{ height: '20px', width: '40%', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }} />
                <div style={{ height: '100px', width: '100%', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)' }} />
                <div style={{ display: 'flex', gap: '12px' }}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} style={{ height: '44px', flex: 1, borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)' }} />
                    ))}
                </div>
            </div>

            {/* Button */}
            <div style={{ height: '48px', width: '200px', borderRadius: '12px', background: 'rgba(34, 211, 238, 0.1)', margin: '40px auto 0', border: '1px solid rgba(34, 211, 238, 0.2)' }} className="shimmer" />
        </div>
    );
}