// the video share stage: a rendered take becomes a link. two doors.
// the studio's own hosting works today with no accounts: the mp4 is
// base64-chunked into StudioVideo rows and studioVideo streams the
// chunks back as one file with range support, so the link plays and
// seeks anywhere. vimeo is the api door: oauth (the secret stays
// server-side in the callback), create with privacy.view unlisted
// (paid plans; disable and nobody are the fallbacks for basic
// accounts), then the tus upload of the exact same deterministic
// bytes straight from the browser. api.vimeo.com's cors preflight
// was verified for this origin. the youtube unlisted door is real
// but audit-gated (unverified projects lock to private) and loom
// has no upload api at all; both are documented, not wired.
// contract: socmed-integration/api/video-publish-api.md
const SHARE_HOST = "https://superagent-9bbbac66.base44.app";
const SHARE_CHUNK_BYTES = 512 * 1024;
let VIMEO_CONN = null;
try { VIMEO_CONN = JSON.parse(sessionStorage.getItem("studiogram-vimeo-conn") || "null"); } catch (e) { VIMEO_CONN = null; }

function base64Chunk(buf, start, end) {
  const stop = Math.min(end, buf.byteLength);
  const view = new Uint8Array(buf, start, stop - start);
  let bin = "";
  const STEP = 0x8000;
  for (let i = 0; i < view.length; i += STEP) {
    bin += String.fromCharCode.apply(null, view.subarray(i, i + STEP));
  }
  return btoa(bin);
}

async function postShare(fn, body) {
  const res = await fetch(SHARE_HOST + "/functions/" + fn, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || fn + " failed (" + res.status + ")");
  return data;
}

function copyShareText(t) {
  try { navigator.clipboard.writeText(t); } catch (e) { /* clipboard is a courtesy, the toast carries the link */ }
}

async function shareVideoLink(rec) {
  const out = await renderVideoBuffer(rec, "mp4");
  if (!out || out.liveTakeUrl) throw new Error("the webcodecs encoder is required to share (mp4 render)");
  const buf = out.buffer;
  const chunkTotal = Math.max(1, Math.ceil(buf.byteLength / SHARE_CHUNK_BYTES));
  const videoId = "vid-" + slug(rec.name) + "-" + Date.now().toString(36);
  toast("uploading " + rec.name + ": " + Math.round(buf.byteLength / 1024) + " kb in " + chunkTotal + " chunk" + (chunkTotal === 1 ? "" : "s"));
  for (let i = 0; i < chunkTotal; i++) {
    await postShare("studioUploadVideo", {
      video_id: videoId, rec_name: rec.name, mime: out.mime, fmt: "mp4",
      width: rec.width, height: rec.height, duration_ms: rec.duration_ms,
      bytes_total: buf.byteLength, chunk_index: i, chunk_total: chunkTotal,
      data_base64: base64Chunk(buf, i * SHARE_CHUNK_BYTES, (i + 1) * SHARE_CHUNK_BYTES),
    });
  }
  const link = SHARE_HOST + "/functions/studioVideo?vid=" + videoId;
  await postShare("studioVideoRecord", {
    provider: "link", name: rec.name, permalink: link,
    meta: { width: rec.width, height: rec.height, duration_ms: rec.duration_ms, bytes: buf.byteLength, video_id: videoId },
  });
  copyShareText(link);
  toast(rec.name + " is live at a studio link (copied)");
  return link;
}

async function connectVimeo() {
  const cfg = await (await fetch(SHARE_HOST + "/functions/studioVimeoConfig")).json().catch(() => null);
  if (!cfg || !cfg.configured) throw new Error("the vimeo app is not configured yet (owner secrets)");
  connectHandoff("vimeo", cfg.authorize_url, (h) => {
    VIMEO_CONN = { token: h.token, name: h.name, link: h.link };
    sessionStorage.setItem("studiogram-vimeo-conn", JSON.stringify(VIMEO_CONN));
    toast("vimeo connected: " + h.name);
  });
}

window.addEventListener("message", (ev) => {
  const d = ev.data;
  if (!d || d.provider !== "vimeo") return;
  if (!d.ok) { toast("vimeo connect failed: " + (d.reason || "refused")); return; }
  VIMEO_CONN = { token: d.token, name: d.name, link: d.link };
  sessionStorage.setItem("studiogram-vimeo-conn", JSON.stringify(VIMEO_CONN));
  toast("vimeo connected: " + d.name);
  renderCaptureStrip();
});

async function shareVideoToVimeo(rec) {
  if (!VIMEO_CONN) return connectVimeo();
  const out = await renderVideoBuffer(rec, "mp4");
  if (!out || out.liveTakeUrl) throw new Error("the webcodecs encoder is required to share (mp4 render)");
  // privacy chain: unlisted is the paid-plan default, disable (hide
  // from vimeo, embed only) and nobody are the basic-plan fallbacks
  let created = null, privacy = null, lastErr = "";
  for (const view of ["unlisted", "disable", "nobody"]) {
    const res = await fetch("https://api.vimeo.com/me/videos", {
      method: "POST",
      headers: { "authorization": "Bearer " + VIMEO_CONN.token, "content-type": "application/json" },
      body: JSON.stringify({
        upload: { approach: "tus", size: out.buffer.byteLength },
        name: rec.name, privacy: { view },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.upload && data.upload.upload_link) { created = data; privacy = view; break; }
    lastErr = data.error || ("http " + res.status);
    if (res.status !== 400) throw new Error("vimeo create failed: " + lastErr);
  }
  if (!created) throw new Error("vimeo create failed: " + lastErr);
  // tus: the whole remaining file at offset 0; the upload link is
  // single-use and pre-authorized, no bearer header on the patch
  const up = await fetch(created.upload.upload_link, {
    method: "PATCH",
    headers: { "tus-resumable": "1.0.0", "upload-offset": "0", "content-type": "application/offset+octet-stream" },
    body: out.buffer,
  });
  if (up.status !== 204) throw new Error("tus upload failed (http " + up.status + ")");
  await postShare("studioVideoRecord", {
    provider: "vimeo", name: rec.name, permalink: created.link,
    connected_username: VIMEO_CONN.name,
    meta: { width: rec.width, height: rec.height, duration_ms: rec.duration_ms, bytes: out.buffer.byteLength, privacy, video_id: created.uri },
  });
  copyShareText(created.link);
  toast(rec.name + " pushed to vimeo (" + privacy + "), link copied");
  return created.link;
}

// wrap the strip render: the base row draws, then the share buttons
// join each record's action row in recording order
const renderVideoStripBase = renderVideoStrip;
renderVideoStrip = function () {
  renderVideoStripBase();
  const row = document.getElementById("vidrow");
  if (!row) return;
  const cards = row.querySelectorAll(".vidcard");
  let idx = 0;
  for (const card of cards) {
    if (card.classList.contains("live")) continue;
    const rec = S.recordings[idx++];
    if (!rec) continue;
    const actions = card.querySelector(".cc-actions");
    if (!actions || card.dataset.share) continue;
    card.dataset.share = "1";
    const mk = (label, fn) => {
      const b = el("button", "btn mini", label);
      b.addEventListener("click", () => { fn(rec).catch((e) => toast("share failed: " + e.message)); });
      return b;
    };
    actions.insertBefore(mk("link", shareVideoLink), actions.children[actions.children.length - 1]);
    actions.insertBefore(mk("vimeo", shareVideoToVimeo), actions.children[actions.children.length - 1]);
  }
};
