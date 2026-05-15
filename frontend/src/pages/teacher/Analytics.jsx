import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useClasses } from '../../context/ClassContext';
import { ChevronLeft, Loader2, BookOpen, Users } from 'lucide-react';
import { getAnalyticsOverview, getPerformanceTrend, getQuizScores, getContentEngagement } from '../../services/api';
import api from '../../services/api';
import AnalyticsHeader from './AnalyticsHeader';
import AnalyticsStats from './AnalyticsStats';
import PerformanceTrendChart from './PerformanceTrendChart';
import QuizScoresChart from './QuizScoresChart';
import ContentEngagementTable from './ContentEngagementTable';
import AnalyticsStatsSkeleton from './AnalyticsStatsSkeleton';
import PerformanceTrendSkeleton from './PerformanceTrendSkeleton';
import QuizScoresSkeleton from './QuizScoresSkeleton';
import ContentEngagementSkeleton from './ContentEngagementSkeleton';

export default function Analytics() {
    const { classId, courseId } = useParams();
    const navigate = useNavigate();
    const { classes } = useClasses();

    const [selectedClass, setSelectedClass] = useState(classId ? parseInt(classId) : null);
    const [selectedCourse, setSelectedCourse] = useState(courseId ? parseInt(courseId) : null);
    const [courses, setCourses] = useState([]);

    const [overview, setOverview] = useState(null);
    const [performanceTrend, setPerformanceTrend] = useState(null);
    const [quizScores, setQuizScores] = useState(null);
    const [contentEngagement, setContentEngagement] = useState(null);

    const [loadingCourses, setLoadingCourses] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [showClassPicker, setShowClassPicker] = useState(false);

    // Auto-select first class
    useEffect(() => {
        if (classes.length > 0 && !selectedClass) {
            const firstClassId = classes[0].id;
            setSelectedClass(firstClassId);
        }
    }, [classes, selectedClass]);

    // Fetch courses when class changes
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
                })
                .catch(err => {
                    console.error('Failed to fetch courses:', err);
                    setCourses([]);
                })
                .finally(() => setLoadingCourses(false));
        }
    }, [selectedClass]);

    // Fetch analytics data when course changes
    useEffect(() => {
        if (selectedClass && selectedCourse) {
            setLoadingData(true);
            Promise.all([
                getAnalyticsOverview(selectedClass, selectedCourse),
                getPerformanceTrend(selectedClass, selectedCourse),
                getQuizScores(selectedClass, selectedCourse),
                getContentEngagement(selectedClass, selectedCourse)
            ])
                .then(([overviewRes, trendRes, quizRes, engagementRes]) => {
                    setOverview(overviewRes.data);
                    setPerformanceTrend(trendRes.data.data || []);
                    setQuizScores(quizRes.data.data || []);
                    setContentEngagement(engagementRes.data.data || []);
                })
                .catch(err => {
                    console.error('Failed to fetch analytics data:', err);
                    setOverview(null);
                    setPerformanceTrend(null);
                    setQuizScores(null);
                    setContentEngagement(null);
                })
                .finally(() => setLoadingData(false));
        }
    }, [selectedClass, selectedCourse]);

    const selectedClassData = classes.find(c => c.id === selectedClass);
    const selectedCourseData = courses.find(c => c.id === selectedCourse);

    const handleChangeClass = () => {
        setShowClassPicker(true);
    };

    const handleChangeCourse = () => {
        setSelectedCourse(null);
    };

    const selectClass = (classId) => {
        setSelectedClass(classId);
        setSelectedCourse(null);
        setShowClassPicker(false);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100" style={{ backgroundColor: '#020617' }}>
            <div className="max-w-7xl mx-auto" style={{ paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px' }}>
                {/* Class Picker Modal */}
                {showClassPicker && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: '#1e293b',
                            borderRadius: '12px',
                            padding: '32px',
                            maxWidth: '400px',
                            width: '90%',
                            border: '1px solid rgb(55, 65, 81)'
                        }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '24px' }}>
                                Select a Class
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                                {classes.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => selectClass(c.id)}
                                        style={{
                                            padding: '12px 16px',
                                            backgroundColor: selectedClass === c.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(30, 41, 59, 0.5)',
                                            border: selectedClass === c.id ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgb(55, 65, 81)',
                                            borderRadius: '8px',
                                            color: '#f1f5f9',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            transition: 'all 200ms ease-in-out',
                                            fontWeight: '500'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (selectedClass !== c.id) {
                                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.7)';
                                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (selectedClass !== c.id) {
                                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
                                                e.currentTarget.style.borderColor = 'rgb(55, 65, 81)';
                                            }
                                        }}
                                    >
                                        {c.name}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setShowClassPicker(false)}
                                style={{
                                    marginTop: '24px',
                                    width: '100%',
                                    padding: '10px 16px',
                                    backgroundColor: 'rgba(55, 65, 81, 0.3)',
                                    border: '1px solid rgb(55, 65, 81)',
                                    borderRadius: '8px',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    transition: 'all 200ms ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.3)';
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {selectedClass && selectedCourse ? (
                    <>
                        <AnalyticsHeader
                            classData={selectedClassData}
                            courseData={selectedCourseData}
                            onChangeCourse={handleChangeCourse}
                            onChangeClass={handleChangeClass}
                            courses={courses}
                            selectedCourse={selectedCourse}
                            setSelectedCourse={setSelectedCourse}
                            allClasses={classes}
                            selectedClass={selectedClass}
                            setSelectedClass={setSelectedClass}
                        />

                        {loadingData ? (
                            <>
                                <AnalyticsStatsSkeleton />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                            Completion Trend
                                        </h2>
                                        <PerformanceTrendSkeleton />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                            Quiz Performance
                                        </h2>
                                        <QuizScoresSkeleton />
                                    </div>
                                    <div>
                                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                            Content Engagement
                                        </h2>
                                        <ContentEngagementSkeleton />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Stats Overview */}
                                {overview && (
                                    <div style={{ marginBottom: '40px' }}>
                                        <AnalyticsStats stats={overview} />
                                    </div>
                                )}

                                {/* Charts */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '40px' }}>
                                    {/* Performance Trend */}
                                    {performanceTrend && (
                                        <div>
                                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                                Completion Trend
                                            </h2>
                                            <PerformanceTrendChart data={performanceTrend} />
                                        </div>
                                    )}

                                    {/* Quiz Scores */}
                                    {quizScores && quizScores.length > 0 && (
                                        <div>
                                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                                Quiz Performance
                                            </h2>
                                            <QuizScoresChart data={quizScores} />
                                        </div>
                                    )}

                                    {/* Content Engagement */}
                                    {contentEngagement && contentEngagement.length > 0 && (
                                        <div>
                                            <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px' }}>
                                                Content Engagement
                                            </h2>
                                            <ContentEngagementTable data={contentEngagement} />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div style={{ textAlign: 'center', paddingTop: '60px' }}>
                        {loadingCourses ? (
                            <Loader2 className="animate-spin text-emerald-400" size={40} style={{ margin: '0 auto' }} />
                        ) : (
                            <p style={{ color: '#94a3b8' }}>Loading analytics...</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
