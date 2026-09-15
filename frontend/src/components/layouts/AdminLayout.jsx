import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LogOut, ListChecks, GraduationCap, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';

export default function AdminLayout() {
    const { user, logout } = useAuth();
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
                <Link to="/admin" className="sidebar-logo" style={{ textDecoration: 'none' }}>
                    <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>A</div>
                    <span className="font-bold text-xl" style={{ color: 'var(--text-primary)', marginLeft: '10px' }}>
                        InstructAI <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Admin</span>
                    </span>
                </Link>

                <div className="sidebar-section-label">School Administration</div>
                <nav className="flex-grow">
                    <NavLink to="/admin" icon={ListChecks} label="Student Whitelist" />
                    <NavLink to="/admin/teachers" icon={GraduationCap} label="Teacher Whitelist" />
                    <div style={{ marginTop: '8px', padding: '0 4px' }}>
                        <ThemeToggle />
                    </div>
                </nav>

                <div style={{ paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{
                        backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)',
                        padding: '16px', marginBottom: '12px', boxShadow: 'var(--card-shadow)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff', fontWeight: 800,
                            }}>
                                {(user?.email?.[0] || 'A').toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <ShieldCheck size={13} color="#f59e0b" /> Administrator
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
                            display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '12px 16px',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px', color: '#ef4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                            transition: 'all 200ms ease-in-out',
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
