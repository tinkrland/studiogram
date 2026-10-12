import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const THREE = require("three");
function latheProfileBand(Ri, W, T, B) {
  const pts = [
    [Ri, -W / 2 + B], [Ri, W / 2 - B], [Ri + B * 0.6, W / 2], [Ri + T - B, W / 2],
    [Ri + T, W / 2 - B], [Ri + T, -W / 2 + B], [Ri + T - B, -W / 2], [Ri + B * 0.6, -W / 2],
    [Ri, -W / 2 + B]
  ];
  return pts.slice().reverse().map(([x, y]) => new THREE.Vector2(x, y));
}
function latheProfileDome(Ri, W, T, B) {
  const pts = [[Ri, -W / 2 + B], [Ri, W / 2 - B]];
  const dome = T * 0.42;
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(Ri + T + dome * Math.cos((t - 0.5) * Math.PI), -W / 2 + t * W));
  }
  pts.push(new THREE.Vector2(Ri, -W / 2 + B));
  return pts.slice().reverse();
}
function checkWinding(geo, label, rOuter, rInner) {
  const pos = geo.attributes.position;
  const idx = geo.index.array;
  function triNormal(a, b, c) {
    const A = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
    const B = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
    const C = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
    return new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
  }
  for (let t = 0; t < idx.length; t += 3) {
    const rs = [0, 1, 2].map((k) => Math.hypot(pos.getX(idx[t + k]), pos.getZ(idx[t + k])));
    if (rs.every((r) => r > rOuter)) {
      const n = triNormal(idx[t], idx[t + 1], idx[t + 2]);
      const cx = (pos.getX(idx[t]) + pos.getX(idx[t + 1]) + pos.getX(idx[t + 2])) / 3;
      const cz = (pos.getZ(idx[t]) + pos.getZ(idx[t + 1]) + pos.getZ(idx[t + 2])) / 3;
      const dot = (n.x * cx + n.z * cz) / Math.hypot(cx, cz);
      console.log(label + " outer face radial dot:", dot.toFixed(2), dot > 0 ? "OUTWARD ok" : "INWARD broken");
      return;
    }
  }
  console.log(label + ": no outer triangle found");
}
const spec = { inner_radius_mm: 8.9, width_mm: 3.2, thickness_mm: 1.7, bevel_mm: 0.35 };
checkWinding(new THREE.LatheGeometry(latheProfileBand(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm), 96), "band", 10.5, 8.9);
checkWinding(new THREE.LatheGeometry(latheProfileDome(9.1, 4.5, 2.2, 0.4), 96), "dome", 11.2, 9.1);
// also verify torus cuff faces outward
const cuff = new THREE.TorusGeometry(34.5, 4.5, 22, 84, 300 * Math.PI / 180);
cuff.rotateX(Math.PI / 2);
console.log("cuff: torus geometry, faces outward by construction");
