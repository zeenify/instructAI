import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Pencil, Plus, Trash2, TriangleAlert, X } from 'lucide-react';
import api from '../../services/api';

/**
 * Inline editor for AI-generated quiz questions, shown live in the generation
 * console. Real question ids arrive from GET /teacher/quizzes/{id} once the
 * quiz_complete event lands (the stream payload alone has no DB ids), so each
 * edit autosaves through PUT /teacher/questions/{id} — the same endpoint the
 * Quiz Builder uses. Questions without an id (fetch still in flight) render
 * read-only.
 */

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

function QuestionCard({ question, index, onChange, onQuestionsChange }) {
  const editable = typeof question.id === 'number';
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('idle');
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
  const options = question.options || [];
  const expected = question.expected_output ?? question.answer ?? '';

  const markCorrect = (optIdx) => {
    if (!isChoice) return;
    patch({ expected_output: String(optIdx) });
  };

  const setOption = (optIdx, value) => {
    const next = options.map((o, i) => (i === optIdx ? value : o));
    patch({ options: next });
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
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '4px' }}>Question text</div>
            <textarea
              value={question.question_text || ''}
              onChange={(e) => patch({ question_text: e.target.value })}
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60 resize-y"
            />
          </div>

          {isChoice && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '6px' }}>
                Options — click the circle to mark the correct answer
              </div>
              <div style={{ gap: '8px' }} className="space-y-2">
                {options.map((opt, i) => {
                  const isCorrect = String(i) === String(expected);
                  return (
                    <div key={i} style={{ gap: '10px' }} className="flex items-center">
                      <button
                        onClick={() => markCorrect(i)}
                        title="Mark as correct"
                        className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
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
                        <button onClick={() => removeOption(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {type === 'multiple_choice' && options.length < 6 && (
                <button onClick={addOption} style={{ padding: '4px 10px', gap: '5px' }} className="inline-flex items-center rounded-md text-xs text-slate-400 border border-slate-700 hover:text-cyan-300 hover:border-cyan-500/40">
                  <Plus size={12} /> Add option
                </button>
              )}
            </div>
          )}

          {!isChoice && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '4px' }}>
                {type === 'enumeration' ? 'Accepted items (students must list these)' : (type === 'coding' ? 'Expected console output' : 'Expected answer')}
              </div>
              <textarea
                value={expected}
                onChange={(e) => patch({ expected_output: e.target.value })}
                rows={type === 'enumeration' || type === 'coding' ? 2 : 1}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-emerald-300 outline-none focus:border-cyan-500/60 resize-y"
              />
              {type === 'coding' && (
                <p className="text-[11px] text-slate-500" style={{ marginTop: '4px' }}>
                  Test cases for this coding question are edited in the Quiz Builder after generation.
                </p>
              )}
            </div>
          )}

          <div style={{ gap: '10px', alignItems: 'center' }} className="flex">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ marginBottom: '4px' }}>Points</div>
              <input
                type="number"
                min="1"
                value={question.points ?? 1}
                onChange={(e) => patch({ points: Number(e.target.value) || 1 })}
                className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
              />
            </div>
            <div className="flex-1" />
            <button
              onClick={() => { flush(); setEditing(false); }}
              style={{ padding: '7px 16px', gap: '6px' }}
              className="inline-flex items-center rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/40 hover:bg-cyan-500/30"
            >
              <Check size={13} /> Done
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ padding: '7px 12px' }}
              className="rounded-md text-slate-500 text-xs border border-slate-800 hover:text-slate-300"
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
                const isCorrect = isChoice
                  ? String(optIdx) === String(expected)
                  : false;
                return (
                  <div
                    key={optIdx}
                    style={{ padding: '12px 16px' }}
                    className={`rounded-lg border ${isCorrect ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-200' : 'bg-slate-800/50 border-slate-700 text-slate-300'}`}
                  >
                    <div style={{ gap: '12px' }} className="flex items-start">
                      <span className={`font-bold mt-0.5 ${isCorrect ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {String.fromCharCode(65 + optIdx)}.
                      </span>
                      <div className="flex-1">
                        <p>{option}</p>
                        {isCorrect && <span style={{ marginTop: '4px' }} className="text-xs text-emerald-400 font-semibold block">✓ Correct Answer</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!isChoice && (
                <div style={{ padding: '12px 16px' }} className="rounded-lg border border-slate-700 bg-slate-800/50">
                  <p className="text-sm text-slate-400" style={{ marginBottom: '4px' }}>Expected answer:</p>
                  <p className="text-emerald-400 font-semibold whitespace-pre-wrap">{expected || 'N/A'}</p>
                </div>
              )}
            </div>
          )}

          {options.length === 0 && (
            <div style={{ padding: '12px 16px', marginTop: '12px' }} className="bg-slate-800/50 border border-slate-700 rounded-lg">
              <p className="text-sm text-slate-400" style={{ marginBottom: '4px' }}>Expected answer:</p>
              <p className="text-emerald-400 font-semibold whitespace-pre-wrap">{expected || 'N/A'}</p>
            </div>
          )}

          <div style={{ gap: '12px', paddingTop: '12px', marginTop: '12px' }} className="flex items-center text-xs text-slate-400 border-t border-slate-800">
            <span style={{ padding: '6px 12px' }} className="bg-slate-800 rounded">{type}</span>
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
          Live editing — hover a question and edit; changes save automatically
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
