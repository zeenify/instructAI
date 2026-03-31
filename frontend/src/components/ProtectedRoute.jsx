import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
    const { token, role, isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        // Not logged in? Send to login
        return <Navigate to="/login" replace />;
    }

    if (allowedRole && role !== allowedRole) {
        // Wrong role? Send back to their specific dashboard
        return <Navigate to={role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student'} replace />;
    }

    return children;
}