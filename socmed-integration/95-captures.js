// ===== photos and capture sets =====
// a photo is an immutable record of exactly what rendered, from exactly where,
// over exactly what scene state. cameras are mutable scene things; a photo
// keeps the values it was taken with, and the camera name only as provenance.
const CAPTURE_IMG = new Map();   // photo id -> full png data url (memory only, never state)
const CAPTURE_THUMBS = new Map(); // photo id -> small jpeg data url

function sceneCoreState() {
  return JSON.parse(JSON.stringify({
    hand: S.hand, pose: S.pose, jewelry: S.jewelry,
    lighting: S.lighting, environment: S.environment, live: S.live, cameras: S.cameras
  }));
}

async function renderPng(size) {
  const prevMode = S.live.mode;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  camera.aspect = 1; pinnedHelper.aspect = 1;
  renderFrame();
  const url = renderer.domElement.toDataURL("image/png");
  resize();
  return url;
}
function makeThumb(png) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 240;
      const ctx = cv.getContext("2d");
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 240, 240);
      resolve(cv.toDataURL("image/jpeg", 0.82));
    };
    img.src = png;
  });
}

function activeSet() { return S.sets.find((x) => x.id === S.active_set) || S.sets[0]; }
function photosInSet(set) {
  return (set.photo_ids || []).map((id) => S.photos.find((p) => p.id === id)).filter(Boolean);
}

// the gate array records which release references were verified when the
// frame was taken: the latest gate status per release in the scene
function gateRecordAtTake() {
  return S.jewelry.map((inst) => {
    // the mesh hash is the unique link from a photo to its gate record
    const latest = [...GATE.entries].reverse().find((e) => e.mesh_sha256 === inst.mesh_sha256);
    return {
      release: latest ? latest.release : inst.release_id,
      version: inst.version,
      mesh_sha256: inst.mesh_sha256,
      verified: latest ? latest.verified : true // it is in the scene, so it passed the gate on entry
    };
  });
}

async function captureFrame() {
  settleSlides(); // the take photographs the committed state, never a mid-slide frame
  const pinned = S.live.mode === "pinned" ? currentPinned() : null;
  const cameraState = pinned
    ? { mode: "pinned", name: pinned.name, position: [...pinned.position], target: [...pinned.target], fov: pinned.fov, focallength: S.live.focallength, focaldistance: S.live.focaldistance }
    : { mode: "orbit", name: null, position: [...S.live.position], target: [...S.live.target], fov: S.live.fov, focallength: S.live.focallength, focaldistance: S.live.focaldistance };
  const snapshot = sceneCoreState();
  const state_hash = await sha256hex(snapshot);
  const png = await renderPng(1600);
  const thumb = await makeThumb(png);
  const id = "c" + Math.random().toString(36).slice(2, 9);
  const set = activeSet();
  const name = `capture ${String((set.photo_ids || []).length + 1).padStart(2, "0")}`;
  const photo = { id, name, camera: cameraState, created_utc: nowUtc(), state_hash, snapshot, gate: gateRecordAtTake() };
  S.photos.push(photo);
  set.photo_ids.push(id);
  CAPTURE_IMG.set(id, png);
  CAPTURE_THUMBS.set(id, thumb);
  renderCaptureStrip(); saveState();
  toast(`${name} saved to "${set.name}". adjust the scene and capture another view.`);
  return photo;
}

async function reproduceCapture(photo) {
  if (!photo.snapshot) { toast("this photo predates full snapshots"); return; }
  const prev = sceneCoreState();
  await applyCoreState(photo.snapshot);
  const png = await renderPng(1600);
  CAPTURE_IMG.set(photo.id, png);
  CAPTURE_THUMBS.set(photo.id, await makeThumb(png));
  await applyCoreState(prev);
  renderCaptureStrip();
  toast(`${photo.name} re-rendered from its recorded scene state`);
}

async function applyCoreState(core) {
  S.hand = core.hand; S.pose = core.pose; S.jewelry = core.jewelry;
  S.lighting = core.lighting; S.environment = core.environment;
  S.live = core.live; S.cameras = core.cameras;
  await syncSceneToState();
}

// rebuilds every runtime object from state. the state is the truth.
async function syncSceneToState() {
  await buildHand();
  applyLighting();
  applyEnvironment();
  for (const inst of S.jewelry) await buildJewelryInstance(inst);
  camera.position.set(...S.live.position);
  controls.target.set(...S.live.target);
  controls.enabled = S.live.mode !== "pinned";
  syncModeBadge();
  renderPanel(currentTab);
  updateVpOverlay();
}

// batch reproduce: re-render the whole active set in order from snapshots,
// leaving the working scene exactly as it was
async function reproduceActiveSet() {
  const set = activeSet();
  const photos = photosInSet(set);
  if (!photos.length) { toast(`"${set.name}" has no photos yet`); return; }
  const prev = sceneCoreState();
  for (const photo of photos) {
    if (!photo.snapshot) continue;
    await applyCoreState(photo.snapshot);
    const png = await renderPng(1600);
    CAPTURE_IMG.set(photo.id, png);
    CAPTURE_THUMBS.set(photo.id, await makeThumb(png));
  }
  await applyCoreState(prev);
  renderCaptureStrip();
  toast(`re-rendered ${photos.length} photo${photos.length === 1 ? "" : "s"} in "${set.name}" from their recorded state`);
}

