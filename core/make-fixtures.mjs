// builds the deterministic release registry fixtures with a real sha-256 hash chain.
// the resulting fixtures.json is embedded verbatim into studiogram's index.html,
// and the app recomputes every hash at load: canonical json, sorted keys, no whitespace.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
const sha256 = (v) => createHash("sha256").update(canonical(v)).digest("hex");


// ===== the mesh compiler =====
// a release record must carry the compiled mesh, not just its parameters: the
// scene renders exactly what would be manufactured. this builder compiles
// each mesh_spec into a minimal glb (positions + indices, no normals: the
// loader computes smooth normals at ingestion) in the spec's native
// millimeters, mirroring the profile math in jewelry/70-jewelry.js so the
// compiled mesh and the procedural fallback agree shape-for-shape.
const SEG = 96;
function compileBand(Ri, W, T, B) {
  const pts = [[Ri, -W / 2 + B], [Ri, W / 2 - B], [Ri + B * 0.6, W / 2], [Ri + T - B, W / 2],
    [Ri + T, W / 2 - B], [Ri + T, -W / 2 + B], [Ri + T - B, -W / 2], [Ri + B * 0.6, -W / 2], [Ri, -W / 2 + B]];
  return lathe(pts.slice().reverse(), SEG);
}
function compileDome(Ri, W, T, B) {
  const pts = [[Ri, -W / 2 + B], [Ri, W / 2 - B]];
  const dome = T * 0.42;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push([Ri + T + dome * Math.cos((t - 0.5) * Math.PI), -W / 2 + t * W]);
  }
  pts.push([Ri, -W / 2 + B]);
  return lathe(pts, SEG);
}
function compileEllipsoid(rx, ry, rz, cx, cy, cz) {
  const pos = [], idx = [];
  const RS = 32, HS = 24;
  for (let i = 0; i <= RS; i++) {
    const phi = (i / RS) * 2 * Math.PI;
    for (let j = 0; j <= HS; j++) {
      const th = (j / HS) * Math.PI;
      pos.push(cx + rx * Math.sin(th) * Math.cos(phi), cy + ry * Math.cos(th), cz + rz * Math.sin(th) * Math.sin(phi));
    }
  }
  for (let i = 0; i < RS; i++) for (let j = 0; j < HS; j++) {
    const a = i * (HS + 1) + j, b = a + HS + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: pos, indices: idx };
}
function compileCuff(Ri, tube, arcDeg) {
  const pos = [], idx = [];
  const R = Ri + tube, TS = 22, AS = 84;
  for (let i = 0; i <= AS; i++) {
    const a = (i / AS) * arcDeg * (Math.PI / 180) + Math.PI; // gap away from camera, matching the runtime torus
    for (let j = 0; j <= TS; j++) {
      const t = (j / TS) * 2 * Math.PI;
      pos.push((R + tube * Math.cos(t)) * Math.cos(a), R * 0 + tube * Math.sin(t), (R + tube * Math.cos(t)) * Math.sin(a));
    }
  }
  for (let i = 0; i < AS; i++) for (let j = 0; j < TS; j++) {
    const a = i * (TS + 1) + j, b = a + TS + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: pos, indices: idx };
}
function lathe(pts, seg) {
  const pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * 2 * Math.PI;
    const ca = Math.cos(a), sa = Math.sin(a);
    for (const [x, y] of pts) pos.push(x * ca, y, x * sa);
  }
  const n = pts.length;
  for (let i = 0; i < seg; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = (i + 1) * n + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  return { positions: pos, indices: idx };
}
function buildGlb(parts) {
  // one glb, one mesh, one primitive per part. positions float32, indices
  // uint16, no normals (computed at load). padded per the glb spec.
  const enc = new TextEncoder();
  const accessors = [], bufferViews = [], primitives = [];
  const binChunks = [];
  let binOffset = 0;
  const pushData = (arr) => {
    const bytes = new Uint8Array(arr.buffer);
    const pad = (4 - (bytes.length % 4)) % 4;
    const padded = new Uint8Array(bytes.length + pad);
    padded.set(bytes); if (pad) padded.fill(0, bytes.length);
    const view = { buffer: 0, byteOffset: binOffset, byteLength: bytes.length };
    binOffset += padded.length;
    binChunks.push(padded);
    bufferViews.push(view);
    return bufferViews.length - 1;
  };
  for (const part of parts) {
    const fv = new Float32Array(part.positions);
    const iv = new Uint16Array(part.indices);
    const minmax = [0, 1, 2].map((k) => {
      let mn = Infinity, mx = -Infinity;
      for (let i = k; i < fv.length; i += 3) { mn = Math.min(mn, fv[i]); mx = Math.max(mx, fv[i]); }
      return [mn, mx];
    });
    const posView = pushData(fv);
    const idxView = pushData(iv);
    accessors.push({ bufferView: posView, componentType: 5126, count: fv.length / 3, type: "VEC3", min: minmax.map((m) => m[0]), max: minmax.map((m) => m[1]) });
    accessors.push({ bufferView: idxView, componentType: 5123, count: iv.length, type: "SCALAR" });
    primitives.push({ attributes: { POSITION: accessors.length - 2 }, indices: accessors.length - 1, material: 0 });
  }
  const gltf = {
    asset: { version: "2.0", generator: "studiogram-fixture-compiler-1" },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives }],
    accessors, bufferViews, buffers: [{ byteLength: binOffset }],
    materials: [{ name: "compiled-release", metallicFactor: 1.0, roughnessFactor: 0.3 }],
  };
  const jsonBytes = enc.encode(JSON.stringify(gltf));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonBytes.length + jsonPad);
  jsonChunk.set(jsonBytes); jsonChunk.fill(0x20, jsonBytes.length);
  const bin = new Uint8Array(binOffset);
  let o = 0; for (const c of binChunks) { bin.set(c, o); o += c.length; }
  const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunk.length, true); dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonChunk, 20);
  const binHead = 20 + jsonChunk.length;
  dv.setUint32(binHead, bin.length, true); dv.setUint32(binHead + 4, 0x004e4942, true);
  out.set(bin, binHead + 8);
  return out;
}
function compileSpec(spec) {
  if (spec.kind === "band") return [compileBand(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm)];
  if (spec.kind === "dome_band") return [compileDome(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm)];
  if (spec.kind === "signet") return [
    compileBand(spec.inner_radius_mm, spec.band_width_mm, spec.band_thickness_mm, 0.3),
    compileEllipsoid(spec.top_w_mm / 2, spec.top_l_mm / 2, spec.top_h_mm / 2,
      0, 0, -(spec.inner_radius_mm + spec.band_thickness_mm + spec.top_h_mm / 2 - 1)),
  ];
  if (spec.kind === "cuff") return [compileCuff(spec.inner_radius_mm, spec.tube_mm, spec.arc_deg)];
  return [compileBand(9, 3, 1.5, 0.3)];
}

