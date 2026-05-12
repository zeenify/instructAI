# Code-Based Challenge Verification for AI-Generated Content

## Problem

When AI generates coding challenges (whole Java programs, not functions), students can hardcode expected output:
```java
System.out.println("1");
System.out.println("2");
System.out.println("3");
// ... vs actual loop logic
```

Both produce identical output, but only one demonstrates understanding.

## Why Existing Solutions Don't Work

- **Multiple test cases**: Requires stdin support (execution engine doesn't have it yet)
- **Line count constraints**: Can write `for(int i=1;i<=5;i++) System.out.println(i);` in 1 line
- **Rigid "must contain"**: `System.out.print(i + "\n")` is valid but differs from `System.out.println(i)`

## Solution: Required Elements as Alternatives + Forbidden Patterns

Generate verification rules per challenge that allow flexibility while catching hardcoding.

### Data Structure

```json
{
  "content_type": "practice",
  "challenge": "Print numbers 1 to 5 using a loop",
  "starter_code": "...",
  "expected_output": "1\n2\n3\n4\n5",
  "verification": {
    "required_elements": [
      {
        "category": "loop_construct",
        "options": ["for", "while", "do while"],
        "reason": "Must iterate to print multiple numbers"
      },
      {
        "category": "output_method",
        "options": ["System.out.println", "System.out.print"],
        "reason": "Must output each number"
      }
    ],
    "forbidden_patterns": [
      "System.out.println(\"1\")",
      "System.out.println(\"1\\n2\\n3\\n4\\n5\")",
      "System.out.print(\"1\\n2\\n3\\n4\\n5\")"
    ]
  },
  "success_criteria": "Code contains a loop, outputs each number, no hardcoded strings"
}
```

## Validation Logic

**In QuizController.php (coding question submission):**

```php
$isCorrect = false;

// 1. Check output matches
if ($output !== $expected) {
    $isCorrect = false;
} else {
    // 2. Check code meets requirements
    $requirements_met = true;
    
    // For each required element category, check if code contains at least one option
    foreach ($verification['required_elements'] as $requirement) {
        $has_option = false;
        foreach ($requirement['options'] as $option) {
            if (strpos($code, $option) !== false) {
                $has_option = true;
                break;
            }
        }
        if (!$has_option) {
            $requirements_met = false;
            break;
        }
    }
    
    // 3. Check no forbidden patterns
    $no_forbidden = true;
    foreach ($verification['forbidden_patterns'] as $pattern) {
        if (strpos($code, $pattern) !== false) {
            $no_forbidden = false;
            break;
        }
    }
    
    $isCorrect = $requirements_met && $no_forbidden;
}
```

## Changes Required

### 1. Stage 2 Content Generation (`instruct-ai-service/prompts/stage2_content_prompts.py`)

**In practice section for programming:**
- Add instruction to AI: "Generate `verification` object with required elements and forbidden patterns"
- AI should identify what code structure is necessary for the problem
- AI should generate realistic hardcoding patterns to forbid

Example prompt addition:
```
VERIFICATION REQUIREMENTS:
For each challenge, generate a "verification" object:
- required_elements: Array of {category, options[], reason}
  * Each category must have 2-4 valid alternatives
  * Examples: loop_construct, output_method, condition_check
- forbidden_patterns: Hardcoded strings/outputs student might use
  * Don't be too strict - only pattern-match obvious cheating
  * Think: What would hardcoding this problem look like?

Example:
{
  "category": "loop_construct",
  "options": ["for", "while", "do"],
  "reason": "Must use iteration"
}
```

### 2. Backend Validation (`backend/app/Http/Controllers/Student/QuizController.php`)

**In the coding question check (around line 242-260):**
- Extract `verification` object from question
- Add verification checks before marking correct
- Log which checks passed/failed for debugging

```php
elseif ($question->type === 'coding') {
    // ... existing output check ...
    
    if ($output === $expected && $expected !== "") {
        // New: Check code meets verification requirements
        $verification = json_decode($question->verification_rules ?? '{}', true);
        
        if (!empty($verification)) {
            $isCorrect = validateCodeStructure($code, $verification);
        } else {
            $isCorrect = true; // Fallback if no verification rules
        }
    }
}

function validateCodeStructure($code, $verification) {
    // Check required elements
    foreach ($verification['required_elements'] ?? [] as $req) {
        $has_option = false;
        foreach ($req['options'] ?? [] as $option) {
            if (strpos($code, $option) !== false) {
                $has_option = true;
                break;
            }
        }
        if (!$has_option) return false;
    }
    
    // Check forbidden patterns
    foreach ($verification['forbidden_patterns'] ?? [] as $pattern) {
        if (strpos($code, $pattern) !== false) return false;
    }
    
    return true;
}
```

### 3. Database Schema (if needed)

**Questions table** - may already have a column:
- Add `verification_rules` (JSON) if doesn't exist
- Or store in `expected_output` alongside output (parse as JSON)

Migration:
```php
Schema::table('questions', function (Blueprint $table) {
    $table->json('verification_rules')->nullable()->after('expected_output');
});
```

## Implementation Checklist

- [ ] Update Stage 2 prompt to generate `verification` object
- [ ] Test AI generates reasonable required_elements and forbidden_patterns
- [ ] Add `verification_rules` column to questions table (if needed)
- [ ] Implement `validateCodeStructure()` in QuizController
- [ ] Update code checking logic to call validation
- [ ] Add logging for what checks pass/fail
- [ ] Test with sample challenges:
  - [ ] Hardcoded output → rejected ✓
  - [ ] Valid loop → accepted ✓
  - [ ] Alternative output method (print vs println) → accepted ✓
  - [ ] Correct output but missing loop → rejected ✓

## Edge Cases to Handle

1. **Case sensitivity** - `for` vs `For` (Java is case-sensitive, use exact match)
2. **Whitespace** - `for(...)` vs `for (...)` - use `strpos()` which ignores whitespace variations naturally
3. **Comments** - Code might have loop in comment → need to strip comments before checking
4. **String literals** - `"for"` inside a string isn't a loop → might need regex instead of `strpos()`

## Future Enhancements

- **Smarter pattern matching**: Use AST parsing instead of string matching
- **Stdin support**: Once execution engine supports input, add multi-test-case support
- **AI review fallback**: If verification fails but output matches, optionally call AI: "Is this approach acceptable?"

## Why This Works

✅ Catches obvious hardcoding (forbidden_patterns)
✅ Allows flexibility in implementation (options within categories)
✅ Scalable for AI-generated content (AI generates what's required)
✅ No extra API costs (runs locally)
✅ No stdin/execution engine changes needed
✅ Aligns with your system (whole Java programs, not functions)
