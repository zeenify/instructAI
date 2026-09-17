import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    Users,
    BarChart3,
    Layers,
    ClipboardList,
    ArrowRight,
    Plus,
    Copy,
    Check,
    Calendar,
    GraduationCap,
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useClasses } from '../../context/ClassContext';
import StatCard from '../../components/ui/StatCard';
import CreateTile from '../../components/ui/CreateTile';
import ColorSwatches from '../../components/ui/ColorSwatches';
import { StatCardSkeleton, ClassCardSkeleton, SkeletonBlock } from '../../components/ui/skeletons';
import { OPEN_CREATE_CLASS } from '../../components/teacher/CreateClassModal';
import '../../styles/dashboard.css';

const DEFAULT_CLASS_COLOR = '#6d5ae0';

/**
 * Time-of-day greeting. Morning starts at 5am (4am is still night),
 * evening runs 6pm–10pm, and the late-night hours get their own line.
 */
const greetingForNow = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 18) return 'Good afternoon';
    if (h >= 18 && h < 23) return 'Good evening';
    return 'Burning the midnight oil';
};

const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
});

export default function TeacherOverview() {
    const navigate = useNavigate();
    const { user } = useAuth();
    // Classes + totals come from ClassContext (single source of truth) so the
    // cards, sidebar, and any future page update together on every change.
    const { classes, totals, loading, patchClass } = useClasses();
    const [copiedId, setCopiedId] = useState(null);

    const setColor = (cls, hex) => {
        // Optimistic: card band, avatar chip, and sidebar dot recolor instantly.
        patchClass(cls.id, { color: hex });
        api.put(`/teacher/classes/${cls.id}/color`, { color: hex }).catch(() => {
            patchClass(cls.id, { color: cls.color }); // roll back on failure
            toast.error('Could not save the class color');
        });
    };

    const copyCode = (cls) => {
        navigator.clipboard?.writeText(cls.class_code);
        setCopiedId(cls.id);
        setTimeout(() => setCopiedId((id) => (id === cls.id ? null : id)), 1500);
    };

    const profile = user?.teacher_profile;
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Teacher';
    const greeting = greetingForNow();

    return (
        <div>
            {/* Hero */}
            <div className="db-hero">
                <div className="db-hero-greeting">
                    <h1 className="db-hero-title">
                        {greeting}, {fullName}
                    </h1>
                    <p className="db-hero-sub">Here's what's happening with your classes today.</p>
                </div>
                <div className="db-hero-meta">
                    <Calendar size={15} />
                    {todayLabel}
                </div>
            </div>

            {/* Skeletons only until the first load — background refreshes never flash them */}
            {loading && classes.length === 0 ? (
                <div>
                    <div className="db-stats-grid">
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                        <SkeletonBlock style={{ width: 48, height: 48, borderRadius: '50%', flex: 'none' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <SkeletonBlock style={{ width: 160, height: 18 }} />
                            <SkeletonBlock style={{ width: 260, height: 12 }} />
                        </div>
                    </div>
                    <div className="db-class-grid">
                        <ClassCardSkeleton />
                        <ClassCardSkeleton />
                        <ClassCardSkeleton />
                    </div>
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="db-stats-grid">
                        <StatCard
                            icon={BookOpen}
                            tone="violet"
                            label="Active Classes"
                            value={totals.classes_count}
                            caption="Classes you created"
                        />
                        <StatCard
                            icon={Users}
                            tone="green"
                            label="Total Students"
                            value={totals.students_count}
                            caption="Across all classes"
                        />
                        <StatCard
                            icon={BarChart3}
                            tone="violet"
                            label="View Analytics"
                            value="Performance Metrics"
                            caption="Track course performance and completion rates"
                            onClick={() => navigate('/dashboard/teacher/analytics')}
                        />
                    </div>

                    {/* Your Classes */}
                    <div className="db-section-row">
                        <div className="db-section-title-wrap">
                            <span className="db-section-icon">
                                <Users size={21} strokeWidth={2.1} />
                            </span>
                            <div>
                                <h2 className="db-section-title">Your Classes</h2>
                                <p className="db-section-sub">Manage your classes, track progress, and create new ones.</p>
                            </div>
                        </div>
                        <button className="db-btn-primary" onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_CLASS))}>
                            <Plus size={16} />
                            Create Class
                        </button>
                    </div>

                    <div className="db-class-grid">
                        {classes.map((cls) => (
                            <div
                                key={cls.id}
                                className="db-card db-class-card db-clickable"
                                onClick={() => navigate(`/dashboard/teacher/class/${cls.id}`)}
                                role="button"
                            >
                                <div
                                    className="db-class-band"
                                    style={{ '--class-color': cls.color || DEFAULT_CLASS_COLOR }}
                                >
                                    <div className="db-band-palette">
                                        <ColorSwatches value={cls.color} onChange={(hex) => setColor(cls, hex)} />
                                    </div>
                                </div>
                                <div className="db-class-body">
                                    <div className="db-class-toprow">
                                        <div className="db-class-name-wrap">
                                            <span
                                                className="db-class-avatar"
                                                style={{ '--class-color': cls.color || DEFAULT_CLASS_COLOR }}
                                            >
                                                <GraduationCap size={22} />
                                            </span>
                                            <h3 className="db-class-name">{cls.name}</h3>
                                        </div>
                                    </div>

                                    <div className="db-code-row">
                                        Class Code:
                                        <span className="db-code-chip">{cls.class_code}</span>
                                        <button
                                            type="button"
                                            className="db-copy-btn"
                                            title="Copy class code"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyCode(cls);
                                            }}
                                        >
                                            {copiedId === cls.id ? <Check size={14} /> : <Copy size={14} />}
                                        </button>
                                    </div>

                                    <div className="db-class-stats">
                                        <div className="db-class-stat">
                                            <span className="db-class-stat-icon"><Users size={14} /></span>
                                            <b>{cls.students_count}</b>
                                            <span>Students</span>
                                        </div>
                                        <div className="db-class-stat">
                                            <span className="db-class-stat-icon"><Layers size={14} /></span>
                                            <b>{cls.modules_count}</b>
                                            <span>Modules</span>
                                        </div>
                                        <div className="db-class-stat">
                                            <span className="db-class-stat-icon"><ClipboardList size={14} /></span>
                                            <b>{cls.classwork_quizzes_count}</b>
                                            <span>Quizzes</span>
                                        </div>
                                    </div>

                                    <div className="db-class-footer">
                                        <span className="db-class-footer-date">
                                            <Calendar size={14} />
                                            Created {formatDate(cls.created_at)}
                                        </span>
                                        <span className="db-class-footer-arrow">
                                            <ArrowRight size={15} />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <CreateTile
                            title="Create New Class"
                            subtitle="Set up a new class and invite your students with a class code."
                            onClick={() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_CLASS))}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
