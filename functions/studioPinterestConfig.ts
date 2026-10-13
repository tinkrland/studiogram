// the pinterest publish glue, config side: tells the studio artifact
// whether the pinterest oauth app is configured and where the dialog
// sends the code. the app id is public; the secret never leaves the
// backend. scopes cover boards (the pin needs one), pins, and the
// account read for the connected-username confirmation.
// spec: spec/social-commerce-publish.md
const PUBLIC_BASE = "https://superagent-9bbbac66.base44.app";

Deno.serve(async (req) => {
  const appId = Deno.env.get("STUDIOGRAM_PINTEREST_APP_ID") || "";
  const appSecret = Deno.env.get("STUDIOGRAM_PINTEREST_APP_SECRET") || "";
  const redirectUri = `${PUBLIC_BASE}/functions/studioPinterestCallback`;
  return new Response(
    JSON.stringify({
      configured: Boolean(appId && appSecret),
      app_id: appId,
      redirect_uri: redirectUri,
      authorize_url: appId
        ? `https://www.pinterest.com/oauth/?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=boards:read,boards:write,pins:read,pins:write,user_accounts:read`
        : null,
    }, null, 2),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
