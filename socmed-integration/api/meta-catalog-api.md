# meta: the catalog feed and the batch api behind it

checked 2026-10-13 against meta's feed specification (current 2026
reference) and the graph api catalog surface.

## two ingestion paths, one catalog

- **feed file**: csv/tsv/xml uploaded to commerce manager or fetched on
  a schedule from a hosted url. this is the path the studio's csv
  speaks, and the same catalog serves facebook and instagram
- **catalog batch api**: graph api `POST /{catalog_id}/items_batch` -
  upsert product items in batches without a feed file. the platform
  (kirosculp) can graduate to this for near-real-time price and
  availability updates without changing the schema below; the feed
  remains the fallback and the audit trail

## the required fields, verified (2026 spec)

id, title, description, availability, condition, price, link,
image_link, **brand**. the v1 meta builder emitted everything except
brand; the correction pass adds the brand column (from the manifest's
optional brand, blank if absent).

- **id**: unique, case-sensitive, max 100 chars; sku is the documented
  choice
- **title**: max 150 chars (the ui shows ~65); no promo language
- **description**: max 5,000 chars plain text; longer than the title
- **availability**: exactly `in stock`, `out of stock`, or `preorder` -
  lowercase with a space. the mto pattern ships `in stock`; `preorder`
  is a supported value here too, same policy decision as google
- **condition**: `new`, `refurbished`, or `used`
- **price**: `420.00 USD` - number, period decimals, iso 4217 code,
  one currency per feed
- **link**: https product page url - this is the conversion surface
  since native in-app checkout ended (2024 announcement, us shops
  transitioned by august 2025)
- **image_link**: min 500x500 px, no watermarks; 1:1 or 4:5 preferred -
  the studio's square and 4:5 exports fit this directly
- **brand**: required; gtin/mpn are only conditionally required when
  the product is branded and sold by multiple retailers, which custom
  made-to-order goods are not

useful extras the builder does not yet emit (parked, platform-side):
`item_group_id` for variants, up to 10 `additional_image_link`s (a
studiogram capture set maps onto this naturally - a future builder
improvement), `custom_label_0-4` for campaign structuring, optional
`inventory`.

## two rules that bite later

- **the pixel content-id rule**: for advantage+ catalog ads, the
  content id in the meta pixel events must equal the feed `id` (the
  sku). since the studio uses the same sku in the commerce card and
  the feed, the platform just needs to pass it through checkout
  events unaltered
- **the 56-day window**: a product can sit in shops as sold out for up
  to 56 days after availability flips; the platform's feed cadence
  must update faster than that for made-to-order batches that close
