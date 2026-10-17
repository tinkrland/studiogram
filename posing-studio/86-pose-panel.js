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

  // moves: the take choreography. an ordered list of finger moves that
  // plays during a take (and rehearses live with the preview button):
  // after its delay, a move eases its value to the target. the list is
  // state, so the same choreography re-renders the same take.
  const moves = section(PANEL, "moves");
  hint(moves, "choreography for takes: each move eases one finger value after its delay, in list order. play it live with the preview, or hit record and it runs on the take's clock.");
  S.moves.forEach((m, i) => {
    const row = el("div", "row");
    const num = el("span", "pill");
    num.textContent = (i + 1) + ".";
    row.appendChild(num);
    const fsel = el("select");
    for (const f of MOVE_FINGERS) {
      const o = el("option"); o.value = f; o.textContent = f;
      if (m.finger === f) o.selected = true;
      fsel.appendChild(o);
    }
    fsel.addEventListener("change", () => { S.moves[i] = sanitizeMove({ ...m, finger: fsel.value }, i); saveState(); renderPosePanel(); });
    row.appendChild(fsel);
    const wsel = el("select");
    for (const w of MOVE_WHATS[fsel.value] || ["curl"]) {
      const o = el("option"); o.value = w; o.textContent = w;
      if (m.what === w) o.selected = true;
      wsel.appendChild(o);
    }
    wsel.addEventListener("change", () => { S.moves[i] = sanitizeMove({ ...m, what: wsel.value }, i); saveState(); renderPosePanel(); });
    row.appendChild(wsel);
    const tIn = el("input");
    tIn.type = "number"; tIn.min = 0; tIn.max = MOVE_T_MAX; tIn.step = 0.5; tIn.value = m.t;
    tIn.title = "seconds after record start";
    tIn.addEventListener("change", () => { S.moves[i] = sanitizeMove({ ...m, t: +tIn.value }, i); saveState(); renderPosePanel(); });
    row.appendChild(tIn);
    const toS = el("span", "pill"); toS.textContent = "to"; row.appendChild(toS);
    const toIn = el("input");
    toIn.type = "range"; toIn.min = 0; toIn.max = 1; toIn.step = 0.05; toIn.value = m.to;
    toIn.addEventListener("input", () => { S.moves[i].to = +toIn.value; saveState(); });
    row.appendChild(toIn);
    const ovIn = el("input");
    ovIn.type = "range"; ovIn.min = 0.2; ovIn.max = MOVE_OVER_MAX; ovIn.step = 0.1; ovIn.value = m.over;
    ovIn.title = "ease duration (s)";
    ovIn.addEventListener("input", () => { S.moves[i].over = +ovIn.value; saveState(); });
    row.appendChild(ovIn);
    const up = button(row, "up", "btn sm", () => { if (i > 0) { const t = S.moves[i - 1]; S.moves[i - 1] = S.moves[i]; S.moves[i] = t; saveState(); renderPosePanel(); } });
    const dn = button(row, "down", "btn sm", () => { if (i < S.moves.length - 1) { const t = S.moves[i + 1]; S.moves[i + 1] = S.moves[i]; S.moves[i] = t; saveState(); renderPosePanel(); } });
    const rm = button(row, "remove", "btn sm danger", () => { S.moves.splice(i, 1); saveState(); renderPosePanel(); });
    up.title = dn.title = rm.title = "";
    moves.appendChild(row);
  });
  const mrow = el("div", "btnrow");
  button(mrow, "+ add move", "btn", () => {
    const last = S.moves[S.moves.length - 1];
    S.moves.push(sanitizeMove({ id: "m" + Date.now().toString(36), finger: "index", what: "curl", t: last ? last.t + last.over + 1 : 2, to: 0.8, over: 0.8 }, S.moves.length));
    saveState(); renderPosePanel();
  });
  button(mrow, MOVES.playing ? "stop preview" : "preview moves", "btn", () => {
    if (MOVES.playing) stopMoves(true); else previewMoves();
    renderPosePanel();
  });
  moves.appendChild(mrow);
}

