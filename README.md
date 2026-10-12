# studiogram

a virtual product photography studio for jewelry on a rigged hand.
one deterministic html artifact renders the whole studio: scene, subject,
light, captures.

the subject is a rigged hand with a real skeleton ('Rigged Hand' by
DennisH2010, blendswap.com/blends/view/66039, CC BY-SA 3.0 — see
`incoming_files/riggedhand/BLENDSWAP_LICENSE.txt` and the in-app model
credit; the license travels with every use).

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

- `build/parts/` — the app source, eight ordered parts (head, core, state,
  scene, hand, jewelry, panels, boot).
- `build/` — the deterministic build pipeline: `build.sh` concatenates the
  parts and inlines the fixtures, poses, uv regions and the glb model;
  `export*.py` / `morphs.py` / `poses.py` run inside blender 4.2 (not
  included) against `incoming_files/riggedhand/Hand_v.4_cycles.blend`;
  `nails_extract.cjs` derives nail-plate uv regions from the exported glb.
- `studiogram/index.html` — the built artifact, self-contained, no network.
- `build/app.mjs` — the same build as a node-checkable module.
- `tools/` — fixture generator.
- `functions/serveStudiogram.ts` — deno endpoint that serves the built
  artifact with the right content type.

## build

```
./build/build.sh
```

outputs `studiogram/index.html` and runs a node syntax check on
`build/app.mjs`. regenerating the glb / poses / uv regions requires blender
4.2 on the path and re-running the export scripts in `build/`.

## invariants

- one artifact, one base hand: no asset swaps, everything is blend weights,
  joint rotations, and texture composites.
- deterministic: the same inputs produce the same artifact; live checks run
  the deployed page headless and pixel-verify against expectations.
