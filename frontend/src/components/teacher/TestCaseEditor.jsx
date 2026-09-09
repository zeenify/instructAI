// Teacher-side authoring of stdin/expected-output test cases for coding
// questions, plus the "does my challenge even work" reference-solution
// verifier. Used inside QuizBuilder's coding question editor.
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, XCircle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';

export default function TestCaseEditor({ question }) {
    const [tests, setTests] = useState(null); // null while loading
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [saving, setSaving] = useState(false);
    const [referenceCode, setReferenceCode] = useState(question.reference_code || '');
    const [verifying, setVerifying] = useState(false);
    const [verifyResults, setVerifyResults] = useState(null);

    useEffect(() => {
        let mounted = true;
        setTests(null);
        setVerifyResults(null);
        setReferenceCode(question.reference_code || '');
        api.get(`/teacher/questions/${question.id}/test-cases`).then((res) => {
            if (!mounted) return;
            const loaded = res.data.test_cases || [];
            setTests(loaded);
            setSavedSnapshot(JSON.stringify(loaded));
        }).catch(() => {
            if (mounted) setTests([]);
        });
        return () => { mounted = false; };
    }, [question.id, question.reference_code]);

    const dirty = tests !== null && JSON.stringify(tests) !== savedSnapshot;

    const update = (index, patch) => {
        setTests((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    };

    const addTest = () => {
        setTests((prev) => [...(prev || []), { input: '', expected_output: '', hidden: false }]);
    };

    const removeTest = (index) => {
        setTests((prev) => prev.filter((_, i) => i !== index));
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await api.put(`/teacher/questions/${question.id}/test-cases`, {
                test_cases: (tests || []).map((t, i) => ({
                    input: t.input || '',
                    expected_output: t.expected_output || '',
                    hidden: !!t.hidden,
                    order_index: i,
                })),
            });
            setTests(res.data.test_cases);
            setSavedSnapshot(JSON.stringify(res.data.test_cases));
            invalidateCache(`get:/teacher/quizzes`);
            toast.success('Test cases saved');
        } catch {
            toast.error('Failed to save test cases');
        } finally {
            setSaving(false);
        }
    };

    const verify = async () => {
        if (!referenceCode.trim()) {
            toast.error('Paste your reference solution first');
            return;
        }
        if (dirty) {
            toast.error('Save your test cases first');
            return;
        }
        setVerifying(true);
        setVerifyResults(null);
        try {
            const res = await api.post(`/teacher/questions/${question.id}/verify`, {
                reference_code: referenceCode,
            }, { timeout: 120000 });
            setVerifyResults(res.data);
            if (res.data.all_passed) {
                toast.success(`Challenge verified — ${res.data.passed}/${res.data.total} tests pass`);
            } else {
                toast.warning(`${res.data.passed}/${res.data.total} tests pass — check the failures`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div style={{ padding: '16px 20px', gap: '12px' }} className={`rounded-3xl flex flex-col ${
            question.language === 'html'
                ? 'bg-slate-500/[0.04] border border-slate-400/20'
                : 'bg-emerald-500/[0.03] border border-emerald-500/15'
        }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className={`flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] ${
                    question.language === 'html' ? 'text-slate-500' : 'text-emerald-600'
                }`}>
                    <FlaskConical size={14} /> Test Cases
                </div>
                {tests !== null && tests.length > 0 && (
                    <span className={`text-[10px] font-bold ${dirty ? 'text-amber-500' : 'text-slate-400'}`}>
                        {tests.length} test{tests.length !== 1 ? 's' : ''}{dirty ? ' · unsaved' : ''}
                    </span>
                )}
            </div>

            {question.language === 'html' ? (
                <p className="text-[11px] text-slate-500 font-medium" style={{ margin: 0 }}>
                    HTML questions are graded by the AI service — test cases don't apply. Describe the expected content in the field below the starter code.
                </p>
            ) : (
                <>
                    <p className="text-[10px] text-slate-500 font-medium" style={{ margin: 0 }}>
                        Each test runs the student's code with the given input and compares stdout. Partial credit = points × tests passed. Hidden tests aren't shown to students.
                    </p>

                    {tests === null ? (
                        <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                            <Loader2 size={14} className="animate-spin" /> Loading test cases...
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-col gap-3">
                                {tests.map((t, i) => (
                                    <div key={i} className="rounded-2xl border border-white/10 bg-black/20 p-3 flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Test {i + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => update(i, { hidden: !t.hidden })}
                                                    title={t.hidden ? 'Hidden from students' : 'Visible to students as a sample'}
                                                    className={`text-[9px] font-black uppercase tracking-wider rounded-lg border-none cursor-pointer px-2 py-1 flex items-center gap-1 ${
                                                        t.hidden ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                                                    }`}
                                                >
                                                    {t.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                                                    {t.hidden ? 'Hidden' : 'Sample'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTest(i)}
                                                    className="text-red-400 hover:text-red-300 bg-transparent border-none cursor-pointer p-1"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Input (stdin)</label>
                                                <textarea
                                                    value={t.input || ''}
                                                    onChange={(e) => update(i, { input: e.target.value })}
                                                    rows={2}
                                                    placeholder={'e.g. 5'}
                                                    className="w-full rounded-lg border border-white/10 bg-[#0b1120] text-cyan-300 font-mono text-xs p-2 outline-none focus:border-cyan-500/40 resize-y"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Expected output</label>
                                                <textarea
                                                    value={t.expected_output || ''}
                                                    onChange={(e) => update(i, { expected_output: e.target.value })}
                                                    rows={2}
                                                    placeholder="What stdout must be"
                                                    className="w-full rounded-lg border border-white/10 bg-[#0b1120] text-emerald-300 font-mono text-xs p-2 outline-none focus:border-emerald-500/40 resize-y"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                                <button
                                    type="button"
                                    onClick={addTest}
                                    className="text-[10px] font-black uppercase tracking-widest rounded-lg border-none cursor-pointer px-3 py-2 flex items-center gap-1 text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                                >
                                    <Plus size={12} /> Add test case
                                </button>
                                <button
                                    type="button"
                                    onClick={save}
                                    disabled={saving || !dirty}
                                    className={`text-[10px] font-black uppercase tracking-widest rounded-lg border-none cursor-pointer px-3 py-2 flex items-center gap-1 transition-colors ${
                                        dirty ? 'text-white bg-emerald-600 hover:bg-emerald-500' : 'text-slate-500 bg-slate-500/10 cursor-not-allowed'
                                    }`}
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save test cases
                                </button>
                            </div>

                            {/* Reference solution verifier */}
                            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 flex flex-col gap-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        Reference solution — run it against every test before publishing
                                    </label>
                                    <button
                                        type="button"
                                        onClick={verify}
                                        disabled={verifying || tests.length === 0 || dirty}
                                        className="text-[10px] font-black uppercase tracking-widest rounded-lg border-none cursor-pointer px-3 py-2 flex items-center gap-1 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        title={tests.length === 0 ? 'Add test cases first' : dirty ? 'Save test cases first' : 'Run reference solution'}
                                    >
                                        {verifying ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                        Verify
                                    </button>
                                </div>
                                <textarea
                                    value={referenceCode}
                                    onChange={(e) => setReferenceCode(e.target.value)}
                                    rows={4}
                                    placeholder="Paste your solution here..."
                                    className="w-full rounded-lg border border-white/10 bg-[#0b1120] text-slate-200 font-mono text-xs p-2 outline-none focus:border-purple-500/40 resize-y"
                                />
                                {verifyResults && (
                                    <div className="flex flex-col gap-1">
                                        <div className={`text-[11px] font-black flex items-center gap-1 ${verifyResults.all_passed ? 'text-emerald-400' : 'text-amber-400'}`}>
                                            {verifyResults.all_passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {verifyResults.passed}/{verifyResults.total} tests pass{verifyResults.all_passed ? ' — safe to publish' : ' — fix before publishing'}
                                        </div>
                                        {verifyResults.results.map((r, i) => (
                                            <div key={i} className="text-[11px] font-mono flex items-start gap-2">
                                                {r.passed
                                                    ? <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                                                    : <XCircle size={11} className="text-red-400 mt-0.5 flex-shrink-0" />}
                                                <span className="text-slate-500">Test {i + 1}:</span>
                                                {r.passed ? (
                                                    <span className="text-emerald-400">ok</span>
                                                ) : (
                                                    <span className="text-red-300 break-all">
                                                        got {r.timed_out ? 'TIMEOUT' : JSON.stringify(r.actual_output || (r.compile_output ? r.compile_output.slice(0, 200) : r.stderr?.slice(0, 200)))}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
