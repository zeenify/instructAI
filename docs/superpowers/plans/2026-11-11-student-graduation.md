# Student Graduation / Access Revocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `graduated_at` status to the student whitelist so that when a cohort graduates, all their accounts are locked out of the system immediately — with bulk "graduate / re-enroll" actions (checkbox batch, whole-class, LRN-paste) — without inventing grade-level or school-year concepts that don't exist in this system.

**Architecture:** A single nullable timestamp column `graduated_at` on `enrolled_students` records graduation as a reversible status event. Login and registration gates check `graduated_at IS NULL`. Admin endpoints mark/restore the status and revoke all tokens for affected users (immediate sign-out). The frontend admin whitelist page adds a class-based bulk selector, a checkbox batch toolbar, an LRN-paste area, and Active/Graduated status chips.

**Tech Stack:** Laravel 11 (PHP 8.4, Sanctum), PostgreSQL (Neon DB), React 19 + TanStack Query.

**Spec:** `docs/superpowers/2026-11-11-student-graduation-design.md`

---

## Global Constraints

- **Database:** local dev points at the **same** Neon DB as production (`ep-shy-lab-a1syfmn6`) — this is live data. Be careful: test with throwaway accounts/LRNs, and avoid destructive operations on real student records.
- **Migration direction:** only `up()` writes; `down()` must drop the new column without touching any other schema.
- **Revocation pattern:** reuse the existing `User::tokens()->delete()` + `update(['is_active' => false])` flow from `UserController::disable()` — immediate session kill.
- **Login message:** keep the existing generic *"This account has been disabled by the school admin."* (no LRN-specific copy).
- **Terminology:** buttons read **"Graduate selected"** / **"Re-enroll selected"** / **"Graduate [class name]"**; chips read **"Active"** (green) / **"Graduated"** (amber, with date).
- **CSS conventions:** new buttons use the existing `db-btn-primary` / `ad-chip` styles; add minimal styles next to the admin whitelist page (page-specific CSS only).
- **No grade_level / section fields touched or added** — they stay in the DB; the UI simply stops rendering them.

## Review Focus

These are the failure modes most likely to bite; each gets a curl/DB verification in its owning task:

1. **Graduated LRN can't register** — a `POST /register/student` with a `graduated_at` LRN must return 422 from `lrnEnrollmentError()`, and the same must hold for Google signup (`loginWithGoogle`).
2. **Graduated user can't login** — `POST /login` with a graduated student's credentials must return 403; existing tokens for that user must be revoked.
3. **Re-enroll restores registration** — `re-enroll` a graduated LRN, then register/login with it must succeed.
4. **Class-based graduate targets current enrollments only** — graduating class X must not affect students not currently `enrolled` in X (and must be idempotent if re-run).
5. **Bulk operations are idempotent** — graduating the same LRN twice must not error or double-revoke; the response must report `already_graduated` counts.

---

## Files changed (summary)

**Backend:**
- `backend/database/migrations/XXXX_add_graduated_at_to_enrolled_students.php` (new)
- `backend/app/Http/Controllers/Admin/StudentWhitelistController.php` (new endpoints)
- `backend/app/Http/Controllers/AuthController.php` (gate check, `lrnEnrollmentError`)
- `backend/routes/api.php` (route registrations)

**Frontend:**
- `frontend/src/queries/admin.js` (new hooks)
- `frontend/src/components/admin/WhitelistManager.jsx` (bulk UI, checkboxes, chips)
- `frontend/src/pages/admin/Admin.css` (new styles — or dedicated `AdminWhitelists.css`? Check convention; Admin.css exists for admin, use it)

---

### Task 1: New migration — `graduated_at` on `enrolled_students`

**Files:**
- Create: `backend/database/migrations/YYYYMMDD_HHMMSS_add_graduated_at_to_enrolled_students.php`

**Interfaces:**
- Produces: `enrolled_students.graduated_at` — `nullableTimestamp()`, default `NULL`, no backfill (all existing rows NULL = Active).

