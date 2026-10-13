// the pinterest publish glue, board list: the pin needs a board. this
// function proxies the v5 boards list (scopes boards:read) with
// bookmark pagination so the token never crosses a browser cors wall.
// contract: get /boards, page_size up to 250, bookmark cursor.
// spec: spec/social-commerce-publish.md
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "post the access token" }), {
      status: 405, headers: { "content-type": "application/json" },
    });
  }
  let body;
  try { body = await req.json(); } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json body" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const token = String((body || {}).access_token || "");
  if (!token) {
    return new Response(JSON.stringify({ error: "not connected: access_token is required" }), { status: 400, headers: { "content-type": "application/json" } });
  }
  const boards = [];
  let bookmark = "";
  for (let page = 0; page < 5; page++) { // 5 x 100 = enough for any studio shelf
    const url = "https://api.pinterest.com/v5/boards?page_size=100" + (bookmark ? "&bookmark=" + encodeURIComponent(bookmark) : "");
    const res = await fetch(url, { headers: { authorization: "Bearer " + token } });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "pinterest refused the boards list: " + (data.message || res.status) }), {
        status: 502, headers: { "content-type": "application/json" },
      });
    }
    for (const b of data.items || []) {
      boards.push({ id: b.id, name: b.name, pin_count: b.pin_count || 0 });
    }
    bookmark = data.bookmark || "";
    if (!bookmark) break;
  }
  return new Response(JSON.stringify({ boards }, null, 2), { status: 200, headers: { "content-type": "application/json" } });
});
