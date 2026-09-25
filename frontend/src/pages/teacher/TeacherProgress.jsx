import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useClasses } from '../../context/ClassContext';
import { useClassDetails } from '../../queries/classDetails';
import { useMonitorStats, useMonitorStudents } from '../../queries/pulse';
import Dropdown from '../../components/ui/Dropdown';
import ClassPulse from './ClassPulse';

/**
 * Sidebar-level Class Progress (Management · Progress). The per-class tab
 * moved here so the sidebar holds the teacher's two "check on me" surfaces:
 * To grade (cross-class queue) and Progress (per-class pulse with a class
 * switcher). Strict 1 class = 1 course: the class's first course drives the
 * monitor queries, same as the class page.
 */
export default function TeacherProgress() {
    const { classes, loading: classesLoading } = useClasses();
    const [searchParams, setSearchParams] = useSearchParams();

    const options = useMemo(
        () => classes.map((c) => ({ value: String(c.id), label: c.name })),
        [classes],
    );

    const requested = searchParams.get('class');
    const valid = options.some((o) => o.value === requested);
    const classId = valid ? Number(requested) : (options[0]?.value ? Number(options[0].value) : null);

    // Keep the URL canonical (?class=…) so views are shareable and switching
    // classes never remounts the shell
    useEffect(() => {
        if (!classesLoading && classId && String(classId) !== requested) {
            const next = new URLSearchParams(searchParams);
            next.set('class', String(classId));
            setSearchParams(next, { replace: true });
        }
    }, [classesLoading, classId, requested, searchParams, setSearchParams]);

    const { data: classroom, isLoading: classLoading } = useClassDetails(classId);
    const course = classroom?.courses?.[0] ?? null;

    // Live stats for the header — same query keys ClassPulse uses, so this
    // shares the cache instead of adding requests
    const { data: stats, isLoading: statsLoading } = useMonitorStats(classId, course?.id);
    const { data: students = [], isLoading: studentsLoading } = useMonitorStudents(classId, course?.id);

    // Only truthful numbers: "100% finished" on a content-less course and a
    // "0% avg" with no quiz attempts read as failures, so they're hidden
    const statParts = [];
    if (stats && (stats.total_items ?? 0) > 0) {
        statParts.push({ b: `${stats.completion_percentage ?? 0}%`, t: ' finished everything' });
    }
    if (stats?.has_quiz_attempts) {
        statParts.push({ b: `${stats.average_quiz_score ?? 0}%`, t: ' avg quiz score' });
    }
    if (!statsLoading && !studentsLoading) {
        statParts.push({ b: String(students.length), t: ` student${students.length !== 1 ? 's' : ''}` });
    }

    return (
        <div className="ed-shell" style={{ paddingBottom: 90 }}>
            <div className="ag-header" style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <p className="pu-kicker" style={{ margin: '0 0 6px' }}>Management · Progress</p>
                        <h1 className="pu-title">Class Progress</h1>
                        {statParts.length > 0 && (
                            <div className="pu-meta">
                                {statParts.map((p, i) => (
                                    <span key={p.t} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                                        {i > 0 && <span style={{ marginRight: 5 }}>·</span>}
                                        <b>{p.b}</b>{p.t}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {options.length > 1 && (
                        <div style={{ minWidth: 230 }}>
                            <Dropdown
                                value={classId ? String(classId) : ''}
                                options={options}
                                onChange={(v) => {
                                    const next = new URLSearchParams(searchParams);
                                    next.set('class', v);
                                    setSearchParams(next, { replace: true });
                                }}
                                fullWidth
                            />
                        </div>
                    )}
                </div>
            </div>

            {!classId || classesLoading || classLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="db-skeleton" style={{ height: 110, borderRadius: 16 }} />
                    <div className="db-skeleton" style={{ height: 220, borderRadius: 16 }} />
                </div>
            ) : !course ? (
                <div className="gb-empty">
                    <div className="gb-empty-icon"><TrendingUp size={22} /></div>
                    <p className="gb-empty-title">No course content yet</p>
                    <p className="gb-empty-sub">Progress appears once this class has course content — add modules in the Content tab.</p>
                </div>
            ) : (
                <ClassPulse key={classId} classId={classId} course={course} embedded />
            )}
        </div>
    );
}
