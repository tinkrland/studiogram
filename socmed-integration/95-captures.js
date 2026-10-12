// ===== capture set, persistence, boot =====
const CAPTURE_IMG = new Map();   // capture id -> full png data url (memory only, never state)
const CAPTURE_THUMBS = new Map(); // capture id -> small jpeg data url

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

async function captureFrame() {
  const pinned = S.live.mode === "pinned" ? currentPinned() : null;
  const cameraState = pinned
    ? { mode: "pinned", pinned: pinned.name, position: pinned.position, target: pinned.target, fov: pinned.fov, focallength: S.live.focallength, focaldistance: S.live.focaldistance }
    : { mode: "orbit", position: [...S.live.position], target: [...S.live.target], fov: S.live.fov, focallength: S.live.focallength, focaldistance: S.live.focaldistance };
  const snapshot = sceneCoreState();
  const state_hash = await sha256hex(snapshot);
  const png = await renderPng(1600);
  const thumb = await makeThumb(png);
  const id = "c" + Math.random().toString(36).slice(2, 9);
  const name = `capture ${String(S.captures.length + 1).padStart(2, "0")}`;
  S.captures.push({ id, name, camera: cameraState, created_utc: nowUtc(), state_hash, snapshot });
  CAPTURE_IMG.set(id, png);
  CAPTURE_THUMBS.set(id, thumb);
  renderCaptureStrip(); saveState();
  toast(`${name} saved. adjust the scene and capture another view.`);
}

async function reproduceCapture(cap) {
  if (!cap.snapshot) { toast("this capture predates full snapshots"); return; }
  const prev = sceneCoreState();
  await applyCoreState(cap.snapshot);
  const png = await renderPng(1600);
  CAPTURE_IMG.set(cap.id, png);
  CAPTURE_THUMBS.set(cap.id, await makeThumb(png));
  await applyCoreState(prev);
  renderCaptureStrip();
  toast(`${cap.name} re-rendered from its saved scene state`);
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
  for (const inst of S.jewelry) buildJewelryInstance(inst);
  camera.position.set(...S.live.position);
  controls.target.set(...S.live.target);
  controls.enabled = S.live.mode !== "pinned";
  syncModeBadge();
  renderPanel(currentTab);
  updateVpOverlay();
}

function showCaptureModal(cap) {
  const modal = $("#capmodal");
  const img = modal.querySelector("img");
  img.src = CAPTURE_IMG.get(cap.id) || CAPTURE_THUMBS.get(cap.id) || "";
  modal.querySelector(".capmodal-meta").textContent =
    `${cap.name} · ${cap.camera.mode} · state sha-256 ${cap.state_hash.slice(0, 16)}… · ${cap.created_utc}`;
  modal.style.display = "flex";
}
$("#capmodal").addEventListener("click", () => { $("#capmodal").style.display = "none"; });

function renderCaptureStrip() {
  const strip = $("#capstrip");
  strip.innerHTML = "";
  $("#capcount").textContent = `${S.captures.length} capture${S.captures.length === 1 ? "" : "s"}`;
  if (!S.captures.length) {
    strip.appendChild(el("div", "empty", "no captures yet. compose the scene and save a frame, then adjust and capture again."));
    return;
  }
  S.captures.forEach((cap, i) => {
    const card = el("div", "capcard");
    const img = document.createElement("img");
    img.src = CAPTURE_THUMBS.get(cap.id) || "";
    img.alt = cap.name;
    img.title = "open the full frame";
    img.style.cursor = "zoom-in";
    img.addEventListener("click", () => showCaptureModal(cap));
    card.appendChild(img);
    const body = el("div", "cc-body");
    const nameInp = document.createElement("input");
    nameInp.type = "text"; nameInp.className = "cc-name"; nameInp.value = cap.name;
    nameInp.addEventListener("change", () => { cap.name = nameInp.value || cap.name; saveState(); });
    body.appendChild(nameInp);
    body.appendChild(el("div", "cc-meta", `${cap.camera.mode} · ${cap.created_utc} · state ${cap.state_hash.slice(0, 8)}`));
    const actions = el("div", "cc-actions");
    const mk = (label, fn, cls) => { const b = el("button", cls || "btn mini", label); b.addEventListener("click", fn); return b; };
    actions.append(
      mk("reproduce", () => reproduceCapture(cap)),
      mk("png", () => exportCapture(cap)),
      mk("up", () => moveCapture(i, -1)),
      mk("down", () => moveCapture(i, 1)),
      mk("x", () => deleteCapture(cap), "btn mini danger")
    );
    body.appendChild(actions);
    card.appendChild(body);
    strip.appendChild(card);
  });
}
function moveCapture(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= S.captures.length) return;
  const arr = S.captures;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  renderCaptureStrip(); saveState();
}
function deleteCapture(cap) {
  S.captures = S.captures.filter((c) => c !== cap);
  CAPTURE_IMG.delete(cap.id); CAPTURE_THUMBS.delete(cap.id);
  renderCaptureStrip(); saveState();
}
function downloadLink(name, href) {
  const a = document.createElement("a");
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
function exportCapture(cap) {
  const img = CAPTURE_IMG.get(cap.id);
  if (!img) { toast("full frame not in memory. use reproduce, then export."); return; }
  downloadLink(`${cap.name.replace(/\s+/g, "-")}.png`, img);
}
async function exportCaptureSet() {
  if (!S.captures.length) { toast("nothing to export yet"); return; }
  for (let i = 0; i < S.captures.length; i++) {
    exportCapture(S.captures[i]);
    await new Promise((r) => setTimeout(r, 350));
  }
  toast(`exported ${S.captures.length} png images`);
}

