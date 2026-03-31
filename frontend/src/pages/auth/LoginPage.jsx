import { useState, useEffect } from 'react'; 
import { useNavigate } from 'react-router-dom'; 
import { motion, AnimatePresence } from 'framer-motion'; 
import { Mail, Lock, ArrowRight, GraduationCap, Briefcase, Loader2 } from 'lucide-react'; 
import { Toaster, toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useGoogleLogin } from '@react-oauth/google';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [tempToken, setTempToken] = useState(null); 

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
      navigate(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
    }
  }, [navigate]);

  const handleGoogleAuth = async (accessToken, role = null) => {
    if (role) setSelectedRole(role); // Set the role to show specific loading state
    setLoading(true);
    try {
      const res = await api.post('/login/google', { 
        access_token: accessToken,
        role: role 
      });

      if (res.data.requires_role) {
        setTempToken(accessToken);
        setShowRoleModal(true);
        setLoading(false); 
      } else {
        setShowRoleModal(false);
        login(res.data.user, res.data.token, res.data.role);
        toast.success("Account Ready!");
        navigate(res.data.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
      }
    } catch (err) {
      toast.error("Setup failed. Please try again.");
      setLoading(false); 
      setSelectedRole(null); // Reset on error
    }
  };


  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setSelectedRole(null); // Reset selection before starting fresh
      handleGoogleAuth(tokenResponse.access_token);
    },
    onError: () => {
      setSelectedRole(null);
      toast.error("Google Login Cancelled");
    }
});

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/login', { email, password });
      login(res.data.user, res.data.token, res.data.role);
      toast.success("Success!");
      navigate(res.data.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
      setLoading(false); 
    }
  };

  return (
    <div className="landing-wrapper min-h-screen flex items-center justify-center p-4 bg-[#030014]">
        <Toaster position="top-center" theme="dark" richColors />
        
        {/* Cinematic Background Glow */}
        <motion.div 
            animate={loading ? { opacity: [0.1, 0.3, 0.1], scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
            className="mouse-glow" id="global-mouse-glow" 
        />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-[440px]"
        >
          <div className="spotlight-card rounded-[32px] overflow-hidden border border-white/10 bg-[#030014]/80 backdrop-blur-2xl shadow-2xl">
            
            {/* TOP LOADING BAR (Linear Style) */}
            <AnimatePresence>
                {loading && (
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                        className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent z-[60]"
                    />
                )}
            </AnimatePresence>

            <div className="p-8 md:p-10">
              <div className="text-center mb-8">
                  <h1 className="section-title text-3xl font-bold mb-2 tracking-tight">Sign In</h1>
                  <p className="text-slate-400 text-sm opacity-70">Log in to manage your intelligent classroom.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                  <Input 
                    label="Email Address" icon={Mail} type="email" placeholder="name@gmail.com" 
                    onChange={e => setEmail(e.target.value)} required 
                    disabled={loading}
                  />
                  <Input 
                    label="Password" icon={Lock} type="password" placeholder="••••••••" 
                    onChange={e => setPassword(e.target.value)} required 
                    disabled={loading}
                  />
                  
                  <Button 
                    loading={loading} 
                    loadingText="Verifying..."
                    className="w-full py-4 text-sm font-bold tracking-widest uppercase"
                  >
                    Login <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
              </form>

              <div className="mt-8">
                  <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-slate-500">
                          <span className="bg-[#0b0b0f] px-3">Or Continue with</span>
                      </div>
                  </div>

                  <button 
                      type="button" 
                      onClick={() => googleLogin()}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] transition-all text-sm font-medium text-white disabled:opacity-50"
                  >
                      <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="Google" />
                      Continue with Google
                  </button>
              </div>

              <div className="mt-10 pt-6 border-t border-white/5 flex justify-center gap-4 text-[11px] font-bold uppercase tracking-widest">
                  <a href="/register/teacher" className="text-purple-400 hover:text-white transition-colors">Register Teacher</a>
                  <span className="opacity-20">|</span>
                  <a href="/register/student" className="text-cyan-400 hover:text-white transition-colors">Student Access</a>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ROLE SELECTION MODAL */}
        <AnimatePresence>
        {showRoleModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative z-10 w-full max-w-[580px] bg-[#030014] border border-white/10 rounded-[24px] overflow-hidden shadow-2xl"
            >
                {/* MODAL LOADING BAR (Same style as login card) */}
                <AnimatePresence>
                    {loading && (
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent z-[60]"
                        />
                    )}
                </AnimatePresence>

                <div className="p-6 md:p-10">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Onboarding</h2>
                        <p className="text-slate-400 text-sm">Choose your perspective to continue.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* TEACHER CARD */}
                        <motion.button 
                            whileHover={!loading ? { scale: 1.02, y: -4, borderColor: "rgba(167, 139, 250, 0.4)", boxShadow: "0 10px 30px -10px rgba(167, 139, 250, 0.2)" } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                            onClick={() => handleGoogleAuth(tempToken, 'teacher')}
                            disabled={loading}
                            className={`flex flex-col text-left p-5 rounded-2xl bg-white/[0.03] border transition-all ${
                                selectedRole === 'teacher' ? 'border-purple-500/60 bg-purple-500/5' : 'border-white/5'
                            } ${loading && selectedRole !== 'teacher' ? 'opacity-40 grayscale' : ''}`}
                        >
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                                {loading && selectedRole === 'teacher' ? <Loader2 className="animate-spin" size={20} /> : <Briefcase size={20} />}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">
                                {loading && selectedRole === 'teacher' ? 'Setting up...' : 'Educator'}
                            </h3>
                            <p className="text-slate-500 text-xs leading-relaxed">Manage curriculum and student analytics.</p>
                        </motion.button>

                        {/* STUDENT CARD */}
                        <motion.button 
                            whileHover={!loading ? { scale: 1.02, y: -4, borderColor: "rgba(34, 211, 238, 0.4)", boxShadow: "0 10px 30px -10px rgba(34, 211, 238, 0.2)" } : {}}
                            whileTap={!loading ? { scale: 0.98 } : {}}
                            onClick={() => handleGoogleAuth(tempToken, 'student')}
                            disabled={loading}
                            className={`flex flex-col text-left p-5 rounded-2xl bg-white/[0.03] border transition-all ${
                                selectedRole === 'student' ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-white/5'
                            } ${loading && selectedRole !== 'student' ? 'opacity-40 grayscale' : ''}`}
                        >
                            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
                                {loading && selectedRole === 'student' ? <Loader2 className="animate-spin" size={20} /> : <GraduationCap size={20} />}
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">
                                {loading && selectedRole === 'student' ? 'Joining...' : 'Student'}
                            </h3>
                            <p className="text-slate-500 text-xs leading-relaxed">Join classes and practice code with AI.</p>
                        </motion.button>
                    </div>
                </div>
            </motion.div>
            </div>
        )}
        </AnimatePresence>
    </div>
  );
}