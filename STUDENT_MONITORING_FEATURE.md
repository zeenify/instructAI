# Student Monitoring Feature

## Overview

Teachers need a dedicated page to monitor student progress across courses in a classroom. This feature provides a class-level overview of course statistics and a drill-down view into individual student progress.

## Architecture & Navigation

### New Route
- **Route**: `/teacher/monitor/:classId`
- **Component**: `StudentMonitor.jsx` (new)
- **Location**: `frontend/src/pages/teacher/`
- **Sidebar**: Add new nav item or submenu called "Monitor" that links to this page

### Navigation Flow
```
Sidebar: Monitor
  ↓
StudentMonitor.jsx
  ↓
Step 1: User selects a class (dropdown/picker)
  ↓
Step 2: User selects a course (dropdown/picker)
  ↓
Step 3a: Sees Course Stats Card
  ↓
Step 3b: Sees Class Overview (all students in course with completion %)
  ↓
Step 4 (optional): Clicks a student → StudentProfile.jsx (detailed view)
```

---

## Data Structure & Database Queries

### What We Pull From Existing Tables

All data comes from existing schema — **no new migrations needed**.

#### Course-Level Statistics (calculated once per course selection)

1. **Total Completion %**
   - Count: students who completed ALL lessons AND ALL quizzes in course
   - Formula: (students_with_all_done / total_enrolled) × 100
   - Query: Group lesson_completions and quiz_attempts by student, check if all required items done
   - Expected from DB: `{ completed_count: 15, total_enrolled: 23, percentage: 65 }`

2. **Average Quiz Score**
   - Formula: Mean of all quiz_attempts.max_score for quizzes in this course
   - Include only latest attempt per student per quiz (use MAX(created_at) per quiz)
   - Expected from DB: `{ average_score: 78, total_quizzes: 5 }`

3. **Students Not Started**
   - Count: students with zero lesson_completions AND zero quiz_attempts in this course
   - Expected from DB: `{ count: 3, student_ids: [1, 5, 12] }`

4. **Students Stuck**
   - Stuck = has code_submissions in a lesson but no lesson_completions for that lesson
   - Query: Join code_submissions to lessons, check if lesson_completions missing for same student+lesson combo
   - Expected from DB: `{ count: 2, student_ids: [8, 19] }`

---

### Class Overview (Student List) — Per Course

For each enrolled student in the course:

1. **Student name**
2. **Overall completion %** (for this course only)
   - Formula: (lessons_completed + quizzes_taken) / total_items_in_course × 100
   - Or: simple count of "done" items
3. **Last active** (most recent timestamp across)
   - lesson_completions.created_at
   - quiz_attempts.created_at
   - code_submissions.created_at
4. **Status flags** (emoji indicators):
   - 🔴 "Not Started" (zero activity in course)
   - 🟡 "Stuck" (has code attempts but incomplete lesson)
   - 🟡 "Failed Quiz Twice" (took same quiz 2+ times, last score < 70%)

Expected from DB per student:
```json
{
  "id": 5,
  "name": "Juan dela Cruz",
  "completion_percentage": 80,
  "last_active": "2026-05-15T14:30:00Z",
  "flags": ["stuck"]  // array of applicable flags
}
```

---

### Individual Student Profile — Course Detail View

When teacher clicks a student name, show detailed timeline:

1. **Header**
   - Student name
   - Overall completion % (for this course)
   - Last seen (timestamp)

2. **Module-by-Module Timeline**
   - For each module in course:
     - Module name
     - For each lesson/quiz in module (in order):
       - Item name
       - Status icon (✅ completed / ⏳ in progress / 🔒 not started)
       - If completed: completion date
       - If quiz: score and number of attempts
       - If lesson with code: number of attempts + pass status

3. **Data sources**:
   - Lessons: from lesson_completions (join to lessons.title, modules.title)
   - Quizzes: from quiz_attempts (score = max_score, attempts = count per student per quiz)
   - Code attempts: from code_submissions (count attempts per lesson, has success flag)
   - Stuck indicator: if code_submissions exist but lesson_completions missing for same lesson

---

## UI Layout

### Level 1: Course Stats Card (after selecting class + course)

