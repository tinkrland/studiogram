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

// ===== full state: export, import, reset, restore =====
function exportSceneState() {
  const blob = new Blob([JSON.stringify(serializeState(true), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadLink("studiogram-scene-state.json", url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("scene state exported");
}

function deepMerge(base, incoming) {
  if (incoming === undefined || incoming === null) return base;
  if (typeof base !== "object" || typeof incoming !== "object" || Array.isArray(base) || Array.isArray(incoming)) {
    return incoming;
  }
  const out = { ...base };
  for (const k of Object.keys(incoming)) out[k] = deepMerge(base[k], incoming[k]);
  return out;
}

async function applyFullState(raw, opts = {}) {
  const def = defaultState();
  const st = deepMerge(def, raw);
  // gate every release reference on import: id, version, mesh hash must match the registry
  const kept = [];
  for (const inst of st.jewelry || []) {
    const rec = byRelease.get(inst.release_id);
    const ok = rec && rec.version === inst.version && rec.assets.mesh_sha256 === inst.mesh_sha256;
    if (ok) kept.push(inst);
    else {
      GATE.entries.push({ utc: nowUtc(), release: inst.release_id, version: inst.version, mesh_sha256: inst.mesh_sha256 || "missing", verified: false });
      toast("a release reference failed the ingestion gate and was refused");
    }
  }
  st.jewelry = kept;
  // captures: pull thumbs into memory, keep the rest as values
  for (const c of st.captures || []) {
    if (c.thumb) { CAPTURE_THUMBS.set(c.id, c.thumb); delete c.thumb; }
    if (!c.snapshot) c.snapshot = null; // captures predating snapshots cannot reproduce
  }
  S = st;
  await syncSceneToState();
  renderCaptureStrip();
  renderGateEntries();
  saveState();
}

$("#btn-import-state").addEventListener("click", () => $("#file-import").click());
$("#file-import").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    if (data.schema !== "studiogram-scene-state") { toast("not a studiogram scene state file"); return; }
    await applyFullState(data);
    toast("scene state imported and verified");
  } catch (e) {
    toast("could not read that file: " + e.message);
  }
  ev.target.value = "";
});
$("#btn-reset-scene").addEventListener("click", () => {
  S = defaultState();
  CAPTURE_IMG.clear(); CAPTURE_THUMBS.clear();
  (async () => { await applyFullState(S, { fresh: true }); toast("scene reset to a clean subject"); })();
});
$("#btn-export-state").addEventListener("click", exportSceneState);
$("#btn-export-caps").addEventListener("click", exportCaptureSet);
$("#btn-capture").addEventListener("click", captureFrame);

// ===== boot =====
function restoreFromStorage() {
  try {
    const txt = localStorage.getItem("studiogram_state");
    if (!txt) return null;
    const data = JSON.parse(txt);
    if (data.schema !== "studiogram-scene-state") return null;
    // scenes saved against the old procedural hand no longer apply: the
    // rig, its bone space, and every camera framing changed with the model
    if (!data.hand || data.hand.model !== "rigged-hand-v4.1") return null;
    return data;
  } catch (e) { return null; }
}


// ===== self test (only with #selftest in the url) =====
// renders the band with an unambiguous flat magenta material and counts the
// pixels that reach the frame, so placement and visibility are checkable
// without human eyes on the canvas.
async function runSelfTest() {
  S = defaultState();
  await loadHandModel();
  applyLighting();
  applyEnvironment();
  camera.position.set(...S.live.position);
  controls.target.set(...S.live.target);
  await addJewelryInstance(REGISTRY[0].release_id, "gold_14k_yellow");
  applyPosePreset("presenting");
  const results = [];
  results.push("build marker: rigged-hand-1");
  results.push("bones: " + HAND.boneCount + ", skinned verts: " + HAND.skinned.geometry.attributes.position.count);
  results.push("bone names: " + [...HAND.bones.keys()].join(", "));
  results.push("ring bone found: " + !!HAND.bones.get("finger_ring01L") + ", bone len: " + (HAND.boneLen.get("ring") || 0).toFixed(4));
  const j = [...JEWELRY.values()][0];
  const g = j.group;
  let mesh = null;
  g.traverse((o) => { if (o.isMesh) mesh = o; });
  if (mesh) mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  renderFrame();
  camera.updateMatrixWorld();
  g.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(g);
  results.push("ring box empty: " + box.isEmpty() + ", center: " + box.getCenter(new THREE.Vector3()).toArray().map((n) => n.toFixed(1)).join(", "));
  const ndc = box.getCenter(new THREE.Vector3()).project(camera);
  results.push("ring ndc: " + ndc.toArray().map((n) => n.toFixed(2)).join(", "));
  const png = await renderPng(400);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; });
  const cv = document.createElement("canvas"); cv.width = cv.height = 400;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, 400, 400).data;
  let magenta = 0, skin = 0, total = 0;
  for (let i = 0; i < d.length; i += 4) {
    total++;
    if (d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 120) magenta++;
    if (d[i] > 60 && d[i] > d[i + 2] + 8 && d[i + 1] > d[i + 2] - 12) skin++;
  }
  results.push("magenta pixels in 400px render: " + magenta);
  results.push("skin pixels in 400px render: " + skin + " of " + total);
  const div = document.createElement("div");
  div.id = "selftest";
  div.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:200;background:#111;color:#9fd99f;padding:12px;font:12px ui-monospace,monospace;white-space:pre;border:1px solid #4a4;";
  div.textContent = "studiogram selftest\n" + results.join("\n");
  document.body.appendChild(div);
  localStorage.removeItem("studiogram_state");
}

