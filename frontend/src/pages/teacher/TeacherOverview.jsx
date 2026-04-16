import TeacherLayout from '../../components/layouts/TeacherLayout';
import { BookOpen, Users, Zap, Clock } from 'lucide-react';

export default function TeacherOverview() {
    return (
        <>
            <div className="mb-10">
                <h1 className="text-4xl font-bold mb-2 tracking-tight">Workspace Overview</h1>
                <p className="text-slate-400">Monitor your classes and AI-generated curriculum.</p>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label mb-2 flex items-center gap-2">
                        <BookOpen size={14} className="text-purple-400" />
                        Active Classes
                    </div>
                    <div className="stat-value text-white">0</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label mb-2 flex items-center gap-2">
                        <Users size={14} className="text-cyan-400" />
                        Total Students
                    </div>
                    <div className="stat-value text-white">0</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label mb-2 flex items-center gap-2">
                        <Zap size={14} className="text-amber-400" />
                        AI Tokens Used
                    </div>
                    <div className="stat-value text-white">Low</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent Activity Feed */}
                <div className="stat-card">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Clock size={20} className="text-slate-500" />
                        Recent Activity
                    </h3>
                    <div className="space-y-6">
                        <p className="text-slate-500 text-sm italic text-center py-10">
                            No recent activity found. Once students join your classes, logs will appear here.
                        </p>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-col gap-4">
                    <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-600/20 to-transparent border border-purple-500/20">
                        <h3 className="text-xl font-bold mb-2">Ready to start?</h3>
                        <p className="text-slate-400 text-sm mb-6">Create your first class to generate AI-powered coding modules.</p>
                        <button className="btn-primary py-3 px-6 text-sm font-bold uppercase tracking-widest">
                            Create Class
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}