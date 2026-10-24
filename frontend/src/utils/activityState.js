// Shared student-side activity state derivation.
// One canonical state per activity, used by both the activity card chip and
// the class page grouping so the two can never disagree.

export function deriveState(activity) {
  const isQuiz = activity.activity_type === 'quiz';
  const subStatus = activity.submission_status;

  // Materials are reference reading, not graded tasks. An unread material is
  // actionable reading — it sits in To do (with the chip) until the student
  // opens it; the read-tracking submission then moves it to the chip-less
  // "Materials" section for good.
  if (activity.activity_type === 'activity' && activity.submission_type === 'material') {
    const viewed = activity.submission_status === 'submitted' || activity.submission_status === 'graded';
    return viewed ? 'material' : 'todo';
  }

  if (isQuiz) {
    if (activity.is_live) {
      // A finished attempt is done even while the room is still open (self-paced).
      if (subStatus === 'graded') return 'graded';
      if (subStatus === 'submitted') return 'submitted';
      if (activity.submission_summary && activity.submission_summary.started_at && subStatus === 'draft') return 'in_progress';
      // A reopened room stays live but carries the previous close time.
      return activity.close_room_at ? 'reopened' : 'live';
    }
    if (activity.close_room_at || activity.live_status === 'completed') {
      if (subStatus === 'graded') return 'graded';
      if (subStatus === 'submitted') return 'submitted';
      // The quiz is over and they never took it. It stays visible and
      // labelled Closed — never silently hidden or called "to do".
      return 'closed';
    }
    // Published but the teacher hasn't opened the room yet
    if (subStatus === 'graded') return 'graded';
    return 'waiting';
  }

  // Non-quiz activities
  if (subStatus === 'graded') return 'graded';
  if (subStatus === 'submitted') return 'submitted';
  if (subStatus === 'missed') return 'missed';
  if (activity.deadline_at && new Date(activity.deadline_at) < new Date()) return 'missed';
  return 'todo';
}
