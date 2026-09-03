import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Reorder, useDragControls } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, GripVertical, Clock, Eye, EyeOff, Loader2, HelpCircle, Upload, BookOpen, Edit3, UserCheck, AlertTriangle, FileText, Timer, Shuffle, Radio } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import ActivityTypeBadge from '../../components/teacher/ActivityTypeBadge';
import DateTimePicker from '../../components/teacher/DateTimePicker';
import DeleteModal from '../../components/ui/DeleteModal';
import Button from '../../components/ui/Button';

const QUESTION_TYPES = [
  { id: 'multiple_choice', label: 'Multiple Choice' },
  { id: 'true_false', label: 'True / False' },
  { id: 'identification', label: 'Identification' },
  { id: 'enumeration', label: 'Enumeration' },
  { id: 'short_answer', label: 'Short Answer' },
  { id: 'essay', label: 'Essay' },
  { id: 'coding', label: 'Coding' },
];

const TIMER_MODES = [
  { id: 'none', label: 'No limit' },
  { id: 'entire_quiz', label: 'Whole quiz' },
  { id: 'per_question', label: 'Per question' },
];

const PER_QUESTION_DEFAULTS = {
  true_false: 20,
  multiple_choice: 40,
  identification: 60,
  short_answer: 60,
  enumeration: 90,
  coding: 300,
  essay: 300,
};

