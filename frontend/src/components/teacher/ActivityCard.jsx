import { useNavigate } from 'react-router-dom';
import { Trash2, Eye, EyeOff, Users, Clock, Upload, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import ActivityTypeBadge from './ActivityTypeBadge';
import { format } from 'date-fns';

export default function ActivityCard({ activity, classId, onUpdate, onDelete }) {
  const navigate = useNavigate();

  const getDeadlineLabel = () => {
    if (!activity.deadline_at) return null;
    const deadline = new Date(activity.deadline_at);
    const now = new Date();
    const diff = deadline - now;
    if (diff < 0) return { text: 'Past due', color: '#ef4444' };
    if (diff < 86400000) return { text: `Due ${format(deadline, 'h:mm a')}`, color: '#f59e0b' };
    if (diff < 604800000) return { text: `Due ${format(deadline, 'EEE, h:mm a')}`, color: '#f59e0b' };
    return { text: `Due ${format(deadline, 'MMM d')}`, color: '#94a3b8' };
  };

  const deadlineInfo = getDeadlineLabel();
  const isMaterial = activity.submission_type === 'material';

  const handleTogglePublish = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/teacher/activities/${activity.id}/publish`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      toast.success(res.data.is_published ? 'Published' : 'Unpublished');
      onUpdate({ ...activity, is_published: res.data.is_published });
    } catch {
      toast.error('Failed to toggle publish status');
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}`)}
      style={{ padding: '24px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', transition: 'all 0.3s', boxShadow: 'var(--card-shadow)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <ActivityTypeBadge type={activity.activity_type} submissionType={activity.submission_type} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: activity.is_published ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', color: activity.is_published ? '#16a34a' : '#64748b', border: '1px solid var(--border-color)' }}>
              {activity.is_published ? '✓ Published' : '◊ Draft'}
            </span>
          </div>
          <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', lineHeight: '1.3', wordBreak: 'break-word' }}>{activity.title}</h4>
          {activity.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{activity.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button onClick={handleTogglePublish} style={{ padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: activity.is_published ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} type="button" title={activity.is_published ? 'Unpublish' : 'Publish'}>
            {activity.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(activity); }} style={{ padding: '10px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} type="button" title="Delete activity">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '16px', marginTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
        {!isMaterial && activity.submissions_count !== undefined && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={14} /> {activity.submissions_count} submission{activity.submissions_count !== 1 ? 's' : ''}</span>
        )}
        {deadlineInfo && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: deadlineInfo.color }}><Clock size={14} /> {deadlineInfo.text}</span>
        )}
        {activity.submission_type === 'file' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Upload size={14} /> File</span>
        )}
        {activity.submission_type === 'questions' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><HelpCircle size={14} /> Questions</span>
        )}
        {activity.questions_count > 0 && (
          <span>{activity.questions_count} question{activity.questions_count !== 1 ? 's' : ''}</span>
        )}
      </div>
    </motion.div>
  );
}
