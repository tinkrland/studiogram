// the video share glue, vimeo oauth callback: vimeo redirects here
// with the authorization code. this function exchanges the code for
// the access token (basic auth, the app secret stays server-side),
// reads the connected account, and returns a page that postMessages
// the connection back to the studiogram window, tagged
// provider: "vimeo".
// contract: vimeo oauth: post https://api.vimeo.com/oauth/access_token,
// json body grant_type authorization_code, bearer token in response.
// socmed-integration/api/video-publish-api.md
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
  const error = u.searchParams.get("error") || u.searchParams.get("error_description");
  if (error) return respond("vimeo", { state, ok: false, provider: "vimeo", reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return respond("vimeo", { state, ok: false, provider: "vimeo", reason: "no authorization code in the callback" });

  const clientId = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) {
    return respond("vimeo", { state, ok: false, provider: "vimeo", reason: "the vimeo app is not configured (missing secrets)" });
  }

  const tokRes = await fetch("https://api.vimeo.com/oauth/access_token", {
    method: "POST",
    headers: {
      "authorization": "Basic " + btoa(clientId + ":" + clientSecret),
      "content-type": "application/json",
      "accept": "application/vnd.vimeo.*+json;version=3.4",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: "https://superagent-9bbbac66.base44.app/functions/studioVimeoCallback",
    }),
  });
  const tok = await tokRes.json().catch(() => ({}));
  if (!tokRes.ok || !tok.access_token) {
    return respond("vimeo", { state, ok: false, provider: "vimeo", reason: "token exchange failed: " + (tok.error || "http " + tokRes.status) });
  }
  return respond("vimeo", { state,
    ok: true,
    provider: "vimeo",
    token: tok.access_token,
    name: (tok.user && tok.user.name) || "vimeo account",
    link: (tok.user && tok.user.link) || null,
  });
});
