// ===== self test (only with #selftest in the url) =====
// renders the band with an unambiguous flat magenta material and counts the
// pixels that reach the frame, so placement and visibility are checkable
// without human eyes on the canvas.
async function runSelfTest() {
  S = defaultState();
  await loadHandModel();
  applyLighting();
  applyEnvironment();
  camera.position.set(...S.live.position);
  controls.target.set(...S.live.target);
  await addJewelryInstance(REGISTRY[0].release_id, "gold_14k_yellow");
  applyPosePreset("presenting");
  const results = [];
  results.push("build marker: rigged-hand-1");
  results.push("bones: " + HAND.boneCount + ", skinned verts: " + HAND.skinned.geometry.attributes.position.count);
  results.push("bone names: " + [...HAND.bones.keys()].join(", "));
  results.push("ring bone found: " + !!HAND.bones.get("finger_ring01L") + ", bone len: " + (HAND.boneLen.get("ring") || 0).toFixed(4));
  const j = [...JEWELRY.values()][0];
  results.push("ring mesh source: " + (j?.source || "none"));
  const g = j.group;
  let mesh = null;
  g.traverse((o) => { if (o.isMesh) mesh = o; });
  if (mesh) mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  settleSlides(); // probes measure the seated piece, not a mid-slide view
  renderFrame();
  camera.updateMatrixWorld();
  g.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(g);
  results.push("ring box empty: " + box.isEmpty() + ", center: " + box.getCenter(new THREE.Vector3()).toArray().map((n) => n.toFixed(1)).join(", "));
  const ndc = box.getCenter(new THREE.Vector3()).project(camera);
  results.push("ring ndc: " + ndc.toArray().map((n) => n.toFixed(2)).join(", "));
  const png = await renderPng(400);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; });
  const cv = document.createElement("canvas"); cv.width = cv.height = 400;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, 400, 400).data;
  let magenta = 0, skin = 0, total = 0;
  for (let i = 0; i < d.length; i += 4) {
    total++;
    if (d[i] > 150 && d[i + 2] > 150 && d[i + 1] < 120) magenta++;
    if (d[i] > 60 && d[i] > d[i + 2] + 8 && d[i + 1] > d[i + 2] - 12) skin++;
  }
  results.push("magenta pixels in 400px render: " + magenta);
  results.push("skin pixels in 400px render: " + skin + " of " + total);

  // stacking: a second piece at the same location auto-stacks, then a reorder
  // must exchange the two seat offsets exactly
  const first = S.jewelry[0];
  await addJewelryInstance(REGISTRY[4].release_id, "gold_14k_yellow");
  const second = S.jewelry[1];
  results.push("auto-stack offsets: " + first.offset_mm.toFixed(1) + ", " + second.offset_mm.toFixed(1));
  const swapped = reorderJewelry(second.iid, "hand");
  results.push("reorder exchanged offsets: " + swapped + " -> " + first.offset_mm.toFixed(1) + ", " + second.offset_mm.toFixed(1));
  const noMove = reorderJewelry(second.iid, "hand");
  results.push("reorder at stack end refused: " + !noMove);

  // manual environment: the editable values must drive the render, proving a
  // preset is a prefill and not a separate rendering path
  S.environment = { bg: "#3d6b4a", center: "#3d6b4a", preset: "manual green" };
  applyEnvironment();
  const pngEnv = await renderPng(400);
  const imgE = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = pngEnv; });
  const cvE = document.createElement("canvas"); cvE.width = cvE.height = 400;
  const ctxE = cvE.getContext("2d"); ctxE.drawImage(imgE, 0, 0);
  const dE = ctxE.getImageData(0, 0, 400, 400).data;
  let green = 0;
  for (let i = 0; i < dE.length; i += 4) if (dE[i] > 40 && dE[i] < 100 && dE[i + 1] > 80 && dE[i + 2] < 90) green++;
  results.push("manual backdrop green pixels: " + green);

  // seat clamp: pressing a piece toward the hand into an occupied band seats
  // it at contact clearance (neighbor offset + width + 0.25mm)
  const clamped = applySeat(second, first.offset_mm);
  const expectSeat = Math.round((first.offset_mm + pieceWidthMm(byRelease.get(first.release_id)) + 0.25) * 10) / 10;
  results.push("seat clamp at contact: " + clamped.toFixed(1) + " (expected " + expectSeat.toFixed(1) + ")");
  applySeat(second, 0); // restore the stack order for the rest of the run

  // slide-on transitions are view-only: transition-on and transition-off
  // adds end at identical state hashes. iids are random identifiers, not
  // quantitative truth, so the comparison normalizes them away.
  const normalizedState = () => JSON.parse(JSON.stringify(sceneCoreState(), (k, v) => (k === "iid" ? "j" : v)));
  localStorage.setItem("studiogram_transitions", "off");
  await addJewelryInstance(REGISTRY[2].release_id, "silver_925");
  const third = S.jewelry[2];
  const hashNoSlide = await sha256hex(normalizedState());
  removeJewelryInstance(third.iid);
  localStorage.setItem("studiogram_transitions", "on");
  await addJewelryInstance(REGISTRY[2].release_id, "silver_925");
  const hashSlide = await sha256hex(normalizedState());
  removeJewelryInstance(S.jewelry[2].iid);
  results.push("transition on/off hashes equal: " + (hashNoSlide === hashSlide));

  // photos: a photo from a named camera keeps the take-time values. reframe
  // the camera afterwards, reproduce, and the frame must not change.
  // the magenta paint above was a view-only probe: rebuild the piece from
  // state first, or the repro would rightly restore the real material.
  await buildJewelryInstance(first);
  S.cameras.push({ name: "selftest cam", position: [140, 260, 460], target: [-15, 100, 40], fov: 26, focallength: 50, focaldistance: 475 });
  S.live = { ...S.live, mode: "pinned", pinned: "selftest cam" };
  syncModeBadge();
  const photo = await captureFrame();
  const photoBackToBack = await captureFrame();
  results.push("back-to-back takes byte-equal: " + (CAPTURE_IMG.get(photoBackToBack.id) === CAPTURE_IMG.get(photo.id)));
  deleteCapture(photoBackToBack);
  results.push("photo camera name: " + photo.camera.name + ", mode: " + photo.camera.mode);
  results.push("photo gate record: " + JSON.stringify(photo.gate));
  const takePng = CAPTURE_IMG.get(photo.id);
  S.cameras.find((c) => c.name === "selftest cam").position = [300, 400, 500];
  S.cameras.find((c) => c.name === "selftest cam").fov = 40;
  await reproduceCapture(photo);
  const reproPng = CAPTURE_IMG.get(photo.id);
  results.push("photo survives camera reframe (values are truth): " + (takePng === reproPng));
  if (takePng !== reproPng) {
    const px = async (url) => { const i = await new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = url; }); const c = document.createElement("canvas"); c.width = c.height = 400; const x = c.getContext("2d"); x.drawImage(i, 0, 0, 400, 400); return x.getImageData(0, 0, 400, 400).data; };
    const a = await px(takePng), b = await px(reproPng);
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) diff++;
    results.push("photo take-vs-repro diff pixels: " + diff);
  }

  // capture sets: per-set numbering, and export filenames derive from set + photo
  S.sets.push({ id: "set2", name: "detail study", photo_ids: [] });
  S.active_set = "set2";
  const photo2 = await captureFrame();
  results.push("second set numbering restarts: " + photo2.name + " in " + activeSet().name);
  results.push("export filename: " + exportFilename(photo2));
  S.active_set = "set1";
  S.cameras = S.cameras.filter((c) => c.name !== "selftest cam");
  S.live = { ...S.live, mode: "orbit" };
  controls.enabled = true; syncModeBadge();
  deleteCapture(photo);
  deleteCapture(photo2);
  S.sets = S.sets.filter((x) => x.id !== "set2");

  const div = document.createElement("div");
  div.id = "selftest";
  div.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:200;background:#111;color:#9fd99f;padding:12px;font:12px ui-monospace,monospace;white-space:pre;border:1px solid #4a4;";
  div.textContent = "studiogram selftest\n" + results.join("\n");
  document.body.appendChild(div);
  localStorage.removeItem("studiogram_state");
}