```
┌─────────────────────────────────────────────┐
│  Course: Java Basics                        │
├─────────────────────────────────────────────┤
│  Class Completion:    64%  (15/23 students) │
│  Average Quiz Score:  78%                   │
│  Students Not Started: 3                    │
│  Students Stuck:      2                     │
└─────────────────────────────────────────────┘
```

**Implementation notes**:
- Display as a card/summary section at top of page
- Show these as simple key-value rows or mini stat boxes
- Make "Not Started" and "Stuck" clickable to filter student list below

---

### Level 2: Class Overview (Student List)

```
┌──────────────────────────────────────────────────────────┐
│  Student List  [Sort: Progress ▼]  [Filter: All ▼]      │
├──────────────────────────────────────────────────────────┤
│  🔴 Juan dela Cruz              ████████░░ 80%  Today    │
│  Maria Santos                   █████░░░░░ 50%  3d ago   │
│  🟡 Pedro Reyes                 ██░░░░░░░░ 20%  1wk ago  │
│  (more students...)                                      │
└──────────────────────────────────────────────────────────┘
```

**Columns**:
- Flag icon (if applicable)
- Student name (clickable)
- Progress bar (completion %)
- Last active timestamp

**Sorting options**:
- By completion % (high to low, low to high)
- By last active (recently active first)
- By name

**Filter options**:
- Show all
- Show not started
- Show stuck
- Show inactive (no activity in 7 days)

**Implementation notes**:
- Use table or card list (cards probably feel better with flags)
- Progress bar can be simple CSS `<div>` with gradient
- Click student name → navigate to Level 3

---

### Level 3: Individual Student Profile

```
┌──────────────────────────────────────────────────────────┐
│  ← Back    Juan dela Cruz        Last seen: Today        │
├──────────────┬──────────────┬────────────────────────────┤
│ Progress     │ Completion   │ Last Active                │
│ 80%          │ 15/19 items  │ Today 2:30 PM              │
├──────────────────────────────────────────────────────────┤
│  Module 1: Variables                                     │
│  ✅ Lesson 1: Intro                Completed Apr 20      │
│  ✅ Lesson 2: Data Types           Completed Apr 21      │
│  ✅ Quiz 1                         Score: 9/10  Apr 22   │
│                                                          │
│  Module 2: Loops                                         │
│  ✅ Lesson 3: For Loops            Completed Apr 25      │
│  🟡 Lesson 4: While Loops  (⚠️ stuck)   3 attempts       │
│  🔒 Quiz 2                         Not taken yet         │
├──────────────────────────────────────────────────────────┤
│  Quiz Summary                                            │
│  Quiz 1   9/10   90%   1 attempt    Apr 22               │
│  Quiz 2   6/10   60%   3 attempts   Apr 28               │
│  Quiz 3   -      -     Not taken                         │
└──────────────────────────────────────────────────────────┘
```

**Sections**:
1. Header: name, progress %, items completed, last active
2. Module timeline (for each module in course):
   - Module name
   - Each lesson/quiz as a row with:
     - Status icon + name
     - Details (completion date OR score + attempts)
     - Stuck warning if applicable
3. Quiz summary table (all quizzes in course, scores and attempts)

**Implementation notes**:
- Use nested list or timeline component
- Color code: green (done) / yellow (stuck) / gray (not started)
- "← Back" button returns to student list

---

## Flag Logic

### Flag Determination

```javascript
function getStudentFlags(student, course, data) {
  const flags = [];
  
  // Flag 1: Not Started
  if (student.lesson_completions.length === 0 && student.quiz_attempts.length === 0) {
    flags.push('not_started');
  }
  
  // Flag 2: Stuck
  // For each lesson in course:
  //   if code_submissions exist for this student+lesson but lesson_completions don't
  //     push 'stuck'
  const stuckLessons = findStuckLessons(student, course);
  if (stuckLessons.length > 0) {
    flags.push('stuck');
  }
  
  // Flag 3: Failed Quiz Twice
  // Group quiz_attempts by quiz_id, count attempts per quiz
  // if any quiz has 2+ attempts AND last attempt score < 70
  const failedQuizzes = findFailedQuizzes(student, course);
  if (failedQuizzes.length > 0) {
    flags.push('failed_quiz_twice');
  }
  
  return flags;
}
```

