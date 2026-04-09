import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, Users, BarChart3, 
  Settings, LogOut, Menu, X, Plus, ChevronRight, Hash
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function DashboardLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [classes, setClasses] = useState([]);

  // Fetch classes for the sidebar navigation
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await api.get('/teacher/classes');
        setClasses(res.data);
      } catch (err) { console.error("Sidebar load error", err); }
    };
    if (user?.role === 'teacher') fetchClasses();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#030014] text-white flex overflow-hidden">
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {!isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(true)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#05011d]/50 backdrop-blur-xl border-r border-white/5 transition-transform duration-300 lg:relative ${!isSidebarOpen ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'}`}>
        <div className="h-full flex flex-col p-6">
          <Link to="/dashboard/teacher" className="flex items-center gap-3 mb-8 px-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-accent rounded-lg flex items-center justify-center font-bold shadow-[0_0_15px_rgba(167,139,250,0.4)]">I</div>
            <span className="font-bold text-xl tracking-tighter">InstructAI</span>
          </Link>

          <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
            {/* SECTION: QUICK CLASS ACCESS */}
            <div className="mb-8">
              <div className="flex items-center justify-between px-2 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">My Classes</span>
                <Link to="/dashboard/teacher/classes/new" className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-purple-400 transition-colors">
                  <Plus size={14} />
                </Link>
              </div>
              <div className="space-y-1">
                {classes.map((c) => (
                  <Link
                    key={c.id}
                    to={`/dashboard/teacher/class/${c.id}`}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border ${location.pathname.includes(`/class/${c.id}`) ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${location.pathname.includes(`/class/${c.id}`) ? 'bg-purple-500 shadow-[0_0_8px_rgba(167,139,250,0.6)]' : 'bg-slate-700'}`} />
                    <span className="truncate font-medium">{c.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* SEPARATOR */}
            <div className="h-[1px] bg-white/5 mb-8 mx-2" />

            {/* SECTION: GENERAL NAV */}
            <nav className="space-y-1">
              <NavLink icon={LayoutDashboard} label="Overview" to="/dashboard/teacher" active={location.pathname === '/dashboard/teacher'} />
              <NavLink icon={Users} label="Students" to="/dashboard/teacher/students" active={location.pathname === '/dashboard/teacher/students'} />
              <NavLink icon={BarChart3} label="Analytics" to="/dashboard/teacher/analytics" active={location.pathname === '/dashboard/teacher/analytics'} />
              <NavLink icon={Settings} label="Settings" to="/dashboard/teacher/settings" active={location.pathname === '/dashboard/teacher/settings'} />
            </nav>
          </div>

          {/* USER PROFILE */}
          <div className="pt-6 border-t border-white/5">
            <div className="flex items-center gap-3 px-2 mb-4">
              <img src={user?.avatar} className="w-9 h-9 rounded-full border border-white/10" alt="" />
              <div className="flex-grow min-w-0">
                <p className="text-xs font-bold truncate">{user?.teacher_profile?.first_name} {user?.teacher_profile?.last_name}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:text-red-400 text-xs font-semibold transition-colors">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-grow overflow-y-auto">
        <header className="h-16 border-b border-white/5 flex items-center px-8 bg-[#030014]/50 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-2 -ml-4 mr-4 text-slate-400">
            {isSidebarOpen ? <X /> : <Menu />}
          </button>
          <div className="flex-grow font-medium text-sm text-slate-400 uppercase tracking-widest">
            {location.pathname.split('/').pop().replace(/-/g, ' ')}
          </div>
        </header>
        <div className="p-4 md:p-10 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavLink({ icon: Icon, label, to, active }) {
  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all border ${active ? 'bg-white/5 border-white/10 text-white' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'}`}>
      <Icon size={18} />
      <span className="font-semibold">{label}</span>
    </Link>
  );
}