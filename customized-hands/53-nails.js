// ===== nails: a real plate per finger, shape from a library, length from a slider =====
// the nail is authored geometry parented to each distal finger bone, so it
// rides posing, morphs, and both finishes (porcelain and skin) like the
// jewelry does. the plate has two parts:
//   bed       the stretch lying on the finger, draped onto the measured dorsal
//             skin (customized-hands/nail-frame.json, derived from the glb
//             by nails_frame.cjs), lifted a hair so it never z-fights.
//   free edge the part past the fingertip, extending straight along the
//             fitted nail-bed line (a real plate leaves the finger there;
//             it does not curl around the fingertip cap).
// state is quantitative only: { shape: "<library key>", length: 0..1 }.
// the shape picks the free-edge silhouette; length is how far it extends.
const NAIL_FRAME = /*__NAILFRAME__*/{};

// ---- the shape library ----
// each shape is a free-edge silhouette in normalised plate coordinates:
//   u in [-1, 1]  across the plate (0 = centre line)
//   edge(u, t)    how far the free edge reaches along the length at u, as a
//                 fraction 0..1 of the full free-edge length at slider
//                 value t (t is the slider, 0..1). returning 0 means the
//                 plate ends exactly at the fingertip there.
//   sideTaper     how much the plate narrows from the fingertip to its end
//                 (0 = parallel sides, 1 = meets at a point)
//   widthGain     how much the plate flares wider than the nail bed (flare/wide)
// shapes are named after the reference charts the owner supplied.
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const NAIL_SHAPES = {
  // edge(u): free-edge reach (0..1) at lateral position u in [-1, 1].
  // taper(f): plate half-width multiplier at free-edge progress f in [0, 1]
  //           (1 = full bed width). together they trace the whole outline:
  //           the sides follow taper, the end follows edge.
  natural:  { label: "natural",  natural: true, taper: () => 1, edge: () => 0.04 },
  oval:     { label: "oval",     taper: (f) => Math.sqrt(Math.max(0, 1 - f * f * 0.35)), edge: (u) => Math.sqrt(Math.max(0, 1 - u * u)) },
  rounded:  { label: "rounded",  taper: () => 1, edge: (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 3.2)), 0.55) },
  square:   { label: "square",   taper: () => 1, edge: () => 1 },
  squoval:  { label: "squoval",  taper: () => 1, edge: (u) => 1 - 0.34 * Math.pow(smooth(0.5, 1, Math.abs(u)), 1.6) },
  almond:   { label: "almond",   taper: (f) => 1 - 0.62 * Math.pow(f, 1.25), edge: (u) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.2)), 1.0) },
  mountain_peak: { label: "mountain peak", taper: (f) => 1 - 0.55 * f, edge: (u) => Math.max(0, 1 - Math.pow(Math.abs(u), 1.15)) },
  stiletto: { label: "stiletto", taper: (f) => Math.max(0.02, 1 - 0.98 * Math.pow(f, 0.9)), edge: (u) => Math.max(0, 1 - Math.abs(u) * 0.97), lengthBoost: 1.3 },
  pointed:  { label: "pointed",  taper: (f) => Math.max(0.03, 1 - 0.95 * f), edge: (u) => Math.max(0, 1 - Math.abs(u) * 0.95), lengthBoost: 0.85 },
  arrow_head: { label: "arrow head", taper: (f) => (f < 0.45 ? 1 : 1 - 0.95 * (f - 0.45) / 0.55), edge: (u) => Math.max(0, 1 - Math.abs(u) * 0.62), lengthBoost: 1.0 },
  rock_peak:  { label: "rock peak",  taper: (f) => 1 - 0.25 * f, edge: (u) => 0.58 + 0.42 * Math.max(0, 1 - Math.abs(u) * 1.6) },
  edge:     { label: "edge",     taper: (f) => 1 - 0.12 * f, edge: (u) => 0.66 + 0.34 * Math.max(0, 1 - Math.abs(u) * 1.25) },
  trapezoid:{ label: "trapezoid",taper: (f) => 1 - 0.38 * f, edge: () => 1 },
  ballerina:{ label: "ballerina",taper: (f) => 1 - 0.42 * f, edge: () => 1, lengthBoost: 1.15 },
  lipstick: { label: "lipstick", taper: () => 1, edge: (u) => 0.28 + 0.72 * ((u + 1) / 2) },
  swirled_lipstick: { label: "swirled lipstick", taper: () => 1, edge: (u) => 0.3 + 0.7 * ((u + 1) / 2) - 0.3 * Math.exp(-Math.pow((u - 0.5) / 0.28, 2)) },
  flare:    { label: "flare",    taper: (f) => 1 + 0.32 * f, edge: () => 1 },
  cut_out:  { label: "cut out",  taper: () => 1, edge: (u) => 1 - 0.36 * Math.exp(-Math.pow(u / 0.45, 2)) },
  wide:     { label: "wide",     taper: (f) => 1 + 0.18 * Math.sin(Math.min(1, f) * Math.PI * 0.5), edge: (u) => 0.92 + 0.08 * (1 - u * u) },
};
const NAIL_SHAPE_ORDER = Object.keys(NAIL_SHAPES);

