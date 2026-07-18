import { useNavigate } from 'react-router-dom';
import { Trash2, Eye, EyeOff, Users, Clock, Upload, HelpCircle, BookOpen, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import ActivityTypeBadge from './ActivityTypeBadge';
import { format } from 'date-fns';

const typeStyles = {
  quiz: { accent: '#a78bfa', icon: Zap },
  file: { accent: '#3b82f6', icon: Upload },
  questions: { accent: '#06b6d4', icon: HelpCircle },
  material: { accent: '#94a3b8', icon: BookOpen },
};

export default function ActivityCard({ activity, classId, onUpdate, onDelete }) {
  const navigate = useNavigate();

  const typeKey = activity.activity_type === 'quiz' ? 'quiz' : (activity.submission_type || 'file');
  const style = typeStyles[typeKey] || typeStyles.file;
  const TypeIcon = style.icon;

  const getDeadlineLabel = () => {
    if (!activity.deadline_at) return null;
    const deadline = new Date(activity.deadline_at);
    const now = new Date();
    return {
      text: `Due ${format(deadline, 'MMM d, yyyy h:mm a')}`,
      color: deadline < now ? '#ef4444' : 'var(--text-tertiary)',
    };
  };

  const deadlineInfo = getDeadlineLabel();
  const isMaterial = activity.submission_type === 'material';

  const handleTogglePublish = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/teacher/activities/${activity.id}/publish`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      if (res.data.is_published) {
        toast.success('Published');
      } else {
        toast.warning('Unpublished');
      }
      onUpdate({ ...activity, is_published: res.data.is_published });
    } catch {
      toast.error('Failed to toggle publish status');
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}`)}
      style={{
        padding: '20px 24px',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = style.accent + '44'; e.currentTarget.style.boxShadow = `0 0 0 1px ${style.accent}22`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: style.accent, opacity: 0.7 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <ActivityTypeBadge type={activity.activity_type} submissionType={activity.submission_type} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px', background: activity.is_published ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', color: activity.is_published ? '#16a34a' : '#64748b' }}>
              {activity.is_published ? '✓ Published' : '◊ Draft'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <TypeIcon size={16} color={style.accent} style={{ flexShrink: 0 }} />
            <h4 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: '1.3', wordBreak: 'break-word' }}>{activity.title}</h4>
          </div>
          {activity.description && (
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 0 26px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{activity.description}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, paddingTop: '2px' }}>
          <button onClick={handleTogglePublish} style={{ padding: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: activity.is_published ? '#16a34a' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} type="button" title={activity.is_published ? 'Unpublish' : 'Publish'}>
            {activity.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(activity); }} style={{ padding: '8px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'transparent', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }} type="button" title="Delete activity">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '12px', marginTop: '12px', marginLeft: '26px', borderTop: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
        {!isMaterial && activity.submissions_count !== undefined && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Users size={13} /> {activity.submissions_count} submission{activity.submissions_count !== 1 ? 's' : ''}</span>
        )}
        {deadlineInfo && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: deadlineInfo.color }}><Clock size={13} /> {deadlineInfo.text}</span>
        )}
        {activity.submission_type === 'file' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Upload size={13} /> File</span>
        )}
        {activity.submission_type === 'questions' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><HelpCircle size={13} /> Questions</span>
        )}
        {activity.questions_count > 0 && (
          <span>{activity.questions_count} question{activity.questions_count !== 1 ? 's' : ''}</span>
        )}
      </div>
    </motion.div>
  );
}
