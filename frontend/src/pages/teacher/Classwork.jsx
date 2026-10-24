import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Radio, Play, DraftingCompass, BookOpen, TrendingUp, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { useClassActivities, useClassGradebook, useDeleteActivity } from '../../queries/classwork';
import ActivityCard from '../../components/teacher/ActivityCard';
import CreateActivityModal from './CreateActivityModal';
import DeleteModal from '../../components/ui/DeleteModal';
import Gradebook from '../../components/teacher/Gradebook';
import './Classwork.css';

// Drafts lead: a newly created activity lands there, and that's the group the
// teacher is looking for right after creating something.
const GROUP_ORDER = ['draft', 'live', 'reopened', 'open', 'material', 'closed'];

function groupActivities(activities) {
    const groups = { live: [], reopened: [], open: [], material: [], draft: [], closed: [] };

    activities.forEach((a) => {
        if (!a.is_published) {
            groups.draft.push(a);
            return;
        }
        // Materials are reference reading — their own section, never in the
        // task lifecycles (they have no deadline and never close).
        if (a.activity_type !== 'quiz' && a.submission_type === 'material') {
            groups.material.push(a);
            return;
        }
        if (a.activity_type === 'quiz') {
            if (a.is_live && a.close_room_at) {
                groups.reopened.push(a);
            } else if (a.is_live) {
                groups.live.push(a);
            } else if (a.close_room_at || a.live_status === 'completed') {
                groups.closed.push(a);
            } else {
                groups.open.push(a);
            }
            return;
        }
        if (a.deadline_at && new Date(a.deadline_at) < new Date()) {
            groups.closed.push(a);
        } else {
            groups.open.push(a);
        }
    });

    return groups;
}

const groupMeta = {
    live: { label: 'Live now', color: 'var(--db-danger)', pulse: true, hint: 'Students are in the room right now' },
    reopened: { label: 'Reopened', color: 'var(--db-accent-bright)', hint: 'Open again for absentees — they work at their own pace' },
    open: { label: 'Open now', color: 'var(--db-green)', hint: 'Published and accepting work' },
    material: { label: 'Materials', color: 'var(--db-green)', hint: 'Reference reading — no due date' },
    draft: { label: 'Drafts', color: 'var(--db-amber)', hint: 'Only you can see these until you publish' },
    closed: { label: 'Closed', color: 'var(--db-text-3)', hint: 'Ended or past the deadline — results still available, reopen quizzes for absentees' },
};

function ClassworkSkeleton() {
    const cardStyle = { height: 138, borderRadius: 16 };
    const Card = () => <div className="db-skeleton" style={cardStyle} />;
    return (
        <div>
            <div className="cw-skel-group">
                <div className="cw-skel-head">
                    <div className="db-skeleton" style={{ width: 9, height: 9, borderRadius: 9 }} />
                    <div className="db-skeleton" style={{ width: 110, height: 13 }} />
                    <div className="db-skeleton" style={{ width: 34, height: 20, borderRadius: 999 }} />
                </div>
                <div className="cw-grid">
                    <Card key="a" /><Card key="b" />
                </div>
            </div>
            <div className="cw-skel-group">
                <div className="cw-skel-head">
                    <div className="db-skeleton" style={{ width: 9, height: 9, borderRadius: 9 }} />
                    <div className="db-skeleton" style={{ width: 96, height: 13 }} />
                    <div className="db-skeleton" style={{ width: 34, height: 20, borderRadius: 999 }} />
                </div>
                <div className="cw-grid">
                    <Card key="c" /><Card key="d" /><Card key="e" />
                </div>
            </div>
        </div>
    );
}

