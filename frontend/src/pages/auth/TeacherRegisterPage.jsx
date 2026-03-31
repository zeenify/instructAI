import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { User, Mail, Lock, Building2, ArrowRight, ShieldCheck } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

export default function TeacherRegisterPage() {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', organization: '' });
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.post('/register/teacher', form);
            login(res.data.user, res.data.token, 'teacher');
            toast.success("Educator workspace ready!");
            setTimeout(() => navigate('/dashboard/teacher'), 1000);
        } catch (err) {
            toast.error(err.response?.data?.message || "Registration failed");
            setLoading(false);
        }
    };

    return (
        <div className="landing-wrapper min-h-screen flex items-center justify-center p-6 bg-[#030014]">
            <Toaster position="top-center" theme="dark" richColors />
            <div className="mouse-glow" id="global-mouse-glow" />

            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 w-full max-w-[500px]">
                <div className="spotlight-card p-[1px] bg-gradient-to-b from-purple-500/20 to-transparent rounded-[32px]">
                    <div className="bg-[#030014]/95 backdrop-blur-3xl rounded-[31px] p-8 md:p-12">
                        
                        <div className="text-center mb-10">
                            <motion.div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-bold uppercase tracking-widest mb-6">
                                <ShieldCheck size={12} /> Instructor Onboarding
                            </motion.div>
                            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Teacher Workspace</h1>
                            <p className="text-slate-400 text-sm">Deploy intelligent curriculum in seconds.</p>
                        </div>

                        <div style={{ position: 'relative', zIndex: 20 }}>
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="First Name" icon={User} placeholder="First Name" onChange={e => setForm({...form, first_name: e.target.value})} required />
                                    <Input label="Last Name" placeholder="Last Name" onChange={e => setForm({...form, last_name: e.target.value})} required />
                                </div>
                                
                                <Input label="Email" icon={Mail} type="email" placeholder="name@gmail.com" onChange={e => setForm({...form, email: e.target.value})} required />
                                <Input label="Password" icon={Lock} type="password" placeholder="••••••••" onChange={e => setForm({...form, password: e.target.value})} required />
                                
                                <Input 
                                    label="School or Organization" 
                                    icon={Building2} 
                                    placeholder="National High School (Optional)" 
                                    onChange={e => setForm({...form, organization: e.target.value})} 
                                />

                                <Button loading={loading} className="w-full py-4 mt-4 font-bold uppercase tracking-widest">
                                    Create Workspace <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </form>
                        </div>

                        <div className="mt-10 pt-8 border-t border-white/5 text-center">
                            <p className="text-slate-500 text-xs uppercase tracking-widest">
                                Already have a workspace? <a href="/login" className="text-purple-400 font-bold ml-2">Sign In</a>
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}