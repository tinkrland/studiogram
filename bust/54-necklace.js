// ===== necklace drape: a verlet chain settles onto the subject =====
// NECK_RINGS: resting shells authored from the subject's cross-sections
const NECK_RINGS = /*__NECKRINGS__*/{};
// the chain is simulated, not templated: particles linked at fixed length,
// integrated with position-based verlet (the technique three.js's cloth demo
// uses), collided against the subject's resting shells. gravity pulls the
// loop down until the shells push back, and the surplus hangs as a true
// catenary at the front — a pendant is a heavy particle whose weight drags
// the droop, like real jewelry. fixed timestep and fixed iteration count
// make the settle deterministic: same scene state, byte-identical curve.
const NECK_TOP = 0.8;             // the band the loop starts from
const NECK_MARGIN = BUST_U(1.2);   // chain rides just off the skin
const DRAPE = { dt: 1 / 120, steps: 900, iter: 20, damp: 0.985, contactDamp: 0.85, grav: 93.4 }; // grav: u/s^2
// contactDamp is friction, support is the normal force: skin and hair hold
// a necklace where it sits. a contact particle feels only `support` of
// gravity, so the loop stays high at the nape while the surplus leaves the
// surface and hangs free — the catenary a real chain finds. without it, a
// frictionless loop slides to the widest band it can reach, off the
// shoulders; friction is also what lets pendant weight pull the chain
// around into the throat.

function ringLookup(theta, y) {
  const rs = NECK_RINGS.rings;
  const n = NECK_RINGS.angles.length;
  const t = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // interpolate the shell in theta and y — a nearest-bin staircase would
  // zigzag the collision and jitter the settle
  const f = t / (2 * Math.PI / n);
  const ia0 = Math.floor(f) % n, ia1 = (ia0 + 1) % n, ft = f - Math.floor(f);
  let iy = 0;
  while (iy < rs.length - 1 && rs[iy + 1].y < y) iy++;
  const r0 = rs[iy], r1 = rs[Math.min(iy + 1, rs.length - 1)];
  const ty = r1.y === r0.y ? 0 : Math.max(0, Math.min(1, (y - r0.y) / (r1.y - r0.y)));
  const rad = (1 - ft) * ((1 - ty) * r0.r[ia0] + ty * r1.r[ia0]) + ft * ((1 - ty) * r0.r[ia1] + ty * r1.r[ia1]);
  return { c: NECK_RINGS.axis, rad: (rad || 0.3) + NECK_MARGIN };
}

