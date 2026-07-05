import { Zap, ClipboardList } from 'lucide-react';

const typeConfig = {
  quiz: { label: 'Quiz', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Zap },
  activity: { label: 'Activity', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: ClipboardList },
};

const submissionLabels = {
  file: 'File',
  questions: 'Questions',
  material: 'Material',
};

export default function ActivityTypeBadge({ type, submissionType, size = 'sm' }) {
  const config = typeConfig[type] || typeConfig.activity;
  const Icon = config.icon;
  const fontSize = size === 'sm' ? '10px' : '12px';
  const padding = size === 'sm' ? '6px 10px' : '8px 14px';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding,
        borderRadius: '8px',
        fontSize,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        background: config.bg,
        color: config.color,
        border: `1px solid ${config.color}33`,
      }}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {config.label}
      {type === 'activity' && submissionType && (
        <span style={{ opacity: 0.7, marginLeft: '2px' }}>
          · {submissionLabels[submissionType] || submissionType}
        </span>
      )}
    </span>
  );
}
