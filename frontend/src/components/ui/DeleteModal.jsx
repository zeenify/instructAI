import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function DeleteModal({ isOpen, onClose, onConfirm, title, loading }) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative z-10 w-full max-w-lg bg-gradient-to-br from-[#1a0a0a] to-[#0f0505] border border-red-500/25 rounded-[28px] overflow-hidden shadow-2xl"
                    >
                        <div style={{ padding: '50px 40px' }}>
                            <div className="flex justify-center mb-16">
                                <div className="w-28 h-28 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-3xl flex items-center justify-center text-red-400 border border-red-500/30">
                                    <AlertTriangle size={56} />
                                </div>
                            </div>

                            <div className="text-center mb-16">
                                <h3 className="text-3xl font-bold text-white mb-6">Delete {title}?</h3>
                                <p className="text-slate-400 text-base leading-relaxed">This action cannot be undone. All associated data will be permanently removed.</p>
                            </div>

                            <div className="flex gap-6">
                                <button
                                    onClick={onClose}
                                    disabled={loading}
                                    style={{ padding: '16px 24px' }}
                                    className="flex-1 rounded-[16px] bg-white/5 border border-white/15 text-slate-300 font-bold uppercase text-sm tracking-wider cursor-pointer hover:bg-white/10 hover:border-white/25 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onConfirm}
                                    disabled={loading}
                                    style={{ padding: '16px 24px' }}
                                    className="flex-1 rounded-[16px] bg-gradient-to-r from-red-600 to-red-700 text-white font-black uppercase text-sm tracking-wider cursor-pointer hover:from-red-500 hover:to-red-600 transition-all shadow-xl hover:shadow-2xl hover:shadow-red-600/40 disabled:opacity-50"
                                >
                                    {loading ? "Purging..." : "Delete"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}