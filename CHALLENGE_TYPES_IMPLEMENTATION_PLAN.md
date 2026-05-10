# Challenge Types Implementation Plan

## Overview
Currently, the system only supports **Coding Challenges** in lessons. This plan outlines the implementation of non-coding challenge types for visual/design/non-technical courses where `is_coding=false`.

**Important**: Lesson challenges are **NOT** scored or tracked. They're inline practice/feedback mechanisms within the lesson. Students get immediate feedback (correct/incorrect) but no scores are recorded. This is different from quizzes which track attempts and scores.

---

## Challenge Types to Implement

### Recommended (High Priority)

#### 1. **Multiple Choice Challenge**
- **Description**: Select one correct answer from 3-4 options
- **Use Case**: Perfect for design, art, business courses
- **Pros**: 
  - Clear grading (auto-gradable)
  - Students can verify understanding
  - Prevents random guessing (unlike T/F)
- **Cons**: 
  - AI needs to generate good distractors
  - More AI tokens per question
- **Auto-Gradable**: ✅ Yes

#### 2. **Identification Challenge**
- **Description**: Identify/label elements in content (e.g., design principles, anatomy, parts of diagram)
- **Use Case**: Design (identify design elements), anatomy, architecture
- **Pros**:
  - Practical application of concepts
  - Students must recognize, not just recall
  - Flexible grading (accept variations)
- **Cons**:
  - Requires structured answer format
  - May need manual verification for variations
  - Complex string matching logic
- **Auto-Gradable**: ⚠️ Partial (fuzzy matching for synonyms)

#### 3. **Enumeration Challenge**
- **Description**: List N items that fit criteria (e.g., "List 3 principles of good design")
- **Use Case**: Recall exercises, comprehensive understanding
- **Pros**:
  - Prevents single lucky guess
  - Tests depth of knowledge
  - Flexible (accepts synonyms/variations)
- **Cons**:
  - Hard to auto-grade (needs fuzzy matching)
  - Student frustration with exact wording
- **Auto-Gradable**: ⚠️ Partial (fuzzy matching required)

#### 4. **Ordering/Sequencing Challenge**
- **Description**: Put steps/elements in correct order (e.g., design process steps)
- **Use Case**: Procedural knowledge, workflows, design processes
- **Pros**:
  - Tests procedural understanding
  - Clear right/wrong answer
  - Engaging interaction
- **Cons**:
  - Requires UI drag-drop component
  - Must handle partial credit logic
- **Auto-Gradable**: ✅ Yes

### Not Recommended (Skip for Now)

#### ❌ **True/False Challenge**
- **Reason**: Too easy to guess (50% chance). Students can reset and retry randomly.
- **Alternative**: Use Multiple Choice instead with more rigorous options

#### ❌ **Short Answer**
- **Reason**: Requires manual grading. Can't auto-grade effectively.
- **Future**: Implement only after AI-powered auto-grading is added

#### ❌ **Matching**
- **Reason**: Complex UI implementation. Better to start with simpler types.
- **Future**: Consider after foundational types are stable

---

## Implementation Roadmap

### Phase 1: Foundation (MC only)
1. Add `challenge_type` column to database
2. Update challenge/question schema
3. Implement UI components for challenge creation
4. Add prompt templates for MC generation
5. Update lesson renderer to display MC challenges
6. Test end-to-end

### Phase 2: Expand (Add Identification + Ordering)
1. Extend database schema to support different answer formats
2. Create UI components for each type
3. Add type-specific prompts
4. Implement grading logic
5. Update lesson renderer

### Phase 3: Advanced (Add Enumeration with fuzzy matching)
1. Implement fuzzy string matching library
2. Handle synonym recognition
3. Add partial credit logic
4. Create grading UI for instructors

---

## System Changes Required

### Database
- [ ] Add `challenge_type` enum column to lesson blocks table
- [ ] Extend block `data` JSON to support:
  - `type`: 'challenge'
  - `challenge_type`: 'mc' | 'identification' | 'ordering' | 'enumeration'
  - `challenge_data`: 
    - For MC: `{ options: [...], correct_answer: 0 }`
    - For Identification: `{ correct_answers: [...] }`
    - For Ordering: `{ correct_order: [...] }`
    - For Enumeration: `{ correct_items: [...], item_count: n }`
- **No new tables needed** - reuse existing lesson block structure

### Backend API
- [ ] Create `POST /student/lessons/{id}/challenge-submit` endpoint (no score recording)
- [ ] Response: `{ correct: boolean, feedback: string, explanation?: string }`
- [ ] Add validation/grading logic for each type:
  - `validateMC(answer, correctAnswer)` - simple index match
  - `validateIdentification(answer, correctAnswers)` - fuzzy match
  - `validateOrdering(answer, correctOrder)` - array comparison
  - `validateEnumeration(answers, correctItems)` - subset fuzzy match
