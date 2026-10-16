// ===== bust model: the v2 subject =====
// "head sculpt - female", cc0 (owner-confirmed 2026-10-14; provenance in
// assets/bust-provenance.md). the hand embeds its glb inline, but the bust
// is 11.8 mb and the artifact stays lean, so it loads the same way gate
// releases load: fetch the published file, verify its sha256 against the
// (GLTFLoader arrives in module scope from the hand's model part)
// recorded hash, then parse. nothing unverified ever renders.
const BUST_URL = "https://base44.app/api/apps/6accc46c95021cc17a0bd7da/files/mp/public/6accc46c95021cc17a0bd7da/b2b8cd40d_bust.glb";
const BUST_SHA256 = "c1b08f12fa3e2f6702a6fa70cba1d5b6e304c5309f8aab30a2d1be92d450e70f";
const BUST_MM_PER_UNIT = 105; // chin-to-crown 2.15u reads as 225mm at this scale
const BUST_U = (mm) => mm / BUST_MM_PER_UNIT; // millimeters -> glb units

const BUST = {
  root: null, model: null, mesh: null, material: null,
  loaded: false, loadError: null,
  source: {
    title: "head sculpt - female", author: "owner-supplied",
    origin: "see assets/bust-provenance.md", license: "cc0"
  }
};

async function sha256hexOf(buf) {
  return [...new Uint8Array(await crypto.subtle.digest("sha-256", buf))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadBustModel() {
  if (BUST.loaded || BUST.loadError) return;
  const res = await fetch(BUST_URL, { cache: "force-cache" });
  if (!res.ok) { BUST.loadError = "fetch failed: " + res.status; return; }
  const buf = await res.arrayBuffer();
  const hash = await sha256hexOf(buf);
  if (hash !== BUST_SHA256) { BUST.loadError = "sha256 mismatch: " + hash.slice(0, 12); return; }
  const gltf = await new GLTFLoader().parseAsync(buf, "");
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isMesh) {
      BUST.mesh = o;
      // one clay material, one tone: the subject tone system tints it whole
      BUST.material = new THREE.MeshPhysicalMaterial({
        color: 0xd49d79, roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6
      });
      o.material = BUST.material;
      o.castShadow = true; o.receiveShadow = true;
    }
  });
  if (!BUST.mesh) { BUST.loadError = "no mesh in glb"; return; }
  BUST.model = model;
  // placement mirrors the hand's: a pure wrapper transform, glb units ->
  // scene millimeters, bounding-box center at the root origin.
  BUST.root = new THREE.Group();
  BUST.root.name = "bust";
  BUST.root.position.set(0, 95, 0);
  BUST.root.visible = false; // the hand stays the default subject
  const mount = new THREE.Group();
  mount.scale.setScalar(BUST_MM_PER_UNIT);
  mount.position.set(0, -1.86, 0.06); // bbox center (0, 1.86, -0.06) to origin
  mount.add(model);
  BUST.root.add(mount);
  scene.add(BUST.root);
  // seat and chain groups live inside the model so anchors apply in glb
  // space directly, the way nail plates ride their bones
  BUST.seatGroup = new THREE.Group(); model.add(BUST.seatGroup);
  BUST.chainGroup = new THREE.Group(); model.add(BUST.chainGroup);
  BUST.loaded = true;
}

// the bust shares the hand's tone system: the same nine swatch presets and
// the same lightness/warmth/depth math, applied to the single clay material.
// one person renders one tone across both subjects.
function bustAlbedoHex(tone) {
  const sk = tone || S.bust.tone;
  const base = hexToRgb01(skinPreset(sk.preset).hex).map(srgbToLin);
  const L = sk.lightness || 0, W = sk.warmth || 0, D = sk.depth || 0;
  let c = base.map((v) => v * Math.pow(2, L * 0.9));
  const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  c = c.map((v) => lum + (v - lum) * (1 + D * 0.7));
  c = [c[0] * (1 + W * 0.10), c[1] * (1 + W * 0.02), c[2] * (1 - W * 0.14)];
  const s = c.map((v) => Math.round(Math.min(1, Math.max(0, linToSrgb(v))) * 255));
  return "#" + s.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function applyBustTone() {
  if (!BUST.loaded) return;
  BUST.material.color.set(bustAlbedoHex());
}

// subject switching: one subject renders at a time; hand-specific panels
// grey out while the bust is on stage. camera framing follows the subject.
function bustFraming() {
  return { position: [150, 330, 480], target: [0, 230, 10] };
}
async function setSubject(kind) {
  if (kind !== "hand" && kind !== "bust") return;
  if (kind === "bust" && !BUST.loaded && !BUST.loadError) {
    await loadBustModel();
    if (BUST.loaded) { applyBustTone(); buildEarSeats(); buildNecklace(); }
  }
  S.subject = kind;
  if (BUST.loaded) BUST.root.visible = kind === "bust";
  if (HAND.root) HAND.root.visible = kind === "hand";
  if (kind === "bust") {
    S.live = { ...S.live, position: bustFraming().position, target: bustFraming().target };
    camera.position.set(...S.live.position);
    controls.target.set(...S.live.target);
  }
  updateSubjectTabs();
  renderPanel(currentTab);
  saveState();
}
function subjectIsBust() { return S.subject === "bust"; }

function updateSubjectTabs() {
  const bust = subjectIsBust();
  document.querySelectorAll("#tabs button").forEach((b) => {
    if (b.dataset.tab === "pose" || b.dataset.tab === "jewelry") {
      b.disabled = bust;
      b.style.opacity = bust ? 0.35 : 1;
    }
  });
}
