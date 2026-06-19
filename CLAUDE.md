# CLAUDE.md
This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

InstructAI is a full-stack Learning Management System (LMS) with AI-powered curriculum generation, RAG-based AI tutor, student analytics/monitoring, and code execution engine. Built with **Laravel 12 (PHP 8.2)** backend, **React 19 + Vite** frontend, and a **FastAPI v2.0.0** microservice for AI features.

## Architecture

### Content Hierarchy
```
Classroom (teacher creates, students join via 6-digit code)
  └─ Course (multiple per class, has is_published, is_coding, order_index)
      └─ Module (ordered collection)
          └─ Lesson | Quiz (ordered items within module)
```

**Key relationships:**
- `Classroom` → owned by teacher, students enroll via `class_code`
- `Course` → belongs to classroom, contains modules, tracks `is_published`, `is_coding`, `order_index`
- `Module` → belongs to course, contains lessons/quizzes ordered by `order_index`
- `Lesson` → rich text editor content using TipTap, stored as JSON blocks, can include code snippets
- `Quiz` → contains questions, `timer_mode` ("none" | "per_question" | "entire_quiz"), `question_limit` for random subset

### Additional Systems
- **Analytics Engine**: Per-class/per-course analytics (overview stats, performance trends, quiz scores, content engagement)
- **Student Monitoring**: Teacher drill-down into student progress per course (stats, flags, profiles)
- **RAG Vector Store**: PostgreSQL pgvector for semantic search across course content (embeddings via `all-MiniLM-L6-v2`)
- **AI Tutor**: 4 character personas (Professor Oak, Buddy, Coach Taylor, Master Yuki) with RAG-powered chat
- **Code Execution**: External Node.js service for compiling/running Java code with 10s timeout
- **Curriculum Indexing**: Searchable index of course content for the AI tutor's RAG pipeline

### User Roles
- **Teacher**: Creates classes, courses, modules, lessons, quizzes. Can generate curriculum via AI. Views analytics and student monitoring.
- **Student**: Enrolls in classes via code, views published content, takes quizzes, submits code, chats with AI tutor.

## Data Models

All models in `backend/app/Models/`:

| Model | Table | Key Fields |
|-------|-------|-----------|
| **User** | `users` | email, password, role (teacher\|student), google_id, avatar |
| **TeacherProfile** | `teacher_profiles` | user_id, first_name, last_name, organization |
| **StudentProfile** | `student_profiles` | user_id, first_name, last_name |
| **Classroom** | `classes` | teacher_id, name, class_code (6-digit), description |
| **Course** | `courses` | teacher_id, class_id, title, description, curriculum_file_url, curriculum_text, is_published, is_coding, order_index |
| **Module** | `modules` | course_id, title, order_index, is_published |
| **Lesson** | `lessons` | module_id, title, content (JSON), order_index, is_published, ai_enabled |
| **Quiz** | `quizzes` | module_id, title, is_randomized, ai_enabled, time_limit_minutes, order_index, passing_score, is_published, timer_mode, question_limit |
| **Question** | `questions` | quiz_id, type (multiple_choice\|true_false\|identification\|enumeration\|coding\|short_answer), question_text, options (JSON), expected_output, points, boilerplate, order_index |
| **Enrollment** | `enrollments` | student_id, class_id, enrolled_at |
| **LessonCompletion** | `lesson_completions` | student_id, lesson_id, completed_at |
| **QuizAttempt** | `quiz_attempts` | student_id, quiz_id, status, total_score, max_score, finished_at |
| **StudentAnswer** | `student_answers` | attempt_id, question_id, submitted_answer, is_correct, answered_at |
| **CodeSubmission** | `code_submissions` | student_id, lesson_id, block_id, code, output, submitted_at |
| **AiChatLog** | `ai_chat_logs` | student_id, class_id, character_name, lesson_id, quiz_id, message, sender, mode, context_metadata |
| **DocumentChunk** | `document_chunks` | class_id, course_id, lesson_id, chunk_text, embedding (vector(384)), metadata |
| **Notification** | `notifications` | user_id, type, message, is_read |

## Database

- **Default**: PostgreSQL with pgvector extension (for RAG embeddings, 384-dim)
- Can fall back to SQLite for local dev via `.env`
- 23 migrations total

