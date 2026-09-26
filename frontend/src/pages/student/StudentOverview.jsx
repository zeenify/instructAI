import { useAuth } from '../../context/AuthContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentOverview() {
    const { user } = useAuth();
    const { classes } = useOutletContext();
    const navigate = useNavigate();

    const totalCourses = classes?.reduce((n, c) => n + (c.courses_count || 0), 0) || 0;

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px 80px' }}>
            <div style={{ marginBottom: '40px' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-tertiary)', margin: '0 0 6px 0' }}>Home</p>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '38px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                    Welcome back, <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>{user?.student_profile?.first_name}</span>
                </h1>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, margin: '0 0 6px 0' }}>
                    Pick up where you left off — select a class to continue.
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {classes?.length || 0} {classes?.length === 1 ? 'class' : 'classes'} · {totalCourses} {totalCourses === 1 ? 'course' : 'courses'}
                </p>
            </div>

            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>Your classes</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '22px' }}>
                {classes.map(c => (
                    <div
                        key={c.id}
                        onClick={() => navigate(`/dashboard/student/class/${c.id}`)}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '240px', overflow: 'hidden', cursor: 'pointer' }}
                    >
                        <div>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                                <h3 style={{ fontSize: '21px', fontWeight: 700, color: 'var(--text-primary)', margin: '0', lineHeight: '1.3', letterSpacing: '-0.015em' }}>{c.name}</h3>
                                <ChevronRight size={18} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 4 }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'none', letterSpacing: 0 }}>
                                    {c.teacher?.teacher_profile?.first_name} {c.teacher?.teacher_profile?.last_name}
                                </span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'none', fontSize: 12.5, borderRadius: 999, padding: '5px 12px' }}>
                                    <BookOpen size={12} /> {c.courses_count} {c.courses_count === 1 ? 'course' : 'courses'}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', margin: '0' }}>Progress</span>
                                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--accent)', margin: '0' }}>{c.progress_percent || 0}%</span>
                                </div>
                                <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${c.progress_percent || 0}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        style={{ height: '100%', background: 'var(--accent)', borderRadius: '999px' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/student/class/${c.id}`); }}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', background: 'var(--accent)', color: '#fffdf7', borderRadius: 12, fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 15, border: 'none', padding: '12px 18px' }}
                            >
                                Enter class <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
