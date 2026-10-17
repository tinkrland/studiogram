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
    // the compiled mesh is fetched and its bytes hashed: the record's claim
    // must survive the recompute, same rule as the spec hash
    let meshFileOk = true;
    if (rec.assets.mesh_glb_sha256) {
      try {
        const buf = await (await fetch(rec.assets.mesh_glb_uri)).arrayBuffer();
        meshFileOk = await sha256bytes(buf) === rec.assets.mesh_glb_sha256;
      } catch (e) { meshFileOk = false; }
    }
    const meshOk = meshHash === rec.assets.mesh_sha256 && meshFileOk;
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
async function gateRelease(releaseId, version, declaredMeshHash, declaredMeshFileHash) {
  const rec = byRelease.get(releaseId);
  if (!rec) return { ok: false, reason: "unknown release id" };
  if (rec.version !== version) return { ok: false, reason: "version mismatch" };
  const meshHash = await sha256hex(rec.parameters.mesh_spec);
  let verified = meshHash === rec.assets.mesh_sha256 && meshHash === declaredMeshHash;
  let reason = verified ? null : "mesh hash mismatch";
  // a record with a compiled mesh must render that mesh: fetch it, hash the
  // bytes, and require the scene's reference to carry the same file hash.
  if (verified && rec.assets.mesh_glb_sha256) {
    try {
      const buf = await (await fetch(rec.assets.mesh_glb_uri)).arrayBuffer();
      const fileHash = await sha256bytes(buf);
      if (fileHash !== rec.assets.mesh_glb_sha256) { verified = false; reason = "mesh file hash mismatch"; }
      else if (declaredMeshFileHash !== fileHash) { verified = false; reason = "stale mesh file reference"; }
    } catch (e) { verified = false; reason = "mesh file unavailable"; }
  }
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
    skin: { preset: "golden", lightness: 0, warmth: 0, depth: 0, hair: 0.35 }, // surface layer: a preset albedo plus three adjustments; hair is drawn follicles on the forearm
    nails: { style: "natural", color: "#b23a48" }, // surface layer: polish tints the nail plates in the atlas
    tattoos: [], // painted into the texture atlas: { id, design, u, v, w, rot } — material, not geometry
    credit: "Rigged Hand by DennisH2010 (blendswap 66039), CC BY-SA 3.0"
  };
}
function defaultBust() {
  return {
    tone: { preset: "golden", lightness: 0, warmth: 0, depth: 0 },
    ear: {
      lobe: { piece: "stud", metal: "gold_14k_yellow", metalBead: false },
      helix: { piece: "none", metal: "gold_14k_yellow" },
      tragus: { piece: "none", metal: "gold_14k_yellow" },
      conch: { piece: "none", metal: "gold_14k_yellow" },
      mirror_left: true
    },
    necklace: { style: "princess", length_cm: 46, metal: "gold_14k_yellow", pendant: true },
    nose: {
      nostril: { piece: "none", metal: "gold_14k_yellow" },
      nostril_l: { piece: "none", metal: "gold_14k_yellow" },
      septum: { piece: "none", metal: "silver_925" }
    }
  };
}
function migrateBust(b) {
  const d = defaultBust();
  if (!b || typeof b !== "object") return d;
  const out = {
    tone: { ...d.tone, ...(b.tone || {}), preset: SKIN_PRESETS.some((x) => x.key === (b.tone || {}).preset) ? b.tone.preset : "golden" },
    ear: { ...d.ear },
    necklace: { ...d.necklace, ...(b.necklace || {}) }
  };
  for (const site of ["lobe", "helix", "tragus", "conch"]) {
    const src = (b.ear || {})[site] || {};
    out.ear[site] = { ...d.ear[site], ...src };
    if (!EAR_PIECE_VALUES.includes(out.ear[site].piece)) out.ear[site].piece = "none";
    if (!METALS[out.ear[site].metal]) out.ear[site].metal = "gold_14k_yellow";
  }
  if (!METALS[out.necklace.metal]) out.necklace.metal = "gold_14k_yellow";
  if (typeof out.ear.mirror_left !== "boolean") out.ear.mirror_left = true;
  out.nose = { ...d.nose };
  for (const site of ["nostril", "nostril_l", "septum"]) {
    const src = (b.nose || {})[site] || {};
    out.nose[site] = { ...d.nose[site], ...src };
    const allowed = site === "septum" ? ["none", "hoop"] : ["none", "stud", "hoop"];
    if (!allowed.includes(out.nose[site].piece)) out.nose[site].piece = "none";
    if (!METALS[out.nose[site].metal]) out.nose[site].metal = d.nose[site].metal;
  }
  if (typeof out.necklace.length_cm !== "number" || out.necklace.length_cm < 30 || out.necklace.length_cm > 65) out.necklace.length_cm = 46;
  if (!["none", "choker", "princess", "custom"].includes(out.necklace.style)) out.necklace.style = "princess";
  return out;
}
function defaultPose() {
  return {
    preset: "presenting",
    fingers: { index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 }, ring: { curl: 0, spread: 0 }, pinky: { curl: 0, spread: 0 } },
    thumb: { curl: 0, opposition: 0 },
    wrist: { pitch: 0, yaw: 0, roll: 0 }
  };
}
const BACKDROPS = {
  paper: { bg: "#b8b5ad", center: "#f4f1ea" },
  warm_gray: { bg: "#8f887c", center: "#cfc8bd" },
  charcoal: { bg: "#1b1c20", center: "#3d4046" },
  blush: { bg: "#c9a49c", center: "#eed4cd" },
  sage: { bg: "#9aa793", center: "#d2dacb" },
  midnight: { bg: "#0d0e15", center: "#23273a" }
};

