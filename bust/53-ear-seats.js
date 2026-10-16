// ===== ear seats: pierced jewelry on authored anchors =====
// EAR_FRAME is authored from the sculpt's own anatomy (bust/ear-frame.json,
// machine-picked 2026-10-14, lobe height still awaiting a human-eye pass).
// each site carries pos (surface point), out (outward normal) and back (the
// far side of the channel): a piece threads the two points, and occlusion
// does the "through the tissue" work — no booleans.
const EAR_FRAME = /*__EARFRAME__*/{};
const EAR_SITES = ["lobe", "helix", "tragus", "conch"];
const EAR_PIECES = ["none", "stud", "hoop", "labret"];

function seatMetal(site) { return METALS[S.bust.ear[site].metal] || METALS.gold_14k_yellow; }
function metalMat(m) {
  return new THREE.MeshStandardMaterial({ color: m.color, metalness: 0.95, roughness: m.rough });
}
const GEM_MAT = new THREE.MeshPhysicalMaterial({
  color: 0xffffff, metalness: 0.1, roughness: 0.05,
  transmission: 0.9, thickness: 0.4, ior: 2.4
});

// pieces are built per site from state, sized in real millimeters carried to
// glb units. sizes are display truth, so the same state renders the same piece.
function buildEarPiece(site) {
  const f = EAR_FRAME[site];
  const cfg = S.bust.ear[site];
  const g = new THREE.Group();
  g.name = "seat-" + site;
  const mat = metalMat(seatMetal(site));
  const pos = new THREE.Vector3(...f.pos), back = new THREE.Vector3(...f.back);
  const dir = back.clone().sub(pos).normalize();
  const len = pos.distanceTo(back);
  const align = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const add = (mesh) => { g.add(mesh); return mesh; };
  if (cfg.piece === "stud" || cfg.piece === "labret") {
    const r = cfg.piece === "stud" ? BUST_U(0.6) : BUST_U(0.5);
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len + BUST_U(4), 10), mat));
    post.position.copy(pos.clone().add(back).multiplyScalar(0.5));
    post.quaternion.copy(align);
    const beadR = cfg.piece === "stud" ? BUST_U(2.2) : BUST_U(1.3);
    const bead = add(new THREE.Mesh(
      new THREE.SphereGeometry(beadR, 20, 14),
      cfg.piece === "stud" && !cfg.metalBead ? GEM_MAT : mat
    ));
    bead.position.copy(pos.clone().addScaledVector(dir, beadR * 0.7));
    const disc = add(new THREE.Mesh(new THREE.CylinderGeometry(BUST_U(2.2), BUST_U(2.2), BUST_U(0.4), 18), mat));
    disc.position.copy(back.clone().addScaledVector(dir, BUST_U(0.7)));
    disc.quaternion.copy(align);
  } else if (cfg.piece === "hoop") {
    const ring = add(new THREE.Mesh(new THREE.TorusGeometry(BUST_U(8), BUST_U(0.6), 12, 36), mat));
    ring.position.copy(pos.clone().add(back).multiplyScalar(0.5));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  }
  return g;
}

// rebuild every seat from state: idempotent, called on subject entry, panel
// changes and state restores alike
function buildEarSeats() {
  if (!BUST.loaded) return;
  for (const g of [...BUST.seatGroup.children]) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    BUST.seatGroup.remove(g);
  }
  for (const site of EAR_SITES) {
    const cfg = S.bust.ear[site];
    if (!cfg || cfg.piece === "none") continue;
    BUST.seatGroup.add(buildEarPiece(site));
  }
}
