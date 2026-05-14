---
name: AI Generation Preview & Edit Flow
description: Teacher review workflow after AI generates lessons/quizzes with code validation
date: 2026-05-13
---

# AI Generation Preview & Edit Flow

## Problem
AI-generated code sometimes has errors. Instead of trying to make perfect AI, let teachers review and edit before publishing.

## Solution
After AI finishes generating, show full editor (reuse LessonEditor/QuizBuilder) with code validation indicators. Teacher can edit freely before approving.

## Flow

**1. Generation Complete**
- AI finishes generating lesson/quiz
- Set status to `ai_draft` (unpublishable)
- Show "Preview & Edit" button

**2. Preview & Edit Screen**
- Load full LessonEditor or QuizBuilder UI (same as manual creation)
- Teacher sees: headings, paragraphs, videos, code blocks, quizzes - all editable
- Teacher can reorder, delete, add components

**3. Code Validation**
- After generation, run all code blocks
- Execute each code with 30-second timeout
- Store results: `{block_id, runs: boolean, error: string}`
- Display indicators: 🟢 (runs) or 🔴 (error) next to each code block
- Teacher can click "Test" on any code to verify

**4. Teacher Actions**
- Edit anything
- Test code blocks
- Fix errors or leave intentionally broken (for "fix syntax" challenges)
- Click Approve & Publish

## Implementation Steps

### 1. Backend

**Add to lessons table:**
```php
// Migration
Schema::table('lessons', function (Blueprint $table) {
    $table->enum('generation_status', ['published', 'ai_draft'])->default('published')->after('title');
});

// Same for quizzes
Schema::table('quizzes', function (Blueprint $table) {
    $table->enum('generation_status', ['published', 'ai_draft'])->default('published')->after('title');
});
```

**Create validation endpoint:**
```
POST /teacher/lessons/{id}/validate-codes
- Execute all code blocks in lesson
- Return: [{block_id, runs: bool, error: string}]
- 30-second timeout per block
```

**Modify publish logic:**
- Check `generation_status != 'ai_draft'` before allowing publish

### 2. Frontend

**After AI generation completes:**
- Redirect to LessonEditor/QuizBuilder (existing components)
- Pass `draft: true` flag
- Fetch code validation results from backend
- Display 🟢/🔴 indicators on code blocks

**UI additions:**
- "Test Code" button on each code block (calls `/student/execute`)
- Status indicator showing code runs/fails
- Error message tooltip
- "Approve & Publish" button (instead of regular save)

### 3. Code Validation

```php
// In new CodeValidationService or similar
public function validateLessonCodes($lessonId)
{
    $lesson = Lesson::find($lessonId);
    $results = [];
    
    foreach ($lesson->content as $block) {
        if ($block['type'] === 'code') {
            try {
                $response = Http::timeout(30)->post(EXECUTION_ENGINE_URL, [
                    'language' => 'java',
                    'code' => $block['data']['code']
                ]);
                
                $runs = !$response->json()['compile_output'] && !$response->json()['stderr'];
                $error = $response->json()['compile_output'] ?? $response->json()['stderr'];
                
                $results[] = [
                    'block_id' => $block['id'],
                    'runs' => $runs,
                    'error' => $error
                ];
            } catch (Exception $e) {
                $results[] = [
                    'block_id' => $block['id'],
                    'runs' => false,
                    'error' => 'Execution timeout or service unavailable'
                ];
            }
        }
    }
    
    return $results;
}
```

## Benefits
- ✅ Catches broken code before students see it
- ✅ Teachers fix typos/errors in 30 seconds
- ✅ Handles "intentional errors" naturally (fix syntax challenges)
- ✅ No extra AI API calls
- ✅ Reuses existing LessonEditor/QuizBuilder components
- ✅ AI becomes a drafting tool, not a perfect solution
- ✅ Teachers have full control over final content

## Notes
- Don't overcomplicate: literally just use existing editors with a draft flag
- Code validation runs after generation, stores results, displays on UI
- Teacher can test individual code blocks before publishing
- Intentional errors (for challenges) stay red - teacher sees and keeps them
