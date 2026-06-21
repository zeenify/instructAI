import { useAuth } from '../../context/AuthContext';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { BookOpen, Award, ArrowRight, LayoutGrid, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentOverview() {
    const { user } = useAuth();
    const { classes } = useOutletContext();
    const navigate = useNavigate();

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
            <div style={{ marginBottom: '48px' }}>
                <h1 style={{ fontSize: '40px', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>
                    Welcome back, <span style={{ color: 'var(--accent)' }}>{user?.student_profile?.first_name}</span>
                </h1>
                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500, letterSpacing: '0.05em', margin: '0' }}>Select a workspace to continue your curriculum.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '48px' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '20px', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                        <LayoutGrid size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0 0 4px 0' }}>Active Classes</p>
                        <p style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: '0' }}>{classes?.length || 0}</p>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '20px', boxShadow: 'var(--card-shadow)' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                        <Zap size={28} />
                    </div>
                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0 0 4px 0' }}>Server Status</p>
                        <p style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-primary)', margin: '0' }}>Online</p>
                    </div>
                </div>
            </div>

            <h2 style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'var(--text-tertiary)', margin: '0 0 32px 0' }}>Your Workspaces</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px', paddingBottom: '80px' }}>
                {classes.map(c => (
                    <div key={c.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '28px', borderRadius: '32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '300px', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', cursor: 'pointer', boxShadow: 'var(--card-shadow)' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: '0', lineHeight: '1.3', letterSpacing: '-0.02em' }}>{c.name}</h3>
                                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0 0' }}>
                                        {c.teacher?.teacher_profile?.first_name} {c.teacher?.teacher_profile?.last_name}
                                    </p>
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                    {c.courses_count} CURRICULUM
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', margin: '0' }}>Workspace Progress</span>
                                    <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--accent)', margin: '0' }}>{c.progress_percent || 0}%</span>
                                </div>
                                <div style={{ height: '6px', width: '100%', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${c.progress_percent || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), #06b6d4)', boxShadow: '0 0 10px var(--accent-glow)' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/dashboard/student/class/${c.id}`)}
                                style={{ width: '100%', padding: '16px 20px', borderRadius: '12px', background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s', border: '1px solid var(--accent-glow)', cursor: 'pointer' }}
                                onMouseEnter={(e) => {
                                    e.target.style.background = 'var(--accent)';
                                    e.target.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.target.style.background = 'var(--accent-light)';
                                    e.target.style.color = 'var(--accent)';
                                }}
                            >
                                Enter Room <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
