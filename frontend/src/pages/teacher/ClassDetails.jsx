import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TeacherLayout from '../../components/layouts/TeacherLayout';
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
        const fetchDetails = async () => {
            try {
                // Ensure this matches your Laravel route: /api/teacher/classes/{id}
                const res = await api.get(`/teacher/classes/${id}`);
                setClassroom(res.data);
            } catch (err) {
                console.error(err);
                toast.error("Could not load class details");
                navigate('/dashboard/teacher');
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id, navigate]);

    const copyCode = () => {
        if (!classroom?.class_code) return;
        navigator.clipboard.writeText(classroom.class_code);
        toast.success("Class code copied!");
    };

    if (loading) return (
        <TeacherLayout>
            <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-purple-500" size={32} />
            </div>
        </TeacherLayout>
    );

    // If API returned nothing or error
    if (!classroom) return null;

    return (
        <TeacherLayout>
            {/* Header / Hero Area */}
            <div className="mb-8 p-8 rounded-[32px] bg-gradient-to-br from-purple-900/20 to-transparent border border-white/5 relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 tracking-tight text-white">{classroom.name}</h1>
                        <p className="text-slate-400 max-w-xl">{classroom.description || "No description provided."}</p>
                    </div>
                    
                    <div className="bg-[#030014] border border-white/10 p-4 rounded-2xl flex flex-col items-center min-w-[140px]">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Class Code</span>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-mono font-bold text-purple-400">{classroom.class_code}</span>
                            <button onClick={copyCode} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors border-none bg-transparent cursor-pointer">
                                <Copy size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex gap-8 border-b border-white/5 mb-8 px-4">
                <button 
                    onClick={() => setActiveTab('courses')}
                    className={`bg-transparent border-none cursor-pointer pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'courses' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Courses ({classroom.courses_count || 0})
                </button>
                <button 
                    onClick={() => setActiveTab('students')}
                    className={`bg-transparent border-none cursor-pointer pb-4 text-sm font-bold uppercase tracking-widest transition-all ${activeTab === 'students' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    Students ({classroom.students_count || 0})
                </button>
            </div>

            {/* TAB CONTENT: COURSES */}
            {activeTab === 'courses' && (
                <div className="space-y-4 text-white">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold">Class Curriculum</h3>
                        <button onClick={() => setIsModalOpen(true)}  className="btn-primary py-2 px-4 text-xs flex items-center gap-2 border-none cursor-pointer">
                            <Plus size={16} /> Create Course
                        </button>
                    </div>

                    {!classroom.courses || classroom.courses.length === 0 ? (
                        <div className="border-2 border-dashed border-white/5 rounded-[24px] py-16 text-center">
                            <BookOpen className="mx-auto text-slate-700 mb-4" size={40} />
                            <p className="text-slate-500">No courses in this class yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {classroom.courses.map(course => (
                                <div key={course.id} className="stat-card p-6 flex justify-between items-center group">
                                    <div>
                                        <h4 className="text-lg font-bold group-hover:text-purple-400 transition-colors">{course.title}</h4>
                                        <p className="text-slate-500 text-sm">{course.is_published ? "Published" : "Draft"}</p>
                                    </div>
                                    <button className="p-3 bg-white/5 rounded-xl text-slate-400 hover:text-white transition-all border-none cursor-pointer">
                                        <ExternalLink size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: STUDENTS */}
            {activeTab === 'students' && (
                <div className="stat-card p-0 overflow-hidden text-white">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Student Name</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Joined At</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {classroom.students?.map(student => (
                                <tr key={student.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-bold">
                                        {/* Added Optional Chaining here to prevent crash */}
                                        {student.student_profile?.first_name} {student.student_profile?.last_name}
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-sm">{student.email}</td>
                                    <td className="px-6 py-4 text-slate-500 text-sm">
                                        {/* Added safety check for pivot data */}
                                        {student.pivot?.enrolled_at ? new Date(student.pivot.enrolled_at).toLocaleDateString() : 'Recent'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-500 hover:text-red-400 transition-colors border-none bg-transparent cursor-pointer">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {(!classroom.students || classroom.students.length === 0) && (
                        <p className="text-center py-10 text-slate-500 italic">No students have joined this class yet.</p>
                    )}
                </div>
            )}
            <CreateCourseModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                classId={id} 
                onCourseCreated={(newCourse) => {
                    // This adds the new course to the UI immediately
                    setClassroom(prev => ({
                        ...prev,
                        courses: [...prev.courses, newCourse],
                        courses_count: prev.courses_count + 1
                    }));
                }}
            />
        </TeacherLayout>
    );
}