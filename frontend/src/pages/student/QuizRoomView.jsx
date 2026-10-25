import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import api, { invalidateCache } from "../../services/api";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pause,
  Play,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Radio,
  FileText,
  Plus,
  Trash2,
  Code as CodeIcon,
  WifiOff,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import InlineCodeAnswer from "../../components/student/InlineCodeAnswer";
import FormattedText from "../../components/ui/FormattedText";
import ConfirmModal from "../../components/ui/ConfirmModal";
import "../../pages/student/Student.css";

const PER_QUESTION_DEFAULTS = {
  true_false: 20,
  multiple_choice: 40,
  identification: 60,
  short_answer: 60,
  enumeration: 90,
  coding: 300,
  essay: 300,
};

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function timerTone(seconds) {
  if (seconds === null) return "var(--text-tertiary)";
  if (seconds <= 30) return "#ef4444";
  if (seconds <= 60) return "#f59e0b";
  return "var(--text-secondary)";
}

function parseStoredAnswer(raw) {
  if (raw === null || raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return raw;
  } catch {
    return raw;
  }
}

export default function QuizRoomView() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState("loading");
  // Session-local seconds on the grading screen — reassures the student the
  // wait is progressing instead of an empty loading state.
  const [gradingElapsed, setGradingElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [saveState, setSaveState] = useState("idle");
  const [offline, setOffline] = useState(false);
  // One failed request in a wave of parallel quiz traffic is not "offline" —
  // require a few consecutive failures before alarming the student.
  const offlineStreakRef = useRef(0);
  const noteNetFail = useCallback(() => {
    offlineStreakRef.current += 1;
    if (offlineStreakRef.current >= 3) setOffline(true);
  }, []);
  const noteNetOk = useCallback(() => {
    offlineStreakRef.current = 0;
    setOffline(false);
  }, []);
  const [finishing, setFinishing] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [teacherPacing, setTeacherPacing] = useState(false);
  const [teacherPhase, setTeacherPhase] = useState("waiting");
  const [liveCurrentQ, setLiveCurrentQ] = useState(null);
  const [roomPaused, setRoomPaused] = useState(false);

  const answersRef = useRef(answers);
  const idxRef = useRef(currentIdx);
  const payloadRef = useRef(payload);
  const phaseRef = useRef(phase);
  const roomPausedRef = useRef(roomPaused);
  const saveTimerRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const heartbeaterRef = useRef(null);
  const pollerRef = useRef(null);
  const mountedJoinRef = useRef(null);
  // The teacher's pointer and the previously seen pointer. A student who was
  // at the old pointer follows a next; a student behind it never gets yanked.
  const liveCurrentQRef = useRef(null);
  const lastLiveQRef = useRef(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    idxRef.current = currentIdx;
  }, [currentIdx]);
  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  // Questions the student left blank — surfaced in the finish confirmation so
  // a silent zero can't happen by accident (mirrors the activities flow).
  const unansweredCount = (payload?.questions || []).filter((q) => {
    const v = answers[q.id];
    if (v == null) return true;
    if (Array.isArray(v)) return v.every((s) => !String(s || "").trim());
    return !String(v).trim();
  }).length;
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roomPausedRef.current = roomPaused;
  }, [roomPaused]);
  useEffect(() => {
    liveCurrentQRef.current = liveCurrentQ;
  }, [liveCurrentQ]);

  const backToClass = useCallback(() => {
    invalidateCache(`get:/student/classes/${classId}/activities`);
    navigate(`/dashboard/student/class/${classId}?tab=activities`);
  }, [classId, navigate]);

  const applyPayload = useCallback((data) => {
    setPayload(data);
    setTeacherPacing(data.activity?.pacing_mode === "teacher");
    setRoomPaused(!!data.room_paused);
    if (data.activity?.pacing_mode === "teacher") {
      setTeacherPhase(data.teacher_phase || "waiting");
      const liveQ = data.live_current_q ?? null;
      setLiveCurrentQ(liveQ);
      liveCurrentQRef.current = liveQ;
      lastLiveQRef.current = liveQ;
    } else {
      setLiveCurrentQ(null);
      liveCurrentQRef.current = null;
      lastLiveQRef.current = null;
    }
    const restored = {};
    (data.submission?.answers || []).forEach((ans) => {
      restored[ans.question_id] = parseStoredAnswer(ans.submitted_answer);
    });
    setAnswers(restored);

    if (data.grading_pending) {
      // Attempt locked, grading (code compiles) still running server-side.
      setPhase("grading");
      return;
    }

    if (data.finalized) {
      setPhase("results");
      return;
    }

    const started = !!data.submission?.started_at;
    setCurrentIdx(data.submission?.current_question_idx || 0);

    if (data.activity?.pacing_mode === "teacher") {
      setPhase("taking");
      if (data.live_question_deadline_at) {
        const ms =
          new Date(data.live_question_deadline_at).getTime() - Date.now();
        setTimeLeft(Math.max(0, Math.ceil(ms / 1000)));
      } else {
        setTimeLeft(null);
      }
    } else if (started) {
      setPhase("taking");
      if (data.activity?.timer_mode === "entire_quiz") {
        setTimeLeft(
          data.remaining_seconds ??
            Math.floor((data.activity?.time_limit_minutes || 0) * 60),
        );
      }
    } else if (data.room_paused) {
      // Room is paused before the student started — hold them in the waiting
      // room (it polls and walks them in once the teacher resumes).
      setPhase("waiting");
    } else {
      setPhase("start");
    }
  }, []);

  const loadQuiz = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await api.post(`/student/activities/${activityId}/quiz/join`);
      applyPayload(res.data);
    } catch (err) {
      const message = err.response?.data?.message || "Unable to load quiz";
      try {
        const res = await api.get(
          `/student/activities/${activityId}/quiz/state`,
          { bypassCache: true },
        );
        const data = res.data;
        if (data.finalized) {
          applyPayload(data);
          return;
        }
        if (data.room_closed) {
          // Close stops NEW entrants, but an attempt already in progress is
          // allowed to finish — don't eject a student who reloaded mid-quiz.
          if (data.submission?.status === "draft" && data.submission?.started_at) {
            applyPayload(data);
            return;
          }
          setErrorMsg("This quiz has ended.");
          setPhase("error");
          return;
        }
        if (!data.room_live) {
          // Published quiz whose room hasn't opened yet — hold the student in
          // a waiting room and enter automatically once the teacher starts it.
          setPhase("waiting");
          return;
        }
        setErrorMsg(message);
        setPhase("error");
      } catch {
        setErrorMsg(message);
        setPhase("error");
      }
    }
  }, [activityId, applyPayload]);

  useEffect(() => {
    // Guard the mount call only — StrictMode double-mounts would otherwise
    // fire the room's slowest request (join) twice. Deliberate loadQuiz()
    // retries elsewhere are unaffected.
    if (mountedJoinRef.current === activityId) return;
    mountedJoinRef.current = activityId;
    loadQuiz();
  }, [loadQuiz]);

  // Waiting room: poll until the teacher opens the room, then walk in.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(async () => {
      try {
        const res = await api.get(
          `/student/activities/${activityId}/quiz/state`,
          { bypassCache: true },
        );
        const data = res.data;
        if (data.finalized) {
          applyPayload(data);
          return;
        }
        if (data.room_closed) {
          setErrorMsg("This quiz was closed before it started.");
          setPhase("error");
          return;
        }
        if (data.room_live) {
          loadQuiz();
        }
      } catch {
        /* keep waiting — transient network errors shouldn't kick the student out */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [phase, activityId, applyPayload, loadQuiz]);

  const saveAnswer = useCallback(
    async (questionId, value, idx, attempt = 0) => {
      pendingSaveRef.current = null;
      setSaveState("saving");
      try {
        await api.post(`/student/activities/${activityId}/quiz/answers`, {
          question_id: questionId,
          submitted_answer: value,
          current_question_idx: idx,
        });
        setSaveState("saved");
      } catch (err) {
        if (err.response?.status === 422) {
          const stateRes = await api
            .get(`/student/activities/${activityId}/quiz/state`, {
              bypassCache: true,
            })
            .catch(() => null);
          const data = stateRes?.data;
          if (data?.finalized) {
            applyPayload(data);
            return;
          }
          // Load testing caught transient 422s on self-paced students whose
          // quiz was NOT over — the old code discarded the answer here and
          // the points were silently lost. If the quiz is still live, retry
          // a couple of times before giving up on the save.
          if (attempt < 2) {
            setSaveState("saving");
            setTimeout(() => {
              saveAnswer(questionId, value, idx, attempt + 1);
            }, 2500);
            return;
          }
          pendingSaveRef.current = null;
          setSaveState("blocked");
          return;
        }
        pendingSaveRef.current = { questionId, value, idx };
        setSaveState("error");
        noteNetFail();
      }
    },
    [activityId, applyPayload, noteNetFail],
  );

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { questionId, value, idx } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      saveAnswer(questionId, value, idx);
    }
  }, [saveAnswer]);

  const onAnswerChange = useCallback(
    (qId, value) => {
      setAnswers((prev) => ({ ...prev, [qId]: value }));
      const idx = idxRef.current;
      pendingSaveRef.current = { questionId: qId, value, idx };

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const pending = pendingSaveRef.current;
        if (pending) {
          pendingSaveRef.current = null;
          saveAnswer(pending.questionId, pending.value, pending.idx);
        }
      }, 1000);
    },
    [saveAnswer],
  );

  const pollState = useCallback(async () => {
    if (
      phaseRef.current === "results" ||
      phaseRef.current === "loading" ||
      phaseRef.current === "error"
    )
      return;
    try {
      const res = await api.get(
        `/student/activities/${activityId}/quiz/state`,
        { bypassCache: true },
      );
      const data = res.data;
      setOffline(false);
      if (data.finalized) {
        applyPayload(data);
        return;
      }
      if (data.activity?.pacing_mode === "teacher") {
        setTeacherPacing(true);
        if (data.teacher_phase) setTeacherPhase(data.teacher_phase);
        setPayload((prev) =>
          prev
            ? {
                ...prev,
                current_question_feedback: data.current_question_feedback ?? null,
              }
            : prev,
        );

        const liveQ = data.live_current_q;
        if (liveQ !== undefined && liveQ !== null) {
          const prevLive = lastLiveQRef.current;

          if (liveQ >= 0) {
            setCurrentIdx((prev) => {
              let next = prev;
              // Caught up with the previous pointer -> follow the teacher's
              // next. Behind it -> stay put and keep catching up.
              if (prevLive !== null && prev >= prevLive && liveQ > prevLive) {
                next = liveQ;
              }
              // The live pointer is a ceiling, never a cursor-setting command.
              return Math.min(Math.max(next, 0), liveQ);
            });
          }

          lastLiveQRef.current = liveQ;
          setLiveCurrentQ(liveQ);
          liveCurrentQRef.current = liveQ;

          // The server deadline belongs to the teacher's CURRENT question.
          // Catch-up questions run on their own per-question clock instead.
          if (liveQ >= 0 && idxRef.current === liveQ) {
            if (data.live_question_deadline_at) {
              const ms =
                new Date(data.live_question_deadline_at).getTime() - Date.now();
              setTimeLeft(Math.max(0, Math.ceil(ms / 1000)));
            } else if (timeLeftRef.current !== null) {
              setTimeLeft(null);
            }
          }
        }
      }
      setRoomPaused(!!data.room_paused);
      // While paused the server-side whole-quiz clock keeps running until the
      // teacher resumes (then it's credited back) — don't let polls shrink the
      // frozen countdown in the meantime.
      if (
        !data.room_paused &&
        data.remaining_seconds !== null &&
        payloadRef.current?.activity?.timer_mode === "entire_quiz"
      ) {
        setTimeLeft(data.remaining_seconds);
      }
      if (
        data.submission?.current_question_idx !== undefined &&
        data.submission?.current_question_idx > idxRef.current
      ) {
        setCurrentIdx(data.submission.current_question_idx);
      }
      const restored = {};
      (data.submission?.answers || []).forEach((ans) => {
        if (
          Number(ans.question_id) !==
          Number(payloadRef.current?.questions?.[idxRef.current]?.id)
        ) {
          restored[ans.question_id] = parseStoredAnswer(ans.submitted_answer);
        }
      });
      setAnswers((prev) => ({ ...prev, ...restored }));
    } catch {
      noteNetFail();
    }
  }, [activityId, applyPayload, noteNetFail]);

  const handleStart = useCallback(async () => {
    try {
      const res = await api.post(
        `/student/activities/${activityId}/quiz/start`,
      );
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              submission: { ...prev.submission, ...res.data.submission },
            }
          : prev,
      );
      setPhase("taking");
      if (payloadRef.current?.activity?.timer_mode === "entire_quiz") {
        setTimeLeft(
          Math.floor(
            (payloadRef.current.activity.time_limit_minutes || 0) * 60,
          ),
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start quiz");
      loadQuiz();
    }
  }, [activityId, loadQuiz]);

  const handleFinish = useCallback(async () => {
    setShowFinishModal(false);
    if (finishing) return;
    setFinishing(true);
    flushSave();
    await new Promise((r) => setTimeout(r, 250));
    try {
      const res = await api.post(
        `/student/activities/${activityId}/quiz/finish`,
      );
      applyPayload(res.data);
      invalidateCache(`get:/student/classes/${classId}/activities`);
      toast.success("Quiz submitted");
    } catch (err) {
      if (err.response?.status === 422) {
        const stateRes = await api.get(
          `/student/activities/${activityId}/quiz/state`,
          { bypassCache: true },
        );
        if (stateRes.data.finalized) applyPayload(stateRes.data);
      } else {
        toast.error(err.response?.data?.message || "Failed to submit quiz");
      }
    } finally {
      setFinishing(false);
    }
  }, [activityId, classId, finishing, flushSave, applyPayload]);

  const advance = useCallback(
    (delta) => {
      flushSave();
      setCurrentIdx((prev) => {
        const countMax = (payloadRef.current?.questions?.length || 1) - 1;
        // Catch-up can move inside [0, teacher's current question], never past.
        const maxIdx = teacherPacing
          && liveCurrentQRef.current !== null
          && liveCurrentQRef.current >= 0
          ? Math.min(countMax, liveCurrentQRef.current)
          : countMax;
        const next = Math.min(Math.max(prev + delta, 0), maxIdx);
        if (next !== prev) {
          api
            .post(`/student/activities/${activityId}/quiz/advance`, {
              current_question_idx: next,
            })
            .catch(() => {});
        }
        return next;
      });
    },
    [activityId, flushSave, teacherPacing],
  );

  const perQuestionSeconds = useCallback((q) => {
    if (!q) return PER_QUESTION_DEFAULTS.multiple_choice;
    const overrides =
      payloadRef.current?.activity?.per_question_durations || {};
    return overrides[q.type] ?? PER_QUESTION_DEFAULTS[q.type] ?? 60;
  }, []);

  const currentQuestion = payload?.questions?.[currentIdx];
  const questionCount = payload?.questions?.length || 0;
  const timerMode = payload?.activity?.timer_mode;
  // Teacher-paced: at the teacher's question vs still catching up.
  const atLiveQuestion =
    !teacherPacing ||
    liveCurrentQ === null ||
    liveCurrentQ < 0 ||
    currentIdx === liveCurrentQ;
  const isCatchup = teacherPacing && !atLiveQuestion && liveCurrentQ >= 0;

  const timeLeftRef = useRef(null);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // Grading poll — the backend grades AFTER responding (engine compiles for
  // code questions), so the attempt locks instantly and the score lands here.
  useEffect(() => {
    if (phase !== "grading") return;
    setGradingElapsed(0);
    const ticks = setInterval(() => setGradingElapsed((s) => s + 1), 1000);
    let alive = true;
    const tick = async () => {
      try {
        const res = await api.get(
          `/student/activities/${activityId}/quiz/state`,
          { bypassCache: true },
        );
        if (alive && !res.data.grading_pending) applyPayload(res.data);
      } catch {
        /* grading continues server-side — keep polling */
      }
    };
    const timer = setInterval(tick, 5000);
    tick();
    return () => {
      alive = false;
      clearInterval(timer);
      clearInterval(ticks);
    };
  }, [phase, activityId, applyPayload]);

  useEffect(() => {
    if (phase !== "taking") return;

    const atLive =
      !teacherPacing ||
      liveCurrentQ === null ||
      liveCurrentQ < 0 ||
      currentIdx === liveCurrentQ;
    const catchup = teacherPacing && !atLive;

    // The teacher's current question is timed by the server deadline.
    if (teacherPacing && atLive) return;

    // Catch-up is self-paced. Only a per-question timer applies, and it
    // never flips the student's page when it hits zero.
    if (catchup && timerMode !== "per_question") {
      timeLeftRef.current = null;
      setTimeLeft(null);
      return;
    }

    if (timerMode === "per_question") {
      const seconds = perQuestionSeconds(currentQuestion);
      timeLeftRef.current = seconds;
      setTimeLeft(seconds);
    }

    const interval = setInterval(() => {
      if (roomPausedRef.current) return; // paused — countdown frozen in place
      const current = timeLeftRef.current;
      if (current === null) return;
      const next = Math.max(0, current - 1);
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next === 0) {
        clearInterval(interval);
        if (catchup) return; // stay on the question — the student moves on
        if (
          timerMode === "per_question" &&
          idxRef.current < questionCount - 1
        ) {
          advance(1);
        } else {
          handleFinish();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    phase,
    timerMode,
    currentIdx,
    currentQuestion,
    perQuestionSeconds,
    questionCount,
    advance,
    handleFinish,
    teacherPacing,
    liveCurrentQ,
  ]);

  useEffect(() => {
    if (phase !== "taking" || !teacherPacing) return;
    // Only the live question mirrors the server deadline; catch-up questions
    // have their own clock above.
    if (liveCurrentQ !== null && currentIdx !== liveCurrentQ) return;
    if (timeLeft === null || timeLeft === undefined) return;

    const interval = setInterval(() => {
      if (roomPausedRef.current) return; // paused — countdown frozen in place
      const current = timeLeftRef.current;
      if (current === null || current === undefined) {
        clearInterval(interval);
        return;
      }
      const next = Math.max(0, current - 1);
      timeLeftRef.current = next;
      setTimeLeft(next);
      if (next === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, teacherPacing, timeLeft, currentIdx, liveCurrentQ]);

  useEffect(() => {
    if (phase !== "taking") return;
    heartbeaterRef.current = setInterval(() => {
      api
        .post(`/student/activities/${activityId}/quiz/heartbeat`)
        .then(() => noteNetOk())
        .catch(noteNetFail);
    }, 10000);
    pollerRef.current = setInterval(() => {
      pollState();
    }, teacherPacing ? 5000 : roomPaused ? 3000 : 20000);
    return () => {
      clearInterval(heartbeaterRef.current);
      clearInterval(pollerRef.current);
    };
  }, [phase, activityId, pollState, teacherPacing, roomPaused, noteNetFail, noteNetOk]);

  useEffect(() => {
    if (phase === "results" && payload?.reveal === "summary") {
      const t = setInterval(() => {
        pollState();
      }, 30000);
      return () => clearInterval(t);
    }
  }, [phase, payload?.reveal, pollState]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") pollState();
    };
    const onOnline = () => {
      setOffline(false);
      pollState();
    };
    const onOffline = () => setOffline(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [pollState]);

  useEffect(() => {
    if (phase !== "taking" || !currentQuestion) return;
    const handler = (e) => {
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
        return;
      if (currentQuestion.type === "multiple_choice") {
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= (currentQuestion.options?.length || 0)) {
          e.preventDefault();
          onAnswerChange(currentQuestion.id, String(n - 1));
        }
      } else if (currentQuestion.type === "true_false") {
        const k = e.key.toLowerCase();
        if (k === "t") {
          e.preventDefault();
          onAnswerChange(currentQuestion.id, "True");
        }
        if (k === "f") {
          e.preventDefault();
          onAnswerChange(currentQuestion.id, "False");
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, currentQuestion, onAnswerChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingSaveRef.current = null;
      if (heartbeaterRef.current) clearInterval(heartbeaterRef.current);
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, []);

  if (phase === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "var(--bg-primary)",
        }}
      >
        <Loader2
          className="animate-spin"
          size={32}
          color="var(--text-tertiary)"
        />
        <p
          style={{ fontSize: "13px", color: "var(--text-tertiary)", margin: 0 }}
        >
          Opening quiz room…
        </p>
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          padding: "24px",
          background: "var(--bg-primary)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "8px",
          }}
        >
          <Radio size={30} color="#ef4444" />
        </div>
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          {roomPaused ? "Quiz paused" : "Waiting for your teacher"}
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            margin: 0,
            maxWidth: "420px",
            lineHeight: 1.6,
          }}
        >
          {roomPaused
            ? "Your teacher paused the quiz before you started. Keep this page open — you'll be able to start the moment it resumes."
            : "The quiz hasn't been opened yet. Keep this page open — it will enter the quiz automatically the moment your teacher starts it."}
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "4px",
            fontSize: "12px",
            color: "var(--text-tertiary)",
          }}
        >
          <Loader2 className="animate-spin" size={13} />
          Checking every 5 seconds
        </div>
        <button
          onClick={backToClass}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            background: "transparent",
            color: "var(--text-secondary)",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <ChevronLeft size={16} /> Back to Class
        </button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
          background: "var(--bg-primary)",
          textAlign: "center",
        }}
      >
        <AlertTriangle size={40} color="#f59e0b" />
        <h2
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: 0,
          }}
        >
          Quiz unavailable
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            margin: 0,
            maxWidth: "420px",
          }}
        >
          {errorMsg}
        </p>
        <button
          onClick={backToClass}
          style={{
            padding: "12px 24px",
            borderRadius: "12px",
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ChevronLeft size={16} /> Back to Class
        </button>
      </div>
    );
  }

  if (phase === "start") {
    const timerLabel =
      timerMode === "none"
        ? "No time limit"
        : timerMode === "entire_quiz"
          ? `${payload.activity.time_limit_minutes || 0} min for the whole quiz`
          : "Per-question countdown";
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--bg-primary)",
        }}
      >
        <div
          style={{
            maxWidth: "640px",
            width: "100%",
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "24px",
            padding: "40px",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <Radio size={18} color="var(--accent)" />
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "none",
                color: 'var(--accent)',
              }}
            >
              {payload.activity.reopened ? 'Reopened Quiz' : 'Live Quiz'}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: "999px",
                background: payload.activity.reopened ? "var(--accent-light)" : "rgba(239, 68, 68, 0.12)",
                color: payload.activity.reopened ? "var(--accent)" : "#ef4444",
                letterSpacing: "0.08em",
                animation: payload.activity.reopened ? undefined : "pulse 1.6s infinite",
              }}
            >
              {payload.activity.reopened ? '● REOPENED' : '● LIVE'}
            </span>
          </div>
          <h1
            style={{
              fontSize: "32px",
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: "0 0 8px 0",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {payload.activity.title}
          </h1>
          {payload.activity.description && (
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                lineHeight: "1.6",
                margin: "0 0 24px 0",
                whiteSpace: "pre-wrap",
              }}
            >
              {payload.activity.description}
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "12px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "none",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  margin: "0 0 4px 0",
                }}
              >
                Questions
              </p>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {questionCount}
              </p>
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "none",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  margin: "0 0 4px 0",
                }}
              >
                Total Points
              </p>
              <p
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                }}
              >
                {payload.activity.total_points}
              </p>
            </div>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: "14px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  textTransform: "none",
                  letterSpacing: "0.1em",
                  color: "var(--text-tertiary)",
                  margin: "0 0 4px 0",
                }}
              >
                Timer
              </p>
              <p
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {timerLabel}
              </p>
            </div>
          </div>
          {payload.activity.shuffle_questions && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-tertiary)",
                margin: "0 0 20px 0",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ShuffleIcon /> Questions are shuffled for you.
            </p>
          )}
          <button
            onClick={handleStart}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "14px",
              letterSpacing: "0.1em",
              textTransform: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
              boxShadow: "0 4px 12px var(--accent-glow)",
            }}
          >
            <Play size={18} /> Start Quiz
          </button>
          <button
            onClick={backToClass}
            style={{
              marginTop: "12px",
              width: "100%",
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background: "transparent",
              color: "var(--text-tertiary)",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Not now — back to class
          </button>
        </div>
      </div>
    );
  }

  if (phase === "grading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          background: "var(--bg-primary)",
          padding: "24px",
        }}
      >
        <Loader2
          className="animate-spin"
          size={32}
          color="var(--text-tertiary)"
        />
        <p
          style={{
            fontSize: "17px",
            color: "var(--text-primary)",
            margin: 0,
            fontWeight: 600,
          }}
        >
          Checking your answers…
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            margin: 0,
            maxWidth: "420px",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          Your programs are being compiled and verified — this usually takes
          under a minute. ({gradingElapsed}s)
        </p>
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-tertiary)",
            margin: 0,
            maxWidth: "420px",
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          You can leave this page — your answers are already saved and
          grading keeps running. Your score will be waiting when you come
          back.
        </p>
        <button
          type="button"
          onClick={backToClass}
          style={{
            marginTop: "4px",
            padding: "10px 18px",
            borderRadius: "10px",
            border: "1px solid var(--text-tertiary)",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to class — check results later
        </button>
      </div>
    );
  }

  if (phase === "results") {
    const results = payload.results;
    const awaitingGrade = results?.status === "submitted";
    const fullReveal = results?.reveal === "full";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          overflowY: "auto",
        }}
        className="custom-scrollbar"
      >
        <div
          style={{
            maxWidth: "1080px",
            margin: "0 auto",
            padding: "48px 24px 96px",
          }}
        >
          <Link
            to={`/dashboard/student/class/${classId}?tab=activities`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "var(--text-tertiary)",
              fontSize: "12px",
              fontWeight: 600,
              textDecoration: "none",
              marginBottom: "24px",
            }}
            className="hover:text-[var(--text-primary)] transition-all"
          >
            <ChevronLeft size={14} /> Back to Class
          </Link>

          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "24px",
              padding: "40px",
              textAlign: "center",
              marginBottom: "24px",
            }}
          >
            {awaitingGrade ? (
              <>
                <CheckCircle2
                  size={40}
                  color="#f59e0b"
                  style={{ marginBottom: "12px" }}
                />
                <h1
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Quiz submitted
                </h1>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Your quiz contains manually graded questions. Your teacher
                  will grade them soon.
                </p>
              </>
            ) : fullReveal ? (
              <>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    textTransform: "none",
                    letterSpacing: "0.2em",
                    color: "var(--text-tertiary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Your Score
                </p>
                <h1
                  style={{
                    fontSize: "56px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 4px 0",
                    letterSpacing: "-0.03em",
                  }}
                >
                  {Number(results.score || 0).toFixed(0)}
                  <span
                    style={{
                      fontSize: "24px",
                      color: "var(--text-tertiary)",
                      fontWeight: 700,
                    }}
                  >
                    {" "}
                    / {Number(results.max_score || 0).toFixed(0)}
                  </span>
                </h1>
                <p
                  style={{
                    fontSize: "14px",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  {results.score >= results.max_score / 2
                    ? "Nice work!"
                    : "Keep practicing!"}
                </p>
              </>
            ) : (
              <>
                <Clock
                  size={40}
                  color="#f59e0b"
                  style={{ marginBottom: "12px" }}
                />
                <h1
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 8px 0",
                  }}
                >
                  Quiz submitted
                </h1>
                <p
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    margin: "0 0 6px 0",
                  }}
                >
                  Your Score: {Number(results.score || 0).toFixed(0)}/
                  {Number(results.max_score || 0).toFixed(0)}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  This score is final — answer review appears when the teacher
                  closes the room.
                </p>
              </>
            )}
          </div>

          {fullReveal && !awaitingGrade && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {(results.rows || []).map((row, idx) => {
                const correct = row.is_correct;
                const answerText = (value) => {
                  if (!value) return null;
                  if (row.type === "enumeration") {
                    try {
                      const items = JSON.parse(value);
                      return Array.isArray(items)
                        ? items.filter((i) => String(i).trim()).join(", ")
                        : value;
                    } catch {
                      return value;
                    }
                  }
                  if (
                    row.type === "multiple_choice" &&
                    Array.isArray(row.options)
                  ) {
                    return row.options[Number(value)] ?? value;
                  }
                  return value;
                };
                const yourAnswer = row.submitted_answer
                  ? answerText(row.submitted_answer)
                  : "—";
                const expectedOutput =
                  row.expected_output !== undefined &&
                  row.expected_output !== null
                    ? answerText(row.expected_output)
                    : null;
                return (
                  <div
                    key={row.question_id}
                    style={{
                      padding: "18px 20px",
                      borderRadius: "16px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        marginBottom: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          margin: 0,
                        }}
                      >
                        {idx + 1}. {row.question_text}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexShrink: 0,
                        }}
                      >
                        {correct === null || correct === undefined ? (
                          <Clock size={16} color="var(--text-tertiary)" />
                        ) : correct ? (
                          <CheckCircle2 size={16} color="#10b981" />
                        ) : (
                          <XCircle size={16} color="#ef4444" />
                        )}
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 700,
                            color:
                              correct === true
                                ? "#10b981"
                                : correct === false
                                  ? "#ef4444"
                                  : "var(--text-tertiary)",
                          }}
                        >
                          {Number(row.score || 0).toFixed(0)}/
                          {Number(row.points).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        margin: "0 0 8px 0",
                      }}
                    >
                      Your answer:{" "}
                      <span
                        style={{
                          color:
                            correct === false
                              ? "#ef4444"
                              : "var(--text-primary)",
                        }}
                      >
                        {yourAnswer}
                      </span>
                    </p>
                    {expectedOutput && (
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#10b981",
                          margin: 0,
                        }}
                      >
                        Correct answer:{" "}
                        <span style={{ color: "#10b981" }}>
                          {expectedOutput}
                        </span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <button
            onClick={backToClass}
            style={{
              marginTop: "28px",
              width: "100%",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
              letterSpacing: "0.1em",
              textTransform: "none",
              cursor: "pointer",
            }}
          >
            Back to Class
          </button>
        </div>
      </div>
    );
  }

  if (!payload) return null;
  // Teacher-paced lobbies have no open question yet — the "Waiting for the
  // teacher" overlay below must still render instead of a blank screen.
  if (!currentQuestion && !(teacherPacing && (teacherPhase === "waiting" || teacherPhase === "paused"))) return null;

  const isPerQuestion = timerMode === "per_question";
  const isLast = currentIdx === questionCount - 1;
  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved ✓"
        : saveState === "blocked"
          ? teacherPhase === "revealed"
            ? "Answer locked"
            : "Answer not open — wait for the teacher"
          : saveState === "error"
            ? "Offline — retrying"
            : "";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        display: "flex",
        flexDirection: "column",
      }}
      className="custom-scrollbar"
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            maxWidth: "1080px",
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "none",
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
                margin: "0 0 2px 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {payload.activity.title}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {currentQuestion && (
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  Question {currentIdx + 1} of {questionCount}
                </p>
              )}
              {offline && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#f59e0b",
                  }}
                >
                  <WifiOff size={12} /> Reconnecting…
                </span>
              )}
              {saveLabel && !offline && (
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    color:
                      saveState === "error"
                        ? "#ef4444"
                        : saveState === "blocked"
                          ? "#f59e0b"
                          : saveState === "saved"
                            ? "#10b981"
                            : "var(--text-tertiary)",
                  }}
                >
                  {saveLabel}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "12px",
              background:
                timeLeft !== null && timeLeft <= 30
                  ? "rgba(239, 68, 68, 0.12)"
                  : "var(--bg-primary)",
              border: `1px solid ${timeLeft !== null && timeLeft <= 30 ? "rgba(239, 68, 68, 0.4)" : "var(--border-color)"}`,
            }}
          >
            <Clock
              size={16}
              color={timerTone(timeLeft)}
              style={
                timeLeft !== null && timeLeft <= 30
                  ? { animation: "pulse 1s infinite" }
                  : undefined
              }
            />
            <span
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: timerTone(timeLeft),
                fontVariantNumeric: "tabular-nums",
                minWidth: "44px",
                textAlign: "center",
              }}
            >
              {isPerQuestion && timeLeft !== null
                ? formatTime(timeLeft)
                : timerMode === "entire_quiz" && timeLeft !== null
                  ? formatTime(timeLeft)
                  : "∞"}
            </span>
          </div>
        </div>
        <div style={{ height: "4px", background: "var(--bg-tertiary)" }}>
          <div
            style={{
              height: "100%",
              background: "var(--accent)",
              transition: "width 0.3s ease",
              width: `${questionCount > 0 ? ((currentIdx + 1) / questionCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          maxWidth: "1080px",
          width: "100%",
          margin: "0 auto",
          padding: "40px 24px 120px",
        }}
      >
        {(teacherPacing && teacherPhase === "waiting") || roomPaused ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 24px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <Pause
              size={36}
              color="#f59e0b"
              style={
                roomPaused
                  ? { animation: "pulse 1.6s infinite" }
                  : undefined
              }
            />
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 800,
                color: "var(--text-primary)",
                margin: 0,
              }}
            >
              {roomPaused ? "Quiz paused" : "Waiting for the teacher…"}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                margin: 0,
                maxWidth: "360px",
              }}
            >
              {roomPaused
                ? "Your teacher paused the quiz. Your answers are safe and your time is on hold — it will resume automatically."
                : "Your teacher hasn't opened a question yet. It will appear here automatically."}
            </p>
          </div>
        ) : (
          <>
            {/* Slide-and-fade so a teacher Next (or your own Next) glides the
                new question in instead of hard-cutting it mid-read */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
              >
                <QuestionRenderer
                  question={currentQuestion}
                  value={answers[currentQuestion.id]}
                  onChange={(val) => onAnswerChange(currentQuestion.id, val)}
                  disabled={teacherPacing && atLiveQuestion && teacherPhase === "revealed"}
                />
                {teacherPacing &&
                  atLiveQuestion &&
                  teacherPhase === "revealed" &&
                  payload.current_question_feedback && (
                    <RevealFeedback
                      feedback={payload.current_question_feedback}
                      question={currentQuestion}
                      value={answers[currentQuestion.id]}
                    />
                  )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

        <div
          style={{
            marginTop: "24px",
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {teacherPacing ? (
            <>
              {currentIdx > 0 && (
                <button
                  onClick={() => advance(-1)}
                  style={{
                    padding: "14px 20px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
              )}
              <div style={{ flex: 1 }} />
              <p
                style={{
                  fontSize: "12px",
                  color: isCatchup ? "var(--accent)" : "var(--text-tertiary)",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: isCatchup ? 700 : 400,
                }}
              >
                <Radio size={14} />
                {isCatchup
                  ? `Catch up at your own pace — you'll sync at question ${liveCurrentQ + 1}`
                  : teacherPhase === "revealed"
                    ? "Question closed — waiting for the teacher"
                    : "In sync — your teacher controls the next question"}
              </p>
              {isCatchup && (
                <button
                  onClick={() => advance(1)}
                  style={{
                    padding: "14px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    letterSpacing: "0.08em",
                    textTransform: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px var(--accent-glow)",
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </>
          ) : roomPaused ? (
            <>
              <div style={{ flex: 1 }} />
              <p
                style={{
                  fontSize: "12px",
                  color: "#f59e0b",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontWeight: 700,
                }}
              >
                <Pause size={14} /> Quiz paused — navigation is on hold
              </p>
            </>
          ) : (
            <>
              {!isPerQuestion && currentIdx > 0 && (
                <button
                  onClick={() => advance(-1)}
                  style={{
                    padding: "14px 20px",
                    borderRadius: "12px",
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
              )}
              <div style={{ flex: 1 }} />
              {isPerQuestion && !isLast && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-tertiary)",
                    margin: 0,
                  }}
                >
                  No going back in per-question mode
                </p>
              )}
              {isLast ? (
                <button
                  onClick={() => setShowFinishModal(true)}
                  disabled={finishing}
                  style={{
                    padding: "14px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    letterSpacing: "0.08em",
                    textTransform: "none",
                    cursor: finishing ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px var(--accent-glow)",
                  }}
                >
                  {finishing ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  {finishing ? "Submitting…" : "Finish Quiz"}
                </button>
              ) : (
                <button
                  onClick={() => advance(1)}
                  style={{
                    padding: "14px 28px",
                    borderRadius: "12px",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    letterSpacing: "0.08em",
                    textTransform: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 12px var(--accent-glow)",
                  }}
                >
                  Next <ChevronRight size={16} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={showFinishModal}
        onClose={() => setShowFinishModal(false)}
        onConfirm={handleFinish}
        title={unansweredCount > 0 ? "Finish with unanswered questions?" : "Finish Quiz?"}
        message={
          unansweredCount > 0
            ? `You have ${unansweredCount} unanswered question${unansweredCount !== 1 ? "s" : ""}. Unanswered questions are graded as incorrect.`
            : "Your answers are saved. After submitting you cannot change them."
        }
        confirmText="Finish Quiz"
        loading={finishing}
        variant="warning"
      />
    </div>
  );
}

function ShuffleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.8-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}

function QuestionRenderer({ question, value, onChange, disabled = false }) {

  if (question.type === "multiple_choice") {
    return (
      <div>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "none",
              letterSpacing: "0.15em",
              color: 'var(--accent)',
            }}
          >
            Multiple Choice · {question.points} pts
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "6px 0 0 0",
              lineHeight: 1.45,
            }}
          >
            <FormattedText text={question.question_text} />
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(question.options || []).map((opt, i) => {
            const selected = value === String(i);
            return (
              <button
                key={i}
                onClick={() => !disabled && onChange(String(i))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "16px 18px",
                  borderRadius: "14px",
                  border: `2px solid ${selected ? "var(--accent)" : "var(--border-color)"}`,
                  background: selected
                    ? "var(--accent-light)"
                    : "var(--bg-secondary)",
                  cursor: disabled ? "default" : "pointer",
                  opacity: disabled && !selected ? 0.55 : 1,
                  textAlign: "left",
                  transition: "all 0.15s",
                  minHeight: "52px",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    border: `2px solid ${selected ? "var(--accent)" : "var(--border-color)"}`,
                    background: selected ? "var(--accent)" : "transparent",
                    color: selected ? "#fff" : "var(--text-tertiary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                <span
                  style={{
                    fontSize: "15px",
                    color: "var(--text-primary)",
                    fontWeight: 500,
                    flex: 1,
                  }}
                >
                  <FormattedText text={opt} />
                </span>
              </button>
            );
          })}
        </div>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            margin: "12px 0 0 0",
          }}
        >
          Tip: press 1–{question.options?.length || 9} to answer
        </p>
      </div>
    );
  }

  if (question.type === "true_false") {
    return (
      <div>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "none",
              letterSpacing: "0.15em",
              color: 'var(--accent)',
            }}
          >
            True or False · {question.points} pts
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "6px 0 0 0",
              lineHeight: 1.45,
            }}
          >
            <FormattedText text={question.question_text} />
          </h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          {[
            { label: "True", color: "#10b981", key: "t" },
            { label: "False", color: "#ef4444", key: "f" },
          ].map((opt) => {
            const selected = value === opt.label;
            return (
              <button
                key={opt.label}
                onClick={() => !disabled && onChange(opt.label)}
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  cursor: disabled ? "default" : "pointer",
                  fontWeight: 800,
                  fontSize: "15px",
                  border: `2px solid ${selected ? opt.color : "var(--border-color)"}`,
                  background: selected
                    ? `${opt.color}1a`
                    : "var(--bg-secondary)",
                  color: selected ? opt.color : "var(--text-secondary)",
                  opacity: disabled && !selected ? 0.55 : 1,
                  minHeight: "56px",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}{" "}
                <span style={{ fontSize: "10px", opacity: 0.7 }}>
                  ({opt.key})
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === "identification" || question.type === "short_answer") {
    return (
      <div>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "none",
              letterSpacing: "0.15em",
              color: 'var(--accent)',
            }}
          >
            {question.type === "identification"
              ? "Identification"
              : "Short Answer"}{" "}
            · {question.points} pts
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "6px 0 0 0",
              lineHeight: 1.45,
            }}
          >
            <FormattedText text={question.question_text} />
          </h2>
        </div>
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          readOnly={disabled}
          rows={question.type === "short_answer" ? 3 : 2}
          placeholder="Type your answer…"
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: "12px",
            border: "1px solid var(--border-color)",
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            fontSize: "15px",
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            opacity: disabled ? 0.6 : 1,
          }}
        />
      </div>
    );
  }

  if (question.type === "enumeration") {
    const items = Array.isArray(value) ? value : [""];
    const addItem = () => onChange([...items, ""]);
    const updateItem = (i, v) => {
      const n = [...items];
      n[i] = v;
      onChange(n);
    };
    const removeItem = (i) => onChange(items.filter((_, idx) => idx !== i));
    return (
      <div>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "none",
              letterSpacing: "0.15em",
              color: 'var(--accent)',
            }}
          >
            Enumeration · {question.points} pts
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "6px 0 0 0",
              lineHeight: 1.45,
            }}
          >
            <FormattedText text={question.question_text} />
          </h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: "8px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "10px",
                  background: "var(--bg-tertiary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--text-tertiary)",
                  flexShrink: 0,
                  marginTop: "8px",
                }}
              >
                {i + 1}
              </div>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(i, e.target.value)}
                readOnly={disabled}
                placeholder={`Answer ${i + 1}`}
                style={{
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: "15px",
                  outline: "none",
                  opacity: disabled ? 0.6 : 1,
                }}
              />
              {items.length > 1 && !disabled && (
                <button
                  onClick={() => removeItem(i)}
                  type="button"
                  style={{
                    padding: "8px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
                    borderRadius: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#ef4444";
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-tertiary)";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => !disabled && addItem()}
          type="button"
          disabled={disabled}
          style={{
            marginTop: "10px",
            padding: "10px 16px",
            background: "transparent",
            border: "1px dashed var(--border-color)",
            borderRadius: "10px",
            cursor: disabled ? "default" : "pointer",
            color: "var(--text-tertiary)",
            fontSize: "13px",
            fontWeight: 600,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Plus
            size={14}
            style={{ marginRight: "4px", verticalAlign: "-2px" }}
          />{" "}
          Add answer
        </button>
      </div>
    );
  }

  if (question.type === "coding") {
    return (
      <div>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "none",
              letterSpacing: "0.15em",
              color: 'var(--accent)',
            }}
          >
            Coding · {question.points} pts
          </span>
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 800,
              color: "var(--text-primary)",
              margin: "6px 0 0 0",
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
            }}
          >
            <FormattedText text={question.question_text} />
          </h2>
        </div>
        <InlineCodeAnswer
          language={question.language}
          value={value}
          onChange={onChange}
          boilerplate={question.boilerplate || ""}
          disabled={disabled}
          sampleTests={question.sample_tests || []}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "none",
            letterSpacing: "0.15em",
            color: 'var(--accent)',
          }}
        >
          Essay · {question.points} pts
        </span>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: "var(--text-primary)",
            margin: "6px 0 0 0",
            lineHeight: 1.45,
          }}
        >
          <FormattedText text={question.question_text} />
        </h2>
      </div>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={disabled}
        rows={6}
        placeholder="Write your response…"
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: "12px",
          border: "1px solid var(--border-color)",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          fontSize: "15px",
          outline: "none",
          resize: "vertical",
          fontFamily: "inherit",
          boxSizing: "border-box",
          lineHeight: 1.6,
          opacity: disabled ? 0.6 : 1,
        }}
      />
    </div>
  );
}

