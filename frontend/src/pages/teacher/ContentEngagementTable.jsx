export default function ContentEngagementTable({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No engagement data available</div>;
    }

    return (
        <div style={{ borderRadius: '8px', border: '1px solid rgb(55, 65, 81)', overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgb(55, 65, 81)' }}>
                        <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Lesson Name</th>
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Attempts</th>
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Completions</th>
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', color: '#94a3b8' }}>Completion Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((item, idx) => {
                        const completionRate = item.completion_rate;
                        let rateColor = '#4ade80';
                        if (completionRate < 50) rateColor = '#ef4444';
                        else if (completionRate < 70) rateColor = '#f59e0b';
                        else if (completionRate < 90) rateColor = '#3b82f6';

                        return (
                            <tr
                                key={idx}
                                style={{ borderBottom: '1px solid rgb(55, 65, 81)', transition: 'background-color 300ms' }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.3)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                <td style={{ padding: '16px 20px', color: '#f1f5f9', fontWeight: '500' }}>
                                    {item.lesson_name}
                                </td>
                                <td style={{ textAlign: 'center', padding: '16px 20px', color: '#94a3b8' }}>
                                    {item.attempts}
                                </td>
                                <td style={{ textAlign: 'center', padding: '16px 20px', color: '#94a3b8' }}>
                                    {item.completion_count}
                                </td>
                                <td style={{ textAlign: 'center', padding: '16px 20px' }}>
                                    <span
                                        style={{
                                            display: 'inline-block',
                                            padding: '4px 12px',
                                            borderRadius: '999px',
                                            fontWeight: '500',
                                            fontSize: '13px',
                                            backgroundColor: rateColor + '20',
                                            color: rateColor
                                        }}
                                    >
                                        {item.completion_rate}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
