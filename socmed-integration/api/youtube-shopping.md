# youtube shopping: the merchant catalog plus the affiliate layer

checked 2026-10-13 against google merchant center help (the youtube
shopping affiliate program pages) and merchant api release notes.

## the merchant route (the brand path)

youtube shopping is not a separate api: product tags on shorts,
long-form, and live streams resolve into the **same merchant center
catalog** that serves google free listings and shopping ads. setup is
catalog-side (merchant center program settings and the connected
store), not a per-video api call. once the catalog exists, merchant
api product management (the feed, the data sources, the mto rules in
[google-merchant-api.md](google-merchant-api.md)) is the entire
product surface. checkout lands on the merchant site.

## the affiliate layer (the creator path)

the youtube shopping affiliate program is a merchant center surface,
entered from gmc's marketing section ("youtube affiliate"):

- the merchant sets **default commission rates** plus per-product
  custom rates; youtube handles creator onboarding, affiliate link
  management, conversion tracking, and billing; the merchant pays
  only on creator-attributed purchases
- eligible creators then tag the merchant's products in videos,
  shorts, and live streams - checkout still happens on the merchant
  site
- reporting exists at merchant api level: the reports api's
  `youtube_content_performance_view` carries sales and commissions
  (platform-funded vs sub-seller breakdowns added week of
  2026-09-14)

for kirosculp this is the creator-flywheel surface: the platform opts
listings into the affiliate program, sets commissions, and any
eligible craft creator can tag a kirosculp piece with the studiogram
photo evidence in the listing. no studio-side code is involved; the
commerce card's rows are already the catalog rows those tags resolve
to.

## the two mto notes that carry over

- availability and handling-window rules are google's, shared across
  free listings, shopping ads, and youtube surfaces
- the affiliate tag links to the merchant pdp, so configurable
  made-to-order options (ring size, engraving) survive - unlike
  tiktok's native checkout, nothing in this path constrains line
  items
