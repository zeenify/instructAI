import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Settings, Zap } from 'lucide-react';

export default function ContentParametersModal({ isOpen, onClose, onGenerate, structureParams }) {
    const [contentParams, setContentParams] = useState({
        contentDepth: 'standard',
        includeImages: true,
        includeVideos: true,
        writingStyle: 'conversational',
        questionsPerQuiz: 10,
        pointsPerQuestion: 5,
        passingPercentage: 70,
        allowAIAssistance: false
    });

    const handleGenerate = () => {
        onGenerate({ ...structureParams, ...contentParams });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md"
                />
                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    className="relative z-10 w-full max-w-2xl bg-[#05011d] border border-cyan-500/20 rounded-[32px] overflow-hidden shadow-2xl"
                >
                    <div className="p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3 text-left">
                                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                                    <Sparkles size={22} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white tracking-tight">Content Generation Settings</h2>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest leading-none">Fine-tune lesson & quiz content</p>
                                </div>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-all bg-transparent border-none cursor-pointer"><X size={20} /></button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="space-y-6">
                            {/* Content Parameters */}
                            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                                <div className="flex items-center gap-2 mb-4 text-cyan-400 text-[10px] font-bold uppercase tracking-widest">
                                    <Settings size={14} /> Lesson Content
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Content Depth */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Content Depth</label>
                                        <select
                                            value={contentParams.contentDepth}
                                            onChange={(e) => setContentParams({...contentParams, contentDepth: e.target.value})}
                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                        >
                                            <option value="concise">Concise</option>
                                            <option value="standard">Standard</option>
                                            <option value="detailed">Detailed</option>
                                        </select>
                                    </div>

                                    {/* Writing Style */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Writing Style</label>
                                        <select
                                            value={contentParams.writingStyle}
                                            onChange={(e) => setContentParams({...contentParams, writingStyle: e.target.value})}
                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                        >
                                            <option value="simple">Simple</option>
                                            <option value="conversational">Conversational</option>
                                            <option value="formal">Formal</option>
                                            <option value="technical">Technical</option>
                                        </select>
                                    </div>

                                    {/* Questions per Quiz */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Questions per Quiz</label>
                                        <input
                                            type="number"
                                            min="5"
                                            max="30"
                                            value={contentParams.questionsPerQuiz}
                                            onChange={(e) => setContentParams({...contentParams, questionsPerQuiz: Number(e.target.value)})}
                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500/40 transition-all"
                                        />
                                    </div>

                                    {/* Passing Percentage */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Passing Score</label>
                                        <select
                                            value={contentParams.passingPercentage}
                                            onChange={(e) => setContentParams({...contentParams, passingPercentage: Number(e.target.value)})}
                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                        >
                                            <option value="60">60%</option>
                                            <option value="70">70%</option>
                                            <option value="80">80%</option>
                                            <option value="90">90%</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Content Toggles */}
                                <div className="flex gap-4 mt-4 flex-wrap">
                                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={contentParams.includeImages}
                                            onChange={(e) => setContentParams({...contentParams, includeImages: e.target.checked})}
                                            className="w-4 h-4 rounded bg-white/5 border-white/10 checked:bg-cyan-500 cursor-pointer"
                                        />
                                        Include images
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={contentParams.includeVideos}
                                            onChange={(e) => setContentParams({...contentParams, includeVideos: e.target.checked})}
                                            className="w-4 h-4 rounded bg-white/5 border-white/10 checked:bg-cyan-500 cursor-pointer"
                                        />
                                        Include videos
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={contentParams.allowAIAssistance}
                                            onChange={(e) => setContentParams({...contentParams, allowAIAssistance: e.target.checked})}
                                            className="w-4 h-4 rounded bg-white/5 border-white/10 checked:bg-cyan-500 cursor-pointer"
                                        />
                                        Allow AI assistance in quiz
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <p className="text-xs text-slate-500">
                                    Lesson content and quiz questions will be generated based on these settings
                                </p>
                                <button type="submit" className="px-8 py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-black rounded-xl flex items-center gap-2 text-xs uppercase font-black tracking-widest border-none cursor-pointer hover:scale-105 transition-all shadow-lg shadow-cyan-500/20">
                                    <Zap size={14} fill="currentColor" /> Generate Content
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
