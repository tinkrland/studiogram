// ===== registry verification (the ingestion gate) =====
const REGISTRY = /*__FIXTURES__*/[];
const byRelease = new Map(REGISTRY.map((r) => [r.release_id, r]));

const GATE = { entries: [], ok: 0, bad: 0 };

async function verifyRegistry() {
  const badge = $("#gatebadge");
  let prev = null;
  let allOk = true;
  for (const rec of REGISTRY) {
    const meshHash = await sha256hex(rec.parameters.mesh_spec);
    const recordCopy = { ...rec }; delete recordCopy.record_hash; delete recordCopy.prev_hash;
    const recordHash = await sha256hex(recordCopy);
    const meshOk = meshHash === rec.assets.mesh_sha256;
    const recordOk = recordHash === rec.record_hash;
    const chainOk = rec.prev_hash === null ? prev === null : prev === rec.prev_hash;
    prev = rec.record_hash;
    const ok = meshOk && recordOk && chainOk;
    if (ok) GATE.ok++; else { GATE.bad++; allOk = false; }
    GATE.entries.push({ utc: nowUtc(), release: rec.name, version: rec.version, mesh_sha256: rec.assets.mesh_sha256, verified: ok });
  }
  badge.textContent = allOk
    ? `provenance gate: ${GATE.ok} releases verified`
    : `provenance gate: ${GATE.bad} failed`;
  badge.style.color = allOk ? "var(--good)" : "var(--bad)";
  return allOk;
}

// a release enters a scene by reference only: id, version, asset hash.
// nothing flows back, and no scene value ever modifies the record.
async function gateRelease(releaseId, version, declaredMeshHash) {
  const rec = byRelease.get(releaseId);
  if (!rec) return { ok: false, reason: "unknown release id" };
  if (rec.version !== version) return { ok: false, reason: "version mismatch" };
  const meshHash = await sha256hex(rec.parameters.mesh_spec);
  const verified = meshHash === rec.assets.mesh_sha256 && meshHash === declaredMeshHash;
  const entry = { utc: nowUtc(), release: rec.name, version, mesh_sha256: meshHash, verified };
  GATE.entries.push(entry);
  if (verified) GATE.ok++; else GATE.bad++;
  const badge = $("#gatebadge");
  badge.textContent = `provenance gate: ${GATE.ok} verified${GATE.bad ? `, ${GATE.bad} failed` : ""}`;
  badge.style.color = GATE.bad ? "var(--bad)" : "var(--good)";
  renderGateEntries();
  return { ok: verified, record: rec, reason: verified ? null : "mesh hash mismatch" };
}

// ===== scene state: quantitative values only =====
const FINGERS = ["index", "middle", "ring", "pinky", "thumb"];

function defaultHand() {
  return {
    model: "rigged-hand-v4.1",
    finish: "porcelain",
    presentation: "hand", // hand | male hand | female hand — blend weights, not files
    morph: { build: 0, finger_length: 0, finger_thickness: 0, palm_width: 0, palm_proportions: 0, nail_length: 0, nail_shape: 0 },
    skin: { tone: 0.4, hair: 0.35 }, // surface layer: tone tints the texture, hair is drawn follicles on the forearm
    nails: { style: "natural", color: "#b23a48" }, // surface layer: polish tints the nail plates in the atlas
    tattoos: [], // painted into the texture atlas: { id, design, u, v, w, rot } — material, not geometry
    credit: "Rigged Hand by DennisH2010 (blendswap 66039), CC BY-SA 3.0"
  };
}
function defaultPose() {
  return {
    preset: "presenting",
    fingers: { index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0, spread: 0 } },
    thumb: { curl: 0, opposition: 0 },
    wrist: { pitch: 0, yaw: 0, roll: 0 }
  };
}
function defaultLights() {
  return {
    recipe: "soft_studio", ambience: "bright",
    key: { on: true, color: "#fff4e6", intensity: 3.0, azimuth: 40, elevation: 55 },
    fill: { on: true, color: "#d6e8ff", intensity: 1.1, azimuth: -55, elevation: 20 },
    rim: { on: true, color: "#ffffff", intensity: 2.0, azimuth: 165, elevation: 45 }
  };
}
function defaultState() {
  return {
    schema: "studiogram-scene-state", state_version: 1,
    hand: defaultHand(),
    pose: defaultPose(),
    jewelry: [],
    lighting: defaultLights(),
    environment: { backdrop: "warm_gray" },
    live: { mode: "orbit", position: [140, 260, 460], target: [-15, 100, 40], fov: 26, focallength: 50, focaldistance: 475 },
    cameras: [],
    captures: [],
  };
}
let S = defaultState();

