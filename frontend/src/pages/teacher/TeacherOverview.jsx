import { useEffect, useState } from 'react';
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
    Loader2,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useClasses } from '../../context/ClassContext';
import StatCard from '../../components/ui/StatCard';
import CreateTile from '../../components/ui/CreateTile';
import ColorSwatches from '../../components/ui/ColorSwatches';
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
    const { refreshClasses } = useClasses();
    const [data, setData] = useState({ classes: [], totals: { classes_count: 0, students_count: 0 } });
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState(null);

    useEffect(() => {
        let alive = true;
        api.get('/teacher/overview', { bypassCache: true })
            .then((res) => {
                if (!alive) return;
                setData({
                    classes: res.data.classes ?? [],
                    totals: res.data.totals ?? { classes_count: 0, students_count: 0 },
                });
            })
            .catch((err) => console.error('Failed to load overview', err))
            .finally(() => alive && setLoading(false));
        return () => {
            alive = false;
        };
    }, []);

    const setColor = async (cls, hex) => {
        // optimistic: card + sidebar dot recolor immediately
        setData((prev) => ({
            ...prev,
            classes: prev.classes.map((c) => (c.id === cls.id ? { ...c, color: hex } : c)),
        }));
        try {
            await api.put(`/teacher/classes/${cls.id}/color`, { color: hex });
            refreshClasses(); // sync the sidebar dots from ClassContext
        } catch {
            setData((prev) => ({
                ...prev,
                classes: prev.classes.map((c) => (c.id === cls.id ? { ...c, color: cls.color } : c)),
            }));
        }
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

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
                    <Loader2 size={28} className="animate-spin" style={{ color: 'var(--db-accent)' }} />
                </div>
            ) : (
                <>
                    {/* Stats */}
                    <div className="db-stats-grid">
                        <StatCard
                            icon={BookOpen}
                            tone="violet"
                            label="Active Classes"
                            value={data.totals.classes_count}
                            caption="Classes you created"
                        />
                        <StatCard
                            icon={Users}
                            tone="green"
                            label="Total Students"
                            value={data.totals.students_count}
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
                        <button className="db-btn-primary" onClick={() => navigate('/dashboard/teacher/classes/new')}>
                            <Plus size={16} />
                            Create Class
                        </button>
                    </div>

                    <div className="db-class-grid">
                        {data.classes.map((cls) => (
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
                            onClick={() => navigate('/dashboard/teacher/classes/new')}
                        />
                    </div>
                </>
            )}
        </div>
    );
}
