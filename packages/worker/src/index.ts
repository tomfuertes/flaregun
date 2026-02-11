interface Env {
  ERRORS: AnalyticsEngineDataset;
  ALLOWED_ORIGINS: string;
}

interface ErrorPayload {
  fingerprint: string;
  message: string;
  stack?: string;
  url?: string;
  type?: string;
  projectId?: string;
}

const IP_COUNTS = new Map<string, { count: number; reset: number }>();
const RATE_LIMIT = 100; // per minute

function parseUA(ua: string): { browser: string; os: string } {
  let browser = "Unknown";
  let os = "Unknown";

  // Browser
  if (ua.includes("Firefox/")) {
    browser = "Firefox " + (ua.match(/Firefox\/(\d+)/)?.[1] ?? "");
  } else if (ua.includes("Edg/")) {
    browser = "Edge " + (ua.match(/Edg\/(\d+)/)?.[1] ?? "");
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome " + (ua.match(/Chrome\/(\d+)/)?.[1] ?? "");
  } else if (ua.includes("Safari/") && ua.includes("Version/")) {
    browser = "Safari " + (ua.match(/Version\/(\d+)/)?.[1] ?? "");
  }

  // OS
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser: browser.trim(), os };
}

function topFrames(stack: string, n = 3): string {
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("at ") || l.match(/^\w+@/))
    .slice(0, n)
    .join("\n");
}

function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url?.slice(0, 256) ?? "";
  }
}

function corsHeaders(origin: string, allowed: string): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (allowed === "*") {
    headers["Access-Control-Allow-Origin"] = "*";
  } else {
    const origins = allowed.split(",").map((o) => o.trim());
    if (origins.includes(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  }
  return headers;
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = IP_COUNTS.get(ip);
  if (!entry || now > entry.reset) {
    IP_COUNTS.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";
    const cors = corsHeaders(origin, env.ALLOWED_ORIGINS);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname !== "/api/errors" || request.method !== "POST") {
      return new Response("Not Found", { status: 404 });
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (rateLimit(ip)) {
      return new Response("Rate limited", { status: 429, headers: cors });
    }

    let payload: ErrorPayload;
    try {
      payload = await request.json();
    } catch {
      return new Response("Bad Request", { status: 400, headers: cors });
    }

    if (!payload.fingerprint || !payload.message) {
      return new Response("Missing fields", { status: 400, headers: cors });
    }

    const ua = request.headers.get("User-Agent") ?? "";
    const { browser, os } = parseUA(ua);

    env.ERRORS.writeDataPoint({
      blobs: [
        payload.fingerprint,
        payload.message.slice(0, 256),
        topFrames(payload.stack ?? ""),
        stripQuery(payload.url ?? ""),
        browser,
        os,
        payload.type ?? "error",
        payload.projectId ?? "default",
      ],
      doubles: [1],
    });

    return new Response(null, { status: 204, headers: cors });
  },
};
