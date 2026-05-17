import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useClasses } from '../../context/ClassContext';
import { ChevronLeft, Loader2, BookOpen, Users } from 'lucide-react';
import api, { getMonitorStats, getMonitorStudents, getStudentProfile } from '../../services/api';
import StudentMonitorStats from './StudentMonitorStats';
import StudentMonitorList from './StudentMonitorList';
import StudentProfileDetail from './StudentProfileDetail';
import StudentProfileSkeleton from './StudentProfileSkeleton';
import StudentMonitorListSkeleton from './StudentMonitorListSkeleton';

export default function StudentMonitor() {
    const { classId, courseId, studentId } = useParams();
    const navigate = useNavigate();
    const { classes } = useClasses();

    const [selectedClass, setSelectedClass] = useState(classId ? parseInt(classId) : null);
    const [selectedCourse, setSelectedCourse] = useState(courseId ? parseInt(courseId) : null);
    const [courses, setCourses] = useState([]);
    const [stats, setStats] = useState(null);
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(studentId ? parseInt(studentId) : null);
    const [studentProfile, setStudentProfile] = useState(null);

    const [loadingCourses, setLoadingCourses] = useState(false);
    const [loadingStats, setLoadingStats] = useState(false);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [sort, setSort] = useState('progress');
    const [filter, setFilter] = useState('all');
    const [profileTab, setProfileTab] = useState('progress');

    useEffect(() => {
        if (classes.length > 0 && !selectedClass) {
            setSelectedClass(classes[0].id);
        }
    }, [classes, selectedClass]);

    useEffect(() => {
        if (selectedClass) {
            setLoadingCourses(true);
            api.get(`/teacher/classes/${selectedClass}`, { bypassCache: true })
                .then(res => {
                    const coursesData = res.data.courses || [];
                    setCourses(coursesData);
                    if (coursesData.length > 0 && !selectedCourse) {
                        setSelectedCourse(coursesData[0].id);
                    }
                    setStats(null);
                    setStudents([]);
                })
                .catch(err => {
                    console.error('Failed to fetch courses:', err);
                    setCourses([]);
                })
                .finally(() => setLoadingCourses(false));
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass && selectedCourse) {
            setLoadingStats(true);
            setLoadingStudents(true);

            Promise.all([
                getMonitorStats(selectedClass, selectedCourse),
                getMonitorStudents(selectedClass, selectedCourse, sort, filter)
            ])
            .then(([statsRes, studentsRes]) => {
                setStats(statsRes.data);
                setStudents(studentsRes.data.students);
                setSelectedStudent(null);
                setStudentProfile(null);
            })
            .catch(err => {
                console.error('Failed to fetch monitoring data:', err);
                setStats(null);
                setStudents([]);
            })
            .finally(() => {
                setLoadingStats(false);
                setLoadingStudents(false);
            });
        }
    }, [selectedClass, selectedCourse, sort, filter]);

    useEffect(() => {
        if (selectedClass && selectedCourse && selectedStudent) {
            setLoadingProfile(true);
            setStudentProfile(null);

            const abortController = new AbortController();

            getStudentProfile(selectedClass, selectedCourse, selectedStudent, abortController.signal)
                .then(res => {
                    setStudentProfile(res.data);
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error('Failed to fetch student profile:', err);
                        setStudentProfile(null);
                    }
                })
                .finally(() => setLoadingProfile(false));

            return () => abortController.abort();
        }
    }, [selectedClass, selectedCourse, selectedStudent]);

    const handleStudentClick = (student) => {
        setSelectedStudent(student.id);
        navigate(`/dashboard/teacher/monitor/${selectedClass}/${selectedCourse}/${student.id}`);
    };

    const handleBackFromProfile = () => {
        setSelectedStudent(null);
        navigate(`/dashboard/teacher/monitor/${selectedClass}`);
    };

    const selectedClassData = classes.find(c => c.id === selectedClass);
    const selectedCourseData = courses.find(c => c.id === selectedCourse);

    if (selectedStudent) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', transition: 'all 0.3s ease' }}>
                <div className="max-w-7xl mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px' }}>
                    <button
                        onClick={handleBackFromProfile}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid #10b981',
                            borderRadius: '8px',
                            color: '#10b981',
                            fontWeight: '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 200ms ease-in-out',
                            marginBottom: '32px'
                        }}
                    >
                        <ChevronLeft size={18} />
                        Back to List
                    </button>

                    {loadingProfile ? (
                        <StudentProfileSkeleton />
                    ) : studentProfile ? (
                        <>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
                                <button
                                    onClick={() => setProfileTab('progress')}
                                    style={{
                                        padding: '12px 16px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: profileTab === 'progress' ? '#10b981' : 'var(--text-tertiary)',
                                        fontWeight: profileTab === 'progress' ? '600' : '500',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease-in-out',
                                        borderBottom: profileTab === 'progress' ? '2px solid #10b981' : '2px solid transparent',
                                        marginBottom: '-1px'
                                    }}
                                >
                                    Course Progress
                                </button>
                                <button
                                    onClick={() => setProfileTab('quizzes')}
                                    style={{
                                        padding: '12px 16px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: profileTab === 'quizzes' ? '#10b981' : 'var(--text-tertiary)',
                                        fontWeight: profileTab === 'quizzes' ? '600' : '500',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease-in-out',
                                        borderBottom: profileTab === 'quizzes' ? '2px solid #10b981' : '2px solid transparent',
                                        marginBottom: '-1px'
                                    }}
                                >
                                    Quiz Summary
                                </button>
                            </div>
                            <StudentProfileDetail profile={studentProfile} activeTab={profileTab} />
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
                            <p>Failed to load student profile</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', transition: 'all 0.3s ease' }}>
            <div className="max-w-7xl mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px' }}>
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '36px', fontWeight: '700', letterSpacing: '-0.04em', marginBottom: '12px' }}>Student Progress Monitor</h1>
                    <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>Track and analyze student performance across courses</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            <BookOpen size={16} style={{ color: '#10b981' }} />
                            Select Class
                        </label>
                        <select
                            value={selectedClass || ''}
                            onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '15px'
                            }}
                        >
                            <option value="">Choose a class...</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--bg-secondary)' }}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                            <Users size={16} style={{ color: '#10b981' }} />
                            Select Course
                        </label>
                        <select
                            value={selectedCourse || ''}
                            onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
                            disabled={!selectedClass}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                backgroundColor: !selectedClass ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                opacity: !selectedClass ? 0.5 : 1,
                                cursor: !selectedClass ? 'not-allowed' : 'pointer',
                                fontSize: '15px'
                            }}
                        >
                            <option value="">Choose a course...</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id} style={{ backgroundColor: 'var(--bg-secondary)' }}>{c.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedClass && selectedCourse && (
                    <>
                        <div style={{ marginBottom: '40px', paddingBottom: '24px', borderBottom: '2px solid rgba(16, 185, 129, 0.3)' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                                Class
                            </p>
                            <h2 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                {selectedClassData?.name}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                <p style={{ fontSize: '16px', fontWeight: '500', color: '#60a5fa', margin: 0 }}>
                                    {selectedCourseData?.title}
                                </p>
                            </div>
                        </div>

                        {loadingStats ? (
                            <div style={{ textAlign: 'center', padding: '60px 0' }}>
                                <Loader2 className="animate-spin text-emerald-400" size={40} style={{ margin: '0 auto' }} />
                            </div>
                        ) : stats ? (
                            <div style={{ marginBottom: '40px' }}>
                                <StudentMonitorStats stats={stats} />
                            </div>
                        ) : null}

                        <div style={{ marginTop: '40px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
                                <div>
                                    <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>Student Progress</h3>
                                    <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginTop: '8px' }}>{students.length} students</p>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Sort</label>
                                        <select
                                            value={sort}
                                            onChange={(e) => setSort(e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="progress">Progress ↓</option>
                                            <option value="progress_asc">Progress ↑</option>
                                            <option value="last_active">Recently Active</option>
                                            <option value="name">Name (A-Z)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px' }}>Filter</label>
                                        <select
                                            value={filter}
                                            onChange={(e) => setFilter(e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: 'var(--bg-secondary)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '8px',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value="all">All Students</option>
                                            <option value="not_started">Not Started</option>
                                            <option value="stuck">Stuck</option>
                                            <option value="inactive">Inactive (7d+)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {loadingStudents ? (
                                <StudentMonitorListSkeleton />
                            ) : students.length > 0 ? (
                                <StudentMonitorList
                                    students={students}
                                    onStudentClick={handleStudentClick}
                                    loadingProfile={loadingProfile}
                                    selectedStudentId={selectedStudent}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: '64px', backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <p style={{ color: 'var(--text-tertiary)' }}>No students found matching the filter criteria.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}