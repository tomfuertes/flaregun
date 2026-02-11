import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { getErrorDetail } from "../lib/ae.server";
import { getAEConfig } from "../lib/config.server";

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const fingerprint = params.id!;
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "24h";
  const config = getAEConfig(context);
  const detail = await getErrorDetail(config, fingerprint, range);

  if (!detail) {
    throw new Response("Not Found", { status: 404 });
  }

  return json({ detail, range });
}

const RANGES = ["1h", "24h", "7d", "30d"] as const;

function Sparkbar({
  data,
}: {
  data: { bucket: string; count: number }[];
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-px h-16">
      {data.map((d, i) => (
        <div
          key={i}
          className="bg-orange-500/80 rounded-t flex-1 min-w-[3px]"
          style={{ height: `${max > 0 ? (d.count / max) * 100 : 0}%` }}
          title={`${d.bucket}: ${d.count}`}
        />
      ))}
    </div>
  );
}

function Breakdown({
  title,
  items,
  labelKey,
}: {
  title: string;
  items: { count: number; [key: string]: string | number }[];
  labelKey: string;
}) {
  const total = items.reduce((s, i) => s + Number(i.count), 0);
  return (
    <div>
      <h4 className="text-zinc-500 text-xs uppercase tracking-wide mb-2">
        {title}
      </h4>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="flex-1 truncate">{String(item[labelKey])}</div>
            <div className="text-zinc-500 font-mono text-xs">
              {Number(item.count).toLocaleString()}
            </div>
            <div className="w-20 bg-zinc-800 rounded-full h-1.5">
              <div
                className="bg-orange-500 rounded-full h-1.5"
                style={{
                  width: `${total > 0 ? (Number(item.count) / total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ErrorDetail() {
  const { detail, range } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          to={`/?range=${range}`}
          className="text-zinc-500 hover:text-zinc-300"
        >
          ← Back
        </Link>
        <div className="flex gap-1 ml-auto">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setSearchParams({ range: r })}
              className={`px-3 py-1 text-sm rounded ${
                r === range
                  ? "bg-orange-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-bold text-orange-400 mb-2 break-words">
          {detail.message}
        </h2>
        <div className="flex gap-6 text-sm text-zinc-500 mb-4">
          <span>
            <span className="font-mono text-zinc-300">
              {detail.count.toLocaleString()}
            </span>{" "}
            occurrences
          </span>
          <span>First: {new Date(detail.firstSeen).toLocaleString()}</span>
          <span>Last: {new Date(detail.lastSeen).toLocaleString()}</span>
        </div>
        {detail.stack && (
          <pre className="bg-zinc-950 border border-zinc-800 rounded p-4 text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap">
            {detail.stack}
          </pre>
        )}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
        <h3 className="text-sm font-bold text-zinc-400 mb-3">
          Errors over time
        </h3>
        <Sparkbar data={detail.timeseries} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <Breakdown title="Pages" items={detail.urls} labelKey="url" />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <Breakdown
            title="Browsers"
            items={detail.browsers}
            labelKey="browser"
          />
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <Breakdown title="OS" items={detail.oses} labelKey="os" />
        </div>
      </div>

      <div className="text-xs text-zinc-600 mt-4 font-mono">
        fingerprint: {detail.fingerprint}
      </div>
    </div>
  );
}
