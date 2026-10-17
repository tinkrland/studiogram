# studiogram

a creative direction studio for faceless product photography. jewelry and
body-adjacent product render on dollified models — a rigged hand, a sculpted
bust — and you direct them in a real studio, in the browser: light the set,
dress the model, pose, frame, take the photo or the video. no diffusion model
hallucinates the shot; the scene you set is the scene you get, byte for byte.
ideal for social commerce, where the product must look exactly like the
product.

one deterministic html artifact renders the whole studio: scene, subject,
light, captures. everything you can see in a frame is a number in a saved
scene state, and the same state reproduces the same frame — the opposite
of a prompt that never renders the same thing twice.

## the suite is in parts, the way a real studio is

a photo shoot is not one act. studiogram mirrors the working parts of an irl
studio:

- **the dressing room** — the subject is prepared before it ever reaches the
  set: morphology (one base hand shaped by authored blend targets — build,
  finger length and thickness, palm proportions — plus male/female/neutral
  presentation weights), surface (nine-tone skin palette with
  lightness/warmth/depth, body hair, 19-shape nail plates with polish),
  tattoos, porcelain doll finish, and the bust's tone and ear seats.
- **set design** — separately, as it happens irl: six backdrop presets plus
  free-color composition, a three-light studio rig, the frame's environment
  is scene state, not baked pixels.
- **props** — 3d objects placed into the backdrop as real scene
  objects: independent geometry, per-prop provenance in scene state
  (source, method, timestamp), background-only placement, and the same
  state renders the same backdrop every time. the platform's curated
  library (sam 3d objects by meta ingestion, their pipeline) will feed
  the placement system; authored placeholder entries stand in until it
  exists, the same way jewelry fixtures stand in for release records.
  because a prop is geometry in the scene and not a denoised guess, it
  literally cannot change between frames — no drift, no melted logos,
  no five-finger hands.
- **the studio floor** — you are the photographer: live orbit, zoom and pan
  mid-take, pinned deterministic shots, five export framings (viewport,
  1:1, 4:5, 9:16, 16:9), photo sets and videos that re-render from their
  recorded camera paths and lighting deltas.

## what it does today

- **subjects**: the rigged hand ('Rigged Hand' by DennisH2010,
  blendswap.com/blends/view/66039, CC BY-SA 3.0 — the license travels with
  every use) and the sculpted bust ('Head Sculpt - Female', cc0 —
  provenance in `assets/bust-provenance.md`), one subject on stage at a
  time, both sharing the same tone palette so one person reads one tone.
- **hand**: skinned mesh (8970 vertices, 33 bones) with per-joint posing,
  five authored pose presets, per-finger curl/spread, seven blend targets,
  porcelain or skin finish.
- **bust**: 210k-vert head-and-shoulders sculpt with the dressing room's
  tone system, authored ear seats (lobe, helix, tragus, conch) wearing
  studs, hoops and labrets that thread front-to-back through the anatomy,
  and a deterministic necklace drape — the length is the only input; the
  chain rides mesh cross-sections and dips exactly as far as the extra
  length allows.
- **jewelry**: procedural rings and bracelets attached to bones, so pieces
  ride posing.
- **captures**: photos and videos are immutable records with reproducible
  state (camera path, lighting deltas, snapshot), exportable as png and
  mp4/mov/webm.
- **provenance gate**: builds verify against a published release manifest;
  the bust's mesh loads only after its sha256 recomputes clean.

the working brief for the next pass lives in [instructions.md](instructions.md).

## layout

the repo reads as the product's feature map; the build reads as one
ordered program. each domain folder holds its runtime code (split at the
original section boundaries, so the manifest concatenation reproduces
the artifact byte-for-byte) plus its authored inputs and scripts.

- `dollification/` — the porcelain display-hand finish
- `customized-hands/` — the hand model, authored blend targets, the
  surface layer (tone, hair, nails, tattoos) and the subject panel
- `bust/` — the v2 subject: model load (hash-verified), ear seats,
  necklace drape, its panel, and the authored anchors and shells they
  solve from
- `posing-studio/` — pose presets as authored joint rotations + the pose panel
- `jewelry/` — procedural rings and bracelets + their panel
- `camera/` — free orbit, pinned deterministic shots, the lens trio
- `lighting/` — the three-light studio rig + its panel
- `setdesign/` — backdrops and scene composition + the scene panel
- `setdesign/93-props.js` — the prop placement system: library entries,
  state clamps, provenance, and the idempotent rebuild
- `socmed-integration/` — the capture set: frame, reproduce, export
- `core/` — shell, utils, state, registry fixtures, render composite,
  panels infra, state import/export, boot, the in-app qa hooks
- `assets/` — the exported `hand.glb`, `bust.glb` and the licensed model sources
- `spec/` — the working specs the next pass builds from
- `research/` — studio-side notes: ear stacks, subject morph variance
- `scripts/` — generic pipeline (build, glb export, inspection, qa tests)
- `artifact/` — the deterministic outputs: `index.html` and `app.mjs`

## invariants

- one artifact, no asset swaps: everything is blend weights, joint
  rotations, and texture composites; the subject is a doll you direct.
- deterministic: the same inputs produce the same artifact and the same
  frame; live checks run the deployed page headless and pixel-verify
  against expectations.
- nothing renders unverified: registry releases pass the ingestion gate,
  and the bust's mesh is fetched and hashed before it can take the stage.
