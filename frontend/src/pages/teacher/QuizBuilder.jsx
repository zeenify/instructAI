import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, Reorder, useDragControls } from 'framer-motion';
import {
    ChevronLeft, ChevronUp, ChevronDown, Trash2, Loader2, Plus, X, Check,
    CheckCircle2, Code, Type, ListOrdered, Hash, Shuffle, Bot, Globe,
    GripVertical, Clock, Target, Filter, Hourglass
} from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import { queryClient } from '../../lib/queryClient';
import { quizKey, useQuiz } from '../../queries/quiz';
import { classDetailsKey } from '../../queries/classDetails';
import { SkeletonBlock } from '../../components/ui/skeletons';
import TestCaseEditor from '../../components/teacher/TestCaseEditor';
import HtmlChecksEditor from '../../components/teacher/HtmlChecksEditor';
import CodeMirror from '@uiw/react-codemirror';
import { CODE_LANGUAGES, cmExtension, resolveLanguage, languageOf } from '../../utils/codeLanguages';
import './QuizBuilder.css';

/** A question "has no correct answer" when the teacher hasn't marked one yet. */
function needsAnswer(q) {
    if (q.type === 'multiple_choice') return !(q.expected_output !== '' && q.expected_output != null);
    if (q.type === 'identification') return !(String(q.expected_output || '').trim());
    if (q.type === 'true_false') return q.expected_output !== 'True' && q.expected_output !== 'False';
    if (q.type === 'enumeration') return !(q.options || []).some((o) => String(o || '').trim());
    if (q.type === 'coding') return !(String(q.expected_output || '').trim());
    return false;
}

