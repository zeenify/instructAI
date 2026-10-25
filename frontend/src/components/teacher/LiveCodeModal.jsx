// Teacher view of students' live draft code during a teacher-paced coding
// question. Polls live-drafts on demand so the teacher can see who's stuck,
// how far along each student is — and run any student's code on the REAL
// interactive terminal (type into their running program like a console).
import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { X, RefreshCw, Loader2, Users, Code2 } from 'lucide-react';
import api from '../../services/api';
import { cmExtension, languageOf } from '../../utils/codeLanguages';
import InteractiveTerminal from '../student/InteractiveTerminal';

// One panel per expanded student, mirroring the student CodeIDE pattern:
// Code / Terminal tabs. The terminal is the real InteractiveTerminal with its
// own Run Program button — nothing executes until the teacher clicks Run, and
// the session survives tab switches (both panes stay mounted).
function StudentCodePanel({ code, language }) {
    const [tab, setTab] = useState('code');
    return (
        <div>
            <div style={{ display: 'flex', gap: '6px', padding: '10px 16px 0', borderBottom: '1px solid var(--border-color)' }}>
                {[
                    { id: 'code', label: 'Code' },
                    { id: 'terminal', label: 'Terminal' },
                ].map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        style={{
                            padding: '7px 14px', borderTopLeftRadius: 9, borderTopRightRadius: 9,
                            border: '1px solid', borderBottom: 'none',
                            borderColor: tab === t.id ? 'var(--border-color)' : 'transparent',
                            background: tab === t.id ? 'var(--bg-tertiary)' : 'transparent',
                            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            marginBottom: -1,
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div style={{ display: tab === 'code' ? 'block' : 'none' }}>
                <CodeMirror
                    value={code}
                    editable={false}
                    height="220px"
                    extensions={[cmExtension(languageOf(language).id)]}
                    theme="dark"
                    basicSetup={{ foldGutter: false, highlightActiveLine: false }}
                />
            </div>
            <div style={{ display: tab === 'terminal' ? 'block' : 'none', height: 360 }}>
                <InteractiveTerminal code={code} language={language} />
            </div>
        </div>
    );
}

export default function LiveCodeModal({ activityId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [message, setMessage] = useState(null);
    const [openStudent, setOpenStudent] = useState(null);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        else setRefreshing(true);
        try {
            const res = await api.get(`/teacher/activities/${activityId}/live-drafts`, { bypassCache: true });
            setData(res.data);
            setMessage(null);
        } catch (err) {
            setMessage(err.response?.data?.message || 'Could not load live drafts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        load();
        const id = setInterval(() => load(true), 5000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activityId]);

    const lang = languageOf(data?.language || 'java');

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', maxHeight: '88vh' }}
                className="relative z-10 w-full max-w-3xl rounded-[24px] shadow-2xl flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ padding: '8px 10px', borderRadius: '10px', background: 'rgba(10, 132, 255, 0.12)', color: '#0a84ff', display: 'flex' }}>
                            <Code2 size={16} />
                        </div>
                        <div>
                            <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Live Code</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                                {data?.question_text || 'Current coding question'}
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {data && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px', background: `${lang.color}1f`, border: `1px solid ${lang.color}55`, fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: lang.color }}>
                                {lang.label}
                            </span>
                        )}
                        <button
                            onClick={() => load(true)}
                            type="button"
                            style={{ background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700 }}
                        >
                            {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Refresh
                        </button>
                        <button onClick={onClose} type="button" style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex' }}>
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ overflow: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-tertiary)', fontSize: '13px', padding: '24px 0' }}>
                            <Loader2 size={16} className="animate-spin" /> Loading drafts...
                        </div>
                    ) : message ? (
                        <div style={{ padding: '14px 18px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', fontSize: '13px' }}>
                            {message}
                        </div>
                    ) : (data?.drafts || []).length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-tertiary)', fontSize: '13px', padding: '24px 0' }}>
                            <Users size={16} /> No students in the room yet.
                        </div>
                    ) : (
                        (data?.drafts || []).map((d) => (
                            <div key={d.student_id} style={{ borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                                <button
                                    onClick={() => setOpenStudent(openStudent === d.student_id ? null : d.student_id)}
                                    type="button"
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 16px', background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer' }}
                                >
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {d.student_name}
                                    </span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0', color: d.code ? '#10b981' : 'var(--text-tertiary)' }}>
                                        {d.code ? `draft · ${d.code.length} chars` : 'nothing yet'}
                                    </span>
                                </button>
                                {openStudent === d.student_id && (
                                    d.code ? (
                                        <div>
                                            <CodeMirror
                                                value={d.code}
                                                editable={false}
                                                height="220px"
                                                extensions={[cmExtension(lang.id)]}
                                                theme="dark"
                                                basicSetup={{ foldGutter: false, highlightActiveLine: false }}
                                            />
                                            <StudentCodePanel code={d.code} language={data?.language || 'java'} />
                                        </div>
                                    ) : (
                                        <div style={{ padding: '14px 16px', color: 'var(--text-tertiary)', fontSize: '12px', fontStyle: 'italic' }}>
                                            This student hasn't typed any code for the current question.
                                        </div>
                                    )
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
