import { useLayoutEffect, useRef } from 'react';

/**
 * Textarea that grows with its content instead of scrolling inside a fixed
 * box. `rows` is the minimum height; `maxRows` caps growth and scrolls only
 * past that. Every other prop passes through to the textarea.
 */
export default function AutoGrowTextarea({ value, rows = 2, maxRows, style, ...rest }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        const lineHeight = parseFloat(window.getComputedStyle(el).lineHeight) || 20;
        const maxHeight = maxRows ? Math.round(maxRows * lineHeight) : Infinity;
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
        el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
    }, [value, rows, maxRows]);

    return <textarea ref={ref} rows={rows} value={value} style={{ resize: 'none', ...style }} {...rest} />;
}
