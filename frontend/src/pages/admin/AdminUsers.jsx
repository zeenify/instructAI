// Account management: every teacher + student, with the admin's three levers —
// disable/enable (kicks them out now), reset password (temp shown once), delete
// (guarded; empty accounts only).
import { useEffect, useMemo, useState } from 'react';
import { MoreVertical, Search, ShieldOff, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import Dropdown from '../../components/ui/Dropdown';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { SkeletonBlock } from '../../components/ui/skeletons';
import { useAdminUsers, useSetUserActive, useResetPassword, useDeleteUser } from '../../queries/admin';
import './Admin.css';

const ROLE_FILTERS = [
    { value: 'all', label: 'Everyone' },
    { value: 'teacher', label: 'Teachers' },
    { value: 'student', label: 'Students' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—');

export default function AdminUsers() {
    const [role, setRole] = useState('all');
    const [search, setSearch] = useState('');
    const [q, setQ] = useState(''); // debounced
    const [confirm, setConfirm] = useState(null);   // { kind: 'disable'|'enable'|'delete', user }
    const [tempPassword, setTempPassword] = useState(null); // { user, temp }

    useEffect(() => {
        const t = setTimeout(() => setQ(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    const { data, isLoading } = useAdminUsers(role, q);
    const setActive = useSetUserActive();
    const resetPassword = useResetPassword();
    const deleteUser = useDeleteUser();

    const users = data?.users ?? [];
    const busy = setActive.isPending || resetPassword.isPending || deleteUser.isPending;

    const groupedCounts = useMemo(() => ({
        teacher: users.filter((u) => u.role === 'teacher').length,
        student: users.filter((u) => u.role === 'student').length,
    }), [users]);

    const runConfirm = async () => {
        if (!confirm) return;
        const { kind, user } = confirm;
        try {
            if (kind === 'delete') {
                await deleteUser.mutateAsync(user.id);
            } else {
                await setActive.mutateAsync({ id: user.id, active: kind === 'enable' });
            }
            setConfirm(null);
        } catch (err) {
            setConfirm(null);
        }
    };

    const runReset = async (user) => {
        try {
            const res = await resetPassword.mutateAsync(user.id);
            setTempPassword({ user, temp: res.data?.temp_password || res.temp_password });
        } catch { /* toast surfaced by api layer */ }
    };

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="db-title">Users</h1>
                    <p className="ad-sub">Every account in the school. Disable to cut access instantly; passwords reset on the spot.</p>
                </div>
            </div>

            <div className="ad-toolbar">
                <Dropdown value={role} options={ROLE_FILTERS} onChange={setRole} />
                <div className="ad-search">
                    <Search size={15} />
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                        <SkeletonBlock style={{ height: 44, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 44, borderRadius: 12 }} />
                        <SkeletonBlock style={{ height: 44, borderRadius: 12 }} />
                    </div>
                ) : users.length === 0 ? (
                    <p className="ad-empty">No accounts match “{q}”.</p>
                ) : (
                    <div className="ad-table" role="table" aria-label="Accounts">
                        <div className="ad-tr ad-th" role="row">
                            <span>Account</span><span>Role</span><span>Detail</span><span>Classes</span><span>Joined</span><span>Status</span><span aria-label="Actions" />
                        </div>
                        {users.map((u) => (
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
                                    <Dropdown
                                        value=""
                                        placeholder={<MoreVertical size={16} />}
                                        onChange={(v) => {
                                            if (v === 'disable' || v === 'enable') setConfirm({ kind: v, user: u });
                                            if (v === 'reset') runReset(u);
                                            if (v === 'delete') setConfirm({ kind: 'delete', user: u });
                                        }}
                                        options={u.is_active
                                            ? [
                                                { value: 'disable', label: 'Disable account' },
                                                { value: 'reset', label: 'Reset password' },
                                                { value: 'delete', label: 'Delete account' },
                                            ]
                                            : [
                                                { value: 'enable', label: 'Enable account' },
                                                { value: 'reset', label: 'Reset password' },
                                                { value: 'delete', label: 'Delete account' },
                                            ]}
                                    />
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <p className="ad-foot-note">
                {groupedCounts.teacher} teacher and {groupedCounts.student} student accounts in view
                {q ? ` matching “${q}”` : ''} · showing at most 500.
            </p>

            <ConfirmModal
                isOpen={confirm === null ? false : confirm.kind !== 'delete'}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                loading={busy}
                title={confirm?.kind === 'disable' ? `Disable ${confirm?.user?.name}?` : `Enable ${confirm?.user?.name}?`}
                message={confirm?.kind === 'disable'
                    ? 'They are signed out immediately and cannot log in until re-enabled. Their data stays untouched.'
                    : 'They can log in again right away with their existing password.'}
                confirmText={confirm?.kind === 'disable' ? 'Disable account' : 'Enable account'}
            />

            <ConfirmModal
                isOpen={confirm === null ? false : confirm.kind === 'delete'}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                loading={busy}
                title={`Delete ${confirm?.user?.name}?`}
                message="Deletion is permanent and only works for accounts with no records. Teachers who own classes and students with submissions cannot be deleted — disable them instead."
                confirmText="Delete account"
            />

            {/* One-time temp password — shown once, copy-to-clipboard */}
            {tempPassword && (
                <div className="db-modal-backdrop" onClick={() => setTempPassword(null)}>
                    <div className="db-modal db-modal-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="db-modal-head">
                            <span className="db-modal-icon"><KeyRound size={17} /></span>
                            <h3 className="db-modal-title">Temporary password</h3>
                            <button className="db-modal-close" onClick={() => setTempPassword(null)}>×</button>
                        </div>
                        <p className="ad-modal-sub">
                            Hand this to {tempPassword.user.name} ({tempPassword.user.email}) personally.
                            It is the only time it is shown, and their old sessions were just signed out.
                        </p>
                        <div className="ad-otp-row">
                            <code className="ad-otp">{tempPassword.temp}</code>
                            <button
                                className="db-btn-primary"
                                onClick={() => navigator.clipboard.writeText(tempPassword.temp)}
                            >
                                Copy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