function RevealFeedback({ feedback, question, value }) {
  const answered = feedback.answered;
  const isCorrect = feedback.is_correct;
  const manuallyGraded = question.type === "essay" || question.type === "coding";

  let tone;
  let title;
  let detail = null;

  if (!answered) {
    tone = {
      border: "var(--border-color)",
      bg: "var(--bg-tertiary)",
      color: "var(--text-tertiary)",
    };
    title = "No answer submitted";
    detail = "You didn't answer this question in time.";
  } else if (manuallyGraded) {
    tone = {
      border: "rgba(245,158,11,0.4)",
      bg: "rgba(245,158,11,0.08)",
      color: "#f59e0b",
    };
    title = "Answer submitted";
    detail = "Your teacher will grade this question.";
  } else if (isCorrect === true) {
    tone = {
      border: "rgba(16,185,129,0.4)",
      bg: "rgba(16,185,129,0.08)",
      color: "#10b981",
    };
    title = `Correct! +${Number(feedback.score || 0).toFixed(0)} pts`;
  } else if (isCorrect === false) {
    tone = {
      border: "rgba(239,68,68,0.4)",
      bg: "rgba(239,68,68,0.08)",
      color: "#ef4444",
    };
    title = "Not quite";
  } else {
    tone = {
      border: "rgba(245,158,11,0.4)",
      bg: "rgba(245,158,11,0.08)",
      color: "#f59e0b",
    };
    title = "Answer submitted";
    detail = "This answer is being reviewed.";
  }

  const toText = (raw) => {
    if (raw === null || raw === undefined || raw === "") return null;
    if (question.type === "enumeration") {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          return arr.filter((i) => String(i).trim()).join(", ");
        }
      } catch {
        return raw;
      }
    }
    if (
      question.type === "multiple_choice" &&
      Array.isArray(question.options)
    ) {
      return question.options[Number(raw)] ?? raw;
    }
    return String(raw);
  };

  const myAnswer = toText(
    typeof value === "string" ? value : JSON.stringify(value),
  );
  const correctAnswer =
    feedback.correct_answer !== null && feedback.correct_answer !== undefined
      ? toText(feedback.correct_answer)
      : null;

  return (
    <div
      style={{
        marginTop: "20px",
        padding: "18px 20px",
        borderRadius: "16px",
        background: tone.bg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
        }}
      >
        {isCorrect === true ? (
          <CheckCircle2 size={20} color={tone.color} />
        ) : isCorrect === false ? (
          <XCircle size={20} color={tone.color} />
        ) : (
          <Clock size={20} color={tone.color} />
        )}
        <span style={{ fontSize: "15px", fontWeight: 800, color: tone.color }}>
          {title}
        </span>
      </div>
      {answered && myAnswer && (
        <p
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            margin: "0 0 6px 0",
          }}
        >
          Your answer:{" "}
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {myAnswer}
          </span>
        </p>
      )}
      {correctAnswer && isCorrect === false && (
        <p style={{ fontSize: "13px", color: tone.color, margin: 0 }}>
          Correct answer:{" "}
          <span style={{ color: tone.color, fontWeight: 700 }}>
            {correctAnswer}
          </span>
        </p>
      )}
      {detail && (
        <p
          style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0 }}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
