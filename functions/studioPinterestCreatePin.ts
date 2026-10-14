// the pinterest publish glue, pin create: receives the session access
// token, the target board, the pin text, and the per-photo items
// (uploaded public jpeg urls plus their listing links). builds the
// media_source the v5 spec defines: one image = image_url, two to five
// = multiple_image_urls with a per-image link, so each photo's listing
// pdp is that image's destination. records the publish in
// StudioPublishedSet with the connected username for attribution.
// contract: post /pins, scopes boards:read/write pins:read/write;
// title 100, description 800, alt_text 500, link 2048.
// spec: spec/social-commerce-publish.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const clamp = (s, n) => String(s || "").slice(0, n);

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
  const base44 = createClientFromRequest(req);
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "post the pin payload" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const token = String((body || {}).access_token || "");
  const boardId = String((body || {}).board_id || "");
  const items = Array.isArray((body || {}).images) ? body.images : [];
  if (!token || !boardId) {
    return new Response(JSON.stringify({ error: "not connected: access_token and board_id are required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (items.length < 1 || items.length > 5) {
    return new Response(JSON.stringify({ error: "a pin takes 1 to 5 images (pinterest v5 caps multiple_image_urls at 5)" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  for (const it of items) {
    if (!it.url) {
      return new Response(JSON.stringify({ error: "every image needs an uploaded url" }), { status: 400, headers: { "content-type": "application/json" } });
    }
  }

  // media_source per the v5 spec: single image vs the 2-5 multi-image
  // variant with per-image title, description, and destination link
  const media_source = items.length === 1
    ? { source_type: "image_url", url: items[0].url, is_standard: true }
    : { source_type: "multiple_image_urls", items: items.map((it) => ({
        url: it.url,
        title: clamp(it.title, 100),
        description: clamp(it.description, 800),
        link: clamp(it.link, 2048) || undefined,
      })) };

  const payload = {
    board_id: boardId,
    title: clamp(body.title, 100),
    description: clamp(body.description, 800),
    alt_text: clamp(body.alt_text, 500),
    link: clamp(body.link, 2048) || undefined,
    media_source,
  };

  const res = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const pin = await res.json();
  if (!res.ok || !pin.id) {
    const msg = typeof (pin.message || pin.error) === "string" ? (pin.message || pin.error) : JSON.stringify(pin.message || pin.error || pin);
    return new Response(JSON.stringify({ error: "pinterest refused the pin: " + msg }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }

  // audit trail, same discipline as the instagram publish
  try {
    await base44.asServiceRole.entities.StudioPublishedSet.create({
      set_name: String(body.set_name || ""),
      caption: clamp(body.description, 800),
      connected_username: String(body.username || ""),
      post_id: String(pin.id),
      permalink: `https://www.pinterest.com/pin/${pin.id}/`,
      photo_count: items.length,
      products_json: JSON.stringify(items.map((it) => it.products || [])),
      created_utc: new Date().toISOString(),
    });
  } catch (e) { /* the pin is live; the record is best-effort */ }

  return new Response(JSON.stringify({
    ok: true,
    pin_id: String(pin.id),
    url: `https://www.pinterest.com/pin/${pin.id}/`,
  }, null, 2), { status: 200, headers: { "content-type": "application/json" } });
});
