// the publish glue, config side: tells the studio artifact whether the
// instagram oauth app is configured and where the dialog should send the
// code. the app id is public; the secret never leaves the backend.
// spec: spec/social-commerce-publish.md
// the canonical public host of this app's functions: the origin inside the
// dispatcher is an internal worker host, but the oauth redirect uri and the
// photo urls must be the public, stable, registered-once form
const PUBLIC_BASE = "https://superagent-9bbbac66.base44.app";

Deno.serve(async (req) => {
  const appId = Deno.env.get("STUDIOGRAM_META_APP_ID") || "";
  const redirectUri = `${PUBLIC_BASE}/functions/studioOauthCallback`;
  return new Response(
    JSON.stringify({
      configured: Boolean(appId),
      app_id: appId,
      redirect_uri: redirectUri,
      authorize_url: appId
        ? `https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=instagram_business_basic,instagram_business_content_publish`
        : null,
    }, null, 2),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
