import WhitelistManager from '../../components/admin/WhitelistManager';

// Admin-only: the approved teacher list. Only emails on this list can register
// or sign up with Google as teachers of Penaranda Senior High School.
export default function TeacherWhitelist() {
    return (
        <WhitelistManager
            title="Teacher Whitelist"
            description="Only emails on this list can register or sign up with Google as teachers of Penaranda Senior High School. Unapproved emails are rejected at registration with a note to contact the school admin."
            endpoint="/admin/teacher-whitelist"
            listKey="teachers"
            placeholder={'One entry per line — email required, the rest optional:\nj.santos@penarandashs.edu.ph, Josef, Santos, Master Teacher I\nm.reyes@penarandashs.edu.ph'}
            lineError="Every line must start with a valid email address"
            parseLine={(line) => {
                const parts = line.split(',').map((p) => p.trim());
                const email = (parts[0] || '').toLowerCase();
                return {
                    email,
                    first_name: parts[1] || null,
                    last_name: parts[2] || null,
                    position: parts[3] || null,
                };
            }}
            columns={[
                { label: 'Email', render: (t) => <span style={{ fontFamily: 'monospace' }}>{t.email}</span>, isValid: (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email) },
                { label: 'Name', render: (t) => [t.first_name, t.last_name].filter(Boolean).join(' ') || '—' },
                { label: 'Position', render: (t) => <span style={{ color: 'var(--text-secondary)' }}>{t.position || '—'}</span> },
            ]}
        />
    );
}
