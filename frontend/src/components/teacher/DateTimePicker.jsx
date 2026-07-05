import { useState, useRef, useEffect, useMemo } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

export default function DateTimePicker({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value ? new Date(value) : new Date());
  const ref = useRef(null);

  const parsedValue = useMemo(() => value ? new Date(value) : null, [value]);

  const displayHours = parsedValue ? String(parsedValue.getHours()).padStart(2, '0') : '08';
  const displayMinutes = parsedValue ? String(parsedValue.getMinutes()).padStart(2, '0') : '00';

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  }), [currentMonth]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const emitDate = (date, h, m) => {
    const d = new Date(date);
    d.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
    onChange(d.toISOString().slice(0, 19));
  };

  const selectDay = (day) => {
    setIsOpen(false);
    emitDate(day, displayHours, displayMinutes);
  };

  const handleTimeChange = (h, m) => {
    if (parsedValue) {
      emitDate(parsedValue, h, m);
    }
  };

  const displayValue = value ? format(new Date(value), 'MMM d, yyyy h:mm aa') : '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '12px 16px', borderRadius: '12px',
          border: '1px solid var(--border-color)',
          background: disabled ? 'var(--bg-secondary)' : 'var(--bg-primary)',
          color: disabled ? 'var(--text-tertiary)' : displayValue ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontSize: '14px', cursor: disabled ? 'default' : 'pointer',
          boxSizing: 'border-box', width: '100%', transition: 'all 0.2s',
        }}
      >
        <Clock size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{displayValue || 'Set deadline...'}</span>
        {value && !disabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', lineHeight: 1 }}
            type="button"
          >x</button>
        )}
      </div>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 300,
            width: '340px', borderRadius: '16px',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            padding: '20px', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: '8px' }} type="button">
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', borderRadius: '8px' }} type="button">
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {days.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = parsedValue && isSameDay(day, parsedValue);
              const isToday = isSameDay(day, new Date());
              return (
                <button key={day.toISOString()} onClick={() => selectDay(day)} type="button"
                  style={{
                    padding: '8px 0', borderRadius: '10px', border: 'none',
                    background: isSelected ? '#a78bfa' : isToday ? 'rgba(167, 139, 250, 0.15)' : 'transparent',
                    color: isSelected ? 'white' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontWeight: isSelected || isToday ? 700 : 400,
                    fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}>
            <Clock size={14} style={{ color: 'var(--text-tertiary)' }} />
            <select value={displayHours} onChange={(e) => handleTimeChange(e.target.value, displayMinutes)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
              {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>:</span>
            <select value={displayMinutes} onChange={(e) => handleTimeChange(displayHours, e.target.value)}
              style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
