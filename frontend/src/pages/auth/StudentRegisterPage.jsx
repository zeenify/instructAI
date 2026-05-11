import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, Lock, ArrowRight, Sparkles } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import './StudentRegisterPage.css';

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
        <div className="register-container" style={{ background: '#030014' }}>
            <Toaster position="top-center" theme="dark" richColors />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="register-card"
            >
                {loading && (
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent"
                        style={{ borderRadius: '32px 0 0 0' }}
                    />
                )}

                <div className="register-header">
                    <div className="register-badge">
                        <Sparkles size={12} /> Student Access
                    </div>
                    <h1>Create Account</h1>
                    <p>Join the intelligent classroom ecosystem.</p>
                </div>

                <form onSubmit={handleSubmit} className="register-form">
                    <div className="register-form-row">
                        <Input
                            label="First Name"
                            icon={User}
                            placeholder="First Name"
                            onChange={e => setForm({...form, first_name: e.target.value})}
                            required
                            disabled={loading}
                        />
                        <Input
                            label="Last Name"
                            icon={User}
                            placeholder="Last Name"
                            onChange={e => setForm({...form, last_name: e.target.value})}
                            required
                            disabled={loading}
                        />
                    </div>

                    <Input
                        label="Email"
                        icon={Mail}
                        type="email"
                        placeholder="name@email.com"
                        onChange={e => setForm({...form, email: e.target.value})}
                        required
                        disabled={loading}
                    />
                    <Input
                        label="Choose Password"
                        icon={Lock}
                        type="password"
                        placeholder="••••••••"
                        onChange={e => setForm({...form, password: e.target.value})}
                        required
                        disabled={loading}
                    />

                    <motion.div
                        animate={loading ? { opacity: [1, 0.7, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                    >
                        <Button variant="student" loading={loading} loadingText="Creating..." className="w-full">
                            Get Started <ArrowRight className="ml-2 w-4 h-4" />
                        </Button>
                    </motion.div>
                </form>

                <div className="register-footer">
                    <p>Already have an account? <a href="/login">Sign In</a></p>
                </div>
            </motion.div>
        </div>
    );
}