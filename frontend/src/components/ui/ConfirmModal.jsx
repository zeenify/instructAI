// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Upload, AlertCircle } from 'lucide-react';

const variantConfig = {
  danger: { icon: AlertTriangle, iconColor: 'var(--db-danger)', iconBg: 'var(--db-danger-soft)', accent: 'var(--db-danger)' },
  warning: { icon: AlertCircle, iconColor: 'var(--db-amber)', iconBg: 'var(--db-amber-soft)', accent: 'var(--db-amber)' },
  default: { icon: Upload, iconColor: 'var(--db-accent)', iconBg: 'var(--db-accent-soft)', accent: 'var(--db-accent)' },
};

// Theme-aware confirm dialog (db- tokens: light pages get a light surface,
// dark pages a dark one). Same props across every consumer in the app.
export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', loading, variant = 'default' }) {
  const cfg = variantConfig[variant] || variantConfig.default;
  const Icon = cfg.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ background: 'rgba(8, 10, 18, 0.55)', backdropFilter: 'blur(6px)' }}
            className="absolute inset-0"
          />
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 18 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            style={{
              position: 'relative',
              zIndex: 10,
              width: '100%',
              maxWidth: 440,
              background: 'var(--db-card)',
              border: '1px solid var(--db-border-strong)',
              borderRadius: 22,
              boxShadow: '0 24px 70px rgba(2, 4, 12, 0.45)',
              padding: '30px 30px 26px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <span style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: cfg.iconBg, color: cfg.iconColor,
                border: `1px solid ${cfg.iconColor}22`,
              }}>
                <Icon size={23} />
              </span>
              <div style={{ minWidth: 0, paddingTop: 3 }}>
                <h3 style={{ fontFamily: 'var(--db-font-display)', fontSize: 20, fontWeight: 700, margin: 0, color: 'var(--db-text)', lineHeight: 1.2 }}>
                  {title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--db-text-2)', margin: '7px 0 0' }}>
                  {message}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 600,
                  background: 'transparent', border: '1px solid var(--db-border)',
                  color: 'var(--db-text-2)', cursor: 'pointer',
                }}
              >
                {cancelText}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                style={{
                  padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 700,
                  background: cfg.accent, border: 'none', color: '#fff',
                  cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                {loading && <span style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                  display: 'inline-block',
                }} className="animate-spin" />}
                {loading ? 'Working…' : confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
