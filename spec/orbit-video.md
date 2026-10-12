# spec: orbit video recording

the movement decision, ruled by the owner (2026-10-12): recording is a
live capture of the moving viewport, the rooms.xyz behavior. on the
reference platform a recording stays in view while the viewport moves:
the operator zooms and orbits during the take, and the recording captures
exactly that. export modes are mp4, mov, and webm. this spec covers the
video record, the live take, and deterministic export. it builds on
`camera/45-camera-modes.js` (orbit vs pinned), `socmed-integration/
95-captures.js` (capture, snapshot, reproduce, export), and the photo
record model of [photo-taking.md](photo-taking.md).

## principle: the path is the record, the file is an export

a photo's truth is its camera values plus snapshot; a video's truth is
the same plus time: a per-frame camera path. the recording that ships
is re-rendered from the record, never the live-compressed take. this
keeps the one invariant the studio is built on: exports are
deterministic renders of recorded state, so the same record exports to
the same bytes in any of the three formats, forever.

## decisions

### d1. the video record

`stopRecording` returns a video record alongside photos in scene state:

```
recording: {
  id, name, taken_utc, duration_ms, fps, width, height,
  state_hash,             // sha-256 over the core scene state at the take
  snapshot,               // the full core state at the take
  gate: [ ... ],          // gate entries at take time (same as a photo)
  path: [ { position, target, fov }, ... ]   // per-frame, fixed timestep
}
```

- the path is the camera performance: position, target, and fov per
  frame at the export fps. it is quantitative values only, which is what
  scene state is allowed to carry (no blobs, no qualitative data).
- the snapshot and gate follow the photo model exactly: values are
  truth, the gate array records what was verified at take time, and
  reproduce never re-gates.
- recordings live in a scene-level `recordings: []` array; the field is
  additive, `state_version` stays 2, and restore tolerates saves without
  it (missing field defaults to []). a recording is not a photo: capture
  sets stay photo-only in v1.
- path size discipline: 30 second cap at 30 fps is 900 entries, a few
  kilobytes. the cap is enforced at record time with a countdown; the
  take stops cleanly at the cap rather than running over.

### d2. the live take

- recording is available in orbit mode only. pinned mode is a fixed
  framing; a recording from it could only be a still. starting a
  recording while pinned is refused with a toast, and pinning during a
  take is deferred until the take ends.
- while recording, the viewport is live: orbit, zoom, and pan all
  continue to work and all of it is captured. this is the rooms.xyz
  behavior the owner ruled on, not a scripted turntable.
- the take itself uses `canvas.captureStream` + `MediaRecorder` (webm,
  the browser's native output). the live take exists for immediate
  playback and discard only; it is ephemeral and never enters scene
  state. the durable truth is the path plus snapshot recorded in
  parallel.
- the mode badge shows `recording` with the countdown; capture-frame is
  disabled during a take so the two record types never interleave.
- audio: silent. product output has no ambient track.

### d3. deterministic export (mp4, mov, webm)

- export always re-renders: apply the snapshot, step the path at the
  fixed fps, render each frame, encode via WebCodecs, mux to the chosen
  container. the operator chooses mp4, mov, or webm on the record's card.
- mp4 and mov carry the same h.264 track in sibling containers (the
  quicktime variant of the same box structure); webm carries vp9.
  encoding parameters are pinned constants, so export is byte-stable.
- muxing: a small muxer is vendored pinned under `assets/vendor/` with
  a PROVENANCE.md of upstream bytes and versions, the same treatment
  three received, or written in-house if no pristine small one covers
  all three containers. verify at implementation; a heavy transcoder
  (ffmpeg.wasm class) is out: it would dwarf the artifact and break the
  single-file discipline.
- fallback: if WebCodecs is unavailable, export offers the live-take
  webm only and says why, rather than shipping a degraded transcode
  path.
- resolution is the take-time viewport resolution. aspect-aware crops
  (4:5, 9:16, and friends) stay a separate parked pass;
  [../socmed-integration/platform-reference.md](../socmed-integration/platform-reference.md)
  already holds the settled numbers for it.

### d4. replay and reproduce

- replay plays the live take when it is still in memory; after reload
  only the record remains, and replay re-renders from the path at
  interactive rate. both show the same performance: the path is truth.
- reproduce re-renders a recording from its snapshot and path the same
  way a photo reproduces from its snapshot, without touching the working
  scene's final state. useful after a material pipeline change, same as
  batch reproduce for photos.

## acceptance

- selftest: record a scripted path, export webm twice, assert
  byte-identical outputs (export determinism).
- selftest: a recording survives reload with metadata intact; a save
  without the `recordings` field restores cleanly (additive schema).
- selftest: the exported mp4 and mov demux to the same h.264 track
  bytes; the webm's first frame matches a photo taken from the path's
  first keyframe over the same snapshot (frame equality).
- qa-drag: zoom while recording, assert consecutive output frames
  differ (the viewport moved inside the take), and that pointer drags
  stay live throughout.
- qa-drag: starting a recording in pinned mode is refused; the pinned
  camera is untouched after the refusal toast.
- ui: the record button, countdown, mode badge, and the three export
  buttons render without overlapping the capture strip; the artifact
  stays one deterministic file.
