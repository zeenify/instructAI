// Backup & restore — the school's safety net. One JSON file holds every
// domain table; restoring is transactional, so a failed restore changes
// nothing. Personal access tokens are deliberately NOT part of a backup.
import { useRef, useState } from 'react';
import { Database, Download, Upload, ShieldAlert, FileJson, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '../../components/ui/ConfirmModal';
import { downloadBackup, useRestoreBackup } from '../../queries/admin';
import './Admin.css';
import './AdminBackup.css';

const fmtBytes = (n) => {
    if (!n && n !== 0) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AdminBackup() {
    const fileInputRef = useRef(null);
    const [downloading, setDownloading] = useState(false);
    const [picked, setPicked] = useState(null); // { file, name, size, exportedAt, total, tables } | { error, name }
    const [confirmOpen, setConfirmOpen] = useState(false);
    const restore = useRestoreBackup();

    const handleDownload = async () => {
        setDownloading(true);
        try {
            await downloadBackup();
            toast.success('Backup downloaded — keep it somewhere safe.');
        } catch {
            toast.error('Could not generate the backup. Try again.');
        } finally {
            setDownloading(false);
        }
    };

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow picking the same file again
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (data?.meta?.app !== 'instructai') {
                setPicked({ error: 'That file is not an InstructAI backup.', name: file.name });
                return;
            }
            if (Number(data?.meta?.format_version) !== 1) {
                setPicked({ error: 'This backup was made by an incompatible version of InstructAI.', name: file.name });
                return;
            }
            const counts = data?.meta?.row_counts || {};
            const total = Object.values(counts).reduce((a, b) => a + (Number(b) || 0), 0);
            setPicked({
                file,
                name: file.name,
                size: file.size,
                exportedAt: data?.meta?.exported_at || null,
                total,
                tables: Object.keys(counts).length,
            });
        } catch {
            setPicked({ error: 'That file is not valid JSON — it cannot be a backup.', name: file.name });
        }
    };

    const handleRestore = () => {
        if (!picked?.file) return;
        restore.mutate(picked.file, {
            onSuccess: () => {
                setConfirmOpen(false);
                setPicked(null);
            },
            onError: () => setConfirmOpen(false),
        });
    };

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="ad-title">Backup &amp; restore</h1>
                    <p className="ad-sub">
                        Download a snapshot of the school&apos;s data, or put one back. Restores are all-or-nothing.
                    </p>
                </div>
            </div>

            <div className="ad-two-col adb-grid">
                <div className="db-card adb-card">
                    <div className="adb-head">
                        <span className="adb-icon"><Database size={20} /></span>
                        <div>
                            <h3 className="db-section-title">Download backup</h3>
                            <p className="db-section-sub">
                                Accounts, whitelists, classes, courses, lessons, quizzes, classwork,
                                submissions and chat logs — one JSON file.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="db-btn-primary adb-btn"
                        onClick={handleDownload}
                        disabled={downloading}
                    >
                        {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        {downloading ? 'Preparing backup…' : 'Download backup (.json)'}
                    </button>

                    <p className="adb-note">
                        Sign-in tokens and sessions are not included — restoring never logs anyone out.
                    </p>
                </div>

                <div className="db-card adb-card adb-danger">
                    <div className="adb-head">
                        <span className="adb-icon danger"><Upload size={20} /></span>
                        <div>
                            <h3 className="db-section-title">Restore from backup</h3>
                            <p className="db-section-sub">
                                Replace the current data with a snapshot you downloaded earlier.
                            </p>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={handleFile}
                    />
                    <button
                        type="button"
                        className="db-btn-danger adb-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={restore.isPending}
                    >
                        <FileJson size={16} />
                        Choose backup file…
                    </button>

                    {picked && !picked.error && (
                        <div className="adb-file">
                            <p className="adb-file-name">{picked.name}</p>
                            <p className="adb-file-meta">
                                {fmtBytes(picked.size)}
                                {' · '}
                                {picked.tables} tables · {picked.total.toLocaleString()} rows
                                {picked.exportedAt && (
                                    <>
                                        {' · '}exported {new Date(picked.exportedAt).toLocaleString()}
                                    </>
                                )}
                            </p>
                            <button
                                type="button"
                                className="adb-restore-btn"
                                onClick={() => setConfirmOpen(true)}
                                disabled={restore.isPending}
                            >
                                {restore.isPending ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                {restore.isPending ? 'Restoring…' : 'Restore this backup'}
                            </button>
                        </div>
                    )}

                    {picked?.error && (
                        <p className="adb-error">{picked.error}</p>
                    )}

                    <p className="adb-warning">
                        <ShieldAlert size={15} />
                        <span>
                            This replaces <strong>all current data</strong>. If anything goes wrong the restore
                            is rolled back and nothing changes.
                        </span>
                    </p>
                </div>
            </div>

            <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={handleRestore}
                title="Restore this backup?"
                message={`Every current account, class, lesson, quiz and submission will be replaced by the contents of “${picked?.name || 'the backup'}”. This cannot be undone — download a fresh backup first if you are unsure.`}
                confirmText="Replace all data"
                cancelText="Cancel"
                loading={restore.isPending}
                variant="danger"
            />
        </div>
    );
}