## Development Commands

### Initial Setup
```bash
# Backend setup
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate

# Frontend setup
cd frontend
npm install

# AI service setup
cd instruct-ai-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Code execution engine setup
cd instruct-execute
npm install
```

### Running Development Servers
```bash
# All-in-one dev environment (from backend/)
composer run dev
# Runs: artisan serve (8000) + queue:listen + pail (logs) + npm run dev (5173)

# Or run individually:
cd backend && php artisan serve              # Laravel API on :8000
cd backend && php artisan queue:work         # Queue worker
cd frontend && npm run dev                   # Vite dev server on :5173
cd instruct-ai-service && python main.py     # AI service on :8001
cd instruct-execute && npm start             # Code execution on :3000
```

### Database
```bash
php artisan migrate                          # Run migrations
php artisan migrate:fresh --seed             # Fresh database with seeding
php artisan make:migration create_table_name # Create migration
php artisan migrate:rollback                 # Rollback last migration
php artisan curriculum:extract {course_id?}  # Re-extract text from curriculum files
```

### Testing
```bash
composer run test              # Run all tests
php artisan test tests/Feature/CourseTest.php  # Specific test file
php artisan test --coverage    # With coverage
```

### Code Quality
```bash
vendor/bin/pint                              # Laravel Pint (PSR-12 formatting)
cd frontend && npm run lint                  # ESLint
cd frontend && npm run format                # Prettier formatting
cd frontend && npm run format:check          # Prettier check
```

## Key Files and Locations

### Backend Structure
- **Routes**: `backend/routes/api.php` — 50+ endpoints with `/teacher/*` and `/student/*` prefixes
- **Controllers** (18 total):
  - `App\Http\Controllers\Teacher\ClassroomController` — CRUD classrooms
  - `App\Http\Controllers\Teacher\CourseController` — Courses + AI generation (774 lines)
  - `App\Http\Controllers\Teacher\ModuleController` — Modules + reordering
  - `App\Http\Controllers\Teacher\LessonController` — Lessons + image upload (Cloudinary)
  - `App\Http\Controllers\Teacher\QuizController` — Quiz CRUD
  - `App\Http\Controllers\Teacher\QuestionController` — Questions + reorder
  - `App\Http\Controllers\Teacher\IndexingController` — Vector indexing/RAG for courses/lessons
  - `App\Http\Controllers\Teacher\StudentMonitorController` — Student progress monitoring
  - `App\Http\Controllers\Teacher\AnalyticsController` — Course analytics
  - `App\Http\Controllers\Student\EnrollmentController` — Enroll via code
  - `App\Http\Controllers\Student\CourseController` — View class/course with progress
  - `App\Http\Controllers\Student\LessonController` — View lessons, mark complete, submit code
  - `App\Http\Controllers\Student\QuizController` — Take quizzes, submit, AI-grade answers
  - `App\Http\Controllers\Student\CodeExecutionController` — Code execution proxy + AI challenge verification
  - `App\Http\Controllers\Student\AIChatController` — AI tutor chat
  - `App\Http\Controllers\AuthController` — Register (teacher/student), login, Google OAuth
  - `App\Http\Controllers\ChatController` — Landing page chatbot
- **Models**: `backend/app/Models/` — 17 models with Eloquent relationships
- **Migrations**: `backend/database/migrations/` — 23 migrations (order matters)
- **Console**: `Console\Commands\ExtractCurriculumText.php` — `php artisan curriculum:extract`
- **Config**: `config/database.php` (pgsql default), `config/services.php` (groq keys), `config/cloudinary.php`, `config/cors.php`

### Frontend Structure
- **Entry**: `frontend/src/main.jsx` → wraps with `GoogleOAuthProvider` + `ThemeProvider` + `AuthProvider`
- **Routing**: `frontend/src/App.jsx` — React Router v7 with nested layouts, protected routes
- **Layouts**:
  - `TeacherLayout.jsx` — Persistent sidebar with class list, nav (Overview, Analytics, Monitor), theme toggle
  - `StudentLayout.jsx` — Persistent sidebar with enrolled classes, join class modal, theme toggle
