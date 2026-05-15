export default function AnalyticsStatsSkeleton() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
            {[1, 2, 3, 4].map(i => (
                <div
                    key={i}
                    style={{
                        backgroundColor: 'rgba(30, 41, 59, 0.5)',
                        borderRadius: '8px',
                        border: '1px solid rgb(55, 65, 81)',
                        padding: '24px',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }}
                >
                    <div style={{ height: '16px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', marginBottom: '12px', width: '60%' }} />
                    <div style={{ height: '32px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', marginBottom: '8px' }} />
                    <div style={{ height: '12px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '40%' }} />
                </div>
            ))}
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
