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
            onSuccess(); // Trigger a refresh of the class list
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
                        className="relative z-10 w-full max-w-md bg-[#030014] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl shadow-cyan-500/10"
                    >
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <PlusCircle className="text-cyan-400" /> Join Class
                                </h2>
                                <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors bg-transparent border-none cursor-pointer">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input 
                                    label="6-Digit Class Code" 
                                    icon={Hash}
                                    placeholder="e.g. X7B9K2" 
                                    value={classCode} 
                                    onChange={e => setClassCode(e.target.value.toUpperCase())} 
                                    maxLength={6}
                                    required 
                                />

                                <Button variant="student" loading={loading} className="w-full py-4 uppercase font-bold tracking-widest">
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