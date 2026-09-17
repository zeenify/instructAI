import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowRight,
    BookOpen,
    Check,
    ClipboardList,
    Copy,
    ExternalLink,
    Layers,
    Users,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';
import { useClassDetails, useCourseContent } from '../../queries/classDetails';
import Classwork from './Classwork';
import { SkeletonBlock } from '../../components/ui/skeletons';
import '../../styles/dashboard.css';

const TABS = ['content', 'students', 'classwork'];

/**
 * The class page — strict 1 class = 1 course (docs/data-layer-plan.md).
 * The first course (order_index) IS the class content; the Content tab shows
 * its modules. CourseBuilder remains the editor, entered via "Open Builder".
 */
export default function ClassDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Legacy ?tab=courses links land on the Content tab (the old grid is gone).
    const tabParam = searchParams.get('tab');
    const activeTab = TABS.includes(tabParam) ? tabParam : 'content';

    const setTab = (tab) => navigate(`/dashboard/teacher/class/${id}?tab=${tab}`, { replace: true });

    const { data: classroom, isLoading, isError } = useClassDetails(id);
    // Strict 1:1 — first course by order_index renders; legacy multi-course
    // classes simply show their first course (nothing breaks).
    const course = classroom?.courses?.[0] ?? null;
    const { data: content, isLoading: loadingContent } = useCourseContent(course?.id);

    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isError) {
            toast.error('Could not load this class');
            navigate('/dashboard/teacher', { replace: true });
        }
    }, [isError, navigate]);

    const copyCode = () => {
        if (!classroom?.class_code) return;
        navigator.clipboard?.writeText(classroom.class_code);
        setCopied(true);
        toast.success(`Class code copied: ${classroom.class_code}`);
        setTimeout(() => setCopied(false), 1600);
    };

    const openBuilder = () => {
        if (course) navigate(`/dashboard/teacher/class/${id}/course/${course.id}`);
    };

    if (isLoading || !classroom) {
        return (
            <div>
                <SkeletonBlock style={{ width: 60, height: 11, marginBottom: 12 }} />
                <div className="cd-title-row" style={{ marginBottom: 26 }}>
                    <SkeletonBlock style={{ width: 320, height: 38 }} />
                    <SkeletonBlock style={{ width: 110, height: 32, borderRadius: 9 }} />
                </div>
                <div className="cd-stat-strip">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="cd-stat" style={{ gap: 8 }}>
                            <SkeletonBlock style={{ width: 48, height: 24 }} />
                            <SkeletonBlock style={{ width: 90, height: 12 }} />
                        </div>
                    ))}
                </div>
                <div className="cd-tab-bar">
                    {[0, 1, 2].map((i) => (
                        <SkeletonBlock key={i} style={{ width: 90, height: 16, marginRight: 18 }} />
                    ))}
                </div>
                {[0, 1, 2].map((i) => (
                    <SkeletonBlock key={i} style={{ height: 64, borderRadius: 14, marginBottom: 10 }} />
                ))}
            </div>
        );
    }

    const modules = content?.modules ?? [];
    const lessonCount = modules.reduce((n, m) => n + (m.lessons?.length ?? 0), 0);
    const students = classroom.students ?? [];

    const statStrip = (
        <div className="cd-stat-strip">
            <div className="cd-stat">
                <b>{students.length}</b>
                <span>Students</span>
            </div>
            <div className="cd-stat">
                <b>{loadingContent && !content ? '—' : modules.length}</b>
                <span>Modules</span>
            </div>
            <div className="cd-stat">
                <b>{loadingContent && !content ? '—' : lessonCount}</b>
                <span>Lessons</span>
            </div>
            <div className="cd-stat">
                <b>{classroom.activities_count ?? 0}</b>
                <span>Classwork</span>
            </div>
        </div>
    );

    return (
        <div>
            {/* Header */}
            <div className="cd-header">
                <div>
                    <p className="cd-eyebrow">Class</p>
                    <div className="cd-title-row">
                        <h1 className="cd-title">{classroom.name}</h1>
                        <button type="button" className="cd-code-chip-lg" onClick={copyCode} title="Copy class code">
                            {classroom.class_code}
                            {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>
                <button className="db-btn-primary" onClick={openBuilder} disabled={!course}>
                    <BookOpen size={16} />
                    Open Builder
                </button>
            </div>

            {statStrip}

            {/* Tabs */}
            <div className="cd-tab-bar">
                <button type="button" className={`cd-tab ${activeTab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>
                    <Layers size={16} />
                    Content
                </button>
                <button type="button" className={`cd-tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>
                    <Users size={16} />
                    Students
                    <span className="cd-tab-count">{students.length}</span>
                </button>
                <button type="button" className={`cd-tab ${activeTab === 'classwork' ? 'active' : ''}`} onClick={() => setTab('classwork')}>
                    <ClipboardList size={16} />
                    Classwork
                    <span className="cd-tab-count">{classroom.activities_count ?? 0}</span>
                </button>
            </div>

            {/* CONTENT TAB */}
            {activeTab === 'content' && (
                <div>
                    {!course ? (
                        // Legacy classes created before auto-course: create their content course on demand.
                        <div className="cd-empty">
                            <BookOpen size={28} style={{ marginBottom: 6 }} />
                            <p className="cd-empty-title">No content yet</p>
                            <p>This class was created before content was automatic. Set it up in one click.</p>
                            <button
                                type="button"
                                className="db-btn-primary"
                                style={{ marginTop: 12 }}
                                onClick={async () => {
                                    try {
                                        await api.post(`/teacher/classes/${id}/courses`, { title: classroom.name });
                                        toast.success('Class content ready');
                                        window.location.reload(); // refetch class + content queries
                                    } catch {
                                        toast.error('Could not create the class content');
                                    }
                                }}
                            >
                                Set up class content
                            </button>
                        </div>
                    ) : modules.length === 0 ? (
                        <div className="cd-empty">
                            <Layers size={28} style={{ marginBottom: 6 }} />
                            <p className="cd-empty-title">No modules yet</p>
                            <p>Open the Builder to add your first module — or generate a whole course with AI.</p>
                            <button type="button" className="db-btn-primary" style={{ marginTop: 12 }} onClick={openBuilder}>
                                <BookOpen size={16} />
                                Open Builder
                            </button>
                        </div>
                    ) : (
                        <>
                            {modules.map((mod, i) => (
                                <button
                                    key={mod.id}
                                    type="button"
                                    className="db-card cd-module-row db-clickable"
                                    onClick={openBuilder}
                                >
                                    <span className="cd-module-index">{String(i + 1).padStart(2, '0')}</span>
                                    <h3 className="cd-module-name">{mod.title}</h3>
                                    <div className="cd-module-meta">
                                        <span className="cd-chip">{mod.lessons?.length ?? 0} Lessons</span>
                                        <span className="cd-chip">{mod.quizzes?.length ?? 0} Quizzes</span>
                                        <span className={`cd-chip ${mod.is_published ? 'published' : 'draft'}`}>
                                            {mod.is_published ? 'Published' : 'Draft'}
                                        </span>
                                        <span className="db-class-footer-arrow">
                                            <ArrowRight size={15} />
                                        </span>
                                    </div>
                                </button>
                            ))}
                            <p style={{ fontSize: 13, color: 'var(--db-text-3)', margin: '14px 0 0' }}>
                                Reorder, edit lessons, and generate with AI inside the Builder.
                            </p>
                        </>
                    )}
                </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
                <div>
                    {students.length === 0 ? (
                        <div className="cd-empty">
                            <Users size={28} style={{ marginBottom: 6 }} />
                            <p className="cd-empty-title">No students yet</p>
                            <p>Share the class code {classroom.class_code} — students join with it.</p>
                        </div>
                    ) : (
                        students.map((s) => (
                            <div key={s.id} className="db-card cd-student-row">
                                <img
                                    src={s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.studentProfile?.first_name ?? s.email)}`}
                                    alt=""
                                />
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p className="cd-student-name">
                                        {s.studentProfile
                                            ? `${s.studentProfile.first_name} ${s.studentProfile.last_name}`
                                            : s.email}
                                    </p>
                                    <p className="cd-student-email">{s.email}</p>
                                </div>
                                {s.studentProfile?.lrn_number && (
                                    <span className="cd-chip">LRN {s.studentProfile.lrn_number}</span>
                                )}
                                <ExternalLink size={15} style={{ color: 'var(--db-text-3)', flex: 'none' }} />
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* CLASSWORK TAB */}
            {activeTab === 'classwork' && <Classwork classId={id} />}
        </div>
    );
}
