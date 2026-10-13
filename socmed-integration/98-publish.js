// ===== the publish glue: post a capture set, listings attached =====
// spec: [../spec/social-commerce-publish.md]. each user connects their
// own instagram account (the oauth exchange happens in the backend
// function; the artifact never sees the app secret, and the token
// lives in sessionStorage for the tab session only), then publishes
// the active set as a carousel with the listing bindings attached.
// instagram's publishing api cannot set shopping tags (meta's own
// docs), so the publish result surfaces the per-photo product list to
// tag in the instagram app. everything else in the flow is verified
// contract: jpeg-only media, child containers, carousel, publish.

const PUBLISH_BASE = "https://superagent-9bbbac66.base44.app/functions";
const IG_CONN_KEY = "studiogram-ig-conn"; // session only: closing the tab forgets it

let PUBLISH_RESULT = null; // the last publish result, module memory only

function igConn() {
  try { return JSON.parse(sessionStorage.getItem(IG_CONN_KEY) || "null"); } catch (e) { return null; }
}
function igConnSave(c) {
  c ? sessionStorage.setItem(IG_CONN_KEY, JSON.stringify(c)) : sessionStorage.removeItem(IG_CONN_KEY);
}

// caption text is composed, never authored: the unique bound product
// titles (lowercased) plus the first pdp url, capped at instagram's
// 2200-character ceiling. same compose rule as alt text.
function composeCaption(titles, pdpUrl) {
  const parts = (titles || []).filter(Boolean).map((t) => t.toLowerCase());
  let caption = parts.length ? "new: " + parts.join(" / ") + "." : "";
  if (pdpUrl) caption += (caption ? " " : "") + pdpUrl;
  return caption.slice(0, 2200);
}

// the publish payload children: one per photo in set order, each with
// its uploaded image url and its verified product bindings (the same
// join the commerce card uses; failed gates never bind). products carry
// the staged pin positions when the tag stage placed them, so the
// audit record and the handoff know where each tag belongs.
function publishChildren(photos, urls) {
  return photos.map((photo, i) => ({
    url: urls[i],
    alt: altText(photo, photoProducts(photo)),
    products: taggedProducts(photo),
  }));
}

// what to tag in the instagram app, per carousel position. the api
// cannot set shopping tags, so this list is the honest handoff: the
// sku plus the staged position when the tag stage placed one.
function tagSummary(children) {
  return children.map((c, i) => ({
    position: i + 1,
    products: (c.products || []).map((p) => p.sku + (p.x != null ? ` @ ${p.x}%, ${p.y}%` : "")),
  }));
}

// the connect half: the backend holds the app secret and exchanges the
// code; the popup postMessages the connection back to this window.
function connectInstagram() {
  fetch(PUBLISH_BASE + "/studioPublishConfig")
    .then((r) => r.json())
    .then((cfg) => {
      if (!cfg.configured) { toast("instagram publishing is not configured yet: the app secrets are missing"); return; }
      window.open(cfg.authorize_url, "studiogram-ig", "width=480,height=720");
    })
    .catch(() => toast("could not reach the publish backend"));
}
window.addEventListener("message", (e) => {
  if (!e.data || typeof e.data.ok !== "boolean") return;
  if (e.data.provider) return; // other platforms (99) tag their messages
  if (e.data.ok) {
    igConnSave({ access_token: e.data.access_token, ig_id: e.data.ig_id, username: e.data.username });
    toast("instagram connected" + (e.data.username ? " as @" + e.data.username : ""));
    renderCaptureStrip();
  } else {
    toast("connect failed: " + (e.data.reason || "unknown error"));
  }
});

// instagram takes jpeg only: reproduce the frame first if it is not in
// memory (values are truth), then convert to jpeg at 0.92 quality over
// a white matte (jpeg has no alpha) and return base64 bytes.
function jpegFromPhoto(photo) {
  return new Promise((resolve, reject) => {
    (async () => {
      if (!CAPTURE_IMG.get(photo.id)) await reproduceCapture(photo);
      const png = CAPTURE_IMG.get(photo.id);
      if (!png) { reject(new Error("no frame to convert")); return; }
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0);
        resolve(cv.toDataURL("image/jpeg", 0.92).split(",")[1]);
      };
      img.onerror = () => reject(new Error("frame decode failed"));
      img.src = png;
    })().catch(reject);
  });
}

