import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Settings, Zap, AlertCircle } from 'lucide-react';

export default function ContentParametersModal({ isOpen, onClose, onGenerate, structureParams, course, isSavingStructure = false }) {
    const [contentParams, setContentParams] = useState({
        contentDepth: 'standard',
        includeImages: true,
        includeVideos: true,
        writingStyle: 'conversational',
        questionTypeDistribution: 'balanced',
        passingPercentage: 70,
        allowAIAssistance: false,
        quizTimerMode: 'entire_quiz',
        quizTimeLimit: 15
    });

    const [customDistribution, setCustomDistribution] = useState({
        mc: 40,
        tf: 20,
        id: 20,
        enum: 10,
        code: 10
    });

    // Check if course has programming content from the database flag
    const hasProgrammingContent = course?.is_coding === true;

    // Determine coding percentage for current selection
    const getCodingPercentage = () => {
        const dist = contentParams.questionTypeDistribution;
        if (dist === 'balanced') return 10;
        if (dist === 'coding_heavy') return 55;
        if (dist === 'theory_focused') return 0;
        if (dist === 'non_coding') return 0;
        if (dist === 'custom') return customDistribution.code;
        return 0;
    };

    const codingPercentage = getCodingPercentage();

    // Check if selected preset has coding
    const hasSelectedCoding = codingPercentage > 0;
    const shouldBlockCoding = !hasProgrammingContent && hasSelectedCoding;

    // Auto-switch to non_coding if incompatible
    const getDisplayPreset = () => {
        if (shouldBlockCoding) {
            return 'non_coding';
        }
        return contentParams.questionTypeDistribution;
    };

    const handleGenerate = () => {
        const finalParams = { ...structureParams, ...contentParams };

        // If custom distribution, format as string for backend
        if (contentParams.questionTypeDistribution === 'custom') {
            const {mc, tf, id, enum: e, code} = customDistribution;
            finalParams.questionTypeDistribution = `custom:${mc},${tf},${id},${e},${code}`;
        }

        // Pass is_coding flag from course to backend
        finalParams.is_coding = course?.is_coding || false;

        onGenerate(finalParams);
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

                                    {/* Question Type Distribution */}
                                    <div className="col-span-2">
                                        <label className="text-xs text-slate-500 mb-2 block">Question Type Distribution</label>
                                        <select
                                            value={getDisplayPreset()}
                                            onChange={(e) => {
                                                if (!hasProgrammingContent && ['balanced', 'coding_heavy'].includes(e.target.value)) {
                                                    // Don't allow coding presets for non-programming courses, but allow custom
                                                    return;
                                                }
                                                setContentParams({...contentParams, questionTypeDistribution: e.target.value});
                                            }}
                                            className="w-full bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-cyan-500/40 transition-all cursor-pointer [&>option]:bg-gray-900 [&>option]:text-white"
                                        >
                                            {!hasProgrammingContent ? (
                                                <>
                                                    <option value="theory_focused">Theory-Focused (50% MC, 25% TF, 20% ID, 5% Enum, 0% Code)</option>
                                                    <option value="non_coding">Non-Coding (40% MC, 25% TF, 25% ID, 10% Enum, 0% Code) - Recommended</option>
                                                    <option value="custom">Custom (Coding locked to 0%)</option>
                                                </>
                                            ) : (
                                                <>
                                                    <option value="balanced">Balanced (40% MC, 20% TF, 20% ID, 10% Enum, 10% Code)</option>
                                                    <option value="coding_heavy">Coding-Heavy (20% MC, 10% TF, 10% ID, 5% Enum, 55% Code)</option>
                                                    <option value="theory_focused">Theory-Focused (50% MC, 25% TF, 20% ID, 5% Enum, 0% Code)</option>
                                                    <option value="non_coding">Non-Coding (40% MC, 25% TF, 25% ID, 10% Enum, 0% Code)</option>
                                                    <option value="custom">Custom (Adjust below)</option>
                                                </>
                                            )}
                                        </select>

                                        {/* Info message for non-programming courses */}
                                        {!hasProgrammingContent && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex gap-3 items-start"
                                            >
                                                <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
                                                <p className="text-xs text-blue-400/90">
                                                    This course has no programming content. Coding-based presets are disabled to ensure quality quiz generation. Choose from available options above.
                                                </p>
                                            </motion.div>
                                        )}
                                    </div>

                                    {/* Quiz Timer */}
                                    <div>
                                        <label className="text-xs text-slate-500 mb-2 block">Quiz Timer (minutes)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="180"
                                            value={contentParams.quizTimeLimit}
                                            onChange={(e) => setContentParams({...contentParams, quizTimeLimit: Number(e.target.value)})}
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

                                {/* Custom Distribution Adjusters - Conditional Render */}
                                {contentParams.questionTypeDistribution === 'custom' && (
                                    <div className="col-span-2 mt-4 bg-white/[0.03] border border-cyan-500/20 rounded-xl p-4 space-y-3">
                                        <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-3">Custom Distribution</p>
                                        {[
                                            {key: 'mc', label: 'Multiple Choice'},
                                            {key: 'tf', label: 'True/False'},
                                            {key: 'id', label: 'Identification'},
                                            {key: 'enum', label: 'Enumeration'},
                                            {key: 'code', label: 'Coding'}
                                        ].map(({key, label}) => {
                                            const isCodeSlider = key === 'code';
                                            const isLocked = !hasProgrammingContent && isCodeSlider;

                                            return (
                                                <div key={key} className={`flex items-center justify-between gap-4 ${isLocked ? 'opacity-50' : ''}`}>
                                                    <span className={`text-sm flex-shrink-0 w-32 ${isLocked ? 'text-slate-500' : 'text-slate-300'}`}>
                                                        {label}
                                                        {isLocked && <span className="ml-1 text-xs text-slate-600">(locked)</span>}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            disabled={isLocked}
                                                            onClick={() => {
                                                                const newVal = Math.max(0, customDistribution[key] - 5);
                                                                setCustomDistribution({...customDistribution, [key]: newVal});
                                                            }}
                                                            className={`w-8 h-8 rounded-lg text-slate-400 transition-all border border-white/10 flex items-center justify-center font-bold ${
                                                                isLocked
                                                                    ? 'bg-white/5 cursor-not-allowed text-slate-600'
                                                                    : 'bg-white/5 hover:bg-white/10 hover:text-white cursor-pointer'
                                                            }`}
                                                        >−5</button>
                                                        <div className="w-16 text-center">
                                                            <span className="text-white font-bold text-sm">{customDistribution[key]}%</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            disabled={isLocked}
                                                            onClick={() => {
                                                                const newVal = Math.min(100, customDistribution[key] + 5);
                                                                setCustomDistribution({...customDistribution, [key]: newVal});
                                                            }}
                                                            className={`w-8 h-8 rounded-lg text-slate-400 transition-all border border-white/10 flex items-center justify-center font-bold ${
                                                                isLocked
                                                                    ? 'bg-white/5 cursor-not-allowed text-slate-600'
                                                                    : 'bg-white/5 hover:bg-white/10 hover:text-white cursor-pointer'
                                                            }`}
                                                        >+5</button>
                                                    </div>
                                                    <div className="flex-grow h-2 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all ${isLocked ? 'bg-slate-600' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`}
                                                            style={{width: `${customDistribution[key]}%`}}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-xs text-slate-500">Total:</span>
                                            <span className={`text-sm font-bold ${
                                                Object.values(customDistribution).reduce((a,b) => a+b, 0) === 100
                                                    ? 'text-emerald-400'
                                                    : 'text-red-400'
                                            }`}>
                                                {Object.values(customDistribution).reduce((a,b) => a+b, 0)}%
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-4">
                                <p className="text-xs text-slate-500">
                                    {isSavingStructure ? 'Saving curriculum structure...' : 'Lesson content and quiz questions will be generated based on these settings'}
                                </p>
                                <button
                                    type="submit"
                                    disabled={isSavingStructure}
                                    className={`px-8 py-3 rounded-xl flex items-center gap-2 text-xs uppercase font-black tracking-widest border-none transition-all shadow-lg ${
                                        isSavingStructure
                                            ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                                            : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black cursor-pointer hover:scale-105 shadow-cyan-500/20'
                                    }`}
                                >
                                    <Zap size={14} fill="currentColor" /> {isSavingStructure ? 'Saving...' : 'Generate Content'}
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
