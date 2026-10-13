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
const close = (payload) => new Response(
  `<!doctype html><html><body><script>
     window.opener && window.opener.postMessage(${JSON.stringify(payload)}, "*");
     window.close();
   </script></body></html>`,
  { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
);

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const error = u.searchParams.get("error_description") || u.searchParams.get("error");
  if (error) return close({ ok: false, provider: "pinterest", reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return close({ ok: false, provider: "pinterest", reason: "no authorization code in the callback" });

  const appId = Deno.env.get("STUDIOGRAM_PINTEREST_APP_ID") || "";
  const appSecret = Deno.env.get("STUDIOGRAM_PINTEREST_APP_SECRET") || "";
  if (!appId || !appSecret) {
    return close({ ok: false, provider: "pinterest", reason: "the pinterest app is not configured (missing secrets)" });
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
    return close({ ok: false, provider: "pinterest", reason: "token exchange failed: " + msg });
  }

  const meRes = await fetch("https://api.pinterest.com/v5/user_account", {
    headers: { authorization: "Bearer " + tok.access_token },
  });
  const me = await meRes.json();
  if (!meRes.ok) return close({ ok: false, provider: "pinterest", reason: "could not read the connected account" });
  return close({
    ok: true,
    provider: "pinterest",
    access_token: tok.access_token,
    username: me.username || "",
  });
});