- **Teacher Pages** (`pages/teacher/`):
  - `TeacherOverview.jsx` — Dashboard home with stats cards, class grid
  - `CreateClass.jsx`, `ClassDetails.jsx` — Class management
  - `CreateCourseModal.jsx` — Course creation with optional file upload
  - `CourseBuilder.jsx` (1687 lines) — Full course builder with modules, AI generation, reordering, publishing
  - `LessonEditor.jsx` — TipTap rich text editor with blocks (text, code, image, video, link)
  - `QuizBuilder.jsx` — Quiz builder with draggable questions, timer modes, question types
  - `AiArchitectModal.jsx` — AI prompt modal with structure parameters
  - `ContentGenerationModal.jsx` — Preview AI-generated modules/lessons/quizzes
  - `ContentParametersModal.jsx` — Content settings (depth, style, media, question distribution)
  - `CurriculumReviewModal.jsx` — Review/accept/regenerate AI curriculum
  - `GenerationConsole.jsx` — Terminal-style AI generation progress log
  - `Analytics.jsx` — Full analytics page with charts (performance trends, quiz scores, content engagement)
  - `StudentMonitor.jsx` — Student progress monitor with class/course/student drill-down
  - `StudentProfileDetail.jsx` — Deep-dive into individual student
- **Student Pages** (`pages/student/`):
  - `StudentOverview.jsx` — Dashboard with class workspace cards
  - `Classview.jsx` — Class detail with course grid
  - `CourseViewer.jsx` — Focus-mode course viewer with timeline sidebar, lock/unlock progression
  - `LessonRenderer.jsx` — Renders lesson content from JSON blocks
  - `QuizDisplay.jsx` (1008 lines) — Quiz taking with timers, code answers, auto-grading, review mode
  - `CodeIDE.jsx` — CodeMirror Java editor with run button, output display, challenge verification
- **Components**:
  - `components/ui/`: `Button.jsx`, `Input.jsx`, `DeleteModal.jsx`, `ThemeToggle.jsx`
  - `components/student/`: `AITutor.jsx` (chatbot with characters), `InteractiveTerminal.jsx` (WebSocket terminal), `JoinClassModal.jsx`
  - `components/teacher/`: `IndexingStatsModal.jsx`
  - `components/landing/`: `Character3D.jsx` (VRM), `ChatbotSection.jsx`, `HeroWithCharacter.jsx`
  - `components/generation/`: `ModuleProgressCard.jsx`, `ProgressBar.jsx`, `TerminalLog.jsx`, `TextTypewriter.jsx`
- **Context**: `AuthContext.jsx`, `ClassContext.jsx` (teacher-only), `ThemeContext.jsx`
- **Services**: `services/api.js` — Axios instance with token interceptor, GET caching (5-min TTL)
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss"`), CSS custom properties for dark/light mode, `index.css`

### AI Service (`instruct-ai-service/`)
- **Version**: v2.0.0
- **Entry**: `main.py` — FastAPI app with 15+ endpoints
- **LLM Models**: Dual-model strategy
  - `llama-3.3-70b-versatile` — curriculum generation, content generation (complex), quiz generation
  - `llama-3.1-8b-instant` — outlines (Stage 1), simple section content (Stage 2), code verification, batch answer checking, tutor chat
- **API Key Rotation**: Up to 4 Groq keys (`GROQ_API_KEY` + 2-4) with round-robin + backoff via `GroqClientPool`
- **Pipelines**:
  - **Curriculum Generation** — streaming SSE, returns module/lesson/quiz structure
  - **Content Generation** (3-stage):
    1. Stage 1 (`stage1_outline_service.py`): Lesson outline with sections
    2. Stage 2 (`stage2_content_service.py`): Content per section (tutorial, concept, example, practice, etc.)
    3. Stage 3 (`stage3_formatter_service.py`): Format sections into lesson blocks (h1, text, code)
  - **Quiz Generation** — with question type distribution presets (balanced, coding_heavy, theory_focused, non_coding)
  - **Content Detection** — `POST /ai/detect-programming-content` + heuristic keyword analysis
- **RAG Infrastructure**:
  - `embedding_service.py` — SentenceTransformer `all-MiniLM-L6-v2` (384-dim)
  - `indexing_service.py` — Token-aware text chunking (tiktoken), stores in pgvector
  - `retrieval_service.py` — Cosine similarity search (`<=>` operator)
  - `rag_tutor_service.py` — Full RAG pipeline: embed → retrieve → build prompt → chat
