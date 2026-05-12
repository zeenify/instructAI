import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import cache from '../../utils/cache';
import CreateCourseModal from './CreateCourseModal';
import DeleteModal from '../../components/ui/DeleteModal';
import { Copy, Users, BookOpen, Plus, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function ClassDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('courses');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const fetchDetails = async () => {
            setLoading(true);
            setClassroom(null);
            cache.invalidate(`get:/teacher/classes/${id}`);

            try {
                const res = await api.get(`/teacher/classes/${id}`, { bypassCache: true });
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
                    navigate('/dashboard/teacher');
                }
            }
        };

        fetchDetails();
        return () => { isMounted = false; };
    }, [id, navigate]);

    const copyCode = () => {
        if (!classroom?.class_code) return;
        navigator.clipboard.writeText(classroom.class_code);
        toast.success(`Class code copied: ${classroom.class_code}`);
    };

    const handleDeleteCourse = (courseId, courseTitle) => {
        setCourseToDelete({ id: courseId, title: courseTitle });
        setDeleteModalOpen(true);
    };

    const confirmDeleteCourse = async () => {
        if (!courseToDelete) return;
        setIsDeleting(true);
        try {
            await api.delete(`/teacher/courses/${courseToDelete.id}`);
            toast.success(`"${courseToDelete.title}" deleted successfully`);
            setClassroom(prev => ({
                ...prev,
                courses: prev.courses.filter(c => c.id !== courseToDelete.id),
                courses_count: prev.courses_count - 1
            }));
            setDeleteModalOpen(false);
            setCourseToDelete(null);
        } catch (err) {
            toast.error("Failed to delete course");
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px 50px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <div style={{ height: '200px', background: 'rgba(167, 139, 250, 0.08)', borderRadius: '12px', padding: '24px', animation: 'pulse 2s infinite' }} />
                    <div style={{ height: '40px', background: 'rgba(167, 139, 250, 0.08)', borderRadius: '8px', width: '120px', animation: 'pulse 2s infinite' }} />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                        {[1, 2, 3].map(i => <div key={i} style={{ height: '240px', background: 'rgba(167, 139, 250, 0.08)', borderRadius: '16px', animation: 'pulse 2s infinite' }} />)}
                    </div>
                </div>
            </div>
        );
    }

    if (!classroom) return null;

    return (
        <div style={{ maxWidth: '100%', padding: '40px 50px', background: '#02010a', color: 'white', minHeight: '100vh' }}>
            {/* HEADER */}
            <div style={{ marginBottom: '48px', padding: '40px', borderRadius: '28px', background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15) 0%, rgba(109, 40, 217, 0.1) 100%)', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                <div style={{ display: 'flex', gap: '40px', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                            <div style={{ width: '6px', height: '24px', background: 'linear-gradient(to bottom, #a78bfa, #9333ea)', borderRadius: '999px' }} />
                            Classroom
                        </div>
                        <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'white', margin: '0 0 12px 0' }}>{classroom.name}</h1>
                        <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 16px 0' }}>{classroom.description || "No description provided."}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', fontSize: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                <BookOpen size={16} />
                                <span>{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                                <Users size={16} />
                                <span>{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(109, 40, 217, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '16px', padding: '28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: '200px', textAlign: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0' }}>Share with Students</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
                            <span style={{ fontSize: '30px', fontWeight: 700, color: '#d8b4fe', fontFamily: 'Courier New, monospace', letterSpacing: '0.1em', margin: '0' }}>{classroom.class_code}</span>
                            <button
                                onClick={copyCode}
                                style={{ padding: '10px 12px', background: 'rgba(167, 139, 250, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '10px', color: '#d8b4fe', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}
                                type="button"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748b', margin: '0' }}>Students use this to join</p>
                    </div>
                </div>
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '40px' }}>
                <button
                    onClick={() => setActiveTab('courses')}
                    style={{
                        padding: '16px 24px',
                        background: 'transparent',
                        border: 'none',
                        color: activeTab === 'courses' ? '#d8b4fe' : '#64748b',
                        fontSize: '14px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderBottom: activeTab === 'courses' ? '2px solid #d8b4fe' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '-1px'
                    }}
                >
                    <BookOpen size={16} />
                    <span>Courses</span>
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    style={{
                        padding: '16px 24px',
                        background: 'transparent',
                        border: 'none',
                        color: activeTab === 'students' ? '#d8b4fe' : '#64748b',
                        fontSize: '14px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        borderBottom: activeTab === 'students' ? '2px solid #d8b4fe' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '-1px'
                    }}
                >
                    <Users size={16} />
                    <span>Students</span>
                </button>
            </div>

            {/* COURSES TAB */}
            {activeTab === 'courses' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
                        <div>
                            <h3 style={{ fontSize: '30px', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>Curriculum</h3>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: '0' }}>{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''}</p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(to right, #9333ea, #7e22ce)', color: 'white', borderRadius: '8px', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', transition: 'all 0.3s' }}
                        >
                            <Plus size={18} /> Create Course
                        </button>
                    </div>

                    {!classroom.courses || classroom.courses.length === 0 ? (
                        <div style={{ border: '2px dashed rgba(255, 255, 255, 0.1)', borderRadius: '24px', padding: '80px 40px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.01)' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(167, 139, 250, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'rgba(167, 139, 250, 0.5)' }}>
                                <BookOpen size={40} />
                            </div>
                            <p style={{ fontSize: '20px', fontWeight: 600, color: '#94a3b8', margin: '0 0 12px 0' }}>No courses yet</p>
                            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 24px 0' }}>Get started by creating your first course</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                style={{ padding: '14px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(167, 139, 250, 0.3)', color: '#d8b4fe', cursor: 'pointer', fontWeight: 600, transition: 'all 0.3s' }}
                            >
                                <Plus size={16} /> Create First Course
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
                            {classroom.courses.map(course => (
                                <div
                                    key={course.id}
                                    style={{ padding: '24px', borderRadius: '20px', border: '1px solid rgba(167, 139, 250, 0.2)', background: 'linear-gradient(135deg, rgba(15, 7, 36, 0.8) 0%, rgba(30, 10, 60, 0.6) 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '300px', position: 'relative', overflow: 'hidden', transition: 'all 0.3s' }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                            <h4 style={{ fontSize: '18px', fontWeight: 800, color: 'white', flex: 1, wordBreak: 'break-word', margin: '0', lineHeight: '1.3' }}>
                                                {course.title}
                                            </h4>
                                            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                                                <button
                                                    onClick={() => navigate(`/dashboard/teacher/class/${classroom.id}/course/${course.id}`)}
                                                    style={{ padding: '12px 14px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '10px', color: '#e9d5ff', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    type="button"
                                                    title="Open course"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCourse(course.id, course.title)}
                                                    style={{ padding: '12px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#f87171', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    type="button"
                                                    title="Delete course"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '16px', background: course.is_published ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.15)', color: course.is_published ? '#4ade80' : '#d8b4fe', border: course.is_published ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(167, 139, 250, 0.4)' }}>
                                            <span>{course.is_published ? '✓ Published' : '◊ Draft'}</span>
                                        </div>

                                        {course.description && (
                                            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                {course.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* PROGRESS BAR */}
                                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0' }}>Progress</span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#22d3ee', margin: '0' }}>0%</span>
                                        </div>
                                        <div style={{ height: '4px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: '0%' }}
                                                style={{ height: '100%', background: 'linear-gradient(to right, #06b6d4, #22d3ee)', boxShadow: '0 0 10px rgba(34, 211, 238, 0.3)' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
                <div>
                    <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(167, 139, 250, 0.1)', marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '30px', fontWeight: 700, color: 'white', margin: '0 0 8px 0' }}>Enrolled Students</h3>
                        <p style={{ fontSize: '14px', color: '#64748b', margin: '0' }}>{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''} learning</p>
                    </div>

                    {!classroom.students || classroom.students.length === 0 ? (
                        <div style={{ borderRadius: '20px', border: '2px dashed rgba(167, 139, 250, 0.25)', padding: '80px 40px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.05) 0%, rgba(109, 40, 217, 0.02) 100%)' }}>
                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.15) 0%, rgba(99, 102, 241, 0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '2px solid rgba(34, 211, 238, 0.2)', color: '#22d3ee' }}>
                                <Users size={40} />
                            </div>
                            <p style={{ fontSize: '22px', fontWeight: 700, color: '#94a3b8', margin: '0 0 12px 0' }}>No students yet</p>
                            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6', margin: '0' }}>
                                Students will appear here once they join using the class code:
                                <div style={{ display: 'inline-block', marginTop: '8px', padding: '8px 16px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(167, 139, 250, 0.3)', borderRadius: '8px', fontFamily: 'Courier New, monospace', fontWeight: 700, color: '#d8b4fe', fontSize: '18px' }}>{classroom.class_code}</div>
                            </p>
                        </div>
                    ) : (
                        <div style={{ borderRadius: '20px', border: '1px solid rgba(167, 139, 250, 0.2)', background: 'linear-gradient(135deg, rgba(15, 7, 36, 0.5) 0%, rgba(30, 10, 60, 0.3) 100%)', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent' }}>
                                <thead style={{ background: 'linear-gradient(90deg, rgba(167, 139, 250, 0.08) 0%, rgba(109, 40, 217, 0.04) 100%)', borderBottom: '1px solid rgba(167, 139, 250, 0.2)' }}>
                                    <tr>
                                        <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Name</th>
                                        <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Email</th>
                                        <th style={{ padding: '18px 24px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Joined</th>
                                        <th style={{ padding: '18px 24px', textAlign: 'right', fontSize: '12px', fontWeight: 700, color: '#d8b4fe', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {classroom.students?.map(student => (
                                        <tr key={student.id} style={{ borderBottom: '1px solid rgba(167, 139, 250, 0.1)', transition: 'all 0.3s' }}>
                                            <td style={{ padding: '18px 24px', color: '#cbd5e1', fontSize: '14px', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.3) 0%, rgba(34, 211, 238, 0.2) 100%)', border: '1.5px solid rgba(167, 139, 250, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#d8b4fe', flexShrink: 0 }}>
                                                        {(student.student_profile?.first_name?.[0] || 'S').toUpperCase()}
                                                    </div>
                                                    <span style={{ color: 'white', fontWeight: 600 }}>{student.student_profile?.first_name} {student.student_profile?.last_name}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '18px 24px', color: '#94a3b8', fontSize: '14px', verticalAlign: 'middle' }}>{student.email}</td>
                                            <td style={{ padding: '18px 24px', color: '#64748b', fontSize: '14px', verticalAlign: 'middle' }}>
                                                {student.pivot?.enrolled_at
                                                    ? new Date(student.pivot.enrolled_at).toLocaleDateString(undefined, {
                                                          month: 'short',
                                                          day: 'numeric',
                                                          year: 'numeric'
                                                      })
                                                    : 'Recently'}
                                            </td>
                                            <td style={{ padding: '18px 24px', textAlign: 'right', verticalAlign: 'middle' }}>
                                                <button style={{ padding: '10px 12px', background: 'transparent', border: '1.5px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', cursor: 'pointer', transition: 'all 0.3s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} type="button" title="Remove student">
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

            <DeleteModal
                isOpen={deleteModalOpen}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setCourseToDelete(null);
                }}
                onConfirm={confirmDeleteCourse}
                title={courseToDelete?.title || 'Course'}
                loading={isDeleting}
            />
        </div>
    );
}
