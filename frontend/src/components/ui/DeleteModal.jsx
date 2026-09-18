import { useEffect, useRef } from 'react';
import { Trash2, Loader2, X } from 'lucide-react';

/**
 * Confirm-delete dialog, native to the db- design system.
 * `title` is the thing being deleted (a type word like "Module" or an actual
 * name); `name` overrides it; `items` lists what gets removed along with it
 * (e.g. a module's lessons and quizzes).
 */
export default function DeleteModal({ isOpen, onClose, onConfirm, title, name, items = [], loading }) {
    const cancelRef = useRef(null);

    // Esc closes, scroll locks, and focus lands on the SAFE action
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        window.addEventListener('keydown', onKey);
        const t = setTimeout(() => cancelRef.current?.focus(), 80);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
            clearTimeout(t);
        };
    }, [isOpen, loading, onClose]);

    if (!isOpen) return null;

    const label = name || title;

    return (
        <div
            className="db-modal-backdrop"
            style={{ zIndex: 300 }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget && !loading) onClose();
            }}
        >
            <div className="db-modal db-modal-sm" role="alertdialog" aria-modal="true" aria-label={`Delete ${label}`}>
                <button type="button" className="db-modal-close" aria-label="Close" onClick={() => !loading && onClose()}>
                    <X size={17} />
                </button>

                <span className="db-delete-icon">
                    <Trash2 size={20} />
                </span>

                <div className="db-modal-head" style={{ marginTop: 14 }}>
                    <h2 className="db-modal-title">Delete {label}?</h2>
                    <p className="db-modal-sub">This permanently removes it from the class — it can't be undone.</p>
                </div>

                {items.length > 0 && (
                    <div className="db-delete-box">
                        <p className="db-delete-box-label">Goes with it</p>
                        <ul>
                            {items.map((it) => (
                                <li key={it}>{it}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="db-modal-actions" style={{ marginTop: 22 }}>
                    <button type="button" ref={cancelRef} className="db-btn-ghost" onClick={() => !loading && onClose()} disabled={loading}>
                        Cancel
                    </button>
                    <button type="button" className="db-btn-danger" onClick={onConfirm} disabled={loading}>
                        {loading ? (
                            <>
                                <Loader2 size={15} className="animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <Trash2 size={15} />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
