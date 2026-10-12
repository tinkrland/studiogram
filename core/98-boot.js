// ===== boot =====
function restoreFromStorage() {
  try {
    const txt = localStorage.getItem("studiogram_state");
    if (!txt) return null;
    const data = JSON.parse(txt);
    if (data.schema !== "studiogram-scene-state") return null;
    // scenes saved against the old procedural hand no longer apply: the
    // rig, its bone space, and every camera framing changed with the model
    if (!data.hand || data.hand.model !== "rigged-hand-v4.1") return null;
    return data;
  } catch (e) { return null; }
}


