// qa: the video share stage with the real module source, stubbed dom
// and network, no browser. run from the repo root:
// node scripts/qa-video-share.mjs
// contract: [../socmed-integration/api/video-publish-api.md]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "socmed-integration/98a-connect-handoff.js"), "utf8") +
  readFileSync(join(root, "socmed-integration/98c-video-share.js"), "utf8");
const fails = [];
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails.push(name);
};
const atob = (s) => Buffer.from(s, "base64").toString("binary");
const btoa = (s) => Buffer.from(s, "binary").toString("base64");

const mkCard = (live) => ({
  classList: { contains: () => !!live },
  dataset: {},
  children: [],
  buttons: [],
  querySelector(sel) { return sel === ".cc-actions" ? this : null; },
  insertBefore(node) { this.buttons.push(node); return node; },
});

const mkSandbox = () => {
  const listeners = [];
  const store = new Map();
  const calls = { uploads: [], records: [], vimeoCreates: [], tus: [], opens: [], toasts: [] };
  let row = null;
  const sandbox = {
    atob, btoa,
    setTimeout: () => {}, // the connect poll loop defers; no-op by default
    sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) },
    window: { addEventListener: (n, fn) => listeners.push(fn), open: (url, name) => { calls.opens.push(url); return {}; } },
    navigator: { clipboard: { writeText: () => {} } },
    document: {
      getElementById: (id) => (id === "vidrow" ? row : null),
      createElement: () => mkCard(false),
    },
    toast: (m) => calls.toasts.push(m),
    el: (tag, cls, label) => { const c = mkCard(false); c.label = label; c.addEventListener = (n, fn) => { c.click = fn; }; return c; },
    slug: (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    S: { recordings: [{ name: "orbit take", width: 1080, height: 1350, duration_ms: 4200 }] },
    renderVideoBuffer: async () => { throw new Error("set per test"); },
    renderCaptureStrip: () => {},
    renderVideoStrip: () => {},
    fetch: async (url, opts) => { throw new Error("set per test: " + url); },
    __calls: calls, __listeners: listeners,
    __setRow: (cards) => { row = { querySelectorAll: () => cards }; },
  };
  return sandbox;
};

const load = (sandbox) => vm.runInNewContext(
  source + "\n;({ base64Chunk, shareVideoLink, shareVideoToVimeo, connectVimeo, conn: () => VIMEO_CONN, strip: renderVideoStrip })",
  sandbox, { filename: "98c-video-share.js" }
);

// base64 chunking: exact bytes, sliced windows, no btoa surprises
{
  const sb = mkSandbox(); const api = load(sb);
  const buf = new Uint8Array(700 * 1024).map((_, i) => i % 251);
  const b1 = api.base64Chunk(buf.buffer, 0, 512 * 1024);
  const b2 = api.base64Chunk(buf.buffer, 512 * 1024, 1024 * 1024);
  const back = Uint8Array.from(atob(b1) + atob(b2), (c) => c.charCodeAt(0));
  check("base64 chunks roundtrip to the exact bytes", back.length === buf.length && back.every((v, i) => v === buf[i]));
  check("chunk two starts where chunk one ends", atob(b1).length === 512 * 1024 && b2.length > 0);
}