function CreateQuestionModal({ isOpen, onClose, onCreated, editQuestion, onEdited }) {
  const isEditMode = !!editQuestion;
  const [type, setType] = useState('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [boilerplate, setBoilerplate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editQuestion) {
      setType(editQuestion.type || 'multiple_choice');
      setQuestionText(editQuestion.question_text || '');
      setPoints(Number(editQuestion.points) || 1);
      const opts = editQuestion.options || (editQuestion.type === 'multiple_choice' ? ['', '', '', ''] : []);
      setOptions(opts);
      if (editQuestion.type === 'multiple_choice') {
        const idx = opts.indexOf(editQuestion.expected_output);
        setCorrectOption(idx >= 0 ? idx : 0);
      } else if (editQuestion.type === 'true_false') {
        setCorrectOption(editQuestion.expected_output === 'False' ? 1 : 0);
      } else {
        setCorrectOption(0);
      }
      setExpectedOutput(editQuestion.expected_output || '');
      setBoilerplate(editQuestion.boilerplate || '');
    } else {
      setType('multiple_choice');
      setQuestionText('');
      setPoints(1);
      setOptions(['', '', '', '']);
      setCorrectOption(0);
      setExpectedOutput('');
      setBoilerplate('');
    }
  }, [editQuestion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    if (type === 'multiple_choice') {
      const valid = options.filter(o => o.trim());
      if (valid.length < 2) {
        toast.error('Multiple choice needs at least 2 options');
        return;
      }
    }

    const safePoints = Math.max(1, Number(points) || 1);

    setLoading(true);
    try {
      const payload = {
        type,
        question_text: questionText.trim(),
        points: type === 'enumeration' ? safePoints * options.filter(o => o.trim()).length : safePoints,
      };
      if (type === 'multiple_choice') {
        const filteredOptions = options.filter(o => o.trim());
        payload.options = filteredOptions;
        payload.expected_output = String(correctOption);
      } else if (type === 'true_false') {
        payload.options = ['True', 'False'];
        payload.expected_output = correctOption === 0 ? 'True' : 'False';
      } else if (type === 'enumeration') {
        payload.options = options.filter(o => o.trim());
      } else if (type === 'coding') {
        payload.expected_output = expectedOutput;
        payload.boilerplate = boilerplate;
      } else {
        payload.expected_output = expectedOutput;
      }
      if (isEditMode) {
        await onEdited(payload);
      } else {
        onCreated(payload);
      }
      onClose();
    } catch {
      toast.error(isEditMode ? 'Failed to update question' : 'Failed to create question');
    } finally {
      setLoading(false);
    }
  };

  const JAVA_BOILERPLATE = 'public class Main {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}';
  const insertJavaBoilerplate = () => {
    setBoilerplate(JAVA_BOILERPLATE);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflow: 'auto' }}
        className="relative z-10 w-full max-w-2xl rounded-[28px] shadow-2xl"
      >
        <form onSubmit={handleSubmit} style={{ padding: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEditMode ? 'Edit Question' : 'Add Question'}</h3>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '6px 12px', borderRadius: '8px', background: 'rgba(167, 139, 250, 0.12)', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {QUESTION_TYPES.find(t => t.id === type)?.label || type}
            </span>
          </div>

          {/* Type selector as pill buttons */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Question Type</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {QUESTION_TYPES.map((t) => (
                <button key={t.id} type="button" onClick={() => setType(t.id)}
                  style={{ padding: '8px 16px', borderRadius: '10px', border: `1.5px solid ${type === t.id ? '#a78bfa' : 'var(--border-color)'}`, background: type === t.id ? 'rgba(167, 139, 250, 0.12)' : 'transparent', color: type === t.id ? '#a78bfa' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', transition: 'all 0.2s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Question text */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Question</label>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} required placeholder="Enter your question..."
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          {/* Points — changes for enumeration */}
          <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                {type === 'enumeration' ? 'Points per correct answer' : 'Points'}
              </label>
              <input type="number" min={1} step={1} value={points} onChange={(e) => setPoints(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                style={{ width: '100px', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
            </div>
            {type === 'enumeration' && options.filter(o => o.trim()).length > 0 && (
              <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.2)', alignSelf: 'flex-end', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Total: <strong style={{ color: '#a78bfa' }}>{points * options.filter(o => o.trim()).length} pts</strong>
                  ({options.filter(o => o.trim()).length} entries × {points} pts each)
                </span>
              </div>
            )}
          </div>

          {/* Multiple Choice */}
          {type === 'multiple_choice' && (
            <div style={{ marginBottom: '20px', padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Options <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-tertiary)' }}>· Select the correct one</span></label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'center' }}>
                  <div onClick={() => setCorrectOption(i)} style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${correctOption === i ? '#a78bfa' : 'var(--border-color)'}`, background: correctOption === i ? '#a78bfa' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {correctOption === i && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
                  </div>
                  <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={'Option ' + (i + 1)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {options.length > 2 && (
                    <button type="button" onClick={() => {
                      setOptions(options.filter((_, idx) => idx !== i));
                      if (correctOption > i) setCorrectOption(correctOption - 1);
                      else if (correctOption === i) setCorrectOption(0);
                    }}
                      style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '6px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setOptions([...options, ''])}
                style={{ marginTop: '4px', padding: '8px 14px', background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px' }}>+ Add option</button>
            </div>
          )}

          {/* True / False */}
          {type === 'true_false' && (
            <div style={{ marginBottom: '20px', padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Correct Answer</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { label: 'True', color: '#10b981', idx: 0 },
                  { label: 'False', color: '#ef4444', idx: 1 },
                ].map((opt) => {
                  const isSelected = correctOption === opt.idx;
                  const borderClr = isSelected ? opt.color : 'var(--border-color)';
                  const bgClr = isSelected ? opt.color + '1a' : 'var(--bg-secondary)';
                  const txtClr = isSelected ? opt.color : 'var(--text-secondary)';
                  return (
                    <button key={opt.idx} type="button" onClick={() => setCorrectOption(opt.idx)}
                      style={{ flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', border: '2px solid ' + borderClr, background: bgClr, color: txtClr }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Identification / Short Answer */}
          {(type === 'identification' || type === 'short_answer') && (
            <div style={{ marginBottom: '20px', padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Correct Answer</label>
              <input type="text" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder="Expected answer"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Enumeration */}
          {type === 'enumeration' && (
            <div style={{ marginBottom: '20px', padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Correct Answers <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-tertiary)' }}>· Each correct entry earns points</span></label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={'Answer ' + (i + 1)}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {options.length > 1 && (
                    <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '6px', transition: 'all 0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setOptions([...options, ''])}
                style={{ marginTop: '4px', padding: '8px 14px', background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px' }}>+ Add answer</button>
            </div>
          )}

          {/* Coding */}
          {type === 'coding' && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Boilerplate Code</label>
                  <button type="button" onClick={insertJavaBoilerplate}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    + Java Boilerplate
                  </button>
                </div>
                <textarea value={boilerplate} onChange={(e) => setBoilerplate(e.target.value)} rows={7} placeholder="// Starter code for students..."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: '#1a1a2e', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ padding: '20px', borderRadius: '16px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Expected Output</label>
                <input type="text" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder="What the program should output"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          {/* Essay */}
          {type === 'essay' && (
            <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(100, 116, 139, 0.05)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: 0, textAlign: 'center' }}>
                Essay questions are manually graded. No expected answer needed.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
            <Button loading={loading} style={{ flex: 1 }} type="submit">{isEditMode ? 'Save Changes' : 'Add Question'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionBlock({ question, index, onUpdate, onDelete, onEdit, disabled, dragControls }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(question.question_text);
  const points = question.points;
  const savingState = useState(false);
  const setSaving = savingState[1];

  const save = async (field) => {
    if (field === 'text' && text.trim() === question.question_text) return;
    if (field === 'points' && points === question.points) return;
    setSaving(true);
    try {
      const payload = {};
      if (field === 'text') payload.question_text = text;
      if (field === 'points') payload.points = points;
      await api.put('/teacher/activities/' + question.activity_id + '/questions/' + question.id, payload);
      onUpdate({ ...question, ...payload });
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (t) => QUESTION_TYPES.find(qt => qt.id === t)?.label || t;

  return (
    <div style={{ padding: '20px 20px 20px 12px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          <div
            onPointerDown={(e) => dragControls?.start(e)}
            style={{ padding: '6px', borderRadius: '8px', cursor: 'grab', color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <GripVertical size={16} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>#{index + 1}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', textTransform: 'uppercase' }}>{getTypeLabel(question.type)}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{question.points} pt{question.points !== 1 ? 's' : ''}</span>
              {question.is_temp && (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', textTransform: 'uppercase' }}>Saving…</span>
              )}
            </div>
            {isEditing ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { setIsEditing(false); save('text'); }} autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #a78bfa', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            ) : (
              <p onClick={() => !question.is_temp && setIsEditing(true)} style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0, cursor: 'pointer', lineHeight: '1.4' }}>{question.question_text}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {!disabled && !question.is_temp && (
            <button onClick={() => onEdit?.(question)}
              style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '8px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#a78bfa'; e.currentTarget.style.background = 'rgba(167, 139, 250, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
              type="button" title="Edit question"><Edit3 size={14} /></button>
          )}
          {!disabled && !question.is_temp && (
            <button onClick={() => onDelete(question)}
              style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '8px', transition: 'all 0.2s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
              type="button" title="Delete question"><Trash2 size={15} /></button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReorderItemWrapper({ question, index, onUpdate, onDelete, onEdit, disabled }) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item value={question} dragListener={false} dragControls={dragControls}>
      <QuestionBlock question={question} index={index} onUpdate={onUpdate} onDelete={onDelete} onEdit={onEdit} disabled={disabled} dragControls={dragControls} />
    </Reorder.Item>
  );
}

export default function ActivityEditor() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const originalRef = useRef(null);
  const dirtyRef = useRef({});
  const saveTimerRef = useRef(null);
  const savingRef = useRef(false);
  const pendingFlushRef = useRef(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editQuestion, setEditQuestion] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteFileTarget, setDeleteFileTarget] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/teacher/activities/' + activityId + '/upload-instruction-file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setActivity((prev) => ({ ...prev, instruction_files: res.data }));
      toast.success('File uploaded');
    } catch {
      toast.error('Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (publicId) => {
    if (!publicId) {
      toast.error('Cannot delete file: missing identifier');
      return;
    }
    try {
      const res = await api.post('/teacher/activities/' + activityId + '/delete-instruction-file', { public_id: publicId });
      setActivity((prev) => ({ ...prev, instruction_files: res.data }));
      toast.success('File removed');
    } catch (err) {
      console.error('Delete file error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to remove file');
    }
  };

  const handleConfirmDeleteFile = () => {
    if (deleteFileTarget) {
      handleDeleteFile(deleteFileTarget);
      setDeleteFileTarget(null);
    }
  };

  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get(`/teacher/activities/${activityId}`);
      setActivity(res.data);
      originalRef.current = res.data;
    } catch {
      toast.error('Failed to load activity');
      navigate(`/dashboard/teacher/class/${classId}`);
    } finally {
      setLoading(false);
    }
  }, [activityId, classId, navigate]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const flushSave = useCallback(async () => {
    if (savingRef.current) {
      pendingFlushRef.current = true;
      return;
    }
    const dirty = dirtyRef.current;
    if (Object.keys(dirty).length === 0) return;
    dirtyRef.current = {};
    savingRef.current = true;
    try {
      await api.put(`/teacher/activities/${activityId}`, dirty);
      originalRef.current = { ...originalRef.current, ...dirty };
      toast.success('Saved', { id: 'activity-save' });
    } catch {
      dirtyRef.current = { ...dirty, ...dirtyRef.current };
      toast.error('Failed to save', { id: 'activity-save-error' });
    } finally {
      savingRef.current = false;
      if (pendingFlushRef.current) {
        pendingFlushRef.current = false;
        flushSave();
      }
    }
  }, [activityId]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { flushSave(); }, 1000);
  }, [flushSave]);

  const handleFieldChange = useCallback((field, value) => {
    setActivity((prev) => ({ ...prev, [field]: value }));
    const original = originalRef.current;
    if (original && original[field] === value) {
      if (field in dirtyRef.current) {
        const next = { ...dirtyRef.current };
        delete next[field];
        dirtyRef.current = next;
      }
    } else {
      dirtyRef.current = { ...dirtyRef.current, [field]: value };
    }
    scheduleSave();
  }, [scheduleSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      flushSave();
    };
  }, [flushSave]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await api.post(`/teacher/activities/${activityId}/publish`);
      setActivity((prev) => ({ ...prev, is_published: res.data.is_published }));
      if (res.data.is_published) {
        toast.success('Published!');
      } else {
        toast.warning('Unpublished');
      }
    } catch {
      toast.error('Failed to toggle publish');
    } finally {
      setPublishing(false);
    }
  };

  const handleAddQuestion = async (payload) => {
    const tempId = 'temp-' + Date.now();
    const tempQuestion = {
      id: tempId,
      activity_id: activityId,
      type: payload.type,
      question_text: payload.question_text,
      options: payload.options || [],
      expected_output: payload.expected_output || '',
      boilerplate: payload.boilerplate || '',
      points: payload.points,
      order_index: (activity?.questions?.length ?? 0) + 1,
      is_temp: true,
    };
    setActivity((prev) => ({ ...prev, questions: [...(prev.questions || []), tempQuestion] }));
    try {
      const res = await api.post(`/teacher/activities/${activityId}/questions`, payload);
      setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === tempId ? res.data : q)) }));
      invalidateCache(`get:/teacher/activities/${activityId}`);
      toast.success('Question added');
    } catch {
      setActivity((prev) => ({ ...prev, questions: (prev.questions || []).filter((q) => q.id !== tempId) }));
      toast.error('Failed to add question');
    }
  };

  const handleUpdateQuestion = (updated) => {
    setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === updated.id ? updated : q)) }));
    invalidateCache(`get:/teacher/activities/${activityId}`);
  };

  const handleDeleteQuestion = async (question) => {
    try {
      await api.delete(`/teacher/activities/${activityId}/questions/${question.id}`);
      setActivity((prev) => ({ ...prev, questions: (prev.questions || []).filter((q) => q.id !== question.id) }));
      invalidateCache(`get:/teacher/activities/${activityId}`);
      toast.success('Question removed');
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleEditQuestionSubmit = async (payload) => {
    if (!editQuestion) return;
    try {
      const res = await api.put(`/teacher/activities/${activityId}/questions/${editQuestion.id}`, payload);
      setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === editQuestion.id ? res.data : q)) }));
      invalidateCache(`get:/teacher/activities/${activityId}`);
      setEditQuestion(null);
      toast.success('Question updated');
    } catch {
      toast.error('Failed to update question');
    }
  };

  const handleReorderQuestions = async (newOrder) => {
    setActivity((prev) => ({ ...prev, questions: newOrder }));
    try {
      await api.post(`/teacher/activities/${activityId}/questions/reorder`, { question_ids: newOrder.map((q) => q.id) });
    } catch {
      toast.error('Failed to reorder');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Loader2 className="animate-spin" size={32} color="var(--text-tertiary)" />
    </div>;
  }

  if (!activity) return null;

  const isQuiz = activity.activity_type === 'quiz';
  const isActivity = activity.activity_type === 'activity';
  const isLive = activity.is_live;
  const isPastDue = activity.deadline_at && new Date(activity.deadline_at) < new Date();
  const isLocked = activity.is_published && (activity.submissions_count || 0) > 0;
  const quizSettingsDisabled = isQuiz && (isLive || isLocked);
  const questionsDisabled = isPastDue || isLocked;
  const totalQuestionPoints = (activity.questions || []).reduce((sum, q) => sum + Number(q.points), 0);
  const perQuestionDurations = { ...PER_QUESTION_DEFAULTS, ...(activity.per_question_durations || {}) };

  return (
    <div style={{ maxWidth: '100%', padding: '40px 50px', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Back */}
      <button onClick={() => navigate(`/dashboard/teacher/class/${classId}?tab=classwork`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }} type="button">
        <ChevronLeft size={16} /> Back to Class
      </button>

      {/* Past-due banner */}
      {isPastDue && (
        <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={18} style={{ color: '#ef4444', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#ef4444', fontWeight: 600 }}>
            This activity is past due. Only the deadline can be edited.
          </span>
        </div>
      )}
      {/* Locked banner */}
      {isLocked && !isPastDue && (
        <div style={{ padding: '16px 20px', borderRadius: '14px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>
            This activity has {activity.submissions_count} submission(s). Most settings are locked to preserve grading integrity. You can still adjust the deadline.
          </span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <ActivityTypeBadge type={activity.activity_type} submissionType={activity.submission_type} size="md" />
          </div>
          <input value={activity.title} onChange={(e) => handleFieldChange('title', e.target.value)}
            readOnly={isLocked || isPastDue}
            style={{ fontSize: '28px', fontWeight: 700, color: (isLocked || isPastDue) ? 'var(--text-tertiary)' : 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: '4px 0', margin: 0, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activityId}/submissions`)}
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }} type="button">
            <UserCheck size={16} /> {activity.submission_type === 'material' ? 'View Status' : 'Submissions'}
          </button>
          <button onClick={handlePublish} disabled={isPastDue || publishing}
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: activity.is_published ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', color: activity.is_published ? '#16a34a' : 'var(--text-secondary)', cursor: (isPastDue || publishing) ? 'not-allowed' : 'pointer', opacity: (isPastDue || publishing) ? 0.5 : 1, fontWeight: 600, fontSize: '13px' }} type="button">
            {publishing ? <Loader2 className="animate-spin" size={16} /> : activity.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
            {publishing ? (activity.is_published ? 'Unpublishing...' : 'Publishing...') : (activity.is_published ? 'Published' : 'Draft')}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left panel — Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Instructions */}
          <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Instructions</h4>
            <textarea value={activity.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} rows={5} readOnly={isLocked || isPastDue}
              placeholder="Add instructions for students..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: (isLocked || isPastDue) ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: (isLocked || isPastDue) ? 'var(--text-tertiary)' : 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            {!(isLocked || isPastDue) && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1px dashed var(--border-color)', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 600, transition: 'all 0.3s' }}>
                <Upload size={16} />
                {uploadingFile ? 'Uploading...' : 'Attach file'}
                <input type="file" onChange={handleUploadFile} disabled={uploadingFile} style={{ display: 'none' }} accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" />
              </label>
            )}
            {(activity.instruction_files || []).length > 0 && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(activity.instruction_files || []).map((file, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                    <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    {!(isLocked || isPastDue) && (
                      <button onClick={() => setDeleteFileTarget(file.public_id)} type="button"
                        style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '6px', flexShrink: 0, transition: 'all 0.2s' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}><Trash2 size={12} /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {activity.submission_type !== 'material' && !isQuiz && (
          <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Deadline</h4>
            <DateTimePicker value={activity.deadline_at} onChange={(val) => handleFieldChange('deadline_at', val)} />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button onClick={() => handleFieldChange('deadline_behavior', 'hard')}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', border: `1px solid ${activity.deadline_behavior === 'hard' ? '#ef4444' : 'var(--border-color)'}`, background: activity.deadline_behavior === 'hard' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activity.deadline_behavior === 'hard' ? '#ef4444' : 'var(--text-secondary)' }} type="button">Hard Cutoff</button>
              <button onClick={() => handleFieldChange('deadline_behavior', 'soft')}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', border: `1px solid ${activity.deadline_behavior === 'soft' ? '#f59e0b' : 'var(--border-color)'}`, background: activity.deadline_behavior === 'soft' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', color: activity.deadline_behavior === 'soft' ? '#f59e0b' : 'var(--text-secondary)' }} type="button">Soft (late OK)</button>
            </div>
          </div>
          )}

          {/* Submission type (read-only) */}
          {isActivity && activity.submission_type && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Submission Type</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em',
                  background: activity.submission_type === 'file' ? 'rgba(59, 130, 246, 0.15)' : activity.submission_type === 'questions' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                  color: activity.submission_type === 'file' ? '#3b82f6' : activity.submission_type === 'questions' ? '#a78bfa' : '#10b981',
                  border: '1px solid',
                  borderColor: activity.submission_type === 'file' ? 'rgba(59, 130, 246, 0.3)' : activity.submission_type === 'questions' ? 'rgba(167, 139, 250, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                }}>
                  {activity.submission_type === 'file' ? <Upload size={14} /> : activity.submission_type === 'questions' ? <HelpCircle size={14} /> : <BookOpen size={14} />}
                  {activity.submission_type === 'file' ? 'File Submission' : activity.submission_type === 'questions' ? 'Questions' : 'Material'}
                </span>
              </div>
            </div>
          )}

          {/* Grading — depends on submission type (not for quizzes: derived from question mix) */}
          {activity.submission_type !== 'material' && !isQuiz && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Grading</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activity.submission_type === 'file' ? (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    Manual grade (required for file submissions)
                  </div>
                ) : (
                  ['auto', 'manual'].map((opt) => (
                    <button key={opt} onClick={() => handleFieldChange('grading_method', opt)} disabled={isLocked || isPastDue}
                      style={{ padding: '10px 14px', borderRadius: '10px', cursor: (isLocked || isPastDue) ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '13px', textAlign: 'left', opacity: (isLocked || isPastDue) ? 0.5 : 1, border: `1px solid ${activity.grading_method === opt ? '#a78bfa' : 'var(--border-color)'}`, background: activity.grading_method === opt ? 'rgba(167, 139, 250, 0.1)' : 'transparent', color: activity.grading_method === opt ? '#a78bfa' : 'var(--text-secondary)' }} type="button">
                      {opt === 'manual' ? 'Manual grade' : 'Auto-grade'}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Quiz settings — pacing, timer mode, shuffle, reveal (quiz only) */}
          {isQuiz && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Timer size={14} /> Quiz Settings</h4>

              {quizSettingsDisabled && (
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '14px', fontSize: '12px', color: '#f59e0b', fontWeight: 600 }}>
                  {isLive ? 'This quiz is live. Settings are locked until the room closes.' : 'Settings are locked once students have joined.'}
                </div>
              )}

              {/* Pacing */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Pacing</label>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', background: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa', border: '1px solid rgba(167, 139, 250, 0.3)' }}>
                  <Radio size={14} />
                  {activity.pacing_mode === 'teacher' ? 'Teacher-paced' : 'Student-paced'}
                </div>
              </div>

              {/* Timer mode */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Timer</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {TIMER_MODES.map((m) => (
                    <button key={m.id} disabled={quizSettingsDisabled}
                      onClick={() => handleFieldChange('timer_mode', m.id)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: quizSettingsDisabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'center', opacity: quizSettingsDisabled ? 0.5 : 1, border: `1px solid ${activity.timer_mode === m.id ? '#a78bfa' : 'var(--border-color)'}`, background: activity.timer_mode === m.id ? 'rgba(167, 139, 250, 0.1)' : 'transparent', color: activity.timer_mode === m.id ? '#a78bfa' : 'var(--text-secondary)' }} type="button">
                      {m.label}
                    </button>
                  ))}
                </div>

                {activity.timer_mode === 'entire_quiz' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                    <input type="number" min={1} max={300} step={1} value={activity.time_limit_minutes || ''} readOnly={quizSettingsDisabled}
                      onChange={(e) => handleFieldChange('time_limit_minutes', e.target.value ? Number(e.target.value) : null)}
                      placeholder="Minutes"
                      style={{ width: '100px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: quizSettingsDisabled ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>minutes for the whole quiz</span>
                  </div>
                )}

                {activity.timer_mode === 'per_question' && (
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {QUESTION_TYPES.map((t) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>{t.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number" min={5} max={900} step={5}
                            value={perQuestionDurations[t.id] || ''}
                            readOnly={quizSettingsDisabled}
                            onChange={(e) => {
                              const next = { ...perQuestionDurations, [t.id]: e.target.value ? Number(e.target.value) : null };
                              handleFieldChange('per_question_durations', next);
                            }}
                            style={{ width: '72px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: quizSettingsDisabled ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', textAlign: 'right' }} />
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', width: '42px' }}>sec</span>
                        </div>
                      </div>
                    ))}
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>Smart defaults per type — adjust any value.</p>
                  </div>
                )}
              </div>

              {/* Shuffle */}
              <div style={{ marginBottom: '16px' }}>
                <button disabled={quizSettingsDisabled}
                  onClick={() => handleFieldChange('shuffle_questions', !activity.shuffle_questions)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', cursor: quizSettingsDisabled ? 'not-allowed' : 'pointer', opacity: quizSettingsDisabled ? 0.5 : 1, border: `1px solid ${activity.shuffle_questions ? '#a78bfa' : 'var(--border-color)'}`, background: activity.shuffle_questions ? 'rgba(167, 139, 250, 0.1)' : 'transparent', textAlign: 'left' }} type="button">
                  <Shuffle size={16} style={{ color: activity.shuffle_questions ? '#a78bfa' : 'var(--text-tertiary)', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Randomize question order</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Each student gets a different order, assigned at join</div>
                  </div>
                  <div style={{ width: '34px', height: '20px', borderRadius: '999px', background: activity.shuffle_questions ? '#a78bfa' : 'var(--bg-tertiary)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: activity.shuffle_questions ? '16px' : '2px', transition: 'left 0.2s' }} />
                  </div>
                </button>
              </div>

              {/* Show results */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Show results</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[
                    { id: 'immediate', label: 'Immediately' },
                    { id: 'room_close', label: 'When room closes' },
                  ].map((opt) => (
                    <button key={opt.id} disabled={quizSettingsDisabled}
                      onClick={() => handleFieldChange('show_results', opt.id)}
                      style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: quizSettingsDisabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '12px', textAlign: 'center', opacity: quizSettingsDisabled ? 0.5 : 1, border: `1px solid ${activity.show_results === opt.id ? '#a78bfa' : 'var(--border-color)'}`, background: activity.show_results === opt.id ? 'rgba(167, 139, 250, 0.1)' : 'transparent', color: activity.show_results === opt.id ? '#a78bfa' : 'var(--text-secondary)' }} type="button">
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '6px 0 0 0' }}>Answers are never revealed mid-quiz.</p>
              </div>
            </div>
          )}

          {/* Max Points */}
          {activity.submission_type === 'file' && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Max Points</h4>
              <input type="number" min={0} step={0.5} value={activity.max_points ?? ''} disabled={isLocked || isPastDue}
                onChange={(e) => handleFieldChange('max_points', e.target.value ? Number(e.target.value) : null)}
                placeholder="Enter max score"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: (isLocked || isPastDue) ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          {(isQuiz || activity.submission_type === 'questions') && activity.questions && activity.questions.length > 0 && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Max Points</h4>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '18px' }}>
                {totalQuestionPoints} pts
                <span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-tertiary)', marginLeft: '8px' }}>auto-calculated from questions</span>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — Edit (questions / preview) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                {isQuiz ? 'Quiz Questions' : activity.submission_type === 'file' ? 'File Submission Preview' : activity.submission_type === 'material' ? 'Material Preview' : 'Questions'}
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                {isQuiz || activity.submission_type === 'questions'
                  ? (activity.questions || []).length > 0
                    ? `${(activity.questions || []).length} question${(activity.questions || []).length !== 1 ? 's' : ''} · Total: ${(activity.questions || []).reduce((sum, q) => sum + Number(q.points), 0)} pts`
                    : 'No questions yet'
                  : 'Students see this when they open the activity'}
              </p>
            </div>
            {(isQuiz || activity.submission_type === 'questions') && !questionsDisabled && (
              <button onClick={() => setShowAddQuestion(true)}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(to right, #9333ea, #7e22ce)', color: 'white', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }} type="button">
                <Plus size={16} /> Add Question
              </button>
            )}
          </div>

          {isQuiz || activity.submission_type === 'questions' ? (
            (activity.questions || []).length === 0 ? (
              <div style={{ border: '2px dashed var(--border-color)', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#a78bfa' }}><HelpCircle size={28} /></div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', margin: '0 0 6px 0' }}>{isQuiz ? 'No questions yet' : 'No questions added'}</p>
                {!questionsDisabled && (
                  <>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>{isQuiz ? 'Add multiple choice, coding, and more' : 'Add questions for students to answer'}</p>
                    <button onClick={() => setShowAddQuestion(true)}
                      style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(167, 139, 250, 0.3)', color: '#d8b4fe', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }} type="button">
                      <Plus size={14} style={{ marginRight: '6px' }} /> Add Question
                    </button>
                  </>
                )}
              </div>
              ) : questionsDisabled ? (
                <div>
                  <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(100, 116, 139, 0.08)', border: '1px solid var(--border-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                    <EyeOff size={16} /> Questions are locked because this activity is published and has submissions.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(activity.questions || []).map((q) => (
                      <QuestionBlock key={q.id} question={q} index={(activity.questions || []).indexOf(q)}
                        onUpdate={handleUpdateQuestion} onDelete={(question) => setDeleteTarget(question)} onEdit={setEditQuestion} disabled={questionsDisabled} />
                    ))}
                  </div>
                </div>
              ) : (
              <Reorder.Group axis="y" values={activity.questions || []} onReorder={handleReorderQuestions} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(activity.questions || []).map((q) => (
                  <ReorderItemWrapper key={q.id} question={q} index={(activity.questions || []).indexOf(q)}
                    onUpdate={handleUpdateQuestion} onDelete={(question) => setDeleteTarget(question)} onEdit={setEditQuestion} disabled={false}
                  />
                ))}
              </Reorder.Group>
            )
          ) : activity.submission_type === 'file' ? (
            <div style={{ padding: '28px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <Upload size={20} style={{ color: '#3b82f6' }} />
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>File Submission</span>
              </div>
              <div style={{ padding: '20px', borderRadius: '14px', border: '2px dashed var(--border-color)', background: 'var(--bg-primary)', textAlign: 'center', marginBottom: '16px' }}>
                <Upload size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 4px 0', fontWeight: 600 }}>Upload your file</p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>PDF, DOCX, images, or ZIP</p>
              </div>
              {activity.deadline_at && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                  <Clock size={16} style={{ color: activity.deadline_behavior === 'hard' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Due {new Date(activity.deadline_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {activity.deadline_behavior === 'hard' ? ' · Hard cutoff' : ' · Late OK'}
                  </span>
                </div>
              )}
              {activity.max_points && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Max score: <strong style={{ color: 'var(--text-primary)' }}>{activity.max_points}</strong> pts</span>
                </div>
              )}
            </div>
          ) : activity.submission_type === 'material' && (
            <div style={{ padding: '28px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <BookOpen size={20} style={{ color: '#10b981' }} />
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Material Preview</span>
              </div>
              {activity.description ? (
                <div style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Instructions</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{activity.description}</p>
                </div>
              ) : (
                <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', textAlign: 'center', marginBottom: '16px' }}>
                  <BookOpen size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>Add instructions above</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Students will see this content when they view the material</p>
                </div>
              )}
              {(activity.instruction_files || []).length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Attachments</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(activity.instruction_files || []).map((file, i) => {
                      const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);
                      return isImage ? (
                        <a key={i} href={file.url} target="_blank" rel="noopener noreferrer"
                          style={{ borderRadius: '10px', overflow: 'hidden', display: 'inline-block', border: '1px solid var(--border-color)', lineHeight: 0 }}>
                          <img src={file.url} alt={file.name}
                            style={{ maxWidth: '280px', maxHeight: '200px', objectFit: 'contain', display: 'block', background: 'var(--bg-primary)' }} />
                        </a>
                      ) : (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                          <FileText size={16} color="#10b981" />
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CreateQuestionModal key={showAddQuestion} isOpen={showAddQuestion} onClose={() => setShowAddQuestion(false)} onCreated={handleAddQuestion} />
      <CreateQuestionModal key={'edit-' + (editQuestion?.id || 'null')} isOpen={!!editQuestion} onClose={() => setEditQuestion(null)} onEdited={handleEditQuestionSubmit} editQuestion={editQuestion} />
      <DeleteModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) handleDeleteQuestion(deleteTarget); setDeleteTarget(null); }}
        title={deleteTarget?.question_text?.slice(0, 50) || 'Question'} loading={false} />
      <DeleteModal isOpen={!!deleteFileTarget} onClose={() => setDeleteFileTarget(null)} onConfirm={handleConfirmDeleteFile} title="File" loading={false} />
    </div>
  );
}
