# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InstructAI is a full-stack Learning Management System (LMS) with AI-powered curriculum generation. Built with Laravel 12 (PHP 8.2) backend, React + Vite frontend, and a FastAPI microservice for AI features.

## Architecture

### Three-Tier Content Hierarchy
The system follows a strict nesting pattern:
```
Classroom (teacher creates, students join via code)
  └─ Course (multiple per class, has is_published flag)
      └─ Module (ordered collection)
          └─ Lesson | Quiz (ordered items within module)
```

**Key relationships:**
- `Classroom` → owned by teacher, joined by students via `class_code`
- `Course` → belongs to classroom, contains modules, tracks `is_published` and `order_index`
- `Module` → belongs to course, contains lessons/quizzes ordered by `order_index`
- `Lesson` → rich text editor content using TipTap, can include code blocks
- `Quiz` → contains questions, supports `timer_mode` ("none", "per_question", "entire_quiz"), `question_limit` for random subset

### User Roles
- **Teacher**: Creates classes, courses, modules, lessons, quizzes. Can generate curriculum via AI.
- **Student**: Enrolls in classes via code, views published content, takes quizzes, submits code.

### Data Models
- **User** (via Sanctum): `role` field ("teacher" | "student"), has polymorphic profile relation
- **Enrollment**: Links students to classrooms (not courses directly)
- **QuizAttempt**: Tracks student quiz submissions with `max_score` and `finished_at`
- **LessonCompletion**: Marks when student completes a lesson
- **CodeSubmission**: Stores student code submissions with `block_id` reference

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
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running Development Servers
```bash
# All-in-one dev environment (from backend/)
composer run dev
# This runs: artisan serve (8000) + queue:listen + pail (logs) + npm run dev (5173)

# Or run individually:
cd backend && php artisan serve              # Laravel API on :8000
cd backend && php artisan queue:work          # Queue worker
cd frontend && npm run dev                    # Vite dev server on :5173
cd instruct-ai-service && python main.py      # AI service on :8001
```

### Database
```bash
# Run migrations
php artisan migrate

# Fresh database with seeding
php artisan migrate:fresh --seed

# Create new migration
php artisan make:migration create_table_name

# Rollback last migration
php artisan migrate:rollback
```

### Testing
```bash
# Run all tests
composer run test
# Or: php artisan test

# Run specific test file
php artisan test tests/Feature/CourseTest.php

# Run with coverage
php artisan test --coverage
```

### Code Quality
```bash
# Laravel Pint (code formatting)
vendor/bin/pint

# ESLint (frontend)
cd frontend && npm run lint
```

## Key Files and Locations

### Backend Structure
- **Routes**: `backend/routes/api.php` - All API endpoints (uses `/teacher/*` and `/student/*` prefixes)
- **Controllers**: Namespaced by role: `App\Http\Controllers\Teacher\*` and `App\Http\Controllers\Student\*`
- **Models**: `backend/app/Models/` - Eloquent models with relationships
- **Migrations**: `backend/database/migrations/` - Schema definitions (order matters)

### Frontend Structure
- **Entry**: `frontend/src/main.jsx` → wraps with `AuthProvider` and `ClassProvider`
- **Routing**: `frontend/src/App.jsx` - React Router v7 with nested layouts
- **Layouts**: 
  - `TeacherLayout.jsx` - Persistent sidebar for teacher dashboard
  - `StudentLayout.jsx` - Persistent sidebar for student dashboard
- **Pages**:
  - Teacher: `pages/teacher/` (CourseBuilder, LessonEditor, QuizBuilder)
  - Student: `pages/student/` (CourseViewer, QuizDisplay, LessonRenderer)
- **Components**: `components/ui/` for reusable UI, `components/student/` (AITutor, JoinClassModal)

### AI Service
- **Main**: `instruct-ai-service/main.py` - FastAPI app with multi-stage content generation pipeline
- **LLM**: Uses Groq API with `llama-3.3-70b-versatile` model
- **Input**: Accepts prompt + optional file upload (PDF/DOCX/TXT)
- **Output**: Structured JSON matching `CurriculumResponse` Pydantic schema
- **Stages**: 
  - Stage 1: Generate lesson outline with sections
  - Stage 2: Generate content for each section (tutorial, concept, example, practice, etc.)
  - Stage 3: Format sections into lesson blocks with media

### Code Execution Engine
- **Location**: `instruct-execute/` (separate repository, do not commit)
- **Purpose**: Node.js Express server for executing student code
- **Language**: Java only (for now)
- **Features**: 
  - Compiles and runs code with 10-second timeout protection
  - Returns stdout, stderr, and compile output
  - Uses OS temp directory for safety
  - Note: Does NOT support stdin/interactive input yet (planned enhancement)

