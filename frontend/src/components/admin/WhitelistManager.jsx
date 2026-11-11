import { useState } from 'react';
import { Trash2, Loader2, GraduationCap, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../ui/ConfirmModal';
import Dropdown from '../ui/Dropdown';
import { SkeletonBlock } from '../ui/skeletons';
import {
    useAdminWhitelist,
    useAddWhitelistEntries,
    useRemoveWhitelistEntry,
    useClassesForGraduation,
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
// because a graduating cohort is dozens of LRNs, not one.
const CONFIG = {
    students: {
        label: 'Student LRNs',
        endpoint: 'student-whitelist',
        listKey: 'students',
        unit: 'LRN(s)',
        // Q&A: the LRN gate is the "only actually-enrolled kids" rule — the
        // 12-digit number comes from the school registry.
        explainer: 'A student registers with their school LRN. If the LRN is on this list, they can create their account; once they do, the LRN is Claimed and nobody can register with it again. When a student graduates, mark them Graduated — their sessions end immediately and they cannot log in again until an admin re-enrolls them.',
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
        // Q&A: an invite is NOT an account. Pre-approving the email is the
        // school's staff-vetting step; the person still creates their own
        // password (or uses Google) and the invite becomes Claimed — one
        // teacher, one email, no reuse.
        explainer: 'An invite allows one teacher to register — it is not an account yet. Add their DepEd email, they create their own password (or use Google), and the invite flips to Claimed so nobody else can use that email.',
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

    const items = data?.[cfg.listKey] ?? [];
    const classes = classData?.classes ?? [];
    const busyStatus = graduateEntries.isPending || reEnrollEntries.isPending;

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

    // ── Graduation actions ────────────────────────────────────────
    const toggleSelected = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
    };

    const selectedLrns = items.filter((i) => selected.has(i.id)).map((i) => i.lrn_number);

    const openConfirm = (action) => setConfirmAction(action);

    const runStatusAction = async () => {
        if (!confirmAction) return;
        const { mode, lrns, classId: id } = confirmAction;
        const actions = lrns ? { lrn_numbers: lrns } : { class_id: Number(id) };
        const mutation = mode === 'graduate' ? graduateEntries : reEnrollEntries;
        try {
            const res = await mutation.mutateAsync({ actions });
            toast.success(res.data?.message || 'Enrollment status updated.');
            setSelected(new Set());
            setStatusText('');
            setClassId('');
        } catch {/* api layer toasts */}
        setConfirmAction(null);
    };

    const statusLines = statusText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const statusLrns = statusLines.map(cfg.parseLine).filter(Boolean).map((e) => e.lrn_number);
    const statusBad = statusLines.length - statusLrns.length;

    const confirmCopy = (() => {
        if (!confirmAction) return { title: '', message: '', confirmText: '' };
        const graduate = confirmAction.mode === 'graduate';
        const what = confirmAction.classId
            ? `every student currently enrolled in "${classes.find((c) => String(c.id) === confirmAction.classId)?.name || 'this class'}"`
            : `${confirmAction.lrns?.length ?? 0} selected LRN(s)`;
        return {
            title: graduate ? 'Graduate these students?' : 'Re-enroll these students?',
            message: graduate
                ? `This marks ${what} as Graduated: their sessions end immediately and they cannot log in until re-enrolled. Their work and grades are kept.`
                : `This restores login access for ${what}. They will need to sign in again.`,
            confirmText: graduate ? 'Graduate' : 'Re-enroll',
        };
    })();

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
                                Marks every student currently enrolled in the class — the end-of-year path.
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
                                onClick={() => openConfirm({ mode: 'graduate', classId })}
                            >
                                <GraduationCap size={14} />
                                Graduate class
                            </button>
                            <button
                                className="db-btn-ghost ad-grad-btn"
                                disabled={!classId || busyStatus}
                                onClick={() => openConfirm({ mode: 're-enroll', classId })}
                            >
                                <RotateCcw size={14} />
                                Re-enroll class
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
                            <span className="ad-grad-label">Graduate by LRN</span>
                            <p className="ad-grad-hint">
                                Paste LRNs (one per line) when they are not in one class — exceptions and transfers.
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
                                    onClick={() => openConfirm({ mode: 'graduate', lrns: statusLrns })}
                                >
                                    <GraduationCap size={14} />
                                    Graduate LRNs
                                </button>
                                <button
                                    className="db-btn-ghost ad-grad-btn"
                                    disabled={statusLrns.length === 0 || busyStatus}
                                    onClick={() => openConfirm({ mode: 're-enroll', lrns: statusLrns })}
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
                            onClick={() => openConfirm({ mode: 'graduate', lrns: selectedLrns })}
                        >
                            <GraduationCap size={14} />
                            Graduate selected
                        </button>
                        <button
                            className="db-btn-ghost ad-grad-btn"
                            disabled={busyStatus}
                            onClick={() => openConfirm({ mode: 're-enroll', lrns: selectedLrns })}
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
                                    checked={items.length > 0 && selected.size === items.length}
                                    onChange={toggleAll}
                                />
                            </span>
                        )}
                        {cfg.columns(items[0] ?? {}).map((c) => <span key={c.head}>{c.head}</span>)}
                        <span>Added</span><span>Status</span><span aria-label="Actions" />
                    </div>
                    {items.length === 0 ? (
                        <p className="ad-empty">The whitelist is empty — nobody can register as {kind === 'students' ? 'a student' : 'a teacher'} yet.</p>
                    ) : items.map((item) => (
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
                                    <>
                                        <span className="ad-chip graduated">Graduated</span>
                                        <span className="ad-cell-sub">since {fmtDate(item.graduated_at)}</span>
                                    </>
                                ) : (
                                    <span className={`ad-chip ${item.claimed ? 'claimed' : 'available'}`}>
                                        {item.claimed ? 'Claimed' : 'Available'}
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
                onConfirm={runStatusAction}
                loading={busyStatus}
                title={confirmCopy.title}
                message={confirmCopy.message}
                confirmText={confirmCopy.confirmText}
            />
        </div>
    );
}
