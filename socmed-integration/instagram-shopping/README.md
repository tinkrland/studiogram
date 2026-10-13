# instagram shopping: tags and the link-out era

instagram is the top organic format for the niche (carousels dominate)
and a full tagging surface, but since meta's native in-app checkout
wind-down (announced 2024, most us shops transitioned by august 2025)
every purchase lands on the website pdp. instagram is discovery and
catalog display, not a checkout.

## onboarding

- business or creator account, meta commerce eligibility review:
  documented 1 day to 4 weeks; commerce account verification itself
  can stall 2-4 weeks, so start it first and let the catalog build
  while it runs
- domain verification (dns txt or html file) before catalog upload, so
  checkout urls are trusted
- catalog via shopify integration or commerce manager: image (min
  500x500), sku, price, product link per item

## tagging mechanics

- up to 20 product tags per post, reel, or story; tags open the
  product page in-app, purchase completes on the site
- advantage+ catalog ads retarget from the pixel plus conversions api
- facebook and instagram share one commerce manager catalog (see
  [facebook-shopping/](../facebook-shopping/))

## corpus evidence (93 jewelry posts, 2026-10-12)

- 47 percent of sampled niche posts were carousels; every top
  performer was a ring-stack carousel
- 4:5 and 3:4 portrait dominate; dm/order ctas are the niche's
  fallback commerce language

## studio inputs

- feed: 4:5 1080x1350 default, 3:4 1080x1440 tall (native since the
  may 2025 grid change), 1:1 1080x1080, 1.91:1 1080x566 landscape
- carousel: all slides one ratio, max 20 slides; the profile grid
  crops 4:5 to 3:4, so keep subjects inside the central 3:4
- reels: 9:16 1080x1920, safe zones top ~108 px and bottom ~250 px;
  90 seconds standard

all presets exist in the current export except 3:4 (flagged in
[social-commerce-reference.md](../social-commerce-reference.md)).

## the 2026 conversion reality (checked 2026-10-13)

with checkout living on the site, the tag is only the door: the meta
pixel and the conversions api are the wiring meta actually optimizes
with, and advantage+ campaigns fly blind without clean server-side
tracking and an accurate catalog. the studio side of that is already
planned - the feed builders (commerce branch) and the pixel
content-id rule (tag id equals feed sku) exist precisely so the
purchase event can match the catalog row.
