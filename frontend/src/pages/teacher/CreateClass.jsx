import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import api from '../../services/api';
import { toast } from 'sonner';
import { LayoutGrid, AlignLeft, ArrowLeft } from 'lucide-react';
import { useClasses } from '../../context/ClassContext';
import './CreateClass.css';

export default function CreateClass() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { refreshClasses } = useClasses();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/teacher/classes', { name, description });
            toast.success("Workspace created successfully!");
            await refreshClasses();
            navigate('/dashboard/teacher');
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create class");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-class-container">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="create-class-back-btn"
                >
                    <ArrowLeft size={16} />
                    Back
                </button>

                <div className="create-class-header">
                    <h1 className="create-class-title">Create Classroom</h1>
                    <p className="create-class-subtitle">Build a new intelligent workspace where students join and collaborate.</p>
                </div>
            </motion.div>

            <motion.form
                onSubmit={handleSubmit}
                className="create-class-form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <div className="create-class-form-group">
                    <label className="create-class-form-label">
                        <LayoutGrid size={16} /> Classroom Name
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="e.g. Grade 12 - Computer Science"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            style={{
                                padding: '16px 20px 16px 55px',
                                background: 'rgba(167, 139, 250, 0.03)',
                                border: '1.5px solid rgba(167, 139, 250, 0.2)',
                                borderRadius: '14px',
                                color: 'white',
                                fontSize: '1rem',
                                fontFamily: "'Inter', -apple-system, sans-serif",
                                width: '100%',
                                transition: 'all 0.3s ease'
                            }}
                            onFocus={(e) => {
                                e.target.style.background = 'rgba(167, 139, 250, 0.08)';
                                e.target.style.borderColor = 'rgba(167, 139, 250, 0.4)';
                                e.target.style.boxShadow = '0 0 20px rgba(167, 139, 250, 0.15)';
                            }}
                            onBlur={(e) => {
                                e.target.style.background = 'rgba(167, 139, 250, 0.03)';
                                e.target.style.borderColor = 'rgba(167, 139, 250, 0.2)';
                                e.target.style.boxShadow = 'none';
                            }}
                            required
                            disabled={loading}
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                            <LayoutGrid size={18} />
                        </div>
                    </div>
                </div>

                <div className="create-class-form-group">
                    <label className="create-class-form-label">
                        <AlignLeft size={16} /> Description
                    </label>
                    <textarea
                        className="create-class-textarea"
                        placeholder="Briefly describe the objectives and topics you'll cover..."
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        disabled={loading}
                    />
                </div>

                <motion.div
                    animate={loading ? { opacity: [1, 0.7, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                >
                    <Button
                        loading={loading}
                        loadingText="Creating..."
                        className="create-class-submit-btn w-full"
                    >
                        Initialize Classroom
                    </Button>
                </motion.div>
            </motion.form>
        </div>
    );
}