// the publish half: convert every photo in the active set (carousel
// max 10), upload each for a public url, then one publish call with
// caption, children, and product bindings. photos without verified
// bindings publish too (untagged), they are never blocked.
async function publishSetToInstagram() {
  const set = activeSet();
  const photos = photosInSet(set).slice(0, 10);
  if (!photos.length) { toast("capture a photo first: publishing needs the active set"); return; }
  const conn = igConn();
  if (!conn) { toast("connect instagram first"); return; }
  toast(`publishing "${set.name}": converting ${photos.length} frame${photos.length === 1 ? "" : "s"} to jpeg...`);
  const urls = [];
  for (const photo of photos) {
    try {
      const b64 = await jpegFromPhoto(photo);
      const dims = photoDims(photo);
      const res = await fetch(PUBLISH_BASE + "/studioUploadPhoto", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jpeg_base64: b64, width: dims.width, height: dims.height, set_name: set.name }),
      }).then((r) => r.json());
      if (!res.url) { toast("upload failed for " + photo.name + (res.error ? ": " + res.error : "")); return; }
      urls.push(res.url);
    } catch (e) { toast("publish stopped at " + photo.name + ": " + e.message); return; }
  }
  const bound = photos.flatMap((p) => photoProducts(p));
  const titles = [...new Set(bound.map((p) => p.title))];
  const caption = composeCaption(titles, bound[0] ? bound[0].pdp_url : "");
  const children = publishChildren(photos, urls);
  toast("publishing the carousel to instagram...");
  try {
    const res = await fetch(PUBLISH_BASE + "/studioPublishCarousel", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ access_token: conn.access_token, ig_id: conn.ig_id, username: conn.username, set_name: set.name, caption, children }),
    }).then((r) => r.json());
    if (res.ok) {
      PUBLISH_RESULT = { set: set.name, permalink: res.permalink, tags: tagSummary(children), at: nowUtc() };
      toast("published" + (res.permalink ? ": " + res.permalink : " (permalink pending)"));
      renderCaptureStrip();
    } else {
      toast("publish failed: " + (res.error || "unknown error"));
    }
  } catch (e) { toast("publish failed: " + e.message); }
}

// the publish bar lives under the commerce bar in the capture strip.
// every render rebuilds it fresh, same discipline as the bars above.
function renderPublishBar() {
  const strip = $("#capstrip");
  let bar = $("#publishbar");
  if (bar) bar.remove();
  bar = el("div", "btnrow");
  bar.id = "publishbar";
  const conn = igConn();
  const status = el("span", "cc-meta", conn ? "instagram: @" + (conn.username || conn.ig_id) : "instagram: not connected");
  status.style.alignSelf = "center";
  bar.appendChild(status);
  const connBtn = el("button", "btn mini", conn ? "reconnect" : "connect instagram");
  connBtn.title = "oauth the instagram account through the backend (the token stays in this tab)";
  connBtn.addEventListener("click", connectInstagram);
  bar.appendChild(connBtn);
  const stageBtn = el("button", "btn mini", "stage tags");
  stageBtn.title = "drag the product pins onto the photos; the positions follow the publish as the in-app tagging guide";
  stageBtn.addEventListener("click", openTagStage);
  bar.appendChild(stageBtn);
  const pubBtn = el("button", "btn mini", "post set to instagram");
  pubBtn.title = "publish the active set as a carousel; the listing bindings follow as the in-app tag list";
  pubBtn.addEventListener("click", publishSetToInstagram);
  bar.appendChild(pubBtn);
  if (PUBLISH_RESULT) {
    const res = el("span", "cc-meta",
      `last: "${PUBLISH_RESULT.set}" ${PUBLISH_RESULT.permalink || ""} | tag in app: ` +
      PUBLISH_RESULT.tags.map((t) => t.position + " " + (t.products.length ? t.products.join(", ") : "none")).join(" | "));
    res.style.alignSelf = "center"; res.style.overflowWrap = "anywhere";
    bar.appendChild(res);
    const refBtn = el("button", "btn mini", "tag reference");
    refBtn.title = "download the sheet with the staged pins drawn on the frames, the mirror guide for the app pass";
    refBtn.addEventListener("click", downloadTagReference);
    bar.appendChild(refBtn);
  }
  strip.appendChild(bar);
}
