import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TeacherLayout from '../../components/layouts/TeacherLayout';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion'; 
import { 
    ChevronLeft, Plus, FileText, HelpCircle, 
    MoreHorizontal, Loader2, Sparkles, ExternalLink, X, Check 
} from 'lucide-react';
import { toast } from 'sonner';
import Button from '../../components/ui/Button';

export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Creation States
    const [isAddingModule, setIsAddingModule] = useState(false);
    const [newModuleTitle, setNewModuleTitle] = useState('');
    
    // Inline Creation State (Tracks which module is being edited)
    const [activeInput, setActiveInput] = useState({ moduleId: null, type: null, value: '' });
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);

    useEffect(() => { fetchCourse(); }, [id]);

    const fetchCourse = async () => {
        try {
            const res = await api.get(`/teacher/courses/${id}`);
            setCourse(res.data);
        } catch (err) { navigate(-1); }
        finally { setLoading(false); }
    };

    const addModule = async (e) => {
        e.preventDefault();
        if (!newModuleTitle.trim()) return;
        setIsAddingModule(true);
        try {
            const res = await api.post(`/teacher/courses/${id}/modules`, { title: newModuleTitle });
            setCourse({ ...course, modules: [...course.modules, { ...res.data, lessons: [], quizzes: [] }] });
            setNewModuleTitle('');
            toast.success("Module initialized");
        } catch (err) { toast.error("Failed to add module"); }
        finally { setIsAddingModule(false); }
    };

    const handleCreateItem = async () => {
        if (!activeInput.value.trim()) return;
        setIsSubmittingItem(true);
        const { moduleId, type, value } = activeInput;
        const endpoint = `/teacher/modules/${moduleId}/${type === 'lesson' ? 'lessons' : 'quizzes'}`;
        
        try {
            const res = await api.post(endpoint, { title: value });
            setCourse(prev => ({
                ...prev,
                modules: prev.modules.map(m => 
                    m.id === moduleId 
                    ? { ...m, [type === 'lesson' ? 'lessons' : 'quizzes']: [...m[type === 'lesson' ? 'lessons' : 'quizzes'], res.data] } 
                    : m
                )
            }));
            setActiveInput({ moduleId: null, type: null, value: '' });
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} created`);
        } catch (err) { toast.error("Creation failed"); }
        finally { setIsSubmittingItem(false); }
    };

    if (loading || !course) return (
        <TeacherLayout>
            <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
        </TeacherLayout>
    );

    return (
        <TeacherLayout>
            <div className="mb-10">
                <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-4 border-none bg-transparent cursor-pointer">
                    <ChevronLeft size={16} /> Back to Class
                </button>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{course.title}</h1>
                        <p className="text-slate-400">Curriculum Structure & Content Engineering</p>
                    </div>
                    <button className="btn-student py-2.5 px-5 text-xs font-bold uppercase tracking-widest flex items-center gap-2 border-none cursor-pointer">
                        <Sparkles size={14} /> AI Generate
                    </button>
                </div>
            </div>

            <div className="space-y-8 mb-12">
                {course.modules.map((module, index) => (
                    <div key={module.id} className="stat-card p-0 border-white/5 overflow-hidden">
                        <div className="bg-white/[0.02] border-b border-white/5 p-6 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-sm font-bold text-purple-400 border border-purple-500/20">
                                    {String(index + 1).padStart(2, '0')}
                                </div>
                                <h3 className="text-xl font-bold text-white">{module.title}</h3>
                            </div>
                        </div>

                        <div className="p-6 space-y-3">
                            {module.lessons?.map(lesson => (
                                <div key={lesson.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-purple-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <FileText size={18} className="text-purple-400" />
                                        <span className="text-sm font-semibold text-slate-200">{lesson.title}</span>
                                    </div>
                                    <button onClick={() => navigate(`/dashboard/teacher/lesson/${lesson.id}`)} className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-[11px] font-bold text-purple-400 uppercase tracking-widest hover:text-white transition-all border-none bg-transparent cursor-pointer">
                                        Edit Content <ExternalLink size={12} />
                                    </button>
                                </div>
                            ))}

                            {module.quizzes?.map(quiz => (
                                <div key={quiz.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-cyan-500/30 transition-all">
                                    <div className="flex items-center gap-4">
                                        <HelpCircle size={18} className="text-cyan-400" />
                                        <span className="text-sm font-semibold text-slate-200">{quiz.title}</span>
                                    </div>
                                    <button className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-[11px] font-bold text-cyan-400 uppercase tracking-widest hover:text-white transition-all border-none bg-transparent cursor-pointer">
                                        Build Quiz <ExternalLink size={12} />
                                    </button>
                                </div>
                            ))}

                            {/* INLINE CREATION FIELD */}
                            {activeInput.moduleId === module.id && (
                                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-2 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2">
                                    <div className={`p-2 rounded-lg ${activeInput.type === 'lesson' ? 'text-purple-400' : 'text-cyan-400'}`}>
                                        {activeInput.type === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                    </div>
                                    <input 
                                        autoFocus
                                        className="flex-grow bg-transparent border-none outline-none text-white text-sm"
                                        placeholder={`Enter ${activeInput.type} title...`}
                                        value={activeInput.value}
                                        onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()}
                                    />
                                    <button onClick={() => setActiveInput({ moduleId: null, type: null, value: '' })} className="p-2 text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer"><X size={16} /></button>
                                    <button disabled={isSubmittingItem} onClick={handleCreateItem} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all border-none cursor-pointer">
                                        {isSubmittingItem ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                    </button>
                                </motion.div>
                            )}

                            {/* TRIGGER BUTTONS */}
                            {!activeInput.moduleId && (
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <button onClick={() => setActiveInput({ moduleId: module.id, type: 'lesson', value: '' })} className="p-4 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-purple-500/5 hover:border-purple-500/40 transition-all text-slate-500 hover:text-purple-400 font-bold text-xs uppercase tracking-widest cursor-pointer">
                                        <Plus size={16} /> Add Lesson
                                    </button>
                                    <button onClick={() => setActiveInput({ moduleId: module.id, type: 'quiz', value: '' })} className="p-4 bg-white/[0.01] border border-dashed border-white/10 rounded-2xl flex items-center justify-center gap-3 hover:bg-cyan-500/5 hover:border-cyan-500/40 transition-all text-slate-500 hover:text-cyan-400 font-bold text-xs uppercase tracking-widest cursor-pointer">
                                        <Plus size={16} /> Add Quiz
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                <form onSubmit={addModule} className="flex flex-col sm:flex-row gap-4">
                    <input 
                        type="text" placeholder="Next Module Title..." 
                        className="student-link flex-grow bg-white/[0.03] text-lg py-4 px-6 border-white/10"
                        value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)}
                        disabled={isAddingModule}
                    />
                    <Button loading={isAddingModule} type="submit" className="px-10 h-[60px]">Add Module</Button>
                </form>
            </div>
        </TeacherLayout>
    );
}