**Steps:**
- [ ] `cd backend && php artisan make:migration add_graduated_at_to_enrolled_students`
- [ ] Write `up()`: `$table->timestamp('graduated_at')->nullable();` — **nothing else** in the table definition. Write `down()`: `$table->dropColumn('graduated_at');`.
- [ ] **Verify:** run the migration (`php artisan migrate`) and confirm `migrations` shows it applied. Then `psql` into the DB: `\d enrolled_students` and confirm `graduated_at timestamp without time zone (null)` is present and no other column changed.

**Verification command:** `cd backend && php artisan migrate:fresh --seed` (on a **local SQLite scratch copy** if you want zero risk — actually, the DB is live; skip fresh, just run `php artisan migrate` after backing up with the existing backup UI, or accept the small risk: single column ADD on a live table is safe).

---

### Task 2: `StudentWhitelistController` — new bulk endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Admin/StudentWhitelistController.php` — append three methods + a helper.

**Interfaces:**
- Consumes: `EnrolledStudent` model, `User` model, `Enrollment` model.
- Produces:
  - `POST /admin/student-whitelist/graduate` accepts `{ "lrn_numbers": ["123..."] }` **or** `{ "class_id": N }`; marks whitelisted + enrolled students `graduated_at = now()` and revokes their tokens; returns `{ "message": "...", "graduated": N, "already_graduated": N }`.
  - `POST /admin/student-whitelist/re-enroll` accepts the same shapes; clears `graduated_at`; returns `{ "message": "...", "reenrolled": N, "not_graduated": N }`.
  - `GET /admin/student-whitelist/classes` returns `{ "classes": [{ "id", "name", "class_code", "students": N }] }` (only classes with ≥1 student).

**Steps:**
- [ ] Add `classes()` method: return `Classroom::withCount('students')->whereHas('students')->get()` with id/name/class_code/students count.
- [ ] Add `graduate(Request $request)`: validate either `class_id` (integer, must exist) or `lrn_numbers` (array of 12-digit numeric strings, max 1000); resolve target LRNs:
  - If `class_id`: all rows in `enrolled_students` whose LRN appears in an active `enrollments` row for that class.
  - If `lrn_numbers`: rows matching those LRNs.
  - For each target: if `graduated_at` already set → `already_graduated++`; else set `graduated_at = now()` **and** revoke tokens via `User::whereHas('studentProfile', fn($q) => $q->where('lrn_number', $lrn))->tokens()->delete();` → `graduated++`.
  - Return counts JSON.
- [ ] Add `reEnroll(Request $request)` similarly: targets = same resolution; for each: if `graduated_at` IS NULL → `not_graduated++`; else set `graduated_at = NULL` → `reenrolled++`.
- [ ] Wrap both in `role:admin` route group; add `abort_if` guards (e.g., request must contain one of the two shapes, else 422).
- [ ] **Verification:** `php artisan serve --port=8000`. Curl a graduated test flow:
  ```bash
  # create test student
  curl -X POST http://localhost:8000/register/student \
    -H "Content-Type: application/json" \
    -d '{"email":"testgrad@example.com","password":"password123","first_name":"Test","last_name":"Grad","lrn_number":"190000000001","accepted_terms":true}'
  # mark graduated by LRN
  curl -X POST http://localhost:8000/admin/student-whitelist/graduate \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <admin-token>" \
    -d '{"lrn_numbers":["190000000001"]}'
  # confirm token revoked + login blocked (403)
  curl -X POST http://localhost:8000/login -H "Content-Type: application/json" \
    -d '{"email":"testgrad@example.com","password":"password123"}'
  ```
  Expected: register 201, graduate `{"graduated":1,"already_graduated":0}`, login **403** ("disabled by the school admin").

---

### Task 3: Auth gate — graduated LRNs can't register or login

**Files:**
- Modify: `backend/app/Http/Controllers/AuthController.php` — `lrnEnrollmentError()`.

