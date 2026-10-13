  backdropMesh = new THREE.Mesh(geo, mat);
  backdropMesh.position.set(0, 260, -620);
  scene.add(backdropMesh);
  scene.background = new THREE.Color(S.environment.bg);
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
  // focus follows the active camera: pinned shots use the focus the pinned
  // camera recorded, so the blurred backdrop is the set the creator pinned.
  // live orbit uses the sliders. otherwise a stale slider would bleed into
  // every pinned render and its deterministic reproduction.
  const [lensFl, lensFd] = activeLens();
  compMat.uniforms.uFocus.value = lensFd;
  compMat.uniforms.uAperture.value = apertureFromFocalLength(lensFl);
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

