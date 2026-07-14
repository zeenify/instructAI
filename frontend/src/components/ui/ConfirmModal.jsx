// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Upload, AlertCircle } from 'lucide-react';

const variantConfig = {
  danger: { icon: AlertTriangle, gradient: 'from-red-500/20 to-red-600/10', border: 'border-red-500/25', iconColor: 'text-red-400', iconBorder: 'border-red-500/30', btnGradient: 'from-red-600 to-red-700', btnHover: 'hover:from-red-500 hover:to-red-600', btnShadow: 'hover:shadow-red-600/40' },
  warning: { icon: AlertCircle, gradient: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/25', iconColor: 'text-amber-400', iconBorder: 'border-amber-500/30', btnGradient: 'from-amber-600 to-amber-700', btnHover: 'hover:from-amber-500 hover:to-amber-600', btnShadow: 'hover:shadow-amber-600/40' },
  default: { icon: Upload, gradient: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/25', iconColor: 'text-blue-400', iconBorder: 'border-blue-500/30', btnGradient: 'from-blue-600 to-blue-700', btnHover: 'hover:from-blue-500 hover:to-blue-600', btnShadow: 'hover:shadow-blue-600/40' },
};

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', loading, variant = 'default' }) {
  const cfg = variantConfig[variant] || variantConfig.default;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative z-10 w-full max-w-lg bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] ${cfg.border} rounded-[28px] overflow-hidden shadow-2xl`}
          >
            <div style={{ padding: '50px 40px' }}>
              <div className="flex justify-center mb-16">
                <div className={`w-28 h-28 bg-gradient-to-br ${cfg.gradient} rounded-3xl flex items-center justify-center ${cfg.iconColor} ${cfg.iconBorder}`}>
                  <Icon size={56} />
                </div>
              </div>

              <div className="text-center mb-16">
                <h3 className="text-3xl font-bold text-white mb-6">{title}</h3>
                <p className="text-slate-400 text-base leading-relaxed">{message}</p>
              </div>

              <div className="flex gap-6">
                <button
                  onClick={onClose}
                  disabled={loading}
                  style={{ padding: '16px 24px' }}
                  className="flex-1 rounded-[16px] bg-white/5 border border-white/15 text-slate-300 font-bold uppercase text-sm tracking-wider cursor-pointer hover:bg-white/10 hover:border-white/25 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  style={{ padding: '16px 24px' }}
                  className={`flex-1 rounded-[16px] bg-gradient-to-r ${cfg.btnGradient} text-white font-black uppercase text-sm tracking-wider cursor-pointer ${cfg.btnHover} transition-all shadow-xl ${cfg.btnShadow} disabled:opacity-50`}
                >
                  {loading ? `${confirmText}...` : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
