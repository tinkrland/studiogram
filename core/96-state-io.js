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
    const rec = byRelease.get(inst.release_id);
    const ok = rec && rec.version === inst.version && rec.assets.mesh_sha256 === inst.mesh_sha256;
    if (ok) kept.push(inst);
    else {
      GATE.entries.push({ utc: nowUtc(), release: inst.release_id, version: inst.version, mesh_sha256: inst.mesh_sha256 || "missing", verified: false });
      toast("a release reference failed the ingestion gate and was refused");
    }
  }
  st.jewelry = kept;
  // captures: pull thumbs into memory, keep the rest as values
  for (const c of st.captures || []) {
    if (c.thumb) { CAPTURE_THUMBS.set(c.id, c.thumb); delete c.thumb; }
    if (!c.snapshot) c.snapshot = null; // captures predating snapshots cannot reproduce
  }
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
$("#btn-export-caps").addEventListener("click", exportCaptureSet);
$("#btn-capture").addEventListener("click", captureFrame);

