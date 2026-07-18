import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
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
import DeleteModal from '../../components/ui/DeleteModal';

import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';

function DraggableQuestion({ q, index, quiz, deleteModalOpen, setDeleteModalOpen, isSyncingId, updateQuestion }) {
    const dragControls = useDragControls();
    const { theme } = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    return (
        <Reorder.Item
            value={q}
            dragListener={false}
            dragControls={dragControls}
            className="relative overflow-visible"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`absolute -left-16 top-0 h-full flex flex-col items-center gap-2 transition-opacity duration-300 opacity-100 z-50`}>
                {!quiz.is_randomized && (
                    <div
                        onPointerDown={(e) => dragControls.start(e)}
                        className={`cursor-grab active:cursor-grabbing p-3 rounded-xl transition-all hover:scale-110 shadow-lg ${
                            theme === 'dark'
                                ? 'bg-white/5 text-slate-500 hover:text-purple-400 hover:bg-white/10'
                                : 'bg-slate-200 text-slate-600 hover:text-purple-500 hover:bg-slate-300'
                        }`}
                    >
                        <GripVertical size={20} />
                    </div>
                )}
                <button
                    onClick={() => setDeleteModalOpen(q.id)}
                    className={`p-3 rounded-xl transition-all border-none cursor-pointer ${
                        theme === 'dark'
                            ? 'text-slate-600 hover:text-red-500 hover:bg-red-500/10 bg-transparent'
                            : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10 bg-transparent'
                    }`}
                >
                    <Trash2 size={20} />
                </button>
            </div>

            <div
                style={{ padding: '32px 40px' }}
                className={`rounded-[40px] border shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-purple-500/30 ${
                    theme === 'dark'
                        ? 'bg-[#050505] border-white/5'
                        : 'bg-white border-slate-200'
                }`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className={`absolute top-0 left-0 right-0 h-32 opacity-50 pointer-events-none ${
                    theme === 'dark'
                        ? 'bg-gradient-to-br from-purple-900/20 to-transparent'
                        : 'bg-gradient-to-br from-purple-200/30 to-transparent'
                }`} />

                <div style={{ gap: '12px', marginBottom: '24px' }} className="flex items-center relative z-10">
                    <span className="w-12 h-12 rounded-2xl bg-purple-600 flex items-center justify-center text-lg font-black text-white shadow-xl shadow-purple-500/30">{index + 1}</span>
                    <span style={{ padding: '6px 12px' }} className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 bg-purple-400/10 rounded-xl">{q.type?.replace('_', ' ')}</span>
                </div>

                <textarea
                    value={q.question_text || ""}
                    onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })}
                    style={{ marginBottom: '24px' }}
                    className={`w-full bg-transparent border-none outline-none text-2xl font-bold resize-none leading-snug relative z-10 ${
                        theme === 'dark'
                            ? 'text-white placeholder:text-slate-700'
                            : 'text-slate-900 placeholder:text-slate-400'
                    }`}
                    placeholder="Compose your question here..."
                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />

                <div style={{ gap: '16px' }} className="flex flex-col relative z-10">
                    {q.type === 'multiple_choice' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {q.options?.map((opt, i) => (
                                <div key={i} style={{ gap: '12px', padding: '12px 16px' }} className={`flex items-center rounded-2xl border transition-all duration-300 ${
                                    String(q.expected_output) === String(i)
                                        ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                                        : theme === 'dark'
                                            ? 'bg-white/[0.02] border-white/10 hover:border-white/20'
                                            : 'bg-slate-100 border-slate-300 hover:border-slate-400'
                                }`}>
                                    <button onClick={() => updateQuestion(q.id, { expected_output: String(i) })} className={`w-8 h-8 rounded-full border-[3px] flex items-center justify-center cursor-pointer transition-all flex-shrink-0 ${
                                        String(q.expected_output) === String(i)
                                            ? 'bg-purple-500 border-purple-500 scale-110 shadow-lg'
                                            : theme === 'dark'
                                                ? 'border-slate-700 hover:border-slate-500 bg-transparent'
                                                : 'border-slate-400 hover:border-slate-500 bg-transparent'
                                    }`}>
                                        {String(q.expected_output) === String(i) && <Check size={16} className="text-white" strokeWidth={3} />}
                                    </button>
                                    <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} className={`bg-transparent border-none outline-none text-base w-full font-medium ${
                                        theme === 'dark'
                                            ? 'text-slate-200'
                                            : 'text-slate-800'
                                    }`} placeholder={`Option ${i+1}`} />
                                </div>
                            ))}
                        </div>
                    )}

                    {q.type === 'identification' && (
                        <div className="relative group/input">
                            <Sparkles className="absolute left-6 top-1/2 -translate-y-1/2 text-purple-500/50 transition-colors group-focus-within/input:text-purple-400" size={20} />
                            <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} style={{ padding: '12px 16px 12px 48px' }} className={`w-full rounded-[24px] text-xl font-bold outline-none transition-all shadow-inner ${
                                theme === 'dark'
                                    ? 'bg-white/[0.02] border border-white/10 text-purple-400 focus:border-purple-500/50 focus:bg-purple-500/5'
                                    : 'bg-slate-100 border border-slate-300 text-purple-600 focus:border-purple-400 focus:bg-purple-50'
                            }`} placeholder="Enter precise answer..." />
                        </div>
                    )}

                    {q.type === 'true_false' && (
                        <div style={{ gap: '16px' }} className="flex">
                            {['True', 'False'].map(val => (
                                <button key={val} onClick={() => updateQuestion(q.id, { expected_output: val })} style={{ padding: '16px 20px' }} className={`flex-1 rounded-[24px] border text-xl font-black transition-all duration-300 cursor-pointer tracking-widest uppercase ${
                                    q.expected_output === val
                                        ? 'bg-purple-600 border-purple-500 text-white shadow-[0_10px_30px_rgba(147,51,234,0.3)] scale-[1.02]'
                                        : theme === 'dark'
                                            ? 'bg-white/[0.02] border-white/10 text-slate-500 hover:bg-white/5 hover:text-white'
                                            : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:text-slate-700'
                                }`}>{val}</button>
                            ))}
                        </div>
                    )}

                    {q.type === 'enumeration' && (
                        <div style={{ gap: '12px' }} className="flex flex-col">
                            <AnimatePresence>
                                {q.options?.map((opt, i) => (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={i} style={{ gap: '12px' }} className="flex">
                                        <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} style={{ padding: '10px 12px' }} className={`flex-grow rounded-2xl font-medium outline-none transition-colors ${
                                            theme === 'dark'
                                                ? 'bg-white/[0.02] border border-white/10 text-white focus:border-purple-500/40'
                                                : 'bg-slate-100 border border-slate-300 text-slate-800 focus:border-purple-400'
                                        }`} placeholder={`Entry ${i+1}...`} />
                                        <button onClick={() => { const n = q.options.filter((_, idx) => idx !== i); updateQuestion(q.id, { options: n }); }} style={{ padding: '10px 12px' }} className={`w-16 flex items-center justify-center rounded-2xl transition-colors border-none cursor-pointer ${
                                            theme === 'dark'
                                                ? 'text-slate-600 hover:text-red-500 hover:bg-red-500/10 bg-white/5'
                                                : 'text-slate-600 hover:text-red-500 hover:bg-red-500/10 bg-slate-200'
                                        }`}><Trash2 size={20}/></button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })} style={{ padding: '10px 16px', gap: '8px', marginTop: '8px' }} className={`flex items-center rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer ${
                                theme === 'dark'
                                    ? 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20'
                                    : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                            }`}>
                                <Plus size={14} /> Append Entry
                            </button>
                        </div>
                    )}

                    {q.type === 'coding' && (
                        <div style={{ gap: '24px' }} className="flex flex-col">
                            <div style={{ gap: '12px' }} className="flex flex-col">
                                <div style={{ gap: '12px', paddingLeft: '4px' }} className="flex justify-between items-end">
                                    <label style={{ gap: '8px' }} className={`text-[10px] font-black uppercase tracking-[0.3em] flex items-center ${
                                        theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                                    }`}><Code size={14}/> Student Sandbox Starter</label>
                                    <button onClick={() => updateQuestion(q.id, { boilerplate: `public class Main {\n    public static void main(String[] args) {\n        // Your logic here\n\n    }\n}` })} style={{ padding: '6px 12px' }} className={`text-[9px] font-black rounded-lg border-none cursor-pointer transition-colors ${
                                        theme === 'dark'
                                            ? 'text-purple-400 bg-purple-500/10 hover:bg-purple-500/20'
                                            : 'text-purple-600 bg-purple-100 hover:bg-purple-200'
                                    }`}>+ Inject Java Template</button>
                                </div>
                                <div className={`rounded-3xl border overflow-hidden shadow-inner ${
                                    theme === 'dark'
                                        ? 'border-white/10 bg-[#020202]'
                                        : 'border-slate-300 bg-slate-50'
                                }`}>
                                    <CodeMirror value={q.boilerplate || ""} height="250px" theme={theme === 'dark' ? 'dark' : 'light'} extensions={[java()]} onChange={(val) => updateQuestion(q.id, { boilerplate: val })} />
                                </div>
                            </div>
                            <div style={{ padding: '16px 20px', gap: '12px' }} className={`rounded-3xl group focus-within:transition-all flex flex-col ${
                                theme === 'dark'
                                    ? 'bg-cyan-500/[0.03] border border-cyan-500/10 focus-within:border-cyan-500/30'
                                    : 'bg-cyan-50 border border-cyan-200 focus-within:border-cyan-400'
                            }`}>
                                <div style={{ gap: '8px' }} className={`flex items-center font-black text-[10px] uppercase tracking-[0.2em] ${
                                    theme === 'dark' ? 'text-cyan-500' : 'text-cyan-600'
                                }`}><Target size={14} /> Expected Console Output Validation</div>
                                <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} className={`w-full bg-transparent border-none outline-none font-mono text-base ${
                                    theme === 'dark'
                                        ? 'text-cyan-400 placeholder:text-cyan-900'
                                        : 'text-cyan-700 placeholder:text-cyan-400'
                                }`} placeholder="Required system output string..." />
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ marginTop: '24px', paddingTop: '24px' }} className={`border-t flex justify-end relative z-10 ${
                    theme === 'dark' ? 'border-white/5' : 'border-slate-200'
                }`}>
                    <div style={{ gap: '12px', padding: '10px 16px' }} className={`flex items-center rounded-2xl border transition-all ${
                        theme === 'dark'
                            ? 'bg-white/5 border-white/10 focus-within:border-purple-500/50 focus-within:bg-white/10'
                            : 'bg-slate-100 border-slate-300 focus-within:border-purple-400 focus-within:bg-purple-50'
                    }`}>
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                        }`}>Weight</span>
                        <input
                            type="number"
                            min="0"
                            value={q.points ?? 1}
                            onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value));
                                updateQuestion(q.id, { points: val });
                            }}
                            className={`w-16 bg-transparent border-none outline-none text-right font-black text-xl ${
                                theme === 'dark' ? 'text-white' : 'text-slate-800'
                            }`}
                        />
                        <span className="text-[10px] font-black text-purple-500 uppercase">PTS</span>
                    </div>
                </div>
            </div>
        </Reorder.Item>
    );
}

function AddTypeBtn({ label, icon: Icon, onClick, disabled }) {
    const { theme } = useTheme();

    return (
        <button disabled={disabled} onClick={onClick} style={{ padding: '24px 28px', gap: '12px' }} className={`flex flex-col items-center justify-center rounded-[32px] border-dashed border transition-all cursor-pointer disabled:opacity-30 group ${
            theme === 'dark'
                ? 'bg-white/[0.02] border-white/5 hover:border-purple-500/40 hover:bg-purple-500/5 hover:shadow-[0_10px_30px_rgba(168,85,247,0.1)]'
                : 'bg-slate-100 border-slate-300 hover:border-purple-400 hover:bg-purple-50 hover:shadow-[0_10px_30px_rgba(168,85,247,0.1)]'
        }`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all shadow-lg ${
                theme === 'dark'
                    ? 'bg-white/5 text-slate-500 group-hover:text-purple-400 group-hover:bg-purple-500/10'
                    : 'bg-slate-200 text-slate-600 group-hover:text-purple-500 group-hover:bg-purple-100'
            }`}>
                <Icon size={28} />
            </div>
            <span className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${
                theme === 'dark'
                    ? 'text-slate-600 group-hover:text-slate-300'
                    : 'text-slate-600 group-hover:text-slate-700'
            }`}>{label}</span>
        </button>
    );
}

export default function QuizBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { theme } = useTheme();

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(null);
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
        } catch (err) {
            setSaveStatus('error');
            toast.error("Failed to reorder questions");
        }
    };

    const removeQuestion = async () => {
        const qId = deleteModalOpen;
        setIsSyncingId(qId);
        try {
            await api.delete(`/teacher/questions/${qId}`);
            setQuestions(prev => prev.filter(q => q.id !== qId));
            toast.warning("Question deleted");
        } catch {
            toast.error("Failed to delete question");
        } finally { setDeleteModalOpen(null); setIsSyncingId(null); }
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

    if (loading || !quiz) return <div style={{ backgroundColor: 'var(--bg-primary)' }} className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" size={48} /></div>;

    return (
        <div style={{ backgroundColor: 'var(--bg-primary)', transition: 'all 0.3s ease' }} className="min-h-screen overflow-visible">
        <div className="w-full px-4 overflow-visible">
            <div style={{ padding: '20px 0', marginBottom: '32px', gap: '24px' }} className={`flex flex-col md:flex-row justify-between items-center sticky top-0 z-40 backdrop-blur-xl border-b ${
                theme === 'dark'
                    ? 'bg-[#030014]/90 border-white/5'
                    : 'bg-slate-50/90 border-slate-200'
            }`}>
                <div style={{ gap: '16px' }} className="flex items-center w-full md:w-auto">
                    <button onClick={() => navigate(-1)} style={{ padding: '10px 12px' }} className={`rounded-full transition-all border-none cursor-pointer ${
                        theme === 'dark'
                            ? 'text-slate-500 hover:text-white hover:bg-white/5'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}>
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col flex-grow">
                        <span style={{ marginBottom: '4px', gap: '8px' }} className="text-[10px] font-bold uppercase tracking-widest text-purple-500 flex items-center"><Settings size={12}/> Quiz Settings</span>
                        <input
                            value={quiz.title || ""}
                            onChange={(e) => setQuiz({...quiz, title: e.target.value})}
                            onBlur={() => handleSaveSettings()}
                            className={`bg-transparent border-none outline-none text-3xl font-black w-full tracking-tight ${
                                theme === 'dark'
                                    ? 'text-white placeholder:text-slate-800'
                                    : 'text-slate-900 placeholder:text-slate-400'
                            }`}
                            placeholder="Name your quiz..."
                        />
                    </div>
                </div>
                <div style={{ gap: '12px' }} className="flex items-center w-full md:w-auto">
                    <div style={{ gap: '8px', padding: '10px 12px' }} className={`flex items-center rounded-2xl border ${
                        theme === 'dark'
                            ? 'bg-white/5 border-white/5'
                            : 'bg-slate-100 border-slate-300'
                    }`}>
                        {saveStatus === 'saving' ? <Loader2 size={14} className="text-purple-400 animate-spin" /> : <CloudCheck size={14} className="text-emerald-500" />}
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                            saveStatus === 'saving'
                                ? 'text-purple-400'
                                : theme === 'dark'
                                    ? 'text-slate-500'
                                    : 'text-slate-600'
                        }`}>{saveStatus === 'saving' ? 'Syncing' : 'Saved'}</span>
                    </div>
                    <button onClick={() => handleSaveSettings({ is_randomized: !quiz.is_randomized })} style={{ padding: '12px 16px', gap: '8px' }} className={`rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center ${
                        quiz.is_randomized
                            ? 'bg-cyan-500 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                            : theme === 'dark'
                                ? 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                : 'bg-slate-200 border border-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-700'
                    }`}><Shuffle size={14} /> Shuffle</button>
                    <button onClick={() => handleSaveSettings({ allow_ai_assistance: !quiz.allow_ai_assistance })} style={{ padding: '12px 16px', gap: '8px' }} className={`rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center ${
                        quiz.allow_ai_assistance
                            ? 'bg-purple-600 text-white shadow-[0_0_20px_rgba(147,51,234,0.3)]'
                            : theme === 'dark'
                                ? 'bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                                : 'bg-slate-200 border border-slate-300 text-slate-600 hover:bg-slate-300 hover:text-slate-700'
                    }`}>{quiz.allow_ai_assistance ? <Bot size={14} /> : <BotOff size={14} />} AI Agent</button>
                </div>
            </div>

            {/* CONFIGURATION DASHBOARD */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-48 max-w-full px-0">
                {/* Timer Card */}
                <div style={{ padding: '20px 24px' }} className={`rounded-[24px] border shadow-xl flex flex-col justify-between group transition-all relative overflow-hidden ${
                    theme === 'dark'
                        ? 'bg-[#050505] border-white/5 hover:border-white/10'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ gap: '8px', marginBottom: '12px' }} className={`flex items-center text-xs font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}><Timer size={16} /><span>Timer Settings</span></div>
                        <div style={{ padding: '4px', gap: '4px', marginBottom: '12px' }} className={`flex rounded-xl border ${
                            theme === 'dark'
                                ? 'bg-white/[0.03] border-white/5'
                                : 'bg-slate-100 border-slate-300'
                        }`}>
                            {['entire_quiz', 'per_question'].map(m => (
                                <button key={m} onClick={() => handleSaveSettings({ timer_mode: m })} style={{ padding: '8px 12px' }} className={`flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border-none cursor-pointer transition-all ${
                                    quiz.timer_mode === m
                                        ? 'bg-purple-600 text-white shadow-md'
                                        : theme === 'dark'
                                            ? 'bg-transparent text-slate-500 hover:text-white'
                                            : 'bg-transparent text-slate-600 hover:text-slate-700'
                                }`}>{m === 'entire_quiz' ? 'Entire Quiz' : 'Per Question'}</button>
                            ))}
                        </div>
                    </div>
                    <div style={{ padding: '12px 16px', gap: '8px' }} className={`flex items-center justify-between rounded-xl border transition-all ${
                        theme === 'dark'
                            ? 'bg-black border-white/5 focus-within:border-white/20'
                            : 'bg-slate-50 border-slate-300 focus-within:border-slate-400'
                    }`}>
                        <div style={{ gap: '8px' }} className="flex items-center">
                            <Hourglass size={16} className="text-purple-500" />
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>{quiz.timer_mode === 'per_question' ? 'Seconds' : 'Minutes'}</span>
                        </div>
                        <input type="number" min="0" className={`bg-transparent border-none outline-none font-black text-xl w-16 text-right ${
                            theme === 'dark' ? 'text-white' : 'text-slate-800'
                        }`} value={getDisplayTime()} onChange={(e) => handleTimeInput(e.target.value)} onBlur={() => handleSaveSettings()} />
                    </div>
                </div>

                {/* Score Card */}
                <div style={{ padding: '20px 24px' }} className={`rounded-[24px] border shadow-xl flex flex-col justify-between group transition-all relative overflow-hidden ${
                    theme === 'dark'
                        ? 'bg-[#050505] border-white/5 hover:border-white/10'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ gap: '8px', marginBottom: '8px' }} className={`flex items-center text-xs font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}><Target size={16} /><span>Passing Score</span></div>
                        <p className={`text-[10px] font-medium pr-2 leading-relaxed ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                        }`}>Minimum points required to pass this quiz.</p>
                    </div>
                    <div style={{ padding: '12px 16px', gap: '16px' }} className={`flex items-center justify-between rounded-xl border transition-all ${
                        stats.isPassingInvalid
                            ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                            : theme === 'dark'
                                ? 'bg-black border-white/5 focus-within:border-white/20'
                                : 'bg-slate-50 border-slate-300 focus-within:border-slate-400'
                    }`}>
                        <div className="flex flex-col">
                            <span style={{ marginBottom: '4px' }} className={`text-[9px] font-bold uppercase tracking-wider ${
                                stats.isPassingInvalid
                                    ? 'text-red-400'
                                    : theme === 'dark'
                                        ? 'text-slate-500'
                                        : 'text-slate-600'
                            }`}>Required</span>
                            <input
                                type="number"
                                min="0"
                                max={stats.totalPoints}
                                className={`bg-transparent border-none outline-none font-black text-xl w-16 ${
                                    stats.isPassingInvalid
                                        ? 'text-red-500'
                                        : theme === 'dark'
                                            ? 'text-white'
                                            : 'text-slate-800'
                                }`}
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
                            <span style={{ marginBottom: '4px' }} className={`text-[9px] font-bold uppercase tracking-wider block ${
                                theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                            }`}>Max Safe</span>
                            <span className={`text-lg font-black ${
                                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>{stats.minPossiblePoints}</span>
                        </div>
                    </div>
                    {stats.isPassingInvalid && <p style={{ marginTop: '12px' }} className="text-[9px] font-bold text-red-500 uppercase">Error: Exceeds safe limit</p>}
                </div>

                {/* Pool Limit Card */}
                <div style={{ padding: '20px 24px' }} className={`rounded-[24px] border shadow-xl flex flex-col justify-between group transition-all relative overflow-hidden ${
                    theme === 'dark'
                        ? 'bg-[#050505] border-white/5 hover:border-white/10'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                }`}>
                    {!quiz.is_randomized && (
                        <div style={{ padding: '16px' }} className={`absolute inset-0 z-20 backdrop-blur-sm flex flex-col items-center justify-center text-center ${
                            theme === 'dark' ? 'bg-[#030014]/90' : 'bg-white/90'
                        }`}>
                            <Lock size={16} className={`mb-2 ${
                                theme === 'dark' ? 'text-slate-600' : 'text-slate-400'
                            }`} />
                            <p className={`text-[9px] font-bold uppercase tracking-wider ${
                                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                            }`}>Turn on Shuffle to limit questions</p>
                        </div>
                    )}
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ gap: '8px', marginBottom: '8px' }} className={`flex items-center text-xs font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}><Filter size={16} /><span>Question Limit</span></div>
                        <p className={`text-[10px] font-medium pr-2 leading-relaxed ${
                            theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                        }`}>Limit how many questions appear per attempt.</p>
                    </div>
                    <div style={{ padding: '12px 16px', gap: '16px' }} className={`flex items-center justify-between rounded-xl border transition-all ${
                        stats.isLimitInvalid
                            ? 'border-red-500/50'
                            : theme === 'dark'
                                ? 'bg-black border-white/5 focus-within:border-white/20'
                                : 'bg-slate-50 border-slate-300 focus-within:border-slate-400'
                    }`}>
                        <div className="flex flex-col">
                            <span style={{ marginBottom: '4px' }} className={`text-[9px] font-bold uppercase tracking-wider ${
                                stats.isLimitInvalid
                                    ? 'text-red-400'
                                    : theme === 'dark'
                                        ? 'text-slate-500'
                                        : 'text-slate-600'
                            }`}>Show</span>
                            <input
                                type="number"
                                min="1"
                                max={questions.length}
                                placeholder="All"
                                className={`bg-transparent border-none outline-none font-black text-xl w-16 ${
                                    stats.isLimitInvalid
                                        ? 'text-red-500'
                                        : theme === 'dark'
                                            ? 'text-white'
                                            : 'text-slate-800'
                                }`}
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
                            <span style={{ marginBottom: '4px' }} className={`text-[9px] font-bold uppercase tracking-wider block ${
                                theme === 'dark' ? 'text-slate-500' : 'text-slate-600'
                            }`}>Total Bank</span>
                            <span className={`text-lg font-black ${
                                theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                            }`}>{stats.poolSize}</span>
                        </div>
                    </div>
                </div>

                {/* Summary Stats Card */}
                <div style={{ padding: '20px 24px', gap: '16px' }} className={`rounded-[24px] border shadow-xl flex flex-col justify-center relative overflow-hidden ${
                    theme === 'dark'
                        ? 'bg-[#050505] border-white/5'
                        : 'bg-white border-slate-200'
                }`}>
                    <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>Questions in Quiz</span>
                        <span className={`text-xl font-black ${
                            theme === 'dark' ? 'text-white' : 'text-slate-800'
                        }`}>{stats.activeCount}</span>
                    </div>
                    <div className={`h-[1px] w-full ${
                        theme === 'dark' ? 'bg-white/5' : 'bg-slate-300'
                    }`} />
                    <div className="flex justify-between items-center">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                        }`}>Total Points</span>
                        <span className="text-xl font-black text-purple-400">{stats.totalPoints}</span>
                    </div>
                </div>
            </div>

            {/* CANVAS */}
            <div className="pb-40 overflow-visible">
                <Reorder.Group axis="y" values={questions} onReorder={handleReorder} style={{ gap: '32px' }} className="flex flex-col list-none p-0 overflow-visible w-full">
                    {questions.map((q, index) => (
                        <DraggableQuestion key={q.id} q={q} index={index} quiz={quiz} deleteModalOpen={deleteModalOpen} setDeleteModalOpen={setDeleteModalOpen} isSyncingId={isSyncingId} updateQuestion={updateQuestion} />
                    ))}
                </Reorder.Group>

                <AnimatePresence>
                    {isCreating && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`p-12 rounded-[40px] border shadow-2xl flex flex-col items-center justify-center gap-4 mt-12 relative overflow-hidden ${
                            theme === 'dark'
                                ? 'border-white/5 bg-[#050505]'
                                : 'border-slate-200 bg-slate-50'
                        }`}>
                            <div className={`absolute inset-0 animate-pulse ${
                                theme === 'dark'
                                    ? 'bg-gradient-to-r from-transparent via-purple-500/5 to-transparent'
                                    : 'bg-gradient-to-r from-transparent via-purple-200/5 to-transparent'
                            }`} />
                            <Loader2 className="animate-spin text-purple-500" size={32} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-400">Adding Question...</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* INSERTER HUB */}
                <div style={{ marginTop: '48px' }}>
                    <div style={{ gap: '16px', marginBottom: '24px' }} className="flex items-center">
                        <div className={`h-[1px] flex-grow bg-gradient-to-r from-transparent ${
                            theme === 'dark' ? 'to-white/10' : 'to-slate-300'
                        }`} />
                        <span className={`text-[10px] font-black uppercase tracking-[0.5em] ${
                            theme === 'dark' ? 'text-slate-600' : 'text-slate-500'
                        }`}>Append Element</span>
                        <div className={`h-[1px] flex-grow bg-gradient-to-l from-transparent ${
                            theme === 'dark' ? 'to-white/10' : 'to-slate-300'
                        }`} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                        <AddTypeBtn label="Choice" icon={CheckCircle2} onClick={() => addQuestion('multiple_choice')} disabled={isCreating} />
                        <AddTypeBtn label="Identify" icon={Type} onClick={() => addQuestion('identification')} disabled={isCreating} />
                        <AddTypeBtn label="List" icon={ListOrdered} onClick={() => addQuestion('enumeration')} disabled={isCreating} />
                        <AddTypeBtn label="T / F" icon={Hash} onClick={() => addQuestion('true_false')} disabled={isCreating} />
                        <AddTypeBtn label="Coding" icon={Code} onClick={() => addQuestion('coding')} disabled={isCreating} />
                    </div>
                </div>
            </div>
            <DeleteModal
                isOpen={deleteModalOpen !== null}
                onClose={() => setDeleteModalOpen(null)}
                onConfirm={removeQuestion}
                title="Question"
                loading={isSyncingId !== null}
            />
        </div>
        </div>
    );
}