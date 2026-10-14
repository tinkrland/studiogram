# visual data curation and style analysis: the platform research report

the durable record of the visual data curation and style analysis
research passes, 2026-10-12 through 2026-10-14. reconstructed and
committed on 2026-10-14: the raw corpus files lived in research
workspaces that have since been cleaned, so this report preserves the
recorded findings rather than the raw rows. every number below was
measured in the original passes; where a claim is a platform fact
rather than a corpus measurement, it is dated and sourced.

## 1. the corpus inventory

| corpus | platform | n | collector |
|---|---|---|---|
| jewelry hashtag posts | instagram | 93 | apify instagram-hashtag-scraper |
| jewelry hashtag posts | tiktok | 175 | clockworks free-tiktok-scraper ($0.004/item) |
| jewelry search pins | pinterest | 160 | fatihtahta/pinterest-scraper-search ($0.004/result, type all-pins) |
| shorts sample | youtube | 45 | apify (nine-platform pass) |
| posts sample | x | 800 | apify (nine-platform pass) |

collection dates 2026-10-12 and 2026-10-13. apidojo tiktok-scraper
was demo-capped at 10 items/run and was not used further.

## 2. instagram: the carousel is the format

measured across 93 hashtag posts (2026-10-12):

- **47 percent carousels**, and the top posts were all ring-stack
  carousels: the multi-slide walkthrough is the winning jewelry shape
- portrait dominates: 4:5 and 3:4; the square export the studio had
  at the time was a mismatch with the grid
- calls to action are conversational: dm and "order via" language
  rather than link-in-bio alone
- querit corroboration: metricool 2026 analysis has instagram
  carousels beating tiktok roughly 5x on engagement; the default
  grid is 4:5 1080x1350

## 3. tiktok: process video and asmr

measured across 175 hashtag posts (2026-10-12):

- median 32k views; saves outnumber comments about 12:1 - saves are
  the jewelry signal to optimize for
- winning formats: asmr packaging videos and how-to / story process
  videos; the craft narrative outperforms the product shot
- tiktok shop tags appeared in only 6 of 135 posts: the affiliate
  engine is the bigger lever than the shop tag for this niche
- median 60 second duration; the studio's 30-second export cap covers
  the median jewelry short (corpus median 36s) exactly
- querit corroboration: tiktok shop at $23.41b us gmv for 2026; the
  affiliate engine is 2m+ creators at ~15 percent average commission

## 4. pinterest: the tall-pin commerce surface

measured across 160 search pins (2026-10-12):

- tall pins rule: 2:3 at 0.67 and ~9:16 at 0.56 of the corpus; only
  10 of 160 square. pinterest native is 2:3 1000x1500
- search results are commerce-shaped: 29 percent promoted, 42 percent
  carried shoppable product metadata; link-outs skew to marketplaces
  (mercadolibre, shein, etsy, aliexpress rank inside jewelry searches)
- creator median 118 followers confirms the "pinterest mood-board
  curators" latent-creator bet in the marketing flywheel; boards are
  large (median 274 pins), so a single strong pin compounds
- 7 of 160 pins cross-link to instagram: the two platforms feed each
  other for this niche
- querit corroboration: pinterest predicts 2026 named maximalism, bold
  gold, maximalist accessories (plus 105 percent); idea pins are the
  reach-priority format; jewelry is one of the most saved and shopped
  categories

## 5. the nine-platform commerce pass (2026-10-13)

per-platform dossiers checked 2026-10-13 across tiktok, reddit,
pinterest, instagram, lemon8, tumblr, xiaohongshu, x, and youtube
shorts. full dossiers in `socmed-integration/` on the social-commerce
branch; one-line states in `social-commerce-integration.md`. the
headline: in-app checkout survives only on tiktok shop and
xiaohongshu's cross-border door; every other platform is a tag that
links to the product page. mto (made-to-order) conflicts with every
checkout-carrying platform because orders settle on fixed variants.

## 6. creator-commerce platforms (added 2026-10-14)

the owner asked for the same treatment for ltk "and stuff": the
creator-affiliate shopping layer. four dossiers added under
`socmed-integration/` (ltk, shopmy, amazon storefronts, whatnot).
summary:

- **ltk** (ltk-shopping): the largest independent affiliate
  infrastructure, ~$4b annual creator-driven sales, ~200k creators,
  ~7k retail brands; brand entry is paid (ltk connect self-serve is
  ~$12,000/year), so for a small studio it is a sponsor-creators
  channel, not a self-serve door
- **shopmy** (shopmy-shopping): creator storefronts with brand-set
  commissions (roughly 10-30 percent), weekly friday payouts, no hard
  follower minimum for creators; the friendlier brand-side door for
  sending product to creators and paying commission per sale
- **amazon storefronts** (amazon-storefront-shopping): the april 14
  2026 associates update opened storefronts and onsite earning to all
  associates (onsite rates 1-3 percent vs 4 percent offsite fashion);
  relevant only if the catalog is listed on amazon, which carries the
  same fixed-variant mto conflict
- **whatnot** (whatnot-shopping): live-auction selling with in-app
  checkout, 8 percent commission plus payment processing (about 12
  percent all-in), and a january 2026 0 percent commission on the
  portion of high-value orders above 1,500 usd in select categories;
  operationally heavy (live shows, in-stock inventory) but it is the
  third in-app checkout door

the checkout map gains one entry: whatnot. in-app checkout now
exists on tiktok shop, xiaohongshu (cross-border), and whatnot; the
link-out rule holds everywhere else.

## 7. what it recommended (status 2026-10-14)

- export presets: 4:5 1080x1350 default, 3:4 1080x1440, 2:3 for
  pinterest (the remaining gap), 9:16 for shorts/reels/pinterest
  video. the aspect-aware export build (main branch) covers square,
  4:5, 9:16, and 16:9; 2:3 and 3:4 remain the called-out gaps
- carousels first on instagram; ring-stack walkthroughs are the
  proven shape
- asmr packaging and process storytelling for tiktok; optimize for
  saves
- pinterest is the priority discovery bet: the tall-pin format, the
  shoppable search surface, and the publish glue already built
  (commerce branch) make it the nearest commerce door
- the creator flywheel runs through shopmy and ltk creators (product
  plus commission), not through paid platform ads
