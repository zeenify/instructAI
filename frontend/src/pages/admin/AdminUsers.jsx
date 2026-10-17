// Account management: every teacher + student, with the admin's three levers —
// disable/enable (instant, optimistic — kicks them out now), set password
// (admin-chosen or generated, shown once with copy feedback), delete
// (guarded; empty accounts only).
import { useEffect, useState } from 'react';
import { MoreVertical, Search, KeyRound, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Dropdown from '../../components/ui/Dropdown';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { SkeletonBlock } from '../../components/ui/skeletons';
import { adminUsersKey, useAdminUsers, useSetUserActive, useResetPassword, useDeleteUser } from '../../queries/admin';
import './Admin.css';

const ROLE_FILTERS = [
    { value: 'all', label: 'Everyone' },
    { value: 'teacher', label: 'Teachers' },
    { value: 'student', label: 'Students' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

const suggestPassword = () => {
    const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    const rest = Array.from({ length: 7 }, () => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 51)]).join('');
    return letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)] + letters[Math.floor(Math.random() * letters.length)] + '-' + rest;
};

export default function AdminUsers() {
    const [role, setRole] = useState('all');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState(''); // debounced
    const [confirm, setConfirm] = useState(null);   // { kind: 'disable'|'enable'|'delete', user }
    // The password modal is fully local: it opens INSTANTLY with a generated
    // suggestion the admin can edit, and only touches the server on submit.
    const [pwModal, setPwModal] = useState(null);   // { user, value, stage: 'edit'|'done', final, copied }
    // Optimistic status: shows the new chip immediately while the request runs.
    const [pendingStatus, setPendingStatus] = useState({}); // { [userId]: boolean }

    useEffect(() => {
        const t = setTimeout(() => setQ(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const { data, isLoading } = useAdminUsers(role, q);
    const setActive = useSetUserActive();
    const resetPassword = useResetPassword();
    const deleteUser = useDeleteUser();

    const users = data?.users ?? [];
    const shown = users.map((u) => ({
        ...u,
        is_active: pendingStatus[u.id] !== undefined ? pendingStatus[u.id] : u.is_active,
    }));

    const groupedCounts = {
        teacher: shown.filter((u) => u.role === 'teacher').length,
        student: shown.filter((u) => u.role === 'student').length,
    };

    // ---- Disable / enable: close the dialog NOW, paint the chip NOW. ----
    const runConfirm = async () => {
        if (!confirm) return;
        const { kind, user } = confirm;
        setConfirm(null); // instant close — no frozen wait
        if (kind === 'delete') {
            try {
                await deleteUser.mutateAsync(user.id);
                toast.success('Account deleted.');
            } catch { /* toast surfaced by the hook */ }
            return;
        }
        const active = kind === 'enable';
        setPendingStatus((p) => ({ ...p, [user.id]: active }));
        try {
            const res = await setActive.mutateAsync({ id: user.id, active });
            toast.success(res.data?.message || (active ? 'Account enabled.' : 'Account disabled.'));
        } catch {
            toast.error('Change did not go through — the account keeps its previous state.');
        } finally {
            setPendingStatus((p) => {
                const next = { ...p };
                delete next[user.id];
                return next;
            });
        }
    };

    // ---- Set password ----
    const openReset = (user) => setPwModal({ user, value: suggestPassword(), stage: 'edit', copied: false });

    const submitPassword = async () => {
        const { user, value } = pwModal;
        try {
            const res = await resetPassword.mutateAsync({ id: user.id, password: value });
            setPwModal({ user, stage: 'done', final: res.data?.temp_password || value, copied: false });
        } catch { /* toast surfaced by the hook */ }
    };

    const copyFinal = async () => {
        try {
            await navigator.clipboard.writeText(pwModal.final);
            setPwModal((m) => ({ ...m, copied: true }));
            toast.success('Password copied to your clipboard.');
            setTimeout(() => setPwModal((m) => (m ? { ...m, copied: false } : m)), 1800);
        } catch {
            toast.error('Clipboard is blocked — select the text and copy manually.');
        }
    };

    const busy = setActive.isPending || resetPassword.isPending || deleteUser.isPending;

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="ad-title">Users</h1>
                    <p className="ad-sub">Every account in the school. Disabling cuts access instantly; passwords are set on the spot.</p>
                </div>
            </div>

            <div className="ad-toolbar">
                <Dropdown value={role} options={ROLE_FILTERS} onChange={setRole} />
                <div className="ad-search">
                    <Search size={16} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email, LRN…"
                        aria-label="Search users"
                    />
                    {search && <button className="ad-clear" onClick={() => { setSearch(''); setQ(''); }}>×</button>}
                </div>
            </div>

            <div className="db-card">
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 18 }}>
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 48, borderRadius: 12 }} />
                    </div>
                ) : shown.length === 0 ? (
                    <p className="ad-empty">No accounts match “{q}”.</p>
                ) : (
                    <div className="ad-table" role="table" aria-label="Accounts">
                        <div className="ad-tr ad-th" role="row">
                            <span>Account</span><span>Role</span><span>Detail</span><span>Classes</span><span>Joined</span><span>Status</span><span aria-label="Actions" />
                        </div>
                        {shown.map((u) => {
                            const isSelf = u.role === 'admin';
                            return (
                                <div key={u.id} className="ad-tr" role="row">
                                    <span className="ad-cell-account" role="cell">
                                        <span className={`ad-avatar ${u.role}`}>{(u.name?.[0] || '?').toUpperCase()}</span>
                                        <span style={{ minWidth: 0 }}>
                                            <span className="ad-cell-title">{u.name}</span>
                                            <span className="ad-cell-sub">{u.email}</span>
                                        </span>
                                    </span>
                                    <span role="cell"><span className={`ad-chip ${u.role}`}>{u.role}</span></span>
                                    <span className="ad-cell-sub" role="cell">{u.role === 'teacher' ? (u.organization || '—') : (u.lrn ? `LRN ${u.lrn}` : '—')}</span>
                                    <span className="ad-num" role="cell">{u.classes_count}</span>
                                    <span className="ad-cell-sub" role="cell">{fmtDate(u.created_at)}</span>
                                    <span role="cell">
                                        <span className={`ad-chip ${u.is_active ? 'active' : 'disabled'}`}>{u.is_active ? 'Active' : 'Disabled'}</span>
                                    </span>
                                    <span role="cell" style={{ textAlign: 'right' }}>
                                        {isSelf ? null : (
                                            <Dropdown
                                                value=""
                                                placeholder={<MoreVertical size={17} />}
                                                onChange={(v) => {
                                                    if (v === 'disable' || v === 'enable') setConfirm({ kind: v, user: u });
                                                    if (v === 'reset') openReset(u);
                                                    if (v === 'delete') setConfirm({ kind: 'delete', user: u });
                                                }}
                                                options={u.is_active
                                                    ? [
                                                        { value: 'disable', label: 'Disable account' },
                                                        { value: 'reset', label: 'Set password' },
                                                        { value: 'delete', label: 'Delete account' },
                                                    ]
                                                    : [
                                                        { value: 'enable', label: 'Enable account' },
                                                        { value: 'reset', label: 'Set password' },
                                                        { value: 'delete', label: 'Delete account' },
                                                    ]}
                                            />
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <p className="ad-foot-note">
                {groupedCounts.teacher} teacher and {groupedCounts.student} student accounts in view
                {q ? ` matching “${q}”` : ''} · showing at most 500.
            </p>

            <ConfirmModal
                isOpen={confirm?.kind === 'disable'}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                title={`Disable ${confirm?.user?.name}?`}
                message="They are signed out immediately and cannot log in until re-enabled. Their data stays untouched."
                confirmText="Disable account"
            />
            <ConfirmModal
                isOpen={confirm?.kind === 'enable'}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                title={`Enable ${confirm?.user?.name}?`}
                message="They can log in again right away with their existing password."
                confirmText="Enable account"
            />
            <ConfirmModal
                isOpen={confirm?.kind === 'delete'}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                variant="danger"
                title={`Delete ${confirm?.user?.name}?`}
                message="Deletion is permanent and only works for accounts with no records. Teachers who own classes and students with submissions cannot be deleted — disable them instead."
                confirmText="Delete permanently"
            />

            {/* Set password — opens instantly, admin chooses or keeps the suggestion */}
            {pwModal && (
                <div className="db-modal-backdrop" onClick={() => setPwModal(null)}>
                    <div className="db-modal db-modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="db-modal-head">
                            <span className="db-modal-icon"><KeyRound size={17} /></span>
                            <h3 className="db-modal-title">{pwModal.stage === 'edit' ? `Set password for ${pwModal.user.name}` : 'Password is set'}</h3>
                        </div>
                        {pwModal.stage === 'edit' ? (
                            <>
                                <p className="ad-modal-sub">
                                    Type the password {pwModal.user.role === 'teacher' ? 'the teacher' : 'the student'} will use, or keep the
                                    generated one. Their existing sessions end the moment you save. Minimum 8 characters.
                                </p>
                                <input
                                    className="db-input ad-pw-input mono"
                                    value={pwModal.value}
                                    onChange={(e) => setPwModal((m) => ({ ...m, value: e.target.value }))}
                                    maxLength={64}
                                    aria-label="New password"
                                />
                                <div className="db-modal-actions" style={{ marginTop: 18 }}>
                                    <button
                                        onClick={() => setPwModal(null)}
                                        style={{ padding: '11px 18px', borderRadius: 11, fontSize: 14, fontWeight: 600, background: 'transparent', border: '1px solid var(--db-border)', color: 'var(--db-text-2)', cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button className="db-btn-primary" onClick={submitPassword} disabled={resetPassword.isPending || pwModal.value.trim().length < 8}>
                                        {resetPassword.isPending ? 'Setting…' : 'Set password'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="ad-modal-sub">
                                    Hand this to <b>{pwModal.user.name}</b> ({pwModal.user.email}) personally —
                                    it is shown once. Tell them their old sessions ended.
                                </p>
                                <div className="ad-otp-row">
                                    <code className="ad-otp">{pwModal.final}</code>
                                    <button className="db-btn-primary" onClick={copyFinal}>
                                        {pwModal.copied ? 'Copied ✓' : 'Copy'}
                                    </button>
                                </div>
                                <div className="db-modal-actions" style={{ marginTop: 18 }}>
                                    <button className="db-btn-primary" onClick={() => setPwModal(null)}>Done</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Small helper so the counts recompute with the optimistic overlay applied.
