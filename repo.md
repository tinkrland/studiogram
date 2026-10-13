# how this repository is organized

this file explains the repository itself. the [readme](README.md) explains
the product.
the [instructions](instructions.md) carry the working brief for the next pass.

the repository map mirrors the product: one folder per feature domain.
the single runtime program is split across those folders at its original
section boundaries, and `scripts/build-app.sh` concatenates the manifest
in program order — the split parts reproduce the artifact byte-for-byte.

## repository map

```text
spec/                 working specs the next pass builds from
                      (social-commerce.md, social-commerce-publish.md)
dollification/        the porcelain display-hand finish
  58-finish.js

customized-hands/     the hand as a shapeable subject
  50-model.js           glb load, rig binding
  52-morphology.js      authored blend targets
  54-surface.js         tone, hair, nail polish, the texture composite
  56-tattoos.js         sleeve-on ink painted into the atlas
  82-subject-panel.js   the subject tab
  morphs.py             authors the blend targets in blender
  hair-region.json      forearm follicle uv candidates
  nail-region.json      nail-plate uv regions
  nails_extract.cjs     derives the nail regions from the glb
  tex-0.jpg, tex-1.jpg  base textures for the offline extractors

posing-studio/        the hand as a posable subject
  60-posing.js          joint posing, pose presets, hand lifecycle
  86-pose-panel.js      the pose tab
  poses.py              authors pose presets in blender
  poses.json            the authored presets as joint rotations

jewelry/              the pieces
  70-jewelry.js         procedural rings and bracelets on bones
  84-jewelry-panel.js   the jewelry tab

camera/               framing
  45-camera-modes.js    free orbit vs pinned deterministic shots
  88-camera-panel.js    the camera tab, lens trio, pinned cameras

lighting/             the studio light rig, whole domain in one folder
  41-lighting.js        three named lights, ambience, recipes, defaults, applyLighting
  90-light-panel.js     the light tab

setdesign/            scene composition
  42-backdrops.js       seamless studio backdrops
  92-scene-panel.js     the scene tab

socmed-integration/   creator outputs
  95-captures.js        capture set: frame, reproduce, strip, png export
  96-commerce.js        listing manifest import, commerce card, catalog feeds
  98-publish.js         the publish glue: connect instagram, post the set
  api/                  per-platform product-api contracts (verified 2026-10-13)
  platform-reference.md export dimensions and shopping surfaces, checked 2026-10-12
  platform-reference.md export dimensions and shopping surfaces, checked 2026-10-12

core/                 the spine
  01-head.html          html shell
  02-core.js            utils
  03-registry-state.js  state store + provenance registry
  40-render.js          renderer, scene, orbit camera
  43-render-composite.js dof composite and renderFrame
  80-panel-infra.js     shared panel controls
  93-panel-shell.js     tab switching, gate entries
  96-state-io.js        scene state export/import/reset
  98-boot.js            restore + wire-up
  99-qa.js              in-app selftest and audit hooks
  fixtures.json         release registry fixtures (embedded at build)
  make-fixtures.mjs     their generator

assets/
  hand.glb              the exported rigged hand model
  rigged-hand/          the licensed blend sources, credit attached

scripts/
  build-app.sh          the deterministic build (ordered manifest)
  split-parts.py        the parts -> domain splitter, verified reassembly
  qa-drag.mjs           real mouse-drag qa in headless chrome (needs system
                        chrome; npm i first). checks orbit drags move the
                        view, pinned mode ignores pointer input and
                        reproduces its framing exactly, and captures taken
                        pinned record the pinned camera.
  export*.py, inspect_*, preview_hand.py, geotest*, normaltest*
                        the blender pipeline and offline qa
  qa-commerce.mjs      node qa of the feed/card builders (no browser)
  qa-publish.mjs       node qa of the publish glue payload builders

functions/             the publish glue backend (this app's functions)
  serve-studiogram.ts  serves the built artifact
  studioPublishConfig  tells the artifact if the instagram app exists
  studioOauthCallback  exchanges the oauth code (secret stays server-side)
  studioUploadPhoto    stores a jpeg frame, returns its public url
  studioPhoto          serves the stored jpeg bytes (instagram fetches)
  studioPublishCarousel  child containers -> carousel -> publish
```

## naming

all lowercase, hyphenated when compound, matching the kirosculp
repository. the only uppercase exceptions are the author's credit
('Rigged Hand' by DennisH2010) and `README.md`.

## numbering

source files carry their manifest position: 01 shell, 02/03 state,
40s scene and camera, 50s hand, 60s posing, 70s jewelry, 80s panels,
90s captures and boot, 99 qa. `scripts/build-app.sh` holds the order.
