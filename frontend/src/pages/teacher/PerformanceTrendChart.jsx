export default function PerformanceTrendChart({ data }) {
    if (!data || data.length === 0) {
        return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>No data available</div>;
    }

    const maxPercentage = Math.max(...data.map(d => d.completion_percentage), 100);
    const chartHeight = 250;
    const chartWidth = Math.max(800, data.length * 60);
    const padding = 40;

    const points = data.map((item, idx) => {
        const x = (idx / (data.length - 1 || 1)) * (chartWidth - 2 * padding) + padding;
        const y = chartHeight - (item.completion_percentage / maxPercentage) * (chartHeight - 2 * padding);
        return { x, y, ...item };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
        <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', border: '1px solid rgb(55, 65, 81)', padding: '24px', overflowX: 'auto' }}>
            <svg width={chartWidth} height={chartHeight + 80} style={{ minWidth: '100%' }}>
                {/* Y-axis line */}
                <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />

                {/* X-axis line */}
                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="rgba(148, 163, 184, 0.3)" strokeWidth="1" />

                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((val) => {
                    const yPos = chartHeight - padding - (val / maxPercentage) * (chartHeight - 2 * padding);
                    return (
                        <g key={`grid-${val}`}>
                            <line x1={padding - 5} y1={yPos} x2={chartWidth - padding} y2={yPos} stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1" strokeDasharray="4" />
                            <text x={padding - 15} y={yPos + 4} fontSize="11" fill="#94a3b8" textAnchor="end">
                                {val}%
                            </text>
                        </g>
                    );
                })}

                {/* Line */}
                <path d={pathD} fill="none" stroke="#10b981" strokeWidth="2" />

                {/* Points */}
                {points.map((p, idx) => (
                    <g key={`point-${idx}`}>
                        <circle cx={p.x} cy={p.y} r="5" fill="#10b981" />
                        <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="#10b981" strokeWidth="1" opacity="0.3" />
                    </g>
                ))}

                {/* X-axis labels */}
                {points.map((p, idx) => {
                    if (idx % Math.ceil(data.length / 5) === 0 || idx === data.length - 1) {
                        const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
                        return (
                            <text key={`label-${idx}`} x={p.x} y={chartHeight - padding + 25} fontSize="11" fill="#94a3b8" textAnchor="middle">
                                {dateStr}
                            </text>
                        );
                    }
                    return null;
                })}
            </svg>

            {/* Legend */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgb(55, 65, 81)', fontSize: '12px', color: '#94a3b8' }}>
                <p style={{ margin: '0 0 8px 0' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px', marginRight: '8px', verticalAlign: 'middle' }} />
                    Cumulative completion rate over time
                </p>
            </div>
        </div>
    );
}
