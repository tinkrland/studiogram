// ===== part 05: the hand =====
// rigged hand model: "Rigged Hand" by DennisH2010, blendswap.com/blends/view/66039
// released under CC BY-SA 3.0 — credit renders in the subject panel.
// the model is a single embedded glb (skinned mesh + armature). pose presets
// are bone-local rotation deltas authored in blender and applied on top of
// the bind pose at runtime, so the hand poses like a doll and attached
// jewelry follows its bone automatically.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const HAND_GLB_B64 = "__HANDGLB__";
const POSE_PRESETS = /*__POSES__*/{};
const POSE_LABELS = { flat: "flat", presenting: "presenting", pointing: "pointing", fist: "fist", spread: "spread" };
const FINGER_BONES = {
  index: "finger_index", middle: "finger_middle", ring: "finger_ring",
  pinky: "finger_pinky", thumb: "thumb"
};

function bname(s) { return s.replace(/\./g, ""); }

const HAND = {
  root: null, model: null, skinned: null,
  bones: new Map(), bind: new Map(), boneLen: new Map(), poseBones: {},
  loaded: false, boneCount: 0,
  source: {
    title: "Rigged Hand", author: "DennisH2010",
    origin: "blendswap.com/blends/view/66039", license: "CC BY-SA 3.0"
  }
};

async function loadHandModel() {
  if (HAND.loaded) return;
  const bin = Uint8Array.from(atob(HAND_GLB_B64), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bin.buffer, "");
  const model = gltf.scene;
  model.traverse((o) => {
    if (o.isSkinnedMesh) {
      HAND.skinned = o;
      o.castShadow = true; o.receiveShadow = true;
      o.frustumCulled = false; // skinned meshes should never be bbox-culled mid-pose
    }
  });
  HAND.model = model;
  // every skinned mesh in the glb, for finish swaps (skin textures <-> porcelain)
  HAND.skinMeshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh) HAND.skinMeshes.push(o); });
  HAND.skinMaterials = HAND.skinMeshes.map((m) => m.material);
  HAND.baseMaps = new Map(HAND.skinMaterials.map((mat, i) => [i, mat.map]));
  // placement is a pure wrapper transform: the glb's bind pose is never
  // touched, so skinning stays consistent. mount stands the hand up
  // (wrist at the mount origin, fingers toward +z) in scene millimeters.
  HAND.root = new THREE.Group();
  HAND.root.name = "hand";
  HAND.root.position.set(0, 100, 0);
  const mount = new THREE.Group();
  mount.scale.setScalar(1000); // meters to millimeters
  mount.rotation.y = Math.PI / 2; // arm from -x to fingers toward +z
  mount.position.set(-162, -1445, -719); // wrist (gltf 0.162, 1.445, 0.719 m) to origin
  mount.add(model);
  HAND.root.add(mount);
  scene.add(HAND.root);
  // gltf loaders strip dots from node names ("finger_ring.01.L" loads as
  // "finger_ring01L"), so every lookup normalizes the same way.
  const bones = HAND.skinned.skeleton.bones;
  HAND.boneCount = bones.length;
  for (const b of bones) {
    HAND.bones.set(bname(b.name), b);
    HAND.bind.set(bname(b.name), b.quaternion.clone());
  }
  for (const [key, base] of Object.entries(FINGER_BONES)) {
    const b01 = HAND.bones.get(bname(base + ".01.L"));
    if (b01 && b01.children.length) HAND.boneLen.set(key, b01.children[0].position.y);
  }
  const fore = HAND.bones.get(bname("forearm.L"));
  if (fore && fore.children.length) HAND.boneLen.set("wrist", fore.children[0].position.y);
  // pose presets arrive with blender's dotted bone names; normalize once here
  for (const [poseName, deltas] of Object.entries(POSE_PRESETS)) {
    const norm = {};
    for (const [boneName, d] of Object.entries(deltas)) norm[bname(boneName)] = d;
    HAND.poseBones[poseName] = norm;
  }
  HAND.loaded = true;
  applyFinish();
}

