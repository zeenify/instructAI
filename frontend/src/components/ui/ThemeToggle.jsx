import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ThemeToggle = ({ variant }) => {
    const { theme, toggleTheme } = useTheme();
    const dark = variant === 'dark-panel';

    if (dark) {
        // Rendered on the sidebar: sun/moon + a real switch.
        const isDark = theme === 'dark';
        return (
            <button
                onClick={toggleTheme}
                className="db-theme-row"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
                <span className="db-theme-label">
                    {isDark ? <Sun size={18} color="#fbbf24" /> : <Moon size={18} color="#8ab4ff" />}
                    <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </span>
                <span className={`db-theme-track ${isDark ? '' : 'on'}`}>
                    <span className="db-theme-knob" />
                </span>
            </button>
        );
    }

    return (
        <button
            onClick={toggleTheme}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: '500'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {theme === 'dark' ? (
                    <Sun size={18} color="#fbbf24" />
                ) : (
                    <Moon size={18} color="#3b82f6" />
                )}
            </div>
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
    );
};

export default ThemeToggle;
