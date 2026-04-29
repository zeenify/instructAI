import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
    ChevronLeft, Plus, FileText, HelpCircle, 
    MoreHorizontal, Loader2, Sparkles, ExternalLink, X, Check, GripVertical, Eye, EyeOff, Globe, Lock, Rocket
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import './CourseBuilder.css';

export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAddingModule, setIsAddingModule] = useState(false);
    const [isUpdatingCourseStatus, setIsUpdatingCourseStatus] = useState(false); // Fix for header hang
    const [newModuleTitle, setNewModuleTitle] = useState('');
    const [activeInput, setActiveInput] = useState({ moduleId: null, type: null, value: '' });
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const debounceTimer = useRef(null);
    const [isPublished, setIsPublished] = useState(false);

    useEffect(() => { fetchCourse(); }, [id]);

    const fetchCourse = async () => {
        try {
            const res = await api.get(`/teacher/courses/${id}`);
            setCourse(res.data);
            setIsPublished(res.data.is_published);
        } catch (err) { navigate(-1); }
        finally { setLoading(false); }
    };

    const toggleCourseStatus = async () => {
        setIsUpdatingCourseStatus(true); // Instant feedback
        const newStatus = !isPublished;
        try {
            await api.post(`/teacher/courses/${id}/publish`, { is_published: newStatus });
            setIsPublished(newStatus);
            toast.success(newStatus ? "Course is now live" : "Course moved to drafts");
        } catch (err) { 
            toast.error("Failed to update status"); 
        } finally {
            setIsUpdatingCourseStatus(false);
        }
    };

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
            } catch (err) { toast.error("Sync failed"); }
        }, 1000);
    };

    const toggleItemStatus = async (item) => {
        const newStatus = !item.is_published;
        const type = item.itemType === 'lesson' ? 'lessons' : 'quizzes';
        
        setCourse(prev => ({
            ...prev,
            modules: prev.modules.map(m => ({
                ...m,
                [type]: m[type].map(i => i.id === item.id ? { ...i, is_published: newStatus } : i)
            }))
        }));

        try {
            await api.put(`/teacher/${type}/${item.id}`, { is_published: newStatus });
        } catch (err) { 
            toast.error("Failed to update visibility"); 
            fetchCourse(); // Rollback on error
        }
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
            toast.success(`${type} created`);
        } catch (err) { toast.error("Failed"); }
        finally { setIsSubmittingItem(false); }
    };

    if (loading || !course) return (
        <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
    );

    return (
        <div className={`builder-container ${isDragging ? 'is-dragging-active' : ''}`}>
            <div className="mb-10">
                <button onClick={() => navigate(-1)} className="back-btn border-none bg-transparent cursor-pointer">
                    <ChevronLeft size={16} /> Back to Class
                </button>
                <div className="builder-header">
                    <div>
                        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{course.title}</h1>
                        <div className="flex items-center gap-3">
                            <p className="text-slate-400 text-sm">Curriculum Structure</p>
                            <div className={`status-pill ${isPublished ? 'live' : 'draft'}`}>
                                {isPublished ? <Globe size={10} /> : <Lock size={10} />}
                                {isPublished ? 'Live' : 'Draft'}
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            disabled={isUpdatingCourseStatus}
                            onClick={toggleCourseStatus}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border-none cursor-pointer flex items-center gap-2 ${isPublished ? 'bg-slate-800 text-slate-400' : 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'}`}
                        >
                            {isUpdatingCourseStatus ? <Loader2 size={14} className="animate-spin" /> : (isPublished ? <EyeOff size={14} /> : <Rocket size={14} />)}
                            {isPublished ? 'Unpublish' : 'Go Live'}
                        </button>
                        <button className="btn-student ai-btn">
                            <Sparkles size={14} /> AI Generate
                        </button>
                    </div>
                </div>
            </div>

            <Reorder.Group axis="y" values={course.modules} onReorder={handleReorderModules} className="module-group list-none">
                {course.modules.map((module, index) => (
                    <Reorder.Item key={module.id} value={module} className="module-card">
                        <div className="module-header">
                            <div className="flex items-center gap-4">
                                <div className="drag-handle"><GripVertical size={20} /></div>
                                <div className="module-number">{String(index + 1).padStart(2, '0')}</div>
                                <h3 className="module-title">{module.title}</h3>
                            </div>
                            <button className="icon-btn bg-transparent border-none cursor-pointer"><MoreHorizontal size={20} /></button>
                        </div>

                        <div className="module-content">
                            <span className="content-label">Module Timeline</span>
                            
                            <Reorder.Group axis="y" values={getSortedItems(module)} onReorder={(newOrder) => handleReorderItems(module.id, newOrder)} className="timeline-group list-none p-0">
                                {getSortedItems(module).map((item) => (
                                    <Reorder.Item 
                                        key={`${item.itemType}-${item.id}`} 
                                        value={item}
                                        onDragStart={() => setIsDragging(true)}
                                        onDragEnd={() => setIsDragging(false)}
                                        className={`timeline-item ${item.itemType}-item ${!item.is_published ? 'is-draft' : ''}`}
                                    >
                                        <div className="flex items-center gap-4 pointer-events-none">
                                            <div className="item-drag-handle"><GripVertical size={16} /></div>
                                            <div className={`item-icon ${item.itemType}`}>
                                                {item.itemType === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-3">
                                                    <span className="item-title">{item.title}</span>
                                                    <span className={`status-badge ${item.is_published ? 'published' : 'draft'}`}>
                                                        {item.is_published ? 'Live' : 'Draft'}
                                                    </span>
                                                </div>
                                                <span className="item-badge">{item.itemType}</span>
                                            </div>
                                        </div>
                                        
                                        {!isDragging && (
                                            <div className="item-actions">
                                                <button 
                                                    onClick={() => toggleItemStatus(item)}
                                                    className={`action-icon-btn ${item.is_published ? 'active' : ''}`}
                                                >
                                                    {item.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
                                                </button>
                                                <button 
                                                    onClick={() => navigate(`/dashboard/teacher/class/${course.class_id}/${item.itemType}/${item.id}`)} 
                                                    className={`edit-pill-btn ${item.itemType}`}
                                                >
                                                    Open {item.itemType} <ExternalLink size={12} />
                                                </button>
                                            </div>
                                        )}
                                    </Reorder.Item>
                                ))}
                            </Reorder.Group>

                            <AnimatePresence mode="wait">
                                {activeInput.moduleId === module.id ? (
                                    <motion.div 
                                        key="input"
                                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} 
                                        className={`inline-input-container ${activeInput.type}-mode`}
                                    >
                                        <div className="input-inner">
                                            <div className="type-indicator">
                                                {activeInput.type === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                            </div>
                                            <input autoFocus placeholder={`What's the name of this ${activeInput.type}?`} value={activeInput.value} onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()} />
                                            <div className="input-actions">
                                                <button onClick={() => setActiveInput({ moduleId: null, type: null, value: '' })} className="cancel-btn"><X size={18} /></button>
                                                <button disabled={isSubmittingItem || !activeInput.value.trim()} onClick={handleCreateItem} className="confirm-btn">
                                                    {isSubmittingItem ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div key="buttons" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="add-item-grid">
                                        <button onClick={() => setActiveInput({ moduleId: module.id, type: 'lesson', value: '' })} className="add-btn lesson"><Plus size={16} /> New Lesson</button>
                                        <button onClick={() => setActiveInput({ moduleId: module.id, type: 'quiz', value: '' })} className="add-btn quiz"><Plus size={16} /> New Quiz</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Reorder.Item>
                ))}
            </Reorder.Group>

            <form onSubmit={addModule} className="add-module-form">
                <input className="student-link" type="text" placeholder="Add a new chapter to this course..." value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} disabled={isAddingModule} />
                <Button loading={isAddingModule} type="submit" className="h-[60px] px-8">Add Module</Button>
            </form>
        </div>
    );
}