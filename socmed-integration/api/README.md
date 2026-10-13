# platform product apis: what actually ingests a catalog

deep dive, checked 2026-10-13 against official references where they
render (google merchant help + merchant api docs, meta feed specs,
tiktok shop partner docs via their documented field tables) and
current secondary integrator guides where the official pages are
js-gated. this folder is the contract reference for the feed builders
in [96-commerce.js](../96-commerce.js); the v1 column sets in the code
were written as honest approximations and this pass verifies them.
one finding already changed the code: see the correction list in
[the spec](../../spec/social-commerce.md).

the one-line map:

| platform | product ingestion | the api | auth | checkout |
|---|---|---|---|---|
| google (+ youtube) | merchant center data source (csv/tsv/xml) or api insert | **merchant api** (content api for shopping sunset 2026-08-18) | oauth 2.0 + cloud project linked via developer registration | on the merchant site |
| youtube shopping | rides the same merchant center catalog; affiliate program adds creator tagging | merchant api + gmc ui (affiliate settings) | same as google | on the merchant site |
| meta (ig + fb) | commerce manager feed (csv/tsv/xml, scheduled fetch) or catalog batch api | graph api `items_batch` on the catalog object | oauth (system user token with catalog scope) | on the merchant site (post 2025) |
| pinterest | catalogs data source: api-created feed pointing at a hosted csv/tsv/xml | api v5 `catalogs/feeds` + items processing reports | oauth (access token, no published price card) | on the merchant site, always |
| tiktok shop | seller center upload or product api create | open api `open-api.tiktokglobalshop.com` (https-only since 2026-06-17) | oauth 2.0: app key/secret, access + refresh tokens, **shop cipher** | in-app, native |

x and tumblr have no product api and no catalog: [the research
dossiers](../../social-commerce-integration.md) already record them as
link-out only.

the pattern that matters for kirosculp: on four of five platforms the
product api is a **feed ingestor** around a csv/tsv/xml file the
merchant hosts, and the studio's csv export already speaks that
language. tiktok shop is the exception - a true product-and-order api
with native checkout - and also the one whose order model carries no
custom line-item options, which is why the made-to-order conflict
lives there.

per-platform details:

- [google-merchant-api.md](google-merchant-api.md) - the feed and the
  api both, identifier_exists, custom goods, price micros, the sunset
- [youtube-shopping.md](youtube-shopping.md) - merchant route,
  affiliate program, commission, the reporting view
- [meta-catalog-api.md](meta-catalog-api.md) - feed fields, the batch
  api, availability values, the pixel content-id rule
- [pinterest-catalogs-api.md](pinterest-catalogs-api.md) - v5 feed
  endpoints, processing reports, quotas
- [tiktok-shop-api.md](tiktok-shop-api.md) - oauth + shop cipher,
  product module, the 2026 gateway enforcement, the mto conflict in
  api terms
