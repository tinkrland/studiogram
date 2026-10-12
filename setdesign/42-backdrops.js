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
function backdropTexture() {
  // renders the live environment values: a preset is a prefill on these same
  // values, never a separate rendering path
  const b = S.environment;
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
  const mat = new THREE.MeshBasicMaterial({ map: backdropTexture() });
