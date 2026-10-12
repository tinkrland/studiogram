// ===== panels and controls =====
let currentTab = "subject";
const PANEL = $("#panelbody");

function section(parent, title) {
  const s = el("div", "section");
  s.appendChild(el("h3", null, title));
  parent.appendChild(s);
  return s;
}
function slider(parent, label, min, max, step, get, set, opts = {}) {
  const row = el("div", "row");
  const lab = el("label", null, label);
  const inp = document.createElement("input");
  inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
  const val = el("span", "val", opts.fmt ? opts.fmt(get()) : String(get()));
  inp.addEventListener("input", () => {
    const v = parseFloat(inp.value);
    set(v);
    val.textContent = opts.fmt ? opts.fmt(v) : String(v);
    if (opts.apply) opts.apply();
    saveState();
  });
  row.append(lab, inp, val);
  parent.appendChild(row);
  return { row, inp };
}
function selectControl(parent, label, options, get, set, opts = {}) {
  const row = el("div", "row");
  const lab = el("label", null, label);
  const sel = document.createElement("select");
  for (const o of options) {
    const op = document.createElement("option");
    op.value = o.value; op.textContent = o.label;
    sel.appendChild(op);
  }
  sel.value = get();
  sel.addEventListener("change", () => { set(sel.value); if (opts.apply) opts.apply(); saveState(); });
  row.append(lab, sel);
  parent.appendChild(row);
  return sel;
}
function button(parent, label, cls, fn) {
  const b = el("button", cls || "btn", label);
  b.addEventListener("click", fn);
  parent.appendChild(b);
  return b;
}
function hint(parent, text) { parent.appendChild(el("div", "hint", text)); }

