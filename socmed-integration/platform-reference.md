# platform reference: export dimensions and shopping surfaces

captures are creator outputs: the studio never knows a channel exists, and
"attribution, captions, links, and posting remain with the creator" (the
capture readme). this file exists so that when export grows aspect-aware
crops, the numbers are already settled and sourced, and so the state of
each platform's shopping surface is recorded somewhere durable. it is
reference material, not a feature list: nothing here authorizes the
studio to post, tag, or transact.

all facts checked 2026-10-12 against current 2026 sources (querit web
evidence plus scraped corpora of 93 instagram posts, 175 tiktok posts, and
160 pinterest pins in the research session). re-verify before any pass
that depends on a specific number; platforms change these without notice.

## export dimension targets

the current build renders captures square: `renderPng(1600)` with
`camera.aspect` forced to 1. square is the native crop of almost nothing
below. the good news: aspect is a render-time value, so the same pinned
camera state can re-render into any target ratio without recomposing; a
portrait pass is a `setSize` and `camera.aspect` change, not a redesign.

### instagram

- feed post, portrait (the recommended default): 4:5, 1080x1350
- feed post, tall: 3:4, 1080x1440 (native since may 2025, matches the
  taller profile-grid preview)
- feed post, square: 1:1, 1080x1080
- feed post, landscape: 1.91:1, 1080x566
- carousel: same ratios as feed, all slides the same ratio, up to 20
  slides. carousels earn the most saves and get a re-serve (second
  impression) mechanic
- reels and stories: 9:16, 1080x1920, keep critical content out of the
  top/bottom ~14 percent ui safe zone

corpus evidence (93 recent niche posts): 4:5 and 3:4 portrait dominate,
47 percent of posts were carousels, and every high performer in the
sample was a carousel, mostly ring stacks.

### pinterest

- standard pin: 2:3, 1000x1500 (minimum 600x900, max 20 mb, jpg/png)
- idea pins (multi-page): 9:16, 1080x1920
- product pin images render square in shopping surfaces, but the pin
  itself stays 2:3

corpus evidence (160 jewelry search pins): tall pins rule. 2:3 and
near-9:16 first images dominated; square was 10 of 160. idea pins get
algorithm priority the way reels do on instagram.

### tiktok

- video: 9:16, 1080x1920
- photo mode (image carousels): 9:16 images, and per the platform's own
  guidance each image should lead to the next, ordered progression

corpus evidence (175 niche posts): process and story formats win (asmr
packaging, how-tos, reveals); static product stills underperform here.
tiktok is the argument for keeping animated outputs parked under the
movement decision, not for forcing stills onto it.

### facebook

- feed post: 4:5, 1080x1350 (max 30 mb)
- carousel cards: 1:1, 1080x1080, all cards the same ratio or the rest
  get cropped to the first card's dimensions
- shops and marketplace product images: square 1:1

facebook shares meta's catalog system with instagram, so the same
capture set feeds both surfaces.

## shopping surfaces, 2026 state

the meta shift matters most: **native in-app checkout is gone.** meta
began transitioning us shops to website checkout in june 2025, most
completed by august 2025; orders now route to the seller's own site.
discovery stays on-platform, conversion happens on the seller's website.
any channel-tier work in kirosculp should assume link-out commerce, not
in-app purchase.

### instagram (meta)

- product tagging requires a business or creator account, a connected
  product catalog, meta commerce eligibility, and policy compliance
- up to 20 product tags per post, reel, or story
- roughly half of us social buyers are expected to shop on instagram in
  2026; discovery surfaces include the shop tab, explore, and tagged posts

### facebook (meta)

- same catalog and eligibility system as instagram; a shop can appear on
  both from one catalog
- 69 million-plus us buyers shop on facebook; native checkout also
  removed, same website-checkout routing

### tiktok shop

- seller requirements: 18 or older, us resident, us address and tax
  information, a payout bank account in the same name, compliant
  products. no follower minimum. seller center registration, approval
  typically 24-48 hours. free to set up, commission charged per sale
- projected $23.41b us sales for 2026 (+48 percent), the accessories
  category runs ~$125m/month; but only 6 of 135 tagged posts in the
  corpus carried a shop product, and small creators still order by dm
  more than by shop tag. present, growing, not yet dominant in the niche

### pinterest

- no native checkout at all: pins always route to the merchant's site
- product pins come from a catalog feed; up to 24 product tags per pin
- the verified merchant program gives a blue check, preferential
  placement in shopping surfaces, and merchant-detail features.
  merchant guidelines require a clear returns policy and a high-quality
  website, and exclude affiliate-only sellers and wholesale retailers
- jewelry is one of the most searched, saved, and shopped categories on
  the platform; 29 percent of sampled jewelry search results were
  promoted pins and 42 percent were shoppable, so the surface is already
  commerce-shaped

## implications for the studio

- if export grows aspect awareness, the target set is: 4:5 (instagram
  and facebook feed), 2:3 (pinterest), 1:1 (square, for facebook
  carousels and shop product shots), and 9:16 only if motion ever lands.
  four crops, one pinned camera state each
- the capture set (named, ordered, set-prefixed exports) maps one-to-one
  onto instagram carousels and pinterest idea pins: both platforms reward
  ordered multi-image sets, which is what the photo-taking model already
  produces
- none of the shopping surfaces change the studio's invariant: captures
  never authorize a transaction. commerce is channel-tier work
  (kirosculp `buildplan/platform/channels.md`), and post-checkout-era
  meta means those channels are catalog-plus-website, not in-app
  storefronts