/** One quiz question block with hover toolbar (drag / move / delete). */
function QuestionBlock({ q, index, lastIndex, onMove, update, remove, randomized, isConfirming, setConfirming }) {
    const controls = useDragControls();
    const [dragging, setDragging] = useState(false);
    const movedRef = useRef(false);
    const qLang = q.type === 'coding' ? languageOf(resolveLanguage(q.language, q.boilerplate || q.expected_output)) : null;

    return (
        <Reorder.Item
            value={q}
            dragListener={false}
            dragControls={controls}
            className={`ed-block qb-q ${dragging ? 'dragging' : ''}`}
            onDragStart={() => { movedRef.current = true; setDragging(true); }}
            onDragEnd={() => {
                setDragging(false);
                setTimeout(() => { movedRef.current = false; }, 150);
            }}
            onClick={() => { if (!movedRef.current && !dragging) return; }}
        >
            <div className="ed-block-tools" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="ed-tool ed-tool-grip"
                    title={randomized ? 'Shuffle is on — the order is random per attempt' : 'Drag to reorder'}
                    aria-label="Drag to reorder"
                    disabled={randomized}
                    onPointerDown={(e) => { if (!randomized) controls.start(e); }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <GripVertical size={15} />
                </button>
                <button
                    type="button"
                    className="ed-tool"
                    title="Move up"
                    aria-label="Move up"
                    disabled={index === 0 || randomized}
                    onClick={() => onMove(index, -1)}
                >
                    <ChevronUp size={15} />
                </button>
                <button
                    type="button"
                    className="ed-tool"
                    title="Move down"
                    aria-label="Move down"
                    disabled={index === lastIndex || randomized}
                    onClick={() => onMove(index, 1)}
                >
                    <ChevronDown size={15} />
                </button>
                {isConfirming ? (
                    <motion.button
                        type="button"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        className="ed-tool ed-tool-confirm"
                        title="Confirm delete"
                        onClick={() => remove(q)}
                    >
                        <Check size={15} />
                    </motion.button>
                ) : (
                    <button
                        type="button"
                        className="ed-tool ed-tool-del"
                        title="Delete question"
                        onClick={() => setConfirming(true)}
                    >
                        <Trash2 size={15} />
                    </button>
                )}
                {isConfirming && (
                    <button type="button" className="ed-tool ed-tool-cancel" title="Keep question" onClick={() => setConfirming(false)}>
                        <X size={15} />
                    </button>
                )}
            </div>

            <div className="qb-q-head">
                <span className="qb-q-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="qb-q-type">{(q.type || 'question').replace('_', ' / ')}</span>
                {needsAnswer(q) && (
                    <span className="qb-q-warn" title="Students can't answer this correctly yet — mark the correct answer">
                        no correct answer
                    </span>
                )}
                <div className="qb-q-weight" title="Points this question is worth">
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={q.points ?? 1}
                        onChange={(e) => update(q.id, { points: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    <span>pts</span>
                </div>
            </div>

            <textarea
                className="qb-q-text"
                rows={1}
                placeholder="Compose your question here…"
                value={q.question_text || ''}
                onChange={(e) => update(q.id, { question_text: e.target.value })}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = `${e.target.scrollHeight}px`; }}
            />

            <div className="qb-q-body">
                {q.type === 'multiple_choice' && (
                    <div className="qb-choices">
                        {q.options?.map((opt, i) => {
                            const correct = String(q.expected_output) === String(i);
                            return (
                                <div key={i} className={`qb-choice ${correct ? 'correct' : ''}`}>
                                    <button
                                        type="button"
                                        className="qb-choice-radio"
                                        title={correct ? 'This is the correct answer' : 'Mark as the correct answer'}
                                        onClick={() => update(q.id, { expected_output: String(i) })}
                                    >
                                        {correct && <Check size={14} strokeWidth={3} />}
                                    </button>
                                    <input
                                        value={opt ?? ''}
                                        placeholder={`Option ${i + 1}`}
                                        onChange={(e) => {
                                            const n = [...q.options];
                                            n[i] = e.target.value;
                                            update(q.id, { options: n });
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                {q.type === 'identification' && (
                    <div className="qb-answer">
                        <span className="qb-field-label">Correct answer</span>
                        <input
                            className="qb-input"
                            placeholder="The exact answer students must type…"
                            value={q.expected_output ?? ''}
                            onChange={(e) => update(q.id, { expected_output: e.target.value })}
                        />
                    </div>
                )}

                {q.type === 'true_false' && (
                    <div className="qb-tf">
                        {['True', 'False'].map((val) => (
                            <button
                                key={val}
                                type="button"
                                className={`qb-tf-btn ${q.expected_output === val ? 'active' : ''}`}
                                onClick={() => update(q.id, { expected_output: val })}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                )}

                {q.type === 'enumeration' && (
                    <div className="qb-enum">
                        {q.options?.map((opt, i) => (
                            <div key={i} className="qb-enum-row">
                                <span className="qb-enum-num">{i + 1}.</span>
                                <input
                                    value={opt ?? ''}
                                    placeholder={`Entry ${i + 1}…`}
                                    onChange={(e) => {
                                        const n = [...q.options];
                                        n[i] = e.target.value;
                                        update(q.id, { options: n });
                                    }}
                                />
                                <button
                                    type="button"
                                    className="qb-enum-del"
                                    title="Remove this entry"
                                    onClick={() => update(q.id, { options: q.options.filter((_, idx) => idx !== i) })}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            className="qb-enum-add"
                            onClick={() => update(q.id, { options: [...(q.options || []), ''] })}
                        >
                            <Plus size={13} /> Add another entry
                        </button>
                    </div>
                )}

                {q.type === 'coding' && qLang && (
                    <div className="qb-coding">
                        <div className="qb-code-row">
                            <span className="ed-card-label">Language</span>
                            <button
                                type="button"
                                className="le-template-btn"
                                title="Puts example code in the editor — it replaces what is written now"
                                onClick={() => update(q.id, { boilerplate: qLang.template })}
                            >
                                + Add example code
                            </button>
                        </div>
                        <div className="qb-seg">
                            {Object.values(CODE_LANGUAGES).map((l) => (
                                <button
                                    key={l.id}
                                    type="button"
                                    onClick={() => update(q.id, { language: l.id })}
                                    title={l.preview ? 'Answers render in a browser preview' : 'Runs on the execution engine'}
                                    className={qLang.id === l.id ? 'active' : ''}
                                >
                                    <span className="qb-lang-dot" style={{ background: l.color, boxShadow: qLang.id === l.id ? `0 0 6px ${l.color}` : 'none' }} />
                                    {l.label}
                                </button>
                            ))}
                        </div>
                        <div className="qb-coding-goal">
                            <span className="ed-card-label">Starter code students see</span>
                            <p className="qb-card-hint">Optional — leave empty and students start from scratch.</p>
                        </div>
                        <div className="qb-cm">
                            <CodeMirror
                                value={q.boilerplate || ''}
                                height="240px"
                                theme="dark"
                                extensions={[cmExtension(qLang.id)]}
                                onChange={(val) => update(q.id, { boilerplate: val })}
                            />
                        </div>
                        <div className="qb-coding-goal">
                            <span className="ed-card-label">
                                {qLang.preview ? 'Challenge goal — the page must show' : 'Challenge goal — the console must print'}
                            </span>
                            <input
                                className="qb-input"
                                placeholder={qLang.preview ? 'e.g. My Favorite Hobby' : 'e.g. Hello World'}
                                value={q.expected_output ?? ''}
                                onChange={(e) => update(q.id, { expected_output: e.target.value })}
                            />
                        </div>
                        {qLang.preview && (
                            <HtmlChecksEditor
                                title="Page Checks"
                                checks={q.html_checks || []}
                                onChange={(next) => update(q.id, { html_checks: next })}
                                referenceHtml={q.reference_code || ''}
                                onReferenceChange={(text) => update(q.id, { reference_code: text })}
                            />
                        )}
                        {!qLang.preview && <TestCaseEditor question={q} />}
                        {!qLang.preview && (
                            <button
                                type="button"
                                className={`qb-partial ${q.partial_credit ? 'on' : ''}`}
                                title="Off: every test must pass for full points. On: points × tests passed."
                                onClick={() => update(q.id, { partial_credit: !q.partial_credit })}
                            >
                                Allow partial credit
                                <span className={`qb-partial-track ${q.partial_credit ? 'on' : ''}`}>
                                    <span className="qb-partial-knob" />
                                </span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </Reorder.Item>
    );
}

export default function QuizBuilder() {
    const { classId, id } = useParams();
    const navigate = useNavigate();

    const { data: quizData } = useQuiz(id);

    const [quiz, setQuiz] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [confirmDraft, setConfirmDraft] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Save lifecycle: 'saved' | 'dirty' | 'saving' | 'error'
    const [saveState, setSaveState] = useState('saved');
    const [lastSavedAt, setLastSavedAt] = useState(null);

    const seededRef = useRef(false);
    const dirtyRef = useRef(false);
    const timerRef = useRef(null);
    // Question edits persist through their OWN endpoints (the quiz PUT does
    // not touch question rows) — patches queue here and flush on save.
    const pendingQ = useRef(new Map());
    const latest = useRef(null);
    latest.current = { quiz, questions };

    useEffect(() => {
        if (quizData && !seededRef.current) {
            seededRef.current = true;
            const sorted = (quizData.questions || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            setQuiz(quizData);
            setQuestions(sorted);
            setLoaded(true);
        }
    }, [quizData]);

    useEffect(() => {
        seededRef.current = false;
        setLoaded(false);
        setSaveState('saved');
        dirtyRef.current = false;
        clearTimeout(timerRef.current);
    }, [id]);

    const saveAll = useCallback(async ({ announce = false, publishOverride, isRetry = false } = {}) => {
        const l = latest.current;
        if (!l.quiz) return;
        clearTimeout(timerRef.current);
        timerRef.current = null;
        dirtyRef.current = false;
        setSaveState('saving');
        try {
            const res = await api.put(`/teacher/quizzes/${id}`, {
                ...l.quiz,
                is_published: publishOverride ?? l.quiz.is_published,
            });
            if (publishOverride !== undefined) setQuiz((prev) => ({ ...prev, is_published: publishOverride }));
            setSaveState('saved');
            setLastSavedAt(new Date());
            queryClient.setQueryData(quizKey(id), res.data?.quiz || res.data);
            invalidateCache(`/teacher/quizzes/${id}`);
            invalidateCache('/teacher/courses/');
            queryClient.invalidateQueries({ queryKey: classDetailsKey(classId) });
            // Flush queued question patches (each through its own endpoint)
            const entries = [...pendingQ.current.entries()];
            if (entries.length) {
                const results = await Promise.allSettled(entries.map(([qId, patch]) => api.put(`/teacher/questions/${qId}`, patch)));
                const stillPending = new Map(entries.filter((_, i) => results[i].status === 'rejected'));
                pendingQ.current = stillPending;
                if (stillPending.size) throw new Error('question patches failed');
            }
            if (announce) {
                toast.success(publishOverride === undefined
                    ? 'Quiz saved'
                    : (publishOverride ? 'Published — students can see this quiz' : 'Moved back to draft'));
            }
            if (dirtyRef.current) {
                timerRef.current = setTimeout(() => saveAll(), 1600);
            }
        } catch (err) {
            dirtyRef.current = true;
            setSaveState('error');
            if (announce) toast.error('Could not save the quiz. It will retry in a moment.');
            if (!isRetry) timerRef.current = setTimeout(() => saveAll({ publishOverride, isRetry: true }), 5000);
        }
    }, [id, classId]);

    const markDirty = useCallback(() => {
        dirtyRef.current = true;
        setSaveState('dirty');
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => saveAll(), 1600);
    }, [saveAll]);

    const togglePublish = async () => {
        const current = latest.current.quiz;
        if (!current) return;
        const next = !current.is_published;
        // Unpublishing hides the quiz from every student — confirm first
        if (!next && !confirmDraft) {
            setConfirmDraft(true);
            setTimeout(() => setConfirmDraft(false), 3500);
            return;
        }
        setConfirmDraft(false);
        const newQuiz = { ...current, is_published: next };
        latest.current = { ...latest.current, quiz: newQuiz };
        setQuiz(newQuiz);
        await saveAll({ announce: true, publishOverride: next });
    };

    const goBack = async () => {
        if (dirtyRef.current) await saveAll();
        navigate(`/dashboard/teacher/class/${classId}?module=${quiz?.module_id}&tab=content`);
    };

    // Tab close / reload safety net while there are unsaved edits
    useEffect(() => {
        const onBeforeUnload = (e) => {
            if (dirtyRef.current || saveState === 'saving' || saveState === 'error') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [saveState]);

    // Leaving the editor flushes pending edits (best effort)
    useEffect(() => () => {
        clearTimeout(timerRef.current);
        if (dirtyRef.current && latest.current.quiz) {
            api.put(`/teacher/quizzes/${id}`, {
                ...latest.current.quiz,
            }).catch(() => {});
        }
    }, [id]);

    const updateSetting = (updates) => {
        setQuiz((prev) => ({ ...prev, ...updates }));
        markDirty();
    };

    const updateQuestion = (qId, data) => {
        setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, ...data } : q)));
        pendingQ.current.set(qId, { ...(pendingQ.current.get(qId) || {}), ...data });
        markDirty();
    };

    const handleReorder = (newOrder) => {
        setQuestions(newOrder);
        markDirty();
        api.post(`/teacher/quizzes/${id}/reorder-questions`, { question_ids: newOrder.map((q) => q.id) })
            .then(() => { setSaveState((s) => (s === 'dirty' ? s : 'saved')); setLastSavedAt(new Date()); })
            .catch(() => { setSaveState('error'); toast.error('Could not save the new order'); });
    };

    const moveQuestion = (index, dir) => {
        setQuestions((prev) => {
            const next = [...prev];
            const to = index + dir;
            if (to < 0 || to >= next.length) return prev;
            [next[index], next[to]] = [next[to], next[index]];
            return next;
        });
        markDirty();
    };

    const removeQuestion = (q) => {
        setQuestions((prev) => prev.filter((x) => x.id !== q.id));
        setDeleteTarget(null);
        markDirty();
        pendingQ.current.delete(q.id);
        api.delete(`/teacher/questions/${q.id}`).catch(() => {
            toast.error('Could not delete the question on the server — reloading.');
            api.get(`/teacher/quizzes/${id}`, { bypassCache: true }).then((res) => {
                seededRef.current = false;
                if (res.data) {
                    const sorted = (res.data.questions || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                    setQuiz(res.data);
                    setQuestions(sorted);
                }
            });
        });
    };

    const addQuestion = async (type = 'multiple_choice') => {
        setIsCreating(true);
        try {
            const res = await api.post(`/teacher/quizzes/${id}/questions`, {
                type,
                language: type === 'coding' ? 'java' : undefined,
                order_index: (latest.current.questions?.length || 0) + 1,
            });
            setQuestions((prev) => [...prev, res.data]);
            markDirty();
            setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
        } catch (err) {
            toast.error('Could not add the question');
        } finally {
            setIsCreating(false);
        }
    };

    const stats = useMemo(() => {
        const total = questions.reduce((acc, q) => acc + (Math.max(0, Number(q.points)) || 0), 0);
        const activeCount = quiz?.is_randomized && quiz?.question_limit ? quiz.question_limit : questions.length;
        const sortedByPoints = [...questions].sort((a, b) => (Number(a.points) || 0) - (Number(b.points) || 0));
        const minPossiblePoints = sortedByPoints.slice(0, activeCount).reduce((acc, q) => acc + (Number(q.points) || 0), 0);
        return {
            totalPoints: total,
            minPossiblePoints,
            poolSize: questions.length,
            activeCount,
            isPassingInvalid: (quiz?.passing_score || 0) > minPossiblePoints,
            isLimitInvalid: quiz?.is_randomized && quiz?.question_limit > questions.length,
        };
    }, [questions, quiz?.passing_score, quiz?.is_randomized, quiz?.question_limit]);

    const unanswered = questions.filter((q) => needsAnswer(q)).length;

    const saveStatus = (
        <span className={`ed-status ${saveState}`}>
            {saveState === 'saved' && <Check size={13} />}
            {saveState === 'saving' && <Loader2 size={13} className="animate-spin" />}
            {saveState === 'saved' && (lastSavedAt ? 'Saved just now' : 'All changes saved')}{saveState === 'saved' && quiz?.is_published ? ' · live to students' : ''}
            {saveState === 'dirty' && 'Unsaved changes'}
            {saveState === 'error' && 'Save failed — retrying…'}
        </span>
    );

    if (!loaded || !quiz) {
        return (
            <div className="ed-shell">
                <div className="ed-header">
                    <div className="ed-header-left">
                        <SkeletonBlock style={{ width: 40, height: 40, borderRadius: 999 }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                <SkeletonBlock style={{ width: 46, height: 11 }} />
                                <SkeletonBlock style={{ width: 70, height: 20, borderRadius: 999 }} />
                            </div>
                            <SkeletonBlock style={{ width: '70%', height: 24 }} />
                        </div>
                    </div>
                    <div className="ed-header-actions">
                        <SkeletonBlock style={{ width: 130, height: 40, borderRadius: 12 }} />
                        <SkeletonBlock style={{ width: 100, height: 40, borderRadius: 12 }} />
                    </div>
                </div>
                <div className="qb-settings">
                    {[0, 1, 2, 3].map((i) => (
                        <SkeletonBlock key={i} style={{ height: 140, borderRadius: 16 }} />
                    ))}
                </div>
                <SkeletonBlock style={{ width: '100%', height: 220, borderRadius: 16, display: 'block' }} />
            </div>
        );
    }

    const getDisplayTime = () => {
        return quiz.timer_mode === 'per_question' ? Math.round((quiz.time_limit_minutes || 0) * 60) : (quiz.time_limit_minutes || 0);
    };

    const handleTimeInput = (val) => {
        let numericVal = parseFloat(val) || 0;
        if (numericVal < 0) numericVal = 0;
        let minutes = quiz.timer_mode === 'per_question' ? numericVal / 60 : numericVal;
        if (minutes > 300) minutes = 300;
        updateSetting({ time_limit_minutes: minutes });
    };

    const deleteQuestionText = deleteTarget ? (questions.find((q) => q.id === deleteTarget)?.question_text || '') : '';

    return (
        <div className="ed-shell">
            {/* STICKY HEADER */}
            <div className="ed-header">
                <div className="ed-header-left">
                    <button type="button" className="ed-back-icon" onClick={goBack} title="Back to module" aria-label="Back to module">
                        <ChevronLeft size={19} />
                    </button>
                    <div className="ed-title-block">
                        <div className="ed-kicker-row">
                            <span className="ed-kicker">Quiz</span>
                            {quiz.is_published ? (
                                <span className="ed-badge published" title="Students can see this quiz">
                                    <Check size={11} />
                                    Published
                                </span>
                            ) : (
                                <span className="ed-badge draft" title="Only you can see this quiz — press Publish when ready">
                                    Draft
                                </span>
                            )}
                        </div>
                        <input
                            value={quiz.title || ''}
                            onChange={(e) => { setQuiz({ ...quiz, title: e.target.value }); markDirty(); }}
                            className="ed-title-input"
                            placeholder="Quiz title…"
                        />
                        <span className="ed-meta">
                            {saveStatus}
                            {unanswered > 0 && (
                                <>
                                    <span className="ed-meta-sep">&middot;</span>
                                    <span className="ed-status warn">
                                        {unanswered} {unanswered === 1 ? 'question has' : 'questions have'} no correct answer yet
                                    </span>
                                </>
                            )}
                        </span>
                    </div>
                </div>
                <div className="ed-header-actions">
                    <button
                        type="button"
                        className={`ed-ai-chip ${quiz.is_randomized ? 'on' : ''}`}
                        title="Each student gets a random slice of the question bank"
                        onClick={() => updateSetting({ is_randomized: !quiz.is_randomized })}
                    >
                        <Shuffle size={17} />
                        <span className="ed-ai-chip-label">
                            Shuffle
                            <span className="ed-ai-chip-state">
                                {quiz.is_randomized ? `On · ${quiz.question_limit || questions.length} of ${questions.length}` : 'Off'}
                            </span>
                        </span>
                    </button>
                    <button
                        type="button"
                        className={`ed-ai-chip ${quiz.allow_ai_assistance ? 'on' : ''}`}
                        title="When on, the students' AI Tutor can answer questions about this quiz while they take it. It never edits your questions."
                        onClick={() => updateSetting({ allow_ai_assistance: !quiz.allow_ai_assistance })}
                    >
                        <Bot size={17} />
                        <span className="ed-ai-chip-label">
                            AI Tutor
                            <span className="ed-ai-chip-state">{quiz.allow_ai_assistance ? 'Helps students' : 'Off'}</span>
                        </span>
                    </button>
                    {quiz.is_published ? (
                        <button
                            type="button"
                            className={`db-btn-ghost ${confirmDraft ? 'ed-btn-warn' : ''}`}
                            onClick={togglePublish}
                            disabled={saveState === 'saving'}
                            title="Hides this quiz from students"
                        >
                            {confirmDraft ? 'Students will lose access — confirm' : 'Return to draft'}
                        </button>
                    ) : (
                        <button type="button" className="db-btn-primary" onClick={togglePublish} disabled={saveState === 'saving'}>
                            {saveState === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
                            Publish
                        </button>
                    )}
                </div>
            </div>

            {/* SETTINGS DASHBOARD */}
            <div className="qb-settings">
                <div className="qb-card">
                    <span className="ed-card-label"><Clock size={14} /> Timer</span>
                    <div className="qb-seg qb-seg-fill">
                        {['entire_quiz', 'per_question'].map((m) => (
                            <button
                                key={m}
                                type="button"
                                className={quiz.timer_mode === m ? 'active' : ''}
                                onClick={() => updateSetting({ timer_mode: m })}
                            >
                                {m === 'entire_quiz' ? 'Whole quiz' : 'Per question'}
                            </button>
                        ))}
                    </div>
                    <div className="qb-input-row">
                        <Hourglass size={15} />
                        <span className="qb-unit">{quiz.timer_mode === 'per_question' ? 'Seconds' : 'Minutes'}</span>
                        <input
                            type="number"
                            min="1"
                            max="300"
                            value={getDisplayTime()}
                            onChange={(e) => handleTimeInput(e.target.value)}
                        />
                    </div>
                </div>

                <div className={`qb-card ${stats.isPassingInvalid ? 'invalid' : ''}`}>
                    <span className="ed-card-label"><Target size={14} /> Passing score</span>
                    <p className="qb-card-hint">Minimum points a student needs to pass.</p>
                    <div className="qb-input-row">
                        <span className="qb-unit">Required</span>
                        <input
                            type="number"
                            min="0"
                            value={quiz.passing_score ?? 0}
                            onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                updateSetting({ passing_score: Math.min(val, stats.minPossiblePoints) });
                            }}
                        />
                        <span className="qb-unit">of {stats.minPossiblePoints} total</span>
                    </div>
                    {stats.isPassingInvalid && (
                        <p className="qb-card-error">Exceeds the worst-case total — lower it.</p>
                    )}
                </div>

                <div className={`qb-card ${!quiz.is_randomized ? 'muted' : ''}`}>
                    <span className="ed-card-label"><Filter size={14} /> Question limit</span>
                    <p className="qb-card-hint">
                        {quiz.is_randomized
                            ? 'How many of the banked questions appear per attempt.'
                            : 'Turn on Shuffle to give each student a random slice of the question bank.'}
                    </p>
                    {!quiz.is_randomized && (
                        <button
                            type="button"
                            className="qb-card-action"
                            onClick={() => updateSetting({ is_randomized: true })}
                        >
                            Turn on Shuffle
                        </button>
                    )}
                    <div className="qb-input-row">
                        <span className="qb-unit">Show</span>
                        <input
                            type="number"
                            min="1"
                            max={questions.length}
                            placeholder="All"
                            disabled={!quiz.is_randomized}
                            value={quiz.question_limit || ''}
                            onChange={(e) => {
                                if (e.target.value === '') return updateSetting({ question_limit: null });
                                const val = Math.max(1, Number(e.target.value) || 1);
                                updateSetting({ question_limit: Math.min(val, questions.length) });
                            }}
                        />
                        <span className="qb-unit">of {stats.poolSize}</span>
                    </div>
                </div>

                <div className="qb-card qb-summary">
                    <div className="qb-summary-row">
                        <span>Questions in quiz</span>
                        <b>{stats.activeCount}</b>
                    </div>
                    <div className="qb-summary-row">
                        <span>Total points</span>
                        <b>{stats.totalPoints}</b>
                    </div>
                    <div className="qb-summary-row">
                        <span>Passing score</span>
                        <b>{quiz.passing_score ?? 0}</b>
                    </div>
                </div>
            </div>

            {/* QUESTIONS */}
            {questions.length === 0 ? (
                <div className="ed-empty">
                    <CheckCircle2 size={26} />
                    <h3>Start your quiz</h3>
                    <p>Pick a question type above — multiple choice, true or false, coding and more. Everything saves automatically.</p>
                </div>
            ) : (
                <Reorder.Group axis="y" values={questions} onReorder={handleReorder} className="ed-list">
                    {questions.map((q, index) => (
                        <QuestionBlock
                            key={q.id}
                            q={q}
                            index={index}
                            lastIndex={questions.length - 1}
                            onMove={moveQuestion}
                            update={updateQuestion}
                            remove={removeQuestion}
                            randomized={Boolean(quiz.is_randomized)}
                            isConfirming={deleteTarget === q.id}
                            setConfirming={(v) => setDeleteTarget(v ? q.id : null)}
                        />
                    ))}
                </Reorder.Group>
            )}

            {isCreating && (
                <div className="qb-creating">
                    <Loader2 size={20} className="animate-spin" />
                    Adding question…
                </div>
            )}

            {/* QUESTION PALETTE */}
            <div className="ed-insert">
                <span className="ed-insert-label">Add a question to this quiz</span>
                <div className="ed-insert-grid">
                    <button type="button" className="ed-insert-card" onClick={() => addQuestion('multiple_choice')} disabled={isCreating}>
                        <span className="ed-insert-icon"><CheckCircle2 size={19} /></span>
                        <span className="ed-insert-text">
                            <span className="ed-insert-name">Multiple choice</span>
                            <span className="ed-insert-sub">Pick one answer</span>
                        </span>
                    </button>
                    <button type="button" className="ed-insert-card" onClick={() => addQuestion('identification')} disabled={isCreating}>
                        <span className="ed-insert-icon"><Type size={19} /></span>
                        <span className="ed-insert-text">
                            <span className="ed-insert-name">Identification</span>
                            <span className="ed-insert-sub">Type the exact answer</span>
                        </span>
                    </button>
                    <button type="button" className="ed-insert-card" onClick={() => addQuestion('enumeration')} disabled={isCreating}>
                        <span className="ed-insert-icon"><ListOrdered size={19} /></span>
                        <span className="ed-insert-text">
                            <span className="ed-insert-name">Enumeration</span>
                            <span className="ed-insert-sub">List several answers</span>
                        </span>
                    </button>
                    <button type="button" className="ed-insert-card" onClick={() => addQuestion('true_false')} disabled={isCreating}>
                        <span className="ed-insert-icon"><Hash size={19} /></span>
                        <span className="ed-insert-text">
                            <span className="ed-insert-name">True or False</span>
                            <span className="ed-insert-sub">Two options only</span>
                        </span>
                    </button>
                    <button type="button" className="ed-insert-card" onClick={() => addQuestion('coding')} disabled={isCreating}>
                        <span className="ed-insert-icon"><Code size={19} /></span>
                        <span className="ed-insert-text">
                            <span className="ed-insert-name">Coding</span>
                            <span className="ed-insert-sub">Students write code</span>
                        </span>
                    </button>
                </div>
            </div>

            {/* Delete confirmation banner: the two-step confirm lives in the
                question's hover toolbar; this names the question while armed. */}
            {deleteTarget && (
                <div className="qb-delete-note">
                    <Trash2 size={14} />
                    Press the check to delete “{(questions.find((q) => q.id === deleteTarget)?.question_text || '').slice(0, 60)}” — or the × to keep it.
                    <button type="button" onClick={() => setDeleteTarget(null)} aria-label="Cancel delete">
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
