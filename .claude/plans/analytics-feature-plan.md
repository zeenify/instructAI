# Analytics Feature Plan

## Overview
Build a teacher analytics dashboard showing historical trends and performance insights across courses and students.

## High-Value Metrics (Phase 1)

### 1. Course Performance Overview
- **Metric**: Completion rate trend over time (line chart)
- **Data**: From `lesson_completions` and `quiz_attempts` grouped by date
- **Query**: Count completed items per day for selected course
- **Display**: Line chart showing progression

### 2. Student Performance Distribution
- **Metric**: Histogram of completion percentages
- **Data**: Calculated from student monitoring data
- **Display**: Bar chart showing "# students at 0-20%, 20-40%, 40-60%, 60-80%, 80-100%"

### 3. Quiz Analytics
- **Metric**: Average quiz scores per quiz
- **Data**: From `quiz_attempts.total_score` grouped by quiz_id
- **Display**: Horizontal bar chart showing average score for each quiz

### 4. Content Engagement
- **Metric**: Most/least attempted lessons
- **Data**: Count of `code_submissions` + `quiz_attempts` per lesson
- **Display**: Table showing lesson name, attempt count, completion rate

### 5. Weekly Activity Timeline
- **Metric**: Student activity volume by day of week
- **Data**: Count of submissions/completions grouped by day
- **Display**: Bar chart showing activity patterns

## Implementation Plan

### Backend
1. Create new controller: `AnalyticsController`
2. Add endpoints:
   - `GET /api/teacher/classes/{classId}/analytics/course/{courseId}/overview`
   - `GET /api/teacher/classes/{classId}/analytics/course/{courseId}/performance-distribution`
   - `GET /api/teacher/classes/{classId}/analytics/course/{courseId}/quiz-scores`
   - `GET /api/teacher/classes/{classId}/analytics/course/{courseId}/content-engagement`
   - `GET /api/teacher/classes/{classId}/analytics/course/{courseId}/activity-timeline`
3. Batch queries to minimize database hits
4. Cache results (optional, for performance)

### Frontend
1. Create new page: `pages/teacher/Analytics.jsx`
2. Create components:
   - `AnalyticsOverview.jsx` - summary cards
   - `CoursePerformanceChart.jsx` - line chart
   - `PerformanceDistribution.jsx` - bar chart (histogram)
   - `QuizScoresChart.jsx` - horizontal bar chart
   - `ContentEngagement.jsx` - table view
   - `ActivityTimeline.jsx` - bar chart
3. Add routing: `/dashboard/teacher/analytics`
4. Add nav link in sidebar

### Data Requirements
- Line charts: Use date-based aggregation
- Bar charts: Use category-based aggregation
- Filters: By date range (optional for Phase 1)

## UI Layout
- Top: Summary stat cards (total students, avg completion, avg quiz score, etc.)
- Middle: Large chart section (tabs: Performance Trend, Performance Distribution, Quiz Scores)
- Bottom: Content Engagement table

## Database Queries Needed
1. **Completion trend**: `GROUP BY DATE(completed_at)` on lesson_completions
2. **Quiz trend**: `GROUP BY DATE(created_at)` on quiz_attempts
3. **Student distribution**: Calculate percentages, bucket into ranges
4. **Quiz averages**: `AVG(total_score)` grouped by quiz_id
5. **Lesson engagement**: COUNT submissions/attempts grouped by lesson_id
6. **Activity by day**: `DAYNAME(created_at)` grouping

## Questions for User
1. Should analytics be per-course or class-wide?
2. Date range filtering needed or just show all-time data?
3. Any specific visualizations you prefer? (we have charts available)
4. Export to CSV/PDF needed?
5. Real-time or is historical data OK (5-min cache acceptable)?
