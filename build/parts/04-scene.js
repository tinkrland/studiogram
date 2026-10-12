// ===== renderer, scene, lighting, backdrop, dof composite =====
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const viewport = $("#viewport");
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(S.live.fov, 1, 30, 2500);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 90; controls.maxDistance = 900;

// environment map for metal reflections (deterministic, generated once)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

// lights: three named lights plus hemispheric ambience. values live in state.
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
    l.visible = st.on;
    if (!st.on) continue;
    l.color.set(st.color);
    l.intensity = st.intensity;
    l.position.copy(azToPos(st.azimuth, st.elevation, 620));
  }
  hemi.intensity = AMBIENCE[L.ambience];
}

// backdrop: plain seamless studio backdrop, center lifted
let backdropMesh = null;
function backdropTexture(name) {
  const b = BACKDROPS[name];
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 400;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = b.bg; ctx.fillRect(0, 0, 512, 400);
  const g = ctx.createRadialGradient(256, 168, 30, 256, 190, 340);
  g.addColorStop(0, b.center); g.addColorStop(1, b.bg);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 400);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function applyEnvironment() {
  if (backdropMesh) { scene.remove(backdropMesh); backdropMesh.geometry.dispose(); backdropMesh.material.map.dispose(); backdropMesh.material.dispose(); }
  const geo = new THREE.PlaneGeometry(2400, 1700);
  const mat = new THREE.MeshBasicMaterial({ map: backdropTexture(S.environment.backdrop) });
  backdropMesh = new THREE.Mesh(geo, mat);
  backdropMesh.position.set(0, 260, -620);
  scene.add(backdropMesh);
  scene.background = new THREE.Color(BACKDROPS[S.environment.backdrop].bg);
}

// dof composite: scene -> hdr target with depth, then a fullscreen pass that
// applies circle-of-confusion blur from the focallength/focaldistance trio and
// tone maps. supersampling gives the antialias.
const SS = 1.5;
let rt = null, rtDepth = null;
const compScene = new THREE.Scene();
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const compMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null }, tDepth: { value: null },
    uNear: { value: 30 }, uFar: { value: 2500 },
    uFocus: { value: 330 }, uAperture: { value: 0.2 }, uMaxPx: { value: 30 }, uTexel: { value: new THREE.Vector2(1, 1) }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    #include <packing>
    varying vec2 vUv;
    uniform sampler2D tColor; uniform sampler2D tDepth;
    uniform float uNear, uFar, uFocus, uAperture, uMaxPx;
    uniform vec2 uTexel;
    vec3 tone(vec3 c){
      c *= 1.05;
      c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
      return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
    }
    void main(){
      vec4 base = texture2D(tColor, vUv);
      float d = texture2D(tDepth, vUv).x;
      float dist = -perspectiveDepthToViewZ(d, uNear, uFar);
      float coc = clamp(abs(dist - uFocus) / max(uFocus * 0.9, 40.0), 0.0, 1.0);
      float r = coc * coc * uAperture * uMaxPx;
      vec3 col = base.rgb;
      if (r > 0.6) {
        vec3 sum = base.rgb; float w = 1.0;
        for (int i = 1; i <= 22; i++) {
          float fi = float(i);
          float ang = fi * 2.39996;
          float rr = sqrt(fi / 22.0) * r;
          vec2 off = vec2(cos(ang), sin(ang)) * rr * uTexel;
          sum += texture2D(tColor, vUv + off).rgb; w += 1.0;
        }
        col = sum / w;
      }
      gl_FragColor = vec4(tone(col), 1.0);
    }`
  ,
  depthTest: false, depthWrite: false
});
compScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), compMat));

function apertureFromFocalLength(fl) {
  const t = Math.min(Math.max((fl - 24) / 111, 0), 1);
  return Math.pow(t, 1.3);
}

function renderFrame() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  if (!rt || rt.width !== Math.round(w * SS)) {
    if (rt) { rt.dispose(); rtDepth.dispose(); }
    rt = new THREE.WebGLRenderTarget(Math.round(w * SS), Math.round(h * SS), { type: THREE.HalfFloatType });
    rtDepth = new THREE.DepthTexture(Math.round(w * SS), Math.round(h * SS));
    rt.depthTexture = rtDepth;
  }
  const activeCam = activeCamera();
  compMat.uniforms.tColor.value = rt.texture;
  compMat.uniforms.tDepth.value = rtDepth;
  compMat.uniforms.uNear.value = activeCam.near;
  compMat.uniforms.uFar.value = activeCam.far;
  compMat.uniforms.uFocus.value = S.live.focaldistance;
  compMat.uniforms.uAperture.value = apertureFromFocalLength(S.live.focallength);
  compMat.uniforms.uTexel.value.set(1 / rt.width, 1 / rt.height);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, activeCam);
  renderer.setRenderTarget(null);
  renderer.render(compScene, compCam);
}

function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pinnedHelper.aspect = w / h;
  pinnedHelper.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

// ===== camera modes: free exploratory orbit, pinned deterministic shots =====
function activeCamera() {
  if (S.live.mode === "pinned") {
    const c = S.cameras.find((x) => x.name === S.live.pinned);
    if (c) {
      pinnedHelper.fov = c.fov;
      pinnedHelper.position.set(...c.position);
      pinnedHelper.lookAt(...c.target);
      pinnedHelper.updateProjectionMatrix();
      return pinnedHelper;
    }
    S.live.mode = "orbit";
  }
  camera.fov = S.live.fov;
  camera.position.set(...S.live.position);
  camera.lookAt(...S.live.target);
  camera.updateProjectionMatrix();
  return camera;
}
const pinnedHelper = new THREE.PerspectiveCamera(30, 1, 30, 2500);

controls.addEventListener("change", () => {
  if (S.live.mode === "pinned") { S.live.mode = "orbit"; syncModeBadge(); }
  S.live.position = [round(camera.position.x), round(camera.position.y), round(camera.position.z)];
  S.live.target = [round(controls.target.x), round(controls.target.y), round(controls.target.z)];
  updateVpOverlay(); saveState();
});
const round = (v) => Math.round(v * 10) / 10;

function syncModeBadge() {
  $("#vpmode").textContent = S.live.mode === "pinned" ? `pinned: ${S.live.pinned}` : "free orbit";
}
function updateVpOverlay() {
  const n = S.jewelry.length;
  $("#vpoverlay").innerHTML =
    `<b>studiogram</b> · ${n} artifact${n === 1 ? "" : "s"} in scene<br>` +
    `fov ${S.live.fov.toFixed(0)} · focallength ${S.live.focallength} · focaldistance ${S.live.focaldistance}`;
}
