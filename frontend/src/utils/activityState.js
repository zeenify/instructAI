// Shared student-side activity state derivation.
// One canonical state per activity, used by both the activity card chip and
// the class page grouping so the two can never disagree.

export function deriveState(activity) {
  const isQuiz = activity.activity_type === 'quiz';
  const sub = activity.submission_summary;
  const subStatus = activity.submission_status;

  if (isQuiz) {
    if (activity.is_live) {
      if (sub && sub.started_at && subStatus === 'draft') return 'in_progress';
      return 'live';
    }
    if (activity.close_room_at || activity.live_status === 'completed') {
      if (subStatus === 'graded') return 'graded';
      if (subStatus === 'submitted') return 'submitted';
      return 'missed';
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
