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

