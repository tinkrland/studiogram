# pinterest: catalogs api v5 and the feed it ingests

checked 2026-10-13 against pinterest api v5 (5.x, the item/catalog
sdk surfaces) and current catalog setup references. pinterest does not
publish an api price card: v5 access is free, rate-limited (reads
around 1,000 requests/minute per current references).

## the ingestion model

pinterest catalogs are fed by a **data source**: a csv/tsv/xml file
either uploaded or fetched on a schedule from a hosted url. the v5
api automates around it:

- `POST /catalogs/feeds` creates a feed against a data source with
  defaults - `default_country`, `default_locale`, `default_currency`,
  `default_availability` - applied when a row omits the field
- feed ingest produces a **processing report**; the items issues
  endpoints list per-row validation failures (bad ids, bad prices,
  unsupported availability values) so a refused row is traceable,
  the same philosophy as the studio's provenance gate
- items endpoints read back the ingested catalog rows

so the platform (kirosculp) hosts the csv the studio exports, creates
the feed through v5, and reads the processing report. no row
transformation is needed between the studio's google-format csv and
pinterest's expectation - pinterest's catalog feed schema tracks
google's (id, title, description, link, image_link, price,
availability, brand, google_product_category...), which is why one
builder serves both.

## the rules that matter for mto

- **availability**: `in stock`, `out of stock`, `preorder` - the same
  enum family as meta/google, so the in-stock-plus-handling-window
  pattern ports unchanged
- **brand**: expected by the merchant guidelines; the manifest now
  carries optional brand and the google-format row (which pinterest
  consumes) emits it
- **prerequisites remain ui-side, not api-side**: business account,
  claimed domain, merchant guidelines review - the vmp badge is a
  post-launch goal, per the research dossiers
- **errors are row-scoped**: a bad row drops with an issue, not a
  dead feed - so the quantity-override and identifier rules can be
  tuned per row without re-uploading the whole catalog

## what the studio's pinterest path still lacks

the 2:3 export preset (flagged since the first research pass) is the
only studio-side gap: catalog images for pinterest are tall pins, and
`image_link` stays empty in the feed until the platform hosts one.
the card gives it the file name, the hash binding, and the alt text.
