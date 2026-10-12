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
