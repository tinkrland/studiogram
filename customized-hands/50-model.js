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
  bones: new Map(), bind: new Map(), boneLen: new Map(), fingerR: new Map(), poseBones: {},
  loaded: false, boneCount: 0,
  source: {
    title: "Rigged Hand", author: "DennisH2010",
    origin: "blendswap.com/blends/view/66039", license: "CC BY-SA 3.0"
  }
};

let HAND_LOAD = null; // in-flight promise: boot fires buildHand un-awaited and
// addJewelryInstance awaits it too — two concurrent entries used to both
// pass the loaded guard (it flips only after the async parse) and each
// created a hand root, leaking one visible ghost into the scene.
function loadHandModel() {
  if (HAND.loaded) return Promise.resolve();
  if (HAND_LOAD) return HAND_LOAD;
  const p = doLoadHandModel();
  HAND_LOAD = p;
  p.catch(() => { HAND_LOAD = null; }); // a failed load may be retried
  return p;
}
async function doLoadHandModel() {
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
  computeFingerRadii();
  HAND.loaded = true;
  HAND_LOAD = null;
  applyNails();
  applyFinish();
}
// per-finger skin radius at the seat height: eight inward rays cast around
// the bone, in bind pose, once at load. advisory fit hints read this; it is
// never a gate and never state.
function computeFingerRadii() {
  if (!HAND.skinned) return;
  scene.updateMatrixWorld(true);
  const rc = new THREE.Raycaster();
  rc.far = 0.03;
  const axis = new THREE.Vector3();
  const wp = new THREE.Vector3();
  const rd = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (const key of [...Object.keys(FINGER_BONES), "wrist"]) {
    const bone = key === "wrist" ? HAND.bones.get(bname("forearm.L")) : boneFor({ kind: "finger", finger: key });
    if (!bone) continue;
    const len = HAND.boneLen.get(key) || 0.045;
    wp.set(0, len * 0.55, 0); bone.localToWorld(wp);
    bone.getWorldQuaternion(q); axis.set(0, 1, 0).applyQuaternion(q);
    const hits = [];
    for (let k = 0; k < 8; k++) {
      rd.set(Math.cos(k * Math.PI / 4), 0, Math.sin(k * Math.PI / 4));
      rd.sub(axis.clone().multiplyScalar(rd.dot(axis)));
      if (rd.lengthSq() < 1e-9) continue;
      rd.normalize();
      const origin = wp.clone().addScaledVector(rd, 0.03);
      rc.set(origin, rd.clone().negate());
      const h = rc.intersectObject(HAND.skinned, false)[0];
      if (h) hits.push(0.03 - h.distance);
    }
    if (hits.length) {
      const rmm = (hits.reduce((a, b) => a + b, 0) / hits.length) * 1000;
      HAND.fingerR.set(key, Math.round(rmm * 10) / 10);
    }
  }
}
