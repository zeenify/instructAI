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
            <div className="min-h-screen bg-slate-950 text-slate-100" style={{ backgroundColor: '#020617' }}>
                <div className="max-w-7xl mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px' }}>
                    <button
                        onClick={handleBackFromProfile}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            paddingLeft: '16px',
                            paddingRight: '16px',
                            paddingTop: '10px',
                            paddingBottom: '10px',
                            backgroundColor: 'rgba(30, 41, 59, 0.4)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px',
                            color: '#10b981',
                            fontWeight: '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            transition: 'all 200ms ease-in-out',
                            marginBottom: '32px'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                            e.currentTarget.style.color = '#4ade80';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                            e.currentTarget.style.color = '#10b981';
                        }}
                    >
                        <ChevronLeft size={18} />
                        Back to List
                    </button>

                    {loadingProfile ? (
                        <StudentProfileSkeleton />
                    ) : studentProfile ? (
                        <>
                            {/* Tabs */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid rgb(55, 65, 81)', paddingBottom: '0' }}>
                                <button
                                    onClick={() => setProfileTab('progress')}
                                    style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: profileTab === 'progress' ? '#10b981' : '#94a3b8',
                                        fontWeight: profileTab === 'progress' ? '600' : '500',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease-in-out',
                                        borderBottom: profileTab === 'progress' ? '2px solid #10b981' : '2px solid transparent',
                                        marginBottom: '-1px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (profileTab !== 'progress') {
                                            e.currentTarget.style.color = '#cbd5e1';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (profileTab !== 'progress') {
                                            e.currentTarget.style.color = '#94a3b8';
                                        }
                                    }}
                                >
                                    Course Progress
                                </button>
                                <button
                                    onClick={() => setProfileTab('quizzes')}
                                    style={{
                                        paddingLeft: '16px',
                                        paddingRight: '16px',
                                        paddingTop: '12px',
                                        paddingBottom: '12px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: profileTab === 'quizzes' ? '#10b981' : '#94a3b8',
                                        fontWeight: profileTab === 'quizzes' ? '600' : '500',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease-in-out',
                                        borderBottom: profileTab === 'quizzes' ? '2px solid #10b981' : '2px solid transparent',
                                        marginBottom: '-1px'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (profileTab !== 'quizzes') {
                                            e.currentTarget.style.color = '#cbd5e1';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (profileTab !== 'quizzes') {
                                            e.currentTarget.style.color = '#94a3b8';
                                        }
                                    }}
                                >
                                    Quiz Summary
                                </button>
                            </div>

                            {/* Tab Content */}
                            <StudentProfileDetail profile={studentProfile} activeTab={profileTab} />
                        </>
                    ) : (
                        <div className="text-center py-16 text-slate-400">
                            <p>Failed to load student profile</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100" style={{ backgroundColor: '#020617' }}>
            <div className="max-w-7xl mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px' }}>
                {/* Header */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 className="text-4xl font-bold tracking-tight" style={{ marginBottom: '12px' }}>Student Progress Monitor</h1>
                    <p className="text-slate-400 text-lg">Track and analyze student performance across courses</p>
                </div>

                {/* Selectors */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                    <div className="group">
                        <label className="block text-sm font-semibold text-slate-200" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <BookOpen size={16} style={{ color: '#10b981' }} />
                            Select Class
                        </label>
                        <select
                            value={selectedClass || ''}
                            onChange={(e) => setSelectedClass(e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                backgroundColor: 'rgba(30, 41, 59, 0.3)',
                                border: '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '15px',
                                fontWeight: '500',
                                lineHeight: '1.6',
                                transition: 'all 200ms ease-in-out',
                                appearance: 'none',
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2360a5fa' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                paddingRight: '40px'
                            }}
                            onFocus={(e) => {
                                e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                                e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
                                e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            <option value="">Choose a class...</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id} style={{ backgroundColor: '#1e293b', color: 'white' }}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="group">
                        <label className="block text-sm font-semibold text-slate-200" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                backgroundColor: !selectedClass ? 'rgba(30, 41, 59, 0.15)' : 'rgba(30, 41, 59, 0.3)',
                                border: !selectedClass ? '1px solid rgba(148, 163, 184, 0.1)' : '1px solid rgba(148, 163, 184, 0.2)',
                                borderRadius: '8px',
                                color: !selectedClass ? 'rgba(255, 255, 255, 0.4)' : 'white',
                                cursor: !selectedClass ? 'not-allowed' : 'pointer',
                                opacity: 1,
                                fontSize: '15px',
                                fontWeight: '500',
                                lineHeight: '1.6',
                                transition: 'all 200ms ease-in-out',
                                appearance: 'none',
                                backgroundImage: !selectedClass
                                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`
                                    : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2360a5fa' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'right 12px center',
                                paddingRight: '40px'
                            }}
                            onFocus={(e) => {
                                if (!selectedClass) return;
                                e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                                e.target.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.backgroundColor = 'rgba(30, 41, 59, 0.3)';
                                e.target.style.borderColor = 'rgba(148, 163, 184, 0.2)';
                                e.target.style.boxShadow = 'none';
                            }}
                        >
                            <option value="">Choose a course...</option>
                            {courses.map(c => (
                                <option key={c.id} value={c.id} style={{ backgroundColor: '#1e293b', color: 'white' }}>{c.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loadingCourses && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-emerald-400" size={40} />
                    </div>
                )}

                {selectedClass && selectedCourse && (
                    <>
                        <div style={{ marginBottom: '40px', paddingBottom: '24px', borderBottom: '2px solid rgba(16, 185, 129, 0.3)' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                                Class
                            </p>
                            <h2 style={{ fontSize: '32px', fontWeight: '700', color: '#f1f5f9', marginBottom: '16px', margin: 0 }}>
                                {selectedClassData?.name}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                    <h3 className="text-2xl font-bold text-slate-100">Student Progress</h3>
                                    <p className="text-slate-400 text-base" style={{ marginTop: '8px' }}>{students.length} students</p>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase" style={{ marginBottom: '8px' }}>Sort</label>
                                        <select
                                            value={sort}
                                            onChange={(e) => setSort(e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                                border: '1px solid rgb(55, 65, 81)',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="progress">Progress ↓</option>
                                            <option value="progress_asc">Progress ↑</option>
                                            <option value="last_active">Recently Active</option>
                                            <option value="name">Name (A-Z)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-400 uppercase" style={{ marginBottom: '8px' }}>Filter</label>
                                        <select
                                            value={filter}
                                            onChange={(e) => setFilter(e.target.value)}
                                            style={{
                                                padding: '8px 12px',
                                                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                                border: '1px solid rgb(55, 65, 81)',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                cursor: 'pointer'
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
                                <div className="text-center py-16 bg-slate-800/30 rounded-lg border border-slate-700">
                                    <p className="text-slate-400">No students found matching the filter criteria.</p>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
