// the video share glue, share ledger: every successful share (hosted
// link or vimeo push) lands here so attribution survives the browser
// session, written as a StudioPublishedSet row the same way the
// photo publish path records its posts.
// contract: socmed-integration/api/video-publish-api.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  // the cors preflight: the studio page fetches cross-origin with a
  // json body, so browsers send an options check first; answer it or
  // every real post dies before reaching this function.
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "content-type,range,authorization",
        "access-control-allow-methods": "GET,POST,HEAD,OPTIONS",
        "access-control-max-age": "86400",
      },
    });
  }
  const b = await req.json().catch(() => null);
  if (!b || !b.provider || !b.name || !b.permalink) {
    return new Response(JSON.stringify({ error: "provider, name, permalink required" }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  if (b.provider !== "link" && b.provider !== "vimeo") {
    return new Response(JSON.stringify({ error: "unknown provider: " + b.provider }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const base44 = createClientFromRequest(req);
  const rec = await base44.asServiceRole.entities.StudioPublishedSet.create({
    set_name: String(b.name),
    caption: "",
    post_id: (b.meta && b.meta.video_id) ? String(b.meta.video_id) : "",
    permalink: String(b.permalink),
    products_json: JSON.stringify({ kind: "video-share", provider: b.provider, ...(b.meta || {}) }),
    connected_username: b.connected_username ? String(b.connected_username) : "",
    photo_count: 0,
    created_utc: new Date().toISOString(),
  });
  return new Response(JSON.stringify({ ok: true, id: rec.id }), {
    status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
});