// the free edge's full reach at slider = 1, in metres (a long nail). the slider
// interpolates 0 -> this. fingers scale it by their plate width so a pinky nail
// stays in proportion to a thumb nail.
const NAIL_MAX_REACH = 0.021;

const NAIL = { plates: new Map(), material: null };

function nailMaterial() {
  if (!NAIL.material) {
    NAIL.material = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(S.hand.nails?.color || "#e9c5bd"),
      roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
  }
  return NAIL.material;
}

// natural nail colour when no polish: a pale translucent pink-ivory. polished
// uses the chosen colour. the colour is a surface value, not a shape.
function nailColor() {
  const n = S.hand.nails || {};
  return n.style === "polished" ? (n.color || "#b23a48") : "#e9ded3"; // keratin: pale rosy ivory, not skin
}

// dorsal skin height at (x, y) in bone-local bind space, from the measured field
function dorsalHeight(fr, x, y) {
  const g = fr.grid;
  const fx = Math.min(g.nx - 1, Math.max(0, (x - g.x0) / g.dx));
  const fy = Math.min(g.ny - 1, Math.max(0, (y - g.y0) / g.dy));
  const ix = Math.min(g.nx - 2, Math.floor(fx)), iy = Math.min(g.ny - 2, Math.floor(fy));
  const tx = fx - ix, ty = fy - iy;
  const h = (a, b) => g.h[b * g.nx + a];
  return (h(ix, iy) * (1 - tx) + h(ix + 1, iy) * tx) * (1 - ty) + (h(ix, iy + 1) * (1 - tx) + h(ix + 1, iy + 1) * tx) * ty;
}

