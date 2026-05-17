export default function QuizScoresSkeleton() {
return (
        <div
            style={{
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                padding: '24px',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[1, 2, 3].map(i => (
                    <div key={i}>
                        <div style={{ height: '14px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', marginBottom: '12px', width: '40%' }} />
                        <div style={{ height: '32px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }} />
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
