import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    BookOpen,
    Check,
    FileText,
    FilePlus2,
    HelpCircle,
    Layers,
    Loader2,
    ListChecks,
    Sparkles,
    Square,
    Trash2,
    TriangleAlert,
    Upload,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import './AiQuestionModal.css';

const VITE_API_URL = import.meta.env.VITE_API_URL || '/api';

const AI_TYPES = [
    { id: 'multiple_choice', label: 'Multiple choice' },
    { id: 'true_false', label: 'True / False' },
    { id: 'identification', label: 'Identification' },
    { id: 'enumeration', label: 'Enumeration' },
    { id: 'short_answer', label: 'Short answer' },
    { id: 'essay', label: 'Essay' },
];

const AUTO_GRADED = new Set(['multiple_choice', 'true_false', 'identification', 'enumeration', 'short_answer']);
const MAX_FILES = 4;
const MAX_FILE_MB = 10;

let localId = 0;
const nextLocalId = () => `aiq${++localId}`;

const fmtChars = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/**
 * AI question generation for a classwork activity.
 *
 * Three phases in one surface:
 *   setup      — pick context (course tree + optional files) and shape the run
 *   generating — streamed batches preview as they land; Stop keeps what's done
 *   review     — edit everything, then append or replace the activity's questions
 */
