import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Paperclip, Sparkles, Bot, FileText, Zap, Settings } from 'lucide-react';

export default function AiArchitectModal({ isOpen, onClose, onExecute, curriculumFile }) {
    const [prompt, setPrompt] = useState("");

    // Structure Generation Parameters (ONLY these shown in this modal)
    const [params, setParams] = useState({
        difficulty: 'beginner',
        moduleCount: '3-5',
        moduleCountCustom: false,
        lessonsPerModule: '3-5',
        lessonsCustom: false,
        includeQuiz: true,
        pacing: 'standard'
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!prompt.trim()) return;
        // Pass only structure params - content params will be set in ContentGenerationModal
        onExecute(prompt, null, params);
        setPrompt("");
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
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3 text-left">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/20">
                                        <Bot size={22} />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white tracking-tight">Curriculum Architect</h2>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Controlled Generation</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-all bg-transparent border-none cursor-pointer"><X size={20} /></button>
                            </div>

                            {curriculumFile && (
                                <div className="mb-6 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-2 text-green-400 text-xs">
                                    <FileText size={14} />
                                    <span className="font-medium">Using curriculum: {curriculumFile}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Structure Parameters */}
                                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                    <div className="flex items-center gap-2 mb-4 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                                        <Settings size={14} /> Curriculum Structure
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Difficulty */}
                                        <div>
                                            <label className="text-xs text-slate-500 mb-2 block">Difficulty Level</label>
                                            <select
                                                value={params.difficulty}
                                                onChange={(e) => setParams({...params, difficulty: e.target.value})}
                                                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                            >
                                                <option value="beginner">Beginner</option>
                                                <option value="intermediate">Intermediate</option>
                                                <option value="advanced">Advanced</option>
                                            </select>
                                        </div>

                                        {/* Module Count */}
                                        <div>
                                            <label className="text-xs text-slate-500 mb-2 block">Number of Modules</label>
                                            {params.moduleCountCustom ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="8"
                                                        value={params.moduleCount}
                                                        onChange={(e) => setParams({...params, moduleCount: e.target.value})}
                                                        className="flex-1 bg-white/[0.05] border border-purple-500/40 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/60 transition-all"
                                                        placeholder="e.g., 6"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setParams({...params, moduleCountCustom: false, moduleCount: '3-5'})}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all text-xs"
                                                    >
                                                        Presets
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <select
                                                        value={params.moduleCount}
                                                        onChange={(e) => setParams({...params, moduleCount: e.target.value})}
                                                        className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                                    >
                                                        <option value="3-5">3-5 modules</option>
                                                        <option value="5-7">5-7 modules</option>
                                                        <option value="6-8">6-8 modules (max)</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setParams({...params, moduleCountCustom: true, moduleCount: '5'})}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all text-xs"
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Lessons per Module */}
                                        <div>
                                            <label className="text-xs text-slate-500 mb-2 block">Lessons per Module</label>
                                            {params.lessonsCustom ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="8"
                                                        value={params.lessonsPerModule}
                                                        onChange={(e) => setParams({...params, lessonsPerModule: e.target.value})}
                                                        className="flex-1 bg-white/[0.05] border border-purple-500/40 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/60 transition-all"
                                                        placeholder="e.g., 4"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setParams({...params, lessonsCustom: false, lessonsPerModule: '3-5'})}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all text-xs"
                                                    >
                                                        Presets
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <select
                                                        value={params.lessonsPerModule}
                                                        onChange={(e) => setParams({...params, lessonsPerModule: e.target.value})}
                                                        className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                                    >
                                                        <option value="2-3">2-3 lessons</option>
                                                        <option value="3-5">3-5 lessons</option>
                                                        <option value="5-8">5-8 lessons (max)</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setParams({...params, lessonsCustom: true, lessonsPerModule: '4'})}
                                                        className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all text-xs"
                                                    >
                                                        Custom
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Pacing */}
                                        <div>
                                            <label className="text-xs text-slate-500 mb-2 block">Pacing</label>
                                            <select
                                                value={params.pacing}
                                                onChange={(e) => setParams({...params, pacing: e.target.value})}
                                                className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                            >
                                                <option value="condensed">Condensed</option>
                                                <option value="standard">Standard</option>
                                                <option value="comprehensive">Comprehensive</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Toggles */}
                                    <div className="flex gap-4 mt-4">
                                        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={params.includeQuiz}
                                                onChange={(e) => setParams({...params, includeQuiz: e.target.checked})}
                                                className="w-4 h-4 rounded bg-white/5 border-white/10 checked:bg-purple-500 cursor-pointer"
                                            />
                                            Quiz per module
                                        </label>
                                    </div>
                                </div>

                                <div className="relative">
                                    <label className="text-xs text-slate-500 mb-2 block">Additional Instructions</label>
                                    <textarea
                                        autoFocus value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                        placeholder="Any specific requirements or focus areas..."
                                        className="w-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 text-white text-sm outline-none focus:border-purple-500/40 transition-all min-h-[100px] resize-none leading-relaxed"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-4">
                                    <button type="submit" className="btn-primary px-8 py-3 rounded-xl flex items-center gap-2 text-xs uppercase font-black tracking-widest border-none cursor-pointer">
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