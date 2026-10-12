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

// mesh hash: sha-256 over the canonical mesh_spec alone (the compiled geometry's identity).
// record hash: sha-256 over the full record excluding prev_hash, per the schema.
// prev_hash: the previous record's record_hash, genesis is null.
let prev = null;
const fixtures = base.map((r) => {
  const record = { ...r, prev_hash: null };
  record.assets.mesh_sha256 = sha256(record.parameters.mesh_spec);
  // record_hash: sha-256 over the canonical record with both hash fields removed
  const { prev_hash, ...forHash } = record;
  record.record_hash = sha256(forHash);
  record.prev_hash = prev;
  prev = record.record_hash;
  return record;
});

writeFileSync(new URL("../app/fixtures.json", import.meta.url), JSON.stringify(fixtures, null, 2));
for (const f of fixtures) {
  console.log(`${f.name}: mesh ${f.assets.mesh_sha256.slice(0, 12)} record ${f.record_hash.slice(0, 12)} prev ${(f.prev_hash || "genesis").slice(0, 12)}`);
}
