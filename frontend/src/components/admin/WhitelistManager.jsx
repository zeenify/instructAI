import { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../ui/ConfirmModal';
import { SkeletonBlock } from '../ui/skeletons';
import { useAdminWhitelist, useAddWhitelistEntries, useRemoveWhitelistEntry } from '../../queries/admin';
import '../../pages/admin/Admin.css';

// Registration gate manager: only pre-approved identifiers (student LRNs /
// teacher emails) can register or sign up with Google. One component, two
// kinds — the payload and columns differ, the mechanics are identical.
const CONFIG = {
    students: {
        label: 'Student LRNs',
        endpoint: 'student-whitelist',
        listKey: 'students',
        unit: 'LRN(s)',
        // Q&A: the LRN gate is the "only actually-enrolled kids" rule — the
        // 12-digit number comes from the school registry.
        explainer: 'A student registers with their school LRN. If the LRN is on this list, they can create their account; once they do, the LRN is Claimed and nobody can register with it again.',
        placeholder: 'One per line — 137548123456, Juan Dela Cruz, Grade 12 - Sampaguita',
        lineError: 'Each line needs a 12-digit LRN (numbers only). Name, grade level and section are optional.',
        parseLine: (line) => {
            const parts = line.split(/[,\t]|\s{2,}/).map((s) => s.trim()).filter(Boolean);
            const lrn = parts.find((p) => /^\d{12}$/.test(p));
            if (!lrn) return null;
            const rest = parts.filter((p) => p !== lrn);
            return { lrn_number: lrn, first_name: rest[0] || null, last_name: rest[1] || null, grade_level: rest[2] || null, section: rest[3] || null };
        },
        columns: (item) => [
            { head: 'LRN', node: <span className="ad-cell-sub mono">{item.lrn_number}</span> },
            { head: 'Name', node: <span className="ad-cell-title">{[item.first_name, item.last_name].filter(Boolean).join(' ') || '—'}</span> },
            { head: 'Grade / Section', node: <span className="ad-cell-sub">{[item.grade_level, item.section].filter(Boolean).join(' · ') || '—'}</span> },
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
    const { data, isLoading } = useAdminWhitelist(kind);
    const addEntries = useAddWhitelistEntries(kind);
    const removeEntry = useRemoveWhitelistEntry(kind);

    const [bulkText, setBulkText] = useState('');
    const [pendingDelete, setPendingDelete] = useState(null);

    const items = data?.[cfg.listKey] ?? [];

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

            {isLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                    <SkeletonBlock style={{ height: 40, borderRadius: 12 }} />
                </div>
            ) : items.length === 0 ? (
                <p className="ad-empty">The whitelist is empty — nobody can register as {kind === 'students' ? 'a student' : 'a teacher'} yet.</p>
            ) : (
                <div className="ad-table" role="table" aria-label={cfg.label}>
                    <div className="ad-tr ad-th" role="row">
                        {cfg.columns(items[0]).map((c) => <span key={c.head}>{c.head}</span>)}
                        <span>Added</span><span>Status</span><span aria-label="Actions" />
                    </div>
                    {items.map((item) => (
                        <div key={item.id} className="ad-tr" role="row">
                            {cfg.columns(item).map((c, i) => <span key={i} role="cell">{c.node}</span>)}
                            <span className="ad-cell-sub" role="cell">{fmtDate(item.created_at)}</span>
                            <span role="cell">
                                <span className={`ad-chip ${item.claimed ? 'claimed' : 'available'}`}>
                                    {item.claimed ? 'Claimed' : 'Available'}
                                </span>
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
        </div>
    );
}
