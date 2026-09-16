import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';

export const CLASS_COLORS = [
    '#6d5ae0', // iris
    '#4f7cf0', // blue
    '#0ea5e9', // sky
    '#14b8a6', // teal
    '#3e8e7e', // sage
    '#f59e0b', // amber
    '#ff6a4d', // coral
    '#f43f5e', // rose
];

/**
 * Small palette button + swatch popover so a teacher can tag a class
 * with a color they'll recognize. Calls onChange(hex) when a swatch is picked.
 * Render it inside a relatively-positioned parent; clicks inside don't propagate.
 */
export default function ColorSwatches({ value, onChange }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDocClick = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    return (
        <span
            className="db-swatch-wrap"
            ref={rootRef}
            onClick={(e) => e.stopPropagation()}
        >
            <button
                type="button"
                className="db-palette-btn"
                title="Set class color"
                onClick={() => setOpen((o) => !o)}
            >
                <Palette size={20} />
            </button>
            {open && (
                <span className="db-swatches">
                    {CLASS_COLORS.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            className={`db-swatch ${value === hex ? 'selected' : ''}`}
                            style={{ background: hex }}
                            title={hex}
                            onClick={() => {
                                setOpen(false);
                                onChange(hex);
                            }}
                        />
                    ))}
                </span>
            )}
        </span>
    );
}
