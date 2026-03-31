import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";


export default function Button({ children, loading, loadingText = "Processing...", className = "", variant = "primary", ...props }) {
  const variants = {
    primary: "btn-primary",
    student: "btn-student",
  };

  return (
    <motion.button
      whileHover={!loading ? { scale: 1.01, boxShadow: variant === 'primary' ? "0 0 20px rgba(167, 139, 250, 0.3)" : "0 0 20px rgba(34, 211, 238, 0.3)" } : {}}
      whileTap={!loading ? { scale: 0.98 } : {}}
      disabled={loading}
      className={`${variants[variant]} relative overflow-hidden flex items-center justify-center gap-3 disabled:cursor-wait ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-current" />
          <span className="tracking-wide">{loadingText}</span>
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}
