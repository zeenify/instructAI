// Both registration gates in one place — tab between student LRNs and
// teacher invites; the shared WhitelistManager does the rest.
import { useState } from 'react';
import WhitelistManager from '../../components/admin/WhitelistManager';
import './Admin.css';

const TABS = [
    { id: 'students', label: 'Student LRNs' },
    { id: 'teachers', label: 'Teacher invites' },
];

export default function AdminWhitelists() {
    const [tab, setTab] = useState('students');

    return (
        <div className="db-hero-pad">
            <div className="ad-head-row">
                <div>
                    <h1 className="ad-title">Whitelists</h1>
                    <p className="ad-sub">The registration gate: only listed LRNs and emails can create accounts for the school.</p>
                </div>
            </div>

            <div className="cd-tab-bar" role="tablist" aria-label="Whitelist kind">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        aria-selected={tab === t.id}
                        className={`cd-tab ${tab === t.id ? 'on' : ''}`}
                        onClick={() => setTab(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div style={{ marginTop: 16 }}>
                <WhitelistManager key={tab} kind={tab} />
            </div>
        </div>
    );
}