// release records shaped after contracts/design-release.schema.json, plus the
// placement information that travels with the canonical design record.
const base = [
  {
    release_id: "6f1c2a90-8f34-4a1e-9c77-2b5d0a91e001",
    design_id: "a01d4f22-71c9-4b0e-8f55-0c9a1b2d3e01",
    version: 1,
    creator_id: "c1a2b3c4-0001-4a00-9000-000000000001",
    creator_name: "atelier ora",
    created_at: "2026-10-02T09:14:03Z",
    engine: {
      name: "paracraft-jewelry",
      version: "0.4.1",
      compiler: "openscad",
      compiler_version: "2021.01",
      ruleset_version: "jewelry-rules-2026-09",
      parameter_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    type: "ring",
    name: "plain band",
    summary: "a flat-profile band with softened edges. the first piece of the fixture set.",
    parameters: {
      placement: { locations: ["finger"] },
      mesh_spec: { kind: "band", inner_radius_mm: 8.9, width_mm: 3.2, thickness_mm: 1.7, bevel_mm: 0.35 }
    },
    metals_offered: ["silver_925", "gold_14k_yellow", "gold_14k_rose"],
    sizing: { min_inner_mm: 7.5, max_inner_mm: 11.5, steps_mm: 0.25 },
    castability: { status: "pass", ruleset: "jewelry-rules-2026-09", checked_at: "2026-10-02T09:13:40Z" },
    mass_estimate_g: { silver_925: 3.4, gold_14k_yellow: 4.4, gold_14k_rose: 4.3 },
    assets: { openscad_source_uri: "releases/plain-band-v1/band.scad", render_uris: ["releases/plain-band-v1/render-0.png"] }
  },
  {
    release_id: "7d2e3b01-9a45-4b2f-8d88-3c6e1b02e002",
    design_id: "b02e5f33-82da-4c1f-9f66-1dab2c3e4f02",
    version: 1,
    creator_id: "c1a2b3c4-0001-4a00-9000-000000000001",
    creator_name: "atelier ora",
    created_at: "2026-10-03T11:02:17Z",
    engine: {
      name: "paracraft-jewelry",
      version: "0.4.1",
      compiler: "openscad",
      compiler_version: "2021.01",
      ruleset_version: "jewelry-rules-2026-09",
      parameter_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    type: "ring",
    name: "dome band",
    summary: "a band with a convex outer face, wider and heavier than the plain band.",
    parameters: {
      placement: { locations: ["finger"] },
      mesh_spec: { kind: "dome_band", inner_radius_mm: 9.1, width_mm: 4.5, thickness_mm: 2.2, bevel_mm: 0.4 }
    },
    metals_offered: ["silver_925", "gold_14k_yellow"],
    sizing: { min_inner_mm: 7.5, max_inner_mm: 11.5, steps_mm: 0.25 },
    castability: { status: "pass", ruleset: "jewelry-rules-2026-09", checked_at: "2026-10-03T11:01:52Z" },
    mass_estimate_g: { silver_925: 5.6, gold_14k_yellow: 7.2 },
    assets: { openscad_source_uri: "releases/dome-band-v1/dome.scad", render_uris: ["releases/dome-band-v1/render-0.png"] }
  },
  {
    release_id: "8e3f4c12-0b56-4c30-9e99-4d7f2c03e003",
    design_id: "c03f6a44-93eb-4d20-8a77-2ebc3d4f5a03",
    version: 1,
    creator_id: "c2b3c4d5-0002-4b00-9000-000000000002",
    creator_name: "studio nil",
    created_at: "2026-10-04T15:44:09Z",
    engine: {
      name: "paracraft-jewelry",
      version: "0.4.1",
      compiler: "openscad",
      compiler_version: "2021.01",
      ruleset_version: "jewelry-rules-2026-09",
      parameter_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    type: "ring",
    name: "signet",
    summary: "a low oval signet on a narrow band, from a second creator to show cross-creator stacks.",
    parameters: {
      placement: {
        locations: ["finger"],
        preferred_position: "proximal_base"
      },
      mesh_spec: { kind: "signet", inner_radius_mm: 9.0, band_width_mm: 2.6, band_thickness_mm: 1.5, top_w_mm: 12.0, top_l_mm: 14.5, top_h_mm: 2.4 }
    },
    metals_offered: ["silver_925", "gold_14k_yellow", "bronze_cu"],
    sizing: { min_inner_mm: 7.5, max_inner_mm: 11.5, steps_mm: 0.25 },
    castability: { status: "pass", ruleset: "jewelry-rules-2026-09", checked_at: "2026-10-04T15:43:31Z" },
    mass_estimate_g: { silver_925: 6.1, gold_14k_yellow: 7.9, bronze_cu: 5.7 },
    assets: { openscad_source_uri: "releases/signet-v1/signet.scad", render_uris: ["releases/signet-v1/render-0.png"] }
  },
  {
    release_id: "9f405d23-1c67-4d41-8faa-5e8a3d04e004",
    design_id: "d04a7b55-a4fc-4e31-9b88-3fcd4e5f6a04",
    version: 2,
    creator_id: "c2b3c4d5-0002-4b00-9000-000000000002",
    creator_name: "studio nil",
    created_at: "2026-10-06T08:21:55Z",
    engine: {
      name: "paracraft-jewelry",
      version: "0.4.1",
      compiler: "openscad",
      compiler_version: "2021.01",
      ruleset_version: "jewelry-rules-2026-09",
      parameter_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    type: "bracelet",
    name: "round cuff",
    summary: "an open round-profile cuff, sized for the wrist location. version 2 after a wall fix.",
    parameters: {
      placement: { locations: ["wrist"] },
      mesh_spec: { kind: "cuff", inner_radius_mm: 30.0, tube_mm: 4.5, arc_deg: 300, gap_w_mm: 2.0 }
    },
    metals_offered: ["silver_925", "gold_14k_rose"],
    sizing: { min_inner_mm: 26.0, max_inner_mm: 34.0, steps_mm: 0.5 },
    castability: { status: "pass", ruleset: "jewelry-rules-2026-09", checked_at: "2026-10-06T08:20:58Z" },
    mass_estimate_g: { silver_925: 24.8, gold_14k_rose: 31.9 },
    assets: { openscad_source_uri: "releases/round-cuff-v2/cuff.scad", render_uris: ["releases/round-cuff-v2/render-0.png"] }
  },
  {
    release_id: "0a516e34-2d78-4e52-9abb-6f9b4e05e005",
    design_id: "e05b8c66-b50d-4f42-ac99-4ade5f6a7b05",
    version: 1,
    creator_id: "c1a2b3c4-0001-4a00-9000-000000000001",
    creator_name: "atelier ora",
    created_at: "2026-10-08T13:37:26Z",
    engine: {
      name: "paracraft-jewelry",
      version: "0.4.1",
      compiler: "openscad",
      compiler_version: "2021.01",
      ruleset_version: "jewelry-rules-2026-09",
      parameter_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    type: "ring",
    name: "thin stack band",
    summary: "a narrow band meant for stacking. several can share one location as independent objects.",
    parameters: {
      placement: { locations: ["finger"] },
      mesh_spec: { kind: "band", inner_radius_mm: 8.9, width_mm: 1.6, thickness_mm: 1.2, bevel_mm: 0.25 }
    },
    metals_offered: ["silver_925", "gold_14k_yellow", "gold_14k_rose"],
    sizing: { min_inner_mm: 7.5, max_inner_mm: 11.5, steps_mm: 0.25 },
    castability: { status: "pass", ruleset: "jewelry-rules-2026-09", checked_at: "2026-10-08T13:36:49Z" },
    mass_estimate_g: { silver_925: 1.2, gold_14k_yellow: 1.6, gold_14k_rose: 1.5 },
    assets: { openscad_source_uri: "releases/thin-stack-band-v1/band.scad", render_uris: ["releases/thin-stack-band-v1/render-0.png"] }
  }
];

// mesh hash: sha-256 over the canonical mesh_spec (the parameters' identity).
// mesh file hash: sha-256 over the compiled glb bytes (the geometry's identity).
// record hash: sha-256 over the full record excluding prev_hash, per the schema.
// prev_hash: the previous record's record_hash, genesis is null.
let prev = null;
const fixtures = base.map((r) => {
  const record = { ...r, prev_hash: null };
  record.assets.mesh_sha256 = sha256(record.parameters.mesh_spec);
  const glb = buildGlb(compileSpec(record.parameters.mesh_spec));
  record.assets.mesh_glb_uri = "data:application/octet-stream;base64," + Buffer.from(glb).toString("base64");
  record.assets.mesh_glb_sha256 = createHash("sha256").update(glb).digest("hex");
  // record_hash: sha-256 over the canonical record with both hash fields removed
  const { prev_hash, ...forHash } = record;
  record.record_hash = sha256(forHash);
  record.prev_hash = prev;
  prev = record.record_hash;
  return record;
});

writeFileSync(new URL("./fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2));
for (const f of fixtures) {
  console.log(`${f.name}: mesh ${f.assets.mesh_sha256.slice(0, 12)} record ${f.record_hash.slice(0, 12)} prev ${(f.prev_hash || "genesis").slice(0, 12)}`);
}
