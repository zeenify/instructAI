import { useMemo } from 'react';
import { FileText, HelpCircle, BookOpen, Loader2, TrendingUp } from 'lucide-react';

const typeIcons = { quiz: HelpCircle, file: FileText, questions: HelpCircle, material: BookOpen };

function scoreColor(score, maxScore) {
  if (score === null || maxScore === null || maxScore === 0) return 'var(--text-tertiary)';
  const pct = score / maxScore;
  if (pct >= 0.8) return '#10b981';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

export default function GradebookTable({ data, loading, onActivityClick }) {

  const activities = useMemo(() => (data?.activities || []).filter(a => a.submission_type !== 'material'), [data]);

  const summary = useMemo(() => {
    if (!data) return null;
  const { students, grades } = data;
    return students.map((s) => {
      let totalScore = 0;
      let totalMax = 0;
      let graded = 0;
      const n = activities.length;
      activities.forEach((a) => {
        const g = grades[s.id]?.[a.id];
        if (g?.status === 'graded' && g?.score !== null) {
          totalScore += Number(g.score);
          totalMax += Number(g.max_score ?? a.max_points ?? 0);
          graded++;
        } else if (g?.status === 'submitted' || g?.status === 'graded') {
          totalMax += Number(g.max_score ?? a.max_points ?? 0);
        } else {
          totalMax += Number(a.max_points ?? 0);
        }
      });
      return { student: s, totalScore, totalMax, graded, total: n, pct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0 };
    });
  }, [data, activities]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
        <Loader2 className="animate-spin" size={28} color="var(--text-tertiary)" />
      </div>
    );
  }

  if (!data || !activities.length) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 24px', borderRadius: '24px', border: '1px dashed var(--border-color)', background: 'var(--bg-secondary)' }}>
        <TrendingUp size={48} color="var(--text-tertiary)" style={{ opacity: 0.4, marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>No grade data yet</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0 }}>Publish activities and wait for student submissions.</p>
      </div>
    );
  }

  const { grades } = data;

  return (
    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '600px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-primary)' }}>
            <th style={{ textAlign: 'left', padding: '14px 16px', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-color)', position: 'sticky', left: 0, background: 'var(--bg-primary)', zIndex: 1 }}>
              Student
            </th>
            {activities.map((a) => {
              const Icon = typeIcons[a.submission_type] || typeIcons[a.activity_type] || HelpCircle;
              return (
                <th key={a.id} style={{ textAlign: 'center', padding: '14px 12px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap', cursor: 'pointer' }}
                  onClick={() => onActivityClick?.(a.id)}
                  title={a.title}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '2px' }}>
                    <Icon size={12} />
                  </div>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>{a.title}</div>
                </th>
              );
            })}
            <th style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 700, color: 'var(--text-tertiary)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: '1px solid var(--border-color)' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {summary.map(({ student, totalScore, totalMax, pct }) => (
            <tr key={student.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-light)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
                {student.avatar ? (
                  <img src={student.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                    {student.student_profile?.first_name?.[0] || '?'}{student.student_profile?.last_name?.[0] || ''}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {student.student_profile?.first_name} {student.student_profile?.last_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{student.email}</div>
                </div>
              </td>
              {activities.map((a) => {
                const g = grades[student.id]?.[a.id];
                const clr = g?.status === 'graded' && g?.score !== null ? scoreColor(g.score, g.max_score) : 'var(--text-tertiary)';
                const display = g?.status === 'graded' && g?.score !== null ? `${g.score}/${g.max_score}` : g?.status === 'submitted' ? 'Pending' : '—';
                return (
                  <td key={a.id} style={{ textAlign: 'center', padding: '12px', color: clr, fontWeight: g?.status === 'graded' ? 700 : 400, cursor: 'pointer' }}
                    onClick={() => onActivityClick?.(a.id)}>
                    {display}
                  </td>
                );
              })}
              <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 700, color: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct > 0 ? '#ef4444' : 'var(--text-tertiary)' }}>
                {totalMax > 0 ? `${totalScore}/${totalMax} (${pct}%)` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
