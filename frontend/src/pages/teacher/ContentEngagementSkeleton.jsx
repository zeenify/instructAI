export default function ContentEngagementSkeleton() {
    return (
        <div
            style={{
                borderRadius: '8px',
                border: '1px solid rgb(55, 65, 81)',
                overflow: 'hidden',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        >
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ backgroundColor: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgb(55, 65, 81)' }}>
                        <th style={{ textAlign: 'left', padding: '16px 20px', fontWeight: '600', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)' }} />
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)' }} />
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)' }} />
                        <th style={{ textAlign: 'center', padding: '16px 20px', fontWeight: '600', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)' }} />
                    </tr>
                </thead>
                <tbody>
                    {[1, 2, 3, 4, 5].map(i => (
                        <tr key={i} style={{ borderBottom: '1px solid rgb(55, 65, 81)' }}>
                            <td style={{ padding: '16px 20px', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.1)' }} />
                            <td style={{ padding: '16px 20px', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.1)' }} />
                            <td style={{ padding: '16px 20px', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.1)' }} />
                            <td style={{ padding: '16px 20px', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.1)' }} />
                        </tr>
                    ))}
                </tbody>
            </table>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
