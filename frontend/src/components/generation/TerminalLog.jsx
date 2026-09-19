import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

/**
 * The generation console's activity feed — a clean, token-styled timeline of
 * what the AI is doing right now (replaces the old terminal look).
 */

const dotColor = {
  status: 'var(--db-text-3)',
  complete: 'var(--db-green)',
  error: 'var(--db-danger)',
  info: 'var(--db-accent-bright)',
  progress: 'var(--db-accent-bright)',
  start: 'var(--db-accent-bright)',
  warn: 'var(--db-amber)',
  stage: 'var(--db-amber)'
};

// Detect stage transitions and add separators
const processLogs = (logs) => {
  const processed = [];
  let lastStage = null;

  logs.forEach((log, idx) => {
    if (log.message?.includes('Stage 1') || log.message?.includes('Architecting')) {
      if (lastStage !== 'stage1') {
        processed.push({ type: 'stage-separator', stage: 'Planning', id: `sep-${idx}` });
        lastStage = 'stage1';
      }
    } else if (log.message?.includes('Stage 2') || log.message?.includes('Writing') || log.message?.includes('Generating')) {
      if (lastStage !== 'stage2') {
        processed.push({ type: 'stage-separator', stage: 'Writing content', id: `sep-${idx}` });
        lastStage = 'stage2';
      }
    } else if (log.message?.includes('Stage 3') || log.message?.includes('media') || log.message?.includes('Formatting')) {
      if (lastStage !== 'stage3') {
        processed.push({ type: 'stage-separator', stage: 'Finalizing', id: `sep-${idx}` });
        lastStage = 'stage3';
      }
    }

    processed.push({ ...log, id: idx });
  });

  return processed;
};

export default function TerminalLog({ logs }) {
  const endRef = useRef(null);
  const processedLogs = processLogs(logs);

  useEffect(() => {
    if (!endRef.current) return;
    endRef.current.scrollIntoView({ behavior: 'auto' });
  }, [processedLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {processedLogs.map((item) => {
        if (item.type === 'stage-separator') {
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0 4px' }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: 'var(--db-amber)',
                }}
              >
                {item.stage}
              </span>
              <span style={{ flex: 1, height: 1, background: 'var(--db-border)' }} />
            </motion.div>
          );
        }

        const log = item;
        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                flex: 'none',
                marginTop: 6,
                background: dotColor[log.type] || 'var(--db-text-3)',
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 13.5,
                lineHeight: 1.5,
                color: log.type === 'error' ? 'var(--db-danger)' : 'var(--db-text-2)',
                overflowWrap: 'anywhere',
              }}
            >
              {log.message}
            </span>
            <span
              style={{
                flex: 'none',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10.5,
                color: 'var(--db-text-3)',
                marginTop: 2,
              }}
            >
              {log.timestamp}
            </span>
          </motion.div>
        );
      })}

      {/* Sentinel for auto-scroll */}
      <div ref={endRef} style={{ height: 0 }} />
    </div>
  );
}
