import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Briefcase, GraduationCap, Hash, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { useGoogleLogin } from '@react-oauth/google';
import './LoginPageV3.css';

const dashboardFor = (r) => (r === 'teacher' ? '/dashboard/teacher' : r === 'admin' ? '/admin' : '/dashboard/student');

/* ── hand-coded paper clip ─────────────────────────────────── */
function PaperClip({ className = '' }) {
  return (
    <svg viewBox="0 0 44 92" fill="none" aria-hidden="true" className={`paper-clip ${className}`}>
      <path
        d="M30 8 V60 a9 9 0 0 1 -18 0 V20 a13 13 0 0 1 26 0 V66 a17 17 0 0 1 -34 0 V26"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── spinning badge ────────────────────────────────────────── */
function SpinBadge() {
  return (
    <div className="auth-spin-badge" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id="auth-badge-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="var(--pik-yellow)" stroke="var(--pik-ink)" strokeWidth="2.5" />
        <text className="auth-spin-badge-text">
          <textPath href="#auth-badge-circle">★ PENARANDA SHS ★ WELCOME BACK</textPath>
        </text>
        <path d="M60 46 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5 z" fill="var(--pik-ink)" />
      </svg>
    </div>
  );
}

function Tape({ className = '' }) {
  return <span className={`tape ${className}`} aria-hidden="true" />;
}

export default function LoginPageV3() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      navigate(dashboardFor(role));
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
        navigate(dashboardFor(res.data.role));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Setup failed. Please try again.");
      setLoading(false);
      setShowRoleModal(false);
      setSelectedRole(null);
      setShowLrnInput(false);
      setLrnNumber('');
      setLrnError('');
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
      navigate(dashboardFor(res.data.role));
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid credentials");
      setLoading(false);
    }
  };

  return (
    <div className="pik auth-page">
      {/* ── left band: the form ── */}
      <div className="auth-form-band">
        <Link to="/" className="auth-logo" aria-label="Back to home">
          <span className="auth-logo-mark">I<span className="auth-logo-dot">.</span></span>
          <span className="auth-logo-word">InstructAI</span>
        </Link>

        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
        >
          <PaperClip className="auth-clip" />
          <p className="auth-card-kicker">InstructAI — Penaranda Senior High School</p>
          <h1 className="auth-card-title">Welcome back</h1>

          <form onSubmit={handleLogin} className="auth-form" autoComplete="off">
            <label className="auth-field">
              <span className="auth-field-label">Email</span>
              <input
                type="email"
                placeholder="juan.delacruz@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="off"
              />
            </label>
            <label className="auth-field">
              <span className="auth-field-label">Password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </label>

            <label className="auth-show-pw">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <span className="auth-show-box" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 13 l5 5 L20 6" stroke="currentColor" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="auth-show-label">show password</span>
            </label>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? <Loader2 size={17} className="auth-spinner" /> : <ArrowRight size={16} strokeWidth={2.8} />}
              {loading ? 'Verifying…' : 'Sign in'}
            </button>
          </form>

          <div className="auth-or"><span>or</span></div>

          <button type="button" className="auth-google" onClick={() => googleLogin()} disabled={loading}>
            <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="" />
            Continue with Google
          </button>
        </motion.div>

        <p className="auth-footnote">having trouble? your teacher or the school admin can help</p>
      </div>

      {/* ── right band: chalkboard ── */}
      <div className="auth-editorial">
        <SpinBadge />

        <p className="auth-chalk-kicker">welcome back to Penaranda SHS</p>
        <h2 className="auth-headline">
          Welcome back<br />
          to{' '}
          <span className="auth-headline-line2">
            <em>class</em>
            <svg viewBox="0 0 220 22" fill="none" aria-hidden="true" className="auth-chalk-underline">
              <path d="M6 12 C 60 4, 128 18, 214 9" stroke="var(--pik-yellow)" strokeWidth="5" strokeLinecap="round" />
              <path d="M14 17 C 76 11, 152 20, 202 13" stroke="rgba(255, 212, 59, 0.5)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
        </h2>
        <p className="auth-body">
          Sign in to reach your courses, quizzes and activities — one account
          works for teachers and students alike.
        </p>

        <p className="auth-hand-note font-hand">new here? grab a ticket below</p>

        <div className="auth-tickets">
          <Link to="/register/teacher" className="ticket">
            <span className="ticket-kicker">new here?</span>
            <span className="ticket-title">Teacher sign up</span>
            <ArrowUpRight size={16} strokeWidth={2.8} />
          </Link>
          <Link to="/register/student" className="ticket">
            <span className="ticket-kicker">joining a class?</span>
            <span className="ticket-title">Student sign up</span>
            <ArrowUpRight size={16} strokeWidth={2.8} />
          </Link>
        </div>

        <div className="chalk-tray" aria-hidden="true">
          <span className="chalk-piece" />
          <span className="chalk-eraser" />
        </div>
      </div>

      {/* ── role selection modal (new Google accounts) ── */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="auth-modal-overlay">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="auth-modal-backdrop"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ duration: 0.3 }}
              className="auth-modal"
            >
              <h2 className="auth-modal-title">Choose your role</h2>
              <p className="auth-modal-sub">how will you use InstructAI?</p>

              <div className="auth-role-grid">
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
                  className={`auth-role-card ${selectedRole === 'teacher' ? 'selected' : ''}`}
                >
                  <span className="auth-role-icon">
                    {loading && selectedRole === 'teacher' ? <Loader2 size={22} className="auth-spinner" /> : <Briefcase size={22} />}
                  </span>
                  <h3>{loading && selectedRole === 'teacher' ? 'Setting up…' : 'Educator'}</h3>
                  <p>
                    Create courses, manage students, and deploy AI-powered curriculum.
                    Your email must be pre-approved by the school admin.
                  </p>
                </motion.button>

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
                  className={`auth-role-card ${selectedRole === 'student' ? 'selected' : ''}`}
                >
                  <span className="auth-role-icon">
                    {loading && selectedRole === 'student' ? <Loader2 size={22} className="auth-spinner" /> : <GraduationCap size={22} />}
                  </span>
                  <h3>{loading && selectedRole === 'student' ? 'Joining…' : showLrnInput ? 'Enter your LRN' : 'Student'}</h3>
                  <p>
                    {showLrnInput
                      ? 'Enter your 12-digit LRN to verify your enrollment at Penaranda Senior High School.'
                      : 'Join classes, learn from curated content, and practice code with AI assistance.'}
                  </p>

                  {showLrnInput && (
                    <div className="auth-lrn" onClick={(e) => e.stopPropagation()}>
                      <div className="auth-lrn-field">
                        <Hash size={15} className="auth-lrn-hash" />
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={12}
                          placeholder="12-digit LRN"
                          value={lrnNumber}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                            setLrnNumber(val);
                            setLrnError(val.length > 0 && val.length !== 12 ? 'LRN must be exactly 12 digits' : '');
                          }}
                          autoFocus
                        />
                      </div>
                      {lrnError && <p className="auth-lrn-error">{lrnError}</p>}
                      <button
                        type="button"
                        className="auth-lrn-confirm"
                        onClick={() => {
                          if (loading) return;
                          if (lrnNumber.length !== 12) {
                            setLrnError('LRN must be exactly 12 digits');
                            return;
                          }
                          handleGoogleAuth(tempToken, 'student', lrnNumber);
                        }}
                      >
                        {loading ? 'Setting up…' : 'Confirm & join'}
                      </button>
                    </div>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
