import { CheckCircle2, Clock, Lock, AlertCircle, BarChart3 } from 'lucide-react';

export default function StudentProfileDetail({ profile, activeTab = 'progress' }) {
    if (!profile) return null;

    const { student, modules, quiz_summary } = profile;

    const getStatusInfo = (status) => {
        const statuses = {
            'completed': { icon: CheckCircle2, label: 'Completed', color: '#4ade80' },
            'in_progress': { icon: Clock, label: 'In Progress', color: '#60a5fa' },
            'not_started': { icon: Lock, label: 'Not Started', color: '#94a3b8' }
        };
        return statuses[status] || statuses['not_started'];
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        try {
            return new Date(date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    };

    const getQuizScoreColor = (percentage) => {
        if (percentage >= 80) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#4ade80' };
        if (percentage >= 70) return { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa' };
        if (percentage >= 60) return { bg: 'rgba(245, 158, 11, 0.1)', text: '#fbbf24' };
        return { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171' };
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* Header Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '24px', border: '1px solid rgb(55, 65, 81)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Progress</p>
                        <BarChart3 size={18} style={{ color: '#4ade80' }} />
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: '700', color: '#4ade80' }}>{student.completion_percentage}%</div>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '12px' }}>{student.items_completed}/{student.total_items} items completed</p>
                </div>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '24px', border: '1px solid rgb(55, 65, 81)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Student Name</p>
                        <CheckCircle2 size={18} style={{ color: '#60a5fa' }} />
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.name}</div>
                </div>

                <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '24px', border: '1px solid rgb(55, 65, 81)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>Last Active</p>
                        <Clock size={18} style={{ color: '#60a5fa' }} />
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#f1f5f9' }}>
                        {student.last_active ? formatDate(student.last_active) : 'Never'}
                    </div>
                </div>
            </div>

            {/* Module Timeline - Only show in Progress Tab */}
            {activeTab === 'progress' && <div>
                <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', marginBottom: '24px' }}>Course Progress</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {modules.map((module, moduleIdx) => (
                        <div
                            key={module.id}
                            style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '24px', border: '1px solid rgb(55, 65, 81)' }}
                        >
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#f1f5f9', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#4ade80', fontSize: '14px', fontWeight: '700' }}>
                                    {moduleIdx + 1}
                                </span>
                                {module.name}
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Lessons */}
                                {module.lessons.map((lesson) => {
                                    const statusInfo = getStatusInfo(lesson.status);
                                    const StatusIcon = statusInfo.icon;

                                    return (
                                        <div
                                            key={`lesson-${lesson.id}`}
                                            style={{
                                                backgroundColor: 'rgba(55, 65, 81, 0.3)',
                                                borderRadius: '6px',
                                                padding: '16px',
                                                border: '1px solid rgb(55, 65, 81)',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '16px'
                                            }}
                                        >
                                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(55, 65, 81, 0.5)', flexShrink: 0 }}>
                                                <StatusIcon size={16} style={{ color: statusInfo.color }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontWeight: '500', color: '#f1f5f9', fontSize: '14px', margin: 0 }}>{lesson.name}</p>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                                                    {lesson.status === 'completed' && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <CheckCircle2 size={12} style={{ color: '#4ade80' }} />
                                                            {formatDate(lesson.completed_at)}
                                                        </span>
                                                    )}
                                                    {lesson.code_attempts > 0 && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <BarChart3 size={12} />
                                                            {lesson.code_attempts} code attempt{lesson.code_attempts !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {lesson.is_stuck && (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fbbf24' }}>
                                                            <AlertCircle size={12} />
                                                            Stuck
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Quizzes */}
                                {module.quizzes.map((quiz) => {
                                    const statusInfo = getStatusInfo(quiz.status);
                                    const StatusIcon = statusInfo.icon;

                                    return (
                                        <div
                                            key={`quiz-${quiz.id}`}
                                            style={{
                                                backgroundColor: 'rgba(55, 65, 81, 0.3)',
                                                borderRadius: '6px',
                                                padding: '16px',
                                                border: '1px solid rgb(55, 65, 81)',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '16px'
                                            }}
                                        >
                                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'rgba(55, 65, 81, 0.5)', flexShrink: 0 }}>
                                                <StatusIcon size={16} style={{ color: statusInfo.color }} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontWeight: '500', color: '#f1f5f9', fontSize: '14px', margin: 0 }}>{quiz.name}</p>
                                                {quiz.status === 'completed' && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                                                        <span>Score: {quiz.score}/{quiz.max_score}</span>
                                                        <span>•</span>
                                                        <span style={{ fontWeight: '500', color: quiz.score >= quiz.max_score * 0.7 ? '#4ade80' : '#fbbf24' }}>
                                                            {Math.round((quiz.score / quiz.max_score) * 100)}%
                                                        </span>
                                                        <span>•</span>
                                                        <span>{quiz.attempts} attempt{quiz.attempts !== 1 ? 's' : ''}</span>
                                                        <span>•</span>
                                                        <span>{formatDate(quiz.last_attempt)}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            }

            {/* Quiz Summary Table - Only show in Quizzes Tab */}
            {activeTab === 'quizzes' && quiz_summary.length > 0 && (
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', marginBottom: '24px' }}>Quiz Summary</h2>

                    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid rgb(55, 65, 81)' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgb(55, 65, 81)' }}>
                                    <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Quiz Name</th>
                                    <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Score</th>
                                    <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Percentage</th>
                                    <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Attempts</th>
                                    <th style={{ textAlign: 'right', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Last Taken</th>
                                </tr>
                            </thead>
                            <tbody>
                                {quiz_summary.map((quiz) => {
                                    const scoreColor = getQuizScoreColor(quiz.percentage);
                                    return (
                                        <tr
                                            key={quiz.quiz_id}
                                            style={{ borderBottom: '1px solid rgb(55, 65, 81)', transition: 'background-color 300ms' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                            <td style={{ padding: '16px 20px', color: '#f1f5f9', fontWeight: '500' }}>{quiz.name}</td>
                                            <td style={{ textAlign: 'center', padding: '16px 20px', color: '#94a3b8' }}>
                                                {quiz.score !== null ? `${quiz.score}/${quiz.max_score}` : '—'}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '16px 20px' }}>
                                                {quiz.percentage !== null ? (
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '4px 12px',
                                                        borderRadius: '999px',
                                                        fontWeight: '500',
                                                        fontSize: '13px',
                                                        backgroundColor: scoreColor.bg,
                                                        color: scoreColor.text
                                                    }}>
                                                        {quiz.percentage}%
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#64748b' }}>—</span>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'center', padding: '16px 20px', color: '#94a3b8' }}>
                                                {quiz.attempts}
                                            </td>
                                            <td style={{ textAlign: 'right', padding: '16px 20px', color: '#64748b', fontSize: '12px' }}>
                                                {quiz.last_attempt ? formatDate(quiz.last_attempt) : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty state for Quiz Summary tab */}
            {activeTab === 'quizzes' && quiz_summary.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 24px', backgroundColor: 'rgba(30, 41, 59, 0.3)', borderRadius: '8px', border: '1px solid rgb(55, 65, 81)' }}>
                    <p style={{ fontSize: '16px', color: '#94a3b8', margin: 0 }}>No quiz attempts yet</p>
                </div>
            )}
        </div>
    );
}
