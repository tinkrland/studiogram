# social commerce integration: from product tags to checkout

how kirosculp/studiogram work plugs into social commerce: what a product
tag actually is on each platform, what has to exist before tagging is
possible, where checkout happens, and what the made-to-order model
breaks unless handled explicitly. companion to
[social-commerce-reference.md](social-commerce-reference.md) (dimensions
and platform state); this file covers the mechanics of wiring the studio's
outputs into tagging and checkout. lives on the `social-commerce` branch
pending review.

evidence, checked 2026-10-13: querit searches on each platform's 2026
setup requirements, the platform docs in kirosculp (design release as the
studio-platform interface, platform/storefronts), the studiogram capture
record model, and an adversarial architecture cross-check on a free
openrouter model (nemotron-3-ultra 550b; its corrections and additions
are folded in and noted inline). kirosculp itself is untouched by this
pass: its repo was read only, all studio-facing work stays in this repo.

## the core mechanic: a tag is a pointer, the catalog is the destination

on every platform, a product tag on a post is not attached to the image.
it is a pointer into a **product catalog** that the platform holds:
instagram's tag resolves to a catalog item in commerce manager,
pinterest's product pin resolves to a catalog feed row, youtube's product
tag resolves to an item from a connected store, tiktok's shop tag
resolves to a seller center listing. no catalog, no tagging. so social
commerce integration is catalog engineering first, photography second,
and the photo-to-sku binding is the piece studiogram is uniquely
positioned to provide.

checkout then happens in exactly one of two places:

- **in-app**: only tiktok shop at scale in this matrix. the purchase,
  payment, and fulfillment tracking happen inside the platform
- **on the merchant site**: meta (in-app checkout removed for us
  merchants, website checkout since 2024-2025), pinterest (never had
  native checkout), youtube (tag links out to the connected store).
  the tag is discovery and the deep link; the product page is the
  conversion surface

practical reading: the website product page is the conversion surface on
three of the four tagging platforms. catalog quality and pdp speed
matter more than any platform storefront setup.

per-platform dossiers live in the sibling folders:
[shopping-hub/](shopping-hub/), [tiktok-shopping/](tiktok-shopping/),
[instagram-shopping/](instagram-shopping/),
[pinterest-shopping/](pinterest-shopping/),
[facebook-shopping/](facebook-shopping/),
[youtube-shopping/](youtube-shopping/), [x-shopping/](x-shopping/),
[tumblr-shopping/](tumblr-shopping/), [reddit-shopping/](reddit-shopping/),
[lemon8-shopping/](lemon8-shopping/), and
[xiaohongshu-shopping/](xiaohongshu-shopping/).

## the nine-platform pass (checked 2026-10-13)

one line each, the commerce state of the nine:

- **tiktok shop**: in-app checkout, $1b+ monthly us gmv, the affiliate
  engine is the distribution lever; mto still breaks native checkout
- **reddit**: shopping arrived in 2026 but as ad inventory (in-search
  carousels, shopify sync); organic stays community-governed and
  untaggable
- **pinterest**: catalog feed -> product pins, 24 tags per pin, and
  the only platform whose api sets the tags (the publish glue is
  built, commerce branch)
- **instagram**: catalog + 20 tags per post, checkout on the site; the
  publish glue is built, tagging is the in-app handoff
- **lemon8**: no commerce at all; affiliate links in descriptions, a
  manual-repost discovery bet on bytedance's western xiaohongshu
- **tumblr**: no commerce; affiliate links with disclosure, process
  storytelling for the craft niche
- **xiaohongshu (rednote/red)**: content, trust, and checkout in one
  app, 376m mau, the cross-border redshop is the only selling door
  for a us brand; a presence bet now, a market-entry decision later
- **x (twitter)**: no organic shopping, 2023 experiments dead;
  e-commerce is dynamic product ads from a feed plus link-out
- **youtube shorts**: merchant tags resolve to the google merchant
  center catalog, checkout on the site; the affiliate surface keeps
  expanding and originality is now algorithmically rewarded

