// ===== the pinterest publish glue: shoppable pins, end to end =====
// spec: [../spec/social-commerce-publish.md]. mirrors the instagram
// glue (98): connect through the backend (secret stays server-side,
// token in sessionStorage for the tab session only), pick a board,
// publish the active set as one multi-image pin (2 to 5 images, per
// image its listing pdp as the link, per the v5 openapi contract).
// the difference that matters: pinterest's api can also tag catalog
// product pins onto the hero pin, so no in-app handoff list is
// needed; the product-tag call ships as a backend function and the
// ui lights up once the catalog feed produces product pins.

const PIN_CONN_KEY = "studiogram-pinterest-conn"; // session only

let PIN_RESULT = null; // the last pinterest publish, module memory only
let PIN_BOARDS = null; // cached board list, refetched on connect

function pinConn() {
  try { return JSON.parse(sessionStorage.getItem(PIN_CONN_KEY) || "null"); } catch (e) { return null; }
}
function pinConnSave(c) {
  c ? sessionStorage.setItem(PIN_CONN_KEY, JSON.stringify(c)) : sessionStorage.removeItem(PIN_CONN_KEY);
}

// connect: the config endpoint builds the authorize url (scopes
// boards + pins + user_account read); the popup postMessages the
// connection back, tagged provider: "pinterest".
function connectPinterest() {
  fetch(PUBLISH_BASE + "/studioPinterestConfig")
    .then((r) => r.json())
    .then((cfg) => {
      if (!cfg.configured) { toast("pinterest publishing is not configured yet: the app secrets are missing"); return; }
      connectHandoff("pinterest", cfg.authorize_url, (h) => {
        pinConnSave({ access_token: h.access_token, username: h.username });
        PIN_BOARDS = null; // refetch for the new connection
        toast("pinterest connected" + (h.username ? " as " + h.username : ""));
      });
    })
    .catch(() => toast("could not reach the publish backend"));
}
window.addEventListener("message", (e) => {
  if (!e.data || e.data.provider !== "pinterest" || typeof e.data.ok !== "boolean") return;
  if (e.data.ok) {
    pinConnSave({ access_token: e.data.access_token, username: e.data.username });
    PIN_BOARDS = null; // refetch for the new connection
    toast("pinterest connected" + (e.data.username ? " as " + e.data.username : ""));
    renderCaptureStrip();
  } else {
    toast("pinterest connect failed: " + (e.data.reason || "unknown error"));
  }
});

// the board list through the backend proxy (the token never crosses a
// browser cors wall), cached until the next connect.
function loadBoards() {
  const conn = pinConn();
  if (!conn) return Promise.resolve([]);
  if (PIN_BOARDS) return Promise.resolve(PIN_BOARDS);
  return fetch(PUBLISH_BASE + "/studioPinterestBoards", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ access_token: conn.access_token }),
  })
    .then((r) => r.json())
    .then((res) => {
      PIN_BOARDS = res.boards || [];
      return PIN_BOARDS;
    })
    .catch(() => []);
}

