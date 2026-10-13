# spec: catalog to scene, the slide-on

how a ring from an artist's catalog enters the scene and seats itself on the
subject. this spec covers the add flow, the physical insertion gesture, the
seating and stacking mechanics, and the fit advisory. it builds on what
exists: `addJewelryInstance` in `jewelry/70-jewelry.js` (default location,
stack offsets), the arrangement panel in `jewelry/84-jewelry-panel.js`
(finger and location selects, seat slider, rotation, reorder buttons), and
release records carrying `sizing` (`min_inner_mm`, `max_inner_mm`,
`steps_mm`) and `placement.locations`.

## principle: the scene mimics how jewelry is actually worn

a ring does not appear on a finger; it slides on over the fingertip and
down to a seat. a bracelet comes over the knuckles to the wrist. the
slide-on is a physical insertion, and every placement gesture in the
arrangement panel should feel like handling a real piece on a real hand.

## decisions

### d1. catalog grouping by artist

the registry panel groups releases by `creator_name`: each artist's
catalog is a section listing their releases. cross-creator scenes are the
norm (fixtures already show two creators), so the grouping makes the
catalog-of-an-artist reading explicit. per-piece cards keep what they
have: metals, mass estimate, placement support, mesh hash. no
commerce vocabulary (no prices, no "buy"): releases enter scenes by
reference, and this panel is studio-side.

### d2. the slide-on transition

adding a piece from the catalog plays a slide-on: the piece enters along
the worn location's axis, from beyond the extremity to its seat, exactly
the way a ring goes on a finger. for fingers: start past the fingertip,
slide along the bone's local +y to the seat offset. for wrist pieces:
enter from beyond the fingers (over the knuckles) along the forearm axis
to the wrist seat. the piece keeps its final rotation and scale
throughout; only the position animates.

- the transition is a pure function of (instance, hand model, final
  state). fixed duration and easing constants live in code (suggest
  450ms, ease-out cubic). no timing values enter scene state.
- deterministic: the same add replays the same transition. the end state
  is what state carries; the transition is derived, so invariant 5
  (quantitative state only) is untouched.
- removable: a "no transitions" toggle and prefers-reduced-motion both
  skip straight to the end state. skipping never changes state.
- removal slides off along the same path in reverse. deletion by button
  from another tab removes immediately; removal from the viewport (if a
  piece-click context is ever added) slides off.
- this is not the parked movement phase. movement is about animated
  outputs (previews, short animations, gifs as creator deliverables) and
  stays parked pending an owner ruling. a view-layer transition is
  interaction feedback that renders the same saved state; the two are
  different things and this spec does not reopen the movement decision.

### d3. seating as sliding

every seat change is a short slide along the axis, not a teleport:

- the seat slider animates the piece between its old and new offset.
- `reorderJewelry` exchanges offsets; both pieces slide to their
  exchanged seats simultaneously.
- seat changes clamp against neighbors: a piece's slide stops where its
  band would meet the adjacent piece's occupied band (its offset plus
  its width plus 0.25mm clearance). pressing a piece toward the hand
  seats it at contact. the ends of a finger refuse past the fit band
  (d5) and the fingertip.

state stays exactly as it is: `offset_mm` remains the single quantitative
truth; the slide is how a change in that value is presented.

### d4. fit is advisory, never a gate

the hand's fingers are fixed scale; a release renders at its compiled
mesh's `inner_radius_mm` (the scene never resizes geometry). derive a
per-finger radius estimate from the hand mesh (a skin-radius sample at
the proximal phalanx, computed once at load). when a piece's inner radius
is smaller than the finger estimate minus a tolerance, the card shows an
advisory hint ("sits below the knuckle line", "wears tight on this
finger"): real product photography routinely photographs rings on
fingers that do not fit, and the scene is a photograph, not a fitting.
no refusal, no gate entry. sizing steps (`steps_mm`) are buyer-facing
order-time data on the platform side and stay out of the scene.

### d5. the fit band

each finger gets a derived seat range `[base, tip]` from its bone length
(the same `boneLen` data the placement uses). the seat slider already
runs 0 to 14mm; replace the hard-coded range with the derived band so
seats are true to each finger. a piece that cannot seat (band narrower
than the piece) is refused at add time with a plain reason, because it
has no valid placement, which is different from a fit hint.

## acceptance

- selftest: after `addJewelryInstance`, the piece's world position
  matches its seat within the model's bone space (already checkable via
  the existing box/ndc probes); the clamp is checkable deterministically
  (set two pieces at colliding offsets, assert the slide settles them
  at contact clearance).
- selftest: transition-off and transition-on adds end at identical
  state hashes.
- qa-drag: a catalog add during pinned mode does not move the camera
  (the transition animates objects, never the view).
- build stays byte-reproducible; transition constants in code, not
  state.
