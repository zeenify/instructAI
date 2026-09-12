import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronDown, ChevronRight, FlaskConical, Loader2, Pencil, Plus, Play, Trash2, TriangleAlert, X } from 'lucide-react';
import api from '../../services/api';

/**
 * Inline editor for AI-generated quiz questions, shown live in the generation
 * console. Real question ids arrive from GET /teacher/quizzes/{id} once the
 * quiz_complete event lands (the stream payload alone has no DB ids), so every
 * edit autosaves through the same endpoints the Quiz Builder uses:
 *   - question fields   -> PUT  /teacher/questions/{id}
 *   - test cases        -> PUT  /teacher/questions/{id}/test-cases (bulk replace)
 *   - verify reference  -> POST /teacher/questions/{id}/verify (runs the
 *                          reference solution on the real engine per test)
 * Questions without an id yet render read-only.
 */

const LANGUAGES = ['java', 'python', 'javascript', 'cpp', 'html'];

function SaveChip({ status }) {
  if (status === 'saving') {
    return <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-slate-400"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  }
  if (status === 'saved') {
    return <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-emerald-400"><Check size={13} /> Saved</span>;
  }
  if (status === 'error') {
    return <span style={{ gap: '6px' }} className="inline-flex items-center text-xs text-red-400"><TriangleAlert size={13} /> Save failed</span>;
  }
  return null;
}

function FieldLabel({ children, hint }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '4px' }}>
      {children}{hint && <span className="text-slate-600 normal-case font-medium"> — {hint}</span>}
    </div>
  );
}

