// ===== full state: export, import, reset, restore =====
function exportSceneState() {
  const blob = new Blob([JSON.stringify(serializeState(true), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadLink("studiogram-scene-state.json", url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast("scene state exported");
}

function deepMerge(base, incoming) {
  if (incoming === undefined || incoming === null) return base;
  if (typeof base !== "object" || typeof incoming !== "object" || Array.isArray(base) || Array.isArray(incoming)) {
    return incoming;
  }
  const out = { ...base };
  for (const k of Object.keys(incoming)) out[k] = deepMerge(base[k], incoming[k]);
  return out;
}

async function applyFullState(raw, opts = {}) {
  const def = defaultState();
  const st = deepMerge(def, raw);
  // gate every release reference on import: id, version, mesh hash must match the registry
  const kept = [];
  for (const inst of st.jewelry || []) {
    const gate = await gateRelease(inst.release_id, inst.version, inst.mesh_sha256, inst.mesh_glb_sha256);
    if (gate.ok) kept.push(inst);
    else {
      GATE.entries.push({ utc: nowUtc(), release: inst.release_id, version: inst.version, mesh_sha256: inst.mesh_sha256 || "missing", verified: false });
      toast(`a release reference failed the ingestion gate (${gate.reason}) and was refused`);
    }
  }
  st.jewelry = kept;
  // environment: older saves carry only a preset name under 'backdrop'; the
  // values it prefilled migrate forward so the scene still renders
  if (st.environment && !st.environment.bg && st.environment.backdrop) {
    const b = BACKDROPS[st.environment.backdrop] || BACKDROPS.warm_gray;
    st.environment = { ...b, preset: st.environment.backdrop };
  }
  if (st.hand) st.hand.skin = migrateSkin(st.hand.skin); // pre-preset saves carried skin.tone
  st.subject = st.subject === "bust" ? "bust" : "hand"; // pre-bust saves stay on the hand
  st.bust = migrateBust(st.bust);
  // photos: pull thumbs into memory, keep the rest as values
  for (const c of st.photos || []) {
    if (c.thumb) { CAPTURE_THUMBS.set(c.id, c.thumb); delete c.thumb; }
    if (!c.snapshot) c.snapshot = null; // captures predating snapshots cannot reproduce
    if (!c.gate) c.gate = [];           // photos predating the gate array carry none
  }
  // v1 saves predate capture sets: their captures become the photos of one
  // implicit set, exactly what the old strip showed
  if (Array.isArray(st.captures)) {
    if (st.captures.length && !(st.photos || []).length) {
      st.photos = st.captures;
      const id = "set" + (st.sets && st.sets.length ? st.sets.length + 1 : 1);
      st.sets = [{ id, name: "shoot 1", photo_ids: st.captures.map((c) => c.id) }];
      st.active_set = id;
    }
    delete st.captures;
  }
  st.state_version = 2;
  if (!st.sets || !st.sets.length) { st.sets = [{ id: "set1", name: "shoot 1", photo_ids: [] }]; }
  if (!st.sets.find((x) => x.id === st.active_set)) st.active_set = st.sets[0].id;
  S = st;
  await syncSceneToState();
  renderCaptureStrip();
  renderGateEntries();
  saveState();
}

$("#btn-import-state").addEventListener("click", () => $("#file-import").click());
$("#file-import").addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;
  try {
    const txt = await file.text();
    const data = JSON.parse(txt);
    if (data.schema !== "studiogram-scene-state") { toast("not a studiogram scene state file"); return; }
    await applyFullState(data);
    toast("scene state imported and verified");
  } catch (e) {
    toast("could not read that file: " + e.message);
  }
  ev.target.value = "";
});
$("#btn-reset-scene").addEventListener("click", () => {
  S = defaultState();
  CAPTURE_IMG.clear(); CAPTURE_THUMBS.clear();
  (async () => { await applyFullState(S, { fresh: true }); toast("scene reset to a clean subject"); })();
});
$("#btn-export-state").addEventListener("click", exportSceneState);
// theme: light first, dark as an opt-in. a ui preference, not scene state.
$("#btn-theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("sgtheme", next); } catch (e) {}
  $("#btn-theme").textContent = "theme: " + next;
});
$("#btn-theme").textContent = "theme: " + (document.documentElement.dataset.theme || "light");
$("#btn-export-caps").addEventListener("click", exportCaptureSet);
$("#btn-batch-repro").addEventListener("click", reproduceActiveSet);
$("#btn-capture").addEventListener("click", captureFrame);

