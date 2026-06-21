# Performance Monitoring Plan

**InstructAI** — Full-stack LMS (Laravel 12 + React 19 + FastAPI + Node.js execution engine)

---

## Table of Contents

- [The Big Picture](#the-big-picture)
- [Phase 1: See What's Happening (Day 1)](#phase-1-see-whats-happening-day-1)
- [Phase 2: Database (Day 2)](#phase-2-database-day-2)
- [Phase 3: Backend Request Tracing (Day 3-4)](#phase-3-backend-request-tracing-day-3-4)
- [Phase 4: Frontend (Day 5-6)](#phase-4-frontend-day-5-6)
- [Phase 5: AI Service & Code Engine (Day 7)](#phase-5-ai-service--code-engine-day-7)
- [Phase 6: Ship It — Persistent Storage & Alerts (Day 8+)](#phase-6-ship-it--persistent-storage--alerts-day-8)
- [How to Read the Data](#how-to-read-the-data)
- [Quick Wins Checklist](#quick-wins-checklist)
- [What Big Tech Actually Does](#what-big-tech-actually-does)

---

## The Big Picture

Right now we're flying blind. We have:

- Scattered `Log::` calls in 7 controllers
- Ad-hoc `console.log` on frontend
- AI service MetricsTracker that prints to terminal then disappears
- No DB query timing
- No page-load timing
- No way to answer _"why was this page slow?"_

**Goal:** A system where any developer can open one dashboard and answer:

- Which page loads are slow?
- Which API endpoints are slow?
- Which DB queries are slow?
- Is the AI service bottlenecking us?
- Is the code execution engine slow?

---

## Phase 1: See What's Happening (Day 1)

**No installs. No new services. Just wrap what exists with timestamps.**

### 1A. Backend request logger middleware

Create a middleware that logs every API request with duration:

```
Timestamp | Method | URL | Status | Duration(ms) | UserID | Memory(MB)
```

Written as structured JSON to `storage/logs/requests-YYYY-MM-DD.log`.

This single file instantly answers: _"which endpoints are slow?"_

### 1B. DB query logger service provider

Register a `DB::listen()` in `AppServiceProvider` that logs every query longer than 100ms:

```
Duration(ms) | SQL (truncated 200ch) | Bindings
```

Written to `storage/logs/slow-queries-YYYY-MM-DD.log`.

Answers: _"which queries are slow?"_

### 1C. Frontend navigation performance marks

Add to the router (`App.jsx`) a simple listener that records:

```
page: /dashboard/teacher/class/{id}/course/{id}
timeToRender: 2340ms
apiCalls: 5
slowestApi: /api/teacher/courses/{id} (890ms)
```

Logged to `console.table` in dev, and stored in `localStorage` as a rolling window (last 100 navigations).

Answers: _"which page transitions are slow?"_

### 1D. AI service file-backed metrics

Replace `MetricsTracker.print_metrics_summary()` with a function that appends to `logs/metrics.jsonl` (one JSON line per request).

Granularity:
```
timestamp | endpoint | model | duration_ms | prompt_tokens | completion_tokens | error
```

Answers: _"is AI the bottleneck?"_

---

## Phase 2: Database (Day 2)

### 2A. Identify N+1 queries

Use the slow-query log from Phase 1. Common patterns to look for:

- Analytics endpoints running 3 separate queries instead of joins
- CourseBuilder loading modules, then lessons, then quizzes in loops
- Any endpoint that fires 10+ near-identical queries

Fix the worst offenders with eager loading (`->with()`) or raw joins.

### 2B. Add DB query timeline to request log

Enrich the request log (Phase 1A) with:

```json
{
  "total_db_queries": 14,
  "total_db_time_ms": 320,
  "slowest_query_ms": 180,
  "slowest_query_sql": "select * from courses where..."
}
```

Now every request log also tells us: _"was DB the bottleneck?"_

### 2C. Index review

Run `EXPLAIN ANALYZE` on the 5 slowest queries from Phase 2A. Add missing indexes for:

- `enrollments.student_id + enrollments.class_id` (composite)
- `lesson_completions.student_id + lesson_completions.lesson_id`
- `quiz_attempts.student_id + quiz_attempts.quiz_id`
- `code_submissions.student_id + code_submissions.lesson_id`

These are the tables hit hardest by analytics/monitoring pages.

---

## Phase 3: Backend Request Tracing (Day 3-4)

### 3A. Install Laravel Debugbar (dev only)

```bash
composer require barryvdh/laravel-debugbar --dev
```

Gives instant per-request breakdown during development:

| Panel | What it shows |
|-------|---------------|
| Route | Which route matched |
| Queries | Every SQL + duration |
| Models | Model hydration count (N+1 detection) |
| Time | Total + breakdown by section |
| Memory | Peak usage |
| Session | Session data |
| Logs | All `Log::` calls in this request |

### 3B. Tag critical endpoints with custom headers

Add a simple middleware that appends timing headers to every API response:

```
X-InstructAI-Time-Total: 450
X-InstructAI-Time-DB: 120
X-InstructAI-Time-AI-Service: 0
X-InstructAI-DB-Queries: 14
```

The frontend can then read these headers and log them alongside page metrics.

### 3C. External monitoring (Sentry)

Install `sentry/sentry-laravel`:

```bash
composer require sentry/sentry-laravel
```

- Automatically captures every exception
- Records transaction performance (endpoint + duration)
- Groups by URL pattern (not raw URL)
- Shows slow transactions, error rates, and trends over time

Performance transactions sample rate: 0.25 (25% of requests traced — enough to spot trends, low overhead).

---

## Phase 4: Frontend (Day 5-6)

### 4A. Navigation timing dashboard

Build a simple `<PerfMonitor />` component (hidden behind a keyboard shortcut, Ctrl+Shift+P):

| Metric | Source |
|--------|--------|
| Route transition time | `performance.now()` before/after route change |
| API calls per page | Axios interceptor counting |
| Slowest API call | Axios interceptor measuring each request |
| Total API time | Sum of all request durations |
| Rendering time | `useEffect` + `performance.now()` after mount |
| Bundle size | `performance.memory` (Chrome) |

States: initial load, re-render, data fetching, empty, error.

### 4B. Axios timing interceptor

Add a request/response interceptor that:

1. Sets `performance.mark()` before request
2. Reads `X-InstructAI-Time-*` response headers
3. Logs slow requests (>500ms) to a local rolling buffer
4. Shows a non-blocking toast for requests >2s (only in dev)

### 4C. Frontend error tracking

Install `@sentry/react`:

```bash
npm install @sentry/react
```

- Automatic React error boundaries
- Performance tracing (page loads, navigation, API calls)
- Browser and OS breakdown
- Session replays (optional, 1% sample)

### 4D. Bundle analysis

Add to `vite.config.js`:

```js
import { visualizer } from 'rollup-plugin-visualizer';

plugins: [
  react(),
  tailwindcss(),
  visualizer({ open: true }),
]
```

Run `npm run build` → opens an interactive treemap of bundle sizes.

Answer: _"why is this page heavy to download?"_

---

## Phase 5: AI Service & Code Engine (Day 7)

### 5A. AI service structured logging

Replace `print()` with structured JSON logging via Python's `logging` module + `python-json-logger`:

```
{"timestamp": "...", "level": "INFO", "logger": "groq_pool", "message": "Key rotation", "key_index": 2, "reason": "rate_limited", "backoff_seconds": 30}
```

Ship to both console and `logs/ai-service.log`.

### 5B. AI service health endpoint

Extend `GET /` to return:

```json
{
  "status": "ok",
  "uptime_seconds": 34200,
  "requests_total": 1523,
  "requests_last_minute": 12,
  "errors_last_hour": 3,
  "avg_duration_ms": 2340,
  "keys_active": 4,
  "keys_rate_limited": 0,
  "db_connected": true
}
```

Laravel can poll this periodically and log if the AI service is unhealthy.

### 5C. Code execution engine metrics

Add a metrics middleware to `instruct-execute`:

```json
{
  "endpoint": "/execute",
  "duration_ms": 234,
  "language": "java",
  "compile_success": true,
  "exit_code": 0,
  "timestamp": "..."
}
```

Write to `logs/execute.jsonl`.

---

## Phase 6: Ship It — Persistent Storage & Alerts (Day 8+)

### 6A. Centralized metrics table in PostgreSQL

Create a `performance_logs` table:

```sql
create table performance_logs (
  id bigserial primary key,
  source varchar(32) not null, -- 'laravel', 'frontend', 'ai', 'execute'
  type varchar(32) not null,   -- 'request', 'query', 'page_load', 'ai_request', 'execute'
  metric varchar(64) not null, -- 'duration_ms', 'db_queries', 'memory_mb'
  value numeric not null,
  tags jsonb,                  -- {method, url, status, user_id, endpoint, model}
  created_at timestamptz default now()
);
```

All services write to this table. Now you can query:

```sql
-- Slowest endpoints today
select metric ->> 'url' as url, avg(value) as avg_ms
from performance_logs
where source = 'laravel' and type = 'request' and metric = 'duration_ms'
  and created_at > now() - interval '24 hours'
group by url
order by avg_ms desc
limit 10;
```

### 6B. Dashboard page

A simple `/dashboard/admin/perf` page (admin-only) showing:

| Widget | Source |
|--------|--------|
| Avg API response time (last 1hr line chart) | performance_logs |
| P95 API response time | performance_logs |
| Slowest endpoints | performance_logs |
| DB query count trend | performance_logs |
| Avg page load time (frontend) | performance_logs |
| AI service avg latency | performance_logs |
| Error rate (last 24hr) | performance_logs + Sentry |

### 6C. Alerts

Simple threshold checking via a scheduled Laravel command:

```php
// App\Console\Commands\CheckPerformance
```
- If avg endpoint duration > 2s for last 5 minutes → alert
- If DB query count per request > 50 → alert
- If AI service avg duration > 10s → alert
- If error rate > 5% → alert

Alerts go to `notifications` table (same as existing notification system).

### 6D. Long term: OpenTelemetry

Once the above is running and proving useful, consider OpenTelemetry:

- **Laravel**: `open-telemetry/opentelemetry-php` SDK
- **Python**: `opentelemetry-distro`
- **JavaScript**: `@opentelemetry/web`

Send traces to Jaeger/Grafana Tempo. Gives end-to-end distributed tracing across all 4 services.

---

## How to Read the Data

### Is it the database?

```
Look at:  Phase 1A request log → "total_db_time_ms" field
Threshold: >30% of total request time → DB is the bottleneck
Fix:      Phase 2A (N+1), Phase 2C (indexes)
```

### Is it the backend code?

```
Look at:  Phase 1A request log → "duration_ms" - "total_db_time_ms"
Threshold: remaining time > 500ms without AI call → code is slow
Fix:      Phase 3A (Debugbar to see which part), optimize controller
```

### Is it the frontend rendering?

```
Look at:  Phase 4A navigation timing → "render_ms"
Threshold: >300ms → component re-rendering too much or too large
Fix:      React.memo, useMemo, lazy load heavy components (3D, CodeMirror, TipTap)
```

### Is it the AI service?

```
Look at:  Phase 1D AI metrics → "duration_ms"
Threshold: >5s for 8b model, >15s for 70b model
Fix:      Check Groq status, reduce token count, add client-side timeout
```

### Is it the network?

```
Look at:  Phase 4B Axios interceptor → "total_api_time" vs X-InstructAI-Time-Total
Signal:   If total_api_time > X-InstructAI-Time-Total significantly → network latency
Fix:      CDN, compression, reduce payload size
```

---

## Quick Wins Checklist

| # | Task | Time | Impact |
|---|------|------|--------|
| 1 | Add DB::listen() slow query logger | 15 min | Medium |
| 2 | Add request timing middleware | 30 min | High |
| 3 | Add frontend navigation perf marks | 1 hr | High |
| 4 | Add AI service file-backed metrics | 30 min | Medium |
| 5 | Install Debugbar (dev) | 5 min | High |
| 6 | Add Sentry backend | 1 hr | High |
| 7 | Add X-InstructAI-Time headers | 30 min | Medium |
| 8 | Add frontend Axios timing interceptor | 1 hr | High |
| 9 | Add bundle visualizer | 15 min | Low |
| 10 | Fix worst N+1 queries | 2-4 hr | High |
| 11 | Add missing indexes | 1 hr | High |

**Start with #1, #2, #3, and #5.** These are zero-install, high-impact, and will surface the biggest issues within an hour of deployment.

---

## What Big Tech Actually Does

They do all of the above, but at scale and with more tools:

| Company | Frontend | Backend | DB | Alerting |
|---------|----------|---------|----|----------|
| **Google** | Chrome DevTools + custom RUM framework | Dapper (distributed tracing) | F1, Spanner built-in | Borgmon/Monarch |
| **Meta** | MobileLab + React Profiler integration | Canopy (distributed tracing) | MySQL at scale | Scuba (real-time) |
| **Netflix** | Boomerang (RUM) + custom | Hystrix (latency + circuit breakers) | Cassandra + EVCache | Atlas (monitoring) |
| **Shopify** | StatsD + Datadog RUM | OpenTelemetry + Datadog APM | Vitess (MySQL) + Datadog | PagerDuty + Datadog |
| **Stripe** | Custom RUM framework | OpenTelemetry + internal tracing | Custom distributed DB | Alertmanager + PagerDuty |
| **Uber** | Synthetics + Custom | Jaeger (distributed tracing) | Schemaless (MySQL) | M3 + Alertmanager |
| **Github** | StatsD + Datadog RUM | OpenTelemetry | MySQL + Redis | Datadog + PagerDuty |

**The common pattern is always the same, regardless of scale:**

1. **Instrument everything** — every request, every DB query, every render
2. **Collect in one place** — centralized time-series metrics store
3. **Visualize** — real-time dashboards
4. **Alert** — automated threshold-based notifications
5. **Trace end-to-end** — correlation ID across all services (the hardest part, done last)

**They don't start with OpenTelemetry or Datadog.** They start with what we're doing here: timing middleware, slow query logs, and a humble dashboard. Then they add layers as the system grows.

---

*This plan prioritizes immediate visibility with zero upfront cost, then incrementally adds persistence, visualization, and alerting.*
