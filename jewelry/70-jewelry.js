// ===== jewelry: the compiled artifact enters the scene by reference =====
// the scene consumes the release's mesh spec and its placement info. it never
// stores a copy of release assets and nothing here can modify a record.
const JEWELRY = new Map(); // iid -> { group, material }

function latheProfileBand(Ri, W, T, B) {
  const pts = [
    [Ri, -W / 2 + B], [Ri, W / 2 - B], [Ri + B * 0.6, W / 2], [Ri + T - B, W / 2],
    [Ri + T, W / 2 - B], [Ri + T, -W / 2 + B], [Ri + T - B, -W / 2], [Ri + B * 0.6, -W / 2],
    [Ri, -W / 2 + B]
  ];
  // reversed so the lathe faces point outward; the natural point order turns
  // the band inside out and every face gets backface culled from outside
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
  // this profile was already wound outward; reversing it would flip it inward
  return pts;
}

// deterministic mesh from the typed spec. same spec in, same geometry out.
// the compiled-mesh path consumes the release's actual glb; this is the
// fallback for records without a mesh asset, so a spec still renders.
function buildArtifactMesh(rec, material) {
  const spec = rec.parameters.mesh_spec;
  const group = new THREE.Group();
  if (spec.kind === "band") {
    const geo = new THREE.LatheGeometry(latheProfileBand(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm), 96);
    group.add(new THREE.Mesh(geo, material));
    group.userData.geoRefs = [geo];
  } else if (spec.kind === "dome_band") {
    const geo = new THREE.LatheGeometry(latheProfileDome(spec.inner_radius_mm, spec.width_mm, spec.thickness_mm, spec.bevel_mm), 96);
    group.add(new THREE.Mesh(geo, material));
    group.userData.geoRefs = [geo];
  } else if (spec.kind === "signet") {
    const band = new THREE.LatheGeometry(latheProfileBand(spec.inner_radius_mm, spec.band_width_mm, spec.band_thickness_mm, 0.3), 96);
    const top = new THREE.SphereGeometry(1, 32, 24);
    group.userData.geoRefs = [band, top];
    group.add(new THREE.Mesh(band, material));
    const oval = new THREE.Mesh(top, material);
    oval.scale.set(spec.top_w_mm / 2, spec.top_l_mm / 2, spec.top_h_mm / 2);
    oval.position.set(0, 0, -(spec.inner_radius_mm + spec.band_thickness_mm + spec.top_h_mm / 2 - 1));
    group.add(oval);
  } else if (spec.kind === "cuff") {
    const geo = new THREE.TorusGeometry(spec.inner_radius_mm + spec.tube_mm, spec.tube_mm, 22, 84, spec.arc_deg * DEG);
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, material);
    m.rotation.y = Math.PI * 0.66 + (spec.gap_w_mm || 0) * 0;
    group.add(m);
    group.userData.geoRefs = [geo];
  } else {
    const geo = new THREE.TorusGeometry(10, 1.5, 16, 64);
    geo.rotateX(Math.PI / 2);
    group.userData.geoRefs = [geo];
    group.add(new THREE.Mesh(geo, material));
  }
  return group;
}

function metalMaterial(metalKey) {
  const m = METALS[metalKey] || METALS.silver_925;
  return new THREE.MeshPhysicalMaterial({
    color: m.color, metalness: 1.0, roughness: m.rough,
    clearcoat: 0.5, clearcoatRoughness: 0.22, envMapIntensity: 1.15
  });
}

async function addJewelryInstance(releaseId, metalKey) {
  await buildHand(); // the model must be loaded before anything can attach to a bone
  const rec = byRelease.get(releaseId);
  if (!rec) { toast("unknown release"); return; }
  const gate = await gateRelease(releaseId, rec.version, rec.assets.mesh_sha256, rec.assets.mesh_glb_sha256);
  if (!gate.ok) { toast(`ingestion gate rejected ${rec.name}: ${gate.reason}`); return; }
  const locations = rec.parameters.placement.locations;
  const location = locations.includes("finger")
    ? { kind: "finger", finger: "ring" }
    : { kind: "wrist" };
  const iid = "j" + Math.random().toString(36).slice(2, 9);
  // stacking: default offset grows with pieces already at this location
  const already = S.jewelry.filter((x) => x.location.kind === location.kind && x.location.finger === location.finger).length;
  const w = (rec.parameters.mesh_spec.width_mm || rec.parameters.mesh_spec.band_width_mm || 4);
  const inst = {
    iid, release_id: releaseId, version: rec.version,
    mesh_sha256: rec.assets.mesh_sha256,
    mesh_glb_sha256: rec.assets.mesh_glb_sha256 || null,
    metal: metalKey && rec.metals_offered.includes(metalKey) ? metalKey : rec.metals_offered[0],
    location, offset_mm: Math.round(already * (w + 0.5) * 10) / 10, rotation_deg: 0
  };
  S.jewelry.push(inst);
  await buildJewelryInstance(inst);
  renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); updateVpOverlay(); saveState();
  toast(`${rec.name} v${rec.version} added to scene by reference`);
}

