import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Users, School, ListChecks, Activity, LogOut, ChevronRight, PanelLeftClose, Menu, ShieldCheck } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import '../../styles/dashboard.css';

export default function AdminLayout() {
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const [collapsed, setCollapsed] = useState(() => localStorage.getItem('db-sidebar-collapsed') === '1');
    const [mobileOpen, setMobileOpen] = useState(false);

    // The admin identity comes from /user (admins carry no profile row —
    // their email is the display identity).
    const { data: me } = useQuery({
        queryKey: ['auth', 'me'],
        queryFn: () => api.get('/user', { bypassCache: true }),
        staleTime: 10 * 60 * 1000,
    });

    useEffect(() => {
        localStorage.setItem('db-sidebar-collapsed', collapsed ? '1' : '0');
    }, [collapsed]);

    // Close the mobile drawer whenever the route changes
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const items = [
        { to: '/admin', icon: LayoutDashboard, label: 'Overview', exact: true },
        { to: '/admin/users', icon: Users, label: 'Users' },
        { to: '/admin/classes', icon: School, label: 'Classes' },
        { to: '/admin/whitelists', icon: ListChecks, label: 'Whitelists' },
        { to: '/admin/system', icon: Activity, label: 'System' },
    ];

    const NavLink = ({ to, icon: Icon, label, exact = false }) => (
        <Link to={to} className={`db-nav-item ${exact ? (location.pathname === to ? 'active' : '') : (location.pathname.startsWith(to) ? 'active' : '')}`}>
            <Icon size={18} />
            <span>{label}</span>
        </Link>
    );

    return (
        <div className={`db-shell ${collapsed ? 'is-collapsed' : ''}`}>
            <aside className={`db-sidebar db-scrollbar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
                {/* Brand + collapse */}
                <div className="db-logo-row">
                    <Link to="/admin" className="db-logo">
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

                <div className="db-side-label">Administrator</div>
                <nav style={{ display: 'flex', flexDirection: 'column' }}>
                    {items.map((it) => (
                        <NavLink key={it.to} to={it.to} icon={it.icon} label={it.label} exact={it.exact} />
                    ))}
                </nav>

                <div className="db-side-spacer" />

                <div style={{ marginTop: '8px', padding: '0 4px' }}>
                    <ThemeToggle variant="dark-panel" />
                </div>

                {/* Profile & Sign Out */}
                <div className="db-side-footer">
                    <div className="db-profile-card">
                        <span className="db-profile-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--db-accent-soft)', color: 'var(--db-accent)', fontWeight: 700 }}>
                            <ShieldCheck size={18} />
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                            <p className="db-profile-name">School Admin</p>
                            <p className="db-profile-email">{me?.email || 'admin'}</p>
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

            {/* Reopen affordance for the collapsed sidebar (same one-way-door
                fix as the teacher shell). */}
            <button className="db-sidebar-float" title="Open sidebar" aria-label="Open sidebar"
                onClick={() => setCollapsed(false)}>
                <Menu size={20} />
            </button>

            {/* Mobile top bar */}
            <div className="db-mobilebar">
                <button className="db-mobilebar-btn" title="Open menu" onClick={() => setMobileOpen(true)}>
                    <Menu size={20} />
                </button>
                <Link to="/admin" className="db-mobilebar-brand">
                    InstructAI<span className="db-mobilebar-dot">.</span>
                </Link>
            </div>

            <main className={`db-main ${collapsed ? 'is-full' : ''}`}>
                <Outlet />
            </main>
        </div>
    );
}
