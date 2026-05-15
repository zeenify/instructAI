export default function PerformanceTrendSkeleton() {
    return (
        <div
            style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgb(55, 65, 81)',
                padding: '24px',
                height: '350px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        >
            <div style={{ height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', marginBottom: '20px', width: '30%' }} />
            <div style={{ height: '280px', backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: '4px' }} />
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
