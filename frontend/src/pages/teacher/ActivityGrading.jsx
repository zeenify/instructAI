import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, CheckSquare, Download, MessageSquare, Search, Edit3, FileText, ImageIcon, CheckCircle, Play, Eye, Code2 } from 'lucide-react';
import { toast } from 'sonner';
import api, { invalidateCache } from '../../services/api';
import CodeMirror from '@uiw/react-codemirror';
import { cmExtension, languageOf, normalizeHtmlChecks, injectPreviewBridge } from '../../utils/codeLanguages';
import InteractiveTerminal from '../../components/student/InteractiveTerminal';
import './ActivityGrading.css';

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
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="ag-file-chip">
        <Download size={14} /> {file.name || 'Download'}
      </a>
    );
  }

  return (
    <div className="ag-file-card">
      {!loaded && !error && (
        <div className="db-skeleton" style={{ height: 200, borderRadius: 0 }} />
      )}
      {error ? (
        <a href={file.url} target="_blank" rel="noopener noreferrer" className="ag-file-chip" style={{ margin: 12 }}>
          <ImageIcon size={18} /> {file.name || 'View image'} <Download size={14} style={{ marginLeft: 'auto' }} />
        </a>
      ) : (
        <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
          <img src={file.url} alt={file.name} onLoad={() => setLoaded(true)} onError={() => setError(true)}
            style={{ width: '100%', maxHeight: 400, objectFit: 'contain', display: 'block', cursor: 'pointer', opacity: loaded ? 1 : 0, transition: 'opacity 0.2s', background: 'var(--db-card-2)' }} />
          <div className="ag-file-caption">
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
      {(!avatar || error) && (
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: isNotSubmitted ? 'var(--db-card-2)' : 'linear-gradient(135deg, #409cff, #0066cc)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isNotSubmitted ? 'var(--db-text-3)' : '#ffffff',
          fontWeight: 700, fontSize: Math.round(size * 0.44) + 'px',
        }}>
          {initial}
        </div>
      )}
      {avatar && !loaded && !error && (
        <div className="db-skeleton" style={{ position: 'absolute', inset: 0, borderRadius: '50%' }} />
      )}
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

  const hasEntries = submissions.length > 0 || notSubmitted.length > 0;

  if (loading) {
    return (
      <div className="ed-shell" style={{ paddingTop: 20 }}>
        <div className="db-skeleton" style={{ height: 96, borderRadius: 16, marginBottom: 20 }} />
        <div className="db-skeleton" style={{ height: 64, borderRadius: 12, marginBottom: 12 }} />
        <div className="db-skeleton" style={{ height: 64, borderRadius: 12 }} />
      </div>
    );
  }

  if (!activity) return null;

  const submittedCount = submissions.filter((s) => s.status === 'submitted' || s.status === 'graded').length;
  const gradedCount = submissions.filter((s) => s.status === 'graded').length;

  const kicker = activity.activity_type === 'quiz'
    ? `Quiz · ${activity.pacing_mode === 'teacher' ? 'Teacher-paced' : 'Student-paced'}`
    : `Activity · ${activity.submission_type === 'file' ? 'File submission' : activity.submission_type === 'questions' ? 'Questions' : 'Material'}`;

  const filterChips = isMaterial
    ? [{ id: 'all', label: 'Everyone' }, { id: 'submitted', label: 'Read' }, { id: 'not_submitted', label: 'Not read' }]
    : [{ id: 'all', label: 'Everyone' }, { id: 'submitted', label: 'Submitted' }, { id: 'graded', label: 'Graded' }, { id: 'not_submitted', label: 'Not submitted' }];

  return (
    <div className="ed-shell" style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div className="ag-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, minWidth: 0 }}>
          <button className="ag-back" onClick={() => navigate(`/dashboard/teacher/class/${classId}?tab=classwork`)}
            title="Back to class" type="button">
            <ChevronLeft size={19} />
          </button>
          <div>
            <div className="ag-kicker-row">
              <span className="ag-kicker">{kicker}</span>
            </div>
            <h2 className="ag-title">{activity.title}</h2>
            <p className="ag-meta">
              {isMaterial
                ? <><b>{submissions.length}</b> read · <b>{notSubmitted.length}</b> not read</>
                : submissions.length > 0
                  ? <><b>{submittedCount}</b> submitted · <b>{gradedCount}</b> graded · {submissions.length + notSubmitted.length} students</>
                  : 'No submissions yet'}
            </p>
          </div>
        </div>
        <button className="db-btn-ghost" onClick={() => navigate(`/dashboard/teacher/class/${classId}/activity/${activityId}`)}
          type="button">
          <Edit3 size={15} /> Edit activity
        </button>
      </div>

      {gradingTarget ? (
        /* ── Grading detail view ── */
        <div>
          <button className="ag-backlink" onClick={() => { setGradingTarget(null); setGradingForm({}); }} type="button">
            <ChevronLeft size={14} /> {isMaterial ? 'Back to reader status' : 'Back to submissions'}
          </button>

          <div className="ag-panel">
            <div className="ag-student-row">
              <StudentAvatar student={gradingTarget} size={38} />
              <div>
                <p className="ag-student-name">{studentName(gradingTarget)}</p>
                <p className="ag-student-sub">
                  Submitted {gradingTarget.submitted_at ? new Date(gradingTarget.submitted_at).toLocaleString() : 'N/A'}
                  {gradingTarget.is_late ? ' · late' : ''}
                </p>
              </div>
            </div>

            {/* File attachments */}
            {gradingTarget.attachments && gradingTarget.attachments.length > 0 && (
              <div style={{ marginBottom: 18 }}>
                <p className="ag-section-label">Submitted files</p>
                <div className="ag-files-grid">
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
                if (!answer?.submitted_answer) return <span style={{ color: 'var(--db-text-3)', fontStyle: 'italic' }}>No answer</span>;
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
                    <div style={{ marginBottom: 20 }}>
                      <div className="ag-pill-row">
                        <span className="ag-pill warn">Needs grading · {manual.length}</span>
                        <span className="ag-pill-note">score these first — the total updates when you submit</span>
                      </div>
                      {manual.map((q) => {
                        const answer = answerOf(q);
                        const code = q.type === 'coding';
                        return (
                          <div key={q.id} className="ag-mq">
                            <div className="ag-mq-head">
                              <span className="ag-mq-label">Question {questionNumber(q)} · {code ? 'Coding' : 'Essay'}</span>
                              <span className="ag-mq-label">{q.points} pts</span>
                            </div>
                            <p className="ag-mq-text">{q.question_text}</p>
                            {code && q.boilerplate && (
                              <div style={{ marginBottom: 11 }}>
                                <p className="ag-section-label" style={{ fontSize: 11 }}>Starter code</p>
                                <pre className="ag-pre mono">{q.boilerplate}</pre>
                              </div>
                            )}
                            <p className="ag-section-label" style={{ fontSize: 11 }}>Student answer</p>
                            {answer?.submitted_answer ? (
                              code
                                ? <CodingAnswerView language={q.language} code={answer.submitted_answer} htmlChecks={q.html_checks || []} testResults={answer.test_results} />
                                : <pre className="ag-pre">{answer.submitted_answer}</pre>
                            ) : (
                              <p className="ag-pre empty">No answer submitted</p>
                            )}
                            <div className="ag-score-row">
                              <label className="ag-score-label">Score:</label>
                              <input type="number" min={0} max={q.points} step={0.5} className="ag-score-input"
                                value={gradingForm.answers?.[q.id]?.score ?? 0}
                                onChange={(e) => { const v = Math.min(Math.max(Number(e.target.value) || 0, 0), q.points); setGradingForm((prev) => ({ ...prev, answers: { ...prev.answers, [q.id]: { score: v } } })); }} />
                              <span className="ag-score-max-label">/ {q.points}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {auto.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div className="ag-pill-row">
                        <span className="ag-pill good">Auto-graded · {auto.length}</span>
                        <span className="ag-pill-note">scored automatically — override if needed</span>
                      </div>
                      {auto.map((q) => {
                        const answer = answerOf(q);
                        return (
                          <div key={q.id} className="ag-aq">
                            <div className="ag-aq-head">
                              <p className="ag-aq-text">
                                <span className="ag-qnum">Q{questionNumber(q)} · </span>
                                {q.question_text}
                              </p>
                              <span className="ag-mq-label" style={{ whiteSpace: 'nowrap' }}>{q.points} pts</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span className="ag-aq-answer">
                                {answerSummary(q, answer)}
                              </span>
                              {answer?.is_correct !== null && answer?.is_correct !== undefined && (
                                <span className={`ag-verdict ${answer?.is_correct ? 'pass' : 'fail'}`}>
                                  {answer?.is_correct ? 'Correct (auto)' : 'Incorrect (auto)'}
                                </span>
                              )}
                              <div className="ag-score-row" style={{ marginLeft: 'auto' }}>
                                <input type="number" min={0} max={q.points} step={0.5} className="ag-score-input" style={{ width: 64, fontSize: 13 }}
                                  title="Override the auto score if needed"
                                  value={gradingForm.answers?.[q.id]?.score ?? 0}
                                  onChange={(e) => { const v = Math.min(Math.max(Number(e.target.value) || 0, 0), q.points); setGradingForm((prev) => ({ ...prev, answers: { ...prev.answers, [q.id]: { score: v } } })); }} />
                                <span className="ag-score-max-label">/ {q.points}</span>
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
              <div className="ag-read-note">
                <CheckCircle size={20} style={{ color: 'var(--db-green)', flexShrink: 0 }} />
                <div>
                  <p className="ag-read-title">Marked as read</p>
                  <p className="ag-student-sub">
                    {gradingTarget.submitted_at ? new Date(gradingTarget.submitted_at).toLocaleString() : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Overall score for file */}
                {(!gradingTarget.questions || gradingTarget.questions.length === 0) && (
                  <div style={{ marginBottom: 16 }}>
                    <p className="ag-section-label">Score</p>
                    <div className="ag-score-row">
                      <input type="number" min={0} max={activity.max_points || 100} step={0.5} className="ag-score-input" style={{ width: 104 }}
                        value={gradingForm.score}
                        onChange={(e) => { const max = activity.max_points || 100; const v = e.target.value ? Math.min(Math.max(Number(e.target.value), 0), max) : ''; setGradingForm((prev) => ({ ...prev, score: v })); }}
                        placeholder="Score" />
                      <span className="ag-score-max-label">/ {activity.max_points || 'N/A'}</span>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                <div style={{ marginBottom: 4 }}>
                  <p className="ag-section-label">Overall feedback</p>
                  <textarea className="ag-feedback" value={gradingForm.feedback}
                    onChange={(e) => setGradingForm((prev) => ({ ...prev, feedback: e.target.value }))}
                    placeholder="Write feedback for the student..."
                    rows={3} />
                </div>

                <div className="ag-submit-row">
                  <button className="db-btn-primary" onClick={() => handleGradeSubmission(gradingTarget.id)} disabled={gradingSaving} type="button">
                    {gradingSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
                    {gradingSaving ? 'Submitting…' : gradingTarget.questions?.some((q) => q.type === 'essay' || q.type === 'coding')
                      ? 'Submit grade'
                      : 'Save score overrides'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Submissions list ── */
        <div>
          <div className="ag-filters">
            <div className="ag-search">
              <span className="ag-search-icon"><Search size={14} /></span>
              <input type="text" value={submissionSearch} onChange={(e) => setSubmissionSearch(e.target.value)}
                placeholder="Search students..." />
            </div>
            <div className="ag-seg">
              {filterChips.map((chip) => (
                <button key={chip.id} type="button"
                  className={`ag-seg-btn ${submissionFilter === chip.id ? 'on' : ''}`}
                  onClick={() => setSubmissionFilter(chip.id)}>
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {loadingSubmissions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div className="db-skeleton" style={{ height: 66, borderRadius: 14 }} />
              <div className="db-skeleton" style={{ height: 66, borderRadius: 14 }} />
              <div className="db-skeleton" style={{ height: 66, borderRadius: 14 }} />
            </div>
          ) : displayList.length === 0 ? (
            <div className="ag-empty">
              <div className="ag-empty-icon"><MessageSquare size={24} /></div>
              {/* With nothing submitted at all, "no matching entries" reads
                  wrong — only claim it when there is something to filter */}
              <p className="ag-empty-title">{hasEntries ? 'No matching entries' : 'No submissions yet'}</p>
              <p className="ag-empty-sub">{hasEntries ? 'Try adjusting your search or filter' : isMaterial ? 'Students will appear here once they view the material' : 'Submissions will appear here once students submit'}</p>
            </div>
          ) : (
            <div className="ag-rows">
              {displayList.map((s) => {
                const isNotSubmitted = s.status === 'not_submitted';
                const score = s.score;
                const maxScore = s.max_score || activity.max_points || (s.questions ? s.questions.reduce((sum, q) => sum + Number(q.points), 0) : null);
                const pct = score != null && maxScore ? Math.round((score / maxScore) * 100) : null;
                return (
                  <div key={s.id} role="button" tabIndex={0} className={`ag-row ${isNotSubmitted ? 'muted' : ''}`}
                    onClick={() => { if (!isNotSubmitted && s.status !== 'draft') openGrading(s); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !isNotSubmitted && s.status !== 'draft') openGrading(s); }}>
                    <StudentAvatar student={s} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="ag-row-name">
                        {studentName(s)}
                        {isNotSubmitted && <span style={{ fontWeight: 400, color: 'var(--db-text-3)', fontSize: 13.5 }}> {isMaterial ? '(not read)' : '(not submitted)'}</span>}
                      </p>
                      {!isNotSubmitted && (
                        <div className="ag-row-sub">
                          <span className={`ag-chip ${isMaterial || s.status === 'graded' ? 'graded' : 'submitted'}`}>
                            {isMaterial ? 'Read' : (s.status === 'graded' ? 'Graded' : 'Submitted')}
                          </span>
                          {s.is_late && <span className="ag-chip late">Late</span>}
                          {s.submitted_at && (
                            <span className="ag-row-date">{new Date(s.submitted_at).toLocaleDateString()}</span>
                          )}
                          {activity.submission_type === 'file' && s.attachments && s.attachments.length > 0 && (
                            <span className="ag-row-files">
                              <FileText size={12} /> {s.attachments.length} file{s.attachments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {!isMaterial && (
                    <div className="ag-score">
                      {isNotSubmitted ? (
                        <span className="ag-pending" style={{ color: 'var(--db-text-3)' }}>—</span>
                      ) : score != null ? (
                        <div>
                          <span className={`ag-score-num ${pct !== null && pct < 60 ? 'fail' : 'pass'}`}>{score}</span>
                          {maxScore && <span className="ag-score-max">/{maxScore}</span>}
                          {pct !== null && (
                            <div className={`ag-score-pct ${pct >= 60 ? 'pass' : 'fail'}`}>{pct}%</div>
                          )}
                        </div>
                      ) : (
                        <span className="ag-pending">Pending</span>
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
// language, a sandboxed live preview for HTML submissions (graded against the
// question's page checks, same harness students see), and the same interactive
// terminal students get — the program pauses on input and the teacher types
// into it, exactly like the student's own run.
function CodingAnswerView({ language, code, htmlChecks: htmlChecksProp = [], testResults = null }) {
  const lang = languageOf(language);
  const isHtml = lang.preview;
  const htmlChecks = isHtml ? normalizeHtmlChecks(htmlChecksProp) : [];
  const [tab, setTab] = useState('code');
  const [previewDoc, setPreviewDoc] = useState('');
  const [previewResults, setPreviewResults] = useState(null);
  const termRef = useRef(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!isHtml) return undefined;
    const handler = (event) => {
      if (!event.data || !event.data.__instructai_preview || event.data.type !== 'check-results') return;
      setPreviewResults(event.data.results || []);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [isHtml]);

  const runPreview = () => {
    setPreviewResults(null);
    setPreviewDoc(injectPreviewBridge(code, htmlChecks));
    setTab('preview');
  };

  return (
    <div className="ag-cv">
      <div className="ag-cv-head">
        <span className="ag-cv-lang" style={{ background: `${lang.color}1f`, border: `1px solid ${lang.color}55`, color: lang.color }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: lang.color }} />
          {lang.label}
        </span>
        <div className="ag-cv-tabs">
          <button onClick={() => setTab('code')} type="button" className={`ag-cv-tab ${tab === 'code' ? 'on' : ''}`}>
            <Code2 size={11} /> Code
          </button>
          {!isHtml && (
            <button onClick={() => setTab('run')} type="button" className={`ag-cv-tab ${tab === 'run' ? 'on' : ''}`}>
              <Play size={11} /> Run
            </button>
          )}
          {isHtml && (
            <button onClick={runPreview} type="button" className={`ag-cv-tab ${tab === 'preview' ? 'on' : ''}`}>
              <Eye size={11} /> Render page
            </button>
          )}
        </div>
      </div>
      {tab === 'code' ? (
        <CodeMirror value={code} editable={false} height="320px" extensions={[cmExtension(lang.id)]} theme="dark" basicSetup={{ foldGutter: false, highlightActiveLine: false }} />
      ) : tab === 'preview' ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 320, background: '#ffffff' }}>
            <iframe title="Student HTML Preview" srcDoc={previewDoc} sandbox="allow-scripts allow-forms allow-modals allow-popups" style={{ width: '100%', height: '100%', border: 'none', display: 'block' }} />
          </div>
          {(previewResults || (testResults && testResults.checks)) && (
            <div className="ag-cv-checks">
              <div className="ag-cv-checks-title">
                Page check results — {(() => {
                  const rows = previewResults || testResults.checks || [];
                  return `${rows.filter((r) => r.passed).length}/${rows.length} passing`;
                })()}
              </div>
              {(previewResults || testResults.checks || []).map((r, i) => (
                <div key={r.id || i} className="ag-cv-check-row">
                  <span style={{ color: r.passed ? '#34d399' : '#f87171', flexShrink: 0 }}>{r.passed ? '✓' : '✕'}</span>
                  <span>{r.label || `Check ${i + 1}`}</span>
                  {!r.passed && r.detail ? <span style={{ color: '#fca5a5', fontSize: 11 }}>— {r.detail}</span> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="ag-cv-stdin">
            <div className="ag-cv-stdin-head">
              <span className="ag-cv-stdin-label">Interactive terminal — when the program asks for input, just type here</span>
              <button
                onClick={() => termRef.current?.triggerRun()}
                type="button"
                disabled={running}
                className="ag-cv-run-btn"
              >
                {running ? 'Running…' : 'Run student code'}
              </button>
            </div>
          </div>
          <div style={{ height: 320, background: '#050120', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, overflow: 'hidden' }}>
            <InteractiveTerminal compact ref={termRef} code={code} language={lang.id} onRunningChange={setRunning} />
          </div>
        </div>
      )}
    </div>
  );
}
