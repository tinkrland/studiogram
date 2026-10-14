// the publish glue, photo serving: instagram's servers fetch media from
// the public url that studioUploadPhoto returns. this endpoint reads the
// id from the query string (instagram cannot post a body), loads the
// StudioPhoto record, and returns the jpeg bytes with the content type.
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
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "photo id required" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
  const base44 = createClientFromRequest(req);
  let rec = null;
  try { rec = await base44.asServiceRole.entities.StudioPhoto.get(id); } catch (e) { rec = null; }
  if (!rec || !rec.jpeg_base64) {
    return new Response(JSON.stringify({ error: "no such photo" }), {
      status: 404, headers: { "content-type": "application/json" },
    });
  }
  const bytes = Uint8Array.from(atob(rec.jpeg_base64), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    status: 200,
    headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
  });
});
