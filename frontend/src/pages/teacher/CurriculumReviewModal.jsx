import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Trash2, Edit3, BookOpen, HelpCircle, AlertCircle, RotateCcw } from 'lucide-react';

export default function CurriculumReviewModal({ isOpen, data, expectedParams, onCancel, onConfirm, onRegenerate }) {
    const [pendingData, setPendingData] = useState(null);
    const [validationWarning, setValidationWarning] = useState(null);
    const [parameterMismatch, setParameterMismatch] = useState(null);

    useEffect(() => {
        if (data) {
            setPendingData(data);
            validateCurriculum(data);
            validateParameters(data, expectedParams);
        }
    }, [data, expectedParams]);

    // Validate that generated curriculum matches requested parameters
    const validateParameters = (curriculumData, expected) => {
        if (!curriculumData || !expected || !curriculumData.new_modules) {
            setParameterMismatch(null);
            return;
        }

        const mismatches = [];
        const actualModules = curriculumData.new_modules.length;
        const expectedModuleRange = expected.moduleCount;

        // Parse expected module count (e.g., "3-5" or "5")
        const [minModules, maxModules] = expectedModuleRange.includes('-')
            ? expectedModuleRange.split('-').map(Number)
            : [parseInt(expectedModuleRange), parseInt(expectedModuleRange)];

        // Check if module count is outside expected range
        if (actualModules < minModules || actualModules > maxModules) {
            mismatches.push(`Expected ${minModules}-${maxModules} modules, got ${actualModules}`);
        }

        // Check if include_quiz was requested but missing
        if (expected.includeQuiz) {
            curriculumData.new_modules.forEach((mod, idx) => {
                const hasQuiz = (mod.items || []).some(item => item.type === 'quiz');
                if (!hasQuiz) {
                    mismatches.push(`Module ${idx + 1} missing quiz (expected per module)`);
                }
            });
        }

        // Check if coding exercises requested
        if (expected.includeCodingExercises) {
            const totalItems = curriculumData.new_modules.reduce((sum, mod) => sum + (mod.items || []).length, 0);
            if (totalItems === 0) {
                mismatches.push(`No coding content generated (expected coding exercises)`);
            }
        }

        if (mismatches.length > 0) {
            setParameterMismatch({
                message: 'Parameter Mismatch Detected',
                details: mismatches,
                regenerateOption: true
            });
        } else {
            setParameterMismatch(null);
        }
    };

    // Validate curriculum against limits
    const validateCurriculum = (curriculumData) => {
        if (!curriculumData || !curriculumData.new_modules) return;

        const modules = curriculumData.new_modules;
        const moduleCount = modules.length;
        const totalLessons = modules.reduce((sum, mod) => {
            const lessonCount = (mod.items || []).filter(item => item.type === 'lesson').length;
            return sum + lessonCount;
        }, 0);

        // Check limits (max 8 modules, max 8 lessons per module, max 64 total lessons)
        const warnings = [];
        if (moduleCount > 8) {
            warnings.push(`Too many modules (${moduleCount}/8 max)`);
        }

        modules.forEach((mod, idx) => {
            const lessonCount = (mod.items || []).filter(item => item.type === 'lesson').length;
            if (lessonCount > 8) {
                warnings.push(`Module ${idx + 1} has too many lessons (${lessonCount}/8 max)`);
            }
        });

        if (totalLessons > 64) {
            warnings.push(`Total lesson count too high (${totalLessons}/64 max)`);
        }

        if (warnings.length > 0) {
            setValidationWarning(warnings.join(' • '));
        } else {
            setValidationWarning(null);
        }
    };

    // Re-validate when pendingData changes
    useEffect(() => {
        if (pendingData) {
            validateCurriculum(pendingData);
        }
    }, [pendingData]);

    // Safety Guard: Don't render if closed or data is missing
    if (!isOpen || !pendingData || !pendingData.new_modules) return null;

    const removeItem = (mIdx, iIdx) => {
        const newData = JSON.parse(JSON.stringify(pendingData));
        newData.new_modules[mIdx].items.splice(iIdx, 1);
        setPendingData(newData);
    };

    const updateModuleTitle = (mIdx, val) => {
        const newData = JSON.parse(JSON.stringify(pendingData)); // Use deep clone here too
        newData.new_modules[mIdx].title = val;
        setPendingData(newData);
    };

    const updateItemTitle = (mIdx, type, iIdx, val) => {
        const newData = JSON.parse(JSON.stringify(pendingData)); // Use deep clone here too
        newData.new_modules[mIdx][type][iIdx].title = val;
        setPendingData(newData);
    };

    


    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-4xl bg-[#030014] border border-white/10 rounded-[40px] shadow-2xl flex flex-col max-h-[90vh]">

                <div style={{ padding: '50px 40px', marginBottom: '0' }} className="border-b border-white/5">
                    <div style={{ marginBottom: '24px', gap: '12px' }} className="flex justify-between items-center">
                        <div>
                            <h2 style={{ marginBottom: '4px' }} className="text-2xl font-black text-white uppercase tracking-tight">Review AI Blueprint</h2>
                            <p style={{ marginBottom: '0' }} className="text-slate-500 text-xs font-bold uppercase tracking-widest">Fine-tune the generated structure before saving</p>
                        </div>
                        <button onClick={onCancel} style={{ padding: '8px 10px' }} className="hover:bg-white/5 rounded-full border-none bg-transparent cursor-pointer text-slate-500"><X /></button>
                    </div>

                    {parameterMismatch && (
                        <div style={{ padding: '16px 20px', gap: '12px', marginBottom: '16px' }} className="flex items-start bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p style={{ marginBottom: '8px' }} className="text-yellow-500 text-sm font-bold">{parameterMismatch.message}</p>
                                <ul style={{ gap: '4px', marginBottom: '12px' }} className="text-yellow-400 text-xs space-y-1">
                                    {parameterMismatch.details.map((detail, idx) => (
                                        <li key={idx}>• {detail}</li>
                                    ))}
                                </ul>
                                {parameterMismatch.regenerateOption && (
                                    <>
                                        <p style={{ marginBottom: '12px' }} className="text-yellow-400/70 text-xs">The generated content doesn't match your parameters. You can regenerate to get better results.</p>
                                        {onRegenerate && (
                                            <button
                                                onClick={onRegenerate}
                                                style={{ padding: '10px 16px', gap: '8px' }}
                                                className="flex items-center bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-500 rounded-lg text-xs font-bold transition-all border-none cursor-pointer"
                                            >
                                                <RotateCcw size={14} />
                                                Regenerate Structure
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {validationWarning && (
                        <div style={{ padding: '16px 20px', gap: '12px' }} className="flex items-start bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                            <AlertCircle size={20} className="text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p style={{ marginBottom: '4px' }} className="text-yellow-500 text-sm font-bold">Exceeds Recommended Limits</p>
                                <p className="text-yellow-400 text-xs">{validationWarning}</p>
                                <p style={{ marginTop: '8px' }} className="text-yellow-400/70 text-xs">Remove some modules/lessons below to avoid rate limiting during content generation.</p>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: '40px', gap: '24px' }} className="flex-grow overflow-y-auto space-y-6 custom-scrollbar">
                    {pendingData.new_modules.map((module, mIdx) => (
                        <div key={mIdx} style={{ padding: '24px 28px' }} className="bg-white/[0.02] border border-white/5 rounded-3xl">
                            <div style={{ marginBottom: '24px', gap: '12px' }} className="flex items-center">
                                <span style={{ padding: '6px 12px' }} className="text-[10px] font-black text-purple-500 bg-purple-500/10 rounded">Module {mIdx + 1}</span>
                                <input
                                    style={{ marginBottom: '0' }}
                                    className="bg-transparent border-none outline-none text-xl font-bold text-white w-full focus:text-purple-400 transition-colors"
                                    value={module.title}
                                    onChange={(e) => updateModuleTitle(mIdx, e.target.value)}
                                />
                            </div>

                            {/* Replace the current items.map block with this */}
                            <div style={{ gap: '12px' }} className="space-y-2">
                                {/* Map through the unified items list */}
                                {(module.items || []).map((item, iIdx) => (
                                    <div key={iIdx} style={{ padding: '16px 20px', gap: '12px', marginBottom: '8px' }} className="flex items-center bg-white/5 rounded-xl border border-white/5 group">
                                        {/* Visual Icon based on type */}
                                        {item.type === 'lesson' ? 
                                            <BookOpen size={16} className="text-purple-500" /> : 
                                            <HelpCircle size={16} className="text-cyan-500" />
                                        }
                                        
                                        <input
                                            className="flex-grow bg-transparent border-none outline-none text-sm text-white"
                                            value={item.title}
                                            onChange={(e) => {
                                                const newData = JSON.parse(JSON.stringify(pendingData));
                                                newData.new_modules[mIdx].items[iIdx].title = e.target.value;
                                                setPendingData(newData);
                                            }}
                                        />

                                        {/* Remove individual item */}
                                        <button onClick={() => {
                                            const newData = JSON.parse(JSON.stringify(pendingData));
                                            newData.new_modules[mIdx].items.splice(iIdx, 1);
                                            setPendingData(newData);
                                        }} style={{ padding: '8px 10px' }} className="text-slate-600 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                ))}

                                {/* Empty State check */}
                                {(!module.items || module.items.length === 0) && (
                                    <p style={{ padding: '12px 16px', marginBottom: '0' }} className="text-[10px] text-center text-slate-600 font-bold uppercase">No items in this module</p>
                                )}
                            </div>
                                                    </div>
                    ))}
                </div>

                <div style={{ padding: '40px', gap: '16px' }} className="border-t border-white/5 flex">
                    <button onClick={onCancel} style={{ padding: '14px 22px' }} className="flex-1 rounded-2xl bg-white/5 text-slate-400 font-bold uppercase text-xs border-none cursor-pointer hover:bg-white/10 transition-all">Discard Changes</button>
                    <button onClick={() => onConfirm(pendingData)} style={{ padding: '14px 22px' }} className="flex-[2] rounded-2xl bg-purple-600 text-white font-black uppercase text-xs border-none cursor-pointer shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-95 transition-all">Commit to Course Timeline</button>
                </div>
            </motion.div>
        </div>
    );
}