**Interfaces:**
- Consumes: `EnrolledStudent::where('lrn_number', ...)` now also filters `whereNull('graduated_at')`.

**Steps:**
- [ ] `lrnEnrollmentError()`: change the existence check to `EnrolledStudent::where('lrn_number', $lrnNumber)->whereNull('graduated_at')->exists()`. Update the error message to mention the LRN may have been removed from the active enrollment list.
- [ ] `login()` is **already** guarded by `is_active` — no change needed, but verify the flow: after Task 2 revokes tokens, login rejects at `!$user->is_active` (which stays true!). **⚠️ Critical:** revoking tokens alone is NOT enough — the login `is_active` check passes because `is_active` is never flipped. Decide and implement ONE of:
  - (a) In `graduate()`, also set `is_active = false` on the users + keep a note in the error message; **re-enroll must re-set `is_active = true`.** (Keeps login behavior unchanged; simplest.)
  - (b) Add a dedicated login check `EnrolledStudent::whereNull('graduated_at')` in `login()` — but then `is_active` becomes redundant.
  - **Recommendation:** go with (a) — `graduate()` sets `is_active = false` (reusing the disable pattern) and `reEnroll()` sets `is_active = true`. Login keeps its existing behavior.
- [ ] **Verify:** same curl flow as Task 2, plus: after re-enroll (`POST .../re-enroll`), register/login with the same student succeeds (200 + token).

---

### Task 4: Register routes

**Files:**
- Modify: `backend/routes/api.php` — insert three new admin routes under the existing admin role group (near lines 290–300, after the whitelist routes).

**Steps:**
- [ ] `Route::get('/admin/student-whitelist/classes', [StudentWhitelistController::class, 'classes'])->middleware(['auth:sanctum','role:admin']);`
- [ ] `Route::post('/admin/student-whitelist/graduate', [StudentWhitelistController::class, 'graduate'])->middleware([...]);`
- [ ] `Route::post('/admin/student-whitelist/re-enroll', [StudentWhitelistController::class, 'reEnroll'])->middleware([...]);`
- [ ] Ensure the route order doesn't conflict with the existing `DELETE /admin/student-whitelist/{id}` (post routes before delete routes in the group).
- [ ] **Verify:** `php artisan route:list | grep student-whitelist` — confirm the three routes exist with correct verbs and the admin role.

---

### Task 5: Frontend query hooks

**Files:**
- Modify: `frontend/src/queries/admin.js` — append three hooks + an invalidate helper.

**Interfaces:**
- Consumes: existing `api` client, `useQueryClient`, `toast`.
- Produces:
  - `useClassesForGraduation()`: `useQuery({ queryKey: ['admin','classes','graduation'], queryFn: () => api.get('/admin/student-whitelist/classes') })`.
  - `useGraduateWhitelistEntries(kind)`: `mutationFn({ actions: { byLrn: [...], byClass: id } })` → `api.post('/admin/student-whitelist/graduate', body)`; on success invalidate `['admin']`.
  - `useReEnrollWhitelistEntries(kind)`: same shape → `/admin/student-whitelist/re-enroll`.

