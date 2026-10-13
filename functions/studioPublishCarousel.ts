// the publish glue, the instagram side: receives the caption, the
// per-photo children (uploaded jpeg urls plus their product bindings),
// and the session access token; creates the child containers, the
// carousel container, and publishes. shopping tags are not supported
// by the instagram publishing api (meta's docs, 2026-06-30), so the
// per-photo product list is returned for in-app tagging and recorded
// with the publish for audit.
// spec: spec/social-commerce-publish.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const IG = "https://graph.instagram.com/v26.0";
const captionFor = (c) => c.slice(0, 2200);

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "post the publish payload" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const token = String(body.access_token || "");
  const igId = String(body.ig_id || "");
  const set = String(body.set_name || "");
  const caption = captionFor(String(body.caption || ""));
  const children = Array.isArray(body.children) ? body.children : [];
  if (!token || !igId) {
    return new Response(JSON.stringify({ error: "not connected: access_token and ig_id are required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  if (children.length < 1 || children.length > 10) {
    return new Response(JSON.stringify({ error: "an instagram carousel takes 1 to 10 children" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  for (const c of children) {
    if (!c.url) {
      return new Response(JSON.stringify({ error: "every child needs an uploaded image url" }), { status: 400, headers: { "content-type": "application/json" } });
    }
  }

  const ig = async (path, params) => {
    const res = await fetch(`${IG}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(params),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.error_user_msg || json.error?.message || `graph api ${res.status} on ${path}`);
    }
    return json;
  };

  try {
    // child containers (is_carousel_item), then the carousel, then publish
    const childIds = [];
    for (const c of children) {
      const child = await ig(`${igId}/media`, { image_url: c.url, is_carousel_item: true });
      childIds.push(child.id);
    }
    const parent = await ig(`${igId}/media`, {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
    });
    const published = await ig(`${igId}/media_publish`, { creation_id: parent.id });

    // record the publish for audit: the composed caption, the permalink,
    // and the per-photo product bindings to tag in the app
    let permalink = published.permalink || "";
    if (!permalink && published.id) {
      try {
        const meta = await (await fetch(`${IG}/${published.id}?fields=permalink&access_token=${token}`)).json();
        permalink = meta.permalink || "";
      } catch (e) { /* permalink is a convenience, not a requirement */ }
    }
    await base44.asServiceRole.entities.StudioPublishedSet.create({
      set_name: set,
      connected_username: String(body.username || ""),
      caption,
      permalink,
      post_id: String(published.id || ""),
      photo_count: children.length,
      products_json: JSON.stringify(children.map((c) => ({ url: c.url, products: c.products || [] }))),
      created_utc: new Date().toISOString(),
    });
    return new Response(JSON.stringify({
      ok: true,
      post_id: published.id || null,
      permalink,
      // instagram's publishing api cannot set shopping tags: this list is
      // what to tag in the instagram app, per carousel position
      tag_list: children.map((c, i) => ({ position: i + 1, products: c.products || [] })),
    }, null, 2), { status: 200, headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e.message || e) }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
});
