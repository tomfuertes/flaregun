export interface FlaregunPayload {
  fingerprint: string;
  message: string;
  stack: string;
  url: string;
  type: string;
  projectId: string;
}

export interface FlaregunConfig {
  endpoint: string;
  projectId: string;
  beforeSend?: (payload: FlaregunPayload) => FlaregunPayload | null;
}

interface QueuedError {
  t: string;
  m: string;
  s: string;
  u: string;
}

interface FlaregunGlobal {
  c: FlaregunConfig | null;
  q: QueuedError[];
}

declare global {
  interface Window {
    __fg?: FlaregunGlobal;
  }
}

let config: FlaregunConfig | null = null;

function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function topFrame(stack?: string): string {
  if (!stack) return "";
  const lines = stack.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("at ") || trimmed.match(/^\w+@/)) return trimmed;
  }
  return lines[1]?.trim() ?? "";
}

const R = "[REDACTED]";
const PII: RegExp[] = [
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,
  /\b(?:\d[ \-]*?){13,19}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  /Bearer\s+[A-Za-z0-9_\-.~+/]+=*/gi,
  /(?:api[_-]?key|api[_-]?secret|access[_-]?token|auth[_-]?token|secret[_-]?key|private[_-]?key)['":\s=]+[A-Za-z0-9_\-.]{8,}/gi,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /(?:\/home\/|\/Users\/|C:\\Users\\)[^\s/\\]+/g,
];

function scrub(s: string): string {
  for (const p of PII) s = s.replace(p, R);
  return s;
}

function send(payload: FlaregunPayload) {
  if (!config) return;

  payload.message = scrub(payload.message);
  payload.stack = scrub(payload.stack);
  payload.url = scrub(payload.url);

  if (config.beforeSend) {
    const result = config.beforeSend(payload);
    if (result === null) return;
    payload = result;
  }

  const body = JSON.stringify(payload);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(config.endpoint, body);
  } else {
    fetch(config.endpoint, { method: "POST", body, keepalive: true });
  }
}

function onError(event: ErrorEvent) {
  const { message, error } = event;
  const stack = error?.stack ?? "";
  const fp = hash(message + topFrame(stack));

  send({
    fingerprint: fp,
    message: message?.slice(0, 256) ?? "Unknown error",
    stack,
    url: location.origin + location.pathname,
    type: "error",
    projectId: config!.projectId,
  });
}

function onRejection(event: PromiseRejectionEvent) {
  const reason = event.reason;
  const message =
    reason instanceof Error ? reason.message : String(reason ?? "");
  const stack = reason instanceof Error ? reason.stack ?? "" : "";
  const fp = hash(message + topFrame(stack));

  send({
    fingerprint: fp,
    message: message.slice(0, 256),
    stack,
    url: location.origin + location.pathname,
    type: "unhandledrejection",
    projectId: config!.projectId,
  });
}

export function init(cfg: FlaregunConfig) {
  config = cfg;

  // Drain queued errors from inline snippet
  const fg = window.__fg;
  if (fg?.q) {
    for (const e of fg.q) {
      send({
        fingerprint: hash(e.m + topFrame(e.s)),
        message: e.m.slice(0, 256),
        stack: e.s,
        url: e.u,
        type: e.t,
        projectId: cfg.projectId,
      });
    }
    fg.q.length = 0;
  }

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
}

export function destroy() {
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
  config = null;
}

// Auto-init when loaded deferred with inline snippet
if (typeof window !== "undefined" && window.__fg?.c) {
  init(window.__fg.c);
}
