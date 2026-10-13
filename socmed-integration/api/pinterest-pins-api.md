# pinterest: pins api v5, tagging without the wall

checked 2026-10-13 against the official openapi description
(pinterest/api-description, v5 spec version 5.28.0) plus the docs
pages that render (post /pins reference, scraped) and current
integration references for the access tiers. headline: **pinterest is
the only platform of the three whose publishing api can set product
tags** - and it can do it without a wall like instagram's app-review
one. a pinterest pin with catalog product pins tagged is a shoppable
pin, end to end through the api.

## create a pin: POST /pins

scopes: `boards:read boards:write pins:read pins:write` (pinterest
oauth 2.0, or client credentials for owned accounts).

```
board_id (required), board_section_id,
title <= 100, description <= 800,
alt_text <= 500, link <= 2048,
dominant_color, ai_disclosures,
media_source: { source_type, ... }
```

`media_source` variants, straight from the spec:

- `image_url`: `{ source_type, url, is_standard }` - a public url
- `image_base64`: `{ source_type, content_type, data }` - base64 bytes
- `images_url`: `{ source_type, index, items[] }` where each item is
  `{ url, title, description, link }` - **multi-image pin with a
  per-image link and description**. the studio's capture set maps
  directly: one pin per set, one image per photo, each photo's
  listing pdp as that image's link
- `video_id`: after `POST /media` (register media upload, scopes
  pins:read/write)
- `pin_url`: save from another pin, with `is_affiliate_link`

`ai_disclosures` is a first-class field on pin create; the studio's
synthetic renders have an honest place to declare it.

## product tags: the api can set them

`POST /pins/{pin_id}/product_tags` (scopes: boards:read/write,
pins:read/write) takes `product_tags`: 1 to 24 items, each a
`ProductTagItem` = `{ pin_id }` of a **product pin** - a pin the
catalog created from the feed
([pinterest-catalogs-api.md](pinterest-catalogs-api.md)). so the
chain is: catalog feed ingests the listings -> product pins exist ->
the studio posts the hero pin -> tags up to 24 product pin ids onto
it -> the pin is shoppable. this closes the loop the instagram glue
cannot: no in-app tagging step.

## access tiers (the gate to plan around)

- **trial**: every new app starts here. pins and boards are sandbox-
  visible only to their creator - the api returns a pin id and nobody
  outside can see the pin, so qa by logged-out eye fails by design.
  universal cap 1,000 requests/day per app; test tokens expire after
  24 hours
- **standard**: free, production visibility and per-category limits.
  upgrade requires a recorded video demo of the app completing an
  action end to end, **including the oauth flow** (the recording must
  show the authorization screen, the token exchange, and an
  authenticated call). no published turnaround; current references put
  a clean first review inside a week. the recurring rejection
  patterns: demo misses the oauth flow, vague app description,
  privacy policy link broken or unbranded
- rate limits are per category and now published in numbers (2026):
  reads around 1,000 requests/minute per user per app; ads_write 400;
  the pin write category is the one the studio rides - comfortably
  above a studio's publish volume

## format context (2026)

- idea pins are gone: the multi-page story format merged into the
  unified pin format through 2023-2025
- 2:3 (1000x1500) is the standard pin; the studio's export sizes
  already cover it ([platform-reference.md](../platform-reference.md))
- fresh pins (new image + new destination) carry distribution
  priority, which is the studio's natural output: every capture is a
  new image and every listing link is a live pdp

## what the glue needs

a pinterest app in trial, standard review recording (the connect
flow itself is the demo), the catalog feed live so product pins
exist, and then the glue mirrors instagram's: connect (oauth scopes
boards + pins), pick a board, post the set as a multi-image pin with
per-photo links, then tag the bound product pins. no app-store-style
review wall beyond the standard-access video.
