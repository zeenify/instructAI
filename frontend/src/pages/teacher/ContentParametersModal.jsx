import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, BookOpen, Video, Bot } from 'lucide-react';
import Dropdown from '../../components/ui/Dropdown';

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

    // Coding share of the preset the teacher picked
    const selectedDist = contentParams.questionTypeDistribution;
    const selectedCodingPct =
        selectedDist === 'balanced' ? 10
        : selectedDist === 'coding_heavy' ? 55
        : selectedDist === 'theory_focused' ? 0
        : selectedDist === 'non_coding' ? 0
        : selectedDist === 'custom' ? customDistribution.code
        : 0;

    // Non-programming courses can't have coding questions — the effective
    // preset switches to non_coding so the UI never lies about what will happen
    const shouldBlockCoding = !hasProgrammingContent && selectedCodingPct > 0;
    const effectiveDist = shouldBlockCoding ? 'non_coding' : selectedDist;
    const codingPercentage = effectiveDist === 'non_coding' ? 0 : selectedCodingPct;

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
        { value: 'balanced', label: 'A mix of everything', detail: '40 · 20 · 20 · 10 · 10' },
        { value: 'coding_heavy', label: 'Mostly coding', detail: '20 · 10 · 10 · 5 · 55' },
        { value: 'non_coding', label: 'No coding', detail: '40 · 25 · 25 · 10 · 0' },
        { value: 'custom', label: "I'll set the mix", detail: 'adjust percentages yourself' },
    ] : [
        { value: 'non_coding', label: 'No coding', detail: '40 · 25 · 25 · 10 · 0' },
        { value: 'custom', label: "I'll set the mix", detail: 'no coding questions' },
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
                            <span className="ed-card-label">Step 3 of 3 · Settings</span>
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
                                <Dropdown
                                    fullWidth
                                    value={contentParams.contentDepth}
                                    onChange={(v) => setContentParams({ ...contentParams, contentDepth: v })}
                                    options={[
                                        { value: 'concise', label: 'Concise — straight to the point' },
                                        { value: 'standard', label: 'Standard' },
                                        { value: 'detailed', label: 'Detailed — lots of examples' },
                                    ]}
                                />
                            </div>
                            <div>
                                <label className="gen-label" style={{ marginTop: 4 }}>Writing style</label>
                                <Dropdown
                                    fullWidth
                                    value={contentParams.writingStyle}
                                    onChange={(v) => setContentParams({ ...contentParams, writingStyle: v })}
                                    options={[
                                        { value: 'simple', label: 'Simple' },
                                        { value: 'conversational', label: 'Conversational' },
                                        { value: 'formal', label: 'Formal' },
                                        { value: 'technical', label: 'Technical' },
                                    ]}
                                />
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
                                    className={effectiveDist === opt.value ? 'on' : ''}
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
                                    <Dropdown
                                        fullWidth
                                        menuUp
                                        value={String(contentParams.passingPercentage)}
                                        onChange={(v) => setContentParams({ ...contentParams, passingPercentage: Number(v) })}
                                        options={[
                                            { value: '60', label: '60%' },
                                            { value: '70', label: '70%' },
                                            { value: '80', label: '80%' },
                                            { value: '90', label: '90%' },
                                        ]}
                                    />
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
                            className="gen-btn gen-btn-primary"
                        >
                            <Sparkles size={14} /> Generate my lessons &amp; quizzes
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