// publish the active set: convert the photos to jpeg (pinterest takes
// public urls; the same studioPhoto hosting serves instagram), upload
// each, then one pin create with per-image listing links. v5 caps the
// multi-image pin at 5, so a larger set takes its first 5 photos and
// says so (a set can be split across pins by publishing in parts).
async function publishSetToPinterest() {
  const set = activeSet();
  const all = photosInSet(set);
  const photos = all.slice(0, 5);
  if (!photos.length) { toast("capture a photo first: publishing needs the active set"); return; }
  const conn = pinConn();
  if (!conn) { toast("connect pinterest first"); return; }
  if (!PIN_STATE.board_id) { toast("pick a board first"); return; }
  if (all.length > 5) toast(`pinterest caps a pin at 5 images: posting the first 5 of ${all.length}`);
  toast(`publishing "${set.name}": converting ${photos.length} frame${photos.length === 1 ? "" : "s"} to jpeg...`);
  const items = [];
  for (const photo of photos) {
    try {
      const b64 = await jpegFromPhoto(photo);
      const dims = photoDims(photo);
      const res = await fetch(PUBLISH_BASE + "/studioUploadPhoto", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jpeg_base64: b64, width: dims.width, height: dims.height, set_name: set.name }),
      }).then((r) => r.json());
      if (!res.url) { toast("upload failed for " + photo.name + (res.error ? ": " + res.error : "")); return; }
      const products = photoProducts(photo);
      items.push({
        url: res.url,
        title: (products[0] ? products[0].title : photo.name).slice(0, 100),
        description: altText(photo, products).slice(0, 800),
        link: products[0] ? products[0].pdp_url : "",
        products: products.map((p) => ({ sku: p.sku, title: p.title, pdp_url: p.pdp_url })),
      });
    } catch (e) { toast("publish stopped at " + photo.name + ": " + e.message); return; }
  }
  // composed, never authored: the unique bound titles plus the first
  // pdp, the same compose rule as the instagram caption, pinned to
  // pinterest's 800-character description ceiling
  const bound = photos.flatMap((p) => photoProducts(p));
  const titles = [...new Set(bound.map((p) => p.title))].map((t) => t.toLowerCase());
  let description = titles.length ? "new: " + titles.join(" / ") + "." : "";
  if (bound[0] && bound[0].pdp_url) description += (description ? " " : "") + bound[0].pdp_url;
  const payload = {
    access_token: conn.access_token,
    username: conn.username,
    board_id: PIN_STATE.board_id,
    set_name: set.name,
    title: set.name.slice(0, 100),
    description: description.slice(0, 800),
    alt_text: altText(photos[0], photoProducts(photos[0])).slice(0, 500),
    link: bound[0] ? bound[0].pdp_url : "",
    images: items,
  };
  toast("publishing the pin to pinterest...");
  try {
    const res = await fetch(PUBLISH_BASE + "/studioPinterestCreatePin", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    if (res.ok) {
      PIN_RESULT = { set: set.name, url: res.url, pin_id: res.pin_id, at: nowUtc() };
      toast("pinned: " + res.url);
      renderCaptureStrip();
    } else {
      toast("pin failed: " + (res.error || "unknown error"));
    }
  } catch (e) { toast("pin failed: " + e.message); }
}

// module state for the board pick; never app state, same discipline
// as the publish result memory above
const PIN_STATE = { board_id: "" };

// the pinterest row lives under the instagram row in the publish bar.
function renderPinterestBar() {
  const strip = $("#capstrip");
  let bar = $("#pinterestbar");
  if (bar) bar.remove();
  bar = el("div", "btnrow");
  bar.id = "pinterestbar";
  const conn = pinConn();
  const status = el("span", "cc-meta", conn ? "pinterest: " + (conn.username || "connected") : "pinterest: not connected");
  status.style.alignSelf = "center";
  bar.appendChild(status);
  const connBtn = el("button", "btn mini", conn ? "reconnect" : "connect pinterest");
  connBtn.title = "oauth the pinterest account through the backend (the token stays in this tab)";
  connBtn.addEventListener("click", connectPinterest);
  bar.appendChild(connBtn);
  if (conn) {
    const sel = el("select", "inp");
    sel.style.maxWidth = "180px";
    sel.appendChild(el("option", "", "pick a board...")).value = "";
    (PIN_BOARDS || []).forEach((b) => {
      const o = el("option", "", b.name + (b.pin_count ? " (" + b.pin_count + ")" : ""));
      o.value = b.id;
      sel.appendChild(o);
    });
    if (PIN_STATE.board_id) sel.value = PIN_STATE.board_id;
    sel.addEventListener("change", () => { PIN_STATE.board_id = sel.value; });
    bar.appendChild(sel);
    const pubBtn = el("button", "btn mini", "post set to pinterest");
    pubBtn.title = "publish the active set as a pin: 1-5 images, each bound photo links to its listing page";
    pubBtn.addEventListener("click", publishSetToPinterest);
    bar.appendChild(pubBtn);
  }
  if (PIN_RESULT) {
    const res = el("span", "cc-meta", `last pin: "${PIN_RESULT.set}" ${PIN_RESULT.url}`);
    res.style.alignSelf = "center"; res.style.overflowWrap = "anywhere";
    bar.appendChild(res);
  }
  strip.appendChild(bar);
}
// boards load lazily right after the first render of the bar; the
// strip redraws once they arrive (and on connect, via the message
// handler calling renderCaptureStrip)
loadBoards().then((b) => { if (b.length) renderCaptureStrip(); });
