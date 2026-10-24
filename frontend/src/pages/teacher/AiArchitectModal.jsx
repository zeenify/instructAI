import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, FileText, BookOpen, Code2, Gauge, Layers, ListOrdered, Route } from 'lucide-react';
import { toast } from 'sonner';
import Dropdown from '../../components/ui/Dropdown';

export default function AiArchitectModal({ isOpen, onClose, onExecute, curriculumFile, courseLanguage }) {
    const [prompt, setPrompt] = useState("");

    // Structure Generation Parameters (ONLY these shown in this modal)
    const [params, setParams] = useState({
        difficulty: 'beginner',
        moduleCount: '3-5',
        moduleCountCustom: false,
        lessonsPerModule: '3-5',
        lessonsCustom: false,
        includeQuiz: true,
        // Off by default — coding challenges are where generated content
        // struggles most; teachers opt in per course.
        includeCodingExercises: false,
        pacing: 'standard'
    });

    // Without a curriculum file this prompt is the ONLY source the AI gets —
    // it must say something. With a file, the description is optional extra
    // steering and the AI can generate from the document alone.
    const promptRequired = !curriculumFile;
    const canGenerate = prompt.trim().length >= 10;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (promptRequired && !canGenerate) {
            // Stay clickable and explain, instead of a silently dead button
            toast.error('Describe the course in at least a sentence — the AI builds everything from this.');
            return;
        }
        // Pass only structure params - content params will be set in ContentParametersModal
        onExecute(prompt, null, params);
        setPrompt("");
    };

    if (!isOpen) return null;

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
                            <span className="ed-card-label">Course planner</span>
                            <h2 className="gen-title">Describe the course you want</h2>
                        </div>
                        <button type="button" onClick={onClose} className="gen-close" title="Close">
                            <X size={18} />
                        </button>
                    </div>

                    {curriculumFile ? (
                        <p className="gen-note">
                            <FileText size={13} style={{ verticalAlign: '-2px' }} /> Using your file:{' '}
                            <strong>{curriculumFile}</strong>
                        </p>
                    ) : (
                        <p className="gen-note">
                            No curriculum file — the AI builds everything from the description below, so be specific.
                        </p>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: 16 }}>
                        <div>
                            <label className="gen-label">
                                {curriculumFile ? 'Additional instructions (optional)' : 'Course description'}
                            </label>
                            <textarea
                                autoFocus
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder={curriculumFile
                                    ? 'Any specific requirements or focus areas...'
                                    : 'e.g. Grade 11 Python course covering variables, conditionals, and loops, with real-life Filipino examples and a quiz per module...'}
                                className="gen-textarea"
                            />
                            {!promptRequired && !canGenerate && (
                                <p className="gen-note" style={{ marginTop: 6 }}>
                                    Optional — leave empty and the AI works straight from your curriculum file.
                                </p>
                            )}
                            {promptRequired && !canGenerate && (
                                <p className="gen-note" style={{ marginTop: 6 }}>
                                    Give it at least a sentence so the AI has something to work with.
                                </p>
                            )}
                        </div>

                        <div>
                            <span className="gen-label"><Gauge size={12} style={{ verticalAlign: '-2px' }} /> Structure</span>
                            <div className="gen-2col">
                                <div>
                                    <label className="gen-label" style={{ marginTop: 4 }}>Difficulty</label>
                                    <Dropdown
                                        fullWidth
                                        value={params.difficulty}
                                        onChange={(v) => setParams({ ...params, difficulty: v })}
                                        options={[
                                            { value: 'beginner', label: 'Beginner' },
                                            { value: 'intermediate', label: 'Intermediate' },
                                            { value: 'advanced', label: 'Advanced' },
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="gen-label" style={{ marginTop: 4 }}>Pacing</label>
                                    <Dropdown
                                        fullWidth
                                        value={params.pacing}
                                        onChange={(v) => setParams({ ...params, pacing: v })}
                                        options={[
                                            { value: 'fast', label: 'Fast — fewer, denser lessons' },
                                            { value: 'standard', label: 'Standard' },
                                            { value: 'slow', label: 'Slow — more guided practice' },
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <span className="gen-label"><Layers size={12} style={{ verticalAlign: '-2px' }} /> Modules</span>
                            {params.moduleCountCustom ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="8"
                                        value={params.moduleCount}
                                        onChange={(e) => setParams({ ...params, moduleCount: String(Math.max(1, Math.min(8, Number(e.target.value) || 1))) })}
                                        className="gen-input"
                                        placeholder="e.g., 6"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setParams({ ...params, moduleCountCustom: false, moduleCount: '3-5' })}
                                        className="gen-btn gen-btn-ghost"
                                    >
                                        Presets
                                    </button>
                                </div>
                            ) : (
                                <div className="gen-seg">
                                    {['2-3', '3-5', '5-7', '6-8'].map(range => (
                                        <button
                                            key={range}
                                            type="button"
                                            className={params.moduleCount === range ? 'on' : ''}
                                            onClick={() => setParams({ ...params, moduleCount: range })}
                                        >
                                            {range}{range === '6-8' ? ' (max)' : ''}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className={params.moduleCountCustom ? 'on' : ''}
                                        style={{ flex: 'none', padding: '8px 14px' }}
                                        onClick={() => setParams({ ...params, moduleCountCustom: true, moduleCount: '4' })}
                                    >
                                        Custom
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <span className="gen-label"><ListOrdered size={12} style={{ verticalAlign: '-2px' }} /> Lessons per module</span>
                            {params.lessonsCustom ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="number"
                                        min="1"
                                        max="8"
                                        value={params.lessonsPerModule}
                                        onChange={(e) => setParams({ ...params, lessonsPerModule: String(Math.max(1, Math.min(8, Number(e.target.value) || 1))) })}
                                        className="gen-input"
                                        placeholder="e.g., 4"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setParams({ ...params, lessonsCustom: false, lessonsPerModule: '3-5' })}
                                        className="gen-btn gen-btn-ghost"
                                    >
                                        Presets
                                    </button>
                                </div>
                            ) : (
                                <div className="gen-seg">
                                    {['2-3', '3-5', '5-7', '6-8'].map(range => (
                                        <button
                                            key={range}
                                            type="button"
                                            className={params.lessonsPerModule === range ? 'on' : ''}
                                            onClick={() => setParams({ ...params, lessonsPerModule: range })}
                                        >
                                            {range}{range === '6-8' ? ' (max)' : ''}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        className={params.lessonsCustom ? 'on' : ''}
                                        style={{ flex: 'none', padding: '8px 14px' }}
                                        onClick={() => setParams({ ...params, lessonsCustom: true, lessonsPerModule: '3' })}
                                    >
                                        Custom
                                    </button>
                                </div>
                            )}
                        </div>

                        <div>
                            <span className="gen-label"><Route size={12} style={{ verticalAlign: '-2px' }} /> Include</span>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className={`gen-check ${params.includeQuiz ? 'on' : ''}`}
                                    onClick={() => setParams({ ...params, includeQuiz: !params.includeQuiz })}
                                >
                                    <BookOpen size={14} /> Quiz per module
                                </button>
                                <button
                                    type="button"
                                    className={`gen-check ${params.includeCodingExercises ? 'on' : ''}`}
                                    onClick={() => setParams({ ...params, includeCodingExercises: !params.includeCodingExercises })}
                                >
                                    <Code2 size={14} /> Coding exercises
                                </button>
                            </div>
                        </div>

                        <div className="gen-foot">
                            <button type="button" onClick={onClose} className="gen-btn gen-btn-ghost">Cancel</button>
                            <button type="submit" className="gen-btn gen-btn-primary">
                                <Zap size={14} /> Design my curriculum
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
