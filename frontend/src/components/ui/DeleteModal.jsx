import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, onConfirm, title, loading }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-sm bg-[#0a0a0a] border border-red-500/20 rounded-[32px] p-8 shadow-2xl">
                        <div className="text-center">
                            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500 border border-red-500/20">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete {title}?</h3>
                            <p className="text-slate-500 text-sm mb-8 leading-relaxed">This action is irreversible. All data associated with this item will be purged from Neon.</p>
                            
                            <div className="flex gap-3">
                                <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-400 font-bold uppercase text-[10px] border-none cursor-pointer hover:bg-white/10 transition-all">Cancel</button>
                                <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-black uppercase text-[10px] border-none cursor-pointer hover:bg-red-500 transition-all disabled:opacity-30">
                                    {loading ? "Purging..." : "Confirm Delete"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}