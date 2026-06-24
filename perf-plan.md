# Performance Implementation Plan

**Beginner-friendly, step-by-step.**

---

## Before We Start: Understand What's Happening

Every time a page loads, Laravel sends queries to NeonDB (your hosted Postgres in Singapore/Australia). Each query takes 20-100ms just for the network trip to Australia and back. Your pages fire 15-30 of these queries one after another.

**Our goal:** Reduce the number of queries per page from 15-30 down to 2-5. This is done by:

1. **Indexes** — Making each query run faster (like a book index vs reading every page)
2. **Eager loading** — Fetching related data in one trip instead of N trips
3. **Caching** — Skipping the DB entirely for data that hasn't changed

---

## Part 1: Database Indexes (Estimated: 20 minutes)

### What is an Index?

Without an index, finding `WHERE student_id = 5` means Postgres reads **every row** in the table to find matches. With an index, it jumps directly to the matching rows — like the index at the back of a book.

An index is just a sorted copy of specific columns. It takes up a bit of disk space but makes queries 10-100x faster.

### What You'll Do

Create a new migration file that adds 5 indexes to frequently-queried columns.

**Step 1.1:** Open your terminal in the `backend` directory and run:

```bash
php artisan make:migration add_performance_indexes
```

This creates a file like `2026_06_23_xxxxxx_add_performance_indexes.php` in `database/migrations/`.

**Step 1.2:** Open that file and replace its content with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Quiz attempts: we often search by student_id AND quiz_id AND status together
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->index(['student_id', 'quiz_id', 'status'], 'idx_quiz_attempts_student_quiz_status');
        });

        // Code submissions: we often search by student_id AND lesson_id
        Schema::table('code_submissions', function (Blueprint $table) {
            $table->index(['student_id', 'lesson_id'], 'idx_code_submissions_student_lesson');
        });

        // Modules: we often sort by order_index within a course
        Schema::table('modules', function (Blueprint $table) {
            $table->index(['course_id', 'order_index'], 'idx_modules_course_order');
        });

        // Lessons: we often filter by module_id AND is_published, then sort by order_index
        Schema::table('lessons', function (Blueprint $table) {
            $table->index(['module_id', 'is_published', 'order_index'], 'idx_lessons_module_published_order');
        });

        // Quizzes: same pattern as lessons
        Schema::table('quizzes', function (Blueprint $table) {
            $table->index(['module_id', 'is_published', 'order_index'], 'idx_quizzes_module_published_order');
        });
    }

    public function down(): void
    {
        Schema::table('quiz_attempts', function (Blueprint $table) {
            $table->dropIndex('idx_quiz_attempts_student_quiz_status');
        });
        Schema::table('code_submissions', function (Blueprint $table) {
            $table->dropIndex('idx_code_submissions_student_lesson');
        });
        Schema::table('modules', function (Blueprint $table) {
            $table->dropIndex('idx_modules_course_order');
        });
        Schema::table('lessons', function (Blueprint $table) {
            $table->dropIndex('idx_lessons_module_published_order');
        });
        Schema::table('quizzes', function (Blueprint $table) {
            $table->dropIndex('idx_quizzes_module_published_order');
        });
    }
};
```

**Step 1.3:** Run the migration:

```bash
php artisan migrate
```

That's it. Five indexes added. Zero code changes. Every query on these tables will now run faster.

**Note:** `lesson_completions` already has a `UNIQUE (student_id, lesson_id)` constraint which automatically creates an index in Postgres. Same for `enrollments` with `UNIQUE (student_id, class_id)`. So those two are already covered.

---

## Part 2: Install Laravel Debugbar (Estimated: 5 minutes)

This is a toolbar that shows every query a page makes, right in your browser. We'll use it to find N+1 problems.

**Step 2.1:** In `backend` directory:

```bash
composer require barryvdh/laravel-debugbar --dev
```

**Step 2.2:** No config needed. Just refresh any page and you'll see a debug bar at the bottom. Click "Queries" to see every SQL statement the page ran.

**What to look for:** If you see 20+ queries for a simple page, that's our target.

---

## Part 3: Enable Lazy Loading Prevention (Estimated: 30 minutes including fixes)

### What is Lazy Loading?

When you write:

```php
$course = Course::find(1);
// At this point, only the course data is loaded

