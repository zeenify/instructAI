import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ClipboardList, AlignLeft, Upload, HelpCircle, BookOpen, Clock } from 'lucide-react';
import Button from '../../components/ui/Button';
import api from '../../services/api';
import { toast } from 'sonner';

const ACTIVITY_TYPES = [
  {
    id: 'quiz',
    label: 'Quiz',
    description: 'Question-based assessment with timer, auto-grading, and live mode',
    icon: Zap, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.3)',
  },
  {
    id: 'activity',
    label: 'Activity',
    description: 'Flexible activity with file submission, questions, or material — deadline and grading',
    icon: ClipboardList, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)',
  },
];

const SUBMISSION_OPTIONS = [
  { id: 'file', label: 'File Submission', desc: 'Students upload files for manual grading', icon: Upload, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.3)' },
  { id: 'questions', label: 'Questions', desc: 'MC, coding, essay questions with auto or manual grading', icon: HelpCircle, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.08)', border: 'rgba(167, 139, 250, 0.3)' },
  { id: 'material', label: 'Material', desc: 'Post resources only — no submission needed', icon: BookOpen, color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', border: 'rgba(16, 185, 129, 0.3)' },
];

export default function CreateActivityModal({ isOpen, onClose, classId, onCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState(null);
  const [submissionType, setSubmissionType] = useState(null);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [deadlineBehavior, setDeadlineBehavior] = useState('hard');
  const [step, setStep] = useState('type');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    if (!selectedType) return;
    setStep('details');
  };

  const handleBack = () => {
    setStep('type');
    setTitle('');
    setDescription('');
    setSubmissionType(null);
    setDeadlineAt('');
    setDeadlineBehavior('hard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedType) return;
    if (selectedType === 'activity' && !submissionType) return;
    const needsDeadline = selectedType !== 'activity' || submissionType !== 'material';
    if (needsDeadline && !deadlineAt) {
      toast.error('Deadline is required for this activity type');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        activity_type: selectedType,
        deadline_at: deadlineAt || null,
        deadline_behavior: deadlineBehavior,
      };
      if (selectedType === 'activity') {
        payload.submission_type = submissionType;
      }
      const res = await api.post(`/teacher/classes/${classId}/activities`, payload);
      toast.success(selectedType === 'quiz' ? 'Quiz created!' : 'Activity created!');
      onCreated(res.data);
      handleClose();
    } catch {
      toast.error('Failed to create');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('type');
    setTitle('');
    setDescription('');
    setSelectedType(null);
    setSubmissionType(null);
    setDeadlineAt('');
    setDeadlineBehavior('hard');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }} className="relative z-10 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl">
            <div style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {step === 'type' ? 'Create New' : selectedType === 'quiz' ? 'Quiz Details' : 'Activity Details'}
                </h2>
                <button onClick={handleClose} style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '8px' }} type="button"><X size={20} /></button>
              </div>

              {step === 'type' && (
                <div>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>What do you want to create?</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {ACTIVITY_TYPES.map((t) => {
                      const Icon = t.icon;
                      const isSelected = selectedType === t.id;
                      return (
                        <button key={t.id} onClick={() => setSelectedType(t.id)} type="button"
                          style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '16px', border: `2px solid ${isSelected ? t.color : 'var(--border-color)'}`, background: isSelected ? t.bg : 'var(--bg-primary)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.3s' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: t.bg, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.color, flexShrink: 0 }}><Icon size={24} /></div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{t.label}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{t.description}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                    <button onClick={handleClose} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }} type="button">Cancel</button>
                    <Button onClick={handleNext} disabled={!selectedType} style={{ flex: 1 }}>Next</Button>
                  </div>
                </div>
              )}

              {step === 'details' && (
                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}><AlignLeft size={12} style={{ marginRight: '6px' }} /> Title</label>
                    <input type="text" placeholder={selectedType === 'quiz' ? 'e.g. Chapter 1 Quiz' : 'e.g. Lab Report, Essay'} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>

                  {selectedType === 'activity' && (
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Submission Type</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {SUBMISSION_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const isSelected = submissionType === opt.id;
                          return (
                            <button key={opt.id} type="button" onClick={() => setSubmissionType(opt.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left', border: `2px solid ${isSelected ? opt.color : 'var(--border-color)'}`, background: isSelected ? opt.bg : 'var(--bg-primary)' }}>
                              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: opt.bg, border: `1px solid ${opt.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: opt.color, flexShrink: 0 }}><Icon size={18} /></div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{opt.label}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{opt.desc}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}><AlignLeft size={12} style={{ marginRight: '6px' }} /> Instructions (optional)</label>
                    <textarea placeholder={selectedType === 'quiz' ? 'Quiz instructions, rules, or notes...' : 'Describe the task, include rubric or guidelines...'} value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                      style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>

                  {/* Deadline */}
                  <div style={{ marginBottom: '24px', padding: '16px', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={14} /> {selectedType === 'activity' && submissionType === 'material' ? 'Deadline (optional)' : 'Deadline'}
                    </h4>
                    <input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                      <button type="button" onClick={() => setDeadlineBehavior('hard')}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', border: `1px solid ${deadlineBehavior === 'hard' ? '#ef4444' : 'var(--border-color)'}`, background: deadlineBehavior === 'hard' ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: deadlineBehavior === 'hard' ? '#ef4444' : 'var(--text-secondary)' }}>Hard Cutoff</button>
                      <button type="button" onClick={() => setDeadlineBehavior('soft')}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '11px', border: `1px solid ${deadlineBehavior === 'soft' ? '#f59e0b' : 'var(--border-color)'}`, background: deadlineBehavior === 'soft' ? 'rgba(245, 158, 11, 0.1)' : 'transparent', color: deadlineBehavior === 'soft' ? '#f59e0b' : 'var(--text-secondary)' }}>Soft (late OK)</button>
                    </div>
                    {selectedType === 'activity' && submissionType === 'material' && deadlineAt && (
                      <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '8px 0 0 0' }}>Optional for materials — students can still view without submitting.</p>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleBack} type="button" style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '14px' }}>Back</button>
                    <Button loading={loading} style={{ flex: 1 }} type="submit">{selectedType === 'quiz' ? 'Create Quiz' : 'Create Activity'}</Button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
