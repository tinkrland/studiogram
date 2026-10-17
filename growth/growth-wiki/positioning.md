# positioning: the deterministic photo studio

## the one sentence

studiogram is a virtual photo studio that renders the exact mesh that goes
to manufacturing, on a rigged hand you can pose, dress, and recast at will:
no diffusion model ever touches the product.

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
