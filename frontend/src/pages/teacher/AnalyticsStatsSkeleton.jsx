export default function AnalyticsStatsSkeleton() {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
            {[1, 2, 3, 4].map(i => (
<div
                    key={i}
                    style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        padding: '24px',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }}
                >
                    <div style={{ height: '16px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '12px', width: '60%' }} />
                    <div style={{ height: '32px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '8px' }} />
                    <div style={{ height: '12px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', width: '40%' }} />
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
