import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Clock, CheckCircle2, ChevronRight } from 'lucide-react';

export default function StudentMonitorList({ students, onStudentClick, loadingProfile, selectedStudentId }) {
    const getProgressColor = (percentage) => {
        if (percentage >= 80) return { bg: '#10b981', text: '#4ade80' };
        if (percentage >= 60) return { bg: '#3b82f6', text: '#60a5fa' };
        if (percentage >= 40) return { bg: '#f59e0b', text: '#fbbf24' };
        return { bg: '#ef4444', text: '#f87171' };
    };

    const getFlagInfo = (flag) => {
        const flags = {
            'not_started': { icon: AlertCircle, label: 'Not Started', bgColor: '#f87171' },
            'stuck': { icon: Clock, label: 'Stuck', bgColor: '#fbbf24' },
            'failed_quiz_twice': { icon: AlertCircle, label: 'Failed Quiz 2x', bgColor: '#fb923c' }
        };
        return flags[flag];
    };

    const formatLastActive = (date) => {
        if (!date) return 'Never';
        try {
            return formatDistanceToNow(new Date(date), { addSuffix: true });
        } catch {
            return 'Unknown';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {console.log('Rendering students:', students)}
            {students.map((student) => {
                console.log('Student item:', student);
                const progressColor = getProgressColor(student.completion_percentage);

                return (
                    <div
                        key={student.id}
                        onClick={() => onStudentClick(student)}
                        style={{
                            position: 'relative',
                            backgroundColor: selectedStudentId === student.id
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'rgba(30, 41, 59, 0.6)',
                            borderRadius: '8px',
                            padding: '16px 20px',
                            border: selectedStudentId === student.id
                                ? '1px solid rgba(16, 185, 129, 0.8)'
                                : '1px solid rgb(55, 65, 81)',
                            cursor: 'pointer',
                            transition: 'all 300ms ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            opacity: loadingProfile && selectedStudentId === student.id ? 0.6 : 1
                        }}
                        onMouseEnter={(e) => {
                            if (selectedStudentId !== student.id) {
                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.8)';
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedStudentId !== student.id) {
                                e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                                e.currentTarget.style.borderColor = 'rgb(55, 65, 81)';
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyPress={(e) => e.key === 'Enter' && onStudentClick(student)}
                    >
                        {/* Status Indicator */}
                        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {student.flags.length > 0 ? (
                                student.flags.slice(0, 2).map((flag) => {
                                    const flagInfo = getFlagInfo(flag);
                                    const FlagIcon = flagInfo?.icon;
                                    return (
                                        <div
                                            key={flag}
                                            style={{
                                                padding: '6px',
                                                borderRadius: '6px',
                                                backgroundColor: flagInfo?.bgColor + '20'
                                            }}
                                            title={flagInfo?.label}
                                        >
                                            <FlagIcon size={16} style={{ color: flagInfo?.bgColor }} />
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                                    <CheckCircle2 size={16} style={{ color: '#4ade80' }} />
                                </div>
                            )}
                        </div>

                        {/* Student Info + Progress */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {/* Top row: Name and percentage */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <p style={{ fontWeight: '600', color: 'white', fontSize: '16px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                    {student.name}
                                </p>
                                <span style={{ fontSize: '16px', fontWeight: '700', color: progressColor.text, flexShrink: 0 }}>
                                    {student.completion_percentage}%
                                </span>
                            </div>

                            {/* Bottom row: Last active and progress bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                                    Last active {formatLastActive(student.last_active)}
                                </p>
                                <div style={{ width: '100px', position: 'relative', height: '6px', backgroundColor: 'rgba(55, 65, 81, 0.5)', borderRadius: '999px', overflow: 'hidden', flexShrink: 0 }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            backgroundColor: progressColor.bg,
                                            width: `${Math.min(100, student.completion_percentage)}%`,
                                            transition: 'width 500ms ease-in-out',
                                            borderRadius: '999px'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Chevron */}
                        <ChevronRight size={20} style={{ color: '#94a3b8', flexShrink: 0, transition: 'color 300ms' }} />
                    </div>
                );
            })}
        </div>
    );
}