## API Patterns

### Authentication
All protected routes use `auth:sanctum` middleware. Frontend stores token in localStorage and includes via Axios interceptor in `services/api.js`.

### Teacher Endpoints
```
POST   /api/teacher/classes                          # Create classroom
GET    /api/teacher/classes/{id}                     # Get class details
POST   /api/teacher/classes/{classId}/courses        # Create course
GET    /api/teacher/courses/{id}                     # Get course with modules
POST   /api/teacher/courses/{id}/ai-generate         # Generate curriculum via AI
POST   /api/teacher/courses/{id}/ai-commit           # Commit AI-generated modules
POST   /api/teacher/modules/{moduleId}/lessons       # Create lesson
POST   /api/teacher/modules/{moduleId}/quizzes       # Create quiz
PUT    /api/teacher/lessons/{id}                     # Update lesson content
POST   /api/teacher/lessons/upload-image             # Upload to Cloudinary
```

### Student Endpoints
```
POST   /api/student/enroll                           # Join class by code
GET    /api/student/classes                          # List enrolled classes
GET    /api/student/courses/{id}                     # View course content
POST   /api/student/lessons/{id}/complete            # Mark lesson complete
POST   /api/student/quizzes/{id}/submit              # Submit quiz attempt
POST   /api/student/execute                          # Proxy to code execution service
```

## Environment Variables

### Backend (.env)
```
DB_CONNECTION=sqlite                    # Or mysql/pgsql for production
AI_SERVICE_URL=http://localhost:8001    # FastAPI service URL
CLOUDINARY_URL=cloudinary://...         # For image uploads
GOOGLE_CLIENT_ID=...                    # OAuth
GOOGLE_CLIENT_SECRET=...                # OAuth
```

### AI Service (.env)
```
GROQ_API_KEY=...                        # Required for curriculum generation
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api  # Backend API base URL
```

## Important Implementation Notes

### Content Management
- **Publishing workflow**: Content starts unpublished. Teachers can publish individual items or use `publishAll` to publish entire course tree at once.
- **Ordering**: Courses, modules, lessons, quizzes, and questions all use `order_index` for manual sorting. Frontend handles drag-and-drop reordering via `reorder` endpoints.
- **AI Integration**: Teachers provide prompt + optional file → AI service returns structured JSON → frontend shows preview → teacher can edit → commits via `ai-commit` endpoint which creates records in Laravel.

### Quiz System
- **Timer modes**: 
  - `"none"` - No time limit
  - `"per_question"` - Each question timed individually
  - `"entire_quiz"` - Single countdown for whole quiz
- **Question limit**: If set, randomly selects N questions from pool when student starts attempt
- **Question types**: `"multiple_choice"`, `"true_false"`, `"short_answer"`
- **Grading**: Backend calculates score on submission and stores in `QuizAttempt.max_score`

### Frontend State Management
- **AuthContext**: Manages user session, loads user data on mount, provides login/logout
- **ClassContext**: Teacher-only context that caches classroom list and active class
- **Protected Routes**: `ProtectedRoute` component checks role and redirects if unauthorized

### Code Execution
- Student submits code → Laravel proxy → `instruct-execute` service (Express.js)
- Compiles Java code with `javac`, executes with 10-second timeout
- Results stored in `CodeSubmission` model with `block_id` to track which code block in lesson
- **Current limitation**: No stdin support (code cannot accept user input interactively)
- **Future enhancement**: Will support Scanner and runtime input prompts

## Common Development Tasks

### Adding a new migration
```bash
php artisan make:migration add_field_to_table_name
# Edit the migration file
php artisan migrate
```

### Creating a new API endpoint
1. Add route in `backend/routes/api.php` within appropriate role group
2. Create/update controller method in `App\Http\Controllers\Teacher\` or `Student\`
3. Update frontend `services/api.js` if needed
4. Use in React component via `await api.get/post/put/delete(...)`

### Adding a new field to TipTap editor
1. Install TipTap extension: `npm install @tiptap/extension-name`
2. Import and add to extensions array in `LessonEditor.jsx`
3. Add toolbar button in bubble menu or main toolbar
4. Backend stores content as JSON in `lessons.content` column

### Debugging Laravel
```bash
# View logs in real-time
php artisan pail

# Clear caches when config changes don't apply
php artisan config:clear
php artisan cache:clear
php artisan route:clear
```

### Testing AI curriculum generation locally
```bash
# Start AI service
cd instruct-ai-service && python main.py

# Test endpoint directly
curl -X POST http://localhost:8001/ai/generate-curriculum \
  -F "prompt=Create a Python basics course with 3 modules"
```
