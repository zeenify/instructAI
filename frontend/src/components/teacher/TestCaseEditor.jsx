// Teacher-side authoring of stdin/expected-output test cases for coding
// questions, plus the "does my challenge even work" reference-solution
// verifier. Used inside QuizBuilder's coding question editor.
import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, ShieldCheck, Eye, EyeOff, Loader2, CheckCircle2, XCircle, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import './TestCaseEditor.css';

export default function TestCaseEditor({ question, apiBase = '/teacher/questions' }) {
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
        api.get(`${apiBase}/${question.id}/test-cases`).then((res) => {
            if (!mounted) return;
            const loaded = res.data.test_cases || [];
            setTests(loaded);
            if (res.data.reference_code != null) setReferenceCode(res.data.reference_code);
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
            const res = await api.put(`${apiBase}/${question.id}/test-cases`, {
                test_cases: (tests || []).map((t, i) => ({
                    input: t.input || '',
                    expected_output: t.expected_output || '',
                    hidden: !!t.hidden,
                    order_index: i,
                })),
            });
            setTests(res.data.test_cases);
            setSavedSnapshot(JSON.stringify(res.data.test_cases));
            invalidateCache('get:/teacher/quizzes');
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
            const res = await api.post(`${apiBase}/${question.id}/verify`, {
                reference_code: referenceCode,
            });
            setVerifyResults(res.data);
        } catch {
            toast.error('Verification failed — try again');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div className="tce-box">
            <div className="tce-head">
                <span className="tce-title">
                    <FlaskConical size={14} /> Test cases
                </span>
                {tests !== null && tests.length > 0 && (
                    <span className="tce-count">
                        {tests.length} test{tests.length !== 1 ? 's' : ''}{dirty ? ' · unsaved' : ''}
                    </span>
                )}
            </div>

            {question.language === 'html' ? (
                null
            ) : (
                <>
                    <p className="tce-desc">
                        Each test runs the student's code with the given input and compares what it prints. All tests must pass for full points unless “Allow partial credit” is on. Hidden tests aren't shown to students.
                    </p>

                    {tests === null ? (
                        <div className="tce-loading">
                            <Loader2 size={14} className="animate-spin" /> Loading test cases…
                        </div>
                    ) : (
                        <>
                            <div className="tce-rows">
                                {tests.map((t, i) => (
                                    <div key={t.id || i} className="tce-row">
                                        <div className="tce-row-top">
                                            <span className="tce-row-num">Test {i + 1}</span>
                                            <div className="tce-row-tools">
                                                <button
                                                    type="button"
                                                    onClick={() => update(i, { hidden: !t.hidden })}
                                                    title={t.hidden ? 'Hidden from students' : 'Visible to students as a sample'}
                                                    className={`tce-visibility ${t.hidden ? 'hidden' : ''}`}
                                                >
                                                    {t.hidden ? <EyeOff size={10} /> : <Eye size={10} />}
                                                    {t.hidden ? 'Hidden' : 'Sample'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeTest(i)}
                                                    className="tce-remove"
                                                    title="Remove this test"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="tce-fields">
                                            <div>
                                                <label className="tce-field-label">Input (stdin)</label>
                                                <textarea
                                                    value={t.input || ''}
                                                    onChange={(e) => update(i, { input: e.target.value })}
                                                    rows={2}
                                                    placeholder="e.g. 5"
                                                    className="tce-textarea"
                                                />
                                            </div>
                                            <div>
                                                <label className="tce-field-label">Expected output</label>
                                                <textarea
                                                    value={t.expected_output || ''}
                                                    onChange={(e) => update(i, { expected_output: e.target.value })}
                                                    rows={2}
                                                    placeholder="What the console must print"
                                                    className="tce-textarea"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="tce-actions">
                                <button
                                    type="button"
                                    onClick={addTest}
                                    className="tce-add"
                                >
                                    <Plus size={12} /> Add a test
                                </button>
                                <button
                                    type="button"
                                    onClick={save}
                                    disabled={saving || !dirty}
                                    className={`tce-save ${dirty ? 'armed' : ''}`}
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save test cases
                                </button>
                            </div>

                            <div className="tce-verify">
                                <div className="tce-verify-head">
                                    <label className="tce-verify-label">
                                        Reference solution — run it against every test before publishing
                                    </label>
                                    <button
                                        type="button"
                                        onClick={verify}
                                        disabled={verifying || tests.length === 0 || dirty}
                                        className="tce-verify-btn"
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
                                    placeholder="Paste your solution here…"
                                    className="tce-reference"
                                />
                                {verifyResults && (
                                    <div className="tce-results">
                                        <div className={`tce-results-title ${verifyResults.all_passed ? 'pass' : 'fail'}`}>
                                            {verifyResults.all_passed ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                            {verifyResults.passed}/{verifyResults.total} tests pass{verifyResults.all_passed ? ' — safe to publish' : ' — fix before publishing'}
                                        </div>
                                        {verifyResults.results.map((r, i) => (
                                            <div key={i} className={`tce-result-row ${r.passed ? 'pass' : 'fail'}`}>
                                                {r.passed
                                                    ? <CheckCircle2 size={11} className="tce-result-icon pass" />
                                                    : <XCircle size={11} className="tce-result-icon fail" />}
                                                <span className="tce-result-num">Test {i + 1}:</span>
                                                {r.passed ? (
                                                    <span className="tce-result-ok">ok</span>
                                                ) : (
                                                    <span className="tce-result-detail">
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
