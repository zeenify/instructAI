import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Shared custom dropdown (dd- styles live in styles/dashboard.css).
 * Replaces native <select> elements everywhere — theme-aware, keyboard
 * friendly (Escape closes), and consistent across pages.
 *
 * The menu renders in a portal at the viewport level with fixed positioning,
 * so it can never be clipped by a scrollable modal or open "past" the card:
 * it flips upward when there is no room below and its height is clamped to
 * whatever space is actually available.
 *
 * props:
 *  - value: current option value
 *  - onChange(value)
 *  - options: [{ value, label }]
 *  - placeholder: shown when no option matches
 *  - icon: optional leading node inside the button
 *  - dashed: dashed button border (for "add" affordances)
 *  - fullWidth: stretch to the container's width
 *  - menuUp: force the menu above the button
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
    const [pos, setPos] = useState(null);
    const rootRef = useRef(null);
    const menuRef = useRef(null);

    const place = () => {
        const anchor = rootRef.current;
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const menuW = fullWidth ? r.width : Math.max(210, r.width);
        const spaceBelow = window.innerHeight - r.bottom - 10;
        const spaceAbove = r.top - 10;
        // Flip up when there isn't comfortable room below and there is more room above
        const up = menuUp || (spaceBelow < 200 && spaceAbove > spaceBelow);
        const maxHeight = Math.max(140, Math.min(280, up ? spaceAbove : spaceBelow));
        setPos({
            top: up ? undefined : r.bottom + 6,
            bottom: up ? window.innerHeight - r.top + 6 : undefined,
            left: Math.max(8, Math.min(r.left, window.innerWidth - menuW - 8)),
            width: fullWidth ? r.width : undefined,
            maxHeight,
            up,
        });
    };

    useLayoutEffect(() => {
        if (open) place();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        // Keep the fixed-position menu glued to the button while anything
        // scrolls (including the modal card itself) or the window resizes
        const onScroll = () => place();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (!open) return undefined;
        const onDoc = (e) => {
            if (rootRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return;
            setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDoc);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const current = options.find((o) => o.value === value);

    return (
        <div className={`dd ${fullWidth ? 'dd-full' : ''} ${dashed ? 'dd-dashed' : ''} ${className}`} ref={rootRef}>
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
            {open && pos && createPortal(
                <div
                    ref={menuRef}
                    role="listbox"
                    className={`dd-menu ${pos.up ? 'dd-menu-up' : ''}`}
                    style={{
                        position: 'fixed',
                        zIndex: 300,
                        top: pos.top,
                        bottom: pos.bottom,
                        left: pos.left,
                        width: pos.width,
                        minWidth: fullWidth ? undefined : 210,
                        maxHeight: pos.maxHeight,
                    }}
                >
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
                </div>,
                document.body
            )}
        </div>
    );
}
