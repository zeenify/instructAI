import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function StudentRegisterPage() {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/register/student', form);
            login(res.data.user, res.data.token, 'student');
            toast.success("Welcome to the future of learning!");
            setTimeout(() => navigate('/dashboard/student'), 1000);
        } catch (err) {
            toast.error(err.response?.data?.message || "Registration failed");
            setLoading(false);
        }
    };

    return (
        <div className="landing-wrapper min-h-screen flex items-center justify-center p-6 bg-[#030014] student-theme">
            <Toaster position="top-center" theme="dark" richColors />
            <div className="mouse-glow" id="global-mouse-glow" />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[480px]">
                <div className="spotlight-card p-[1px] bg-gradient-to-b from-cyan-500/20 to-transparent rounded-[32px]">
                    <div className="bg-[#030014]/95 backdrop-blur-3xl rounded-[31px] p-8 md:p-12">
                        
                        <div className="text-center mb-10">
                            <motion.div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                                <Sparkles size={12} /> Student Access
                            </motion.div>
                            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Create Account</h1>
                            <p className="text-slate-400 text-sm">Join the intelligent classroom ecosystem.</p>
                        </div>

                        <div style={{ position: 'relative', zIndex: 20 }}>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="First Name" icon={User} placeholder="First Name" onChange={e => setForm({...form, first_name: e.target.value})} required />
                                    <Input label="Last Name" placeholder="Last Name" onChange={e => setForm({...form, last_name: e.target.value})} required />
                                </div>
                                
                                <Input label="Email" icon={Mail} type="email" placeholder="name@email.com" onChange={e => setForm({...form, email: e.target.value})} required />
                                <Input label="Choose Password" icon={Lock} type="password" placeholder="••••••••" onChange={e => setForm({...form, password: e.target.value})} required />

                                <Button variant="student" loading={loading} className="w-full py-4 mt-4 font-bold uppercase tracking-widest">
                                    Get Started <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </form>
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 text-center">
                            <p className="text-slate-500 text-xs uppercase tracking-widest">
                                Already have an account? <a href="/login" className="text-cyan-400 font-bold ml-2">Sign In</a>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}