// one settle: the loop splits where jewelry actually splits it. the worn
// arc (groove -> nape -> groove) rests on the band — skin friction owns it
// and it does not slide, exactly like a necklace someone put on. the free
// segment (groove -> chest droop -> groove) is a pinned verlet catenary:
// gravity owns it, the chest shells push back, and a pendant is a heavy
// particle whose weight drags the droop. pinning the ends is what makes the
// settle stable: no closed-loop ratchet can walk anything off the band.
function settleChain(lengthCm, withPendant) {
  const target = lengthCm / 10.5;
  const linkLen = BUST_U(3.4);
  const axis = NECK_RINGS.axis;
  // worn arc: from the right groove (θ = -π/2) around the nape to the left
  const NW = 48;
  const worn = [];
  for (let i = 0; i <= NW; i++) {
    const th = -Math.PI / 2 + (Math.PI * i) / NW; // -π/2 .. +π/2 through π
    const { rad } = ringLookup(th, NECK_TOP);
    worn.push(new THREE.Vector3(axis[0] + rad * Math.cos(th), NECK_TOP, axis[1] + rad * Math.sin(th)));
  }
  let Lworn = 0;
  for (let i = 1; i <= NW; i++) Lworn += worn[i].distanceTo(worn[i - 1]);
  const pinR = worn[0].clone(), pinL = worn[NW].clone();
  // free segment: what's left of the chain hangs between the grooves
  const Lfree = Math.max(target - Lworn, linkLen * 4);
  const m = Math.max(8, Math.round(Lfree / linkLen) + 1);
  const segLen = Lfree / (m - 1);
  const chord = pinR.distanceTo(pinL);
  const hang0 = Math.max(0.05, (Lfree - chord) * 0.35);
  const pts = [], prev = [], w = [];
  for (let i = 0; i < m; i++) {
    const t = i / (m - 1);
    // put-on guess: a front-bulging arc from pin to pin
    const p = pinR.clone().lerp(pinL, t);
    p.y -= hang0 * 4 * t * (1 - t);
    p.z += 0.12 * (1 - Math.abs(t - 0.5) * 2);
    pts.push(p); prev.push(p.clone()); w.push(1);
  }
  pts[0].copy(pinR); pts[m - 1].copy(pinL); // the pins
  let pendantIdx = -1;
  if (withPendant) {
    pendantIdx = Math.floor(m / 2);
    w[pendantIdx] = 1 / 10;                   // the pendant's weight
  }
  // project the guess onto the shells so the segment is born in contact
  for (const p of pts) {
    p.y = Math.min(1.25, Math.max(0.18, p.y));
    const th = Math.atan2(p.z - axis[1], p.x - axis[0]);
    const { rad } = ringLookup(th, p.y);
    const dx = p.x - axis[0], dz = p.z - axis[1], d = Math.hypot(dx, dz);
    if (d < rad && d > 1e-6) { p.x = axis[0] + (dx / d) * rad; p.z = axis[1] + (dz / d) * rad; }
  }
  const g = DRAPE.grav * DRAPE.dt * DRAPE.dt;
  let lastMaxMove = 0;
  for (let s = 0; s < DRAPE.steps; s++) {
    for (let i = 1; i < m - 1; i++) {
      const p = pts[i], q = prev[i];
      // the drape's bottom rests on the sternum: below the rest line the
      // chest is nearly horizontal, so it is support, not slope — static
      // friction takes gravity there and the pendant comes to rest on bone
      const resting = p.y < 0.24;
      const damp = resting ? DRAPE.contactDamp : DRAPE.damp;
      const grav = resting ? 0 : g;
      const px = p.x + (p.x - q.x) * damp;
      const py = p.y + (p.y - q.y) * damp - grav;
      const pz = p.z + (p.z - q.z) * damp;
      q.set(p.x, p.y, p.z); p.set(px, py, pz);
    }
    for (let k = 0; k < DRAPE.iter; k++) {
      for (let i = 0; i < m - 1; i++) {               // fixed-length links
        const a = pts[i], b = pts[i + 1];
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        const d = Math.hypot(dx, dy, dz) || 1e-9;
        const diff = (d - segLen) / d;
        const ia = i === 0 ? 0 : 1, ib = i + 1 === m - 1 ? 0 : 1; // pins never move
        const tw = w[i] * ia + w[i + 1] * ib;
        if (!tw) continue;
        const fa = (w[i] * ia) / tw, fb = (w[i + 1] * ib) / tw;
        a.x += dx * diff * fa; a.y += dy * diff * fa; a.z += dz * diff * fa;
        b.x -= dx * diff * fb; b.y -= dy * diff * fb; b.z -= dz * diff * fb;
      }
      for (let i = k < DRAPE.iter - 4 ? -1 : 1; i < m - 1 && k >= DRAPE.iter - 4; i++) { // the chest pushes back, late in the pass
        const p = pts[i];
        p.y = Math.min(1.25, Math.max(0.18, p.y));
        const th = Math.atan2(p.z - axis[1], p.x - axis[0]);
        const { rad } = ringLookup(th, p.y);
        const dx = p.x - axis[0], dz = p.z - axis[1], d = Math.hypot(dx, dz);
        if (d < rad && d > 1e-6) {
          p.x = axis[0] + (dx / d) * rad;
          p.z = axis[1] + (dz / d) * rad;
          prev[i].set(p.x, p.y, p.z); // inelastic push: no injected velocity
        }
      }
    }
    if (s >= DRAPE.steps - 100) {
      let mv = 0;
      for (let i = 1; i < m - 1; i++) mv = Math.max(mv, pts[i].distanceTo(prev[i]));
      lastMaxMove = Math.max(lastMaxMove, mv);
    }
  }
  // the closed loop the meshes consume: worn arc, then the free segment back
  const loop = [...worn];
  for (let i = m - 2; i >= 1; i--) loop.push(pts[i]);
  const n = loop.length;
  let perimeter = 0;
  for (let i = 0; i < n; i++) perimeter += loop[i].distanceTo(loop[(i + 1) % n]);
  return { pts: loop, n, perimeter, settled: lastMaxMove, pendantIdx: pendantIdx < 0 ? -1 : NW + (m - 1 - pendantIdx) };
}

