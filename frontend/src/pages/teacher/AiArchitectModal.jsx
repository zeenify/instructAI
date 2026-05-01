import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Paperclip, Sparkles, Bot, FileText, Zap } from 'lucide-react';

export default function AiArchitectModal({ isOpen, onClose, onExecute }) {
    const [prompt, setPrompt] = useState("");
    const [file, setFile] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!prompt.trim() && !file) return;
        onExecute(prompt, file);
        setPrompt("");
        setFile(null);
    };

    

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div 
                        initial={{ scale: 0.9, y: 20, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.9, y: 20, opacity: 0 }}
                        className="relative z-10 w-full max-w-2xl bg-[#05011d] border border-purple-500/20 rounded-[32px] overflow-hidden shadow-2xl"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                        <Bot size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Curriculum Architect</h2>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Engineering Mode</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-all bg-transparent border-none cursor-pointer"><X size={20} /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="relative">
                                    <textarea 
                                        autoFocus value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Command the AI: 'Build a Java course from this DLL' or 'Add 3 quizzes about OOP inheritance'..."
                                        className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-6 text-white text-sm outline-none focus:border-purple-500/40 transition-all min-h-[150px] resize-none leading-relaxed"
                                    />
                                    <AnimatePresence>
                                        {file && (
                                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-lg text-purple-400 text-[10px] font-bold uppercase">
                                                <FileText size={12} /> {file.name}
                                                <X size={12} className="cursor-pointer" onClick={() => setFile(null)} />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                    <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-[10px] font-bold uppercase tracking-widest">
                                        <Paperclip size={14} />
                                        <span>Attach DLL</span>
                                        <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} accept=".pdf,.docx,.txt" />
                                    </label>
                                    <button type="submit" disabled={!prompt.trim() && !file} className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-xs uppercase font-black tracking-widest disabled:opacity-30 border-none cursor-pointer">
                                        <Zap size={14} fill="currentColor" /> Initialize Generation
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}