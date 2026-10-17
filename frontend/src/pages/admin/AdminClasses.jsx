// Every class in the school, with its teacher and load. Oversight only —
// content editing stays with the owning teachers.
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { SkeletonBlock } from '../../components/ui/skeletons';
import { useAdminClasses } from '../../queries/admin';
import './Admin.css';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function AdminClasses() {
    const { data, isLoading } = useAdminClasses();
    const [search, setSearch] = useState('');
    const [q, setQ] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setQ(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const all = data?.classes ?? [];
    const needle = q.toLowerCase();
    const classes = q
        ? all.filter((c) =>
            [c.name, c.class_code, c.teacher, c.teacher_email].filter(Boolean).some((v) => v.toLowerCase().includes(needle)))
        : all;

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="db-title">Classes</h1>
                    <p className="ad-sub">All {all.length} classes in the school, newest first.</p>
                </div>
            </div>

            <div className="ad-toolbar">
                <div className="ad-search">
                    <Search size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search class, code, teacher…"
                        aria-label="Search classes"
                    />
                    {search && <button className="ad-clear" onClick={() => { setSearch(''); setQ(''); }}>×</button>}
                </div>
            </div>

            <div className="db-card">
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                    </div>
                ) : classes.length === 0 ? (
                    <p className="ad-empty">{q ? `No classes match “${q}”.` : 'No classes exist yet.'}</p>
                ) : (
                    <div className="ad-table" role="table" aria-label="Classes">
                        <div className="ad-tr ad-th" role="row">
                            <span>Class</span><span>Teacher</span><span>Students</span><span>Courses</span><span>Classwork</span><span>Created</span>
                        </div>
                        {classes.map((c) => (
                            <div key={c.id} className="ad-tr" role="row">
                                <span className="ad-cell-account" role="cell">
                                    <span className="ad-class-dot" style={c.color ? { background: c.color } : undefined} />
                                    <span style={{ minWidth: 0 }}>
                                        <span className="ad-cell-title">{c.name}</span>
                                        <span className="ad-cell-sub mono">{c.class_code}</span>
                                    </span>
                                </span>
                                <span role="cell">
                                    <span className="ad-cell-title">{c.teacher}</span>
                                    {c.teacher_email && c.teacher !== c.teacher_email && <span className="ad-cell-sub">{c.teacher_email}</span>}
                                </span>
                                <span className="ad-num" role="cell">{c.students_count}</span>
                                <span className="ad-num" role="cell">{c.courses_count}</span>
                                <span className="ad-num" role="cell">{c.activities_count}</span>
                                <span className="ad-cell-sub" role="cell">{fmtDate(c.created_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
