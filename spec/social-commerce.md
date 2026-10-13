# spec: social commerce export

the commerce decision, ruled by the owner (2026-10-12 research pass,
directed as code 2026-10-13): the studio's social-commerce contribution
is a **decoupled export layer**, built on its own orphan branch. the
studio never authors commerce values, never touches listings, pricing,
orders, or checkout, and never grows commerce logic. the platform
(sculptura/kirosculp) owns every commerce value; the studio imports them
by reference, proves the binding with the provenance gate, and exports
paste-ready commerce artifacts next to the photos. this file is the
spec of record for that layer.

the research dossiers behind it (per-platform dimensions, tagging
mechanics, made-to-order feed rules) live on the `social-commerce`
research branch; this spec implements what they conclude.

## principle: values are truth, the platform authors them

scene state carries quantitative values only (invariant 5). commerce
data is not scene state: the listing manifest persists beside scene
state in its own localStorage key (`studiogram_listings`), exactly
like saved hands. photos stay immutable and never carry commerce
fields; the binding is computed at export time by joining a photo's
verified gate entries to manifest rows through `mesh_sha256`. one
import replaces the whole manifest (the platform exports one file per
batch); refused rows are reported and dropped, never repaired here.

## the interface: the sculptura listing manifest

the platform exports one json file, generated from its listings, which
reference design releases by id. version 1:

```
{
  "schema": "sculptura-listing-manifest",
  "manifest_version": 1,
  "listings": [
    {
      "release_id": "...",     // must exist in the registry
      "version": 1,            // must match the registry record
      "mesh_sha256": "...",    // must equal the registry's assets.mesh_sha256
      "sku": "KIR-...",        // platform's catalog id
      "title": "...",
      "description": "...",   // optional
      "price": 420.00,
      "currency": "USD",      // default usd
      "pdp_url": "https://...",        // the link-out conversion surface
      "image_url": "https://...",      // optional: hosted catalog image
      "brand": "...",                  // optional: required by meta and pinterest
      "max_handling_days": 30 // optional, default 30: the mto ship-by window
    }
  ]
}
```

### the import gate

a row is accepted only when its release reference verifies against the
registry: known release id, matching version, and a declared mesh hash
equal to the registry's. this is the anti-drift property at import
time: the commerce row and the geometry it sells resolve to one hash,
or the row is refused with a plain reason. required commerce values
(sku, title, numeric price, pdp_url) are checked, not inferred. the
accepted rows sort by sku so every downstream artifact is
deterministic.

## the join: photos to listings through the gate

a photo's gate array already records which releases were verified when
the frame was taken. `photoProducts(photo)` collects manifest rows
whose `mesh_sha256` appears among the photo's **verified** gate
entries: a failed gate never authorizes commerce, and one photo may
bind several products (a stack, a set shot), which platform tagging
already supports (instagram allows 20 tags per post). photos whose gate
carries no bound listing export as unbound, never blocked.

## the exports

### the commerce card (per capture set)

a json sidecar that pairs with the set's exported pngs: per photo, the
export filename, dimensions, composed alt text, and the product rows
(sku, title, price, pdp url, release reference, mesh hash). alt text is
composed, never authored: manifest title plus the photo's recorded
name. the platform's tagging flow pastes from the card without
re-typing, and the mesh-hash rows are the provenance that image and
listing sell the same geometry.

### the catalog feed (per platform)

one csv row per listing, deterministic, sorted by sku. three column
sets in v1, encoding the made-to-order rules the research dossiers
established:

- **google merchant center** (serves pinterest's feed too): the custom-
  goods rules (`identifier_exists: FALSE`, `mpn` = release id,
  `condition: new`), the mto availability pattern (`in_stock` with a
  published handling window: `min_handling_time` 7, `max_handling_time`
  from the row, default 30), and the quantity override (`quantity: 1`)
  because feeds want stock the mto backend does not hold
- **meta**: the catalog columns meta commerce manager ingests; the
  same mto pattern
- **tiktok**: the seller-center facing mapping; `availability`
  `IN_STOCK`, handling days carried per row

the column sets were verified against the platforms' 2026-10-13
product-api references (see [../socmed-integration/api/](../socmed-integration/api/))
and corrected in that pass: `identifier_exists` emits lowercase `false`
(google documents yes/true/no/false for text data sources),
`brand` is emitted by the google, meta, and tiktok builders (meta and
pinterest expect it), and the platform-side api target for google is
the merchant api (content api for shopping was sunset 2026-08-18; the
csv data-source path is unchanged). the min/max handling columns
remain flagged: verify against the current google product data spec
before first upload, with account-level shipping settings as the
fallback.

`image_link` carries the manifest's hosted `image_url` when present;
otherwise it is empty and the platform fills it after uploading the
studio's pngs. the studio never guesses a hosted url.

## what this layer never does

- no pricing ui, no order state, no checkout anywhere in the artifact
- no commerce values in scene state, no commerce fields on photos
- no repair of refused manifest rows (the platform re-exports)
- no feed upload automation: the platform uploads its own catalogs
- parked: per-photo alt-text editing, feed upload, hosted image
  hosting, per-listing availability overrides beyond the manifest's

## verification

- selftest (`#selftest` in the artifact url): manifest import accepts
  and refuses correctly, a photo binds through its gate record, the
  card carries products and alt text, feed rows are deterministic and
  carry the mto rules, and a drifted listing (wrong mesh hash) is
  refused. cleanup restores the prior manifest state.
- `scripts/qa-commerce.mjs`: node qa of the same layer with a stubbed
  registry, importing the real module source, asserting the gate
  refusals, the join, csv escaping, and byte-equal feed output across
  builds.
- the deterministic build includes the module in
  `scripts/build-app.sh`'s manifest between captures and video.
