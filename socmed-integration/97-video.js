// ===== video recording: manually driven viewport capture =====
// the owner ruled on movement after seeing the reference platform: recording
// captures the manually driven viewport, not an orbit script. zoom in, zoom
// out, pan, orbit, live lighting, and backdrop set changes all stay active during a
// take, and all of it is captured per frame. the take's durable truth is the
// per-frame camera path plus lighting deltas plus the take-time snapshot
// (quantitative values only, the same record discipline as photos); the
// mediarecorder take is an ephemeral preview that never enters scene state.
// the recording's dimensions are chosen up front (viewport or a platform
// aspect) and may be switched mid-take, rooms.xyz-style: the operator
// changes the framing while it runs, each change is captured per frame,
// and export letterboxes every segment onto the union canvas. every export
// re-renders the record through webcodecs into mp4, mov, or webm, so the
// same record exports to the same bytes forever.
// the dimension presets are shared with photo export: EXPORT_SIZES in
// socmed-integration/95-captures.js, which loads first
const VIDEO_FPS = 30;
const VIDEO_MAX_MS = 30000;
const RECORD_TAKES = new Map();  // recording id -> live take object url (memory only, never state)
let REC = null;                   // the active take
let VIEW_LOCKED = false;          // export and replay own the canvas while locked

// recording needs a movable framing: pinned mode is a fixed view, a
// recording from it could only be a still. the refusal is a toast, never
// a silent no.
function startRecording() {
  if (REC) { stopRecording(); return true; }
  if (S.live.mode === "pinned") {
    toast("pinned mode is a fixed framing. resume free orbit to record a move.");
    return false;
  }
  settleSlides(); // the take starts from the committed state, never a mid-slide view
  const sizeKey = $("#rec-size").value || "viewport";
  const dims = chosenDims("#rec-size");
  const width = dims.width, height = dims.height;
  REC = {
    t0: performance.now(),
    samples: [],
    chunks: [],
    sizeKey,
    width, height,
    snapshot: sceneCoreState(),
    gate: gateRecordAtTake(),
    state_hash: null,
  };
  sha256hex(REC.snapshot).then((h) => { if (REC) REC.state_hash = h; });
  // the live take: the browser's native canvas capture. preview quality
  // only; exports never come from this stream.
  try {
    const stream = canvas.captureStream(VIDEO_FPS);
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
    if (mime) {
      REC.recorder = new MediaRecorder(stream, { mimeType: mime });
      REC.recorder.ondataavailable = (e) => { if (REC && e.data && e.data.size) REC.chunks.push(e.data); };
      REC.recorder.start(250);
    }
  } catch (e) { /* no mediarecorder: the path is still recorded, exports still work */ }
  let lastLighting = canonical(S.lighting);
  let lastEnvironment = canonical(S.environment);
  let lastSizeKey = null;
  const sample = () => {
    if (!REC) return;
    const frame = {
      t: performance.now() - REC.t0,
      position: [round(camera.position.x), round(camera.position.y), round(camera.position.z)],
      target: [round(controls.target.x), round(controls.target.y), round(controls.target.z)],
      fov: round(camera.fov),
    };
    // lighting is captured as deltas: a frame carries the lighting values
    // only when they changed, so a 30s take costs a few dozen entries
    const nowLighting = canonical(S.lighting);
    if (nowLighting !== lastLighting) {
      lastLighting = nowLighting;
      frame.lighting = JSON.parse(JSON.stringify(S.lighting));
    }
    // the backdrop is captured the same way: only the frames where it
    // changed carry it, so a set change mid-take survives the export
    const nowEnv = canonical(S.environment);
    if (nowEnv !== lastEnvironment) {
      lastEnvironment = nowEnv;
      frame.environment = JSON.parse(JSON.stringify(S.environment));
    }
    // the viewport size travels with the frame: the first sample seeds the
    // take's opening framing, later entries record each mid-take switch
    if (REC.sizeKey !== lastSizeKey) {
      lastSizeKey = REC.sizeKey;
      frame.size = { key: REC.sizeKey, width: REC.width, height: REC.height };
    }
    REC.samples.push(frame);
    if (performance.now() - REC.t0 >= VIDEO_MAX_MS) { stopRecording(); return; }
    REC.raf = requestAnimationFrame(sample);
  };
  REC.raf = requestAnimationFrame(sample);
  REC.timer = setInterval(() => {
    if (!REC) return;
    updateRecordUi(Math.max(0, VIDEO_MAX_MS - (performance.now() - REC.t0)));
  }, 100);
  updateRecordUi(VIDEO_MAX_MS);
  showRecFrameOverlay();
  toast("recording the live viewport. zoom, pan, orbit, lighting, backdrop, and framing changes are all captured.");
  return true;
}

