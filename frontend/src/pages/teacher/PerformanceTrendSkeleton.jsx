export default function PerformanceTrendSkeleton() {
return (
        <div
            style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '24px',
                height: '350px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        >
            <div style={{ height: '20px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '20px', width: '30%' }} />
            <div style={{ height: '280px', backgroundColor: 'var(--bg-primary)', opacity: 0.5, borderRadius: '4px' }} />
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
