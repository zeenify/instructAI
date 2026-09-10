import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Trash2,
  Eye,
  EyeOff,
  Users,
  Clock,
  Upload,
  HelpCircle,
  BookOpen,
  Zap,
  Radio,
  BarChart3,
  Play,
  Timer,
  Copy,
  Loader2,
  X,
} from "lucide-react";
// eslint-disable-next-line no-unused-vars
import { motion } from "framer-motion";
import { toast } from "sonner";
import api, { invalidateCache } from "../../services/api";
import { format } from "date-fns";

const typeStyles = {
  quiz: { accent: "#a78bfa", icon: Zap, label: "Quiz" },
  file: { accent: "#3b82f6", icon: Upload, label: "Assignment" },
  questions: { accent: "#06b6d4", icon: HelpCircle, label: "Q&A" },
  material: { accent: "#94a3b8", icon: BookOpen, label: "Material" },
};

// One canonical state per card — the pill, the actions, and the grouping
// all derive from this so a card can never show contradictory states.
function quizState(a) {
  if (!a.is_published) return "draft";
  if (a.is_live && a.live_status === "paused") return "paused";
  if (a.is_live) return "live";
  if (a.close_room_at || a.live_status === "completed") return "closed";
  return "ready";
}

function activityState(a) {
  if (!a.is_published) return "draft";
  if (a.deadline_at && new Date(a.deadline_at) < new Date()) return "closed";
  return "ready";
}

const stateStyles = {
  draft: {
    label: "Draft",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.12)",
    border: "1px solid rgba(148, 163, 184, 0.3)",
  },
  ready: {
    label: "Ready to launch",
    color: "#60a5fa",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "1px solid rgba(59, 130, 246, 0.35)",
  },
  live: {
    label: "LIVE",
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    pulse: true,
  },
  paused: {
    label: "Paused",
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.12)",
    border: "1px solid rgba(245, 158, 11, 0.35)",
  },
  closed: {
    label: "Closed",
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.1)",
    border: "1px solid rgba(148, 163, 184, 0.25)",
  },
};

function timerSummary(a) {
  if (a.activity_type !== "quiz") return null;
  if (a.pacing_mode === "teacher") return "Teacher-paced";
  if (a.timer_mode === "entire_quiz" && a.time_limit_minutes)
    return `${a.time_limit_minutes} min limit`;
  if (a.timer_mode === "per_question") return "Per-question timer";
  return "No time limit";
}

