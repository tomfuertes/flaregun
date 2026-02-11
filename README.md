# Flaregun

Self-hosted error tracking on Cloudflare. Analytics Engine only. No databases, no Durable Objects.

```
Browser → sendBeacon → Worker → Analytics Engine → Dashboard (SQL API)
```

## Install

### Option A: Inline IIFE

Full SDK, synchronous. <!-- IIFE_GZIP -->1080B<!-- /IIFE_GZIP --> gzipped.

```html
<script src="https://unpkg.com/flaregun/dist/flaregun.iife.js"></script>
<script>
  Flaregun.init({ endpoint: '/api/errors', projectId: 'my-app' });
</script>
```

### Option B: Queue snippet + deferred SDK (recommended)

Inline snippet (<!-- SNIPPET_RAW -->474B<!-- /SNIPPET_RAW --> raw) queues errors immediately. Full SDK loads `defer`, drains the queue, takes over.

```html
<script>
<!-- SNIPPET_START -->
(function(r,e){r.__fg={c:null,q:e},r.Flaregun={init:function(n){r.__fg.c=n}},r.addEventListener("error",function(n){e.push({t:"error",m:n.message||"",s:n.error&&n.error.stack||"",u:location.origin+location.pathname})}),r.addEventListener("unhandledrejection",function(n){var o=n.reason;e.push({t:"unhandledrejection",m:o instanceof Error?o.message:String(o||""),s:o instanceof Error&&o.stack||"",u:location.origin+location.pathname})})})(window,[]);
<!-- SNIPPET_END -->
Flaregun.init({ endpoint: '/api/errors', projectId: 'my-app' });
</script>
<script defer src="https://unpkg.com/flaregun/dist/flaregun.iife.js"></script>
```

### With a bundler

```js
import { init } from 'flaregun';
init({ endpoint: '/api/errors', projectId: 'my-app' });
```

## Config

```ts
Flaregun.init({
  endpoint: string;   // Worker URL
  projectId: string;  // Project slug stored in blob8
  beforeSend?: (payload) => payload | null;  // Modify or drop errors
});
```

`beforeSend` receives `{ fingerprint, message, stack, url, type, projectId }`. Return `null` to drop.

## Deploy

```bash
pnpm install && pnpm --filter flaregun build

# Worker
pnpm --filter @flaregun/worker dev      # local
npx wrangler deploy -c packages/worker/wrangler.toml  # prod

# Dashboard — set CF_ACCOUNT_ID, CF_API_TOKEN, AE_DATASET first
pnpm --filter @flaregun/dashboard dev    # local
pnpm --filter @flaregun/dashboard build && npx wrangler pages deploy packages/dashboard/build/client
```

## Privacy

No IPs stored, no cookies, no user identifiers. UA reduced to family+version. Query params stripped from URLs.

PII scrubbing runs in both SDK and Worker (defense in depth). Patterns cover emails, credit cards, SSNs, phone numbers, IPs, JWTs, tokens, API keys, UUIDs, and home directory paths. See [`PII_PATTERNS` in the SDK](packages/sdk/src/index.ts) and [`PII_PATTERNS` in the Worker](packages/worker/src/index.ts).

Analytics Engine has no individual data point deletion. 90-day retention is the only deletion mechanism. For Article 17 compliance, gate behind a consent banner or CF Access.

## Roadmap

**v0.2 — Source maps via R2.** SDK sends script URL with errors. Worker fetches `.map` once per fingerprint, stores in R2, deobfuscates stack traces on the dashboard.

**v0.3 — Durable Objects.** Real-time dedup and hot counters. Alerting via DO alarms → Slack/email Worker. Release tracking dimension.

**Later.** CF Access for dashboard auth. User/session context in beacon payload.

## Keeping this README in sync

Size numbers and the inline snippet are generated from the build:

```bash
./scripts/sync-readme.sh
```

## License

MIT
