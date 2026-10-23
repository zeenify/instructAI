import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Book, LogOut, Plus, Loader2, Sparkles, Hash, Menu, ArrowRight, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import cache from '../../utils/cache';
import JoinClassModal from '../student/JoinClassModal';
import ThemeToggle from '../ui/ThemeToggle';
import cognifyImg from '../../assets/landing/cognify.png';
import '../../pages/teacher/Dashboard.css';
import '../../pages/student/Student.css';

// APK lives on the backend (backend/public/downloads/Cognify.apk). Same
// origin derivation as the landing page's download row.
const COGNIFY_APK_URL = `${(
  import.meta.env.VITE_API_URL || 'https://instructai-backend.onrender.com/api'
).replace(/\/api\/?$/, '')}/downloads/Cognify.apk`;
const PROMO_DISMISS_KEY = 'cognify-promo-dismissed-at';
const PROMO_REMIND_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

// The mobile-app promo card hides itself for two weeks when dismissed.
function useCognifyPromo() {
    const [showPromo, setShowPromo] = useState(() => {
        try {
            const at = Number(localStorage.getItem(PROMO_DISMISS_KEY) || 0);
            return Date.now() - at > PROMO_REMIND_AFTER_MS;
        } catch { return true; }
    });
    const dismissPromo = () => {
        try { localStorage.setItem(PROMO_DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
        setShowPromo(false);
    };
    return [showPromo, dismissPromo];
}

export default function StudentLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    // Last-known classes paint instantly; the network refresh corrects after.
    const [classes, setClasses] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('sidebar:student:classes-last') || '[]'); }
        catch { return []; }
    });
    const [loading, setLoading] = useState(() => !sessionStorage.getItem('sidebar:student:classes-last'));

    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const [showPromo, dismissPromo] = useCognifyPromo();

    const fetchClasses = async (forceRefresh = false) => {
        const cacheKey = 'sidebar:student:classes';
        if (!forceRefresh) {
            const cached = cache.get(cacheKey);
            if (cached) {
                setClasses(cached);
                setLoading(false);
                return;
            }
        }
        setLoading(true);
        try {
            // Forced refreshes must bypass the legacy axios GET cache (5-min
            // TTL) — otherwise joining a class re-reads the pre-join list.
            const res = await api.get('/student/classes', forceRefresh ? { bypassCache: true } : undefined);
            cache.set(cacheKey, res.data);
            sessionStorage.setItem('sidebar:student:classes-last', JSON.stringify(res.data));
            setClasses(res.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchClasses(); }, []);


    return (
        /* CHANGE 1: Use dashboard-container to match the CSS */
        <div className="dashboard-container student-theme">

            {/* Mobile top bar — the immortal sidebar becomes a drawer below 900px */}
            <div className="sv-mobilebar">
                <button type="button" className="sv-burger" onClick={() => setNavOpen(true)} aria-label="Open navigation">
                    <Menu size={20} />
                </button>
                <span className="sv-mobilebar-brand">InstructAI</span>
            </div>
            {navOpen && <div className="sv-backdrop" onClick={() => setNavOpen(false)} />}

            <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
                <div className="sidebar-top">
                    <Link to="/dashboard/student" className="sidebar-logo" onClick={() => setNavOpen(false)}>
                        <div className="logo-sq">I</div>
                        <span className="font-bold text-xl" style={{ color: 'var(--text-primary)', marginLeft: '10px' }}>InstructAI</span>
                    </Link>

                    <div className="nav-group">
                        <label className="sidebar-section-label">Your Classes</label>
                        <div className="class-stack">
                            {loading ? (
                                // Skeleton rows, not a spinner — the class list must look alive
                                Array.from({ length: 2 }).map((_, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                                        <div className="db-skeleton" style={{ width: 8, height: 8, borderRadius: '50%' }} />
                                        <div className="db-skeleton" style={{ width: `${70 - i * 18}%`, height: 12 }} />
                                    </div>
                                ))
                            ) :
                                classes.map(c => (
                                    <Link key={c.id} to={`/dashboard/student/class/${c.id}`}
                                        onClick={() => setNavOpen(false)}
                                        className={`nav-item ${location.pathname.includes(`/class/${c.id}`) ? 'active' : ''}`}>
                                        <div className="class-dot" />
                                        <span className="truncate">{c.name}</span>
                                    </Link>
                                ))
                            }
                            <button
                                onClick={() => setIsJoinModalOpen(true)}
                                className="nav-item w-full bg-transparent border-none cursor-pointer"
                                style={{ border: 'none', background: 'none', textAlign: 'left', marginTop: '10px', color: 'var(--accent)' }}
                            >
                                <Hash size={16} />
                                <span className="text-sm font-bold">Join Class</span>
                            </button>
                        </div>
                    </div>

                    <div className="nav-group mt-8">
                        <label className="sidebar-section-label">Portal</label>
                        <nav className="flex-grow">
                            <Link to="/dashboard/student" onClick={() => setNavOpen(false)} className={`nav-item ${location.pathname === '/dashboard/student' ? 'active' : ''}`}>
                                <LayoutDashboard size={18} /> <span>Overview</span>
                            </Link>
                        </nav>
                    </div>
                </div>

                {showPromo && (
                    <div className="sv-appcard">
                        <button type="button" className="sv-appcard-close" onClick={dismissPromo} aria-label="Hide this">
                            <X size={13} />
                        </button>
                        <img src={cognifyImg} alt="" className="sv-appcard-logo" />
                        <div className="sv-appcard-body">
                            <p className="sv-appcard-title">Cognify, on your phone</p>
                            <p className="sv-appcard-sub">Flashcards &amp; podcast narration from your classes</p>
                            <a className="sv-appcard-cta" href={COGNIFY_APK_URL} download="Cognify.apk">
                                <span>Get the app</span>
                                <ArrowRight size={11} strokeWidth={2.5} />
                            </a>
                        </div>
                    </div>
                )}

                <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px' }}>
                        <img src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.student_profile?.first_name}`} className="w-10 h-10 rounded-full border border-white/10 shadow-lg flex-shrink-0" alt="" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.student_profile?.first_name}</p>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-tertiary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Student Account</p>
                        </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                        <ThemeToggle variant="dark-panel" />
                    </div>
                    <button onClick={() => { logout(); navigate('/login'); }} className="nav-item w-full border-none bg-transparent cursor-pointer hover:text-[var(--accent)]" style={{ border: 'none', background: 'none' }}>
                        <LogOut size={16} /> <span>Sign Out</span>
                    </button>
                </div>
            </aside>


            <main className="main-content">
                <Outlet context={{ classes, openJoinModal: () => setIsJoinModalOpen(true), loading }} />
            </main>

            <JoinClassModal 
                isOpen={isJoinModalOpen} 
                onClose={() => setIsJoinModalOpen(false)} 
                onSuccess={() => fetchClasses(true)} 
            />
        </div>
    );
}