export default function Classwork({ classId }) {
    const navigate = useNavigate();
    // ?view=gradebook deep-links straight to the gradebook sub-tab (the
    // Progress tab's "to grade" tile lands here)
    const [searchParams] = useSearchParams();
    const [view, setView] = useState(searchParams.get('view') === 'gradebook' ? 'gradebook' : 'activities');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);

    // stale-while-revalidate: cached items render instantly, a quiet refetch
    // corrects them; the interval keeps LIVE / Closed states honest while open
    const { data: activities = [], isLoading: activitiesLoading } = useClassActivities(classId);
    const { data: gradebookData, isLoading: gradebookLoading } = useClassGradebook(classId, {
        enabled: view === 'gradebook',
    });
    const deleteActivity = useDeleteActivity(classId);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteActivity.mutateAsync(deleteTarget.id);
            toast.success(`"${deleteTarget.title}" deleted`);
            setDeleteTarget(null);
        } catch {
            toast.error('Failed to delete activity');
        }
    };

    const handleActivityClick = (activityId) => {
        navigate(`/dashboard/teacher/class/${classId}/activity/${activityId}/submissions`);
    };

    const groups = groupActivities(activities);
    const liveCount = groups.live.length;
    const draftCount = groups.draft.length;

    return (
        <div>
            {/* Header — the class tab already says "Classwork" and carries the
                total, so this line only adds signals the tab badge can't show */}
            <div className="cw-head">
                <div>
                    <h3 className="cw-title">Classwork</h3>
                    {!activitiesLoading && liveCount > 0 && (
                        <p className="cw-meta">
                            <span className="cw-meta-live">{liveCount} live now</span>
                            {draftCount > 0 && <span>· {draftCount} draft{draftCount !== 1 ? 's' : ''}</span>}
                        </p>
                    )}
                    {!activitiesLoading && liveCount === 0 && draftCount > 0 && (
                        <p className="cw-meta">
                            <span>{draftCount} draft{draftCount !== 1 ? 's' : ''}</span>
                        </p>
                    )}
                </div>
                {view === 'activities' && (
                    <button className="db-btn-primary" onClick={() => setIsCreateOpen(true)} type="button">
                        <Plus size={17} /> New classwork
                    </button>
                )}
            </div>

            {/* Sub-tabs */}
            <div className="cw-tabs">
                <button type="button" onClick={() => setView('activities')}
                    className={`cw-tab ${view === 'activities' ? 'active' : ''}`}>
                    <ListOrdered size={15} /> Activities
                </button>
                <button type="button" onClick={() => setView('gradebook')}
                    className={`cw-tab ${view === 'gradebook' ? 'active' : ''}`}>
                    <TrendingUp size={15} /> Gradebook
                </button>
            </div>

            {/* Activities View */}
            {view === 'activities' && (
                activitiesLoading ? (
                    <ClassworkSkeleton />
                ) : activities.length === 0 ? (
                    <div className="cw-empty">
                        <div className="cw-empty-icon"><BookOpen size={28} /></div>
                        <p className="cw-empty-title">No classwork yet</p>
                        <p className="cw-empty-sub">
                            Post quizzes and activities here — timed quizzes with live rooms,
                            file submissions, question sets, or plain reading material.
                        </p>
                        <button className="db-btn-primary" onClick={() => setIsCreateOpen(true)} type="button">
                            <Plus size={16} /> Create your first classwork
                        </button>
                    </div>
                ) : (
                    <div>
                        {GROUP_ORDER.map((key) => {
                            const items = groups[key];
                            const meta = groupMeta[key];
                            if (!items.length) return null;
                            return (
                                <div className="cw-group" key={key}>
                                    <div className="cw-group-head">
                                        <span className={`cw-group-dot ${meta.pulse ? 'pulse' : ''}`}
                                            style={{ background: meta.color }} />
                                        <h4 className="cw-group-label">{meta.label}</h4>
                                        <span className="cw-group-count">{items.length}</span>
                                        {meta.hint && <span className="cw-group-hint">— {meta.hint}</span>}
                                    </div>
                                    <div className="cw-grid">
                                        {items.map((activity) => (
                                            <ActivityCard key={activity.id} activity={activity} classId={classId}
                                                onDelete={setDeleteTarget} />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Gradebook View — Gradebook owns its skeleton; gating it behind
                a circle spinner left the tab spinning for the whole slow
                dev-server fetch instead of showing progress */}
            {view === 'gradebook' && (
                <Gradebook data={gradebookData} loading={gradebookLoading} onActivityClick={handleActivityClick} />
            )}

            {/* Create Modal */}
            <CreateActivityModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} classId={classId} />

            {/* Delete Modal */}
            <DeleteModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
                title={deleteTarget?.title || 'Activity'} loading={deleteActivity.isPending} />
        </div>
    );
}
