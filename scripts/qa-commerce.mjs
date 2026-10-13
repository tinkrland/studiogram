// qa: the commerce export layer with the real module source, stubbed
// registry and dom, no browser. run from the repo root:
// node scripts/qa-commerce.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "socmed-integration/96-commerce.js"), "utf8");
const fails = [];
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails.push(name);
};

// stubs: everything the module reads from earlier modules and the dom.
// kept deliberately dumb so the qa exercises the module, not the stubs.
const fakeEl = () => {
  const e = { style: {}, children: [], appendChild(c) { this.children.push(c); }, addEventListener() {}, remove() {}, click() {}, set value(v) { this._v = v; }, get value() { return this._v || ""; }, set textContent(v) { this._tc = v; }, get textContent() { return this._tc || ""; } };
  return e;
};
const records = [
  { release_id: "rel-band-01", version: 1, assets: { mesh_sha256: "h-band-01" } },
  { release_id: "rel-ring-02", version: 2, assets: { mesh_sha256: "h-ring-02" } },
];
const sandbox = {
  byRelease: new Map(records.map((r) => [r.release_id, r])),
  nowUtc: () => "2026-10-13T00:00:00Z",
  photoDims: (p) => ({ width: p.width || 1600, height: p.height || 1600 }),
  photosInSet: () => [],
  activeSet: () => ({ id: "set1", name: "set 1", photo_ids: [] }),
  exportFilename: (p) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".png",
  slug: (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  el: fakeEl,
  $: () => fakeEl(),
  toast: () => {},
  downloadLink: () => {},
  document: { createElement: () => fakeEl(), body: { appendChild() {} } },
  localStorage: { getItem: () => null, setItem: () => {} },
  URL: { createObjectURL: () => "blob:stub", revokeObjectURL: () => {} },
  Blob: class { constructor(parts) { this.parts = parts; } },
  setTimeout: () => {},
};
const api = vm.runInNewContext(
  source + "\n;({ importListingManifest, photoProducts, commerceCard, feedCSV, csvEscape, altText })",
  sandbox, { filename: "96-commerce.js" }
);

// the import gate
const good = await api.importListingManifest({
  schema: "sculptura-listing-manifest", manifest_version: 1,
  listings: [
    { release_id: "rel-band-01", version: 1, mesh_sha256: "h-band-01", sku: "KIR-B01", title: "band one", description: "a plain band", price: 420, pdp_url: "https://x/p" },
    { release_id: "rel-ring-02", version: 2, mesh_sha256: "h-ring-02", sku: "KIR-R02", title: "ring two", price: 300, pdp_url: "https://x/r", max_handling_days: 21 },
  ],
});
check("valid manifest: 2 accepted 0 refused", good.ok && good.accepted === 2 && good.refused.length === 0, JSON.stringify(good.refused));

const bad = await api.importListingManifest({
  schema: "sculptura-listing-manifest", manifest_version: 1,
  listings: [
    { release_id: "rel-band-01", version: 1, mesh_sha256: "wrong-hash", sku: "DRIFT", title: "drift", price: 1, pdp_url: "u" },   // hash drift
    { release_id: "rel-ring-02", version: 1, mesh_sha256: "h-ring-02", sku: "VER", title: "ver", price: 1, pdp_url: "u" },        // version mismatch
    { release_id: "nope", version: 1, mesh_sha256: "x", sku: "UNK", title: "unk", price: 1, pdp_url: "u" },                        // unknown release
    { release_id: "rel-band-01", version: 1, mesh_sha256: "h-band-01", sku: "NOPRICE", title: "no price" },                       // missing required value
  ],
});
check("gate refuses all four bad rows", bad.ok && bad.accepted === 0 && bad.refused.length === 4,
  bad.refused.map((r) => r.reason).join(" | "));
check("bad manifest leaves the layer empty", api.photoProducts({ gate: [] }).length === 0);

// re-import the good one for the join and feed tests
await api.importListingManifest({
  schema: "sculptura-listing-manifest", manifest_version: 1,
  listings: [
    { release_id: "rel-band-01", version: 1, mesh_sha256: "h-band-01", sku: "KIR-B01", title: "band one", description: "a plain band", price: 420, pdp_url: "https://x/p" },
    { release_id: "rel-ring-02", version: 2, mesh_sha256: "h-ring-02", sku: "KIR-R02", title: "ring two", price: 300, pdp_url: "https://x/r", max_handling_days: 21 },
  ],
});

// the join: verified gate entries bind, failed ones never do
const photo = { id: "c1", name: "capture 01", gate: [
  { mesh_sha256: "h-band-01", verified: true },
  { mesh_sha256: "h-ring-02", verified: false },
] };
const prods = api.photoProducts(photo);
check("photo binds only through verified gate entries", prods.length === 1 && prods[0].sku === "KIR-B01", prods.map((p) => p.sku).join(","));

// the card
sandbox.photosInSet = () => [photo];
sandbox.activeSet = () => ({ id: "set1", name: "set 1", photo_ids: [photo.id] });
const card = api.commerceCard({ name: "set 1" });
check("card carries the product and composed alt text",
  card.photos[0].products[0].sku === "KIR-B01" && card.photos[0].alt === "band one, studio photograph, view capture 01",
  card.photos[0].alt);
check("card exposes the hash binding", card.photos[0].products[0].mesh_sha256 === "h-band-01");

// feed determinism and the made-to-order rules
const g1 = api.feedCSV("google"), g2 = api.feedCSV("google");
check("google feed byte-equal across builds", g1 === g2);
check("google feed rows sorted by sku", g1.indexOf("KIR-B01") < g1.indexOf("KIR-R02"));
check("google mto rules present", g1.includes("identifier_exists") && g1.includes("FALSE") &&
  /KIR-R02,.*h-ring-02|,21,1/.test(g1.split("\n").find((l) => l.startsWith("KIR-R02")) || ""),
  g1.split("\n").find((l) => l.startsWith("KIR-R02")));
check("google mpn is the release id", g1.includes(",rel-ring-02,"));
const meta = api.feedCSV("meta");
check("meta feed price carries currency", meta.includes("300.00 USD"));
const tt = api.feedCSV("tiktok");
check("tiktok feed availability mapping", tt.includes("IN_STOCK"));
check("unknown platform refused", api.feedCSV("nope") === null);

// csv escaping: comma, quote, newline
const esc = api.csvEscape('a,b"c\nd');
check("csv escaping quotes, commas, newlines", esc === '"a,b""c\nd"', esc);

console.log(fails.length ? `\n${fails.length} FAIL` : "\nall commerce qa green");
process.exit(fails.length ? 1 : 0);
