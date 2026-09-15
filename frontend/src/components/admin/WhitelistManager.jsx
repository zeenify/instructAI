import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, CheckCircle2, Circle, ShieldAlert } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import api from '../../services/api';

// Shared admin whitelist manager (panel fix): only pre-approved identifiers
// (student LRNs / teacher emails) can register or sign up with Google.
export default function WhitelistManager({
    title,
    description,
    endpoint,
    listKey,
    placeholder,
    parseLine,
    lineError,
    columns,
}) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [bulkText, setBulkText] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(endpoint, { bypassCache: true });
            setItems(res.data[listKey] || []);
        } catch (err) {
            toast.error(err.response?.status === 403
                ? 'Admin access required'
                : 'Failed to load the whitelist');
        } finally {
            setLoading(false);
        }
    }, [endpoint, listKey]);

    useEffect(() => { load(); }, [load]);

    const handleBulkAdd = async () => {
        if (!bulkText.trim()) return;
        const entries = bulkText.split(/\n+/).map((l) => l.trim()).filter(Boolean).map(parseLine);
        const bad = entries.filter((e) => !e || !columns.every((c) => c.isValid ? c.isValid(e) : true));
        if (bad.length > 0 || entries.length === 0) {
            toast.error(lineError);
            return;
        }

        setSaving(true);
        try {
            const res = await api.post(endpoint, { entries });
            toast.success(res.data.message || 'Whitelist updated');
            setBulkText('');
            load();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update the whitelist');
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (item) => {
        try {
            await api.delete(`${endpoint}/${item.id}`);
            setItems((prev) => prev.filter((s) => s.id !== item.id));
            toast.success('Removed from the whitelist');
        } catch {
            toast.error('Failed to remove entry');
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
            <Toaster position="top-center" theme="dark" richColors />

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{
                    padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center',
                    background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b',
                }}>
                    <ShieldAlert size={20} />
                </div>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    {title}
                </h1>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px 0', lineHeight: 1.5 }}>
                {description}
            </p>

            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '16px', padding: '20px 24px', marginBottom: '24px',
            }}>
                <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                    Add entries
                </div>
                <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={placeholder}
                    rows={5}
                    style={{
                        width: '100%', padding: '12px 14px', borderRadius: '10px',
                        background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace',
                        resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                    }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        One entry per line — duplicates are updated, not duplicated.
                    </span>
                    <button
                        onClick={handleBulkAdd}
                        disabled={saving || !bulkText.trim()}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                            borderRadius: '10px', border: 'none', cursor: saving ? 'wait' : 'pointer',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff',
                            fontSize: '13px', fontWeight: '700', opacity: saving || !bulkText.trim() ? 0.6 : 1,
                        }}
                    >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        {saving ? 'Saving...' : 'Add to Whitelist'}
                    </button>
                </div>
            </div>

            <div style={{
                background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                borderRadius: '16px', overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <Loader2 size={20} className="animate-spin" style={{ marginRight: '8px' }} />
                        Loading whitelist...
                    </div>
                ) : items.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                        The whitelist is empty — no one can register until you add entries above.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                {columns.map((c) => (
                                    <th key={c.label} style={{ padding: '12px 16px', fontWeight: '700' }}>{c.label}</th>
                                ))}
                                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Status</th>
                                <th style={{ padding: '12px 16px', fontWeight: '700' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                    {columns.map((c) => (
                                        <td key={c.label} style={{ padding: '12px 16px' }}>{c.render(item)}</td>
                                    ))}
                                    <td style={{ padding: '12px 16px' }}>
                                        {item.claimed ? (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#4ade80', fontSize: '12px', fontWeight: '600' }}>
                                                <CheckCircle2 size={13} /> Registered
                                            </span>
                                        ) : (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>
                                                <Circle size={13} /> Available
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleRemove(item)}
                                            title="Remove from whitelist"
                                            style={{
                                                padding: '6px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)',
                                                background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', cursor: 'pointer',
                                                display: 'inline-flex', alignItems: 'center',
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
