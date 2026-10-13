// the pinterest publish glue, product tags: the differentiator. the
// v5 api can tag catalog product pins onto a hero pin (post
// /pins/{pin_id}/product_tags, 1 to 24 items, each a product pin id
// the catalog feed created), which closes the loop instagram's api
// cannot: shoppable pins with no in-app handoff. this function ships
// ahead of the catalog; the studio calls it once product pins exist.
// contract: ProductTagsBulkAddRequest, max 24 items.
// spec: spec/social-commerce-publish.md
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "post the product tag payload" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const token = String((body || {}).access_token || "");
  const pinId = String((body || {}).pin_id || "");
  const productPinIds = Array.isArray((body || {}).product_pin_ids) ? body.product_pin_ids : [];
  if (!token || !pinId) {
    return new Response(JSON.stringify({ error: "not connected: access_token and pin_id are required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (productPinIds.length < 1 || productPinIds.length > 24) {
    return new Response(JSON.stringify({ error: "product tags take 1 to 24 product pin ids" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const res = await fetch(`https://api.pinterest.com/v5/pins/${pinId}/product_tags`, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ product_tags: productPinIds.map((id) => ({ pin_id: String(id) })) }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof (data.message || data.error) === "string" ? (data.message || data.error) : JSON.stringify(data.message || data.error || res.status);
    return new Response(JSON.stringify({ error: "pinterest refused the product tags: " + msg }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, tagged: productPinIds.length }, null, 2), {
    status: 200, headers: { "content-type": "application/json" },
  });
});
