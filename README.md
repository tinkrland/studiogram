# studiogram

a virtual product photography studio for jewelry on a rigged hand.
one deterministic html artifact renders the whole studio: scene, subject,
light, captures.

the subject is a rigged hand with a real skeleton ('Rigged Hand' by
DennisH2010, blendswap.com/blends/view/66039, CC BY-SA 3.0 — see
`assets/rigged-hand/blendswap-license.txt` and the in-app model
credit; the license travels with every use).

the working brief for the next pass lives in [instructions.md](instructions.md): current state, priorities (release mesh consumption, license review, vendoring three), the parked phases, and the house rules.

## what it does

- **subject**: skinned hand mesh (8970 vertices, 33 bones) with per-joint
  posing, five authored pose presets, and per-finger curl/spread sliders.
- **surface**: skin finish with tone tint, body-hair follicles, nail polish
  (polish plates are extracted from the mesh's own uv data), and
  surface-aware tattoos painted into the texture atlas — ink follows the
  surface under the cursor, rides posing and morphs, no decal geometry.
- **morphology**: seven authored blend targets on the one base mesh
  (build, finger length/thickness, palm width/proportions, nail
  length/shape) plus male/female/neutral presentation presets as blend
  weights. one base hand, no library of people.
- **finish**: matte porcelain display hand or the original skin textures;
  surface details exist only on the skin finish.
- **jewelry**: procedural rings and bracelets attached to bones, so pieces
  ride posing.
- **captures**: creator outputs with reproducible state (camera, pose,
  light, backdrop), exportable as a png set.
- **provenance gate**: builds verify against a published release manifest.

## layout

the repo reads as the product's feature map; the build reads as one
ordered program. each domain folder holds its runtime code (split at the
original section boundaries, so the manifest concatenation reproduces
the artifact byte-for-byte) plus its authored inputs and scripts.

- `dollification/` — the porcelain display-hand finish
- `customized-hands/` — the hand model, authored blend targets, the
  surface layer (tone, hair, nails, tattoos) and the subject panel
- `posing-studio/` — pose presets as authored joint rotations + the pose panel
- `jewelry/` — procedural rings and bracelets + their panel
- `camera/` — free orbit, pinned deterministic shots, the lens trio
- `lighting/` — the three-light studio rig + its panel
- `setdesign/` — backdrops and scene composition + the scene panel
- `socmed-integration/` — the capture set: frame, reproduce, png export
- `core/` — shell, utils, state, registry fixtures, render composite,
  panels infra, state import/export, boot, the in-app qa hooks
- `assets/` — the exported `hand.glb` and the licensed model sources
- `spec/` — the working specs the next pass builds from
- `scripts/` — generic pipeline (build, glb export, inspection, qa tests)
- `artifact/` — the deterministic outputs: `index.html` and `app.mjs`

## invariants

- one artifact, one base hand: no asset swaps, everything is blend weights,
  joint rotations, and texture composites.
- deterministic: the same inputs produce the same artifact; live checks run
  the deployed page headless and pixel-verify against expectations.
