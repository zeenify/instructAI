import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Shared custom dropdown (dd- styles live in styles/dashboard.css).
 * Replaces native <select> elements everywhere — theme-aware, keyboard
 * friendly (Escape closes), and consistent across pages.
 *
 * props:
 *  - value: current option value
 *  - onChange(value)
 *  - options: [{ value, label }]
 *  - placeholder: shown when no option matches
 *  - icon: optional leading node inside the button
 *  - dashed: dashed button border (for "add" affordances)
 *  - fullWidth: stretch to the container's width
 *  - menuUp: open the menu above the button instead of below
 *  - className: extra classes on the root wrapper
 */
export default function Dropdown({
    value,
    onChange,
    options = [],
    placeholder = 'Choose…',
    icon = null,
    dashed = false,
    fullWidth = false,
    menuUp = false,
    className = '',
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const current = options.find((o) => o.value === value);

    return (
        <div className={`dd ${fullWidth ? 'dd-full' : ''} ${dashed ? 'dd-dashed' : ''} ${className}`} ref={ref}>
            <button
                type="button"
                className="dd-btn"
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                {icon}
                <span className="dd-btn-label">{current ? current.label : placeholder}</span>
                <ChevronDown size={13} className={`dd-caret ${open ? 'open' : ''}`} />
            </button>
            {open && (
                <div className={`dd-menu ${menuUp ? 'dd-menu-up' : ''}`} role="listbox">
                    {options.map((o) => (
                        <button
                            key={o.value}
                            type="button"
                            role="option"
                            aria-selected={o.value === value}
                            className={`dd-item ${o.value === value ? 'active' : ''}`}
                            onClick={() => { onChange(o.value); setOpen(false); }}
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
