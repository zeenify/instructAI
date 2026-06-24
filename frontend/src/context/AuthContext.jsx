import { createContext, useState, useEffect, useContext } from 'react';
import api, { invalidateCache } from '../services/api';
import cache from '../utils/cache';

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
        sessionStorage.setItem('user', JSON.stringify(userData));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        setRole(null);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        sessionStorage.removeItem('user');
        cache.clear();
    };

    useEffect(() => {
        const loadUser = async () => {
            if (token) {
                // Check sessionStorage cache first (avoids API call on navigation)
                const cached = sessionStorage.getItem('user');
                if (cached) {
                    try {
                        const userData = JSON.parse(cached);
                        setUser(userData);
                        setRole(userData.role);
                        setLoading(false);
                        return;
                    } catch (e) {
                        // Invalid cache, fall through to fetch
                    }
                }

                try {
                    const res = await api.get('/user', { bypassCache: true });
                    sessionStorage.setItem('user', JSON.stringify(res.data));
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