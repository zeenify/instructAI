import { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [role, setRole] = useState(localStorage.getItem('role'));

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
                    // Fetch full user data including profiles
                    const res = await api.get('/user');
                    setUser(res.data);
                    setRole(res.data.role);
                } catch (err) {
                    console.error("Session expired");
                    logout();
                }
            }
            setLoading(false);
        };
        loadUser();
    }, [token]);

    // Show a loading screen while we fetch the user info
    if (loading) return (
        <div className="h-screen bg-[#030014] flex items-center justify-center">
            <div className="w-12 h-12 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
        </div>
    );

    return (
        <AuthContext.Provider value={{ user, token, role, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);