// audit mode: inspects the real boot flow's scene instead of building its own,
// so a divergence between selftest and normal boot shows up as numbers.
async function runSceneAudit() {
  const results = [];
  results.push("HAND.loaded: " + HAND.loaded);
  results.push("camera pos: " + camera.position.toArray().map((n) => n.toFixed(1)).join(", ") + ", target: " + controls.target.toArray().map((n) => n.toFixed(1)).join(", "));
  results.push("live: " + JSON.stringify({ position: S.live.position, target: S.live.target, mode: S.live.mode }));
  results.push("pose preset: " + S.pose.preset + ", wrist: " + JSON.stringify(S.pose.wrist));
  if (HAND.loaded) {
    HAND.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(HAND.model);
    results.push("morph targets: " + (HAND.skinned && HAND.skinned.morphTargetDictionary ? Object.keys(HAND.skinned.morphTargetDictionary).join(", ") : "none"));
  results.push("morph active: " + S.hand.presentation + " · build " + S.hand.morph.build + " · ft " + S.hand.morph.finger_thickness + " · nails " + S.hand.morph.nail_length + "/" + S.hand.morph.nail_shape);
  results.push("surface: finish " + S.hand.finish + " · tone " + S.hand.skin.tone + " · hair " + S.hand.skin.hair);
  results.push("nails: " + (S.hand.nails?.style || "natural") + (S.hand.nails?.style === "polished" ? " " + (S.hand.nails.color || "#b23a48") : ""));
  {
    // center-ray probe: the exact ray a screen-center click casts, against
    // the posed skinned hand. ground truth for placement raycasts.
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = rc.intersectObject(HAND.skinned, false)[0];
    results.push("center ray: " + (hit
      ? "hit uv " + hit.uv.x.toFixed(3) + "," + hit.uv.y.toFixed(3) + " dist " + Math.round(hit.distance)
      : "misses the skinned hand"));
  }
  results.push("tattoos: " + (S.hand.tattoos?.length || 0) +
    (S.hand.tattoos?.length ? " · " + S.hand.tattoos.map((t) => t.design + " @" + t.u.toFixed(2) + "," + t.v.toFixed(2)).join(" ") : ""));
  results.push("hand bbox world: " + (box.isEmpty() ? "EMPTY" : "min " + box.min.toArray().map((n) => n.toFixed(0)).join(",") + " max " + box.max.toArray().map((n) => n.toFixed(0)).join(",")));
    const p = HAND.skinned.geometry.attributes.position;
    results.push("skinned verts: " + p.count + ", visible: " + HAND.skinned.visible + ", culling: " + HAND.skinned.frustumCulled);
    const ndc = box.getCenter(new THREE.Vector3()).project(camera);
    results.push("hand center ndc: " + ndc.toArray().map((n) => n.toFixed(2)).join(", "));
  } else results.push("hand NOT loaded");
  let meshCount = 0, ring = null;
  scene.traverse((o) => { if (o.isMesh) meshCount++; });
  for (const j of JEWELRY.values()) j.group.traverse((o) => { if (o.isMesh) ring = o; });
  results.push("meshes in scene: " + meshCount + ", ring mesh: " + !!ring + (ring ? ", ring parent type " + ring.parent.parent.type : ""));
  const png = await renderPng(400);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; });
  const cv = document.createElement("canvas"); cv.width = cv.height = 400;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, 400, 400).data;
  let backdropish = 0, dark = 0, other = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (r > 150 && g > 145 && b > 130) backdropish++;
    else if (r < 90 && g < 90 && b < 90) dark++;
    else other++;
  }
  results.push("pixels: backdropish " + backdropish + ", dark " + dark + ", other " + other);
  const div = document.createElement("div");
  div.id = "selftest";
  div.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:200;background:#111;color:#9fd99f;padding:12px;font:12px ui-monospace,monospace;white-space:pre;border:1px solid #4a4;";
  div.textContent = "studiogram audit\n" + results.join("\n");
  document.body.appendChild(div);
}

(async function boot() {
  resize();
  if (location.hash.includes("selftest")) {
    await runSelfTest();
    function animate() { requestAnimationFrame(animate); if (S.live.mode === "orbit") controls.update(); renderFrame(); }
    animate();
    return;
  }
  const restored = restoreFromStorage();
  if (restored) {
    await applyFullState(restored, { restoring: true });
  } else {
    buildHand();
    applyLighting();
    applyEnvironment();
    camera.position.set(...S.live.position);
    controls.target.set(...S.live.target);
    // a clean starting subject: the plain band on the ring finger, presented
    applyPosePreset("presenting");
    await addJewelryInstance(REGISTRY[0].release_id, "gold_14k_yellow");
  }
  await verifyRegistry();
  renderGateEntries();
  renderPanel("subject");
  if (location.hash.includes("audit")) setTimeout(runSceneAudit, 9000);
  renderCaptureStrip();
  updateVpOverlay();
  syncModeBadge();

  function animate() {
    requestAnimationFrame(animate);
    if (S.live.mode === "orbit") controls.update();
    renderFrame();
  }
  animate();
})();
