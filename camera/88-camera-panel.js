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
      if (REC) { toast("pinning is deferred until the recording ends"); return; }
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

