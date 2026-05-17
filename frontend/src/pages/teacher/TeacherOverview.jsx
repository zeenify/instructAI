import { useClasses } from '../../context/ClassContext';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { BookOpen, Users, BarChart3, Eye, Plus, ArrowRight } from 'lucide-react';
import api from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

export default function TeacherOverview() {
    const { classes } = useClasses();
    const navigate = useNavigate();
    const [totalStudents, setTotalStudents] = useState(0);

    useEffect(() => {
        const fetchStudentCounts = async () => {
            try {
                let studentCount = 0;
                for (const cls of classes) {
                    const res = await api.get(`/teacher/classes/${cls.id}`);
                    studentCount += res.data.students?.length || 0;
                }
                setTotalStudents(studentCount);
            } catch (err) {
                console.error('Failed to fetch student counts:', err);
            }
        };

        if (classes.length > 0) {
            fetchStudentCounts();
        } else {
            setTotalStudents(0);
        }
    }, [classes]);

return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', paddingLeft: '24px', paddingRight: '24px', paddingTop: '32px', paddingBottom: '32px', transition: 'all 0.3s ease' }}>
            <div style={{ maxWidth: '1280px', marginLeft: 'auto', marginRight: 'auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px', margin: 0 }}>
                        Dashboard
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                        Welcome back! Here's your teaching overview.
                    </p>
                </div>

                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
                    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                Active Classes
                            </p>
                            <BookOpen style={{ width: '18px', height: '18px', color: '#10b981' }} />
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                            {classes.length}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Classes you created</p>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)', padding: '24px', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                Total Students
                            </p>
                            <Users style={{ width: '18px', height: '18px', color: '#06b6d4' }} />
                        </div>
                        <div style={{ fontSize: '36px', fontWeight: '700', color: '#06b6d4', marginBottom: '8px' }}>
                            {totalStudents}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Across all classes</p>
                    </div>

                    <div
                        onClick={() => navigate('/dashboard/teacher/analytics')}
                        style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            padding: '24px',
                            cursor: 'pointer',
                            transition: 'all 200ms ease-in-out',
                            boxShadow: 'var(--card-shadow)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                View Analytics
                            </p>
                            <BarChart3 style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#8b5cf6', marginBottom: '8px' }}>
                            Performance Metrics
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Track course performance and completion rates</p>
                    </div>
                </div>

                {/* Classes Section */}
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Your Classes</h2>
                        <button
                            onClick={() => navigate('/dashboard/teacher/classes/new')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 16px',
                                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                borderRadius: '8px',
                                color: '#10b981',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 200ms ease-in-out'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.3)';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                            }}
                        >
                            <Plus size={16} />
                            Create Class
                        </button>
                    </div>

{classes.length === 0 ? (
                        <div style={{
                            backgroundColor: 'var(--bg-secondary)',
                            borderRadius: '10px',
                            border: '1px solid var(--border-color)',
                            padding: '40px',
                            textAlign: 'center',
                            boxShadow: 'var(--card-shadow)'
                        }}>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                                You haven't created any classes yet.
                            </p>
                            <button
                                onClick={() => navigate('/dashboard/teacher/classes/new')}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 24px',
                                    backgroundColor: '#10b981',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 200ms ease-in-out'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#059669';
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#10b981';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <Plus size={16} />
                                Create Your First Class
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                            {classes.map(cls => (
                                <button
                                    key={cls.id}
                                    onClick={() => navigate(`/dashboard/teacher/class/${cls.id}`)}
                                    style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-color)',
                                        padding: '20px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 200ms ease-in-out',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        minHeight: '120px',
                                        boxShadow: 'var(--card-shadow)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                                        e.currentTarget.style.borderColor = '#10b981';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                                        e.currentTarget.style.borderColor = 'var(--border-color)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
                                            {cls.name}
                                        </h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                            Class Code: <span style={{ fontWeight: '600' }}>{cls.class_code}</span>
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                                        <ArrowRight style={{ width: '16px', height: '16px', color: '#10b981' }} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}