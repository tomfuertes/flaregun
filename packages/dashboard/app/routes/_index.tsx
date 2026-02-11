import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { getErrorGroups } from "../lib/ae.server";
import { getAEConfig } from "../lib/config.server";

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const range = url.searchParams.get("range") ?? "24h";
  const config = getAEConfig(context);
  const groups = await getErrorGroups(config, range);
  return json({ groups, range });
}

const RANGES = ["1h", "24h", "7d", "30d"] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Index() {
  const { groups, range } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Errors</h2>
        <div className="flex gap-1">
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

      {groups.length === 0 ? (
        <div className="text-zinc-500 text-center py-20">
          <p className="text-lg">No errors in this time range.</p>
          <p className="text-sm mt-2">
            That's either really good news, or you haven't set up the SDK yet.
          </p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 text-left border-b border-zinc-800">
              <th className="pb-2 font-medium">Message</th>
              <th className="pb-2 font-medium text-right w-20">Count</th>
              <th className="pb-2 font-medium text-right w-28">First</th>
              <th className="pb-2 font-medium text-right w-28">Last</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr
                key={g.fingerprint}
                className="border-b border-zinc-800/50 hover:bg-zinc-900/50"
              >
                <td className="py-3 pr-4">
                  <Link
                    to={`/errors/${g.fingerprint}?range=${range}`}
                    className="text-orange-400 hover:text-orange-300 hover:underline"
                  >
                    {g.message.length > 80
                      ? g.message.slice(0, 80) + "…"
                      : g.message}
                  </Link>
                  <div className="text-zinc-600 text-xs mt-0.5 font-mono">
                    {g.fingerprint}
                  </div>
                </td>
                <td className="py-3 text-right font-mono text-zinc-300">
                  {g.count.toLocaleString()}
                </td>
                <td className="py-3 text-right text-zinc-500">
                  {timeAgo(g.firstSeen)}
                </td>
                <td className="py-3 text-right text-zinc-500">
                  {timeAgo(g.lastSeen)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
