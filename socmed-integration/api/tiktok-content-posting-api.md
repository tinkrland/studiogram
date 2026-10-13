# tiktok: content posting api, the photo door is open

checked 2026-10-13 against developers.tiktok.com (get started direct
post, updated 2026-08-04; photo reference, updated 2026-08-24; media
transfer guide, updated 2026-08-04; scopes overview, updated
2026-08-19). headline: **the content posting api now supports
photos**. the studio's capture sets can post to tiktok without going
through a video render, but two walls stand in front of production
use: url ownership and the client audit.

## the endpoints

photo posts use a different endpoint than video:

- `POST https://open.tiktokapis.com/v2/post/publish/content/init/`
  with `media_type: "PHOTO"` and `post_mode`:
  - `DIRECT_POST`: posts straight to the user's account
  - `MEDIA_UPLOAD`: lands in the user's tiktok inbox as a draft; the
    user finishes the post in the tiktok app (app version >= 31.8.0)
- video keeps `/v2/post/publish/video/init/`; the studio's video take
  would use the same `content/init` family

the flow: query creator info first, then init the post, then poll
`/v2/post/publish/status/fetch/` with the returned `publish_id`.

```
post_info: {
  title (max 90 utf-16 runes), description (max 4000),
  privacy_level, disable_comment, auto_add_music,
  brand_content_toggle, brand_organic_toggle
}
source_info: {
  source: "PULL_FROM_URL",            // the only photo source
  photo_images: [url, ...],           // up to 35
  photo_cover_index: 0-based int       // required
}
post_mode, media_type: "PHOTO", is_aigc
```

- `privacy_level` is required for `DIRECT_POST` and must be one of the
  options the `creator_info/query` call returned for that user; a
  mismatch is a 400 `privacy_level_option_mismatch`
- `is_aigc: true` labels the post as ai-generated; the studio's
  renders are synthetic imagery, so this flag is honest to set
- title + description support sending the listing bindings along (same
  compose rule as the instagram caption: unique bound titles + pdp)

## auth and the two walls

- app on tiktok for developers with the content posting api product
  added; scope `video.publish` (direct post) or `video.upload` (inbox
  upload), approved on the app first, then granted per user through
  login kit oauth
- **wall 1, url ownership**: photo source is `PULL_FROM_URL` only, and
  the urls must sit under a **verified domain or url prefix** added to
  the app's url properties widget. verification for a domain is a dns
  signature record. the studio's photo hosting lives on
  `superagent-9bbbac66.base44.app`, whose dns the owner does not
  control, so production tiktok posting needs the photo urls on a
  domain the owner controls (e.g. kirosculp.com) or a url prefix the
  owner can verify. an unverified prefix fails with
  `url_ownership_unverified`. the exact url-prefix verification
  method is not confirmed in this pass; test against the real app
  before promising it
- **wall 2, the client audit**: every post from an unaudited client is
  forced to private-only (`unaudited_client_can_only_post_to_private_
  accounts`); lifting it requires passing tiktok's compliance audit.
  unaudited clients also cap at 5 pending shares per 24h
- rate limits: 6 init requests per minute per access token; daily post
  caps per user (`spam_risk_too_many_posts`) and a daily active
  publishing user cap per client (`reached_active_user_cap`)

## media restrictions (photos)

- formats: webp and jpeg only (png is not listed; the instagram glue's
  jpeg conversion already produces the right format)
- max 1080p per image, max 20 mb each
- the pull url must be https, must not redirect (3xx invalid), and
  must stay reachable for the whole download (one-hour timeout)

## commerce

the content posting api carries **no product tagging**. tiktok shop
anchors are set in-app; the shop catalog side is
[tiktok-shop-api.md](tiktok-shop-api.md) and the mto conflict stands
there. for the studio the tiktok glue would follow the instagram
shape: post the photo set, hand back the bound listing list to tag
in-app.

## what the glue needs

a tiktok app with the content posting api product, scope
`video.publish` approved, a verified url property for the photo host,
and the audit passed before anything posts public. until then the
honest mode is `MEDIA_UPLOAD` (inbox draft) or private `DIRECT_POST`
during testing.
