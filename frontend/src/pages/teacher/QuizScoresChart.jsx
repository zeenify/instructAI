export default function QuizScoresChart({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No quiz data available</div>;
    }

    return (
        <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgb(55, 65, 81)', padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {data.map((quiz, idx) => {
                    const score = Math.round(quiz.avg_score);
                    let color = '#10b981';
                    let label = 'Excellent';

                    if (score < 60) {
                        color = '#ef4444';
                        label = 'Needs Improvement';
                    } else if (score < 80) {
                        color = '#f59e0b';
                        label = 'Good';
                    }

                    return (
                        <div key={`quiz-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            {/* Quiz name */}
                            <div style={{ minWidth: '200px', maxWidth: '200px' }}>
                                <p style={{ fontSize: '14px', fontWeight: '600', color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {quiz.quiz_name}
                                </p>
                            </div>

                            {/* Bar */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flex: 1, height: '32px', backgroundColor: 'rgba(55, 65, 81, 0.3)', borderRadius: '6px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
                                    <div
                                        style={{
                                            height: '100%',
                                            width: `${score}%`,
                                            backgroundColor: color,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'width 300ms ease-in-out',
                                            minWidth: score > 0 ? '40px' : '0'
                                        }}
                                    >
                                        {score > 10 && (
                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                                                {score}%
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {score <= 10 && (
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: color }}>
                                        {score}%
                                    </span>
                                )}
                            </div>

                            {/* Label and attempts */}
                            <div style={{ minWidth: '140px', textAlign: 'right' }}>
                                <p style={{ fontSize: '12px', fontWeight: '600', color: color, margin: '0 0 4px 0' }}>
                                    {label}
                                </p>
                                <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>
                                    {quiz.attempt_count} attempt{quiz.attempt_count !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgb(55, 65, 81)', display: 'flex', gap: '24px', fontSize: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }} />
                    <span style={{ color: '#94a3b8' }}>80% or higher</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '2px' }} />
                    <span style={{ color: '#94a3b8' }}>60-80%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
                    <span style={{ color: '#94a3b8' }}>Below 60%</span>
                </div>
            </div>
        </div>
    );
}
