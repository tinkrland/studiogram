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
