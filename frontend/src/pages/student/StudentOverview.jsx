import { useAuth } from '../../context/AuthContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BookOpen, ArrowRight, LayoutGrid, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentOverview() {
    const { user } = useAuth();
    const { classes } = useOutletContext();
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 24px' }}>
            <div style={{ marginBottom: '44px' }}>
                <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '36px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
                    Welcome back, <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>{user?.student_profile?.first_name}</span>
                </h1>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, margin: '0' }}>Pick up where you left off — select a class to continue.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '48px' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '22px 24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 999 }}>
                        <LayoutGrid size={26} />
                    </div>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>Active classes</p>
                        <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '0', letterSpacing: '-0.02em' }}>{classes?.length || 0}</p>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '22px 24px', borderRadius: 14, display: 'flex', alignItems: 'center', gap: '18px' }}>
                    <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'var(--accent-light)', color: 'var(--accent)', borderRadius: 999 }}>
                        <Zap size={26} />
                    </div>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-tertiary)', margin: '0 0 2px 0' }}>Server status</p>
                        <p style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', margin: '0', letterSpacing: '-0.02em' }}>Online</p>
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>Your workspaces</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', paddingBottom: '80px' }}>
                {classes.map(c => (
                    <div
                        key={c.id}
                        onClick={() => navigate(`/dashboard/student/class/${c.id}`)}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '26px', borderRadius: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '280px', overflow: 'hidden', cursor: 'pointer' }}
                    >
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                                <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0', lineHeight: '1.3', letterSpacing: '-0.015em' }}>{c.name}</h3>
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

                        <div style={{ marginTop: 'auto', paddingTop: '22px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', background: 'var(--accent)', color: '#fffdf7', borderRadius: 12, fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: 15, border: 'none', padding: '13px 18px', boxShadow: '0 2px 8px rgba(62,142,126,0.25)' }}
                            >
                                Enter room <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
