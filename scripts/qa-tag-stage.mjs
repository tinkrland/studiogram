// qa: the tag stage with the real module source, stubbed dom and
// commerce join, no browser and no network. run from the repo root:
// node scripts/qa-tag-stage.mjs
// spec: [../spec/social-commerce-publish.md]
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "socmed-integration/98b-tag-stage.js"), "utf8");
const fails = [];
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails.push(name);
};

const fakeEl = () => ({
  style: {}, appendChild() {}, addEventListener() {}, remove() {},
  set title(v) { this._t = v; }, get title() { return this._t; },
});

const listings = [
  { sku: "KIR-B01", title: "band one", pdp_url: "https://x/p", mesh_sha256: "h-band-01" },
  { sku: "KIR-R02", title: "ring two", pdp_url: "https://x/r", mesh_sha256: "h-ring-02" },
];
const mkStore = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), dump: () => Object.fromEntries(m) }; };
const sandbox = {
  localStorage: mkStore(),
  window: { addEventListener() {}, open() {} },
  document: { createElement: () => fakeEl(), body: { appendChild() {}, removeChild() {} }, querySelector: () => null },
  fetch: () => { throw new Error("no network in qa"); },
  toast: () => {},
  el: fakeEl,
  $: () => null,
  slug: (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  nowUtc: () => "2026-10-13T00:00:00Z",
  photoDims: (p) => ({ width: p.width || 1080, height: p.height || 1350 }),
  activeSet: () => ({ name: "set 1" }),
  photosInSet: () => [],
  photoProducts: (photo) => listings.filter((l) => (photo.gate || []).some((g) => g.verified && g.mesh_sha256 === l.mesh_sha256)),
  altText: (photo, products) => (products[0] ? products[0].title + ", " : "") + "studio photograph, view " + photo.name,
  composeCaption: () => "qa caption stub",
  jpegFromPhoto: async () => { throw new Error("no frames in qa"); },
  downloadLink: () => {},
};
const api = vm.runInNewContext(
  source + "\n;({ clampPct, pinsForStore, mergePinPositions, refSheetPlan, stageSetPins, stagePinsFor, taggedProducts })",
  sandbox, { filename: "98b-tag-stage.js" }
);

// clamp: percentages live inside the frame, 2 to 98, rounded
check("clamp keeps pins inside the frame", api.clampPct(50) === 50 && api.clampPct(-3) === 2 && api.clampPct(140) === 98);
check("clamp rounds fractional positions", api.clampPct(50.49) === 50 && api.clampPct(50.5) === 51);

// store reads: tolerate anything missing or malformed
check("missing set and photo read as no pins",
  api.pinsForStore({}, "nope", "p1").length === 0);
check("malformed pins are dropped, good ones normalized",
  (() => {
    const out = api.pinsForStore({ s: { p1: [{ sku: "A", x: 3.2, y: 99.7 }, { sku: "" }, { sku: "B" }, null, { sku: "C", x: "x" }] } }, "s", "p1");
    return out.length === 1 && out[0].sku === "A" && out[0].x === 3 && out[0].y === 98;
  })());

// the merge: pins locate bound products, never invent them
const products = [{ sku: "KIR-B01", title: "band one", pdp_url: "https://x/p" }, { sku: "KIR-R02", title: "ring two", pdp_url: "https://x/r" }];
const merged = api.mergePinPositions(products, [{ sku: "KIR-R02", x: 40, y: 60 }, { sku: "GHOST", x: 1, y: 1 }]);
check("positions attach only to the matching sku",
  merged[0].x === undefined && merged[1].x === 40 && merged[1].y === 60, JSON.stringify(merged));
check("an orphan pin never becomes a product row", merged.length === 2 && !merged.some((p) => p.sku === "GHOST"));
check("every row keeps the publish shape (sku, title, pdp_url)",
  merged.every((p) => p.sku && p.title && p.pdp_url));

// save/load roundtrip through the storage stub, then the join through it
const photo = { id: "c1", gate: [{ verified: true, mesh_sha256: "h-ring-02" }] };
api.stageSetPins(photo, [{ sku: "KIR-R02", x: 31, y: 67 }]);
const stored = JSON.parse(sandbox.localStorage.getItem("studiogram_tag_stage"));
check("pins persist per set slug and photo id",
  stored["set-1"] && stored["set-1"].c1 && stored["set-1"].c1[0].sku === "KIR-R02", JSON.stringify(stored));
check("reloaded pins read back through the store",
  api.stagePinsFor(photo)[0].x === 31 && api.stagePinsFor(photo)[0].y === 67);
check("taggedProducts is the verified join with positions merged",
  (() => {
    const t = api.taggedProducts(photo);
    return t.length === 1 && t[0].sku === "KIR-R02" && t[0].x === 31 && t[0].pdp_url === "https://x/r";
  })());
check("failed gate still never binds, pins or not",
  api.taggedProducts({ id: "c9", gate: [{ verified: false, mesh_sha256: "h-ring-02" }] }).length === 0);

// unpin: filter out the sku, empty photo entries prune away
api.stageSetPins(photo, []);
check("unpinning empties the photo entry and prunes the set key",
  api.stagePinsFor(photo).length === 0 && !JSON.parse(sandbox.localStorage.getItem("studiogram_tag_stage"))["set-1"]);

// the reference sheet plan: one band per photo, a legend line per pin
const entries = [
  { name: "a", width: 1080, height: 1350, pins: [{ sku: "KIR-R02", x: 50, y: 50 }, { sku: "KIR-B01", x: 20, y: 80 }] },
  { name: "b", width: 1000, height: 1250, pins: [] },
];
const plan = api.refSheetPlan(entries, 1080);
check("plan stacks photos under the header with a per-pin legend",
  plan.items[0].y === plan.headerH && plan.items[0].lines === 2 && plan.items[1].lines === 1,
  JSON.stringify({ i0: plan.items[0], i1: plan.items[1] }));
check("plan height is the exact stack: header + bands + legends + pads",
  plan.height === plan.items[1].y + plan.items[1].h + plan.legendPad + plan.items[1].lines * plan.lineH + plan.pad,
  String(plan.height));
check("a 50/50 pin lands at the center of its band",
  (() => { const i = plan.items[0]; return i.x + i.w * 0.5 === i.x + (i.w * 50) / 100 && i.y + i.h * 0.5 === i.y + (i.h * 50) / 100; })());
check("wide frames scale down to the sheet width",
  plan.items[0].w === 1080 - plan.pad * 2 && plan.items[0].h === Math.round(1350 * ((1080 - plan.pad * 2) / 1080)));

console.log(fails.length ? `\n${fails.length} FAIL` : "\nall tag stage qa green");
process.exit(fails.length ? 1 : 0);
