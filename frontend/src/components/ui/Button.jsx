import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const accentColors = {
  primary: "#a78bfa",
  student: "#22d3ee",
};

export default function Button({ children, loading, loadingText = "Processing...", className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "btn-primary",
    student: "btn-student",
  };
  const accent = accentColors[variant];

  return (
    <motion.button
      whileHover={!loading ? { scale: 1.02, boxShadow: `0 0 24px ${accent}44` } : {}}
      whileTap={!loading ? { scale: 0.97 } : {}}
      disabled={loading}
      className={`${variants[variant]} relative overflow-hidden flex items-center justify-center gap-3 disabled:cursor-wait ${className}`}
      {...props}
    >
      {loading && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accent}18 50%, transparent 100%)`,
          }}
          animate={{ x: ["-100%", "100%"] }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
        />
      )}

      {loading ? (
        <>
          <span className="relative flex items-center justify-center" style={{ width: 18, height: 18 }}>
            <motion.span
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 14px ${accent}`,
                opacity: 0.5,
              }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0.15, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
            />
            <motion.span
              style={{ display: "inline-flex" }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
            >
              <Loader2 className="w-[18px] h-[18px] text-current relative z-10" />
            </motion.span>
          </span>
          <span className="tracking-wide">{loadingText}</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}