const METALS = {
  silver_925: { label: "silver 925", color: 0xe6e6ec, rough: 0.13 },
  gold_14k_yellow: { label: "gold 14k", color: 0xe9b95c, rough: 0.17 },
  gold_14k_rose: { label: "rose gold 14k", color: 0xe2a88c, rough: 0.17 },
  bronze_cu: { label: "bronze", color: 0xc98d5f, rough: 0.28 }
};
const AMBIENCE = { bright: 0.95, dim: 0.45, dark: 0.16 };
const BACKDROPS = {
  paper: { bg: "#b8b5ad", center: "#f4f1ea" },
  warm_gray: { bg: "#8f887c", center: "#cfc8bd" },
  charcoal: { bg: "#1b1c20", center: "#3d4046" },
  blush: { bg: "#c9a49c", center: "#eed4cd" },
  sage: { bg: "#9aa793", center: "#d2dacb" },
  midnight: { bg: "#0d0e15", center: "#23273a" }
};
const LIGHT_RECIPES = {
  soft_studio: {
    label: "soft studio",
    ambience: "bright",
    key: { on: true, color: "#fff4e6", intensity: 3.0, azimuth: 40, elevation: 55 },
    fill: { on: true, color: "#d6e8ff", intensity: 1.1, azimuth: -55, elevation: 20 },
    rim: { on: true, color: "#ffffff", intensity: 2.0, azimuth: 165, elevation: 45 }
  },
  bright_commercial: {
    label: "bright commercial",
    ambience: "bright",
    key: { on: true, color: "#ffffff", intensity: 4.6, azimuth: 25, elevation: 60 },
    fill: { on: true, color: "#eef4ff", intensity: 2.0, azimuth: -45, elevation: 30 },
    rim: { on: true, color: "#ffffff", intensity: 1.2, azimuth: 170, elevation: 50 }
  },
  dramatic_rim: {
    label: "dramatic rim",
    ambience: "dark",
    key: { on: true, color: "#ffe9d2", intensity: 1.3, azimuth: 55, elevation: 35 },
    fill: { on: true, color: "#aac4e8", intensity: 0.25, azimuth: -60, elevation: 15 },
    rim: { on: true, color: "#ffffff", intensity: 4.4, azimuth: 160, elevation: 30 }
  },
  warm_gold: {
    label: "warm gold",
    ambience: "dim",
    key: { on: true, color: "#ffd9a0", intensity: 3.3, azimuth: 35, elevation: 50 },
    fill: { on: true, color: "#ffe9d0", intensity: 0.8, azimuth: -50, elevation: 25 },
    rim: { on: true, color: "#fff3e0", intensity: 2.4, azimuth: 150, elevation: 55 }
  }
};
function saveState() {
  clearTimeout(saveState._t);
  saveState._t = setTimeout(() => {
    try { localStorage.setItem("studiogram_state", JSON.stringify(serializeState(true))); } catch (e) { /* storage full: keep captures lean */ }
  }, 350);
}
// ===== saved hand configurations: a creator asset, not scene state =====
// a saved hand keeps the complete shape-plus-surface set: presentation,
// build morphs, finish, tone, hair, and painted tattoos. pose and jewelry
// are deliberately excluded — those are per-shoot choices. the library
// persists beside the scene state, outside it, so an exported scene stays
// quantitative scene values only (invariant 5).
let SAVED_HANDS = [];
try { SAVED_HANDS = JSON.parse(localStorage.getItem("studiogram_saved_hands")) || []; } catch (e) { SAVED_HANDS = []; }
function storeSavedHands() {
  try { localStorage.setItem("studiogram_saved_hands", JSON.stringify(SAVED_HANDS)); } catch (e) { /* storage full */ }
}
function snapshotHand() {
  return JSON.parse(JSON.stringify({
    presentation: S.hand.presentation,
    morph: S.hand.morph,
    finish: S.hand.finish,
    skin: S.hand.skin,
    nails: S.hand.nails,
    tattoos: S.hand.tattoos,
  }));
}
function saveCurrentHand(name) {
  const cfg = {
    id: "hand_" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    name: (name || "").trim() || ("hand " + (SAVED_HANDS.length + 1)),
    created_utc: nowUtc(),
    hand: snapshotHand(),
  };
  SAVED_HANDS.unshift(cfg);
  storeSavedHands();
  return cfg;
}
function applySavedHand(cfg) {
  if (!cfg || !cfg.hand) return;
  const h = JSON.parse(JSON.stringify(cfg.hand));
  S.hand.presentation = h.presentation || "hand";
  S.hand.morph = h.morph || defaultHand().morph;
  S.hand.finish = h.finish || "porcelain";
  S.hand.skin = h.skin || defaultHand().skin;
  S.hand.nails = h.nails || defaultHand().nails;
  S.hand.tattoos = h.tattoos || [];
  applyFinish(); // routes the surface composite and painted tattoos for the skin finish
  applyMorphs(); // presentation preset weights plus the stacked build sliders
  saveState();
}
function deleteSavedHand(cfg) {
  const i = SAVED_HANDS.indexOf(cfg);
  if (i >= 0) { SAVED_HANDS.splice(i, 1); storeSavedHands(); }
}

// captures keep a thumbnail in saved state; full png frames live in memory only.
function serializeState(withThumbs) {
  const caps = S.captures.map((c) => {
    const o = { id: c.id, name: c.name, camera: c.camera, created_utc: c.created_utc, state_hash: c.state_hash, snapshot: c.snapshot };
    if (withThumbs && CAPTURE_THUMBS[c.id]) o.thumb = CAPTURE_THUMBS[c.id];
    return o;
  });
  return { ...S, captures: caps };
}