function updateRecordUi(msLeft) {
  const secs = Math.ceil(msLeft / 1000);
  $("#btn-record").textContent = `stop · ${secs}s`;
  $("#btn-capture").disabled = true;
  $("#vpmode").textContent = `recording · ${secs}s`;
}

// the framing overlay shows what the chosen dimensions see, so a portrait
// take or photo can be composed while recording into it. during a take the
// recording's dimensions rule the overlay; otherwise it arms for the photo
// selector, and clears entirely when the live viewport is what exports.
function showRecFrameOverlay() {
  const vp = $("#viewport");
  let ov = document.getElementById("rec-frame");
  const frame = REC
    ? { w: REC.width, h: REC.height, on: REC.sizeKey !== "viewport" }
    : ($("#photo-size").value !== "viewport" ? chosenDims("#photo-size") : null);
  if (!frame) { if (ov) ov.remove(); return; }
  if (!ov) { ov = document.createElement("div"); ov.id = "rec-frame"; vp.appendChild(ov); }
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const ar = frame.w / frame.h;
  let w = vw * 0.92, h = w / ar;
  if (h > vh * 0.92) { h = vh * 0.92; w = h * ar; }
  ov.style.width = w + "px";
  ov.style.height = h + "px";
}
$("#photo-size").addEventListener("change", showRecFrameOverlay);
// rooms.xyz lets the operator change the recording's dimensions while it
// runs. the switch is live immediately and the next sampled frame carries
// it, so the export replays the framing exactly as it was played.
$("#rec-size").addEventListener("change", () => {
  if (!REC) return;
  const dims = chosenDims("#rec-size");
  REC.sizeKey = $("#rec-size").value || "viewport";
  REC.width = dims.width;
  REC.height = dims.height;
  showRecFrameOverlay();
  toast(`recording framing switched to ${REC.width}x${REC.height}.`);
});

// resample the live samples onto the fixed export grid: one path entry per
// exported frame, camera values lerped between the bracketing live samples,
// lighting carried forward from the last change at or before that moment.
function buildPath(samples, duration_ms) {
  const n = Math.max(2, Math.round((duration_ms / 1000) * VIDEO_FPS) + 1);
  const path = [];
  const lerp = (a, b, f) => round(a + (b - a) * f);
  // the lighting value in effect at each live sample, carried forward from
  // the last change at or before it
  let eff = null, effEnv = null, effSize = null;
  const effAt = samples.map((s) => { if (s.lighting) eff = s.lighting; return eff; });
  const effEnvAt = samples.map((s) => { if (s.environment) effEnv = s.environment; return effEnv; });
  const effSizeAt = samples.map((s) => { if (s.size) effSize = s.size; return effSize; });
  // dedupe against the last value each track stored, not against the
  // previous entry (which may have stored nothing and would re-store
  // every other frame)
  let lastLight = null, lastEnv = null, lastSize = null;
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * duration_ms;
    // bracket the moment between two live samples; before the first and
    // after the last sample, clamp to the end brackets. falling back to
    // the opening sample for the final frame would revert the last frame
    // to the take's opening lighting, backdrop, and framing.
    let a = samples[0], b = samples[Math.min(1, samples.length - 1)];
    let ai = 0;
    if (t >= samples[samples.length - 1].t && samples.length >= 2) {
      a = samples[samples.length - 2]; b = samples[samples.length - 1]; ai = samples.length - 2;
    } else {
      for (let j = 0; j < samples.length - 1; j++) {
        if (samples[j].t <= t && samples[j + 1].t >= t) { a = samples[j]; b = samples[j + 1]; ai = j; break; }
      }
    }
    const lighting = effAt[ai];
    const span = Math.max(b.t - a.t, 1e-6);
    const f = Math.min(Math.max((t - a.t) / span, 0), 1);
    const entry = {
      position: a.position.map((v, k) => lerp(v, b.position[k], f)),
      target: a.target.map((v, k) => lerp(v, b.target[k], f)),
      fov: lerp(a.fov, b.fov, f),
    };
    // store each track only on the frames where its value changed
    if (lighting && canonical(lighting) !== lastLight) {
      lastLight = canonical(lighting);
      entry.lighting = JSON.parse(JSON.stringify(lighting));
    }
    const environment = effEnvAt[ai];
    if (environment && canonical(environment) !== lastEnv) {
      lastEnv = canonical(environment);
      entry.environment = JSON.parse(JSON.stringify(environment));
    }
    const size = effSizeAt[ai];
    if (size && canonical(size) !== lastSize) {
      lastSize = canonical(size);
      entry.size = JSON.parse(JSON.stringify(size));
    }
    path.push(entry);
  }
  return path;
}