**Steps:**
- [ ] Write `useClassesForGraduation` (staleTime 30s, placeholderData keeps rows).
- [ ] Write `useGraduateWhitelistEntries` and `useReEnrollWhitelistEntries` with `onError` reporting the backend message via `toast.error`.
- [ ] **Verify:** `npm run lint` passes (no TS/ESLint errors); `npm run build` must succeed at the end (can't verify fully until the component is wired — do a smoke check with `npm run lint` now).

---

### Task 6: Admin whitelist UI — class-based bulk + checkboxes + chips

**Files:**
- Modify: `frontend/src/components/admin/WhitelistManager.jsx` (students branch only).
- Modify: `frontend/src/pages/admin/Admin.css` — add `.ad-selection-bar`, `.ad-chip.graduated`, `.ad-checkbox-col` styles.

**Steps:**
- [ ] In the students `CONFIG`, add `bulkActions: true` flag and a `renderRow`/checkbox wrapper that adds `<input type="checkbox" value={item.id} ...>` to each row's first cell (or a dedicated left column).
- [ ] Add a state `const [selected, setSelected] = useState(new Set()); const [selectedActions, setSelectedActions] = useState(null);` — selection bar shows X selected; buttons: **Graduate selected**, **Re-enroll selected**.
- [ ] Add a **class bulk action** above the list: `<select>` (populated from `useClassesForGraduation`) + button "Graduate [name]" that calls `useGraduateWhitelistEntries('students').mutate({ actions: { byClass: id } })`. Also a "Re-enroll [name]" for re-enroll.
- [ ] Add an **LRN-paste** area (textarea, one LRN per line) with "Graduate" / "Re-enroll" buttons — validate each line is 12 digits, batch POST.
- [ ] Replace the "Status" column: chip `"Active"` (green) when `graduated_at` is null; `"Graduated"` + date (amber) otherwise.
- [ ] Hide the "Grade / Section" column (remove from the students `columns` config; keep the teachers config untouched).
- [ ] **Verify:** open the admin whitelists page, toggle checkboxes, open the class dropdown (should list classes with student counts), run the class-graduate button and confirm the DB `graduated_at` updates and chips flip amber.

---

### Task 7: End-to-end verification + cleanup

**Steps:**
- [ ] Full test script against `http://localhost:8000` with a throwaway admin + student:
  1. create 3 test students (different LRNs), create a class, enroll all 3,
  2. class-graduate the class → verify all 3 `graduated_at` set, all 3 tokens revoked, all 3 logins 403,
  3. re-enroll all 3 → verify `graduated_at` cleared, login succeeds,
  4. LRN-paste graduate 1 → verify only that 1 is affected,
  5. register a new account with an already-graduated LRN → 422,
  6. run the class-graduate action twice (idempotency) → no errors, `already_graduated` count reported.
- [ ] `npm run lint` and `npm run build` — the build is the final gate.
- [ ] Run `npx impeccable detect src/components/admin/ src/queries/admin.js src/pages/admin/` and fix only findings in these redesigned pages (ignore the known intentional slop: Inter/Fraunces and the blockquote border).
- [ ] Commit the whole branch: `git commit -m "feat(admin): student graduation status with bulk graduate / re-enroll by class or batch"`.
- [ ] Push: `git push origin feat/student-graduation`.

**Verify final:** `git log --oneline -3`, and open the branch on GitHub for review.

---

## Self-Review Checklist (before implementing)

1. **Spec coverage:** every behavior in the design doc (§3.1–3.4) has a task — ✅ migration, ✅ controller endpoints, ✅ auth gate, ✅ routes, ✅ hooks, ✅ UI, ✅ E2E.
2. **The `is_active` coupling (review focus #2):** `graduate()` sets `is_active=false` and revokes tokens; `reEnroll()` restores both — this keeps login's existing check working. Re-enroll message: "re-enabled".
3. **Class-based scope:** only currently-enrolled students are targeted (via `enrollments` join) — ✅ in Task 2.
4. **Idempotency:** already-graduated LRNs counted, not re-flagged; re-run of class graduate is safe — ✅ in Task 2.
5. **Live-DB safety:** all E2E tests use throwaway LRNs (`1900...`); no destructive ops on real records.

---

## Execution handoff

**Plan complete and saved.** This is a **native** execution plan: I will implement every task myself in this session, then run the full E2E verification against the local Neon DB. The most critical risk is the `is_active` coupling in the login gate (it was already there but its interaction with graduation had to be deliberately wired up) — that's pinned in review focus #2 and tested in Task 3.

**Should I proceed with native execution now?** (If you'd rather have an independent subagent review each task before I move on, say "subagent-driven" and I'll split the plan into per-task subagent calls instead.)