- **Tutor Characters**: 4 personas (`config/characters.py`):
  - `professor` (Professor Oak) — wise, patient, academic
  - `buddy` (Buddy) — casual, friendly peer
  - `coach` (Coach Taylor) — motivational, energetic
  - `sage` (Master Yuki) — philosophical, zen
- **Media Fetching**: Pexels API (images — currently disabled), YouTube Data API v3 (videos with dedup)
- **Code Formatter**: Java/Python/JavaScript formatting in `utils/code_formatter.py`
- **Prompts**: Modular prompt files in `prompts/` (curriculum, content, stage1_outline, stage2_content)
- **Metrics**: `MetricsTracker` per-endpoint/per-model token/duration/error tracking

### Code Execution Engine (`instruct-execute/`)
- **Purpose**: Node.js Express 5 server for compiling and running student Java code
- **Supported Language**: Java only (JDK 22)
- **Protocols**:
  - **REST** `POST /execute` — `{ language, code, input? }` → `{ stdout, stderr, compile_output }`
  - **WebSocket** `ws://host:3000` — Interactive terminal with stdin support via `{ type: "execute" }` / `{ type: "input" }`
- **Security**: UUID temp dir per execution, auto-cleanup, 10s (REST) / 30s (WS) timeout
- **Deployment**: Docker (Dockerfile) or Railway (nixpacks.toml)
- **Port**: 3000 (configurable via `PORT` env)

## API Patterns

### Authentication
All protected routes use `auth:sanctum` middleware. Frontend stores token in localStorage and includes via Axios interceptor in `services/api.js`. No role-checking middleware — role checks done inline in controllers.

### Public Endpoints
```
POST   /api/register/teacher                # Teacher registration
POST   /api/register/student                # Student registration
POST   /api/login                           # Email/password login
POST   /api/login/google                    # Google OAuth login
POST   /api/chat/message                    # Landing page chatbot (Euna)
```

### Authenticated Shared
```
GET    /api/user                            # Current user with profile
POST   /api/logout                          # Logout, revoke token
```

### Teacher Endpoints

**Classrooms:**
```
GET    /api/teacher/classes                 # List classrooms
POST   /api/teacher/classes                 # Create classroom
GET    /api/teacher/classes/{id}            # Get class details
DELETE /api/teacher/class/{id}              # Delete class
GET    /api/teacher/stats                   # Dashboard stats (class/student counts)
```

**Courses:**
```
POST   /api/teacher/classes/{classId}/courses           # Create course
GET    /api/teacher/courses/{id}                        # Get course with modules
PUT    /api/teacher/courses/{id}                        # Update course
DELETE /api/teacher/courses/{id}                        # Delete course
POST   /api/teacher/courses/{id}/publish                # Toggle publish
POST   /api/teacher/courses/{id}/publish-all            # Publish entire course tree
POST   /api/teacher/courses/{id}/upload-curriculum      # Upload curriculum file
POST   /api/teacher/courses/{id}/ai-generate            # Generate curriculum via AI
POST   /api/teacher/courses/{id}/ai-generate-content    # Generate full content via AI
POST   /api/teacher/courses/{id}/ai-commit              # Commit AI-generated modules/lessons
```

**Modules:**
```
POST   /api/teacher/courses/{courseId}/modules          # Create module
PUT    /api/teacher/modules/{id}                        # Update module
DELETE /api/teacher/modules/{id}                        # Delete module
POST   /api/teacher/courses/{courseId}/modules/reorder  # Reorder modules
POST   /api/teacher/modules/{moduleId}/reorder          # Reorder items within module
```

**Lessons:**
```
POST   /api/teacher/modules/{moduleId}/lessons          # Create lesson
GET    /api/teacher/lessons/{id}                        # Get lesson content
PUT    /api/teacher/lessons/{id}                        # Update lesson
DELETE /api/teacher/lessons/{id}                        # Delete lesson
POST   /api/teacher/lessons/upload-image                # Upload to Cloudinary
```

