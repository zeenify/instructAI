# Data Layer Plan — TanStack Query migration

> Written down so the plan survives conversation compaction.
> Update the checkboxes and progress log as work completes.

## The problem (verified by investigation, Sep 2026)

The app has no unified data layer. Three accidental strategies coexist:

1. **Context-held data** — `ClassContext` (mounted above teacher routes in
   `App.jsx`) holds the class list; its state survives navigation because it
   sits outside what React Router unmounts. This is why the Overview page and
   class-to-class switching feel instant. Fast *by accident*.
2. **Homegrown 5-min GET cache** — `services/api.js` + `utils/cache.js`: an
   in-memory Map keyed `method:url` (query params NOT in the key), TTL 5 min,
   lazy eviction on read. Makes ClassDetails/CourseBuilder/LessonEditor/
   QuizBuilder fast within 5 minutes. Fast *by accident*, with bugs.
3. **Always-fresh fetches** — Monitor, Analytics, ActivityResults pass
   `bypassCache: true` on every request (skips cache read AND write). Every
   visit is a full network waterfall. Monitor additionally remounts across
   three sibling routes (`monitor`, `monitor/:classId`,
   `monitor/:classId/:courseId/:studentId`), so clicking a student, going
   Back, or re-clicking Monitor refires every request.

Latent bugs in the old cache: params not part of the key (collision risk);
login does not clear it (logging into a different account in the same tab can
show the previous account's data for up to 5 min); ~50 hand-written
`invalidateCache()` calls after mutations — each one a chance to forget and
serve stale data forever.

## The fix — TanStack Query (`@tanstack/react-query`)

One shared in-memory query cache mounted above the routes with
**stale-while-revalidate** semantics:

- Revisit a page → cached data renders **instantly**; if older than its
  freshness window, a background refetch updates the UI when it lands.
  Fast AND accurate — no tradeoff, no loading screen over existing content.
- Query keys include params (`['monitor','students', classId, courseId, sort]`),
  so different params never collide and each combo caches separately.
- After a mutation, invalidate **by key** (`queryClient.invalidateQueries`),
  replacing all ~50 manual invalidations.
- Deduplication: two components asking for the same data = one request.
- `queryClient.clear()` on logout fixes the cross-account leak.
- Keeps axios + existing api.js helpers. Old cache and `bypassCache` are
  deleted only after every page has migrated.

Per-data freshness windows (`staleTime`) are chosen per query, e.g. class list
5 min, monitor stats 30 s, live quiz board 0 + `refetchInterval` polling.

## Phases

### Phase 1 — Foundation (one-time)
- [x] Install `@tanstack/react-query`.
- [x] `QueryClientProvider` in `main.jsx`; defaults: `staleTime: 30_000`,
      `refetchOnWindowFocus: false`, `retry: 1`.
- [x] `queryClient.clear()` in AuthContext `logout()`.
- [x] `src/queries/` hooks: `teacherClasses.js` (`useTeacherOverview`),
      `monitor.js` (`useMonitorCourses`, `useMonitorStats`,
      `useMonitorStudents`, `useStudentProfile`). Analytics/activities hooks
      intentionally deferred to their page migrations — no dead stub code.

### Phase 2 — ClassContext becomes a thin shell
- [x] Rewritten over `useTeacherOverview()`, same public interface
      (`classes`, `totals`, `loading`, `refreshClasses`, `patchClass`).
      Consumers unchanged. `loading` is now first-load-only; `enabled` guard
      keeps the query teacher-only.

### Phase 3 — Monitor page (worst offender; UI redesign due anyway)
- [x] `StudentMonitor.jsx` refactored onto the monitor hooks. URL is the
      source of truth for selection (auto-select first class/course via
      `replace` navigations); remounts render from per-key cache instantly.

### Phase 4 — Rollout with each page's UI redesign
- [ ] Migrate Analytics, ActivityResults, Classwork, builders
      (CourseBuilder, LessonEditor, QuizBuilder, ActivityEditor,
      ActivityGrading), then student pages — each during its redesign.
- [ ] Final cleanup: delete `utils/cache.js`, interceptor cache logic,
      `bypassCache` flag, and all manual `invalidateCache()` calls.

## Rules for future pages (follow in every redesign)
- Pages consume data via `src/queries/` hooks — never a private `useEffect`
  fetch of data another page also shows.
- Mutations invalidate by query key; cosmetic-only changes use optimistic
  `setQueryData`-style updates with rollback.
- Loading UI only when there is no cached data yet (`isLoading`, not
  `isFetching`) — background refetches must never blank a page.

## Acceptance checks
- [ ] Second visit to Monitor renders instantly from cache; stats refresh in background.
- [ ] Creating a class updates sidebar + overview cards with no spinner flash.
- [ ] Logout → different account in same tab → zero stale data.
- [ ] Monitor sort/filter changes never blank the list.
- [ ] `vite build` passes each phase.

## Progress log
- 2026-09-18: Plan written; investigation complete; no implementation yet.
- 2026-09-18: Phases 1–3 implemented and building. Remaining: Phase 4 rollout
  (per-page during redesigns), final cache cleanup, live UX verification by
  the user (monitor revisit speed, no-spinner create, sort/filter).
