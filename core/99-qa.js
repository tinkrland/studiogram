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
  results.push("hand root singular: " + (HAND.root.parent.children.filter((c) => c.name === "hand").length === 1) + " (a boot race used to leak a ghost)");
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
  const png = await renderPng(400, 400);
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

  // nails ride the dorsal side: polish must show from the back of the hand
  // and not from the palm (the first frames dressed the pad side instead)
  {
    const countPolish = async (fromZ) => {
      camera.position.set(fromZ * 420, 260, fromZ > 0 ? 420 : -420);
      camera.position.set(fromZ > 0 ? 180 : -180, 260, fromZ * 420);
      controls.target.set(-15, 100, 40); controls.update(); renderFrame();
      const png = await renderPng(400, 400);
      const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = png; });
      const cv = document.createElement("canvas"); cv.width = cv.height = 400;
      const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, 400, 400).data;
      let c = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 80 && d[i + 2] < 110) c++;
      return c;
    };
    const keepStyle = S.hand.nails.style, keepColor = S.hand.nails.color;
    S.hand.nails.style = "polished"; S.hand.nails.color = "#ff0040";
    applyNails();
    const dorsal = await countPolish(+1), palm = await countPolish(-1);
    results.push("nails dorsal: " + (dorsal > 200 && palm < dorsal / 20) + " (dorsal view " + dorsal + " polish px, palm view " + palm + ")");
    S.hand.nails.style = keepStyle; S.hand.nails.color = keepColor;
    applyNails();
    camera.position.set(...S.live.position); controls.target.set(...S.live.target);
  }

  // props: set dressing renders as scene objects with provenance in state
  {
    S.props = [
      { id: "pt1", prop: "ottoman", x: 300, z: -400, rotY: 15, scale: 1.2, provenance: { source: "authored placeholder", method: "procedural", ts: "2026-10-17T00:00:00Z" } },
      { id: "pt2", prop: "vase", x: -350, z: -300, rotY: 0, scale: 1, provenance: { source: "authored placeholder", method: "procedural", ts: "2026-10-17T00:00:00Z" } }
    ];
    applyProps();
    const group = scene.getObjectByName("props");
    const placed = group ? group.children.filter((c) => (c.name || "").startsWith("prop_")) : [];
    let meshes = 0;
    if (group) group.traverse((o) => { if (o.isMesh) meshes++; });
    results.push("props render as scene objects: " + (placed.length === 2 && meshes === 3) + " (" + placed.length + " placed, " + meshes + " meshes: ottoman 2 + vase 1)");
    // clamps: a prop cannot be dragged toward the stage
    S.props[0].z = 50; S.props[0].scale = 9;
    applyProps();
    const clamped = S.props[0].z <= -180 && S.props[0].scale <= 2;
    results.push("props clamp to the backdrop band (z " + S.props[0].z + ", scale " + S.props[0].scale.toFixed(2) + "): " + clamped);
    // state round-trip: provenance travels
    const propsJson = JSON.stringify(S.props.map((q) => ({ ...q })));
    const restoredProps = JSON.parse(propsJson);
    results.push("props serialize with provenance: " + (restoredProps.length === 2 && restoredProps[0].provenance.method === "procedural"));
    S.props = [];
    applyProps();
    let remaining = 0;
    const g2 = scene.getObjectByName("props");
    if (g2) g2.traverse((o) => { if (o.isMesh) remaining++; });
    results.push("props clear with state: " + (remaining === 0));
  }

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
  const pngEnv = await renderPng(400, 400);
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
  $("#photo-size").value = "portrait"; // 4:5: the photo's chosen dimensions are part of its truth
  const photo = await captureFrame();
  const pngDims = (dataUrl) => new Promise((res) => { const i = new Image(); i.onload = () => res(i.naturalWidth + "x" + i.naturalHeight); i.src = dataUrl; });
  results.push("photo dimensions recorded: " + photo.width + "x" + photo.height);
  results.push("photo renders at its chosen dimensions: " + (await pngDims(CAPTURE_IMG.get(photo.id))) + " (expect 1080x1350)");
  const photoBackToBack = await captureFrame();
  results.push("back-to-back takes byte-equal: " + (CAPTURE_IMG.get(photoBackToBack.id) === CAPTURE_IMG.get(photo.id)));
  deleteCapture(photoBackToBack);
  results.push("photo camera name: " + photo.camera.name + ", mode: " + photo.camera.mode);
  // pinned depth of field comes from the pinned camera record, not the live
  // sliders: moving the sliders while pinned must not change the frame.
  const pinnedPng = await renderPng(200, 200);
  const saveFl = S.live.focallength, saveFd = S.live.focaldistance;
  S.live.focallength = 135; S.live.focaldistance = 120;
  const movedPng = await renderPng(200, 200);
  S.live.focallength = saveFl; S.live.focaldistance = saveFd;
  results.push("pinned render ignores live focus sliders: " + (pinnedPng === movedPng));
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
  // a photo from before this pass has no width/height: it reproduces at the
  // legacy square size instead of failing
  const legacy = { id: "legacy", name: "legacy square", camera: { ...photo.camera }, created_utc: nowUtc(), state_hash: photo.state_hash, snapshot: sceneCoreState(), gate: [] };
  await reproduceCapture(legacy);
  results.push("photo without recorded dimensions falls back to legacy square: " + (await pngDims(CAPTURE_IMG.get("legacy"))) + " (expect 1600x1600)");
  $("#photo-size").value = "viewport";
  S.active_set = "set1";
  S.cameras = S.cameras.filter((c) => c.name !== "selftest cam");
  S.live = { ...S.live, mode: "orbit" };
  controls.enabled = true; syncModeBadge();
  deleteCapture(photo);
  deleteCapture(photo2);
  S.sets = S.sets.filter((x) => x.id !== "set2");

  // nails: a real plate per finger, shape from the library, length from a slider
  {
    const reachMm = (shape, len, finger) => {
      S.hand.nails.shape = shape; S.hand.nails.length = len; applyNails();
      const m = NAIL.plates.get(finger), pp = m.geometry.attributes.position;
      let maxY = -1e9; for (let i = 0; i < pp.count; i++) maxY = Math.max(maxY, pp.getY(i));
      return (maxY - NAIL_FRAME[finger].tip) * 1000;
    };
    results.push("nail plates built for all five fingers: " + (NAIL.plates.size === 5));
    const r0 = reachMm("square", 0, "index"), r5 = reachMm("square", 0.5, "index"), r1 = reachMm("square", 1, "index");
    results.push("nail length slider extends the free edge monotonically: " + (r0 < r5 && r5 < r1) + " (" + r0.toFixed(1) + " / " + r5.toFixed(1) + " / " + r1.toFixed(1) + " mm)");
    const sty = reachMm("stiletto", 0.8, "index"), sqr = reachMm("square", 0.8, "index"), nat = reachMm("natural", 0.8, "index");
    results.push("natural nail ignores the length slider: " + (nat < 1.0) + " (" + nat.toFixed(1) + " mm)");
    results.push("stiletto reaches further than square at the same slider: " + (sty > sqr));
    const tipW = (shape) => {
      S.hand.nails.shape = shape; S.hand.nails.length = 0.8; applyNails();
      const pp = NAIL.plates.get("index").geometry.attributes.position, NU = 29, NV = pp.count / NU;
      return (pp.getX((NV - 1) * NU + 28) - pp.getX((NV - 1) * NU)) * 1000;
    };
    results.push("stiletto tip is narrower than square tip: " + (tipW("stiletto") < tipW("square") * 0.5) + " (" + tipW("stiletto").toFixed(1) + " vs " + tipW("square").toFixed(1) + " mm)");
    results.push("every library shape builds a finite plate: " + NAIL_SHAPE_ORDER.every((k) => { reachMm(k, 0.7, "middle"); const pp = NAIL.plates.get("middle").geometry.attributes.position; for (let i = 0; i < pp.count; i++) if (!Number.isFinite(pp.getX(i) + pp.getY(i) + pp.getZ(i))) return false; return true; }) + " (" + NAIL_SHAPE_ORDER.length + " shapes)");
    S.hand.nails.shape = "oval"; S.hand.nails.length = 0.3; applyNails();
  }
  // skin presets land on their swatch, sliders move the right way, old saves migrate
  {
    const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const keep = JSON.stringify(S.hand.skin), keepFinish = S.hand.finish;
    S.hand.finish = "skin"; applyFinish();
    const uv = HAND.skinned.geometry.attributes.uv; let worst = 0;
    for (const pr of SKIN_PRESETS) {
      S.hand.skin = { preset: pr.key, lightness: 0, warmth: 0, depth: 0, hair: 0 }; applySurface();
      const cv = HAND.surfaceCanvas.get(0), W = cv.width, d = cv.getContext("2d").getImageData(0, 0, W, W).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < uv.count; i++) { const o = (Math.min(W - 1, Math.floor(uv.getY(i) * W)) * W + Math.min(W - 1, Math.floor(uv.getX(i) * W))) * 4; r += d[o]; g += d[o + 1]; b += d[o + 2]; }
      const t = hexRgb(pr.hex); worst = Math.max(worst, Math.abs(r / uv.count - t[0]), Math.abs(g / uv.count - t[1]), Math.abs(b / uv.count - t[2]));
    }
    results.push("skin presets render within 8 levels of their swatch: " + (worst <= 8) + " (worst " + worst.toFixed(1) + ", " + SKIN_PRESETS.length + " presets)");
    const lum = (h) => { const c = hexRgb(h); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
    const at = (o) => { S.hand.skin = { preset: "tan", lightness: 0, warmth: 0, depth: 0, hair: 0, ...o }; return skinAlbedoHex(); };
    results.push("skin lightness slider orders correctly: " + (lum(at({ lightness: 0.5 })) > lum(at({})) && lum(at({})) > lum(at({ lightness: -0.5 }))));
    results.push("old skin.tone saves migrate to a preset: " + (migrateSkin({ tone: 0.4 }).preset === "bronze" && migrateSkin({ tone: 1 }).preset === "espresso" && migrateSkin({ tone: 0.4, hair: 0.2 }).hair === 0.2 && migrateSkin(undefined).preset === "golden"));
    S.hand.skin = JSON.parse(keep); S.hand.finish = keepFinish; applyFinish(); applySurface();
  }
  // orbit video recording: refused while pinned, the path is the record,
  // and export re-renders deterministically into all three containers
  S.cameras.push({ name: "selftest vid cam", position: [140, 260, 460], target: [-15, 100, 40], fov: 26, focallength: 50, focaldistance: 475 });
  S.live = { ...S.live, mode: "pinned", pinned: "selftest vid cam" };
  syncModeBadge();
  const refused = startRecording();
  results.push("recording refused while pinned: " + (refused === false));
  results.push("no record created on refusal: " + (S.recordings.length === 0));
  S.cameras = S.cameras.filter((c) => c.name !== "selftest vid cam");
  S.live = { ...S.live, mode: "orbit" };
  controls.enabled = true; syncModeBadge();
  camera.position.set(140, 260, 460);
  controls.target.set(-15, 100, 40);
  $("#rec-size").value = "square"; // the recording's chosen dimensions
  await new Promise((r) => setTimeout(r, 80));
  startRecording();
  results.push("record started: " + !!REC);
  const capBlocked = await captureFrame();
  results.push("photo capture blocked during take: " + (capBlocked === null));
  let prevEnv = null;
  // a scripted move: the camera sweeps in while the take runs, as zoom would
  for (let i = 1; i <= 5; i++) {
    camera.position.set(140 + i * 6, 260 + i * 3, 460 - i * 24);
    await new Promise((r) => setTimeout(r, 50));
    if (i === 2) { S.lighting.key.intensity = 3.7; applyLighting(); } // live lighting change, captured mid-take
    if (i === 3) { prevEnv = S.environment; S.environment = { bg: "#304a5e", center: "#4a6a86", preset: "mid-take set" }; applyEnvironment(); } // live backdrop change, captured mid-take
    if (i === 4) { $("#rec-size").value = "portrait"; $("#rec-size").dispatchEvent(new Event("change")); } // live framing switch, rooms.xyz-style
  }
  await new Promise((r) => setTimeout(r, 60));
  const vid = stopRecording();
  results.push("record created: " + (vid ? vid.name + " " + (vid.duration_ms / 1000).toFixed(1) + "s " + vid.path.length + " frames" : "none"));
  const moved = vid && vid.path.length > 1 && JSON.stringify(vid.path[0]) !== JSON.stringify(vid.path[vid.path.length - 1]);
  results.push("path moved across the take: " + moved);
  results.push("recording dimensions honored: " + (vid && vid.width === 1080 && vid.height === 1350) + " (" + (vid ? vid.width + "x" + vid.height : "none") + ", final framing)");
  const deltas = vid ? vid.path.filter((f) => f.lighting).length : 0;
  results.push("lighting change captured mid-take: " + (deltas >= 1) + " (" + deltas + " delta frames)");
  results.push("lighting carried to the last frame: " + (vid && pathLightingAt(vid, vid.path.length - 1).key.intensity === 3.7));
  const sizeDeltas = vid ? vid.path.filter((f) => f.size).length : 0;
  const lastSize = vid ? videoSizeAt(vid, vid.path.length - 1) : null;
  results.push("framing switch captured mid-take: " + (sizeDeltas >= 2) + " (" + sizeDeltas + " size delta frames, opening square -> portrait)");
  results.push("framing carried to the last frame: " + (lastSize && lastSize.key === "portrait" && lastSize.width === 1080 && lastSize.height === 1350));
  const envDeltas = vid ? vid.path.filter((f) => f.environment).length : 0;
  results.push("backdrop change captured mid-take: " + (envDeltas >= 1) + " (" + envDeltas + " delta frames)");
  // the record is deltas: the value in effect at the last frame is the
  // last change at or before it, same carry-forward the export applies
  const envAt = (rec, i) => { let e = rec.snapshot.environment; for (let j = 0; j <= i && j < rec.path.length; j++) if (rec.path[j].environment) e = rec.path[j].environment; return e; };
  const lastEnv = vid ? envAt(vid, vid.path.length - 1) : null;
  results.push("backdrop carried to the last frame: " + (lastEnv && lastEnv.preset === "mid-take set" && lastEnv.bg === "#304a5e"));
  if (prevEnv) { S.environment = JSON.parse(JSON.stringify(prevEnv)); applyEnvironment(); prevEnv = null; } // the take keeps its record; the session returns to its set
  results.push("record serialized in state: " + (serializeState(false).recordings.length === 1));
  const bufEq = (a, b) => a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === new Uint8Array(b)[i]);
  const brand = (b) => new TextDecoder().decode(new Uint8Array(b.slice(4, 10)));
  if (typeof window.VideoEncoder !== "undefined") {
    const w1 = await renderVideoBuffer(vid, "webm");
    const w2 = await renderVideoBuffer(vid, "webm");
    results.push("webm exports byte-identical: " + (w1.buffer && w2.buffer && bufEq(w1.buffer, w2.buffer)));
    const mp4 = await renderVideoBuffer(vid, "mp4");
    const mov = await renderVideoBuffer(vid, "mov");
    results.push("mp4 brand " + brand(mp4.buffer) + ", mov brand " + brand(mov.buffer));
    results.push("mp4/mov are sibling containers not copies: " + (mp4.buffer && mov.buffer && !bufEq(mp4.buffer, mov.buffer)));
    // demux what was written: the container must carry the whole path
    const { Input, BlobSource, MP4, WEBM } = await import("mediabunny");
    const trackOf = async (buf, type, formats) => {
      const input = new Input({ formats, source: new BlobSource(new Blob([buf], { type })) });
      const track = await input.getPrimaryVideoTrack();
      const stats = await track.computePacketStats();
      const codec = track.codec;
      input.dispose();
      return { codec, count: stats.packetCount };
    };
    const demuxMp4 = await trackOf(mp4.buffer, mp4.mime, [MP4]);
    const demuxWebm = await trackOf(w1.buffer, w1.mime, [WEBM]);
    results.push("mp4 demuxes: " + demuxMp4.codec + ", " + demuxMp4.count + " packets");
    results.push("webm demuxes: " + demuxWebm.codec + ", " + demuxWebm.count + " packets");
    results.push("demuxed frames match the path: " + (demuxMp4.count === vid.path.length && demuxWebm.count === vid.path.length));
  } else {
    results.push("webcodecs unavailable: export falls back to the live take only");
  }
  deleteRecording(vid);
  // import stays tolerant of saves that predate recordings
  const rawVid = JSON.parse(JSON.stringify(serializeState(false)));
  rawVid.recordings = [{ id: "vx", name: "imported", created_utc: nowUtc(), duration_ms: 900, fps: 30, width: 2, height: 2, state_hash: "", snapshot: null, gate: [], path: [{ position: [1, 1, 1], target: [0, 0, 0], fov: 26 }] }];
  await applyFullState(rawVid);
  results.push("recording imported from state: " + (S.recordings.length === 1 && S.recordings[0].path.length === 1));
  const rawNoVid = JSON.parse(JSON.stringify(serializeState(false)));
  delete rawNoVid.recordings;
  await applyFullState(rawNoVid);
  results.push("import tolerates missing recordings: " + (Array.isArray(S.recordings) && S.recordings.length === 0));

  // bust subject: on-demand load, verified hash, deterministic drape
  if (!BUST.loaded && !BUST.loadError) {
    await loadBustModel();
    if (BUST.loaded) { applyBustTone(); buildEarSeats(); buildNecklace(); }
  }
  results.push("bust load: " + (BUST.loaded ? "ok" : "failed") + (BUST.loadError ? " (" + BUST.loadError + ")" : ""));
  if (BUST.loaded) {
    results.push("bust verts: " + BUST.mesh.geometry.attributes.position.count + ", subject default: " + S.subject);
    const keepTone = { ...S.bust.tone };
    S.bust.tone = { preset: "espresso", lightness: 0, warmth: 0, depth: 0 };
    applyBustTone();
    results.push("bust tone espresso: " + bustAlbedoHex() + " (expect #724932)");
    const s1 = settleChain(46, true), s2 = settleChain(46, true);
    const eq = s1.pts.every((q, i) => q.equals(s2.pts[i]));
    results.push("drape re-settle byte-identical (fixed-step verlet is deterministic): " + eq);
    const bandHeld = Math.max(...s1.pts.map((q) => q.y));
    results.push("worn band holds at the nape (friction owns the back arc): " + (Math.abs(bandHeld - 0.8) < 0.02) + " (band y " + bandHeld.toFixed(2) + ")");
    const s3 = settleChain(40, false), s4 = settleChain(36, false);
    const mean = (r) => r.pts.reduce((a, q) => a + q.y, 0) / r.pts.length;
    results.push("drape deepens with length (mean depth 36 < 40 < 46): " + (mean(s4) > mean(s3) && mean(s3) > mean(s1)) +
      " (" + mean(s4).toFixed(2) + " / " + mean(s3).toFixed(2) + " / " + mean(s1).toFixed(2) + ")");
    let lo = 0;
    for (let i = 1; i < s1.pts.length; i++) if (s1.pts[i].y < s1.pts[lo].y && s1.pts[i].z > 0) lo = i;
    results.push("pendant rests at the low point of the droop: " +
      (s1.pts[lo].y < s1.pts[(lo + 2) % s1.pts.length].y && s1.pts[lo].y < s1.pts[(lo - 2 + s1.pts.length * 2) % s1.pts.length].y) +
      " (y " + s1.pts[lo].y.toFixed(2) + ")");
    buildNecklace();
    let links = 0; BUST.chainGroup.traverse((o) => { if (o.isMesh) links++; });
    let seats = 0; BUST.seatGroup.traverse((o) => { if (o.isMesh) seats++; });
    results.push("chain meshes at 46cm with pendant: " + links + ", mirrored lobe stud meshes: " + seats + " (post, gem, disc x2 ears)");
    S.bust.ear.mirror_left = false; buildPiercings();
    seats = 0; BUST.seatGroup.traverse((o) => { if (o.isMesh) seats++; });
    results.push("mirror off halves the seats: " + seats);
    S.bust.nose.nostril.piece = "stud"; S.bust.nose.septum.piece = "hoop"; buildPiercings();
    seats = 0; BUST.seatGroup.traverse((o) => { if (o.isMesh) seats++; });
    results.push("nose seats add 4 meshes: " + seats + " (nostril pin post/gem/disc + septum ring)");
    S.bust.nose.nostril.piece = "none"; S.bust.nose.septum.piece = "none";
    S.bust.ear.mirror_left = true; buildPiercings();
    // hoops thread the channel: the ring's axis must be perpendicular to it
    S.bust.ear.lobe.piece = "hoop"; buildPiercings();
    const hoops = [];
    BUST.seatGroup.children.forEach((g) => g.traverse((o) => { if (o.isMesh && o.geometry.type === "TorusGeometry") hoops.push(o); }));
    const f = EAR_FRAME.lobe;
    const dirR = new THREE.Vector3(...f.pos).sub(new THREE.Vector3(...f.back)).normalize();
    const dirL = dirR.clone().multiply(new THREE.Vector3(-1, 1, 1)); // mirrored channel
    const down = new THREE.Vector3(0, -1, 0);
    // each hoop's ring plane must contain gravity and its own ear's channel
    const okHoops = hoops.filter((hoop) => {
      const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(hoop.getWorldQuaternion(new THREE.Quaternion()));
      return Math.abs(axis.y) < 0.02 && (Math.abs(axis.dot(dirR)) < 0.02 || Math.abs(axis.dot(dirL)) < 0.02);
    });
    results.push("hoops thread the channel (hangs with gravity, perpendicular to its ear's channel): " + (hoops.length === 2 && okHoops.length === hoops.length) + " (" + okHoops.length + "/" + hoops.length + " mirrored hoops)");
    S.bust.ear.lobe.piece = "stud"; buildPiercings();
    S.subject = "bust"; BUST.root.visible = true; if (HAND.root) HAND.root.visible = false;
    const ser = serializeState(false);
    results.push("state carries subject+bust: " + (ser.subject === "bust" && ser.bust.tone.preset === "espresso" && ser.bust.necklace.style));
    const restored = migrateBust(ser.bust);
    results.push("bust state migrates clean: " + (restored.tone.preset === "espresso" && restored.ear.lobe.piece === "stud" && restored.ear.mirror_left === true && restored.nose.septum.piece === "none"));
    S.bust.tone = keepTone; applyBustTone();
    S.subject = "hand"; BUST.root.visible = false; if (HAND.root) HAND.root.visible = true;
  }

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
  const png = await renderPng(400, 400);
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
  // orbit video recording: refused while pinned, the path is the record,
  // and export re-renders deterministically into all three containers
  S.cameras.push({ name: "selftest vid cam", position: [140, 260, 460], target: [-15, 100, 40], fov: 26, focallength: 50, focaldistance: 475 });
  S.live = { ...S.live, mode: "pinned", pinned: "selftest vid cam" };
  syncModeBadge();
  const refused = startRecording();
  results.push("recording refused while pinned: " + (refused === false));
  results.push("no record created on refusal: " + (S.recordings.length === 0));
  S.cameras = S.cameras.filter((c) => c.name !== "selftest vid cam");
  S.live = { ...S.live, mode: "orbit" };
  controls.enabled = true; syncModeBadge();
  camera.position.set(140, 260, 460);
  controls.target.set(-15, 100, 40);
  $("#rec-size").value = "square"; // the recording's chosen dimensions
  await new Promise((r) => setTimeout(r, 80));
  startRecording();
  results.push("record started: " + !!REC);
  const capBlocked = await captureFrame();
  results.push("photo capture blocked during take: " + (capBlocked === null));
  let prevEnv = null;
  // a scripted move: the camera sweeps in while the take runs, as zoom would
  for (let i = 1; i <= 5; i++) {
    camera.position.set(140 + i * 6, 260 + i * 3, 460 - i * 24);
    await new Promise((r) => setTimeout(r, 50));
    if (i === 2) { S.lighting.key.intensity = 3.7; applyLighting(); } // live lighting change, captured mid-take
    if (i === 3) { prevEnv = S.environment; S.environment = { bg: "#304a5e", center: "#4a6a86", preset: "mid-take set" }; applyEnvironment(); } // live backdrop change, captured mid-take
    if (i === 4) { $("#rec-size").value = "portrait"; $("#rec-size").dispatchEvent(new Event("change")); } // live framing switch, rooms.xyz-style
  }
  await new Promise((r) => setTimeout(r, 60));
  const vid = stopRecording();
  results.push("record created: " + (vid ? vid.name + " " + (vid.duration_ms / 1000).toFixed(1) + "s " + vid.path.length + " frames" : "none"));
  const moved = vid && vid.path.length > 1 && JSON.stringify(vid.path[0]) !== JSON.stringify(vid.path[vid.path.length - 1]);
  results.push("path moved across the take: " + moved);
  results.push("recording dimensions honored: " + (vid && vid.width === 1080 && vid.height === 1350) + " (" + (vid ? vid.width + "x" + vid.height : "none") + ", final framing)");
  const deltas = vid ? vid.path.filter((f) => f.lighting).length : 0;
  results.push("lighting change captured mid-take: " + (deltas >= 1) + " (" + deltas + " delta frames)");
  results.push("lighting carried to the last frame: " + (vid && pathLightingAt(vid, vid.path.length - 1).key.intensity === 3.7));
  const sizeDeltas = vid ? vid.path.filter((f) => f.size).length : 0;
  const lastSize = vid ? videoSizeAt(vid, vid.path.length - 1) : null;
  results.push("framing switch captured mid-take: " + (sizeDeltas >= 2) + " (" + sizeDeltas + " size delta frames, opening square -> portrait)");
  results.push("framing carried to the last frame: " + (lastSize && lastSize.key === "portrait" && lastSize.width === 1080 && lastSize.height === 1350));
  const envDeltas = vid ? vid.path.filter((f) => f.environment).length : 0;
  results.push("backdrop change captured mid-take: " + (envDeltas >= 1) + " (" + envDeltas + " delta frames)");
  // the record is deltas: the value in effect at the last frame is the
  // last change at or before it, same carry-forward the export applies
  const envAt = (rec, i) => { let e = rec.snapshot.environment; for (let j = 0; j <= i && j < rec.path.length; j++) if (rec.path[j].environment) e = rec.path[j].environment; return e; };
  const lastEnv = vid ? envAt(vid, vid.path.length - 1) : null;
  results.push("backdrop carried to the last frame: " + (lastEnv && lastEnv.preset === "mid-take set" && lastEnv.bg === "#304a5e"));
  if (prevEnv) { S.environment = JSON.parse(JSON.stringify(prevEnv)); applyEnvironment(); prevEnv = null; } // the take keeps its record; the session returns to its set
  results.push("record serialized in state: " + (serializeState(false).recordings.length === 1));
  const bufEq = (a, b) => a.byteLength === b.byteLength && new Uint8Array(a).every((v, i) => v === new Uint8Array(b)[i]);
  const brand = (b) => new TextDecoder().decode(new Uint8Array(b.slice(4, 10)));
  if (typeof window.VideoEncoder !== "undefined") {
    const w1 = await renderVideoBuffer(vid, "webm");
    const w2 = await renderVideoBuffer(vid, "webm");
    results.push("webm exports byte-identical: " + (w1.buffer && w2.buffer && bufEq(w1.buffer, w2.buffer)));
    const mp4 = await renderVideoBuffer(vid, "mp4");
    const mov = await renderVideoBuffer(vid, "mov");
    results.push("mp4 brand " + brand(mp4.buffer) + ", mov brand " + brand(mov.buffer));
    results.push("mp4/mov are sibling containers not copies: " + (mp4.buffer && mov.buffer && !bufEq(mp4.buffer, mov.buffer)));
    // demux what was written: the container must carry the whole path
    const { Input, BlobSource, MP4, WEBM } = await import("mediabunny");
    const trackOf = async (buf, type, formats) => {
      const input = new Input({ formats, source: new BlobSource(new Blob([buf], { type })) });
      const track = await input.getPrimaryVideoTrack();
      const stats = await track.computePacketStats();
      const codec = track.codec;
      input.dispose();
      return { codec, count: stats.packetCount };
    };
    const demuxMp4 = await trackOf(mp4.buffer, mp4.mime, [MP4]);
    const demuxWebm = await trackOf(w1.buffer, w1.mime, [WEBM]);
    results.push("mp4 demuxes: " + demuxMp4.codec + ", " + demuxMp4.count + " packets");
    results.push("webm demuxes: " + demuxWebm.codec + ", " + demuxWebm.count + " packets");
    results.push("demuxed frames match the path: " + (demuxMp4.count === vid.path.length && demuxWebm.count === vid.path.length));
  } else {
    results.push("webcodecs unavailable: export falls back to the live take only");
  }
  deleteRecording(vid);
  // import stays tolerant of saves that predate recordings
  const rawVid = JSON.parse(JSON.stringify(serializeState(false)));
  rawVid.recordings = [{ id: "vx", name: "imported", created_utc: nowUtc(), duration_ms: 900, fps: 30, width: 2, height: 2, state_hash: "", snapshot: null, gate: [], path: [{ position: [1, 1, 1], target: [0, 0, 0], fov: 26 }] }];
  await applyFullState(rawVid);
  results.push("recording imported from state: " + (S.recordings.length === 1 && S.recordings[0].path.length === 1));
  const rawNoVid = JSON.parse(JSON.stringify(serializeState(false)));
  delete rawNoVid.recordings;
  await applyFullState(rawNoVid);
  results.push("import tolerates missing recordings: " + (Array.isArray(S.recordings) && S.recordings.length === 0));

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
    function animate() { requestAnimationFrame(animate); if (VIEW_LOCKED) return; if (S.live.mode === "orbit") controls.update(); renderFrame(); }
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
  // qa handle: the visual check scripts (scripts/nail-sheet.mjs) reach the
  // module-scoped scene through this, only when the url asks for it
  if (location.hash.includes("qa")) window.__sg = { get S() { return S; }, HAND, THREE, camera, controls, renderer, renderFrame, applyFinish, applyNails, NAIL_FRAME, NAIL_SHAPES, NAIL_SHAPE_ORDER, bname, FINGER_BONES, applyPosePreset, buildNailGeometry, NAIL, nailMaterial, applySurface, SKIN_PRESETS, skinAlbedoHex, migrateSkin, SKIN_GROUPS, skinAlbedo, NAIL_SHAPE_ORDER, settleChain, ringLookup, NECK_RINGS, DRAPE, BUST };
  renderCaptureStrip();
  updateVpOverlay();
  syncModeBadge();

  function animate() {
    requestAnimationFrame(animate);
    if (VIEW_LOCKED) return; // video export/replay owns the canvas while locked
    if (S.live.mode === "orbit") controls.update();
    renderFrame();
  }
  animate();
})();

