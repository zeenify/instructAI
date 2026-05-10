import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import CreateCourseModal from './CreateCourseModal';
import { 
    Copy, Users, BookOpen, Plus, 
    Trash2, ExternalLink, Loader2 
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClassDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('courses');
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        
        const fetchDetails = async () => {
            // Speed Trick: Reset state instantly so the user sees the Skeleton 
            // of the NEW class immediately instead of the data of the OLD class.
            setLoading(true);
            setClassroom(null); 
            
            try {
                const res = await api.get(`/teacher/classes/${id}`);
                if (isMounted) {
                    setClassroom(res.data);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    toast.error("Could not load class details");
                    navigate('/dashboard/teacher');
                }
                if (err.response?.status === 403) {
                    toast.error("Security Alert: Unauthorized access attempt.");
                    navigate('/dashboard/teacher'); // Kick them back to safety
                }
            }
        };

        fetchDetails();
        return () => { isMounted = false; };
    }, [id, navigate]);

    const copyCode = () => {
        if (!classroom?.class_code) return;
        navigator.clipboard.writeText(classroom.class_code);
        toast.success("Class code copied!");
    };

    // --- MILLION DOLLAR SKELETON UI ---
    if (loading) return (
        <div className="animate-pulse space-y-8">
            {/* Header Skeleton */}
            <div className="h-48 bg-white/5 rounded-[32px] border border-white/5 flex flex-col justify-center px-10 gap-4">
                <div className="h-10 bg-white/10 rounded-xl w-1/3" />
                <div className="h-4 bg-white/5 rounded-lg w-1/2" />
            </div>
            {/* Tabs Skeleton */}
            <div className="flex gap-8 border-b border-white/5 px-4">
                <div className="h-8 bg-white/5 rounded w-24 mb-4" />
                <div className="h-8 bg-white/5 rounded w-24 mb-4" />
            </div>
            {/* Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-32 bg-white/5 rounded-3xl border border-white/5" />
                <div className="h-32 bg-white/5 rounded-3xl border border-white/5" />
            </div>
        </div>
    );

    if (!classroom) return null;

    return (
        <>
            {/* Header / Hero Area - Enhanced */}
            <div className="mb-12 p-10 rounded-[28px] bg-gradient-to-br from-purple-500/15 via-purple-900/10 to-transparent border border-purple-500/20 relative overflow-hidden">
                {/* Decorative gradient orb */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-0" />

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-1.5 h-8 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-[0.15em]">Classroom</span>
                        </div>
                        <h1 className="text-5xl font-bold mb-3 tracking-tight text-white">{classroom.name}</h1>
                        <p className="text-slate-400 max-w-2xl text-base leading-relaxed">{classroom.description || "No description provided."}</p>
                        <div className="mt-6 flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                                <BookOpen size={16} className="text-purple-400" />
                                <span>{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Users size={16} className="text-cyan-400" />
                                <span>{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-900/40 to-purple-900/10 border border-purple-500/30 hover:border-purple-400/50 p-6 rounded-2xl flex flex-col items-center min-w-[160px] transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-[0.15em] mb-3">Share with Students</span>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-3xl font-mono font-bold text-purple-300">{classroom.class_code}</span>
                            <button
                                onClick={copyCode}
                                className="p-2.5 hover:bg-purple-500/20 rounded-lg text-purple-300 hover:text-purple-200 transition-all border border-purple-500/30 hover:border-purple-400/50 bg-transparent cursor-pointer"
                                title="Copy class code"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2">Students use this to join</p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation - Enhanced */}
            <div className="flex gap-1 border-b border-white/5 mb-10 px-0">
                <button
                    onClick={() => setActiveTab('courses')}
                    className={`px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all relative bg-transparent border-none cursor-pointer ${
                        activeTab === 'courses'
                            ? 'text-purple-300 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gradient-to-r after:from-purple-500 after:to-purple-400'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <BookOpen size={16} />
                        <span>Courses</span>
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`px-6 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all relative bg-transparent border-none cursor-pointer ${
                        activeTab === 'students'
                            ? 'text-cyan-300 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-gradient-to-r after:from-cyan-500 after:to-cyan-400'
                            : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <Users size={16} />
                        <span>Students</span>
                    </div>
                </button>
            </div>

            {/* TAB CONTENT: COURSES - Enhanced */}
            {activeTab === 'courses' && (
                <div className="space-y-6 text-white">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h3 className="text-2xl font-bold">Class Curriculum</h3>
                            <p className="text-slate-500 text-sm mt-1">{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''} created</p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary py-3 px-6 text-sm flex items-center gap-2 border-none cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all rounded-lg font-bold shadow-lg hover:shadow-purple-500/30"
                        >
                            <Plus size={18} /> Create Course
                        </button>
                    </div>

                    {!classroom.courses || classroom.courses.length === 0 ? (
                        <div className="border-2 border-dashed border-white/10 rounded-[24px] py-20 px-8 text-center bg-white/[0.01]">
                            <div className="w-20 h-20 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <BookOpen className="text-purple-500/50" size={40} />
                            </div>
                            <p className="text-slate-400 text-lg font-medium mb-2">No courses yet</p>
                            <p className="text-slate-500 text-sm mb-6">Get started by creating your first course</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-purple-200 hover:border-purple-400/50 transition-all"
                            >
                                <Plus size={16} /> Create First Course
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {classroom.courses.map(course => (
                                <div
                                    key={course.id}
                                    className="group relative p-6 rounded-2xl border border-white/10 hover:border-purple-500/40 bg-gradient-to-br from-white/[0.05] to-transparent hover:from-purple-900/20 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/10"
                                >
                                    <div className="flex flex-col h-full justify-between">
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <h4 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors flex-1 pr-3 line-clamp-2">
                                                    {course.title}
                                                </h4>
                                                <button
                                                    onClick={() => navigate(`/dashboard/teacher/class/${classroom.id}/course/${course.id}`)}
                                                    className="p-2 bg-purple-600/30 rounded-lg text-purple-300 hover:text-purple-200 hover:bg-purple-500/40 transition-all border border-purple-500/20 hover:border-purple-400/50 flex-shrink-0"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                                            course.is_published
                                                                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                                : 'bg-slate-600/20 text-slate-300 border border-slate-500/30'
                                                        }`}
                                                    >
                                                        {course.is_published ? '✓ Published' : '◊ Draft'}
                                                    </span>
                                                </div>
                                                {course.description && (
                                                    <p className="text-sm text-slate-400 line-clamp-2">{course.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: STUDENTS - Enhanced */}
            {activeTab === 'students' && (
                <div className="space-y-6">
                    <div>
                        <h3 className="text-2xl font-bold text-white mb-1">Enrolled Students</h3>
                        <p className="text-slate-500 text-sm">{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''} learning</p>
                    </div>

                    {!classroom.students || classroom.students.length === 0 ? (
                        <div className="border-2 border-dashed border-white/10 rounded-[24px] py-20 px-8 text-center bg-white/[0.01]">
                            <div className="w-20 h-20 bg-cyan-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Users className="text-cyan-500/50" size={40} />
                            </div>
                            <p className="text-slate-400 text-lg font-medium mb-2">No students yet</p>
                            <p className="text-slate-500 text-sm">Students will appear here once they join using the class code: <span className="font-mono font-bold text-purple-300">{classroom.class_code}</span></p>
                        </div>
                    ) : (
                        <div className="border border-white/10 rounded-2xl overflow-hidden bg-gradient-to-b from-white/[0.05] to-transparent">
                            <table className="w-full text-left text-white">
                                <thead className="bg-white/5 border-b border-white/10">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Name</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Email</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-400">Joined</th>
                                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.1em] text-slate-400 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {classroom.students?.map(student => (
                                        <tr key={student.id} className="hover:bg-white/[0.03] transition-colors">
                                            <td className="px-6 py-4 font-semibold">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center">
                                                        <span className="text-sm font-bold text-white">
                                                            {(student.student_profile?.first_name?.[0] || 'S').toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span>{student.student_profile?.first_name} {student.student_profile?.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400 text-sm">{student.email}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {student.pivot?.enrolled_at
                                                    ? new Date(student.pivot.enrolled_at).toLocaleDateString(undefined, {
                                                          month: 'short',
                                                          day: 'numeric',
                                                          year: 'numeric'
                                                      })
                                                    : 'Recently'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/30 bg-transparent cursor-pointer">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <CreateCourseModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                classId={id} 
                onCourseCreated={(newCourse) => {
                    setClassroom(prev => ({
                        ...prev,
                        courses: [...prev.courses, newCourse],
                        courses_count: prev.courses_count + 1
                    }));
                }}
            />
        </>
    );
}