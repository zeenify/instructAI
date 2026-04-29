import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Book, ArrowRight, Loader2, User, Info, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ClassView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchClassData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/student/classes/${id}`);
                if (isMounted) {
                    setClassroom(res.data);
                    setLoading(false);
                }
            } catch (err) {
                navigate('/dashboard/student');
            }
        };
        fetchClassData();
        return () => { isMounted = false; };
    }, [id, navigate]);

    if (loading) return <ClassSkeleton />;

     return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-700 pb-20">
            {/* Class Hero Header */}
            <div className="mb-12 p-10 rounded-[40px] bg-gradient-to-br from-cyan-900/20 to-transparent border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div>
                        <h1 className="text-5xl font-black text-white mb-4 tracking-tighter">{classroom.name}</h1>
                        <p className="text-slate-400 max-w-2xl text-lg leading-relaxed">{classroom.description || "Welcome to your digital classroom."}</p>
                    </div>

                    <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl">
                        
                        {/* --- STRICT AVATAR LOGIC --- */}
                        {(() => {
                            const avatar = classroom.teacher?.avatar;
                            // Check if avatar exists, isn't just whitespace, and isn't the string "null"
                            const hasValidAvatar = avatar && avatar.trim() !== "" && avatar !== "null";

                            if (hasValidAvatar) {
                                return (
                                    <img 
                                        src={avatar} 
                                        className="w-14 h-14 rounded-2xl border border-cyan-500/30 object-cover shadow-lg flex-shrink-0" 
                                        alt="Instructor" 
                                    />
                                );
                            } else {
                                return (
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-[#02010a] font-black text-xl shadow-lg border border-cyan-500/20 flex-shrink-0">
                                        {classroom.teacher?.teacher_profile?.first_name?.charAt(0) || 'T'}
                                        {classroom.teacher?.teacher_profile?.last_name?.charAt(0) || ''}
                                    </div>
                                );
                            }
                        })()}

                        <div>
                            <p className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] mb-1">Lead Instructor</p>
                            <p className="text-white font-black text-lg tracking-tight leading-none">
                                {classroom.teacher?.teacher_profile?.first_name} {classroom.teacher?.teacher_profile?.last_name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="text-sm font-black uppercase tracking-[0.3em] text-slate-500 mb-8 px-2">Published Curriculum</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {classroom.courses?.map(course => (
                    <div key={course.id} className="bg-white/[0.02] border border-white/5 p-10 rounded-[40px] hover:border-cyan-500/30 transition-all group flex flex-col justify-between h-full relative overflow-hidden">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                                <h3 className="text-3xl font-bold text-white group-hover:text-cyan-400 transition-colors tracking-tight">{course.title}</h3>
                                <div className="text-[10px] font-black text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-lg border border-cyan-500/20">
                                    {course.progress_percent || 0}% DONE
                                </div>
                            </div>
                            <p className="text-slate-400 text-base leading-relaxed mb-10 line-clamp-3">
                                {course.description || "Master these concepts with interactive logic tasks."}
                            </p>
                        </div>

                        {/* COURSE PROGRESS SECTION */}
                        <div className="space-y-6 mt-auto">
                            <div className="space-y-2">
                                <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    <span>Course Progress</span>
                                    <span className="text-cyan-400">{course.progress_percent || 0}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${course.progress_percent || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        className="h-full bg-cyan-500 shadow-[0_0_15px_#22d3ee]"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={() => navigate(`/dashboard/student/course/${course.id}`)}
                                className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 transition-all hover:bg-cyan-500 hover:scale-[1.02] active:scale-95 border-none cursor-pointer"
                            >
                                Launch Course <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ClassSkeleton() {
    return (
        <div className="max-w-6xl mx-auto animate-pulse space-y-12">
            <div className="h-64 bg-white/5 rounded-[40px]" />
            <div className="grid grid-cols-2 gap-8">
                <div className="h-80 bg-white/5 rounded-[40px]" />
                <div className="h-80 bg-white/5 rounded-[40px]" />
            </div>
        </div>
    );
}