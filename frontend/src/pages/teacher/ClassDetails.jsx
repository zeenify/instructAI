import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    BookOpen,
    Check,
    ClipboardList,
    Copy,
    ExternalLink,
    Layers,
    Users } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';
import { useClassDetails } from '../../queries/classDetails';
import Classwork from './Classwork';
import CourseBuilder from './CourseBuilder';
import CopyClassModal from './CopyClassModal';
import { SkeletonBlock } from '../../components/ui/skeletons';
import '../../styles/dashboard.css';

const TABS = ['content', 'students', 'classwork'];

/** Mirrors the embedded builder: toolbar row + module card grid. */
function ContentTabSkeleton() {
    return (
        <>
            <SkeletonBlock style={{ height: 46, borderRadius: 14, marginBottom: 22 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                {[0, 1, 2].map((i) => (
                    <SkeletonBlock key={i} style={{ height: 168, borderRadius: 16 }} />
                ))}
            </div>
        </>
    );
}

/**
 * The class page — strict 1 class = 1 course (docs/data-layer-plan.md).
 * The first course (order_index) IS the class content; the Content tab shows
 * its modules. CourseBuilder remains the editor, entered via "Open Builder".
 */
export default function ClassDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Legacy ?tab=courses links land on the Content tab (the old grid is gone).
    const tabParam = searchParams.get('tab');
    const activeTab = TABS.includes(tabParam) ? tabParam : 'content';

    // Progress moved to the sidebar (Management · Progress) — old deep links
    // follow it there, scoped to this class
    useEffect(() => {
        if (tabParam === 'progress') {
            navigate(`/dashboard/teacher/progress?class=${id}`, { replace: true });
        }
    }, [tabParam, id, navigate]);

    const setTab = (tab) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', tab);
        setSearchParams(next, { replace: true });
    };

    // The open module lives in the URL (?module=ID) so refresh, browser Back,
    // and shared links land back inside the module — not the grid. Only plain
    // positive integers are accepted: anything else ('abc', '12x', '-1',
    // '1e5') is ignored outright, and a well-formed id that isn't one of THIS
    // class's modules self-cleans in the builder (the payload is server-scoped
    // to the logged-in teacher, so foreign ids can never render).
    const rawModule = searchParams.get('module');
    const openModuleId = rawModule !== null && /^\d+$/.test(rawModule) ? Number(rawModule) : null;
    const setOpenModule = (moduleId) => {
        const next = new URLSearchParams(searchParams);
        if (moduleId) {
            next.set('module', String(moduleId));
            next.set('tab', 'content');
        } else {
            next.delete('module');
        }
        // push (not replace): browser Back then returns to the module grid
        setSearchParams(next);
    };

    const { data: classroom, isLoading, isError } = useClassDetails(id);
    // Strict 1:1 — first course by order_index IS the class content, shipped
    // (with modules, lessons, quizzes) inside the class payload: one query,
    // no serial waterfall. Legacy multi-course classes show their first.
    const course = classroom?.courses?.[0] ?? null;
    const content = course ?? null;

    const [copied, setCopied] = useState(false);
    const [copyModalOpen, setCopyModalOpen] = useState(false);

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

    if (isLoading || !classroom) {
        return (
            <div>
                <div className="cd-hero">
                    <SkeletonBlock style={{ width: 52, height: 11, marginBottom: 12 }} />
                    <div className="cd-title-row">
                        <SkeletonBlock style={{ width: 340, height: 40, borderRadius: 12 }} />
                        <SkeletonBlock style={{ width: 118, height: 36, borderRadius: 10 }} />
                    </div>
                    <SkeletonBlock style={{ width: 280, height: 14, marginTop: 14 }} />
                </div>
                <div className="cd-tab-bar" style={{ marginBottom: 22 }}>
                    <SkeletonBlock style={{ width: 92, height: 15 }} />
                </div>
                <ContentTabSkeleton />
            </div>
        );
    }

    const modules = content?.modules ?? [];
    const students = classroom.students ?? [];

    const toGrade = classroom.to_grade_count ?? 0;

    return (
        <div>
            {/* Header — hero card tinted with the class color */}
            <div className="cd-hero" style={{ '--class-color': classroom.color || '#0a84ff' }}>
                <p className="cd-eyebrow">Class</p>
                <div className="cd-title-row">
                    <h1 className="cd-title">{classroom.name}</h1>
                    <button type="button" className="cd-code-chip-lg" onClick={copyCode} title="Copy class code — share it with students so they can join">
                        <span className="cd-code-chip-hint">Copy</span>
                        {classroom.class_code}
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                        type="button"
                        className="cc-hero-btn"
                        onClick={() => setCopyModalOpen(true)}
                        title="Copy content (modules, lessons, quizzes) from one of your other classes"
                    >
                        <Copy size={14} />
                        Copy content
                    </button>
                </div>
                {/* One quiet line instead of four cards — "to grade" only
                    speaks up when there is something waiting */}
                <p className="cd-hero-stats">
                    <span>{students.length} students</span>
                    <span className="cd-hero-stats-dot">&middot;</span>
                    <span>{modules.length} modules</span>
                    <span className="cd-hero-stats-dot">&middot;</span>
                    <span>{classroom.activities_count ?? 0} classwork</span>
                    {toGrade > 0 && (
                        <>
                            <span className="cd-hero-stats-dot">&middot;</span>
                            <button type="button" className="cd-hero-stats-grade" style={{
                                background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
                                font: 'inherit', color: 'inherit',
                            }} onClick={() => navigate('/dashboard/teacher/grading')}
                                title="Open the grading inbox">
                                {toGrade} to grade
                            </button>
                        </>
                    )}
                </p>
            </div>

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

            {/* CONTENT TAB — the embedded builder IS the management surface */}
            {activeTab === 'content' && (
                <>
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
                    ) : (
                        /* key: builder state (modules, expanded module, modes) is
                           per-course — never leak across class switches */
                        <CourseBuilder
                            key={course.id}
                            courseId={course.id}
                            embedded
                            initialCourse={content}
                            openModuleId={openModuleId}
                            onOpenModule={setOpenModule}
                        />
                    )}
                </>
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
                        students.map((s) => {
                            const profileName = s.studentProfile
                                ? [s.studentProfile.first_name, s.studentProfile.last_name].filter(Boolean).join(' ')
                                : '';
                            const displayName = profileName || s.email;
                            return (
                                <div key={s.id} className="db-card cd-student-row">
                                    <img
                                        src={s.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`}
                                        alt=""
                                    />
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <p className="cd-student-name">{displayName}</p>
                                        {profileName && <p className="cd-student-email">{s.email}</p>}
                                    </div>
                                    {s.studentProfile?.lrn_number && (
                                        <span className="cd-chip">LRN {s.studentProfile.lrn_number}</span>
                                    )}
                                    <ExternalLink size={15} style={{ color: 'var(--db-text-3)', flex: 'none' }} />
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* CLASSWORK TAB */}
            {activeTab === 'classwork' && <Classwork classId={id} />}

            {/* COPY CONTENT FROM ANOTHER CLASS */}
            {copyModalOpen && (
                <CopyClassModal classId={id} courseId={course?.id} onClose={() => setCopyModalOpen(false)} />
            )}
        </div>
    );
}
