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

