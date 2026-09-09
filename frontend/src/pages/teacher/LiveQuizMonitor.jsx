import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Eye,
  HelpCircle,
  ListChecks,
  Pause,
  Play,
  Radio,
  RotateCw,
  Square,
  SquareTerminal,
  Users,
  X,
  Zap,
} from "lucide-react";
import api from "../../services/api";

const STATUS_META = {
  taking: { label: "Taking", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  submitted: {
    label: "Submitted",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.12)",
  },
  joined: { label: "Joined", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
  disconnected: {
    label: "Disconnected",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.12)",
  },
  absent: { label: "Absent", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
};

function StatusChip({ status, pulse = false }) {
  const meta = STATUS_META[status] || STATUS_META.absent;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: "600",
        backgroundColor: meta.bg,
        color: meta.color,
        border: `1px solid ${meta.color}33`,
      }}
    >
      {pulse ? (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: meta.color,
            animation: "livePulse 1.2s ease-in-out infinite",
          }}
        />
      ) : (
        <Circle size={8} fill={meta.color} color={meta.color} />
      )}
      {meta.label}
    </span>
  );
}

function CountCard({ icon, label, value, color }) {
  const Icon = icon;
  return (
    <div
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: color,
        }}
      >
        <Icon size={18} />
        <span
          style={{
            fontSize: "13px",
            fontWeight: "600",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: "28px",
          fontWeight: "700",
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function formatClock(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function TeacherPacingControls({
  board,
  activityId,
  busy,
  setBusy,
  onError,
  onChanged,
  isPaused = false,
}) {
  const pacing = board?.pacing || {};
  const questions = board?.questions || [];
  const distribution = board?.distribution || [];
  const currentQ = pacing.current_q ?? 0;
  const phase = isPaused ? "paused" : pacing.phase || "waiting";
  const revealed = phase === "revealed" || !!pacing.revealed_at;
  const question = questions[currentQ];
  const dist = distribution[currentQ] || null;

  const phaseLabel =
    phase === "complete"
      ? "Complete"
      : phase === "paused"
        ? "Paused"
        : phase === "revealed"
          ? "Revealed"
          : phase === "question"
            ? "Question open"
            : "Waiting";
  const phaseColor =
    phase === "complete"
      ? "#8b5cf6"
      : phase === "paused"
        ? "#f59e0b"
        : phase === "revealed"
          ? "#10b981"
          : phase === "question"
            ? "#3b82f6"
            : "#94a3b8";

  const setQuestion = async (idx) => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/live/question`, {
        idx,
      });
      await onChanged(true);
    } catch (e) {
      onError(
        e.response?.data?.message || e.message || "Failed to set question",
      );
    } finally {
      setBusy(false);
    }
  };

  const reveal = async () => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/live/reveal`);
      await onChanged(true);
    } catch (e) {
      onError(
        e.response?.data?.message || e.message || "Failed to reveal answer",
      );
    } finally {
      setBusy(false);
    }
  };

  const deadline = pacing.deadline_at ? new Date(pacing.deadline_at) : null;
  const deadlineText =
    deadline && deadline.getTime() > Date.now()
      ? `Closes ${formatClock(deadline.toISOString())}`
      : deadline && phase !== "complete"
        ? "Countdown expired"
        : null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-secondary)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Radio size={18} color="#8b5cf6" />
          <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
            Question Control
          </h2>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "700",
              padding: "3px 10px",
              borderRadius: "999px",
              backgroundColor: "rgba(139,92,246,0.12)",
              border: "1px solid rgba(139,92,246,0.35)",
              color: "#8b5cf6",
              letterSpacing: "0.06em",
            }}
          >
            TEACHER-PACED
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: "600",
            color: phaseColor,
          }}
        >
          <Circle size={8} fill={phaseColor} color={phaseColor} />
          {phaseLabel}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: "12px",
          alignItems: "stretch",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "14px 16px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              margin: "0 0 6px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Current Question
          </p>
          <p style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
            {questions.length > 0
              ? `Question ${currentQ + 1} of ${questions.length}`
              : "No questions"}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--text-secondary)",
              margin: "6px 0 0",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {question?.question_text || "—"}{" "}
            {question?.points != null ? `(${question.points} pts)` : ""}
          </p>
          {deadlineText && (
            <p
              style={{
                fontSize: "12px",
                fontWeight: "600",
                color:
                  deadlineText === "Countdown expired" ? "#ef4444" : "#f59e0b",
                margin: "8px 0 0",
              }}
            >
              <Clock
                size={12}
                style={{ verticalAlign: "-2px", marginRight: "4px" }}
              />
              {deadlineText}
            </p>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: "220px",
            padding: "14px 16px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "10px",
            border: "1px solid var(--border-color)",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              margin: "0 0 6px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Answer Distribution
          </p>
          {dist && dist.answered > 0 ? (
            <>
              <p style={{ fontSize: "15px", fontWeight: "700", margin: 0 }}>
                {dist.answered} answered
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "8px",
                }}
              >
                {Object.entries(dist.per_option || {}).map(([opt, count]) => (
                  <span
                    key={opt}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "600",
                      backgroundColor: "rgba(16,185,129,0.1)",
                      border: "1px solid rgba(16,185,129,0.3)",
                      color: "#10b981",
                    }}
                  >
                    {opt}: {count}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-tertiary)",
                margin: 0,
              }}
            >
              No answers yet for this question.
            </p>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <button
          onClick={() => setQuestion(Math.max(0, currentQ - 1))}
          disabled={busy || isPaused || currentQ <= 0 || phase === "complete"}
          style={{
            ...controlBtn,
            opacity:
              busy || isPaused || currentQ <= 0 || phase === "complete"
                ? 0.5
                : 1,
          }}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <button
          onClick={() =>
            setQuestion(Math.min(questions.length - 1, currentQ + 1))
          }
          disabled={
            busy ||
            isPaused ||
            currentQ >= questions.length - 1 ||
            phase === "complete"
          }
          style={{
            ...controlBtn,
            opacity:
              busy ||
              isPaused ||
              currentQ >= questions.length - 1 ||
              phase === "complete"
                ? 0.5
                : 1,
          }}
        >
          Next <ChevronRight size={16} />
        </button>
        <button
          onClick={reveal}
          disabled={
            busy ||
            isPaused ||
            revealed ||
            phase === "complete" ||
            phase === "waiting"
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            backgroundColor: "#10b981",
            border: "none",
            borderRadius: "8px",
            color: "#fff",
            fontWeight: "600",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 200ms ease-in-out",
            opacity:
              busy ||
              isPaused ||
              revealed ||
              phase === "complete" ||
              phase === "waiting"
                ? 0.5
                : 1,
          }}
        >
          <Eye size={16} />
          {revealed ? "Answer Revealed" : "Reveal Answer"}
        </button>
      </div>
    </div>
  );
}

const controlBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 18px",
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border-color)",
  borderRadius: "8px",
  color: "var(--text-secondary)",
  fontWeight: "600",
  fontSize: "14px",
  cursor: "pointer",
  transition: "all 200ms ease-in-out",
};

function formatIdle(seconds) {
  if (seconds === null || seconds === undefined) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function LiveQuizMonitor() {
  const { classId, activityId } = useParams();
  const navigate = useNavigate();

  const [board, setBoard] = useState(null);
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showLiveCode, setShowLiveCode] = useState(false);
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);

  const intervalRef = useRef(null);
  const inFlightRef = useRef(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchBoard = useCallback(
    async (silent = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const res = await api.get(
          `/teacher/activities/${activityId}/live-board`,
          { bypassCache: true },
        );
        setBoard(res.data);
        setActivity(res.data.activity);
        setLoading(false);
        setError(null);
        setLastUpdated(new Date());
      } catch (e) {
        setLoading(false);
        setError(
          e.response?.data?.message || e.message || "Failed to load live board",
        );
        if (!silent) clearInterval(intervalRef.current);
      } finally {
        inFlightRef.current = false;
      }
    },
    [activityId],
  );

  useEffect(() => {
    fetchBoard();
    const id = setInterval(() => fetchBoard(true), 3000);
    intervalRef.current = id;
    return () => clearInterval(id);
  }, [fetchBoard]);

  const handleStart = async () => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/start-live`);
      await fetchBoard(true);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Failed to start the room",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/end-live`);
      setConfirmEnd(false);
      setSelectedStudent(null);
      setProgress(null);
      await fetchBoard(true);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Failed to close the room",
      );
    } finally {
      setBusy(false);
    }
  };

  const openDetails = async (student) => {
    setSelectedStudent(student);
    if (!student.submission_id) return;
    setProgressLoading(true);
    setProgress(null);
    try {
      const res = await api.get(
        `/teacher/activities/${activityId}/live-progress`,
        { bypassCache: true },
      );
      const row = res.data.students.find(
        (s) => s.student.id === student.student.id,
      );
      setProgress(row || null);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message ||
          "Failed to load student progress",
      );
    } finally {
      setProgressLoading(false);
    }
  };

  const closeDetails = () => {
    setSelectedStudent(null);
    setProgress(null);
  };

  const handlePause = async () => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/pause-live`);
      await fetchBoard(true);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Failed to pause the room",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    setBusy(true);
    try {
      await api.post(`/teacher/activities/${activityId}/resume-live`);
      await fetchBoard(true);
    } catch (e) {
      setError(
        e.response?.data?.message || e.message || "Failed to resume the room",
      );
    } finally {
      setBusy(false);
    }
  };

  const isLive = activity?.live_status === "active";
  const isPaused = activity?.live_status === "paused";
  const isClosed = activity?.live_status === "completed";
  const counts = board?.counts || {};
  const students = board?.students || [];
  const roster = [...students].sort((a, b) => {
    const order = {
      taking: 0,
      joined: 1,
      disconnected: 2,
      submitted: 3,
      absent: 4,
    };
    return (
      (order[a.status] ?? 9) - (order[b.status] ?? 9) ||
      (a.student.first_name || "").localeCompare(b.student.first_name || "")
    );
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        color: "var(--text-primary)",
        transition: "all 0.3s ease",
      }}
    >
      <div
        className="max-w-7xl mx-auto"
        style={{
          paddingLeft: "24px",
          paddingRight: "24px",
          paddingTop: "32px",
          paddingBottom: "32px",
          transition: "margin-right 200ms ease",
          marginRight: selectedStudent ? "min(420px, 100vw)" : 0,
        }}
      >
        <button
          onClick={() => navigate(`/dashboard/teacher/class/${classId}`)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "var(--bg-secondary)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            color: "var(--text-secondary)",
            fontWeight: "500",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 200ms ease-in-out",
            marginBottom: "24px",
          }}
        >
          <ChevronLeft size={18} />
          Back to Class
        </button>

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 16px",
              borderRadius: "8px",
              backgroundColor: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#ef4444",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "300px",
              flexDirection: "column",
              gap: "12px",
              color: "var(--text-tertiary)",
            }}
          >
            <RotateCw size={32} className="animate-spin" />
            <p style={{ fontSize: "14px" }}>Loading live board...</p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "16px",
                flexWrap: "wrap",
                marginBottom: "28px",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <h1
                    style={{
                      fontSize: "28px",
                      fontWeight: "700",
                      letterSpacing: "-0.03em",
                      margin: 0,
                    }}
                  >
                    {activity?.title || "Live Quiz"}
                  </h1>
                  {isLive && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(239,68,68,0.12)",
                        border: "1px solid rgba(239,68,68,0.35)",
                        color: "#ef4444",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          backgroundColor: "#ef4444",
                          animation: "livePulse 1s ease-in-out infinite",
                        }}
                      />
                      LIVE
                    </span>
                  )}
                  {isPaused && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.4)",
                        color: "#f59e0b",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <Pause size={10} fill="#f59e0b" />
                      PAUSED
                    </span>
                  )}
                  {isClosed && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(139,92,246,0.12)",
                        border: "1px solid rgba(139,92,246,0.35)",
                        color: "#8b5cf6",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <Square size={10} fill="#8b5cf6" />
                      ROOM CLOSED
                    </span>
                  )}
                  {!isLive && !isClosed && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "999px",
                        backgroundColor: "rgba(94,234,212,0.1)",
                        border: "1px solid rgba(94,234,212,0.3)",
                        color: "#5eead4",
                        fontSize: "12px",
                        fontWeight: "700",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <Zap size={10} />
                      NOT STARTED
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "15px",
                    color: "var(--text-secondary)",
                    margin: 0,
                  }}
                >
                  {counts.enrolled ?? 0} enrolled ·{" "}
                  {activity?.type === "quiz" ? "Quiz" : "Activity"} · started{" "}
                  {formatClock(activity?.live_started_at)}
                </p>
              </div>

              <div
                style={{ display: "flex", gap: "12px", alignItems: "center" }}
              >
                {!isLive && !isPaused && !isClosed && (
                  <button
                    onClick={handleStart}
                    disabled={busy}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      backgroundColor: "#10b981",
                      border: "none",
                      borderRadius: "8px",
                      color: "#ffffff",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 200ms ease-in-out",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Play size={16} />
                    Start Room
                  </button>
                )}
                {(isLive || isPaused) && activity?.pacing_mode === "teacher" && (
                  <button
                    onClick={isLive ? handlePause : handleResume}
                    disabled={busy}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      backgroundColor: isPaused
                        ? "#10b981"
                        : "rgba(245,158,11,0.12)",
                      border: isPaused
                        ? "none"
                        : "1px solid rgba(245,158,11,0.4)",
                      borderRadius: "8px",
                      color: isPaused ? "#ffffff" : "#f59e0b",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 200ms ease-in-out",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    {isPaused ? (
                      <>
                        <Play size={16} />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause size={16} />
                        Pause
                      </>
                    )}
                  </button>
                )}
                {(isLive || isPaused) && activity?.pacing_mode === "teacher" && (
                  <button
                    onClick={() => setShowLiveCode(true)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      backgroundColor: "rgba(139,92,246,0.12)",
                      border: "1px solid rgba(139,92,246,0.4)",
                      borderRadius: "8px",
                      color: "#8b5cf6",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 200ms ease-in-out",
                    }}
                    title="Watch students' code as they type on the current coding question"
                  >
                    <SquareTerminal size={16} />
                    Live Code
                  </button>
                )}
                {(isLive || isPaused) && (
                  <button
                    onClick={() => setConfirmEnd(true)}
                    disabled={busy}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      backgroundColor: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.4)",
                      borderRadius: "8px",
                      color: "#ef4444",
                      fontWeight: "600",
                      fontSize: "14px",
                      cursor: "pointer",
                      transition: "all 200ms ease-in-out",
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Square size={14} fill="#ef4444" />
                    End Room
                  </button>
                )}
                {isClosed && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 20px",
                      borderRadius: "8px",
                      backgroundColor: "var(--bg-secondary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-tertiary)",
                      fontWeight: "600",
                      fontSize: "14px",
                    }}
                  >
                    <ListChecks size={16} />
                    View results in Class Activity
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "12px",
                marginBottom: "28px",
              }}
            >
              <CountCard
                icon={Users}
                label="Enrolled"
                value={counts.enrolled ?? 0}
                color="var(--text-secondary)"
              />
              <CountCard
                icon={Activity}
                label="Taking"
                value={counts.taking ?? 0}
                color="#10b981"
              />
              <CountCard
                icon={ListChecks}
                label="Submitted"
                value={counts.submitted ?? 0}
                color="#8b5cf6"
              />
              <CountCard
                icon={HelpCircle}
                label="Joined"
                value={counts.joined ?? 0}
                color="#3b82f6"
              />
              <CountCard
                icon={Clock}
                label="Disconnected"
                value={counts.disconnected ?? 0}
                color="#f59e0b"
              />
              <CountCard
                icon={Eye}
                label="Absent"
                value={counts.absent ?? 0}
                color="#94a3b8"
              />
            </div>

            {(isLive || isPaused) && activity?.pacing_mode === "teacher" && (
              <TeacherPacingControls
                board={board}
                activityId={activityId}
                busy={busy}
                setBusy={setBusy}
                onError={setError}
                onChanged={fetchBoard}
                isPaused={isPaused}
              />
            )}

            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid var(--border-color)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h2 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>
                  Student Roster
                </h2>
                <span
                  style={{
                    fontSize: "13px",
                    color: "var(--text-tertiary)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Radio size={14} color="#10b981" />
                  Refreshes every 3s
                </span>
              </div>

              {roster.length === 0 ? (
                <div
                  style={{
                    padding: "48px 20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <Users
                    size={32}
                    style={{ marginBottom: "12px", opacity: 0.5 }}
                  />
                  <p style={{ fontSize: "15px", margin: 0 }}>
                    No students enrolled in this class yet.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      minWidth: "720px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          borderBottom: "1px solid var(--border-color)",
                        }}
                      >
                        {[
                          "Student",
                          "Status",
                          "Started",
                          "Idle",
                          "Question",
                          "Answered",
                          "Score",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "12px 16px",
                              textAlign: "left",
                              fontSize: "12px",
                              fontWeight: "600",
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                        <th style={{ padding: "12px 16px", width: "48px" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {roster.map((row) => {
                        const name = `${row.student?.student_profile?.first_name || "Student"} ${row.student?.student_profile?.last_name || ""}`;
                        return (
                          <tr
                            key={row.student?.id}
                            onClick={() => openDetails(row)}
                            style={{
                              borderBottom: "1px solid var(--border-color)",
                              cursor: "pointer",
                              transition: "background 150ms ease-in-out",
                              backgroundColor:
                                selectedStudent?.student?.id === row.student?.id
                                  ? "rgba(16,185,129,0.06)"
                                  : "transparent",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor =
                                "rgba(16,185,129,0.04)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor =
                                selectedStudent?.student?.id === row.student?.id
                                  ? "rgba(16,185,129,0.06)"
                                  : "transparent";
                            }}
                          >
                            <td style={{ padding: "14px 16px" }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "50%",
                                    backgroundColor: "#10b981",
                                    color: "#fff",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "14px",
                                    fontWeight: "700",
                                    flexShrink: 0,
                                  }}
                                >
                                  {name[0]}
                                </div>
                                <span
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: "600",
                                  }}
                                >
                                  {name}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              <StatusChip
                                status={row.status}
                                pulse={row.status === "taking"}
                              />
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "13px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {formatClock(row.started_at)}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "13px",
                                color:
                                  row.idle_seconds !== null &&
                                  row.idle_seconds > 15
                                    ? "#f59e0b"
                                    : "var(--text-secondary)",
                                fontWeight:
                                  row.idle_seconds !== null &&
                                  row.idle_seconds > 15
                                    ? "600"
                                    : "400",
                              }}
                            >
                              {formatIdle(row.idle_seconds)}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "13px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {row.status === "taking"
                                ? `Question ${row.current_question_idx + 1}`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "13px",
                                color: "var(--text-secondary)",
                              }}
                            >
                              {row.submission_id
                                ? `${row.answers_count} answered`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                fontSize: "13px",
                                fontWeight: "600",
                                color:
                                  row.status === "submitted"
                                    ? "#8b5cf6"
                                    : "var(--text-tertiary)",
                              }}
                            >
                              {row.status === "submitted"
                                ? `${row.score ?? "—"}/${row.max_score ?? "—"}`
                                : "—"}
                            </td>
                            <td
                              style={{
                                padding: "14px 16px",
                                textAlign: "right",
                              }}
                            >
                              <ChevronRight
                                size={16}
                                color="var(--text-tertiary)"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p
              style={{
                textAlign: "center",
                marginTop: "16px",
                fontSize: "12px",
                color: "var(--text-tertiary)",
              }}
            >
              Last refresh{" "}
              {formatClock(lastUpdated ? lastUpdated.toISOString() : null)}
            </p>
          </>
        )}

        {confirmEnd && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "20px",
            }}
          >
            <div
              style={{
                backgroundColor: "var(--bg-secondary)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "28px",
                maxWidth: "440px",
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <Square size={20} color="#ef4444" fill="#ef4444" />
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                  End live room?
                </h3>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  marginBottom: "24px",
                  lineHeight: 1.6,
                }}
              >
                The room will close immediately. Unfinished answers are
                submitted as-is, missed questions are graded as incorrect, and
                results are shown to students (per the quiz settings). This
                cannot be undone.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setConfirmEnd(false)}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "transparent",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnd}
                  disabled={busy}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#ef4444",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: "pointer",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? "Closing..." : "End Room"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedStudent && (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              backgroundColor: "var(--bg-secondary)",
              borderLeft: "1px solid var(--border-color)",
              zIndex: 90,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-12px 0 32px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                padding: "20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    margin: "0 0 4px",
                  }}
                >
                  Student Progress
                </p>
                <h3 style={{ fontSize: "18px", fontWeight: "700", margin: 0 }}>
                  {selectedStudent.student?.student_profile?.first_name}{" "}
                  {selectedStudent.student?.student_profile?.last_name}
                </h3>
                <div style={{ marginTop: "8px" }}>
                  <StatusChip
                    status={selectedStudent.status}
                    pulse={selectedStudent.status === "taking"}
                  />
                </div>
              </div>
              <button
                onClick={closeDetails}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-tertiary)",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              {!selectedStudent.submission_id ? (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    paddingTop: "48px",
                  }}
                >
                  <Eye
                    size={32}
                    style={{ opacity: 0.5, marginBottom: "12px" }}
                  />
                  <p style={{ fontSize: "14px", margin: 0 }}>
                    This student has not joined the room yet.
                  </p>
                </div>
              ) : progressLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    paddingTop: "48px",
                  }}
                >
                  <RotateCw
                    size={28}
                    className="animate-spin"
                    color="var(--text-tertiary)"
                  />
                </div>
              ) : progress ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "12px",
                      marginBottom: "20px",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px",
                        backgroundColor: "var(--bg-primary)",
                        borderRadius: "10px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--text-tertiary)",
                          margin: "0 0 4px",
                        }}
                      >
                        Started
                      </p>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                          margin: 0,
                        }}
                      >
                        {formatClock(progress.started_at)}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: "14px",
                        backgroundColor: "var(--bg-primary)",
                        borderRadius: "10px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--text-tertiary)",
                          margin: "0 0 4px",
                        }}
                      >
                        Answered
                      </p>
                      <p
                        style={{
                          fontSize: "15px",
                          fontWeight: "600",
                          margin: 0,
                        }}
                      >
                        {progress.answers_count}/
                        {progress.questions?.length ?? 0}
                      </p>
                    </div>
                  </div>

                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      margin: "0 0 12px",
                    }}
                  >
                    Questions
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                    }}
                  >
                    {progress.questions?.map((q, i) => (
                      <div
                        key={q.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 14px",
                          backgroundColor: "var(--bg-primary)",
                          borderRadius: "10px",
                          border: "1px solid var(--border-color)",
                          borderColor: q.is_current
                            ? "#10b981"
                            : "var(--border-color)",
                          boxShadow: q.is_current
                            ? "0 0 0 1px rgba(16,185,129,0.4)"
                            : "none",
                        }}
                      >
                        <span
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "50%",
                            backgroundColor: q.answered
                              ? "rgba(16,185,129,0.15)"
                              : "rgba(148,163,184,0.1)",
                            color: q.answered
                              ? "#10b981"
                              : "var(--text-tertiary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "13px",
                            fontWeight: "700",
                            flexShrink: 0,
                          }}
                        >
                          {i + 1}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              fontSize: "13px",
                              fontWeight: "600",
                              margin: 0,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {q.type?.replace("_", " ") || "question"}
                          </p>
                          <p
                            style={{
                              fontSize: "12px",
                              color: "var(--text-tertiary)",
                              margin: "2px 0 0",
                            }}
                          >
                            {q.points} pts
                          </p>
                        </div>
                        {q.is_current && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#10b981",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            <Radio size={12} />
                            CURRENT
                          </span>
                        )}
                        {q.answered && !q.is_current && (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              color: "#10b981",
                            }}
                          >
                            ✓ ANSWERED
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {progress.status === "submitted" && (
                    <div
                      style={{
                        marginTop: "20px",
                        padding: "16px",
                        backgroundColor: "rgba(139,92,246,0.08)",
                        border: "1px solid rgba(139,92,246,0.3)",
                        borderRadius: "10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: "700",
                          color: "#8b5cf6",
                          margin: "0 0 4px",
                        }}
                      >
                        Submitted
                      </p>
                      <p
                        style={{
                          fontSize: "22px",
                          fontWeight: "700",
                          margin: 0,
                        }}
                      >
                        {progress.score ?? "—"}{" "}
                        <span
                          style={{
                            fontSize: "14px",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          / {progress.max_score ?? "—"}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    paddingTop: "48px",
                  }}
                >
                  <p style={{ fontSize: "14px", margin: 0 }}>
                    No progress data available.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showLiveCode && (
        <LiveCodeModal
          activityId={activityId}
          onClose={() => setShowLiveCode(false)}
        />
      )}

      <style>{`
                @keyframes livePulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.35; }
                }
            `}</style>
    </div>
  );
}
