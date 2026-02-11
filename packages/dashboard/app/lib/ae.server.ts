export interface AEConfig {
  accountId: string;
  apiToken: string;
  dataset: string;
}

interface AERow {
  [key: string]: string | number;
}

interface AEResponse {
  data: AERow[];
  meta: { name: string; type: string }[];
  rows: number;
}

export async function queryAE(
  config: AEConfig,
  sql: string
): Promise<AEResponse> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/analytics_engine/sql`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "text/plain",
    },
    body: sql,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AE query failed (${res.status}): ${text}`);
  }

  return res.json();
}

export interface ErrorGroup {
  fingerprint: string;
  message: string;
  stack: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export async function getErrorGroups(
  config: AEConfig,
  range: string = "24h"
): Promise<ErrorGroup[]> {
  const interval = rangeToInterval(range);
  const sql = `
    SELECT
      blob1 AS fingerprint,
      blob2 AS message,
      blob3 AS stack,
      SUM(double1) AS count,
      MIN(timestamp) AS firstSeen,
      MAX(timestamp) AS lastSeen
    FROM ${config.dataset}
    WHERE timestamp > NOW() - INTERVAL ${interval}
    GROUP BY fingerprint, message, stack
    ORDER BY count DESC
    LIMIT 50
  `;
  const result = await queryAE(config, sql);
  return result.data.map((row) => ({
    fingerprint: String(row.fingerprint),
    message: String(row.message),
    stack: String(row.stack),
    count: Number(row.count),
    firstSeen: String(row.firstSeen),
    lastSeen: String(row.lastSeen),
  }));
}

export interface ErrorDetail extends ErrorGroup {
  urls: { url: string; count: number }[];
  browsers: { browser: string; count: number }[];
  oses: { os: string; count: number }[];
  timeseries: { bucket: string; count: number }[];
}

export async function getErrorDetail(
  config: AEConfig,
  fingerprint: string,
  range: string = "24h"
): Promise<ErrorDetail | null> {
  const interval = rangeToInterval(range);

  const [groupRes, urlRes, browserRes, osRes, tsRes] = await Promise.all([
    queryAE(
      config,
      `SELECT blob1 AS fingerprint, blob2 AS message, blob3 AS stack,
              SUM(double1) AS count, MIN(timestamp) AS firstSeen, MAX(timestamp) AS lastSeen
       FROM ${config.dataset}
       WHERE blob1 = '${fingerprint}' AND timestamp > NOW() - INTERVAL ${interval}
       GROUP BY fingerprint, message, stack
       LIMIT 1`
    ),
    queryAE(
      config,
      `SELECT blob4 AS url, SUM(double1) AS count
       FROM ${config.dataset}
       WHERE blob1 = '${fingerprint}' AND timestamp > NOW() - INTERVAL ${interval}
       GROUP BY url ORDER BY count DESC LIMIT 10`
    ),
    queryAE(
      config,
      `SELECT blob5 AS browser, SUM(double1) AS count
       FROM ${config.dataset}
       WHERE blob1 = '${fingerprint}' AND timestamp > NOW() - INTERVAL ${interval}
       GROUP BY browser ORDER BY count DESC LIMIT 10`
    ),
    queryAE(
      config,
      `SELECT blob6 AS os, SUM(double1) AS count
       FROM ${config.dataset}
       WHERE blob1 = '${fingerprint}' AND timestamp > NOW() - INTERVAL ${interval}
       GROUP BY os ORDER BY count DESC LIMIT 10`
    ),
    queryAE(
      config,
      `SELECT toStartOfInterval(timestamp, INTERVAL '1' HOUR) AS bucket,
              SUM(double1) AS count
       FROM ${config.dataset}
       WHERE blob1 = '${fingerprint}' AND timestamp > NOW() - INTERVAL ${interval}
       GROUP BY bucket ORDER BY bucket ASC`
    ),
  ]);

  if (groupRes.data.length === 0) return null;

  const group = groupRes.data[0];
  return {
    fingerprint: String(group.fingerprint),
    message: String(group.message),
    stack: String(group.stack),
    count: Number(group.count),
    firstSeen: String(group.firstSeen),
    lastSeen: String(group.lastSeen),
    urls: urlRes.data.map((r) => ({
      url: String(r.url),
      count: Number(r.count),
    })),
    browsers: browserRes.data.map((r) => ({
      browser: String(r.browser),
      count: Number(r.count),
    })),
    oses: osRes.data.map((r) => ({
      os: String(r.os),
      count: Number(r.count),
    })),
    timeseries: tsRes.data.map((r) => ({
      bucket: String(r.bucket),
      count: Number(r.count),
    })),
  };
}

function rangeToInterval(range: string): string {
  switch (range) {
    case "1h":
      return "'1' HOUR";
    case "7d":
      return "'7' DAY";
    case "30d":
      return "'30' DAY";
    default:
      return "'24' HOUR";
  }
}