- **No grading engines** - just return correct/incorrect with optional explanation

### AI Service
- [ ] Create type-specific prompt templates
- [ ] Update Stage 2 to generate varied challenge types
- [ ] Add validation for generated challenges
- [ ] Handle `is_coding=false` → restrict to non-coding types

### Frontend
- [ ] Create challenge type selector in LessonEditor
- [ ] Build UI components for each challenge type:
  - `MCChallengeDisplay` (radio buttons)
  - `IdentificationChallengeDisplay` (text input)
  - `OrderingChallengeDisplay` (drag-drop or ranking)
  - `EnumerationChallengeDisplay` (textarea with item list)
- [ ] Update LessonRenderer to handle new types

### Prompts
- [ ] Update Stage 2 content prompts to generate mixed challenge types
- [ ] Add constraints for non-coding courses:
  - When `is_coding=false`: Only use MC, Identification, Ordering, Enumeration
  - Never generate Coding Challenges

---

## Breaking Changes to Plan For

### Lesson Renderer
- **Current**: Only knows about Coding Challenges
- **Impact**: Will crash on unknown challenge types
- **Fix**: Add type switch/conditional rendering
- **Timeline**: Must be done before Phase 1 deployment

### Challenge Submit Endpoint
- **Current**: Only `POST /student/execute` for code execution
- **New**: Add `POST /student/lessons/{id}/challenge-submit` for lesson challenges
- **Simplification**: No score tracking, just immediate feedback
- **Timeline**: Must be done before Phase 1 deployment

### Challenge Display in Lesson Renderer
- **Current**: Only shows coding challenges with execute button
- **New**: Show different UI per type:
  - MC: Radio buttons + submit button
  - Identification: Text input + submit button
  - Ordering: Drag-and-drop list + submit button
  - Enumeration: Text area (comma/line separated) + submit button
- **Timeline**: Must be done before Phase 1 deployment

---

## Prompt Considerations

### Stage 1 (Outline)
- Already configured to not suggest "practice" sections when `is_coding=false`
- ✅ No changes needed

### Stage 2 (Content Generation)
- Currently excludes challenge blocks when `is_coding=false`
- **Need to change**: Allow MC/Identification/Ordering/Enumeration challenges
- **Change location**: `prompts/stage2_content_prompts.py`
- **New logic**:
  ```
  if not needs_code:
      - NO coding challenges
      - NO ordering challenges (not practical for design)
      - YES MC, Identification, Enumeration challenges
  ```

### Stage 3 (Formatting)
- Need to format challenges into block structure
- Already handles text/code/video/image blocks
- **Add**: `challenge` block type with `challenge_type` property

---

## Suggested Implementation Order

1. **First**: Multiple Choice (simplest, highest ROI)
   - Trivial validation (index match)
   - AI can generate easily
   - Minimal UI complexity (radio buttons)
   - Estimated effort: 1-2 days

2. **Second**: Identification (practical value)
   - Design courses need this
   - Fuzzy matching adds value but simple
   - Text input UI
   - Estimated effort: 1-2 days

3. **Third**: Ordering (procedural knowledge)
   - Good for design processes
   - Requires drag-drop UI component
   - Simple array validation
   - Estimated effort: 1-2 days

4. **Fourth**: Enumeration (comprehensive assessment)
   - Lower priority initially
   - Fuzzy subset matching
   - Textarea UI with item list
   - Estimated effort: 1 day

---

## Risk Assessment

### High Risk
- ❌ Breaking lesson renderer if not updated first
- ❌ Fuzzy matching creating false positives in grading
- ❌ AI generating poorly designed challenges

### Medium Risk
- ⚠️ Database migration complexity
- ⚠️ Student UX confusion with new types

### Low Risk
- ✅ Backend API changes (contained)
- ✅ Prompt updates (safe with constraints)

---

## Success Criteria

- [ ] Design course generates MC challenges instead of coding challenges
- [ ] Student can complete MC challenges in lesson renderer
- [ ] MC answers show correct/incorrect feedback
- [ ] No score recording or tracking (students can retry freely)
- [ ] AI generates varied, relevant challenge questions
- [ ] All 4 challenge types display and validate correctly
- [ ] No regression in lesson/quiz functionality

---

## Notes for Future Sessions

- Lesson challenges are **practice/feedback only**, not assessments
- Students can retry challenges unlimited times without penalty
- Consider adding "explanation" field for wrong answers (optional)
- UI/UX: Make challenges engaging with immediate visual feedback
- Consider future: Challenge completion rate analytics (for teachers)
- Don't confuse with Quiz system - keep these completely separate
- Could eventually add challenge difficulty hints if needed
- Future enhancement: Track challenge attempts locally (client-side only for UX)
