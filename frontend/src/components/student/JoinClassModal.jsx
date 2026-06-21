import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Hash, PlusCircle } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import api from '../../services/api';
import { toast } from 'sonner';

export default function JoinClassModal({ isOpen, onClose, onSuccess }) {
    const [classCode, setClassCode] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!classCode.trim()) return;
        
        setLoading(true);
        try {
            await api.post('/student/enroll', { class_code: classCode });
            toast.success("Successfully joined the class!");
            setClassCode('');
            onSuccess();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Invalid class code or already enrolled.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '32px', boxShadow: '0 20px 60px var(--accent-glow)' }}
                        className="relative z-10 w-full max-w-md overflow-hidden"
                    >
                        <div style={{ padding: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <PlusCircle style={{ color: 'var(--accent)' }} /> Join Class
                                </h2>
                                <button onClick={onClose} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 10px', transition: 'color 0.3s' }}
                                    className="hover:text-[var(--text-primary)]">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <Input
                                    label="6-Digit Class Code"
                                    icon={Hash}
                                    placeholder="e.g. X7B9K2"
                                    value={classCode}
                                    onChange={e => setClassCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    required
                                />

                                <Button variant="student" loading={loading} style={{ padding: '16px 24px' }} className="w-full uppercase font-bold tracking-widest">
                                    Join Workspace
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
