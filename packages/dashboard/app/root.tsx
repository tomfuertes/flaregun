import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/cloudflare";
import stylesheet from "./tailwind.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

export default function App() {
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flaregun</title>
        <Meta />
        <Links />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen font-mono">
        <header className="border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
          <span className="text-orange-500 text-xl">🔫</span>
          <h1 className="text-lg font-bold tracking-tight">Flaregun</h1>
          <span className="text-zinc-500 text-sm ml-2">error tracking</span>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Outlet />
        </main>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
