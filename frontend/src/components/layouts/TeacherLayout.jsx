import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClasses } from '../../context/ClassContext'; // Use the new context
import { LayoutDashboard, Users, BarChart3, Settings, LogOut, Plus, Loader2 } from 'lucide-react';
import '../../pages/teacher/Dashboard.css';

export default function TeacherLayout({ children }) {
    const { user, logout } = useAuth();
    const { classes, loading } = useClasses(); // Get classes from context
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
                    <span className="font-bold text-xl" style={{ color: 'white', marginLeft: '10px' }}>InstructAI</span>
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
                    <NavLink to="/dashboard/teacher/students" icon={Users} label="Students" />
                    <NavLink to="/dashboard/teacher/analytics" icon={BarChart3} label="Analytics" />
                    <NavLink to="/dashboard/teacher/settings" icon={Settings} label="Settings" />
                </nav>

                {/* --- RESTORED PROFILE & SIGN OUT SECTION --- */}
                <div className="pt-6 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-4 px-2">
                        <img 
                            src={user?.avatar || `https://ui-avatars.com/api/?name=${user?.teacher_profile?.first_name}`} 
                            className="w-10 h-10 rounded-full border border-white/10 shadow-lg" 
                            alt="Avatar"
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate m-0">
                                {user?.teacher_profile?.first_name} {user?.teacher_profile?.last_name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate m-0">{user?.email}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleLogout} 
                        className="nav-item w-full border-none bg-transparent cursor-pointer hover:text-red-400" 
                        style={{ border: 'none', background: 'none', paddingLeft: '12px' }}
                    >
                        <LogOut size={18} />
                        <span className="font-semibold">Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                {children}
            </main>
        </div>
    );
}