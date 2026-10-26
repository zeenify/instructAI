import { useMemo, useState } from 'react';
import { Zap, Upload, HelpCircle, AlertTriangle, CircleDashed, TrendingUp, Search, Download } from 'lucide-react';
import { toast } from 'sonner';
import Dropdown from '../ui/Dropdown';
import { getExcelJS, addTitleBlock, styleHeader, allBorders, fitColumns, stamp, stampFile, downloadWorkbook, XL } from '../../utils/excelExport';
import './Gradebook.css';

const typeIcons = { quiz: Zap, file: Upload, questions: HelpCircle };

function bandOf(pct) {
  if (pct >= 75) return 'good';
  if (pct >= 50) return 'mid';
  return 'low';
}

export default function Gradebook({ data, loading, onActivityClick }) {
  const [search, setSearch] = useState('');
  const [flagFilter, setFlagFilter] = useState(null); // null | 'tograde' | 'missing'
  const [sort, setSort] = useState('name');
  const [exportScope, setExportScope] = useState('all'); // all | quiz | activity

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

  const handleExport = async () => {
    // The scope dropdown decides which columns ship; the on-screen grid is
    // untouched. Quizzes = activity_type 'quiz', everything else is an
    // activity (file / Q&A — materials never reach the gradebook).
    const exportActs = activities.filter((a) => (
      exportScope === 'all'
      || (exportScope === 'quiz' ? a.activity_type === 'quiz' : a.activity_type !== 'quiz')
    ));
    if (!exportActs.length) {
      toast.error(exportScope === 'quiz' ? 'No quizzes in this gradebook yet.' : 'No activities in this gradebook yet.');
      return;
    }
    const typeOf = (a) => (a.activity_type === 'quiz' ? 'Quiz' : 'Activity');
    const quizCount = exportActs.filter((a) => a.activity_type === 'quiz').length;

    const ExcelJS = await getExcelJS();
    const wb = new ExcelJS.Workbook();
    const className = data?.class_name || 'Class';
    const sorted = [...rows].sort((a, b) => {
      const an = `${a.student.student_profile?.last_name || ''}${a.student.student_profile?.first_name || ''}`.toLowerCase();
      const bn = `${b.student.student_profile?.last_name || ''}${b.student.student_profile?.first_name || ''}`.toLowerCase();
      return an.localeCompare(bn);
    });

    // Totals re-computed over the selected columns only, so "Quizzes only"
    // exports a quiz-only average — same state machine as the grid
    const scoped = sorted.map((r) => {
      let totalScore = 0;
      let totalMax = 0;
      let missing = 0;
      let pending = 0;
      let late = 0;
      let graded = 0;
      exportActs.forEach((a) => {
        const { state, g } = r.cells[a.id];
        const max = Number(g?.max_score ?? a.max_points ?? 0);
        if (state === 'graded') {
          totalScore += Number(g.score);
          totalMax += max;
          graded += 1;
          if (g.is_late) late += 1;
        } else if (state === 'pending') {
          pending += 1;
          totalMax += max;
        } else if (state === 'missing') {
          missing += 1;
          totalMax += max;
        } else {
          totalMax += max;
        }
      });
      return {
        ...r,
        sTotalScore: totalScore,
        sPct: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
        sMissing: missing,
        sPending: pending,
        sLate: late,
        sGraded: graded,
      };
    });
    const scopedClassAvg = (() => {
      const withPct = scoped.filter((r) => r.sPct !== null);
      return withPct.length ? Math.round(withPct.reduce((n, r) => n + r.sPct, 0) / withPct.length) : null;
    })();

    // Points possible per activity: the activity's own setting, or the max of
    // whatever submissions recorded (classwork quizzes carry it per submission)
    const actPts = {};
    exportActs.forEach((a) => {
      let pts = Number(a.max_points ?? 0);
      if (!pts) {
        students.forEach((s) => {
          const g = grades[s.id]?.[a.id];
          if (g?.max_score) pts = Math.max(pts, Number(g.max_score));
        });
      }
      actPts[a.id] = pts;
    });

    // ── Sheet 1: the class record ──
    const ws = wb.addWorksheet('Class Record');
    const colCount = 7 + exportActs.length;
    const headerRow = addTitleBlock(
      ws,
      `${className} — Class Record`,
      `${exportActs.length} item${exportActs.length !== 1 ? 's' : ''} (${quizCount} quiz${quizCount !== 1 ? 'zes' : ''} · ${exportActs.length - quizCount} activit${exportActs.length - quizCount !== 1 ? 'ies' : 'y'})`
        + ` · ${sorted.length} student${sorted.length !== 1 ? 's' : ''}${data?.teacher_name ? ` · Teacher: ${data.teacher_name}` : ''} · Generated ${stamp()}`,
      colCount,
    );
    const headers = ['#', 'Last Name', 'First Name', 'Email', 'LRN',
      ...exportActs.map((a) => `${typeOf(a)} · ${a.title}\n${actPts[a.id] ? `${actPts[a.id]} pts` : ''}`.trim()),
      'Total (pts)', 'Total %'];
    headers.forEach((h, i) => { ws.getCell(headerRow, i + 1).value = h; });
    styleHeader(ws, headerRow, colCount);
    // Quizzes keep the blue header; activity columns get the slate header so
    // the two kinds stay distinguishable at a glance, even printed in mono
    exportActs.forEach((a, ai) => {
      if (a.activity_type !== 'quiz') {
        ws.getCell(headerRow, 6 + ai).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.activityHeaderFill } };
      }
    });

    scoped.forEach((r, idx) => {
      const row = headerRow + 1 + idx;
      const p = r.student.student_profile || {};
      ws.getCell(row, 1).value = idx + 1;
      ws.getCell(row, 2).value = p.last_name || '';
      ws.getCell(row, 3).value = p.first_name || '';
      ws.getCell(row, 4).value = r.student.email || '';
      ws.getCell(row, 5).value = p.lrn_number || '';
      exportActs.forEach((a, ai) => {
        const cell = ws.getCell(row, 6 + ai);
        const { state, g } = r.cells[a.id];
        if (state === 'graded') {
          cell.value = Number(g.score);
          // Plain numbers — '0.##' renders integers with a trailing dot ("8.")
          cell.alignment = { horizontal: 'center' };
          if (g.is_late) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.pendingFill } };
          }
        } else if (state === 'pending') {
          cell.value = 'To grade';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.pendingFill } };
          cell.font = XL.pendingFont;
          cell.alignment = { horizontal: 'center' };
        } else if (state === 'missing') {
          cell.value = 'Missing';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.missingFill } };
          cell.font = XL.missingFont;
          cell.alignment = { horizontal: 'center' };
        } else {
          // No grade yet — quiz not taken, or activity still submittable.
          // Every no-data cell reads the same: a muted dash, never blank.
          cell.value = '—';
          cell.font = XL.mutedFont;
          cell.alignment = { horizontal: 'center' };
        }
      });
      const tot = ws.getCell(row, colCount - 1);
      tot.value = r.sTotalScore;
      tot.font = { bold: true };
      tot.alignment = { horizontal: 'center' };
      const pct = ws.getCell(row, colCount);
      if (r.sPct !== null) {
        pct.value = r.sPct / 100;
        pct.numFmt = '0%';
        pct.font = { bold: true, color: { argb: r.sPct >= 75 ? 'FF065F46' : r.sPct >= 50 ? 'FF92610A' : 'FF991B1B' } };
      }
      pct.alignment = { horizontal: 'center' };
      for (let c = 1; c <= colCount; c += 1) allBorders(ws.getCell(row, c));
    });

    // Class average row
    const avgRow = headerRow + 1 + sorted.length;
    ws.getCell(avgRow, 2).value = 'Class Average';
    exportActs.forEach((a, ai) => {
      const cell = ws.getCell(avgRow, 6 + ai);
      const avg = colStats[a.id]?.avg;
      if (avg !== null && avg !== undefined) {
        cell.value = avg / 100;
        cell.numFmt = '0%';
      }
      cell.alignment = { horizontal: 'center' };
    });
    if (scopedClassAvg !== null) {
      const cell = ws.getCell(avgRow, colCount);
      cell.value = scopedClassAvg / 100;
      cell.numFmt = '0%';
    }
    for (let c = 1; c <= colCount; c += 1) {
      const cell = ws.getCell(avgRow, c);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.avgFill } };
      cell.font = cell.font?.bold ? cell.font : XL.avgFont;
      allBorders(cell);
    }

    fitColumns(ws, colCount, { min: 6, max: 30 });
    [1, 2, 3, 4, 5].forEach((c) => { ws.getColumn(c).width = [5, 18, 16, 30, 16][c - 1]; });
    exportActs.forEach((_, ai) => { ws.getColumn(6 + ai).width = 20; });
    ws.getColumn(colCount - 1).width = 12;
    ws.getColumn(colCount).width = 10;

    // Legend — so anyone reading the sheet knows every marker without guessing
    const legendRow = avgRow + 2;
    ws.mergeCells(legendRow, 1, legendRow, colCount);
    const legend = ws.getCell(legendRow, 1);
    legend.value = 'Legend:  number = graded   ·   — = no grade yet (not taken / not due)   ·   To grade = submitted, awaiting grading   ·   Missing = not submitted by the deadline   ·   shaded amber = late';
    legend.font = { size: 10, color: { argb: 'FF6B7280' }, italic: true };
    legend.alignment = { horizontal: 'left', wrapText: true };
    ws.getRow(legendRow).height = 18;

    // ── Sheet 2: per-student summary (same selection) ──
    const ws2 = wb.addWorksheet('Summary');
    const h2 = addTitleBlock(
      ws2,
      `${className} — Student Summary`,
      `${quizCount} quiz${quizCount !== 1 ? 'zes' : ''} · ${exportActs.length - quizCount} activit${exportActs.length - quizCount !== 1 ? 'ies' : 'y'} · Generated ${stamp()}`,
      9,
    );
    ['Last Name', 'First Name', 'Email', 'LRN', 'Graded', 'To grade', 'Missing', 'Late', 'Average %'].forEach((h, i) => {
      ws2.getCell(h2, i + 1).value = h;
    });
    styleHeader(ws2, h2, 9);
    scoped.forEach((r, idx) => {
      const row = h2 + 1 + idx;
      const p = r.student.student_profile || {};
      ws2.getCell(row, 1).value = p.last_name || '';
      ws2.getCell(row, 2).value = p.first_name || '';
      ws2.getCell(row, 3).value = r.student.email || '';
      ws2.getCell(row, 4).value = p.lrn_number || '';
      ws2.getCell(row, 5).value = r.sGraded;
      ws2.getCell(row, 6).value = r.sPending;
      ws2.getCell(row, 7).value = r.sMissing;
      ws2.getCell(row, 8).value = r.sLate;
      if (r.sPct !== null) {
        const c = ws2.getCell(row, 9);
        c.value = r.sPct / 100;
        c.numFmt = '0%';
      }
      for (let c = 1; c <= 9; c += 1) allBorders(ws2.getCell(row, c));
    });
    fitColumns(ws2, 9, { min: 8 });
    ws2.getColumn(3).width = 30;

    await downloadWorkbook(wb, `Class Record — ${className} — ${stampFile()}.xlsx`);
  };

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
            value={exportScope}
            onChange={setExportScope}
            options={[
              { value: 'all', label: 'Export: Everything' },
              { value: 'quiz', label: 'Export: Quizzes only' },
              { value: 'activity', label: 'Export: Activities only' },
            ]}
          />
          <button
            type="button"
            className="gb-export-btn"
            onClick={handleExport}
            title="Download the class record as an Excel file"
          >
            <Download size={13} /> Excel
          </button>
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
        <span className="gb-legend-item"><span className="gb-legend-dot" style={{ background: 'var(--db-green)' }} /> graded 75%+</span>
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
                        {g.is_late && <span className="gb-late-dot" title="Late attempt — submitted after a reopen" />}
                      </td>
                    );
                  }
                  if (state === 'pending') {
                    return (
                      <td key={a.id} className="gb-cell" onClick={() => onActivityClick?.(a.id)} style={{ cursor: 'pointer' }}>
                        <span className="gb-chip tograde">To grade</span>
                        {g.is_late && <span className="gb-late-dot" title="Late attempt — submitted after a reopen" />}
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
                      background: pct === null ? 'transparent' : pct >= 75 ? 'var(--db-green)' : pct >= 50 ? 'var(--db-amber)' : 'var(--db-danger)',
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
