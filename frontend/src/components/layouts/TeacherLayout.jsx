import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClasses } from '../../context/ClassContext';
import { LayoutDashboard, BarChart3, Settings, LogOut, Plus, Eye, ChevronRight, PanelLeftClose, Menu } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import CreateClassModal, { OPEN_CREATE_CLASS } from '../teacher/CreateClassModal';
import '../../styles/dashboard.css';

export default function TeacherLayout() {
    const { user, logout } = useAuth();
    const { classes, loading } = useClasses();
    const location = useLocation();
    const navigate = useNavigate();

    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('db-sidebar-collapsed') === '1');
    const [mobileOpen, setMobileOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('db-sidebar-collapsed', collapsed ? '1' : '0');
    }, [collapsed]);

    // Any surface (overview buttons, old /classes/new links) can open the modal
    useEffect(() => {
        const open = () => setCreateOpen(true);
        window.addEventListener(OPEN_CREATE_CLASS, open);
        return () => window.removeEventListener(OPEN_CREATE_CLASS, open);
    }, []);

    // Close the mobile drawer whenever the route changes
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const NavLink = ({ to, icon: Icon, label }) => (
        <Link to={to} className={`db-nav-item ${location.pathname === to ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
        </Link>
    );

    const openFromFloat = () => {
        if (window.innerWidth <= 900) setMobileOpen(true);
        else setCollapsed(false);
    };

    return (
        <div className={`db-shell ${collapsed ? 'is-collapsed' : ''}`}>
            <aside
                className={`db-sidebar db-scrollbar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}
            >
                {/* Brand + collapse */}
                <div className="db-logo-row">
                    <Link to="/dashboard/teacher" className="db-logo">
                        <span className="db-logo-chip">I<span className="db-logo-dot">.</span></span>
                        <span className="db-logo-word">InstructAI</span>
                    </Link>
                    <button
                        className="db-side-collapse"
                        title="Collapse sidebar"
                        onClick={() => {
                            if (window.innerWidth <= 900) setMobileOpen(false);
                            else setCollapsed(true);
                        }}
                    >
                        <PanelLeftClose size={18} />
                    </button>
                </div>

                {/* Classes Section */}
                <div className="db-side-label">Your Classes</div>
                <div className="db-scrollbar" style={{ overflowY: 'auto', maxHeight: '300px', marginBottom: '8px' }}>
                    {loading && classes.length === 0 ? (
                        // Skeleton rows — a lone spinner reads as "broken"
                        <div style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div className="db-skeleton" style={{ height: '15px', borderRadius: '7px', width: '86%' }} />
                            <div className="db-skeleton" style={{ height: '15px', borderRadius: '7px', width: '68%' }} />
                            <div className="db-skeleton" style={{ height: '15px', borderRadius: '7px', width: '78%' }} />
                        </div>
                    ) : (
                        classes.map((c) => (
                            <Link
                                key={c.id}
                                to={`/dashboard/teacher/class/${c.id}`}
                                className={`db-nav-item ${location.pathname.includes(`/class/${c.id}`) ? 'active' : ''}`}
                            >
                                <span
                                    className="db-class-dot"
                                    style={c.color ? { background: c.color, boxShadow: `0 0 8px ${c.color}88` } : undefined}
                                />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                            </Link>
                        ))
                    )}

                    <button
                        onClick={() => setCreateOpen(true)}
                        className="db-nav-item"
                        style={{ color: 'var(--db-accent-bright)', fontWeight: 600, marginTop: '6px' }}
                    >
                        <Plus size={16} />
                        <span>Create Class</span>
                    </button>
                </div>

                {/* Management Section */}
                <div className="db-side-label">Management</div>
                <nav style={{ display: 'flex', flexDirection: 'column' }}>
                    <NavLink to="/dashboard/teacher" icon={LayoutDashboard} label="Overview" />
                    <NavLink to="/dashboard/teacher/analytics" icon={BarChart3} label="Analytics" />
                    <NavLink to="/dashboard/teacher/monitor" icon={Eye} label="Monitor" />
                    <NavLink to="/dashboard/teacher/settings" icon={Settings} label="Settings" />
                    <div style={{ marginTop: '8px', padding: '0 4px' }}>
                        <ThemeToggle variant="dark-panel" />
                    </div>
                </nav>

                <div className="db-side-spacer" />

                {/* Profile & Sign Out */}
                <div className="db-side-footer">
                    <div className="db-profile-card">
                        <img
                            className="db-profile-avatar"
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.teacher_profile?.first_name}`}
                            alt="Avatar"
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p className="db-profile-name">
                                {user?.teacher_profile?.first_name} {user?.teacher_profile?.last_name}
                            </p>
                            <p className="db-profile-email">{user?.email}</p>
                        </div>
                        <span className="db-profile-chevron">
                            <ChevronRight size={15} />
                        </span>
                    </div>
                    <button onClick={handleLogout} className="db-signout">
                        <LogOut size={16} />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {mobileOpen && (
                <button className="db-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
            )}

            <button className="db-sidebar-float" title="Open menu" onClick={openFromFloat}>
                <Menu size={19} />
            </button>

            <main className={`db-main ${collapsed ? 'is-full' : ''}`}>
                <Outlet />
            </main>

            <CreateClassModal open={createOpen} onClose={() => setCreateOpen(false)} />
        </div>
    );
}