**Quizzes:**
```
POST   /api/teacher/modules/{moduleId}/quizzes          # Create quiz
GET    /api/teacher/quizzes/{id}                        # Get quiz with questions
PUT    /api/teacher/quizzes/{id}                        # Update quiz
DELETE /api/teacher/quizzes/{id}                        # Delete quiz
POST   /api/teacher/quizzes/{quizId}/questions          # Create question
PUT    /api/teacher/questions/{id}                      # Update question
DELETE /api/teacher/questions/{id}                      # Delete question
POST   /api/teacher/quizzes/{id}/reorder-questions      # Reorder questions
```

**Indexing (RAG):**
```
POST   /api/teacher/courses/{id}/index                  # Index entire course
POST   /api/teacher/lessons/{id}/index                  # Index single lesson
GET    /api/teacher/courses/{id}/indexing-stats         # Get indexing status
POST   /api/teacher/courses/{id}/test-search            # Test semantic search
```

**Analytics:**
```
GET    /api/teacher/classes/{classId}/courses/{courseId}/analytics/overview
GET    /api/teacher/classes/{classId}/courses/{courseId}/analytics/performance-trend
GET    /api/teacher/classes/{classId}/courses/{courseId}/analytics/quiz-scores
GET    /api/teacher/classes/{classId}/courses/{courseId}/analytics/content-engagement
```

**Student Monitoring:**
```
GET    /api/teacher/classes/{classId}/courses/{courseId}/monitor/stats
GET    /api/teacher/classes/{classId}/courses/{courseId}/monitor/students
GET    /api/teacher/classes/{classId}/courses/{courseId}/monitor/student/{studentId}
```

### Student Endpoints
```
GET    /api/student/classes                  # List enrolled classes
POST   /api/student/enroll                   # Join class by 6-digit code
GET    /api/student/classes/{id}             # View class detail
GET    /api/student/courses/{id}             # View course with progress
GET    /api/student/lessons/{id}             # View lesson content
POST   /api/student/lessons/{id}/complete    # Mark lesson complete
POST   /api/student/lessons/{id}/submit-code # Submit code for a lesson block
GET    /api/student/quizzes/{id}             # Get quiz questions (for attempt)
POST   /api/student/quizzes/{id}/submit      # Submit quiz answers
POST   /api/student/attempts/{attemptId}/submit  # Submit individual attempt
POST   /api/student/execute                  # Proxy to code execution engine
POST   /api/ai/verify-code-challenge         # AI verify code challenge output
POST   /api/student/ai/chat                  # AI tutor chat (with RAG context)
POST   /api/student/ai/history               # Load AI tutor chat history
```

## Environment Variables

### Backend (.env)
```
DB_CONNECTION=pgsql                          # Or sqlite for local dev
DB_HOST=127.0.0.1                           # PostgreSQL host
DB_PORT=5432                                # PostgreSQL port
DB_DATABASE=instructai                      # PostgreSQL database
DB_USERNAME=postgres                         # PostgreSQL user
DB_PASSWORD=secret                           # PostgreSQL password
AI_SERVICE_URL=http://localhost:8001         # FastAPI service URL
EXECUTION_ENGINE_URL=http://localhost:3000   # Code execution engine URL
CLOUDINARY_URL=cloudinary://...             # For image uploads
CLOUDINARY_UPLOAD_PRESET=...                # Cloudinary upload preset
GOOGLE_CLIENT_ID=...                        # Google OAuth
GOOGLE_CLIENT_SECRET=...                    # Google OAuth
GROQ_API_KEY_CHAT=...                       # Separate Groq key for Euna chatbot
```

### AI Service (.env)
```
GROQ_API_KEY=...                        # Primary Groq API key
GROQ_API_KEY2=...                       # Additional keys for rotation (up to 4)
GROQ_API_KEY3=...                       # ...
GROQ_API_KEY4=...                       # ...
PEXELS_API_KEY=...                      # For real images (currently disabled)
YOUTUBE_API_KEY=...                     # YouTube Data API v3 for videos
DATABASE_URL=postgresql://...           # PostgreSQL connection for RAG
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api  # Backend API base URL
VITE_WS_URL=ws://localhost:3000         # Code execution WS URL
VITE_AI_SERVICE_URL=http://localhost:8001  # AI service URL
```

### Code Execution (.env)
```
PORT=3000                               # Server port (default)
```

