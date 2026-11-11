# Student Graduation / Access Revocation — Design Doc

**Date:** 2026-11-11
**Author:** Edrick Martin (InstructAI backend)
**Status:** Ready for implementation — user approved approach in conversation
**Branch:** `feat/student-graduation`

---

## 1. The problem (from the defense panel)

During the final defense the panel asked: *"Your whitelist only gates registration. What happens when a student graduates but their LRN is still in the whitelist? Can they keep logging in forever?"*

The initial answer — "the admin deletes their LRN" — was rejected because it **doesn't actually solve the problem**:

- Deleting the LRN from `enrolled_students` stops *new* registrations with that LRN, but it does nothing to an **account that already exists**. That student keeps logging in indefinitely.
- To actually block them, an admin would also have to remember to manually flip `User.is_active = false` on their `users` row — a second, separate step that has no UI hook at the whitelist surface and is easy to forget.
- Doing it one-by-one for a graduating cohort (30–100+ students) is operationally painful.

So the current system effectively lets any registered graduate retain access forever. That's what needs to change.

---

## 2. What the system actually contains (data facts, not assumptions)

During design we verified the actual schema — **no grade level / section / school year hierarchy exists**, and there is no plan to add one. This is a Google-Classroom-style model:

| Table | Real columns | Has grade/section? |
|---|---|---|
| `classes` | `id, teacher_id, name, class_code, description, color` | ❌ No. A class is a named container ("Math 101") with a code. |
| `student_profiles` | `user_id, first_name, last_name, lrn_number` | ❌ No `grade_level` field (it was in the original schema but dropped from the migration and from `fillable`). |
| `enrolled_students` (the whitelist) | `id, lrn_number (unique), first_name, last_name, grade_level, section, claimed, timestamps` | ⚠️ `grade_level` / `section` exist **only as optional metadata the admin may type** when bulk-pasting LRNs. Not enforced, not tied to anything. |

**Critical implication:** there is no "Grade 12 – Sampaguita" entity the system can say "these students belong to this class, so they all graduate together." The panel's mental model (graduating by class/section/year) does not match this system.

**However:** the existing whitelist *is* a per-LRN status list, and the admin already has class information **externally**: classes exist as `classes` rows (name + `class_code`), and each student's *active enrollments* are in `enrollments`. So "the students in class X" **is** a computable question for students who are still enrolled.

---

## 3. Design decisions

### 3.1 The core field: `graduated_at` on the whitelist entry

Add a single nullable timestamp column `graduated_at` to `enrolled_students`.

Rationale:
- It records **graduation as a status event**, which directly answers the panel ("graduated students can't log in") without inventing grade-level/year-level concepts that don't exist.
- It's reversible: clearing the column "re-enrolls" the student (for mistakes / transfers back).
- It gives an audit trail of *when* each student graduated — useful for reporting ("which LRNs were graduated this year").
- Zero impact on historical data: `quiz_attempts`, `code_submissions`, `ai_chat_logs`, `enrollments` are untouched. Nothing is deleted.

**Revoke behavior (user-approved):** when an LRN is marked graduated, **all sessions end immediately** — the system revokes every `tokens` row for that student (same code path as the existing `/admin/users/{id}/disable`). At the *next* login attempt they get the existing inactive-account message: *"This account has been disabled by the school admin."* (The message text can be tightened to mention the LRN no longer being on the active enrollment list — optional copy edit, see §5.)

**Registration gate:** a student registers with LRN X only if an `enrolled_students` row for X exists **and** `graduated_at IS NULL`. Graduated LRNs can never register again — they'd have to be "re-enrolled" (un-graduated) first.

