// shared glb reader for the extraction scripts: positions, skin weights and
// inverse bind matrices of the single skinned hand mesh, plus a helper that
// returns the vertices dominated by one bone in that bone's local bind frame.
const fs = require("fs");
const b = fs.readFileSync("assets/hand.glb");
const jlen = b.readUInt32LE(12);
const J = JSON.parse(b.slice(20, 20 + jlen).toString());
const binStart = 20 + jlen + 8;
const acc = (i) => {
  const a = J.accessors[i], bv = J.bufferViews[a.bufferView];
  const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
  const comp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  const sz = a.componentType === 5126 ? 4 : a.componentType === 5123 ? 2 : 1;
  const buf = b.buffer.slice(b.byteOffset + off, b.byteOffset + off + a.count * comp * sz);
  const arr = a.componentType === 5126 ? new Float32Array(buf) : a.componentType === 5123 ? new Uint16Array(buf) : new Uint8Array(buf);
  return { n: a.count, comp, arr };
};
const prim = J.meshes[0].primitives[0];
const pos = acc(prim.attributes.POSITION);
const nor = acc(prim.attributes.NORMAL);
const jo = acc(prim.attributes.JOINTS_0), we = acc(prim.attributes.WEIGHTS_0);
const ibm = acc(J.skins[0].inverseBindMatrices);
const jn = (i) => J.nodes[J.skins[0].joints[i]].name.replace(/\./g, "");
const distal = { finger_index03L: "index", finger_middle03L: "middle", finger_ring03L: "ring", finger_pinky03L: "pinky", thumb03L: "thumb" };
const toLocal = (j, p) => { const m = ibm.arr.subarray(j * 16, j * 16 + 16);
  return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12], m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13], m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; };
const toLocalDir = (j, d) => { const m = ibm.arr.subarray(j * 16, j * 16 + 16);
  return [m[0]*d[0]+m[4]*d[1]+m[8]*d[2], m[1]*d[0]+m[5]*d[1]+m[9]*d[2], m[2]*d[0]+m[6]*d[1]+m[10]*d[2]]; };
function jointIndex(boneName) { return J.skins[0].joints.findIndex((_, k) => jn(k) === boneName); }
// vertices whose dominant joint is `ji` (weight >= minW), in the joint's local frame
function boneVerts(ji, minW = 0.5) {
  const out = [];
  for (let v = 0; v < pos.n; v++) {
    let best = -1, bw = 0;
    for (let k = 0; k < 4; k++) { const w = we.arr[v*4+k]; if (w > bw) { bw = w; best = jo.arr[v*4+k]; } }
    if (best !== ji || bw < minW) continue;
    out.push({ v, p: toLocal(ji, [pos.arr[v*3], pos.arr[v*3+1], pos.arr[v*3+2]]),
               n: toLocalDir(ji, [nor.arr[v*3], nor.arr[v*3+1], nor.arr[v*3+2]]) });
  }
  return out;
}
module.exports = { J, pos, nor, jo, we, ibm, jn, distal, toLocal, toLocalDir, jointIndex, boneVerts };