/** Test-case editor for coding questions: load, edit, add/remove, autosave, verify. */
function TestCasesPanel({ question, onTestsPersisted }) {
  const [open, setOpen] = useState(false);
  const [tests, setTests] = useState(null); // null = not loaded yet
  const [status, setStatus] = useState('idle');
  const [verifyState, setVerifyState] = useState(null); // { running, passed, total, results, error }
  const timerRef = useRef(null);
  const loadedRef = useRef(false);

  const hasReference = !!(question.reference_code && question.reference_code.trim());

  const load = async () => {
    try {
      const res = await api.get(`/teacher/questions/${question.id}/test-cases`, { bypassCache: true });
      setTests(res.data.test_cases || []);
    } catch {
      setTests([]);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  };

  const scheduleSave = (nextTests) => {
    setTests(nextTests);
    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      try {
        // Skip rows the teacher hasn't filled yet — the backend requires
        // expected_output on every test, and a half-typed row must not fail
        // the whole save.
        const payload = nextTests
          .filter(t => String(t.expected_output ?? '').trim() !== '')
          .map((t, i) => ({
            input: String(t.input ?? ''),
            expected_output: String(t.expected_output ?? ''),
            hidden: !!t.hidden,
            order_index: i,
          }));
        if (!payload.length) { setStatus('idle'); return; }
        await api.put(`/teacher/questions/${question.id}/test-cases`, { test_cases: payload });
        setStatus('saved');
        onTestsPersisted?.(payload);
        setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 1800);
      } catch {
        setStatus('error');
      }
    }, 800);
  };

  const patchTest = (idx, fields) => {
    scheduleSave(tests.map((t, i) => (i === idx ? { ...t, ...fields } : t)));
  };
  const addTest = () => scheduleSave([...(tests || []), { input: '', expected_output: '', hidden: false }]);
  const removeTest = (idx) => scheduleSave(tests.filter((_, i) => i !== idx));

  const runVerify = async () => {
    setVerifyState({ running: true });
    try {
      const res = await api.post(`/teacher/questions/${question.id}/verify`, {
        reference_code: question.reference_code || '',
      });
      setVerifyState({ running: false, ...res.data });
    } catch (e) {
      setVerifyState({ running: false, error: e?.response?.data?.error || 'Verify failed' });
    }
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-lg">
      <button
        onClick={toggle}
        style={{ padding: '10px 14px', gap: '8px' }}
        className="w-full flex items-center text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-cyan-300 transition-colors bg-transparent border-none cursor-pointer"
      >
        {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <FlaskConical size={13} />
        Test cases {tests ? `(${tests.length})` : ''}
        {status === 'saving' && <Loader2 size={12} className="animate-spin text-slate-500" />}
        {status === 'saved' && <Check size={12} className="text-emerald-400" />}
        {status === 'error' && <TriangleAlert size={12} className="text-red-400" />}
        <span className="flex-1" />
        <span className="text-slate-600 normal-case font-medium">stdin → expected stdout · runs on the real engine</span>
      </button>

      {open && (
        <div style={{ padding: '12px 14px', gap: '10px' }} className="space-y-3 border-t border-slate-800">
          {tests === null && <div className="text-sm text-slate-500"><Loader2 size={13} className="inline animate-spin" /> Loading test cases…</div>}

          {tests !== null && tests.length === 0 && (
            <div className="text-sm text-slate-500">No test cases yet — add at least one so this question grades through the test engine.</div>
          )}

          {tests !== null && tests.map((t, idx) => (
            <div key={t.id ?? idx} style={{ padding: '10px 12px', gap: '10px' }} className="bg-slate-900/70 border border-slate-800 rounded-lg">
              <div style={{ gap: '8px', marginBottom: '6px' }} className="flex items-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Test {idx + 1}</span>
                <button
                  onClick={() => patchTest(idx, { hidden: !t.hidden })}
                  style={{ padding: '2px 8px', gap: '4px' }}
                  className={`inline-flex items-center rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                    t.hidden
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  {t.hidden ? 'Hidden' : 'Sample'}
                </button>
                <span className="flex-1" />
                <button onClick={() => removeTest(idx)} className="text-slate-600 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer">
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ gap: '10px' }} className="grid grid-cols-2">
                <div>
                  <FieldLabel>Input (stdin)</FieldLabel>
                  <textarea
                    value={t.input || ''}
                    onChange={(e) => patchTest(idx, { input: e.target.value })}
                    rows={2}
                    spellCheck={false}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-cyan-500/60 resize-y"
                  />
                </div>
                <div>
                  <FieldLabel>Expected output</FieldLabel>
                  <textarea
                    value={t.expected_output || ''}
                    onChange={(e) => patchTest(idx, { expected_output: e.target.value })}
                    rows={2}
                    spellCheck={false}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-emerald-300 outline-none focus:border-cyan-500/60 resize-y"
                  />
                </div>
              </div>
            </div>
          ))}

          {tests !== null && (
            <div style={{ gap: '10px', alignItems: 'center' }} className="flex">
              <button
                onClick={addTest}
                style={{ padding: '5px 12px', gap: '5px' }}
                className="inline-flex items-center rounded-md text-xs text-slate-400 border border-slate-700 hover:text-cyan-300 hover:border-cyan-500/40 bg-transparent cursor-pointer"
              >
                <Plus size={12} /> Add test case
              </button>
              <span className="flex-1" />
              <SaveChip status={status} />
              <button
                onClick={runVerify}
                disabled={!hasReference || (verifyState?.running)}
                style={{ padding: '6px 14px', gap: '6px' }}
                className={`inline-flex items-center rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                  hasReference && !verifyState?.running
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25'
                    : 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
                }`}
                title={hasReference ? 'Run the reference solution against every test case' : 'Needs a reference solution first'}
              >
                {verifyState?.running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                Verify on engine
              </button>
            </div>
          )}

          {verifyState && !verifyState.running && (
            <div style={{ padding: '10px 12px' }} className={`rounded-lg border text-sm ${
              verifyState.error ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : verifyState.all_passed ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
            }`}>
              {verifyState.error
                ? verifyState.error
                : <span className="font-semibold">{verifyState.passed}/{verifyState.total} tests pass {verifyState.all_passed ? '— safe to publish' : '— fix the failing tests or the reference solution'}</span>}
              {!verifyState.error && (verifyState.results || []).map(r => (
                <div key={r.test_case_index} style={{ marginTop: '6px' }} className="font-mono text-xs text-slate-400">
                  Test {r.test_case_index + 1}: {r.passed
                    ? <span className="text-emerald-400">ok</span>
                    : <span className="text-red-400">fail{r.timed_out ? ' (timeout)' : ` — got "${String(r.actual_output).slice(0, 60)}"`}</span>}
                </div>
              ))}
            </div>
          )}

          {!hasReference && (
            <div className="text-[11px] text-slate-600">
              No reference solution on this question yet — add one below, then Verify will run it against every test.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({ question, index, onChange }) {
  const editable = typeof question.id === 'number';
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('idle');
  const [showReference, setShowReference] = useState(false);
  const timerRef = useRef(null);
  const latestRef = useRef(null);

  const doSave = async (payload) => {
    setStatus('saving');
    try {
      await api.put(`/teacher/questions/${question.id}`, payload);
      setStatus('saved');
      setTimeout(() => setStatus(s => (s === 'saved' ? 'idle' : s)), 1800);
    } catch {
      setStatus('error');
    }
  };

  const flush = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (latestRef.current) { doSave(latestRef.current); latestRef.current = null; }
  };

  const patch = (fields) => {
    onChange(index, fields);
    if (!editable) return;
    latestRef.current = fields;
    setStatus('saving');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { timerRef.current = null; if (latestRef.current) { doSave(latestRef.current); latestRef.current = null; } }, 900);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const type = question.type || 'multiple_choice';
  const isChoice = type === 'multiple_choice' || type === 'true_false';
  const isEnum = type === 'enumeration';
  const isCoding = type === 'coding';
  const options = question.options || [];
  const expected = question.expected_output ?? question.answer ?? '';

  const markCorrect = (optIdx) => {
    if (!isChoice) return;
    patch({ expected_output: String(optIdx) });
  };

  const setOption = (optIdx, value) => {
    patch({ options: options.map((o, i) => (i === optIdx ? value : o)) });
  };
  const addOption = () => patch({ options: [...options, ''] });
  const removeOption = (optIdx) => {
    const next = options.filter((_, i) => i !== optIdx);
    const exp = String(question.expected_output ?? '');
    const patched = { options: next };
    if (isChoice && exp !== '' && Number(exp) === optIdx) patched.expected_output = '';
    else if (isChoice && exp !== '' && Number(exp) > optIdx) patched.expected_output = String(Number(exp) - 1);
    patch(patched);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '20px 24px' }}
      className="bg-slate-900/50 border border-slate-800 rounded-xl group/q relative"
    >
      {editable && !editing && (
        <button
          onClick={() => setEditing(true)}
          style={{ padding: '5px 10px', gap: '5px' }}
          className="absolute top-3 right-3 z-10 inline-flex items-center rounded-md text-[11px] font-semibold opacity-0 group-hover/q:opacity-100 bg-slate-900 border border-slate-700 text-slate-400 hover:text-cyan-300 transition-all"
        >
          <Pencil size={11} /> Edit
        </button>
      )}

      <div style={{ marginBottom: '12px', gap: '10px' }} className="flex items-start justify-between">
        <span className="text-cyan-400 text-sm font-semibold">Question {index + 1}</span>
        {editing && <SaveChip status={status} />}
      </div>

      {editing ? (
        <div style={{ gap: '12px' }} className="space-y-3">
          <div>
            <FieldLabel>Question text</FieldLabel>
            <textarea
              value={question.question_text || ''}
              onChange={(e) => patch({ question_text: e.target.value })}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60 resize-y"
            />
          </div>

          {isChoice && (
            <div>
              <FieldLabel hint="click the circle to change the right answer">Options</FieldLabel>
              <div style={{ gap: '8px' }} className="space-y-2">
                {options.map((opt, i) => {
                  const isCorrect = String(i) === String(expected);
                  return (
                    <div key={i} style={{ gap: '10px' }} className="flex items-center">
                      <button
                        onClick={() => markCorrect(i)}
                        title="Mark as correct"
                        className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all cursor-pointer bg-transparent ${
                          isCorrect ? 'bg-emerald-500/30 border-emerald-400' : 'border-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {isCorrect && <Check size={12} className="text-emerald-300" />}
                      </button>
                      <input
                        value={opt}
                        onChange={(e) => setOption(i, e.target.value)}
                        className={`flex-1 bg-slate-950 border rounded-lg px-3 py-2 text-sm outline-none focus:border-cyan-500/60 ${
                          isCorrect ? 'border-emerald-500/50 text-emerald-200' : 'border-slate-700 text-slate-200'
                        }`}
                      />
                      {options.length > 2 && (
                        <button onClick={() => removeOption(i)} className="text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {type === 'multiple_choice' && options.length < 6 && (
                <button onClick={addOption} style={{ padding: '4px 10px', gap: '5px' }} className="mt-2 inline-flex items-center rounded-md text-xs text-slate-400 border border-slate-700 hover:text-cyan-300 hover:border-cyan-500/40 bg-transparent cursor-pointer">
                  <Plus size={12} /> Add option
                </button>
              )}
            </div>
          )}

          {isEnum && (
            <div>
              <FieldLabel hint="students must list exactly these">Accepted items</FieldLabel>
              <div style={{ gap: '8px' }} className="space-y-2">
                {options.map((opt, i) => (
                  <div key={i} style={{ gap: '10px' }} className="flex items-center">
                    <span className="text-xs text-slate-500 w-5 text-center font-bold">{i + 1}.</span>
                    <input
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-200 outline-none focus:border-cyan-500/60"
                    />
                    <button onClick={() => removeOption(i)} className="text-slate-500 hover:text-red-400 transition-colors bg-transparent border-none cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {options.length < 8 && (
                <button onClick={addOption} style={{ padding: '4px 10px', gap: '5px', marginTop: '8px' }} className="inline-flex items-center rounded-md text-xs text-slate-400 border border-slate-700 hover:text-cyan-300 hover:border-cyan-500/40 bg-transparent cursor-pointer">
                  <Plus size={12} /> Add item
                </button>
              )}
            </div>
          )}

          {!isChoice && !isEnum && (
            <div>
              <FieldLabel>{isCoding ? 'Expected console output (no-input run)' : 'Expected answer'}</FieldLabel>
              <textarea
                value={expected}
                onChange={(e) => patch({ expected_output: e.target.value })}
                rows={isCoding ? 2 : 1}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-300 outline-none focus:border-cyan-500/60 resize-y"
              />
            </div>
          )}

          {isCoding && (
            <>
              <div style={{ gap: '12px' }} className="grid grid-cols-2">
                <div>
                  <FieldLabel>Starter code (boilerplate)</FieldLabel>
                  <textarea
                    value={question.boilerplate || ''}
                    onChange={(e) => patch({ boilerplate: e.target.value })}
                    rows={6}
                    spellCheck={false}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-cyan-200 outline-none focus:border-cyan-500/60 resize-y"
                  />
                </div>
                <div>
                  <FieldLabel>Reference solution — the verified answer</FieldLabel>
                  <textarea
                    value={question.reference_code || ''}
                    onChange={(e) => patch({ reference_code: e.target.value })}
                    rows={6}
                    spellCheck={false}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs text-emerald-200 outline-none focus:border-cyan-500/60 resize-y"
                  />
                </div>
              </div>

              <TestCasesPanel question={question} />

              <div style={{ gap: '10px', alignItems: 'center' }} className="flex">
                <button
                  onClick={() => patch({ partial_credit: !question.partial_credit })}
                  style={{ padding: '7px 14px', gap: '8px' }}
                  className={`inline-flex items-center rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                    question.partial_credit
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {question.partial_credit ? 'Partial credit ON' : 'Partial credit OFF'}
                </button>
                <span className="text-[11px] text-slate-600">off = all tests must pass for full points</span>
              </div>
            </>
          )}

          <div style={{ gap: '12px', alignItems: 'flex-end' }} className="flex">
            {isCoding && (
              <div>
                <FieldLabel>Language</FieldLabel>
                <select
                  value={question.language || 'java'}
                  onChange={(e) => patch({ language: e.target.value })}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            )}
            <div>
              <FieldLabel>Points</FieldLabel>
              <input
                type="number"
                min="1"
                value={question.points ?? 1}
                onChange={(e) => patch({ points: Number(e.target.value) || 1 })}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
              />
            </div>
            <span className="flex-1" />
            <button
              onClick={() => { flush(); setEditing(false); }}
              style={{ padding: '7px 16px', gap: '6px' }}
              className="inline-flex items-center rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/40 hover:bg-cyan-500/30 cursor-pointer"
            >
              <Check size={13} /> Done
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '7px 12px' }}
              className="rounded-md text-slate-500 text-xs border border-slate-800 hover:text-slate-300 bg-transparent cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ marginTop: '4px', paddingRight: '60px' }} className="text-white font-semibold text-lg">
            {question.question_text || question.question}
          </p>

          {options.length > 0 && (
            <div style={{ gap: '8px', marginTop: '14px' }} className="space-y-2">
              {options.map((option, optIdx) => {
                const isCorrect = isChoice ? String(optIdx) === String(expected) : false;
                return (
                  <div
                    key={optIdx}
                    style={{ padding: '12px 16px' }}
                    className={`rounded-lg border ${isCorrect ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200' : 'bg-slate-800/50 border-slate-700 text-slate-300'}`}
                  >
                    <div style={{ gap: '12px' }} className="flex items-start">
                      <span className={`font-bold mt-0.5 ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isEnum ? `${optIdx + 1}.` : `${String.fromCharCode(65 + optIdx)}.`}
                      </span>
                      <div className="flex-1">
                        <p>{option}</p>
                        {isCorrect && <span style={{ marginTop: '4px' }} className="text-xs text-emerald-400 font-semibold block">✓ Correct Answer</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(!isChoice || options.length === 0) && (
            <div style={{ padding: '12px 16px', marginTop: '12px' }} className="bg-slate-800/50 border border-slate-700 rounded-lg">
              <p className="text-sm text-slate-400" style={{ marginBottom: '4px' }}>
                {isCoding ? 'Expected output:' : (isEnum ? 'Accepted items:' : 'Expected answer:')}
              </p>
              {isEnum
                ? <p className="text-emerald-400 font-semibold">{options.join(', ') || 'N/A'}</p>
                : <p className="text-emerald-400 font-semibold whitespace-pre-wrap">{expected || 'N/A'}</p>}
            </div>
          )}

          {isCoding && question.reference_code && (
            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => setShowReference(!showReference)}
                style={{ padding: '4px 10px', gap: '5px' }}
                className="inline-flex items-center rounded text-[11px] font-semibold text-slate-500 border border-slate-800 hover:text-cyan-300 bg-transparent cursor-pointer"
              >
                {showReference ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Reference solution
              </button>
              {showReference && (
                <pre className="mt-2 overflow-x-auto text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-emerald-300" style={{ padding: '12px 14px' }}>
                  {question.reference_code}
                </pre>
              )}
            </div>
          )}

          <div style={{ gap: '12px', paddingTop: '12px', marginTop: '12px' }} className="flex items-center text-xs text-slate-400 border-t border-slate-800">
            <span style={{ padding: '6px 12px' }} className="bg-slate-800 rounded">{type}</span>
            {isCoding && <span style={{ padding: '6px 12px' }} className="bg-slate-800 rounded">{question.language || 'java'}</span>}
            {isCoding && question.partial_credit && <span style={{ padding: '6px 12px' }} className="bg-amber-500/15 text-amber-400 rounded">partial credit</span>}
            <span>{question.points || 1} pts</span>
            {!editable && <span className="text-slate-600">· saving unlocks when the question ids sync</span>}
          </div>
        </>
      )}
    </motion.div>
  );
}

export default function EditableQuizContent({ questions, onQuestionsChange }) {
  if (!questions?.length) return null;

  const changeQuestion = (index, fields) => {
    onQuestionsChange(questions.map((q, i) => (i === index ? { ...q, ...fields } : q)));
  };

  return (
    <div style={{ gap: '24px' }} className="space-y-5">
      <div style={{ gap: '10px' }} className="flex items-center">
        <span className="text-[11px] text-slate-500 uppercase tracking-widest font-bold">
          Live editing — answers, options, test cases, reference solutions: all save automatically
        </span>
      </div>
      {questions.map((question, idx) => (
        <QuestionCard
          key={question.id ?? `q-${idx}`}
          question={question}
          index={idx}
          onChange={changeQuestion}
        />
      ))}
    </div>
  );
}
