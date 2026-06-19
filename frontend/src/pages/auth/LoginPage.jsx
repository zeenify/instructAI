import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, ArrowRight, GraduationCap, Briefcase, Loader2, Hash } from 'lucide-react';
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
  const [showLrnInput, setShowLrnInput] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [tempToken, setTempToken] = useState(null);
  const [lrnNumber, setLrnNumber] = useState('');
  const [lrnError, setLrnError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    if (token && role) {
      navigate(role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
    }
  }, [navigate]);

  const handleGoogleAuth = async (accessToken, role = null, lrn = null) => {
    if (role) setSelectedRole(role);
    setLoading(true);
    try {
      const res = await api.post('/login/google', {
        access_token: accessToken,
        role: role,
        lrn_number: lrn
      });

      if (res.data.requires_role) {
        setTempToken(accessToken);
        setShowRoleModal(true);
        setShowLrnInput(false);
        setLrnNumber('');
        setLrnError('');
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
                    onClick={() => {
                      setShowLrnInput(false);
                      setLrnNumber('');
                      setLrnError('');
                      handleGoogleAuth(tempToken, 'teacher');
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRole('student');
                      if (showLrnInput) {
                        if (lrnNumber.length !== 12) {
                          setLrnError('LRN must be exactly 12 digits');
                          return;
                        }
                        handleGoogleAuth(tempToken, 'student', lrnNumber);
                      } else {
                        setShowLrnInput(true);
                      }
                    }}
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
                      {loading && selectedRole === 'student' ? 'Joining...' : showLrnInput ? 'Enter your LRN' : 'Student'}
                    </h3>
                    <p className="role-card-description">
                      {showLrnInput
                        ? 'Enter your 12-digit LRN to verify your enrollment at Penaranda Senior High School.'
                        : 'Join classes, learn from curated content, and practice code with AI assistance.'}
                    </p>

                    {showLrnInput && (
                      <div style={{ marginTop: '16px', width: '100%' }} onClick={e => e.stopPropagation()}>
                        <div style={{ position: 'relative' }}>
                          <Hash size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', zIndex: 2 }} />
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={12}
                            placeholder="12-digit LRN"
                            value={lrnNumber}
                            onChange={e => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                              setLrnNumber(val);
                              if (val.length > 0 && val.length !== 12) {
                                setLrnError('LRN must be exactly 12 digits');
                              } else {
                                setLrnError('');
                              }
                            }}
                            autoFocus
                            style={{
                              width: '100%',
                              padding: '10px 12px 10px 36px',
                              borderRadius: '10px',
                              border: lrnError ? '1px solid #f87171' : '1px solid rgba(34, 211, 238, 0.3)',
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'white',
                              fontSize: '14px',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        {lrnError && (
                          <p style={{ color: '#f87171', fontSize: '11px', marginTop: '6px', marginLeft: '4px' }}>{lrnError}</p>
                        )}
                        <motion.div
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (loading) return;
                            if (lrnNumber.length !== 12) {
                              setLrnError('LRN must be exactly 12 digits');
                              return;
                            }
                            handleGoogleAuth(tempToken, 'student', lrnNumber);
                          }}
                          style={{
                            width: '100%',
                            marginTop: '10px',
                            padding: '10px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            textAlign: 'center',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                          }}
                        >
                          {loading ? 'Setting up...' : 'Confirm & Join'}
                        </motion.div>
                      </div>
                    )}
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