// ----- subject panel -----
function renderSubjectPanel() {
  PANEL.innerHTML = "";
  const model = section(PANEL, "hand model");
  hint(model, "a rigged hand with a real skeleton. poses bend the rig's joints; attached jewelry rides its bone.");
  const stats = el("div", "list-item");
  stats.appendChild(el("span", "name", `${HAND.source.title} · ${HAND.boneCount} bones`));
  stats.appendChild(el("span", "dim", Object.keys(POSE_PRESETS).length + " poses"));
  model.appendChild(stats);
  if (HAND.loaded) {
    model.appendChild(el("div", "empty",
      "skinned mesh: " + HAND.skinned.geometry.attributes.position.count + " vertices"));
  }

  const finish = section(PANEL, "finish");
  hint(finish, "the hand presents as a matte porcelain display hand, or with its original skin textures. the piece is the subject; the hand is the stand.");
  const finishRow = el("div", "btnrow");
  for (const key of ["porcelain", "skin"]) {
    const b = el("button", "btn" + (S.hand.finish === key ? " primary" : ""), key);
    b.addEventListener("click", () => { S.hand.finish = key; applyFinish(); saveState(); renderSubjectPanel(); });
    finishRow.appendChild(b);
  }
  finish.appendChild(finishRow);

  const surface = section(PANEL, "surface");
  hint(surface,
    "the skin layer, independent of morphology: tone tints the base skin texture, body hair is follicle strokes composited on the forearm. available on every presentation preset; visible on the skin finish.");
  const scard = el("div", "card");
  const sk = S.hand.skin;
  slider(scard, "skin tone", 0, 1, 0.05,
    () => sk.tone,
    (v) => { sk.tone = v; },
    { apply: () => applySurface(), fmt: (v) => v.toFixed(2) });
  slider(scard, "body hair", 0, 1, 0.05,
    () => sk.hair,
    (v) => { sk.hair = v; },
    { apply: () => applySurface(), fmt: (v) => v.toFixed(2) });
  surface.appendChild(scard);

  // nail appearance: polish tint on the nail plates. surface, not shape —
  // length and shape stay morph targets on the same base mesh.
  const nailRow = el("div", "row");
  nailRow.appendChild(el("label", null, "nails"));
  const nailBtns = el("div", "btnrow");
  nailBtns.style.margin = "0";
  for (const key of ["natural", "polished"]) {
    const b = el("button", "btn mini" + (S.hand.nails?.style === key ? " primary" : ""), key);
    b.addEventListener("click", () => { S.hand.nails.style = key; applySurface(); renderSubjectPanel(); saveState(); });
    nailBtns.appendChild(b);
  }
  const ncol = document.createElement("input");
  ncol.type = "color"; ncol.value = S.hand.nails?.color || "#b23a48"; ncol.style.width = "42px";
  ncol.addEventListener("input", () => { S.hand.nails.color = ncol.value; applySurface(); saveState(); });
  nailBtns.appendChild(ncol);
  nailRow.appendChild(nailBtns);
  surface.appendChild(nailRow);

  const tat = section(PANEL, "tattoos");
  hint(tat, "sleeve-on placement: pick a design, enter place mode, and the ink follows the surface under your cursor. the commit paints into the hand's texture, so it rides posing and morphs instead of sitting on top as geometry. click to commit, esc to leave. visible on the skin finish.");
  const drow = el("div", "btnrow");
  for (const k of DESIGN_ORDER) {
    const b = el("button", "btn mini" + (TATTOO.design === k ? " primary" : ""), k);
    b.addEventListener("click", () => {
      TATTOO.design = k;
      if (HAND.tattooGhost) HAND.tattooGhost.design = k;
      applySurface();
      renderSubjectPanel(); saveState();
    });
    drow.appendChild(b);
  }
  tat.appendChild(drow);
  const tcard = el("div", "card");
  slider(tcard, "size", 0.02, 0.15, 0.005,
    () => TATTOO.size,
    (v) => { TATTOO.size = v; if (HAND.tattooGhost) HAND.tattooGhost.w = v; },
    { apply: () => applySurface(), fmt: (v) => v.toFixed(3) });
  slider(tcard, "rotation", -Math.PI, Math.PI, 0.1,
    () => TATTOO.rot,
    (v) => { TATTOO.rot = v; if (HAND.tattooGhost) HAND.tattooGhost.rot = v; },
    { apply: () => applySurface(), fmt: (v) => Math.round(v * 57.3) + "°" });
  tat.appendChild(tcard);
  const trow = el("div", "btnrow");
  const placeBtn = el("button", "btn" + (TATTOO.active ? " primary" : ""), TATTOO.active ? "placing — click the hand, esc to finish" : "place tattoo");
  placeBtn.addEventListener("click", () => setTattooMode(!TATTOO.active));
  trow.appendChild(placeBtn);
  const clearBtn = el("button", "btn", "clear");
  clearBtn.addEventListener("click", () => {
    if (!S.hand.tattoos.length) { toast("no tattoos to clear"); return; }
    S.hand.tattoos = [];
    applySurface(); renderSubjectPanel(); saveState();
    toast("tattoos cleared");
  });
  trow.appendChild(clearBtn);
  tat.appendChild(trow);
  tat.appendChild(el("div", "empty",
    S.hand.tattoos.length ? S.hand.tattoos.length + " tattoo" + (S.hand.tattoos.length === 1 ? "" : "s") + " painted"
    : "no tattoos painted yet."));

  const morpho = section(PANEL, "morphology");
  hint(morpho,
    "seven authored blend targets on the one base mesh. presentation presets are blend weights, not different files; the sliders stack on top of them.");
  const presRow = el("div", "btnrow");
  for (const key of ["hand", "male hand", "female hand"]) {
    const b = el("button", "btn" + (S.hand.presentation === key ? " primary" : ""), key);
    b.addEventListener("click", () => {
      S.hand.presentation = key;
      applyMorphs();
      saveState();
      renderSubjectPanel();
    });
    presRow.appendChild(b);
  }
  morpho.appendChild(presRow);
  const mg = S.hand.morph;
  const morphDefs = [
    ["build", -1, 1, 0.05],
    ["finger length", -1, 1, 0.05],
    ["finger thickness", -1, 1, 0.05],
    ["palm width", -1, 1, 0.05],
    ["palm proportions", -1, 1, 0.05]
  ];
  const morphKeys = { "finger length": "finger_length", "finger thickness": "finger_thickness", "palm width": "palm_width", "palm proportions": "palm_proportions", "build": "build" };
  const morphDefs2 = [
    ["nail length", 0, 1, 0.05, "nail_length"],
    ["nail shape", 0, 1, 0.05, "nail_shape"]
  ];
  const mcard = el("div", "card");
  for (const [label, lo, hi, st, kOverride] of morphDefs.map((d) => [d[0], d[1], d[2], d[3], morphKeys[d[0]]]).concat(morphDefs2)) {
    const k = kOverride;
    slider(mcard, label, lo, hi, st,
      () => mg[k],
      (v) => { mg[k] = v; },
      { apply: () => applyMorphs(), fmt: (v) => v.toFixed(2) });
  }
  morpho.appendChild(mcard);

  // saved hands: the creator's hand library. a saved hand carries the full
  // shape-plus-surface set; pose and jewelry stay per-shoot.
  const saved = section(PANEL, "saved hands");
  hint(saved, "save a hand once. a saved configuration keeps the complete shape-plus-surface set: presentation, build, finish, tone, hair, and ink. pose and jewelry stay per-shoot. apply a saved hand to swap the subject without touching the shoot.");
  const saveRow = el("div", "row");
  const nameInp = document.createElement("input");
  nameInp.type = "text"; nameInp.placeholder = "name this hand";
  const saveBtn = el("button", "btn", "save current hand");
  saveRow.append(nameInp, saveBtn);
  saved.appendChild(saveRow);
  saveBtn.addEventListener("click", () => {
    const cfg = saveCurrentHand(nameInp.value);
    nameInp.value = "";
    toast(`saved hand '${cfg.name}' to the library`);
    renderSubjectPanel();
  });
  nameInp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") saveBtn.click(); });
  if (!SAVED_HANDS.length) {
    saved.appendChild(el("div", "empty", "no saved hands yet. shape one, name it, save it."));
  }
  for (const cfg of SAVED_HANDS) {
    const card = el("div", "card");
    const t = el("div", "t");
    t.appendChild(el("b", null, cfg.name));
    const h = cfg.hand;
    t.appendChild(el("span", null,
      h.presentation + " · " + h.finish + " · tone " + (h.skin?.tone ?? 0.4).toFixed(2) +
      " · " + (h.tattoos?.length || 0) + ((h.tattoos?.length || 0) === 1 ? " tattoo" : " tattoos")));
    card.appendChild(t);
    const meta = el("div", "meta",
      "build " + (h.morph?.build ?? 0).toFixed(2) +
      " · hair " + (h.skin?.hair ?? 0.35).toFixed(2) +
      " · saved " + (cfg.created_utc || "").slice(0, 10));
    card.appendChild(meta);
    const actions = el("div", "btnrow");
    const applyBtn = el("button", "btn mini", "apply");
    applyBtn.addEventListener("click", () => {
      applySavedHand(cfg);
      toast(`applied saved hand '${cfg.name}'`);
      renderSubjectPanel();
    });
    const delBtn = el("button", "btn mini", "delete");
    delBtn.addEventListener("click", () => {
      deleteSavedHand(cfg);
      toast(`removed saved hand '${cfg.name}'`);
      renderSubjectPanel();
    });
    actions.append(applyBtn, delBtn);
    card.appendChild(actions);
    saved.appendChild(card);
  }

  const credit = section(PANEL, "model credit");
  hint(credit,
    `'Rigged Hand' by ${HAND.source.author}, ${HAND.source.origin}. released under ${HAND.source.license}: free to use and adapt, including commercially, with this credit kept attached.`);
}
// ----- jewelry panel -----
const registryMetalChoice = {};
function renderJewelryPanel() {
  PANEL.innerHTML = "";
  const reg = section(PANEL, "release registry");
  hint(reg, "releases enter scenes by reference: id, version, asset hash. this gate checks provenance and visual reliability only. it is never a castability, safety, or quality claim; product geometry validation belongs to the studio's release gate upstream.");
  for (const rec of REGISTRY) {
    const card = el("div", "card");
    const t = el("div", "t");
    t.appendChild(el("b", null, `${rec.name}`));
    t.appendChild(el("span", null, `v${rec.version} · ${rec.type}`));
    card.appendChild(t);
    const metalSel = document.createElement("select");
    const chosen = registryMetalChoice[rec.release_id] || rec.metals_offered[0];
    for (const m of rec.metals_offered) {
      const op = document.createElement("option");
      op.value = m; op.textContent = METALS[m] ? METALS[m].label : m;
      metalSel.appendChild(op);
    }
    metalSel.value = chosen;
    metalSel.addEventListener("change", () => { registryMetalChoice[rec.release_id] = metalSel.value; renderJewelryPanel(); });
    const mass = rec.mass_estimate_g[chosen] !== undefined ? `${rec.mass_estimate_g[chosen]} g` : "mass n/a";
    const meta = el("div", "meta", `by ${rec.creator_name} · ${mass} est. · supports: ${supportedLocations(rec).join(", ")}`);
    card.appendChild(meta);
    const hash = el("div", "hash", `mesh sha-256 ${rec.assets.mesh_sha256.slice(0, 16)}…`);
    card.appendChild(hash);
    const actions = el("div", "btnrow");
    const addBtn = el("button", "btn primary mini", "add to scene");
    addBtn.addEventListener("click", () => addJewelryInstance(rec.release_id, metalSel.value));
    actions.append(metalSel, addBtn);
    card.appendChild(actions);
    reg.appendChild(card);
  }

  const inst = section(PANEL, "arrangement");
  hint(inst, "each piece is an independent object at a named location. it follows the pose instead of freezing in space.");
  if (!S.jewelry.length) { inst.appendChild(el("div", "empty", "scene has no artifacts yet")); return; }
  for (const j of S.jewelry) {
    const rec = byRelease.get(j.release_id);
    const card = el("div", "card");
    const t = el("div", "t");
    t.appendChild(el("b", null, rec ? rec.name : "unknown"));
    t.appendChild(el("span", null, `v${j.version} · ${METALS[j.metal] ? METALS[j.metal].label : ""}`));
    card.appendChild(t);
    const hash = el("div", "hash gate-ok", `mesh sha-256 ${j.mesh_sha256.slice(0, 16)}… verified`);
    card.appendChild(hash);
    const locRow = el("div", "row");
    const locSel = document.createElement("select");
    const locations = rec ? supportedLocations(rec) : ["finger"];
    for (const kind of locations) {
      const op = document.createElement("option"); op.value = kind; op.textContent = kind;
      locSel.appendChild(op);
    }
    locSel.value = j.location.kind;
    locSel.addEventListener("change", () => {
      j.location = locSel.value === "finger" ? { kind: "finger", finger: "ring" } : { kind: "wrist" };
      placeJewelryInstance(j); renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); saveState();
    });
    locRow.append(el("label", null, "location"), locSel);
    card.appendChild(locRow);
    if (j.location.kind === "finger") {
      const fingerSel = document.createElement("select");
      for (const f of FINGERS) {
        const op = document.createElement("option"); op.value = f; op.textContent = f;
        fingerSel.appendChild(op);
      }
      fingerSel.value = j.location.finger;
      fingerSel.addEventListener("change", () => { j.location.finger = fingerSel.value; placeJewelryInstance(j); saveState(); });
      const fRow = el("div", "row");
      fRow.append(el("label", null, "at"), fingerSel);
      card.appendChild(fRow);
    }
    slider(card, "seat offset", 0, 14, 0.1, () => j.offset_mm, (v) => { j.offset_mm = v; }, { apply: () => placeJewelryInstance(j), fmt: (v) => v.toFixed(1) });
    slider(card, "rotation", -180, 180, 1, () => j.rotation_deg, (v) => { j.rotation_deg = v; }, { apply: () => placeJewelryInstance(j), fmt: (v) => v.toFixed(0) });
    const metalSel = document.createElement("select");
    const rec2 = byRelease.get(j.release_id);
    for (const m of (rec2 ? rec2.metals_offered : [j.metal])) {
      const op = document.createElement("option"); op.value = m; op.textContent = METALS[m] ? METALS[m].label : m;
      metalSel.appendChild(op);
    }
    metalSel.value = j.metal;
    metalSel.addEventListener("change", () => { j.metal = metalSel.value; updateJewelryMetal(j); renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); saveState(); });
    const mRow = el("div", "row");
    mRow.append(el("label", null, "metal"), metalSel);
    card.appendChild(mRow);
    const rm = el("button", "btn mini danger", "remove from scene");
    rm.addEventListener("click", () => removeJewelryInstance(j.iid));
    card.appendChild(rm);
    inst.appendChild(card);
  }
}

