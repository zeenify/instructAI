/**
 * Skeleton loaders for page-level content — the standard loading state for
 * every redesigned page. Rule: skeletons for page/section loads, circle
 * spinners only for small inline actions (buttons, chips). Shimmer color is
 * theme-aware via --db-shimmer (see dashboard.css).
 */

export function SkeletonBlock({ style }) {
    return <div className="db-skeleton" style={style} />;
}

/** Matches StatCard's layout: circular icon chip + label/value/caption lines. */
export function StatCardSkeleton() {
    return (
        <div className="db-card db-stat">
            <SkeletonBlock style={{ width: 56, height: 56, borderRadius: '50%', flex: 'none' }} />
            <div className="db-stat-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <SkeletonBlock style={{ width: '55%', height: 11 }} />
                <SkeletonBlock style={{ width: '35%', height: 30 }} />
                <SkeletonBlock style={{ width: '70%', height: 11 }} />
            </div>
        </div>
    );
}

/** Matches ClassCard's layout: color band, avatar+name, code row, stats strip, footer. */
export function ClassCardSkeleton() {
    return (
        <div className="db-card db-class-card">
            <SkeletonBlock style={{ height: 84, borderRadius: 0, flex: 'none' }} />
            <div className="db-class-body">
                <div className="db-class-toprow">
                    <div className="db-class-name-wrap">
                        <SkeletonBlock style={{ width: 46, height: 46, borderRadius: 14, flex: 'none' }} />
                        <SkeletonBlock style={{ width: '60%', height: 18 }} />
                    </div>
                </div>
                <SkeletonBlock style={{ width: '45%', height: 26, marginBottom: 18 }} />
                <div className="db-class-stats">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="db-class-stat" style={{ justifyContent: 'center' }}>
                            <SkeletonBlock style={{ width: 30, height: 30, borderRadius: 10, flex: 'none' }} />
                            <SkeletonBlock style={{ width: 52, height: 12 }} />
                        </div>
                    ))}
                </div>
                <div className="db-class-footer" style={{ paddingTop: 14 }}>
                    <SkeletonBlock style={{ width: '40%', height: 12 }} />
                    <SkeletonBlock style={{ width: 34, height: 34, borderRadius: '50%', flex: 'none' }} />
                </div>
            </div>
        </div>
    );
}
