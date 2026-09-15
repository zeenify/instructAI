import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import './LoginPage.css';
import './StudentRegisterPage.css';

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

function Tape({ className = '' }) {
  return <span className={`tape ${className}`} aria-hidden="true" />;
}

/* ── spinning badge ────────────────────────────────────────── */
function SpinBadge() {
  return (
    <div className="auth-spin-badge" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs>
          <path id="stu-badge-circle" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="var(--pik-yellow)" stroke="var(--pik-ink)" strokeWidth="2.5" />
        <text className="auth-spin-badge-text">
          <textPath href="#stu-badge-circle">★ FOR STUDENTS ★ JOIN YOUR CLASS</textPath>
        </text>
        <path d="M60 46 l4.6 9.4 10.4 1.5 -7.5 7.3 1.8 10.3 -9.3 -4.9 -9.3 4.9 1.8 -10.3 -7.5 -7.3 10.4 -1.5 z" fill="var(--pik-ink)" />
      </svg>
    </div>
  );
}

export default function StudentRegisterPage() {
  const [loading, setLoading] = useState(false);
  const [lrnError, setLrnError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', lrn_number: '' });
  const { login } = useAuth();
  const navigate = useNavigate();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.lrn_number.length !== 12) {
      setLrnError('LRN must be exactly 12 digits');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/register/student', form);
      login(res.data.user, res.data.token, 'student');
      toast.success('Welcome to the future of learning!');
      setTimeout(() => navigate('/dashboard/student'), 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
      setLoading(false);
    }
  };

  const googleSignup = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      if (form.lrn_number.length !== 12) {
        toast.error('Enter your 12-digit LRN first, then continue with Google.');
        return;
      }
      setLoading(true);
      api
        .post('/login/google', { access_token: tokenResponse.access_token, role: 'student', lrn_number: form.lrn_number })
        .then((res) => {
          login(res.data.user, res.data.token, res.data.role);
          toast.success('Welcome to the future of learning!');
          navigate('/dashboard/student');
        })
        .catch((err) => {
          toast.error(err.response?.data?.message || 'Google sign-up failed. Please try email instead.');
          setLoading(false);
        });
    },
    onError: () => {
      toast.error('Google Sign-Up Cancelled');
    },
  });

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
          <h1 className="auth-card-title">Join your class</h1>

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            <div className="auth-form-row">
              <label className="auth-field">
                <span className="auth-field-label">First name</span>
                <input
                  type="text"
                  placeholder="Juan"
                  value={form.first_name}
                  onChange={set('first_name')}
                  required
                  disabled={loading}
                />
              </label>
              <label className="auth-field">
                <span className="auth-field-label">Last name</span>
                <input
                  type="text"
                  placeholder="Dela Cruz"
                  value={form.last_name}
                  onChange={set('last_name')}
                  required
                  disabled={loading}
                />
              </label>
            </div>

            <label className="auth-field">
              <span className="auth-field-label">Email</span>
              <input
                type="email"
                placeholder="juan.delacruz@gmail.com"
                value={form.email}
                onChange={set('email')}
                required
                disabled={loading}
                autoComplete="off"
              />
            </label>

            <label className="auth-field">
              <span className="auth-field-label">Password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="create a password"
                value={form.password}
                onChange={set('password')}
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

            <label className="auth-field">
              <span className="auth-field-label">LRN — learner reference number</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="your 12-digit LRN"
                maxLength={12}
                value={form.lrn_number}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 12);
                  setForm({ ...form, lrn_number: val });
                  setLrnError(val.length > 0 && val.length !== 12 ? 'LRN must be exactly 12 digits' : '');
                }}
                required
                disabled={loading}
              />
              {lrnError && <span className="auth-lrn-inline-error">{lrnError}</span>}
            </label>

            <button type="submit" className="auth-submit student" disabled={loading}>
              {loading ? <Loader2 size={17} className="auth-spinner" /> : <ArrowRight size={16} strokeWidth={2.8} />}
              {loading ? 'Creating…' : 'Get started'}
            </button>

            <div className="auth-or"><span>or</span></div>

            <button type="button" className="auth-google" onClick={() => googleSignup()} disabled={loading}>
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="" />
              Sign up with Google
            </button>

            <p className="auth-whitelist-note">
              <ShieldCheck size={14} strokeWidth={2.4} />
              must be on the Penaranda SHS enrollment list — ask your teacher if it is not accepted
            </p>
          </form>
        </motion.div>

        <p className="auth-footnote">
          already have an account?{' '}
          <Link to="/login" className="auth-footnote-link">sign in</Link>
        </p>
      </div>

      {/* ── right band: chalkboard ── */}
      <div className="auth-editorial">
        <SpinBadge />

        <p className="auth-chalk-kicker">for students — penaranda shs</p>
        <h2 className="auth-headline">
          Read, code,<br />
          <span className="auth-headline-line2">
            <em>compete</em>
            <svg viewBox="0 0 340 22" fill="none" aria-hidden="true" className="auth-chalk-underline">
              <path d="M6 12 C 90 4, 210 18, 334 9" stroke="var(--pik-yellow)" strokeWidth="5" strokeLinecap="round" />
              <path d="M16 17 C 120 11, 240 20, 320 13" stroke="rgba(255, 212, 59, 0.5)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
        </h2>

        <p className="auth-hand-note font-hand">bring your LRN — your teacher has it</p>

        <div className="auth-tickets">
          <Link to="/login" className="ticket">
            <span className="ticket-kicker">already enrolled?</span>
            <span className="ticket-title">Student log in</span>
            <ArrowUpRight size={16} strokeWidth={2.8} />
          </Link>
          <Link to="/register/teacher" className="ticket">
            <span className="ticket-kicker">not a student?</span>
            <span className="ticket-title">Teacher sign up</span>
            <ArrowUpRight size={16} strokeWidth={2.8} />
          </Link>
        </div>

        <div className="chalk-tray" aria-hidden="true">
          <span className="chalk-piece" />
          <span className="chalk-eraser" />
        </div>
      </div>
    </div>
  );
}
