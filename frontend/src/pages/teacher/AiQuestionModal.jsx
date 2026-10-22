import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FormattedText from '../../components/ui/FormattedText';
import { useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    BookOpen,
    Check,
    ChevronDown,
    FileText,
    HelpCircle,
    Layers,
    Loader2,
    ListChecks,
    Minus,
    RefreshCw,
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
    { id: 'coding', label: 'Coding' },
];

// Every type at 0 = "automatic" — Laravel generates multiple choice only;
// other types are a deliberate Advanced choice with exact counts
const ZERO_COUNTS = Object.fromEntries(AI_TYPES.map((t) => [t.id, 0]));

const MAX_FILES = 4;
const MAX_FILE_MB = 10;
const MODAL_Z = 1000;

let localId = 0;
const nextLocalId = () => `aiq${++localId}`;

const fmtWords = (chars) => {
    const words = Math.max(1, Math.round(chars / 5.5));
    return words >= 1000 ? `${(words / 1000).toFixed(1)}k words` : `${words} words`;
};

const plural = (n, word, pluralWord) => `${n} ${n === 1 ? word : (pluralWord ?? word + 's')}`;

/**
 * AI question generation for a classwork activity.
 *
 * Three phases in one surface:
 *   setup      — pick context (course tree + optional files) and shape the run
 *   generating — streamed batches preview as they land; Stop keeps what's done
 *   review     — edit everything, then append or replace the activity's questions
 *
 * Reviewed work is never destroyed by a stray click: closing during review
 * with uncommitted questions asks first.
 */
