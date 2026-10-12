# how this repository is organized

this file explains the repository itself. the [readme](README.md) explains
the product.

## repository map

```text
app/
  parts/            the eight ordered source parts of the studio
  fixtures.json     release registry fixtures embedded at build
  hand.glb          the rigged hand model, deterministic build input
  poses.json        authored pose presets as joint rotations
  hair-region.json  forearm follicle uv candidates, exported from the mesh
  nail-region.json  nail-plate uv regions, exported from the mesh
  tex-0.jpg         base color and normal textures exported from the
  tex-1.jpg         source blend, used by the offline extractors

artifact/
  index.html        the deterministic build: the one self-contained artifact
  app.mjs           the same build as a node-checkable module

assets/rigged-hand/
  *.blend, *.jpg    the licensed model sources, credit attached
  blendswap-license.txt

scripts/
  build-app.sh      concatenates the parts and inlines the inputs
  export*.py        glb exports from the source blend (pipeline iterations)
  morphs.py         authored blend targets + hair-region export
  poses.py          authored pose presets + pose renders
  nails_extract.cjs nail-plate uv extraction from the glb
  nails_explore.py  scratch analysis behind the extraction
  inspect_*.py/mjs  blend/glb inspection dumps
  make-fixtures.mjs release registry fixture generator
  geotest*, normaltest*  offline qa against three.js math

functions/
  serve-studiogram.ts  serves the built artifact
```

## naming

all lowercase, hyphenated when compound, matching the kirosculp
repository. the only uppercase exceptions are the author's credit
('Rigged Hand' by DennisH2010) and `README.md`.
