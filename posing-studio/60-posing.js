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

