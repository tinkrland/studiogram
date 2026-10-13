// qa: the publish glue with the real module source, stubbed dom and
// commerce join, no browser and no network. run from the repo root:
// node scripts/qa-publish.mjs
// spec: [../spec/social-commerce-publish.md]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "socmed-integration/98-publish.js"), "utf8");
const fails = [];
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails.push(name);
};

const fakeEl = () => ({
  style: {}, appendChild() {}, addEventListener() {}, remove() {}, set title(v) { this._t = v; }, get title() { return this._t; },
});

// the join stub mirrors 96-commerce's verified-gate rule: only hashes
// present in the photo's verified gate entries bind to listings.
const listings = [
  { sku: "KIR-B01", title: "band one", pdp_url: "https://x/p", mesh_sha256: "h-band-01" },
  { sku: "KIR-R02", title: "ring two", pdp_url: "https://x/r", mesh_sha256: "h-ring-02" },
];
const sandbox = {
  sessionStorage: (() => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; })(),
  window: { addEventListener() {}, open() {} },
  fetch: () => { throw new Error("no network in qa"); },
  toast: () => {},
  el: fakeEl,
  $: () => fakeEl(),
  nowUtc: () => "2026-10-13T00:00:00Z",
  photoDims: (p) => ({ width: p.width || 1080, height: p.height || 1350 }),
  activeSet: () => ({ name: "set 1" }),
  photosInSet: () => [],
  CAPTURE_IMG: new Map(),
  reproduceCapture: async () => {},
  altText: (photo, products) => (products[0] ? products[0].title + ", " : "") + "studio photograph, view " + photo.name,
  photoProducts: (photo) => listings.filter((l) => (photo.gate || []).some((g) => g.verified && g.mesh_sha256 === l.mesh_sha256)),
  renderCaptureStrip: () => {},
};
const api = vm.runInNewContext(
  source + "\n;({ composeCaption, publishChildren, tagSummary, igConn, igConnSave })",
  sandbox, { filename: "98-publish.js" }
);

// caption composition: lowercase join, first pdp, 2200 cap, empty case
check("caption composed from titles + pdp",
  api.composeCaption(["Ring Two", "Band One"], "https://x/r") === "new: ring two / band one. https://x/r");
check("caption with no bound titles is just the pdp",
  api.composeCaption([], "https://x/p") === "https://x/p");
check("caption capped at instagram's 2200 characters",
  api.composeCaption([Array(3000).join("x")], "https://x/p").length === 2200);

// children assembly: verified bindings only, per-photo products, alt
const photos = [
  { id: "c1", name: "capture 01", gate: [{ verified: true, mesh_sha256: "h-ring-02" }] },
  { id: "c2", name: "capture 02", gate: [{ verified: true, mesh_sha256: "h-ring-02" }, { verified: true, mesh_sha256: "h-band-01" }] },
  { id: "c3", name: "capture 03", gate: [{ verified: false, mesh_sha256: "h-band-01" }] },
];
const children = api.publishChildren(photos, ["u1", "u2", "u3"]);
check("children in set order with uploaded urls",
  children.map((c) => c.url).join(",") === "u1,u2,u3");
check("failed gate never binds (the commerce rule carries into publish)",
  children[2].products.length === 0, JSON.stringify(children[2]));
check("multi-product photo carries both bindings, in manifest order",
  children[1].products.map((p) => p.sku).join(",") === "KIR-B01,KIR-R02");
check("children carry composed alt text",
  children[0].alt === "ring two, studio photograph, view capture 01");

// the tag list handoff (the api cannot set shopping tags)
const tags = api.tagSummary(children);
check("tag list is per carousel position",
  JSON.stringify(tags) === JSON.stringify([{ position: 1, products: ["KIR-R02"] }, { position: 2, products: ["KIR-B01", "KIR-R02"] }, { position: 3, products: [] }]),
  JSON.stringify(tags));

// the connection lives in sessionStorage only, never in scene state
api.igConnSave({ access_token: "tok", ig_id: "1", username: "studio" });
check("connection round-trips through sessionStorage", api.igConn().username === "studio");
api.igConnSave(null);
check("disconnect clears the session token", api.igConn() === null);

console.log(fails.length ? `\n${fails.length} FAIL` : "\nall publish qa green");
process.exit(fails.length ? 1 : 0);
