# spec: the publish glue (post from the studio, one oauth, listings attached)

ruled by the owner (2026-10-13): the studio's social surface grows a
publish flow. a creator clicks post on a capture set, the studio
connects the account through the platform's oauth, and the photos
publish with the set's product listing bindings attached. this is
the glue between [social-commerce.md](social-commerce.md)'s card join
and the platform publish apis. v1 implements instagram; the shape is
platform-generic so pinterest and others can slot in.

## the verified instagram contract (scraped from meta's docs 2026-10-13, updated jun 30 2026)

- **login**: instagram api with instagram login (no facebook page
  required). dialog at `instagram.com/oauth/authorize`, token
  exchange at `graph.instagram.com/v26.0/oauth/access_token`, scopes
  `instagram_business_basic,instagram_business_content_publish`
- **publishing**: create child containers
  (`POST /{ig-id}/media` with `image_url`, `is_carousel_item=true`),
  the carousel container (`media_type=CAROUSEL`, `children` csv, max
  10), then `POST /{ig-id}/media_publish` with `creation_id`. media
  is fetched by meta from a public https url - **jpeg only, png is
  not supported** - so the studio converts its png renders to jpeg at
  0.92 quality before upload. limits: 100 api-published posts per 24h
  (a carousel is one post), 50 pending containers, containers expire
- **the tagging wall**: meta's own docs state "shopping tags are not
  supported" for api publishing and the instagram-login setup
  "cannot access ads or tagging". product tags are therefore applied
  in the instagram app after publishing. the glue does the honest
  version: it publishes the carousel, then surfaces the exact
  per-photo product list (from the commerce card join) to tag in-app.
  the alternative route - catalog-based ads with product tags - is
  the marketing api, deliberately out of scope here

## the architecture (decoupled, same rules as the feed layer)

```
artifact (98-publish.js)                      backend functions (this app)
  connect instagram  ──window.open oauth──▶    studioPublishConfig   (GET: app id, redirect uri)
  ─────────────code arrives by redirect───▶    studioOauthCallback   (exchange code with the
                                               app secret from env; postMessage the token
                                               + ig id + username back to the opener)
  post set to instagram:
    photo png -> canvas -> jpeg ───POST──▶    studioUploadPhoto      (store in the StudioPhoto
                                               entity; return the public serve url)
    ───caption + children + products──▶       studioPublishCarousel  (child containers ->
                                               carousel -> publish; record the result in
                                               StudioPublishedSet)
  media fetch by meta ◀──GET ?id=────────────  studioPhoto            (serves the jpeg bytes)
```

boundaries held:

- the artifact never sees the app secret; the exchange happens in the
  backend function. the token lives in `sessionStorage` for the
  session only (tab close forgets it), never in scene state and never
  in a file
- caption text is composed, never authored: unique product titles
  from the set's verified listing bindings plus the first pdp url,
  capped at 2200 characters. same compose rule as alt text
- the token passes per-request to the publish function; nothing is
  persisted server-side except the publish record (audit: set name,
  caption, permalink, product bindings)
- commerce values stay platform-authored: the products in the caption
  come from the imported manifest, gated by hash

## the flow in the artifact

a publish bar renders under the commerce bar in the capture strip:

1. **connect instagram**: fetches config; if the app is configured,
   opens the oauth dialog; the callback postMessages the token and
   account; the bar shows the connected username
2. **post set to instagram**: requires an active set with photos, a
   listing manifest, and a connection. per photo: reproduce the
   frame (values are truth), convert to jpeg, upload for a public
   url; then one publish call with all children. the result shows
   the permalink plus the per-photo product list to tag in the app
3. photos without verified listing bindings publish too (untagged);
   the result marks them, they are never blocked

## next platforms, verified contracts

the instagram glue is the template; the two other candidate platforms
now have verified publish contracts in
[../socmed-integration/api/](../socmed-integration/api/) (checked
2026-10-13):

- **pinterest** first. its v5 api posts multi-image pins (one pin per
  capture set, per-photo links to the listing pdps) and uniquely can
  tag products through the api (up to 24 catalog product pins onto the
  hero pin), so the in-app-tagging handoff instagram forces does not
  exist there. the only gate is the standard-access video review,
  which is a recording of the connect flow this glue already provides
- **tiktok** second. its content posting api gained photo support
  (2026-08 docs) but photos must be pulled from a verified url
  prefix/domain, and the studio's photo host is platform dns the
  owner cannot sign. production tiktok posting needs photo hosting on
  an owner-controlled domain plus the tiktok client audit before
  anything posts public; inbox-upload mode is the honest testing path
  until then

## multi-user by design

the glue is for the studio's users, not one owner account. every user
connects their own instagram professional account through the oauth
flow, their token lives in their tab session only, and the publish
record stores their connected handle for attribution. the meta app is
a one-time developer setup, the standard saas shape.

## owner setup (the one-time developer dependency)

1. create a meta app at developers.facebook.com, add the instagram
   product with **instagram login** (business login for instagram)
2. add the redirect uri: `<app-origin>/functions/studioOauthCallback`
3. set the secrets `STUDIOGRAM_META_APP_ID` and
   `STUDIOGRAM_META_APP_SECRET` (requested alongside this spec). these
   are the app's own credentials, not any user's account
4. app review for `instagram_business_content_publish` in advanced
   access is what lets users outside the app's roles oauth and publish;
   until it clears, accounts with a role on the app can test

## verification

- `scripts/qa-publish.mjs`: node qa of the payload builders against
  the real module source - caption composition from card bindings,
  jpeg conversion request shape, publish payload assembly, truncation
- function roundtrip tested live: upload a jpeg through
  `studioUploadPhoto`, fetch the returned url through `studioPhoto`,
  byte-compare; publish and oauth functions return plain structured
  errors when unconfigured
- deterministic build includes the module; artifact selftest covers
  the pure builders

## parked

- pinterest publish (v5 pin create), tiktok direct post - the same
  shape, later passes
- scheduled publishing, first-comment, story/reel publishing
- marketing-api catalog ads (the only api path that tags products,
  and it is an ads product, not an organic post)
