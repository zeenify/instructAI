import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { invalidateCache } from '../../services/api';
import cache from '../../utils/cache';
import CreateCourseModal from './CreateCourseModal';
import DeleteModal from '../../components/ui/DeleteModal';
import {
    Copy, Users, BookOpen, Plus,
    Trash2, ExternalLink, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import './ClassDetails.css';

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
            // Speed Trick: Reset state instantly so the user sees the Skeleton
            // of the NEW class immediately instead of the data of the OLD class.
            setLoading(true);
            setClassroom(null);

            // Clear cache for this specific class
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

    // --- MILLION DOLLAR SKELETON UI ---
    if (loading) return (
        <div className="class-details-container">
            <div className="skeleton-container">
                {/* Header Skeleton */}
                <div className="skeleton-header">
                    <div className="skeleton-header-line" />
                    <div className="skeleton-header-line" />
                </div>
                {/* Tabs Skeleton */}
                <div className="skeleton-tabs">
                    <div className="skeleton-tab" />
                    <div className="skeleton-tab" />
                </div>
                {/* Grid Skeleton */}
                <div className="skeleton-grid">
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                    <div className="skeleton-card" />
                </div>
            </div>
        </div>
    );

    if (!classroom) return null;

    return (
        <div className="class-details-container">
            {/* Header / Hero Area - Enhanced */}
            <div className="class-header">
                {/* Decorative gradient orb */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -z-0" style={{ pointerEvents: 'none' }} />

                <div className="class-header-content">
                    <div className="class-header-left">
                        <div className="class-header-label">
                            <div className="w-1.5 h-6 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
                            Classroom
                        </div>
                        <h1 className="class-header-title">{classroom.name}</h1>
                        <p className="class-header-description">{classroom.description || "No description provided."}</p>
                        <div className="class-header-stats">
                            <div className="class-header-stat">
                                <BookOpen size={16} className="text-purple-400" />
                                <span>{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="class-header-stat">
                                <Users size={16} className="text-cyan-400" />
                                <span>{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>

                    <div className="class-code-box">
                        <span className="class-code-label">Share with Students</span>
                        <div className="class-code-display">
                            <span className="class-code-text">{classroom.class_code}</span>
                            <button
                                onClick={copyCode}
                                className="class-code-copy-btn"
                                title="Copy class code"
                                type="button"
                                style={{ pointerEvents: 'auto' }}
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                        <p className="class-code-hint">Students use this to join</p>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation - Enhanced */}
            <div className="class-tabs">
                <button
                    onClick={() => setActiveTab('courses')}
                    className={`class-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
                >
                    <BookOpen size={16} />
                    <span>Courses</span>
                </button>
                <button
                    onClick={() => setActiveTab('students')}
                    className={`class-tab-btn ${activeTab === 'students' ? 'active' : ''}`}
                >
                    <Users size={16} />
                    <span>Students</span>
                </button>
            </div>

            {/* TAB CONTENT: COURSES - Enhanced */}
            {activeTab === 'courses' && (
                <div className="class-content">
                    <div className="class-curriculum-header">
                        <div>
                            <h3 className="class-curriculum-title">Class Curriculum</h3>
                            <p className="class-curriculum-subtitle">{classroom.courses_count || 0} course{(classroom.courses_count || 0) !== 1 ? 's' : ''} created</p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="btn-primary py-3 px-6 text-sm flex items-center gap-2 border-none cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 transition-all rounded-lg font-bold shadow-lg hover:shadow-purple-500/30"
                        >
                            <Plus size={18} /> Create Course
                        </button>
                    </div>

                    {!classroom.courses || classroom.courses.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <BookOpen size={40} />
                            </div>
                            <p className="empty-title">No courses yet</p>
                            <p className="empty-subtitle">Get started by creating your first course</p>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:text-purple-200 hover:border-purple-400/50 transition-all font-semibold"
                            >
                                <Plus size={16} /> Create First Course
                            </button>
                        </div>
                    ) : (
                        <div className="class-courses-grid">
                            {classroom.courses.map(course => (
                                <div
                                    key={course.id}
                                    className="course-card"
                                >
                                    <div>
                                        <div className="course-card-header">
                                            <h4 className="course-card-title">
                                                {course.title}
                                            </h4>
                                            <div className="course-card-actions">
                                                <button
                                                    onClick={() => navigate(`/dashboard/teacher/class/${classroom.id}/course/${course.id}`)}
                                                    className="course-card-action-btn"
                                                    type="button"
                                                    title="Open course"
                                                >
                                                    <ExternalLink size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCourse(course.id, course.title)}
                                                    className="course-card-action-btn course-card-delete-btn"
                                                    type="button"
                                                    title="Delete course"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <span className={`course-card-badge ${course.is_published ? 'published' : 'draft'}`}>
                                            {course.is_published ? (
                                                <>
                                                    <span>✓</span>
                                                    <span>Published</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>◊</span>
                                                    <span>Draft</span>
                                                </>
                                            )}
                                        </span>
                                        <div className="course-card-content">
                                            {course.description && (
                                                <p className="course-card-description">{course.description}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="course-card-footer"></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: STUDENTS - Enhanced */}
            {activeTab === 'students' && (
                <div className="students-section">
                    <div className="students-header">
                        <h3 className="students-header-title">Enrolled Students</h3>
                        <p className="students-header-subtitle">{classroom.students_count || 0} student{(classroom.students_count || 0) !== 1 ? 's' : ''} learning</p>
                    </div>

                    {!classroom.students || classroom.students.length === 0 ? (
                        <div className="students-empty">
                            <div className="students-empty-icon">
                                <Users size={40} className="text-cyan-400" />
                            </div>
                            <p className="students-empty-title">No students yet</p>
                            <p className="students-empty-subtitle">
                                Students will appear here once they join using the class code:
                                <div className="students-empty-code">{classroom.class_code}</div>
                            </p>
                        </div>
                    ) : (
                        <div className="students-table-container">
                            <table className="students-table">
                                <thead className="students-table-head">
                                    <tr>
                                        <th className="students-table-header">Name</th>
                                        <th className="students-table-header">Email</th>
                                        <th className="students-table-header">Joined</th>
                                        <th className="students-table-header">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="students-table-body">
                                    {classroom.students?.map(student => (
                                        <tr key={student.id} className="students-table-row">
                                            <td className="students-table-cell">
                                                <div className="student-name-cell">
                                                    <div className="student-avatar">
                                                        {(student.student_profile?.first_name?.[0] || 'S').toUpperCase()}
                                                    </div>
                                                    <span>{student.student_profile?.first_name} {student.student_profile?.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="students-table-cell student-email">{student.email}</td>
                                            <td className="students-table-cell student-joined">
                                                {student.pivot?.enrolled_at
                                                    ? new Date(student.pivot.enrolled_at).toLocaleDateString(undefined, {
                                                          month: 'short',
                                                          day: 'numeric',
                                                          year: 'numeric'
                                                      })
                                                    : 'Recently'}
                                            </td>
                                            <td className="students-table-cell">
                                                <button className="student-action-btn" type="button" title="Remove student">
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