// the pinterest publish glue, oauth callback: pinterest redirects here
// with the authorization code. this function exchanges the code for the
// access token (the app secret stays server-side, basic auth to the
// v5 token endpoint), reads the connected account, and returns a page
// that postMessages the connection back to the studiogram window that
// opened the dialog, tagged provider: "pinterest".
// contract: pinterest openapi v5 (5.28.0): post /oauth/token, form
// encoded, grant_type authorization_code; apps created after
// 2025-09-25 receive a continuous refresh token automatically.
// spec: spec/social-commerce-publish.md
import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

// the studio edge injects a script-src none csp on every function
// response, so this page cannot rely on scripts: the connection is
// delivered by storing it as a StudioConnHandoff row keyed by the
// one-time code the artifact sent as the oauth state, which the
// artifact polls for via studioConnPoll. the inline postMessage
// stays as a no-op fallback in case the edge policy ever relaxes.
const render = (payload) => `<!doctype html><html><body>
  <p style="font: 15px system-ui; padding: 24px;">${payload.ok
    ? "connected as " + (payload.username || payload.name || "your account") + ". you can close this window and return to the studio."
    : "the connect did not complete: " + (payload.reason || "unknown error")}</p>
  <script>
    window.opener && window.opener.postMessage(${JSON.stringify(payload)}, "*");
  </script></body></html>`;

const respond = async (provider, payload, base44) => {
  const state = payload.state;
  if (state && base44) {
    try {
      await base44.asServiceRole.entities.StudioConnHandoff.create({
        provider, code: state,
        payload_json: JSON.stringify(payload),
        created_utc: new Date().toISOString(),
      });
    } catch (e) { /* the poll surfaces waiting until the ttl */ }
  }
  return new Response(render(payload), {
    status: 200, headers: { "content-type": "text/html; charset=utf-8" },
  });
};

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const u = new URL(req.url);
  const state = u.searchParams.get("state") || "";
  const error = u.searchParams.get("error_description") || u.searchParams.get("error");
  if (error) return respond("pinterest", { state, ok: false, provider: "pinterest", reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return respond("pinterest", { state, ok: false, provider: "pinterest", reason: "no authorization code in the callback" });

  const appId = Deno.env.get("STUDIOGRAM_PINTEREST_APP_ID") || "";
  const appSecret = Deno.env.get("STUDIOGRAM_PINTEREST_APP_SECRET") || "";
  if (!appId || !appSecret) {
    return respond("pinterest", { state, ok: false, provider: "pinterest", reason: "the pinterest app is not configured (missing secrets)" });
  }

  // the exchange's redirect_uri must match the authorize dialog's
  // canonical public host, never the internal dispatcher origin
  const redirectUri = "https://superagent-9bbbac66.base44.app/functions/studioPinterestCallback";
  const tokRes = await fetch("https://api.pinterest.com/v5/oauth/token", {
    method: "POST",
    headers: {
      "authorization": "Basic " + btoa(appId + ":" + appSecret),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  });
  const tok = await tokRes.json();
  if (!tokRes.ok || !tok.access_token) {
    const msg = typeof (tok.message || tok.error) === "string" ? (tok.message || tok.error) : JSON.stringify(tok.message || tok.error || tok);
    return respond("pinterest", { state, ok: false, provider: "pinterest", reason: "token exchange failed: " + msg });
  }

  const meRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { authorization: "Bearer " + tok.access_token },
  });
  const me = await meRes.json();
  if (!meRes.ok) return respond("pinterest", { state, ok: false, provider: "pinterest", reason: "could not read the connected account" });
  return respond("pinterest", { state,
    ok: true,
    provider: "pinterest",
    access_token: tok.access_token,
    username: me.username || "",
  });
});
