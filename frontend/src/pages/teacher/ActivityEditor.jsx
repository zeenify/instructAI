import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import FormattedText from '../../components/ui/FormattedText';
import AutoGrowTextarea from '../../components/ui/AutoGrowTextarea';
import { useParams, useNavigate } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import {
    ChevronLeft, Plus, Trash2, Clock, Eye, EyeOff, Loader2, HelpCircle, Upload,
    BookOpen, UserCheck, AlertTriangle, FileText, Timer, Shuffle, Radio, Edit3, Check, X, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import api from '../../services/api';
import { classActivitiesKey } from '../../queries/classwork';
import { useEngineLanguages, availabilityMap } from '../../queries/engine';
import DateTimePicker from '../../components/teacher/DateTimePicker';
import DeleteModal from '../../components/ui/DeleteModal';
import CodeMirror from '@uiw/react-codemirror';
import { CODE_LANGUAGES, cmExtension, languageOf } from '../../utils/codeLanguages';
import TestCaseEditor from '../../components/teacher/TestCaseEditor';
import HtmlChecksEditor from '../../components/teacher/HtmlChecksEditor';
import AiQuestionModal from './AiQuestionModal';
import './ActivityEditor.css';

const QUESTION_TYPES = [
    { id: 'multiple_choice', label: 'Multiple Choice', sub: 'pick one correct option' },
    { id: 'true_false', label: 'True / False', sub: 'two choices' },
    { id: 'identification', label: 'Identification', sub: 'exact answer' },
    { id: 'enumeration', label: 'Enumeration', sub: 'list all answers' },
    { id: 'short_answer', label: 'Short Answer', sub: 'brief response' },
    { id: 'essay', label: 'Essay', sub: 'manually graded' },
    { id: 'coding', label: 'Coding', sub: 'their code is run and checked' },
];

const TIMER_MODES = [
    { id: 'none', label: 'No limit' },
    { id: 'entire_quiz', label: 'Whole quiz' },
    { id: 'per_question', label: 'Per question' },
];

const PER_QUESTION_DEFAULTS = {
    true_false: 20,
    multiple_choice: 40,
    identification: 60,
    short_answer: 60,
    enumeration: 90,
    coding: 300,
    essay: 300,
};

const at2359 = (d) => {
    const x = new Date(d);
    x.setHours(23, 59, 0, 0);
    // Full ISO with Z — a sliced-off zone would be re-parsed as local time
    // by the picker and shift the stored instant by the UTC offset.
    return x.toISOString();
};

const DEADLINE_PRESETS = [
    { label: 'Tonight', value: () => at2359(new Date()) },
    { label: 'Tomorrow', value: () => at2359(new Date(Date.now() + 86400000)) },
    {
        label: 'End of week',
        value: () => {
            const now = new Date();
            const diff = (6 - now.getDay() + 7) % 7 || 7; // next Saturday
            return at2359(now.getTime() + diff * 86400000);
        },
    },
];

function CreateQuestionModal({ isOpen, onClose, onCreated, editQuestion, onEdited, viewOnly = false }) {
    const isEditMode = !!editQuestion;
    // View mode: the activity has submissions — show every detail, change nothing
    const isViewMode = viewOnly && isEditMode;
    const [type, setType] = useState('multiple_choice');
    const [questionText, setQuestionText] = useState('');
    const [points, setPoints] = useState(1);
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctOption, setCorrectOption] = useState(0);
    const [expectedOutput, setExpectedOutput] = useState('');
    const [boilerplate, setBoilerplate] = useState('');
    const [language, setLanguage] = useState('java');
    // Set when the teacher switches language with custom starter code still in
    // the editor — tells them what to replace instead of stranding old code
    const [staleFrom, setStaleFrom] = useState(null);
    const [loading, setLoading] = useState(false);
    const { data: engineLangs } = useEngineLanguages();
    const langAvail = useMemo(() => availabilityMap(engineLangs), [engineLangs]);

    useEffect(() => {
        if (editQuestion) {
            setType(editQuestion.type || 'multiple_choice');
            setQuestionText(editQuestion.question_text || '');
            setPoints(Number(editQuestion.points) || 1);
            const opts = editQuestion.options || (editQuestion.type === 'multiple_choice' ? ['', '', '', ''] : []);
            setOptions(opts);
            if (editQuestion.type === 'multiple_choice') {
                const idx = opts.indexOf(editQuestion.expected_output);
                setCorrectOption(idx >= 0 ? idx : 0);
            } else if (editQuestion.type === 'true_false') {
                setCorrectOption(editQuestion.expected_output === 'False' ? 1 : 0);
            } else {
                setCorrectOption(0);
            }
            setExpectedOutput(editQuestion.expected_output || '');
            setBoilerplate(editQuestion.boilerplate || '');
            setLanguage(editQuestion.language || 'java');
            setStaleFrom(null);
        } else {
            setType('multiple_choice');
            setQuestionText('');
            setPoints(1);
            setOptions(['', '', '', '']);
            setCorrectOption(0);
            setExpectedOutput('');
            setBoilerplate('');
            setLanguage('java');
            setStaleFrom(null);
        }
    }, [editQuestion]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!questionText.trim()) return;

        if (type === 'multiple_choice') {
            const valid = options.filter(o => o.trim());
            if (valid.length < 2) {
                toast.error('Multiple choice needs at least 2 options');
                return;
            }
        }

        const safePoints = Math.max(1, Number(points) || 1);

        setLoading(true);
        try {
            const payload = {
                type,
                question_text: questionText.trim(),
                points: type === 'enumeration' ? safePoints * options.filter(o => o.trim()).length : safePoints,
            };
            if (type === 'multiple_choice') {
                const filteredOptions = options.filter(o => o.trim());
                payload.options = filteredOptions;
                payload.expected_output = String(correctOption);
            } else if (type === 'true_false') {
                payload.options = ['True', 'False'];
                payload.expected_output = correctOption === 0 ? 'True' : 'False';
            } else if (type === 'enumeration') {
                payload.options = options.filter(o => o.trim());
            } else if (type === 'coding') {
                payload.expected_output = expectedOutput;
                payload.boilerplate = boilerplate;
                payload.language = language;
            } else {
                payload.expected_output = expectedOutput;
            }
            if (isEditMode) {
                await onEdited(payload);
            } else {
                onCreated(payload);
            }
            onClose();
        } catch {
            toast.error(isEditMode ? 'Failed to update question' : 'Failed to create question');
        } finally {
            setLoading(false);
        }
    };

    const activeLang = languageOf(language);
    const insertTemplate = () => {
        setBoilerplate(activeLang.template);
        setStaleFrom(null);
    };

    // Switching language must not silently strand starter code written for the
    // old one: an untouched default template travels with the switch, custom
    // starter code stays but is flagged so the teacher sees what to replace.
    const pickLanguage = (id) => {
        if (id === language) return;
        const from = languageOf(language);
        const to = languageOf(id);
        if (boilerplate && boilerplate !== from.template) {
            setStaleFrom(from.label);
        } else if (boilerplate) {
            setBoilerplate(to.template);
        }
        setLanguage(id);
    };

    if (!isOpen) return null;

    return (
        <div className="db-modal-backdrop" onClick={onClose}>
            <div className="db-modal ae-qm" onClick={(e) => e.stopPropagation()}>
                <button className="db-modal-close" onClick={onClose} type="button"><X size={17} /></button>

                <form onSubmit={handleSubmit}>
                    <div className="db-modal-head" style={{ marginBottom: 18 }}>
                        <h3 className="db-modal-title" style={{ fontSize: 24 }}>{isViewMode ? 'View question' : isEditMode ? 'Edit question' : 'Add a question'}</h3>
                        <p className="db-modal-sub">{isViewMode ? 'Read-only — settings lock once students submit.' : isEditMode ? 'Changes apply to this question only.' : 'Pick the type, then fill in the details.'}</p>
                    </div>

                    <fieldset disabled={isViewMode} style={isViewMode ? { border: 'none', padding: 0, margin: 0, opacity: 0.92 } : undefined}>

                    {/* Type selector */}
                    <div style={{ marginBottom: 20 }}>
                        <span className="ae-field-label">Question type</span>
                        <div className="ae-qm-types">
                            {QUESTION_TYPES.map((t) => (
                                <button key={t.id} type="button" className={`ae-qm-type ${type === t.id ? 'selected' : ''}`}
                                    onClick={() => setType(t.id)}>
                                    {t.label}
                                    <span className="ae-qm-type-sub">{t.sub}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Question text */}
                    <label className="db-field" style={{ marginBottom: 16 }}>
                        <span className="db-field-label">Question</span>
                        <AutoGrowTextarea className="db-input db-textarea" value={questionText} onChange={(e) => setQuestionText(e.target.value)}
                            rows={3} maxRows={14} required placeholder="Enter your question..." />
                    </label>

                    {/* Points */}
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                        <div>
                            <span className="ae-field-label">{type === 'enumeration' ? 'Points per correct answer' : 'Points'}</span>
                            <input className="ae-input" type="number" min={1} step={1} value={points} style={{ width: 92 }}
                                aria-label={type === 'enumeration' ? 'Points per correct answer' : 'Points'}
                                onChange={(e) => setPoints(Math.min(1000, Math.max(1, Math.round(Number(e.target.value) || 1))))} />
                        </div>
                        {type === 'enumeration' && options.filter(o => o.trim()).length > 0 && (
                            <p className="ae-seg-hint" style={{ margin: '0 0 10px' }}>
                                Total: <strong style={{ color: 'var(--db-accent-bright)' }}>
                                    {points * options.filter(o => o.trim()).length} pts
                                </strong> ({options.filter(o => o.trim()).length} entries × {points} pts each)
                            </p>
                        )}
                    </div>

                    {/* Multiple Choice */}
                    {type === 'multiple_choice' && (
                        <div className="ae-qm-box" style={{ marginBottom: 18 }}>
                            <span className="ae-field-label">Options · click the circle to mark the correct one</span>
                            {options.map((opt, i) => (
                                <div key={i} className="ae-qm-option-row">
                                    <button type="button" className={`ae-qm-radio ${correctOption === i ? 'selected' : ''}`}
                                        onClick={() => setCorrectOption(i)} aria-label={`Mark option ${i + 1} correct`}>
                                        {correctOption === i && <span className="ae-qm-radio-dot" />}
                                    </button>
                                    <input className="ae-input" type="text" value={opt} style={{ flex: 1 }}
                                        onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                                        placeholder={'Option ' + (i + 1)} />
                                    {options.length > 2 && (
                                        <button type="button" className="ae-qm-add" style={{ margin: 0, padding: '8px 10px', borderStyle: 'solid', borderWidth: 1 }}
                                            onClick={() => {
                                                setOptions(options.filter((_, idx) => idx !== i));
                                                if (correctOption > i) setCorrectOption(correctOption - 1);
                                                else if (correctOption === i) setCorrectOption(0);
                                            }} title="Remove option">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" className="ae-qm-add" onClick={() => setOptions([...options, ''])}>
                                + Add option
                            </button>
                        </div>
                    )}

                    {/* True / False */}
                    {type === 'true_false' && (
                        <div className="ae-qm-box" style={{ marginBottom: 18 }}>
                            <span className="ae-field-label">Correct answer</span>
                            <div className="ae-seg">
                                {[{ label: 'True', idx: 0 }, { label: 'False', idx: 1 }].map((opt) => (
                                    <button key={opt.idx} type="button" className={`ae-seg-btn ${correctOption === opt.idx ? 'on' : ''}`}
                                        style={{ padding: '12px', fontSize: 14, fontWeight: 700 }}
                                        onClick={() => setCorrectOption(opt.idx)}>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Identification / Short Answer */}
                    {(type === 'identification' || type === 'short_answer') && (
                        <div className="ae-qm-box" style={{ marginBottom: 18 }}>
                            <span className="ae-field-label">Correct answer</span>
                            <input className="ae-input" type="text" value={expectedOutput} style={{ width: '100%' }}
                                onChange={(e) => setExpectedOutput(e.target.value)} placeholder="Expected answer" />
                            {type === 'short_answer' && (
                                <p className="ae-seg-hint">Graded case-insensitively against the student's answer.</p>
                            )}
                        </div>
                    )}

                    {/* Enumeration */}
                    {type === 'enumeration' && (
                        <div className="ae-qm-box" style={{ marginBottom: 18 }}>
                            <span className="ae-field-label">Correct answers · each correct entry earns points</span>
                            {options.map((opt, i) => (
                                <div key={i} className="ae-qm-option-row">
                                    <input className="ae-input" type="text" value={opt} style={{ flex: 1 }}
                                        onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }}
                                        placeholder={'Answer ' + (i + 1)} />
                                    {options.length > 1 && (
                                        <button type="button" className="ae-qm-add" style={{ margin: 0, padding: '8px 10px', borderStyle: 'solid', borderWidth: 1 }}
                                            onClick={() => setOptions(options.filter((_, idx) => idx !== i))} title="Remove answer">
                                            <Trash2 size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button type="button" className="ae-qm-add" onClick={() => setOptions([...options, ''])}>
                                + Add answer
                            </button>
                        </div>
                    )}

                    {/* Coding */}
                    {type === 'coding' && (
                        <div style={{ marginBottom: 18 }}>
                            <div className="ae-qm-box" style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11, flexWrap: 'wrap', gap: 10 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                        <span className="ae-field-label" style={{ margin: 0 }}>Language</span>
                                        <div className="ae-lang-group">
                                            {Object.values(CODE_LANGUAGES).map((l) => {
                                                // Unknown availability (probe still loading
                                                // or failed) never blocks the UI
                                                const unavailable = langAvail[l.id] === false;
                                                return (
                                                    <button key={l.id} type="button"
                                                        className={`ae-lang-chip ${language === l.id ? 'selected' : ''}`}
                                                        onClick={() => pickLanguage(l.id)}
                                                        disabled={unavailable}
                                                        title={unavailable
                                                            ? `${l.label} isn't installed on this execution server`
                                                            : l.preview ? 'Student pages render in a browser preview' : 'Runs on the execution engine'}>
                                                        <span className="ae-lang-dot" style={{ background: l.color }} />
                                                        {l.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <button type="button" className="cw-btn-mini" onClick={insertTemplate}>
                                        + {activeLang.label} template
                                    </button>
                                </div>
                                {langAvail[language] === false && (
                                    <p className="ae-lang-warn">
                                        The {activeLang.label} runtime isn't installed on this execution server — runs and verification will fail until it is.
                                    </p>
                                )}
                                {staleFrom && (
                                    <p className="ae-lang-warn">
                                        The starter code was written for {staleFrom} — press “+ {activeLang.label} template” to replace it, or rewrite it for {activeLang.label}.
                                    </p>
                                )}
                                <div style={{ borderRadius: 11, overflow: 'hidden', border: '1px solid var(--db-border-strong)' }}>
                                    <CodeMirror value={boilerplate} height="180px"
                                        onChange={(val) => { setBoilerplate(val); if (!val || val === activeLang.template) setStaleFrom(null); }}
                                        extensions={[cmExtension(language)]} theme="dark" />
                                </div>
                            </div>
                            <div className="ae-qm-box">
                                <span className="ae-field-label">{activeLang.preview ? 'Expected content on the page' : 'Expected output'}</span>
                                <input className="ae-input" type="text" value={expectedOutput} style={{ width: '100%' }}
                                    onChange={(e) => setExpectedOutput(e.target.value)}
                                    placeholder={activeLang.preview ? 'Text that must appear on the rendered page' : 'What the program should output'} />
                            </div>
                        </div>
                    )}

                    {/* Essay */}
                    {type === 'essay' && (
                        <div className="ae-qm-box" style={{ marginBottom: 18, textAlign: 'center' }}>
                            <p style={{ fontSize: 13.5, color: 'var(--db-text-2)', margin: 0 }}>
                                Essay questions are manually graded — no expected answer needed.
                            </p>
                        </div>
                    )}

                    </fieldset>

                    <div className="db-modal-actions">
                        <button type="button" className="db-btn-ghost" onClick={onClose}>{isViewMode ? 'Close' : 'Cancel'}</button>
                        {!isViewMode && (
                            <button type="submit" className="db-btn-primary" disabled={loading}>
                                {isEditMode ? 'Save changes' : 'Add question'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

function QuestionBlock({ question, index, onUpdate, onDelete, onEdit, disabled, dragControls }) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(question.question_text);

    // Question-detail patches (html checks, partial credit…) must land in the
    // parent's state IMMEDIATELY: HtmlChecksEditor builds every keystroke from
    // the checks prop, so waiting for the PUT round-trip would drop characters.
    // The network write is debounced behind the optimistic update.
    const latestQuestionRef = useRef(question);
    latestQuestionRef.current = question;
    const pendingPatchRef = useRef(null);
    const patchTimerRef = useRef(null);

    useEffect(() => () => {
        clearTimeout(patchTimerRef.current);
        const patch = pendingPatchRef.current;
        const q = latestQuestionRef.current;
        if (patch && q?.id && q?.activity_id) {
            api.put(`/teacher/activities/${q.activity_id}/questions/${q.id}`, patch).catch(() => {});
        }
    }, []);

    const persistPatch = async () => {
        const patch = pendingPatchRef.current;
        const q = latestQuestionRef.current;
        if (!patch || !q?.id || !q?.activity_id) return;
        pendingPatchRef.current = null;
        try {
            await api.put(`/teacher/activities/${q.activity_id}/questions/${q.id}`, patch);
        } catch {
            toast.error('Failed to save question changes');
            pendingPatchRef.current = { ...patch, ...(pendingPatchRef.current || {}) };
        }
    };

    const patchQuestion = (payload) => {
        onUpdate({ ...latestQuestionRef.current, ...payload });
        pendingPatchRef.current = { ...(pendingPatchRef.current || {}), ...payload };
        clearTimeout(patchTimerRef.current);
        patchTimerRef.current = setTimeout(persistPatch, 700);
    };

    const save = async (field) => {
        if (field === 'text' && text.trim() === question.question_text) return;
        const payload = {};
        if (field === 'text') payload.question_text = text;
        try {
            await api.put('/teacher/activities/' + question.activity_id + '/questions/' + question.id, payload);
            onUpdate({ ...question, ...payload });
        } catch {
            toast.error('Failed to save');
        }
    };

    const getTypeLabel = (t) => QUESTION_TYPES.find(qt => qt.id === t)?.label || t;

    return (
        <div className="ae-q">
            {disabled && !question.is_temp && (
                <div className="ae-q-tools">
                    <button type="button" className="ed-tool" onClick={() => onEdit?.(question)} title="View question details">
                        <Eye size={14} />
                    </button>
                </div>
            )}
            {!disabled && !question.is_temp && (
                <div className="ae-q-tools">
                    <button type="button" className="ed-tool ed-tool-grip"
                        onPointerDown={(e) => dragControls?.start(e)} title="Drag to reorder">
                        <GripIcon />
                    </button>
                    <button type="button" className="ed-tool" onClick={() => onEdit?.(question)} title="Edit question">
                        <Edit3 size={14} />
                    </button>
                    <button type="button" className="ed-tool ed-tool-del" onClick={() => onDelete(question)} title="Delete question">
                        <Trash2 size={14} />
                    </button>
                </div>
            )}

            <div className="ae-q-head">
                <span className="ae-q-num">#{index + 1}</span>
                <span className="ae-q-type">{getTypeLabel(question.type)}</span>
                <span className="ae-q-points">{question.points} pt{Number(question.points) !== 1 ? 's' : ''}</span>
                {question.is_temp && <span className="ae-q-saving">Saving…</span>}
            </div>

            {isEditing ? (
                <AutoGrowTextarea className="ae-q-textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus
                    onBlur={() => { setIsEditing(false); save('text'); }} />
            ) : (
                <p className="ae-q-text" onClick={() => !disabled && !question.is_temp && setIsEditing(true)}>
                    <FormattedText text={question.question_text} />
                </p>
            )}

            {question.type === 'coding' && !question.is_temp && (
                <div className="ae-q-body">
                    {disabled ? (
                        <p className="ae-q-locked-note">Partial credit: {question.partial_credit ? 'on' : 'off'} — open the eye icon for the full question view.</p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => patchQuestion({ partial_credit: !question.partial_credit })}
                            className={`ae-credit ${question.partial_credit ? 'on' : ''}`}
                            title="Off: every test must pass for full points. On: points × tests passed."
                        >
                            <span className="ae-credit-track"><span className="ae-credit-knob" /></span>
                            Allow partial credit
                        </button>
                    )}

                    {(question.language || 'java') === 'html' ? (
                        <div style={disabled ? { pointerEvents: 'none', opacity: 0.75 } : undefined}>
                            <HtmlChecksEditor
                                title="Page Checks"
                                checks={question.html_checks || []}
                                onChange={(next) => patchQuestion({ html_checks: next })}
                                referenceHtml={question.reference_code || ''}
                                onReferenceChange={(text) => patchQuestion({ reference_code: text })}
                            />
                        </div>
                    ) : (
                        <TestCaseEditor question={question} apiBase="/teacher/activity-questions" readOnly={disabled} />
                    )}
                </div>
            )}
        </div>
    );
}

function GripIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="3" r="1.4" /><circle cx="11" cy="3" r="1.4" />
            <circle cx="5" cy="8" r="1.4" /><circle cx="11" cy="8" r="1.4" />
            <circle cx="5" cy="13" r="1.4" /><circle cx="11" cy="13" r="1.4" />
        </svg>
    );
}

function ReorderItemWrapper({ question, index, onUpdate, onDelete, onEdit, disabled }) {
    const dragControls = useDragControls();
    return (
        <Reorder.Item value={question} dragListener={false} dragControls={dragControls} style={{ position: 'relative' }}>
            <QuestionBlock question={question} index={index} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} disabled={disabled} dragControls={dragControls} />
        </Reorder.Item>
    );
}

export default function ActivityEditor() {
    const { classId, activityId } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [activity, setActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saveState, setSaveState] = useState('saved');
    const originalRef = useRef(null);
    const dirtyRef = useRef({});
    const saveTimerRef = useRef(null);
    const savingRef = useRef(false);
    const pendingFlushRef = useRef(false);
    const [showAddQuestion, setShowAddQuestion] = useState(false);
    const [showAiQuestions, setShowAiQuestions] = useState(false);
    const [editQuestion, setEditQuestion] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteFileTarget, setDeleteFileTarget] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [confirmUnpublish, setConfirmUnpublish] = useState(false);

    const handleUploadFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingFile(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post('/teacher/activities/' + activityId + '/upload-instruction-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setActivity((prev) => ({ ...prev, instruction_files: res.data }));
            toast.success('File uploaded');
        } catch {
            toast.error('Failed to upload file');
        } finally {
            setUploadingFile(false);
            e.target.value = '';
        }
    };

    const handleDeleteFile = async (publicId) => {
        if (!publicId) {
            toast.error('Cannot delete file: missing identifier');
            return;
        }
        try {
            const res = await api.post('/teacher/activities/' + activityId + '/delete-instruction-file', { public_id: publicId });
            setActivity((prev) => ({ ...prev, instruction_files: res.data }));
            toast.success('File removed');
        } catch (err) {
            console.error('Delete file error:', err.response?.data || err.message);
            toast.error(err.response?.data?.message || 'Failed to remove file');
        }
    };

    const handleConfirmDeleteFile = () => {
        if (deleteFileTarget) {
            handleDeleteFile(deleteFileTarget);
            setDeleteFileTarget(null);
        }
    };

    const fetchActivity = useCallback(async () => {
        try {
            const res = await api.get(`/teacher/activities/${activityId}`, { bypassCache: true });
            setActivity(res.data);
            originalRef.current = res.data;
        } catch {
            toast.error('Failed to load activity');
            navigate(`/dashboard/teacher/class/${classId}`);
        } finally {
            setLoading(false);
        }
    }, [activityId, classId, navigate]);

    useEffect(() => { fetchActivity(); }, [fetchActivity]);

    const flushSave = useCallback(async () => {
        if (savingRef.current) {
            pendingFlushRef.current = true;
            return;
        }
        const dirty = dirtyRef.current;
        if (Object.keys(dirty).length === 0) return;
        dirtyRef.current = {};
        savingRef.current = true;
        setSaveState('saving');
        try {
            await api.put(`/teacher/activities/${activityId}`, dirty);
            originalRef.current = { ...originalRef.current, ...dirty };
            setSaveState('saved');
        } catch {
            dirtyRef.current = { ...dirty, ...dirtyRef.current };
            setSaveState('error');
            toast.error('Failed to save', { id: 'activity-save-error' });
        } finally {
            savingRef.current = false;
            if (pendingFlushRef.current) {
                pendingFlushRef.current = false;
                flushSave();
            }
        }
    }, [activityId]);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { flushSave(); }, 1000);
    }, [flushSave]);

    const handleFieldChange = useCallback((field, value) => {
        setActivity((prev) => ({ ...prev, [field]: value }));
        const original = originalRef.current;
        if (original && original[field] === value) {
            if (field in dirtyRef.current) {
                const next = { ...dirtyRef.current };
                delete next[field];
                dirtyRef.current = next;
            }
        } else {
            dirtyRef.current = { ...dirtyRef.current, [field]: value };
        }
        setSaveState((s) => (s === 'saving' ? s : 'dirty'));
        scheduleSave();
    }, [scheduleSave]);

    useEffect(() => {
        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
            flushSave();
        };
    }, [flushSave]);

    // Tab close / reload safety net while there are unsaved edits
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (dirtyRef.current && Object.keys(dirtyRef.current).length > 0) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, []);

    const refreshList = () => {
        queryClient.invalidateQueries({ queryKey: classActivitiesKey(classId) });
    };

    const handlePublish = async () => {
        if (activity.is_published) {
            // Unpublishing hides the activity from every student — confirm first
            if (!confirmUnpublish) {
                setConfirmUnpublish(true);
                setTimeout(() => setConfirmUnpublish(false), 3500);
                return;
            }
            setConfirmUnpublish(false);
        } else {
            // Client-side guardrails mirroring the backend, so teachers get an
            // actionable message instead of a failed publish.
            if (activity.activity_type === 'quiz' && (activity.questions?.length ?? 0) === 0) {
                toast.error('Add at least one question before publishing the quiz');
                return;
            }
            if (
                activity.activity_type === 'quiz' &&
                activity.pacing_mode !== 'teacher' &&
                activity.timer_mode === 'entire_quiz' &&
                !(Number(activity.time_limit_minutes) >= 1)
            ) {
                toast.error('Set the minutes for the whole-quiz timer before publishing');
                return;
            }
        }
        setPublishing(true);
        try {
            const res = await api.post(`/teacher/activities/${activityId}/publish`);
            setActivity((prev) => ({ ...prev, is_published: res.data.is_published }));
            refreshList();
            if (res.data.is_published) {
                toast.success('Published — students can now see it');
            } else {
                toast.warning('Unpublished');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to toggle publish');
        } finally {
            setPublishing(false);
        }
    };

    const handleAddQuestion = async (payload) => {
        const tempId = 'temp-' + Date.now();
        const tempQuestion = {
            id: tempId,
            activity_id: activityId,
            type: payload.type,
            question_text: payload.question_text,
            options: payload.options || [],
            expected_output: payload.expected_output || '',
            boilerplate: payload.boilerplate || '',
            language: payload.language || 'java',
            points: payload.points,
            order_index: (activity?.questions?.length ?? 0) + 1,
            is_temp: true,
        };
        setActivity((prev) => ({ ...prev, questions: [...(prev.questions || []), tempQuestion] }));
        try {
            const res = await api.post(`/teacher/activities/${activityId}/questions`, payload);
            setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === tempId ? res.data : q)) }));
            toast.success('Question added');
        } catch {
            setActivity((prev) => ({ ...prev, questions: (prev.questions || []).filter((q) => q.id !== tempId) }));
            toast.error('Failed to add question');
        }
    };

    const handleUpdateQuestion = (updated) => {
        setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === updated.id ? updated : q)) }));
    };

    const handleDeleteQuestion = async (question) => {
        try {
            await api.delete(`/teacher/activities/${activityId}/questions/${question.id}`);
            setActivity((prev) => ({ ...prev, questions: (prev.questions || []).filter((q) => q.id !== question.id) }));
            toast.success('Question removed');
        } catch {
            toast.error('Failed to delete question');
        }
    };

    const handleEditQuestionSubmit = async (payload) => {
        if (!editQuestion) return;
        try {
            const res = await api.put(`/teacher/activities/${activityId}/questions/${editQuestion.id}`, payload);
            setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === editQuestion.id ? res.data : q)) }));
            setEditQuestion(null);
            toast.success('Question updated');
        } catch {
            toast.error('Failed to update question');
        }
    };

    const handleReorderQuestions = async (newOrder) => {
        setActivity((prev) => ({ ...prev, questions: newOrder }));
        try {
            await api.post(`/teacher/activities/${activityId}/questions/reorder`, { question_ids: newOrder.map((q) => q.id) });
        } catch {
            toast.error('Failed to reorder');
        }
    };

    if (loading) {
        return (
            <div className="ed-shell" style={{ paddingBottom: 90 }}>
                <div className="db-skeleton" style={{ height: 92, borderRadius: 16, marginBottom: 22 }} />
                <div className="ae-grid">
                    <div className="db-skeleton" style={{ height: 380, borderRadius: 16 }} />
                    <div className="db-skeleton" style={{ height: 300, borderRadius: 16 }} />
                </div>
            </div>
        );
    }

    if (!activity) return null;

    const isQuiz = activity.activity_type === 'quiz';
    const isMaterial = activity.submission_type === 'material';
    const isLive = activity.is_live;
    const isPastDue = activity.deadline_at && new Date(activity.deadline_at) < new Date();
    const isLocked = activity.is_published && (activity.submissions_count || 0) > 0;
    const quizSettingsDisabled = isQuiz && (isLive || isLocked);
    const questionsDisabled = isPastDue || isLocked;
    const totalQuestionPoints = (activity.questions || []).reduce((sum, q) => sum + Number(q.points), 0);
    const perQuestionDurations = { ...PER_QUESTION_DEFAULTS, ...(activity.per_question_durations || {}) };

    // One canonical header state (mirrors the card logic on the Classwork tab)
    const headerState = (() => {
        if (!activity.is_published) return 'draft';
        if (isLive && activity.close_room_at) return 'reopened';
        if (isLive && activity.live_status === 'paused') return 'paused';
        if (isLive) return 'live';
        if (isPastDue || activity.live_status === 'completed' || activity.close_room_at) return 'closed';
        return 'published';
    })();

    const badge = {
        draft: { label: 'Draft', cls: 'draft' },
        published: { label: 'Published', cls: 'published' },
        live: { label: 'Live', cls: 'live', pulse: true },
        paused: { label: 'Paused', cls: 'live' },
        reopened: { label: 'Reopened', cls: 'closed' },
        closed: { label: 'Closed', cls: 'closed' },
    }[headerState];

    const kickerText = isQuiz
        ? `Quiz · ${activity.pacing_mode === 'teacher' ? 'Teacher-paced' : 'Student-paced'}`
        : `Activity · ${activity.submission_type === 'file' ? 'File submission' : activity.submission_type === 'questions' ? 'Questions' : 'Material'}`;

    const statusText = {
        saved: 'Saved',
        dirty: 'Unsaved changes',
        saving: 'Saving…',
        error: 'Save failed',
    }[saveState];

    return (
        <div className="ed-shell" style={{ paddingBottom: 90 }}>
            <header className="ed-header">
                <div className="ed-header-left">
                    <button className="ed-back-icon" onClick={() => navigate(`/dashboard/teacher/class/${classId}?tab=classwork`)}
                        title="Back to class" type="button">
                        <ChevronLeft size={19} />
                    </button>
                    <div className="ed-title-block">
                        <div className="ed-kicker-row">
                            <span className="ed-kicker">{kickerText}</span>
                            <span className={`ae-badge ${badge.cls}`}>
                                {badge.pulse && <span className="ae-badge-dot pulse" />}
                                {badge.label}
                            </span>
                        </div>
                        <input className="ed-title-input" value={activity.title} onChange={(e) => handleFieldChange('title', e.target.value)}
                            readOnly={isLocked || isPastDue} placeholder="Untitled" />
                        <div className="ed-meta">
                            {[
                                (isQuiz || activity.submission_type === 'questions') && (activity.questions || []).length > 0
                                    ? `${(activity.questions || []).length} question${(activity.questions || []).length !== 1 ? 's' : ''} · ${totalQuestionPoints} pts`
                                    : null,
                                activity.submissions_count !== undefined
                                    ? isMaterial
                                        ? `${activity.submissions_count} view${activity.submissions_count !== 1 ? 's' : ''}`
                                        : `${activity.submissions_count} submission${activity.submissions_count !== 1 ? 's' : ''}`
                                    : null,
                                !isQuiz && activity.deadline_at && (
                                    <span key="due" style={{ color: isPastDue ? 'var(--db-danger)' : undefined }}>
                                        due {format(new Date(activity.deadline_at), 'MMM d, h:mm a')}
                                        {activity.deadline_behavior === 'soft' ? ' · late OK' : ' · closes at deadline'}
                                    </span>
                                ),
                            ].filter(Boolean).map((item, i) => (
                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    {i > 0 && <span className="ed-meta-sep">·</span>}
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="ed-header-actions">
                    <span className={`ed-status ${saveState}`}>
                        {saveState === 'saving' && <Loader2 className="animate-spin" size={13} />}
                        {statusText}
                    </span>
                    <button className="db-btn-ghost" onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activityId}/submissions`)}
                        type="button">
                        <UserCheck size={15} /> {isMaterial && !isQuiz ? 'View status' : 'Submissions'}
                    </button>
                    {activity.is_published ? (
                        <button
                            className={`db-btn-ghost ${confirmUnpublish ? 'ed-btn-warn' : ''}`}
                            onClick={handlePublish}
                            disabled={isPastDue || publishing}
                            type="button"
                            title={isPastDue ? 'Past-due activities stay published' : 'Unpublish — students will no longer see it'}
                        >
                            {publishing ? <Loader2 className="animate-spin" size={15} /> : confirmUnpublish ? <AlertTriangle size={15} /> : <Eye size={15} />}
                            {confirmUnpublish ? 'Unpublish?' : 'Published'}
                        </button>
                    ) : (
                        <button className="db-btn-primary" onClick={handlePublish} disabled={isPastDue || publishing} type="button">
                            {publishing ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
                            Publish
                        </button>
                    )}
                </div>
            </header>

            {/* State banners */}
            {isPastDue && (
                <div className="ae-banner danger">
                    <Clock size={16} style={{ flexShrink: 0 }} />
                    <span>This activity is past due — only the deadline can still be changed.</span>
                </div>
            )}
            {isLocked && !isPastDue && (
                <div className="ae-banner warn">
                    <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                    <span>
                        {isMaterial
                            ? `${activity.submissions_count} student${activity.submissions_count !== 1 ? 's' : ''} already viewed this material — most settings stay locked.`
                            : <>
                                {activity.submissions_count} submission{activity.submissions_count !== 1 ? 's' : ''} already in —
                                most settings are locked to keep grading fair. You can still adjust the deadline.
                              </>}
                    </span>
                </div>
            )}

            <div className="ae-grid">
                {/* Settings rail */}
                <div>
                    {/* Instructions */}
                    <div className="ae-card">
                        <h4 className="ae-card-label"><BookOpen size={13} /> Instructions</h4>
                        <AutoGrowTextarea className="ae-textarea" value={activity.description || ''}
                            onChange={(e) => handleFieldChange('description', e.target.value)} rows={5}
                            readOnly={isLocked || isPastDue}
                            placeholder="Add instructions for students..." />
                        {!(isLocked || isPastDue) && (
                            <label className="ae-attach">
                                <Upload size={15} />
                                {uploadingFile ? 'Uploading…' : 'Attach a file'}
                                <input type="file" onChange={handleUploadFile} disabled={uploadingFile} style={{ display: 'none' }}
                                    accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
                            </label>
                        )}
                        {(activity.instruction_files || []).length > 0 && (
                            <div>
                                {(activity.instruction_files || []).map((file, i) => (
                                    <div key={i} className="ae-file-row">
                                        <FileText size={13} style={{ color: 'var(--db-text-3)', flexShrink: 0 }} />
                                        <span className="ae-file-name">{file.name}</span>
                                        {!(isLocked || isPastDue) && (
                                            <button onClick={() => setDeleteFileTarget(file.public_id)} type="button"
                                                className="ed-tool ed-tool-del" style={{ width: 26, height: 26 }}
                                                title="Remove file">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Deadline (activities with something to submit).
                        Quizzes have no wall-clock deadline in either pacing
                        mode — the room's Close/Reopen lifecycle owns it. */}
                    {activity.submission_type !== 'material' && !isQuiz && (
                        <div className="ae-card">
                            <h4 className="ae-card-label"><Clock size={13} /> Deadline</h4>
                            <DateTimePicker value={activity.deadline_at} onChange={(val) => handleFieldChange('deadline_at', val)} />
                            <div className="ae-presets">
                                {DEADLINE_PRESETS.map((p) => (
                                    <button key={p.label} type="button" className="ae-preset"
                                        onClick={() => handleFieldChange('deadline_at', p.value())}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                            <div className="ae-seg" style={{ marginTop: 12 }}>
                                <button type="button" onClick={() => handleFieldChange('deadline_behavior', 'hard')}
                                    className={`ae-seg-btn ${activity.deadline_behavior === 'hard' ? 'on' : ''}`}>
                                    Closes at deadline
                                </button>
                                <button type="button" onClick={() => handleFieldChange('deadline_behavior', 'soft')}
                                    className={`ae-seg-btn ${activity.deadline_behavior === 'soft' ? 'on' : ''}`}>
                                    Late OK
                                </button>
                            </div>
                            <p className="ae-seg-hint">
                                {activity.deadline_behavior === 'hard'
                                    ? 'Submissions close the moment the deadline passes.'
                                    : 'Students can still submit after the deadline — they’re marked late so you can score them accordingly.'}
                            </p>
                        </div>
                    )}

                    {/* Grading (question-based activities) */}
                    {activity.submission_type === 'questions' && (
                        <div className="ae-card">
                            <h4 className="ae-card-label"><Check size={13} /> Grading</h4>
                            <div className="ae-seg">
                                {['auto', 'manual'].map((opt) => (
                                    <button key={opt} type="button" onClick={() => handleFieldChange('grading_method', opt)}
                                        disabled={isLocked || isPastDue}
                                        className={`ae-seg-btn ${activity.grading_method === opt ? 'on' : ''}`}>
                                        {opt === 'manual' ? 'Manual grade' : 'Auto-grade'}
                                    </button>
                                ))}
                            </div>
                            <p className="ae-seg-hint">
                                {activity.grading_method === 'manual'
                                    ? 'You review and score every submission yourself.'
                                    : 'Objective questions are scored automatically; essays stay in your queue.'}
                            </p>
                        </div>
                    )}

                    {/* Quiz settings */}
                    {isQuiz && (
                        <div className="ae-card">
                            <h4 className="ae-card-label"><Timer size={13} /> Quiz settings</h4>

                            {quizSettingsDisabled && (
                                <div className="ae-banner warn" style={{ padding: '10px 13px', margin: '0 0 14px', fontSize: 12.5 }}>
                                    {isLive ? 'This quiz is live — settings unlock when the room closes.' : 'Settings locked once students joined.'}
                                </div>
                            )}

                            {/* Pacing (fixed at creation) */}
                            <div style={{ marginBottom: 15 }}>
                                <span className="ae-field-label">Pacing</span>
                                <span className="ae-chip"><Radio size={13} />
                                    {activity.pacing_mode === 'teacher' ? 'Teacher-paced' : 'Student-paced'}
                                </span>
                            </div>

                            {/* Timer — the teacher paces the questions themselves,
                                so a clock only fights the teacher. Teacher-paced
                                quizzes are always No limit. */}
                            {activity.pacing_mode === 'teacher' ? (
                                <div style={{ marginBottom: 15 }}>
                                    <span className="ae-field-label">Timer</span>
                                    <span className="ae-chip" style={{ background: 'var(--db-card-2)' }}>
                                        <Timer size={13} /> No limit — you control the pace
                                    </span>
                                </div>
                            ) : (
                                <div style={{ marginBottom: 15 }}>
                                    <span className="ae-field-label">Timer</span>
                                    <div className="ae-seg">
                                        {TIMER_MODES.filter((m) => m.id !== 'entire_quiz').map((m) => (
                                            <button key={m.id} type="button" disabled={quizSettingsDisabled}
                                                onClick={() => handleFieldChange('timer_mode', m.id)}
                                                className={`ae-seg-btn ${activity.timer_mode === m.id ? 'on' : ''}`}>
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>

                                    {activity.timer_mode === 'entire_quiz' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 11 }}>
                                            <input type="number" min={1} max={300} step={1} className="ae-input" style={{ width: 96 }}
                                                value={activity.time_limit_minutes || ''} readOnly={quizSettingsDisabled}
                                                onChange={(e) => handleFieldChange('time_limit_minutes', e.target.value ? Number(e.target.value) : null)}
                                                placeholder="Minutes" />
                                            <span style={{ fontSize: 12.5, color: 'var(--db-text-3)' }}>minutes for the whole quiz</span>
                                        </div>
                                    )}

                                    {activity.timer_mode === 'per_question' && (
                                        <div style={{ marginTop: 11, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {QUESTION_TYPES.map((t) => (
                                                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--db-text-2)' }}>{t.label}</span>
                                                    <input
                                                        type="number" min={5} max={900} step={5}
                                                        className="ae-input" style={{ width: 76, textAlign: 'right' }}
                                                        value={perQuestionDurations[t.id] || ''}
                                                        readOnly={quizSettingsDisabled}
                                                        onChange={(e) => {
                                                            const next = { ...perQuestionDurations, [t.id]: e.target.value ? Number(e.target.value) : null };
                                                            handleFieldChange('per_question_durations', next);
                                                        }} />
                                                    <span style={{ fontSize: 12, color: 'var(--db-text-3)', width: 28 }}>sec</span>
                                                </div>
                                            ))}
                                            <p className="ae-seg-hint" style={{ margin: '4px 0 0' }}>Smart defaults per type — adjust any value.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Shuffle */}
                            <button type="button" disabled={quizSettingsDisabled || activity.pacing_mode === 'teacher'}
                                onClick={() => handleFieldChange('shuffle_questions', !activity.shuffle_questions)}
                                className={`ae-toggle ${activity.shuffle_questions ? 'on' : ''}`}
                                style={{ marginBottom: 14 }}>
                                <Shuffle size={16} style={{ color: activity.shuffle_questions ? 'var(--db-accent-bright)' : 'var(--db-text-3)', flexShrink: 0 }} />
                                <span style={{ flex: 1 }}>
                                    <span className="ae-toggle-name" style={{ display: 'block' }}>Randomize question order</span>
                                    <span className="ae-toggle-sub" style={{ display: 'block' }}>
                                        {activity.pacing_mode === 'teacher'
                                            ? 'Not available in teacher-paced mode — you read questions in order'
                                            : 'Each student gets a different order, assigned at join'}
                                    </span>
                                </span>
                                <span className="ae-toggle-track"><span className="ae-toggle-knob" /></span>
                            </button>

                            {/* Show results */}
                            <div>
                                <span className="ae-field-label">Show results</span>
                                {activity.pacing_mode === 'teacher' ? (
                                    // Per-question reveal is gone — answers stay
                                    // sealed until the room closes, so there is
                                    // nothing to configure here anymore.
                                    <span className="ae-chip" style={{ background: 'var(--db-card-2)' }}>
                                        <EyeOff size={13} /> At the end — when the room closes
                                    </span>
                                ) : (
                                    <>
                                        <div className="ae-seg">
                                            {[
                                                { id: 'immediate', label: 'Immediately' },
                                                { id: 'room_close', label: 'When room closes' },
                                            ].map((opt) => (
                                                <button key={opt.id} type="button" disabled={quizSettingsDisabled}
                                                    onClick={() => handleFieldChange('show_results', opt.id)}
                                                    className={`ae-seg-btn ${activity.show_results === opt.id ? 'on' : ''}`}>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="ae-seg-hint">
                                            Immediate: results appear right after a student submits. Room close: results stay hidden until you end the room.
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Max points — file type is manual input */}
                    {activity.submission_type === 'file' && (
                        <div className="ae-card">
                            <h4 className="ae-card-label"><Check size={13} /> Max points</h4>
                            <input type="number" min={0} step={0.5} className="ae-input" style={{ width: '100%', boxSizing: 'border-box' }}
                                value={activity.max_points ?? ''} disabled={isLocked || isPastDue}
                                onChange={(e) => handleFieldChange('max_points', e.target.value ? Number(e.target.value) : null)}
                                placeholder="Enter max score" />
                            <p className="ae-seg-hint">What the submission is graded out of.</p>
                        </div>
                    )}

                    {/* Max points — auto-calculated */}
                    {(isQuiz || activity.submission_type === 'questions') && (activity.questions || []).length > 0 && (
                        <div className="ae-card">
                            <h4 className="ae-card-label"><Check size={13} /> Max points</h4>
                            <div className="ae-points-display">
                                {totalQuestionPoints} pts
                                <span>auto-calculated from questions</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Questions / preview column */}
                <div>
                    <div className="ae-col-head">
                        <div>
                            <h4 className="ae-col-title">
                                {isQuiz ? 'Quiz questions'
                                    : activity.submission_type === 'file' ? 'What students see'
                                    : activity.submission_type === 'material' ? 'What students see'
                                    : 'Questions'}
                            </h4>
                            <p className="ae-col-sub">
                                {isQuiz || activity.submission_type === 'questions'
                                    ? (activity.questions || []).length > 0
                                        ? `${(activity.questions || []).length} question${(activity.questions || []).length !== 1 ? 's' : ''} · ${totalQuestionPoints} pts total · drag to reorder`
                                        : 'No questions yet'
                                    : 'A live preview of the activity as students will open it'}
                            </p>
                        </div>
                        {(isQuiz || activity.submission_type === 'questions') && !questionsDisabled && (
                            <div className="ae-col-actions">
                                <button className="db-btn-ghost ae-ai-btn" onClick={() => setShowAiQuestions(true)} type="button"
                                    title="Write questions from your class material with AI">
                                    <Sparkles size={15} /> Generate with AI
                                </button>
                                <button className="db-btn-primary" onClick={() => setShowAddQuestion(true)} type="button">
                                    <Plus size={16} /> Add question
                                </button>
                            </div>
                        )}
                    </div>

                    {isQuiz || activity.submission_type === 'questions' ? (
                        (activity.questions || []).length === 0 ? (
                            <div className="ae-empty">
                                <div className="ae-empty-icon"><HelpCircle size={24} /></div>
                                <p className="ae-empty-title">{isQuiz ? 'No questions yet' : 'No questions added'}</p>
                                {!questionsDisabled ? (
                                    <>
                                        <p className="ae-empty-sub">
                                            {isQuiz ? 'Multiple choice, coding, essays — mix any types.' : 'Add questions for students to answer.'}
                                        </p>
                                        <div className="ae-col-actions" style={{ justifyContent: 'center' }}>
                                            <button className="db-btn-ghost ae-ai-btn" onClick={() => setShowAiQuestions(true)} type="button">
                                                <Sparkles size={15} /> Generate with AI
                                            </button>
                                            <button className="db-btn-primary" onClick={() => setShowAddQuestion(true)} type="button">
                                                <Plus size={15} /> Add your first question
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="ae-empty-sub">This activity is locked — questions can no longer change.</p>
                                )}
                            </div>
                        ) : questionsDisabled ? (
                            <div>
                                <div className="ae-locked-note">
                                    <EyeOff size={15} />
                                    {isPastDue
                                        ? 'Questions are locked — the deadline has passed. Use the eye icon on a question to view it.'
                                        : 'Questions are locked — this activity is published and has submissions. Use the eye icon on a question to view it.'}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {(activity.questions || []).map((q) => (
                                        <QuestionBlock key={q.id} question={q} index={(activity.questions || []).indexOf(q)}
                                            onUpdate={handleUpdateQuestion} onDelete={(question) => setDeleteTarget(question)}
                                            onEdit={setEditQuestion} disabled={questionsDisabled} />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <Reorder.Group axis="y" values={activity.questions || []} onReorder={handleReorderQuestions}
                                style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {(activity.questions || []).map((q) => (
                                    <ReorderItemWrapper key={q.id} question={q} index={(activity.questions || []).indexOf(q)}
                                        onUpdate={handleUpdateQuestion} onDelete={(question) => setDeleteTarget(question)}
                                        onEdit={setEditQuestion} disabled={false} />
                                ))}
                            </Reorder.Group>
                        )
                    ) : activity.submission_type === 'file' ? (
                        <div className="ae-preview">
                            <div className="ae-preview-head">
                                <Upload size={19} style={{ color: 'var(--db-accent-bright)' }} />
                                File submission
                            </div>
                            <div className="ae-dropzone">
                                <Upload size={30} style={{ color: 'var(--db-text-3)', marginBottom: 8 }} />
                                <p style={{ fontSize: 14, color: 'var(--db-text-2)', margin: '0 0 4px', fontWeight: 600 }}>Upload your file</p>
                                <p style={{ fontSize: 12.5, color: 'var(--db-text-3)', margin: 0 }}>PDF, DOCX, images, or ZIP</p>
                            </div>
                            {activity.deadline_at && (
                                <div className="ae-preview-row">
                                    <Clock size={15} style={{ color: activity.deadline_behavior === 'hard' ? 'var(--db-danger)' : 'var(--db-amber)', flexShrink: 0 }} />
                                    <span>
                                        Due {format(new Date(activity.deadline_at), 'MMM d, yyyy h:mm a')}
                                        {activity.deadline_behavior === 'hard' ? ' · closes at deadline' : ' · late OK'}
                                    </span>
                                </div>
                            )}
                            {activity.max_points && (
                                <div className="ae-preview-row" style={{ marginBottom: 0 }}>
                                    <span>Max score: <strong style={{ color: 'var(--db-text)' }}>{activity.max_points}</strong> pts</span>
                                </div>
                            )}
                        </div>
                    ) : activity.submission_type === 'material' && (
                        <div className="ae-preview">
                            <div className="ae-preview-head">
                                <BookOpen size={19} style={{ color: 'var(--db-green)' }} />
                                Material
                            </div>
                            {activity.description ? (
                                <div className="ae-instructions-box">
                                    <p style={{ fontSize: 14, color: 'var(--db-text-2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                        {activity.description}
                                    </p>
                                </div>
                            ) : (
                                <div className="ae-dropzone">
                                    <BookOpen size={30} style={{ color: 'var(--db-text-3)', marginBottom: 8 }} />
                                    <p style={{ fontSize: 14, color: 'var(--db-text-2)', margin: 0, fontWeight: 600 }}>Add instructions on the left</p>
                                    <p style={{ fontSize: 12.5, color: 'var(--db-text-3)', marginTop: 4 }}>Students will see this content here</p>
                                </div>
                            )}
                            {(activity.instruction_files || []).length > 0 && (
                                <div>
                                    <span className="ae-field-label">Attachments</span>
                                    <div className="ae-attachments">
                                        {(activity.instruction_files || []).map((file, i) => {
                                            const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);
                                            return isImage ? (
                                                <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                                                    style={{ borderRadius: 12, overflow: 'hidden', display: 'inline-block', border: '1px solid var(--db-border)', lineHeight: 0 }}>
                                                    <img src={file.url} alt={file.name}
                                                        style={{ maxWidth: 280, maxHeight: 200, objectFit: 'contain', display: 'block', background: 'var(--db-card-2)' }} />
                                                </a>
                                            ) : (
                                                <div key={i} className="ae-attachment-file">
                                                    <FileText size={15} style={{ color: 'var(--db-green)' }} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <CreateQuestionModal key={showAddQuestion} isOpen={showAddQuestion} onClose={() => setShowAddQuestion(false)} onCreated={handleAddQuestion} />
            {showAiQuestions && (
                <AiQuestionModal
                    activityId={activityId}
                    activityTitle={activity?.title || 'this activity'}
                    onClose={() => setShowAiQuestions(false)}
                    onCommitted={() => {
                        fetchActivity();
                        queryClient.invalidateQueries({ queryKey: classActivitiesKey(classId) });
                    }}
                />
            )}
            <CreateQuestionModal key={'edit-' + (editQuestion?.id || 'null')} isOpen={!!editQuestion} onClose={() => setEditQuestion(null)} onEdited={handleEditQuestionSubmit} editQuestion={editQuestion} viewOnly={questionsDisabled} />
            <DeleteModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}
                onConfirm={() => { if (deleteTarget) handleDeleteQuestion(deleteTarget); setDeleteTarget(null); }}
                title={deleteTarget?.question_text?.slice(0, 50) || 'Question'} loading={false} />
            <DeleteModal isOpen={!!deleteFileTarget} onClose={() => setDeleteFileTarget(null)} onConfirm={handleConfirmDeleteFile} title="File" loading={false} />
        </div>
    );
}
