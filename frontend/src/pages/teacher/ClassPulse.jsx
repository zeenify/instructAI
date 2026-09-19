import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, ClipboardCheck, CircleDashed, PlayCircle, ChevronRight,
    BookOpen, Zap, TrendingUp,
} from 'lucide-react';
import { useMonitorStats, useMonitorStudents, useStudentProgress } from '../../queries/pulse';
import { useClassGradebook } from '../../queries/classwork';
import './ClassPulse.css';

function relTime(ts) {
    if (!ts) return null;
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return 'just now';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export default function ClassPulse({ classId, course }) {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [expandedId, setExpandedId] = useState(null);

    const { data: stats } = useMonitorStats(classId, course?.id);
    const { data: students = [], isLoading: studentsLoading } = useMonitorStudents(classId, course?.id);
    const { data: gradebook } = useClassGradebook(classId);

    // Classwork counts (to grade / missing per student) merged onto the roster —
    // the gradebook payload already knows submission status per published activity
    const classworkByStudent = useMemo(() => {
        const map = {};
        if (!gradebook) return map;
        const now = new Date();
        const published = (gradebook.activities || []).filter((a) => a.submission_type !== 'material');
        Object.entries(gradebook.grades || {}).forEach(([studentId, perActivity]) => {
            let pending = 0;
            let missing = 0;
            published.forEach((a) => {
                const g = perActivity[a.id];
                if (g?.status === 'submitted') pending += 1;
                else if (!g && a.deadline_at && new Date(a.deadline_at) < now) missing += 1;
            });
            map[Number(studentId)] = { pending, missing };
        });
        return map;
    }, [gradebook]);

    const rows = useMemo(() => {
        const now = Date.now();
        return students.map((s) => {
            const cw = classworkByStudent[s.id] || { pending: 0, missing: 0 };
            const flags = s.flags || [];
            const notStarted = flags.includes('not_started');
            const stuck = flags.includes('stuck');
            const lastActive = s.last_active ? new Date(s.last_active).getTime() : null;
            const inactive = !lastActive || now - lastActive > 7 * 24 * 60 * 60 * 1000;
            let status;
            if (notStarted) status = { label: 'Not started', cls: 'risk' };
            else if (stuck) status = { label: 'Stuck', cls: 'stuck' };
            else if (s.completion_percentage >= 100) status = { label: 'Finished', cls: 'ontrack' };
            else if (inactive || s.completion_percentage < 35) status = { label: 'At risk', cls: 'risk' };
            else status = { label: 'On track', cls: 'ontrack' };
            return { ...s, cw, notStarted, stuck, inactive, status };
        });
    }, [students, classworkByStudent]);

    const riskCount = rows.filter((r) => r.status.cls === 'risk').length;
    const missingStudents = rows.filter((r) => r.cw.missing > 0).length;
    const toGrade = rows.reduce((n, r) => n + r.cw.pending, 0);

    const visibleRows = useMemo(() => {
        let list = rows;
        if (filter === 'risk') list = list.filter((r) => r.status.cls === 'risk');
        if (filter === 'missing') list = list.filter((r) => r.cw.missing > 0);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((r) => (r.name || '').toLowerCase().includes(q));
        }
        const weight = (r) => (r.notStarted ? 0 : r.stuck ? 1 : r.inactive ? 2 : 3);
        return [...list].sort((a, b) => {
            const wa = weight(a) * 1000 + (a.completion_percentage ?? 0);
            const wb = weight(b) * 1000 + (b.completion_percentage ?? 0);
            return wa - wb;
        });
    }, [rows, filter, search]);

    const tiles = [
        toGrade > 0 && {
            key: 'tograde',
            cls: 'warn',
            icon: ClipboardCheck,
            num: toGrade,
            label: 'submissions to grade',
            onClick: () => navigate(`/dashboard/teacher/class/${classId}?tab=classwork&view=gradebook`),
        },
        missingStudents > 0 && {
            key: 'missing',
            cls: 'danger',
            icon: CircleDashed,
            num: missingStudents,
            label: 'students with missing work',
            onClick: () => { setFilter(filter === 'missing' ? 'all' : 'missing'); setExpandedId(null); },
        },
        (stats?.not_started_count ?? 0) > 0 && {
            key: 'notstarted',
            cls: 'info',
            icon: PlayCircle,
            num: stats.not_started_count,
            label: 'have not started the course',
            onClick: () => { setFilter(filter === 'risk' ? 'all' : 'risk'); setExpandedId(null); },
        },
    ].filter(Boolean);

    return (
        <div>
            {/* Header */}
            <div className="pu-head">
                <div>
                    <p className="pu-kicker">Classroom · Progress</p>
                    <h3 className="pu-title">Progress</h3>
                    <div className="pu-meta">
                        {stats && (
                            <>
                                <span><b>{stats.completion_percentage ?? 0}%</b> finished everything</span>
                                <span>·</span>
                                <span><b>{stats.average_quiz_score ?? 0}%</b> avg quiz score</span>
                                <span>·</span>
                            </>
                        )}
                        <span><b>{students.length}</b> student{students.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            {/* Attention tiles — the three questions a teacher actually asks */}
            {tiles.length > 0 ? (
                <div className="pu-tiles">
                    {tiles.map((t) => {
                        const Icon = t.icon;
                        return (
                            <button key={t.key} type="button" className={`pu-tile ${t.key === 'missing' && filter === 'missing' ? 'active-danger' : t.key === 'notstarted' && filter === 'risk' ? 'active-warn' : ''}`}
                                onClick={t.onClick}>
                                <span className={`pu-tile-icon ${t.cls}`}><Icon size={19} /></span>
                                <span>
                                    <span className="pu-tile-num" style={{ display: 'block' }}>{t.num}</span>
                                    <span className="pu-tile-label" style={{ display: 'block' }}>{t.label}</span>
                                </span>
                            </button>
                        );
                    })}
                </div>
            ) : students.length > 0 && (
                <div className="pu-tiles">
                    <div className="pu-tile" style={{ cursor: 'default' }}>
                        <span className="pu-tile-icon" style={{ color: 'var(--db-green)', borderColor: 'var(--db-green-border)', background: 'var(--db-green-soft)' }}><TrendingUp size={19} /></span>
                        <span>
                            <span className="pu-tile-num" style={{ display: 'block' }}>All clear</span>
                            <span className="pu-tile-label" style={{ display: 'block' }}>Nothing needs your attention right now</span>
                        </span>
                    </div>
                </div>
            )}

            {/* Roster */}
            <div className="pu-toolbar">
                <div className="pu-search">
                    <span className="pu-search-icon"><Search size={14} /></span>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search students..." />
                </div>
                <div className="pu-seg">
                    {[
                        { id: 'all', label: 'Everyone' },
                        { id: 'risk', label: `At risk${riskCount ? ` (${riskCount})` : ''}` },
                        { id: 'missing', label: `Missing work${missingStudents ? ` (${missingStudents})` : ''}` },
                    ].map((chip) => (
                        <button key={chip.id} type="button"
                            className={`pu-seg-btn ${filter === chip.id ? 'on' : ''}`}
                            onClick={() => { setFilter(chip.id); setExpandedId(null); }}>
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {studentsLoading ? (
                <div className="pu-rows">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="db-skeleton" style={{ height: 68, borderRadius: 14 }} />
                    ))}
                </div>
            ) : students.length === 0 ? (
                <div className="pu-empty">
                    <div className="pu-empty-icon"><TrendingUp size={24} /></div>
                    <p className="pu-empty-title">No students yet</p>
                    <p className="pu-empty-sub">Progress appears here once students join your class and start working.</p>
                </div>
            ) : (
                <div className="pu-rows">
                    {visibleRows.map((r) => {
                        const expanded = expandedId === r.id;
                        return (
                            <div key={r.id} className="pu-row">
                                <button type="button" className="pu-row-btn"
                                    onClick={() => setExpandedId(expanded ? null : r.id)}
                                    aria-expanded={expanded}>
                                    <div className="pu-row-main">
                                        <p className="pu-row-name">{r.name}</p>
                                        <div className="pu-row-sub">
                                            <span className={`pu-chip ${r.status.cls}`}>{r.status.label}</span>
                                            {r.cw.missing > 0 && <span className="pu-chip missing">{r.cw.missing} missing</span>}
                                            {r.cw.pending > 0 && <span className="pu-chip stuck">{r.cw.pending} to grade</span>}
                                            <span className={`pu-last ${r.inactive ? 'stale' : ''}`}>
                                                {r.last_active ? `active ${relTime(r.last_active)}` : 'no activity yet'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="pu-progress">
                                        <div className="pu-progress-top">
                                            <span className="pu-progress-label">Course</span>
                                            <span className="pu-progress-pct">{r.completion_percentage ?? 0}%</span>
                                        </div>
                                        <div className="pu-bar">
                                            <div className="pu-bar-fill" style={{
                                                width: '100%',
                                                transform: `scaleX(${Math.min((r.completion_percentage ?? 0) / 100, 1)})`,
                                                background: (r.completion_percentage ?? 0) >= 100 ? 'var(--db-green)' : (r.completion_percentage ?? 0) >= 35 ? 'var(--db-accent)' : 'var(--db-danger)',
                                            }} />
                                        </div>
                                    </div>
                                    <span className={`pu-caret ${expanded ? 'open' : ''}`}><ChevronRight size={16} /></span>
                                </button>
                                {expanded && <StudentDetail classId={classId} courseId={course?.id} studentId={r.id} />}
                            </div>
                        );
                    })}
                    {visibleRows.length === 0 && (
                        <div className="pu-empty" style={{ padding: '34px 30px' }}>
                            <p className="pu-empty-title" style={{ margin: 0 }}>No students match this view.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StudentDetail({ classId, courseId, studentId }) {
    const { data, isLoading } = useStudentProgress(classId, courseId, studentId);
    if (isLoading) {
        return (
            <div className="pu-detail">
                <div className="db-skeleton" style={{ height: 60, borderRadius: 10 }} />
            </div>
        );
    }
    const modules = data?.modules || [];
    return (
        <div className="pu-detail">
            {modules.length === 0 && (
                <p style={{ fontSize: 13.5, color: 'var(--db-text-3)', margin: 0 }}>No course content yet.</p>
            )}
            {modules.map((m) => (
                <div key={m.id} className="pu-module">
                    <p className="pu-module-name">{m.name}</p>
                    <div className="pu-items">
                        {[...(m.lessons || []), ...(m.quizzes || [])].map((item) => {
                            const cls = item.status === 'completed' ? 'done' : item.status === 'in_progress' ? 'wip' : 'not';
                            const label = item.status === 'completed' ? 'Done' : item.status === 'in_progress' ? 'Working' : 'Not started';
                            return (
                                <div key={`${item.type}-${item.id}`} className="pu-item">
                                    {item.type === 'quiz' ? <Zap size={13} style={{ color: 'var(--db-text-3)', flexShrink: 0 }} /> : <BookOpen size={13} style={{ color: 'var(--db-text-3)', flexShrink: 0 }} />}
                                    <span className="pu-item-name">{item.name}</span>
                                    <span className={`pu-item-state ${cls}`}>{label}</span>
                                    {item.type === 'quiz' && item.score != null && (
                                        <span className="pu-item-score">
                                            {item.score}/{item.max_score}
                                            {item.attempts > 1 ? ` · ${item.attempts} tries` : ''}
                                        </span>
                                    )}
                                    {item.type === 'lesson' && item.is_stuck && (
                                        <span className="pu-item-score" style={{ color: 'var(--db-amber)' }}>{item.code_attempts} tries, stuck</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