// the viewport size in effect at a path frame, carried forward from the
// last change at or before it. records from before mid-take switching carry
// no size entries; they render whole at the record's own dimensions.
function videoSizeAt(rec, i) {
  let size = { key: rec.size, width: rec.width, height: rec.height };
  for (let j = 0; j <= i && j < rec.path.length; j++) if (rec.path[j].size) size = rec.path[j].size;
  return size;
}

// the effective lighting at a path frame, carried forward from the last
// change at or before it. this is what export applies before rendering.
function pathLightingAt(rec, i) {
  let lighting = rec.snapshot.lighting;
  for (let j = 0; j <= i && j < rec.path.length; j++) if (rec.path[j].lighting) lighting = rec.path[j].lighting;
  return lighting;
}

function stopRecording() {
  if (!REC) return null;
  const duration_ms = performance.now() - REC.t0;
  if (REC.raf) cancelAnimationFrame(REC.raf);
  if (REC.timer) clearInterval(REC.timer);
  const closing = REC;
  const overlay = document.getElementById("rec-frame");
  if (overlay) overlay.remove();
  $("#btn-record").textContent = "record video";
  $("#btn-capture").disabled = false;
  $("#rec-size").disabled = false;
  const rec = {
    id: "v" + Math.random().toString(36).slice(2, 9),
    name: `recording ${String(S.recordings.length + 1).padStart(2, "0")}`,
    created_utc: nowUtc(),
    duration_ms: Math.round(duration_ms),
    fps: VIDEO_FPS,
    size: closing.sizeKey,
    width: closing.width,   // the final dimensions of the take; earlier segments live in the path
    height: closing.height,
    state_hash: closing.state_hash,
    snapshot: closing.snapshot,
    gate: closing.gate,
    path: buildPath(closing.samples, duration_ms),
  };
  const finish = () => {
    if (closing.chunks.length) {
      const url = URL.createObjectURL(new Blob(closing.chunks, { type: "video/webm" }));
      RECORD_TAKES.set(rec.id, url);
    }
    renderCaptureStrip();
  };
  REC = null;
  if (closing.recorder && closing.recorder.state !== "inactive") closing.recorder.onstop = finish;
  else finish();
  if (closing.recorder) closing.recorder.stop();
  S.recordings.push(rec);
  syncModeBadge();
  renderCaptureStrip(); saveState();
  toast(`${rec.name} saved: ${(rec.duration_ms / 1000).toFixed(1)}s, ${rec.path.length} frames, ${rec.width}x${rec.height}. export below.`);
  return rec;
}

