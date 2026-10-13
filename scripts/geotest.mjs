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
const spec = { kind: "band", inner_radius_mm: 8.9, width_mm: 3.2, thickness_mm: 1.7, bevel_mm: 0.35 };
const geo = new THREE.LatheGeometry(latheProfileBand(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm), 96);
geo.computeBoundingBox();
console.log("vertices:", geo.attributes.position.count);
console.log("bbox min:", geo.boundingBox.min.toArray().map(n=>n.toFixed(2)).join(", "));
console.log("bbox max:", geo.boundingBox.max.toArray().map(n=>n.toFixed(2)).join(", "));
const scene = new THREE.Scene();
const att = new THREE.Object3D(); att.position.y = 7.7;
const mcp = new THREE.Object3D(); mcp.position.set(0, 88, 0);
mcp.add(att); scene.add(mcp);
const mesh = new THREE.Mesh(geo);
att.add(mesh);
scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(att);
console.log("world box center:", box.getCenter(new THREE.Vector3()).toArray().map(n=>n.toFixed(2)).join(", "));
console.log("box empty:", box.isEmpty());
const cam = new THREE.PerspectiveCamera(26, 1, 30, 2500);
cam.position.set(95, 150, 300); cam.lookAt(0, 105, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
const ndc = box.getCenter(new THREE.Vector3()).clone().project(cam);
console.log("ndc:", ndc.toArray().map(n=>n.toFixed(3)).join(", "));
