export default function StudentProfileSkeleton() {
    const SkeletonBox = ({ width = '100%', height = '20px', style = {} }) => (
        <div
            style={{
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                borderRadius: '4px',
                width,
                height,
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                ...style
            }}
        />
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {/* Header Stats Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
                {[1, 2, 3].map(i => (
                    <div
                        key={i}
                        style={{
                            backgroundColor: 'rgba(30, 41, 59, 0.5)',
                            borderRadius: '8px',
                            padding: '24px',
                            border: '1px solid rgb(55, 65, 81)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}
                    >
                        <SkeletonBox width="40%" height="12px" />
                        <SkeletonBox width="60%" height="28px" />
                        <SkeletonBox width="80%" height="12px" />
                    </div>
                ))}
            </div>

            {/* Modules Skeleton */}
            <div>
                <SkeletonBox width="30%" height="24px" style={{ marginBottom: '24px' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {[1, 2].map(moduleIdx => (
                        <div
                            key={moduleIdx}
                            style={{
                                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                borderRadius: '8px',
                                padding: '24px',
                                border: '1px solid rgb(55, 65, 81)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '20px'
                            }}
                        >
                            <SkeletonBox width="40%" height="20px" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[1, 2, 3].map(itemIdx => (
                                    <div
                                        key={itemIdx}
                                        style={{
                                            backgroundColor: 'rgba(55, 65, 81, 0.3)',
                                            borderRadius: '6px',
                                            padding: '16px',
                                            display: 'flex',
                                            gap: '16px'
                                        }}
                                    >
                                        <SkeletonBox width="20px" height="20px" style={{ flexShrink: 0, borderRadius: '4px' }} />
                                        <div style={{ flex: 1 }}>
                                            <SkeletonBox width="50%" height="14px" style={{ marginBottom: '8px' }} />
                                            <SkeletonBox width="70%" height="12px" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quiz Summary Table Skeleton */}
            <div>
                <SkeletonBox width="30%" height="24px" style={{ marginBottom: '24px' }} />
                <div style={{ borderRadius: '8px', border: '1px solid rgb(55, 65, 81)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', gap: '20px', padding: '16px', backgroundColor: 'rgba(30, 41, 59, 0.7)' }}>
                        <SkeletonBox width="30%" height="12px" />
                        <SkeletonBox width="15%" height="12px" />
                        <SkeletonBox width="15%" height="12px" />
                        <SkeletonBox width="20%" height="12px" />
                    </div>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ display: 'flex', gap: '20px', padding: '16px', borderTop: '1px solid rgb(55, 65, 81)' }}>
                            <SkeletonBox width="30%" height="12px" />
                            <SkeletonBox width="15%" height="12px" />
                            <SkeletonBox width="15%" height="12px" />
                            <SkeletonBox width="20%" height="12px" />
                        </div>
                    ))}
                </div>
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