// ----- pose panel -----
function renderPosePanel() {
  PANEL.innerHTML = "";
  const presets = section(PANEL, "pose presets");
  const row = el("div", "btnrow");
  for (const key of Object.keys(POSE_PRESETS)) {
    const b = el("button", "btn" + (S.pose.preset === key ? " primary" : ""), POSE_LABELS[key] || key);
    b.addEventListener("click", () => { applyPosePreset(key); renderPosePanel(); saveState(); });
    row.appendChild(b);
  }
  presets.appendChild(row);
  hint(presets, "presets are authored in blender as joint rotations, applied to the rig here. sliders stack on top.");

  const fingers = section(PANEL, "fingers");
  for (const fname of ["index", "middle", "ring", "pinky"]) {
    const f = S.pose.fingers[fname];
    const card = el("div", "card");
    card.appendChild(el("b", null, fname));
    slider(card, "curl", 0, 1, 0.01, () => f.curl, (v) => { f.curl = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(2) });
    slider(card, "spread", -1, 1, 0.01, () => f.spread, (v) => { f.spread = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(2) });
    fingers.appendChild(card);
  }
  const thumb = section(PANEL, "thumb");
  slider(thumb, "curl", 0, 1, 0.01, () => S.pose.thumb.curl, (v) => { S.pose.thumb.curl = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(2) });
  slider(thumb, "opposition", 0, 1, 0.01, () => S.pose.thumb.opposition, (v) => { S.pose.thumb.opposition = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(2) });
  const wrist = section(PANEL, "wrist");
  slider(wrist, "pitch", -20, 20, 0.5, () => S.pose.wrist.pitch, (v) => { S.pose.wrist.pitch = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(0) });
  slider(wrist, "yaw", -25, 25, 0.5, () => S.pose.wrist.yaw, (v) => { S.pose.wrist.yaw = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(0) });
  slider(wrist, "roll", -30, 30, 0.5, () => S.pose.wrist.roll, (v) => { S.pose.wrist.roll = v; }, { apply: () => applyPose(), fmt: (v) => v.toFixed(0) });
}

