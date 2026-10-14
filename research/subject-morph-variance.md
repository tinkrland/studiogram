# subject morph variance: making one sourced bust or ear read as many people

research note, 2026-10-14, answering the owner's question: with sourced
blend models, can code + sliders vary the neck/bust (collarbone
prominence, frame) and ears so the same asset doesn't become recognizable
across photos? yes, and the studio already proves the mechanism on the
hand: `assets/hand.glb` carries nine authored morph targets
(`finger_thickness, finger_length, palm_width, palm_proportions, build,
nail_length, nail_shape, presentation_male, presentation_female`),
exported as gltf shape keys, driven by `S.hand.morph` sliders in
`customized-hands/52-morphology.js`. a bust and an ear are the same
pipeline with different anatomical axes.

## the two routes

**route 1, authored shape keys (preferred).** in blender, sculpt a small
set of named shape keys on the sourced base mesh, one per anatomical
intent, mirrored l/r where the subject is symmetric; export the glb with
shape keys as morph targets (`extras.targetNames`, exactly how the hand
ships). the runtime cost is a weight per target on the gpu; sliders stack
additively and clamp to the artifact-free span. this is the hand's route
and it needs no new studio code beyond sliders over a new morph dict.

**route 2, procedural region displacement (code-only fallback).** author
a region point-set per anatomical axis (the studio already ships authored
regions: `hair-region.json`, `nail-region.json`) and displace vertices
along normals inside the region with a smooth falloff. no blender work
per model and it works on any mesh, but the shapes are crude (normal pushes
only, no ridge sculpting like a real collarbone). good enough for "slightly
different person", not for close-ups.

## the axis vocabulary (curated, not exhaustive)

the hand's lesson: seven axes that each read as one anatomical intent.
the same discipline applies per subject.

**neck/bust:**
- collarbone prominence (the ridge + its fossa)
- neck length (vertebra spacing, jawline follows)
- neck circumference
- trapezius slope (neck-to-shoulder transition, drives how chains sit)
- shoulder width / frame (narrow to broad)
- chest volume (bust fullness)
- presentation keys (the hand's male/female presentation precedent)

**ear:**
- lobe size, lobe attachment (attached vs free)
- helix prominence, ear width/length, conch depth
- (rotation/scale of the whole ear is a transform, not a morph)

a "subject identity" is then just the vector of slider values. per
scene, randomize within curated ranges (or pick presets) and the same
sourced bust reads as different people. the vector lives in scene state,
so captures and exports re-render the exact same person deterministically
— same discipline as pose and lighting.

## interactions the v2 work must respect

- **drape evaluates on the deformed mesh.** a necklace rests where the
  collarbones are; morphs must be applied before any surface sampling, so
  drape reads the morphed positions, not bind positions.
- **piercing sites follow morphs.** an ear site anchor authored against
  the bind mesh must ride the morph displacement — either sample the
  morphed surface at placement time or store the anchor as (vertex,
  offset) so it moves with the lobe/helix shape it lives on. the nail
  plates already solve the analogous problem for bones; this is the
  morph-space version.
- **artifact span per model.** each sourced model has a range where its
  shape keys stay clean; clamp sliders to the span, and a model whose
  topology fights the sculpts gets fewer axes, not broken ones.

## sourcing checklist (what to demand from a blend model)

1. clean quad topology, single base mesh, symmetric where the subject is
2. sculptable: shape keys hold their form at the intended extremes
3. exportable: glb with morph targets + `extras.targetNames`
4. no rig needed for the bust's first pass (a turn/tilt transform covers
   framing); ears need none at all
5. license that permits derivative shape keys (the rigged-hand precedent:
   attribution preserved, license terms in the repo)

## what stays open

- whether presentation keys (male/female) are wanted for busts as they
  exist for hands — merchandising question, not a technical one
- identity presets as shareable objects (the ear-stack preset question,
  same shape: scene state vs platform catalog entity)
- whether route-2 procedural morphs are worth building at all if route-1
  authoring per sourced model stays cheap
