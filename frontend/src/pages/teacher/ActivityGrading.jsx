import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Loader2, CheckSquare, Download, MessageSquare, Search, Edit3, FileText, ImageIcon, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import ActivityTypeBadge from '../../components/teacher/ActivityTypeBadge';
import CodeMirror from '@uiw/react-codemirror';
import { cmExtension, languageOf } from '../../utils/codeLanguages';
import { Eye, Code2 } from 'lucide-react';

function studentName(s) {
  const p = s?.student_profile || s?.student?.student_profile;
  if (p?.first_name || p?.last_name) return (p.first_name + ' ' + p.last_name).trim();
  return s?.student?.name || s?.name || s?.student_name || 'Unknown';
}

function studentAvatar(s) {
  return s?.student?.avatar || s?.avatar || null;
}

function FilePreview({ file }) {
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name || file.url);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!isImage) {
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
        <Download size={14} /> {file.name || 'Download'}
      </a>
    );
  }

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
      {!loaded && !error && (
        <div className="animate-pulse" style={{ height: '200px', background: 'var(--bg-tertiary)' }} />
      )}
      {error ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', color: '#3b82f6', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
          <ImageIcon size={20} /> {file.name || 'View image'} <Download size={14} style={{ marginLeft: 'auto' }} />
        </a>
      ) : (
        <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
          <img src={file.url} alt={file.name} onLoad={() => setLoaded(true)} onError={() => setError(true)}
            style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block', cursor: 'pointer', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s', background: 'var(--bg-primary)' }} />
          <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={12} /> {file.name}
          </div>
        </a>
      )}
    </div>
  );
}

function StudentAvatar({ student, size = 32, style: outerStyle }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const avatar = studentAvatar(student);
  const initial = studentName(student).charAt(0).toUpperCase();
  const isNotSubmitted = student?.status === 'not_submitted';

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, position: 'relative', overflow: 'hidden', ...outerStyle }}>
      {/* Letter fallback */}
      {(!avatar || error) && (
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: isNotSubmitted ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #a78bfa, #7e22ce)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isNotSubmitted ? 'var(--text-tertiary)' : 'white',
          fontWeight: 700, fontSize: Math.round(size * 0.44) + 'px',
        }}>
          {initial}
        </div>
      )}
      {/* Skeleton placeholder while loading */}
      {avatar && !loaded && !error && (
        <div className="animate-pulse" style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'var(--bg-tertiary)',
        }} />
      )}
      {/* Actual image */}
      {avatar && !error && (
        <img src={avatar} alt="" onLoad={() => setLoaded(true)} onError={() => setError(true)}
          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s' }} />
      )}
    </div>
  );
}