the checkout map does not move: in-app only on tiktok shop and
xiaohongshu (through the cross-border door), everything else links
to the pdp.

## the creator-commerce extension (checked 2026-10-14)

the owner asked for ltk and the rest of the creator-affiliate layer;
dossiers live in the per-platform folders. one line each:

- **ltk**: the largest independent affiliate rail (~$4b annual
  creator-driven sales), brand door is paid (~$12k/yr self-serve) -
  a sponsor-creators channel, not a self-serve door
- **shopmy**: creator storefronts, brand-set 10-30 percent
  commissions, weekly payouts, no five-figure brand door - the first
  creator-commerce door and mto-compatible (the link lands on the
  studio pdp)
- **amazon storefronts**: the april 14 2026 associates update opened
  storefronts and onsite earning to all associates (onsite 1-3
  percent vs offsite 4 percent fashion); rides entirely on the
  list-on-amazon decision, which carries the mto conflict
- **whatnot**: live auction selling with in-app checkout (8 percent
  commission plus processing, ~12 percent all-in; 0 percent above
  $1,500 in select categories since january 2026); needs in-stock
  inventory and a live host

one checkout-map correction: whatnot does carry in-app checkout, so
the in-app list becomes tiktok shop, xiaohongshu (cross-border door),
and whatnot. everything else still links to the pdp.

## the binding: the release hash is the product identity

the studio-platform interface is the design release: a versioned,
immutable bundle with exact asset hashes, and the platform's listings
consume releases by reference. a studiogram photo already carries that
identity in its gate record: each gate entry is linked by `mesh_sha256`,
the same hash the release carries. the commerce binding therefore needs
no new identity system:

- release `mesh_sha256` = the product's immutable identity
- platform listing references the release (existing rule)
- catalog feed row uses the release id (or its short hash) as the
  merchant product id (`mpn` slot) in every platform feed
- studiogram photo's gate array references the same hash, so any
  captured image is provably a photograph of the exact geometry the
  listing sells

this is the anti-drift property extended into commerce: catalog image,
product page, and shipped piece all resolve to one hash. no generative
competitor can claim this; it is the studiogram differentiator stated in
commerce terms. it also gives provenance for the `mpn` field feeds demand
for custom goods (below).

## per-platform setup, in dependency order

### 1. the hub: shopify (or equivalent) + google merchant center

one commerce hub holds the catalog; everything else syncs from it. the
cross-check added the missing prerequisite: **google merchant center**
is the feed backbone for youtube shopping, the recommended feed source
for pinterest, a supplemental source for meta, and free google shopping
listings. domain verification (dns txt or html file) comes before any
catalog upload on meta and pinterest too. pixel plus conversions api
(server-side) is what makes tag-to-purchase measurement and retargeting
work on meta, tiktok, and pinterest.

### 2. meta (instagram + facebook)

- business or creator account, meta commerce eligibility review
  (documented range 1 day to 4 weeks; the cross-check notes commerce
  account verification itself can stall 2-4 weeks, so start it first)
- catalog with image, sku, price, product link per item (min 500x500
  image); sync via shopify integration or commerce manager
- after approval: up to 20 product tags per post, reel, or story;
  tags open the product page, purchase completes on the site
- domain verification is required before checkout urls are trusted

### 3. pinterest

- business account, claimed website, then a catalog data source
  (platform integration or feed upload); merchant guidelines review
- product pins accept up to 24 product tags; rich pins for product
  pages come from the same domain claim
- the verified merchant program is not a tagging prerequisite (cross-
  check correction): claimed domain + catalog + review unlocks product
  pins; vmp adds the badge and distribution. for a new brand it is a
  post-launch goal, not a launch blocker

### 4. youtube

- as the brand, the route is youtube shopping merchant via the shopify
  (google merchant center) connection, **not** the affiliate program
  (that is creators tagging other brands' products; cross-check
  correction to earlier notes)
- product tags on shorts and long-form resolve to the connected
  catalog; checkout lands on the store's pdp

### 5. tiktok shop (last, highest friction)

