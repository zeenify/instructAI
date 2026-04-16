import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChevronLeft, Trash2, CheckCircle2, Code, Clock,
    Loader2, Hash, Type, ListOrdered, Shuffle,
    Bot, BotOff, Check, CloudCheck, CloudUpload,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import Button from '../../components/ui/Button';

export default function QuizBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);
    const [saveStatus, setSaveStatus] = useState('saved'); 
    
    const debounceTimer = useRef(null);

    useEffect(() => { fetchQuiz(); }, [id]);

    const fetchQuiz = async () => {
        try {
            const res = await api.get(`/teacher/quizzes/${id}`);
            setQuiz(res.data);
            setQuestions(res.data.questions || []);
        } catch (err) { navigate(-1); }
        finally { setLoading(false); }
    };

    const addQuestion = async (type = 'multiple_choice') => {
        setIsCreating(true);
        try {
            const res = await api.post(`/teacher/quizzes/${id}/questions`, { type });
            setQuestions(prev => [...prev, res.data]);
            toast.success("Question added");
            setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
        } catch (err) {
            toast.error("Save failed. Try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const updateQuestion = (qId, data) => {
        // 1. Update local UI instantly (Using ?? "" to prevent null errors)
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, ...data } : q));
        setSaveStatus('saving');

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            try {
                await api.put(`/teacher/questions/${qId}`, data);
                setSaveStatus('saved');
            } catch (err) {
                setSaveStatus('error');
                toast.error("Auto-save failed");
            }
        }, 1000);
    };

    const removeQuestion = async (qId) => {
        setIsDeleting(qId);
        try {
            await api.delete(`/teacher/questions/${qId}`);
            setQuestions(prev => prev.filter(q => q.id !== qId));
            toast.success("Deleted");
        } catch (err) {
            toast.error("Delete failed");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleSaveSettings = async () => {
        setSaveStatus('saving');
        try {
            await api.put(`/teacher/quizzes/${id}`, quiz);
            setSaveStatus('saved');
            toast.success("Settings saved");
        } catch (err) { setSaveStatus('error'); }
    };

    if (loading || !quiz) return <div className="h-screen bg-[#030014] flex items-center justify-center"><Loader2 className="animate-spin text-purple-500" /></div>;

    return (
        <>
            <div className="flex flex-col lg:flex-row justify-between items-start gap-6 mb-12">
                <div className="flex-grow">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-white mb-4 border-none bg-transparent cursor-pointer">
                        <ChevronLeft size={16} /> Back
                    </button>
                    <div className="flex items-center gap-4">
                        <input 
                            value={quiz.title || ""} 
                            onChange={(e) => setQuiz({...quiz, title: e.target.value})} 
                            className="bg-transparent border-none outline-none text-4xl font-black text-white w-full tracking-tight" 
                        />
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                            {saveStatus === 'saving' ? <Loader2 size={14} className="text-purple-400 animate-spin" /> : 
                             saveStatus === 'saved' ? <CloudCheck size={14} className="text-emerald-500" /> : 
                             <AlertCircle size={14} className="text-red-500" />}
                            <span className={`text-[9px] font-bold uppercase tracking-widest ${saveStatus === 'saving' ? 'text-purple-400' : 'text-slate-500'}`}>
                                {saveStatus === 'saving' ? 'Saving' : saveStatus === 'saved' ? 'Synced' : 'Error'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* SHUFFLE BUTTON */}
                    <button 
                        disabled={loading} // Add this
                        onClick={() => quiz && setQuiz(prev => ({...prev, is_randomized: !prev.is_randomized}))}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${quiz?.is_randomized ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                    >
                        <Shuffle size={16} /> 
                        <span className="text-[10px] font-bold uppercase tracking-widest">Shuffle</span>
                    </button>

                    {/* AI TOGGLE BUTTON */}
                    <button 
                        disabled={loading} // Add this
                        onClick={() => setQuiz({...quiz, allow_ai_assistance: !quiz.allow_ai_assistance})}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${quiz?.allow_ai_assistance ? 'bg-purple-500/10 border-purple-500/40 text-purple-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                    >
                        {quiz?.allow_ai_assistance ? <Bot size={16} /> : <BotOff size={16} />} 
                        <span className="text-[10px] font-bold uppercase tracking-widest">AI Agent</span>
                    </button>
                    <div className="flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-white/10">
                        <Clock size={16} className="text-slate-500 ml-2" />
                        <input type="number" value={quiz.time_limit_minutes ?? ""} placeholder="0" onChange={(e) => setQuiz({...quiz, time_limit_minutes: e.target.value})} className="bg-transparent border-none outline-none text-white w-10 text-center font-bold" />
                    </div>
                    <Button loading={saveStatus === 'saving'} onClick={handleSaveSettings}>Save</Button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto space-y-8 pb-40">
                {questions.map((q, index) => (
                    <motion.div layout key={q.id} className={`stat-card p-8 border-white/5 relative group transition-opacity ${isDeleting === q.id ? 'opacity-50 grayscale' : 'opacity-100'}`}>
                        <div className="flex justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <span className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-sm font-black text-white shadow-lg shadow-purple-500/20">
                                    {index + 1}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 bg-purple-400/10 px-3 py-1 rounded-md">{q.type?.replace('_', ' ')}</span>
                            </div>
                            <button disabled={isDeleting === q.id} onClick={() => removeQuestion(q.id)} className="p-2 text-slate-700 hover:text-red-500 bg-transparent border-none cursor-pointer transition-colors">
                                {isDeleting === q.id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            </button>
                        </div>

                        <textarea 
                            value={q.question_text || ""} 
                            onChange={(e) => updateQuestion(q.id, { question_text: e.target.value })} 
                            className="w-full bg-transparent border-none outline-none text-xl font-bold text-white mb-6 resize-none placeholder:text-slate-800" 
                            placeholder="Type your question..." 
                        />

                        {/* RENDERERS - Fixed null value issues using ?? "" */}
                        {q.type === 'multiple_choice' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {q.options?.map((opt, i) => (
                                    <div key={i} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${String(q.expected_output) === String(i) ? 'bg-purple-500/10 border-purple-500/40' : 'bg-white/[0.02] border-white/5'}`}>
                                        <button onClick={() => updateQuestion(q.id, { expected_output: String(i) })} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer ${String(q.expected_output) === String(i) ? 'bg-purple-500 border-purple-500' : 'border-slate-700'}`}>
                                            {String(q.expected_output) === String(i) && <Check size={12} className="text-white" />}
                                        </button>
                                        <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} className="bg-transparent border-none outline-none text-slate-300 text-sm w-full" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {q.type === 'identification' && (
                            <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-purple-400 font-bold outline-none" placeholder="Enter answer..." />
                        )}

                        {q.type === 'true_false' && (
                            <div className="flex gap-4">
                                {['True', 'False'].map(val => (
                                    <button key={val} onClick={() => updateQuestion(q.id, { expected_output: val })} className={`flex-1 py-5 rounded-2xl border font-black transition-all cursor-pointer ${q.expected_output === val ? 'bg-purple-600 border-purple-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500'}`}>{val}</button>
                                ))}
                            </div>
                        )}

                        {q.type === 'enumeration' && (
                            <div className="space-y-3">
                                {q.options?.map((opt, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input value={opt ?? ""} onChange={(e) => { const n = [...q.options]; n[i] = e.target.value; updateQuestion(q.id, { options: n }); }} className="flex-grow bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none" />
                                        <button onClick={() => { const n = q.options.filter((_, idx) => idx !== i); updateQuestion(q.id, { options: n }); }} className="p-2 text-slate-600 hover:text-red-500 bg-transparent border-none cursor-pointer"><Trash2 size={18}/></button>
                                    </div>
                                ))}
                                <button onClick={() => updateQuestion(q.id, { options: [...(q.options || []), ''] })} className="text-[10px] font-bold text-purple-400 uppercase tracking-widest bg-transparent border-none cursor-pointer mt-2">+ Add Item</button>
                            </div>
                        )}

                        {q.type === 'coding' && (
                            <div className="p-6 bg-black rounded-[24px] border border-white/10">
                                <div className="flex items-center gap-2 mb-4 text-cyan-500 font-black text-[10px] uppercase tracking-widest"><Code size={16} /> Expected Output</div>
                                <input value={q.expected_output ?? ""} onChange={(e) => updateQuestion(q.id, { expected_output: e.target.value })} className="w-full bg-transparent border-none outline-none text-cyan-400 font-mono text-sm" placeholder="Text the console should print..." />
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Weight:</span>
                                <input type="number" value={q.points ?? 1} onChange={(e) => updateQuestion(q.id, { points: e.target.value })} className="w-12 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-purple-400 font-bold outline-none" />
                            </div>
                        </div>
                    </motion.div>
                ))}

                <div className="relative">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <AddTypeBtn label="Choice" icon={CheckCircle2} onClick={() => addQuestion('multiple_choice')} disabled={isCreating} />
                        <AddTypeBtn label="Identify" icon={Type} onClick={() => addQuestion('identification')} disabled={isCreating} />
                        <AddTypeBtn label="List" icon={ListOrdered} onClick={() => addQuestion('enumeration')} disabled={isCreating} />
                        <AddTypeBtn label="T / F" icon={Hash} onClick={() => addQuestion('true_false')} disabled={isCreating} />
                        <AddTypeBtn label="Coding" icon={Code} onClick={() => addQuestion('coding')} disabled={isCreating} />
                    </div>

                    <AnimatePresence>
                        {isCreating && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#030014]/60 backdrop-blur-sm rounded-[24px] flex items-center justify-center z-10">
                                <div className="flex items-center gap-3 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl shadow-2xl">
                                    <Loader2 className="animate-spin text-purple-500" size={20} />
                                    <span className="text-xs font-black uppercase tracking-widest text-white">Connecting to Neon...</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    );
}

function AddTypeBtn({ label, icon: Icon, onClick, disabled }) {
    return (
        <button disabled={disabled} onClick={onClick} className="p-5 bg-white/[0.02] border border-dashed border-white/10 rounded-[24px] flex flex-col items-center gap-3 text-slate-500 hover:text-purple-400 hover:border-purple-500/40 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-wait group">
            <Icon size={24} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
        </button>
    );
}