// deterministic export: re-render the record's path over its snapshot at the
// fixed fps and the record's chosen dimensions, apply each frame's lighting,
// encode through webcodecs, mux to the chosen container. mp4 and mov carry
// the same h.264 track in sibling containers; webm carries vp9. the same
// record always exports to the same bytes.
async function renderVideoBuffer(rec, fmt) {
  if (!["mp4", "mov", "webm"].includes(fmt)) throw new Error("unknown export format " + fmt);
  if (typeof window.VideoEncoder === "undefined") {
    const take = RECORD_TAKES.get(rec.id);
    if (fmt === "webm" && take) return { liveTakeUrl: take };
    throw new Error("no webcodecs encoder in this browser; only the live take webm is available");
  }
  const { Output, Mp4OutputFormat, MovOutputFormat, WebMOutputFormat, CanvasSource, BufferTarget, QUALITY_HIGH } =
    await import("mediabunny");
  const formats = { mp4: Mp4OutputFormat, mov: MovOutputFormat, webm: WebMOutputFormat };
  const codec = fmt === "webm" ? "vp9" : "avc";
  const prev = sceneCoreState();
  const wasLocked = VIEW_LOCKED;
  VIEW_LOCKED = true;
  try {
    await applyCoreState(rec.snapshot);
    renderer.setPixelRatio(1);
    // a video track has one fixed size, so mixed framings export onto the
    // union of every size the take used: each frame renders at exactly the
    // dimensions in effect, then centers onto the union canvas (letterbox
    // bars where aspects differ, black as video convention). takes that
    // never switched framing export unchanged.
    const sizes = rec.path.map((_, i) => videoSizeAt(rec, i));
    const outW = Math.max(...sizes.map((x) => x.width));
    const outH = Math.max(...sizes.map((x) => x.height));
    const comp = document.createElement("canvas");
    comp.width = outW; comp.height = outH;
    const cctx = comp.getContext("2d");
    const first = sizes[0];
    renderer.setSize(first.width, first.height, false);
    camera.aspect = first.width / first.height;
    pinnedHelper.aspect = first.width / first.height;
    const target = new BufferTarget();
    const output = new Output({ format: new formats[fmt](), target });
    const source = new CanvasSource(comp, { codec, quality: QUALITY_HIGH });
    output.addVideoTrack(source, { frameRate: VIDEO_FPS });
    await output.start();
    const dt = 1 / VIDEO_FPS;
    for (let i = 0; i < rec.path.length; i++) {
      const k = rec.path[i];
      const size = sizes[i];
      if (renderer.domElement.width !== size.width || renderer.domElement.height !== size.height) {
        renderer.setSize(size.width, size.height, false);
        camera.aspect = size.width / size.height;
        pinnedHelper.aspect = size.width / size.height;
      }
      camera.position.set(...k.position);
      controls.target.set(...k.target);
      camera.lookAt(...k.target);
      camera.fov = k.fov;
      camera.updateProjectionMatrix();
      // a lighting change captured mid-take is part of the performance
      if (k.lighting) { S.lighting = JSON.parse(JSON.stringify(k.lighting)); applyLighting(); }
      // and so is a set change: the backdrop is re-rendered as the take played it
      if (k.environment) { S.environment = JSON.parse(JSON.stringify(k.environment)); applyEnvironment(); }
      renderFrame();
      cctx.fillStyle = "#000";
      cctx.fillRect(0, 0, outW, outH);
      cctx.drawImage(renderer.domElement, Math.round((outW - size.width) / 2), Math.round((outH - size.height) / 2));
      await source.add(i * dt, dt);
    }
    await output.finalize();
    const buffer = target.buffer;
    return { buffer, mime: await output.getMimeType() };
  } finally {
    VIEW_LOCKED = wasLocked;
    await applyCoreState(prev);
    resize();
    renderCaptureStrip();
  }
}

async function exportVideo(rec, fmt) {
  try {
    const out = await renderVideoBuffer(rec, fmt);
    if (out.liveTakeUrl) {
      downloadLink(`${slug(rec.name)}.webm`, out.liveTakeUrl);
      toast(`${rec.name} exported as the live take (no webcodecs encoder available)`);
      return;
    }
    const url = URL.createObjectURL(new Blob([out.buffer], { type: out.mime }));
    downloadLink(`${slug(rec.name)}-${rec.width}x${rec.height}.${fmt}`, url);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`${rec.name} exported as ${fmt}: ${Math.round(out.buffer.byteLength / 1024)} kb, ${rec.path.length} frames`);
  } catch (e) {
    toast("video export failed: " + e.message);
  }
}

