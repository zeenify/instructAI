import { useMemo, useState } from 'react';
import { Trash2, Loader2, GraduationCap, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../ui/ConfirmModal';
import Dropdown from '../ui/Dropdown';
import { SkeletonBlock } from '../ui/skeletons';
import {
    useAdminWhitelist,
    useAddWhitelistEntries,
    useRemoveWhitelistEntry,
    useClassesForGraduation,
    useClassRoster,
    useGraduateWhitelistEntries,
    useReEnrollWhitelistEntries,
} from '../../queries/admin';
import '../../pages/admin/Admin.css';

// Registration gate manager: only pre-approved identifiers (student LRNs /
// teacher emails) can register or sign up with Google. One component, two
// kinds — the payload and columns differ, the mechanics are identical.
//
// Students additionally carry an enrollment STATUS: Active (graduated_at
// NULL) or Graduated (timestamp set). Graduating revokes every session and
// blocks future logins; re-enrolling restores access. Bulk paths exist
// because a graduating cohort is dozens of LRNs, not one — and every bulk
// path previews WHO it affects before it can be confirmed.
const CONFIG = {
    students: {
        label: 'Student LRNs',
        endpoint: 'student-whitelist',
        listKey: 'students',
        unit: 'LRN(s)',
        bulkLabel: 'Add student LRNs',
        // Q&A: the LRN gate is the "only actually-enrolled kids" rule — the
        // 12-digit number comes from the school registry.
        explainer: 'A student can register only with an LRN on this list — after they register, the row shows Registered. When a cohort finishes school, mark it Graduated: everyone is signed out immediately, the LRN cannot register or log in again, and nothing is deleted. Re-enroll undoes it.',
        searchPlaceholder: 'Search LRN or name…',
        placeholder: 'One per line — 137548123456, Juan Dela Cruz',
        lineError: 'Each line needs a 12-digit LRN (numbers only). First and last name are optional.',
        parseLine: (line) => {
            const parts = line.split(/[,\t]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
            const lrn = parts.find((p) => /^\d{12}$/.test(p));
            if (!lrn) return null;
            const rest = parts.filter((p) => p !== lrn);
            return { lrn_number: lrn, first_name: rest[0] || null, last_name: rest[1] || null };
        },
        columns: (item) => [
            { head: 'LRN', node: <span className="ad-cell-sub mono">{item.lrn_number}</span> },
            { head: 'Name', node: <span className="ad-cell-title">{[item.first_name, item.last_name].filter(Boolean).join(' ') || '—'}</span> },
        ],
    },
    teachers: {
        label: 'Teacher invites',
        endpoint: 'teacher-whitelist',
        listKey: 'teachers',
        unit: 'invite(s)',
        bulkLabel: 'Add teacher invites',
        // Q&A: an invite is NOT an account. Pre-approving the email is the
        // school's staff-vetting step; the person still creates their own
        // password (or uses Google) and the invite becomes Registered — one
        // teacher, one email, no reuse.
        explainer: 'An invite allows exactly one teacher to register — it is not an account yet. Add their DepEd email; after they register, the invite shows Registered so nobody else can use that email.',
        searchPlaceholder: 'Search email or name…',
        placeholder: 'One per line — ms.santos@deped.gov.ph, Ana Santos, Master Teacher I',
        lineError: 'Each line needs a valid email address. Name and position are optional.',
        parseLine: (line) => {
            const parts = line.split(/[,\t]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
            const email = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
            if (!email) return null;
            const rest = parts.filter((p) => p !== email);
            return { email: email.toLowerCase(), first_name: rest[0] || null, last_name: rest[1] || null, position: rest[2] || null };
        },
        columns: (item) => [
            { head: 'Email', node: <span className="ad-cell-sub mono">{item.email}</span> },
            { head: 'Name', node: <span className="ad-cell-title">{[item.first_name, item.last_name].filter(Boolean).join(' ') || '—'}</span> },
            { head: 'Position', node: <span className="ad-cell-sub">{item.position || '—'}</span> },
        ],
    },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function WhitelistManager({ kind }) {
    const cfg = CONFIG[kind];
    const isStudents = kind === 'students';

    const { data, isLoading } = useAdminWhitelist(kind);
    const addEntries = useAddWhitelistEntries(kind);
    const removeEntry = useRemoveWhitelistEntry(kind);
    const { data: classData, isLoading: classesLoading } = useClassesForGraduation(isStudents);
    const graduateEntries = useGraduateWhitelistEntries(kind);
    const reEnrollEntries = useReEnrollWhitelistEntries(kind);

    const [bulkText, setBulkText] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    // Graduation state (students only)
    const [selected, setSelected] = useState(() => new Set());
    const [classId, setClassId] = useState('');
    const [statusText, setStatusText] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    // Class roster preview: picking a class never acts blindly — the modal
    // lists the names first, and only its confirm button fires the action.
    const [rosterAction, setRosterAction] = useState(null);

    // Filter/search state
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    const items = useMemo(() => data?.[cfg.listKey] ?? [], [data, cfg.listKey]);
    const classes = classData?.classes ?? [];
    const busyStatus = graduateEntries.isPending || reEnrollEntries.isPending;

    const {
        data: rosterData,
        isLoading: rosterLoading,
        isError: rosterError,
    } = useClassRoster(rosterAction?.classId, rosterAction !== null);
    const roster = rosterData?.students ?? [];

    const handleBulkAdd = async () => {
        if (!bulkText.trim() || addEntries.isPending) return;
        const lines = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const entries = lines.map(cfg.parseLine);
        if (entries.some((e) => !e) || entries.length === 0) {
            toast.error(cfg.lineError);
            return;
        }
        try {
            const res = await addEntries.mutateAsync(entries);
            toast.success(res.data?.message || `Added ${entries.length} ${kind === 'students' ? 'LRN(s)' : 'invite(s)'}.`);
            setBulkText('');
        } catch {/* api layer toasts */}
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        try {
            await removeEntry.mutateAsync(pendingDelete.id);
            toast.success('Removed from the whitelist.');
        } catch {/* api layer toasts */}
        setPendingDelete(null);
    };

    // ── Filtering / search ────────────────────────────────────────
    const visibleItems = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((i) => {
            if (isStudents && statusFilter === 'active' && i.graduated_at) return false;
            if (isStudents && statusFilter === 'graduated' && !i.graduated_at) return false;
            if (!q) return true;
            const hay = `${i.lrn_number ?? ''} ${i.email ?? ''} ${i.first_name ?? ''} ${i.last_name ?? ''}`.toLowerCase();
            return hay.includes(q);
        });
    }, [items, isStudents, statusFilter, search]);

    const activeCount = isStudents ? items.filter((i) => !i.graduated_at).length : items.length;
    const graduatedCount = isStudents ? items.filter((i) => i.graduated_at).length : 0;

    // ── Graduation actions ────────────────────────────────────────
    const toggleSelected = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Select-all only ever touches the rows on screen — filtered-out rows
    // must never be swept into a bulk graduation unseen.
    const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((i) => selected.has(i.id));
    const toggleAll = () => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                visibleItems.forEach((i) => next.delete(i.id));
            } else {
                visibleItems.forEach((i) => next.add(i.id));
            }
            return next;
        });
    };

    const selectedLrns = items.filter((i) => selected.has(i.id)).map((i) => i.lrn_number);

    const runStatusAction = async (action) => {
        if (!action) return;
        const { mode, lrns, classId: id } = action;
        const actions = lrns ? { lrn_numbers: lrns } : { class_id: Number(id) };
        const mutation = mode === 'graduate' ? graduateEntries : reEnrollEntries;
        try {
            const res = await mutation.mutateAsync({ actions });
            // The backend message includes counts — and reports pasted LRNs
            // that matched nobody, so typos never disappear silently.
            toast.success(res.data?.message || 'Enrollment status updated.');
            setSelected(new Set());
            setStatusText('');
            setClassId('');
            setConfirmAction(null);
            setRosterAction(null);
        } catch {/* api layer toasts */}
    };

    const statusLines = statusText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const statusLrns = statusLines.map(cfg.parseLine).filter(Boolean).map((e) => e.lrn_number);
    const statusBad = statusLines.length - statusLrns.length;

    const confirmCopy = (() => {
        if (!confirmAction) return { title: '', message: '', confirmText: '' };
        const graduate = confirmAction.mode === 'graduate';
        const what = confirmAction.lrns
            ? `${confirmAction.lrns.length} pasted LRN(s)`
            : `${selectedLrns.length} selected student(s)`;
        return {
            title: graduate ? 'Graduate these students?' : 'Re-enroll these students?',
            message: graduate
                ? `This marks ${what} as Graduated: their sessions end immediately and they cannot log in until an admin re-enrolls them. Their work and grades are kept. LRNs that are already graduated are skipped.`
                : `This restores login access for ${what}. They will need to sign in again.`,
            confirmText: graduate ? 'Graduate' : 'Re-enroll',
        };
    })();

    // ── Class roster preview modal ────────────────────────────────
    const rosterClass = classes.find((c) => String(c.id) === String(rosterAction?.classId));
    const rosterToGraduate = roster.filter((s) => !s.graduated_at).length;
    const rosterToReEnroll = roster.filter((s) => s.graduated_at).length;
    const graduateMode = rosterAction?.mode === 'graduate';
    const rosterTargetCount = graduateMode ? rosterToGraduate : rosterToReEnroll;

    return (
        <div className="db-card">
            <div className="db-section-row">
                <div>
                    <h3 className="db-section-title">{cfg.label}</h3>
                    <p className="db-section-sub">{cfg.explainer}</p>
                </div>
            </div>

            <div className="ad-bulk">
                <div className="ad-bulk-col">
                    <span className="ad-grad-label">{cfg.bulkLabel}</span>
                    <textarea
                        className="ad-bulk-input"
                        rows={3}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder={cfg.placeholder}
                        aria-label={`Bulk add ${cfg.label}`}
                    />
                    {(() => {
                        const lines = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
                        if (lines.length === 0) return null;
                        const valid = lines.filter(cfg.parseLine).length;
                        const bad = lines.length - valid;
                        return (
                            <p className="ad-bulk-hint">
                                {valid > 0 && <span className="ok">{valid} valid</span>}
                                {valid > 0 && bad > 0 ? ' · ' : ''}
                                {bad > 0 && <span className="bad">{bad} unparseable — {cfg.lineError}</span>}
                                {bad === 0 && valid > 0 ? ` — ready to add as ${valid} ${cfg.unit}` : ''}
                            </p>
                        );
                    })()}
                </div>
                <button className="db-btn-primary" onClick={handleBulkAdd} disabled={addEntries.isPending || !bulkText.trim()}>
                    {addEntries.isPending ? <Loader2 size={15} className="ad-spin" /> : null}
                    {addEntries.isPending ? 'Saving…' : 'Add to whitelist'}
                </button>
            </div>

            {isStudents && (
                <div className="ad-grad-panel">
                    <div className="ad-grad-row">
                        <div className="ad-grad-col">
                            <span className="ad-grad-label">Graduate a whole class</span>
                            <p className="ad-grad-hint">
                                Pick the class, review its roster, then confirm — the end-of-school-year path.
                            </p>
                        </div>
                        <div className="ad-grad-actions">
                            <Dropdown
                                value={classId}
                                onChange={setClassId}
                                placeholder="Choose a class…"
                                options={classes.map((c) => ({
                                    value: String(c.id),
                                    label: `${c.name} · ${c.students_count} student${c.students_count === 1 ? '' : 's'}`,
                                }))}
                                icon={<GraduationCap size={14} />}
                            />
                            <button
                                className="db-btn-primary ad-grad-btn"
                                disabled={!classId || busyStatus}
                                onClick={() => setRosterAction({ mode: 'graduate', classId })}
                            >
                                <GraduationCap size={14} />
                                Graduate class…
                            </button>
                            <button
                                className="db-btn-ghost ad-grad-btn"
                                disabled={!classId || busyStatus}
                                onClick={() => setRosterAction({ mode: 're-enroll', classId })}
                            >
                                <RotateCcw size={14} />
                                Re-enroll class…
                            </button>
                        </div>
                    </div>
                    {!classesLoading && classes.length === 0 && (
                        <p className="ad-grad-hint" style={{ margin: '4px 0 0' }}>
                            No classes have enrolled students yet.
                        </p>
                    )}

                    <div className="ad-grad-row ad-grad-row--lrns">
                        <div className="ad-grad-col">
                            <span className="ad-grad-label">Graduate by LRN list</span>
                            <p className="ad-grad-hint">
                                For students not in one class — the registrar&apos;s graduate list, transferees, or
                                individual exceptions. LRNs not found on the whitelist are reported back to you.
                            </p>
                        </div>
                        <div className="ad-grad-actions ad-grad-actions--stack">
                            <textarea
                                className="ad-bulk-input"
                                rows={2}
                                value={statusText}
                                onChange={(e) => setStatusText(e.target.value)}
                                placeholder="One LRN per line — 137548123456"
                                aria-label="LRNs to graduate or re-enroll"
                            />
                            {statusLines.length > 0 && (
                                <p className="ad-bulk-hint">
                                    {statusLrns.length > 0 && <span className="ok">{statusLrns.length} valid</span>}
                                    {statusLrns.length > 0 && statusBad > 0 ? ' · ' : ''}
                                    {statusBad > 0 && <span className="bad">{statusBad} unparseable — LRNs are 12 digits.</span>}
                                </p>
                            )}
                            <div className="ad-grad-btnrow">
                                <button
                                    className="db-btn-primary ad-grad-btn"
                                    disabled={statusLrns.length === 0 || busyStatus}
                                    onClick={() => setConfirmAction({ mode: 'graduate', lrns: statusLrns })}
                                >
                                    <GraduationCap size={14} />
                                    Graduate LRNs
                                </button>
                                <button
                                    className="db-btn-ghost ad-grad-btn"
                                    disabled={statusLrns.length === 0 || busyStatus}
                                    onClick={() => setConfirmAction({ mode: 're-enroll', lrns: statusLrns })}
                                >
                                    <RotateCcw size={14} />
                                    Re-enroll LRNs
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isStudents && selected.size > 0 && (
                <div className="ad-selection-bar" role="status">
                    <span className="ad-selection-count">{selected.size} selected</span>
                    <div className="ad-grad-btnrow">
                        <button
                            className="db-btn-primary ad-grad-btn"
                            disabled={busyStatus}
                            onClick={() => setConfirmAction({ mode: 'graduate', lrns: selectedLrns })}
                        >
                            <GraduationCap size={14} />
                            Graduate selected
                        </button>
                        <button
                            className="db-btn-ghost ad-grad-btn"
                            disabled={busyStatus}
                            onClick={() => setConfirmAction({ mode: 're-enroll', lrns: selectedLrns })}
                        >
                            <RotateCcw size={14} />
                            Re-enroll selected
                        </button>
                        <button className="ad-clear-selection" onClick={() => setSelected(new Set())}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            <div className="ad-filter-row">
                {isStudents && (
                    <div className="ad-tabs" role="tablist" aria-label="Filter by enrollment status">
                        {[
                            { key: 'all', label: 'All', count: items.length },
                            { key: 'active', label: 'Active', count: activeCount },
                            { key: 'graduated', label: 'Graduated', count: graduatedCount },
                        ].map((t) => (
                            <button
                                key={t.key}
                                role="tab"
                                aria-selected={statusFilter === t.key}
                                className={`ad-tab ${statusFilter === t.key ? 'is-active' : ''}`}
                                onClick={() => setStatusFilter(t.key)}
                            >
                                {t.label}
                                <span className="ad-tab-count">{t.count}</span>
                            </button>
                        ))}
                    </div>
                )}
                <div className="ad-search">
                    <Search size={15} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={cfg.searchPlaceholder}
                        aria-label="Search the list"
                    />
                    {search && (
                        <button className="ad-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                </div>
            ) : (
                <div className="ad-table" role="table" aria-label={cfg.label}>
                    {/* Headers come from the column config, never from the first
                        row — an empty whitelist used to render a headerless
                        blank block that read as broken. */}
                    <div className={`ad-tr ad-tr--whitelist ${isStudents ? 'ad-tr--whitelist-students' : ''} ad-th`} role="row">
                        {isStudents && (
                            <span>
                                <input
                                    type="checkbox"
                                    className="ad-checkbox"
                                    aria-label="Select all students"
                                    checked={allVisibleSelected}
                                    onChange={toggleAll}
                                />
                            </span>
                        )}
                        {cfg.columns(items[0] ?? {}).map((c) => <span key={c.head}>{c.head}</span>)}
                        <span>Added</span><span>Status</span><span aria-label="Actions" />
                    </div>
                    {items.length === 0 ? (
                        <p className="ad-empty">The whitelist is empty — nobody can register as {kind === 'students' ? 'a student' : 'a teacher'} yet.</p>
                    ) : visibleItems.length === 0 ? (
                        <p className="ad-empty">No rows match the current search or filter.</p>
                    ) : visibleItems.map((item) => (
                        <div key={item.id} className={`ad-tr ad-tr--whitelist ${isStudents ? 'ad-tr--whitelist-students' : ''}`} role="row">
                            {isStudents && (
                                <span role="cell">
                                    <input
                                        type="checkbox"
                                        className="ad-checkbox"
                                        aria-label={`Select ${item.lrn_number}`}
                                        checked={selected.has(item.id)}
                                        onChange={() => toggleSelected(item.id)}
                                    />
                                </span>
                            )}
                            {cfg.columns(item).map((c, i) => <span key={i} role="cell">{c.node}</span>)}
                            <span className="ad-cell-sub" role="cell">{fmtDate(item.created_at)}</span>
                            <span role="cell">
                                {isStudents && item.graduated_at ? (
                                    <span className="ad-status-stack">
                                        <span className="ad-chip graduated">Graduated</span>
                                        <span className="ad-cell-sub">since {fmtDate(item.graduated_at)}</span>
                                    </span>
                                ) : isStudents ? (
                                    <span className="ad-status-stack">
                                        <span className="ad-chip active">Active</span>
                                        <span className="ad-cell-sub">{item.claimed ? 'Registered' : 'Not registered'}</span>
                                    </span>
                                ) : (
                                    <span className={`ad-chip ${item.claimed ? 'active' : 'available'}`}>
                                        {item.claimed ? 'Registered' : 'Pending'}
                                    </span>
                                )}
                            </span>
                            <span role="cell" style={{ textAlign: 'right' }}>
                                <button className="ad-icon-btn danger" title="Remove from whitelist" onClick={() => setPendingDelete(item)}>
                                    {removeEntry.isPending && removeEntry.variables === item.id
                                        ? <Loader2 size={14} className="ad-spin" />
                                        : <Trash2 size={14} />}
                                </button>
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <ConfirmModal
                isOpen={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                onConfirm={handleDelete}
                loading={removeEntry.isPending}
                title="Remove from the whitelist?"
                message={pendingDelete
                    ? `${pendingDelete.lrn_number || pendingDelete.email} will no longer be able to register. Accounts already created are not affected.`
                    : ''}
                confirmText="Remove"
            />

            <ConfirmModal
                isOpen={confirmAction !== null}
                onClose={() => setConfirmAction(null)}
                onConfirm={() => runStatusAction(confirmAction)}
                loading={busyStatus}
                title={confirmCopy.title}
                message={confirmCopy.message}
                confirmText={confirmCopy.confirmText}
            />

            {/* Class roster preview — the "no blind graduations" step. */}
            {rosterAction && (
                <div className="ad-modal-overlay" onClick={() => setRosterAction(null)}>
                    <div
                        className="ad-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${graduateMode ? 'Graduate' : 'Re-enroll'} class`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="ad-modal-title">
                            {graduateMode ? 'Graduate class' : 'Re-enroll class'} — {rosterClass?.name ?? ''}
                        </h3>
                        <p className="ad-modal-sub">
                            {graduateMode
                                ? 'These students are currently enrolled in this class. Graduating signs them out immediately and blocks login until an admin re-enrolls them. Their work and grades are kept.'
                                : 'Re-enrolling clears the Graduated mark so these students can register or log in again. Already-active students are left alone.'}
                        </p>

                        {rosterLoading ? (
                            <div className="ad-roster-list ad-roster-loading">
                                <Loader2 size={16} className="ad-spin" />
                                Loading class roster…
                            </div>
                        ) : rosterError ? (
                            <div className="ad-roster-list ad-roster-loading">
                                Could not load the class roster — close this and try again.
                            </div>
                        ) : roster.length === 0 ? (
                            <div className="ad-roster-list ad-roster-loading">
                                No students are currently enrolled in this class.
                            </div>
                        ) : (
                            <div className="ad-roster-list">
                                {roster.map((s) => (
                                    <div key={s.id} className="ad-roster-item">
                                        <div className="ad-roster-id">
                                            <span className="ad-roster-name">
                                                {[s.first_name, s.last_name].filter(Boolean).join(' ') || '—'}
                                            </span>
                                            <span className="ad-roster-lrn">{s.lrn_number}</span>
                                        </div>
                                        {s.graduated_at ? (
                                            <span className="ad-chip graduated">Graduated</span>
                                        ) : (
                                            <span className="ad-chip active">Active</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {graduateMode && rosterToGraduate > 0 && rosterToReEnroll > 0 && (
                            <p className="ad-modal-note">
                                {rosterToReEnroll} of these are already graduated and will be left as is.
                            </p>
                        )}

                        <div className="ad-modal-foot">
                            <button className="db-btn-ghost ad-grad-btn" onClick={() => setRosterAction(null)} disabled={busyStatus}>
                                Cancel
                            </button>
                            <button
                                className={graduateMode ? 'db-btn-primary ad-grad-btn' : 'db-btn-ghost ad-grad-btn'}
                                disabled={busyStatus || rosterLoading || rosterError || rosterTargetCount === 0}
                                onClick={() => runStatusAction(rosterAction)}
                            >
                                {busyStatus ? <Loader2 size={14} className="ad-spin" /> : graduateMode ? <GraduationCap size={14} /> : <RotateCcw size={14} />}
                                {busyStatus
                                    ? 'Working…'
                                    : `${graduateMode ? 'Graduate' : 'Re-enroll'} ${rosterTargetCount} student${rosterTargetCount === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
