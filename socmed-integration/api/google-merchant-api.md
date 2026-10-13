# google: merchant api and the feed it replaced

checked 2026-10-13 against google merchant center help and the
merchant api developer docs.

## the sunset changes the api target

content api for shopping (v2.1, the `products.insert` world) **was
sunset on 2026-08-18; progressive errors started 2026-09-01**. the
official successor is the merchant api:

- base: `https://merchantapi.googleapis.com/{SUB_API}/{VERSION}/{RESOURCE}:{METHOD}`
- price is now `amountMicros` (int64 micros) + `currencyCode`, not the
  old `value`/`currency` string pair
- `customBatch` is gone; multi-product updates go through products
  update methods or async calls
- new method `ProductsUpdate` updates individual products without the
  full insert payload
- merchant center and the cloud project link via a developer
  registration call (`accounts/.../developerRegistration:registerGcp`)

the sunset does **not** touch the studio's csv export: file data
sources (csv/tsv/xml uploaded or fetched by merchant center) are the
same ingestion path as before, and shopify's google & youtube app
handles the api migration itself. what the sunset changes is the
platform-side (kirosculp) choice when it automates past the feed:
build against merchant api, not content api v2.1.

## the mto rules, verified

- **identifier_exists**: text/xml data sources accept `yes`, `true`,
  `no`, `false` (must be submitted in english); merchant api data
  sources accept only `true`/`false`. google's own examples are
  custom goods: "customized black dress", "hand-knitted scarf" with
  gtin and mpn **left blank** and identifier_exists `no`. this is
  exactly the kirosculp case, and the correction pass changed the
  builder to emit lowercase `false`
- **brand**: optional for custom goods but recommended; the manifest
  now carries an optional `brand` and the google row emits it
- **availability**: `in stock` (feed text) / `in_stock` (api). google
  also supports `preorder` as a first-class value with preorder
  attributes; the standard mto pattern remains in_stock plus a
  published handling window, but preorder is not an invalid choice -
  it is a visibility policy decision, per the spec
- **handling time**: the min/max handling columns are shipping-service
  territory - verify them against the current product data spec
  before first upload, and keep account-level shipping settings as
  the fallback; this is flagged in the spec rather than assumed

## what the feed builder emits vs what google wants

the v1 google column set (id, title, description, link, image_link,
availability, price `420.00 USD`, condition new, identifier_exists
false, mpn = release id, handling window, quantity 1) matches the
documented spec shape for custom goods. two residual gaps are honest
and recorded:

- `image_link` is empty until the platform uploads the studio pngs and
  fills hosted urls - a feed without it disapproves, by design: the
  platform must complete the row
- `shipping` cost fields are not emitted at all; shipping settings at
  account level or a supplemental data source own them
