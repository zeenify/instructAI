import { Users, BookOpen, TrendingUp, Zap } from 'lucide-react';

export default function AnalyticsStats({ stats }) {
    if (!stats) return null;

    const statBoxes = [
        {
            label: 'Total Students',
            value: stats.total_students,
            icon: Users,
            color: '#10b981',
            bgColor: 'rgba(16, 185, 129, 0.1)',
            borderColor: 'rgba(16, 185, 129, 0.3)'
        },
        {
            label: 'Total Content',
            value: stats.total_items,
            icon: BookOpen,
            color: '#06b6d4',
            bgColor: 'rgba(6, 182, 212, 0.1)',
            borderColor: 'rgba(6, 182, 212, 0.3)'
        },
        {
            label: 'Avg Completion',
            value: `${stats.avg_completion}%`,
            icon: TrendingUp,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
            borderColor: 'rgba(245, 158, 11, 0.3)'
        },
        {
            label: 'Avg Quiz Score',
            value: `${stats.avg_quiz_score}%`,
            icon: Zap,
            color: '#8b5cf6',
            bgColor: 'rgba(139, 92, 246, 0.1)',
            borderColor: 'rgba(139, 92, 246, 0.3)'
        }
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {statBoxes.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                    <div
                        key={idx}
                        style={{
                            backgroundColor: stat.bgColor,
                            borderRadius: '10px',
                            border: `1px solid ${stat.borderColor}`,
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            transition: 'all 200ms ease-in-out',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = stat.bgColor.replace('0.1', '0.15');
                            e.currentTarget.style.borderColor = stat.borderColor.replace('0.3', '0.5');
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = stat.bgColor;
                            e.currentTarget.style.borderColor = stat.borderColor;
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                                {stat.label}
                            </p>
                            <div style={{ padding: '8px', borderRadius: '6px', backgroundColor: stat.color + '20' }}>
                                <Icon style={{ width: '16px', height: '16px', color: stat.color }} />
                            </div>
                        </div>
                        <div>
                            <span style={{ fontSize: '32px', fontWeight: '700', color: stat.color }}>
                                {stat.value}
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
