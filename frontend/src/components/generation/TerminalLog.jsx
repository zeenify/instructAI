import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

const iconMap = {
  status: '$',
  complete: '✓',
  error: '✗',
  info: '→',
  progress: '⟳',
  start: '▶',
  stage: '▬'
};

const colorMap = {
  status: 'text-slate-400',
  complete: 'text-green-400',
  error: 'text-red-400',
  info: 'text-cyan-400',
  progress: 'text-purple-400',
  start: 'text-cyan-400',
  stage: 'text-amber-400'
};

// Detect stage transitions and add separators
const processLogs = (logs) => {
  const processed = [];
  let lastStage = null;

  logs.forEach((log, idx) => {
    // Detect stage changes
    if (log.message?.includes('Stage 1') || log.message?.includes('Architecting')) {
      if (lastStage !== 'stage1') {
        processed.push({
          type: 'stage-separator',
          stage: 'Stage 1: Planning',
          id: `sep-${idx}`
        });
        lastStage = 'stage1';
      }
    } else if (log.message?.includes('Stage 2') || log.message?.includes('Writing') || log.message?.includes('Generating')) {
      if (lastStage !== 'stage2') {
        processed.push({
          type: 'stage-separator',
          stage: 'Stage 2: Content Generation',
          id: `sep-${idx}`
        });
        lastStage = 'stage2';
      }
    } else if (log.message?.includes('Stage 3') || log.message?.includes('media') || log.message?.includes('Formatting')) {
      if (lastStage !== 'stage3') {
        processed.push({
          type: 'stage-separator',
          stage: 'Stage 3: Finalizing',
          id: `sep-${idx}`
        });
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
    // Scroll sentinel into view - this is more reliable than scrollHeight
    endRef.current.scrollIntoView({ behavior: 'auto' });
  }, [processedLogs]);

  return (
    <div className="space-y-2 text-sm font-mono leading-relaxed overflow-y-auto scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700 hover:scrollbar-thumb-slate-600">
      {processedLogs.map((item) => {
        if (item.type === 'stage-separator') {
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="py-3 my-2 border-t border-amber-500/30 origin-left"
            >
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <span className="text-lg">▬</span>
                <span className="text-base">{item.stage}</span>
                <span className="text-lg">▬</span>
              </div>
            </motion.div>
          );
        }

        const log = item;
        return (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -15, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`flex items-start gap-3 ${colorMap[log.type] || 'text-slate-400'}`}
          >
            <span className="text-slate-600 flex-shrink-0 w-16">
              {log.timestamp}
            </span>
            <span className="flex-shrink-0 w-4">{iconMap[log.type] || '•'}</span>
            <span className="flex-1 break-words text-slate-200">{log.message}</span>
          </motion.div>
        );
      })}

      {/* Sentinel element for scrolling */}
      <div ref={endRef} className="h-0" />

      {/* Blinking cursor at end */}
      {logs.length > 0 && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="inline-block w-1 h-5 bg-cyan-400 ml-20"
        />
      )}
    </div>
  );
}