export default function AiQuestionModal({ activityId, activityTitle, onClose, onCommitted }) {
    const [phase, setPhase] = useState('setup');
    const [selectedLessons, setSelectedLessons] = useState(new Set());
    const [useCurriculum, setUseCurriculum] = useState(false);
    const [focus, setFocus] = useState('');
    const [files, setFiles] = useState([]);
    const [count, setCount] = useState(10);
    const [difficulty, setDifficulty] = useState('medium');
    const [counts, setCounts] = useState(ZERO_COUNTS);
    // Opt-in: coding batches also propose IO test cases (engine-verified)
    const [genTestCases, setGenTestCases] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const [statusLine, setStatusLine] = useState('');
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [drafts, setDrafts] = useState([]);
    const [mode, setMode] = useState('append');
    const [committing, setCommitting] = useState(false);
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const abortRef = useRef(null);
    const fileInputRef = useRef(null);
    const headRef = useRef(null);

    const {
        data: context,
        isLoading: contextLoading,
        isError: contextError,
        refetch: refetchContext,
    } = useQuery({
        queryKey: ['activity-ai-context', activityId],
        enabled: phase === 'setup',
        queryFn: async () => {
            const res = await api.get(`/teacher/activities/${activityId}/ai-context`, { bypassCache: true });
            return res.data;
        },
    });

    const modules = useMemo(() => context?.modules ?? [], [context]);
    const course = context?.course ?? null;
    const codingMeta = context?.coding ?? null;

    // Explicit per-type counts (Advanced) — any number above zero switches
    // the run from automatic to exact mix
    const countsActive = Object.values(counts).some((n) => n > 0);
    const countsSum = Object.values(counts).reduce((a, b) => a + Number(b || 0), 0);
    const totalCount = countsActive ? countsSum : count;
    const advDirty = focus.trim() !== '' || files.length > 0 || countsActive || difficulty !== 'medium';
    const codingBlocked =
        codingMeta && (!codingMeta.language || !codingMeta.engine_ok)
            ? (!codingMeta.language
                ? 'Set the course language in the Curriculum modal first'
                : `The execution engine doesn't have ${codingMeta.language} available`)
            : null;

    const selectableLessonIds = useMemo(
        () => modules.flatMap((m) => m.lessons.filter((l) => l.text_chars >= 40).map((l) => l.id)),
        [modules]
    );
    const wholeCourseSelected =
        selectableLessonIds.length > 0 && selectableLessonIds.every((id) => selectedLessons.has(id));

    const canGenerate =
        phase === 'setup' &&
        (selectedLessons.size > 0 || useCurriculum || files.length > 0);

    // Escape asks before discarding reviewed work; otherwise closes
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (phase === 'generating' || committing) return;
            attemptClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, committing, drafts.length]);

    // Move focus into the modal on open and on phase changes
    useEffect(() => {
        headRef.current?.focus();
    }, [phase]);

    // An in-flight generation must not outlive the modal
    useEffect(() => () => abortRef.current?.abort(), []);

    const attemptClose = useCallback(() => {
        if (phase === 'generating' || committing) return;
        if (phase === 'review' && drafts.length > 0) {
            setConfirmDiscard(true);
            return;
        }
        onClose();
    }, [phase, committing, drafts.length, onClose]);

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
        setSelectedLessons(() => {
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

    const dropzoneKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
        }
    };

    // ---- Streaming generation --------------------------------------------------

    const startGeneration = useCallback(async () => {
        setPhase('generating');
        setConfirmDiscard(false);
        setDrafts([]);
        setProgress({ done: 0, total: totalCount });
        setStatusLine('Connecting to AI service…');

        const controller = new AbortController();
        abortRef.current = controller;

        const form = new FormData();
        form.append('context', JSON.stringify({
            lesson_ids: [...selectedLessons],
            use_curriculum: useCurriculum,
        }));
        form.append('settings', JSON.stringify({
            count: totalCount,
            difficulty,
            focus,
            // null = automatic — the backend reads the material and decides
            counts: countsActive ? counts : null,
            generate_test_cases: genTestCases,
        }));
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
                const { value, done: streamDone } = await reader.read();
                if (streamDone) break;
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
                        const batch = (event.data?.questions ?? []).map((q) => {
                            // MC correctness is tracked by INDEX (option texts
                            // are editable; string-matching breaks on edits).
                            // No verbatim match → null → the card is flagged
                            // and the teacher picks the key themselves; the
                            // match is case-insensitive like the backend.
                            let correctIndex = null;
                            if (q.type === 'multiple_choice') {
                                const answer = (q.expected_output ?? '').trim().toLowerCase();
                                const idx = (q.options ?? []).findIndex((o) => o && o.trim().toLowerCase() === answer);
                                correctIndex = idx === -1 ? null : idx;
                            }
                            return {
                                localId: nextLocalId(),
                                type: q.type,
                                question_text: q.question_text,
                                options: q.options ?? [],
                                correctIndex,
                                expected_output: q.expected_output ?? '',
                                // Points come per-type from the server's
                                // defaults (1 pt objective, 5 pt essay/coding)
                                points: Math.max(1, Math.round(Number(q.points) || 1)),
                                boilerplate: q.boilerplate ?? '',
                                reference_code: q.reference_code ?? '',
                                language: q.language ?? codingMeta?.language ?? '',
                                test_cases: (q.test_cases ?? []).map((tc) => ({
                                    input: tc.input ?? '',
                                    expected_output: tc.expected_output ?? '',
                                    hidden: !!tc.hidden,
                                })),
                            };
                        });
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
    }, [activityId, selectedLessons, useCurriculum, difficulty, focus, files, counts, countsActive, totalCount, codingMeta, genTestCases]);

    const stopGeneration = () => {
        abortRef.current?.abort();
    };

    // ---- Review editing ------------------------------------------------------

    const patchDraft = (localId, patch) => {
        setDrafts((prev) => prev.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
    };

    const removeDraft = (localId) => setDrafts((prev) => prev.filter((d) => d.localId !== localId));

    const editOption = (draft, index, value) => {
        const options = draft.options.map((o, i) => (i === index ? value : o));
        patchDraft(draft.localId, { options });
    };

    const addOption = (draft) => {
        if (draft.options.length >= 6) return;
        patchDraft(draft.localId, { options: [...draft.options, ''] });
    };

    const removeOption = (draft, index) => {
        const options = draft.options.filter((_, i) => i !== index);
        const correctIndex = draft.correctIndex === index ? null
            : draft.correctIndex > index ? draft.correctIndex - 1 : draft.correctIndex;
        patchDraft(draft.localId, { options, correctIndex });
    };

    const invalidMc = drafts.filter((d) => d.type === 'multiple_choice' && (d.correctIndex == null || !d.options[d.correctIndex]?.trim()));
    const invalidCoding = drafts.filter((d) => d.type === 'coding' && (!d.boilerplate?.trim() || !d.expected_output?.trim()));
    const invalidDrafts = [...invalidMc, ...invalidCoding];

    const commit = async () => {
        if (invalidMc.length > 0) {
            toast.error(`${plural(invalidMc.length, 'multiple-choice question')} ha${invalidMc.length === 1 ? 's' : 've'} no correct answer marked — pick the right option first.`);
            return;
        }
        if (invalidCoding.length > 0) {
            toast.error(`${plural(invalidCoding.length, 'coding question')} need${invalidCoding.length === 1 ? 's' : ''} starter code and an expected output.`);
            return;
        }
        setCommitting(true);
        try {
            const payload = drafts.map((d) => {
                const base = {
                    type: d.type,
                    question_text: d.question_text,
                    options: d.options ?? [],
                    expected_output: d.type === 'multiple_choice'
                        ? (d.options[d.correctIndex] ?? '')
                        : (d.expected_output ?? ''),
                    points: Math.max(1, Math.round(Number(d.points) || 1)),
                };
                if (d.type === 'coding') {
                    base.boilerplate = d.boilerplate ?? '';
                    base.reference_code = d.reference_code ?? '';
                    base.language = d.language || undefined;
                    base.test_cases = (d.test_cases ?? []).filter((tc) => tc.expected_output?.trim());
                }
                return base;
            });
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
    if (selectedLessons.size > 0) summaryParts.push(plural(selectedLessons.size, 'lesson'));
    if (useCurriculum) summaryParts.push('curriculum');
    if (files.length > 0) summaryParts.push(plural(files.length, 'file'));

    return (
        <div className="db-modal-backdrop" style={{ zIndex: MODAL_Z }} onClick={attemptClose}>
            <div
                className="db-modal aiq-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Generate questions with AI"
            >
                <button className="db-modal-close" onClick={attemptClose} type="button" disabled={phase === 'generating'}>
                    <X size={17} />
                </button>

                <div className="db-modal-head" ref={headRef} tabIndex={-1}>
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
                        {contextError ? (
                            <div className="aiq-error-row">
                                <TriangleAlert size={15} />
                                <span>
                                    {contextError?.response?.status === 404
                                        ? 'This activity no longer exists — close and reopen the editor.'
                                        : "Couldn't load this class's material."}
                                </span>
                                {contextError?.response?.status !== 404 && (
                                    <button type="button" className="aiq-retry-btn" onClick={() => refetchContext()}>
                                        <RefreshCw size={12} /> Retry
                                    </button>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* One control lives outside the scroll: how many.
                                    Everything else is Advanced. */}
                                <div className="aiq-topbar">
                                    <div className="aiq-setting">
                                        <div className="aiq-rail-label">How many</div>
                                        <div className="aiq-stepper">
                                            <button type="button" aria-label="Fewer questions" onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={countsActive || totalCount <= 1}>−</button>
                                            <span>{totalCount}</span>
                                            <button type="button" aria-label="More questions" onClick={() => setCount((c) => Math.min(20, c + 1))} disabled={countsActive || totalCount >= 20}>+</button>
                                        </div>
                                    </div>
                                    {countsActive && (
                                        <p className="aiq-mix-note">Set by your exact mix in Advanced</p>
                                    )}
                                    <div className="aiq-advanced">
                                        <button
                                            type="button"
                                            className="aiq-adv-toggle"
                                            aria-expanded={advancedOpen}
                                            onClick={() => setAdvancedOpen((o) => !o)}
                                        >
                                            <ChevronDown size={14} className={advancedOpen ? 'is-open' : ''} />
                                            Advanced
                                            {advDirty && <span className="aiq-adv-dot" aria-label="has custom settings" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="aiq-setup aiq-setup--single">
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
                                                <button
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={wholeCourseSelected}
                                                    className={`aiq-wholecourse ${wholeCourseSelected ? 'is-checked' : ''}`}
                                                    onClick={toggleWholeCourse}
                                                    disabled={selectableLessonIds.length === 0}
                                                    title={selectableLessonIds.length === 0 ? 'No lessons have written content yet' : undefined}
                                                >
                                                    <span className={`aiq-checkbox--box ${wholeCourseSelected ? 'is-checked' : ''}`}>
                                                        {wholeCourseSelected && <Check size={11} strokeWidth={3.5} />}
                                                    </span>
                                                    <BookOpen size={14} />
                                                    <span className="aiq-wholecourse-title">Whole course</span>
                                                    <span className="aiq-tree-meta">{plural(selectableLessonIds.length, 'lesson')}</span>
                                                </button>

                                                <div className="aiq-tree">
                                                    {modules.map((m) => {
                                                        const selectable = m.lessons.filter((l) => l.text_chars >= 40);
                                                        const allIn = selectable.length > 0 && selectable.every((l) => selectedLessons.has(l.id));
                                                        const someIn = selectable.some((l) => selectedLessons.has(l.id));
                                                        return (
                                                            <div key={m.id} className="aiq-module">
                                                                <button
                                                                    type="button"
                                                                    role="checkbox"
                                                                    aria-checked={allIn ? 'true' : someIn ? 'mixed' : 'false'}
                                                                    className={`aiq-module-row ${allIn ? 'is-all' : someIn ? 'is-some' : ''}`}
                                                                    onClick={() => toggleModule(m)}
                                                                    disabled={selectable.length === 0}
                                                                    title={selectable.length === 0 ? 'No lessons with written content' : undefined}
                                                                >
                                                                    <span className={`aiq-checkbox--box ${allIn ? 'is-checked' : someIn ? 'is-partial' : ''}`}>
                                                                        {allIn && <Check size={11} strokeWidth={3.5} />}
                                                                        {!allIn && someIn && <Minus size={9} strokeWidth={4} />}
                                                                    </span>
                                                                    <span className="aiq-module-title">{m.title}</span>
                                                                    <span className="aiq-tree-meta">{plural(selectable.length, 'lesson')}</span>
                                                                </button>
                                                                <ul className="aiq-lessons">
                                                                    {m.lessons.map((l) => {
                                                                        const hasText = l.text_chars >= 40;
                                                                        const checked = selectedLessons.has(l.id);
                                                                        return (
                                                                            <li key={l.id}>
                                                                                <button
                                                                                    type="button"
                                                                                    role="checkbox"
                                                                                    aria-checked={checked}
                                                                                    className={`aiq-lesson-row ${checked ? 'is-checked' : ''}`}
                                                                                    onClick={() => toggleLesson(l)}
                                                                                    disabled={!hasText}
                                                                                    title={hasText ? undefined : 'This lesson has no written content to seed questions yet'}
                                                                                >
                                                                                    <span className={`aiq-checkbox--box ${checked ? 'is-checked' : ''}`}>
                                                                                        {checked && <Check size={10} strokeWidth={3.5} />}
                                                                                    </span>
                                                                                    <FileText size={12} className="aiq-lesson-icon" />
                                                                                    <span className="aiq-lesson-title">{l.title}</span>
                                                                                    <span className="aiq-tree-meta">
                                                                                        {hasText ? fmtWords(l.text_chars) : 'no text'}
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
                                                        <span className="aiq-tree-meta">{fmtWords(course.curriculum_chars)}</span>
                                                    </label>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {advancedOpen && (
                                    <div className="aiq-adv-body">
                                                <div className="aiq-adv-row">
                                                    <div className="aiq-rail-label">Custom prompt <span className="aiq-optional">optional</span></div>
                                                    <textarea
                                                        className="aiq-focus"
                                                        rows={2}
                                                        maxLength={500}
                                                        value={focus}
                                                        onChange={(e) => setFocus(e.target.value)}
                                                        placeholder="e.g. focus on recursion, avoid definitions, make it word-problem heavy…"
                                                    />
                                                </div>

                                                <div className="aiq-adv-row">
                                                    <div className="aiq-rail-label">Reference files <span className="aiq-optional">optional</span></div>
                                                    <div
                                                        className={`aiq-dropzone ${files.length > 0 ? 'has-files' : ''}`}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                                                        onClick={() => fileInputRef.current?.click()}
                                                        onKeyDown={dropzoneKeyDown}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-label="Upload reference files"
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

                                                <div className="aiq-adv-row">
                                                    <div className="aiq-rail-label">Question mix</div>
                                                    <p className="aiq-mix-note">
                                                        {countsActive
                                                            ? <>Exact mix — the total above follows it. <button type="button" className="aiq-mix-reset" onClick={() => setCounts(ZERO_COUNTS)}>Back to automatic</button></>
                                                            : 'Automatic — multiple choice only. Set a number here to choose other types exactly.'}
                                                    </p>
                                                    <div className="aiq-mix-grid">
                                                        {AI_TYPES.map((t) => {
                                                            const locked = t.id === 'coding' && codingBlocked;
                                                            return (
                                                                <div key={t.id} className={`aiq-mix-row ${locked ? 'is-locked' : ''}`}>
                                                                    <span className="aiq-mix-label" title={locked ? codingBlocked : undefined}>{t.label}</span>
                                                                    <div className="aiq-stepper aiq-stepper--sm">
                                                                        <button
                                                                            type="button"
                                                                            aria-label={`Fewer ${t.label}`}
                                                                            onClick={() => setCounts((c) => ({ ...c, [t.id]: Math.max(0, Number(c[t.id]) - 1) }))}
                                                                            disabled={locked || Number(counts[t.id]) <= 0}
                                                                        >−</button>
                                                                        <span>{counts[t.id]}</span>
                                                                        <button
                                                                            type="button"
                                                                            aria-label={`More ${t.label}`}
                                                                            onClick={() => setCounts((c) => ({ ...c, [t.id]: Math.min(20, Number(c[t.id]) + 1) }))}
                                                                            disabled={locked || countsSum >= 20}
                                                                            title={locked ? codingBlocked : undefined}
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <p className="aiq-hint">
                                                        <TriangleAlert size={11} />
                                                        Identification and short answer are graded by exact match — the AI writes a canonical answer, but review them.
                                                    </p>
                                                </div>

                                                <div className="aiq-adv-row">
                                                    <div className="aiq-rail-label">Difficulty</div>
                                                    <div className="aiq-seg" role="group" aria-label="Difficulty">
                                                        {['easy', 'medium', 'hard'].map((d) => (
                                                            <button
                                                                key={d}
                                                                type="button"
                                                                className={`aiq-seg-btn ${difficulty === d ? 'is-active' : ''}`}
                                                                aria-pressed={difficulty === d}
                                                                onClick={() => setDifficulty(d)}
                                                            >
                                                                {d[0].toUpperCase() + d.slice(1)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Only meaningful with coding questions in the mix. On =
                                                    the generator also proposes IO test cases, engine-verifies
                                                    them against its own solution, and the question grades
                                                    itself at submit instead of waiting for the teacher. */}
                                                <div className="aiq-adv-row" title={(counts.coding ?? 0) > 0 ? undefined : 'Add coding questions to the mix first'}>
                                                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: (counts.coding ?? 0) > 0 ? 'pointer' : 'not-allowed', opacity: (counts.coding ?? 0) > 0 ? 1 : 0.5 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={genTestCases}
                                                            disabled={(counts.coding ?? 0) === 0}
                                                            onChange={(e) => setGenTestCases(e.target.checked)}
                                                            style={{ marginTop: 2 }}
                                                        />
                                                        <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                                                            <strong>Generate test cases for coding questions</strong>
                                                            {' '}— the AI proposes stdin/expected-output checks, verifies them against its own
                                                            solution on the engine, and these questions grade themselves automatically.
                                                        </span>
                                                    </label>
                                                </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="aiq-foot">
                            <p className="aiq-foot-summary">
                                {canGenerate
                                    ? `${plural(totalCount, 'question')} · ${countsActive ? 'your mix' : difficulty} · from ${summaryParts.join(' + ')}`
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
                                    <span className="aiq-preview-text"><FormattedText text={d.question_text} /></span>
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
                            <button type="button" className="db-btn-ghost aiq-stop-btn" onClick={stopGeneration}>
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
                                        {d.type === 'essay' && (
                                            <span className="aiq-manual-chip">manual grading</span>
                                        )}
                                        {d.type === 'multiple_choice' && d.correctIndex == null && (
                                            <span className="aiq-missing-key">
                                                <TriangleAlert size={11} />
                                                pick the correct option
                                            </span>
                                        )}
                                        {d.type === 'coding' && (!d.boilerplate?.trim() || !d.expected_output?.trim()) && (
                                            <span className="aiq-missing-key">
                                                <TriangleAlert size={11} />
                                                needs starter code + expected output
                                            </span>
                                        )}
                                        <span className="aiq-card-points">
                                            <button type="button" aria-label="Fewer points" onClick={() => patchDraft(d.localId, { points: Math.max(1, Number(d.points) - 1) })}>−</button>
                                            {d.points} pt{Number(d.points) !== 1 ? 's' : ''}
                                            <button type="button" aria-label="More points" onClick={() => patchDraft(d.localId, { points: Math.min(100, Number(d.points) + 1) })}>+</button>
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
                                        aria-label={`Question ${index + 1} text`}
                                    />

                                    {d.type === 'multiple_choice' && (
                                        <div className="aiq-options">
                                            {d.options.map((opt, i) => {
                                                const correct = d.correctIndex === i;
                                                return (
                                                    <div key={i} className={`aiq-option ${correct ? 'is-correct' : ''}`}>
                                                        <button
                                                            type="button"
                                                            className="aiq-option-radio"
                                                            title={correct ? 'Correct answer' : 'Mark as correct'}
                                                            aria-label={correct ? `Option ${i + 1} is the correct answer` : `Mark option ${i + 1} as correct`}
                                                            aria-pressed={correct}
                                                            onClick={() => patchDraft(d.localId, { correctIndex: i })}
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
                                        <div className="aiq-seg aiq-tf" role="group" aria-label="Correct answer">
                                            {['True', 'False'].map((v) => (
                                                <button
                                                    key={v}
                                                    type="button"
                                                    className={`aiq-seg-btn ${d.expected_output === v ? 'is-active' : ''}`}
                                                    aria-pressed={d.expected_output === v}
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
                                                aria-label="Correct answer"
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
                                                        aria-label={`Correct item ${i + 1}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="aiq-option-remove"
                                                        onClick={() => removeOption(d, i)}
                                                        disabled={d.options.length <= 1}
                                                        title={d.options.length <= 1 ? 'An enumeration needs at least one item' : undefined}
                                                    >
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

                                    {d.type === 'coding' && (
                                        <div className="aiq-coding">
                                            <div className="aiq-coding-field">
                                                <div className="aiq-rail-label">Starter code</div>
                                                <textarea
                                                    className="aiq-code"
                                                    rows={4}
                                                    value={d.boilerplate}
                                                    onChange={(e) => patchDraft(d.localId, { boilerplate: e.target.value })}
                                                    aria-label={`Question ${index + 1} starter code`}
                                                    spellCheck={false}
                                                />
                                            </div>
                                            <div className="aiq-coding-field">
                                                <div className="aiq-rail-label">
                                                    Reference solution <span className="aiq-optional">the answer key — students never see it</span>
                                                </div>
                                                <textarea
                                                    className="aiq-code"
                                                    rows={5}
                                                    value={d.reference_code}
                                                    onChange={(e) => patchDraft(d.localId, { reference_code: e.target.value })}
                                                    aria-label={`Question ${index + 1} reference solution`}
                                                    spellCheck={false}
                                                />
                                            </div>
                                            <div className="aiq-coding-field">
                                                <div className="aiq-rail-label">Expected output</div>
                                                <textarea
                                                    className="aiq-code aiq-code--short"
                                                    rows={2}
                                                    value={d.expected_output}
                                                    onChange={(e) => patchDraft(d.localId, { expected_output: e.target.value })}
                                                    aria-label={`Question ${index + 1} expected output`}
                                                    spellCheck={false}
                                                />
                                            </div>
                                            {d.language && <span className="aiq-lang-chip">{d.language}</span>}
                                            {/* Test cases — already engine-verified against the
                                                reference solution at generation; each test is
                                                one auto-grade probe. Editable + removable. */}
                                            {(d.test_cases?.length ?? 0) > 0 && (
                                                <div className="aiq-coding-field">
                                                    <div className="aiq-rail-label">
                                                        Test cases <span className="aiq-optional">already verified against the reference solution — with these, the question grades itself</span>
                                                    </div>
                                                    {d.test_cases.map((tc, ti) => (
                                                        <div key={ti} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', border: '1px solid var(--db-border, #333)', borderRadius: 10, marginBottom: 8 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--db-text-3)' }}>Test {ti + 1} — stdin</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => patchDraft(d.localId, { test_cases: d.test_cases.filter((_, j) => j !== ti) })}
                                                                    style={{ background: 'transparent', border: 'none', color: 'var(--db-danger, #f87171)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                                                                >
                                                                    Remove
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                className="aiq-code"
                                                                rows={2}
                                                                value={tc.input}
                                                                onChange={(e) => patchDraft(d.localId, { test_cases: d.test_cases.map((x, j) => (j === ti ? { ...x, input: e.target.value } : x)) })}
                                                                aria-label={`Question ${index + 1} test case ${ti + 1} stdin`}
                                                                spellCheck={false}
                                                                placeholder="(empty stdin is allowed)"
                                                            />
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--db-text-3)' }}>Expected stdout</span>
                                                            <textarea
                                                                className="aiq-code"
                                                                rows={2}
                                                                value={tc.expected_output}
                                                                onChange={(e) => patchDraft(d.localId, { test_cases: d.test_cases.map((x, j) => (j === ti ? { ...x, expected_output: e.target.value } : x)) })}
                                                                aria-label={`Question ${index + 1} test case ${ti + 1} expected output`}
                                                                spellCheck={false}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
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

                        <div className="aiq-foot aiq-foot--review">
                            <div className="aiq-mode" role="group" aria-label="Destination">
                                <button
                                    type="button"
                                    className={`aiq-mode-btn ${mode === 'append' ? 'is-active' : ''}`}
                                    aria-pressed={mode === 'append'}
                                    onClick={() => setMode('append')}
                                    disabled={committing}
                                >
                                    Add to existing
                                </button>
                                <button
                                    type="button"
                                    className={`aiq-mode-btn ${mode === 'replace' ? 'is-active is-danger' : ''}`}
                                    aria-pressed={mode === 'replace'}
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
                            <button
                                type="button"
                                className={`db-btn-primary aiq-generate-btn ${mode === 'replace' ? 'aiq-commit--danger' : ''}`}
                                onClick={commit}
                                disabled={committing || drafts.length === 0 || invalidDrafts.length > 0}
                            >
                                {committing ? <Loader2 size={14} className="aiq-spin" /> : <ListChecks size={15} />}
                                {mode === 'replace' ? 'Replace with' : 'Add'} {plural(drafts.length, 'question')}
                            </button>
                        </div>

                        {confirmDiscard && (
                            <div className="aiq-discard-bar" role="alertdialog" aria-label="Discard generated questions?">
                                <TriangleAlert size={15} />
                                <span className="aiq-discard-text">
                                    Discard these {plural(drafts.length, 'question')} and every edit you made?
                                </span>
                                <button type="button" className="aiq-discard-keep" onClick={() => setConfirmDiscard(false)}>
                                    Keep editing
                                </button>
                                <button
                                    type="button"
                                    className="aiq-discard-yes"
                                    onClick={() => { setConfirmDiscard(false); setDrafts([]); onClose(); }}
                                >
                                    Discard
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

function labelFor(type) {
    return AI_TYPES.find((t) => t.id === type)?.label ?? type;
}
