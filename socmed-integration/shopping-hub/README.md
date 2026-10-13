# the shopping hub: catalog, pdp, and the feed backbone

the conversion surface for three of the five tagging platforms
(instagram, facebook, pinterest, youtube) is the merchant site, and
every platform's tag is a pointer into a catalog. this folder holds
the hub-side engineering: the catalog source, the product page, and
the feed rules that made-to-order goods must satisfy.

## the stack

- **shopify** (or equivalent): catalog of record, the pdp, checkout,
  and the sync source for meta and tiktok
- **google merchant center**: feed backbone. serves youtube shopping,
  the recommended pinterest feed source, a supplemental meta source,
  and free google shopping listings
- **domain verification** (dns txt or html) on meta and pinterest
  before any catalog upload
- **pixel plus conversions api** (server-side) for tag-to-purchase
  measurement and retargeting on meta, tiktok, and pinterest

## the binding

the design release's mesh_sha256 is the product identity everywhere:
the studiogram photo's gate record references it, the platform listing
references the release, and the feed row uses the release id as the
mpn. one hash from photo to checkout; catalog image, pdp, and shipped
piece cannot drift. see
[social-commerce-integration.md](../social-commerce-integration.md)
for the full mechanism.

## made-to-order feed rules

1. no gtin for custom goods: set `identifier_exists: false`, use the
   release id as `mpn` (missing this disapproves the feed)
2. availability: mto is strictly preorder but preorder is
   deprioritized on some surfaces; the standard pattern is in_stock
   plus a published ship-by window. decide once, platform-wide
3. handling time: publish the worst case (e.g. 30 days) as
   `max_handling_time`, maintained via content api or supplemental
   feeds rather than the daily batch
4. quantity: feeds want > 0 to serve while the backend holds 0; the
   feed layer applies a quantity override
5. price cadence: if metal pricing moves, batch daily sync is too
   slow; price updates go api-driven or prices lock per window
6. return policy: mto final-sale terms must be published in the feed's
   return policy fields

## sequencing

hub first (pdp + catalog + domain claims), meta and pinterest in
parallel (their reviews are slow-clock items), youtube merchant next
(cheap once merchant center exists), tiktok shop last (highest
friction plus the line-item options conflict in
[tiktok-shopping/](../tiktok-shopping/)).
