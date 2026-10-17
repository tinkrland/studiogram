---
title: proskena
status: draft, waits in review
---

# proskena

a whole photography studio in your browser. direct the shoot, keep the
pixels.

proskena renders real jewelry geometry on a rigged hand you can pose,
dress, and recast at will. no diffusion model ever touches the subject:
the image is the object, by construction, hash-verified. and you do not
need to own a cad file to start: the studio ships a fixture catalog of
pieces that are cc0 for commercial use. shoot them, sell them, mood-board
them. bring your own mesh only when the photo must document your exact
product.

## how it maps to a real studio

the product is organized the way a working studio is staffed. every
department is its own system, so changing one never re-rolls the others:

- **the model.** the rigged hand or bust in front of the camera. pose it
  from authored presets or bend it finger by finger with curl and spread
  sliders; the jewelry follows the bone automatically.
- **the dressing room.** hand customization is wardrobe and styling:
  porcelain display finish or skin, tones rebuilt from the albedo so
  pale stays pale and deep stays deep, seeded forearm follicles for body
  hair, tattoo ink committed into the texture so it rides posing, 19
  nail shapes with real plate geometry, polish, seven blend-target
  morphs for the wrist itself.
- **the set dresser.** backdrops and scene, its own panel, switchable
  mid-take on video. change the set without touching the talent.
- **the prop artist.** a different job from the set dresser: the props
  are their own layer, and the hero product is never a prop. background
  props can come from meta sam 3d run in google colab, quarantined to set
  dressing where a hallucinated leaf costs nothing.
- **the gaffer.** the lighting rig is separate from the camera. relight
  without re-shooting, the way a studio relights a standing setup.
- **the cameraman.** lenses, focal distance, camera-owned depth of
  field. move it mid-take, the way you would move behind a real tripod.
- **the photographer.** you. direct all of the above in the same frame,
  no prompt, no generation round trip.

that separation is the whole idea. a diffusion tool folds every
department into one prompt and hands you a lottery ticket. proskena
keeps the crew, so re-posing never re-rolls the product and relighting
never re-rolls the pose.

## what you get

- **the talent.** a rigged hand with a real 33-bone skeleton, or a bust
  with face, chest, ear, and nose seats. porcelain matte by default, the
  quiet display hand: the piece is the subject, the hand is the stand.
- **the arrangement.** every piece is an independent object at a named
  seat: finger, wrist, ear lobe, pierced ear, nose, chest. rings stack
  along the limb, hoops thread the piercings, necklaces drape with real
  chain physics.
- **the fixture catalog.** built-in pieces, cc0 for commercial use, with
  tamper-evident hash chains on every record. shoot today, no mesh
  required.
- **the output.** photos and video from the same scene state. crops in
  4:5, 9:16, and 1:1 without a re-shoot. captures carry provenance
  records, and retakes are byte-identical: re-open the scene, get the
  same pixels.

## you are the photographer

the interaction model is direction, not prompting. want a different
angle? move the camera. want the hand turned? drag the pose slider, the
way you would ask a model to tilt a wrist. proskena answers in the same
frame.

the economics follow: every render is local. the only network calls are
asset loads, so a retake, a re-pose, or a crop change costs nothing and
waits for nothing. a diffusion tool bills and waits per generation, and
every one of those bills was a lottery ticket on the subject's likeness.

the cost structure is quiet all the way down. bring your own google
account and prop generation runs in google colab on sam 3d: no gcp
project, nothing provisioned, no infrastructure bill. renders are your
gpu's work, not ours. a free tier can be honest when the marginal cost
of a frame is zero.

## why not generation

2026 is the year platforms made buyers pay for generated product
imagery: tiktok requires disclosure labels on ai-generated ad content,
etsy requires photos that document the actual finished item, meta labels
realistic ai creative and downranks the undisclosed. the risk that kills
accounts is not the label, it is misrepresentation: the photo that
promises what the product is not. a generated image cannot promise what
it will show. a render of the real mesh cannot break that promise.

and the details: generation redraws prongs, engraving, stone counts,
proportions from a statistical guess of what products look like. fix one
thing and it forgets another: regenerate for a new angle and every
detail is redrawn from scratch, whether you asked or not. proskena
draws the mesh that goes to the caster, and cannot warp what it never
guesses: every pixel is a function of the scene state. the angle
changes, the product stays, because there is nothing to forget.

disclosure stays yours either way: a proskena capture is synthetic media
and should be disclosed where a platform asks. the difference is the
disclosure is easy to make honestly when the image is the object.

## who it is for

- **the made-to-order jeweler.** lost-wax casting starts from a cad
  mesh, so the file exists before the piece does. photograph it before
  it exists, exactly, in the crop your listing needs.
- **the faceless content maker.** pinterest boards, instagram carousels,
  mood imagery with no model to book and no face to show. the porcelain
  hand and the bust shoot faceless by design.
- **the small brand running drops.** listing and social imagery on a
  schedule, many crops from one scene, retakes that cost nothing.
- **anyone burned by the label wave.** if you have been flagged for
  generated imagery, this is the other road: exact by construction.

and not only jewelry. watches, eyewear, accessories, anything small and
wearable that performs on a hand, a wrist, or a bust. the architecture
is subject-shaped, not jewelry-shaped.

## the honest limits

- your own product still needs its mesh when the photo must document
  your exact piece. until then, the cc0 fixtures cover the shoot.
- generation is quarantined to set dressing. it never touches the
  subject.
- the hand model carries a cc by-sa 3.0 license; its credit is rendered
  in the subject panel, and presentation choices for public imagery are
  a ruling still open.

## about the name

the proskenion was the stage of the ancient greek theater: the raised
platform in front of the scenery where the performance happens. proskena
is that stage for objects: a place with a dressing room, a set, lights,
and a camera, where the product performs and you direct.

the whole studio is one self-contained page: no build step, no backend
required, no api key. the code carries the intent: every claim above
points at a comment or a function in the repo.

pricing: to be set at launch.