// morphology: seven authored blend targets on the single base mesh drive
// every hand variation. presentation presets set weights; the sliders stack
// on top. there is no second hand asset and never a slider without a target.
function applyMorphs() {
  for (const m of (HAND.skinMeshes || [])) {
    const dict = m.morphTargetDictionary;
    if (!dict) continue;
    const inf = m.morphTargetInfluences;
    for (const name of Object.keys(dict)) inf[dict[name]] = 0;
    if (S.hand.presentation === "male hand") inf[dict["presentation_male"]] = 1;
    if (S.hand.presentation === "female hand") inf[dict["presentation_female"]] = 1;
    for (const [k, v] of Object.entries(S.hand.morph)) {
      if (dict[k] !== undefined) inf[dict[k]] = v;
    }
  }
}

// forearm follicle candidates exported from the base mesh's uv space.
// injected at build time from the mesh itself — no hand-picked region.
const HAIR_REGION = /*__HAIRPTS__*/[];

// nail-plate uv points per finger, exported the same way: the brightest
// texels of each distal phalanx, clustered. the plate is where polish goes.
const NAIL_REGION = /*__NAILPTS__*/{};

// surface layer: skin tone tints the base texture and body hair is drawn
// as follicle strokes into the composite, before any material assignment.
// one canvas rebuild serves both — the state is the truth, the texture is
// derived. hair candidates come from the forearm's uv region, so density
// stays anchored to the surface regardless of morph weights.
function skinToneColor(t) {
  // multiply tint from untouched (t=0) to a deep tone (t=1). multiply only
  // darkens and warms; the base skin texture keeps all its detail.
  const a = Math.min(1, Math.max(0, t));
  const c0 = [1.0, 1.0, 1.0];
  const c1 = [0.52, 0.36, 0.29];
  return c0.map((v, i) => v + (c1[i] - v) * a);
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function applySurface() {
  if (!HAND.skinMeshes || !HAND.skinMaterials) return;
  const tone = S.hand.skin?.tone ?? 0.4;
  const hair = S.hand.skin?.hair ?? 0.35;
  HAND.skinMaterials.forEach((mat, i) => {
    const base = mat.map;
    if (!base || !base.image) return;
    const size = 1024;
    let cv = HAND.surfaceCanvas?.get(i);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      if (!HAND.surfaceCanvas) HAND.surfaceCanvas = new Map();
      HAND.surfaceCanvas.set(i, cv);
      HAND.surfaceTexture = HAND.surfaceTexture || new Map();
      const tex = new THREE.CanvasTexture(cv);
      tex.flipY = false;               // gltf uv convention
      tex.colorSpace = THREE.SRGBColorSpace;
      HAND.surfaceTexture.set(i, tex);
    }
    const ctx = cv.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(base.image, 0, 0, size, size);
    // tone tint, multiply keeps the texture's shading structure
    if (tone > 0.001) {
      const c = skinToneColor(tone);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`;
      ctx.fillRect(0, 0, size, size);
    }
    // body hair: forearm follicle candidates, deterministic per index
    if (hair > 0.001 && Array.isArray(HAIR_REGION) && HAIR_REGION.length) {
      const rnd = mulberry32(0x5EED0001 + i);
      ctx.globalCompositeOperation = "source-over";
      const n = Math.round(HAIR_REGION.length * Math.min(1, hair));
      for (let k = 0; k < n; k++) {
        const [u, v] = HAIR_REGION[k];
        const x = u * size, y = v * size;
        const ang = rnd() * Math.PI;
        const len = 4 + rnd() * 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = `rgba(52, 34, 24, ${0.28 + rnd() * 0.3})`;
        ctx.lineWidth = 1.1 + rnd() * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    // nail appearance: polish tints the nail plates. painted into the
    // composite so it rides posing, morphs, and the finish swap like any
    // other surface detail — visible on the skin finish.
    const nails = S.hand.nails;
    if (nails?.style === "polished" && NAIL_REGION && Object.keys(NAIL_REGION).length) {
      ctx.globalCompositeOperation = "source-over";
      const col = nails.color || "#b23a48";
      // one soft ellipse per nail plate: center, radii and angle come from
      // the plate points, so the tint stays inside the plate, not on skin.
      for (const plate of Object.values(NAIL_REGION)) {
        const [cu, cv] = plate.c;
        const [ru, rv] = plate.r;
        ctx.save();
        ctx.translate(cu * size, cv * size);
        ctx.rotate(plate.a || 0);
        ctx.scale(Math.max(ru, 1e-4) * size, Math.max(rv, 1e-4) * size);
        const g = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
        g.addColorStop(0, hexA(col, 0.78));
        g.addColorStop(0.72, hexA(col, 0.55));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    paintTattoos(ctx, size);
    const tex = HAND.surfaceTexture.get(i);
    tex.needsUpdate = true;
    if (S.hand.finish === "skin" && mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
  });
  if (S.hand.finish !== "skin") restoreBaseMaps();
}
function restoreBaseMaps() {
  HAND.skinMaterials?.forEach((mat, i) => {
    const base = HAND.baseMaps?.get(i);
    if (base && mat.map !== base) { mat.map = base; mat.needsUpdate = true; }
  });
}

// --- tattoos: sleeve-on interaction, atlas-painted commit. the ghost
// follows the surface under the cursor exactly like a sticker preview, but
// the commit paints into the hand's texture, so the ink is a material
// property: it rides posing, morphs, and skin-tone compositing for free.
// geometry decals cannot do that on a skinned, morphable mesh.
const TATTOO = { active: false, design: "star", size: 0.06, rot: 0 };
const DESIGN_ORDER = ["star", "heart", "anchor", "bolt"];
const DESIGN_CANVAS = new Map();
function designCanvas(kind) {
  if (DESIGN_CANVAS.has(kind)) return DESIGN_CANVAS.get(kind);
  const px = 256;
  const cv = document.createElement("canvas");
  cv.width = px; cv.height = px;
  const c = cv.getContext("2d");
  c.translate(px / 2, px / 2);
  c.scale(px / 2 - 14, px / 2 - 14);   // draw in [-1, 1]
  c.strokeStyle = "#221a13";
  c.lineWidth = 0.075;
  c.lineCap = "round"; c.lineJoin = "round";
  c.fillStyle = "rgba(34, 26, 19, 0.16)";
  const poly = (pts, close) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    if (close) c.closePath();
    c.stroke();
    if (close) c.fill();
  };
  if (kind === "star") {
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      pts.push([Math.cos(a), Math.sin(a)]);
      const b = a + Math.PI / 5;
      pts.push([0.42 * Math.cos(b), 0.42 * Math.sin(b)]);
    }
    poly(pts, true);
  } else if (kind === "heart") {
    c.beginPath();
    c.moveTo(0, 0.85);
    c.bezierCurveTo(-1.25, 0.1, -0.7, -0.95, 0, -0.35);
    c.bezierCurveTo(0.7, -0.95, 1.25, 0.1, 0, 0.85);
    c.stroke(); c.fill();
  } else if (kind === "anchor") {
    c.beginPath(); c.arc(0, -0.72, 0.2, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0, -0.52); c.lineTo(0, 0.68); c.stroke();
    c.beginPath(); c.moveTo(-0.62, 0.1); c.lineTo(0.62, 0.1); c.stroke();
    c.beginPath(); c.moveTo(-0.92, 0.05);
    c.quadraticCurveTo(0, 1.0, 0.92, 0.05); c.stroke();
    c.beginPath(); c.moveTo(0, 0.68);
    c.quadraticCurveTo(-0.38, 0.52, -0.92, 0.05); c.stroke();
    c.beginPath(); c.moveTo(0, 0.68);
    c.quadraticCurveTo(0.38, 0.52, 0.92, 0.05); c.stroke();
  } else if (kind === "bolt") {
    poly([[0.18, -1], [-0.5, 0.05], [-0.04, 0.05], [-0.18, 1], [0.5, -0.05], [0.04, -0.05]], true);
  }
  DESIGN_CANVAS.set(kind, cv);
  return cv;
}
for (const k of DESIGN_ORDER) designCanvas(k);

function paintTattoos(ctx, size) {
  const list = (S.hand.tattoos || []).slice();
  if (HAND.tattooGhost) list.push(HAND.tattooGhost);
  for (const t of list) {
    const dcv = designCanvas(t.design);
    const w = t.w * size;
    const h = w * (dcv.height / dcv.width);
    ctx.save();
    ctx.translate(t.u * size, t.v * size);
    ctx.rotate(t.rot || 0);
    ctx.globalAlpha = t.ghost ? 0.5 : 0.92;
    ctx.drawImage(dcv, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

const tattooRay = new THREE.Raycaster();
function tattooNdc(ev) {
  const r = renderer.domElement.getBoundingClientRect();
  // a positionless activation (synthetic click, keyboard Enter on a
  // focused canvas) reports client (0,0), which is never a point on the
  // canvas itself. treat it as the view center so the flow stays
  // operable without a positioned pointer.
  const cx = (ev.clientX === 0 && ev.clientY === 0) ? r.left + r.width / 2 : ev.clientX;
  const cy = (ev.clientX === 0 && ev.clientY === 0) ? r.top + r.height / 2 : ev.clientY;
  return {
    x: ((cx - r.left) / r.width) * 2 - 1,
    y: -((cy - r.top) / r.height) * 2 + 1,
  };
}
function setTattooMode(on) {
  TATTOO.active = on;
  HAND.tattooGhost = null;
  controls.enabled = !on && S.live.mode === "orbit";
  renderer.domElement.style.cursor = on ? "crosshair" : "";
  if (S.hand.finish !== "skin" && on) toast("tattoos paint into the skin finish — switch finish to see the ink");
  applySurface();
  if (currentTab === "subject") renderPanel("subject");
  saveState();
}
renderer.domElement.addEventListener("pointermove", (ev) => {
  if (!TATTOO.active || !HAND.loaded) return;
  const nd = tattooNdc(ev);
  tattooRay.setFromCamera(new THREE.Vector2(nd.x, nd.y), camera);
  const hit = tattooRay.intersectObject(HAND.skinned, false)[0];
  HAND.tattooGhost = hit && hit.uv
    ? { design: TATTOO.design, u: hit.uv.x, v: hit.uv.y, w: TATTOO.size, rot: TATTOO.rot, ghost: true }
    : null;
  applySurface();
});
// commit on click, not pointerdown: pointerdown would fire mid-drag on
// touch, and synthetic clicks (keyboard, automation) never raise it.
// touch-drag to position, release to commit.
renderer.domElement.addEventListener("click", (ev) => {
  if (!TATTOO.active) return;
  if (!HAND.tattooGhost) {
    // a click can arrive without a prior hover (touch, or a page that
    // never saw a move): raycast fresh at the click point and place there.
    const nd = tattooNdc(ev);
    tattooRay.setFromCamera(new THREE.Vector2(nd.x, nd.y), camera);
    const hit = tattooRay.intersectObject(HAND.skinned, false)[0];
    if (!hit || !hit.uv) return;
    HAND.tattooGhost = { design: TATTOO.design, u: hit.uv.x, v: hit.uv.y, w: TATTOO.size, rot: TATTOO.rot, ghost: true };
  }
  const g = HAND.tattooGhost;
  S.hand.tattoos.push({
    id: "t" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
    design: g.design, u: g.u, v: g.v, w: g.w, rot: g.rot,
  });
  HAND.tattooGhost = null;
  applySurface();
  if (currentTab === "subject") renderPanel("subject");
  saveState();
  toast("tattoo committed to the skin");
});
window.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && TATTOO.active) setTattooMode(false);
});

// subject finish: the hand presents as a porcelain display hand by default,
// or with its original skin textures. jewelry photography favors the quiet
// matte doll — the piece is the subject, the hand is the stand.
function applyFinish() {
  if (!HAND.skinMeshes) return;
  if (S.hand.finish === "porcelain") {
    if (!HAND.dollMaterial) {
      HAND.dollMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.937, 0.902, 0.851), // warm ivory, slightly paler than skin
        roughness: 0.62, metalness: 0
      });
    }
    for (const m of HAND.skinMeshes) m.material = HAND.dollMaterial;
  } else {
    for (const [i, m] of HAND.skinMeshes.entries()) m.material = HAND.skinMaterials[i];
    applySurface();
  }
}

// where a piece of jewelry sits: the proximal phalanx bone of the chosen
// finger, or the forearm bone for wrist pieces. bones point along local +y,
// the same axis as the lathe hole, so artifacts need only a position offset.
function boneFor(location) {
  if (location.kind === "wrist") return HAND.bones.get(bname("forearm.L")) || null;
  const base = FINGER_BONES[location.finger];
  return base ? HAND.bones.get(bname(base + ".01.L")) || null : null;
}

const _eu = new THREE.Euler(0, 0, 0, "XYZ");
const _dq = new THREE.Quaternion();

function applyPose() {
  if (!HAND.loaded) return;
  const preset = HAND.poseBones[S.pose.preset] || {};
  for (const [name, bone] of HAND.bones) {
    const bind = HAND.bind.get(name);
    bone.quaternion.copy(bind);
    const d = preset[name];
    if (d) bone.quaternion.multiply(_dq.setFromEuler(_eu.set(d[0], d[1], d[2])));
  }
  // slider extras stack on top of the preset, in bone-local space
  for (const fname of ["index", "middle", "ring", "pinky"]) {
    const f = S.pose.fingers[fname];
    const base = FINGER_BONES[fname];
    if (f.curl) {
      for (const seg of ["01", "02", "03"]) {
        const b = HAND.bones.get(bname(base + "." + seg + ".L"));
        if (b) b.quaternion.multiply(_dq.setFromEuler(_eu.set(f.curl * (seg === "03" ? 0.4 : 0.7), 0, 0)));
      }
    }
    if (f.spread) {
      const b = HAND.bones.get(bname(base + ".01.L"));
      if (b) b.quaternion.multiply(_dq.setFromEuler(_eu.set(0, 0, f.spread * 0.3)));
    }
  }
  const t = S.pose.thumb;
  const tb = HAND.bones.get(bname("thumb.01.L"));
  if (tb) tb.quaternion.multiply(_dq.setFromEuler(_eu.set(t.curl * 0.45, 0, -t.opposition * 0.55)));
  for (const seg of ["02", "03"]) {
    const b = HAND.bones.get(bname("thumb." + seg + ".L"));
    if (b) b.quaternion.multiply(_dq.setFromEuler(_eu.set(t.curl * 0.4, 0, 0)));
  }
  // wrist framing pivots the whole hand around its wrist (the root origin)
  if (HAND.root) HAND.root.rotation.set(S.pose.wrist.pitch * DEG, S.pose.wrist.yaw * DEG, S.pose.wrist.roll * DEG);
}

function applyPosePreset(key) {
  if (!POSE_PRESETS[key]) return;
  S.pose.preset = key;
  S.pose.fingers = {
    index: { curl: 0, spread: 0 }, middle: { curl: 0, spread: 0 },
    ring: { curl: 0, spread: 0 }, pinky: { curl: 0, spread: 0 }
  };
  S.pose.thumb = { curl: 0, opposition: 0 };
  applyPose();
}

async function buildHand() {
  await loadHandModel();
  applyFinish();
  applyMorphs();
  applyPose();
  reattachJewelry();
}

function disposeHand() {
  // the rigged model loads once and is never rebuilt; pose changes are
  // bone rotations, not geometry changes.
}
