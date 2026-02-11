// Flaregun inline snippet — paste in <head> before any other scripts.
// Captures errors into a queue until the full SDK loads via <script defer>.
// ~300 bytes minified.
(function (w, q) {
  w.__fg = { c: null, q: q };
  w.Flaregun = {
    init: function (c) {
      w.__fg.c = c;
    },
  };
  w.addEventListener("error", function (e) {
    q.push({
      t: "error",
      m: e.message || "",
      s: (e.error && e.error.stack) || "",
      u: location.origin + location.pathname,
    });
  });
  w.addEventListener("unhandledrejection", function (e) {
    var r = e.reason;
    q.push({
      t: "unhandledrejection",
      m: r instanceof Error ? r.message : String(r || ""),
      s: r instanceof Error ? r.stack || "" : "",
      u: location.origin + location.pathname,
    });
  });
})(window, []);
