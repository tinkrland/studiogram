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

