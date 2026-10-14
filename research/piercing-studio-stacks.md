# pierced ears in the studio: placement sites and stacked earrings

ideation, 2026-10-14. this file answers one question the placement map
raises but does not answer: once an ear model is in the studio, how does
the software represent *multiple piercings per ear* and *stacked
earrings* without turning into a scene-graph mess. it builds on
the anatomy knowledge base (kirosculp repo, `offerings/piercings/placements.md`: the placement map, jewelry types per placement, gauge chart, and the 2026-09-29 scope decision) and inherits
its hold unchanged: nothing here approves a piercing-safe offer, and
"placement" in the studio is a merchandising/vocabulary axis, never a
medical claim.

## the hard parts, named

1. **one ear, many holes.** a real "ear stack" spread is five to ten
   sites on one ear. a scene that treats each earring as a free-floating
   object gives no home to "which hole is this in" and no way to render
   the thread-through (the post or bar passing through the ear, back
   visible behind the lobe).
2. **pieces are placement-typed, not generic.** the same front gem can
   sit on a flat-back labret (helix) or a butterfly post (lobe); a
   conch hoop and a huggie are both "hoop" with different diameters and
   gauges. geometry must be parameterized by placement, matching the
   placement map's per-site ranges (candidate research, still under the
   hold for any physical claim).
3. **multi-site pieces.** an industrial is one bar through two holes; an
   orbital is one hoop spanning two rim holes; chains connect two
   piercings. these cannot be modeled as single-site instances.
4. **model variance.** different ear blend models have different
   topology. sites must be authored per model, addressed by a shared
   vocabulary, so a piece can be placed on any ear without re-work.

## the design: sites, seats, stacks

**piercing sites are authored anchors on the ear mesh**, the same
pattern the studio already uses for nail plates: landmark points
exported from the model into a frame file (`EAR_FRAME`), one entry per
band-1 placement vocabulary key:

```json
"lobe_1": { "pos": [x,y,z], "out": [nx,ny,nz], "back": [x,y,z], "curve": 0.4 }
```

- `pos` + `out` place the front of the piece on the ear surface along
  its normal; `back` marks the exit point on the far side, so the
  thread-through geometry (post, bar, flat back) renders *through* the
  ear rather than resting on it. `curve` feeds curvature for barbells
  (daith, rook, snug) from the placement map's anatomy notes.
- repeated placements get numbered sites (`lobe_1..lobe_3`): a
  "stacked" lobe look is several sites, each with its own piece — not
  one site holding several. that is how real stacks work and it keeps
  the one-piece-per-hole invariant the research implies.
- a model missing a site (an ear without a modeled daith fold) simply
  does not offer it; the site list is per-model, the vocabulary is
  shared.

**each site holds an ordered seat chain, exactly like the ring stack
on a finger bone today.** the existing jewelry seat system generalizes:
a piece instance references `(ear, site, offset)`, where the offset
moves it along the post/bar channel instead of around the finger.
huggies and studs both sit at their site; stacking *along one hole*
(second lobe hole, transverse lobe bar) is expressed as two instances at
the same site with ordered offsets.

**pieces are generated against a placement spec**, which is the
software-side reading of the placement map: type (labret / hoop /
curved bar / clicker / huggie / bar), gauge, wearable length or diameter
range, mass hint. `paracraft` constraint sets stay the source of those
numbers when they exist; until the hold lifts, the studio ships only
the *shape vocabulary* with placeholder dimensions, labeled as
candidate. the important software property: choosing a placement
changes what geometry is generated, not a label — the research's own
requirement.

**multi-site pieces are instances that claim several sites.** an
industrial instance carries `sites: ["helix_1", "forward_helix_2"]`;
the seat manager reserves both before allowing the piece, positions the
bar between the two anchors, and refuses placement if either site is
occupied. chains (hidden helix, connectors) get the same mechanism with
a sagging-curve segment between anchors. this is the one genuinely new
mechanism; everything else reuses the seat system.

**an ear stack is a composition object, not a scene hack**: a named list
of `(site, piece)` pairs, renderable as a unit, shareable as a preset.
this matches how the retail side already merchandises "curated ear
stacks": the studio renders the composition, the platform sells it as a
look. state-wise the ear is one scene-level object, additive over
state v2 like `recordings`:

```json
"ear": { "model": "...", "sites": { "lobe_1": { "instances": [...] }, ... } }
```

snapshots capture it whole, so photos and videos re-render
deterministically the same way captures do today.

## what the ui would look like

- a subject-tab ear section mirroring the nail picker: an ear diagram
  with site dots; clicking a dot shows that site's chain (occupied or
  empty) and a placement-typed picker (studs at a lobe, clickers at a
  daith), so the interface teaches the vocabulary instead of presenting
  an undifferentiated pile of earrings.
- a stack panel listing sites in anatomy order (lobe upward), with
  per-site piece, metal, and seat offset — the same rows the finger
  ring stack shows today.
- multi-site pieces appear once, listed at their first site with a
  "spans to X" note.

## build order (proposal)

1. **lobe lane only** (the research's default lane): lobe_1..3 sites,
   stud and huggie types, thread-through rendering. nothing here needs
   the hold lifted; standard pierced-ear display is current retail
   baseline.
2. **band-1 ear vocabulary**: all ear sites on the map, hoop/curved
   bar/clicker generation, the per-model frame file. shape vocabulary
   only, placeholder dims labeled candidate.
3. **multi-site pieces**: industrial, orbital, chain connectors.
4. **stack compositions** as shareable presets.

each phase is independently shippable and none of them makes a
piercing-safety claim; the hold governs release copy, not geometry
research. the one decision needed from the owner before phase 2: which
ear blend model is the reference mesh (the site frame must be authored
against it, and site quality is only as good as that model's anatomy).

## open questions

- should both ears render (mirrored sites) or is one display ear the
  product unit, as the display hand is one hand?
- do stack presets belong to the studio (scene state) or the platform
  (catalog entity, referenced by id through the provenance gate)?
- threadless tops (interchangeable fronts on a shared labret post) —
  model as one piece with swappable front, or two linked instances?
  the interchangeability is a retail feature; one piece with a front
  slot is the simpler studio truth.
