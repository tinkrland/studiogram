// the video share glue, vimeo oauth callback: vimeo redirects here
// with the authorization code. this function exchanges the code for
// the access token (basic auth, the app secret stays server-side),
// reads the connected account, and returns a page that postMessages
// the connection back to the studiogram window, tagged
// provider: "vimeo".
// contract: vimeo oauth: post https://api.vimeo.com/oauth/access_token,
// json body grant_type authorization_code, bearer token in response.
// socmed-integration/api/video-publish-api.md
const close = (payload) => new Response(
  `<!doctype html><html><body><script>
     window.opener && window.opener.postMessage(${JSON.stringify(payload)}, "*");
     window.close();
   </script></body></html>`,
  { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
);

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const error = u.searchParams.get("error") || u.searchParams.get("error_description");
  if (error) return close({ ok: false, provider: "vimeo", reason: "authorize refused: " + error });

  const code = u.searchParams.get("code");
  if (!code) return close({ ok: false, provider: "vimeo", reason: "no authorization code in the callback" });

  const clientId = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_SECRET") || "";
  if (!clientId || !clientSecret) {
    return close({ ok: false, provider: "vimeo", reason: "the vimeo app is not configured (missing secrets)" });
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
    return close({ ok: false, provider: "vimeo", reason: "token exchange failed: " + (tok.error || "http " + tokRes.status) });
  }
  return close({
    ok: true,
    provider: "vimeo",
    token: tok.access_token,
    name: (tok.user && tok.user.name) || "vimeo account",
    link: (tok.user && tok.user.link) || null,
  });
});
