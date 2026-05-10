import { motion } from 'framer-motion';

export default function ProgressBar({ value, label, showPercentage = true }) {
  return (
    <div className="space-y-3">
      {label && (
        <div className="text-sm font-medium text-slate-300 flex items-center justify-between">
          <span>{label}</span>
          {showPercentage && <span className="text-cyan-400 font-mono">{Math.round(value)}%</span>}
        </div>
      )}
      <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
