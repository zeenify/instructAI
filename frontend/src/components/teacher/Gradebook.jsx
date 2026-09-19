import { useMemo, useState } from 'react';
import { Zap, Upload, HelpCircle, AlertTriangle, CircleDashed, TrendingUp, Search } from 'lucide-react';
import Dropdown from '../ui/Dropdown';
import './Gradebook.css';

const typeIcons = { quiz: Zap, file: Upload, questions: HelpCircle };

function bandOf(pct) {
  if (pct >= 80) return 'good';
  if (pct >= 50) return 'mid';
  return 'low';
}

export default function Gradebook({ data, loading, onActivityClick }) {
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState(null); // null | 'tograde' | 'missing'
  const [sort, setSort] = useState('name');

  const activities = useMemo(
    () => (data?.activities || []).filter((a) => a.submission_type !== 'material'),
    [data],
  );
  const students = useMemo(() => data?.students || [], [data]);
  const grades = useMemo(() => data?.grades || {}, [data]);

  // Per-activity column stats: class average of graded work + how much needs grading
  const colStats = useMemo(() => {
    const map = {};
    activities.forEach((a) => {
      let sumPct = 0;
      let gradedCount = 0;
      let pending = 0;
      students.forEach((s) => {
        const g = grades[s.id]?.[a.id];
        if (g?.status === 'graded' && g?.score !== null && g?.max_score) {
          sumPct += (Number(g.score) / Number(g.max_score)) * 100;
          gradedCount += 1;
        } else if (g?.status === 'submitted') {
          pending += 1;
        }
      });
      map[a.id] = {
        avg: gradedCount > 0 ? Math.round(sumPct / gradedCount) : null,
        pending,
      };
    });
    return map;
  }, [activities, students, grades]);

  // Per-student totals + missing work
  const rows = useMemo(() => {
    const now = new Date();
    return students.map((student) => {
      let totalScore = 0;
      let totalMax = 0;
      let missing = 0;
      let pending = 0;
      const cells = {};
      activities.forEach((a) => {
        const g = grades[student.id]?.[a.id];
        const max = Number(g?.max_score ?? a.max_points ?? 0);
        let state;
        if (g?.status === 'graded' && g?.score !== null) {
          state = 'graded';
          totalScore += Number(g.score);
          totalMax += Number(g.max_score ?? a.max_points ?? 0);
        } else if (g?.status === 'submitted') {
          state = 'pending';
          pending += 1;
          totalMax += max;
        } else if (a.activity_type === 'quiz') {
          state = 'none';
          totalMax += max;
        } else if (a.deadline_at && new Date(a.deadline_at) < now) {
          state = 'missing';
          missing += 1;
          totalMax += max;
        } else {
          state = 'notdue';
          totalMax += max;
        }
        cells[a.id] = { state, g };
      });
      return {
        student,
        cells,
        totalScore,
        totalMax,
        missing,
        pending,
        pct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
      };
    });
  }, [students, activities, grades]);

  const visibleRows = useMemo(() => {
    let list = rows;
    if (flagFilter === 'tograde') list = list.filter((r) => r.pending > 0);
    if (flagFilter === 'missing') list = list.filter((r) => r.missing > 0);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const name = `${r.student.student_profile?.first_name || ''} ${r.student.student_profile?.last_name || ''}`.toLowerCase();
        return name.includes(q) || (r.student.email || '').toLowerCase().includes(q);
      });
    }
    const sorted = [...list];
    if (sort === 'highest') sorted.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
    if (sort === 'lowest') sorted.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
    if (sort === 'name') {
      sorted.sort((a, b) => {
        const an = `${a.student.student_profile?.last_name || ''}${a.student.student_profile?.first_name || ''}`.toLowerCase();
        const bn = `${b.student.student_profile?.last_name || ''}${b.student.student_profile?.first_name || ''}`.toLowerCase();
        return an.localeCompare(bn);
      });
    }
    return sorted;
  }, [rows, search, flagFilter, sort]);

  const totalPending = rows.reduce((n, r) => n + r.pending, 0);
  const totalMissing = rows.reduce((n, r) => n + r.missing, 0);
  const classAvg = useMemo(() => {
    const withPct = rows.filter((r) => r.pct !== null);
    if (!withPct.length) return null;
    return Math.round(withPct.reduce((n, r) => n + r.pct, 0) / withPct.length);
  }, [rows]);

  if (loading) {
    return (
      <div>
        <div className="gb-toolbar">
          <div className="db-skeleton" style={{ width: 240, height: 40, borderRadius: 11 }} />
        </div>
        <div className="gb-wrap">
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--db-border-strong)' }}>
            <div className="db-skeleton" style={{ width: '70%', height: 14 }} />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ padding: '15px 16px', borderBottom: '1px solid var(--db-border)' }}>
              <div className="db-skeleton" style={{ width: i === 1 ? '45%' : '60%', height: 13 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !activities.length) {
    return (
      <div className="gb-empty">
        <div className="gb-empty-icon"><TrendingUp size={24} /></div>
        <p className="gb-empty-title">No grade data yet</p>
        <p className="gb-empty-sub">
          Published quizzes and activities appear here automatically — scores fill in
          as students submit and you grade. Nothing to see until then.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="gb-toolbar">
        <div className="gb-search">
          <span className="gb-search-icon"><Search size={14} /></span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..." />
        </div>
        <div className="gb-toolbar-right">
          {totalPending > 0 && (
            <button type="button"
              className={`gb-alert-chip warn ${flagFilter === 'tograde' ? '' : 'off'}`}
              onClick={() => setFlagFilter(flagFilter === 'tograde' ? null : 'tograde')}
              title="Show only students with work waiting for your grade">
              <AlertTriangle size={13} /> {totalPending} to grade
            </button>
          )}
          {totalMissing > 0 && (
            <button type="button"
              className={`gb-alert-chip danger ${flagFilter === 'missing' ? '' : 'off'}`}
              onClick={() => setFlagFilter(flagFilter === 'missing' ? null : 'missing')}
              title="Show only students with unsubmitted past-deadline work">
              <CircleDashed size={13} /> {totalMissing} missing
            </button>
          )}
          {classAvg !== null && (
            <span className="gb-alert-chip off" style={{ cursor: 'default' }} title="Average of every student's current total">
              Class avg {classAvg}%
            </span>
          )}
          <Dropdown
            value={sort}
            onChange={setSort}
            options={[
              { value: 'name', label: 'Sort: Last name' },
              { value: 'highest', label: 'Sort: Highest total' },
              { value: 'lowest', label: 'Sort: Lowest total' },
            ]}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="gb-legend">
        <span className="gb-legend-item"><span className="gb-legend-dot" style={{ background: 'var(--db-green)' }} /> graded 80%+</span>
        <span className="gb-legend-item"><span className="gb-legend-dot" style={{ background: 'var(--db-amber)' }} /> to grade</span>
        <span className="gb-legend-item"><span className="gb-legend-dot" style={{ background: 'var(--db-danger)' }} /> missing</span>
        <span className="gb-legend-item"><span className="gb-legend-dot" style={{ background: 'var(--db-border-strong)' }} /> no submission yet</span>
      </div>

      {/* Grid */}
      <div className="gb-wrap">
        <table className="gb-table">
          <thead>
            <tr>
              <th className="gb-student gb-student-head">Student</th>
              {activities.map((a) => {
                const Icon = typeIcons[a.submission_type] || typeIcons[a.activity_type] || HelpCircle;
                const stats = colStats[a.id];
                return (
                  <th key={a.id} className="gb-col">
                    <button type="button" className="gb-col-btn" onClick={() => onActivityClick?.(a.id)}
                      title={`${a.title} — open submissions`}>
                      <span className="gb-col-icon"><Icon size={13} /></span>
                      <span className="gb-col-title">{a.title}</span>
                      <span className="gb-col-flags">
                        {stats?.pending > 0 && <span className="gb-col-flag tograde">{stats.pending} to grade</span>}
                        {stats?.avg !== null && <span className="gb-col-flag avg">avg {stats.avg}%</span>}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="gb-total gb-total-head">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ student, cells, totalScore, totalMax, pct, missing, pending }) => (
              <tr key={student.id}>
                <td className="gb-student">
                  <div className="gb-student-cell">
                    {student.avatar ? (
                      <img className="gb-avatar" src={student.avatar} alt="" />
                    ) : (
                      <span className="gb-avatar-fallback">
                        {student.student_profile?.first_name?.[0] || '?'}{student.student_profile?.last_name?.[0] || ''}
                      </span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="gb-name">
                        {student.student_profile?.first_name} {student.student_profile?.last_name}
                      </div>
                      <div className="gb-email">{student.email}</div>
                    </div>
                  </div>
                </td>
                {activities.map((a) => {
                  const { state, g } = cells[a.id];
                  if (state === 'graded') {
                    const score = Number(g.score);
                    const max = Number(g.max_score ?? a.max_points ?? 0);
                    const pct = max > 0 ? Math.round((score / max) * 100) : null;
                    return (
                      <td key={a.id} className="gb-cell" onClick={() => onActivityClick?.(a.id)} style={{ cursor: 'pointer' }}>
                        <span className={`gb-grade ${bandOf(pct ?? 100)}`}>
                          {score}/{max}
                          {pct !== null && <small>{pct}%</small>}
                        </span>
                      </td>
                    );
                  }
                  if (state === 'pending') {
                    return (
                      <td key={a.id} className="gb-cell" onClick={() => onActivityClick?.(a.id)} style={{ cursor: 'pointer' }}>
                        <span className="gb-chip tograde">To grade</span>
                      </td>
                    );
                  }
                  if (state === 'missing') {
                    return (
                      <td key={a.id} className="gb-cell" onClick={() => onActivityClick?.(a.id)} style={{ cursor: 'pointer' }}>
                        <span className="gb-chip missing">Missing</span>
                      </td>
                    );
                  }
                  return (
                    <td key={a.id} className="gb-cell">
                      <span className="gb-chip due" title={a.activity_type === 'quiz' ? 'No submission recorded' : 'Deadline has not passed yet'}>
                        {a.activity_type === 'quiz' ? '—' : 'Not due'}
                      </span>
                    </td>
                  );
                })}
                <td className="gb-total">
                  <span className={`gb-total-pct ${pct === null ? '' : bandOf(pct)}`}>
                    {pct === null ? '—' : `${pct}%`}
                  </span>
                  <div className="gb-total-score">{totalScore}/{totalMax}</div>
                  <div className="gb-bar" style={{ marginTop: 5 }}>
                    <div className="gb-bar-fill" style={{
                      transform: `scaleX(${Math.min((pct ?? 0) / 100, 1)})`,
                      background: pct === null ? 'transparent' : pct >= 80 ? 'var(--db-green)' : pct >= 50 ? 'var(--db-amber)' : 'var(--db-danger)',
                    }} />
                  </div>
                  {(missing > 0 || pending > 0) && (
                    <div style={{ marginTop: 4 }}>
                      {missing > 0 && <div className="gb-total-missing">{missing} missing</div>}
                      {pending > 0 && <div className="gb-total-missing" style={{ color: 'var(--db-amber)' }}>{pending} to grade</div>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td className="gb-student" colSpan={activities.length + 2} style={{ textAlign: 'center', padding: '34px 16px', color: 'var(--db-text-3)' }}>
                  No students match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