// the hosted link: chunks posted in order, share recorded, link returned
{
  const sb = mkSandbox(); const api = load(sb);
  const buf = new Uint8Array(700 * 1024).fill(7).buffer;
  sb.renderVideoBuffer = async () => ({ buffer: buf, mime: 'video/mp4; codecs="avc1.640028"' });
  sb.fetch = async (url, opts) => {
    if (url.endsWith("/functions/studioUploadVideo")) {
      const b = JSON.parse(opts.body); sb.__calls.uploads.push(b); return { ok: true, json: async () => ({ ok: true }) };
    }
    if (url.endsWith("/functions/studioVideoRecord")) {
      const b = JSON.parse(opts.body); sb.__calls.records.push(b); return { ok: true, json: async () => ({ ok: true, id: "r1" }) };
    }
    throw new Error("unexpected fetch " + url);
  };
  const link = await api.shareVideoLink(sb.S.recordings[0]);
  check("700 kb posts as two sequential chunks",
    sb.__calls.uploads.length === 2 && sb.__calls.uploads[0].chunk_index === 0 && sb.__calls.uploads[1].chunk_index === 1,
    sb.__calls.uploads.length + " uploads");
  check("chunk payloads carry the whole shape (id, mime, bytes, totals)",
    sb.__calls.uploads.every((u) => /^vid-orbit-take-/.test(u.video_id) && u.mime.startsWith("video/mp4") && u.bytes_total === 700 * 1024 && u.chunk_total === 2 && u.data_base64));
  check("the share is recorded with provider link", sb.__calls.records.length === 1 && sb.__calls.records[0].provider === "link" && sb.__calls.records[0].meta.video_id === sb.__calls.uploads[0].video_id);
  check("the returned link points at the studio serve function", link === "https://superagent-9bbbac66.base44.app/functions/studioVideo?vid=" + sb.__calls.uploads[0].video_id);
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.renderVideoBuffer = async () => ({ buffer: new Uint8Array(1024).buffer, mime: "video/mp4" });
  sb.fetch = async (url, opts) => {
    if (url.includes("studioUploadVideo")) { sb.__calls.uploads.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true }) }; }
    if (url.includes("studioVideoRecord")) { sb.__calls.records.push(JSON.parse(opts.body)); return { ok: true, json: async () => ({ ok: true }) }; }
    return { ok: false, json: async () => ({}) };
  };
  await api.shareVideoLink(sb.S.recordings[0]);
  check("a small take posts as a single chunk",
    sb.__calls.uploads.length === 1 && sb.__calls.uploads[0].chunk_total === 1);
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.renderVideoBuffer = async () => ({ buffer: new Uint8Array(1024).buffer, mime: "video/mp4" });
  sb.fetch = async (url) => url.includes("studioUploadVideo")
    ? { ok: false, status: 413, json: async () => ({ error: "too large" }) }
    : { ok: true, json: async () => ({ ok: true }) };
  let threw = null;
  try { await api.shareVideoLink(sb.S.recordings[0]); } catch (e) { threw = e.message; }
  check("a failed chunk upload surfaces the error", threw === "too large", threw);
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.renderVideoBuffer = async () => ({ liveTakeUrl: "blob:x" });
  let threw = null;
  try { await api.shareVideoLink(sb.S.recordings[0]); } catch (e) { threw = e.message; }
  check("no webcodecs encoder refuses to share", /webcodecs encoder is required/.test(threw), threw);
}

