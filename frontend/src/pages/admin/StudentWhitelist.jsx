import WhitelistManager from '../../components/admin/WhitelistManager';

// Admin-only: the school's enrollment whitelist. Only LRNs on this list can
// register or sign up with Google as students of Penaranda Senior High School.
export default function StudentWhitelist() {
    return (
        <WhitelistManager
            title="Student Whitelist"
            description="Only LRNs on this list can register or sign up with Google as students of Penaranda Senior High School. Students whose LRN is missing here will be told to ask their teacher to have it added."
            endpoint="/admin/student-whitelist"
            listKey="students"
            placeholder={'One entry per line — LRN required, the rest optional:\n301234567890, Juan, Dela Cruz, 11, Sampaguita\n301234567891'}
            lineError="Every line must start with a 12-digit LRN"
            parseLine={(line) => {
                const parts = line.split(',').map((p) => p.trim());
                return {
                    lrn_number: (parts[0] || '').replace(/\D/g, '').slice(0, 12),
                    first_name: parts[1] || null,
                    last_name: parts[2] || null,
                    grade_level: parts[3] || null,
                    section: parts[4] || null,
                };
            }}
            columns={[
                { label: 'LRN', render: (s) => <span style={{ fontFamily: 'monospace' }}>{s.lrn_number}</span>, isValid: (s) => s.lrn_number.length === 12 },
                { label: 'Name', render: (s) => [s.first_name, s.last_name].filter(Boolean).join(' ') || '—' },
                { label: 'Grade & Section', render: (s) => <span style={{ color: 'var(--text-secondary)' }}>{[s.grade_level, s.section].filter(Boolean).join(' — ') || '—'}</span> },
            ]}
        />
    );
}
