<?php
namespace App\Http\Controllers\Student;
use App\Http\Controllers\Controller;
use App\Models\Classroom;
use App\Models\Enrollment;
use Illuminate\Http\Request;
class EnrollmentController extends Controller
{
// List classes the student is enrolled in
    public function index(Request $request)
    {
        $studentId = $request->user()->id;
        $classes = $request->user()->classes()
            ->with('teacher.teacherProfile')
            ->withCount('courses')
            ->get();

        // Attach progress to each class for the Overview/Sidebar
        foreach ($classes as $class) {
            // 1. Get all published item IDs (Lessons + Quizzes) in this class
            $itemIds = \App\Models\Lesson::whereIn('module_id', function($q) use ($class) {
                    $q->select('id')->from('modules')->whereIn('course_id', function($sq) use ($class) {
                        $sq->select('id')->from('courses')->where('class_id', $class->id);
                    });
                })->where('is_published', true)->pluck('id');

            if ($itemIds->count() > 0) {
                $doneCount = \App\Models\LessonCompletion::where('student_id', $studentId)
                    ->whereIn('lesson_id', $itemIds)->count();
                $class->progress_percent = round(($doneCount / $itemIds->count()) * 100);
            } else {
                $class->progress_percent = 0;
            }
        }

        return response()->json($classes);
    }

    // Join a class using a code
    public function enroll(Request $request)
    {
        $request->validate(['class_code' => 'required|string']);

        // Find the class
        $classroom = Classroom::where('class_code', strtoupper($request->class_code))->first();

        if (!$classroom) {
            return response()->json(['message' => 'Invalid class code.'], 404);
        }

        // Check if already enrolled
        $exists = Enrollment::where('student_id', $request->user()->id)
                            ->where('class_id', $classroom->id)
                            ->exists();

        if ($exists) {
            return response()->json(['message' => 'You are already enrolled in this class.'], 400);
        }

        // Enroll
        Enrollment::create([
            'student_id' => $request->user()->id,
            'class_id' => $classroom->id
        ]);

        return response()->json(['message' => 'Successfully joined class!', 'class' => $classroom], 200);
    }
}