export default function AiQuestionModal({ activityId, activityTitle, onClose, onCommitted }) {
    const [phase, setPhase] = useState('setup');
    const [selectedLessons, setSelectedLessons] = useState(new Set());
    const [useCurriculum, setUseCurriculum] = useState(false);
    const [focus, setFocus] = useState('');
    const [files, setFiles] = useState([]);
    const [types, setTypes] = useState(['multiple_choice']);
    const [count, setCount] = useState(10);
    const [difficulty, setDifficulty] = useState('medium');
    const [points, setPoints] = useState(1);

    const [statusLine, setStatusLine] = useState('');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [drafts, setDrafts] = useState([]);
    const [mode, setMode] = useState('append');
    const [committing, setCommitting] = useState(false);

    const abortRef = useRef(null);
    const fileInputRef = useRef(null);

    const { data: context, isLoading: contextLoading } = useQuery({
        queryKey: ['activity-ai-context', activityId],
        enabled: phase === 'setup',
        queryFn: async () => {
            const res = await api.get(`/teacher/activities/${activityId}/ai-context`, { bypassCache: true });
            return res.data;
        },
    });

    const modules = context?.modules ?? [];
    const course = context?.course ?? null;
    const allLessonIds = useMemo(() => modules.flatMap((m) => m.lessons.map((l) => l.id)), [modules]);
    const selectableLessonIds = useMemo(
        () => modules.flatMap((m) => m.lessons.filter((l) => l.text_chars >= 40).map((l) => l.id)),
        [modules]
    );
    const wholeCourseSelected = allLessonIds.length > 0 && selectableLessonIds.every((id) => selectedLessons.has(id));

    const canGenerate =
        phase === 'setup' &&
        types.length > 0 &&
        (selectedLessons.size > 0 || useCurriculum || files.length > 0);

    // ---- Tree selection ----------------------------------------------------

    const toggleLesson = (lesson) => {
        if (lesson.text_chars < 40) return;
        setSelectedLessons((prev) => {
            const next = new Set(prev);
            if (next.has(lesson.id)) next.delete(lesson.id);
            else next.add(lesson.id);
            return next;
        });
    };

    const toggleModule = (module) => {
        const selectable = module.lessons.filter((l) => l.text_chars >= 40).map((l) => l.id);
        if (selectable.length === 0) return;
        const allIn = selectable.every((id) => selectedLessons.has(id));
        setSelectedLessons((prev) => {
            const next = new Set(prev);
            selectable.forEach((id) => (allIn ? next.delete(id) : next.add(id)));
            return next;
        });
    };

    const toggleWholeCourse = () => {
        setSelectedLessons((prev) => {
            if (wholeCourseSelected) return new Set();
            return new Set(selectableLessonIds);
        });
    };

    // ---- Files ---------------------------------------------------------------

    const addFiles = (fileList) => {
        const incoming = [...fileList];
        const rejected = [];
        setFiles((prev) => {
            const next = [...prev];
            for (const f of incoming) {
                if (next.length >= MAX_FILES) { rejected.push(`${f.name} — max ${MAX_FILES} files`); continue; }
                if (f.size > MAX_FILE_MB * 1024 * 1024) { rejected.push(`${f.name} — over ${MAX_FILE_MB}MB`); continue; }
                if (next.some((x) => x.name === f.name && x.size === f.size)) { continue; }
                next.push(f);
            }
            return next;
        });
        rejected.forEach((r) => toast.error(r));
    };

    // ---- Streaming generation --------------------------------------------------

    const startGeneration = useCallback(async () => {
        setPhase('generating');
        setDrafts([]);
        setProgress({ done: 0, total: count });
        setStatusLine('Connecting to AI service…');

        const controller = new AbortController();
        abortRef.current = controller;

        const form = new FormData();
        form.append('context', JSON.stringify({
            lesson_ids: [...selectedLessons],
            use_curriculum: useCurriculum,
        }));
        form.append('settings', JSON.stringify({ types, count, difficulty, focus }));
        files.forEach((f) => form.append('files[]', f));

        let sawError = null;
        const collected = [];
        try {
            const res = await fetch(`${VITE_API_URL}/teacher/activities/${activityId}/ai-generate-questions`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${localStorage.token}` },
                body: form,
                signal: controller.signal,
            });

            if (!res.ok) {
                let message = 'Could not start the generation';
                try {
                    const err = await res.json();
                    message = err.message || message;
                } catch { /* non-JSON */ }
                toast.error(message);
                setPhase('setup');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let done = false;

            while (!done) {
                const { value, complete } = await reader.read();
                if (complete) break;
                buffer += decoder.decode(value, { stream: true });

                let idx;
                while ((idx = buffer.indexOf('\n\n')) !== -1) {
                    const raw = buffer.slice(0, idx + 2);
                    buffer = buffer.slice(idx + 2);
                    const line = raw.trim();
                    if (!line || line.startsWith(':')) continue; // heartbeat
                    if (!line.startsWith('data: ')) continue;

                    let event;
                    try { event = JSON.parse(line.slice(6)); } catch { continue; }

                    if (event.type === 'status') {
                        setStatusLine(event.message || '');
                    } else if (event.type === 'questions') {
                        const batch = (event.data?.questions ?? []).map((q) => ({
                            localId: nextLocalId(),
                            type: q.type,
                            question_text: q.question_text,
                            options: q.options ?? [],
                            expected_output: q.expected_output ?? '',
                            points,
                        }));
                        if (batch.length) {
                            collected.push(...batch);
                            setDrafts((prev) => [...prev, ...batch]);
                            if (event.progress) setProgress(event.progress);
                        }
                    } else if (event.type === 'complete') {
                        done = true;
                    } else if (event.type === 'error') {
                        sawError = event.message || 'The AI could not write questions';
                        done = true;
                    }
                }
            }
        } catch (err) {
            if (err?.name !== 'AbortError') {
                sawError = 'The connection dropped — try again';
            }
        }

        abortRef.current = null;
        if (collected.length === 0) {
            if (sawError) toast.error(sawError);
            setPhase('setup');
        } else {
            if (sawError) toast.message('Heads up', { description: `${sawError} — you can review what was written.` });
            setPhase('review');
        }
    }, [activityId, selectedLessons, useCurriculum, types, count, difficulty, focus, files, points]);

    const stopGeneration = () => {
        abortRef.current?.abort();
    };

    // ---- Review editing ------------------------------------------------------

    const patchDraft = (localId, patch) => {
        setDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
    };

    const removeDraft = (localId) => setDrafts((prev) => prev.filter((d) => d.localId !== localId));

    const setCorrectOption = (draft, index) => {
        patchDraft(draft.localId, { expected_output: draft.options[index] ?? '' });
    };

    const editOption = (draft, index, value) => {
        const options = draft.options.map((o, i) => (i === index ? value : o));
        const wasCorrect = draft.expected_output === draft.options[index];
        patchDraft(draft.localId, { options, expected_output: wasCorrect ? value : draft.expected_output });
    };

    const addOption = (draft) => {
        if (draft.options.length >= 6) return;
        patchDraft(draft.localId, { options: [...draft.options, ''] });
    };

    const removeOption = (draft, index) => {
        const wasCorrect = draft.expected_output === draft.options[index];
        const options = draft.options.filter((_, i) => i !== index);
        patchDraft(draft.localId, {
            options,
            expected_output: wasCorrect ? '' : draft.expected_output,
        });
    };

    const commit = async () => {
        setCommitting(true);
        try {
            const payload = drafts.map((d) => ({
                type: d.type,
                question_text: d.question_text,
                options: AUTO_GRADED.has(d.type) || d.type === 'enumeration' ? d.options : [],
                expected_output: d.expected_output ?? '',
                points: Math.max(1, Math.round(Number(d.points) || 1)),
            }));
            const res = await api.post(`/teacher/activities/${activityId}/ai-commit-questions`, {
                mode,
                questions: payload,
            });
            toast.success(res.data.message);
            onCommitted?.();
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not save the questions');
        } finally {
            setCommitting(false);
        }
    };

    // ---- Render ---------------------------------------------------------------

    const summaryParts = [];
    if (selectedLessons.size > 0) summaryParts.push(`${selectedLessons.size} lesson${selectedLessons.size === 1 ? '' : 's'}`);
    if (useCurriculum) summaryParts.push('curriculum');
    if (files.length > 0) summaryParts.push(`${files.length} file${files.length === 1 ? '' : 's'}`);

    return (
        <div className="db-modal-backdrop" style={{ zIndex: 1000 }} onClick={phase === 'generating' ? undefined : onClose}>
            <div className="db-modal aiq-modal" onClick={(e) => e.stopPropagation()}>
                <button className="db-modal-close" onClick={onClose} type="button" disabled={phase === 'generating'}>
                    <X size={17} />
                </button>

                <div className="db-modal-head">
                    <h3 className="db-modal-title">
                        <Sparkles size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--db-accent-bright)' }} />
                        {phase === 'review' ? 'Review generated questions' : 'Generate questions with AI'}
                    </h3>
                    <p className="db-modal-sub">
                        {phase === 'setup' && (
                            <>Grounded in <strong>{activityTitle}</strong>'s own class material — pick the lessons the AI reads.</>
                        )}
                        {phase === 'generating' && 'Writing questions from your selected material…'}
                        {phase === 'review' && 'Edit anything that reads wrong, then add them to the activity.'}
                    </p>
                </div>

                {/* ================= SETUP ================= */}
                {phase === 'setup' && (
                    <>
                        <div className="aiq-setup">
                            <div className="aiq-tree-col">
                                <div className="aiq-rail-label">
                                    <Layers size={13} />
                                    Class material
                                </div>

                                {contextLoading ? (
                                    <div className="aiq-loading"><Loader2 size={18} className="aiq-spin" /></div>
                                ) : !course || modules.length === 0 ? (
                                    <p className="aiq-empty">This class has no lesson content yet — upload a file instead, or build lessons first.</p>
                                ) : (
                                    <>
                                        <label className="aiq-wholecourse">
                                            <input
                                                type="checkbox"
                                                className="aiq-checkbox"
                                                checked={wholeCourseSelected}
                                                onChange={toggleWholeCourse}
                                            />
                                            <BookOpen size={14} />
                                            <span className="aiq-wholecourse-title">Whole course</span>
                                            <span className="aiq-tree-meta">{selectableLessonIds.length} lessons</span>
                                        </label>

                                        <div className="aiq-tree">
                                            {modules.map((m) => {
                                                const selectable = m.lessons.filter((l) => l.text_chars >= 40);
                                                const allIn = selectable.length > 0 && selectable.every((l) => selectedLessons.has(l.id));
                                                const someIn = selectable.some((l) => selectedLessons.has(l.id));
                                                return (
                                                    <div key={m.id} className="aiq-module">
                                                        <button
                                                            type="button"
                                                            className={`aiq-module-row ${allIn ? 'is-all' : someIn ? 'is-some' : ''}`}
                                                            onClick={() => toggleModule(m)}
                                                            disabled={selectable.length === 0}
                                                        >
                                                            <span className={`aiq-checkbox aiq-checkbox--box ${allIn ? 'is-checked' : someIn ? 'is-partial' : ''}`}>
                                                                {allIn && <Check size={11} strokeWidth={3.5} />}
                                                                {!allIn && someIn && <span className="aiq-partial-dot" />}
                                                            </span>
                                                            <span className="aiq-module-title">{m.title}</span>
                                                            <span className="aiq-tree-meta">{m.lessons.length} lessons</span>
                                                        </button>
                                                        <ul className="aiq-lessons">
                                                            {m.lessons.map((l) => {
                                                                const hasText = l.text_chars >= 40;
                                                                const checked = selectedLessons.has(l.id);
                                                                return (
                                                                    <li key={l.id}>
                                                                        <button
                                                                            type="button"
                                                                            className={`aiq-lesson-row ${checked ? 'is-checked' : ''}`}
                                                                            onClick={() => toggleLesson(l)}
                                                                            disabled={!hasText}
                                                                        >
                                                                            <span className={`aiq-checkbox aiq-checkbox--box ${checked ? 'is-checked' : ''}`}>
                                                                                {checked && <Check size={10} strokeWidth={3.5} />}
                                                                            </span>
                                                                            <FileText size={12} className="aiq-lesson-icon" />
                                                                            <span className="aiq-lesson-title">{l.title}</span>
                                                                            <span className="aiq-tree-meta">
                                                                                {hasText ? `${fmtChars(l.text_chars)} chars` : 'no text'}
                                                                            </span>
                                                                        </button>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {course.curriculum_chars > 0 && (
                                            <label className="aiq-curriculum-row">
                                                <input
                                                    type="checkbox"
                                                    className="aiq-checkbox"
                                                    checked={useCurriculum}
                                                    onChange={(e) => setUseCurriculum(e.target.checked)}
                                                />
                                                <FileText size={13} />
                                                <span className="aiq-lesson-title">Uploaded curriculum file</span>
                                                <span className="aiq-tree-meta">{fmtChars(course.curriculum_chars)} chars</span>
                                            </label>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="aiq-rail">
                                <div className="aiq-rail-block">
                                    <div className="aiq-rail-label">Focus <span className="aiq-optional">optional</span></div>
                                    <textarea
                                        className="aiq-focus"
                                        rows={2}
                                        maxLength={500}
                                        value={focus}
                                        onChange={(e) => setFocus(e.target.value)}
                                        placeholder="e.g. focus on recursion, avoid definitions, make it word-problem heavy…"
                                    />
                                </div>

                                <div className="aiq-rail-block">
                                    <div className="aiq-rail-label">Reference files <span className="aiq-optional">optional</span></div>
                                    <div
                                        className={`aiq-dropzone ${files.length > 0 ? 'has-files' : ''}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                                        onClick={() => fileInputRef.current?.click()}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        <Upload size={16} />
                                        <span>Drop PDF, DOCX, PPTX or TXT — or click to browse</span>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                                        multiple
                                        hidden
                                        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                                    />
                                    {files.length > 0 && (
                                        <ul className="aiq-files">
                                            {files.map((f, i) => (
                                                <li key={`${f.name}-${i}`} className="aiq-file">
                                                    <FileText size={12} />
                                                    <span className="aiq-file-name">{f.name}</span>
                                                    <span className="aiq-file-size">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
                                                    <button type="button" className="aiq-file-remove" onClick={(e) => { e.stopPropagation(); setFiles((prev) => prev.filter((_, j) => j !== i)); }}>
                                                        <X size={12} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="aiq-rail-block">
                                    <div className="aiq-rail-label">Question types</div>
                                    <div className="aiq-type-chips">
                                        {AI_TYPES.map((t) => {
                                            const active = types.includes(t.id);
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    className={`aiq-type-chip ${active ? 'is-active' : ''}`}
                                                    onClick={() =>
                                                        setTypes((prev) => (active ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                                                    }
                                                >
                                                    {active && <Check size={11} strokeWidth={3} />}
                                                    {t.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {types.some((t) => t === 'identification' || t === 'short_answer') && (
                                        <p className="aiq-hint">
                                            <TriangleAlert size={11} />
                                            Identification and short answer are graded by exact match — the AI writes a canonical answer, but review them.
                                        </p>
                                    )}
                                </div>

                                <div className="aiq-settings-row">
                                    <div className="aiq-setting">
                                        <div className="aiq-rail-label">How many</div>
                                        <div className="aiq-stepper">
                                            <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1}>−</button>
                                            <span>{count}</span>
                                            <button type="button" onClick={() => setCount((c) => Math.min(20, c + 1))} disabled={count >= 20}>+</button>
                                        </div>
                                    </div>
                                    <div className="aiq-setting">
                                        <div className="aiq-rail-label">Difficulty</div>
                                        <div className="aiq-seg">
                                            {['easy', 'medium', 'hard'].map((d) => (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    className={`aiq-seg-btn ${difficulty === d ? 'is-active' : ''}`}
                                                    onClick={() => setDifficulty(d)}
                                                >
                                                    {d[0].toUpperCase() + d.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="aiq-setting">
                                        <div className="aiq-rail-label">Points each</div>
                                        <div className="aiq-stepper">
                                            <button type="button" onClick={() => setPoints((p) => Math.max(1, p - 1))} disabled={points <= 1}>−</button>
                                            <span>{points}</span>
                                            <button type="button" onClick={() => setPoints((p) => Math.min(100, p + 1))} disabled={points >= 100}>+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="aiq-foot">
                            <p className="aiq-foot-summary">
                                {canGenerate
                                    ? `${count} question${count === 1 ? '' : 's'} · ${difficulty} · from ${summaryParts.join(' + ')}`
                                    : 'Pick lessons or add a file for the AI to read'}
                            </p>
                            <button type="button" className="db-btn-primary aiq-generate-btn" onClick={startGeneration} disabled={!canGenerate}>
                                <Sparkles size={15} />
                                Generate
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </>
                )}

                {/* ================= GENERATING ================= */}
                {phase === 'generating' && (
                    <div className="aiq-generating">
                        <div className="aiq-progress-head">
                            <Loader2 size={16} className="aiq-spin" />
                            <span className="aiq-status">{statusLine || 'Working…'}</span>
                            <span className="aiq-progress-count">{progress.done}/{progress.total}</span>
                        </div>
                        <div className="aiq-progress-bar">
                            <div
                                className="aiq-progress-fill"
                                style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                            />
                        </div>

                        <div className="aiq-preview-list">
                            {drafts.map((d) => (
                                <div key={d.localId} className="aiq-preview-card">
                                    <span className={`aiq-type-badge is-${d.type}`}>{labelFor(d.type)}</span>
                                    <span className="aiq-preview-text">{d.question_text}</span>
                                </div>
                            ))}
                            {drafts.length === 0 && (
                                <div className="aiq-preview-empty">Questions will appear here as they're written…</div>
                            )}
                        </div>

                        <div className="aiq-generating-foot">
                            <p className="aiq-generating-note">
                                {progress.done > 0
                                    ? 'Stopping keeps what\u2019s already written — you can still review it.'
                                    : 'Stopping now cancels the run.'}
                            </p>
                            <button type="button" className="db-btn aiq-stop-btn" onClick={stopGeneration}>
                                <Square size={12} />
                                Stop
                            </button>
                        </div>
                    </div>
                )}

                {/* ================= REVIEW ================= */}
                {phase === 'review' && (
                    <>
                        <div className="aiq-review-list">
                            {drafts.map((d, index) => (
                                <div key={d.localId} className="aiq-card">
                                    <div className="aiq-card-head">
                                        <span className="aiq-card-num">{index + 1}</span>
                                        <span className={`aiq-type-badge is-${d.type}`}>{labelFor(d.type)}</span>
                                        {!AUTO_GRADED.has(d.type) && d.type !== 'enumeration' && (
                                            <span className="aiq-manual-chip">manual grading</span>
                                        )}
                                        <span className="aiq-card-points">
                                            <button type="button" onClick={() => patchDraft(d.localId, { points: Math.max(1, Number(d.points) - 1) })}>−</button>
                                            {d.points} pt{Number(d.points) !== 1 ? 's' : ''}
                                            <button type="button" onClick={() => patchDraft(d.localId, { points: Math.min(100, Number(d.points) + 1) })}>+</button>
                                        </span>
                                        <button type="button" className="aiq-card-remove" onClick={() => removeDraft(d.localId)} title="Remove question">
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    <textarea
                                        className="aiq-qtext"
                                        rows={2}
                                        value={d.question_text}
                                        onChange={(e) => patchDraft(d.localId, { question_text: e.target.value })}
                                    />

                                    {d.type === 'multiple_choice' && (
                                        <div className="aiq-options">
                                            {d.options.map((opt, i) => {
                                                const correct = d.expected_output === opt && opt !== '';
                                                return (
                                                    <div key={i} className={`aiq-option ${correct ? 'is-correct' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="aiq-option-radio"
                                                            title={correct ? 'Correct answer' : 'Mark as correct'}
                                                            onClick={() => setCorrectOption(d, i)}
                                                        >
                                                            {correct && <Check size={10} strokeWidth={3.5} />}
                                                        </button>
                                                        <input
                                                            value={opt}
                                                            onChange={(e) => editOption(d, i, e.target.value)}
                                                            placeholder={`Option ${i + 1}`}
                                                        />
                                                        {d.options.length > 2 && (
                                                            <button type="button" className="aiq-option-remove" onClick={() => removeOption(d, i)}>
                                                                <X size={11} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                            {d.options.length < 6 && (
                                                <button type="button" className="aiq-option-add" onClick={() => addOption(d)}>
                                                    + Add option
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {d.type === 'true_false' && (
                                        <div className="aiq-seg aiq-tf">
                                            {['True', 'False'].map((v) => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    className={`aiq-seg-btn ${d.expected_output === v ? 'is-active' : ''}`}
                                                    onClick={() => patchDraft(d.localId, { expected_output: v })}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {(d.type === 'identification' || d.type === 'short_answer') && (
                                        <div className="aiq-answer">
                                            <input
                                                value={d.expected_output}
                                                onChange={(e) => patchDraft(d.localId, { expected_output: e.target.value })}
                                                placeholder="Canonical answer (exact match)"
                                            />
                                        </div>
                                    )}

                                    {d.type === 'enumeration' && (
                                        <div className="aiq-options">
                                            <p className="aiq-enum-note">Correct items — students get credit per item:</p>
                                            {d.options.map((opt, i) => (
                                                <div key={i} className="aiq-option">
                                                    <span className="aiq-enum-num">{i + 1}.</span>
                                                    <input
                                                        value={opt}
                                                        onChange={(e) => editOption(d, i, e.target.value)}
                                                        placeholder={`Item ${i + 1}`}
                                                    />
                                                    <button type="button" className="aiq-option-remove" onClick={() => removeOption(d, i)}>
                                                        <X size={11} />
                                                    </button>
                                                </div>
                                            ))}
                                            {d.options.length < 6 && (
                                                <button
                                                    type="button"
                                                    className="aiq-option-add"
                                                    onClick={() => patchDraft(d.localId, { options: [...d.options, ''] })}
                                                >
                                                    + Add item
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {d.type === 'essay' && (
                                        <p className="aiq-essay-note">
                                            <HelpCircle size={12} />
                                            Open-ended — graded manually. No answer key needed.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="aiq-foot">
                            <div className="aiq-mode" role="radiogroup" aria-label="Destination">
                                <button
                                    type="button"
                                    className={`aiq-mode-btn ${mode === 'append' ? 'is-active' : ''}`}
                                    onClick={() => setMode('append')}
                                    disabled={committing}
                                >
                                    Add to existing
                                </button>
                                <button
                                    type="button"
                                    className={`aiq-mode-btn ${mode === 'replace' ? 'is-active is-danger' : ''}`}
                                    onClick={() => setMode('replace')}
                                    disabled={committing}
                                >
                                    Replace all
                                </button>
                            </div>
                            {mode === 'replace' && (
                                <p className="aiq-warning">
                                    <TriangleAlert size={12} />
                                    Replaces every question currently in this activity.
                                </p>
                            )}
                            <button type="button" className="db-btn-primary aiq-generate-btn" onClick={commit} disabled={committing || drafts.length === 0}>
                                {committing ? <Loader2 size={14} className="aiq-spin" /> : <ListChecks size={15} />}
                                {mode === 'replace' ? 'Replace with' : 'Add'} {drafts.length} question{drafts.length === 1 ? '' : 's'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function labelFor(type) {
    return AI_TYPES.find((t) => t.id === type)?.label ?? type;
}
