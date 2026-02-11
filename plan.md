# Flaregun v0.1 — Plan

Self-hosted error tracking on Cloudflare. Analytics Engine only. No Durable Objects, no D1 — those are v2.

## What v0.1 Does

- Browser SDK (`<script>` tag, <1KB gzipped) catches `window.onerror` + `unhandledrejection`
- `navigator.sendBeacon` fires errors to a Worker endpoint
- Worker writes structured data points to Analytics Engine
- Dashboard (CF Pages) queries AE SQL API, shows errors grouped by fingerprint with time-series charts

## What v0.1 Does NOT Do

- Source map deobfuscation
- Alerting (Slack/email)
- Release tracking
- User/session context
- Real-time dedup or counting (DO-based, v2)
- Auth on the dashboard (add later, CF Access is the easy answer)

## Architecture

```
Browser                     Cloudflare
┌──────────┐    beacon    ┌──────────────┐    writeDataPoint    ┌──────────────────┐
│ flaregun │ ──────────►  │ Worker       │ ──────────────────►  │ Analytics Engine  │
│ SDK      │  POST /api/  │ /api/errors  │                      │ (90-day retention)│
└──────────┘   errors     └──────────────┘                      └────────┬─────────┘
                                                                         │ SQL API
                          ┌──────────────┐                               │
                          │ Dashboard    │ ◄─────────────────────────────┘
                          │ CF Pages     │   SELECT blob1, COUNT()
                          └──────────────┘   GROUP BY blob1
```

## Analytics Engine Schema

Each `writeDataPoint()` call:

| Field | AE Slot | Content | Example |
|---|---|---|---|
| Fingerprint | `blob1` | MD5 of normalized message + stack top frame | `a3f8b2c1` |
| Message | `blob2` | `error.message` (truncated to 256 chars) | `Cannot read properties of undefined (reading 'map')` |
| Stack (top 3 frames) | `blob3` | Top 3 lines of stack trace | `at Foo.render (app.js:42:15)\nat ...` |
| Page URL | `blob4` | `location.href` (origin + pathname, no query) | `/checkout` |
| Browser | `blob5` | Parsed UA family + version | `Chrome 121` |
| OS | `blob6` | Parsed OS family | `macOS` |
| Error type | `blob7` | `error` or `unhandledrejection` | `error` |
| Project ID | `blob8` | Config-provided project slug | `my-app` |
| Count | `double1` | Always `1` (for SUM aggregation) | `1` |

**Grouping at query time:**
```sql
SELECT blob1 AS fingerprint, blob2 AS message, blob3 AS stack,
       SUM(double1) AS count, MIN(timestamp) AS first_seen, MAX(timestamp) AS last_seen
FROM errors
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY blob1, blob2, blob3
ORDER BY count DESC
LIMIT 50
```

## Project Structure

```
flaregun/
├── packages/
│   ├── sdk/                  # Browser SDK
│   │   ├── src/
│   │   │   └── index.ts      # onerror + unhandledrejection + sendBeacon
│   │   ├── package.json      # "flaregun" on npm
│   │   └── tsup.config.ts    # Bundle to IIFE + ESM, target <1KB gzip
│   │
│   ├── worker/               # Ingest Worker
│   │   ├── src/
│   │   │   └── index.ts      # POST /api/errors → AE writeDataPoint
│   │   └── wrangler.toml     # Analytics Engine binding
│   │
│   └── dashboard/            # Dashboard (Remix on CF Pages)
│       ├── app/
│       │   ├── routes/
│       │   │   ├── _index.tsx        # Error groups list (table + sparklines)
│       │   │   └── errors.$id.tsx    # Single error group detail
│       │   └── lib/
│       │       └── ae.server.ts      # Analytics Engine SQL API client
│       └── wrangler.toml
│
├── plan.md
├── package.json              # Workspace root (pnpm)
└── README.md
```

## Implementation Steps

### 1. Scaffold monorepo
- `pnpm init`, workspace config
- Three packages: `sdk`, `worker`, `dashboard`

### 2. Browser SDK (`packages/sdk`)
- `window.addEventListener('error', ...)` — capture message, filename, lineno, colno, stack
- `window.addEventListener('unhandledrejection', ...)` — capture reason + stack
- Fingerprint: hash of `message + top stack frame` (simple string hash, not crypto)
- `navigator.sendBeacon(endpoint, JSON.stringify(payload))`
- Config: `Flaregun.init({ endpoint: '/api/errors', projectId: 'my-app' })`
- Build with tsup: IIFE for `<script>` tag, ESM for bundlers
- Target: <1KB gzipped

### 3. Ingest Worker (`packages/worker`)
- Single route: `POST /api/errors`
- Parse JSON body, validate required fields (message, fingerprint)
- Normalize: strip query params from URL, truncate message to 256 chars, take top 3 stack frames
- Parse UA string (lightweight — just family + version, use regex not a library)
- `env.ERRORS.writeDataPoint({ blobs: [...], doubles: [1] })`
- Return `204 No Content`
- CORS: allow configurable origins
- Rate limit: basic per-IP throttle via `request.headers.get('cf-connecting-ip')` — drop if >100 errors/min from same IP

### 4. Dashboard (`packages/dashboard`)
- Remix app on CF Pages
- **Index page:** table of error groups sorted by count (last 24h default)
  - Columns: message (truncated), count, first seen, last seen, sparkline (last 24h)
  - Time range selector: 1h, 24h, 7d, 30d
- **Detail page:** single error group
  - Full message + stack trace
  - Time-series chart (errors over time, bucketed by hour)
  - Breakdown by URL, browser, OS
  - Sample raw payloads (last 5 via `LIMIT 5` query)
- **AE SQL API client:** fetch from `https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql`
  - Auth via API token (env var)
- Styling: minimal, Tailwind, dark mode default

### 5. Deploy & test
- `wrangler deploy` for worker
- `wrangler pages deploy` for dashboard
- Add `<script src="...">` to a test page, throw errors, verify they appear

## AE Limits to Know

- 25 blobs max, 20 doubles max per data point (we use 8 blobs, 1 double — plenty of room)
- 90-day retention (not configurable)
- Free plan: 100k data points/day
- Paid plan: 10M/month included, then $0.25/million
- SQL API: 1M queries/month included (dashboard usage will be negligible)
- No billing on SQL API yet (still free as of Feb 2026)

## v2 Roadmap (not in scope)

- Durable Objects for real-time dedup + hot counters
- Source map upload to R2 + deobfuscation
- Alerting via DO alarms → Slack/email Worker
- CF Access for dashboard auth
- Release tracking dimension
- User/session context in beacon payload
