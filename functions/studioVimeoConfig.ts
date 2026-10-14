// the video share glue, vimeo oauth config: tells the studio whether
// the owner's vimeo app secrets are set and hands the authorize url
// (code flow, scopes public edit upload) to the connect button. the
// client secret never reaches the browser.
// contract: socmed-integration/api/video-publish-api.md
const REDIRECT_URI = "https://superagent-9bbbac66.base44.app/functions/studioVimeoCallback";

Deno.serve(async (req) => {
  const clientId = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("STUDIOGRAM_VIMEO_CLIENT_SECRET") || "";
  const configured = Boolean(clientId && clientSecret);
  const body = { configured, redirect_uri: REDIRECT_URI, provider: "vimeo" };
  if (configured) {
    body.authorize_url = "https://api.vimeo.com/oauth/authorize?" + new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: "public edit upload",
      state: "studiogram",
    });
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
});