// audit mode: inspects the real boot flow's scene instead of building its own,
// so a divergence between selftest and normal boot shows up as numbers.
async function runSceneAudit() {
  const results = [];
  results.push("HAND.loaded: " + HAND.loaded);
  results.push("camera pos: " + camera.position.toArray().map((n) => n.toFixed(1)).join(", ") + ", target: " + controls.target.toArray().map((n) => n.toFixed(1)).join(", "));
  results.push("live: " + JSON.stringify({ position: S.live.position, target: S.live.target, mode: S.live.mode }));
  results.push("pose preset: " + S.pose.preset + ", wrist: " + JSON.stringify(S.pose.wrist));
  results.push("environment: preset " + S.environment.preset + ", edge " + S.environment.bg + ", center " + S.environment.center);
  results.push("capture sets: " + S.sets.map((x) => x.name + " (" + x.photo_ids.length + ")").join(", ") + " · active: " + activeSet().name);
  results.push("finger radii mm: " + (HAND.fingerR.size ? [...HAND.fingerR].map(([f, r]) => f.slice(0, 3) + " " + r.toFixed(1)).join(" ") : "not sampled"));
  if (HAND.loaded) {
    HAND.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(HAND.model);
    // the camera the renderer actually uses: the orbit camera in free mode,
    // the pinned helper for a shot. projections below must go through it.
    const ac = activeCamera(); ac.updateMatrixWorld(true);
    results.push("morph targets: " + (HAND.skinned && HAND.skinned.morphTargetDictionary ? Object.keys(HAND.skinned.morphTargetDictionary).join(", ") : "none"));
  results.push("morph active: " + S.hand.presentation + " · build " + S.hand.morph.build + " · ft " + S.hand.morph.finger_thickness + " · nails " + S.hand.morph.nail_length + "/" + S.hand.morph.nail_shape);
  results.push("surface: finish " + S.hand.finish + " · tone " + S.hand.skin.tone + " · hair " + S.hand.skin.hair);
  results.push("nails: " + (S.hand.nails?.style || "natural") + (S.hand.nails?.style === "polished" ? " " + (S.hand.nails.color || "#b23a48") : ""));
  {
    // center-ray probe: the exact ray a screen-center click casts, against
    // the posed skinned hand. ground truth for placement raycasts. probed
    // through the active camera so a pinned shot audits what it renders.
    results.push("active camera: " + (S.live.mode === "pinned" ? "pinned " + S.live.pinned : "orbit") + " · fov " + ac.fov.toFixed(0));
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(0, 0), ac);
    const hit = rc.intersectObject(HAND.skinned, false)[0];
    results.push("center ray: " + (hit
      ? "hit uv " + hit.uv.x.toFixed(3) + "," + hit.uv.y.toFixed(3) + " dist " + Math.round(hit.distance)
      : "misses the skinned hand"));
  }
  results.push("tattoos: " + (S.hand.tattoos?.length || 0) +
    (S.hand.tattoos?.length ? " · " + S.hand.tattoos.map((t) => t.design + " @" + t.u.toFixed(2) + "," + t.v.toFixed(2)).join(" ") : ""));
  results.push("hand bbox world: " + (box.isEmpty() ? "EMPTY" : "min " + box.min.toArray().map((n) => n.toFixed(0)).join(",") + " max " + box.max.toArray().map((n) => n.toFixed(0)).join(",")));
    const p = HAND.skinned.geometry.attributes.position;
    results.push("skinned verts: " + p.count + ", visible: " + HAND.skinned.visible + ", culling: " + HAND.skinned.frustumCulled);
    const ndc = box.getCenter(new THREE.Vector3()).project(ac);
    results.push("hand center ndc: " + ndc.toArray().map((n) => n.toFixed(2)).join(", "));
  } else results.push("hand NOT loaded");
  let meshCount = 0, ring = null;
  scene.traverse((o) => { if (o.isMesh) meshCount++; });
  for (const j of JEWELRY.values()) j.group.traverse((o) => { if (o.isMesh) ring = o; });
  results.push("meshes in scene: " + meshCount + ", ring mesh: " + !!ring + (ring ? ", ring parent type " + ring.parent.parent.type : ""));
  results.push("jewelry: " + ([...JEWELRY.values()].map((j) =>
    (j.rec?.name || "?") + " v" + (j.rec?.version ?? "?") + " (" + j.source + ")").join(" | ") || "none in scene"));
  const png = await renderPng(400);
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; });
  const cv = document.createElement("canvas"); cv.width = cv.height = 400;
  const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, 400, 400).data;
  let backdropish = 0, dark = 0, other = 0;
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (r > 150 && g > 145 && b > 130) backdropish++;
    else if (r < 90 && g < 90 && b < 90) dark++;
    else other++;
  }
  results.push("pixels: backdropish " + backdropish + ", dark " + dark + ", other " + other);
  const div = document.createElement("div");
  div.id = "selftest";
  div.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:200;background:#111;color:#9fd99f;padding:12px;font:12px ui-monospace,monospace;white-space:pre;border:1px solid #4a4;";
  div.textContent = "studiogram audit\n" + results.join("\n");
  document.body.appendChild(div);
}

(async function boot() {
  resize();
  if (location.hash.includes("selftest")) {
    await runSelfTest();
    function animate() { requestAnimationFrame(animate); if (S.live.mode === "orbit") controls.update(); renderFrame(); }
    animate();
    return;
  }
  const restored = restoreFromStorage();
  if (restored) {
    await applyFullState(restored, { restoring: true });
  } else {
    buildHand();
    applyLighting();
    applyEnvironment();
    camera.position.set(...S.live.position);
    controls.target.set(...S.live.target);
    // a clean starting subject: the plain band on the ring finger, presented
    applyPosePreset("presenting");
    await addJewelryInstance(REGISTRY[0].release_id, "gold_14k_yellow");
  }
  await verifyRegistry();
  renderGateEntries();
  renderPanel("subject");
  if (location.hash.includes("audit")) setTimeout(runSceneAudit, 9000);
  renderCaptureStrip();
  updateVpOverlay();
  syncModeBadge();

  function animate() {
    requestAnimationFrame(animate);
    if (S.live.mode === "orbit") controls.update();
    renderFrame();
  }
  animate();
})();

