# visual data curation and style analysis research

this is the research portion of the repo, and its proper name is the
one in the title: **visual data curation and style analysis research**.
earlier pushes framed this work as "social media research" and
"social-commerce", which undersold what it actually is: curated
corpora of platform visuals (instagram posts, tiktok posts, pinterest
pins, youtube shorts, x posts) plus the style analysis drawn from
them, feeding the integration docs and the studio's export and
publishing decisions. the owner renamed it here on 2026-10-14.

## what lives here

- [report.md](report.md) - the master report of the curation and
  style-analysis passes: what the corpora measured, what the visual
  grammar of each platform is, and what it recommended. the numbers
  are the recorded findings of the original passes; the raw corpus
  files lived in research workspaces and were never committed, so
  this report is the durable record.

## where the findings landed

the research conclusions are implemented in two places:

- `socmed-integration/platform-reference.md` (main branch) - export
  dimensions per platform, derived from the visual analysis
- `socmed-integration/social-commerce-reference.md` and the
  per-platform dossier folders (social-commerce branch) - the
  commerce state of each platform, derived from the same corpora
  plus platform documentation checks

the four creator-commerce platforms added 2026-10-14 (ltk, shopmy,
amazon storefronts, whatnot) live in `socmed-integration/` as
dossiers and are summarized in [report.md](report.md).

## method

- corpora are collected with apify actors (paid per result; run ids
  and counts recorded in the report) and querit web searches for
  platform-documentation facts
- visual analysis reads the corpora for format ratios, dominant
  content shapes, and commerce markers (promoted units, product
  metadata, ctas)
- the commerce checks are dated in each dossier; platforms change
  without notice, so re-verify before depending on any single number
