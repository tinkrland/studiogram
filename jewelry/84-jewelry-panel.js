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
    const nav = el("div", "btnrow");
    const up = el("button", "btn mini", "stack toward hand");
    up.addEventListener("click", () => { reorderJewelry(j.iid, "hand"); renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); });
    const down = el("button", "btn mini", "stack toward tip");
    down.addEventListener("click", () => { reorderJewelry(j.iid, "tip"); renderJewelryPanel(); if (currentTab === "jewelry") renderPanel(currentTab); });
    nav.append(up, down);
    card.appendChild(nav);
    const rm = el("button", "btn mini danger", "remove from scene");
    rm.addEventListener("click", () => removeJewelryInstance(j.iid));
    card.appendChild(rm);
    inst.appendChild(card);
  }
}

