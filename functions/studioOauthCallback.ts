// the publish glue, oauth callback: instagram redirects here with the
// authorization code. this function exchanges the code for the access
// token (the app secret stays server-side), fetches the account id and
// username, and returns a page that postMessages the connection back to
// the studiogram artifact window that opened the dialog.
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
  if (error) return close({ ok: false, reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return close({ ok: false, reason: "no authorization code in the callback" });

  const appId = Deno.env.get("STUDIOGRAM_META_APP_ID") || "";
  const appSecret = Deno.env.get("STUDIOGRAM_META_APP_SECRET") || "";
  if (!appId || !appSecret) return close({ ok: false, reason: "the instagram app is not configured (missing secrets)" });

  const redirectUri = `${u.origin}/functions/studioOauthCallback`;
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
    return close({ ok: false, reason: "token exchange failed: " + (tok.error_message || tok.error || "unknown error") });
  }
  const meRes = await fetch(`https://graph.instagram.com/v26.0/me?fields=user_id,username&access_token=${tok.access_token}`);
  const me = await meRes.json();
  if (!meRes.ok) return close({ ok: false, reason: "could not read the connected account" });
  return close({
    ok: true,
    access_token: tok.access_token,
    ig_id: String(me.user_id ?? me.id ?? ""),
    username: me.username || "",
  });
});
