import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Trash2, Eye, EyeOff, Users, Clock, Upload, HelpCircle, BookOpen, Zap,
    Radio, BarChart3, Play, Timer, Copy, Loader2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../services/api';
import { classActivitiesKey } from '../../queries/classwork';

const typeStyles = {
    quiz: { icon: Zap, label: 'Quiz', tint: 'var(--db-amber)' },
    file: { icon: Upload, label: 'Assignment', tint: 'var(--db-accent-bright)' },
    questions: { icon: HelpCircle, label: 'Q&A', tint: 'var(--db-accent-bright)' },
    material: { icon: BookOpen, label: 'Material', tint: 'var(--db-green)' },
};

// One canonical state per card — the pill, the actions, and the grouping
// all derive from this so a card can never show contradictory states.
function quizState(a) {
    if (!a.is_published) return 'draft';
    if (a.is_live && a.live_status === 'paused') return 'paused';
    if (a.is_live) return 'live';
    if (a.close_room_at || a.live_status === 'completed') return 'closed';
    return 'ready';
}

function activityState(a) {
    if (!a.is_published) return 'draft';
    if (a.deadline_at && new Date(a.deadline_at) < new Date()) return 'closed';
    return 'ready';
}

const stateLabels = {
    draft: { label: 'Draft', cls: 'draft' },
    ready: { label: 'Ready', cls: 'ready' },
    live: { label: 'Live', cls: 'live', pulse: true },
    paused: { label: 'Paused', cls: 'paused' },
    closed: { label: 'Closed', cls: 'closed' },
};

function timerSummary(a) {
    if (a.activity_type !== 'quiz') return null;
    // pacing is already on the type chip — only show timer facts here
    if (a.timer_mode === 'entire_quiz' && a.time_limit_minutes) return `${a.time_limit_minutes} min`;
    if (a.timer_mode === 'per_question') return 'Per-question timer';
    return null;
}

