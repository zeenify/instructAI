import { Users, BookOpen, BarChart3, Target } from 'lucide-react';

export default function AnalyticsStats({ stats }) {
    if (!stats) return null;

    const statBoxes = [
        {
            label: 'Total Students',
            value: stats.total_students,
            icon: Users,
            color: '#10b981'
        },
        {
            label: 'Course Items',
            value: stats.total_items,
            icon: BookOpen,
            color: '#60a5fa'
        },
        {
            label: 'Avg Completion',
            value: stats.avg_completion,
            unit: '%',
            icon: BarChart3,
            color: '#f59e0b'
        },
        {
            label: 'Avg Quiz Score',
            value: stats.avg_quiz_score,
            unit: '%',
            icon: Target,
            color: '#8b5cf6'
        }
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {statBoxes.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={idx}
                        style={{
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: '8px',
                            border: '1px solid rgb(55, 65, 81)',
                            padding: '20px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px', margin: 0 }}>
                                {stat.label}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                                <span style={{ fontSize: '28px', fontWeight: '700', color: stat.color }}>
                                    {stat.value}
                                </span>
                                {stat.unit && (
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: stat.color }}>
                                        {stat.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: stat.color + '15', flexShrink: 0 }}>
                            <Icon style={{ width: '18px', height: '18px', color: stat.color }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
