import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, GripVertical, Clock, Eye, EyeOff, Loader2, HelpCircle, Upload, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import ActivityTypeBadge from '../../components/teacher/ActivityTypeBadge';
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

function CreateQuestionModal({ isOpen, onClose, onCreated }) {
  const [type, setType] = useState('multiple_choice');
  const [questionText, setQuestionText] = useState('');
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctOption, setCorrectOption] = useState(0);
  const [expectedOutput, setExpectedOutput] = useState('');
  const [boilerplate, setBoilerplate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    setLoading(true);
    try {
      const payload = {
        type,
        question_text: questionText.trim(),
        points,
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
      onCreated(payload);
      onClose();
    } catch {
      toast.error('Failed to create question');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', maxHeight: '90vh', overflow: 'auto' }}
        className="relative z-10 w-full max-w-2xl rounded-[28px] shadow-2xl"
      >
        <form onSubmit={handleSubmit} style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 24px 0' }}>Add Question</h3>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }}>
              {QUESTION_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Question</label>
            <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={3} required placeholder="Enter your question..."
              style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Points</label>
            <input type="number" min={0} step={0.5} value={points} onChange={(e) => setPoints(Number(e.target.value))}
              style={{ width: '120px', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
          </div>

          {type === 'multiple_choice' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Options</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                  <input type="radio" name="correctOption" checked={correctOption === i} onChange={() => setCorrectOption(i)} style={{ accentColor: '#a78bfa' }} />
                  <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Option ${i + 1}`}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {options.length > 2 && (
                    <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setOptions([...options, ''])}
                style={{ padding: '8px 12px', background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px' }}>+ Add option</button>
            </div>
          )}

          {type === 'true_false' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Correct Answer</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setCorrectOption(0)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, border: `2px solid ${correctOption === 0 ? '#10b981' : 'var(--border-color)'}`, background: correctOption === 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-primary)', color: correctOption === 0 ? '#10b981' : 'var(--text-secondary)' }}>True</button>
                <button type="button" onClick={() => setCorrectOption(1)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, border: `2px solid ${correctOption === 1 ? '#ef4444' : 'var(--border-color)'}`, background: correctOption === 1 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-primary)', color: correctOption === 1 ? '#ef4444' : 'var(--text-secondary)' }}>False</button>
              </div>
            </div>
          )}

          {(type === 'identification' || type === 'short_answer') && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Correct Answer</label>
              <input type="text" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder="Expected answer"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {type === 'enumeration' && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Correct Answers</label>
              {options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input type="text" value={opt} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); }} placeholder={`Answer ${i + 1}`}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                  {options.length > 1 && (
                    <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                      style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setOptions([...options, ''])}
                style={{ padding: '8px 12px', background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px' }}>+ Add answer</button>
            </div>
          )}

          {type === 'coding' && (
            <>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Boilerplate Code</label>
                <textarea value={boilerplate} onChange={(e) => setBoilerplate(e.target.value)} rows={6} placeholder="// Starter code for students..."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#1a1a2e', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Expected Output</label>
                <input type="text" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} placeholder="What the program should output"
                  style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </>
          )}

          {type === 'essay' && (
            <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: '20px' }}>Essay questions are manually graded.</p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
            <Button loading={loading} style={{ flex: 1 }} type="submit">Add Question</Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function QuestionBlock({ question, index, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(question.question_text);
  const points = question.points;
  const [, setSaving] = useState(false);

  const save = async (field) => {
    setSaving(true);
    try {
      const payload = {};
      if (field === 'text') payload.question_text = text;
      if (field === 'points') payload.points = points;
      await api.put(`/teacher/activities/${question.activity_id}/questions/${question.id}`, payload);
      onUpdate({ ...question, ...payload });
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (t) => QUESTION_TYPES.find(qt => qt.id === t)?.label || t;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <GripVertical size={16} color="var(--text-tertiary)" style={{ cursor: 'grab', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase' }}>#{index + 1}</span>
              <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', background: 'rgba(167, 139, 250, 0.1)', color: '#a78bfa', textTransform: 'uppercase' }}>{getTypeLabel(question.type)}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{question.points} pt{question.points !== 1 ? 's' : ''}</span>
            </div>
            {isEditing ? (
              <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { setIsEditing(false); save('text'); }} autoFocus
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #a78bfa', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            ) : (
              <p onClick={() => setIsEditing(true)} style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0, cursor: 'pointer', lineHeight: '1.4' }}>{question.question_text}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => onDelete(question)}
            style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', borderRadius: '6px' }} type="button" title="Delete question"><Trash2 size={14} /></button>
        </div>
      </div>
    </motion.div>
  );
}

export default function ActivityEditor() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [, setOriginalActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/teacher/activities/${activityId}/upload-instruction-file`, formData, {
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
      const res = await api.post(`/teacher/activities/${activityId}/delete-instruction-file`, { public_id: publicId });
      setActivity((prev) => ({ ...prev, instruction_files: res.data }));
      toast.success('File removed');
    } catch (err) {
      console.error('Delete file error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to remove file');
    }
  };

  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get(`/teacher/activities/${activityId}`);
      setActivity(res.data);
      setOriginalActivity(res.data);
    } catch {
      toast.error('Failed to load activity');
      navigate(`/dashboard/teacher/class/${classId}`);
    } finally {
      setLoading(false);
    }
  }, [activityId, classId, navigate]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  const handleFieldChange = (field, value) => {
    setActivity((prev) => ({ ...prev, [field]: value }));
  };

  const saveField = async (field) => {
    if (!activity) return;
    setSaving(true);
    try {
      await api.put(`/teacher/activities/${activityId}`, { [field]: activity[field] });
      setOriginalActivity((prev) => ({ ...prev, [field]: activity[field] }));
      toast.success('Saved');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      const res = await api.post(`/teacher/activities/${activityId}/publish`);
      setActivity((prev) => ({ ...prev, is_published: res.data.is_published }));
      setOriginalActivity((prev) => ({ ...prev, is_published: res.data.is_published }));
      toast.success(res.data.is_published ? 'Published!' : 'Unpublished');
    } catch {
      toast.error('Failed to toggle publish');
    }
  };

  const handleAddQuestion = async (payload) => {
    try {
      const res = await api.post(`/teacher/activities/${activityId}/questions`, payload);
      setActivity((prev) => ({ ...prev, questions: [...(prev.questions || []), res.data] }));
      toast.success('Question added');
    } catch {
      toast.error('Failed to add question');
    }
  };

  const handleUpdateQuestion = (updated) => {
    setActivity((prev) => ({ ...prev, questions: (prev.questions || []).map((q) => (q.id === updated.id ? updated : q)) }));
  };

  const handleDeleteQuestion = async (question) => {
    try {
      await api.delete(`/teacher/activities/${activityId}/questions/${question.id}`);
      setActivity((prev) => ({ ...prev, questions: (prev.questions || []).filter((q) => q.id !== question.id) }));
      toast.success('Question removed');
    } catch {
      toast.error('Failed to delete question');
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

  return (
    <div style={{ maxWidth: '100%', padding: '40px 50px', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Back */}
      <button onClick={() => navigate(`/dashboard/teacher/class/${classId}?tab=classwork`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }} type="button">
        <ChevronLeft size={16} /> Back to Class
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <ActivityTypeBadge type={activity.activity_type} submissionType={activity.submission_type} size="md" />
          </div>
          <input value={activity.title} onChange={(e) => handleFieldChange('title', e.target.value)} onBlur={() => saveField('title')}
            style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', border: 'none', outline: 'none', width: '100%', padding: '4px 0', margin: 0, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button onClick={handlePublish}
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: activity.is_published ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)', color: activity.is_published ? '#16a34a' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }} type="button">
            {activity.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
            {activity.is_published ? 'Published' : 'Draft'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '32px', alignItems: 'start' }}>
        {/* Left panel — Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Instructions */}
          <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Instructions</h4>
            <textarea value={activity.description || ''} onChange={(e) => handleFieldChange('description', e.target.value)} onBlur={() => saveField('description')} rows={5}
              placeholder="Add instructions for students..." style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1px dashed var(--border-color)', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px', fontWeight: 600, transition: 'all 0.3s' }}>
                <Upload size={16} />
                {uploadingFile ? 'Uploading...' : 'Attach file'}
                <input type="file" onChange={handleUploadFile} disabled={uploadingFile} style={{ display: 'none' }} />
              </label>
              {(activity.instruction_files || []).length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(activity.instruction_files || []).map((file, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                      <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <button onClick={() => handleDeleteFile(file.public_id)} type="button"
                        style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', flexShrink: 0 }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Deadline */}
          <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Deadline</h4>
            <input type="datetime-local" value={activity.deadline_at ? activity.deadline_at.slice(0, 16) : ''}
              onChange={(e) => handleFieldChange('deadline_at', e.target.value ? e.target.value + ':00' : null)} onBlur={() => saveField('deadline_at')}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button onClick={() => { handleFieldChange('deadline_behavior', 'hard'); saveField('deadline_behavior'); }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', border: `1px solid ${activity.deadline_behavior === 'hard' ? '#ef4444' : 'var(--border-color)'}`, background: activity.deadline_behavior === 'hard' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: activity.deadline_behavior === 'hard' ? '#ef4444' : 'var(--text-secondary)' }} type="button">Hard Cutoff</button>
              <button onClick={() => { handleFieldChange('deadline_behavior', 'soft'); saveField('deadline_behavior'); }}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', border: `1px solid ${activity.deadline_behavior === 'soft' ? '#f59e0b' : 'var(--border-color)'}`, background: activity.deadline_behavior === 'soft' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', color: activity.deadline_behavior === 'soft' ? '#f59e0b' : 'var(--text-secondary)' }} type="button">Soft (late OK)</button>
            </div>
          </div>

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

          {/* Grading — depends on submission type */}
          {activity.submission_type !== 'material' && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Grading</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activity.submission_type === 'file' ? (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', fontWeight: 600, fontSize: '13px', border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                    Manual grade (required for file submissions)
                  </div>
                ) : (
                  ['auto', 'manual'].map((opt) => (
                    <button key={opt} onClick={() => { handleFieldChange('grading_method', opt); saveField('grading_method'); }}
                      style={{ padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', textAlign: 'left', border: `1px solid ${activity.grading_method === opt ? '#a78bfa' : 'var(--border-color)'}`, background: activity.grading_method === opt ? 'rgba(167, 139, 250, 0.1)' : 'transparent', color: activity.grading_method === opt ? '#a78bfa' : 'var(--text-secondary)' }} type="button">
                      {opt === 'manual' ? 'Manual grade' : 'Auto-grade'}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Timer — only for quiz and questions-type activity */}
          {(isQuiz || activity.submission_type === 'questions') && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={14} /> Time Limit</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="number" min={0} step={1} value={activity.time_limit_minutes || ''}
                  onChange={(e) => handleFieldChange('time_limit_minutes', e.target.value ? Number(e.target.value) : null)} onBlur={() => saveField('time_limit_minutes')}
                  placeholder="No limit"
                  style={{ width: '100px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>minutes</span>
              </div>
            </div>
          )}

          {/* Max Points — hide for Material */}
          {activity.submission_type !== 'material' && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0' }}>Max Points</h4>
              <input type="number" min={0} step={0.5} value={activity.max_points ?? ''}
                onChange={(e) => handleFieldChange('max_points', e.target.value ? Number(e.target.value) : null)} onBlur={() => saveField('max_points')}
                placeholder={activity.submission_type === 'file' ? 'Enter max score' : 'Auto-calculated from questions'}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
        </div>

        {/* Right panel — Questions or Preview */}
        {isQuiz || activity.submission_type === 'questions' ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Questions</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                  {(activity.questions || []).length > 0
                    ? `${(activity.questions || []).length} question${(activity.questions || []).length !== 1 ? 's' : ''} · Total: ${(activity.questions || []).reduce((sum, q) => sum + Number(q.points), 0)} pts`
                    : isQuiz ? 'Add questions to build your quiz' : 'Add questions for this activity'}
                </p>
              </div>
              <button onClick={() => setShowAddQuestion(true)}
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: 'linear-gradient(to right, #9333ea, #7e22ce)', color: 'white', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }} type="button">
                <Plus size={16} /> Add Question
              </button>
            </div>

            {(activity.questions || []).length === 0 ? (
              <div style={{ border: '2px dashed var(--border-color)', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#a78bfa' }}><HelpCircle size={28} /></div>
                <p style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', margin: '0 0 6px 0' }}>
                  {isQuiz ? 'No questions yet' : 'No questions added'}
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
                  {isQuiz ? 'Add multiple choice, coding, and more' : 'Add questions for students to answer'}
                </p>
                <button onClick={() => setShowAddQuestion(true)}
                  style={{ padding: '10px 20px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(167, 139, 250, 0.3)', color: '#d8b4fe', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }} type="button">
                  <Plus size={14} style={{ marginRight: '6px' }} /> Add Question
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(activity.questions || []).map((q, i) => (
                  <QuestionBlock key={q.id} question={q} index={i} onUpdate={handleUpdateQuestion} onDelete={(question) => setDeleteTarget(question)} />
                ))}
              </div>
            )}
          </div>
        ) : activity.submission_type === 'file' ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Student View Preview</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>Students will see this when they open the activity</p>
            </div>

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
          </div>
        ) : activity.submission_type === 'material' && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>Student View Preview</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>Students will see the instructions as reference material</p>
            </div>

            <div style={{ padding: '28px', borderRadius: '20px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <BookOpen size={20} style={{ color: '#10b981' }} />
                <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)' }}>Material</span>
              </div>

              <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                <BookOpen size={32} style={{ color: 'var(--text-tertiary)', marginBottom: '8px' }} />
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>No submission required</p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>Students can read and review the instructions</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateQuestionModal isOpen={showAddQuestion} onClose={() => setShowAddQuestion(false)} onCreated={handleAddQuestion} />
      <DeleteModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) handleDeleteQuestion(deleteTarget); setDeleteTarget(null); }}
        title={deleteTarget?.question_text?.slice(0, 50) || 'Question'} loading={false} />
    </div>
  );
}
