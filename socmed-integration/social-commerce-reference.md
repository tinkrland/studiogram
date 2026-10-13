# social commerce reference: full dimension matrix and commerce state

this extends [platform-reference.md](platform-reference.md) with the full
matrix the owner asked for: every platform's photo and video targets plus
each platform's shopping surface, on one page, with the studio's current
preset gaps called out. it lives on the `social-commerce` branch pending
review; numbers here re-verify the main-branch reference where they
overlap.

evidence, all checked 2026-10-13: apify corpora (45 youtube shorts, 800
x posts, plus the prior 93 instagram posts, 175 tiktok posts, 160
pinterest pins), querit web searches, and an adversarial cross-check pass
run on a free openrouter inference model (nvidia/nemotron-3-ultra-550b,
chosen because the stealth/space-bunny-alpha preview ended before this
pass; its two disagreements with the 2026 primary sources are recorded
below). re-verify before depending on any single number; platforms change
without notice.

## the matrix

### instagram photos

- feed, portrait (recommended default): 4:5, 1080x1350
- feed, tall: 3:4, 1080x1440, native since the may 2025 grid change
- feed, square: 1:1, 1080x1080; landscape: 1.91:1, 1080x566
- carousel: same ratios as feed, all slides one ratio, max 20 slides
- profile grid crops 4:5 tall images to 3:4, so keep the subject inside
  the central 3:4 for a clean grid preview
- commerce: up to 20 product tags per post, reel, or story; requires a
  business or creator account, a connected catalog, and meta commerce
  eligibility. native in-app checkout is gone (announced 2024, most us
  shops transitioned to website checkout by august 2025): the tag opens
  the product page, purchase happens on the merchant site
- corpus: 47 percent of sampled niche posts were carousels; every top
  performer was a ring-stack carousel

### instagram reels

- 9:16, 1080x1920; safe zones: roughly the top 108 px and bottom 250 px
  carry ui chrome (bio links, caption, audio)
- up to 90 seconds standard (3 minutes on some accounts); mp4, 30 fps
- commerce: product tags work on reels; same catalog and website-checkout
  rules as feed

### pinterest photo pins

- standard pin: 2:3, 1000x1500 (min 600x900, max 20 mb, jpg/png/webp;
  ratios from 1:2.1 to 3:4 are accepted, 2:3 is the one that gets served
  uncropped everywhere)
- square 1:1 serves for product-context slots, but the corpus shows tall
  dominating jewelry search results (square was 10 of 160)
- commerce: product pins come from a catalog feed; up to 24 product tags
  per pin; the verified merchant program (returns policy, quality site,
  no affiliate-only, no wholesale) gives the blue check and preferential
  placement. no native checkout ever: pins route to the merchant site
- corpus: 29 percent of jewelry search results were promoted pins, 42
  percent shoppable; the surface is already commerce-shaped

### pinterest video pins

- 9:16, 1080x1920 recommended (also accepts 1:1, 2:3, 3:4, 4:5, 1:2)
- 4 seconds to 15 minutes; mp4/mov/m4v, max 2 gb, 30 fps; keep ui-safe
  margins top and bottom (about 15 percent)
- multi-page pins (formerly idea pins): 9:16, up to 20 pages, and the
  platform's reach-priority format
- commerce: video pins take product tags like photo pins; shop the look
  surfaces pull from the same catalog

### youtube shorts

- 9:16, 1080x1920; up to 3 minutes (since october 2024); mp4/mov/webm;
  no custom thumbnails; keep text inside the central area
- commerce: product tagging needs the youtube partner program plus a
  connected merchant store (shopify family) or the affiliate program;
  tags appear on the shorts shelf. no native checkout: tags link out
- corpus (45 jewelry shorts): median 36 seconds, median 80k views,
  channel median 52k subs; asmr/tour/process formats dominate;
  commerce language appeared in only 5 of 45 descriptions, hashtags in
  almost all

### tiktok

