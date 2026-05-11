import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../services/api';
import { 
    ChevronLeft, CheckCircle2, Circle, 
    PlayCircle, HelpCircle, ArrowRight, ArrowLeft, Loader2, Menu, X, Lock,
    Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import LessonRenderer from './LessonRenderer';
import QuizDisplay from './QuizDisplay';
import AITutor from '../../components/student/AITutor';


export default function CourseViewer() {
    const { id: courseId, itemId, itemType } = useParams(); 
    const navigate = useNavigate();
    
    const [course, setCourse] = useState(null);
    const [progress, setProgress] = useState({ lessons: [], quizzes: [] });
    const [loading, setLoading] = useState(true);
const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [canProceed, setCanProceed] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isAiLocked, setIsAiLocked] = useState(false); // New state to control the bubble

    useEffect(() => { fetchCourseData(); }, [courseId]);
    // Fix for Step 1: Force lock the button instantly when the URL changes
useEffect(() => {
        setCanProceed(false); // Immediately lock the button
        setShowMobileSidebar(false); // Close sidebar on mobile
        setIsAiLocked(false); // Default to unlocked for lessons
    }, [itemId, itemType]);

    const fetchCourseData = async () => {
        try {
            const res = await api.get(`/student/courses/${courseId}`);
            setCourse(res.data.course);
            setProgress({
                lessons: res.data.completed_lessons,
                quizzes: res.data.completed_quizzes
            });

            // If we land on the base course URL, jump to the first available item
            if (!itemId) {
                const firstModule = res.data.course.modules[0];
                if (firstModule) {
                    const firstItem = getTimeline(firstModule)[0];
                    navigate(`/dashboard/student/course/${courseId}/${firstItem.itemType}/${firstItem.id}`, { replace: true });
                }
            }
        } catch (err) {
            toast.error("Course unavailable");
            navigate('/dashboard/student');
        } finally { setLoading(false); }
    };

    const getTimeline = (module) => {
        const lessons = (module.lessons || []).map(l => ({ ...l, itemType: 'lesson' }));
        const quizzes = (module.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }));
        return [...lessons, ...quizzes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
    };

    const flattenedTimeline = useMemo(() => {
        if (!course) return [];
        let items = [];
        course.modules.forEach(m => { items = [...items, ...getTimeline(m)]; });

        return items.map((item, index) => {
            if (index === 0) return { ...item, isLocked: false };
            const prev = items[index - 1];
            const prevDone = prev.itemType === 'lesson' 
                ? progress.lessons.includes(prev.id) 
                : progress.quizzes.includes(prev.id);
            return { ...item, isLocked: !prevDone };
        });
    }, [course, progress]);

    const activeItem = useMemo(() => {
        if (!flattenedTimeline.length || !itemId) return null;
        return flattenedTimeline.find(
            i => String(i.id) === String(itemId) && i.itemType === itemType
        );
    }, [flattenedTimeline, itemId, itemType]);


    const handleNext = async () => {
        if (!canProceed || isNavigating) return;
        
        setIsNavigating(true);
        try {
            if (itemType === 'lesson') {
                await api.post(`/student/lessons/${itemId}/complete`);
            }

            await fetchCourseData(); 

            // Find current item in the flattened list using the URL itemId
            const currentIndex = flattenedTimeline.findIndex(
                i => String(i.id) === String(itemId) && i.itemType === itemType
            );
            
            const nextItem = flattenedTimeline[currentIndex + 1];

            if (nextItem) {
                // Navigate using the new URL structure
                navigate(`/dashboard/student/course/${courseId}/${nextItem.itemType}/${nextItem.id}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                toast.success("Course Completed!");
                navigate('/dashboard/student');
            }
        } catch (err) {
            toast.error("Failed to save progress.");
        } finally {
            setIsNavigating(false);
        }
    };

    // Calculate overall percentage
    const stats = useMemo(() => {
        if (!course) return 0;
        const total = flattenedTimeline.length;
        const done = progress.lessons.length + progress.quizzes.length;
        return Math.round((done / total) * 100) || 0;
    }, [flattenedTimeline, progress]);

    if (loading) return <CourseSkeleton />;

    return (
        <div className="flex h-screen bg-[#02010a] text-white overflow-hidden student-theme">
            {/* LEFT: PERSISTENT TIMELINE */}
            <aside className={`fixed lg:relative z-50 w-80 h-full flex flex-col border-r border-white/5 bg-[#05011d]/95 backdrop-blur-2xl transition-transform duration-300 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div style={{ padding: '24px 28px', paddingBottom: '20px' }} className="border-b border-white/5 bg-[#05011d]/50">
                    <Link
                        to={`/dashboard/student/class/${course.class_id}`}
                        style={{ gap: '8px', marginBottom: '16px' }}
                        className="flex items-center text-slate-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest no-underline"
                    >
                        <ChevronLeft size={14} /> Exit Course
                    </Link>
                    <h2 style={{ marginBottom: '16px' }} className="font-bold text-lg leading-tight line-clamp-2">{course.title}</h2>

                    <div style={{ gap: '12px' }} className="flex flex-col">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-cyan-500">
                            <span>Your Progress</span>
                            <span>{stats}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }} animate={{ width: `${stats}%` }}
                                className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.3)]"
                            />
                        </div>
                    </div>
                </div>

                <div style={{ gap: '24px' }} className="flex-grow overflow-y-auto p-6 pb-12 flex flex-col custom-scrollbar">
                    {course.modules.map(module => (
                        <div key={module.id}>
                            <h3 style={{ marginBottom: '12px' }} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 px-2">{module.title}</h3>
                            <div style={{ gap: '4px' }} className="flex flex-col">
                                {getTimeline(module).map(item => {
                                    const timelineItem = flattenedTimeline.find(t => t.id === item.id && t.itemType === item.itemType);
                                    const isLocked = timelineItem?.isLocked;
                                    const isDone = item.itemType === 'lesson' ? progress.lessons.includes(item.id) : progress.quizzes.includes(item.id);
                                    const isActive = String(itemId) === String(item.id) && itemType === item.itemType;

                                    return (
                                        <button
                                            key={`${item.itemType}-${item.id}`}
                                            disabled={isLocked}
                                            onClick={() => { navigate(`/dashboard/student/course/${courseId}/${item.itemType}/${item.id}`); setShowMobileSidebar(false); }}
                                            style={{ padding: '12px 14px', gap: '12px' }}
                                            className={`w-full flex items-center rounded-xl transition-all border-none text-left cursor-pointer group
                                                ${isActive ? 'bg-cyan-500/10 text-cyan-400' : isLocked ? 'opacity-30' : 'text-slate-400 hover:bg-white/5'}`}
                                        >
                                            <div className="flex-shrink-0">
                                                {isLocked ? <Lock size={16} /> : isDone ? <CheckCircle2 size={18} className="text-emerald-500" /> : <PlayCircle size={18} className={isActive ? 'text-cyan-400' : 'text-slate-600 group-hover:text-cyan-400'} />}
                                            </div>
                                            <span className="text-sm font-bold truncate">{item.title}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

<AITutor contextItem={activeItem} isLocked={isAiLocked} />

            {/* RIGHT: CONTENT AREA */}
            <main className="flex-grow flex flex-col relative bg-[#02010a]">
                {/* Mobile Header Toggle */}
                <div style={{ padding: '16px 20px', gap: '12px' }} className="lg:hidden border-b border-white/5 flex items-center bg-[#05011d]">
                    <button style={{ padding: '10px 12px' }} onClick={() => setShowMobileSidebar(true)} className="text-cyan-500 bg-transparent border-none rounded-lg hover:bg-white/5 transition-all"><Menu /></button>
                    <span className="text-xs font-bold text-slate-400 truncate">{itemType === 'lesson' ? 'Lesson' : 'Quiz'}</span>
                </div>

                <div style={{ padding: '32px 24px 180px', gap: '24px' }} className="flex-grow overflow-y-auto custom-scrollbar md:px-20 flex flex-col">
                    <div className="max-w-4xl mx-auto">
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={`${itemType}-${itemId}`}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Only render the content if we actually have an item ID from the URL */}
                                {itemId && itemId !== 'undefined' ? (
                                    itemType === 'lesson' ? (
                                        <LessonRenderer 
                                            lessonId={itemId} 
                                            onProgressUpdate={setCanProceed}
                                            isCompleted={progress.lessons.includes(Number(itemId))} 
                                        />
) : (
                                        <QuizDisplay 
                                            quizId={itemId} 
                                            onPass={() => { setCanProceed(true); fetchCourseData(); }}
                                            onAiToggle={(allowed) => setIsAiLocked(!allowed)}
                                            isAlreadyPassed={progress.quizzes.includes(Number(itemId))}
                                        />
                                    )
                                ) : (
                                    /* This shows while the URL is redirecting to the first lesson */
                                    <div className="flex items-center justify-center h-64">
                                        <Loader2 className="animate-spin text-cyan-500" size={32} />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* NAVIGATION FOOTER */}
                <footer style={{ padding: '20px 28px', gap: '24px' }} className="fixed bottom-0 right-0 left-0 lg:left-80 bg-[#02010a]/80 backdrop-blur-xl border-t border-white/5 flex justify-between items-center z-40">
                    <button
                        onClick={() => navigate(-1)}
                        style={{ gap: '8px' }}
                        className="flex items-center text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-white transition-all bg-transparent border-none cursor-pointer"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <button
                        disabled={!canProceed || isNavigating}
                        onClick={handleNext}
                        style={{ padding: '14px 28px', gap: '12px' }}
                        className={`font-black rounded-2xl text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all border-none flex items-center
                            ${canProceed && !isNavigating
                                ? 'bg-cyan-500 text-[#02010a] shadow-cyan-500/20 cursor-pointer hover:scale-105 active:scale-95'
                                : 'bg-white/5 text-slate-600 cursor-not-allowed'
                            }`}
                    >
                        {isNavigating ? <Loader2 className="animate-spin" size={16}/> :
                         canProceed ? (
                             <>Next Chapter <ArrowRight size={16} /></>
                         ) : (
                             <><Lock size={14}/> Content Locked</>
                         )}
                    </button>
                </footer>
            </main>
        </div>
    );
}

// --- MILLION DOLLAR SKELETON ---
function CourseSkeleton() {
    return (
        <div className="flex h-screen bg-[#02010a] overflow-hidden animate-pulse">
            <aside className="w-80 border-r border-white/5 bg-[#05011d]/50 p-6 flex flex-col gap-8">
                <div className="h-4 w-20 bg-white/5 rounded" />
                <div className="h-8 w-full bg-white/5 rounded-xl" />
                <div className="h-2 w-full bg-white/5 rounded-full" />
                <div className="space-y-4 mt-8">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-12 w-full bg-white/5 rounded-xl" />)}
                </div>
            </aside>
            <main className="flex-grow p-20">
                <div className="max-w-3xl mx-auto space-y-10">
                    <div className="h-16 w-3/4 bg-white/5 rounded-2xl" />
                    <div className="h-1 w-20 bg-white/5 rounded-full" />
                    <div className="space-y-6">
                        <div className="h-4 w-full bg-white/5 rounded" />
                        <div className="h-4 w-full bg-white/5 rounded" />
                        <div className="h-4 w-2/3 bg-white/5 rounded" />
                    </div>
                    <div className="h-64 w-full bg-white/5 rounded-[40px]" />
                </div>
            </main>
        </div>
    );
}