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
    const [isAiLocked, setIsAiLocked] = useState(false);

    useEffect(() => { fetchCourseData(); }, [courseId]);

    useEffect(() => {
        setCanProceed(false);
        setShowMobileSidebar(false);
        setIsAiLocked(false);
    }, [itemId, itemType]);

    const fetchCourseData = async () => {
        try {
            const res = await api.get(`/student/courses/${courseId}`);
            setCourse(res.data.course);
            setProgress({
                lessons: res.data.completed_lessons,
                quizzes: res.data.completed_quizzes
            });

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
                await api.post(`/student/lessons/${itemId}/complete`);
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            const res = await api.get(`/student/courses/${courseId}`);

            const updatedCourse = res.data.course;
            const updatedProgress = {
                lessons: res.data.completed_lessons,
                quizzes: res.data.completed_quizzes
            };

            let allItems = [];
            updatedCourse.modules.forEach(m => {
                const lessons = (m.lessons || []).map(l => ({ ...l, itemType: 'lesson' }));
                const quizzes = (m.quizzes || []).map(q => ({ ...q, itemType: 'quiz' }));
                const moduleItems = [...lessons, ...quizzes].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                allItems = [...allItems, ...moduleItems];
            });

            const currentIndex = allItems.findIndex(
                i => String(i.id) === String(itemId) && i.itemType === itemType
            );

            const nextItem = allItems[currentIndex + 1];

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

    const stats = useMemo(() => {
        if (!course) return 0;
        const total = flattenedTimeline.length;
        const done = progress.lessons.length + progress.quizzes.length;
        return Math.round((done / total) * 100) || 0;
    }, [flattenedTimeline, progress]);

    if (loading) return <CourseSkeleton />;

    return (
        <div style={{ background: 'var(--bg-primary)' }} className="flex h-screen overflow-hidden">
            {/* LEFT: PERSISTENT TIMELINE */}
            <aside style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }} className={`fixed lg:relative z-50 w-80 h-full flex flex-col backdrop-blur-2xl transition-transform duration-300 ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div style={{ padding: '24px 28px', paddingBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
                    <Link
                        to={`/dashboard/student/class/${course.class_id}`}
                        style={{ gap: '8px', marginBottom: '16px', color: 'var(--text-tertiary)', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none', display: 'flex', alignItems: 'center' }}
                        className="hover:text-[var(--text-primary)] transition-all"
                    >
                        <ChevronLeft size={14} /> Exit Course
                    </Link>
                    <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)' }} className="font-bold text-lg leading-tight line-clamp-2">{course.title}</h2>

                    <div style={{ gap: '12px' }} className="flex flex-col">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>
                            <span>Your Progress</span>
                            <span>{stats}%</span>
                        </div>
                        <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ width: 0 }} animate={{ width: `${stats}%` }}
                                style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), #06b6d4)', boxShadow: '0 0 10px var(--accent-glow)' }}
                            />
                        </div>
                    </div>
                </div>

                <div key={`sidebar-${course?.id}-${progress.lessons.length}-${progress.quizzes.length}`} style={{ gap: '24px', padding: '24px', paddingBottom: '48px' }} className="flex-grow overflow-y-auto flex flex-col custom-scrollbar">
                    {course.modules.map(module => (
                        <div key={module.id} style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-tertiary)', marginBottom: '12px', padding: '0' }}>{module.title}</h3>
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
                                            style={{ padding: '14px 16px', gap: '12px', display: 'flex', alignItems: 'center', borderRadius: '12px', border: 'none', textAlign: 'left', cursor: 'pointer', background: isActive ? 'var(--accent-light)' : 'transparent', color: isActive ? 'var(--accent)' : isLocked ? 'var(--text-tertiary)' : 'var(--text-secondary)', transition: 'all 0.3s', opacity: isLocked ? 0.5 : 1, fontSize: '14px', fontWeight: 600, overflow: 'hidden' }}
                                            className="w-full flex items-center group"
                                            title={item.title}
                                        >
                                            <div style={{ flexShrink: 0 }}>
                                                {isLocked ? <Lock size={16} /> : isDone ? <CheckCircle2 size={18} style={{ color: '#10b981' }} /> : <PlayCircle size={18} style={{ color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }} />}
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

            <AITutor
                classId={course?.class_id}
                lessonId={itemType === 'lesson' ? itemId : null}
                quizId={itemType === 'quiz' ? itemId : null}
                aiEnabled={true}
                contextItem={activeItem}
                lessonContent={itemType === 'lesson' && activeItem?.content ? JSON.stringify(activeItem.content) : null}
            />

            {/* RIGHT: CONTENT AREA */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: 'var(--bg-primary)' }}>
                {/* Mobile Header Toggle */}
                <div style={{ padding: '16px 20px', gap: '12px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }} className="lg:hidden flex items-center">
                    <button style={{ padding: '10px 12px', color: 'var(--accent)', background: 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }} onClick={() => setShowMobileSidebar(true)} className="hover:bg-[var(--accent-light)] transition-all"><Menu /></button>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)' }} className="truncate">{itemType === 'lesson' ? 'Lesson' : 'Quiz'}</span>
                </div>

                <div style={{ padding: '32px 24px 180px', gap: '24px' }} className="flex-grow overflow-y-auto custom-scrollbar flex flex-col">
                    <div style={{ maxWidth: '1300px', margin: '0 auto', width: '100%' }}>
                        <AnimatePresence mode="wait">
                            <motion.div 
                                key={`${itemType}-${itemId}`}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                            >
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
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '16rem' }}>
                                        <Loader2 className="animate-spin" style={{ color: 'var(--accent)' }} size={32} />
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* NAVIGATION FOOTER */}
                <footer style={{ padding: '20px 28px', gap: '24px', background: 'var(--bg-secondary)', backdropFilter: 'blur(20px)', borderTop: '1px solid var(--border-color)' }} className="fixed bottom-0 right-0 left-0 lg:left-80 flex justify-between items-center z-40">
                    <button
                        onClick={() => navigate(-1)}
                        style={{ gap: '8px', display: 'flex', alignItems: 'center', color: 'var(--text-tertiary)', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.3s' }}
                        className="hover:text-[var(--text-primary)]"
                    >
                        <ArrowLeft size={16} /> Back
                    </button>

                    <button
                        disabled={!canProceed || isNavigating}
                        onClick={handleNext}
                        style={{ padding: '14px 28px', gap: '12px', display: 'flex', alignItems: 'center', fontWeight: 900, borderRadius: '16px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', border: 'none', transition: 'all 0.3s', boxShadow: canProceed && !isNavigating ? '0 4px 12px var(--accent-glow)' : 'none', background: canProceed && !isNavigating ? 'var(--accent)' : 'var(--bg-tertiary)', color: canProceed && !isNavigating ? '#fff' : 'var(--text-tertiary)', cursor: canProceed && !isNavigating ? 'pointer' : 'not-allowed' }}
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

function CourseSkeleton() {
    return (
        <div style={{ background: 'var(--bg-primary)' }} className="flex h-screen overflow-hidden">
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
            <aside style={{ width: '320px', borderRight: '1px solid var(--border-color)', background: 'var(--bg-secondary)', backdropFilter: 'blur(20px)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }} className="hidden lg:flex">
                {/* Header */}
                <div style={{ gap: '12px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '16px', width: '80px', borderRadius: '8px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                    <div style={{ height: '24px', width: '100%', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                </div>

                {/* Progress bar */}
                <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: '12px', width: '100%', borderRadius: '6px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                    <div style={{ height: '6px', width: '100%', borderRadius: '3px', background: 'var(--accent-light)' }} className="shimmer" />
                </div>

                {/* Timeline items */}
                <div style={{ gap: '20px', display: 'flex', flexDirection: 'column', marginTop: '16px' }}>
                    {[1,2,3,4,5,6].map(i => (
                        <div key={i} style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '14px', width: '60%', borderRadius: '6px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                            <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
                                {[1,2].map(j => (
                                    <div key={j} style={{ height: '36px', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* MAIN CONTENT SKELETON */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Header bar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }} className="lg:hidden">
                    <div style={{ height: '20px', width: '120px', borderRadius: '8px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                </div>

                {/* Content area */}
                <div style={{ flex: 1, overflow: 'auto', padding: '48px 24px', display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ maxWidth: '1300px', width: '100%', gap: '48px', display: 'flex', flexDirection: 'column' }}>
                        {/* Title */}
                        <div style={{ height: '52px', width: '70%', borderRadius: '24px', background: 'var(--skeleton-bg)', margin: '0 auto' }} className="shimmer" />
                        {/* Subtitle */}
                        <div style={{ height: '16px', width: '40%', borderRadius: '8px', background: 'var(--accent-light)', margin: '0 auto' }} className="shimmer" />
                        {/* Content blocks */}
                        <div style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
                            {[1,2,3].map(i => (
                                <div key={i} style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ height: '20px', width: '100%', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                                    <div style={{ height: '20px', width: '95%', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                                    <div style={{ height: '20px', width: '80%', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                                </div>
                            ))}
                        </div>
                        {/* Large media block */}
                        <div style={{ height: '300px', borderRadius: '32px', background: 'var(--skeleton-bg)', marginTop: '24px' }} className="shimmer" />
                    </div>
                </div>

                {/* Footer skeleton */}
                <div style={{ padding: '20px 28px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
                    <div style={{ height: '24px', width: '80px', borderRadius: '12px', background: 'var(--skeleton-bg)' }} className="shimmer" />
                    <div style={{ height: '40px', width: '200px', borderRadius: '16px', background: 'var(--accent-light)' }} className="shimmer" />
                </div>
            </main>
        </div>
    );
}