export default function ActivityCard({
  activity,
  classId,
  onUpdate,
  onDelete,
}) {
  const navigate = useNavigate();
  const [repostOpen, setRepostOpen] = useState(false);
  const [classes, setClasses] = useState(null);
  const [repostingTo, setRepostingTo] = useState(null);

  const typeKey =
    activity.activity_type === "quiz"
      ? "quiz"
      : activity.submission_type || "file";
  const style = typeStyles[typeKey] || typeStyles.file;
  const TypeIcon = style.icon;

  const isQuiz = activity.activity_type === "quiz";
  const state = isQuiz ? quizState(activity) : activityState(activity);
  const stateStyle = stateStyles[state] || stateStyles.draft;
  const typeLabel =
    isQuiz
      ? `Quiz · ${activity.pacing_mode === "teacher" ? "Teacher-paced" : "Student-paced"}`
      : style.label;

  const deadlineInfo = (() => {
    if (isQuiz || !activity.deadline_at) return null;
    const deadline = new Date(activity.deadline_at);
    const passed = deadline < new Date();
    return {
      text: `${passed ? "Was due" : "Due"} ${format(deadline, "MMM d, h:mm a")}`,
      color: passed ? "#ef4444" : "var(--text-tertiary)",
    };
  })();

  const handleTogglePublish = async (e) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/teacher/activities/${activity.id}/publish`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      if (res.data.is_published) {
        toast.success("Published — students can now see it");
      } else {
        toast.warning("Unpublished");
      }
      onUpdate({ ...activity, is_published: res.data.is_published });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle publish status");
    }
  };

  const handleGoLive = async (e) => {
    e.stopPropagation();
    try {
      await api.post(`/teacher/activities/${activity.id}/start-live`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      toast.success("Quiz room is live — students can join now");
      onUpdate({ ...activity, is_live: true, live_status: "active" });
      navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start the quiz room");
    }
  };

  const handleResume = async (e) => {
    e.stopPropagation();
    try {
      await api.post(`/teacher/activities/${activity.id}/resume-live`);
      invalidateCache(`get:/teacher/classes/${classId}/activities`);
      toast.success("Quiz resumed");
      onUpdate({ ...activity, live_status: "active" });
      navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not resume the quiz");
    }
  };

  const openRepost = async (e) => {
    e.stopPropagation();
    setRepostOpen(true);
    setClasses(null);
    try {
      const res = await api.get("/teacher/classes", { bypassCache: true });
      setClasses(res.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load your classes");
      setRepostOpen(false);
    }
  };

  const handleRepost = async (targetClassId, targetClassName) => {
    if (repostingTo) return;
    setRepostingTo(targetClassId);
    try {
      const res = await api.post(`/teacher/activities/${activity.id}/repost`, {
        class_id: targetClassId,
      });
      invalidateCache(`get:/teacher/classes/${targetClassId}/activities`);
      toast.success(res.data?.message || `Posted to ${targetClassName}`);
      setRepostOpen(false);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Could not post it to that class",
      );
    } finally {
      setRepostingTo(null);
    }
  };

  const goMonitor = (e) => {
    e.stopPropagation();
    navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/live`);
  };

  const goResults = (e) => {
    e.stopPropagation();
    navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}/results`);
  };

  const primaryAction = (() => {
    if (!isQuiz) return null;
    if (state === "ready") {
      return (
        <button
          onClick={handleGoLive}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "none",
            background: "linear-gradient(135deg, #9333ea, #7e22ce)",
            color: "#fff",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            transition: "all 0.15s",
          }}
          type="button"
          title="Start the live room — students join immediately"
        >
          <Play size={13} /> Start Live
        </button>
      );
    }
    if (state === "live") {
      return (
        <button
          onClick={goMonitor}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            background: "rgba(239, 68, 68, 0.1)",
            cursor: "pointer",
            color: "#ef4444",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            transition: "all 0.15s",
          }}
          type="button"
          title="Open the live monitor"
        >
          <Radio size={13} /> Monitor
        </button>
      );
    }
    if (state === "paused") {
      return (
        <button
          onClick={handleResume}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            background: "rgba(245, 158, 11, 0.1)",
            cursor: "pointer",
            color: "#f59e0b",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            transition: "all 0.15s",
          }}
          type="button"
          title="Resume the quiz"
        >
          <Play size={13} /> Resume
        </button>
      );
    }
    if (state === "closed" && (activity.questions_count || 0) > 0) {
      return (
        <button
          onClick={goResults}
          style={{
            padding: "8px 14px",
            borderRadius: "10px",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            background: "rgba(16, 185, 129, 0.08)",
            cursor: "pointer",
            color: "#10b981",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 700,
            transition: "all 0.15s",
          }}
          type="button"
          title="Open results analysis"
        >
          <BarChart3 size={13} /> Results
        </button>
      );
    }
    return null;
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() =>
        navigate(`/dashboard/teacher/class/${classId}/activity/${activity.id}`)
      }
      style={{
        padding: "20px 24px",
        borderRadius: "16px",
        border:
          state === "live"
            ? "1px solid rgba(239, 68, 68, 0.35)"
            : "1px solid var(--border-color)",
        background: "var(--bg-secondary)",
        cursor: "pointer",
        transition: "all 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = style.accent + "44";
        e.currentTarget.style.boxShadow = `0 0 0 1px ${style.accent}22`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor =
          state === "live" ? "rgba(239, 68, 68, 0.35)" : "var(--border-color)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: state === "live" ? "#ef4444" : style.accent,
          opacity: 0.7,
        }}
      />
      <div>
        {/* Type + state: one row, no badge soup */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.02em",
              padding: "4px 10px",
              borderRadius: "6px",
              background: style.accent + "1f",
              color: style.accent,
              whiteSpace: "nowrap",
            }}
          >
            <TypeIcon size={12} />
            {typeLabel}
          </span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: state === "live" ? "0.06em" : "0.02em",
              padding: "4px 10px",
              borderRadius: "999px",
              background: stateStyle.bg,
              color: stateStyle.color,
              border: stateStyle.border,
              whiteSpace: "nowrap",
            }}
          >
            {stateStyle.pulse && (
              <span
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: stateStyle.color,
                  animation: "livePulse 1.1s ease-in-out infinite",
                }}
              />
            )}
            {stateStyle.label}
          </span>
        </div>

        <h4
          style={{
            fontSize: "17px",
            fontWeight: 700,
            color: "var(--text-primary)",
            margin: "0 0 6px 0",
            lineHeight: "1.3",
            wordBreak: "break-word",
          }}
        >
          {activity.title}
        </h4>
        {activity.description && (
          <p
            style={{
              fontSize: "14px",
              color: "var(--text-secondary)",
              margin: "0 0 4px 0",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {activity.description}
          </p>
        )}
      </div>

      {/* Metadata row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          paddingTop: "12px",
          marginTop: "12px",
          borderTop: "1px solid var(--border-color)",
          fontSize: "13px",
          color: "var(--text-tertiary)",
          flexWrap: "wrap",
        }}
      >
        {(activity.questions_count || 0) > 0 && (
          <span>
            {activity.questions_count} question
            {activity.questions_count !== 1 ? "s" : ""}
          </span>
        )}
        {!isQuiz && activity.submissions_count !== undefined && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Users size={13} /> {activity.submissions_count} submission
            {activity.submissions_count !== 1 ? "s" : ""}
          </span>
        )}
        {isQuiz && activity.submissions_count !== undefined && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Users size={13} /> {activity.submissions_count} of{" "}
            {activity.enrolled_count ?? "—"} submitted
          </span>
        )}
        {timerSummary(activity) && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <Timer size={13} /> {timerSummary(activity)}
          </span>
        )}
        {deadlineInfo && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: deadlineInfo.color,
            }}
          >
            <Clock size={13} /> {deadlineInfo.text}
          </span>
        )}

        <div
          style={{
            display: "flex",
            gap: "6px",
            flexShrink: 0,
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          {primaryAction}
          <button
            onClick={openRepost}
            style={{
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
              background: "transparent",
              cursor: "pointer",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            type="button"
            title="Post to another class"
          >
            <Copy size={15} />
          </button>
          {state !== "closed" && (
            <button
              onClick={handleTogglePublish}
              style={{
                padding: "8px",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                cursor: "pointer",
                color: activity.is_published ? "#16a34a" : "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
              type="button"
              title={activity.is_published ? "Unpublish" : "Publish"}
            >
              {activity.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          )}
          {!isQuiz && (activity.questions_count || 0) > 0 && (
            <button
              onClick={goResults}
              style={{
                padding: "8px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                background: "rgba(16, 185, 129, 0.08)",
                cursor: "pointer",
                color: "#10b981",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                justifyContent: "center",
                transition: "all 0.15s",
                fontSize: "12px",
                fontWeight: 600,
              }}
              type="button"
              title="Open results analysis"
            >
              <BarChart3 size={14} />
              Results
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(activity);
            }}
            style={{
              padding: "8px",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "transparent",
              cursor: "pointer",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            type="button"
            title="Delete activity"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {/* Post-to-another-class modal */}
      {repostOpen && (
        <div
          onClick={() => setRepostOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(2, 6, 23, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "440px",
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.45)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "18px 20px 0",
              }}
            >
              <h3
                style={{
                  fontSize: "17px",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Copy size={16} color="#a78bfa" /> Post to another class
              </h3>
              <button
                onClick={() => setRepostOpen(false)}
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                margin: "8px 20px 14px",
              }}
            >
              “{activity.title}” will be copied into the class you pick as a
              draft — questions, settings and points included. Publish it there
              when you're ready.
            </p>
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "0 12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {classes === null ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: "28px 0",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : classes.filter((c) => c.id !== Number(classId)).length ===
                0 ? (
                <p
                  style={{
                    textAlign: "center",
                    fontSize: "13px",
                    color: "var(--text-tertiary)",
                    padding: "24px 8px",
                    margin: 0,
                  }}
                >
                  No other classes yet — create another class first.
                </p>
              ) : (
                classes
                  .filter((c) => c.id !== Number(classId))
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleRepost(c.id, c.name)}
                      disabled={repostingTo !== null}
                      type="button"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "10px",
                        padding: "13px 14px",
                        borderRadius: "12px",
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-primary)",
                        cursor:
                          repostingTo !== null ? "wait" : "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                        opacity: repostingTo !== null && repostingTo !== c.id ? 0.5 : 1,
                      }}
                    >
                      <span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: "var(--text-primary)",
                          }}
                        >
                          {c.name}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: "12px",
                            color: "var(--text-tertiary)",
                            marginTop: "2px",
                          }}
                        >
                          {c.students_count ?? 0} student
                          {(c.students_count ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </span>
                      {repostingTo === c.id ? (
                        <Loader2 size={16} className="animate-spin" color="#a78bfa" />
                      ) : (
                        <Copy size={15} color="var(--text-tertiary)" />
                      )}
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
