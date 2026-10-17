// ----- scene panel -----
function renderScenePanel() {
  PANEL.innerHTML = "";
  const subj = section(PANEL, "subject");
  hint(subj, "one subject on stage at a time: the rigged hand or the bust. switching reframes the camera; the hand's shape, pose and jewelry stay saved.");
  const srow = el("div", "btnrow");
  for (const kind of ["hand", "bust"]) {
    const b = button(srow, kind, "btn" + (S.subject === kind ? " on" : ""), () => setSubject(kind));
    b.style.borderColor = S.subject === kind ? "var(--accent)" : "";
  }
  subj.appendChild(srow);
  const env = section(PANEL, "environment");
  hint(env, "plain backdrops with free color values.");
  const sw = el("div", "swatches");
  for (const [name, b] of Object.entries(BACKDROPS)) {
    // a preset is on only while the live values equal it: editing the values
    // by hand un-highlights the swatch, since the render follows the values
    const on = S.environment.bg === b.bg && S.environment.center === b.center;
    const btn = el("button", "swatch" + (on ? " on" : ""));
    btn.style.background = b.center;
    btn.title = name;
    btn.addEventListener("click", () => { S.environment = { ...b, preset: name }; applyEnvironment(); renderScenePanel(); saveState(); });
    sw.appendChild(btn);
  }
  env.appendChild(sw);
  hint(env, "presets prefill the values below: paper · warm gray · charcoal · blush · sage · midnight. any value can then be adjusted by hand.");
  const envRows = el("div");
  for (const key of ["bg", "center"]) {
    const row = el("div", "row");
    const inp = document.createElement("input"); inp.type = "color";
    inp.value = S.environment[key];
    inp.addEventListener("input", () => { S.environment[key] = inp.value; applyEnvironment(); saveState(); });
    row.append(el("label", null, key === "bg" ? "edge" : "center lift"), inp);
    envRows.appendChild(row);
  }
  env.appendChild(envRows);

  const props = section(PANEL, "props");
  hint(props, "set dressing as real scene objects: placed into the backdrop, saved in scene state with per-prop provenance, rendered identically every time. background only — never worn, never attached to the subject. the platform's curated sam-3d library will feed this later; until then the entries are authored placeholder geometry.");
  const prow = el("div", "btnrow");
  for (const [kind, def] of Object.entries(PROP_LIBRARY)) {
    button(prow, "+ " + def.label, "btn", () => addProp(kind));
  }
  props.appendChild(prow);
  for (const p of S.props) {
    const def = PROP_LIBRARY[p.prop];
    if (!def) continue;
    const row = el("div", "row");
    row.appendChild(el("label", null, def.label));
    const mk = (min, max, step, val,fn, title) => {
      const i = document.createElement("input"); i.type = "range";
      i.min = min; i.max = max; i.step = step; i.value = val; i.title = title;
      i.addEventListener("input", () => { fn(+i.value); clampProp(p); applyProps(); saveState(); });
      return i;
    };
    row.append(
      mk(-800, 800, 10, p.x, (v) => p.x = v, "x"),
      mk(-900, -180, 10, p.z, (v) => p.z = v, "depth"),
      mk(0, 360, 5, p.rotY, (v) => p.rotY = v, "rotation"),
      mk(0.4, 2, 0.05, p.scale, (v) => p.scale = v, "scale")
    );
    button(row, "remove", "btn danger", () => removeProp(p.id));
    props.appendChild(row);
  }

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