function defaultState() {
  return {
    schema: "studiogram-scene-state", state_version: 2,
    subject: "hand", // which subject is on stage: hand | bust
    hand: defaultHand(),
    bust: defaultBust(),
    pose: defaultPose(),
    moves: [],    // take choreography: ordered finger moves played during a take
    jewelry: [],
  props: [],
    lighting: defaultLights(),
    environment: { ...BACKDROPS.warm_gray, preset: "warm_gray" }, // bg/center are the values that render; a preset is a prefill, not a path
    live: { mode: "orbit", position: [140, 260, 460], target: [-15, 100, 40], fov: 26, focallength: 50, focaldistance: 475 },
    cameras: [],
    photos: [],          // the photo collection: immutable records of taken frames
    recordings: [],      // orbit video records: per-frame camera path plus snapshot
    sets: [{ id: "set1", name: "shoot 1", photo_ids: [] }],
    active_set: "set1",
  };
}
let S = defaultState();

const EAR_PIECE_VALUES = ["none", "stud", "hoop", "labret"];
const METALS = {
  silver_925: { label: "silver 925", color: 0xe6e6ec, rough: 0.13 },
  gold_14k_yellow: { label: "gold 14k", color: 0xe9b95c, rough: 0.17 },
  gold_14k_rose: { label: "rose gold 14k", color: 0xe2a88c, rough: 0.17 },
  bronze_cu: { label: "bronze", color: 0xc98d5f, rough: 0.28 }
};
function saveState() {
  clearTimeout(saveState._t);
  saveState._t = setTimeout(() => {
    try { localStorage.setItem("studiogram_state", JSON.stringify(serializeState(true))); } catch (e) { /* storage full: keep captures lean */ }
  }, 350);
}
// orbiting fires change events every frame, so the 350ms debounce coalesces
// them into a save-on-quiet. that means a tab closed mid-motion would lose
// its last move — flush synchronously on unload to close that window.
window.addEventListener("beforeunload", () => {
  clearTimeout(saveState._t);
  try { localStorage.setItem("studiogram_state", JSON.stringify(serializeState(true))); } catch (e) {}
});
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
  S.hand.skin = migrateSkin(h.skin);
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
  const photos = S.photos.map((c) => {
    const o = { id: c.id, name: c.name, camera: c.camera, created_utc: c.created_utc, state_hash: c.state_hash, snapshot: c.snapshot, gate: c.gate || [], width: c.width, height: c.height };
    if (withThumbs && CAPTURE_THUMBS.get(c.id)) o.thumb = CAPTURE_THUMBS.get(c.id);
    return o;
  });
  return { ...S, captures: undefined, photos };
}

