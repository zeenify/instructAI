import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { 
    ChevronLeft, Plus, FileText, HelpCircle, 
    MoreHorizontal, Loader2, Sparkles, ExternalLink, X, Check, GripVertical 
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import TeacherLayout from '../../components/layouts/TeacherLayout';
import Button from '../../components/ui/Button';
import './CourseBuilder.css';

export default function CourseBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAddingModule, setIsAddingModule] = useState(false);
    const [newModuleTitle, setNewModuleTitle] = useState('');
    const [activeInput, setActiveInput] = useState({ moduleId: null, type: null, value: '' });
    const [isSubmittingItem, setIsSubmittingItem] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => { fetchCourse(); }, [id]);

    const debounceTimer = useRef(null);


    const fetchCourse = async () => {
        try {
            const res = await api.get(`/teacher/courses/${id}`);
            setCourse(res.data);
        } catch (err) { navigate(-1); }
        finally { setLoading(false); }
    };

    // --- REORDER LOGIC ---
    const handleReorderModules = (newOrder) => {
        setCourse(prev => ({ ...prev, modules: newOrder }));
    };

    const handleReorderItems = (moduleId, newOrder) => {
        // A. Update UI instantly (Always smooth)
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

        // B. DEBOUNCED SYNC: Only save to DB after 1 second of "silence"
        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        debounceTimer.current = setTimeout(async () => {
            try {
                const payload = newOrder.map(item => ({
                    id: item.id,
                    itemType: item.itemType
                }));
                
                // This only fires once the teacher is DONE dragging
                await api.post(`/teacher/modules/${moduleId}/reorder`, { items: payload });
                console.log("Database order synced");
            } catch (err) {
                toast.error("Sync failed");
            }
        }, 1000); // 1 second delay
    };


    // 2. Updated Helper: Only sort by index IF we haven't manually dragged yet
    const getSortedItems = useCallback((module) => {
        // If we just dragged, use that exact order
        if (module._lastOrder) return module._lastOrder;

        const lessons = (module.lessons || []).map(l => ({ ...l, itemType: 'lesson' }));
        const quizzes = (module.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }));
        
        // Sort by order_index, but fallback to ID to keep it stable
        return [...lessons, ...quizzes].sort((a, b) => {
            const orderA = a.order_index ?? 0;
            const orderB = b.order_index ?? 0;
            if (orderA !== orderB) return orderA - orderB;
            return a.id - b.id;
        });
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
        <TeacherLayout>
            <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-purple-500" size={32} /></div>
        </TeacherLayout>
    );

    return (
        <TeacherLayout>
            <div className={`builder-container ${isDragging ? 'is-dragging-active' : ''}`}>
                <div className="mb-10">
                    <button onClick={() => navigate(-1)} className="back-btn border-none bg-transparent cursor-pointer">
                        <ChevronLeft size={16} /> Back to Class
                    </button>
                    <div className="builder-header">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">{course.title}</h1>
                            <p className="text-slate-400 text-sm">Curriculum Structure & Content Engineering</p>
                        </div>
                        <button className="btn-student ai-btn border-none cursor-pointer">
                            <Sparkles size={14} /> AI Generate
                        </button>
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
                                
                                <Reorder.Group 
                                    axis="y" 
                                    values={getSortedItems(module)} 
                                    onReorder={(newOrder) => handleReorderItems(module.id, newOrder)}
                                    className="timeline-group list-none p-0"
                                >
                                    {getSortedItems(module).map((item) => (
                                        <Reorder.Item 
                                            key={`${item.itemType}-${item.id}`} 
                                            value={item}
                                            onDragStart={() => setIsDragging(true)}
                                            onDragEnd={() => setIsDragging(false)}
                                            className={`timeline-item ${item.itemType}-item`}
                                        >
                                            <div className="flex items-center gap-4 pointer-events-none">
                                                <div className="item-drag-handle"><GripVertical size={16} /></div>
                                                <div className={`item-icon ${item.itemType}`}>
                                                    {item.itemType === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="item-title">{item.title}</span>
                                                    <span className="item-badge">{item.itemType}</span>
                                                </div>
                                            </div>
                                            {!isDragging && (
                                                <button onClick={() => navigate(`/dashboard/teacher/${item.itemType}/${item.id}`)} className="edit-btn">
                                                    Edit {item.itemType} <ExternalLink size={12} />
                                                </button>
                                            )}
                                        </Reorder.Item>
                                    ))}
                                </Reorder.Group>

                                <AnimatePresence>
                                    {activeInput.moduleId === module.id && (
                                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="inline-input-box">
                                            <div className={`type-icon ${activeInput.type}`}>
                                                {activeInput.type === 'lesson' ? <FileText size={18} /> : <HelpCircle size={18} />}
                                            </div>
                                            <input autoFocus placeholder={`Enter ${activeInput.type} title...`} value={activeInput.value} onChange={(e) => setActiveInput({ ...activeInput, value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleCreateItem()} />
                                            <div className="flex gap-1">
                                                <button onClick={() => setActiveInput({ moduleId: null, type: null, value: '' })} className="action-btn cancel bg-transparent border-none cursor-pointer"><X size={16} /></button>
                                                <button disabled={isSubmittingItem} onClick={handleCreateItem} className="action-btn confirm bg-transparent border-none cursor-pointer">
                                                    {isSubmittingItem ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                </button>
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
                    <input className="student-link" type="text" placeholder="Next Module Title..." value={newModuleTitle} onChange={(e) => setNewModuleTitle(e.target.value)} disabled={isAddingModule} />
                    <Button loading={isAddingModule} type="submit" className="h-[60px] px-8">Add Module</Button>
                </form>
            </div>
        </TeacherLayout>
    );
}