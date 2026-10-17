// Admin landing — one glance at the whole school: counts, whitelist cover,
// the newest accounts and the biggest classes.
import { Link } from 'react-router-dom';
import { Users, GraduationCap, School, BookOpen, ArrowRight } from 'lucide-react';
import StatCard from '../../components/ui/StatCard';
import { SkeletonBlock, StatCardSkeleton } from '../../components/ui/skeletons';
import { useAdminOverview } from '../../queries/admin';
import { useAuth } from '../../context/AuthContext';
import './Admin.css';

function WhitelistMeter({ label, total, claimed }) {
    const pct = total > 0 ? Math.round((claimed / total) * 100) : 0;
    return (
        <div className="ad-meter">
            <div className="ad-meter-head">
                <span className="ad-meter-label">{label}</span>
                <span className="ad-meter-value">{claimed} of {total} claimed</span>
            </div>
            <div className="ad-meter-track"><div className="ad-meter-fill" style={{ width: `${pct}%` }} /></div>
        </div>
    );
}

export default function AdminOverview() {
    const { user } = useAuth();
    const { data, isLoading } = useAdminOverview();

    if (isLoading || !data) {
        return (
            <div className="db-hero-pad">
                <SkeletonBlock style={{ height: '96px', borderRadius: '18px', marginBottom: '20px' }} />
                <div className="db-stats-grid" style={{ marginBottom: '20px' }}>
                    <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
                </div>
                <SkeletonBlock style={{ height: '220px', borderRadius: '18px' }} />
            </div>
        );
    }

    const { counts, whitelist, newest, top_classes: topClasses } = data;
    const firstName = (user?.student_profile?.first_name || user?.teacher_profile?.first_name || user?.email?.split('@')[0]) ?? 'Admin';

    return (
        <div className="db-hero-pad">
            <div className="db-hero">
                <p className="ad-kicker">School operations</p>
                <h1 className="db-title">The whole school, {firstName}</h1>
                <p className="ad-sub">{counts.students} students and {counts.teachers} teachers across {counts.classes} classes — whitelists decide who can join.</p>
            </div>

            <div className="db-stats-grid" style={{ margin: '18px 0 22px' }}>
                <StatCard icon={Users} tone="violet" label="Students" value={counts.students} caption={counts.disabled > 0 ? `${counts.disabled} disabled` : 'all active'} />
                <StatCard icon={GraduationCap} tone="green" label="Teachers" value={counts.teachers} caption="approved accounts" />
                <StatCard icon={School} tone="violet" label="Classes" value={counts.classes} caption={`${counts.courses} courses inside`} />
                <StatCard icon={BookOpen} tone="green" label="Lessons + Quizzes" value={counts.lessons + counts.quizzes} caption={`${counts.modules} modules · ${counts.activities} classwork`} />
            </div>

            <div className="ad-two-col">
                <div className="db-card">
                    <div className="db-section-row">
                        <div>
                            <h3 className="db-section-title">Registration whitelist</h3>
                            <p className="db-section-sub">Only listed LRNs and emails can sign up. Claimed = turned into an account.</p>
                        </div>
                        <Link to="/admin/whitelists" className="ad-link">Manage <ArrowRight size={14} /></Link>
                    </div>
                    <WhitelistMeter label="Student LRNs" total={whitelist.students.total} claimed={whitelist.students.claimed} />
                    <WhitelistMeter label="Teacher invites" total={whitelist.teachers.total} claimed={whitelist.teachers.claimed} />
                </div>

                <div className="db-card">
                    <div className="db-section-row">
                        <div>
                            <h3 className="db-section-title">Biggest classes</h3>
                            <p className="db-section-sub">By enrollment — <Link to="/admin/classes" className="ad-link inline">see all classes</Link></p>
                        </div>
                    </div>
                    <div className="ad-rows">
                        {topClasses.map((c) => (
                            <div key={c.id} className="ad-row">
                                <div style={{ minWidth: 0 }}>
                                    <p className="ad-row-title">{c.name}</p>
                                    <p className="ad-row-sub">{c.teacher}</p>
                                </div>
                                <span className="ad-num">{c.students_count} students</span>
                            </div>
                        ))}
                        {topClasses.length === 0 && <p className="ad-empty">No classes yet.</p>}
                    </div>
                </div>
            </div>

            <div className="db-card" style={{ marginTop: '22px' }}>
                <div className="db-section-row">
                    <div>
                        <h3 className="db-section-title">Newest accounts</h3>
                        <p className="db-section-sub">The latest signups across the school — <Link to="/admin/users" className="ad-link inline">all users</Link></p>
                    </div>
                </div>
                <div className="ad-rows">
                    {newest.map((u) => (
                        <div key={u.id} className="ad-row">
                            <div style={{ minWidth: 0 }}>
                                <p className="ad-row-title">{u.name}</p>
                                <p className="ad-row-sub">{u.email}</p>
                            </div>
                            <span className={`ad-chip ${u.role}`}>{u.role}</span>
                        </div>
                    ))}
                    {newest.length === 0 && <p className="ad-empty">No accounts yet.</p>}
                </div>
            </div>
        </div>
    );
}
