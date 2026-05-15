export default function QuizScoresSkeleton() {
    return (
        <div
            style={{
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '8px',
                border: '1px solid rgb(55, 65, 81)',
                padding: '24px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[1, 2, 3].map(i => (
                    <div key={i}>
                        <div style={{ height: '14px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', marginBottom: '12px', width: '40%' }} />
                        <div style={{ height: '32px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '6px' }} />
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