// vimeo connect: provider-tagged messages only, session stored, refuse path
{
  const sb = mkSandbox(); const api = load(sb);
  sb.__listeners[0]({ data: { ok: true, provider: "pinterest", token: "x" } });
  check("the vimeo listener ignores other providers", api.conn() === null);
  sb.__listeners[0]({ data: { ok: true, provider: "vimeo", token: "vm-1", name: "studio test", link: "https://vimeo.com/u" } });
  check("a vimeo connect stores the token in the session", api.conn() && api.conn().token === "vm-1" && sb.sessionStorage.getItem("studiogram-vimeo-conn").includes("vm-1"));
  sb.__listeners[0]({ data: { ok: false, provider: "vimeo", reason: "authorize refused: access denied" } });
  check("a refused connect toasts the reason", sb.__calls.toasts.some((t) => /refused: access denied/.test(t)));
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.fetch = async () => ({ ok: true, json: async () => ({ configured: false }) });
  let threw = null;
  try { await api.connectVimeo(); } catch (e) { threw = e.message; }
  check("unconfigured vimeo app refuses to connect", /not configured/.test(threw), threw);
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.fetch = async () => ({ ok: true, json: async () => ({ configured: true, authorize_url: "https://api.vimeo.com/oauth/authorize?response_type=code" }) });
  await api.connectVimeo();
  check("configured app opens the authorize dialog with the state code",
    sb.__calls.opens[0] && sb.__calls.opens[0].includes("response_type=code") && /state=conn-vimeo-[a-z0-9]+/.test(sb.__calls.opens[0]));
}
{
  // the poll handoff: waiting once, then the stored connection lands
  // and applies exactly like the old postMessage path did
  const sb = mkSandbox(); const api = load(sb);
  sb.setTimeout = (fn) => fn(); // run the poll loop synchronously
  let polls = 0;
  sb.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes("studioConnPoll")
      ? (++polls === 1 ? { waiting: true } : { ok: true, handoff: { ok: true, token: "vh-1", name: "studio vimeo", link: "https://vimeo.com/studio" } })
      : { configured: true, authorize_url: "https://api.vimeo.com/oauth/authorize?response_type=code" },
  });
  await api.connectVimeo();
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); // let the poll chain settle
  check("the connect handoff polls until the token lands",
    polls === 2 && api.conn() && api.conn().token === "vh-1" && sb.sessionStorage.getItem("studiogram-vimeo-conn").includes("vh-1"),
    "polls " + polls);
  check("a landed handoff toasts the connection", sb.__calls.toasts.some((t) => /vimeo connected: studio vimeo/.test(t)));
}
{
  // a refused authorize also travels the handoff, not just postMessage
  const sb = mkSandbox(); const api = load(sb);
  sb.setTimeout = (fn) => fn();
  sb.fetch = async (url) => ({
    ok: true,
    json: async () => url.includes("studioConnPoll")
      ? { ok: true, handoff: { ok: false, reason: "authorize refused: access denied" } }
      : { configured: true, authorize_url: "https://api.vimeo.com/oauth/authorize?response_type=code" },
  });
  await api.connectVimeo();
  for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
  check("a refused connect surfaces the reason through the handoff", sb.__calls.toasts.some((t) => /refused: access denied/.test(t)));
}

