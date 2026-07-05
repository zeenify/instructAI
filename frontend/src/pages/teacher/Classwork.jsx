import { useEffect, useState } from 'react';
import { Plus, BookOpen, Clock, CheckCircle, DraftingCompass, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import cache from '../../utils/cache';
import ActivityCard from '../../components/teacher/ActivityCard';
import CreateActivityModal from './CreateActivityModal';
import DeleteModal from '../../components/ui/DeleteModal';

const GROUP_ORDER = ['open', 'upcoming', 'past', 'draft'];

function groupActivities(activities) {
  const now = new Date();
  const groups = { open: [], upcoming: [], past: [], draft: [] };

  activities.forEach((a) => {
    if (!a.is_published) {
      groups.draft.push(a);
      return;
    }
    if (!a.deadline_at) {
      groups.open.push(a);
      return;
    }
    const deadline = new Date(a.deadline_at);
    if (deadline < now) {
      groups.past.push(a);
    } else if (deadline < new Date(now.getTime() + 86400000 * 3)) {
      groups.upcoming.push(a);
    } else {
      groups.open.push(a);
    }
  });

  return groups;
}

const groupMeta = {
  open: { label: 'Open', icon: CheckCircle, color: '#10b981', countColor: 'rgba(16, 185, 129, 0.15)' },
  upcoming: { label: 'Upcoming', icon: Clock, color: '#f59e0b', countColor: 'rgba(245, 158, 11, 0.15)' },
  past: { label: 'Past', icon: Clock, color: '#64748b', countColor: 'rgba(100, 116, 139, 0.15)' },
  draft: { label: 'Drafts', icon: DraftingCompass, color: '#a78bfa', countColor: 'rgba(167, 139, 250, 0.15)' },
};

export default function Classwork({ classId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchActivities = async () => {
    try {
      const res = await api.get(`/teacher/classes/${classId}/activities`);
      setActivities(res.data);
    } catch {
      toast.error('Failed to load activities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cached = cache.get(`get:/teacher/classes/${classId}/activities`);
    if (cached) {
      setActivities(cached);
      setLoading(false);
    } else {
      fetchActivities();
    }
  }, [classId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/teacher/activities/${deleteTarget.id}`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      toast.success(`"${deleteTarget.title}" deleted`);
      setActivities((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete activity');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreated = (newActivity) => {
    setActivities((prev) => [...prev, newActivity]);
    invalidateCache(`get:/teacher/classes/${classId}/activities`);
  };

  const handleUpdate = (updated) => {
    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  };

  const groups = groupActivities(activities);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--text-tertiary)" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h3 style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Classwork</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '0' }}>
            {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'} total
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          style={{
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(to right, #9333ea, #7e22ce)',
            color: 'white',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '14px',
            textTransform: 'uppercase',
            transition: 'all 0.3s',
          }}
        >
          <Plus size={18} /> Create
        </button>
      </div>

      {/* Empty state */}
      {activities.length === 0 ? (
        <div
          style={{
            border: '2px dashed var(--border-color)',
            borderRadius: '24px',
            padding: '80px 40px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              color: '#a78bfa',
            }}
          >
            <BookOpen size={40} />
          </div>
          <p style={{ fontSize: '20px', fontWeight: 600, color: '#94a3b8', margin: '0 0 12px 0' }}>No classwork yet</p>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>
            Create your first quiz, assignment, or activity
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            style={{
              padding: '14px 24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              background: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              color: '#d8b4fe',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.3s',
            }}
          >
            <Plus size={16} /> Create First Activity
          </button>
        </div>
      ) : (
        /* Grouped timeline */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {GROUP_ORDER.map((key) => {
            const items = groups[key];
            const meta = groupMeta[key];
            if (!items.length) return null;
            const Icon = meta.icon;

            return (
              <div key={key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '16px',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      background: meta.countColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: meta.color,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <h4
                    style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    {meta.label}
                  </h4>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: meta.color,
                      background: meta.countColor,
                      padding: '2px 10px',
                      borderRadius: '999px',
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {items.map((activity) => (
                    <ActivityCard
                      key={activity.id}
                      activity={activity}
                      classId={classId}
                      onUpdate={handleUpdate}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateActivityModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        classId={classId}
        onCreated={handleCreated}
      />

      {/* Delete Modal */}
      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={deleteTarget?.title || 'Activity'}
        loading={isDeleting}
      />
    </div>
  );
}