## Important Implementation Notes

### Content Management
- **Publishing workflow**: Content starts unpublished. Teachers can publish individual items or use `publishAll` to publish entire course tree.
- **Ordering**: Courses, modules, lessons, quizzes, and questions all use `order_index` for manual sorting. Frontend handles drag-and-drop reordering via `reorder` endpoints.
- **AI Generation pipeline**: Teacher provides prompt + optional file (PDF/DOCX/TXT) → AI service returns streaming structured JSON → frontend shows real-time preview (generation console) → teacher can edit content parameters → commits via `ai-commit` endpoint which creates records in Laravel.
- **AI Content Parameters**: Teachers can configure difficulty, content depth (concise/standard/detailed), writing style (conversational/formal/technical/simple), image/video inclusion, question type distribution (balanced/coding_heavy/theory_focused/non_coding), timer settings.
- **Curriculum File**: Uploaded files are parsed via `pdfplumber` (PDF), `python-docx` (DOCX), or plain text; raw text stored in `courses.curriculum_text`.

### Quiz System
- **Timer modes**:
  - `"none"` — No time limit
  - `"per_question"` — Each question timed individually
  - `"entire_quiz"` — Single countdown for whole quiz
- **Question limit**: If set, randomly selects N questions from pool when student starts attempt
- **Question types**: `"multiple_choice"`, `"true_false"`, `"identification"`, `"enumeration"`, `"coding"`, `"short_answer"`
- **Grading**: Backend calculates score on submission:
  - multiple_choice/true_false: exact match
  - identification/enumeration/coding: sent to AI service `/ai/check-answers-batch` for AI grading
  - Stores in `QuizAttempt.max_score` and `QuizAttempt.total_score`

### Analytics System
- **Overview endpoint**: Returns total students enrolled, completion rates, average scores, quiz attempt counts for a course within a class
- **Performance trend**: Returns daily/weekly trend of average quiz scores over time
- **Quiz scores**: Distribution of scores across all attempts for a course's quizzes
- **Content engagement**: Per-lesson/per-quiz completion and attempt rates
- **Frontend**: Chart components (`PerformanceTrendChart.jsx`, `QuizScoresChart.jsx`, `ContentEngagementTable.jsx`) with loading skeletons

### Student Monitoring
- **Monitor stats**: Aggregate stats for a course (enrolled, active, at-risk, completed)
- **Student list**: Per-student progress with sort/filter (by name, score, completion)
- **Student profile**: Deep dive into individual student — quiz scores, lesson completion, code submissions, flags
- **Frontend**: Drill-down navigation from class → course → student via URL params

### RAG & Vector Search
- **Embedding model**: `sentence-transformers/all-MiniLM-L6-v2` (384-dimension)
- **Storage**: PostgreSQL with pgvector extension, `document_chunks` table
- **Chunking**: Token-aware with tiktoken (`cl100k_base`), 500 tokens/chunk with 50-token overlap
- **Indexing**: Course-level (curriculum + all lessons as unified content, 600-token chunks), lesson-level (500-token chunks)
- **Retrieval**: Cosine similarity (`<=>` pgvector operator), top-k with optional lesson ID prioritization
- **Teacher testing**: `POST /api/teacher/courses/{id}/test-search` lets teachers verify search results

### AI Tutor
- **Modes**:
  - `"restricted"` — STRICT assessment mode during quiz/challenge: only guiding questions, no answers
  - Any other value — Full answers, explanations, examples, code
- **Characters**: 4 persona options loaded from `config/characters.py` with name, personality, and avatar
- **Context**: Tutor receives current lesson content, quiz content (if active), RAG-retrieved context, and chat history
- **Frontend**: Floating FAB button opens chat window with markdown rendering, code block copy, character switcher
- **History**: Messages stored in `AiChatLog` with student_id, character_name, mode, context_metadata

### Code Execution
- **REST flow**: Student submits code → Laravel proxy (`POST /api/student/execute`) → instruct-execute (`POST /execute`) → returns stdout/stderr/compile_output → stored in `CodeSubmission` with `block_id` reference
- **Interactive terminal**: WebSocket-based using `@xterm/xterm` frontend → instruct-execute WebSocket → spawns Java process with stdin pipe
- **Fallback**: Backend tries localhost:3000 first, then `EXECUTION_ENGINE_URL` (deployed)
- **Challenge verification**: `POST /api/ai/verify-code-challenge` sends code + expected_output to AI service for correctness checking
- **Current limitation**: Java only. No stdin support in REST mode (only via WebSocket).

