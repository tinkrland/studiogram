// serves the studiogram first-pass build as a live page.
// the app itself is a single deterministic html file uploaded to public storage;
// this endpoint only sets the correct content type so browsers render it.
const PAGE_URL =
  "https://base44.app/api/apps/6ac24e708f39fb029bbbac66/files/mp/public/6ac24e708f39fb029bbbac66/11137f4a3_index.html";

Deno.serve(async (req) => {
  const upstream = await fetch(PAGE_URL, { cache: "no-store" });
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: "page source unavailable" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
  const page = await upstream.text();
  return new Response(page, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      // the edge injects script-src 'none' unless the response carries
      // its own policy; the artifact is one inline script, so allow it
      "content-security-policy":
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; " +
        "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
        "media-src 'self' blob: https:; connect-src 'self' https:; " +
        "font-src 'self' data:; worker-src blob:; frame-ancestors 'none'",
    },
  });
});