- video: 9:16, 1080x1920, up to 10 minutes standard, 4 gb; safe zone
  about 15 percent top and bottom (captions, buttons)
- photo mode: 9:16 images, up to 35 per post, ordered progression
- commerce: tiktok shop, no follower minimum, commission per sale
  (roughly 5-20 percent by category plus processing), seller center
  registration with us address, tax info, and payout bank. $23.41b
  projected us sales 2026 (+48 percent)
- corpus: process and story formats win; shop tags appeared in only 6
  of 135 tagged posts; dm-ordering still outnumbers shop tags in the
  niche

### x (twitter) videos and images

- single image: 16:9, 1600x900, displays uncropped; up to 4 images per
  post (cropped to 16:9 in the grid)
- video: 16:9 (1280x720 min) or 1:1; max 2:20 and 512 mb on standard
  accounts, longer and larger for premium tiers; 30 fps recommended
- commerce: no organic product tagging; the organic shopping surfaces
  were shut down in 2023 and what remains is advertising (dynamic
  product ads from a feed) and link-out. treat as a broadcast and
  link-out channel only
- corpus note: 607 of 800 sampled jewelry-tag posts carried video, but
  the sample was bot-heavy (median 3 likes); x is a weak organic
  channel for the niche and the shopping tab claims in third-party
  blog posts did not verify against first-party sources

### tumblr

- photo posts: free aspect ratio; up to 2048x3072 stored, displayed at
  1280 px wide; max 20 mb
- video: up to 10 minutes, 100 mb; gif max 15 mb; header 2048x1152
- commerce: none native. affiliate links are allowed with disclosure
  (#affiliate tag); tipping exists (5 percent platform cut); art
  prints, zines, pins, and jewelry are the proven seller categories.
  it is a community and aesthetic channel with link-out commerce, at
  best

### facebook

- feed image: 4:5, 1080x1350, max 30 mb; video 4 gb
- carousel cards: 1:1, 1080x1080, all cards the same ratio
- marketplace and shop product images: square 1:1
- commerce: same meta catalog as instagram; shops route to website
  checkout (same post-native-checkout state); 69 million-plus us buyers
  shop on facebook

## the link-out era

every platform above now lands purchases on the seller's own site: meta
removed in-app checkout, youtube and pinterest never had it, x never
had it at scale, tiktok shop is the one true in-app checkout at scale
in this matrix. the practical reading for channel-tier work in
kirosculp: the website product page is the conversion surface on four
of five platforms, so catalog quality and fast deep-linked pdps matter
more than any platform storefront setup.

## studio preset gaps against the matrix

the build now exports photos and deterministic video at: square
1080x1080, portrait 4:5 1080x1350, vertical 9:16 1080x1920, and wide
16:9 1920x1080 (plus viewport). against this matrix the gaps are:

1. **2:3, 1000x1500 (pinterest standard)**: the only target ratio with
   no preset, and pinterest is the platform where jewelry search is
   most commerce-shaped. a preset at 1080x1620 (2:3 at the 1080 width
   the other presets use) would fill it
2. **3:4, 1080x1440 (instagram tall)**: accepted by instagram and the
   ratio the profile grid actually previews; cheap to add beside 4:5
3. 16:9 photo exists for x; x video, youtube shorts, tiktok, reels,
   and pinterest video all take the existing 9:16 preset once the
   video export (30 second cap today) grows to each platform's length
   norms

the 30-second record cap covers the median jewelry short exactly (36
seconds is the corpus median; the cap keeps every record exportable to
every platform's short-form surface). extending past 60 seconds would
start excluding instagram reels.

## cross-check note

the free openrouter model cross-checked this matrix and confirmed
every dimension row, adding the file-size and safe-zone numbers
recorded above. it disputed two facts and was overruled on both by
2026 primary sources: it called instagram 3:4 unsupported (stale
training data; the 3:4 grid shipped may 2025) and dated meta's
checkout removal to april 2024 (the documented transition completing
for most shops was august 2025; the announcement-vs-completion dates
are reconciled in the instagram section above).