let DRAPE_CACHE = null; // rebuilding meshes shouldn't re-run the settle
function solveDrape(lengthCm, withPendant) {
  if (DRAPE_CACHE && DRAPE_CACHE.lengthCm === lengthCm && DRAPE_CACHE.pendant === !!withPendant) return DRAPE_CACHE.result;
  const result = settleChain(lengthCm, withPendant);
  DRAPE_CACHE = { lengthCm, pendant: !!withPendant, result };
  return result;
}

// cable chain: one link per particle pair, alternating roll for the weave
function buildNecklace() {
  if (!BUST.loaded) return;
  for (const g of [...BUST.chainGroup.children]) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    BUST.chainGroup.remove(g);
  }
  const cfg = S.bust.necklace;
  if (!cfg || cfg.style === "none") return;
  const { pts: raw, pendantIdx } = solveDrape(cfg.length_cm, cfg.pendant);
  const target = cfg.length_cm / 10.5;
  const linkLen = BUST_U(3.4);
  // the settle owns the shape; the mesh spacing owns the length: resample
  // the settled curve at exactly linkLen, so the rendered chain is the
  // nominal length riding the physical drape
  const per = [];
  for (let i = 1; i < raw.length; i++) per.push(raw[i].distanceTo(raw[i - 1]));
  per.push(raw[0].distanceTo(raw[raw.length - 1]));
  const total = per.reduce((a, b) => a + b, 0);
  const n = Math.max(24, Math.round(target / linkLen));
  const pts = [];
  let seg = 1, acc = 0;
  for (let i = 0; i < n; i++) {
    const tArc = ((i + 0.5) * total) / n;
    while (seg < raw.length && acc + per[seg - 1] < tArc) { acc += per[seg - 1]; seg++; }
    const t = (tArc - acc) / Math.max(per[seg - 1], 1e-9);
    const a = raw[seg - 1], b = raw[seg % raw.length];
    pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t));
  }
  const mat = metalMat(METALS[cfg.metal] || METALS.gold_14k_yellow);
  const group = new THREE.Group();
  group.name = "necklace";
  let flip = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const tan = b.clone().sub(a).normalize();
    const link = new THREE.Mesh(new THREE.TorusGeometry(BUST_U(1.7), BUST_U(0.55), 10, 18), mat);
    link.position.copy(a).add(b).multiplyScalar(0.5);
    link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    if (flip) link.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0).cross(tan).normalize(), Math.PI / 2);
    group.add(link);
    flip ^= 1;
  }
  if (pendantIdx >= 0) {
    let lo = 0;
    for (let i = 1; i < n; i++) if (pts[i].y < pts[lo].y && pts[i].z > 0) lo = i;
    const p = pts[lo];
    const bail = new THREE.Mesh(new THREE.TorusGeometry(BUST_U(1.2), BUST_U(0.4), 8, 14), mat);
    bail.position.copy(p);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(BUST_U(4.5), 24, 18), mat);
    drop.scale.set(0.75, 1.15, 0.45);
    drop.position.set(p.x, p.y - BUST_U(5.6), p.z);
    group.add(bail, drop);
  }
  BUST.chainGroup.add(group);
}
