# instructions for the working agent

this file is the working brief for the next pass on this repository. it
assumes the reader has the repo open but not the surrounding product
context, so the rules are stated in full. read it before making changes.

## what this repository is

this is the first pass of studiogram, a virtual product photography studio
for jewelry: the same compiled 3d artifact that will be sent for
manufacturing is placed on a rigged hand, posed, lit, and captured as a
reproducible scene. the product context, scope, and provenance of every
requirement live in `studio/studiogram/build-scope.md` in the `kirosculp`
repository (the standalone scope of record). the short version of its
invariants, which this build must keep:

- one artifact: the scene renders the same geometry that goes to
  manufacturing. no second copy of a design, no redraw, no generation.
- deterministic: explicit geometry plus saved scene state reconstructs
  the same view. no generative imagery anywhere.
- one-way rule: release records enter scenes by reference (id, version,
  asset hash) and nothing flows back. the ingestion gate recomputes every
  hash and refuses mismatches. never trust a declared claim over a
  recomputed one.
- scene state is quantitative values only (transforms, poses, light
  values, capture order). saved hands are creator assets stored beside
  scene state, not inside it; captures keep thumbnails only in state, full
  png frames in memory.
- captures are creator outputs for presentation. they never modify a
  release and never authorize a transaction.

## house rules

- all prose lowercase throughout, including product names when natural.
  no emojis, no em dashes. preserve exact case in code, identifiers,
  urls, and credits. the only existing uppercase exceptions are the
  author credit "rigged hand" by DennisH2010 where the license requires
  attribution fidelity, and `README.md`/`repo.md` by established repo
  convention.
- commit messages: a lowercase subject of about 50 characters stating the
  one idea, with reasoning and verification notes in the body.
- the build is the verification. `scripts/build-app.sh` concatenates the
  manifest in program order; after any source change it must run clean and
  `git status` must show no diff in `artifact/` (byte-for-byte
  reproducibility is an invariant, not a nicety).
- every runtime behavior that can be asserted deterministically gets a qa
  check. existing harnesses: `scripts/qa-drag.mjs` (real mouse drags in
  headless chrome; needs system chrome at `/usr/bin/google-chrome` and
  `npm i` first), the `#selftest` in-page pixel check, and the `#audit`
  scene probe. keep them current when behavior changes; the previous pass
  added checks this way (pinned reproduction, unload flush).
- after each rebuild, the deployed page is the uploaded `artifact/index.html`;
  the upload produces a new public url and `functions/serve-studiogram.ts`
  must be updated to point at it. keep that deploy step in this doc, not
  in anyone's head or a sandbox: the repo is the source of truth.

## current state (as of the unload-flush commit)

- subject: rigged hand (8970 verts, 33 bones), five pose presets, per-
  finger curl/spread, wrist framing; seven authored blend targets plus
  presentation presets; surface layer (tone tint, follicle hair, nail
  polish from extracted nail plates, atlas-painted tattoos); porcelain or
  skin finish.
- jewelry: procedural rings and bracelets attached to bones, stacking
  offsets, cross-creator fixtures, metals with per-metal materials.
- camera: free orbit vs pinned deterministic shots, lens trio feeding a
  depth-of-field composite; pinned framing ignores pointer input and
  reproduces exactly (qa-verified).
- lighting: three-light studio rig plus ambience presets, four named
  recipes.
- captures: snapshot plus sha-256 state hash per capture, reproduce,
  reorder, png export; state export/import with gate re-verification.
- release fixtures: five records shaped after the design-release schema
  with a real hash chain (`core/make-fixtures.mjs`).

## next-pass priorities, in order

1. **release mesh consumption.** the gap: `buildArtifactMesh()` in
   `jewelry/70-jewelry.js` rebuilds geometry procedurally from
   `parameters.mesh_spec` (band, dome_band, signet, cuff). the scope's
   invariant is that the scene consumes the release's compiled mesh, so
   what is shown is what is manufactured. extend the release record's
   `assets` to carry the compiled mesh (a glb referenced by uri) plus a
   hash over the mesh file bytes, extend the ingestion gate to verify
   that hash the same way `mesh_sha256` is verified today (currently a
   hash over the mesh_spec, which stands in for the mesh identity), and
   render the real mesh through the existing GLTFLoader path. keep the
   procedural path only as a fixture fallback for records without a mesh
   asset. the fixture generator (`core/make-fixtures.mjs`) grows a real
   mesh builder for this. note: `sizing` stays out of v1; fixtures carry
   `inner_radius_mm` directly.

2. **hand model license review, before any production use.** the hand is
   "rigged hand" by DennisH2010, blendswap 66039, CC BY-SA 3.0. the
   credit is wired everywhere it must be (license file, in-app credit,
   scene-state credit). share-alike needs a ruling: get counsel's read on
   whether production renders and the artifact embedding the model are
   adaptations carrying by-sa obligations, or replace the base hand with
   an in-house authored model (which also serves the "one base hand"
   invariant long-term). no code action until ruled; do not ship
   production imagery before it.

3. **vendor three.** the importmap pins `three@0.160.0` on unpkg:
   version-deterministic but an external runtime dependency. vendor the
   module (and the two addons) into the artifact or serve them beside it,
   so the deterministic artifact has no external dependency. keep the
   pin; only change where it is served from.

4. **earlobe placement.** the scope supports finger, wrist, and earlobe;
   the build supports finger and wrist. earlobe needs authored ear
   geometry (in-focus product-adjacent anatomy is authored geometry,
   never reconstructed output). parked until the owner rules on a second
   subject; do not improvise one.

## deliberately parked: do not pull into this pass

- props. the background prop library with meta sam reconstruction is a
  far-later phase and platform-prepopulated, never creator-generated.
  scenes here keep plain seamless backdrops; scene state carries no prop
  slots.
- movement (movement previews, short animations, gifs). open owner
  decision, not first-pass scope.
- wearables (vr/ar try-on). future version, not scheduled.
- anything platform-side: listings, pricing, orders, checkout. captures
  may someday be attached to listing content, but this repo never touches
  commerce.

## state and schema discipline

- scene state schema is `studiogram-scene-state`, `state_version: 1`.
  bump `state_version` on breaking changes and keep restore tolerant of
  older saves (`restoreFromStorage` already refuses mismatched hand
  models rather than corrupting a scene).
- never add qualitative data to scene state (no reference images, no
  free-form blobs). quantitative values only.
- randomness discipline: seeded generators (mulberry32) for anything
  that feeds a render; unseeded ids only where they are pure identifiers
  (capture ids, instance ids) that never affect pixels.
