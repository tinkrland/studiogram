# spec: photo taking and capture sets

the capture model, tightened to the reference platform's shape (rooms.xyz
scripting docs; adopt the model, not the code): capture returns a photo
object, and an ordered capture set references named cameras. this spec
covers the photo object, named cameras, capture sets as the recording of a
shoot, reproduce, and export. it builds on what exists:
`camera/45-camera-modes.js` (free orbit vs pinned deterministic shots),
`camera/88-camera-panel.js` (named pinned cameras with the lens trio),
`socmed-integration/95-captures.js` (capture, snapshot, state hash,
reproduce, reorder, png export).

## principle: the photo is the record, the camera is a tool

a photo, once taken, is an immutable record of exactly what rendered, from
exactly where, over exactly what scene state. cameras are mutable scene
things a creator can frame, rename, edit, and delete. editing a camera
after a shoot must never silently change what an existing photo reproduces.
this separation is the whole spec.

## decisions

### d1. the photo object

`captureFrame` returns a photo object with everything needed to reproduce
and audit the frame:

```
photo: {
  id, name, taken_utc,
  camera: {
    mode,                 // orbit | pinned
    name,                 // present when the shot came from a named camera
    position, target, fov, focallength, focaldistance   // values at take time
  },
  state_hash,             // sha-256 over the canonical core scene state (exists)
  snapshot,               // the full core state (exists)
  gate: [ { release, version, mesh_sha256, verified } ]  // gate entries at take time
}
```

- the camera name is a label of provenance, not a live link. the values
  are the truth. a photo taken from "hero shot" keeps the framing "hero
  shot" had at take time, even after "hero shot" is reframed or deleted.
- the gate array records which release references were verified when the
  frame was taken. the photo becomes a full provenance record: state hash
  plus verified mesh hashes. this is the "recording" side of photo
  taking: not just what it looked like, but that every piece in frame
  was a verified release at that moment.
- full png frames stay in memory only, thumbnails in state (unchanged).

### d2. capture sets are the recording of a shoot

the single global strip becomes named, ordered capture sets:

- a scene carries multiple sets; each set is `{ id, name, photo_ids[] }`.
  photos live in one scene-level collection; a photo belongs to one set
  at a time (moving between sets is a later convenience, not v1).
- the active set is the one the strip shows; capturing appends to it.
  new scenes start with one set named "shoot 1".
- sets are ordered: reordering moves a photo's position in its set.
  reorder and delete work on the active set (existing buttons).
- naming: photos stay "capture 01", "capture 02" per set numbering; sets
  are creator-named ("carousel", "detail study"). a set's name is
  presentation, never provenance.
- export exports the active set in order as pngs, filenames prefixed by
  the set name: `shoot-1-capture-01.png`. carousel-ready ordering is the
  set's order.
- export dimensions are the photo's truth: a `#photo-size` selector beside
  the capture button offers viewport, 1:1 1080, 4:5 1080x1350, 9:16
  1080x1920, and 16:9 1920x1080 (the same preset library video recording
  uses, per
  [../socmed-integration/platform-reference.md](../socmed-integration/platform-reference.md)
  and d3 of [video-recording.md](video-recording.md)). the chosen
  dimensions are recorded on the photo as `width`/`height` at capture,
  capture and every reproduce render exactly those pixels, and the
  framing overlay (which the video pass built) arms for the photo
  selector whenever it is not viewport and no take is running. photos
  taken before this pass carry no dimensions and reproduce at the
  legacy 1600x1600 square.

### d3. what references what (the rooms.xyz shape, precisely)

- a named camera is a scene thing: position, target, fov, and the lens
  trio, creator-framed and editable.
- a photo references the camera that took it by name (provenance) and by
  values (truth), per d1.
- a capture set references photos in order. sets do not reference
  cameras directly: a set's shots may mix orbit and pinned photos from
  different cameras, because a real shoot does.

### d4. reproduce

- reproduce re-renders a photo from its snapshot (existing pattern:
  apply, render, restore). the gate array is not re-verified on
  reproduce: it is a record of the take, and reproduce must render what
  was taken, refusing nothing. the snapshot's jewelry references are
  still gate-checked on import of a state file (existing behavior,
  unchanged).
- batch reproduce: a button re-renders the whole active set in order
  from snapshots, without touching the working scene's final state.
  useful after a texture or material pipeline change where every photo
  must be re-rendered from its own state.

### d5. ephemerality stays

free-orbit moves and other live adjustments remain ephemeral view state,
restored from scene state on reset (existing). pinned cameras and photos
are saved scene state. this matches the reference platform's rule: runtime
changes are ephemeral by default, edit-mode originals are restored on
reset. video/live streaming stays out: the reference platform streams
live in-scene; export for listings is ours. animated output is no longer
parked: video recording is built per [video-recording.md](video-recording.md).

## acceptance

- selftest: a photo captured with 4:5 selected records 1080x1350 and
  renders at exactly those pixels; a photo without recorded dimensions
  (pre-pass) reproduces at the legacy 1600x1600 square without failing.
- selftest: take a photo from a named camera, reframe that camera,
  reproduce the photo, assert the rendered pixels match the take-time
  values (frame equality against the take's png), proving the name is
  provenance and the values are truth.
- selftest: create two sets, capture into each, assert per-set numbering
  and order; export filenames derive from set name plus photo name.
- selftest: a photo's gate array matches the gate entries emitted during
  its take (a tampered registry record at take time yields a photo whose
  gate array shows the failed verification).
- qa-drag: capture during pinned mode keeps recording the pinned camera
  (existing check stays green).
- state schema: `state_version` bumps; import stays tolerant of v1 saves
  (a single implicit set is migrated to "shoot 1", photos keep their
  existing fields, gate defaults to [] when absent).