$course->modules  // <-- Laravel now fires: SELECT * FROM modules WHERE course_id = 1
```

That's "lazy loading." It seems innocent, but inside a loop it becomes:

```php
foreach ($quizzes as $quiz) {
    $quiz->module->course->class_id  // 3 NEW queries per iteration!
    // If you have 20 questions, that's an extra 60 queries
}
```

We want to **prevent lazy loading** so the app forces us to load everything upfront.

### Step 3.1: Enable Prevention in Development

Open `app/Providers/AppServiceProvider.php` and change it to:

```php
<?php

namespace App\Providers;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Catch N+1 problems during development
        if (app()->isLocal()) {
            Model::preventLazyLoading(true);
        }

        // Log lazy loads in production instead of crashing
        Model::handleLazyLoadingViolationUsing(function ($model, $relation) {
            Log::warning("Lazy loading detected", [
                'model' => get_class($model),
                'relation' => $relation,
            ]);
        });
    }
}
```

### Step 3.2: Open Every Page and Fix What Breaks

Now browse your app. Any lazy-loaded relationship will throw an error with a message like:

> "Attempted to lazy load [relation] on model [Model]."

When you see this:

1. Note the model and relation name (e.g., `Course` → `modules`)
2. Find the controller that's loading that model
3. Add `->with('modules')` to the query:

```php
// Before (breaks):
$course = Course::find($id);

