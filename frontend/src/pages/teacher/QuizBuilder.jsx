import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { 
    ChevronLeft, Trash2, CheckCircle2, Code, Clock,
    Loader2, Hash, Type, ListOrdered, Shuffle,
    Bot, BotOff, Check, CloudCheck, AlertCircle,
    GripVertical, Target, Hourglass, Timer, Sparkles, Filter, Settings, Plus, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import Button from '../../components/ui/Button';

import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';

function DraggableQuestion({ q, index, quiz, isDeleting, isSyncingId, setIsDeleting, updateQuestion, removeQuestion }) {
    const dragControls = useDragControls();

    return (
        <Reorder.Item
            value={q}
            dragListener={false}
            dragControls={dragControls}
            className="group relative"
        >
            <div className="absolute -left-16 top-0 h-full hidden lg:flex flex-col items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                {!quiz.is_randomized && (
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        className="cursor-grab active:cursor-grabbing p-3 bg-white/5 rounded-xl text-slate-500 hover:text-purple-400 hover:bg-white/10 transition-all hover:scale-110 shadow-lg"
                    >
                        <GripVertical size={20} />
                    </div>
                )}
                <AnimatePresence mode="wait">
                    {isDeleting === q.id ? (
                        <motion.button
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            onClick={() => removeQuestion(q.id)}
                            disabled={isSyncingId === q.id}
                            className="p-3 bg-red-500 rounded-xl text-white border-none cursor-pointer shadow-lg shadow-red-500/40 flex items-center justify-center transition-transform hover:scale-110"
                        >
                            {isSyncingId === q.id ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
                        </motion.button>
                    ) : (
                        <button
                            onClick={() => setIsDeleting(q.id)}
                            className="p-3 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all border-none bg-transparent cursor-pointer"
                        >
                            <Trash2 size={20} />
                        </button>
                    )}
                </AnimatePresence>
            </div>

            <div className={`p-10 rounded-[40px] bg-[#050505] border border-white/5 shadow-2xl relative overflow-hidden transition-all duration-300 ${isDeleting === q.id ? 'opacity-50 grayscale scale-[0.98]' : 'hover:border-purple-500/30'}`}>
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-br from-purple-900/20 to-transparent opacity-50 pointer-events-none" />

                <div className="flex items-center gap-4 mb-8 relative z-10">
                    <span className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-lg font-black text-white shadow-xl shadow-purple-500/30">{index + 1}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 bg-purple-400/10 px-4 py-2 rounded-xl">{q.type?.replace('_', ' ')}</span>
                </div>

                <textarea
                    value={q.question_text || ""}
                    onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-2xl font-bold text-white mb-10 resize-none placeholder:text-slate-700 leading-snug relative z-10"
                    placeholder="Compose your question here..."
                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />

                <div className="space-y-6 relative z-10">
                    {q.type === 'multiple_choice' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options?.map((opt, i) => (
                                <div key={i} className={`flex items-center gap-4 p-5 rounded-2xl border transition-all duration-300 ${String(q.expected_output) === String(i) ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-white/[0.02] border-white/10 hover:border-white/20'}`}>
                                    <button onClick={() => updateQuestion(q.id, { expected_output: String(i) })} className={`w-8 h-8 rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all ${String(q.expected_output) === String(i) ? 'bg-purple-500 border-purple-500 scale-110 shadow-lg' : 'border-slate-700 hover:border-slate-500 bg-transparent'}`}>
                                        {String(q.expected_output) === String(i) && <Check size={16} className="text-white" strokeWidth={3} />}
                                    </button>
                                    <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} className="bg-transparent border-none outline-none text-slate-200 text-base w-full font-medium" placeholder={`Option ${i+1}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {q.type === 'identification' && (
                        <div className="relative group/input">
                            <Sparkles className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-500/50 transition-colors group-focus-within/input:text-purple-400" size={20} />
                            <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} className="w-full bg-white/[0.02] border border-white/10 rounded-[24px] p-6 pl-16 text-xl text-purple-400 font-bold outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all shadow-inner" placeholder="Enter precise answer..." />
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div className="flex gap-4">
                            {['True', 'False'].map(val => (
                                <button key={val} onClick={() => updateQuestion(q.id, { expected_output: val })} className={`flex-1 py-8 rounded-[24px] border text-xl font-black transition-all duration-300 cursor-pointer tracking-widest uppercase ${q.expected_output === val ? 'bg-purple-600 border-purple-500 text-white shadow-[0_10px_30px_rgba(147,51,234,0.3)] scale-[1.02]' : 'bg-white/[0.02] border-white/10 text-slate-500 hover:bg-white/5 hover:text-white'}`}>{val}</button>
                            ))}
                        </div>
                    )}

                    {q.type === 'enumeration' && (
                        <div className="space-y-3">
                            <AnimatePresence>
                                {q.options?.map((opt, i) => (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={i} className="flex gap-3">
                                        <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} className="flex-grow bg-white/[0.02] border border-white/10 rounded-2xl p-5 text-white font-medium outline-none focus:border-purple-500/40 transition-colors" placeholder={`Entry ${i+1}...`} />
                                        <button onClick={() => { const n = q.options.filter((_, idx) => idx !== i); updateQuestion(q.id, { options: n }); }} className="w-16 flex items-center justify-center text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-2xl bg-white/5 transition-colors border-none cursor-pointer"><Trash2 size={20}/></button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })} className="flex items-center gap-2 px-6 py-4 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/20 transition-all border-none cursor-pointer mt-4">
                                <Plus size={14} /> Append Entry
                            </button>
                        </div>
                    )}

                    {q.type === 'coding' && (
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <div className="flex justify-between items-end px-1">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 flex items-center gap-2"><Code size={14}/> Student Sandbox Starter</label>
                                    <button onClick={() => updateQuestion(q.id, { boilerplate: `public class Main {\n    public static void main(String[] args) {\n        // Your logic here\n\n    }\n}` })} className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-4 py-2 rounded-lg border-none cursor-pointer hover:bg-purple-500/20 transition-colors">+ Inject Java Template</button>
                                </div>
                                <div className="rounded-3xl border border-white/10 bg-[#020202] overflow-hidden shadow-inner">
                                    <CodeMirror value={q.boilerplate || ""} height="250px" theme="dark" extensions={[java()]} onChange={(val) => updateQuestion(q.id, { boilerplate: val })} />
                                </div>
                            </div>
                            <div className="p-6 bg-cyan-500/[0.03] rounded-3xl border border-cyan-500/10 group focus-within:border-cyan-500/30 transition-all">
                                <div className="flex items-center gap-2 mb-4 text-cyan-500 font-black text-[10px] uppercase tracking-[0.2em]"><Target size={14} /> Expected Console Output Validation</div>
                                <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} className="w-full bg-transparent border-none outline-none text-cyan-400 font-mono text-base placeholder:text-cyan-900" placeholder="Required system output string..." />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-12 pt-8 border-t border-white/5 flex justify-end relative z-10">
                    <div className="flex items-center gap-4 bg-white/5 px-5 py-3 rounded-2xl border border-white/10 focus-within:border-purple-500/50 focus-within:bg-white/10 transition-all">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Weight</span>
                        <input
                            type="number"
                            min="0"
                            value={q.points ?? 1}
                            onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                updateQuestion(q.id, { points: val });
                            }}
                            className="w-16 bg-transparent border-none outline-none text-right text-white font-black text-xl"
                        />
                        <span className="text-[10px] font-black text-purple-500 uppercase">PTS</span>
                    </div>
                </div>
            </div>
        </Reorder.Item>
    );
}

function AddTypeBtn({ label, icon: Icon, onClick, disabled }) {
    return (
        <button disabled={disabled} onClick={onClick} className="flex flex-col items-center justify-center gap-4 p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-purple-500/40 hover:bg-purple-500/5 hover:shadow-[0_10px_30px_rgba(168,85,247,0.1)] transition-all cursor-pointer disabled:opacity-30 group border-dashed">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 group-hover:text-purple-400 group-hover:scale-110 group-hover:bg-purple-500/10 transition-all shadow-lg">
                <Icon size={28} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 group-hover:text-slate-300 transition-colors">{label}</span>
        </button>
    );
}

export default function QuizBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);
    const [isSyncingId, setIsSyncingId] = useState(null);
    const [saveStatus, setSaveStatus] = useState('saved');

    const debounceTimer = useRef(null);

    const stats = useMemo(() => {
        const total = questions.reduce((acc, q) => acc + (Math.max(0, Number(q.points)) || 0), 0);
        const activeCount = quiz?.is_randomized && quiz?.question_limit ? quiz.question_limit : questions.length;
        
        // Calculate worst-case scenario: sort questions by points ascending and sum up the limit amount
        const sortedByPoints = [...questions].sort((a, b) => (Number(a.points) || 0) - (Number(b.points) || 0));
        const minPossiblePoints = sortedByPoints.slice(0, activeCount).reduce((acc, q) => acc + (Number(q.points) || 0), 0);

        return {
            totalPoints: total,
            minPossiblePoints: minPossiblePoints,
            poolSize: questions.length,
            activeCount: activeCount,
            isPassingInvalid: (quiz?.passing_score || 0) > minPossiblePoints,
            isLimitInvalid: quiz?.is_randomized && quiz?.question_limit > questions.length
        };
    }, [questions, quiz?.passing_score, quiz?.is_randomized, quiz?.question_limit]);

    useEffect(() => { fetchQuiz(); }, [id]);

    const fetchQuiz = async () => {
        try {
            const res = await api.get(`/teacher/quizzes/${id}`);
            setQuiz(res.data);
            const sortedQuestions = (res.data.questions || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            setQuestions(sortedQuestions);
        } catch (err) { navigate(-1); }
        finally { setLoading(false); }
    };

    const addQuestion = async (type = 'multiple_choice') => {
        setIsCreating(true);
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 50);
        try {
            const res = await api.post(`/teacher/quizzes/${id}/questions`, {
                type,
                order_index: questions.length + 1
            });
            setQuestions(prev => [...prev, res.data]);
            toast.success("Question created");
        } catch (err) { toast.error("Generation failed"); }
        finally { setIsCreating(false); }
    };

    const updateQuestion = (qId, data) => {
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, ...data } : q));
        setSaveStatus('saving');
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            try { await api.put(`/teacher/questions/${qId}`, data); setSaveStatus('saved'); } 
            catch (err) { setSaveStatus('error'); }
        }, 1000);
    };

    const handleReorder = async (newOrder) => {
        setQuestions(newOrder);
        setSaveStatus('saving');
        try {
            await api.post(`/teacher/quizzes/${id}/reorder-questions`, { question_ids: newOrder.map(q => q.id) });
            setSaveStatus('saved');
        } catch (err) { setSaveStatus('error'); }
    };

    const removeQuestion = async (qId) => {
        setIsSyncingId(qId);
        try {
            await api.delete(`/teacher/questions/${qId}`);
            setQuestions(prev => prev.filter(q => q.id !== qId));
            toast.success("Question deleted");
        } finally { setIsDeleting(null); setIsSyncingId(null); }
    };

    const handleSaveSettings = async (updates = {}) => {
        const newQuiz = { ...quiz, ...updates };
        setQuiz(newQuiz);
        setSaveStatus('saving');

        if (newQuiz.passing_score > stats.totalPoints) toast.error("Passing score cannot exceed total points.");

        try {
            await api.put(`/teacher/quizzes/${id}`, newQuiz);

            // Invalidate cache for this quiz and related courses
            invalidateCache(`/teacher/quizzes/${id}`);
            invalidateCache(`/teacher/courses/`);

            setSaveStatus('saved');
            if (Object.keys(updates).length > 0) toast.success("Settings applied");
        } catch (err) { setSaveStatus('error'); }
    };

    const getDisplayTime = () => {
        if (!quiz) return 0;
        return quiz.timer_mode === 'per_question' ? Math.round((quiz.time_limit_minutes || 0) * 60) : (quiz.time_limit_minutes || 0);
    };

    const handleTimeInput = (val) => {
        let numericVal = parseFloat(val) || 0;
        if (numericVal < 0) numericVal = 0;
        let minutes = quiz.timer_mode === 'per_question' ? numericVal / 60 : numericVal;
        if (minutes > 300) minutes = 300;
        handleSaveSettings({ time_limit_minutes: minutes });
    };

    if (loading || !quiz) return <div className="h-screen bg-[#030014] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={48} /></div>;

    return (
        <div className="max-w-5xl mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 sticky top-0 z-40 bg-[#030014]/90 backdrop-blur-xl py-6 border-b border-white/5">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => navigate(-1)} className="p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all border-none bg-transparent cursor-pointer">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col flex-grow">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1 flex items-center gap-2"><Settings size={12}/> Quiz Settings</span>
                        <input
                            value={quiz.title || ""}
                            onChange={(e) => setQuiz({...quiz, title: e.target.value})}
                            onBlur={() => handleSaveSettings()}
                            className="bg-transparent border-none outline-none text-3xl font-black text-white w-full placeholder:text-slate-800 tracking-tight"
                            placeholder="Name your quiz..."
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/5 mr-2">
                        {saveStatus === 'saving' ? <Loader2 size={14} className="text-purple-400 animate-spin" /> : <CloudCheck size={14} className="text-emerald-500" />}
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${saveStatus === 'saving' ? 'text-purple-400' : 'text-slate-500'}`}>{saveStatus === 'saving' ? 'Syncing' : 'Saved'}</span>
                    </div>
                    <button onClick={() => handleSaveSettings({ is_randomized: !quiz.is_randomized })} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center gap-2 ${quiz.is_randomized ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}><Shuffle size={14} /> Shuffle</button>
                    <button onClick={() => handleSaveSettings({ allow_ai_assistance: !quiz.allow_ai_assistance })} className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center gap-2 ${quiz.allow_ai_assistance ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]' : 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}>{quiz.allow_ai_assistance ? <Bot size={14} /> : <BotOff size={14} />} AI Agent</button>
                </div>
            </div>

            {/* CONFIGURATION DASHBOARD */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-16">
                {/* Timer Card */}
                <div className="p-6 rounded-[24px] bg-[#050505] border border-white/5 shadow-xl flex flex-col justify-between group hover:border-white/10 transition-all relative overflow-hidden">
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-4"><Timer size={16} /><span className="text-xs font-bold uppercase tracking-wider">Timer Settings</span></div>
                        <div className="flex bg-white/[0.03] p-1 rounded-xl gap-1 mb-4 border border-white/5">
                            {['entire_quiz', 'per_question'].map(m => (
                                <button key={m} onClick={() => handleSaveSettings({ timer_mode: m })} className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer transition-all ${quiz.timer_mode === m ? 'bg-purple-600 text-white shadow-md' : 'bg-transparent text-slate-500 hover:text-white'}`}>{m === 'entire_quiz' ? 'Entire Quiz' : 'Per Question'}</button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-black p-4 rounded-xl border border-white/5 focus-within:border-white/20 transition-all">
                        <div className="flex items-center gap-2">
                            <Hourglass size={16} className="text-purple-500" />
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{quiz.timer_mode === 'per_question' ? 'Seconds' : 'Minutes'}</span>
                        </div>
                        <input type="number" min="0" className="bg-transparent border-none outline-none text-white font-black text-xl w-16 text-right" value={getDisplayTime()} onChange={(e) => handleTimeInput(e.target.value)} onBlur={() => handleSaveSettings()} />
                    </div>
                </div>

                {/* Score Card */}
                <div className="p-6 rounded-[24px] bg-[#050505] border border-white/5 shadow-xl flex flex-col justify-between group hover:border-white/10 transition-all relative overflow-hidden">
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2"><Target size={16} /><span className="text-xs font-bold uppercase tracking-wider">Passing Score</span></div>
                        <p className="text-[10px] text-slate-500 font-medium pr-2 leading-relaxed">Minimum points required to pass this quiz.</p>
                    </div>
                    <div className={`flex items-center justify-between bg-black p-4 rounded-xl border transition-all ${stats.isPassingInvalid ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-white/5 focus-within:border-white/20'}`}>
                        <div className="flex flex-col">
                            <span className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${stats.isPassingInvalid ? 'text-red-400' : 'text-slate-500'}`}>Required</span>
                            <input 
                                type="number" 
                                min="0" 
                                max={stats.totalPoints}
                                className={`bg-transparent border-none outline-none font-black text-xl w-16 ${stats.isPassingInvalid ? 'text-red-500' : 'text-white'}`} 
                                value={quiz.passing_score ?? 0} 
                                onChange={(e) => {
                                    const val = Math.max(0, Number(e.target.value));
                                    const clamped = val > stats.minPossiblePoints ? stats.minPossiblePoints : val;
                                    setQuiz({...quiz, passing_score: clamped});
                                }} 
                                onBlur={() => handleSaveSettings()} 
                            />
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Max Safe</span>
                            <span className="text-lg font-black text-slate-300">{stats.minPossiblePoints}</span>
                        </div>
                    </div>
                    {stats.isPassingInvalid && <p className="text-[9px] font-bold text-red-500 uppercase mt-2">Error: Exceeds safe limit</p>}
                </div>

                {/* Pool Limit Card */}
                <div className="p-6 rounded-[24px] bg-[#050505] border border-white/5 shadow-xl flex flex-col justify-between group hover:border-white/10 transition-all relative overflow-hidden">
                    {!quiz.is_randomized && (
                        <div className="absolute inset-0 bg-[#030014]/90 z-20 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                            <Lock size={16} className="text-slate-600 mb-2" />
                            <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Turn on Shuffle to limit questions</p>
                        </div>
                    )}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 text-slate-400 mb-2"><Filter size={16} /><span className="text-xs font-bold uppercase tracking-wider">Question Limit</span></div>
                        <p className="text-[10px] text-slate-500 font-medium pr-2 leading-relaxed">Limit how many questions appear per attempt.</p>
                    </div>
                    <div className={`flex items-center justify-between bg-black p-4 rounded-xl border transition-all ${stats.isLimitInvalid ? 'border-red-500/50' : 'border-white/5 focus-within:border-white/20'}`}>
                        <div className="flex flex-col">
                            <span className={`text-[9px] font-bold uppercase tracking-wider mb-1 ${stats.isLimitInvalid ? 'text-red-400' : 'text-slate-500'}`}>Show</span>
                            <input 
                                type="number" 
                                min="1" 
                                max={questions.length}
                                placeholder="All" 
                                className={`bg-transparent border-none outline-none font-black text-xl w-16 ${stats.isLimitInvalid ? 'text-red-500' : 'text-white'}`} 
                                value={quiz.question_limit || ""} 
                                onChange={(e) => {
                                    if (e.target.value === "") {
                                        handleSaveSettings({ question_limit: null });
                                        return;
                                    }
                                    const val = Math.max(1, Number(e.target.value));
                                    const clamped = val > questions.length ? questions.length : val;
                                    handleSaveSettings({ question_limit: clamped });
                                }} 
                            />
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Total Bank</span>
                            <span className="text-lg font-black text-slate-300">{stats.poolSize}</span>
                        </div>
                    </div>
                </div>

                {/* Summary Stats Card */}
                <div className="p-6 rounded-[24px] bg-[#050505] border border-white/5 shadow-xl flex flex-col justify-center gap-6 relative overflow-hidden">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Questions in Quiz</span>
                        <span className="text-xl font-black text-white">{stats.activeCount}</span>
                    </div>
                    <div className="h-[1px] w-full bg-white/5" />
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Points</span>
                        <span className="text-xl font-black text-purple-400">{stats.totalPoints}</span>
                    </div>
                </div>
            </div>

            {/* CANVAS */}
            <div className="max-w-4xl mx-auto pb-40">
                <Reorder.Group axis="y" values={questions} onReorder={handleReorder} className="space-y-12 list-none p-0">
                    {questions.map((q, index) => (
                        <DraggableQuestion key={q.id} q={q} index={index} quiz={quiz} isDeleting={isDeleting} isSyncingId={isSyncingId} setIsDeleting={setIsDeleting} updateQuestion={updateQuestion} removeQuestion={removeQuestion} />
                    ))}
                </Reorder.Group>

                <AnimatePresence>
                    {isCreating && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="p-12 rounded-[40px] border border-white/5 bg-[#050505] shadow-2xl flex flex-col items-center justify-center gap-4 mt-12 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent animate-pulse" />
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Adding Question...</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* INSERTER HUB */}
                <div className="mt-20">
                    <div className="flex items-center gap-6 mb-12">
                        <div className="h-[1px] flex-grow bg-gradient-to-r from-transparent to-white/10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-600">Append Element</span>
                        <div className="h-[1px] flex-grow bg-gradient-to-l from-transparent to-white/10" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <AddTypeBtn label="Choice" icon={CheckCircle2} onClick={() => addQuestion('multiple_choice')} disabled={isCreating} />
                        <AddTypeBtn label="Identify" icon={Type} onClick={() => addQuestion('identification')} disabled={isCreating} />
                        <AddTypeBtn label="List" icon={ListOrdered} onClick={() => addQuestion('enumeration')} disabled={isCreating} />
                        <AddTypeBtn label="T / F" icon={Hash} onClick={() => addQuestion('true_false')} disabled={isCreating} />
                        <AddTypeBtn label="Coding" icon={Code} onClick={() => addQuestion('coding')} disabled={isCreating} />
                    </div>
                </div>
            </div>
        </div>
    );
}