// ----- camera panel -----
function renderCameraPanel() {
  PANEL.innerHTML = "";
  const mode = section(PANEL, "camera mode");
  const row = el("div", "btnrow");
  const orbitBtn = el("button", "btn" + (S.live.mode === "orbit" ? " primary" : ""), "free orbit");
  orbitBtn.addEventListener("click", () => { S.live.mode = "orbit"; controls.enabled = true; syncModeBadge(); renderCameraPanel(); saveState(); });
  row.appendChild(orbitBtn);
  const pinnedBtn = el("button", "btn" + (S.live.mode === "pinned" ? " primary" : ""), "pinned shot");
  pinnedBtn.addEventListener("click", () => {
    if (!S.cameras.length) { toast("no pinned cameras yet"); return; }
    S.live.mode = "pinned";
    if (!S.cameras.find((x) => x.name === S.live.pinned)) S.live.pinned = S.cameras[S.cameras.length - 1].name;
    controls.enabled = false;
    syncModeBadge(); renderCameraPanel(); saveState();
  });
  row.appendChild(pinnedBtn);
  mode.appendChild(row);
  hint(mode, "any scene thing can be a camera, its local +z is the view direction. free orbit explores; a pinned camera is the deterministic shot. capture records whichever is active.");

  const trio = section(PANEL, "parameters");
  slider(trio, "fieldofview", 15, 60, 0.5, () => S.live.fov, (v) => { S.live.fov = v; }, { apply: () => updateVpOverlay(), fmt: (v) => v.toFixed(0) });
  slider(trio, "focallength", 24, 135, 1, () => S.live.focallength, (v) => { S.live.focallength = v; }, { apply: () => updateVpOverlay(), fmt: (v) => v.toFixed(0) });
  hint(trio, "bigger focallength is blurrier.");
  slider(trio, "focaldistance", 120, 800, 1, () => S.live.focaldistance, (v) => { S.live.focaldistance = v; }, { apply: () => updateVpOverlay(), fmt: (v) => v.toFixed(0) });

  const pin = section(PANEL, "pinned cameras");
  const pinRow = el("div", "row");
  const nameInp = document.createElement("input"); nameInp.type = "text"; nameInp.placeholder = "camera name";
  const pinBtn = el("button", "btn mini", "pin current view");
  pinBtn.addEventListener("click", () => {
    const name = nameInp.value.trim() || "camera " + (S.cameras.length + 1);
    if (S.cameras.find((c) => c.name === name)) { toast("that camera name exists"); return; }
    const pos = S.live.mode === "pinned" ? currentPinned().position : S.live.position;
    const target = S.live.mode === "pinned" ? currentPinned().target : S.live.target;
    S.cameras.push({ name, position: [...pos], target: [...target], fov: S.live.fov, focallength: S.live.focallength, focaldistance: S.live.focaldistance });
    nameInp.value = "";
    renderCameraPanel(); saveState();
    toast(`view pinned as "${name}"`);
  });
  pinRow.append(nameInp, pinBtn);
  pin.appendChild(pinRow);
  if (!S.cameras.length) pin.appendChild(el("div", "empty", "no pinned cameras. frame a view and pin it."));
  for (const c of S.cameras) {
    const item = el("div", "list-item");
    item.appendChild(el("span", "name", c.name));
    const go = el("button", "btn mini", "go");
    go.addEventListener("click", () => {
      S.live.mode = "pinned"; S.live.pinned = c.name; controls.enabled = false;
      syncModeBadge(); renderCameraPanel(); saveState();
    });
    const del = el("button", "btn mini danger", "delete");
    del.addEventListener("click", () => {
      S.cameras = S.cameras.filter((x) => x !== c);
      if (S.live.mode === "pinned" && S.live.pinned === c.name) { S.live.mode = "orbit"; controls.enabled = true; syncModeBadge(); }
      renderCameraPanel(); saveState();
    });
    item.append(go, del);
    pin.appendChild(item);
  }
}
function currentPinned() { return S.cameras.find((c) => c.name === S.live.pinned) || null; }

