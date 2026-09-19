import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, Video, Bot } from 'lucide-react';

export default function ContentParametersModal({ isOpen, onClose, onGenerate, structureParams, course, isSavingStructure = false }) {
    const [contentParams, setContentParams] = useState({
        contentDepth: 'standard',
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

    const distributionOptions = hasProgrammingContent ? [
        { value: 'balanced', label: 'Balanced', detail: '40 · 20 · 20 · 10 · 10' },
        { value: 'coding_heavy', label: 'Coding-heavy', detail: '20 · 10 · 10 · 5 · 55' },
        { value: 'theory_focused', label: 'Theory-focused', detail: '50 · 25 · 20 · 5 · 0' },
        { value: 'non_coding', label: 'Non-coding', detail: '40 · 25 · 25 · 10 · 0' },
        { value: 'custom', label: 'Custom', detail: 'set your own mix' },
    ] : [
        { value: 'theory_focused', label: 'Theory-focused', detail: '50 · 25 · 20 · 5 · 0' },
        { value: 'non_coding', label: 'Non-coding', detail: '40 · 25 · 25 · 10 · 0' },
        { value: 'custom', label: 'Custom', detail: 'coding locked to 0%' },
    ];

    const stepper = (key, label) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span className="gen-note">{label}</span>
            <input
                type="number"
                min="0"
                max="100"
                value={customDistribution[key]}
                onChange={(e) => setCustomDistribution({ ...customDistribution, [key]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                className="gen-input"
                style={{ width: 72, padding: '7px 10px' }}
            />
        </div>
    );

    return (
        <AnimatePresence>
            <div className="gen-overlay">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="gen-backdrop"
                />
                <motion.div
                    initial={{ scale: 0.96, opacity: 0, y: 10 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.96, opacity: 0, y: 10 }}
                    transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                    className="gen-card wide"
                >
                    <div className="gen-head">
                        <div>
                            <span className="ed-card-label">Stage 2 · content settings</span>
                            <h2 className="gen-title">How should lessons and quizzes feel?</h2>
                        </div>
                        <button type="button" onClick={onClose} className="gen-close" title="Close">
                            <X size={18} />
                        </button>
                    </div>

                    <div>
                        <span className="gen-label"><BookOpen size={12} style={{ verticalAlign: '-2px' }} /> Lessons</span>
                        <div className="gen-2col">
                            <div>
                                <label className="gen-label" style={{ marginTop: 4 }}>Content depth</label>
                                <select
                                    value={contentParams.contentDepth}
                                    onChange={(e) => setContentParams({ ...contentParams, contentDepth: e.target.value })}
                                    className="gen-select"
                                >
                                    <option value="concise">Concise — straight to the point</option>
                                    <option value="standard">Standard</option>
                                    <option value="detailed">Detailed — lots of examples</option>
                                </select>
                            </div>
                            <div>
                                <label className="gen-label" style={{ marginTop: 4 }}>Writing style</label>
                                <select
                                    value={contentParams.writingStyle}
                                    onChange={(e) => setContentParams({ ...contentParams, writingStyle: e.target.value })}
                                    className="gen-select"
                                >
                                    <option value="simple">Simple</option>
                                    <option value="conversational">Conversational</option>
                                    <option value="formal">Formal</option>
                                    <option value="technical">Technical</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <span className="gen-label">Quiz questions</span>
                        <div className="gen-seg">
                            {distributionOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    title={opt.detail}
                                    className={getDisplayPreset() === opt.value ? 'on' : ''}
                                    onClick={() => setContentParams({ ...contentParams, questionTypeDistribution: opt.value })}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="gen-note" style={{ marginTop: 6 }}>
                            Mix of multiple choice · true/false · identification · enumeration · coding —
                            currently <strong>{codingPercentage}% coding</strong>.
                            {!hasProgrammingContent && ' This course is not marked as programming, so coding questions are off.'}
                        </p>
                        {contentParams.questionTypeDistribution === 'custom' && (
                            <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 12, background: 'var(--db-card-2)', border: '1px solid var(--db-border)', display: 'grid', gap: 8 }}>
                                {stepper('mc', 'Multiple choice %')}
                                {stepper('tf', 'True / False %')}
                                {stepper('id', 'Identification %')}
                                {stepper('enum', 'Enumeration %')}
                                {stepper('code', 'Coding %' + (hasProgrammingContent ? '' : ' (locked — course is non-programming)'))}
                                <p className="gen-note">Total: {Object.values(customDistribution).reduce((a, b) => a + Number(b || 0), 0)}%</p>
                            </div>
                        )}
                    </div>

                    <div>
                        <span className="gen-label">Quiz rules</span>
                        <div className="gen-2col">
                            <div>
                                <label className="gen-label" style={{ marginTop: 4 }}>Timer mode</label>
                                <div className="gen-seg">
                                    <button
                                        type="button"
                                        className={contentParams.quizTimerMode === 'entire_quiz' ? 'on' : ''}
                                        onClick={() => setContentParams({ ...contentParams, quizTimerMode: 'entire_quiz' })}
                                    >
                                        Whole quiz
                                    </button>
                                    <button
                                        type="button"
                                        className={contentParams.quizTimerMode === 'per_question' ? 'on' : ''}
                                        onClick={() => setContentParams({ ...contentParams, quizTimerMode: 'per_question' })}
                                    >
                                        Per question
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <div style={{ flex: 1 }}>
                                    <label className="gen-label" style={{ marginTop: 4 }}>
                                        Time limit ({contentParams.quizTimerMode === 'per_question' ? 'min/question' : 'minutes'})
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="180"
                                        value={contentParams.quizTimeLimit}
                                        onChange={(e) => setContentParams({ ...contentParams, quizTimeLimit: Number(e.target.value) })}
                                        className="gen-input"
                                    />
                                </div>
                                <div style={{ width: 110 }}>
                                    <label className="gen-label" style={{ marginTop: 4 }}>Passing score</label>
                                    <select
                                        value={contentParams.passingPercentage}
                                        onChange={(e) => setContentParams({ ...contentParams, passingPercentage: Number(e.target.value) })}
                                        className="gen-select"
                                    >
                                        <option value="60">60%</option>
                                        <option value="70">70%</option>
                                        <option value="80">80%</option>
                                        <option value="90">90%</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className={`gen-check ${contentParams.includeVideos ? 'on' : ''}`}
                            onClick={() => setContentParams({ ...contentParams, includeVideos: !contentParams.includeVideos })}
                        >
                            <Video size={14} /> Suggest YouTube videos in lessons
                        </button>
                        <button
                            type="button"
                            className={`gen-check ${contentParams.allowAIAssistance ? 'on' : ''}`}
                            onClick={() => setContentParams({ ...contentParams, allowAIAssistance: !contentParams.allowAIAssistance })}
                        >
                            <Bot size={14} /> Allow AI Tutor help during quizzes
                        </button>
                    </div>

                    <div className="gen-foot">
                        <button type="button" onClick={onClose} className="gen-btn gen-btn-ghost">Cancel</button>
                        <button
                            type="button"
                            onClick={handleGenerate}
                            disabled={isSavingStructure}
                            className="gen-btn gen-btn-primary"
                        >
                            <Sparkles size={14} /> {isSavingStructure ? 'Saving structure…' : 'Generate content'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
