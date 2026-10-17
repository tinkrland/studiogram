// nail-plate frame extraction. the runtime builds a real plate mesh per
// finger (customized-hands/53-nails.js); this derives, from the glb itself,
// the dorsal skin height field of each distal phalanx in bone-local bind
// space, so the plate drapes onto the actual skin and never floats or sinks.
// every value is measured from the mesh; nothing is hand-placed.
//   run from the repo root: node customized-hands/nails_frame.cjs
//   output: customized-hands/nail-frame.json
// per finger: { s: dorsal sign on bone-local z, tip: y of the fingertip,
//   bed: { z, slope } the straight nail-bed line the free edge extends along,
//   xc/w: lateral centre and skin half-width, grid: dorsal height field
//   h(x, y) = s*z of the skin's top arc, on an nx-by-ny grid from the tip back }
const G = require("./glb_skin.cjs");
const NX = 25, NY = 28, REACH = 0.0235;       // grid spans 23.5mm back from the tip
const out = {};
for (const [bn, fn] of Object.entries(G.distal)) {
  const ji = G.jointIndex(bn);
  const pts = G.boneVerts(ji).map((o) => o.p);
  const tip = Math.max(...pts.map((p) => p[1]));
  const zmax = Math.max(...pts.map((p) => p[2])), zmin = Math.min(...pts.map((p) => p[2]));
  // the dorsal side is the THINNER side of the phalanx: the nail bed rides
  // tight over the bone, while the palm side carries the fleshy pad. the
  // extent from the bone origin tells them apart (the first pass compared
  // raw extents and dressed the pad — nails rendered on the palm).
  const s = Math.abs(zmax) >= Math.abs(zmin) ? -1 : 1;
  const zone = pts.filter((p) => p[1] > tip - 0.012 && p[1] < tip - 0.002);
  const xs = zone.map((p) => p[0]);
  const xc = (Math.min(...xs) + Math.max(...xs)) / 2, w = (Math.max(...xs) - Math.min(...xs)) / 2;
  // dorsal arc: for each y-slice, keep only the upper half of the section
  // (above the section's mid-height), then interpolate height across x.
  const y0 = tip - REACH, dy = REACH / (NY - 1);
  const x0 = xc - w * 1.15, dx = (w * 2.3) / (NX - 1);
  const h = new Float64Array(NX * NY);
  for (let iy = 0; iy < NY; iy++) {
    const y = y0 + iy * dy;
    const sl = pts.filter((p) => Math.abs(p[1] - y) < dy * 0.75);
    if (sl.length < 4) { for (let ix = 0; ix < NX; ix++) h[iy*NX+ix] = NaN; continue; }
    const zs = sl.map((p) => s * p[2]);
    const mid = (Math.min(...zs) + Math.max(...zs)) / 2;
    const top = sl.filter((p) => s * p[2] >= mid).sort((a, b) => a[0] - b[0]);
    for (let ix = 0; ix < NX; ix++) {
      const x = x0 + ix * dx;
      // inverse-distance blend of the 3 nearest dorsal samples in x
      const near = top.map((p) => ({ d: Math.abs(p[0] - x), z: s * p[2] })).sort((a, b) => a.d - b.d).slice(0, 3);
      let num = 0, den = 0;
      for (const n of near) { const wt = 1 / (n.d + 2e-4); num += wt * n.z; den += wt; }
      h[iy*NX+ix] = den ? num / den : NaN;
    }
  }
  // fill any empty rows from their neighbours
  for (let pass = 0; pass < 60; pass++) {
    let holes = 0;
    for (let iy = 0; iy < NY; iy++) {
      if (!Number.isNaN(h[iy*NX])) continue;
      const a = iy > 0 && !Number.isNaN(h[(iy-1)*NX]) ? iy - 1 : -1;
      const c = iy < NY-1 && !Number.isNaN(h[(iy+1)*NX]) ? iy + 1 : -1;
      if (a < 0 && c < 0) { holes++; continue; }
      for (let ix = 0; ix < NX; ix++) h[iy*NX+ix] = a >= 0 && c >= 0 ? (h[a*NX+ix] + h[c*NX+ix]) / 2 : h[(a >= 0 ? a : c)*NX+ix];
    }
    if (!holes) break;
  }
  // the nail bed is the nearly flat dorsal stretch 4..12mm back from the
  // tip (the last ~3mm of skin curls ~60deg around the fingertip cap, and
  // a real plate does not follow that curl). fit a straight line to the
  // centre column there: the free edge extends along it.
  const cc = Math.round((NX - 1) / 2);
  let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
  for (let iy = 0; iy < NY; iy++) {
    const back = tip - (y0 + iy * dy);              // metres behind the tip
    if (back < 0.004 || back > 0.012) continue;
    const yy = -back, zz = h[iy*NX+cc];
    sx += yy; sy += zz; sxx += yy*yy; sxy += yy*zz; cnt++;
  }
  const slope = (cnt * sxy - sx * sy) / (cnt * sxx - sx * sx);
  const bedZ = (sy - slope * sx) / cnt;                 // dorsal height of the bed line at the tip's y
  const r = (v) => Math.round(v * 1e6) / 1e6;
  out[fn] = { s, tip: r(tip), xc: r(xc), w: r(w), bed: { z: r(bedZ), slope: r(slope) },
    grid: { y0: r(y0), dy: r(dy), x0: r(x0), dx: r(dx), nx: NX, ny: NY, h: Array.from(h, r) } };
  const at = (mmBack, xf) => (h[Math.round((REACH - mmBack/1000) / dy) * NX + Math.round(xf * (NX - 1))] * 1000).toFixed(1);
  console.log(fn.padEnd(7), "s", s, "half-width", (w*1000).toFixed(1) + "mm",
    "| dorsal height mm  tip+1:", at(1, 0.5), " 5:", at(5, 0.5), " 10:", at(10, 0.5), " 15:", at(15, 0.5),
    "| edge@5:", at(5, 0.12), "| bed z", (bedZ*1000).toFixed(1) + "mm slope", slope.toFixed(2));
}
require("fs").writeFileSync("customized-hands/nail-frame.json", JSON.stringify(out));
console.log("wrote customized-hands/nail-frame.json");
