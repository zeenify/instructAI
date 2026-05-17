import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClasses } from '../../context/ClassContext';
import { LayoutDashboard, Users, BarChart3, Settings, LogOut, Plus, Loader2, Eye } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import '../../pages/teacher/Dashboard.css';
export default function TeacherLayout() {
const { user, logout } = useAuth();
const { classes, loading } = useClasses();
const location = useLocation();
const navigate = useNavigate();

const handleLogout = () => {
    logout();
    navigate('/login');
};

const NavLink = ({ to, icon: Icon, label }) => (
    <Link to={to} className={`nav-item ${location.pathname === to ? 'active' : ''}`}>
        <Icon size={18} />
        <span>{label}</span>
    </Link>
);

return (
    <div className="dashboard-container">
        <aside className="sidebar">
            {/* Brand Logo */}
            <Link to="/dashboard/teacher" className="sidebar-logo" style={{ textDecoration: 'none' }}>
                <div className="logo-icon">I</div>
                <span className="font-bold text-xl" style={{ color: 'var(--text-primary)', marginLeft: '10px' }}>InstructAI</span>
            </Link>

            {/* Classes Section */}
            <div className="sidebar-section-label">Your Classes</div>
            <div className="mb-8 overflow-y-auto max-h-[300px] custom-scrollbar">
                {loading && classes.length === 0 ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-500" size={16} /></div>
                ) : (
                    classes.map(c => (
                        <Link key={c.id} to={`/dashboard/teacher/class/${c.id}`} 
                            className={`nav-item ${location.pathname.includes(`/class/${c.id}`) ? 'active' : ''}`}
                        >
                            <div className="class-dot" />
                            <span className="truncate">{c.name}</span>
                        </Link>
                    ))
                )}
                
                <button 
                    onClick={() => navigate('/dashboard/teacher/classes/new')}
                    className="nav-item w-full bg-transparent border-none cursor-pointer hover:text-white" 
                    style={{ border: 'none', background: 'none', textAlign: 'left', marginTop: '10px', color: 'var(--primary)' }}
                >
                    <Plus size={16} />
                    <span className="text-sm font-bold">Create Class</span>
                </button>
            </div>

            {/* Management Section */}
            <div className="sidebar-section-label">Management</div>
            <nav className="flex-grow">
                <NavLink to="/dashboard/teacher" icon={LayoutDashboard} label="Overview" />
                <NavLink to="/dashboard/teacher/analytics" icon={BarChart3} label="Analytics" />
                <NavLink to="/dashboard/teacher/monitor" icon={Eye} label="Monitor" />
                <NavLink to="/dashboard/teacher/settings" icon={Settings} label="Settings" />
                <div style={{ marginTop: '8px', padding: '0 4px' }}>
                    <ThemeToggle />
                </div>
            </nav>

            {/* Profile & Sign Out */}
            <div style={{ paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '16px', marginBottom: '12px', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <img
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.teacher_profile?.first_name}`}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
                            alt="Avatar"
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.teacher_profile?.first_name} {user?.teacher_profile?.last_name}
                            </p>
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {user?.email}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '12px 16px',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 200ms ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                    }}
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </button>
            </div>
        </aside>

        <main className="main-content">
            <Outlet />
        </main>
    </div>
);
}
