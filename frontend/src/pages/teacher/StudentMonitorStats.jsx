import { TrendingUp, Target, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function StudentMonitorStats({ stats }) {
    if (!stats) return null;

    const CircularProgress = ({ percentage, color, size = 120 }) => {
        const radius = size / 2 - 8;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(55, 65, 81, 0.5)"
                    strokeWidth="6"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 300ms ease-in-out' }}
                />
                <text
                    x={size / 2}
                    y={size / 2}
                    textAnchor="middle"
                    dy="0.3em"
                    style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        fill: color,
                        transform: 'rotate(90deg)',
                        transformOrigin: `${size / 2}px ${size / 2}px`
                    }}
                >
                    {percentage}%
                </text>
            </svg>
        );
    };

    const GaugeChart = ({ value, max, color, size = 120 }) => {
        const percentage = (value / max) * 100;
        const radius = size / 2 - 8;
        const circumference = Math.PI * radius;
        const strokeDashoffset = circumference - (percentage / 100) * circumference;

        return (
            <svg width={size} height={size / 2 + 16} viewBox={`0 0 ${size} ${size / 2 + 16}`} style={{ overflow: 'visible' }}>
                <path
                    d={`M 8 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
                    fill="none"
                    stroke="rgba(55, 65, 81, 0.5)"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                <path
                    d={`M 8 ${size / 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{ transition: 'stroke-dashoffset 300ms ease-in-out' }}
                />
                <text
                    x={size / 2}
                    y={size / 2 + 20}
                    textAnchor="middle"
                    style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        fill: color
                    }}
                >
                    {value}%
                </text>
            </svg>
        );
    };

    const HorizontalBar = ({ value, total, color }) => {
        const percentage = (value / total) * 100;
        return (
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: color }}>{value} students</span>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>{Math.round(percentage)}%</span>
                </div>
                <div
                    style={{
                        width: '100%',
                        height: '12px',
                        backgroundColor: 'rgba(55, 65, 81, 0.5)',
                        borderRadius: '999px',
                        overflow: 'hidden'
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${percentage}%`,
                            backgroundColor: color,
                            transition: 'width 300ms ease-in-out',
                            borderRadius: '999px'
                        }}
                    />
                </div>
            </div>
        );
    };

    const CounterWithBadges = ({ value, total, color }) => {
        const percentage = (value / total) * 100;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                        style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '12px',
                            backgroundColor: color + '15',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `2px solid ${color}50`
                        }}
                    >
                        <span style={{ fontSize: '36px', fontWeight: '700', color: color }}>
                            {value}
                        </span>
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                        out of <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{total}</span>
                    </p>
                    <p style={{ fontSize: '12px', color: color, fontWeight: '600', margin: '4px 0 0 0' }}>
                        {Math.round(percentage)}% of class
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* Class Completion - Circular Progress */}
            <div
                style={{
                    borderRadius: '8px',
                    border: '1px solid rgb(55, 65, 81)',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                <div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', margin: 0 }}>
                        Class Completion
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress percentage={stats.completion_percentage} color="#4ade80" />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0 }}>
                        <span style={{ fontWeight: '600', color: '#4ade80' }}>{stats.completed_count}</span> of {stats.total_enrolled} students completed
                    </p>
                </div>
            </div>

            {/* Average Quiz Score - Gauge */}
            <div
                style={{
                    borderRadius: '8px',
                    border: '1px solid rgb(55, 65, 81)',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                <div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', margin: 0 }}>
                        Average Quiz Score
                    </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <GaugeChart value={stats.average_quiz_score} max={100} color="#60a5fa" />
                </div>
                <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    {stats.average_quiz_score >= 80 && (
                        <span style={{ fontSize: '12px', color: '#4ade80', fontWeight: '500' }}>Excellent performance</span>
                    )}
                    {stats.average_quiz_score >= 60 && stats.average_quiz_score < 80 && (
                        <span style={{ fontSize: '12px', color: '#fbbf24', fontWeight: '500' }}>Good progress</span>
                    )}
                    {stats.average_quiz_score < 60 && (
                        <span style={{ fontSize: '12px', color: '#f87171', fontWeight: '500' }}>Needs improvement</span>
                    )}
                </div>
            </div>

            {/* Not Started - Horizontal Bar */}
            <div
                style={{
                    borderRadius: '8px',
                    border: '1px solid rgb(55, 65, 81)',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}
            >
                <div>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                        Not Started
                    </p>
                </div>
                <HorizontalBar value={stats.not_started_count} total={stats.total_enrolled} color="#f87171" />
            </div>

            {/* Need Attention - Counter Badge */}
            <div
                style={{
                    borderRadius: '8px',
                    border: '1px solid rgb(55, 65, 81)',
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <div style={{ width: '100%' }}>
                    <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                        Need Attention
                    </p>
                </div>
                <CounterWithBadges value={stats.stuck_count} total={stats.total_enrolled} color="#fbbf24" />
            </div>
        </div>
    );
}
