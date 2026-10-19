# Smoke Test Accounts

**⚠️ STATE CHANGE (2026-10-19): the production database was wiped to a clean
slate before the real pilot. Every account below was deleted, along with all
classes, courses, activities, quizzes and chats. Only `admin@instructai.dev`
survived (its password is unchanged). A JSON backup of the deleted content
lives in `%TEMP%/instructai-db-backup-final/` on the dev machine.**

To seed real accounts: log in as admin → Whitelists → add real student LRNs
and the real teacher email — whitelisted emails/LRNs are the only people who
can register.

QA accounts for testing the InstructAI platform (pre-wipe — historical). All
accounts lived on the shared Neon Postgres database (same DB the deployed
Render backend uses).

## Credentials

| Account | Email | Password | Role | Used for |
|---------|-------|----------|------|----------|
| Smoke Teacher | `smoketeacher@instructai.dev` | `SmokeTeacher123!` | Teacher | Creating classes, courses, quizzes; running live/teacher-paced rooms; grading |
| Smoke Student 1 | `smokestudent1@instructai.dev` | `SmokeStudent123!` | Student | Enrolling in classes, taking quizzes, AI tutor, live quiz participant |
| Smoke Student 2 | `smokestudent2@instructai.dev` | `SmokeStudent123!` | Student | Second participant for multi-user flows (live quizzes, activities) |

## Typical usage

- **Teacher-paced live quiz** — log in 3 browsers (or 3 sessions): Smoke Teacher
  starts the room and paces questions; Smoke Student 1 and Smoke Student 2 join
  and answer. Verifies: pause/resume, countdown, reveal feedback, room close.
- **Student-paced quiz** — Smoke Student 1 takes the quiz while Smoke Student 2
  stays out, to compare auto-grading paths.
- **Analytics/monitoring** — Smoke Teacher views course analytics and student
  monitoring using data produced by both students.

## Login

1. Frontend dev server: `http://localhost:5173`
2. API base: `http://instructai.test/api` (Laravel Herd)
3. Sign in via the login page with email + password (no Google OAuth needed).

## Creating new accounts (replaces recovering old ones)

Accounts are created with the public register endpoints:

```bash
curl -X POST http://instructai.test/api/register/teacher \
  -H "Content-Type: application/json" \
  -d '{"email":"newteacher@instructai.dev","password":"SomePass123!","first_name":"New","last_name":"Teacher","organization":"QA"}'

curl -X POST http://instructai.test/api/register/student \
  -H "Content-Type: application/json" \
  -d '{"email":"newstudent@instructai.dev","password":"SomePass123!","first_name":"New","last_name":"Student","lrn_number":"123456789012"}'
```

Notes:
- Student accounts require a unique 12-digit `lrn_number`.
- Passwords must be at least 8 characters.
- Do NOT reset passwords on existing accounts — create fresh ones instead.

## Retired accounts

| Email | Role | Status |
|-------|------|--------|
| `testteacher@instructai.com` | Teacher | Legacy — password `password123` |
| `smoketest@instructai.com` | Teacher | Legacy — password `password123` |
| `smokestudent@instructai.com` | Student | Legacy — password unknown |
| `smoketest.teacher@instructai.dev` | Teacher | Legacy — password unknown |
| `smoketest.student@instructai.dev` | Student | Legacy — password unknown |