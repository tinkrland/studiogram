// the publish glue, photo hosting: instagram publishing fetches media
// from a public https url (jpeg only), and the studio renders frames
// in the browser. this function stores a jpeg frame in the StudioPhoto
// entity and returns the public serve url that studioPhoto exposes.
// spec: spec/social-commerce-publish.md
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
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "post the jpeg frame to upload" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  const base44 = createClientFromRequest(req);
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const jpeg = String(body.jpeg_base64 || "");
  if (!jpeg) {
    return new Response(JSON.stringify({ error: "jpeg_base64 is required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  // 8 MB is instagram's per-image ceiling; refuse anything beyond it so
  // the endpoint cannot be used as a junk store
  if (jpeg.length > 11_000_000) {
    return new Response(JSON.stringify({ error: "frame exceeds the 8 MB limit" }), { status: 413, headers: { "content-type": "application/json" } });
  }
  const rec = await base44.asServiceRole.entities.StudioPhoto.create({
    jpeg_base64: jpeg,
    width: Number(body.width) || 0,
    height: Number(body.height) || 0,
    set_name: String(body.set_name || ""),
    created_utc: new Date().toISOString(),
  });
  return new Response(JSON.stringify({
    photo_id: rec.id,
    url: `https://superagent-9bbbac66.base44.app/functions/studioPhoto?id=${rec.id}`,
  }, null, 2), { status: 200, headers: { "content-type": "application/json" } });
});
