import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Check localStorage or default to 'dark'
    const [theme, setTheme] = useState(localStorage.getItem('theme-preference') || 'dark');

    useEffect(() => {
        // Apply theme to the <html> element
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme-preference', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);