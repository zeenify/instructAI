// System status — service probes, env presence (booleans only, never values)
// and data volumes. The operations story for the defense.
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useAdminSystem } from '../../queries/admin';
import { SkeletonBlock } from '../../components/ui/skeletons';
import './Admin.css';

function ServiceCard({ svc }) {
    return (
        <div className="ad-service">
            <span className={`ad-dot ${svc.ok ? 'ok pulsing' : 'bad'}`} />
            <div style={{ minWidth: 0, flex: 1 }}>
                <p className="ad-cell-title">
                    {svc.label}
                    <span className={`ad-chip ${svc.ok ? 'active' : 'disabled'}`} style={{ marginLeft: 8 }}>
                        {svc.ok ? 'Online' : 'Down'}
                    </span>
                </p>
                <p className="ad-cell-sub mono">{svc.url}</p>
                {!svc.ok && svc.note && <p className="ad-cell-sub">{svc.note}</p>}
            </div>
            {svc.ok && <span className="ad-num">{svc.latency_ms ?? '?'} ms</span>}
        </div>
    );
}

export default function AdminSystem() {
    const { data, isLoading, isFetching, refetch } = useAdminSystem();

    if (isLoading || !data) {
        return (
            <div className="db-hero-pad">
                <SkeletonBlock style={{ height: '72px', borderRadius: '18px', marginBottom: '20px' }} />
                <div className="ad-two-col">
                    <SkeletonBlock style={{ height: '200px', borderRadius: '18px' }} />
                    <SkeletonBlock style={{ height: '200px', borderRadius: '18px' }} />
                </div>
            </div>
        );
    }

    const { services, config, volumes, checked_at } = data;

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="db-title">System</h1>
                    <p className="ad-sub">Service health and school data at a glance. Probes run with a 30s cache.</p>
                </div>
                <button className="db-btn-primary ad-refresh" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw size={14} className={isFetching ? 'ad-spin' : ''} /> Refresh
                </button>
            </div>

            <div className="ad-two-col">
                <div className="db-card">
                    <div className="db-section-row">
                        <div>
                            <h3 className="db-section-title">Services</h3>
                            <p className="db-section-sub">Live HTTP probes. Last checked {new Date(checked_at).toLocaleTimeString()}</p>
                        </div>
                    </div>
                    <div className="ad-rows">
                        {services.map((svc) => <ServiceCard key={svc.label} svc={svc} />)}
                    </div>
                </div>

                <div className="db-card">
                    <div className="db-section-row">
                        <div>
                            <h3 className="db-section-title">Configuration</h3>
                            <p className="db-section-sub">Keys are presence checks only — values never leave the server.</p>
                        </div>
                    </div>
                    <div className="ad-config-grid">
                        {config.map((c) => (
                            <div key={c.key} className="ad-config-row">
                                {c.set ? <CheckCircle2 size={15} className="ad-ok" /> : <XCircle size={15} className="ad-missing" />}
                                <span className="ad-cell-sub mono">{c.key}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="db-card" style={{ marginTop: '22px' }}>
                <div className="db-section-row">
                    <div>
                        <h3 className="db-section-title">Data volume</h3>
                        <p className="db-section-sub">Total rows per table, across the whole school.</p>
                    </div>
                </div>
                <div className="ad-volumes">
                    {volumes.map((v) => (
                        <div key={v.label} className="ad-volume">
                            <span className="ad-volume-num">{v.rows.toLocaleString()}</span>
                            <span className="ad-volume-label">{v.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
