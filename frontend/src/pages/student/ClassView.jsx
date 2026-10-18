import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Check, ChevronRight, ClipboardList, Layers, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import StudentActivityCard from '../../components/student/StudentActivityCard';
import { deriveState as activityCardState } from '../../utils/activityState';
import { useStudentClass, useStudentActivities } from '../../queries/student';
import { SkeletonBlock } from '../../components/ui/skeletons';
import '../../styles/dashboard.css';

const TABS = ['modules', 'classwork'];

/**
 * Student class page — strict 1 class = 1 course (docs/data-layer-plan.md).
 * The class page IS the content: modules and lessons render directly (no
 * course-picker hop). Tapping a lesson/quiz opens the focus-mode viewer.
 */
export default function ClassView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const tabParam = searchParams.get('tab');
    const activeTab = TABS.includes(tabParam) ? tabParam : 'modules'; // legacy ?tab=courses lands here
    const setTab = (tab) => setSearchParams({ tab }, { replace: true });

    const { data: classroom, isLoading, isError } = useStudentClass(id);
    const { data: activities = [], isLoading: activitiesLoading } = useStudentActivities(
        id,
        { poll: activeTab === 'classwork' },
    );

    useEffect(() => {
        if (isError) {
            toast.error('Could not load this class');
            navigate('/dashboard/student', { replace: true });
        }
    }, [isError, navigate]);

    // Mark items as seen: NEW dots only show what appeared since the last visit
    useEffect(() => {
        if (classroom) {
            const t = setTimeout(() => localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString()), 4000);
            return () => clearTimeout(t);
        }
    }, [classroom, id]);

    if (isLoading || !classroom) {
        return (
            <div>
                <div className="sv-class-head">
                    <SkeletonBlock style={{ width: 52, height: 12, marginBottom: 12 }} />
                    <SkeletonBlock style={{ width: 340, height: 42, borderRadius: 12 }} />
                    <SkeletonBlock style={{ width: 420, height: 14, marginTop: 14 }} />
                </div>
                <div className="sv-seg" style={{ marginBottom: 22 }}>
                    <SkeletonBlock style={{ width: 92, height: 15 }} />
                </div>
                <ContentSkeleton />
            </div>
        );
    }

    // Strict 1:1 — the class's single published course IS the content
    const course = classroom.courses?.[0] ?? null;
    const modules = course?.modules ?? [];

    // Due-soon strip: upcoming classwork deadlines (existing activities data)
    const now = Date.now();
    const dueSoon = activities
        .filter(a => a.deadline_at && new Date(a.deadline_at).getTime() > now && a.deadline_behavior !== 'close_room')
        .sort((a, b) => new Date(a.deadline_at) - new Date(b.deadline_at))
        .slice(0, 3);

    // NEW dots: items posted since the student's last visit to this class
    const LAST_VISIT_KEY = `sv:lastVisit:${id}`;
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const isNew = (createdAt) => lastVisit && createdAt && new Date(createdAt) > new Date(lastVisit);

    const teacherName = classroom.teacher?.teacher_profile
        ? `${classroom.teacher.teacher_profile.first_name} ${classroom.teacher.teacher_profile.last_name}`
        : 'Your teacher';

    return (
        <div>
            {/* Class head — large title on canvas, not boxed in a card */}
            <div className="sv-class-head">
                <p className="sv-eyebrow">Class</p>
                <h1 className="sv-title">{classroom.name}</h1>
                <p className="sv-desc">{classroom.description || `Welcome to ${teacherName}'s digital classroom.`}</p>
                <div className="sv-teacher-row">
                    {classroom.teacher?.avatar ? (
                        <img src={classroom.teacher.avatar} alt="" className="db-profile-avatar" style={{ width: 28, height: 28 }} />
                    ) : (
                        <span className="sv-teacher-avatar">
                            {classroom.teacher?.teacher_profile?.first_name?.charAt(0) || 'T'}
                        </span>
                    )}
                    <span className="sv-teacher-name">{teacherName}</span>
                    <span className="sv-teacher-role">Teacher</span>
                </div>
            </div>

            {/* Segmented control — Modules | Classwork */}
            <div className="sv-seg">
                <button type="button" className={`sv-seg-btn ${activeTab === 'modules' ? 'on' : ''}`} onClick={() => setTab('modules')}>
                    <Layers size={16} />
                    Modules
                </button>
                <button type="button" className={`sv-seg-btn ${activeTab === 'classwork' ? 'on' : ''}`} onClick={() => setTab('classwork')}>
                    <ClipboardList size={16} />
                    Classwork
                    <span className="sv-seg-count">{activitiesLoading ? '…' : activities.length}</span>
                </button>
            </div>

            {/* MODULES TAB — the single course's content, no course-picker hop */}
            {activeTab === 'modules' && (
                !course || modules.length === 0 ? (
                    <div className="cd-empty">
                        <BookOpen size={28} style={{ marginBottom: 6 }} />
                        <p className="cd-empty-title">No lessons yet</p>
                        <p>Your teacher hasn't published any modules yet. Check back soon — or switch to Classwork.</p>
                    </div>
                ) : (
                    <>
                        <div className="sv-progress-row">
                            <div className="sv-progress-info">
                                <span className="sv-progress-title">Your progress</span>
                                <span className="sv-progress-caption">{modules.length} {modules.length === 1 ? 'module' : 'modules'} · finish lessons and quizzes to grow this bar</span>
                            </div>
                            <div className="sv-progress-num-wrap">
                                <span className="sv-progress-num">{course.progress_percent || 0}%</span>
                                <span className="sv-progress-word">Done</span>
                            </div>
                        </div>
                        <div className="sv-progress-track">
                            <motion.span
                                initial={{ width: 0 }}
                                animate={{ width: `${course.progress_percent || 0}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </div>

                        {dueSoon.length > 0 && (
                            <div className="sv-due-strip">
                                <span className="sv-due-label">Due soon</span>
                                {dueSoon.map(a => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        className="sv-due-chip"
                                        onClick={() => navigate(`/dashboard/student/class/${id}/activity/${a.id}`)}
                                        title={a.description || a.title}
                                    >
                                        {a.title}
                                        <b>{new Date(a.deadline_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</b>
                                    </button>
                                ))}
                            </div>
                        )}

                        {modules.map((mod, mi) => (
                            <div key={mod.id} className="sv-group">
                                <div className="sv-group-head">
                                    <span className="sv-group-index">{String(mi + 1).padStart(2, '0')}</span>
                                    <h3 className="sv-group-title">{mod.title}</h3>
                                </div>
                                <div className="sv-group-list">
                                    {[...(mod.lessons || []).map(l => ({ ...l, kind: 'lesson' })), ...(mod.quizzes || []).map(q => ({ ...q, kind: 'quiz' }))]
                                        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
                                        .map((item) => (
                                            <button
                                                key={`${item.kind}-${item.id}`}
                                                type="button"
                                                className="sv-row"
                                                onClick={() => navigate(`/dashboard/student/course/${course.id}/${item.kind}/${item.id}`)}
                                            >
                                                <span className={`sv-row-icon ${item.kind}`}>
                                                    {item.kind === 'lesson' ? <BookOpen size={16} /> : <ClipboardList size={16} />}
                                                </span>
                                                <span className="sv-row-title">
                                                    {item.title}
                                                    {isNew(item.created_at) && <span className="sv-new-dot" title="New" />}
                                                </span>
                                                {item.kind === 'lesson' && (
                                                    <span className="sv-row-meta">
                                                        ~{Math.max(5, Math.round((item.content?.length || 0) * 0.75))} min
                                                    </span>
                                                )}
                                                {item.kind === 'lesson' && item.is_completed && (
                                                    <span className="sv-row-done"><Check size={13} /> Done</span>
                                                )}
                                                <ChevronRight size={15} className="sv-row-chevron" />
                                            </button>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </>
                )
            )}

            {/* CLASSWORK TAB — status-first grouped activities */}
            {activeTab === 'classwork' && (
                activitiesLoading ? (
                    <ContentSkeleton rows={4} flat />
                ) : activities.length === 0 ? (
                    <div className="cd-empty">
                        <ClipboardList size={28} style={{ marginBottom: 6 }} />
                        <p className="cd-empty-title">No activities yet</p>
                        <p>Your teacher hasn't posted any activities yet.</p>
                    </div>
                ) : (
                    <div>
                        {activities.some(a => a.is_live) && (
                            <div className="sv-live-banner">
                                <span className="sv-live-dot" />
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 15, fontWeight: 800, color: '#ef4444', margin: 0 }}>Quiz in progress</p>
                                    <p style={{ fontSize: 12, color: 'var(--db-text-2)', margin: '4px 0 0 0' }}>
                                        {activities.filter(a => a.is_live).map(a => a.title).join(', ')} — tap "Join now" to start.
                                    </p>
                                </div>
                                <Radio size={20} color="#ef4444" style={{ flexShrink: 0 }} />
                            </div>
                        )}

                        {(() => {
                            const buckets = { live: [], todo: [], done: [], missed: [] };
                            activities.forEach((a) => {
                                const st = activityCardState(a);
                                if (st === 'live' || st === 'in_progress') buckets.live.push(a);
                                else if (st === 'waiting' || st === 'todo') buckets.todo.push(a);
                                else if (st === 'graded' || st === 'submitted') buckets.done.push(a);
                                else buckets.missed.push(a);
                            });
                            const sectionMeta = {
                                live: { title: 'Live now' },
                                todo: { title: 'To do' },
                                done: { title: 'Completed' },
                                missed: { title: 'Missed' },
                            };
                            const renderSection = (key, list) => {
                                if (!list.length) return null;
                                return (
                                    <div key={key} style={{ marginBottom: 30 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                            {key === 'live' && <span className="sv-live-dot" style={{ width: 9, height: 9 }} />}
                                            <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0, color: key === 'live' || key === 'missed' ? 'var(--db-danger)' : 'var(--db-text-2)', margin: 0 }}>{sectionMeta[key].title}</h3>
                                            <span className="cd-tab-count">{list.length}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {list.map(activity => (
                                                <StudentActivityCard key={activity.id} activity={activity} classId={id} />
                                            ))}
                                        </div>
                                    </div>
                                );
                            };
                            return (
                                <>
                                    {renderSection('live', buckets.live)}
                                    {renderSection('todo', buckets.todo)}
                                    {renderSection('done', buckets.done)}
                                    {renderSection('missed', buckets.missed)}
                                </>
                            );
                        })()}
                    </div>
                )
            )}
        </div>
    );
}

/** Mirrors the lessons tab: progress row + module sections with lesson rows. */
function ContentSkeleton({ rows = 2, flat = false }) {
    return (
        <>
            {!flat && (
                <>
                    <SkeletonBlock style={{ height: 46, borderRadius: 14, marginBottom: 16 }} />
                    <SkeletonBlock style={{ height: 8, borderRadius: 999, marginBottom: 24, width: '60%' }} />
                </>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {Array.from({ length: rows }).map((_, m) => (
                    <div key={m}>
                        <SkeletonBlock style={{ width: 200, height: 18, marginBottom: 12 }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[0, 1].map((i) => (
                                <SkeletonBlock key={i} style={{ height: 58, borderRadius: 14 }} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
