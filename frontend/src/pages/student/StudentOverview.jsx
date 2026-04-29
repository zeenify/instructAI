import { useAuth } from '../../context/AuthContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BookOpen, Award, ArrowRight, LayoutGrid, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentOverview() {
    const { user } = useAuth();
    const { classes } = useOutletContext(); 
    const navigate = useNavigate();

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-700">
            <div className="mb-12">
                <h1 className="text-4xl font-bold mb-2 text-white">
                    Welcome back, <span className="text-cyan-400">{user?.student_profile?.first_name}</span>
                </h1>
                <p className="text-slate-400 font-medium tracking-wide">Select a workspace to continue your curriculum.</p>
            </div>

            {/* Simple Stats Header */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[24px] flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                        <LayoutGrid size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Active Classes</p>
                        <p className="text-2xl font-black text-white">{classes?.length || 0}</p>
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[24px] flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                        <Zap size={28} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Server Status</p>
                        <p className="text-2xl font-black text-white">Online</p>
                    </div>
                </div>
            </div>

            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-8 px-2">Your Workspaces</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
                {classes.map(c => (
                    <div key={c.id} className="bg-[#05011d] border border-white/5 p-8 rounded-[32px] hover:border-cyan-500/30 transition-all group relative">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">{c.name}</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                                    {c.teacher?.teacher_profile?.first_name} {c.teacher?.teacher_profile?.last_name}
                                </p>
                            </div>
                            <div className="bg-white/5 px-3 py-1 rounded-full text-[10px] font-black text-slate-400 border border-white/5">
                                {c.courses_count} CURRICULUM
                            </div>
                        </div>

                        {/* PROGRESS SECTION ON CLASS CARD */}
                        <div className="mb-10 space-y-3">
                            <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest">
                                <span className="text-slate-500">Workspace Progress</span>
                                <span className="text-cyan-400">{c.progress_percent || 0}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${c.progress_percent || 0}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-cyan-500 shadow-[0_0_10px_#22d3ee]"
                                />
                            </div>
                        </div>

                        <button 
                            onClick={() => navigate(`/dashboard/student/class/${c.id}`)}
                            className="w-full py-4 rounded-xl bg-cyan-500/5 text-cyan-400 font-black uppercase tracking-[0.2em] text-[10px] flex items-center justify-center gap-2 border border-cyan-500/10 hover:bg-cyan-500 hover:text-black transition-all cursor-pointer border-none"
                        >
                            Enter Room <ArrowRight size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}