// the video share glue, serving: reads the chunks of one video_id in
// chunk_index order, concatenates them, and streams the file with
// range support so hosted links play and seek in any browser. the
// videos are immutable per id, so caching is allowed.
// contract: socmed-integration/api/video-publish-api.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

Deno.serve(async (req) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "range,content-type",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "accept-ranges": "bytes",
  };
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  const vid = new URL(req.url).searchParams.get("vid");
  if (!vid) {
    return new Response(JSON.stringify({ error: "video id required" }), {
      status: 400, headers: { "content-type": "application/json", ...cors },
    });
  }
  const base44 = createClientFromRequest(req);
  // the sdk's filter call is positional: filter(query, sort, limit)
  // and the response unwraps to a { records } envelope
  let list;
  try {
    list = await base44.asServiceRole.entities.StudioVideo.filter({ video_id: vid }, "chunk_index", 100);
  } catch (e) {
    list = { records: [] };
  }
  const rows = (list.records || list.items || list || [])
    .filter((r) => r && r.data_base64)
    .sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));
  if (!rows.length) {
    return new Response(JSON.stringify({ error: "no such video" }), {
      status: 404, headers: { "content-type": "application/json", ...cors },
    });
  }
  const parts = rows.map((r) => Uint8Array.from(atob(r.data_base64), (c) => c.charCodeAt(0)));
  const total = parts.reduce((n, p) => n + p.length, 0);
  const whole = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { whole.set(p, off); off += p.length; }
  const mime = rows[0].mime || "video/mp4";
  const headers = { "content-type": mime, "cache-control": "public, max-age=3600", ...cors };

  const range = req.headers.get("range");
  const m = range && range.match(/^bytes=(\d*)-(\d*)$/);
  if (m) {
    let start = m[1] === "" ? null : Number(m[1]);
    let end = m[2] === "" ? null : Number(m[2]);
    if (start === null) { // suffix range: last N bytes
      const n = Number(m[2]);
      start = Math.max(0, total - n);
      end = total - 1;
    } else {
      if (start >= total) {
        return new Response(null, { status: 416, headers: { ...headers, "content-range": "bytes */" + total } });
      }
      if (end === null || end >= total) end = total - 1;
    }
    const body = whole.subarray(start, end + 1);
    return new Response(req.method === "HEAD" ? null : body, {
      status: 206,
      headers: {
        ...headers,
        "content-length": String(body.length),
        "content-range": "bytes " + start + "-" + end + "/" + total,
      },
    });
  }
  return new Response(req.method === "HEAD" ? null : whole, {
    status: 200, headers: { ...headers, "content-length": String(total) },
  });
});
