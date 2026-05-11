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
import './LoginPage.css';
import './RoleModal.css';

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
    if (role) setSelectedRole(role);
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
      setSelectedRole(null);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      setSelectedRole(null);
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
    <div className="login-container" style={{ background: '#030014' }}>
      <Toaster position="top-center" theme="dark" richColors />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="login-card"
      >
        {loading && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute top-0 left-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
            style={{ borderRadius: '32px 0 0 0' }}
          />
        )}

        <div className="login-header">
          <h1>Sign In</h1>
          <p>Log in to manage your intelligent classroom.</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <Input
            label="Email Address"
            icon={Mail}
            type="email"
            placeholder="name@gmail.com"
            onChange={e => setEmail(e.target.value)}
            required
            disabled={loading}
          />
          <Input
            label="Password"
            icon={Lock}
            type="password"
            placeholder="••••••••"
            onChange={e => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <motion.div
            animate={loading ? { opacity: [1, 0.7, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Button
              loading={loading}
              loadingText="Verifying..."
              className="w-full"
            >
              Login <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </motion.div>
        </form>

        <div className="login-divider">
          <span>Or Continue with</span>
        </div>

        <button
          type="button"
          onClick={() => googleLogin()}
          disabled={loading}
          className="google-button"
        >
          <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>

        <div className="login-footer">
          <a href="/register/teacher">Register Teacher</a>
          <span>|</span>
          <a href="/register/student">Student Access</a>
        </div>
      </motion.div>

      {/* ROLE SELECTION MODAL */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="role-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="role-modal-backdrop"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.3 }}
              className="role-modal-container"
            >
              <div className="role-modal-header">
                <h2 className="role-modal-title">Choose Your Role</h2>
                <p className="role-modal-subtitle">Select how you'll use InstructAI to get started</p>
              </div>

              <div className="role-modal-content">
                <div className="role-cards-grid">
                  {/* TEACHER CARD */}
                  <motion.button
                    whileHover={!loading ? { y: -4 } : {}}
                    whileTap={!loading ? { scale: 0.98 } : {}}
                    onClick={() => handleGoogleAuth(tempToken, 'teacher')}
                    disabled={loading}
                    className={`role-card teacher ${selectedRole === 'teacher' ? 'selected' : ''}`}
                  >
                    <div className="role-card-icon">
                      {loading && selectedRole === 'teacher' ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <Briefcase size={24} />
                      )}
                    </div>
                    <h3 className="role-card-title">
                      {loading && selectedRole === 'teacher' ? 'Setting up...' : 'Educator'}
                    </h3>
                    <p className="role-card-description">
                      Create courses, manage students, and deploy AI-powered curriculum in seconds.
                    </p>
                  </motion.button>

                  {/* STUDENT CARD */}
                  <motion.button
                    whileHover={!loading ? { y: -4 } : {}}
                    whileTap={!loading ? { scale: 0.98 } : {}}
                    onClick={() => handleGoogleAuth(tempToken, 'student')}
                    disabled={loading}
                    className={`role-card student ${selectedRole === 'student' ? 'selected' : ''}`}
                  >
                    <div className="role-card-icon">
                      {loading && selectedRole === 'student' ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <GraduationCap size={24} />
                      )}
                    </div>
                    <h3 className="role-card-title">
                      {loading && selectedRole === 'student' ? 'Joining...' : 'Student'}
                    </h3>
                    <p className="role-card-description">
                      Join classes, learn from curated content, and practice code with AI assistance.
                    </p>
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