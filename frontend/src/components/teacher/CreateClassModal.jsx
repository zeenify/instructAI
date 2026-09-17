import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check, Copy, Loader2, Plus } from 'lucide-react';
import api from '../../services/api';
import { useClasses } from '../../context/ClassContext';
import { CLASS_COLORS } from '../ui/ColorSwatches';

const DEFAULT_CLASS_COLOR = '#6d5ae0';

/** Event name used to open the modal from anywhere in the dashboard shell. */
export const OPEN_CREATE_CLASS = 'instructai:create-class';

/**
 * Quick-create class dialog with a share-the-code finish.
 * Two states: the form (name, optional description, color) and the
 * success screen that celebrates the class code students join with.
 */
export default function CreateClassModal({ open, onClose }) {
    const navigate = useNavigate();
    const { refreshClasses } = useClasses();
    const nameRef = useRef(null);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState(DEFAULT_CLASS_COLOR);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [created, setCreated] = useState(null); // the new classroom
    const [copied, setCopied] = useState(false);

    // Autofocus the name field and lock page scroll while open
    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => nameRef.current?.focus(), 80);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            clearTimeout(t);
            document.body.style.overflow = prev;
        };
    }, [open]);

    // Escape closes (unless a request is in flight)
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape' && !loading) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, loading, onClose]);

    if (!open) return null;

    const reset = () => {
        setName('');
        setDescription('');
        setColor(DEFAULT_CLASS_COLOR);
        setError(null);
        setCreated(null);
        setCopied(false);
    };

    const close = () => {
        onClose();
        // Clear after the exit so the form is fresh next time it opens
        setTimeout(reset, 150);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!name.trim() || loading) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/teacher/classes', {
                name: name.trim(),
                description: description.trim() || null,
                color,
            });
            setCreated(res.data);
            refreshClasses();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create the class. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard?.writeText(created.class_code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    return (
        <div className="db-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !loading && close()}>
            <div className="db-modal" role="dialog" aria-modal="true" aria-label={created ? 'Class created' : 'Create a new class'}>
                <button type="button" className="db-modal-close" aria-label="Close" onClick={close} disabled={loading}>
                    <X size={17} />
                </button>

                {!created ? (
                    <>
                        <div className="db-modal-head">
                            <h2 className="db-modal-title">Create a New Class</h2>
                            <p className="db-modal-sub">Students join with the code you'll get after this.</p>
                        </div>

                        <form onSubmit={submit} className="db-modal-form">
                            <label className="db-field">
                                <span className="db-field-label">Class name</span>
                                <input
                                    ref={nameRef}
                                    type="text"
                                    className="db-input"
                                    placeholder="e.g. Grade 12 - Computer Science"
                                    value={name}
                                    maxLength={255}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={loading}
                                    required
                                />
                            </label>

                            <label className="db-field">
                                <span className="db-field-label">
                                    Description <em>(optional)</em>
                                </span>
                                <textarea
                                    className="db-input db-textarea"
                                    placeholder="Briefly describe the objectives and topics you'll cover."
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={loading}
                                />
                            </label>

                            <div className="db-field">
                                <span className="db-field-label">Class color</span>
                                <div className="db-field-swatches">
                                    {CLASS_COLORS.map((hex) => (
                                        <button
                                            key={hex}
                                            type="button"
                                            className={`db-swatch ${color === hex ? 'selected' : ''}`}
                                            style={{ background: hex }}
                                            title={hex}
                                            aria-label={`Class color ${hex}`}
                                            aria-pressed={color === hex}
                                            onClick={() => setColor(hex)}
                                            disabled={loading}
                                        >
                                            {color === hex && <Check size={22} strokeWidth={3.5} className="db-swatch-check" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {error && <p className="db-modal-error">{error}</p>}

                            <div className="db-modal-actions">
                                <button type="button" className="db-btn-ghost" onClick={close} disabled={loading}>
                                    Cancel
                                </button>
                                <button type="submit" className="db-btn-primary" disabled={loading || !name.trim()}>
                                    {loading ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            Creating…
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={15} />
                                            Create Class
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="db-modal-success">
                        <span className="db-success-badge">
                            <svg viewBox="0 0 52 52" className="db-success-check" aria-hidden="true">
                                <path
                                    d="M14 27.5 L23 36.5 L38.5 18.5"
                                    fill="none"
                                    strokeWidth="5.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    pathLength="1"
                                />
                            </svg>
                        </span>
                        <h2 className="db-modal-title">Class created!</h2>
                        <p className="db-modal-sub">Share this code with your students — it's how they join.</p>

                        <button type="button" className="db-code-hero" onClick={copyCode} title="Copy class code">
                            <span>{created.class_code}</span>
                            {copied ? <Check size={18} className="db-code-copied" /> : <Copy size={18} />}
                        </button>
                        <p className="db-code-hint">{copied ? 'Copied to clipboard' : 'Click the code to copy it'}</p>

                        <div className="db-modal-actions">
                            <button
                                type="button"
                                className="db-btn-ghost"
                                onClick={() => {
                                    reset();
                                    setTimeout(() => nameRef.current?.focus(), 80);
                                }}
                            >
                                Create another
                            </button>
                            <button
                                type="button"
                                className="db-btn-primary"
                                onClick={() => {
                                    close();
                                    navigate(`/dashboard/teacher/class/${created.id}`);
                                }}
                            >
                                Go to class
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
