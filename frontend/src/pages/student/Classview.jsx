import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ChevronRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ClassView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchClassData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/student/classes/${id}`);
                if (isMounted) {
                    setClassroom(res.data);
                    setLoading(false);
                }
            } catch (err) {
                navigate('/dashboard/student');
            }
        };
        fetchClassData();
        return () => { isMounted = false; };
    }, [id, navigate]);

    if (loading) {
        return (
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', display: 'flex', flexDirection: 'column', gap: '32px', animation: 'pulse 2s infinite' }}>
                <div style={{ height: '280px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '40px' }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '32px' }}>
                    {[1, 2].map(i => <div key={i} style={{ height: '300px', background: 'rgba(34, 211, 238, 0.1)', borderRadius: '40px' }} />)}
                </div>
            </div>
        );
    }

    if (!classroom) return null;

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', color: 'white' }}>
            {/* HEADER */}
            <div style={{ marginBottom: '48px', padding: '40px', borderRadius: '40px', background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, transparent 100%)', border: '1px solid rgba(34, 211, 238, 0.1)', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)' }}>
                <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: '32px' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '40px', fontWeight: 900, color: 'white', margin: '0 0 16px 0', lineHeight: '1.2', letterSpacing: '-0.02em' }}>{classroom.name}</h1>
                        <p style={{ fontSize: '16px', color: '#94a3b8', lineHeight: '1.6', margin: '0', maxWidth: '600px' }}>{classroom.description || "Welcome to your digital classroom."}</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(0, 0, 0, 0.4)', padding: '16px 20px', borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)', minWidth: '200px' }}>
                        {(() => {
                            const avatar = classroom.teacher?.avatar;
                            const hasValidAvatar = avatar && avatar.trim() !== "" && avatar !== "null";

                            if (hasValidAvatar) {
                                return (
                                    <img
                                        src={avatar}
                                        style={{ width: '56px', height: '56px', borderRadius: '16px', border: '1.5px solid rgba(34, 211, 238, 0.3)', objectFit: 'cover', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)', flexShrink: 0 }}
                                        alt="Instructor"
                                    />
                                );
                            } else {
                                return (
                                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, #06b6d4, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#02010a', fontWeight: 900, fontSize: '20px', boxShadow: '0 8px 16px rgba(0, 0, 0, 0.3)', border: '1.5px solid rgba(34, 211, 238, 0.2)', flexShrink: 0 }}>
                                        {classroom.teacher?.teacher_profile?.first_name?.charAt(0) || 'T'}
                                        {classroom.teacher?.teacher_profile?.last_name?.charAt(0) || ''}
                                    </div>
                                );
                            }
                        })()}

                        <div>
                            <p style={{ fontSize: '10px', fontWeight: 900, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 4px 0' }}>Lead Instructor</p>
                            <p style={{ fontSize: '16px', fontWeight: 900, color: 'white', margin: '0', letterSpacing: '-0.02em', lineHeight: '1.2' }}>
                                {classroom.teacher?.teacher_profile?.first_name} {classroom.teacher?.teacher_profile?.last_name}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION TITLE */}
            <h2 style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: '#64748b', marginBottom: '32px', margin: '0 0 32px 0' }}>Published Curriculum</h2>

            {/* COURSES GRID */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '32px', paddingBottom: '80px' }}>
                {classroom.courses?.map(course => (
                    <div key={course.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '28px', borderRadius: '40px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', position: 'relative', overflow: 'hidden', transition: 'all 0.3s', cursor: 'pointer' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
                                <h3 style={{ fontSize: '28px', fontWeight: 700, color: 'white', margin: '0', lineHeight: '1.3', letterSpacing: '-0.02em' }}>{course.title}</h3>
                                <div style={{ fontSize: '10px', fontWeight: 900, color: '#22d3ee', background: 'rgba(34, 211, 238, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(34, 211, 238, 0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                    {course.progress_percent || 0}% Done
                                </div>
                            </div>
                            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '24px', margin: '0 0 24px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {course.description || "Master these concepts with interactive logic tasks."}
                            </p>
                        </div>

                        {/* PROGRESS SECTION */}
                        <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b', margin: '0' }}>Progress</span>
                                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#22d3ee', margin: '0' }}>{course.progress_percent || 0}%</span>
                                </div>
                                <div style={{ height: '6px', width: '100%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${course.progress_percent || 0}%` }}
                                        transition={{ duration: 1, ease: "easeOut" }}
                                        style={{ height: '100%', background: 'linear-gradient(90deg, #06b6d4, #22d3ee)', boxShadow: '0 0 15px rgba(34, 211, 238, 0.4)' }}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={() => navigate(`/dashboard/student/course/${course.id}`)}
                                style={{ width: '100%', padding: '16px 20px', borderRadius: '20px', background: 'white', color: 'black', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: 'all 0.3s', border: 'none', cursor: 'pointer' }}
                            >
                                Launch Course <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