// vimeo push: privacy fallback chain, tus headers, share recorded
{
  const sb = mkSandbox(); const api = load(sb);
  sb.__listeners[0]({ data: { ok: true, provider: "vimeo", token: "vm-2", name: "studio test", link: "https://vimeo.com/u" } });
  const buf = new Uint8Array(2048).fill(3).buffer;
  sb.renderVideoBuffer = async () => ({ buffer: buf, mime: "video/mp4" });
  sb.fetch = async (url, opts) => {
    if (url === "https://api.vimeo.com/me/videos") {
      const body = JSON.parse(opts.body);
      sb.__calls.vimeoCreates.push(body);
      if (body.privacy.view === "unlisted") return { ok: false, status: 400, json: async () => ({ error: "invalid privacy setting for this account" }) };
      if (body.privacy.view === "disable") return { ok: true, status: 200, json: async () => ({ uri: "/videos/991", link: "https://vimeo.com/991", upload: { upload_link: "https://files.tus.vimeo.com/files/t1" } }) };
      throw new Error("fallback order wrong, hit " + body.privacy.view);
    }
    if (url === "https://files.tus.vimeo.com/files/t1") {
      sb.__calls.tus.push(opts);
      return { ok: true, status: 204 };
    }
    if (url.endsWith("/functions/studioVideoRecord")) {
      const b = JSON.parse(opts.body); sb.__calls.records.push(b); return { ok: true, json: async () => ({ ok: true }) };
    }
    throw new Error("unexpected fetch " + url);
  };
  const link = await api.shareVideoToVimeo(sb.S.recordings[0]);
  check("unlisted refusal falls back to disable, not nobody first",
    sb.__calls.vimeoCreates.map((c) => c.privacy.view).join(",") === "unlisted,disable",
    sb.__calls.vimeoCreates.map((c) => c.privacy.view).join(","));
  check("create posts the tus approach with the exact byte size",
    sb.__calls.vimeoCreates[1].upload.approach === "tus" && sb.__calls.vimeoCreates[1].upload.size === 2048);
  check("the tus patch carries tus 1.0.0 at offset 0",
    sb.__calls.tus[0].headers["tus-resumable"] === "1.0.0" && sb.__calls.tus[0].headers["upload-offset"] === "0" && sb.__calls.tus[0].headers["content-type"] === "application/offset+octet-stream" && sb.__calls.tus[0].method === "PATCH");
  check("the vimeo share records with the connected username and privacy",
    sb.__calls.records.length === 1 && sb.__calls.records[0].provider === "vimeo" && sb.__calls.records[0].connected_username === "studio test" && sb.__calls.records[0].meta.privacy === "disable");
  check("the vimeo link is the created video link", link === "https://vimeo.com/991");
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.__listeners[0]({ data: { ok: true, provider: "vimeo", token: "vm-3", name: "studio test", link: "https://vimeo.com/u" } });
  sb.renderVideoBuffer = async () => ({ buffer: new Uint8Array(64).buffer, mime: "video/mp4" });
  sb.fetch = async (url, opts) => {
    if (url === "https://api.vimeo.com/me/videos") return { ok: true, json: async () => ({ uri: "/videos/1", link: "https://vimeo.com/1", upload: { upload_link: "https://files.tus.vimeo.com/f" } }) };
    if (url.includes("files.tus.vimeo.com")) return { ok: false, status: 500 };
    return { ok: true, json: async () => ({ ok: true }) };
  };
  let threw = null;
  try { await api.shareVideoToVimeo(sb.S.recordings[0]); } catch (e) { threw = e.message; }
  check("a failed tus upload surfaces http 500", threw === "tus upload failed (http 500)", threw);
}
{
  const sb = mkSandbox(); const api = load(sb);
  sb.__listeners[0]({ data: { ok: true, provider: "vimeo", token: "vm-4", name: "studio test", link: "https://vimeo.com/u" } });
  sb.renderVideoBuffer = async () => ({ buffer: new Uint8Array(64).buffer, mime: "video/mp4" });
  sb.fetch = async (url, opts) => {
    if (url === "https://api.vimeo.com/me/videos") {
      const body = JSON.parse(opts.body); sb.__calls.vimeoCreates.push(body);
      return { ok: false, status: 401, json: async () => ({ error: "token expired" }) };
    }
    throw new Error("unexpected fetch " + url);
  };
  let threw = null;
  try { await api.shareVideoToVimeo(sb.S.recordings[0]); } catch (e) { threw = e.message; }
  check("a 401 create does not try the privacy fallbacks and surfaces the error",
    sb.__calls.vimeoCreates.length === 1 && threw === "vimeo create failed: token expired", threw);
}

// the strip wrap: share buttons land on every record card, no dupes, live skipped
{
  const sb = mkSandbox();
  let rendered = 0;
  sb.renderVideoStrip = () => { rendered++; }; // the base row, captured at module load
  const api = load(sb);
  const live = mkCard(true), card1 = mkCard(false), card2 = mkCard(false);
  sb.__setRow([live, card1, card2]);
  sb.S.recordings.push({ name: "second take", width: 1080, height: 1350, duration_ms: 3000 });
  api.strip();
  check("the wrap calls the base strip render first", rendered === 1);
  check("live recording cards are skipped, records get buttons",
    live.buttons.length === 0 && card1.buttons.length === 2 && card2.buttons.length === 2,
    card1.buttons.length + "/" + card2.buttons.length);
  check("the buttons are link and vimeo",
    card1.buttons.map((b) => b.label).join(",") === "link,vimeo");
  api.strip();
  check("a second render does not duplicate buttons",
    card1.buttons.length === 2 && card2.buttons.length === 2 && rendered === 2);
}

console.log(fails.length ? "\n" + fails.length + " FAIL" : "\nall video share qa green");
process.exit(fails.length ? 1 : 0);