function showCaptureModal(photo) {
  const modal = $("#capmodal");
  const img = modal.querySelector("img");
  img.src = CAPTURE_IMG.get(photo.id) || CAPTURE_THUMBS.get(photo.id) || "";
  const cam = photo.camera;
  modal.querySelector(".capmodal-meta").textContent =
    `${photo.name} · ${cam.mode}${cam.name ? " · camera " + cam.name : ""} · state sha-256 ${photo.state_hash.slice(0, 16)}… · ${photo.created_utc}` +
    (photo.gate && photo.gate.length ? ` · ${photo.gate.length} verified release${photo.gate.length === 1 ? "" : "s"}` : "");
  modal.style.display = "flex";
}
$("#capmodal").addEventListener("click", () => { $("#capmodal").style.display = "none"; });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
function exportFilename(photo) {
  return `${slug(activeSet().name)}-${slug(photo.name)}.png`;
}

function renderCaptureStrip() {
  const strip = $("#capstrip");
  strip.innerHTML = "";
  const set = activeSet();
  const photos = photosInSet(set);
  $("#capcount").textContent = `${set.name} · ${photos.length} photo${photos.length === 1 ? "" : "s"}`;

  // capture sets: the recording of a shoot
  const setRow = el("div", "btnrow");
  for (const s of S.sets) {
    const chip = el("button", "btn mini" + (s.id === S.active_set ? " primary" : ""), s.name);
    chip.title = "make this the active set";
    chip.addEventListener("click", () => { S.active_set = s.id; renderCaptureStrip(); saveState(); });
    setRow.appendChild(chip);
  }
  const newSetInp = document.createElement("input"); newSetInp.type = "text"; newSetInp.placeholder = "set name"; newSetInp.style.width = "110px";
  const newSetBtn = el("button", "btn mini", "new set");
  newSetBtn.addEventListener("click", () => {
    const name = newSetInp.value.trim() || "set " + (S.sets.length + 1);
    const id = "set" + Date.now().toString(36);
    S.sets.push({ id, name, photo_ids: [] });
    S.active_set = id;
    newSetInp.value = "";
    renderCaptureStrip(); saveState();
    toast(`capture set "${name}" created and active`);
  });
  setRow.append(newSetInp, newSetBtn);
  const renameInp = document.createElement("input"); renameInp.type = "text"; renameInp.value = set.name; renameInp.style.width = "110px";
  renameInp.title = "rename the active set";
  renameInp.addEventListener("change", () => { set.name = renameInp.value.trim() || set.name; renderCaptureStrip(); saveState(); });
  setRow.appendChild(renameInp);
  strip.appendChild(setRow);

  const stripRow = el("div", "capstrip-row");
  if (!photos.length) {
    stripRow.appendChild(el("div", "empty", "no photos in this set yet. compose the scene and save a frame, then adjust and capture again."));
  }
  photos.forEach((photo, i) => {
    const card = el("div", "capcard");
    const img = document.createElement("img");
    img.src = CAPTURE_THUMBS.get(photo.id) || "";
    img.alt = photo.name;
    img.title = "open the full frame";
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => showCaptureModal(photo));
    card.appendChild(img);
    const body = el("div", "cc-body");
    const nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.className = "cc-name"; nameInp.value = photo.name;
    nameInp.addEventListener("change", () => { photo.name = nameInp.value || photo.name; saveState(); });
    body.appendChild(nameInp);
    body.appendChild(el("div", "cc-meta", `${photo.camera.mode}${photo.camera.name ? " · " + photo.camera.name : ""} · ${photo.created_utc} · state ${photo.state_hash.slice(0, 8)}`));
    const actions = el("div", "cc-actions");
    const mk = (label, fn, cls) => { const b = el("button", cls || "btn mini", label); b.addEventListener("click", fn); return b; };
    actions.append(
      mk("reproduce", () => reproduceCapture(photo)),
      mk("png", () => exportCapture(photo)),
      mk("up", () => moveCapture(i, -1)),
      mk("down", () => moveCapture(i, 1)),
      mk("x", () => deleteCapture(photo), "btn mini danger")
    );
    body.appendChild(actions);
    card.appendChild(body);
    stripRow.appendChild(card);
  });
  strip.appendChild(stripRow);
}
function moveCapture(i, dir) {
  const set = activeSet();
  const ids = set.photo_ids;
  const j = i + dir;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  renderCaptureStrip(); saveState();
}
function deleteCapture(photo) {
  const set = activeSet();
  set.photo_ids = set.photo_ids.filter((id) => id !== photo.id);
  S.photos = S.photos.filter((p) => p !== photo);
  CAPTURE_IMG.delete(photo.id); CAPTURE_THUMBS.delete(photo.id);
  renderCaptureStrip(); saveState();
}
function downloadLink(name, href) {
  const a = document.createElement("a");
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
function exportCapture(photo) {
  const img = CAPTURE_IMG.get(photo.id);
  if (!img) { toast("full frame not in memory. use reproduce, then export."); return; }
  downloadLink(exportFilename(photo), img);
}
async function exportCaptureSet() {
  const set = activeSet();
  const photos = photosInSet(set);
  if (!photos.length) { toast(`"${set.name}" has no photos to export yet`); return; }
  for (let i = 0; i < photos.length; i++) {
    exportCapture(photos[i]);
    await new Promise((r) => setTimeout(r, 350));
  }
  toast(`exported ${photos.length} png image${photos.length === 1 ? "" : "s"} from "${set.name}"`);
}
