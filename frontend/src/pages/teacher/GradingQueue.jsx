import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useGradingQueue } from '../../queries/grading';
import './GradingQueue.css';

export default function GradingQueue() {
    const navigate = useNavigate();
    const { data: queue = [], isLoading } = useGradingQueue();

    // One card per activity, newest submissions first inside
    const groups = useMemo(() => {
        const map = new Map();
        queue.forEach((s) => {
            const key = s.activity?.id;
            if (!map.has(key)) {
                map.set(key, {
                    activity: s.activity,
                    class_name: s.class_name,
                    submissions: [],
                });
            }
            map.get(key).submissions.push(s);
        });
        return [...map.values()];
    }, [queue]);

    return (
        <div className="ed-shell" style={{ paddingBottom: 90 }}>
            {/* Header */}
            <div className="ag-header" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div>
                        <p className="pu-kicker" style={{ margin: '0 0 6px' }}>Management · To grade</p>
                        <h1 className="pu-title">To grade</h1>
                        <p className="ag-meta">
                            {queue.length > 0
                                ? <><b>{queue.length}</b> submission{queue.length !== 1 ? 's' : ''} waiting across <b>{groups.length}</b> activit{groups.length !== 1 ? 'ies' : 'y'}</>
                                : 'Everything graded'}
                        </p>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="db-skeleton" style={{ height: 120, borderRadius: 16 }} />
                    <div className="db-skeleton" style={{ height: 120, borderRadius: 16 }} />
                </div>
            ) : groups.length === 0 ? (
                <div className="gb-empty">
                    <div className="gb-empty-icon" style={{ color: 'var(--db-green)', borderColor: 'var(--db-green-border)', background: 'var(--db-green-soft)' }}>
                        <CheckCircle2 size={24} />
                    </div>
                    <p className="gb-empty-title">You're all caught up</p>
                    <p className="gb-empty-sub">
                        Submissions appear here the moment a student turns work in —
                        across every class you teach.
                    </p>
                </div>
            ) : (
                <div className="gq-groups">
                    {groups.map((g) => (
                        <div key={g.activity.id} className="ag-panel">
                            <div className="gq-head">
                                <div style={{ minWidth: 0 }}>
                                    <div className="ag-kicker-row" style={{ marginBottom: 5 }}>
                                        <span className="ag-badge">{g.class_name}</span>
                                        <span className="pu-chip stuck">{g.submissions.length} waiting</span>
                                    </div>
                                    <h3 className="gq-title">{g.activity.title}</h3>
                                </div>
                                <button className="db-btn-primary" type="button"
                                    onClick={() => navigate(`/dashboard/teacher/class/${g.activity.class_id}/activity/${g.activity.id}/submissions`)}>
                                    <ClipboardCheck size={15} /> Grade
                                </button>
                            </div>
                            <div className="gq-students">
                                {g.submissions.map((s) => (
                                    <button key={s.id} type="button" className="gq-student"
                                        onClick={() => navigate(`/dashboard/teacher/class/${g.activity.class_id}/activity/${g.activity.id}/submissions`)}>
                                        <span className="gb-avatar-fallback" style={{ width: 30, height: 30, fontSize: 11.5 }}>
                                            {s.student_name?.charAt(0).toUpperCase() || '?'}
                                        </span>
                                        <span className="gq-student-name">{s.student_name}</span>
                                        {s.is_late ? <span className="pu-chip missing">Late</span> : null}
                                        <span className="gq-when">
                                            {s.submitted_at ? format(new Date(s.submitted_at), 'MMM d, h:mm a') : ''}
                                        </span>
                                        <ChevronRight size={14} style={{ color: 'var(--db-text-3)' }} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
