// the video share glue, chunked upload: a rendered take can exceed a
// single request body, so the studio slices the mp4 into base64
// chunks and posts each one to this endpoint; every chunk lands in
// its own StudioVideo row, ordered by chunk_index, and studioVideo
// streams the rows back as one file with range support.
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
  const need = ["video_id", "rec_name", "mime", "bytes_total", "chunk_index", "chunk_total", "data_base64"];
  if (!b || need.some((k) => b[k] === undefined || b[k] === null)) {
    return new Response(JSON.stringify({ error: "chunk fields required: " + need.join(", ") }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const mime = String(b.mime);
  // browsers attach codec parameters (video/mp4; codecs=...); match
  // the container, not the full string
  if (!/^video\/(mp4|webm|quicktime)(;|$)/.test(mime)) {
    return new Response(JSON.stringify({ error: "unsupported container: " + mime }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const chunkTotal = Number(b.chunk_total), chunkIndex = Number(b.chunk_index);
  if (!Number.isInteger(chunkTotal) || chunkTotal < 1 || chunkTotal > 100 ||
      !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= chunkTotal ||
      Number(b.bytes_total) < 1 || !String(b.data_base64)) {
    return new Response(JSON.stringify({ error: "chunk shape invalid" }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const base44 = createClientFromRequest(req);
  const rec = await base44.asServiceRole.entities.StudioVideo.create({
    video_id: String(b.video_id),
    rec_name: String(b.rec_name),
    mime,
    fmt: String(b.fmt || "mp4"),
    width: Number(b.width) || 0,
    height: Number(b.height) || 0,
    duration_ms: Number(b.duration_ms) || 0,
    bytes_total: Number(b.bytes_total),
    chunk_index: chunkIndex,
    chunk_total: chunkTotal,
    data_base64: String(b.data_base64),
    created_utc: new Date().toISOString(),
  });
  return new Response(JSON.stringify({ ok: true, video_id: rec.video_id, chunk_index: rec.chunk_index }), {
    status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
});
