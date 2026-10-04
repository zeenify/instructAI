import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight,
    BookOpen,
    Check,
    ChevronRight,
    ClipboardList,
    Copy,
    FileQuestion,
    Layers,
    Loader2,
    RefreshCw,
    Replace,
    TriangleAlert,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { classDetailsKey } from '../../queries/classDetails';
import { invalidateClasswork } from '../../queries/classwork';
import './CopyClassModal.css';

/**
 * "Copy from another class" — pull a class's content (modules, lessons,
 * quizzes) and/or classwork activities into THIS class as unpublished
 * drafts. Two steps: pick the source class, then choose exactly what to
 * copy (append vs replace for content, per-activity selection).
 */
export default function CopyClassModal({ classId, onClose }) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState('pick');
    const [sourceId, setSourceId] = useState(null);
    const [includeContent, setIncludeContent] = useState(true);
    const [contentMode, setContentMode] = useState('append');
    const [selectedActivities, setSelectedActivities] = useState(new Set());
    const [copying, setCopying] = useState(false);
    const headRef = useRef(null);

    // Escape closes — never while a copy request is in flight
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape' && !copying) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [copying, onClose]);

    // Move focus into the modal, and keep it there across steps
    useEffect(() => {
        headRef.current?.focus();
    }, [step]);

    const { data: classes, isLoading: classesLoading } = useQuery({
        queryKey: ['teacher-classes-for-copy'],
        queryFn: async () => {
            const res = await api.get('/teacher/classes', { bypassCache: true });
            return res.data;
        },
    });

    const otherClasses = useMemo(
        () => (classes ?? []).filter((c) => c.id !== Number(classId)),
        [classes, classId]
    );

    const {
        data: preview,
        isLoading: previewLoading,
        isError: previewError,
        refetch: refetchPreview,
    } = useQuery({
        queryKey: ['copy-preview', sourceId],
        enabled: step === 'configure' && Boolean(sourceId),
        queryFn: async () => {
            const res = await api.get(`/teacher/classes/${sourceId}/copy-preview`, { bypassCache: true });
            return res.data;
        },
    });

    const hasContent = (preview?.modules?.length ?? 0) > 0;
    const activities = preview?.activities ?? [];
    const pickedCount = selectedActivities.size;
    const contentLabel = hasContent && includeContent
        ? `${preview.modules.length} module${preview.modules.length === 1 ? '' : 's'} (${preview.totals.lessons} lessons, ${preview.totals.quizzes} quizzes)`
        : null;
    const canCopy = (includeContent && hasContent) || pickedCount > 0;

    const pickClass = (c) => {
        setSourceId(c.id);
        setSelectedActivities(new Set());
        setIncludeContent(true);
        setContentMode('append');
        setStep('configure');
    };

    const toggleActivity = (id) => {
        setSelectedActivities((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const copy = async () => {
        setCopying(true);
        try {
            const res = await api.post(`/teacher/classes/${classId}/copy-from`, {
                source_class_id: sourceId,
                content_mode: includeContent && hasContent ? contentMode : 'none',
                activity_ids: [...selectedActivities],
            });
            toast.success(res.data.message);
            queryClient.invalidateQueries({ queryKey: classDetailsKey(classId) });
            invalidateClasswork(queryClient, classId);
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Could not copy — try again');
        } finally {
            setCopying(false);
        }
    };

    return (
        <div className="db-modal-backdrop" style={{ zIndex: 1000 }} onClick={copying ? undefined : onClose}>
            <div className="db-modal cc-modal" onClick={(e) => e.stopPropagation()}>
                <button className="db-modal-close" onClick={onClose} type="button" disabled={copying}>
                    <X size={17} />
                </button>

                {step === 'pick' && (
                    <>
                        <div className="db-modal-head" ref={headRef} tabIndex={-1}>
                            <h3 className="db-modal-title">
                                <Copy size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--db-accent-bright)' }} />
                                Copy from another class
                            </h3>
                            <p className="db-modal-sub">
                                Pull content and classwork from one of your other classes into
                                this one. Everything arrives as drafts — deadlines reset, you
                                publish when ready.
                            </p>
                        </div>

                        <div className="cc-list">
                            {classesLoading ? (
                                <div className="cc-loading"><Loader2 size={20} className="cc-spin" /></div>
                            ) : otherClasses.length === 0 ? (
                                <p className="cc-empty">
                                    No other classes yet — create another class first, then copy
                                    content between them.
                                </p>
                            ) : (
                                otherClasses.map((c) => (
                                    <button key={c.id} type="button" className="cc-row" onClick={() => pickClass(c)}>
                                        <span className="cc-row-dot" style={{ background: c.color || 'var(--db-accent)' }} />
                                        <span className="cc-row-main">
                                            <span className="cc-row-name">{c.name}</span>
                                            <span className="cc-row-sub">Code {c.class_code}</span>
                                        </span>
                                        <ChevronRight size={16} className="cc-row-chevron" />
                                    </button>
                                ))
                            )}
                        </div>
                    </>
                )}

                {step === 'configure' && (
                    <>
                        <div className="db-modal-head" ref={headRef} tabIndex={-1}>
                            <button type="button" className="cc-back" onClick={() => setStep('pick')} disabled={copying}>
                                <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
                                Change class
                            </button>
                            <h3 className="db-modal-title">
                                <Copy size={18} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--db-accent-bright)' }} />
                                Copy into this class
                            </h3>
                            <p className="db-modal-sub">
                                From <strong>{preview?.class?.name || '…'}</strong> — choose what to bring over.
                            </p>
                        </div>

                        {previewError ? (
                            <div className="cc-error-row">
                                <TriangleAlert size={15} />
                                <span>Couldn't load what that class can offer.</span>
                                <button type="button" className="cc-retry-btn" onClick={() => refetchPreview()}>
                                    <RefreshCw size={12} /> Retry
                                </button>
                            </div>
                        ) : previewLoading ? (
                            <div className="cc-loading"><Loader2 size={20} className="cc-spin" /></div>
                        ) : (
                            <div className="cc-body">
                                {/* ---- Content section ---- */}
                                {hasContent && (
                                    <section className="cc-section">
                                        <label className="cc-section-head">
                                            <input
                                                type="checkbox"
                                                className="cc-checkbox"
                                                checked={includeContent}
                                                onChange={(e) => setIncludeContent(e.target.checked)}
                                                disabled={copying}
                                            />
                                            <BookOpen size={15} />
                                            <span className="cc-section-title">Class content</span>
                                            <span className="cc-section-meta">
                                                {preview.totals.lessons} lessons · {preview.totals.quizzes} quizzes
                                            </span>
                                        </label>

                                        {includeContent && (
                                            <>
                                                <ul className="cc-tree">
                                                    {preview.modules.map((m) => (
                                                        <li key={m.id} className="cc-tree-row">
                                                            <Layers size={14} className="cc-tree-icon" />
                                                            <span className="cc-tree-title">{m.title}</span>
                                                            <span className="cc-tree-meta">
                                                                {m.lessons_count} lesson{m.lessons_count === 1 ? '' : 's'}
                                                                {' · '}
                                                                {m.quizzes_count} quiz{m.quizzes_count === 1 ? '' : 'zes'}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>

                                                <div className="cc-mode" role="group" aria-label="Destination">
                                                    <button
                                                        type="button"
                                                        className={`cc-mode-btn ${contentMode === 'append' ? 'is-active' : ''}`}
                                                        aria-pressed={contentMode === 'append'}
                                                        onClick={() => setContentMode('append')}
                                                        disabled={copying}
                                                    >
                                                        <ArrowRight size={14} />
                                                        Add to existing
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={`cc-mode-btn ${contentMode === 'replace' ? 'is-active is-danger' : ''}`}
                                                        aria-pressed={contentMode === 'replace'}
                                                        onClick={() => setContentMode('replace')}
                                                        disabled={copying}
                                                    >
                                                        <Replace size={14} />
                                                        Replace current
                                                    </button>
                                                </div>
                                                {contentMode === 'replace' && (
                                                    <p className="cc-warning">
                                                        <TriangleAlert size={13} />
                                                        This class's current modules, lessons and quizzes — and the
                                                        grades attached to them — will be removed. Locked if students
                                                        already have quiz attempts.
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </section>
                                )}

                                {/* ---- Classwork section ---- */}
                                <section className="cc-section">
                                    <div className="cc-section-head">
                                        <ClipboardList size={15} />
                                        <span className="cc-section-title">Classwork</span>
                                        {activities.length > 0 && (
                                            <button
                                                type="button"
                                                className="cc-selectall"
                                                onClick={() =>
                                                    setSelectedActivities((prev) =>
                                                        prev.size === activities.length
                                                            ? new Set()
                                                            : new Set(activities.map((a) => a.id))
                                                    )
                                                }
                                                disabled={copying}
                                            >
                                                {pickedCount === activities.length ? 'Clear all' : 'Select all'}
                                            </button>
                                        )}
                                    </div>

                                    {activities.length === 0 ? (
                                        <p className="cc-empty">No classwork in that class.</p>
                                    ) : (
                                        <ul className="cc-activities">
                                            {activities.map((a) => {
                                                const checked = selectedActivities.has(a.id);
                                                return (
                                                    <li key={a.id}>
                                                        <button
                                                            type="button"
                                                            role="checkbox"
                                                            aria-checked={checked}
                                                            className={`cc-activity ${checked ? 'is-checked' : ''}`}
                                                            onClick={() => toggleActivity(a.id)}
                                                            disabled={copying}
                                                        >
                                                            <span className={`cc-checkbox cc-checkbox--box ${checked ? 'is-checked' : ''}`}>
                                                                {checked && <Check size={11} strokeWidth={3.5} />}
                                                            </span>
                                                            <FileQuestion size={14} className="cc-tree-icon" />
                                                            <span className="cc-activity-title">{a.title}</span>
                                                            <span className="cc-tree-meta">
                                                                {a.activity_type === 'quiz' ? 'Quiz' : 'Activity'}
                                                                {a.questions_count > 0 && ` · ${a.questions_count} Q`}
                                                            </span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </section>
                            </div>
                        )}

                        <div className="cc-foot">
                            <p className="cc-foot-summary">
                                {!canCopy
                                    ? 'Pick content or classwork to copy'
                                    : [contentLabel, pickedCount > 0 && `${pickedCount} classwork`]
                                          .filter(Boolean)
                                          .join(' · ')}
                            </p>
                            <button
                                type="button"
                                className={`db-btn-primary cc-copy-btn ${contentMode === 'replace' && includeContent && hasContent ? 'cc-copy-btn--danger' : ''}`}
                                onClick={copy}
                                disabled={!canCopy || copying}
                            >
                                {copying ? <Loader2 size={15} className="cc-spin" /> : contentMode === 'replace' && includeContent && hasContent ? <Replace size={15} /> : <Copy size={15} />}
                                {copying ? 'Copying…' : contentMode === 'replace' && includeContent && hasContent ? 'Replace content' : 'Copy'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
