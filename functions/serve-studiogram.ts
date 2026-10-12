// serves the studiogram first-pass build as a live page.
// the app itself is a single deterministic html file uploaded to public storage;
// this endpoint only sets the correct content type so browsers render it.
const PAGE_URL =
  "https://media.base44.com/files/public/6accc46c95021cc17a0bd7da/3f0e93d94_index.html";

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
    },
  });
});