- seller center registration: us business documents, tax and payout
  details; then product listings requiring 5+ high-resolution images
  per product, no off-platform redirects inside shop listings
- the only in-app checkout; commission by category (roughly 5-20
  percent plus processing)
- note the mto conflict below before investing here: native shop
  checkout cannot carry line-item options

## made-to-order breaks the standard feed assumptions

the cross-check flagged these; they are the real integration work for
a mto brand and none of them are photography problems:

1. **no gtin**: custom manufactured goods have no global trade item
   number. feeds must set `identifier_exists: false` (or equivalent)
   and use the release id as `mpn`. missing this disapproves the feed.
   the release hash is the natural mpn
2. **availability semantics**: feeds expect in_stock/out_of_stock/
   preorder/backorder. mto is strictly preorder, but preorder is
   deprioritized or buy-button-hidden on some surfaces. the standard
   mto pattern is in_stock plus a published ship-by/handling window;
   decide this as a platform policy, not per-feed
3. **handling time**: feeds want static shipping and transit fields;
   mto lead times (casting, finishing, plating) vary. publish the
   worst case as `max_handling_time` (e.g. 30 days) or maintain it via
   the content api / supplemental feeds rather than the daily batch
4. **quantity**: shopify inventory for mto is typically 0, but feeds
   want quantity > 0 to serve. the feed layer needs a quantity
   override (publish 1 or a fixed number while backend stays 0)
5. **price cadence**: if metal pricing moves, batch daily sync is too
   slow. price updates need an api-driven path (tiktok content api,
   meta/pinterest supplemental feeds) or prices must be locked per
   listing window
6. **options at checkout** (the biggest one): ring size, engraving,
   and sizing are line-item options. meta and pinterest never see the
   checkout, so their tags can deep-link to a configured pdp and it
   works. **tiktok shop native checkout does not support custom line
   item properties**: either every size/engraving combination becomes
   a static variant sku (combinatorial explosion) or that product
   redirects to the site and loses native checkout. for kirosculp's
   made-to-order rings this is the deciding factor for whether tiktok
   shop is a storefront or just an ad channel
7. **return policy**: mto final-sale terms must be published in the
   feed's return policy fields; platforms penalize missing or
   restrictive policy visibility

## what studiogram provides today, and the gaps

today: photos record their export dimensions, their gate array (the
mesh hash linkage), camera state, and set membership; capture sets are
carousel-ordered; batch export exists; the export presets cover 1:1,
4:5, 9:16, 16:9. that is most of the asset side of tagging already.

the gaps to close, in value order:

1. **the commerce card on the export**: a per-photo (or per-set) sidecar
   export carrying sku, product title, price, deep pdp link, and the
   release hash - enough to paste into a catalog row or a platform's
   tag picker without re-typing. the gate record already holds the
   hash half; the platform holds the listing half
2. **capture set to feed image set**: tiktok requires 5+ images per
   listing and meta wants one per angle; a set export that names files
   by set + order + release id is feed-ready with no renaming step
3. **the 2:3 preset** (already flagged in the reference doc): catalog
   and pin images for pinterest
4. **alt text and captions**: tagged posts need per-image alt text and
   platform copy; the set card is the natural home for both, written
   once per set and adapted per platform

none of these are runtime changes to the artifact; they are export
surface additions that fit the existing record model.

## recommended sequencing

1. hub first: shopify + google merchant center + the pdp (the
   conversion surface for 3 of 4 platforms)
2. meta + pinterest in parallel: eligibility and domain claims are
   slow-clock items that run while the catalog is being built; both
   are link-out, so the pdp carries the sale
3. youtube merchant: cheap once the merchant center feed exists
4. tiktok shop last: highest onboarding friction, and the mto options
   conflict must be resolved (static variant explosion vs site
   redirect) before any listing work is worth doing
5. studiogram work streams with the branch: commerce card export and
   the 2:3 preset are the first two studio-side items

the creator's tagging flow once live: compose and capture a set in
studiogram, export the set plus its commerce card, upload to the
platform, tag from the catalog by release id, and the platform deep
link carries the sale to the pdp. one hash from photo to checkout.