// build the plate geometry for one finger. the plate lives in the distal
// bone's local frame: x lateral, y along the finger toward the tip, z dorsal
// (times fr.s, the dorsal sign).
function buildNailGeometry(fr, shapeKey, length) {
  // the plate is a keratin OBJECT, not paint on skin: it is stiff, so its
  // top surface follows the finger's dorsal CENTERLINE (the bed's ridge)
  // and carries its own transverse arch across; it never drapes the skin's
  // side walls. it is a constant-ish thickness slab with a real edge, so it
  // reads as a separate thing sitting on the finger. polish is lacquer over
  // this plate, never a tint on skin.
  const shape = NAIL_SHAPES[shapeKey] || NAIL_SHAPES.oval;
  const NU = 29, NV = 30;
  const halfW = fr.w * 0.78;
  const bedBack = Math.max(0.008, (fr.phal || 0.02) * 0.62);
  const reach = shape.natural ? 0.0008 : NAIL_MAX_REACH * (fr.w / 0.0072) * (shape.lengthBoost || 1) * length;
  const lift = 0.00035;                           // rides 0.35mm off the bed's ridge
  const dome = 0.00055;                           // the plate's own arch across
  // growth along the bed: the matrix extrudes the plate UNDER the proximal
  // fold; over the sterile matrix the bed holds it flat along the BED PLANE
  // (the fitted line), and at the distal groove (~2mm before the fingertip)
  // the plate separates — it never follows the fingertip's rounding cap,
  // it leaves along the bed's own line. the skin centerline acts only as a
  // floor so the base tucks under the fold instead of sinking through it.
  const topZ = (u, y) => {
    const zLine = fr.bed.z + fr.bed.slope * (y - fr.tip);      // the bed plane
    const zC = dorsalHeight(fr, fr.xc, Math.min(y, fr.tip));  // the skin floor
    return Math.max(zLine, zC) + lift + dome * (1 - u * u);    // own arch across
  };
  // growth of nail height: the plate emerges thin from under the fold
  // (~0.15mm at the matrix) and is fullest at the free edge (~0.5mm)
  const thickAt = (v) => 0.00015 + 0.00035 * v;
  // top + bottom grids, same topology; the rim closes them into a solid
  const verts = [], idx = [];
  const pointAt = (r, c, side) => {                // side 0 = top, 1 = bottom
    const v = r / (NV - 1);
    const u = (c / (NU - 1)) * 2 - 1;
    const dist = v * (bedBack + reach);
    const onBed = dist <= bedBack;
    const f = onBed ? 0 : Math.min(1, (dist - bedBack) / Math.max(reach, 1e-6));
    const wMul = shape.natural ? 1 : shape.taper(f);
    const baseRound = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, 1 - v / 0.08), 2)));
    const endAt = bedBack + reach * Math.min(1, Math.max(0, shape.edge(u)));
    const here = Math.min(dist, endAt);
    const x = fr.xc + u * halfW * wMul * Math.max(0.3, baseRound);
    const y = fr.tip - bedBack + here;
    const z = topZ(u, y) - (side ? thickAt(v) : 0);
    return [x, y, fr.s * z];
  };
  const N = NU * NV;
  for (let r = 0; r < NV; r++) for (let c = 0; c < NU; c++) {
    verts.push(...pointAt(r, c, 0));              // top block
  }
  for (let r = 0; r < NV; r++) for (let c = 0; c < NU; c++) {
    verts.push(...pointAt(r, c, 1));              // bottom block
  }
  const quad = (a, b, c, d, flip) => {
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  };
  for (let r = 0; r < NV - 1; r++) for (let c = 0; c < NU - 1; c++) {
    const a = r * NU + c, b = a + 1, d = a + NU, e = d + 1;
    if (fr.s > 0) { idx.push(a, d, b, b, d, e); idx.push(N + a, N + b, N + d, N + b, N + e, N + d); }
    else { idx.push(a, b, d, b, e, d); idx.push(N + a, N + d, N + b, N + b, N + d, N + e); }
  }
  // rim: stitch the solid closed — both lateral edges, the free edge, the cuticle
  const rim = (i0, i1) => {                        // top i0 -> bottom i0 pair strip
    const j0 = N + i0, j1 = N + i1;
    if (fr.s > 0) idx.push(i0, i1, j0, i1, j1, j0);
    else idx.push(i0, j0, i1, i1, j0, j1);
  };
  for (let r = 0; r < NV - 1; r++) { rim(r * NU, (r + 1) * NU); rim((r + 1) * NU - 1, (r + 2) * NU - 1); }
  for (let c = 0; c < NU - 1; c++) { rim((NV - 1) * NU + c, (NV - 1) * NU + c + 1); rim(c, c + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// (re)build every plate from state. cheap: five small meshes.
function applyNails() {
  if (!HAND.loaded || !NAIL_FRAME || !Object.keys(NAIL_FRAME).length) return;
  const n = S.hand.nails || (S.hand.nails = { style: "natural", color: "#b23a48", shape: "oval", length: 0.3 });
  if (!n.shape || !NAIL_SHAPES[n.shape]) n.shape = "oval";
  if (typeof n.length !== "number") n.length = 0.3;
  nailMaterial().color.set(nailColor());
  for (const [finger, fr] of Object.entries(NAIL_FRAME)) {
    const bone = HAND.bones.get(bname((FINGER_BONES[finger] || finger) + (finger === "thumb" ? ".03.L" : ".03.L")));
    if (!bone) continue;
    let mesh = NAIL.plates.get(finger);
    const geo = buildNailGeometry(fr, n.shape, n.length);
    if (!mesh) {
      mesh = new THREE.Mesh(geo, nailMaterial());
      mesh.name = "nail_" + finger;
      mesh.castShadow = true; mesh.renderOrder = 2;
      bone.add(mesh);
      NAIL.plates.set(finger, mesh);
    } else {
      // idempotent re-attach: if anything rebuilt the rig under us, the
      // plate would ride a stale bone and float off the fingertip in any
      // pose that bends the finger. re-pin to the current bone each apply.
      if (mesh.parent !== bone) bone.add(mesh);
      mesh.geometry.dispose();
      mesh.geometry = geo;
    }
    mesh.visible = true;
  }
}

// a small outline icon for the picker, drawn from the very silhouette
// function the plate geometry uses, so the icon cannot drift from the shape.
function nailShapeIcon(key) {
  const def = NAIL_SHAPES[key];
  const W = 34, H = 44, ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("width", W); svg.setAttribute("height", H);
  const half = 11, baseY = 41, bedTop = 25, maxReach = def.natural ? 1.5 : 21 * Math.min(1.12, def.lengthBoost || 1);
  // walk the right side up the free edge using taper(f), then the end across using edge(u)
  const pts = [[W / 2 - half, baseY], [W / 2 - half, bedTop]];
  const side = (sign) => { const out = []; for (let i = 0; i <= 10; i++) { const f = i / 10; out.push([W / 2 + sign * half * (def.natural ? 1 : def.taper(f)), bedTop - f * maxReach * (def.natural ? 0 : 0.0) ]); } return out; };
  // the end profile: for each lateral position u, the plate reaches edge(u) of the way
  const end = [];
  for (let c = 0; c <= 40; c++) {
    const u = (c / 40) * 2 - 1;
    const e = Math.max(0, Math.min(1, def.edge(u)));
    const w = def.natural ? 1 : def.taper(e);               // width at the height this column ends
    end.push([W / 2 + u * half * w, bedTop - e * maxReach]);
  }
  let d = `M ${W / 2 - half} ${baseY} L ${W / 2 - half} ${bedTop}`;
  for (const q of end) d += ` L ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  d += ` L ${W / 2 + half} ${bedTop} L ${W / 2 + half} ${baseY} Z`;
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", d); path.setAttribute("fill", "currentColor"); path.setAttribute("fill-opacity", "0.16");
  path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", "1.4"); path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}
