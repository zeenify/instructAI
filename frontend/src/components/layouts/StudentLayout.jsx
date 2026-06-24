import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Book, LogOut, Plus, Loader2, Sparkles, Hash } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../services/api';
import cache from '../../utils/cache';
import JoinClassModal from '../student/JoinClassModal';
import ThemeToggle from '../ui/ThemeToggle';
import '../../pages/teacher/Dashboard.css';
import '../../pages/student/Student.css';
  

export default function StudentLayout() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false); 

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
            const res = await api.get('/student/classes');
            cache.set(cacheKey, res.data);
            setClasses(res.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { fetchClasses(); }, []);


    return (
        /* CHANGE 1: Use dashboard-container to match the CSS */
        <div className="dashboard-container student-theme">
            
            
            <aside className="sidebar">
                <div className="sidebar-top">
                    <Link to="/dashboard/student" className="sidebar-logo">
                        <div className="logo-sq">I</div>
                        <span className="font-bold text-xl" style={{ color: 'var(--text-primary)', marginLeft: '10px' }}>InstructAI</span>
                    </Link>

                    <div className="nav-group">
                        <label className="sidebar-section-label">Your Classes</label>
                        <div className="class-stack">
                            {loading ? <Loader2 className="animate-spin mx-auto text-cyan-800" size={16}/> : 
                                classes.map(c => (
                                    <Link key={c.id} to={`/dashboard/student/class/${c.id}`} 
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
                            <Link to="/dashboard/student" className={`nav-item ${location.pathname === '/dashboard/student' ? 'active' : ''}`}>
                                <LayoutDashboard size={18} /> <span>Overview</span>
                            </Link>
                        </nav>
                    </div>
                </div>

                <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px' }}>
                        <img src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.student_profile?.first_name}`} className="w-10 h-10 rounded-full border border-white/10 shadow-lg flex-shrink-0" alt="" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.student_profile?.first_name}</p>
                            <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Student Account</p>
                        </div>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                        <ThemeToggle />
                    </div>
                    <button onClick={() => { logout(); navigate('/login'); }} className="nav-item w-full border-none bg-transparent cursor-pointer hover:text-[var(--accent)]" style={{ border: 'none', background: 'none' }}>
                        <LogOut size={16} /> <span>Sign Out</span>
                    </button>
                </div>
            </aside>


            <main className="main-content">
                <Outlet context={{ classes }} />
            </main>

            <JoinClassModal 
                isOpen={isJoinModalOpen} 
                onClose={() => setIsJoinModalOpen(false)} 
                onSuccess={() => fetchClasses(true)} 
            />
        </div>
    );
}

