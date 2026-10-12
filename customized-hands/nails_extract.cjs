// nail-plate extraction: per distal bone, the vertices whose texels are the
// brightest on the fingertip are the nail plate. emits uv points per finger
// for the runtime polish composite (same pattern as the hair follicles).
const fs = require("fs");
const { execSync } = require("child_process");
const b = fs.readFileSync("assets/hand.glb");
const jlen = b.readUInt32LE(12);
const J = JSON.parse(b.slice(20, 20 + jlen).toString());
const binStart = 20 + jlen + 8;
const acc = (i) => {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView];
  const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
  const comp = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4}[a.type];
  let arr;
  if (a.componentType === 5126) arr = new Float32Array(b.buffer.slice(off, off + a.count*comp*4));
  else if (a.componentType === 5121) { const u = new Uint8Array(b.buffer.slice(off, off + a.count*comp)); arr = Float32Array.from(u); }
  return {n: a.count, comp, arr}; };
const prim = J.meshes[0].primitives[0];
const uv = acc(prim.attributes.TEXCOORD_0);
const joints = acc(prim.attributes.JOINTS_0);
const weights = acc(prim.attributes.WEIGHTS_0);
const jointName = i => J.nodes[J.skins[0].joints[i]].name.replace(/\./g,"");
const distal = { finger_index03L: "index", finger_middle03L: "middle", finger_ring03L: "ring", finger_pinky03L: "pinky", thumb03L: "thumb" };

// texture lookup: export texel brightness per (u,v) via a ppm dump done in python beforehand
// (JPEG decode in pure node is heavy; brightness array comes from a python-written raw file)
const S = 2048;
const lum = new Float32Array(fs.readFileSync("customized-hands/tex-lum.bin"));
const lumAt = (u, v) => {
  const x = Math.min(S-1, Math.max(0, Math.round(u*S)));
  const y = Math.min(S-1, Math.max(0, Math.round(v*S))); // glTF v: 0 = bottom of image
  return lum[(S-1-y)*S + x]; // tex_lum.bin rows are top-down
};

const out = {};
for (let v = 0; v < uv.n; v++) {
  let best = -1, bw = 0;
  for (let k = 0; k < 4; k++) { const w = weights.arr[v*4+k]; if (w > bw) { bw = w; best = joints.arr[v*4+k] | 0; } }
  const name = jointName(best);
  if (!(name in distal)) continue;
  const u = uv.arr[v*2], vv = uv.arr[v*2+1];
  const finger = distal[name];
  (out[finger] || (out[finger] = [])).push({u, v: vv, l: lumAt(u, vv)});
}
const nails = {};
for (const [finger, verts] of Object.entries(out)) {
  const ls = verts.map(x => x.l).sort((a, b) => b - a);
  const thr = ls[Math.floor(ls.length * 0.06)]; // top 6% brightest fingertip texels = plate
  const bright = verts.filter(x => x.l >= thr && x.l > 2.0); // and absolutely bright
  // cluster in uv: single-link with tight radius
  bright.sort((a, b) => a.u - b.u);
  const clusters = [];
  for (const p of bright) {
    let hit = null;
    for (const c of clusters) if (Math.hypot((c.u-p.u), (c.v-p.v)) < 0.035) { hit = c; break; }
    if (hit) { hit.n++; hit.u = (hit.u*hit.n + p.u)/(hit.n+1); hit.v = (hit.v*hit.n + p.v)/(hit.n+1); hit.n++; hit.pts.push(p); }
    else clusters.push({u: p.u, v: p.v, n: 1, pts: [p]});
  }
  clusters.sort((a, b) => b.n - a.n);
  const plate = clusters[0];
  if (!plate) continue;
  // sample the plate's uv points (stride), keep as [u,v] pairs
  const stride = Math.max(1, Math.floor(plate.pts.length / 60));
  const pts = plate.pts.filter((_, i) => i % stride === 0).map(p => [+p.u.toFixed(5), +p.v.toFixed(5)]);
  nails[finger] = { pts, count: plate.n };
  console.log(finger, "verts", verts.length, "bright", bright.length, "clusters", clusters.length,
    "plate n", plate.n, "uv center", plate.u.toFixed(3), plate.v.toFixed(3), "emitted pts", pts.length);
}
fs.writeFileSync("customized-hands/nail-region.json", JSON.stringify(nails));
console.log("wrote customized-hands/nail-region.json");
