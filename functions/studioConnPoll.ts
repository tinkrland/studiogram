// the connect handoff poll: the studio edge injects a script-src none
// content-security-policy on every function response, so the oauth
// callback pages can never run their postMessage scripts. the delivery
// that survives is server-side: the callback stores the connection in
// the StudioConnHandoff entity keyed by the one-time code the artifact
// generated for the oauth state, and this endpoint is what the artifact
// polls until the handoff lands (or the ttl passes).
// contract: socmed-integration/api/video-publish-api.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const HANDOFF_TTL_MS = 5 * 60 * 1000; // the user has 5 minutes to finish the dialog

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const provider = u.searchParams.get("provider") || "";
  const code = u.searchParams.get("code") || "";
  if (!provider || !code) {
    return new Response(JSON.stringify({ error: "provider and code are required" }), {
      status: 400, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const base44 = createClientFromRequest(req);
  let found = null;
  try {
    const list = await base44.asServiceRole.entities.StudioConnHandoff.filter({ provider, code }, "-created_date", 10);
    const rows = (list.records || list.items || list || []).filter((r) => r && r.payload_json);
    if (rows.length) {
      // newest first; drop any older duplicates from retried dialogs
      found = rows[0];
      try {
        await base44.asServiceRole.entities.StudioConnHandoff.delete(found.id);
      } catch (e) { /* consumed on read, best effort */ }
    }
  } catch (e) { /* filter or delete races surface as waiting */ }
  if (!found) {
    return new Response(JSON.stringify({ waiting: true }), {
      status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  const age = Date.now() - (Date.parse(found.created_utc || "") || 0);
  let payload = null;
  try { payload = JSON.parse(found.payload_json); } catch (e) { payload = null; }
  if (!payload || age > HANDOFF_TTL_MS) {
    return new Response(JSON.stringify({ ok: false, reason: "the connect handoff expired, try again" }), {
      status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
    });
  }
  return new Response(JSON.stringify({ ok: true, handoff: payload }), {
    status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
});
