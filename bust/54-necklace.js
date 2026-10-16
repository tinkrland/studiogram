// ===== necklace drape: length is the only input =====
// deterministic, no physics engine. NECK_RINGS holds first-hit resting
// shells authored from the sculpt's own cross-sections (clavicle to jaw,
// bust/neck-rings.json). a single sag parameter drops the front of the loop;
// bisection finds the sag whose arclength equals the necklace length, so the
// front dips only as far as the extra chain allows — same mesh + same length,
// same curve, every time.
const NECK_RINGS = /*__NECKRINGS__*/{};
const NECK_TOP = 1.0;       // resting band (glb units, below the jaw)
const NECK_MARGIN = BUST_U(1.2); // chain rides just off the skin

function ringLookup(theta, y) {
  const rs = NECK_RINGS.rings;
  const n = NECK_RINGS.angles.length;
  const t = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // the shell interpolates in theta (adjacent bins blend) and in y — a
  // nearest-bin staircase would zigzag the polyline and inflate arclength
  const f = t / (2 * Math.PI / n);
  const ia0 = Math.floor(f) % n, ia1 = (ia0 + 1) % n, ft = f - Math.floor(f);
  let iy = 0;
  while (iy < rs.length - 1 && rs[iy + 1].y < y) iy++;
  const r0 = rs[iy], r1 = rs[Math.min(iy + 1, rs.length - 1)];
  const ty = r1.y === r0.y ? 0 : Math.max(0, Math.min(1, (y - r0.y) / (r1.y - r0.y)));
  const rad = (1 - ft) * ((1 - ty) * r0.r[ia0] + ty * r1.r[ia0]) + ft * ((1 - ty) * r0.r[ia1] + ty * r1.r[ia1]);
  const c = [(1 - ty) * r0.c[0] + ty * r1.c[0], (1 - ty) * r0.c[1] + ty * r1.c[1]];
  return { c, rad: (rad || 0.3) + NECK_MARGIN };
}

function necklacePoints(sag, n = 500) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = -Math.PI + (2 * Math.PI * i) / n;
    const h = (1 - Math.cos(th - Math.PI / 2)) / 2; // 0 at the nape, 1 at the throat
    const y = Math.max(0.3, Math.min(1.1, NECK_TOP - sag * h));
    const { c, rad } = ringLookup(th, y);
    pts.push([c[0] + rad * Math.cos(th), y, c[1] + rad * Math.sin(th)]);
  }
  return pts;
}
function necklaceLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
  }
  return L;
}
// cm -> glb units (105mm per unit), then bisect the sag
function solveDrape(lengthCm) {
  const target = lengthCm / 10.5;
  let lo = 0, hi = 0.9;
  for (let i = 0; i < 36; i++) {
    const mid = (lo + hi) / 2;
    if (necklaceLength(necklacePoints(mid)) < target) lo = mid; else hi = mid;
  }
  return { sag: (lo + hi) / 2, pts: necklacePoints((lo + hi) / 2) };
}

// cable chain: torus links at fixed arclength, alternating roll for the weave
function buildNecklace() {
  if (!BUST.loaded) return;
  for (const g of [...BUST.chainGroup.children]) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    BUST.chainGroup.remove(g);
  }
  const cfg = S.bust.necklace;
  if (!cfg || cfg.style === "none") return;
  const { pts } = solveDrape(cfg.length_cm);
  const mat = metalMat(METALS[cfg.metal] || METALS.gold_14k_yellow);
  const group = new THREE.Group();
  group.name = "necklace";
  // arclength resample
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
  }
  const total = cum[cum.length - 1];
  const linkLen = BUST_U(3.4); // ~3.4mm per link
  const n = Math.max(8, Math.round(total / linkLen));
  let seg = 1, flip = 0;
  for (let k = 0; k < n; k++) {
    const s = ((k + 0.5) * total) / n;
    while (seg < pts.length - 1 && cum[seg] < s) seg++;
    const t = (s - cum[seg - 1]) / Math.max(cum[seg] - cum[seg - 1], 1e-9);
    const px = pts[seg - 1][0] + (pts[seg][0] - pts[seg - 1][0]) * t;
    const py = pts[seg - 1][1] + (pts[seg][1] - pts[seg - 1][1]) * t;
    const pz = pts[seg - 1][2] + (pts[seg][2] - pts[seg - 1][2]) * t;
    const tan = new THREE.Vector3(pts[seg][0] - pts[seg - 1][0], pts[seg][1] - pts[seg - 1][1], pts[seg][2] - pts[seg - 1][2]).normalize();
    const link = new THREE.Mesh(new THREE.TorusGeometry(BUST_U(1.7), BUST_U(0.55), 10, 18), mat);
    link.position.set(px, py, pz);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    if (flip) link.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0).cross(tan).normalize(), Math.PI / 2);
    group.add(link);
    flip ^= 1;
  }
  if (cfg.pendant) {
    // the pendant hangs at the lowest point of the front dip
    let dip = pts[0];
    for (const p of pts) if (p[2] > 0 && p[1] < dip[1]) dip = p;
    const bail = new THREE.Mesh(new THREE.TorusGeometry(BUST_U(1.2), BUST_U(0.4), 8, 14), mat);
    bail.position.set(dip[0], dip[1] + BUST_U(1.2), dip[2]);
    group.add(bail);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(BUST_U(4.5), 24, 18), mat);
    drop.scale.set(0.75, 1.15, 0.45);
    drop.position.set(dip[0], dip[1] - BUST_U(3.2), dip[2]);
    group.add(drop);
  }
  BUST.chainGroup.add(group);
}