// ----- light panel -----
function renderLightPanel() {
  PANEL.innerHTML = "";
  const recipes = section(PANEL, "light recipes");
  selectControl(recipes, "recipe", Object.entries(LIGHT_RECIPES).map(([k, v]) => ({ value: k, label: v.label })),
    () => S.lighting.recipe, (v) => { S.lighting.recipe = v; }, { apply: () => {} });
  const applyBtnRow = el("div", "btnrow");
  button(applyBtnRow, "apply recipe values", "btn", () => {
    const r = LIGHT_RECIPES[S.lighting.recipe];
    S.lighting.ambience = r.ambience;
    for (const n of ["key", "fill", "rim"]) S.lighting[n] = { ...r[n] };
    applyLighting(); renderLightPanel(); saveState();
  });
  button(applyBtnRow, "reset to saved values", "btn", () => { applyLighting(); renderLightPanel(); toast("edit-mode values restored"); });
  recipes.appendChild(applyBtnRow);
  hint(recipes, "presets provide a starting point. runtime changes are ephemeral; reset restores the saved values.");
  selectControl(recipes, "ambience", [
    { value: "bright", label: "bright" }, { value: "dim", label: "dim" }, { value: "dark", label: "dark" }
  ], () => S.lighting.ambience, (v) => { S.lighting.ambience = v; }, { apply: () => applyLighting() });

  for (const name of ["key", "fill", "rim"]) {
    const l = S.lighting[name];
    const card = section(PANEL, `${name} light`);
    const onRow = el("div", "row");
    const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = l.on;
    cb.addEventListener("change", () => { l.on = cb.checked; applyLighting(); saveState(); });
    onRow.append(el("label", null, "enabled"), cb);
    card.appendChild(onRow);
    const colorRow = el("div", "row");
    const col = document.createElement("input"); col.type = "color"; col.value = l.color; col.style.width = "42px";
    col.addEventListener("input", () => { l.color = col.value; applyLighting(); saveState(); });
    colorRow.append(el("label", null, "color"), col);
    card.appendChild(colorRow);
    slider(card, "intensity", 0, 6, 0.05, () => l.intensity, (v) => { l.intensity = v; }, { apply: () => applyLighting(), fmt: (v) => v.toFixed(2) });
    slider(card, "azimuth", -180, 180, 1, () => l.azimuth, (v) => { l.azimuth = v; }, { apply: () => applyLighting(), fmt: (v) => v.toFixed(0) });
    slider(card, "elevation", -10, 90, 1, () => l.elevation, (v) => { l.elevation = v; }, { apply: () => applyLighting(), fmt: (v) => v.toFixed(0) });
  }
}

