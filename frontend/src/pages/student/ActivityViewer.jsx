import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api, { invalidateCache } from '../../services/api';
import {
  ChevronLeft, Clock, CheckCircle2, Circle, AlertTriangle, AlertCircle, Hourglass,
  FileText, Upload, Trash2, Loader2, Download, ImageIcon,
  Send, Code as CodeIcon, Plus, XCircle, Play
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, parseISO, isPast, format } from 'date-fns';
import CodeMirror from '@uiw/react-codemirror';
import { java } from '@codemirror/lang-java';
import StudentActivityCard from '../../components/student/StudentActivityCard';
import ConfirmModal from '../../components/ui/ConfirmModal';
import '../../pages/student/Student.css';

const typeConfig = {
  quiz: { label: 'Quiz', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
  file: { label: 'File Submission', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)' },
  questions: { label: 'Q&A', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' },
  material: { label: 'Material', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
};

export default function ActivityViewer() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [sidebarActivities, setSidebarActivities] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [activity, setActivity] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [removingFileId, setRemovingFileId] = useState(null);
  const [unsubmitting, setUnsubmitting] = useState(false);
  const [showUnsubmitModal, setShowUnsubmitModal] = useState(false);
  const [showUnansweredModal, setShowUnansweredModal] = useState(false);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [canSubmit, setCanSubmit] = useState(true);
  const mounted = useRef(true);

  const fetchSidebar = useCallback(async () => {
    try {
      const res = await api.get(`/student/classes/${classId}/activities`);
      setSidebarActivities(res.data);
    } catch { /* ignore */ } finally { setSidebarLoading(false); }
  }, [classId]);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/student/activities/${activityId}`);
      setActivity(res.data.activity);
      setSubmission(res.data.submission);
      setCanSubmit(res.data.can_submit !== false);

      if (res.data.submission?.answers) {
        const restored = {};
        res.data.submission.answers.forEach(ans => {
          try { restored[ans.question_id] = JSON.parse(ans.submitted_answer); }
          catch { restored[ans.question_id] = ans.submitted_answer; }
        });
        setAnswers(restored);
      }

      if (res.data.submission?.attachments?.length) {
        setUploadedFiles(res.data.submission.attachments);
      }

      if (res.data.activity.submission_type === 'material' && !res.data.submission) {
        try {
          const r = await api.post(`/student/activities/${activityId}/submit`, {});
          if (mounted) {
            setSubmission(r.data);
            invalidateCache(`get:/student/classes/${classId}/activities`);
            fetchSidebar();
          }
        } catch {
          // ignore
        }
      }
    } catch {
      toast.error('Failed to load activity');
      navigate(`/dashboard/student/class/${classId}?tab=activities`);
    } finally { setLoading(false); }
  }, [activityId, classId, navigate, fetchSidebar]);

  useEffect(() => { fetchSidebar(); return () => { mounted.current = false; }; }, [fetchSidebar]);
  useEffect(() => { mounted.current = true; fetchActivity(); return () => { mounted.current = false; }; }, [fetchActivity]);

  const saveAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post(`/student/activities/${activityId}/upload-file`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedFiles(res.data);
      toast.success('File uploaded');
    } catch {
      toast.error('Failed to upload file');
    } finally { setUploadingFile(false); }
    e.target.value = '';
  };

  const handleRemoveFile = async (publicId) => {
    setRemovingFileId(publicId);
    try {
      const res = await api.delete(`/student/activities/${activityId}/remove-file`, { data: { public_id: publicId } });
      setUploadedFiles(res.data);
      toast.warning('File removed');
    } catch {
      toast.error('Failed to remove file');
    } finally {
      setRemovingFileId(null);
    }
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {};

      if (activity.submission_type === 'questions') {
        payload.answers = answers;
        payload.question_ids = (activity.questions || []).map(q => q.id);
      }

      const res = await api.post(`/student/activities/${activityId}/submit`, payload);
      setSubmission(res.data);
      toast.success(activity.submission_type === 'material' ? 'Marked as complete' : 'Submitted successfully');
      invalidateCache(`get:/student/classes/${classId}/activities`);

      if (res.data.status === 'graded') {
        if (res.data.answers) {
          const restored = {};
          res.data.answers.forEach(ans => {
            try { restored[ans.question_id] = JSON.parse(ans.submitted_answer); }
            catch { restored[ans.question_id] = ans.submitted_answer; }
          });
          setAnswers(restored);
        }
      }
      fetchSidebar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (activity.submission_type === 'questions') {
      const unanswered = (activity.questions || []).filter(q => {
        const val = answers[q.id];
        if (q.type === 'enumeration') return !Array.isArray(val) || val.every(v => !v.trim());
        if (q.type === 'essay' || q.type === 'coding' || q.type === 'short_answer' || q.type === 'identification') return !val || !String(val).trim();
        return val === undefined || val === null || val === '';
      });
      if (unanswered.length > 0) {
        setUnansweredCount(unanswered.length);
        setShowUnansweredModal(true);
        return;
      }
    }

    doSubmit();
  };

  const handleUnsubmit = useCallback(async () => {
    if (unsubmitting) return;
    setShowUnsubmitModal(false);
    setUnsubmitting(true);
    try {
      await api.post(`/student/activities/${activityId}/unsubmit`);
      invalidateCache(`get:/student/classes/${classId}/activities`);
      toast.warning('Submission unsubmitted');
      setSubmission(null);
      await fetchSidebar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to unsubmit');
    } finally { setUnsubmitting(false); }
  }, [activityId, unsubmitting, fetchSidebar]);

  const currentTypeKey = activity?.activity_type === 'quiz' ? 'quiz' : (activity?.submission_type || 'quiz');
  const typeInfo = typeConfig[currentTypeKey] || typeConfig.quiz;
  const deadlineDate = activity?.deadline_at ? parseISO(activity.deadline_at) : null;
  const isOverdue = deadlineDate && isPast(deadlineDate);
  const isPastDue = isOverdue && activity?.deadline_behavior === 'hard';
  const isSubmitted = submission?.status === 'submitted' || submission?.status === 'graded';
  const isGraded = submission?.status === 'graded';
  const canUnsubmit = !isPastDue && isSubmitted && !isGraded && activity.submission_type === 'file';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <Loader2 className="animate-spin" size={32} color="var(--text-tertiary)" />
      </div>
    );
  }

  if (!activity) return null;

  return (
    <>
    <div style={{ background: 'var(--bg-primary)', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {/* LEFT SIDEBAR */}
      <aside style={{ width: '300px', flexShrink: 0, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <Link to={`/dashboard/student/class/${classId}?tab=activities`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', textDecoration: 'none', marginBottom: '12px' }}
            className="hover:text-[var(--text-primary)] transition-all">
            <ChevronLeft size={14} /> Back to Class
          </Link>
          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Activities
          </h3>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="custom-scrollbar">
          {sidebarLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}><Loader2 className="animate-spin" size={20} color="var(--text-tertiary)" /></div>
          ) : sidebarActivities.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>No activities yet</p>
          ) : (
            sidebarActivities.map(a => (
              <Link
                key={a.id}
                to={`/dashboard/student/class/${classId}/activity/${a.id}`}
                style={{ display: 'block', textDecoration: 'none', marginBottom: '6px' }}
              >
                <StudentActivityCard activity={a} classId={classId} isActive={String(a.id) === String(activityId)} />
              </Link>
            ))
          )}
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="custom-scrollbar">
        <div style={{ maxWidth: '1400px', margin: '0 auto', width: '100%', padding: '40px 64px 120px' }}>

          {/* HEADER */}
          <div style={{ marginBottom: '32px' }}>
            <Link to={`/dashboard/student/class/${classId}?tab=activities`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 600, textDecoration: 'none', marginBottom: '16px' }}
              className="hover:text-[var(--text-primary)] transition-all">
              <ChevronLeft size={14} /> Back to Class
            </Link>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: typeInfo.bg, color: typeInfo.color }}>{typeInfo.label}</span>
                  {isSubmitted && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: (isGraded || activity.submission_type === 'material') ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)', color: (isGraded || activity.submission_type === 'material') ? '#10b981' : '#f59e0b' }}>
                      {isGraded ? `Graded: ${submission.score}/${submission.max_score}` : activity.submission_type === 'material' ? 'Read' : 'Submitted'}
                    </span>
                  )}
                  {isPastDue && !isSubmitted && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>Missed</span>
                  )}
                  {isOverdue && !isPastDue && (
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>Late</span>
                  )}
                </div>
                <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0', letterSpacing: '-0.02em' }}>{activity.title}</h1>
                {deadlineDate && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: isOverdue ? '#ef4444' : 'var(--text-tertiary)' }}>
                    <Clock size={14} />
                    <span>Due {format(deadlineDate, 'MMM d, h:mm a')} ({formatDistanceToNow(deadlineDate, { addSuffix: true })})</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* INSTRUCTIONS */}
          {activity.description && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px 0' }}>Instructions</h4>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{activity.description}</p>
            </div>
          )}

          {/* INSTRUCTION FILES */}
          {activity.instruction_files?.length > 0 && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginBottom: '24px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px 0' }}>Materials</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activity.instruction_files.map((f, i) => {
                  const isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f.name);
                  return isImage ? (
                    <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', width: '360px' }}>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: '220px', background: '#f9fafb', cursor: 'pointer' }}>
                        <img src={f.url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </a>
                      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', borderTop: '1px solid var(--border-color)' }}>
                        <ImageIcon size={14} color="var(--text-tertiary)" />
                        <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)' }}>{f.name}</span>
                        <a href={f.url} download={f.name} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'var(--accent)', fontSize: '12px', gap: '4px' }}>
                          <Download size={14} /> Download
                        </a>
                      </div>
                    </div>
                  ) : (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', textDecoration: 'none', color: 'var(--text-primary)', fontSize: '13px' }}>
                      <FileText size={16} color="var(--accent)" />
                      <span style={{ flex: 1 }}>{f.name}</span>
                      <Download size={14} color="var(--text-tertiary)" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* SUBMISSION STATUS (after submit) */}
          {isSubmitted && activity.submission_type !== 'material' && (
            <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: isGraded ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                {isGraded ? <CheckCircle2 size={20} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} /> : <Hourglass size={20} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />}
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: isGraded ? '#10b981' : '#f59e0b', margin: 0 }}>
                    {isGraded ? `Graded: ${Number(submission.score).toFixed(0)}/${Number(submission.max_score).toFixed(0)}` : 'Submitted — awaiting grade'}
                  </p>
                  {submission.submitted_at && (
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                      Submitted {formatDistanceToNow(parseISO(submission.submitted_at), { addSuffix: true })}
                    </p>
                  )}
                  {isGraded && submission.teacher_notes && (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0 0', lineHeight: '1.4' }}>
                      {submission.teacher_notes}
                    </p>
                  )}
                </div>
              </div>

              {isGraded && submission.answers?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(activity.questions || []).map((q, idx) => {
                    const ans = submission.answers.find(a => Number(a.question_id) === Number(q.id));
                    return (
                      <div key={q.id} style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
                              {idx + 1}. {q.question_text}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                              Your answer: {ans?.submitted_answer
                                ? q.type === 'multiple_choice'
                                  ? (q.options?.[parseInt(ans.submitted_answer)] ?? ans.submitted_answer)
                                  : q.type === 'enumeration'
                                    ? (() => { try { const items = JSON.parse(ans.submitted_answer); return Array.isArray(items) ? items.join(', ') : ans.submitted_answer; } catch { return ans.submitted_answer; } })()
                                    : ans.submitted_answer
                                : 'No answer'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {ans?.is_correct !== null ? (
                              ans?.is_correct ? <CheckCircle2 size={16} color="#10b981" /> : <XCircle size={16} color="#ef4444" />
                            ) : (
                              <Clock size={16} color="#94a3b8" />
                            )}
                            <span style={{ fontSize: '13px', fontWeight: 700, color: ans?.is_correct ? '#10b981' : ans?.is_correct === false ? '#ef4444' : 'var(--text-tertiary)' }}>
                              {Number(ans?.score || 0).toFixed(0)}/{Number(q.points).toFixed(0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canUnsubmit && (
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowUnsubmitModal(true)} disabled={unsubmitting}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: '#ef4444', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                  >
                    {unsubmitting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                    {unsubmitting ? 'Unsubmitting...' : 'Unsubmit'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MISSED PAST DUE */}
          {isPastDue && !isSubmitted && (
            <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.06)', textAlign: 'center', marginBottom: '24px' }}>
              <AlertCircle size={32} color="#ef4444" style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '16px', fontWeight: 700, color: '#ef4444', margin: '0 0 4px 0' }}>Deadline Passed</p>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>This activity had a hard deadline and is no longer accepting submissions.</p>
            </div>
          )}

          {/* LATE SUBMISSION WARNING (soft deadline) */}
          {isOverdue && !isPastDue && !isSubmitted && (
            <div style={{ padding: '14px 20px', borderRadius: '14px', border: '1px solid rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.06)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
              <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 600 }}>
                The deadline has passed but late submissions are accepted. Your submission will be marked as late.
              </span>
            </div>
          )}

          {/* FILE SUBMISSION */}
          {activity.submission_type === 'file' && canSubmit && (
            <div style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={16} /> {isSubmitted ? 'Submitted Files' : 'Upload Your Work'}
              </h4>

              {!isSubmitted && (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px', borderRadius: '12px', border: '2px dashed var(--border-color)', cursor: 'pointer', color: 'var(--text-tertiary)', marginBottom: '16px', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-glow)'; e.currentTarget.style.background = 'var(--accent-light)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'transparent'; }}>
                  <Upload size={24} />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{uploadingFile ? 'Uploading...' : 'Click to upload a file'}</span>
                  <span style={{ fontSize: '11px' }}>PDF, DOC, images, code files — up to 50MB</span>
                  <input type="file" onChange={handleUploadFile} hidden disabled={uploadingFile} />
                </label>
              )}

              {uploadedFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {uploadedFiles.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                      <FileText size={16} color="var(--accent)" />
                      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{(f.size / 1024).toFixed(0)} KB</span>
                      {!isSubmitted && (
                        <button onClick={() => handleRemoveFile(f.public_id)} type="button" disabled={removingFileId === f.public_id}
                          style={{ padding: '6px', background: 'transparent', border: 'none', cursor: removingFileId === f.public_id ? 'wait' : 'pointer', color: 'var(--text-tertiary)', borderRadius: '6px', transition: 'all 0.2s', opacity: removingFileId === f.public_id ? 0.4 : 1 }}
                          onMouseEnter={(e) => { if (removingFileId !== f.public_id) { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; } }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}>
                          {removingFileId === f.public_id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!isSubmitted && uploadedFiles.length > 0 && (
                <button onClick={handleSubmit} disabled={submitting}
                  style={{ marginTop: '16px', width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: submitting ? 0.6 : 1 }}>
                  {submitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  {submitting ? 'Submitting...' : 'Turn In'}
                </button>
              )}
            </div>
          )}

          {/* QUESTIONS SUBMISSION */}
          {activity.submission_type === 'questions' && canSubmit && !isSubmitted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '0 0 8px 0' }}>
                {activity.questions?.length || 0} question{(activity.questions?.length || 0) !== 1 ? 's' : ''}
              </p>
              {(activity.questions || []).map((q, idx) => (
                <QuestionRenderer key={q.id} question={q} index={idx} value={answers[q.id]} onChange={(val) => saveAnswer(q.id, val)} />
              ))}

              <button onClick={handleSubmit} disabled={submitting}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', background: '#7c3aed', color: 'white', fontWeight: 700, fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                {submitting ? 'Submitting...' : 'Submit Answers'}
              </button>
            </div>
          )}


        </div>
      </main>
    </div>
    <ConfirmModal
      isOpen={showUnsubmitModal}
      onClose={() => setShowUnsubmitModal(false)}
      onConfirm={handleUnsubmit}
      title="Unsubmit Activity?"
      message="You can submit again before the deadline. Your uploaded files will be kept."
      confirmText="Unsubmit"
      loading={unsubmitting}
      variant="warning"
    />
    <ConfirmModal
      isOpen={showUnansweredModal}
      onClose={() => setShowUnansweredModal(false)}
      onConfirm={() => { setShowUnansweredModal(false); doSubmit(); }}
      title="Unanswered Questions"
      message={`You have ${unansweredCount} unanswered question${unansweredCount !== 1 ? 's' : ''}. Submit anyway?`}
      confirmText="Submit Anyway"
      loading={submitting}
      variant="warning"
    />
    </>
  );
}

function QuestionRenderer({ question, index, value, onChange }) {
  const [codeOutput, setCodeOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  if (question.type === 'multiple_choice') {
    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(question.options || []).map((opt, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '10px', border: `1px solid ${value === String(i) ? '#a78bfa' : 'var(--border-color)'}`, background: value === String(i) ? 'rgba(167, 139, 250, 0.08)' : 'var(--bg-primary)', cursor: 'pointer', transition: 'all 0.2s' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: `2px solid ${value === String(i) ? '#a78bfa' : 'var(--border-color)'}`, background: value === String(i) ? '#a78bfa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {value === String(i) && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'white' }} />}
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{opt}</span>
              <input type="radio" name={`q_${question.id}`} checked={value === String(i)} onChange={() => onChange(String(i))} style={{ display: 'none' }} />
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (question.type === 'true_false') {
    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['True', 'False'].map(opt => {
            const sel = value === opt;
            const clr = opt === 'True' ? '#10b981' : '#ef4444';
            return (
              <button key={opt} onClick={() => onChange(opt)}
                style={{ flex: 1, padding: '14px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', border: `2px solid ${sel ? clr : 'var(--border-color)'}`, background: sel ? `${clr}1a` : 'var(--bg-primary)', color: sel ? clr : 'var(--text-secondary)' }}>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === 'identification' || question.type === 'short_answer') {
    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
      </div>
    );
  }

  if (question.type === 'enumeration') {
    const items = Array.isArray(value) ? value : [''];
    const addItem = () => onChange([...items, '']);
    const updateItem = (i, v) => { const n = [...items]; n[i] = v; onChange(n); };
    const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', flexShrink: 0 }}>{i + 1}</div>
              <input type="text" value={item} onChange={(e) => updateItem(i, e.target.value)} placeholder={`Answer ${i + 1}`}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
              {items.length > 1 && (
                <button onClick={() => removeItem(i)} type="button"
                  style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', borderRadius: '6px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={addItem} type="button"
          style={{ marginTop: '8px', padding: '8px 14px', background: 'transparent', border: '1px dashed var(--border-color)', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: '13px' }}>
          <Plus size={14} style={{ marginRight: '4px' }} /> Add answer
        </button>
      </div>
    );
  }

  if (question.type === 'coding') {
    const runCode = async () => {
      setIsRunning(true);
      setCodeOutput('');
      try {
        const res = await api.post('/student/execute', {
          language: 'java',
          code: value || question.boilerplate || '',
        });
        setCodeOutput(res.data.stdout || res.data.stderr || res.data.compile_output || 'No output');
      } catch {
        setCodeOutput('Error executing code');
      } finally { setIsRunning(false); }
    };

    const insertBoilerplate = () => {
      const bp = question.boilerplate || 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}';
      onChange(bp);
    };

    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
          <button onClick={insertBoilerplate} type="button"
            style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', cursor: 'pointer', fontWeight: 600, fontSize: '11px' }}>
            <CodeIcon size={14} style={{ marginRight: '4px' }} /> Reset Boilerplate
          </button>
        </div>
        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <CodeMirror value={value || question.boilerplate || ''} onChange={onChange} height="200px" extensions={[java()]} theme="dark" />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
          <button onClick={runCode} disabled={isRunning} type="button"
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', opacity: isRunning ? 0.6 : 1 }}>
            {isRunning ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />} Run
          </button>
        </div>
        {codeOutput && (
          <div style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: '#1a1a2e', color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '150px', overflow: 'auto' }}>
            {codeOutput}
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'essay') {
    return (
      <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{index + 1}. {question.question_text}</p>
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={5} placeholder="Write your response..."
          style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
      </div>
    );
  }

  return null;
}
