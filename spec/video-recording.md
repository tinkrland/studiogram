# spec: video recording

the movement decision, ruled by the owner (2026-10-12, refined same day
after seeing the reference platform in use): recording is a manually
driven capture of the live viewport, not an orbit script. on rooms.xyz
the operator zooms in and out, pans, and changes the dimensions of the
recording while it runs; a studiogram take captures exactly that, plus
live lighting and backdrop set adjustments. export modes are mp4, mov, and webm. this
spec covers the video record, the live take, and deterministic export.
it builds on `camera/45-camera-modes.js` (orbit vs pinned),
`socmed-integration/95-captures.js` (capture, snapshot, reproduce,
export), and the photo record model of [photo-taking.md](photo-taking.md).

## principle: the path is the record, the file is an export

a photo's truth is its camera values plus snapshot; a video's truth is
the same plus time: a per-frame camera path with per-frame lighting,
backdrop, and framing changes. the recording that ships is re-rendered from the record, never
the live-compressed take. this keeps the one invariant the studio is
built on: exports are deterministic renders of recorded state, so the
same record exports to the same bytes in any of the three formats,
forever.

## decisions

### d1. the video record

`stopRecording` returns a video record alongside photos in scene state:

```
recording: {
  id, name, created_utc, duration_ms, fps, size, width, height,
  state_hash,             // sha-256 over the core scene state at the take
  snapshot,               // the full core scene state at the take
  gate: [ ... ],          // gate entries at take time (same as a photo)
  path: [ { position, target, fov, lighting?, environment?, size? }, ... ]  // per-frame, fixed timestep
}
```

- the path is the performance: camera values per frame at the export
  fps, lerped onto the fixed grid from the live samples. a frame carries
  lighting values only when they changed (delta encoding, carried
  forward at export). the backdrop set follows the same rule: a frame
  carries the environment values only when they changed, so a
  mid-take set swap survives into the export. all quantitative, which
  is what scene state is allowed to carry (no blobs, no qualitative
  data).
- the snapshot and gate follow the photo model exactly: values are
  truth, the gate array records what was verified at take time, and
  reproduce never re-gates. scene edits beyond lighting mid-take are
  not part of the record; the take starts from the committed state.
  lighting and the backdrop set are the live exceptions because the
  owner called them out.
- `width`/`height` are the recording's final dimensions (d3); earlier
  framings live in the path as `size` delta frames and export renders
  each segment at exactly its own dimensions (union letterbox).
- recordings live in a scene-level `recordings: []` array; the field is
  additive, `state_version` stays 2, and restore tolerates saves without
  it (missing field defaults to []). a recording is not a photo: capture
  sets stay photo-only in v1.
- path size discipline: 30 second cap at 30 fps is 900 camera entries
  plus a handful of lighting deltas, a few kilobytes. the cap is enforced
  at record time with a countdown; the take stops cleanly at the cap
  rather than running over.

### d2. the live take

- recording is available in orbit mode only. pinned mode is a fixed
  framing; a recording from it could only be a still. starting a
  recording while pinned is refused with a toast, pinning during a
  take is deferred until the take ends, and photo capture is disabled
  so the two record types never interleave.
- while recording, the viewport is live: orbit, zoom, and pan all
  continue to work and all of it is captured, and lighting adjustments
  (the lighting/ panel) are sampled per frame. this is the rooms.xyz
  behavior the owner ruled on.
- the take itself uses `canvas.captureStream` + `MediaRecorder` (webm,
  the browser's native output). the live take exists for immediate
  playback and discard only; it is ephemeral and never enters scene
  state. the durable truth is the path plus snapshot recorded in
  parallel.
- the mode badge shows `recording` with the countdown.
- audio: silent. product output has no ambient track.

### d3. recording dimensions

- dimensions are chosen before the take, from a selector beside the
  record button: viewport size, 1:1 1080, 4:5 1080x1350, 9:16
  1080x1920, 16:9 1920x1080. the numbers match the export ratios
  settled in
  [../socmed-integration/platform-reference.md](../socmed-integration/platform-reference.md);
  a full aspect-aware photo export stays its own parked pass.
- during the take a framing overlay shows what the chosen dimensions
  see, so a portrait take can be composed while recording into it.
- the selector stays live during the take, rooms.xyz-style: the operator
  may switch framing while recording, each switch is captured per frame
  (delta-encoded, carried forward like lighting and the backdrop set),
  and the record's `width`/`height` are the final framing.
- export: a video track has one fixed size, so mixed framings render
  each segment at its own exact dimensions onto the union canvas of
  every size the take used, centered and letterboxed (black bars).
  takes that never switched framing export whole, unchanged.
- the export grid clamps to the end brackets: a frame after the last
  live sample uses the last bracket, never the opening sample, so the
  final frame keeps the take's closing lighting, backdrop, and framing.

### d4. deterministic export (mp4, mov, webm)

- export always re-renders: apply the snapshot, step the path at the
  fixed fps applying each frame's lighting, render each frame, encode
  via WebCodecs, mux to the chosen container. the operator chooses
  mp4, mov, or webm on the record's card.
- mp4 and mov carry the same h.264 track in sibling containers (the
  quicktime variant of the same box structure); webm carries vp9.
  encoding parameters are pinned constants, so export is byte-stable.
- muxing is mediabunny 1.61.3, vendored pinned under
  `assets/vendor/mediabunny@1.61.3/` with a PROVENANCE.md of upstream
  bytes and license (mpl-2.0), the same treatment three received. it
  is imported lazily, so page load never parses the encoder until an
  export or demux needs it.
- fallback: if WebCodecs is unavailable, export offers the live-take
  webm only and says why, rather than shipping a degraded transcode
  path.

### d5. replay and reproduce

- replay plays the live take when it is still in memory; after reload
  only the record remains, and replay re-renders from the path at
  interactive rate, lighting changes included. both show the same
  performance: the path is truth.

## acceptance

- selftest: record a scripted path, export webm twice, assert
  byte-identical outputs (export determinism).
- selftest: a mid-take lighting change lands in the path as delta
  frames and carries forward to the last frame; a mid-take framing
  switch lands the same way (seed frame plus one delta per switch), the
  record's dimensions are the final framing, and export stays
  byte-identical across mixed framings.
- selftest: demux the exported mp4 and webm (mediabunny Input): the
  avc and vp9 tracks each carry exactly the path's frame count.
- selftest: a recording survives reload with metadata intact; a save
  without the `recordings` field restores cleanly (additive schema).
- qa-drag: while pinned, starting a recording is refused and no record
  is created; the pinned camera is untouched after the refusal toast.
- qa-drag: zoom and drag while recording; assert the pointer drags
  stay live during the take, the 9:16 overlay is drawn, and the saved
  path's first and last frames differ (the viewport moved inside the
  take).
- ui: the record button, dimension selector, countdown, framing
  overlay, and the three export buttons render without overlapping the
  capture strip; the artifact stays one deterministic file.