export default function ActivityGrading() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [gradingTarget, setGradingTarget] = useState(null);
  const [gradingForm, setGradingForm] = useState({});
  const [gradingSaving, setGradingSaving] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [submissionSearch, setSubmissionSearch] = useState('');

  const fetchActivity = useCallback(async () => {
    try {
      const res = await api.get(`/teacher/activities/${activityId}`);
      setActivity(res.data);
    } catch {
      toast.error('Failed to load activity');
      navigate(`/dashboard/teacher/class/${classId}`);
    } finally {
      setLoading(false);
    }
  }, [activityId, classId, navigate]);

  const fetchSubmissions = useCallback(async () => {
    if (!activityId) return;
    setLoadingSubmissions(true);
    try {
      const [subRes, enrolledRes] = await Promise.all([
        api.get(`/teacher/activities/${activityId}/submissions`),
        api.get(`/teacher/activities/${activityId}/enrolled-students`),
      ]);
      setSubmissions(Array.isArray(subRes.data) ? subRes.data : []);
      setEnrolledStudents(Array.isArray(enrolledRes.data) ? enrolledRes.data : []);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoadingSubmissions(false);
    }
  }, [activityId]);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);
  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const isMaterial = activity?.submission_type === 'material';

  const handleGradeSubmission = async (submissionId) => {
    setGradingSaving(true);
    try {
      const body = {
        score: gradingForm.score,
        teacher_notes: gradingForm.feedback || '',
      };
      if (gradingTarget.questions && gradingTarget.questions.length > 0) {
        body.answers = gradingTarget.questions.map((q) => ({
          question_id: q.id,
          score: Number(gradingForm.answers?.[q.id]?.score ?? 0) || 0,
        }));
      }
      await api.post(`/teacher/activities/${activityId}/submissions/${submissionId}/grade`, body);
      invalidateCache(`get:/teacher/activities/${activityId}/submissions`);
      invalidateCache(`get:/teacher/activities/${activityId}/enrolled-students`);
      toast.success('Submission graded');
      setGradingTarget(null);
      setGradingForm({});
      fetchSubmissions();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to grade');
    } finally {
      setGradingSaving(false);
    }
  };

  const openGrading = (submission) => {
    // Quiz submissions carry questions nested inside each answer row; surface them
    // as a top-level list so the per-question grading UI can render.
    const questions = (submission.answers || [])
      .map((a) => a.question)
      .filter(Boolean);
    const target = questions.length > 0 ? { ...submission, questions } : submission;

    const form = {
      score: submission.score ?? '',
      feedback: submission.feedback || '',
      answers: {},
    };
    if (target.answers && target.questions) {
      target.questions.forEach((q) => {
        const ans = target.answers.find((a) => a.question_id === q.id);
        // A question the student skipped has no answer row — it starts at 0,
        // never at full points.
        form.answers[q.id] = {
          score: ans?.score ?? 0,
        };
      });
    }
    setGradingForm(form);
    setGradingTarget(target);
  };

  const notSubmitted = enrolledStudents
    .filter((e) => e.submission_status === 'none')
    .map((e) => ({
      id: 'ns-' + e.student.id,
      student: e.student,
      status: 'not_submitted',
      score: null,
      max_score: null,
    }));

  const displayList = submissionFilter === 'not_submitted'
    ? notSubmitted.filter((s) => {
        const name = studentName(s).toLowerCase();
        return !submissionSearch || name.includes(submissionSearch.toLowerCase());
      })
    : submissions.filter((s) => {
        const name = studentName(s).toLowerCase();
        const searchMatch = !submissionSearch || name.includes(submissionSearch.toLowerCase());
        const statusMatch = submissionFilter === 'all' || s.status === submissionFilter;
        return searchMatch && statusMatch;
      });

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Loader2 className="animate-spin" size={32} color="var(--text-tertiary)" />
    </div>;
  }

  if (!activity) return null;

  return (
    <div style={{ maxWidth: '100%', padding: '40px 50px', background: 'var(--bg-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}>
      {/* Back */}
      <button onClick={() => navigate(`/dashboard/teacher/class/${classId}?tab=classwork`)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, marginBottom: '24px' }} type="button">
        <ChevronLeft size={16} /> Back to Class
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <ActivityTypeBadge type={activity.activity_type} submissionType={activity.submission_type} size="md" />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{activity.title}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
            {isMaterial
              ? `${submissions.length} read, ${notSubmitted.length} not read`
              : submissions.length > 0
                ? `${submissions.filter((s) => s.status === 'submitted' || s.status === 'graded').length} submitted, ${submissions.filter((s) => s.status === 'graded').length} graded`
                : 'No submissions yet'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activityId}`)}
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '13px' }} type="button">
            <Edit3 size={16} /> Edit Activity
          </button>
        </div>
      </div>

      {gradingTarget ? (
        /* ── Grading detail view ── */
        <div>
          <button onClick={() => { setGradingTarget(null); setGradingForm({}); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }} type="button">
            <ChevronLeft size={14} /> {isMaterial ? 'Back to reader status' : 'Back to submissions'}
          </button>

          <div style={{ padding: '20px', borderRadius: '16px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <StudentAvatar student={gradingTarget} size={36} />
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>{studentName(gradingTarget)}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                  Submitted {gradingTarget.submitted_at ? new Date(gradingTarget.submitted_at).toLocaleString() : 'N/A'}
                  {gradingTarget.is_late ? ' · Late' : ''}
                </p>
              </div>
            </div>

            {/* File attachments */}
            {gradingTarget.attachments && gradingTarget.attachments.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Submitted Files</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                  {gradingTarget.attachments.map((f, i) => (
                    <FilePreview key={i} file={f} />
                  ))}
                </div>
              </div>
            )}

            {/* Per-answer grading — manual questions first, auto-graded below */}
            {gradingTarget.questions && gradingTarget.questions.length > 0 && (() => {
              const manual = gradingTarget.questions.filter((q) => q.type === 'essay' || q.type === 'coding');
              const auto = gradingTarget.questions.filter((q) => q.type !== 'essay' && q.type !== 'coding');
              const answerOf = (q) => gradingTarget.answers?.find((a) => a.question_id === q.id);
              const questionNumber = (q) => gradingTarget.questions.indexOf(q) + 1;

              const answerSummary = (q, answer) => {
                if (!answer?.submitted_answer) return <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No answer</span>;
                if (q.type === 'multiple_choice') return (q.options?.[parseInt(answer.submitted_answer)] ?? answer.submitted_answer);
                if (q.type === 'enumeration') {
                  try { const items = JSON.parse(answer.submitted_answer); return Array.isArray(items) ? items.join(', ') : answer.submitted_answer; }
                  catch { return answer.submitted_answer; }
                }
                return answer.submitted_answer;
              };

              return (
                <>
                  {manual.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '999px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                          Needs grading · {manual.length}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>score these first — the total updates when you submit</span>
                      </div>
                      {manual.map((q) => {
                        const answer = answerOf(q);
                        const code = q.type === 'coding';
                        return (
                          <div key={q.id} style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid rgba(245, 158, 11, 0.25)', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                Question {questionNumber(q)} · {code ? 'Coding' : 'Essay'}
                              </span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{q.points} pts</span>
                            </div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 10px 0', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{q.question_text}</p>
                            {code && q.boilerplate && (
                              <div style={{ marginBottom: '10px' }}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>Starter code</p>
                                <pre style={{ margin: 0, padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontFamily: 'Consolas, Monaco, "Courier New", monospace', fontSize: '12px', lineHeight: 1.55, whiteSpace: 'pre', overflowX: 'auto' }}>{q.boilerplate}</pre>
                              </div>
                            )}
                            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>Student answer</p>
                            {answer?.submitted_answer ? (
                              code
                                ? <CodingAnswerView language={q.language} code={answer.submitted_answer} />
                                : (
                              <pre style={{ margin: '0 0 12px 0', padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: '13.5px', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {answer.submitted_answer}
                              </pre>
                                )
                            ) : (
                              <p style={{ margin: '0 0 12px 0', padding: '12px 14px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px dashed var(--border-color)', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '13px' }}>No answer submitted</p>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Score:</label>
                              <input type="number" min={0} max={q.points} step={0.5} value={gradingForm.answers?.[q.id]?.score ?? 0}
                                onChange={(e) => { const v = Math.min(Math.max(Number(e.target.value) || 0, 0), q.points); setGradingForm((prev) => ({ ...prev, answers: { ...prev.answers, [q.id]: { score: v } } })); }}
                                style={{ width: '70px', padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ {q.points}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {auto.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          Auto-graded · {auto.length}
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>scored automatically — override if needed</span>
                      </div>
                      {auto.map((q) => {
                        const answer = answerOf(q);
                        return (
                          <div key={q.id} style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, flex: 1 }}>
                                <span style={{ color: 'var(--text-tertiary)', fontWeight: 600 }}>Q{questionNumber(q)} · </span>
                                {q.question_text}
                              </p>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{q.points} pts</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', background: 'var(--bg-secondary)', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {answerSummary(q, answer)}
                              </span>
                              {answer?.is_correct !== null && answer?.is_correct !== undefined && (
                                <span style={{ fontSize: '12px', fontWeight: 600, color: answer?.is_correct ? '#22c55e' : '#ef4444', whiteSpace: 'nowrap' }}>
                                  {answer?.is_correct ? 'Correct (auto)' : 'Incorrect (auto)'}
                                </span>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                                <input type="number" min={0} max={q.points} step={0.5} value={gradingForm.answers?.[q.id]?.score ?? 0}
                                  onChange={(e) => { const v = Math.min(Math.max(Number(e.target.value) || 0, 0), q.points); setGradingForm((prev) => ({ ...prev, answers: { ...prev.answers, [q.id]: { score: v } } })); }}
                                  title="Override the auto score if needed"
                                  style={{ width: '60px', padding: '5px 7px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }} />
                                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>/ {q.points}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Material: just show marked as read */}
            {isMaterial ? (
              <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <CheckCircle size={20} color="#22c55e" />
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#22c55e', margin: '0 0 2px 0' }}>Marked as Read</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {gradingTarget.submitted_at ? new Date(gradingTarget.submitted_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Overall score for file */}
                {(!gradingTarget.questions || gradingTarget.questions.length === 0) && (
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Score</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="number" min={0} max={activity.max_points || 100} step={0.5} value={gradingForm.score}
                        onChange={(e) => { const max = activity.max_points || 100; const v = e.target.value ? Math.min(Math.max(Number(e.target.value), 0), max) : ''; setGradingForm((prev) => ({ ...prev, score: v })); }}
                        placeholder="Score"
                        style={{ width: '100px', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }} />
                      <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>/ {activity.max_points || 'N/A'}</span>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px 0' }}>Overall Feedback</p>
                  <textarea value={gradingForm.feedback}
                    onChange={(e) => setGradingForm((prev) => ({ ...prev, feedback: e.target.value }))}
                    placeholder="Write feedback for the student..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                </div>

                <button onClick={() => handleGradeSubmission(gradingTarget.id)} disabled={gradingSaving}
                  style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', cursor: gradingSaving ? 'not-allowed' : 'pointer', background: 'linear-gradient(to right, #9333ea, #7e22ce)', color: 'white', fontWeight: 700, fontSize: '14px', opacity: gradingSaving ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }} type="button">
                  {gradingSaving ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <CheckSquare size={16} />}
                  {gradingTarget.questions?.some((q) => q.type === 'essay' || q.type === 'coding')
                    ? 'Submit Grade'
                    : 'Save Score Overrides'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Submissions list ── */
        <div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
              <input type="text" value={submissionSearch} onChange={(e) => setSubmissionSearch(e.target.value)}
                placeholder="Search students..." style={{ width: '100%', padding: '8px 10px 8px 30px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <select value={submissionFilter} onChange={(e) => setSubmissionFilter(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}>
              {isMaterial ? (
                <>
                  <option value="all">All</option>
                  <option value="submitted">Read</option>
                  <option value="not_submitted">Not Read</option>
                </>
              ) : (
                <>
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="graded">Graded</option>
                  <option value="not_submitted">Not Submitted</option>
                </>
              )}
            </select>
          </div>

          {loadingSubmissions ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <Loader2 size={28} className="animate-spin" color="var(--text-tertiary)" />
            </div>
          ) : displayList.length === 0 ? (
            <div style={{ border: '2px dashed var(--border-color)', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#a78bfa' }}><MessageSquare size={28} /></div>
              <p style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', margin: '0 0 6px 0' }}>{submissionSearch || submissionFilter !== 'all' ? 'No matching entries' : 'No submissions yet'}</p>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>{submissionSearch || submissionFilter !== 'all' ? 'Try adjusting your search or filter' : isMaterial ? 'Students will appear here once they view the material' : 'Submissions will appear here once students submit'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {displayList.map((s) => {
                const isNotSubmitted = s.status === 'not_submitted';
                const score = s.score;
                const maxScore = s.max_score || activity.max_points || (s.questions ? s.questions.reduce((sum, q) => sum + Number(q.points), 0) : null);
                const pct = score != null && maxScore ? Math.round((score / maxScore) * 100) : null;
                return (
                  <div key={s.id} onClick={() => { if (!isNotSubmitted && s.status !== 'draft') openGrading(s); }}
                    style={{ padding: '14px 16px', borderRadius: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', cursor: !isNotSubmitted && s.status !== 'draft' ? 'pointer' : 'default', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '12px' }}
                    onMouseEnter={(e) => { if (!isNotSubmitted && s.status !== 'draft') e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.4)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}>
                    <StudentAvatar student={s} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0', opacity: isNotSubmitted ? 0.5 : 1 }}>
                        {studentName(s)}
                        {isNotSubmitted && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '13px' }}> {isMaterial ? '(not read)' : '(not submitted)'}</span>}
                      </p>
                      {!isNotSubmitted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', fontWeight: 600, background: isMaterial ? 'rgba(16, 185, 129, 0.1)' : (s.status === 'graded' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)'), color: isMaterial ? '#10b981' : (s.status === 'graded' ? '#22c55e' : '#3b82f6') }}>
                            {isMaterial ? 'Read' : (s.status === 'graded' ? 'Graded' : 'Submitted')}
                          </span>
                          {s.is_late && <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>Late</span>}
                          {s.submitted_at && (
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(s.submitted_at).toLocaleDateString()}</span>
                          )}
                          {/* Show file indicator for file submissions */}
                          {activity.submission_type === 'file' && s.attachments && s.attachments.length > 0 && (
                            <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <FileText size={12} /> {s.attachments.length} file{s.attachments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isMaterial && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isNotSubmitted ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>---</span>
                      ) : score != null ? (
                        <div>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: pct !== null && pct >= 60 ? '#22c55e' : '#ef4444' }}>{score}</span>
                          {maxScore && <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>/{maxScore}</span>}
                          {pct !== null && (
                            <div style={{ fontSize: '11px', fontWeight: 600, color: pct >= 60 ? '#22c55e' : '#ef4444' }}>{pct}%</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>Pending</span>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Teacher-side view of a student's code: syntax highlighted in the question's
// language, with a sandboxed live preview for HTML submissions.
function CodingAnswerView({ language, code }) {
  const lang = languageOf(language);
  const isHtml = lang.preview;
  const [tab, setTab] = useState('code');
  const [previewDoc, setPreviewDoc] = useState('');

  const runPreview = () => {
    setPreviewDoc(code);
    setTab('preview');
  };

  return (
    <div style={{ margin: '0 0 12px 0', borderRadius: '10px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', background: `${lang.color}1f`, border: `1px solid ${lang.color}55`, fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: lang.color }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: lang.color }} />
          {lang.label}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setTab('code')} type="button" style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', background: tab === 'code' ? 'rgba(124, 58, 237, 0.14)' : 'transparent', color: tab === 'code' ? '#a78bfa' : 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 800, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Code2 size={10} /> Code
          </button>
          {isHtml && (
            <button onClick={runPreview} type="button" style={{ padding: '5px 10px', borderRadius: '7px', border: 'none', background: tab === 'preview' ? 'rgba(124, 58, 237, 0.14)' : 'transparent', color: tab === 'preview' ? '#a78bfa' : 'var(--text-tertiary)', cursor: 'pointer', fontWeight: 800, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Eye size={10} /> Render Page
            </button>
          )}
        </div>
      </div>
      {tab === 'code' ? (
        <CodeMirror value={code} editable={false} height="320px" extensions={[cmExtension(lang.id)]} theme="dark" basicSetup={{ foldGutter: false, highlightActiveLine: false }} />
      ) : (
        <div style={{ height: '320px', background: '#fff' }}>
          <iframe title="Student HTML Preview" srcDoc={previewDoc} sandbox="allow-scripts allow-forms allow-modals allow-popups" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
        </div>
      )}
    </div>
  );
}