### Frontend State Management
- **AuthContext**: Manages user session, loads user data on mount via `GET /api/user`, provides login/logout
- **ClassContext**: Teacher-only context that caches classroom list and active class
- **ThemeContext**: Dark/light mode persisted to localStorage, CSS variable-driven theme switching
- **Protected Routes**: `ProtectedRoute` component checks auth + role, redirects if unauthorized
- **API Caching**: In-memory cache with 5-minute TTL, bypasses cache for class/course detail endpoints

### Frontend Stack Details
- **React 19** with hooks, `react-router-dom` v7
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/vite` plugin, no config file needed), CSS custom properties for theme
- **Rich text**: TipTap v3 with StarterKit, BubbleMenu, Link, Placeholder, Underline extensions
- **Code editor**: `@uiw/react-codemirror` with `@codemirror/lang-java` for CodeIDE
- **Icons**: `lucide-react`
- **Animation**: `framer-motion` v12
- **3D rendering**: Three.js with `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@pixiv/three-vrm` for VRM character on landing page
- **Toasts**: `sonner`
- **Terminal**: `@xterm/xterm`
- **Date formatting**: `date-fns`

### Backend Patterns
- **Teacher ownership check**: All teacher controllers check `$request->user()->id` against `teacher_id` on the resource using `firstOrFail()`.
- **Deep hierarchy auth**: Lesson/quiz access goes through module → course → teacher via `whereHas` closures.
- **Student enrollment check**: `$request->user()->classes()->where('class_id', $id)->exists()`.
- **AI streaming**: Server-Sent Events via Guzzle stream read loop through to the frontend.
- **Code execution fallback**: Try local (`localhost:3000`) first, fallback to deployed `EXECUTION_ENGINE_URL`.
- **Quiz grading**: AI batch endpoint for non-exact-match question types.

## Common Development Tasks

### Adding a new migration
```bash
php artisan make:migration add_field_to_table_name
# Edit the migration file
php artisan migrate
```

### Creating a new API endpoint
1. Add route in `backend/routes/api.php` within appropriate role group
2. Create/update controller in `App\Http\Controllers\Teacher\` or `Student\`
3. Update frontend `services/api.js` if needed
4. Use in React component via `await api.get/post/put/delete(...)`

### Adding a new field to TipTap editor
1. Install TipTap extension: `npm install @tiptap/extension-name`
2. Import and add to extensions array in `LessonEditor.jsx`
3. Add toolbar button in bubble menu or main toolbar
4. Backend stores content as JSON in `lessons.content` column

### Debugging Laravel
```bash
php artisan pail                              # View logs in real-time
php artisan config:clear                      # Clear config cache
php artisan cache:clear                       # Clear application cache
php artisan route:clear                       # Clear route cache
```

### Testing AI curriculum generation locally
```bash
cd instruct-ai-service && python main.py

# Test curriculum stream endpoint
curl -X POST http://localhost:8001/ai/generate-curriculum-stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Create a Python basics course with 3 modules","difficulty":"beginner","module_count":3,"lessons_per_module":3}'

# Test content generation (3-stage pipeline)
curl -X POST http://localhost:8001/ai/generate-content-stream \
  -H "Content-Type: application/json" \
  -d '{"curriculum_context":"...","modules":[...],...}'
```

### Adding a new AI tutor character
1. Add entry to `instruct-ai-service/config/characters.py` with name, personality, avatar
2. Character auto-available via `GET /ai/characters` endpoint
3. Frontend `AITutor.jsx` renders character options from API response

### Testing code execution
```bash
cd instruct-execute && npm start

# REST
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{"language":"java","code":"public class Main { public static void main(String[] args) { System.out.println(\"Hello\"); } }"}'
### Testing AI curriculum generation locally
```bash
# Start AI service
cd instruct-ai-service && python main.py

# Test endpoint directly
curl -X POST http://localhost:8001/ai/generate-curriculum \
  -F "prompt=Create a Python basics course with 3 modules"
```
