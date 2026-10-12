import { createRequire } from "node:module";
const require = createRequire(new URL("../package.json", import.meta.url));
const THREE = require("three");
function latheProfileBand(Ri, W, T, B) {
  const pts = [
    [Ri, -W / 2 + B], [Ri, W / 2 - B], [Ri + B * 0.6, W / 2], [Ri + T - B, W / 2],
    [Ri + T, W / 2 - B], [Ri + T, -W / 2 + B], [Ri + T - B, -W / 2], [Ri + B * 0.6, -W / 2],
    [Ri, -W / 2 + B]
  ];
  return pts.map(([x, y]) => new THREE.Vector2(x, y));
}
const spec = { inner_radius_mm: 8.9, width_mm: 3.2, thickness_mm: 1.7, bevel_mm: 0.35 };
const geo = new THREE.LatheGeometry(latheProfileBand(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm), 96);
const pos = geo.attributes.position, nor = geo.attributes.normal;
// outer face vertices: radius = sqrt(x^2+z^2) ~ 10.6
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
  const r = Math.sqrt(x * x + z * z);
  if (r > 10.55) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    const nr = Math.sqrt(nx * nx + nz * nz);
    console.log("outer vert r=" + r.toFixed(2), "pos y=" + y.toFixed(2), "normal=(" + nx.toFixed(2) + "," + ny.toFixed(2) + "," + nz.toFixed(2) + ")",
      "radial component sign:", Math.sign((nx * x + nz * z) / r).toFixed(0), nr > 0 ? "(radial)" : "(axial)");
    break;
  }
}
// inner face vertices: radius ~ 8.9
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
  const r = Math.sqrt(x * x + z * z);
  if (r < 8.95 && Math.abs(y) < 1.0) {
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    console.log("inner vert r=" + r.toFixed(2), "pos y=" + y.toFixed(2), "normal=(" + nx.toFixed(2) + "," + ny.toFixed(2) + "," + nz.toFixed(2) + ")",
      "radial sign:", Math.sign((nx * x + nz * z) / r).toFixed(0), "(should be -1, pointing inward from the band toward the finger)");
    break;
  }
}
// triangle winding: compute one triangle's geometric normal on the outer face and compare with outward radial
const idx = geo.index.array;
function triNormal(a, b, c) {
  const A = new THREE.Vector3(pos.getX(a), pos.getY(a), pos.getZ(a));
  const B = new THREE.Vector3(pos.getX(b), pos.getY(b), pos.getZ(b));
  const C = new THREE.Vector3(pos.getX(c), pos.getY(c), pos.getZ(c));
  return new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(C, A)).normalize();
}
// find a triangle whose vertices all have r > 10.5 (outer face)
for (let t = 0; t < idx.length; t += 3) {
  const rs = [0, 1, 2].map((k) => {
    const i = idx[t + k];
    return Math.hypot(pos.getX(i), pos.getZ(i));
  });
  if (rs.every((r) => r > 10.5)) {
    const n = triNormal(idx[t], idx[t + 1], idx[t + 2]);
    const cx = (pos.getX(idx[t]) + pos.getX(idx[t + 1]) + pos.getX(idx[t + 2])) / 3;
    const cz = (pos.getZ(idx[t]) + pos.getZ(idx[t + 1]) + pos.getZ(idx[t + 2])) / 3;
    const dot = (n.x * cx + n.z * cz) / Math.hypot(cx, cz);
    console.log("outer triangle geometric normal radial dot:", dot.toFixed(2), "(>0 = front faces outward = visible from outside)");
    break;
  }
}