async function buildJewelryInstance(inst) {
  removeJewelryMesh(inst.iid);
  const rec = byRelease.get(inst.release_id);
  if (!rec) return;
  const material = metalMaterial(inst.metal);
  const g = new THREE.Group();
  let group, source = "procedural fallback";
  if (rec.assets.mesh_glb_uri) {
    // the scene renders the release's compiled mesh: what is shown is what
    // is manufactured. bytes are fetched through the same uri the gate
    // hashed, so the render can only succeed on verified bytes.
    const buf = await (await fetch(rec.assets.mesh_glb_uri)).arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buf, "");
    group = gltf.scene;
    source = "release glb " + rec.assets.mesh_glb_sha256.slice(0, 12);
  } else {
    group = buildArtifactMesh(rec, material);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.material = material; o.castShadow = true;
      if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    }
  });
  g.add(group);
  JEWELRY.set(inst.iid, { group: g, material, rec, source });
  placeJewelryInstance(inst);
}
function removeJewelryMesh(iid) {
  const j = JEWELRY.get(iid);
  if (!j) return;
  j.group.parent?.remove(j.group);
  j.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  j.material.dispose();
  JEWELRY.delete(iid);
}
function placeJewelryInstance(inst) {
  const j = JEWELRY.get(inst.iid);
  if (!j || !HAND.loaded) return;
  const bone = boneFor(inst.location);
  if (!bone) return;
  const key = inst.location.kind === "wrist" ? "wrist" : inst.location.finger;
  const len = HAND.boneLen.get(key) || 0.045;
  bone.add(j.group);
  // bone space is meters (the model's native units); artifact geometry is
  // millimeters, so the group shrinks a thousandfold to sit true to size.
  j.group.scale.setScalar(0.001);
  j.group.position.set(0, len * 0.55 + inst.offset_mm * 0.001, 0);
  j.group.rotation.y = inst.rotation_deg * DEG;
}
function reattachJewelry() {
  for (const inst of S.jewelry) placeJewelryInstance(inst);
}
function updateJewelryMetal(inst) {
  const j = JEWELRY.get(inst.iid);
  if (!j) return;
  j.material.color.set(METALS[inst.metal].color);
  j.material.roughness = METALS[inst.metal].rough;
}
// reorder within a stack: exchange seat offsets with the adjacent piece at the
// same location. "hand" swaps toward the base (lower offset), "tip" toward the
// fingertip. each piece stays its own object; only the two offsets exchange.
function reorderJewelry(iid, dir) {
  const inst = S.jewelry.find((x) => x.iid === iid);
  if (!inst) return false;
  const stack = S.jewelry
    .filter((x) => x.location.kind === inst.location.kind && x.location.finger === inst.location.finger)
    .sort((a, b) => a.offset_mm - b.offset_mm);
  const i = stack.indexOf(inst);
  const j = dir === "hand" ? i - 1 : i + 1;
  if (j < 0 || j >= stack.length) return false;
  const a = inst.offset_mm;
  inst.offset_mm = stack[j].offset_mm;
  stack[j].offset_mm = a;
  placeJewelryInstance(inst); placeJewelryInstance(stack[j]);
  saveState();
  return true;
}
function removeJewelryInstance(iid) {
  removeJewelryMesh(iid);
  S.jewelry = S.jewelry.filter((x) => x.iid !== iid);
  renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); updateVpOverlay(); saveState();
}
function supportedLocations(rec) {
  return rec.parameters.placement.locations; // e.g. ["finger"] or ["wrist"]
}

