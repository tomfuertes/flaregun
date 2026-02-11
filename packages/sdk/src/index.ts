export interface FlaregunConfig {
  endpoint: string;
  projectId: string;
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

function send(payload: Record<string, unknown>) {
  if (!config) return;
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

