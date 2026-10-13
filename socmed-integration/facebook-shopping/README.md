# facebook shopping: the meta catalog's older audience

facebook shares instagram's commerce manager catalog and eligibility,
so most setup is done once for both (see
[instagram-shopping/](../instagram-shopping/)). the differences are
audience and surfaces: facebook skews older buyers, carries 69 million
plus us buyers who shop on the platform, and adds marketplace.

## what differs from instagram

- shops route to website checkout, same post-native-checkout state
- marketplace: 1:1 product images, local and shipped goods
- shop ads and advantage+ catalog ads run across both surfaces from
  the same catalog
- the pdp conversion surface is the same site either way

## the api tagging state (verified 2026-10-13)

in-app, page posts and photos can still tag catalog products - the
composer in meta business suite does it, checkout lands on the site.
but the api cannot: the v26.0 page photos reference carries no
product_tags parameter anymore (older graph versions had one; it was
removed as meta sunsetted the shops api surface), and the feed/edges
surfaces only publish plain posts. the remaining api path that shows
products is the marketing api: dynamic/advantage+ catalog ads, which
is paid placement, feed-driven, checkout on the site. so facebook is
instagram's exact shape: tag by human in-app, checkout on the pdp,
api publishes but never tags.

## studio inputs

- feed image: 4:5, 1080x1350, max 30 mb; video 4 gb
- carousel cards: 1:1, 1080x1080, all cards one ratio
- marketplace and shop product images: square 1:1

## verdict

no standalone facebook strategy: the catalog work is shared, the
creative reuses instagram assets at the same ratios, and the channel
is worth having because it costs almost nothing extra once meta
eligibility clears.
