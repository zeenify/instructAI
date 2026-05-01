import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
    ChevronLeft, Plus, FileText, HelpCircle, MoreHorizontal, Loader2, 
    Sparkles, ExternalLink, X, Check, GripVertical, Eye, EyeOff, Globe, Lock, Rocket, Trash2, Brain
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import DeleteModal from '../../components/ui/DeleteModal';
import AiArchitectModal from './AiArchitectModal'; 
import CurriculumReviewModal from './CurriculumReviewModal.jsx';
import './CourseBuilder.css';


export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    
    // Core States
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPublished, setIsPublished] = useState(false);
    
    // UI Feedback States
    const [isAddingModule, setIsAddingModule] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); 
    const [isDragging, setIsDragging] = useState(false);
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    
    // Inputs
    const [newModuleTitle, setNewModuleTitle] = useState('');
    const [activeInput, setActiveInput] = useState({ moduleId: null, type: null, value: '' });
    const debounceTimer = useRef(null);

    // AI States
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isEngineering, setIsEngineering] = useState(false);
    const [aiLogs, setAiLogs] = useState([]); 
    const [aiResult, setAiResult] = useState(null); 
    const [isReviewOpen, setIsReviewOpen] = useState(false);

    const [deleteConfig, setDeleteModal] = useState({ isOpen: false, type: '', id: null });
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => { fetchCourse(); }, [id]);

    const fetchCourse = async () => {
        try {
            const res = await api.get(`/teacher/courses/${id}`);
            setCourse(res.data);
            setIsPublished(res.data.is_published);
        } catch (err) { navigate('/dashboard/teacher'); }
        finally { setLoading(false); }
    };

    // --- NAVIGATION ---
    const goBackToClass = () => {
        if (course?.class_id) navigate(`/dashboard/teacher/class/${course.class_id}`);
        else navigate('/dashboard/teacher');
    };

    // --- ACTIONS ---
    const toggleCourseStatus = async () => {
        setIsUpdatingStatus(true);
        const newStatus = !isPublished;
        try {
            await api.post(`/teacher/courses/${id}/publish`, { is_published: newStatus });
            setIsPublished(newStatus);
            toast.success(newStatus ? "Course is now live" : "Course set to draft");
        } catch (err) { toast.error("Update failed"); }
        finally { setIsUpdatingStatus(false); }
    };

    const publishAllItems = async () => {
        setIsUpdatingStatus(true);
        try {
            await api.post(`/teacher/courses/${id}/publish-all`);
            toast.success("Curriculum synchronized and live");
            fetchCourse();
        } catch (err) { toast.error("Bulk sync failed"); }
        finally { setIsUpdatingStatus(false); }
    };

    const deleteItem = async (type, itemId) => {
        if (!confirm(`Delete this ${type}? This action is permanent.`)) return;
        try {
            await api.delete(`/teacher/${type}s/${itemId}`);
            toast.success("Item removed");
            fetchCourse();
        } catch (err) { toast.error("Delete failed"); }
    };

    const openDeleteModal = (type, itemId) => {
        setDeleteModal({ isOpen: true, type, id: itemId });
    };

    const handlePermanentDelete = async () => {
        const { type, id: itemId } = deleteConfig;
        setIsDeleting(true);
        
        // Correct Pluralization: 'quiz' becomes 'quizzes', everything else adds 's'
        const pluralType = type === 'quiz' ? 'quizzes' : `${type}s`;

        try {
            await api.delete(`/teacher/${pluralType}/${itemId}`);
            toast.success("Timeline updated successfully");
            setDeleteModal({ isOpen: false, type: '', id: null });
            fetchCourse();
        } catch (err) {
            toast.error("Deletion failed. Check database constraints.");
        } finally {
            setIsDeleting(false);
        }
    };



    const toggleItemStatus = async (item) => {
        const newStatus = !item.is_published;
        const type = item.itemType === 'lesson' ? 'lessons' : 'quizzes';
        
        // Optimistic UI
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => ({
                ...m,
                [type]: m[type].map(i => i.id === item.id ? { ...i, is_published: newStatus } : i)
            }))
        }));

        try {
            await api.put(`/teacher/${type}/${item.id}`, { is_published: newStatus });
        } catch (err) { fetchCourse(); }
    };
    
    const handleExecuteAI = async (prompt, file) => {
            setIsAiModalOpen(false);
            setIsEngineering(true);
            setAiLogs(["[SYSTEM] Initializing InstructAI Agent...", "[AUTH] Verifying workspace...", "[LLM] Linking to Groq Llama-3..."]);

            const formData = new FormData();
            formData.append('prompt', prompt); 
            if (file) formData.append('file', file);

            try {
                setTimeout(() => setAiLogs(prev => [...prev, "[IO] Analyzing document schema...", "[LOGIC] Planning curriculum path..."]), 1000);
                
                const res = await api.post(`/teacher/courses/${id}/ai-generate`, formData);
                
                // BULLETPROOF NORMALIZATION
                // 1. Ensure new_modules is an array
                const rawModules = Array.isArray(res.data?.new_modules) ? res.data.new_modules :[];
                
                const normalizedData = {
                    new_modules: rawModules.map(m => {
                        // 2. Ensure lessons and quizzes are arrays, and safely map them
                        const lessons = Array.isArray(m.lessons) 
                            ? m.lessons.map(l => ({ title: l.title || 'Untitled Lesson', type: 'lesson' })) 
                            :[];
                            
                        const quizzes = Array.isArray(m.quizzes) 
                            ? m.quizzes.map(q => ({ title: q.title || 'Untitled Quiz', type: 'quiz' })) 
                            :[];
                            
                        return {
                            title: m.title || 'Untitled Module', // 3. Ensure title exists
                            items: [...lessons, ...quizzes]
                        };
                    })
                };

                // If the AI completely failed and returned 0 modules, warn the user
                if (normalizedData.new_modules.length === 0) {
                    toast.error("AI couldn't generate a structure. Try a simpler prompt.");
                    setIsEngineering(false);
                    return;
                }
                
                setAiLogs(prev => [...prev, "[DATA] Blueprint ready. Launching Review Mode..."]);
                setTimeout(() => {
                    setAiResult(normalizedData); 
                    setIsReviewOpen(true);
                    setIsEngineering(false);
                    setAiLogs([]);
                }, 1200);
            } catch (err) {
                toast.error("AI Interrupted");
                setIsEngineering(false);
            }
        };

    const handleConfirmAI = async (finalData) => {
        setIsReviewOpen(false);
        setLoading(true);
        try {
            // We send the edited data from the modal back to Laravel
            await api.post(`/teacher/courses/${id}/ai-commit`, finalData);
            toast.success("Curriculum integrated successfully");
            fetchCourse(); // Refresh the timeline to show everything
        } catch (err) {
            toast.error("Failed to save AI curriculum");
        } finally {
            setLoading(false);
        }
    };

    // --- REORDER LOGIC ---
    const handleReorderModules = (newOrder) => {
        setCourse(prev => ({ ...prev, modules: newOrder }));
    };

    const handleReorderItems = (moduleId, newOrder) => {
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => {
                if (m.id === moduleId) {
                    return {
                        ...m,
                        lessons: newOrder.filter(i => i.itemType === 'lesson'),
                        quizzes: newOrder.filter(i => i.itemType === 'quiz'),
                        _lastOrder: newOrder 
                    };
                }
                return m;
            })
        }));

        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(async () => {
            try {
                const payload = newOrder.map(item => ({ id: item.id, itemType: item.itemType }));
                await api.post(`/teacher/modules/${moduleId}/reorder`, { items: payload });
            } catch (err) { toast.error("Order sync failed"); }
        }, 1000);
    };

    const getSortedItems = useCallback((module) => {
        if (module._lastOrder) return module._lastOrder;
        const lessons = (module.lessons || []).map(l => ({ ...l, itemType: 'lesson' }));
        const quizzes = (module.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }));
        return [...lessons, ...quizzes].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    }, []);

    const addModule = async (e) => {
        e.preventDefault();
        if (!newModuleTitle.trim()) return;
        setIsAddingModule(true);
        try {
            const res = await api.post(`/teacher/courses/${id}/modules`, { title: newModuleTitle });
            setCourse(prev => ({ ...prev, modules: [...prev.modules, { ...res.data, lessons: [], quizzes: [] }] }));
            setNewModuleTitle('');
            toast.success("Module added");
        } catch (err) { toast.error("Failed"); }
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
            toast.success("Created");
        } catch (err) { toast.error("Failed"); }
        finally { setIsSubmittingItem(false); }
    };

    if (loading || !course) return (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
    );

    return (
        <div className={`builder-container ${isDragging ? 'is-dragging-active' : ''}`}>
            {/* Header */}
            <div className="mb-10">
                <button onClick={goBackToClass} className="back-btn border-none bg-transparent cursor-pointer">
                    <ChevronLeft size={16} /> Back to Classroom Hub
                </button>
                <div className="builder-header">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{course.title}</h1>
                        <div className="flex items-center gap-4">
                            <div className={`status-pill ${isPublished ? 'live' : 'draft'}`}>
                                {isPublished ? <Globe size={10} /> : <Lock size={10} />}
                                {isPublished ? 'Live' : 'Draft'}
                            </div>
                            <button onClick={publishAllItems} className="text-[10px] font-black text-purple-400 hover:text-white uppercase tracking-widest border-none bg-transparent cursor-pointer underline decoration-purple-500/30 underline-offset-4">
                                Bulk Publish Items
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            disabled={isUpdatingStatus}
                            onClick={toggleCourseStatus}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center gap-2 ${isPublished ? 'bg-slate-800 text-slate-400' : 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'}`}
                        >
                            {isUpdatingStatus ? <Loader2 size={14} className="animate-spin" /> : (isPublished ? <EyeOff size={14} /> : <Rocket size={14} />)}
                            {isPublished ? 'Unpublish' : 'Go Live'}
                        </button>
                        <button onClick={() => setIsAiModalOpen(true)} className="btn-student ai-btn border-none cursor-pointer shadow-lg">
                            <Sparkles size={14} /> AI Architect
                        </button>
                    </div>
                </div>
            </div>

            {/* Draggable Module List */}
            <Reorder.Group axis="y" values={course.modules} onReorder={handleReorderModules} className="module-group list-none p-0">
                {course.modules.map((module, index) => (
                    <Reorder.Item key={module.id} value={module} className="module-card">
                        <div className="module-header">
                            <div className="flex items-center gap-4">
                                <div className="drag-handle"><GripVertical size={20} /></div>
                                <div className="module-number">{String(index + 1).padStart(2, '0')}</div>
                                <h3 className="module-title">{module.title}</h3>
                            </div>
                            <button onClick={() => openDeleteModal('module', module.id)} className="icon-btn hover:text-red-500 bg-transparent border-none cursor-pointer">
                                <Trash2 size={18} />
                            </button>
                        </div>

                        <div className="module-content">
                            <span className="content-label">Module Timeline</span>
                            <Reorder.Group axis="y" values={getSortedItems(module)} onReorder={(newOrder) => handleReorderItems(module.id, newOrder)} className="timeline-group list-none p-0">
                                {getSortedItems(module).map((item) => (
                                    <Reorder.Item key={`${item.itemType}-${item.id}`} value={item} onDragStart={() => setIsDragging(true)} onDragEnd={() => setIsDragging(false)} className={`timeline-item ${item.itemType}-item ${!item.is_published ? 'is-draft' : ''}`}>
                                        <div className="flex items-center gap-4 pointer-events-none">
                                            <div className="item-drag-handle"><GripVertical size={16} /></div>
                                            <div className={`item-icon ${item.itemType}`}>
                                                {item.itemType === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                            </div>
                                            <div className="flex flex-col text-left">
                                                <div className="flex items-center gap-3">
                                                    <span className="item-title">{item.title}</span>
                                                    <span className={`status-badge ${item.is_published ? 'published' : 'draft'}`}>{item.is_published ? 'Live' : 'Draft'}</span>
                                                </div>
                                                <span className="item-badge uppercase tracking-widest">{item.itemType}</span>
                                            </div>
                                        </div>
                                        {!isDragging && (
                                            <div className="item-actions">
                                                <button onClick={() => openDeleteModal(item.itemType, item.id)} className="action-icon-btn hover:text-red-500">
                                                    <Trash2 size={16} />
                                                </button>
                                                <button onClick={() => toggleItemStatus(item)} className={`action-icon-btn ${item.is_published ? 'active text-emerald-500' : ''}`}>
                                                    {item.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                                <button onClick={() => navigate(`/dashboard/teacher/class/${course.class_id}/${item.itemType}/${item.id}`)} className={`edit-pill-btn ${item.itemType}`}>
                                                    Open <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>

                            <AnimatePresence mode="wait">
                                {activeInput.moduleId === module.id && (
                                    <motion.div key="input" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`inline-input-container ${activeInput.type}-mode`} >
                                        <div className="input-inner">
                                            <input autoFocus placeholder={`Title...`} value={activeInput.value} onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()} />
                                            <div className="input-actions">
                                                <button onClick={() => setActiveInput({ moduleId: null, type: null, value: '' })} className="cancel-btn"><X size={18} /></button>
                                                <button disabled={isSubmittingItem || !activeInput.value.trim()} onClick={handleCreateItem} className="confirm-btn">
                                                    {isSubmittingItem ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {!activeInput.moduleId && (
                                <div className="add-item-grid">
                                    <button onClick={() => setActiveInput({ moduleId: module.id, type: 'lesson', value: '' })} className="add-btn lesson"><Plus size={16} /> Lesson</button>
                                    <button onClick={() => setActiveInput({ moduleId: module.id, type: 'quiz', value: '' })} className="add-btn quiz"><Plus size={16} /> Quiz</button>
                                </div>
                            )}
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            <form onSubmit={addModule} className="add-module-form">
                <input className="student-link" type="text" placeholder="Add a new chapter..." value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} disabled={isAddingModule} />
                <Button loading={isAddingModule} type="submit" className="h-[60px] px-8">Add Module</Button>
            </form>

            {/* MODALS */}
            <AiArchitectModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} onExecute={handleExecuteAI} />
            <CurriculumReviewModal isOpen={isReviewOpen} data={aiResult} onCancel={() => setIsReviewOpen(false)} onConfirm={handleConfirmAI} />

            <AnimatePresence>
                {isEngineering && (
                    <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-2xl px-4">
                        <div className="bg-[#05011d]/90 backdrop-blur-2xl border border-purple-500/30 rounded-3xl p-6 shadow-2xl">
                            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Agent Output Feed</span>
                                </div>
                                <Loader2 size={14} className="animate-spin text-slate-500" />
                            </div>
                            <div className="h-32 overflow-y-auto font-mono text-[11px] space-y-2 custom-scrollbar">
                                {aiLogs.map((log, i) => (
                                    <div key={i} className="text-slate-400 flex gap-3">
                                        <span className="text-purple-800 font-bold shrink-0">{new Date().toLocaleTimeString()}</span>
                                        <span className="animate-in fade-in slide-in-from-left-1">{log}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <DeleteModal 
                isOpen={deleteConfig.isOpen} 
                title={deleteConfig.type}
                loading={isDeleting}
                onClose={() => setDeleteModal({ ...deleteConfig, isOpen: false })}
                onConfirm={handlePermanentDelete}
            />
        </div>
    );
}