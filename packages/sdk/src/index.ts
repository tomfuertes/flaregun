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

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}\b/g,         // credit cards
  /\b\d{3}-\d{2}-\d{4}\b/g,                                   // SSNs
];

function scrubPII(str: string): string {
  let result = str;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

function send(payload: FlaregunPayload) {
  if (!config) return;

  payload.message = scrubPII(payload.message);
  payload.stack = scrubPII(payload.stack);

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
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
}

export function destroy() {
  window.removeEventListener("error", onError);
  window.removeEventListener("unhandledrejection", onRejection);
  config = null;
}