// After (works):
$course = Course::with('modules')->find($id);
```

**Common patterns you'll need to fix:**

| File | What to add |
|------|-------------|
| `Student/QuizController.php` | `$quiz->load('questions')` before the `->questions->map()` loop |
| `Student/QuizController.php` | `$completedAttempt->load('answers')` before the per-question answer lookup |
| `Student/CourseController.php` | Already uses `$course->load([...])` — check `showClass` for lazy `->courses` usage |
| `Teacher/CourseController.php` | `$course->load('modules')` before `$course->modules->pluck('id')` in `publishAll()` |
| `Teacher/AnalyticsController.php` | Add `->with(['modules.lessons', 'modules.quizzes'])` to the course query |
| `Teacher/StudentMonitorController.php` | Same as AnalyticsController |

**How to know if you fixed it:** Refresh the page — if the error is gone, you fixed it. Check Debugbar — query count should drop significantly.

---

## Part 4: Fix the Student Quiz N+1 (The Biggest Slowdown)

This is the single biggest improvement. The quiz page fires 1 query per question when displaying results.

**File:** `app/Http/Controllers/Student/QuizController.php`

**Find this code (around line 47-53):**

```php
if ($completedAttempt) {
    $existingResult = [
        'details' => $quiz->questions->map(function($q) use ($completedAttempt) {
            $ans = $completedAttempt->answers()->where('question_id', $q->id)->first();
```

**The problem:** `$completedAttempt->answers()` inside the `->map()` loop fires a NEW query for every question. 20 questions = 20 extra queries.

**Change to:**

```php
if ($completedAttempt) {
    // Load ALL answers once before the loop
    $allAnswers = $completedAttempt->answers()
        ->whereIn('question_id', $quiz->questions->pluck('id'))
        ->get()
        ->keyBy('question_id');

    $existingResult = [
        'details' => $quiz->questions->map(function($q) use ($allAnswers) {
            $ans = $allAnswers->get($q->id);
```

**What changed:** We load all answers in ONE query, then look them up from memory. 20 queries → 1 query.

---

## Part 5: Fix the Student Class List N+1 (Sidebar Speed)

**File:** `app/Http/Controllers/Student/CourseController.php`

**Find lines 29-66 (the `foreach ($classroom->courses as $course)` loop).**

This loop fires 4 queries per course to compute progress. For 5 courses = 20 queries.

**Replace the entire foreach loop** (lines 29-66) with:

```php
// Get all course IDs
$courseIds = $classroom->courses->pluck('id');

// Batch COUNT queries — one query per metric, not per course
$lessonCounts = DB::table('modules')
    ->whereIn('course_id', $courseIds)
    ->join('lessons', 'modules.id', '=', 'lessons.module_id')
    ->where('lessons.is_published', true)
    ->selectRaw('modules.course_id, COUNT(*) as count')
    ->groupBy('modules.course_id')
    ->pluck('count', 'course_id');

$quizCounts = DB::table('modules')
    ->whereIn('course_id', $courseIds)
    ->join('quizzes', 'modules.id', '=', 'quizzes.module_id')
    ->where('quizzes.is_published', true)
    ->selectRaw('modules.course_id, COUNT(*) as count')
    ->groupBy('modules.course_id')
    ->pluck('count', 'course_id');

$completedLessons = DB::table('lesson_completions')
    ->join('lessons', 'lesson_completions.lesson_id', '=', 'lessons.id')
    ->join('modules', 'lessons.module_id', '=', 'modules.id')
    ->where('lesson_completions.student_id', $studentId)
    ->where('lessons.is_published', true)
    ->whereIn('modules.course_id', $courseIds)
    ->selectRaw('modules.course_id, COUNT(*) as count')
    ->groupBy('modules.course_id')
    ->pluck('count', 'course_id');

$completedQuizzes = DB::table('quiz_attempts')
    ->join('quizzes', 'quiz_attempts.quiz_id', '=', 'quizzes.id')
    ->join('modules', 'quizzes.module_id', '=', 'modules.id')
    ->where('quiz_attempts.student_id', $studentId)
    ->where('quiz_attempts.status', 'completed')
    ->where('quizzes.is_published', true)
    ->whereIn('modules.course_id', $courseIds)
    ->whereColumn('quiz_attempts.total_score', '>=', 'quizzes.passing_score')
    ->selectRaw('modules.course_id, COUNT(*) as count')
    ->groupBy('modules.course_id')
    ->pluck('count', 'course_id');

// Now just map the pre-computed values
foreach ($classroom->courses as $course) {
    $total = ($lessonCounts[$course->id] ?? 0) + ($quizCounts[$course->id] ?? 0);
    $done = ($completedLessons[$course->id] ?? 0) + ($completedQuizzes[$course->id] ?? 0);
    $course->progress_percent = $total > 0 ? (int) round(($done / $total) * 100) : 0;
}
```

**What changed:** Instead of 4 queries per course (20 queries for 5 courses), we run 4 queries TOTAL, once. The data is then mapped in memory.

---

## Part 6: Frontend Caching (Auth + Sidebar)

### Step 6.1: Cache User Data

**File:** `frontend/src/context/AuthContext.jsx`

Replace the `loadUser` function:

```javascript
useEffect(() => {
    const loadUser = async () => {
        if (token) {
            // Check sessionStorage first
            const cached = sessionStorage.getItem('user');
            if (cached) {
                try {
                    const userData = JSON.parse(cached);
                    setUser(userData);
                    setRole(userData.role);
                    setLoading(false);
                    return;
                } catch (e) {
                    // Invalid cache, fall through to fetch
                }
            }

            try {
                const res = await api.get('/user', { bypassCache: true });
                sessionStorage.setItem('user', JSON.stringify(res.data));
                setUser(res.data);
                setRole(res.data.role);
            } catch (err) {
                console.error("Session expired");
                logout();
            }
        }
        setLoading(false);
    };
    loadUser();
}, [token]);
```

Also add to the `login` function to store user data:

```javascript
const login = (userData, userToken, userRole) => {
    setUser(userData);
    setToken(userToken);
    setRole(userRole);
    localStorage.setItem('token', userToken);
    localStorage.setItem('role', userRole);
    sessionStorage.setItem('user', JSON.stringify(userData)); // Add this
};
```

And to `logout`:

```javascript
const logout = () => {
    setUser(null);
    setToken(null);
    setRole(null);
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    sessionStorage.removeItem('user'); // Add this
    cache.clear();
};
```

### Step 6.2: Cache Sidebar Class List

**File:** `frontend/src/components/layouts/StudentLayout.jsx`

Replace the `fetchClasses` function:

```javascript
const fetchClasses = async () => {
    const cacheKey = 'sidebar:student:classes';
    const cached = cache.get(cacheKey);
    if (cached) {
        setClasses(cached);
        return;
    }

    setLoading(true);
    try {
        const res = await api.get('/student/classes');
        cache.set(cacheKey, res.data);
        setClasses(res.data);
    } finally {
        setLoading(false);
    }
};
```

**Do the same for `TeacherLayout.jsx`** if it has a similar sidebar.

Invalidate the cache when the user joins a class (in `JoinClassModal.jsx` on success):

```javascript
// After successful join:
cache.invalidatePattern('sidebar:student:classes');
```

---

## Part 7: Fix the Analytics N+1

**File:** `app/Http/Controllers/Teacher/AnalyticsController.php`

Find the `getContentEngagement()` method (around line 191). Replace the per-lesson loop with batch queries:

**Before:**
```php
foreach ($courseItems['all_lessons'] as $lesson) {
    $completions = LessonCompletion::where('lesson_id', $lesson->id)
        ->whereIn('student_id', $enrolledStudentIds)->count();
    $codeAttempts = CodeSubmission::where('lesson_id', $lesson->id)
        ->whereIn('student_id', $enrolledStudentIds)->count();
```

**After:**
```php
$lessonIds = $courseItems['all_lessons']->pluck('id');

$completionCounts = LessonCompletion::whereIn('lesson_id', $lessonIds)
    ->whereIn('student_id', $enrolledStudentIds)
    ->selectRaw('lesson_id, COUNT(*) as count')
    ->groupBy('lesson_id')
    ->pluck('count', 'lesson_id');

$codeAttemptCounts = CodeSubmission::whereIn('lesson_id', $lessonIds)
    ->whereIn('student_id', $enrolledStudentIds)
    ->selectRaw('lesson_id, COUNT(*) as count')
    ->groupBy('lesson_id')
    ->pluck('count', 'lesson_id');

foreach ($courseItems['all_lessons'] as $lesson) {
    $completions = $completionCounts[$lesson->id] ?? 0;
    $codeAttempts = $codeAttemptCounts[$lesson->id] ?? 0;
```

---

## Part 8: Fix the Reorder N+1 (Teacher Drag-and-Drop)

### File: `app/Http/Controllers/Teacher/ModuleController.php`

Find `reorderItems()` (around line 51). Replace the loop:

**Before:**
```php
foreach ($items as $index => $item) {
    if ($item['itemType'] === 'lesson') {
        DB::table('lessons')->where('id', $item['id'])->update(['order_index' => $index + 1]);
    } elseif ($item['itemType'] === 'quiz') {
        DB::table('quizzes')->where('id', $item['id'])->update(['order_index' => $index + 1]);
    }
}
```

**After:**
```php
DB::transaction(function () use ($items) {
    foreach ($items as $index => $item) {
        $table = $item['itemType'] === 'lesson' ? 'lessons' : 'quizzes';
        DB::table($table)->where('id', $item['id'])->update(['order_index' => $index + 1]);
    }
});
```

(The transaction wraps all updates together so they're sent to the DB in one batch instead of waiting for each one to finish.)

Do the same for `reorderModules()` (around line 99) and `QuestionController::reorder()`.

---

## Step 9: Request Timing Middleware (For visibility)

This tells you how long **every** API request takes, so you always know what's slow.

**Create** `app/Http/Middleware/RequestTiming.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class RequestTiming
{
    public function handle(Request $request, Closure $next): Response
    {
        $start = microtime(true);
        $startQueries = \DB::getQueryLog();
        \DB::enableQueryLog();

        $response = $next($request);

        $duration = (int)((microtime(true) - $start) * 1000);
        $queryLog = \DB::getQueryLog();
        $queryCount = count($queryLog);
        $totalDbTime = (int)collect($queryLog)->sum('time');

        // Only log if it took more than 500ms
        if ($duration > 500) {
            Log::info("Request timing", [
                'method' => $request->method(),
                'url' => $request->path(),
                'status' => $response->getStatusCode(),
                'duration_ms' => $duration,
                'db_queries' => $queryCount,
                'db_time_ms' => $totalDbTime,
            ]);
        }

        return $response;
    }
}
```

**Register it** in `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->api(prepend: [
        \App\Http\Middleware\RequestTiming::class,
    ]);
})
```

Now check `storage/logs/laravel.log` — you'll see entries like:

```
[2026-06-23] local.INFO: Request timing {"method":"GET","url":"api/student/quizzes/199","status":200,"duration_ms":3490,"db_queries":23,"db_time_ms":1800}
```

This tells you **exactly** which endpoints are slow, how many queries they make, and how much time is spent in the database.

---

## Quick Reference: What to Do During Implementation

When I guide you, here's what to expect:

| Step | What I'll Ask You | What You'll See |
|------|-------------------|-----------------|
| 1 | "Run this artisan command" | Migration file created |
| 2 | "Paste this code into the file" | Indexes added |
| 3 | "Run migrate" | Indexes created in DB |
| 4 | "Open this page in your browser" | Debugbar at bottom |
| 5 | "Try loading the quiz page" | Error or debugbar showing fewer queries |
| 6 | "Paste this fix into the controller" | Page loads faster |
| 7 | "Check debugbar again" | Query count dropped |

The key thing to watch: **the Debugbar query count**. Before each fix, note the number. After the fix, it should be significantly lower.
