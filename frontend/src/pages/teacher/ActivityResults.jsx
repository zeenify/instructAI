import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, ScatterChart, Scatter, ReferenceLine, LabelList,
} from 'recharts';
import {
    ChevronLeft, Users, Target, Hash, Trophy, Clock, CheckCircle2,
    RefreshCw, AlertTriangle, TrendingDown, Lightbulb, EyeOff, BarChart3, Crown, PartyPopper, Download,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { getExcelJS, addTitleBlock, styleHeader, allBorders, fitColumns, stamp, stampFile, fmtDateTime, downloadWorkbook, XL } from '../../utils/excelExport';
import SimilarityPanel from '../../components/teacher/SimilarityPanel';

const C = {
    green: '#10b981',
    amber: '#f59e0b',
    red: '#ef4444',
    violet: '#0a84ff',
    blue: '#3b82f6',
    slate: '#94a3b8',
    cyan: '#06b6d4',
};

const TYPE_LABELS = {
    multiple_choice: 'Multiple Choice',
    true_false: 'True/False',
    identification: 'Identification',
    enumeration: 'Enumeration',
    short_answer: 'Short Answer',
    essay: 'Essay',
    coding: 'Coding',
};

const TYPE_COLORS = {
    multiple_choice: C.violet,
    true_false: C.blue,
    identification: C.amber,
    enumeration: C.green,
    short_answer: C.cyan,
    essay: '#f472b6',
    coding: C.red,
};

const typeLabel = (t) => TYPE_LABELS[t] || t.replace(/_/g, ' ');
const colorForPct = (p) => (p === null || p === undefined ? C.slate : p >= 70 ? C.green : p >= 40 ? C.amber : C.red);

const fmtDuration = (s) => {
    if (s === null || s === undefined) return '—';
    const m = Math.floor(s / 60);
    const r = Math.round(s % 60);
    if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
    if (m > 0) return `${m}m ${r}s`;
    return `${r}s`;
};

const PODIUM_STYLE = {
    1: { h: 150, w: 168, grad: 'linear-gradient(180deg, #fde68a 0%, #f59e0b 100%)', glow: '0 12px 32px rgba(245, 158, 11, 0.35)' },
    2: { h: 112, w: 140, grad: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)', glow: '0 10px 26px rgba(148, 163, 184, 0.3)' },
    3: { h: 88, w: 140, grad: 'linear-gradient(180deg, #fdba74 0%, #d97706 100%)', glow: '0 10px 26px rgba(217, 119, 6, 0.3)' },
};

function Card({ title, subtitle, right, children, style }) {
    return (
        <div style={{ backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '16px', padding: '22px', boxShadow: 'var(--card-shadow)', ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px' }}>
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--db-text)' }}>{title}</h3>
                    {subtitle && <p style={{ fontSize: '13px', color: 'var(--db-text-3)', margin: '4px 0 0 0' }}>{subtitle}</p>}
                </div>
                {right}
            </div>
            {children}
        </div>
    );
}

function KpiCard({ icon, label, value, sub, color }) {
    const IconComponent = icon;
    return (
        <div style={{ backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '16px', padding: '18px 20px', boxShadow: 'var(--card-shadow)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconComponent size={20} color={color} />
            </div>
            <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0', color: 'var(--db-text-3)', margin: '0 0 4px 0' }}>{label}</p>
                <p style={{ fontSize: '23.5px', fontWeight: 800, color: 'var(--db-text)', margin: 0, lineHeight: 1.2 }}>{value}</p>
                {sub && <p style={{ fontSize: '12px', color: 'var(--db-text-3)', margin: '2px 0 0 0' }}>{sub}</p>}
            </div>
        </div>
    );
}

function ChartTooltip({ active, payload, label, format }) {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: '300px' }}>
            {label && <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--db-text)' }}>{label}</div>}
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--db-text-2)', padding: '2px 0', lineHeight: 1.4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.payload?.fill || C.green, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}:</span>
                    <span style={{ fontWeight: 700, color: 'var(--db-text)', marginLeft: 'auto', paddingLeft: '8px' }}>{format ? format(p.value, p.payload, p) : p.value}</span>
                </div>
            ))}
        </div>
    );
}

