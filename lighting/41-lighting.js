const LIGHTS = {};
for (const name of ["key", "fill", "rim"]) {
  const l = new THREE.DirectionalLight(0xffffff, 1);
  l.castShadow = name === "key";
  if (l.castShadow) {
    l.shadow.mapSize.set(2048, 2048);
    const c = l.shadow.camera; c.left = -160; c.right = 160; c.top = 260; c.bottom = -120; c.near = 50; c.far = 1300;
    l.shadow.bias = -0.0004; l.shadow.radius = 4;
  }
  scene.add(l); LIGHTS[name] = l;
}
const hemi = new THREE.HemisphereLight(0xf5efe6, 0x3a3630, 1);
scene.add(hemi);

function applyLighting() {
  const L = S.lighting;
  const azToPos = (az, el, dist) => {
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist);
  };
  for (const name of ["key", "fill", "rim"]) {
    const st = L[name], l = LIGHTS[name];
