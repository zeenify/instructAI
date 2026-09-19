import { motion } from 'framer-motion';

export default function ProgressBar({ value, label, showPercentage = true }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {label && (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          className="gen-note"
        >
          <span>{label}</span>
          {showPercentage && (
            <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--db-accent-bright)' }}>
              {Math.round(value)}%
            </span>
          )}
        </div>
      )}
      <div
        style={{
          height: 8,
          borderRadius: 999,
          background: 'var(--db-card-2)',
          border: '1px solid var(--db-border)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          style={{ height: '100%', background: 'var(--db-accent)', borderRadius: 999 }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
