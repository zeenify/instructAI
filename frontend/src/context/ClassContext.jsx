import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const ClassContext = createContext();

export const ClassProvider = ({ children }) => {
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();

    const refreshClasses = async () => {
        if (!user || user.role !== 'teacher') return;
        setLoading(true);
        try {
            const res = await api.get('/teacher/classes');
            setClasses(res.data);
        } catch (err) {
            console.error("Failed to fetch classes", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Only fetch if the user is a teacher and we don't have classes yet
        if (user && user.role === 'teacher') {
            refreshClasses();
        }
    }, [user]); // Re-run when 'user' is no longer null

    return (
        <ClassContext.Provider value={{ classes, loading, refreshClasses }}>
            {children}
        </ClassContext.Provider>
    );
};

export const useClasses = () => useContext(ClassContext);