import { useEffect, useState, useMemo } from 'react';
import { flushSync } from 'react-dom';
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

    // When item changes (from navigation), reset button
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
        course.modules.forEach(m => {
            const timeline = getTimeline(m);
            // Sort within this module only, don't do global sort
            const sortedTimeline = [...timeline].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            items = [...items, ...sortedTimeline];
        });

        const result = items.map((item, index) => {
            if (index === 0) return { ...item, isLocked: false };
            const prev = items[index - 1];
            const prevDone = prev.itemType === 'lesson'
                ? progress.lessons.includes(prev.id)
                : progress.quizzes.includes(prev.id);
            return { ...item, isLocked: !prevDone };
        });

        return result;
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
                const completeRes = await api.post(`/student/lessons/${itemId}/complete`);
                }

            // Small delay to ensure backend persists the completion
            await new Promise(resolve => setTimeout(resolve, 100));

            // Fetch updated course data
            const res = await api.get(`/student/courses/${courseId}`);

            const updatedCourse = res.data.course;
            const updatedProgress = {
                lessons: res.data.completed_lessons,
                quizzes: res.data.completed_quizzes
            };

            // Manually build the timeline with updated progress to find next item
            let allItems = [];
            updatedCourse.modules.forEach(m => {
                const lessons = (m.lessons || []).map(l => ({ ...l, itemType: 'lesson' }));
                const quizzes = (m.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }));
                const moduleItems = [...lessons, ...quizzes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                allItems = [...allItems, ...moduleItems];
            });

            // Find current and next item
            const currentIndex = allItems.findIndex(
                i => String(i.id) === String(itemId) && i.itemType === itemType
            );

            const nextItem = allItems[currentIndex + 1];

            // Update state SYNCHRONOUSLY before navigating
            // flushSync forces React to process the state update immediately
            flushSync(() => {
                setCourse(updatedCourse);
                setProgress(updatedProgress);
            });

            if (nextItem) {
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
        <div style={{ background: 'linear-gradient(135deg, #050a15 0%, #0f1420 50%, #050a15 100%)' }} className="flex h-screen text-white overflow-hidden student-theme">
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

                <div key={`sidebar-${course?.id}-${progress.lessons.length}-${progress.quizzes.length}-${JSON.stringify(progress)}`} style={{ gap: '24px', padding: '24px', paddingBottom: '48px' }} className="flex-grow overflow-y-auto flex flex-col custom-scrollbar">
                    {course.modules.map(module => (
                        <div key={module.id} style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: '#94a3b8', marginBottom: '12px', padding: '0' }}>{module.title}</h3>
                            <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                                {getTimeline(module).map(item => {
                                    const timelineItem = flattenedTimeline.find(t => String(t.id) === String(item.id) && t.itemType === item.itemType);
                                    const isLocked = timelineItem?.isLocked;
                                    const isDone = item.itemType === 'lesson' ? progress.lessons.includes(item.id) : progress.quizzes.includes(item.id);
                                    const isActive = String(itemId) === String(item.id) && itemType === item.itemType;

                                    return (
                                        <button
                                            key={`${item.itemType}-${item.id}`}
                                            disabled={isLocked}
                                            onClick={() => { navigate(`/dashboard/student/course/${courseId}/${item.itemType}/${item.id}`); setShowMobileSidebar(false); }}
                                            style={{ padding: '14px 16px', gap: '12px', display: 'flex', alignItems: 'center', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', background: isActive ? 'rgba(34, 211, 238, 0.1)' : 'transparent', color: isActive ? '#22d3ee' : isLocked ? '#64748b' : '#94a3b8', transition: 'all 0.3s', opacity: isLocked ? 0.5 : 1, fontSize: '14px', fontWeight: 600, overflow: 'hidden' }}
                                            className="w-full flex items-center group"
                                            title={item.title}
                                        >
                                            <div style={{ flexShrink: 0 }}>
                                                {isLocked ? <Lock size={16} /> : isDone ? <CheckCircle2 size={18} style={{ color: '#10b981' }} /> : <PlayCircle size={18} style={{ color: isActive ? '#22d3ee' : '#64748b' }} />}
                                            </div>
                                            <span style={{ overflow: 'hidden', flex: 1 }}>
                                                <motion.span
                                                    initial={{ x: 0 }}
                                                    whileHover={{ x: -Math.max(0, item.title.length * 7 - 150), transition: { duration: item.title.length * 0.2, ease: 'linear', repeat: Infinity, repeatType: 'mirror' } }}
                                                    style={{ display: 'inline-block', whiteSpace: 'nowrap' }}
                                                >
                                                    {item.title}
                                                </motion.span>
                            </span>
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
            <main className="flex-grow flex flex-col relative" style={{ background: 'linear-gradient(135deg, #050a15 0%, #0f1420 50%, #050a15 100%)' }}>
                {/* Mobile Header Toggle */}
                <div style={{ padding: '16px 20px', gap: '12px' }} className="lg:hidden border-b border-white/5 flex items-center bg-[#05011d]">
                    <button style={{ padding: '10px 12px' }} onClick={() => setShowMobileSidebar(true)} className="text-cyan-500 bg-transparent border-none rounded-lg hover:bg-white/5 transition-all"><Menu /></button>
                    <span className="text-xs font-bold text-slate-400 truncate">{itemType === 'lesson' ? 'Lesson' : 'Quiz'}</span>
                </div>

                <div style={{ padding: '32px 24px 180px', gap: '24px' }} className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
                    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
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
                <footer style={{ padding: '20px 28px', gap: '24px', background: 'linear-gradient(180deg, rgba(5, 10, 21, 0.95) 0%, rgba(15, 20, 32, 0.95) 100%)', backdropFilter: 'blur(20px)' }} className="fixed bottom-0 right-0 left-0 lg:left-80 border-t border-white/5 flex justify-between items-center z-40">
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

// --- PREMIUM SKELETON LOADER ---
function CourseSkeleton() {
    return (
        <div style={{ background: 'linear-gradient(135deg, #050a15 0%, #0f1420 50%, #050a15 100%)' }} className="flex h-screen overflow-hidden">
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

            {/* SIDEBAR SKELETON */}
            <aside style={{ width: '320px', borderRight: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5, 1, 29, 0.95)', backdropFilter: 'blur(20px)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }} className="hidden lg:flex">
                {/* Header */}
                <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '16px', width: '80px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                    <div style={{ height: '24px', width: '100%', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                </div>

                {/* Progress bar */}
                <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '12px', width: '100%', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                    <div style={{ height: '6px', width: '100%', borderRadius: '3px', background: 'rgba(34, 211, 238, 0.1)' }} className="shimmer" />
                </div>

                {/* Timeline items */}
                <div style={{ gap: '20px', display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
                    {[1,2,3,4,5,6].map(i => (
                        <div key={i} style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '14px', width: '60%', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                            <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                                {[1,2].map(j => (
                                    <div key={j} style={{ height: '36px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)' }} className="shimmer" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* MAIN CONTENT SKELETON */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header bar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(5, 1, 29, 0.5)', backdropFilter: 'blur(10px)', display: 'lg:hidden' }} className="lg:hidden">
                    <div style={{ height: '20px', width: '120px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                </div>

                {/* Content area */}
                <div style={{ flex: 1, overflow: 'auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '1300px', width: '100%', gap: '48px', display: 'flex', flexDirection: 'column' }}>
                        {/* Title */}
                        <div style={{ height: '52px', width: '70%', borderRadius: '24px', background: 'rgba(255, 255, 255, 0.05)', margin: '0 auto' }} className="shimmer" />

                        {/* Subtitle */}
                        <div style={{ height: '16px', width: '40%', borderRadius: '8px', background: 'rgba(34, 211, 238, 0.08)', margin: '0 auto' }} className="shimmer" />

                        {/* Content blocks */}
                        <div style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
                            {[1,2,3].map(i => (
                                <div key={i} style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ height: '20px', width: '100%', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)' }} className="shimmer" />
                                    <div style={{ height: '20px', width: '95%', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)' }} className="shimmer" />
                                    <div style={{ height: '20px', width: '80%', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.04)' }} className="shimmer" />
                                </div>
                            ))}
                        </div>

                        {/* Large media block */}
                        <div style={{ height: '300px', borderRadius: '32px', background: 'rgba(255, 255, 255, 0.04)', marginTop: '24px' }} className="shimmer" />
                    </div>
                </div>

                {/* Footer skeleton */}
                <div style={{ padding: '20px 28px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'linear-gradient(180deg, rgba(5, 10, 21, 0.95) 0%, rgba(15, 20, 32, 0.95) 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
                    <div style={{ height: '24px', width: '80px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)' }} className="shimmer" />
                    <div style={{ height: '40px', width: '200px', borderRadius: '16px', background: 'rgba(34, 211, 238, 0.1)' }} className="shimmer" />
                </div>
            </main>
        </div>
    );
}