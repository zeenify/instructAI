import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OPEN_CREATE_CLASS } from '../../components/teacher/CreateClassModal';

/**
 * Legacy route — class creation now happens in the CreateClassModal.
 * Redirects to the dashboard and opens the modal for old links.
 */
export default function CreateClass() {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('/dashboard/teacher', { replace: true });
        const t = setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_CREATE_CLASS)), 60);
        return () => clearTimeout(t);
    }, [navigate]);

    return null;
}
