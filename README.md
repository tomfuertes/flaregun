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

## AE limits

| | Free | Paid |
|---|---|---|
| Data points/day | 100k | 10M/month included |
| Retention | 90 days | 90 days |
| SQL queries | 1M/month | 1M/month |

## License

MIT
