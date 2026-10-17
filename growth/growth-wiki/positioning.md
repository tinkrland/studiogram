# positioning: the deterministic photo studio

## the one sentence

studiogram is a virtual photo studio that renders the exact mesh that goes
to manufacturing, on a rigged hand you can pose, dress, and recast at will:
no diffusion model ever touches the product.

## the studio has roles, not a prompt

the product is organized the way a real photo studio is organized, and
each concern is a separate system with its own state:

- the talent: the rigged hand or bust, with skin tone, body hair, 19 nail
  shapes, tattoo ink painted into the texture, and seven blend-target
  morphs. a hand model and wardrobe department in one subject panel.
  the doll is the default: a single matte ivory material over the whole
  skinned mesh, in the code's own words "jewelry photography favors the
  quiet matte doll — the piece is the subject, the hand is the stand".
  the skin finish is the full dressing room: color rebuilt from the
  chosen albedo so pale stays pale and deep stays deep, seeded follicle
  strokes for body hair, ink committed into the texture atlas so it
  rides posing and morphs, polish tinting the real nail-plate geometry
  instead of a smudged atlas ellipse.
- the set: backdrop and scene, switchable mid-take on video, never frozen
  behind the subject.
- the arrangement: every piece is an independent object at a named seat
  (finger, wrist, ear lobe, nose), stacking along the limb, following the
  pose. this is the prop system in its first form; a curated prop library
  is a declared later phase in the code itself, and the arrangement seats
  are exactly where those props will land.
- the lighting rig and the camera: separate panels, camera-owned depth of
  field, framing changeable mid-take.
- the output: photos and video from the same scene state. captures are
  creator outputs with provenance records; retakes are byte-identical.

this is why the studio metaphor is structural, not decorative. a
diffusion tool folds all of these into one prompt and gives you a lottery
ticket. studiogram keeps the roles separate the way a stage does, so
changing the set never re-rolls the talent, and re-posing never re-rolls
the product.

## what it is against

the 2026 on-model category (welpix, fititon, neuroviz, tashvi, photta) takes
a product photo or a prompt and generates imagery. three structural costs:

1. hallucination. generation redraws the product from a statistical model of
   what products look like. prongs, engraving, stone counts, proportions can
   all drift. the customer receives what the model imagined, not what ships.
2. flags. 2026 is the year platforms made the buyer pay for this. tiktok's
   july 21, 2026 ad policy requires disclosure labels on ai-generated ad
   creative; etsy's seller policy (effective july 9, 2026) requires photos
   that document the actual finished item, with ai model imagery permitted
   only with disclosure; meta applies "ai info" labels and downranks
   undisclosed realistic ai creative. the enforcement risk that actually
   kills accounts is not the label. it is misrepresentation: tiktok shop's
   own rule is that ai images "should never change the product's size,
   color" or otherwise misstate the item. a generative render cannot
   guarantee that. a deterministic render of the real mesh is the only
   image class that can.
3. the re-roll tax. want the ring tilted two degrees, or the nail shape
   changed, or a different skin tone, or the same shot in 4:5 and 9:16?
   with generation, every tweak is a new lottery ticket and a new risk the
   product details drift. in studiogram it is a slider. back-to-back takes
   are byte-equal, verified by the in-page selftest.

## the honest disclosure position

a studiogram capture is still synthetic media and should be disclosed as
such on platforms that ask (tiktok's is_aigc flag exists in the posting api
the commerce glue already speaks). the difference is what the disclosure
protects: the image is a faithful render of the real product geometry,
hash-verified against the release. disclosure plus exactness is a
defensible position. disclosure plus hallucination is not. never market
studiogram as a way to evade ai labels; market it as the way to make the
label honest.

## the hand model angle

the rigged, dollified hand (and the bust) is the wedge that generative
tools cannot copy cheaply: a hand model you never pay, never schedule, and
can customize per shoot: 19 nail shapes with real plate geometry, skin
tones, body hair, tattoos that paint into the texture, poses that bend a
real 33-bone skeleton. a real on-model session with a hand model runs
$200 to $5,000; a retake in the studio is a keypress. the subject is the
product; the hand is the stand.

## the input asymmetry, stated honestly

diffusion tools accept a photo. studiogram accepts a mesh. that is a
barrier for buyers who only have photos, and it is the moat for buyers who
already have meshes. jewelry made by lost-wax casting always already has
a mesh: the 3d-printed master starts as one. so the made-to-order jeweler
is the beachhead, and the photo-to-mesh onramp (or a mesh-authoring path)
is the future unlock for the dropshipper segment.

## scope

jewelry is the credible wedge (rings, earrings with seated stacks, hoops,
necklaces with drape, bracelets on wrist). the architecture is
subject-shaped, not jewelry-shaped: watches, eyewear, accessories are
natural extensions. studiogram stands alone as a studio; it does not
require sculptura.
