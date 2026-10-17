// ===== prop library: set dressing as real scene objects =====
// the kirosculp plan is explicit about props: the platform prepopulates and
// curates a prop library (sam 3d reconstruction, their side, planned not
// built), and studiogram places entries into the backdrop as scene objects.
// this module is the studiogram side of that contract: props are independent
// objects, placed and recorded in scene state with per-prop provenance,
// rendered deterministically, background-only — never worn, never attached
// to the subject, never product-adjacent. until the platform library exists,
// the entries are authored placeholder geometry, the same stand-in pattern
// the jewelry fixtures use for release records; the provenance record says
// so in plain words.
const PROP_GROUP = new THREE.Group();
PROP_GROUP.name = "props";
scene.add(PROP_GROUP);

const PROP_LIMIT = 6;
// placement clamps: the backdrop band behind the stage. props live at
// negative z, the subject owns the stage — nothing tasteful reads from a
// prop sitting in the product's lap.
const PROP_X = 800, PROP_Z_MIN = -900, PROP_Z_MAX = -180;

// authored placeholder geometry — muted, matte, mood not capability
function propMat(color, rough) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough ?? 0.85, metalness: 0 });
}
function buildOttoman() {
  const g = new THREE.Group();
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(150, 158, 95, 28), propMat(0x9a8578));
  cushion.position.y = 115;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(120, 132, 70, 28), propMat(0x54473e));
  base.position.y = 35;
  g.add(cushion, base);
  return g;
}
function buildMug() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(42, 38, 95, 24), propMat(0xe4d8c3));
  body.position.y = 48;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(26, 8, 10, 18), propMat(0xe4d8c3));
  handle.position.set(46, 50, 0);
  handle.rotation.y = Math.PI / 2;
  g.add(body, handle);
  return g;
}
function buildBooks() {
  const g = new THREE.Group();
  const cols = [0x7d6b60, 0x6b7561, 0x8c7f8e];
  let y = 0, tilt = 0.06;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(210, 38, 145), propMat(cols[i], 0.95));
    b.position.set(6 * (i % 2 ? 1 : -1), y + 19, 0);
    b.rotation.y = tilt * (i - 1);
    g.add(b);
    y += 38;
    tilt += 0.05;
  }
  return g;
}
function buildVase() {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(40 + 55 * Math.sin(t * Math.PI * 0.9) * (1 - t * 0.35), t * 230));
  }
  const vase = new THREE.Mesh(new THREE.LatheGeometry(pts, 26), propMat(0x86929b, 0.6));
  g.add(vase);
  return g;
}
const PROP_LIBRARY = {
  ottoman: { label: "ottoman", build: buildOttoman },
  mug: { label: "mug", build: buildMug },
  books: { label: "book stack", build: buildBooks },
  vase: { label: "vase", build: buildVase },
};

// place a prop: state-first, then the idempotent rebuild renders from it
function addProp(kind) {
  if (!PROP_LIBRARY[kind]) return;
  if (S.props.length >= PROP_LIMIT) { toast("the backdrop is full (" + PROP_LIMIT + " props)"); return; }
  const n = S.props.filter((p) => p.prop === kind).length;
  S.props.push({
    id: "p" + Math.random().toString(36).slice(2, 9),
    prop: kind,
    x: ((n % 2 ? 1 : -1) * (230 + n * 90)) | 0,
    z: -260 - n * 120,
    rotY: 0,
    scale: 1,
    provenance: { source: "authored placeholder", method: "procedural", ts: new Date().toISOString() }
  });
  applyProps(); renderScenePanel(); saveState();
}
function removeProp(id) {
  S.props = S.props.filter((p) => p.id !== id);
  applyProps(); renderScenePanel(); saveState();
}
function clampProp(p) {
  p.x = Math.max(-PROP_X, Math.min(PROP_X, +p.x || 0));
  p.z = Math.max(PROP_Z_MIN, Math.min(PROP_Z_MAX, +p.z || PROP_Z_MAX));
  p.rotY = ((+p.rotY || 0) % 360 + 360) % 360;
  p.scale = Math.max(0.4, Math.min(2, +p.scale || 1));
  return p;
}

// rebuild every prop from state; the same state renders the same backdrop
function applyProps() {
  for (const g of [...PROP_GROUP.children]) {
    g.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    PROP_GROUP.remove(g);
  }
  for (const p of S.props) {
    if (!PROP_LIBRARY[p.prop]) continue;
    clampProp(p);
    const g = PROP_LIBRARY[p.prop].build();
    g.name = "prop_" + p.id;
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rotY * Math.PI / 180;
    g.scale.setScalar(p.scale);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    PROP_GROUP.add(g);
  }
}
