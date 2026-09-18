import { useEffect, useRef, useState } from 'react';
import { X, Plus, Check, Loader2, Layers, Sparkles } from 'lucide-react';

/**
 * Create/rename module dialog. Pure UI — the parent owns the API call via
 * onSubmit(title); if it rejects, the error shows inline and the dialog
 * stays open so the teacher doesn't lose what they typed.
 */
export default function ModuleModal({ open, mode = 'create', initialTitle = '', moduleNumber = 1, onClose, onSubmit }) {
    const inputRef = useRef(null);
    const [title, setTitle] = useState(initialTitle);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fresh form each time it opens; lock scroll; focus the input; Esc closes
    useEffect(() => {
        if (!open) return;
        setTitle(initialTitle);
        setError(null);
        setLoading(false);
        const t = setTimeout(() => inputRef.current?.focus(), 80);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            clearTimeout(t);
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    if (!open) return null;

    const isCreate = mode === 'create';

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim() || loading) return;
        setLoading(true);
        setError(null);
        try {
            await onSubmit(title.trim());
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || 'Something went wrong. Try again.');
            setLoading(false);
        }
    };

    return (
        <div
            className="db-modal-backdrop"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !loading) onClose();
            }}
        >
            <div className="db-modal db-modal-sm" role="dialog" aria-modal="true" aria-label={isCreate ? 'New module' : 'Rename module'}>
                <button type="button" className="db-modal-close" aria-label="Close" onClick={() => !loading && onClose()}>
                    <X size={17} />
                </button>

                <span className="db-kicker-chip">
                    <Layers size={13} />
                    MODULE {String(moduleNumber).padStart(2, '0')}
                </span>

                <div className="db-modal-head" style={{ marginTop: 14 }}>
                    <h2 className="db-modal-title">{isCreate ? 'New Module' : 'Rename Module'}</h2>
                    <p className="db-modal-sub">
                        {isCreate
                            ? 'A module bundles lessons and quizzes in the order students take them.'
                            : 'Give this module a clearer name — lessons and quizzes stay put.'}
                    </p>
                </div>

                <form onSubmit={submit} className="db-modal-form">
                    <label className="db-field">
                        <span className="db-field-label">Module title</span>
                        <input
                            ref={inputRef}
                            type="text"
                            className="db-input"
                            placeholder={isCreate ? 'e.g. Getting Started with Java' : ''}
                            value={title}
                            maxLength={255}
                            onChange={(e) => setTitle(e.target.value)}
                            disabled={loading}
                            required
                        />
                    </label>

                    {isCreate && (
                        <p className="db-field-hint">
                            <Sparkles size={13} />
                            You'll add lessons and quizzes inside it next.
                        </p>
                    )}

                    {error && <p className="db-modal-error">{error}</p>}

                    <div className="db-modal-actions">
                        <button type="button" className="db-btn-ghost" onClick={() => !loading && onClose()} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="db-btn-primary" disabled={loading || !title.trim()}>
                            {loading ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    {isCreate ? 'Creating…' : 'Saving…'}
                                </>
                            ) : (
                                <>
                                    {isCreate ? <Plus size={15} /> : <Check size={15} />}
                                    {isCreate ? 'Create Module' : 'Save Changes'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
