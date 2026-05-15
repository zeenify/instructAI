export default function StudentMonitorListSkeleton() {
    const SkeletonLine = ({ width = '100%', height = '12px' }) => (
        <div
            style={{
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                borderRadius: '4px',
                width,
                height,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
        />
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3, 4, 5].map(i => (
                <div
                    key={i}
                    style={{
                        position: 'relative',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)',
                        borderRadius: '8px',
                        padding: '16px 20px',
                        border: '1px solid rgb(55, 65, 81)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }}
                >
                    {/* Status Indicator */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div
                            style={{
                                padding: '6px',
                                borderRadius: '6px',
                                width: '28px',
                                height: '28px',
                                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }}
                        />
                    </div>

                    {/* Student Info + Progress */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Top row: Name and percentage */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <SkeletonLine width="40%" />
                            <SkeletonLine width="15%" />
                        </div>

                        {/* Bottom row: Last active and progress bar */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <SkeletonLine width="25%" />
                            <div style={{ width: '100px', height: '6px', backgroundColor: 'rgba(55, 65, 81, 0.5)', borderRadius: '999px', flexShrink: 0, animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }} />
                        </div>
                    </div>

                    {/* Chevron */}
                    <div
                        style={{
                            width: '20px',
                            height: '20px',
                            flexShrink: 0,
                            backgroundColor: 'rgba(55, 65, 81, 0.5)',
                            borderRadius: '4px',
                            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                        }}
                    />
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
