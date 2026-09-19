import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, BookOpen, HelpCircle, AlertCircle, RotateCcw } from 'lucide-react';

export default function CurriculumReviewModal({ isOpen, data, expectedParams, existingModules = 0, onCancel, onConfirm, onRegenerate }) {
    const [pendingData, setPendingData] = useState(null);
    const [destination, setDestination] = useState('append');
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

    const updateModuleTitle = (mIdx, val) => {
        const newData = JSON.parse(JSON.stringify(pendingData));
        newData.new_modules[mIdx].title = val;
        setPendingData(newData);
    };

    return (
        <div className="gen-overlay" style={{ zIndex: 170 }}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel} className="gen-backdrop" />
            <motion.div
                initial={{ scale: 0.96, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.96, opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                className="gen-card wide"
            >
                <div className="gen-head">
                    <div>
                        <span className="ed-card-label">Step 2 of 3 · Review</span>
                        <h2 className="gen-title">Check your course outline</h2>
                        <p className="gen-note" style={{ marginTop: 4 }}>
                            Edit any title or remove items — nothing is saved to your class yet.
                        </p>
                    </div>
                    <button type="button" onClick={onCancel} className="gen-close" title="Close"><X size={18} /></button>
                </div>

                {parameterMismatch && (
                    <div className="cur-strip err" style={{ alignItems: 'flex-start' }}>
                        <AlertCircle size={16} />
                        <div>
                            <p style={{ fontWeight: 700, marginBottom: 4 }}>{parameterMismatch.message}</p>
                            <ul style={{ margin: '0 0 8px', paddingLeft: 16 }}>
                                {parameterMismatch.details.map((detail, idx) => (
                                    <li key={idx}>{detail}</li>
                                ))}
                            </ul>
                            {parameterMismatch.regenerateOption && onRegenerate && (
                                <button
                                    type="button"
                                    onClick={onRegenerate}
                                    className="gen-btn gen-btn-ghost"
                                    style={{ padding: '7px 12px', color: 'var(--db-amber)' }}
                                >
                                    <RotateCcw size={13} />
                                    Regenerate structure
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {validationWarning && (
                    <div className="cur-strip err" style={{ alignItems: 'flex-start' }}>
                        <AlertCircle size={16} />
                        <div>
                            <p style={{ fontWeight: 700 }}>Exceeds recommended limits</p>
                            <p>{validationWarning} — remove some modules/lessons below to avoid rate limits during content generation.</p>
                        </div>
                    </div>
                )}

                {existingModules > 0 && (
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span className="gen-label" style={{ marginBottom: 0 }}>
                            This class already has {existingModules} module{existingModules === 1 ? '' : 's'} — what should happen to them?
                        </span>
                        <div className="gen-seg">
                            <button type="button" className={destination === 'append' ? 'on' : ''} onClick={() => setDestination('append')}>
                                Keep them, add these
                            </button>
                            <button type="button" className={destination === 'replace' ? 'on' : ''} onClick={() => setDestination('replace')}>
                                Replace them
                            </button>
                        </div>
                        {destination === 'replace' && (
                            <p className="gen-note" style={{ color: 'var(--db-amber)' }}>
                                Replacing permanently deletes the existing {existingModules} module{existingModules === 1 ? '' : 's'} with all their lessons and quizzes.
                            </p>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', paddingRight: 2 }}>
                    {pendingData.new_modules.map((module, mIdx) => (
                        <div
                            key={mIdx}
                            style={{ padding: '16px 18px', borderRadius: 14, background: 'var(--db-card-2)', border: '1px solid var(--db-border)' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span
                                    style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: 10.5,
                                        fontWeight: 700,
                                        letterSpacing: '0.08em',
                                        color: 'var(--db-accent-bright)',
                                        background: 'var(--db-accent-soft)',
                                        border: '1px solid var(--db-accent-border)',
                                        padding: '4px 10px',
                                        borderRadius: 999,
                                        flex: 'none',
                                    }}
                                >
                                    {String(mIdx + 1).padStart(2, '0')}
                                </span>
                                <input
                                    aria-label={`Module ${mIdx + 1} title`}
                                    className="gen-input"
                                    style={{ fontWeight: 700, fontFamily: 'var(--db-font-display)' }}
                                    value={module.title}
                                    onChange={(e) => updateModuleTitle(mIdx, e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(module.items || []).map((item, iIdx) => (
                                    <div
                                        key={iIdx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '9px 12px',
                                            borderRadius: 10,
                                            background: 'var(--db-card)',
                                            border: '1px solid var(--db-border)',
                                        }}
                                    >
                                        {item.type === 'lesson'
                                            ? <BookOpen size={15} style={{ color: 'var(--db-accent-bright)', flex: 'none' }} />
                                            : <HelpCircle size={15} style={{ color: 'var(--db-amber)', flex: 'none' }} />}
                                        <input
                                            aria-label={`${item.type} title`}
                                            className="gen-input review-item-input"
                                            style={{ border: 'none', background: 'transparent', padding: '4px 2px', boxShadow: 'none' }}
                                            value={item.title}
                                            onChange={(e) => {
                                                const newData = JSON.parse(JSON.stringify(pendingData));
                                                newData.new_modules[mIdx].items[iIdx].title = e.target.value;
                                                setPendingData(newData);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            title="Remove this item"
                                            aria-label={`Remove ${item.type} ${item.title}`}
                                            onClick={() => {
                                                const newData = JSON.parse(JSON.stringify(pendingData));
                                                newData.new_modules[mIdx].items.splice(iIdx, 1);
                                                setPendingData(newData);
                                            }}
                                            className="gen-close"
                                            style={{ color: 'var(--db-text-3)' }}
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}

                                {(!module.items || module.items.length === 0) && (
                                    <p className="gen-note" style={{ textAlign: 'center', padding: '8px 0' }}>No items in this module</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="gen-foot" style={{ borderTop: '1px solid var(--db-border)', paddingTop: 16 }}>
                    <button type="button" onClick={onCancel} className="gen-btn gen-btn-ghost">Discard</button>
                    <button type="button" onClick={() => onConfirm({ ...pendingData, mode: destination })} className="gen-btn gen-btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                        {destination === 'replace' ? 'Replace my class content' : 'Save to my class'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
