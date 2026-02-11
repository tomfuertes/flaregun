# 🔫 Flaregun

Self-hosted error tracking on Cloudflare. Analytics Engine only. No databases, no Durable Objects — just a Worker and a dashboard.

## What it does

- **Browser SDK** (`<script>` tag, <1KB gzipped) catches `window.onerror` + `unhandledrejection`
- **Worker** receives errors via `navigator.sendBeacon` and writes to Analytics Engine
- **Dashboard** (Remix on CF Pages) queries the AE SQL API to show errors grouped by fingerprint

## Architecture

```
Browser → sendBeacon → Worker → Analytics Engine → Dashboard (SQL API)
```

No cold storage. No message queues. Analytics Engine handles retention (90 days) and aggregation.

## Quick start

```bash
pnpm install

# Build SDK
pnpm --filter flaregun build

# Dev worker
pnpm --filter @flaregun/worker dev

# Dev dashboard
pnpm --filter @flaregun/dashboard dev
```

## SDK usage

```html
<script src="https://unpkg.com/flaregun/dist/flaregun.iife.js"></script>
<script>
  Flaregun.init({
    endpoint: 'https://your-worker.your-subdomain.workers.dev/api/errors',
    projectId: 'my-app'
  });
</script>
```

Or with a bundler:

```js
import { init } from 'flaregun';

init({
  endpoint: '/api/errors',
  projectId: 'my-app'
});
```

## Deploy

### Worker

```bash
cd packages/worker
# Edit wrangler.toml if needed
npx wrangler deploy
```

### Dashboard

Set env vars in `.dev.vars` or via `wrangler pages secret put`:

- `CF_ACCOUNT_ID` — your Cloudflare account ID
- `CF_API_TOKEN` — API token with Analytics Engine read access
- `AE_DATASET` — dataset name (default: `flaregun_errors`)

```bash
cd packages/dashboard
pnpm build
npx wrangler pages deploy ./build/client
```

## Privacy & GDPR

Flaregun is designed to minimize personal data collection:

- **No IP addresses stored** — `cf-connecting-ip` is used for rate limiting in-memory only, never persisted
- **No cookies, session IDs, or user identifiers**
- **User-Agent reduced** to browser family + version (e.g. "Chrome 121"), not stored raw
- **Query params stripped** from URLs before storage
- **Built-in PII scrubber** redacts emails, credit card numbers, and SSNs from error messages and stack traces before they leave the browser
- **90-day auto-deletion** via Analytics Engine's fixed retention

### `beforeSend` hook

For additional control, use `beforeSend` to filter or redact payloads:

```js
Flaregun.init({
  endpoint: '/api/errors',
  projectId: 'my-app',
  beforeSend(payload) {
    // Drop errors from specific pages
    if (payload.url.includes('/admin')) return null;

    // Redact custom patterns
    payload.message = payload.message.replace(/user_\w+/gi, '[REDACTED]');
    return payload;
  }
});
```

Return `null` to drop the error entirely.

### Limitations

- **No individual data deletion** — Analytics Engine has no API to delete specific data points. The 90-day retention is the only deletion mechanism. If you need Article 17 compliance on demand, gate Flaregun behind a consent banner or use CF Access.
- **URL path segments** may contain identifiers (e.g. `/users/john`). Use `beforeSend` to strip them if needed.

## AE limits

| | Free | Paid |
|---|---|---|
| Data points/day | 100k | 10M/month included |
| Retention | 90 days | 90 days |
| SQL queries | 1M/month | 1M/month |

## License

MIT
