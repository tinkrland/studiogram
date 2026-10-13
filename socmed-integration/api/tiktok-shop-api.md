# tiktok shop: the product api and the order model that breaks mto

checked 2026-10-13 against tiktok shop partner center documentation
(the docv2 pages are js-gated; field rules below come from their
indexed field tables and current integrator references).

## architecture

- gateway: `open-api.tiktokglobalshop.com` - **https-only since
  2026-06-17**; plain http calls are dead
- auth: oauth 2.0. app key + app secret from partner center; the
  authorize flow returns an access token, a refresh token, and a
  **shop cipher** (the identifier of the connected shop) that rides
  along with every call. token refresh must be automated from day one
- portals: us partner center for us-registered companies targeting us
  shops; global partner portal otherwise. an in-house integration
  registers as a "seller in-house developer" app (custom app type,
  not published to the app store)
- scopes are per module: product management, orders, inventory,
  logistics, finance. request all needed scopes up front

## the product module

product create carries: title (us: 1-255 chars), description,
category id (resolved from the category endpoints first), images
(seller center requires 5+ high-resolution images per listing - a
studiogram capture set with feed-ready export is sized for exactly
this), pricing, variants with seller_sku, and category-specific
attributes. inventory updates are a separate module that keeps stock
in sync in real time - which for made-to-order is really an
availability model, not a stock model.

the studio's tiktok csv is a staging artifact for this module, not a
wire payload: the platform reads the row, resolves the category, and
creates the product through the api (or uploads it in seller center
first). the transform is platform-side work, per the decoupling rule.

## the order model, restated in api terms

the order api retrieves orders, updates statuses, and handles
fulfillment through the logistics module - but **an order carries
fixed variant skus only; there is no custom line-item properties
field**. for kirosculp that means:

1. a listing whose options (ring size, engraving, plating) are meant
   to be configurable at checkout cannot be sold natively without
   pre-exploding every combination into static skus
2. or the listing stays simplified (no-option products) and
   configurable work drives to the site pdp - native checkout lost
3. or tiktok stays an ad channel (spark ads) with no shop listing at
   all

the option is a platform policy decision (the spec parks it), but the
api constraint is verified: no custom options in the order schema.

## what the commerce card gives this path

the card's product rows (sku, title, price, pdp url, release hash)
map one-to-one onto the product create payload's merchant fields; the
capture set covers the 5+ image requirement; the release-hash
provenance survives into seller_sku. nothing in the studio needs to
change for this path - the transform is the platform's.