// replay plays the live take while it is still in memory; after a reload
// only the record remains, and replay re-renders the path in real time,
// lighting changes included. both show the same performance: the path is
// truth.
async function replayVideo(rec) {
  const take = RECORD_TAKES.get(rec.id);
  if (take) {
    const modal = $("#vidmodal");
    const video = modal.querySelector("video");
    video.src = take;
    modal.querySelector(".capmodal-meta").textContent =
      `${rec.name} · live take · ${(rec.duration_ms / 1000).toFixed(1)}s · ${rec.width}x${rec.height}`;
    modal.style.display = "flex";
    video.play().catch(() => {});
    return;
  }
  const prev = sceneCoreState();
  const wasLocked = VIEW_LOCKED;
  VIEW_LOCKED = true;
  try {
    await applyCoreState(rec.snapshot);
    toast(`replaying ${rec.name} from its recorded path`);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = performance.now() - t0;
        const i = Math.min(Math.floor((t / 1000) * VIDEO_FPS), rec.path.length - 1);
        const k = rec.path[i];
        const size = videoSizeAt(rec, i);
        if (renderer.domElement.width !== size.width || renderer.domElement.height !== size.height) {
          renderer.setPixelRatio(1);
          renderer.setSize(size.width, size.height, false);
          camera.aspect = size.width / size.height;
          pinnedHelper.aspect = size.width / size.height;
        }
        camera.position.set(...k.position);
        controls.target.set(...k.target);
        camera.lookAt(...k.target);
        camera.fov = k.fov;
        camera.updateProjectionMatrix();
        if (k.lighting) { S.lighting = JSON.parse(JSON.stringify(k.lighting)); applyLighting(); }
        if (k.environment) { S.environment = JSON.parse(JSON.stringify(k.environment)); applyEnvironment(); }
        renderFrame();
        if (t >= rec.duration_ms || i >= rec.path.length - 1) return resolve();
        requestAnimationFrame(step);
      };
      step();
    });
  } finally {
    VIEW_LOCKED = wasLocked;
    await applyCoreState(prev);
    resize();
    renderCaptureStrip();
  }
}

function deleteRecording(rec) {
  S.recordings = S.recordings.filter((r) => r !== rec);
  const url = RECORD_TAKES.get(rec.id);
  if (url) { URL.revokeObjectURL(url); RECORD_TAKES.delete(rec.id); }
  renderCaptureStrip(); saveState();
}

// the recordings sit in the capture bar under the photo strip. a live
// take shows itself while it runs; finished takes show their metadata and
// the three export modes.
function renderVideoStrip() {
  let row = document.getElementById("vidrow");
  if (row) row.remove();
  row = el("div", "vidrow");
  row.id = "vidrow";
  if (REC) {
    const live = el("div", "vidcard live");
    const secs = Math.min(VIDEO_MAX_MS, performance.now() - REC.t0) / 1000;
    live.appendChild(el("div", "cc-meta", `recording… ${secs.toFixed(1)}s · ${REC.width}x${REC.height} · zoom/pan/orbit/lighting stay live`));
    row.appendChild(live);
  }
  for (const rec of S.recordings) {
    const card = el("div", "vidcard");
    card.appendChild(el("div", "cc-name", rec.name));
    const lightDeltas = rec.path.filter((f) => f.lighting).length;
    card.appendChild(el("div", "cc-meta",
      `${(rec.duration_ms / 1000).toFixed(1)}s · ${rec.fps}fps · ${rec.width}x${rec.height} · ${lightDeltas ? lightDeltas + " lighting change" + (lightDeltas === 1 ? "" : "s") + " · " : ""}state ${(rec.state_hash || "").slice(0, 8)}${RECORD_TAKES.has(rec.id) ? " · live take in memory" : ""}`));
    const actions = el("div", "cc-actions");
    const mk = (label, fn, cls) => { const b = el("button", cls || "btn mini", label); b.addEventListener("click", fn); return b; };
    actions.append(
      mk("replay", () => replayVideo(rec)),
      mk("mp4", () => exportVideo(rec, "mp4")),
      mk("mov", () => exportVideo(rec, "mov")),
      mk("webm", () => exportVideo(rec, "webm")),
      mk("x", () => deleteRecording(rec), "btn mini danger")
    );
    card.appendChild(actions);
    row.appendChild(card);
  }
  if (row.children.length) $("#capstrip").appendChild(row);
}

// wrap the photo strip render so the video row refreshes with it
const renderPhotoStrip = renderCaptureStrip;
renderCaptureStrip = function () {
  renderPhotoStrip();
  renderVideoStrip();
};

$("#btn-record").addEventListener("click", () => { if (REC) stopRecording(); else startRecording(); });
$("#vidmodal").addEventListener("click", () => {
  const modal = $("#vidmodal");
  modal.style.display = "none";
  modal.querySelector("video").pause();
});
window.addEventListener("resize", () => { if (REC) showRecFrameOverlay(); });
