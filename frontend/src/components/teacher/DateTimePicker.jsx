import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react';
import Dropdown from '../ui/Dropdown';

/**
 * Deadline picker used by the classwork create modal and the activity editor.
 * Theme-aware (db- tokens); the two time fields use the shared Dropdown
 * (native <select> is banned in redesigned UIs).
 *
 * The calendar renders in a portal with fixed positioning (same pattern as
 * Dropdown.jsx) so a scrolling modal can never clip it or let it hang past
 * the modal's edge; it flips upward when there is no room below.
 */
export default function DateTimePicker({ value, onChange, disabled }) {
    const [isOpen, setIsOpen] = useState(false);
    const [pos, setPos] = useState(null);
    const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
    const ref = useRef(null);
    const popRef = useRef(null);

    const parsedValue = useMemo(() => (value ? new Date(value) : null), [value]);

    const displayHours = parsedValue ? String(parsedValue.getHours()).padStart(2, '0') : '08';
    const displayMinutes = parsedValue ? String(parsedValue.getMinutes()).padStart(2, '0') : '00';

    const days = useMemo(() => eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth)),
        end: endOfWeek(endOfMonth(currentMonth)),
    }), [currentMonth]);

    const place = () => {
        const anchor = ref.current;
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const POP_H = 392;
        const POP_W = Math.min(340, window.innerWidth - 24);
        const spaceBelow = window.innerHeight - r.bottom - 10;
        const spaceAbove = r.top - 10;
        const up = spaceBelow < POP_H && spaceAbove > spaceBelow;
        setPos({
            top: up ? undefined : Math.min(r.bottom + 6, window.innerHeight - POP_H - 8),
            bottom: up ? window.innerHeight - r.top + 6 : undefined,
            left: Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8)),
            width: POP_W,
            up,
        });
    };

    useLayoutEffect(() => {
        if (isOpen) place();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onScroll = () => place();
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onScroll);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onScroll);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setIsOpen(false); };
        document.addEventListener('mousedown', handler);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('keydown', onKey);
        };
    }, []);

    const emitDate = (date, h, m) => {
        const d = new Date(date);
        d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
        // Full ISO with Z. Slicing off the zone (the old behavior) produced a
        // timezone-naive string that JS parsed as LOCAL — every display and
        // save round-trip shifted the deadline by the UTC offset.
        onChange(d.toISOString());
    };

    const selectDay = (day) => {
        setIsOpen(false);
        emitDate(day, displayHours, displayMinutes);
    };

    const handleTimeChange = (h, m) => {
        if (parsedValue) emitDate(parsedValue, h, m);
    };

    const displayValue = value ? format(new Date(value), 'MMM d, yyyy h:mm aa') : '';

    const hourOptions = Array.from({ length: 24 }, (_, i) => ({
        value: String(i).padStart(2, '0'),
        label: String(i).padStart(2, '0'),
    }));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => ({
        value: String(i).padStart(2, '0'),
        label: String(i).padStart(2, '0'),
    }));

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '12px 15px', borderRadius: 12,
                    border: '1px solid var(--db-border-strong)',
                    background: 'var(--db-card-2)',
                    color: disabled ? 'var(--db-text-3)' : displayValue ? 'var(--db-text)' : 'var(--db-text-3)',
                    fontSize: 14.5, cursor: disabled ? 'default' : 'pointer',
                    boxSizing: 'border-box', transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    fontFamily: 'inherit', textAlign: 'left',
                }}
            >
                <Clock size={16} style={{ color: 'var(--db-text-3)', flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: displayValue ? "'JetBrains Mono', monospace" : 'inherit', fontSize: 13.5 }}>
                    {displayValue || 'Set deadline...'}
                </span>
                {value && !disabled && (
                    <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => { e.stopPropagation(); onChange(null); }}
                        style={{ display: 'grid', placeItems: 'center', padding: 3, borderRadius: 7, color: 'var(--db-text-3)' }}
                        title="Clear deadline"
                    >
                        <X size={14} />
                    </span>
                )}
            </button>

            {isOpen && !disabled && pos && createPortal(
                <div
                    ref={popRef}
                    style={{
                        position: 'fixed', top: pos.top, bottom: pos.bottom, left: pos.left, zIndex: 300,
                        width: pos.width, borderRadius: 16,
                        background: 'var(--db-card)',
                        border: '1px solid var(--db-border-strong)',
                        boxShadow: 'var(--db-shadow)',
                        padding: 18, overflow: 'hidden',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} type="button"
                            style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, background: 'transparent', border: '1px solid var(--db-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--db-text-2)' }}>
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontFamily: 'var(--db-font-display)', fontSize: 15, fontWeight: 700, color: 'var(--db-text)' }}>
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} type="button"
                            style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, background: 'transparent', border: '1px solid var(--db-border)', borderRadius: 9, cursor: 'pointer', color: 'var(--db-text-2)' }}>
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                            <div key={d} style={{ textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, color: 'var(--db-text-3)', padding: '3px 0' }}>{d}</div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                        {days.map((day) => {
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const isSelected = parsedValue && isSameDay(day, parsedValue);
                            const isToday = isSameDay(day, new Date());
                            return (
                                <button key={day.toISOString()} onClick={() => selectDay(day)} type="button"
                                    style={{
                                        padding: '8px 0', borderRadius: 9, border: isSelected ? 'none' : '1px solid transparent',
                                        background: isSelected ? 'var(--db-accent)' : isToday ? 'var(--db-accent-soft)' : 'transparent',
                                        color: isSelected ? '#ffffff' : isCurrentMonth ? 'var(--db-text)' : 'var(--db-text-3)',
                                        fontWeight: isSelected || isToday ? 700 : 400,
                                        fontSize: 13, cursor: 'pointer', transition: 'background 0.15s ease',
                                    }}
                                >
                                    {format(day, 'd')}
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--db-border)', alignItems: 'center' }}>
                        <Clock size={14} style={{ color: 'var(--db-text-3)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <Dropdown value={displayHours} options={hourOptions}
                                onChange={(v) => handleTimeChange(v, displayMinutes)} />
                        </div>
                        <span style={{ color: 'var(--db-text-3)', fontSize: 14, fontWeight: 700 }}>:</span>
                        <div style={{ flex: 1 }}>
                            <Dropdown value={displayMinutes} options={minuteOptions}
                                onChange={(v) => handleTimeChange(displayHours, v)} />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
