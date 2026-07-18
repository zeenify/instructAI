import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Circle, AlertTriangle, Hourglass, FileText, HelpCircle, BookOpen, Loader2 } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

const submissionConfig = {
  quiz: { label: 'Quiz', icon: HelpCircle, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
  file: { label: 'File', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  questions: { label: 'Q&A', icon: HelpCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  material: { label: 'Material', icon: BookOpen, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

const statusConfig = {
  graded: { icon: CheckCircle2, color: '#10b981', label: 'Graded' },
  submitted: { icon: Hourglass, color: '#f59e0b', label: 'Submitted' },
  draft: { icon: Circle, color: '#94a3b8', label: 'Draft' },
  not_submitted: { icon: Circle, color: '#64748b', label: 'Not Submitted' },
  missed: { icon: AlertTriangle, color: '#ef4444', label: 'Missed' },
};

export default function StudentActivityCard({ activity, classId, isActive }) {
  const navigate = useNavigate();

  const typeKey = activity.activity_type === 'quiz' ? 'quiz' : (activity.submission_type || 'quiz');
  const typeInfo = submissionConfig[typeKey] || submissionConfig.quiz;
  const TypeIcon = typeInfo.icon;

  let statusInfo = statusConfig[activity.submission_status] || statusConfig.not_submitted;
  if (activity.submission_type === 'material' && activity.submission_status === 'submitted') {
    statusInfo = { icon: CheckCircle2, color: '#10b981', label: 'Read' };
  }
  const StatusIcon = statusInfo.icon;

  const deadlineDate = activity.deadline_at ? parseISO(activity.deadline_at) : null;
  const isOverdue = deadlineDate && isPast(deadlineDate);

  const handleClick = () => {
    navigate(`/dashboard/student/class/${classId}/activity/${activity.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
        border: `1px solid ${isActive ? 'var(--accent-glow)' : 'var(--border-color)'}`,
        borderRadius: '20px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--accent-glow)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; } }}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; } }}
    >
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: typeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TypeIcon size={22} color={typeInfo.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.title}</h4>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: typeInfo.bg, color: typeInfo.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{typeInfo.label}</span>
          {activity.submission_type !== 'material' && activity.submission_summary?.status === 'graded' && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: statusInfo.color, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {Number(activity.submission_summary.score).toFixed(0)}/{Number(activity.submission_summary.max_score).toFixed(0)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          {deadlineDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOverdue ? '#ef4444' : 'var(--text-tertiary)' }}>
              <Clock size={12} />
              Due {format(deadlineDate, 'MMM d, h:mm a')}
            </span>
          )}
          {activity.questions_count > 0 && (
            <span>{activity.questions_count} question{activity.questions_count !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <StatusIcon size={18} color={statusInfo.color} title={statusInfo.label} />
      </div>
    </div>
  );
}