// ----- scene panel -----
function renderScenePanel() {
  PANEL.innerHTML = "";
  const env = section(PANEL, "environment");
  hint(env, "plain backdrops for the first pass. the curated prop library is a later phase and is not part of this build.");
  const sw = el("div", "swatches");
  for (const [name, b] of Object.entries(BACKDROPS)) {
    const btn = el("button", "swatch" + (S.environment.backdrop === name ? " on" : ""));
    btn.style.background = b.center;
    btn.title = name;
    btn.addEventListener("click", () => { S.environment.backdrop = name; applyEnvironment(); renderScenePanel(); saveState(); });
    sw.appendChild(btn);
  }
  env.appendChild(sw);
  hint(env, "paper · warm gray · charcoal · blush · sage · midnight");

  const gate = section(PANEL, "provenance gate");
  hint(gate, "releases entered this scene by reference: id, version, asset hash. every entry below was re-hashed on arrival. the ingestion gate exists for visual reliability and provenance only, never as a castability, safety, or quality claim about a product.");
  const logBox = el("div");
  logBox.id = "gate-entries";
  gate.appendChild(logBox);
  renderGateEntries();

  const st = section(PANEL, "scene state");
  hint(st, "scene state stores quantitative values only: transforms, poses, light values, capture order. the same values reconstruct the same view. qualitative inputs are not kept.");
  const rows = el("div", "btnrow");
  button(rows, "export scene state", "btn", exportSceneState);
  button(rows, "import scene state", "btn", () => $("#file-import").click());
  button(rows, "reset scene", "btn danger", () => { resetScene(); });
  st.appendChild(rows);
}

function renderGateEntries() {
  const box = document.getElementById("gate-entries");
  if (!box) return;
  box.innerHTML = "";
  if (!GATE.entries.length) { box.appendChild(el("div", "empty", "no releases ingested yet")); return; }
  for (const e of [...GATE.entries].reverse().slice(0, 30)) {
    const item = el("div", "list-item");
    item.style.fontSize = "11px";
    item.appendChild(el("span", "name", `${e.release} v${e.version}`));
    const badge = el("span", e.verified ? "gate-ok" : "gate-bad", e.verified ? "hash verified" : "hash mismatch");
    item.appendChild(badge);
    box.appendChild(item);
  }
}

function renderPanel(tab) {
  currentTab = tab;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  if (tab === "subject") renderSubjectPanel();
  else if (tab === "jewelry") renderJewelryPanel();
  else if (tab === "pose") renderPosePanel();
  else if (tab === "camera") renderCameraPanel();
  else if (tab === "light") renderLightPanel();
  else if (tab === "scene") renderScenePanel();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => renderPanel(b.dataset.tab)));
