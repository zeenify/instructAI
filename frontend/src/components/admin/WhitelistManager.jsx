import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, Loader2, GraduationCap, RotateCcw, Search, Plus, X } from 'lucide-react';
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
        listKey: 'students',
        unit: 'LRN(s)',
        addLabel: 'Add student LRNs',
        addButton: 'Add LRNs',
        explainer: 'Active LRNs can register. Graduating signs students out and prevents them from logging in or registering again.',
        searchPlaceholder: 'Search LRN or name…',
        placeholder: '137548123456, Juan Dela Cruz',
        lineError: 'Each line needs a 12-digit LRN (numbers only). First and last name are optional.',
        parseLine: (line) => {
            const parts = line.split(/[,\t]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
            const lrn = parts.find((p) => /^\d{12}$/.test(p));
            if (!lrn) return null;
            const rest = parts.filter((p) => p !== lrn);
            return { lrn_number: lrn, first_name: rest[0] || null, last_name: rest[1] || null };
        },
    },
    teachers: {
        label: 'Teacher invites',
        listKey: 'teachers',
        unit: 'invite(s)',
        addLabel: 'Add teacher invites',
        addButton: 'Add invites',
        explainer: 'Only invited emails can register as teachers. An invite becomes Registered after its account is created.',
        searchPlaceholder: 'Search email or name…',
        placeholder: 'ms.santos@deped.gov.ph, Ana Santos, Master Teacher I',
        lineError: 'Each line needs a valid email address. Name and position are optional.',
        parseLine: (line) => {
            const parts = line.split(/[,\t]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
            const email = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
            if (!email) return null;
            const rest = parts.filter((p) => p !== email);
            return { email: email.toLowerCase(), first_name: rest[0] || null, last_name: rest[1] || null, position: rest[2] || null };
        },
    },
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

// Small dialog lifecycle shared by the two form dialogs. Keep the latest
// callbacks in refs so a pending request does not restart focus/scroll setup.
function useDialogLifecycle(isOpen, busy, onClose) {
    const dialogRef = useRef(null);
    const busyRef = useRef(busy);
    const closeRef = useRef(onClose);

    useEffect(() => {
        busyRef.current = busy;
        closeRef.current = onClose;
    }, [busy, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKey = (event) => {
            if (event.key === 'Escape') {
                // The shared Dropdown also listens for Escape. Let it close
                // first instead of dismissing the dialog underneath it.
                if (document.querySelector('.dd-menu')) return;
                if (!busyRef.current) {
                    event.stopPropagation();
                    closeRef.current();
                }
                return;
            }
            if (event.key !== 'Tab' || !dialogRef.current) return;
            const focusable = [...dialogRef.current.querySelectorAll(
                'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            )];
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKey);
        const focusTimer = window.setTimeout(() => {
            const target = dialogRef.current?.querySelector('textarea') || dialogRef.current?.querySelector('button');
            target?.focus();
        }, 0);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKey);
            window.clearTimeout(focusTimer);
            if (previousFocus instanceof HTMLElement) previousFocus.focus();
        };
    }, [isOpen]);

    return dialogRef;
}

export default function WhitelistManager({ kind }) {
    const cfg = CONFIG[kind];
    const isStudents = kind === 'students';

    const { data, isLoading } = useAdminWhitelist(kind);
    const addEntries = useAddWhitelistEntries(kind);
    const removeEntry = useRemoveWhitelistEntry(kind);
    const { data: classData, isLoading: classesLoading } = useClassesForGraduation(isStudents);
    const graduateEntries = useGraduateWhitelistEntries(kind);
    const reEnrollEntries = useReEnrollWhitelistEntries(kind);

    const [addOpen, setAddOpen] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    // Graduation state (students only)
    const [selected, setSelected] = useState(() => new Set());
    const [classId, setClassId] = useState('');
    const [statusText, setStatusText] = useState('');
    const [confirmAction, setConfirmAction] = useState(null);
    const [statusModal, setStatusModal] = useState(null);

    // Filter/search state
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch] = useState('');

    const items = useMemo(() => data?.[cfg.listKey] ?? [], [data, cfg.listKey]);
    const classes = classData?.classes ?? [];
    // Rows already on the whitelist, by identifier. Lets the UI warn BEFORE
    // an action instead of the backend silently skipping/no-oping: adding an
    // existing LRN, graduating an already-graduated student, etc.
    const existingByIdentifier = useMemo(() => {
        const map = new Map();
        items.forEach((i) => {
            const key = i.lrn_number ?? i.email;
            if (key) map.set(isStudents ? key : String(key).toLowerCase(), i);
        });
        return map;
    }, [items, isStudents]);
    const busyStatus = graduateEntries.isPending || reEnrollEntries.isPending;
    const statusSource = statusModal?.source ?? 'class';
    const graduateMode = statusModal?.mode !== 're-enroll';

    const {
        data: rosterData,
        isLoading: rosterLoading,
        isError: rosterError,
    } = useClassRoster(classId, statusModal !== null && statusSource === 'class');
    const roster = rosterData?.students ?? [];

    const closeAdd = () => {
        if (!addEntries.isPending) setAddOpen(false);
    };
    const closeStatusModal = () => {
        if (busyStatus) return;
        setStatusModal(null);
        setClassId('');
        setStatusText('');
    };
    const addDialogRef = useDialogLifecycle(addOpen, addEntries.isPending, closeAdd);
    const statusDialogRef = useDialogLifecycle(statusModal !== null, busyStatus, closeStatusModal);

    const handleBulkAdd = async () => {
        if (!bulkText.trim() || addEntries.isPending || bulkStats.newCount === 0) return;
        if (bulkStats.bad > 0) {
            toast.error(cfg.lineError);
            return;
        }
        try {
            const res = await addEntries.mutateAsync(bulkStats.uniqueEntries);
            toast.success(res.data?.message || `Added ${bulkStats.newCount} ${kind === 'students' ? 'LRN(s)' : 'invite(s)'}.`);
            setBulkText('');
            setAddOpen(false);
        } catch {/* api layer toasts */}
    };

    const handleDelete = async () => {
        if (!pendingDelete) return;
        try {
            await removeEntry.mutateAsync(pendingDelete.id);
            toast.success('Removed from the whitelist.');
            setSelected((prev) => {
                const next = new Set(prev);
                next.delete(pendingDelete.id);
                return next;
            });
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

    // Graduating a graduated student is a no-op — so the actions only ever
    // target rows they can actually change, and the skipped count is shown
    // in the confirmation BEFORE the admin commits.
    const selectedItems = items.filter((i) => selected.has(i.id));
    const selectedActiveLrns = selectedItems.filter((i) => !i.graduated_at).map((i) => i.lrn_number);
    const selectedGraduatedLrns = selectedItems.filter((i) => i.graduated_at).map((i) => i.lrn_number);

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
            setStatusModal(null);
        } catch {/* api layer toasts */}
    };

    // What an Add submit would actually do, computed live: dedupe, skip
    // already-whitelisted rows, and say so — never a silent "0 added, 1 updated".
    const bulkStats = useMemo(() => {
        const lines = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const parsed = lines.map(cfg.parseLine).filter(Boolean);
        const unique = new Map();
        parsed.forEach((e) => unique.set(isStudents ? e.lrn_number : e.email, e));
        const existingRows = [];
        unique.forEach((_, key) => {
            const row = existingByIdentifier.get(key);
            if (row) existingRows.push(row);
        });
        return {
            bad: lines.length - parsed.length,
            duplicateCount: parsed.length - unique.size,
            uniqueEntries: [...unique.values()],
            existingCount: existingRows.length,
            existingGraduated: existingRows.filter((r) => r.graduated_at).length,
            existingRegistered: existingRows.filter((r) => r.claimed).length,
            newCount: unique.size - existingRows.length,
        };
    }, [bulkText, cfg, isStudents, existingByIdentifier]);

    // Paste mode: exact live breakdown — how many of the pasted LRNs are
    // active, graduated, or unknown, so the confirm button never promises
    // an action that would partly (or wholly) do nothing.
    const statusStats = useMemo(() => {
        const lines = statusText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
        const parsed = lines.map(cfg.parseLine).filter(Boolean);
        const lrns = [...new Set(parsed.map((e) => e.lrn_number))];
        let active = 0;
        let graduated = 0;
        let unknown = 0;
        lrns.forEach((lrn) => {
            const row = existingByIdentifier.get(lrn);
            if (!row) unknown += 1;
            else if (row.graduated_at) graduated += 1;
            else active += 1;
        });
        return {
            bad: lines.length - parsed.length,
            duplicateCount: parsed.length - lrns.length,
            lrns,
            active,
            graduated,
            unknown,
        };
    }, [statusText, cfg, existingByIdentifier]);
    // Only LRNs the chosen action can actually change are submitted.
    const statusTargetLrns = statusStats.lrns.filter((lrn) => {
        const row = existingByIdentifier.get(lrn);
        return graduateMode ? row && !row.graduated_at : row && row.graduated_at;
    });

    const confirmCopy = (() => {
        if (!confirmAction) return { title: '', message: '', confirmText: '' };
        const graduate = confirmAction.mode === 'graduate';
        const count = confirmAction.lrns?.length ?? 0;
        const skipped = confirmAction.skipped ?? 0;
        const what = `${count} selected student${count === 1 ? '' : 's'}`;
        const skipNote = skipped > 0
            ? ` ${skipped} already-${graduate ? 'graduated' : 'active'} student${skipped === 1 ? '' : 's'} in your selection will be left as is.`
            : '';
        return {
            title: graduate ? 'Graduate these students?' : 'Re-enroll these students?',
            message: graduate
                ? `This marks ${what} as Graduated: their sessions end immediately and they cannot log in until an admin re-enrolls them. Their work and grades are kept.${skipNote}`
                : `This restores login access for ${what}. They will need to sign in again.${skipNote}`,
            confirmText: `${graduate ? 'Graduate' : 'Re-enroll'} ${count} student${count === 1 ? '' : 's'}`,
        };
    })();

    // ── Class roster preview (no blind graduations) ───────────────
    const rosterClass = classes.find((c) => String(c.id) === String(classId));
    const rosterToGraduate = roster.filter((s) => !s.graduated_at).length;
    const rosterToReEnroll = roster.filter((s) => s.graduated_at).length;
    const rosterTargetCount = graduateMode ? rosterToGraduate : rosterToReEnroll;
    const classActionDisabled = !classId || rosterLoading || rosterError || rosterTargetCount === 0;
    const statusActionDisabled = busyStatus || (statusSource === 'class' ? classActionDisabled : statusTargetLrns.length === 0);

    const openStatusModal = () => {
        setClassId('');
        setStatusText('');
        setStatusModal({ mode: 'graduate', source: 'class' });
    };
    const setStatusMode = (mode) => setStatusModal((prev) => ({ ...prev, mode }));
    const setStatusSource = (source) => setStatusModal((prev) => ({ ...prev, source }));

    return (
        <div className="ad-whitelist">
            <div className="ad-whitelist-head">
                <div>
                    <h3 className="db-section-title">{cfg.label}</h3>
                    <p className="db-section-sub">{cfg.explainer}</p>
                </div>
                <div className="ad-whitelist-actions">
                    {isStudents && (
                        <button className="db-btn-ghost ad-header-btn" onClick={openStatusModal} disabled={busyStatus}>
                            <GraduationCap size={16} />
                            Graduate / re-enroll
                        </button>
                    )}
                    <button className="db-btn-primary ad-header-btn" onClick={() => setAddOpen(true)}>
                        <Plus size={16} />
                        {cfg.addButton}
                    </button>
                </div>
            </div>

            <section className="db-card ad-list-card" aria-label={`${cfg.label} list`}>
                <div className="ad-filter-row">
                    {isStudents && (
                        <div className="ad-tabs" role="group" aria-label="Filter by enrollment status">
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

                {isStudents && selected.size > 0 && (
                    <div className="ad-selection-bar" role="status">
                        <span className="ad-selection-count">{selected.size} selected</span>
                        <div className="ad-grad-btnrow">
                            <button
                                className="db-btn-primary ad-grad-btn"
                                disabled={busyStatus || selectedActiveLrns.length === 0}
                                title={selectedActiveLrns.length === 0 ? 'Everyone selected is already graduated' : undefined}
                                onClick={() => setConfirmAction({ mode: 'graduate', lrns: selectedActiveLrns, skipped: selectedGraduatedLrns.length })}
                            >
                                <GraduationCap size={14} />
                                Graduate selected
                            </button>
                            <button
                                className="db-btn-ghost ad-grad-btn"
                                disabled={busyStatus || selectedGraduatedLrns.length === 0}
                                title={selectedGraduatedLrns.length === 0 ? 'No graduated students are selected' : undefined}
                                onClick={() => setConfirmAction({ mode: 're-enroll', lrns: selectedGraduatedLrns, skipped: selectedActiveLrns.length })}
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
                    <div className="ad-table-loading">
                        <SkeletonBlock style={{ height: 48, borderRadius: 10 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 10 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 10 }} />
                    </div>
                ) : items.length === 0 ? (
                    <div className="ad-empty-state">
                        <h4>No {isStudents ? 'student LRNs' : 'teacher invites'} yet</h4>
                        <p>Add {isStudents ? 'an LRN' : 'an email'} to allow {isStudents ? 'students' : 'teachers'} to register.</p>
                        <button className="db-btn-primary ad-header-btn" onClick={() => setAddOpen(true)}>
                            <Plus size={15} /> {cfg.addButton}
                        </button>
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="ad-empty-state">
                        <h4>No {isStudents ? 'LRNs' : 'invites'} match these filters</h4>
                        <p>Try another search or show all entries.</p>
                        <button className="db-btn-ghost ad-header-btn" onClick={() => { setSearch(''); setStatusFilter('all'); }}>
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className="ad-table" role="table" aria-label={cfg.label}>
                        <div className={`ad-tr ad-tr--whitelist ${isStudents ? 'ad-tr--whitelist-students' : 'ad-tr--whitelist-teachers'} ad-th`} role="row">
                            {isStudents && (
                                <span role="columnheader">
                                    <input
                                        type="checkbox"
                                        className="ad-checkbox"
                                        aria-label="Select all visible students"
                                        checked={allVisibleSelected}
                                        onChange={toggleAll}
                                    />
                                </span>
                            )}
                            <span role="columnheader">{isStudents ? 'Student' : 'Teacher'}</span>
                            {!isStudents && <span className="ad-col-position" role="columnheader">Position</span>}
                            <span className="ad-col-added" role="columnheader">Added</span>
                            <span role="columnheader">Status</span>
                            <span aria-label="Actions" role="columnheader" />
                        </div>
                        {visibleItems.map((item) => {
                            const identifier = item.lrn_number || item.email;
                            const name = [item.first_name, item.last_name].filter(Boolean).join(' ');
                            return (
                                <div key={item.id} className={`ad-tr ad-tr--whitelist ${isStudents ? 'ad-tr--whitelist-students' : 'ad-tr--whitelist-teachers'}`} role="row">
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
                                    <span className="ad-identity" role="cell">
                                        <span className={`ad-cell-title ${!name ? 'mono' : ''}`}>{name || identifier}</span>
                                        <span className={`ad-cell-sub ${name ? 'mono' : ''}`}>{name ? identifier : 'Name not provided'}</span>
                                    </span>
                                    {!isStudents && <span className="ad-cell-sub ad-col-position" role="cell">{item.position || '—'}</span>}
                                    <span className="ad-cell-sub ad-col-added" role="cell">{fmtDate(item.created_at)}</span>
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
                                    <span role="cell" className="ad-row-actions">
                                        <button className="ad-icon-btn danger" title="Remove from whitelist" aria-label={`Remove ${identifier}`} onClick={() => setPendingDelete(item)}>
                                            {removeEntry.isPending && removeEntry.variables === item.id
                                                ? <Loader2 size={14} className="ad-spin" />
                                                : <Trash2 size={14} />}
                                        </button>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

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
                variant="danger"
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

            {addOpen && (
                <div className="ad-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeAdd(); }}>
                    <div ref={addDialogRef} className="ad-modal ad-modal-form" role="dialog" aria-modal="true" aria-labelledby="ad-add-title" aria-describedby="ad-add-description">
                        <button className="ad-modal-close" aria-label="Close add dialog" onClick={closeAdd} disabled={addEntries.isPending}>
                            <X size={18} />
                        </button>
                        <h3 className="ad-modal-title" id="ad-add-title">{cfg.addLabel}</h3>
                        <p className="ad-modal-sub" id="ad-add-description">
                            Paste one {isStudents ? 'LRN' : 'email'} per line.
                            {isStudents ? ' Optionally add the student’s name after a comma.' : ' Optionally add a name and position after commas.'}
                        </p>
                        <textarea
                            className="ad-bulk-input"
                            rows={6}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder={cfg.placeholder}
                            aria-label={cfg.addLabel}
                            disabled={addEntries.isPending}
                        />
                        {bulkText.trim() === '' ? (
                            <p className="ad-bulk-hint">Names are optional; you can also paste them later.</p>
                        ) : (
                            <p className="ad-bulk-hint" aria-live="polite">
                                {bulkStats.bad > 0
                                    ? <span className="bad">{bulkStats.bad} invalid — {cfg.lineError}</span>
                                    : [
                                        bulkStats.duplicateCount > 0 && `${bulkStats.duplicateCount} duplicate${bulkStats.duplicateCount === 1 ? '' : 's'} removed`,
                                        bulkStats.existingCount > 0 && `⚠ ${bulkStats.existingCount} already whitelisted — will be skipped`
                                            + (isStudents && bulkStats.existingGraduated > 0
                                                ? ` (${bulkStats.existingGraduated} graduated — use Re-enroll to restore access)`
                                                : (!isStudents && bulkStats.existingRegistered > 0
                                                    ? ` (${bulkStats.existingRegistered} registered)`
                                                    : '')),
                                        bulkStats.newCount > 0 && `${bulkStats.newCount} ${cfg.unit} ready to add`,
                                        bulkStats.newCount === 0 && 'Nothing new to add.',
                                    ].filter(Boolean).join(' · ')}
                            </p>
                        )}
                        <div className="ad-modal-foot">
                            <button className="db-btn-ghost ad-grad-btn" onClick={closeAdd} disabled={addEntries.isPending}>Cancel</button>
                            <button className="db-btn-primary ad-grad-btn" onClick={handleBulkAdd} disabled={addEntries.isPending || bulkStats.bad > 0 || bulkStats.newCount === 0}>
                                {addEntries.isPending ? <Loader2 size={15} className="ad-spin" /> : <Plus size={15} />}
                                {addEntries.isPending ? 'Adding…' : bulkStats.bad === 0 && bulkStats.newCount > 0 ? `${cfg.addButton} (${bulkStats.newCount})` : cfg.addButton}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {statusModal && (
                <div className="ad-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeStatusModal(); }}>
                    <div ref={statusDialogRef} className="ad-modal ad-modal-form ad-status-modal" role="dialog" aria-modal="true" aria-labelledby="ad-status-title" aria-describedby="ad-status-description">
                        <button className="ad-modal-close" aria-label="Close enrollment status dialog" onClick={closeStatusModal} disabled={busyStatus}>
                            <X size={18} />
                        </button>
                        <h3 className="ad-modal-title" id="ad-status-title">Update enrollment status</h3>
                        <p className="ad-modal-sub" id="ad-status-description">
                            {graduateMode
                                ? 'Students are signed out immediately and cannot log in or register again. Their classes, grades, and work are not deleted.'
                                : 'Restores access for students whose graduation is being undone. Previous sessions are not restored; students log in again.'}
                        </p>

                        <div className="ad-dialog-field">
                            <span className="ad-field-label">Action</span>
                            <div className="ad-segmented" role="group" aria-label="Enrollment action">
                                <button className={graduateMode ? 'is-active' : ''} aria-pressed={graduateMode} onClick={() => setStatusMode('graduate')} disabled={busyStatus}>
                                    <GraduationCap size={15} /> Graduate
                                </button>
                                <button className={!graduateMode ? 'is-active' : ''} aria-pressed={!graduateMode} onClick={() => setStatusMode('re-enroll')} disabled={busyStatus}>
                                    <RotateCcw size={15} /> Re-enroll
                                </button>
                            </div>
                        </div>

                        <div className="ad-dialog-field">
                            <span className="ad-field-label">Students</span>
                            <div className="ad-segmented" role="group" aria-label="Choose students by">
                                <button className={statusSource === 'class' ? 'is-active' : ''} aria-pressed={statusSource === 'class'} onClick={() => setStatusSource('class')} disabled={busyStatus}>A whole class</button>
                                <button className={statusSource === 'paste' ? 'is-active' : ''} aria-pressed={statusSource === 'paste'} onClick={() => setStatusSource('paste')} disabled={busyStatus}>Paste an LRN list</button>
                            </div>
                        </div>

                        {statusSource === 'class' ? (
                            <>
                                <div className="ad-dialog-field">
                                    <span className="ad-field-label">Class</span>
                                    <Dropdown
                                        value={classId}
                                        onChange={setClassId}
                                        placeholder={classesLoading ? 'Loading classes…' : 'Choose a class…'}
                                        options={classes.map((c) => ({
                                            value: String(c.id),
                                            label: `${c.name} · ${c.students_count} student${c.students_count === 1 ? '' : 's'}`,
                                        }))}
                                        icon={<GraduationCap size={14} />}
                                        fullWidth
                                    />
                                </div>
                                {!classId ? (
                                    <div className="ad-roster-list ad-roster-loading">
                                        {classesLoading
                                            ? 'Loading available classes…'
                                            : classes.length === 0
                                                ? 'No classes have enrolled students yet.'
                                                : 'Choose a class to review its roster before continuing.'}
                                    </div>
                                ) : rosterLoading ? (
                                    <div className="ad-roster-list ad-roster-loading">
                                        <Loader2 size={16} className="ad-spin" />
                                        Loading class roster…
                                    </div>
                                ) : rosterError ? (
                                    <div className="ad-roster-error" role="alert">
                                        <p>Could not load the class roster. No students have been updated.</p>
                                        <button className="db-btn-ghost ad-grad-btn" onClick={() => setClassId('')} disabled={busyStatus}>
                                            Choose another class
                                        </button>
                                    </div>
                                ) : roster.length === 0 ? (
                                    <div className="ad-roster-list ad-roster-loading">
                                        No students are currently enrolled in this class.
                                    </div>
                                ) : (
                                    <div className="ad-roster-list" aria-label={`${rosterClass?.name || 'Class'} roster`}>
                                        {roster.map((s) => (
                                            <div key={s.id} className="ad-roster-item">
                                                <div className="ad-roster-id">
                                                    <span className="ad-roster-name">
                                                        {[s.first_name, s.last_name].filter(Boolean).join(' ') || s.lrn_number}
                                                    </span>
                                                    <span className="ad-roster-lrn">{s.lrn_number}</span>
                                                </div>
                                                <span className={`ad-chip ${s.graduated_at ? 'graduated' : 'active'}`}>
                                                    {s.graduated_at ? 'Graduated' : 'Active'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {classId && !rosterLoading && !rosterError && roster.length > 0 && (
                                    <p className="ad-modal-note">
                                        {graduateMode && rosterToReEnroll > 0
                                            ? `${rosterToReEnroll} already graduated will be left unchanged.`
                                            : !graduateMode && rosterToGraduate > 0
                                                ? `${rosterToGraduate} already active will be left unchanged.`
                                                : `${rosterTargetCount} student${rosterTargetCount === 1 ? '' : 's'} will be updated.`}
                                    </p>
                                )}
                            </>
                        ) : (
                            <>
                                <textarea
                                    className="ad-bulk-input ad-status-input"
                                    rows={5}
                                    value={statusText}
                                    onChange={(e) => setStatusText(e.target.value)}
                                    placeholder="One LRN per line — 137548123456"
                                    aria-label="LRNs to graduate or re-enroll"
                                    disabled={busyStatus}
                                />
                                <p className="ad-bulk-hint" aria-live="polite">
                                    {[
                                        statusStats.lrns.length > 0 && `${statusStats.lrns.length} unique LRN${statusStats.lrns.length === 1 ? '' : 's'}`,
                                        statusStats.duplicateCount > 0 && `${statusStats.duplicateCount} duplicate${statusStats.duplicateCount === 1 ? '' : 's'} removed`,
                                        statusStats.bad > 0 && `${statusStats.bad} invalid — LRNs are 12 digits`,
                                        statusStats.unknown > 0 && `${statusStats.unknown} not on the whitelist (reported after the update)`,
                                        graduateMode && statusStats.graduated > 0 && `${statusStats.graduated} already graduated — will be skipped`,
                                        !graduateMode && statusStats.active > 0 && `${statusStats.active} already active — will be skipped`,
                                        statusStats.lrns.length > 0 && statusTargetLrns.length === 0 && `⚠ Nothing to ${graduateMode ? 'graduate' : 're-enroll'} here.`,
                                    ].filter(Boolean).join(' · ') || 'One 12-digit LRN per line.'}
                                </p>
                            </>
                        )}

                        <div className="ad-modal-foot">
                            <button className="db-btn-ghost ad-grad-btn" onClick={closeStatusModal} disabled={busyStatus}>Cancel</button>
                            <button
                                className={`${graduateMode ? 'db-btn-primary' : 'db-btn-ghost'} ad-grad-btn`}
                                disabled={statusActionDisabled}
                                onClick={() => runStatusAction({
                                    mode: statusModal.mode,
                                    ...(statusSource === 'class' ? { classId } : { lrns: statusTargetLrns }),
                                })}
                            >
                                {busyStatus ? <Loader2 size={14} className="ad-spin" /> : graduateMode ? <GraduationCap size={14} /> : <RotateCcw size={14} />}
                                {busyStatus
                                    ? 'Working…'
                                    : statusSource === 'class'
                                        ? `${graduateMode ? 'Graduate' : 'Re-enroll'} ${rosterTargetCount} student${rosterTargetCount === 1 ? '' : 's'}`
                                        : `${graduateMode ? 'Graduate' : 'Re-enroll'} ${statusTargetLrns.length} LRN${statusTargetLrns.length === 1 ? '' : 's'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
