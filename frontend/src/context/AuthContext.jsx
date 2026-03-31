import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [role, setRole] = useState(localStorage.getItem('role'));

    // --- The missing login function ---
    const login = (userData, userToken, userRole) => {
        setUser(userData);
        setToken(userToken);
        setRole(userRole);
        localStorage.setItem('token', userToken);
        localStorage.setItem('role', userRole);
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setRole(null);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
    };

    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                try {
                    // Logic to verify token/get user data could go here
                    // For now, we assume token is valid and just stop loading
                    setLoading(false);
                } catch (err) {
                    logout();
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        };
        loadUser();
    }, [token]);

    if (loading) return <div className="bg-black h-screen" />; 

    return (
        <AuthContext.Provider value={{ user, token, role, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);