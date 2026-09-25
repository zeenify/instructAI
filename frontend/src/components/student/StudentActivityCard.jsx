import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, Circle, AlertTriangle, Hourglass, FileText, HelpCircle, BookOpen, Radio, PlayCircle, Timer, Award } from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';
import { deriveState } from '../../utils/activityState';

const typeConfig = {
  quiz: { label: 'Quiz', icon: HelpCircle, color: '#409cff', bg: 'rgba(64, 156, 255, 0.12)' },
  file: { label: 'Assignment', icon: FileText, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  questions: { label: 'Q&A', icon: HelpCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  material: { label: 'Material', icon: BookOpen, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

const stateConfig = {
  live: { label: 'Join now', icon: Radio, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.14)', border: 'rgba(239, 68, 68, 0.4)', pulse: true },
  in_progress: { label: 'In progress', icon: PlayCircle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' },
  waiting: { label: 'Starts soon', icon: Circle, color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.35)' },
  graded: { label: 'Done', icon: CheckCircle2, color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)' },
  submitted: { label: 'Pending grade', icon: Hourglass, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)' },
  todo: { label: 'To do', icon: Circle, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)' },
  missed: { label: 'Missed', icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.35)' },
};

function timerSummary(a) {
  if (a.activity_type !== 'quiz') return null;
  if (a.pacing_mode === 'teacher') return 'Teacher-paced';
  if (a.timer_mode === 'entire_quiz' && a.time_limit_minutes)
    return `${a.time_limit_minutes} min limit`;
  if (a.timer_mode === 'per_question') return 'Per-question timer';
  return null;
}

export default function StudentActivityCard({ activity, classId, isActive }) {
  const navigate = useNavigate();

  const isQuiz = activity.activity_type === 'quiz';
  const typeKey = isQuiz ? 'quiz' : (activity.submission_type || 'quiz');
  const typeInfo = typeConfig[typeKey] || typeConfig.quiz;
  const TypeIcon = typeInfo.icon;

  const state = deriveState(activity);
  const stateInfo = stateConfig[state];
  const StateIcon = stateInfo.icon;

  const graded = state === 'graded' && activity.submission_summary;
  const scorePill = graded
    ? `${Number(activity.submission_summary.score).toFixed(0)}/${Number(activity.submission_summary.max_score).toFixed(0)}`
    : null;

  const deadlineDate = !isQuiz && activity.deadline_at ? parseISO(activity.deadline_at) : null;
  const isOverdue = deadlineDate && isPast(deadlineDate);

  const handleClick = () => {
    if (activity.activity_type === 'quiz') {
      navigate(`/dashboard/student/class/${classId}/quiz/${activity.id}`);
      return;
    }
    navigate(`/dashboard/student/class/${classId}/activity/${activity.id}`);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: isActive ? 'var(--accent-light)' : 'var(--bg-secondary)',
        border: `1px solid ${state === 'live' ? stateInfo.border : (isActive ? 'var(--accent-glow)' : 'var(--border-color)')}`,
        borderRadius: '20px',
        padding: '18px 20px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}
      onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.borderColor = state === 'live' ? stateInfo.border : 'var(--accent-glow)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'; } }}
      onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.borderColor = state === 'live' ? stateInfo.border : 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; } }}
    >
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: typeInfo.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <TypeIcon size={22} color={typeInfo.color} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
          <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activity.title}</h4>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: typeInfo.bg, color: typeInfo.color, flexShrink: 0, whiteSpace: 'nowrap' }}>{typeInfo.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
          {activity.questions_count > 0 && (
            <span>{activity.questions_count} question{activity.questions_count !== 1 ? 's' : ''}</span>
          )}
          {isQuiz && (activity.max_points || 0) > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Award size={12} /> {Number(activity.max_points).toFixed(0)} pts
            </span>
          )}
          {timerSummary(activity) && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Timer size={12} /> {timerSummary(activity)}
            </span>
          )}
          {deadlineDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isOverdue ? '#ef4444' : 'var(--text-tertiary)' }}>
              <Clock size={12} />
              Due {format(deadlineDate, 'MMM d, h:mm a')}
            </span>
          )}
        </div>
      </div>

      {/* State chip + score — the one source of truth for "where is this?" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {scorePill && (
          <span style={{ fontSize: '13px', fontWeight: 800, color: stateInfo.color, whiteSpace: 'nowrap' }}>
            {scorePill}
          </span>
        )}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: state === 'live' ? '0.06em' : '0.02em',
            padding: '6px 12px',
            borderRadius: '999px',
            background: stateInfo.bg,
            color: stateInfo.color,
            border: `1px solid ${stateInfo.border}`,
            whiteSpace: 'nowrap',
          }}
        >
          {stateInfo.pulse && (
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: stateInfo.color,
                animation: 'livePulse 1.1s ease-in-out infinite',
              }}
            />
          )}
          <StateIcon size={12} />
          {stateInfo.label}
        </span>
      </div>
    </div>
  );
}
