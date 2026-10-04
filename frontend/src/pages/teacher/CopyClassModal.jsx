import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowRight,
    BookOpen,
    Check,
    ChevronRight,
    Copy,
    Layers,
    Loader2,
    RefreshCw,
    Replace,
    TriangleAlert,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { classDetailsKey, courseContentKey } from '../../queries/classDetails';
import './CopyClassModal.css';

/**
 * "Copy from another class" — pull a class's entire content (modules,
 * lessons, quizzes, questions) into THIS class as unpublished drafts.
 * Classwork has its own per-card repost; this modal is content-only.
 * Two steps: pick the source class, then Add-to-existing vs Replace.
 */
export default function CopyClassModal({ classId, courseId, onClose }) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState('pick');
    const [sourceId, setSourceId] = useState(null);
    const [contentMode, setContentMode] = useState('append');
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

    const pickClass = (c) => {
        setSourceId(c.id);
        setContentMode('append');
        setStep('configure');
    };

    const copy = async () => {
        setCopying(true);
        try {
            const res = await api.post(`/teacher/classes/${classId}/copy-from`, {
                source_class_id: sourceId,
                content_mode: contentMode,
            });
            toast.success(res.data.message);
            // The class payload (hero counts) and the builder's content
            // query both hold module data — refresh both
            queryClient.invalidateQueries({ queryKey: classDetailsKey(classId) });
            if (courseId) queryClient.invalidateQueries({ queryKey: courseContentKey(courseId) });
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
                                Copy content from another class
                            </h3>
                            <p className="db-modal-sub">
                                Bring the modules, lessons and quizzes of one of your other
                                classes into this one. Everything arrives as drafts — you
                                publish when ready. (Classwork has its own repost.)
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
                                    <button key={c.id} type="button" className="cc-row" onClick={() => pickClass(c)}
                                        aria-label={`Copy content from ${c.name}`}>
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
                                Copy content into this class
                            </h3>
                            <p className="db-modal-sub">
                                From <strong>{preview?.class?.name || '…'}</strong> — everything below comes over.
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
                                {hasContent ? (
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
                                ) : (
                                    <p className="cc-empty">
                                        That class has no content to copy yet.
                                    </p>
                                )}
                            </div>
                        )}

                        <div className="cc-foot">
                            <p className="cc-foot-summary">
                                {previewLoading
                                    ? 'Checking what that class has…'
                                    : hasContent
                                        ? `${preview.modules.length} module${preview.modules.length === 1 ? '' : 's'} (${preview.totals.lessons} lessons, ${preview.totals.quizzes} quizzes)`
                                        : 'Nothing to copy'}
                            </p>
                            <button
                                type="button"
                                className={`db-btn-primary cc-copy-btn ${contentMode === 'replace' && hasContent ? 'cc-copy-btn--danger' : ''}`}
                                onClick={copy}
                                disabled={!hasContent || copying || previewLoading || previewError}
                            >
                                {copying ? <Loader2 size={15} className="cc-spin" /> : contentMode === 'replace' ? <Replace size={15} /> : <Copy size={15} />}
                                {copying ? 'Copying…' : contentMode === 'replace' ? 'Replace content' : 'Copy content'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
