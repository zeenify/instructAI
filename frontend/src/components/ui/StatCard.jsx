import { ArrowRight } from 'lucide-react';

/**
 * Shared stat card for dashboard pages.
 * Pass `value` as a number for a big numeral, or a short string
 * (e.g. "Performance Metrics") to render it as a smaller title line.
 * The circular arrow appears only when the card is clickable (`onClick`).
 */
export default function StatCard({ icon: Icon, tone = 'violet', label, value, caption, onClick }) {
    return (
        <div
            className={`db-card db-stat ${onClick ? 'db-clickable' : ''}`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
            <div className={`db-stat-icon ${tone}`}>
                <Icon size={24} strokeWidth={2.1} />
            </div>
            <div className="db-stat-body">
                <p className="db-stat-label">{label}</p>
                <p className={`db-stat-value ${typeof value === 'string' ? 'is-title' : ''}`}>{value}</p>
                <p className="db-stat-caption">{caption}</p>
            </div>
            {onClick && (
                <div className="db-stat-arrow">
                    <ArrowRight size={16} />
                </div>
            )}
        </div>
    );
}
