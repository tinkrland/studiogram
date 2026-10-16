// ===== pierced seats: ears, nostrils, septum =====
// EAR_FRAME and NOSE_FRAME are authored from the sculpt's own anatomy
// (bust/ear-frame.json, bust/nose-frame.json): each site carries pos (surface
// point), out (outward normal) and back (the far side of the channel). a
// piece threads the two points and occlusion does the "through the tissue"
// work — no booleans. the right ear and right nostril are authored; the left
// side is a pure mirror, and the panel can turn that mirroring off.
const EAR_FRAME = /*__EARFRAME__*/{};
const NOSE_FRAME = /*__NOSEFRAME__*/{};
const EAR_SITES = ["lobe", "helix", "tragus", "conch"];
const EAR_PIECES = ["none", "stud", "hoop", "labret"];
const NOSE_PIECES = { nostril: ["none", "stud", "hoop"], septum: ["none", "hoop"] };

// per-region sizes in millimeters: the ear's stud is a lobe stud, the
// nostril's is a tiny nose pin, the septum ring hangs under the columella
const SEAT_SIZES = {
  ear:    { gem: 2.2, bead: 1.3, post: 0.6, disc: 2.2, hoop: 8.0, tube: 0.6 },
  nostril:{ gem: 1.6, bead: 1.0, post: 0.5, disc: 1.8, hoop: 3.2, tube: 0.45 },
  septum: { hoop: 4.5, tube: 0.6 }
};

function seatMetal(site) { return METALS[S.bust.ear[site].metal] || METALS.gold_14k_yellow; }
function metalMat(m) {
  return new THREE.MeshStandardMaterial({ color: m.color, metalness: 0.95, roughness: m.rough });
}
const GEM_MAT = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0.1, roughness: 0.05,
  transmission: 0.9, thickness: 0.4, ior: 2.4
});

// one site builder for every region: pieces are built per site from state,
// sized in real millimeters carried to glb units. same state, same piece.
function buildSitePiece(frame, cfg, region) {
  const sz = SEAT_SIZES[region];
  const mat = metalMat(METALS[cfg.metal] || METALS.gold_14k_yellow);
  const pos = new THREE.Vector3(...frame.pos), back = new THREE.Vector3(...frame.back);
  const dir = back.clone().sub(pos).normalize();
  const len = pos.distanceTo(back);
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const g = new THREE.Group();
  const add = (mesh) => { g.add(mesh); return mesh; };
  if (cfg.piece === "stud" || cfg.piece === "labret") {
    const r = BUST_U(sz.post);
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len + BUST_U(4), 10), mat));
    post.position.copy(pos.clone().add(back).multiplyScalar(0.5));
    post.quaternion.copy(align);
    const beadR = cfg.piece === "stud" ? BUST_U(sz.gem) : BUST_U(sz.bead);
    const bead = add(new THREE.Mesh(
      new THREE.SphereGeometry(beadR, 20, 14),
      cfg.piece === "stud" && !cfg.metalBead ? GEM_MAT : mat
    ));
    bead.position.copy(pos.clone().addScaledVector(dir, beadR * 0.7));
    const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(BUST_U(sz.disc), BUST_U(sz.disc), BUST_U(0.4), 18), mat));
    disc.position.copy(back.clone().addScaledVector(dir, BUST_U(0.7)));
    disc.quaternion.copy(align);
  } else if (cfg.piece === "hoop") {
    const ring = add(new THREE.Mesh(
      new THREE.TorusGeometry(BUST_U(sz.hoop), BUST_U(sz.tube), 12, 36), mat
    ));
    ring.position.copy(pos.clone().add(back).multiplyScalar(0.5));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }
  return g;
}
const mirrorFrame = (f) => ({
  pos: [-f.pos[0], f.pos[1], f.pos[2]],
  out: [-f.out[0], f.out[1], f.out[2]],
  back: [-f.back[0], f.back[1], f.back[2]]
});

// rebuild every pierced seat from state: idempotent, called on subject entry,
// panel changes and state restores alike
function clearSeatGroup() {
  for (const g of [...BUST.seatGroup.children]) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    BUST.seatGroup.remove(g);
  }
}
function buildEarSeats() {
  if (!BUST.loaded) return;
  for (const site of EAR_SITES) {
    const cfg = S.bust.ear[site];
    if (!cfg || cfg.piece === "none") continue;
    BUST.seatGroup.add(buildSitePiece(EAR_FRAME[site], cfg, "ear"));
    if (S.bust.ear.mirror_left) {
      BUST.seatGroup.add(buildSitePiece(mirrorFrame(EAR_FRAME[site]), cfg, "ear"));
    }
  }
}
function buildNoseSeats() {
  if (!BUST.loaded) return;
  const n = S.bust.nose;
  const sites = [["nostril", NOSE_FRAME.nostril], ["nostril_l", mirrorFrame(NOSE_FRAME.nostril)], ["septum", NOSE_FRAME.septum]];
  for (const [key, frame] of sites) {
    const cfg = n[key];
    if (!cfg || cfg.piece === "none" || !NOSE_PIECES[key.startsWith("nostril") ? "nostril" : "septum"].includes(cfg.piece)) continue;
    BUST.seatGroup.add(buildSitePiece(frame, cfg, key.startsWith("nostril") ? "nostril" : "septum"));
  }
}
function buildPiercings() { clearSeatGroup(); buildEarSeats(); buildNoseSeats(); }