**Re-enrollment:** un-graduating (`graduated_at = NULL`) restores registration eligibility. It does **not** restore any previously revoked token or reopen an existing session — the student must log in fresh. (If a mistake needs the old session back, that's a separate `enable` action.)

### 3.2 Bulk operations (the operational fix)

Because classifying/checkboxing 30+ rows is painful, the whitelist page gets **three** ways to graduate:

1. **Checkbox batch** — select any subset of rows → "Graduate selected" / "Re-enroll selected". Fast for targeted exceptions (5–40 students).
2. **Class-based graduate** (primary bulk path) — a dropdown populated from existing `classes`, select a class, graduate **all currently enrolled students** in that class in one action. This is the "end-of-year graduation" flow: the admin picks "Math 101" and all its enrolled students are marked graduated at once.
   - Only students who are actively `enrolled` in that class at that moment are graduated. This mirrors reality: a student who dropped the class is not part of "this class graduating."
   - If a class has no enrollments, the action is a no-op with a friendly message ("No students are currently enrolled in this class").
3. **LRN text paste** — a second text area where admins paste LRNs, one per line, → "Mark graduated" / "Re-enroll". Useful when the admin has a spreadsheet of names/LRNs.

Terminology (user-approved, panel-friendly):
- **"Graduate selected"** — marks the LRNs graduated (reversible). Not "suspend", not "disable" — graduation is the accurate domain term the panel used.
- **"Re-enroll selected"** — clears `graduated_at` (restores eligibility). Chosen over "ungraduate" / "un-graduate" because it's the correct school-admin term and it's clear in one read.
- UI status column shows two chips: **"Active"** (green) vs **"Graduated"** (amber/red) + the graduation date.

### 3.3 What we do NOT do

- **No grade_level / section fields are touched or added.** They stay as they are (optional whitelist metadata), but we **stop displaying them in the whitelist UI** — they're AI-assumed concepts that don't belong in a defensible design, and they risk misrepresenting the system to the panel ("we track sections" when we don't).
  - Question left to implementation: should we delete the columns entirely, or just hide them? **Recommendation: hide in UI only, keep the columns in the DB.** Deleting risks breaking the bulk-import parser line that expects up to 4 fields, and there's no operational win. Hiding solves the panel-facing problem. (If you'd rather delete them, say so — low risk either way, I'll adjust.)
- **No school-year / cohort tables.** That was the over-engineering option and was rejected.
- **No auto-graduation jobs.** Nothing runs on a schedule. Graduation is always an explicit admin action.
- **No data deletion.** Students keep all their work (submissions, quiz attempts, chat logs, enrollments). Only access is affected.

### 3.4 Edge cases (handled)

| Case | Behavior |
|---|---|
| Graduate a class whose students are already graduated | The action is idempotent — marking `graduated_at` to the same value again is harmless; no duplicate token revocation harm. |
| Graduate a class containing a student who isn't whitelisted | Only whitelisted, enrolled students are affected. Non-whitelisted (shouldn't exist, but) are skipped. |
| Graduate then re-enroll then login | Works: fresh login succeeds with new token. Old token stays dead. |
| Delete an LRN from the whitelist (existing remove) | Existing behavior preserved — the LRN can no longer register, and no `is_active` change is forced. (This is a separate action from graduation; deleting is still the "the student left the school entirely" path.) |
| Teacher/Google signup for a graduated student | Rejected at registration with the LRN-not-on-active-list message (gate checks `graduated_at IS NULL`). |
| A student enrolled in multiple classes, both get graduated | Idempotent — `graduated_at` set once; subsequent class-graduate actions on the same LRN are no-ops. |

---

## 4. Files to change

**Backend:**

1. `backend/database/migrations/XXXX_add_graduated_at_to_enrolled_students.php` — new migration: `nullableTimestamp('graduated_at')` on `enrolled_students`.
2. `backend/app/Models/EnrolledStudent.php` — no change needed (Laravel reads the new column automatically).
3. `backend/app/Http/Controllers/Admin/StudentWhitelistController.php` — add:
   - `POST /admin/student-whitelist/graduate` — accepts `{ lrn_numbers: string[] }` and/or `{ class_id: int }`; marks graduated + revokes tokens; returns counts (graduated / already-graduated).
   - `POST /admin/student-whitelist/re-enroll` — same shape; clears `graduated_at`.
   - `GET /admin/student-whitelist/classes` — list of classes with enrollment counts (for the bulk dropdown).
4. Token revocation helper: extend the existing `User::tokens()->delete()` pattern (already in `UserController::disable`) into a small shared helper or inline it.
5. `lrnEnrollmentError()` in `AuthController.php` — update to reject `graduated_at IS NOT NULL` LRNs with a clearer message.

**Frontend:**

6. `frontend/src/components/admin/WhitelistManager.jsx` (students config) —:
   - Add checkboxes to each student row.
   - Add a sticky selection bar ("X selected") with **Graduate selected / Re-enroll selected** buttons.
   - Add a "Graduate a whole class" control (class dropdown + button) above the list.
   - Add an "LRN paste" text area + button (Graduate / Re-enroll).
   - Replace "Status" column with Active/Graduated chips + date.
7. `frontend/src/queries/admin.js` — add `useGraduateWhitelistEntries` / `useReEnrollWhitelistEntries` / `useClassesForGraduation` hooks; invalidate `['admin']` tree on success.
8. Optionally tighten the "account disabled" login message to reference the LRN being removed from the active enrollment list.

---

## 5. API contract (summary)

| Method | Endpoint | Request | Response |
|---|---|---|---|
| POST | `/admin/student-whitelist/graduate` | `{ "lrn_numbers": ["123456789012"] }` **or** `{ "class_id": 7 }` | `{ "message": "...", "graduated": N, "already_graduated": N }` |
| POST | `/admin/student-whitelist/re-enroll` | same shape | `{ "message": "...", "reenrolled": N, "not_graduated": N }` |
| GET | `/admin/student-whitelist/classes` | — | `{ "classes": [{ id, name, class_code, students: N }] }` |
| GET | `/admin/student-whitelist` (existing) | — | returns full rows **including** `graduated_at` (null or ISO string) |

The `graduated_at` field appears on the existing list response so the UI can render it.

---

## 6. What this gives the panel (the answer it now supports)

> *"We don't just gate registration — the whitelist is our record of who is currently enrolled. When a cohort graduates, the admin selects their class and clicks 'Graduate' and **every one of those students is locked out of the system immediately** — their sessions end and they can never register again with that LRN. If we make a mistake, 'Re-enroll' undoes it in one click. Nothing else changes: their work and grades stay exactly as they were."*

Plus the individual-toggle safety net for exceptions.

---

## 7. Open questions for the user

1. **The `grade_level` / `section` columns:** delete them from the DB entirely, or hide them in the UI only? (My recommendation: hide in UI only — safest, no risk to the bulk-import parser, and there's no real harm keeping optional metadata.)
2. **Disabled-login message:** keep the generic *"This account has been disabled by the school admin."* or add LRN context ("...your LRN was removed from the active enrollment list.")?
3. **Class-based graduate scope:** only students *currently enrolled* in the class at action time — correct, or should it also include students who were enrolled at any point? (I recommend current-only; it's the more honest reading of "this class is graduating.")
4. **Migration direction:** should the migration also backfill nothing (all NULL) — yes, that's the plan, no backfill needed.

---
