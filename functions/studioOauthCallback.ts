// the publish glue, oauth callback: instagram redirects here with the
// authorization code. this function exchanges the code for the access
// token (the app secret stays server-side), fetches the account id and
// username, and returns a page that postMessages the connection back to
// the studiogram artifact window that opened the dialog.
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
  if (error) return respond("instagram", { state, ok: false, reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return respond("instagram", { state, ok: false, reason: "no authorization code in the callback" });

  const appId = Deno.env.get("STUDIOGRAM_META_APP_ID") || "";
  const appSecret = Deno.env.get("STUDIOGRAM_META_APP_SECRET") || "";
  if (!appId || !appSecret) return respond("instagram", { state, ok: false, reason: "the instagram app is not configured (missing secrets)" });

  // the exchange's redirect_uri must match the one the authorize dialog
  // used: the canonical public host, never the internal dispatcher origin
  const redirectUri = "https://superagent-9bbbac66.base44.app/functions/studioOauthCallback";
  const body = new URLSearchParams({
    client_id: appId, client_secret: appSecret, grant_type: "authorization_code",
    redirect_uri: redirectUri, code,
  });
  const tokRes = await fetch("https://graph.instagram.com/v26.0/oauth/access_token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const tok = await tokRes.json();
  if (!tokRes.ok || !tok.access_token) {
    const detail = tok.error_message || tok.error?.error_message || tok.error || "unknown error";
    return respond("instagram", { state, ok: false, reason: "token exchange failed: " + (typeof detail === "string" ? detail : JSON.stringify(detail)) });
  }
  const meRes = await fetch(`https://graph.instagram.com/v26.0/me?fields=user_id,username&access_token=${tok.access_token}`);
  const me = await meRes.json();
  if (!meRes.ok) return respond("instagram", { state, ok: false, reason: "could not read the connected account" });
  return respond("instagram", { state,
    ok: true,
    access_token: tok.access_token,
    ig_id: String(me.user_id ?? me.id ?? ""),
    username: me.username || "",
  });
});