export default function ActivityResults() {
    const { classId, activityId } = useParams();
    const navigate = useNavigate();
    const { theme } = useTheme();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportSel, setExportSel] = useState({ results: true, itemAnalysis: true, matrix: true, summary: true });

    const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';
    const gridColor = theme === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(100,116,139,0.18)';

    const fetchAnalysis = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api.get(`/teacher/activities/${activityId}/results-analysis`, { bypassCache: true });
            setData(res.data);
            setError(null);
        } catch {
            setError('Failed to load results analysis');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAnalysis();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityId]);

    const scatterData = useMemo(() => (data?.scatter || []).filter((d) => d.duration_seconds !== null), [data]);
    const rankingData = useMemo(() => (data?.ranking || []).slice(0, 20), [data]);
    const matrix = data?.matrix || [];
    const questions = data?.questions || [];
    const stats = data?.stats || {};

    const confetti = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
        left: (i * 37 + 11) % 100,
        delay: (i * 13) % 9,
        dur: 3.2 + (i % 5) * 0.9,
        size: 6 + (i % 4) * 2,
        color: [C.violet, C.green, C.cyan, C.amber, '#f472b6'][i % 5],
        rot: (i * 47) % 360,
    })), []);

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--db-canvas)', color: 'var(--db-text)', transition: 'all 0.3s ease' }}>
                <div className="max-w-7xl mx-auto" style={{ padding: '32px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '10px' }}>
                        <RefreshCw size={18} className="animate-spin" />
                        <span style={{ color: 'var(--db-text-2)', fontSize: '15px' }}>Loading results analysis...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ minHeight: '100vh', backgroundColor: 'var(--db-canvas)', color: 'var(--db-text)', transition: 'all 0.3s ease' }}>
                <div className="max-w-7xl mx-auto" style={{ padding: '32px 24px' }}>
                    <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '15px', fontWeight: '500' }}>{error || 'No data'}</div>
                </div>
            </div>
        );
    }

    const hasResults = (stats.submitted || 0) > 0;
    const top3 = rankingData.slice(0, 3);
    const visualPodium = [top3[1], top3[0], top3[2]].filter(Boolean).map((r) => ({ r, rank: r === top3[0] ? 1 : r === top3[1] ? 2 : 3 }));

    const handleExport = async (sel) => {
        const ExcelJS = await getExcelJS();
        const wb = new ExcelJS.Workbook();
        const activityTitle = data.activity.title;

        // ── Sheet: one row per student, highest first, non-submitters last ──
        if (sel.results) {
        const ws = wb.addWorksheet('Results');
        const colCount = 9;
        const hr = addTitleBlock(
            ws,
            `${activityTitle} — Results`,
            `${typeLabel(data.activity.activity_type)} · ${stats.submitted} of ${stats.enrolled} enrolled submitted`
                + ` · Class avg ${stats.avg_score_pct ?? '—'}% · Median ${stats.median_score_pct ?? '—'}%`
                + ` · Pass rate ${stats.pass_rate ?? '—'}% · Generated ${stamp()}`,
            colCount,
        );
        ['Rank', 'Student', 'Score', 'Max', '%', 'Status', 'Duration', 'Submitted', 'Answered'].forEach((h, i) => {
            ws.getCell(hr, i + 1).value = h;
        });
        styleHeader(ws, hr, colCount);

        let rowIdx = hr;
        (data.ranking || []).forEach((r, i) => {
            rowIdx += 1;
            ws.getCell(rowIdx, 1).value = i + 1;
            ws.getCell(rowIdx, 2).value = r.student;
            ws.getCell(rowIdx, 3).value = r.score;
            ws.getCell(rowIdx, 4).value = r.max_score;
            const pctCell = ws.getCell(rowIdx, 5);
            pctCell.value = r.score_pct / 100;
            pctCell.numFmt = '0%';
            pctCell.font = { bold: true, color: { argb: r.score_pct >= 80 ? 'FF065F46' : r.score_pct >= 50 ? 'FF92610A' : 'FF991B1B' } };
            ws.getCell(rowIdx, 6).value = r.status === 'graded' ? 'Graded' : 'Submitted';
            ws.getCell(rowIdx, 7).value = fmtDuration(r.duration_seconds);
            ws.getCell(rowIdx, 8).value = fmtDateTime(r.submitted_at);
            ws.getCell(rowIdx, 9).value = `${r.answered} / ${r.total_questions}`;
            [1, 3, 4, 5, 6, 7, 9].forEach((c) => { ws.getCell(rowIdx, c).alignment = { horizontal: 'center' }; });
            for (let c = 1; c <= colCount; c += 1) allBorders(ws.getCell(rowIdx, c));
        });
        (data.insights?.not_submitted || []).forEach((name) => {
            rowIdx += 1;
            ws.getCell(rowIdx, 2).value = name;
            const s = ws.getCell(rowIdx, 6);
            s.value = 'No submission';
            s.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.missingFill } };
            s.font = XL.missingFont;
            s.alignment = { horizontal: 'center' };
            for (let c = 1; c <= colCount; c += 1) allBorders(ws.getCell(rowIdx, c));
        });
        fitColumns(ws, colCount, { min: 6, max: 30 });
        ws.getColumn(2).width = 30;
        ws.getColumn(8).width = 20;
        }

        // ── Sheet: item analysis ──
        const qs = data.questions || [];
        if (sel.itemAnalysis && qs.length) {
            const ws2 = wb.addWorksheet('Item Analysis');
            const h2 = addTitleBlock(ws2, `${activityTitle} — Item Analysis`, `${qs.length} questions · Generated ${stamp()}`, 10);
            ['#', 'Question', 'Type', 'Pts', 'Correct', 'Wrong', 'Blank', 'To grade', 'Accuracy', 'Difficulty'].forEach((h, i) => {
                ws2.getCell(h2, i + 1).value = h;
            });
            styleHeader(ws2, h2, 10);
            qs.forEach((q, i) => {
                const row = h2 + 1 + i;
                ws2.getCell(row, 1).value = q.order ?? i + 1;
                ws2.getCell(row, 2).value = q.text;
                ws2.getCell(row, 3).value = TYPE_LABELS[q.type] || q.type;
                ws2.getCell(row, 4).value = q.points;
                ws2.getCell(row, 5).value = q.correct;
                ws2.getCell(row, 6).value = q.wrong;
                ws2.getCell(row, 7).value = q.blank;
                ws2.getCell(row, 8).value = q.pending;
                if (q.accuracy_pct !== null && q.accuracy_pct !== undefined) {
                    const a = ws2.getCell(row, 9);
                    a.value = q.accuracy_pct / 100;
                    a.numFmt = '0%';
                }
                const d = ws2.getCell(row, 10);
                d.alignment = { horizontal: 'center' };
                if (!q.attempted) {
                    d.value = '—';
                    d.font = XL.mutedFont;
                } else if (q.accuracy_pct >= 75) {
                    d.value = 'Easy';
                    d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.gradedFill } };
                    d.font = XL.gradedFont;
                } else if (q.accuracy_pct >= 40) {
                    d.value = 'Moderate';
                    d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.pendingFill } };
                    d.font = XL.pendingFont;
                } else {
                    d.value = 'Hard';
                    d.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.missingFill } };
                    d.font = XL.missingFont;
                }
                for (let c = 1; c <= 10; c += 1) allBorders(ws2.getCell(row, c));
            });
            fitColumns(ws2, 10, { min: 6, max: 18 });
            ws2.getColumn(2).width = 70;
        }

        // ── Sheet: student × question matrix ──
        const matrixRows = data.matrix || [];
        if (sel.matrix && matrixRows.length && qs.length) {
            const colsWithQ = 2 + qs.length + 1;
            const ws3 = wb.addWorksheet('Student × Question');
            const h3 = addTitleBlock(ws3, `${activityTitle} — Student × Question`, `✓ correct · ✕ wrong · P needs grading · – blank · Generated ${stamp()}`, colsWithQ);
            const headers3 = ['Student', ...qs.map((q, i) => `Q${q.order ?? i + 1}`), '%'];
            headers3.forEach((h, i) => { ws3.getCell(h3, i + 1).value = h; });
            styleHeader(ws3, h3, colsWithQ);
            matrixRows.forEach((m, ri) => {
                const row = h3 + 1 + ri;
                ws3.getCell(row, 1).value = m.student;
                m.cells.forEach((cell, ci) => {
                    const c = ws3.getCell(row, 2 + ci);
                    c.alignment = { horizontal: 'center' };
                    if (cell.state === 'correct') { c.value = '✓'; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.gradedFill } }; c.font = XL.gradedFont; }
                    else if (cell.state === 'wrong') { c.value = '✕'; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.missingFill } }; c.font = XL.missingFont; }
                    else if (cell.state === 'pending') { c.value = 'P'; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.pendingFill } }; c.font = XL.pendingFont; }
                    else { c.value = '–'; c.font = XL.mutedFont; }
                });
                const pct = ws3.getCell(row, colsWithQ);
                pct.value = m.score_pct / 100;
                pct.numFmt = '0%';
                pct.font = { bold: true };
                pct.alignment = { horizontal: 'center' };
                for (let c = 1; c <= colsWithQ; c += 1) allBorders(ws3.getCell(row, c));
            });
            ws3.getColumn(1).width = 30;
            for (let c = 2; c < colsWithQ; c += 1) ws3.getColumn(c).width = 6;
            ws3.getColumn(colsWithQ).width = 8;
        }

        // ── Sheet: class summary — the analytics a teacher actually reports ──
        if (sel.summary) {
            const ws4 = wb.addWorksheet('Class Summary');
            const hr4 = addTitleBlock(
                ws4,
                `${activityTitle} — Class Summary`,
                `${typeLabel(data.activity.activity_type)} · Generated ${stamp()}`,
                4,
            );
            let r = hr4;

            const kv = [
                ['Students enrolled', stats.enrolled ?? '—'],
                ['Students submitted', stats.submitted ?? '—'],
                ['Participation', stats.participation_rate != null ? `${stats.participation_rate}%` : '—'],
                ['Class average', stats.avg_score_pct != null ? `${stats.avg_score_pct}%` : '—'],
                ['Median score', stats.median_score_pct != null ? `${stats.median_score_pct}%` : '—'],
                ['Pass rate (≥60%)', stats.pass_rate != null ? `${stats.pass_rate}%` : '—'],
                ['Highest score', stats.highest_score_pct != null ? `${stats.highest_score_pct}%` : '—'],
                ['Lowest score', stats.lowest_score_pct != null ? `${stats.lowest_score_pct}%` : '—'],
                ['Average time taken', stats.avg_duration_seconds != null ? fmtDuration(stats.avg_duration_seconds) : '—'],
                ['Questions answered (avg)', stats.avg_answered_pct != null ? `${stats.avg_answered_pct}%` : '—'],
            ];
            kv.forEach(([k, v]) => {
                ws4.getCell(r, 1).value = k;
                ws4.getCell(r, 1).font = { bold: true, color: { argb: 'FF374151' } };
                ws4.getCell(r, 2).value = v;
                ws4.getCell(r, 2).alignment = { horizontal: 'center' };
                allBorders(ws4.getCell(r, 1));
                allBorders(ws4.getCell(r, 2));
                r += 1;
            });

            // Score distribution
            r += 2;
            ws4.getCell(r, 1).value = 'Score distribution';
            ws4.getCell(r, 1).font = { bold: true, size: 12.5, color: { argb: 'FF111827' } };
            r += 1;
            ['Range', 'Students'].forEach((h, i) => { ws4.getCell(r, i + 1).value = h; });
            styleHeader(ws4, r, 2);
            (data.histogram || []).forEach((bin) => {
                r += 1;
                ws4.getCell(r, 1).value = bin.label;
                ws4.getCell(r, 2).value = bin.count;
                ws4.getCell(r, 2).alignment = { horizontal: 'center' };
                allBorders(ws4.getCell(r, 1));
                allBorders(ws4.getCell(r, 2));
            });

            // Performance by question type
            r += 2;
            ws4.getCell(r, 1).value = 'Performance by question type';
            ws4.getCell(r, 1).font = { bold: true, size: 12.5, color: { argb: 'FF111827' } };
            r += 1;
            ['Type', 'Questions', 'Correct', 'Accuracy'].forEach((h, i) => { ws4.getCell(r, i + 1).value = h; });
            styleHeader(ws4, r, 4);
            (data.types || []).forEach((t) => {
                r += 1;
                ws4.getCell(r, 1).value = TYPE_LABELS[t.type] || t.type;
                ws4.getCell(r, 2).value = t.count;
                ws4.getCell(r, 3).value = t.correct;
                if (t.accuracy_pct !== null && t.accuracy_pct !== undefined) {
                    ws4.getCell(r, 4).value = t.accuracy_pct / 100;
                    ws4.getCell(r, 4).numFmt = '0%';
                }
                for (let c = 1; c <= 4; c += 1) {
                    if (c > 1) ws4.getCell(r, c).alignment = { horizontal: 'center' };
                    allBorders(ws4.getCell(r, c));
                }
            });

            // Insights
            const ins = data.insights || {};
            r += 2;
            ws4.getCell(r, 1).value = 'Insights';
            ws4.getCell(r, 1).font = { bold: true, size: 12.5, color: { argb: 'FF111827' } };
            r += 1;
            const insightLines = [];
            if (ins.hardest) insightLines.push([`Hardest question — Q${ins.hardest.order}`, `${ins.hardest.accuracy_pct}% accuracy`]);
            if (ins.easiest) insightLines.push([`Easiest question — Q${ins.easiest.order}`, `${ins.easiest.accuracy_pct}% accuracy`]);
            (ins.weak_questions || []).forEach((q) => insightLines.push([`Weak — Q${q.order}: ${q.text}`, `${q.accuracy_pct}% accuracy`]));
            (ins.needs_help || []).forEach((s) => insightLines.push([`Needs support — ${s.student}`, `${s.score_pct}%`]));
            (ins.not_submitted || []).forEach((n) => insightLines.push(['Did not submit', n]));
            if (!insightLines.length) insightLines.push(['Nothing flagged', '—']);
            insightLines.forEach(([k, v]) => {
                ws4.getCell(r, 1).value = k;
                ws4.mergeCells(r, 1, r, 3);
                ws4.getCell(r, 4).value = v;
                ws4.getCell(r, 4).alignment = { horizontal: 'center' };
                ws4.getCell(r, 1).alignment = { wrapText: true, vertical: 'middle' };
                for (let c = 1; c <= 4; c += 1) allBorders(ws4.getCell(r, c));
                r += 1;
            });

            fitColumns(ws4, 4, { min: 10 });
            ws4.getColumn(1).width = 52;
            ws4.views = [{ state: 'frozen', ySplit: 0 }];
        }

        await downloadWorkbook(wb, `Results — ${activityTitle} — ${stampFile()}.xlsx`);
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--db-canvas)', color: 'var(--db-text)', transition: 'all 0.3s ease' }}>
            <div className="max-w-7xl mx-auto" style={{ padding: '32px 24px', paddingBottom: '64px' }}>
                <button
                    onClick={() => navigate(`/dashboard/teacher/class/${classId}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '8px', color: 'var(--db-text-2)', fontWeight: '500', fontSize: '15px', cursor: 'pointer', transition: 'all 200ms ease-in-out', marginBottom: '24px' }}
                >
                    <ChevronLeft size={18} />
                    Back to Class
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <h1 style={{ fontSize: '25.5px', fontWeight: 800, margin: 0 }}>{data.activity.title}</h1>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                <BarChart3 size={12} /> RESULTS ANALYSIS
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', fontSize: '14px', color: 'var(--db-text-3)' }}>
                            <span>{typeLabel(data.activity.activity_type)}</span>
                            <span>·</span>
                            <span>{data.activity.question_count} question{data.activity.question_count !== 1 ? 's' : ''}</span>
                            {data.activity.max_points !== null && (
                                <>
                                    <span>·</span>
                                    <span>{data.activity.max_points} pts</span>
                                </>
                            )}
                            <span>·</span>
                            <span>{stats.submitted} scored submission{stats.submitted !== 1 ? 's' : ''} of {stats.enrolled} enrolled</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setShowExportModal(true)}
                            disabled={!data}
                            title="Choose what to export as Excel"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '8px', color: 'var(--db-text-2)', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                        >
                            <Download size={14} />
                            Export Excel
                        </button>
                        <button
                            onClick={() => fetchAnalysis(true)}
                            disabled={refreshing}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '8px', color: 'var(--db-text-2)', fontWeight: '600', fontSize: '14px', cursor: 'pointer', opacity: refreshing ? 0.6 : 1 }}
                        >
                            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {!hasResults ? (
                    <div style={{ border: '2px dashed var(--db-border)', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', background: 'var(--db-card)' }}>
                        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--db-card-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: C.slate }}><BarChart3 size={28} /></div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px 0' }}>No scored results yet</h3>
                        <p style={{ fontSize: '15px', color: 'var(--db-text-3)', margin: 0 }}>Analysis appears once students submit work. {stats.draft_count > 0 ? `${stats.draft_count} submission${stats.draft_count !== 1 ? 's are' : ' is'} still in progress.` : ''}</p>
                    </div>
                ) : (
                    <>
                        {/* ── Hero: winner podium ── */}
                        {visualPodium.length > 0 && (
                            <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, rgba(10, 132, 255, 0.10), rgba(16, 185, 129, 0.06))', border: '1px solid rgba(10, 132, 255, 0.28)', borderRadius: '22px', padding: '30px 24px 40px', marginBottom: '24px' }}>
                                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                                    {confetti.map((c, i) => (
                                        <span key={i} style={{ position: 'absolute', top: 0, left: `${c.left}%`, width: c.size, height: Math.round(c.size * 0.6), background: c.color, borderRadius: 2, opacity: 0, animation: `confettiFall ${c.dur}s linear ${c.delay}s infinite` }} />
                                    ))}
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <PartyPopper size={15} color={C.violet} />
                                        <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, letterSpacing: '0', color: C.violet }}>Quiz complete</p>
                                    </div>
                                    <h2 style={{ margin: 0, fontSize: '25.5px', fontWeight: 800, color: 'var(--db-text)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <Crown size={22} color={C.amber} />
                                        {top3.length === 1 ? `${top3[0].student} tops the quiz with ${top3[0].score_pct}%` : `${top3[0].student} takes 1st place with ${top3[0].score_pct}%`}
                                    </h2>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--db-text-3)' }}>
                                        {stats.submitted} of {stats.enrolled} enrolled students submitted · {data.activity.question_count} question{data.activity.question_count !== 1 ? 's' : ''} · Top 3 shown
                                    </p>

                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '14px', marginTop: '30px' }}>
                                        {visualPodium.map(({ r, rank }, idx) => {
                                            const p = PODIUM_STYLE[rank];
                                            return (
                                                <div key={r.student} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: p.w, animation: 'podiumFade 0.5s ease both', animationDelay: `${0.1 + idx * 0.12}s` }}>
                                                    {rank === 1 && <Crown size={26} color={C.amber} style={{ marginBottom: 6 }} />}
                                                    <div
                                                        style={{
                                                            width: '100%', height: p.h, background: p.grad, borderRadius: '14px 14px 8px 8px',
                                                            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 14,
                                                            boxShadow: p.glow, animation: 'podiumRise 0.65s cubic-bezier(0.22, 1, 0.36, 1) both', animationDelay: `${0.2 + idx * 0.15}s`,
                                                            '--podium-h': `${p.h}px`,
                                                        }}
                                                    >
                                                        <span style={{ fontSize: '23.5px', fontWeight: 900, color: 'rgba(255,255,255,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>{rank}</span>
                                                    </div>
                                                    <p style={{ margin: '10px 0 0 0', fontSize: '14px', fontWeight: 700, color: 'var(--db-text)', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.student}>{r.student}</p>
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 800, color: colorForPct(r.score_pct) }}>{r.score_pct}%</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Big chart: every question, one view ── */}
                        {questions.length > 0 && (
                            <Card
                                title="Question breakdown"
                                subtitle="How the class answered each question — the % next to each question is accuracy"
                                style={{ marginBottom: '24px' }}
                                right={
                                    <div style={{ display: 'flex', gap: '14px', fontSize: '13px', color: 'var(--db-text-3)', flexWrap: 'wrap' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.green, display: 'inline-block' }} /> Correct</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.red, display: 'inline-block' }} /> Wrong</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.amber, display: 'inline-block' }} /> Pending</span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: 10, height: 10, borderRadius: 3, background: C.slate, display: 'inline-block' }} /> Blank</span>
                                    </div>
                                }
                            >
                                <ResponsiveContainer width="100%" height={Math.max(180, questions.length * 58)}>
                                    <BarChart data={questions} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }} barSize={26}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 13 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="text"
                                            width={320}
                                            tick={{ fill: axisColor, fontSize: 12 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v, i) => {
                                                const q = questions[i];
                                                const acc = q && q.accuracy_pct !== null ? ` · ${q.accuracy_pct}%` : '';
                                                return `${v.length > 38 ? `${v.slice(0, 38)}…` : v}${acc}`;
                                            }}
                                        />
                                        <Tooltip content={<ChartTooltip format={(v, p, e) => `${v} ${e.name.toLowerCase()}`} />} cursor={{ fill: gridColor }} />
                                        <Bar dataKey="correct" name="Correct" stackId="a" fill={C.green} radius={[2, 0, 0, 2]} />
                                        <Bar dataKey="wrong" name="Wrong" stackId="a" fill={C.red} />
                                        <Bar dataKey="pending" name="Pending" stackId="a" fill={C.amber} />
                                        <Bar dataKey="blank" name="Blank" stackId="a" fill={C.slate} radius={[0, 2, 2, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        )}

                        {/* ── KPI scorecards ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                            <KpiCard icon={Users} label="Participation" value={`${stats.participation_rate}%`} sub={`${stats.submitted} / ${stats.enrolled} submitted`} color={C.blue} />
                            <KpiCard icon={Target} label="Class Average" value={`${stats.avg_score_pct}%`} sub={`Passing at 60%`} color={colorForPct(stats.avg_score_pct)} />
                            <KpiCard icon={Hash} label="Median Score" value={`${stats.median_score_pct}%`} sub={`Range ${stats.lowest_score_pct}% – ${stats.highest_score_pct}%`} color={C.violet} />
                            <KpiCard icon={Trophy} label="Pass Rate" value={`${stats.pass_rate}%`} sub="Scored 60% or higher" color={stats.pass_rate >= 70 ? C.green : stats.pass_rate >= 40 ? C.amber : C.red} />
                            <KpiCard icon={Clock} label="Avg Time Taken" value={fmtDuration(stats.avg_duration_seconds)} sub="Per completed submission" color={C.cyan} />
                            <KpiCard icon={CheckCircle2} label="Questions Answered" value={`${stats.avg_answered_pct}%`} sub="Of all questions, on average" color={C.green} />
                        </div>

                        {/* ── Insights ── */}
                        {(() => {
                            const ins = data.insights || {};
                            const items = [];
                            if (ins.weak_questions?.length) items.push({ icon: TrendingDown, color: C.red, text: `${ins.weak_questions.length} question${ins.weak_questions.length !== 1 ? 's' : ''} below 40% accuracy — worth reviewing or checking the answer key: ${ins.weak_questions.map((q) => `Q${q.order} (${q.accuracy_pct}%)`).join(', ')}.` });
                            if (ins.unanswered_questions?.length) items.push({ icon: EyeOff, color: C.slate, text: `${ins.unanswered_questions.map((q) => `Q${q.order}`).join(', ')} ${ins.unanswered_questions.length !== 1 ? 'were' : 'was'} not answered by ${ins.unanswered_questions[0].blank} student${ins.unanswered_questions[0].blank !== 1 ? 's' : ''} — likely skipped or timed out.` });
                            if (ins.needs_help?.length) items.push({ icon: AlertTriangle, color: C.amber, text: `${ins.needs_help.length} student${ins.needs_help.length !== 1 ? 's' : ''} scored below 60% and may need support: ${ins.needs_help.map((s) => `${s.student} (${s.score_pct}%)`).join(', ')}.` });
                            if (ins.hardest && ins.easiest) {
                                if (ins.hardest.order === ins.easiest.order) {
                                    items.push({ icon: Lightbulb, color: C.violet, text: `Every question landed at ${ins.hardest.accuracy_pct}% accuracy (Q${ins.hardest.order}).` });
                                } else {
                                    items.push({ icon: Lightbulb, color: C.violet, text: `Hardest: Q${ins.hardest.order} at ${ins.hardest.accuracy_pct}% accuracy. Easiest: Q${ins.easiest.order} at ${ins.easiest.accuracy_pct}%.` });
                                }
                            }
                            if (ins.not_submitted?.length) items.push({ icon: EyeOff, color: C.slate, text: `${ins.not_submitted.length} enrolled student${ins.not_submitted.length !== 1 ? 's' : ''} have not submitted: ${ins.not_submitted.join(', ')}.` });
                            if (stats.draft_count > 0) items.push({ icon: Clock, color: C.cyan, text: `${stats.draft_count} submission${stats.draft_count !== 1 ? 's' : ''} in progress (not yet submitted).` });

                            if (!items.length) return null;
                            return (
                                <div style={{ marginBottom: '24px', padding: '18px 22px', borderRadius: '16px', background: 'rgba(10, 132, 255, 0.06)', border: '1px solid rgba(10, 132, 255, 0.25)' }}>
                                    <p style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0', color: C.violet, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Lightbulb size={14} /> Insights
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {items.map((it, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px', color: 'var(--db-text-2)', lineHeight: 1.5 }}>
                                                <it.icon size={15} color={it.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <span>{it.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Charts row 1 ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                            <Card title="Score distribution" subtitle="How the class performed, binned by score">
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={data.histogram} margin={{ top: 24, right: 8, left: -18, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                        <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 13 }} axisLine={{ stroke: gridColor }} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 13 }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<ChartTooltip format={(v) => `${v} student${v !== 1 ? 's' : ''}`} />} cursor={{ fill: gridColor }} />
                                        <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]}>
                                            {data.histogram.map((bin, i) => (
                                                <Cell key={i} fill={bin.count > 0 ? C.green : 'var(--db-card-2)'} />
                                            ))}
                                            <LabelList dataKey="count" position="top" style={{ fill: axisColor, fontSize: 13, fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>

                            <Card title="Performance by question type" subtitle="Average accuracy grouped by question format">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                    <ResponsiveContainer width="55%" height={220}>
                                        <PieChart>
                                            <Pie data={data.types} dataKey="accuracy_pct" nameKey="type" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3} strokeWidth={0}>
                                                {data.types.map((t, i) => (
                                                    <Cell key={i} fill={TYPE_COLORS[t.type] || C.slate} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<ChartTooltip format={(v, p) => `${v}% accuracy (${p.correct}/${p.attempted} answered)`} />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {data.types.map((t) => (
                                            <div key={t.type} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[t.type] || C.slate, flexShrink: 0 }} />
                                                <span style={{ fontSize: '14px', color: 'var(--db-text-2)', flex: 1 }}>{typeLabel(t.type)}</span>
                                                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--db-text)' }}>{t.accuracy_pct === null ? '—' : `${t.accuracy_pct}%`}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </Card>
                        </div>

                        {/* ── Charts row 2 ── */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                            <Card title="Score vs. time" subtitle="Did students who took longer score better? Each dot is one student">
                                <ResponsiveContainer width="100%" height={220}>
                                    <ScatterChart margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                        <XAxis type="number" dataKey="duration_seconds" name="Time taken" tick={{ fill: axisColor, fontSize: 13 }} axisLine={false} tickLine={false} tickFormatter={fmtDuration} unit="" />
                                        <YAxis type="number" dataKey="score_pct" name="Score" domain={[0, 100]} tick={{ fill: axisColor, fontSize: 13 }} axisLine={false} tickLine={false} unit="%" />
                                        <ReferenceLine y={60} stroke={C.amber} strokeDasharray="5 5" label={{ value: 'Pass 60%', fill: C.amber, fontSize: 12, position: 'insideTopRight' }} />
                                        <Tooltip content={<ChartTooltip format={(v, p) => (p.name === 'Score' ? `${v}%` : `${fmtDuration(v)} taken`)} />} cursor={{ strokeDasharray: '3 3', stroke: axisColor }} />
                                        {scatterData.length === 0 ? (
                                            <></>
                                        ) : (
                                            <Scatter data={scatterData} name="Students" fill={C.green}>
                                                {scatterData.map((d, i) => (
                                                    <Cell key={i} fill={colorForPct(d.score_pct)} />
                                                ))}
                                            </Scatter>
                                        )}
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </Card>

                            <Card title="Class ranking" subtitle={rankingData.length < (data.ranking || []).length ? `Top ${rankingData.length} of ${(data.ranking || []).length} submitted` : 'All submitted students, best to worst'}>
                                <ResponsiveContainer width="100%" height={Math.max(120, rankingData.length * 42)}>
                                    <BarChart data={rankingData} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                                        <XAxis type="number" domain={[0, 100]} tick={{ fill: axisColor, fontSize: 13 }} axisLine={false} tickLine={false} unit="%" />
                                        <YAxis
                                            type="category"
                                            dataKey="student"
                                            width={170}
                                            tick={{ fill: axisColor, fontSize: 13 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v, i) => `${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} ${v}`}
                                        />
                                        <Tooltip content={<ChartTooltip format={(v, p) => `${v}% — ${p.score}/${p.max_score} pts`} />} cursor={{ fill: gridColor }} />
                                        <Bar dataKey="score_pct" name="Score" radius={[0, 6, 6, 0]}>
                                            {rankingData.map((r, i) => (
                                                <Cell key={i} fill={colorForPct(r.score_pct)} />
                                            ))}
                                            <LabelList dataKey="score_pct" position="right" formatter={(v) => `${v}%`} style={{ fill: axisColor, fontSize: 13, fontWeight: 700 }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card>
                        </div>

                        {/* ── Question breakdown cards ── */}
                        {questions.length > 0 && (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Question breakdown</h2>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                                    {questions.map((q) => {
                                        const answered = q.attempted + q.pending;
                                        const total = answered + q.blank;
                                        const dist = q.distribution || [];
                                        return (
                                            <div key={q.id} style={{ backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '14px', padding: '18px', boxShadow: 'var(--card-shadow)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 700, color: TYPE_COLORS[q.type] || C.slate, background: `${TYPE_COLORS[q.type] || C.slate}1a`, padding: '3px 8px', borderRadius: '6px' }}>{typeLabel(q.type)}</span>
                                                            <span style={{ fontSize: '12px', color: 'var(--db-text-3)', fontWeight: 600 }}>{q.points} pts</span>
                                                        </div>
                                                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--db-text)', margin: 0, lineHeight: 1.45 }}>Q{q.order}. {q.text}</p>
                                                    </div>
                                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                        <p style={{ fontSize: '25.5px', fontWeight: 800, margin: 0, color: q.attempted ? colorForPct(q.accuracy_pct) : 'var(--db-text-3)' }}>
                                                            {q.attempted ? `${q.accuracy_pct}%` : '—'}
                                                        </p>
                                                        <p style={{ fontSize: '12px', color: 'var(--db-text-3)', margin: 0 }}>accuracy</p>
                                                    </div>
                                                </div>
                                                <div style={{ height: '8px', borderRadius: '999px', background: 'var(--db-card-2)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: q.attempted ? `${Math.max(2, q.accuracy_pct)}%` : '0%', background: q.attempted ? colorForPct(q.accuracy_pct) : 'var(--db-card-2)', transition: 'width 300ms ease' }} />
                                                </div>
                                                <div style={{ display: 'flex', gap: '10px', fontSize: '12px', flexWrap: 'wrap' }}>
                                                    <span style={{ color: C.green, fontWeight: 600 }}>{q.correct} correct</span>
                                                    <span style={{ color: C.red, fontWeight: 600 }}>{q.wrong} wrong</span>
                                                    {q.pending > 0 && <span style={{ color: C.amber, fontWeight: 600 }}>{q.pending} pending</span>}
                                                    <span style={{ color: 'var(--db-text-3)', fontWeight: 600 }}>{q.blank} blank</span>
                                                </div>
                                                {dist.length > 0 && total > 0 && (
                                                    <div>
                                                        <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0', color: 'var(--db-text-3)', margin: '0 0 6px 0' }}>Answer distribution</p>
                                                        <div style={{ display: 'flex', height: '22px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--db-border)' }}>
                                                            {dist.map((d, i) => (
                                                                <div key={i} title={`"${d.label}" — ${d.count} answer${d.count !== 1 ? 's' : ''}`} style={{ width: total ? `${(d.count / total) * 100}%` : 0, background: [C.violet, C.blue, C.cyan, C.amber, C.green, C.red][i % 6], minWidth: d.count ? '4px' : 0, cursor: 'default' }} />
                                                            ))}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                            {dist.map((d, i) => (
                                                                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--db-text-3)' }}>
                                                                    <span style={{ width: 8, height: 8, borderRadius: 2, background: [C.violet, C.blue, C.cyan, C.amber, C.green, C.red][i % 6], display: 'inline-block' }} />
                                                                    {d.label} · {d.count}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* ── Student × question matrix ── */}
                        {matrix.length > 0 && questions.length > 0 && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Answer matrix</h2>
                                    <p style={{ fontSize: '13px', color: 'var(--db-text-3)', margin: 0 }}>One row per student — spot who skipped questions or where the whole class tripped.</p>
                                </div>
                                <div style={{ backgroundColor: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '14px', overflowX: 'auto', boxShadow: 'var(--card-shadow)' }}>
                                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '520px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--db-border)' }}>
                                                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '12px', fontWeight: 700, letterSpacing: '0', color: 'var(--db-text-3)' }}>Student</th>
                                                {questions.map((q) => (
                                                    <th key={q.id} style={{ textAlign: 'center', padding: '12px 8px', fontSize: '12px', fontWeight: 700, color: 'var(--db-text-3)' }} title={q.text}>Q{q.order}</th>
                                                ))}
                                                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '12px', fontWeight: 700, letterSpacing: '0', color: 'var(--db-text-3)' }}>Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {matrix.map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--db-border)' }}>
                                                    <td style={{ padding: '10px 16px', fontSize: '14px', fontWeight: 600, color: 'var(--db-text)', whiteSpace: 'nowrap' }}>{row.student}</td>
                                                    {row.cells.map((cell, j) => (
                                                        <td key={j} style={{ textAlign: 'center', padding: '10px 8px' }}>
                                                            <span
                                                                title={cell.state === 'correct' ? 'Correct' : cell.state === 'wrong' ? 'Wrong' : cell.state === 'pending' ? 'Awaiting grade' : 'Not answered'}
                                                                style={{
                                                                    width: '22px', height: '22px', borderRadius: '7px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '13px', fontWeight: 700,
                                                                    background: cell.state === 'correct' ? 'rgba(16,185,129,0.15)' : cell.state === 'wrong' ? 'rgba(239,68,68,0.15)' : cell.state === 'pending' ? 'rgba(245,158,11,0.15)' : 'var(--db-card-2)',
                                                                    color: cell.state === 'correct' ? C.green : cell.state === 'wrong' ? C.red : cell.state === 'pending' ? C.amber : 'var(--db-text-3)',
                                                                }}
                                                            >
                                                                {cell.state === 'correct' ? '✓' : cell.state === 'wrong' ? '✗' : cell.state === 'pending' ? '…' : '—'}
                                                            </span>
                                                        </td>
                                                    ))}
                                                    <td style={{ textAlign: 'right', padding: '10px 16px', fontSize: '14px', fontWeight: 800, color: colorForPct(row.score_pct), whiteSpace: 'nowrap' }}>{row.score_pct}%</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', gap: '18px', marginTop: '12px', fontSize: '13px', color: 'var(--db-text-3)', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(16,185,129,0.25)', display: 'inline-block' }} /> Correct</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(239,68,68,0.25)', display: 'inline-block' }} /> Wrong</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'rgba(245,158,11,0.25)', display: 'inline-block' }} /> Pending grade</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: 12, height: 12, borderRadius: 4, background: 'var(--db-card-2)', display: 'inline-block' }} /> Not answered</span>
                                </div>
                            </div>
                        )}
                        <SimilarityPanel activityId={activityId} />
                    </>
                )}
            </div>

            {/* Export picker — every sheet on by default, one Excel file */}
            {showExportModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={() => setShowExportModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }} />
                    <div style={{ position: 'relative', zIndex: 1, background: 'var(--db-card)', border: '1px solid var(--db-border)', borderRadius: '16px', padding: '26px', width: 'min(480px, 100%)', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--db-text)' }}>Export to Excel</h3>
                            <button onClick={() => setShowExportModal(false)} type="button" style={{ background: 'transparent', border: 'none', color: 'var(--db-text-3)', cursor: 'pointer', display: 'flex' }}>
                                <EyeOff size={18} />
                            </button>
                        </div>
                        <p style={{ fontSize: '13.5px', color: 'var(--db-text-3)', margin: '0 0 18px' }}>
                            Pick the sheets you want — everything is included by default.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
                            {[
                                { key: 'results', label: 'Results', desc: 'One row per student — rank, score, %, duration, submitted time; non-submitters listed' },
                                { key: 'itemAnalysis', label: 'Item analysis', desc: 'Per question: correct / wrong / blank, accuracy, Easy–Moderate–Hard rating' },
                                { key: 'matrix', label: 'Student × question matrix', desc: '✓ / ✕ grid — spot who skipped what at a glance' },
                                { key: 'summary', label: 'Class summary', desc: 'Averages, median, pass rate, score distribution, per-type accuracy, flagged insights' },
                            ].map((opt) => (
                                <label
                                    key={opt.key}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${exportSel[opt.key] ? 'rgba(10,132,255,0.45)' : 'var(--db-border)'}`, background: exportSel[opt.key] ? 'rgba(10,132,255,0.07)' : 'transparent', cursor: 'pointer' }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={exportSel[opt.key]}
                                        onChange={(e) => setExportSel((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                                        style={{ marginTop: '3px', accentColor: '#0a84ff', width: 16, height: 16 }}
                                    />
                                    <span>
                                        <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--db-text)' }}>{opt.label}</span>
                                        <span style={{ display: 'block', fontSize: '12.5px', color: 'var(--db-text-3)', marginTop: '2px', lineHeight: 1.45 }}>{opt.desc}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowExportModal(false)} type="button" style={{ padding: '10px 16px', background: 'transparent', border: '1px solid var(--db-border)', borderRadius: '9px', color: 'var(--db-text-2)', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    setExporting(true);
                                    try {
                                        await handleExport(exportSel);
                                        setShowExportModal(false);
                                    } finally {
                                        setExporting(false);
                                    }
                                }}
                                disabled={exporting || !Object.values(exportSel).some(Boolean)}
                                type="button"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#0a84ff', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: exporting ? 'wait' : 'pointer', opacity: exporting || !Object.values(exportSel).some(Boolean) ? 0.6 : 1 }}
                            >
                                <Download size={14} />
                                {exporting ? 'Building…' : 'Download Excel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