**Display in UI**:
- 🔴 = Not Started
- 🟡 = Stuck
- 🟡 = Failed Quiz Twice
- Show all applicable flags on student list row

---

## API Endpoints Needed

### Backend (Laravel)

**New endpoints to create:**

1. **GET `/api/teacher/classes/{classId}/courses/{courseId}/monitor/stats`**
   - Returns: course stats card data
   - Response:
   ```json
   {
     "completion_percentage": 64,
     "completed_count": 15,
     "total_enrolled": 23,
     "average_quiz_score": 78,
     "not_started_count": 3,
     "stuck_count": 2
   }
   ```

2. **GET `/api/teacher/classes/{classId}/courses/{courseId}/monitor/students`**
   - Returns: student list with flags, completion %, last active
   - Query params: `?sort=progress&filter=all`
   - Response:
   ```json
   {
     "students": [
       {
         "id": 5,
         "name": "Juan dela Cruz",
         "completion_percentage": 80,
         "last_active": "2026-05-15T14:30:00Z",
         "flags": ["stuck"]
       },
       ...
     ]
   }
   ```

3. **GET `/api/teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}`**
   - Returns: detailed student profile with timeline data
   - Response:
   ```json
   {
     "student": {
       "id": 5,
       "name": "Juan dela Cruz",
       "completion_percentage": 80,
       "items_completed": 15,
       "total_items": 19,
       "last_active": "2026-05-15T14:30:00Z"
     },
     "modules": [
       {
         "id": 1,
         "name": "Variables",
         "lessons": [
           {
             "id": 10,
             "name": "Intro",
             "type": "lesson",
             "status": "completed",
             "completed_at": "2026-04-20T10:30:00Z"
           },
           ...
         ],
         "quizzes": [
           {
             "id": 3,
             "name": "Quiz 1",
             "type": "quiz",
             "status": "completed",
             "score": 9,
             "max_score": 10,
             "attempts": 1,
             "last_attempt": "2026-04-22T15:00:00Z"
           },
           ...
         ]
       },
       ...
     ],
     "quiz_summary": [
       {
         "quiz_id": 3,
         "name": "Quiz 1",
         "score": 9,
         "max_score": 10,
         "percentage": 90,
         "attempts": 1,
         "last_attempt": "2026-04-22T15:00:00Z"
       },
       ...
     ]
   }
   ```

**Middleware**: All endpoints require `auth:sanctum` and teacher role verification

---

### Frontend (React/API Service)

**Add to `frontend/src/services/api.js`:**

```javascript
// Class monitoring endpoints
export const getMonitorStats = (classId, courseId) => 
  api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/stats`);

export const getMonitorStudents = (classId, courseId, sort = 'progress', filter = 'all') =>
  api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/students`, {
    params: { sort, filter }
  });

export const getStudentProfile = (classId, courseId, studentId) =>
  api.get(`/teacher/classes/${classId}/courses/${courseId}/monitor/student/${studentId}`);
```

---

## Component Structure

### New Components

1. **`StudentMonitor.jsx`** (Main page)
   - Handles class selector + course selector
   - Renders stats card + student list
   - Routes to individual student profile on click

2. **`StudentMonitorStats.jsx`** (Stats card)
   - Displays course stats (completion %, quiz avg, etc.)
   - Reusable component

3. **`StudentMonitorList.jsx`** (Student list)
   - Table/card grid of students
   - Sorting + filtering
   - Shows flags, completion %, last active
   - Clickable rows

4. **`StudentProfileDetail.jsx`** (Individual profile)
   - Module-by-module timeline
   - Quiz summary
   - "Back" navigation

---

## Database Query Strategy

**Key consideration**: Minimize N+1 queries. For each endpoint:

### For `/monitor/stats`:
```sql
-- Completion count
SELECT COUNT(DISTINCT student_id) as completed_count
FROM (
  SELECT student_id
  FROM lesson_completions
  WHERE course_id = {courseId}
  GROUP BY student_id, lesson_id
) lc
JOIN (
  SELECT student_id
  FROM quiz_attempts
  WHERE course_id = {courseId}
  GROUP BY student_id, quiz_id
) qa
ON lc.student_id = qa.student_id
```

Actually, simpler approach:
1. Get all students enrolled in class
2. For each, check if has completion for all lessons AND all quizzes (or use subquery)
3. Calculate completion % in single query