export default function ActivityCard({ activity, classId, onDelete }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [repostOpen, setRepostOpen] = useState(false);
    const [classes, setClasses] = useState(null);
    const [repostingTo, setRepostingTo] = useState(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: classActivitiesKey(classId) });
    };

    const typeKey = activity.activity_type === 'quiz' ? 'quiz' : activity.submission_type || 'file';
    const style = typeStyles[typeKey] || typeStyles.file;
    const TypeIcon = style.icon;

    const isQuiz = activity.activity_type === 'quiz';
    const state = isQuiz ? quizState(activity) : activityState(activity);
    const stateInfo = stateLabels[state] || stateLabels.draft;

    const typeLabel = isQuiz
        ? `Quiz · ${activity.pacing_mode === 'teacher' ? 'Teacher-paced' : 'Student-paced'}`
        : style.label;

    const deadlineInfo = (() => {
        if (isQuiz || !activity.deadline_at) return null;
        const deadline = new Date(activity.deadline_at);
        const passed = deadline < new Date();
        const soon = !passed && deadline - new Date() < 3 * 24 * 60 * 60 * 1000;
        return {
            text: `${passed ? 'Was due' : 'Due'} ${format(deadline, 'MMM d, h:mm a')}`,
            cls: passed ? 'due-past' : soon ? 'due-soon' : '',
        };
    })();

    const withBusy = async (fn, errText) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
        } catch (err) {
            toast.error(err.response?.data?.message || errText);
        } finally {
            setBusy(false);
        }
    };

    const handleTogglePublish = (e) => {
        e.stopPropagation();
        withBusy(async () => {
            const res = await api.post(`/teacher/activities/${activity.id}/publish`);
            refresh();
            if (res.data.is_published) {
                toast.success('Published — students can now see it');
            } else {
                toast.warning('Unpublished');
            }
        }, 'Failed to toggle publish status');
    };

    const handleGoLive = (e) => {
        e.stopPropagation();
        withBusy(async () => {
            await api.post(`/teacher/activities/${activity.id}/start-live`);
            refresh();
            toast.success('Quiz room is live — students can join now');
            navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
        }, 'Could not start the quiz room');
    };

    const handleResume = (e) => {
        e.stopPropagation();
        withBusy(async () => {
            await api.post(`/teacher/activities/${activity.id}/resume-live`);
            refresh();
            toast.success('Quiz resumed');
            navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
        }, 'Could not resume the quiz');
    };

    const openRepost = async (e) => {
        e.stopPropagation();
        setRepostOpen(true);
        setClasses(null);
        try {
            const res = await api.get('/teacher/classes', { bypassCache: true });
            setClasses(res.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Could not load your classes');
            setRepostOpen(false);
        }
    };

    const handleRepost = (targetClassId, targetClassName) => {
        if (repostingTo) return;
        setRepostingTo(targetClassId);
        withBusy(async () => {
            const res = await api.post(`/teacher/activities/${activity.id}/repost`, {
                class_id: targetClassId,
            });
            queryClient.invalidateQueries({ queryKey: classActivitiesKey(targetClassId) });
            refresh();
            toast.success(res.data?.message || `Posted to ${targetClassName}`);
            setRepostOpen(false);
        }, 'Could not post it to that class').finally(() => setRepostingTo(null));
    };

    const goMonitor = (e) => {
        e.stopPropagation();
        navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
    };

    const goResults = (e) => {
        e.stopPropagation();
        navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/results`);
    };

    const primaryAction = (() => {
        if (!isQuiz) {
            if ((activity.questions_count || 0) > 0) {
                return (
                    <button className="cw-btn-mini" onClick={goResults} type="button" title="Open results analysis">
                        <BarChart3 size={12} /> Results
                    </button>
                );
            }
            return null;
        }
        if (state === 'ready') {
            return (
                <button className="cw-btn-live" onClick={handleGoLive} type="button"
                    title="Start the live room — students join immediately">
                    <Play size={12} /> Start live
                </button>
            );
        }
        if (state === 'live') {
            return (
                <button className="cw-btn-live" onClick={goMonitor} type="button" title="Open the live monitor">
                    <Radio size={12} /> Monitor
                </button>
            );
        }
        if (state === 'paused') {
            return (
                <button className="cw-btn-mini" onClick={handleResume} type="button" title="Resume the quiz">
                    <Play size={12} /> Resume
                </button>
            );
        }
        if (state === 'closed' && (activity.questions_count || 0) > 0) {
            return (
                <button className="cw-btn-mini go" onClick={goResults} type="button" title="Open results analysis">
                    <BarChart3 size={12} /> Results
                </button>
            );
        }
        return null;
    })();

    return (
        <>
            <div
                className={`cw-card ${state === 'live' ? 'is-live' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}`)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.currentTarget.contains(document.activeElement)) {
                        navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}`);
                    }
                }}
            >
                {/* Type + state: one row, no badge soup */}
                <div className="cw-card-top">
                    <span className="cw-type">
                        <TypeIcon size={12} style={{ color: style.tint }} />
                        {typeLabel}
                    </span>
                    <span className={`cw-state ${stateInfo.cls}`}>
                        <span className={`cw-state-dot ${stateInfo.pulse ? 'pulse' : ''}`} />
                        {stateInfo.label}
                    </span>
                </div>

                <h4 className="cw-card-title">{activity.title}</h4>
                {activity.description && <p className="cw-card-desc">{activity.description}</p>}

                {/* Metadata row */}
                <div className="cw-card-meta">
                    {(activity.questions_count || 0) > 0 && (
                        <span className="cw-card-meta-item">
                            {activity.questions_count} Q{activity.questions_count !== 1 ? 's' : ''}
                        </span>
                    )}
                    {activity.submissions_count !== undefined && (
                        <span className="cw-card-meta-item">
                            <Users size={12} />
                            {isQuiz
                                ? `${activity.submissions_count}/${activity.enrolled_count ?? '—'} submitted`
                                : `${activity.submissions_count} submitted`}
                        </span>
                    )}
                    {timerSummary(activity) && (
                        <span className="cw-card-meta-item"><Timer size={12} /> {timerSummary(activity)}</span>
                    )}
                    {deadlineInfo && (
                        <span className={`cw-card-meta-item ${deadlineInfo.cls}`}>
                            <Clock size={12} /> {deadlineInfo.text}
                        </span>
                    )}

                    <div className="cw-card-actions">
                        {primaryAction}
                        <button className="cw-icon-btn" onClick={openRepost} type="button" title="Post to another class">
                            <Copy size={14} />
                        </button>
                        {state !== 'closed' && (
                            <button
                                className={`cw-icon-btn ${activity.is_published ? 'on' : ''}`}
                                onClick={handleTogglePublish}
                                type="button"
                                title={activity.is_published ? 'Unpublish' : 'Publish'}
                            >
                                {activity.is_published ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        )}
                        <button className="cw-icon-btn danger"
                            onClick={(e) => { e.stopPropagation(); onDelete(activity); }}
                            type="button" title="Delete activity">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Post-to-another-class modal */}
            {repostOpen && (
                <div className="db-modal-backdrop" style={{ zIndex: 1000 }} onClick={() => setRepostOpen(false)}>
                    <div className="db-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 460px)' }}>
                        <button className="db-modal-close" onClick={() => setRepostOpen(false)} type="button">
                            <X size={17} />
                        </button>
                        <div className="db-modal-head">
                            <h3 className="db-modal-title" style={{ fontSize: 23 }}>
                                <Copy size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--db-accent-bright)' }} />
                                Post to another class
                            </h3>
                            <p className="db-modal-sub" style={{ fontSize: 14.5 }}>
                                “{activity.title}” will be copied into the class you pick as a draft —
                                questions, settings and points included. Publish it there when you're ready.
                            </p>
                        </div>
                        <div className="cw-repost-list">
                            {classes === null ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '26px 0', color: 'var(--db-text-3)' }}>
                                    <Loader2 size={20} className="animate-spin" />
                                </div>
                            ) : classes.filter((c) => c.id !== Number(classId)).length === 0 ? (
                                <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--db-text-3)', padding: '22px 8px', margin: 0 }}>
                                    No other classes yet — create another class first.
                                </p>
                            ) : (
                                classes.filter((c) => c.id !== Number(classId)).map((c) => (
                                    <button key={c.id} className="cw-repost-item"
                                        onClick={() => handleRepost(c.id, c.name)}
                                        disabled={repostingTo !== null} type="button">
                                        <span>
                                            <span className="cw-repost-name">{c.name}</span>
                                            <span className="cw-repost-sub">
                                                {c.students_count ?? 0} student{(c.students_count ?? 0) !== 1 ? 's' : ''}
                                            </span>
                                        </span>
                                        {repostingTo === c.id ? (
                                            <Loader2 size={16} className="animate-spin" color="var(--db-accent-bright)" />
                                        ) : (
                                            <Copy size={15} color="var(--db-text-3)" />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
