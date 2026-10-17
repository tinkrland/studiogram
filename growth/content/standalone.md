---
title: proskena
status: draft, waits in review
---

# proskena

a whole photography studio in your browser. bring a mesh, leave with a
shoot.

proskena renders the exact geometry that goes to manufacturing on a
rigged hand you can pose, dress, and recast at will. no diffusion model
ever touches the product: the image is the product, by construction,
hash-verified.

## the studio has roles, not a prompt

photography is not one tool, it is a workplace with departments. proskena
keeps them separate, the way a real studio does:

- **the talent.** a rigged hand with a real 33-bone skeleton, or a bust
  with face, chest, ear, and nose seats. pose it from authored presets or
  bend it finger by finger with curl and spread sliders. it presents by
  default as a quiet matte porcelain display hand: the piece is the
  subject, the hand is the stand. switch it to skin and the dressing room
  opens: tones rebuilt from the albedo so pale stays pale and deep stays
  deep, forearm body hair as seeded follicle strokes, tattoo ink that
  commits into the texture so it rides posing for free, 19 nail shapes
  with real plate geometry and polish, and seven blend-target morphs
  that reshape the wrist without re-sculpting.
- **the set.** backdrops and scene, switchable mid-take on video. never
  frozen behind the subject.
- **the arrangement.** every piece of jewelry is an independent object at
  a named seat: finger, wrist, ear lobe, pierced ear, nose, chest.
  rings stack along the limb, hoops thread the piercings, necklaces
  drape with real chain physics. change the pose and the pieces follow
  the bone.
- **the light.** a lighting rig with its own panel. relight without
  re-shooting.
- **the camera.** lenses, focal distance, camera-owned depth of field.
  move it mid-take, the way you would move behind a real tripod.
- **the output.** photos and video from the same scene state. crops in
  4:5, 9:16, and 1:1 without a re-shoot. captures are creator outputs
  with provenance records, and retakes are byte-identical: re-open the
  scene, get the same pixels.

## you are the photographer

the interaction model is direction, not prompting. want a different
angle? move the camera. want the hand turned? drag the pose slider, the
way you would ask a model to tilt a wrist. proskena answers in the same
frame.

the economics follow: every render is local. the only network calls are
asset loads (your mesh, the hand, the bust), so a retake, a re-pose, or a
crop change costs nothing and waits for nothing. a diffusion tool bills
and waits per generation, and every one of those bills was a lottery
ticket on your product's likeness.

## why not generation

2026 is the year platforms made buyers pay for generated product
imagery: tiktok requires disclosure labels on ai-generated ad content,
etsy requires photos that document the actual finished item, meta labels
realistic ai creative and downranks the undisclosed. the risk that kills
accounts is not the label, it is misrepresentation: the photo that
promises what the product is not. a generated image cannot promise what
it will show. a render of the real mesh cannot break that promise.

and the details: generation redraws prongs, engraving, stone counts,
proportions from a statistical guess of what products look like. proskena
draws the mesh that goes to the caster. every tweak stays a slider, not
a re-roll.

disclosure stays yours either way: a proskena capture is synthetic media
and should be disclosed where a platform asks. the difference is the
disclosure is easy to make honestly when the image is the product.

## who it is for

- **the made-to-order jeweler.** lost-wax casting starts from a cad
  mesh, so the file exists before the piece does. photograph it before
  it exists, exactly, in the crop your listing needs.
- **the small brand running drops.** listing and social imagery on a
  schedule, many crops from one scene, no hand model to book.
- **anyone burned by the label wave.** if you have been flagged for
  generated imagery, this is the other road: exact by construction.

## the honest limits

- you need a mesh. photo-only sellers have no onramp yet; background
  props can come from meta sam 3d run in colab, but the hero product is
  mesh-only, always.
- generation is quarantined to set dressing. it never touches the
  product.
- jewelry is the credible wedge today: rings, earrings, hoops,
  necklaces, bracelets. the architecture is subject-shaped, not
  jewelry-shaped.

## about the name

the proskenion was the stage of the ancient greek theater: the raised
platform in front of the scenery where the performance happens. proskena
is that stage for objects: a place with a dressing room, a set, lights,
and a camera, where the product performs and you direct.

the whole studio is one self-contained page: no build step, no backend
required, no api key. the code carries the intent: every claim above
points at a comment or a function in the repo.

pricing: to be set at launch.