### For `/monitor/students`:
```sql
-- For each student in class:
SELECT 
  u.id, u.name,
  (lessons_completed + quizzes_taken) / total_items * 100 as completion_pct,
  MAX(last_active_timestamp) as last_active
FROM students
LEFT JOIN lesson_completions ON ...
LEFT JOIN quiz_attempts ON ...
GROUP BY u.id
```

### For `/monitor/student/{studentId}`:
```sql
-- Get all modules for course
SELECT * FROM modules WHERE course_id = {courseId}

-- For each module, get lessons + quizzes ordered by order_index
SELECT * FROM lessons WHERE module_id = {moduleId} ORDER BY order_index
SELECT * FROM quizzes WHERE module_id = {moduleId} ORDER BY order_index

-- For each lesson, get completion status + code attempts
SELECT * FROM lesson_completions WHERE student_id = {studentId} AND lesson_id = {lessonId}
SELECT COUNT(*) FROM code_submissions WHERE student_id = {studentId} AND lesson_id = {lessonId}

-- For each quiz, get attempts and score
SELECT MAX(max_score) as score, COUNT(*) as attempts 
FROM quiz_attempts 
WHERE student_id = {studentId} AND quiz_id = {quizId}
```

**Note**: These can be optimized with eager loading in Laravel. Use `with()` relationships.

---

## Implementation Checklist

### Backend (Laravel)

- [ ] Create new controller: `Teacher/StudentMonitorController.php`
- [ ] Add three endpoints:
  - [ ] `getMonitorStats()`
  - [ ] `getMonitorStudents()`
  - [ ] `getStudentProfile()`
- [ ] Write queries to fetch:
  - [ ] Course completion stats
  - [ ] Student list with flags
  - [ ] Individual student timeline
- [ ] Add routes to `api.php`:
  - [ ] `GET /teacher/classes/{classId}/courses/{courseId}/monitor/stats`
  - [ ] `GET /teacher/classes/{classId}/courses/{courseId}/monitor/students`
  - [ ] `GET /teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}`
- [ ] Test endpoints with Postman/curl

### Frontend (React)

- [ ] Create `StudentMonitor.jsx` page
- [ ] Create `StudentMonitorStats.jsx` component
- [ ] Create `StudentMonitorList.jsx` component
- [ ] Create `StudentProfileDetail.jsx` component
- [ ] Add API service methods to `services/api.js`
- [ ] Add route to teacher routes in `App.jsx`:
  - [ ] Path: `/teacher/monitor/:classId`
  - [ ] Component: `StudentMonitor`
- [ ] Add sidebar nav item linking to `/teacher/monitor/:classId`
- [ ] Implement sorting logic (progress, last active, name)
- [ ] Implement filter logic (all, not started, stuck, inactive)
- [ ] Style components (use existing component library)

### Testing

- [ ] Test with 0 students (edge case)
- [ ] Test with student who has zero activity
- [ ] Test with student who is stuck (code attempts, no completion)
- [ ] Test with student who failed quiz twice
- [ ] Test sorting by each option
- [ ] Test filtering by each option
- [ ] Test navigating back from profile detail
- [ ] Verify flags display correctly

---

## Data Flow Summary

```
Teacher clicks "Monitor" in sidebar
  ↓
StudentMonitor.jsx loads
  ↓ 
User picks class from dropdown
  ↓
User picks course from dropdown
  ↓
Fetch: GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/stats
Fetch: GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/students
  ↓
Display: Stats card + Student list
  ↓
User clicks a student
  ↓
Fetch: GET /api/teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}
  ↓
Display: StudentProfileDetail.jsx with full timeline
  ↓
User clicks "Back"
  ↓
Return to student list
```

---

## Notes

- **No new database tables needed** — all data exists in current schema
- **No WebSocket needed** — page load refresh is fine for capstone
- **Flags are calculated server-side** — simpler than client-side logic
- **Timestamps stored in UTC** — convert to local time in React
- **Permission check** — teacher can only see classes they own

---

## Future Enhancements (NOT in scope)

- Export student progress as CSV/PDF
- Real-time progress updates (WebSocket)
- Grade book integration
- Class-wide performance analytics/graphs
- Bulk email to stuck students
