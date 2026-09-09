// Plagiarism-style similarity flags for a class activity's coding answers.
// Fetches /teacher/activities/{id}/similarity and lists suspicious pairs —
// a signal for the teacher to review, not proof of cheating.
import { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, Users } from 'lucide-react';
import api from '../../services/api';

export default function SimilarityPanel({ activityId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        // loading starts true from useState — no synchronous setState needed
        api.get(`/teacher/activities/${activityId}/similarity`, { bypassCache: true }).then((res) => {
            if (!mounted) return;
            setData(res.data);
            setLoading(false);
        }).catch(() => {
            if (!mounted) return;
            setError('Could not load similarity analysis');
            setLoading(false);
        });
        return () => { mounted = false; };
    }, [activityId]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                <Loader2 size={16} className="animate-spin" /> Checking for similar submissions...
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ padding: '16px', color: '#ef4444', fontSize: '13px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px' }}>
                {error || 'No data'}
            </div>
        );
    }

    const pairs = data.pairs || [];

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={18} style={{ color: pairs.length > 0 ? C_RED : 'var(--text-tertiary)' }} />
                    Similar submissions
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                    coding answers scored at or above {Math.round((data.threshold || 0.6) * 100)}% token similarity — worth a look, not proof
                </p>
            </div>

            {pairs.length === 0 ? (
                <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Users size={16} style={{ color: '#10b981' }} />
                    No suspicious similarity among {data.submissions_checked || 0} graded submission{data.submissions_checked === 1 ? '' : 's'} across {data.questions_checked || 0} coding question{data.questions_checked === 1 ? '' : 's'}.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pairs.map((pair, i) => (
                        <div key={i} style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {pair.student_a.name} <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>and</span> {pair.student_b.name}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    {pair.question_text}
                                </div>
                            </div>
                            <span style={{
                                padding: '6px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 900,
                                background: pair.similarity >= 0.9 ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                color: pair.similarity >= 0.9 ? '#ef4444' : '#f59e0b',
                                border: `1px solid ${pair.similarity >= 0.9 ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}`,
                            }}>
                                {Math.round(pair.similarity * 100)}% similar
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const C_RED = '#ef4444';
