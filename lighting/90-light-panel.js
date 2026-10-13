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

