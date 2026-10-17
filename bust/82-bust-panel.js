// ===== the bust panel: the subject tab while the bust is on stage =====
// tone reuses the hand's palette verbatim (nine swatch presets plus the three
// adjustments) so one person reads one tone across hand and bust shots.
function renderBustPanel() {
  PANEL.innerHTML = "";
  if (!BUST.loaded) {
    const box = section(PANEL, "bust subject");
    if (BUST.loadError) hint(box, "the bust did not load: " + BUST.loadError + ". the mesh is never rendered unverified.");
    else hint(box, "the bust loads on demand and verifies its sha256 before rendering.");
    return;
  }
  const sub = section(PANEL, "bust subject");
  hint(sub, "head sculpt - female, cc0. provenance: assets/bust-provenance.md. " +
    BUST.mesh.geometry.attributes.position.count + " verts, tone follows the hand's palette.");

  const tone = S.bust.tone;
  const scard = section(PANEL, "skin tone");
  const sw = el("div", "swatches");
  for (const p of SKIN_PRESETS) {
    const btn = el("button", "swatch" + (tone.preset === p.key ? " on" : ""));
    btn.style.background = p.hex;
    btn.title = p.label;
    btn.addEventListener("click", () => {
      tone.preset = p.key;
      tone.lightness = 0; tone.warmth = 0; tone.depth = 0;
      applyBustTone(); saveState(); renderBustPanel();
    });
    sw.appendChild(btn);
  }
  scard.appendChild(sw);
  scard.appendChild(el("div", "hint", `${skinPreset(tone.preset).label} · adjusted ${bustAlbedoHex(tone)}`));
  const adj = (label, key) => slider(scard, label, -1, 1, 0.05,
    () => tone[key] || 0, (v) => { tone[key] = v; },
    { apply: () => applyBustTone(), fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(2) });
  adj("lightness", "lightness");
  adj("warmth", "warmth");
  adj("depth", "depth");
  button(scard, "reset to preset", "btn mini", () => {
    tone.lightness = 0; tone.warmth = 0; tone.depth = 0;
    applyBustTone(); saveState(); renderBustPanel();
  });

  const ear = section(PANEL, "ear seats");
  hint(ear, "seats thread authored anatomy: front anchor to back exit, the ear hides the middle. the left ear mirrors the right by default; the lobe height still awaits a human-eye pass.");
  for (const site of EAR_SITES) {
    const cfg = S.bust.ear[site];
    const row = el("div", "row");
    row.appendChild(el("label", null, site));
    const piece = document.createElement("select");
    for (const p of EAR_PIECES) {
      const o = document.createElement("option"); o.value = p; o.textContent = p; piece.appendChild(o);
    }
    piece.value = cfg.piece;
    piece.addEventListener("change", () => { cfg.piece = piece.value; buildEarSeats(); saveState(); });
    const metal = document.createElement("select");
    for (const [k, m] of Object.entries(METALS)) {
      const o = document.createElement("option"); o.value = k; o.textContent = m.label; metal.appendChild(o);
    }
    metal.value = cfg.metal;
    metal.addEventListener("change", () => { cfg.metal = metal.value; buildEarSeats(); saveState(); });
    row.append(piece, metal);
    if (site === "lobe") {
      const gem = document.createElement("label");
      gem.style.marginLeft = "6px";
      const cb = document.createElement("input"); cb.type = "checkbox";
      cb.checked = !S.bust.ear.lobe.metalBead;
      cb.addEventListener("change", () => { S.bust.ear.lobe.metalBead = !cb.checked; buildEarSeats(); saveState(); });
      gem.append(cb, document.createTextNode("gem"));
      row.appendChild(gem);
    }
    ear.appendChild(row);
  }
  const mrow = el("div", "row");
  mrow.appendChild(el("label", null, "mirror to left ear"));
  const mcb = document.createElement("input"); mcb.type = "checkbox";
  mcb.checked = S.bust.ear.mirror_left;
  mcb.addEventListener("change", () => { S.bust.ear.mirror_left = mcb.checked; buildPiercings(); saveState(); });
  mrow.appendChild(mcb);
  ear.appendChild(mrow);

  const nose = section(PANEL, "nose seats");
  hint(nose, "nostril pins thread the nostril wall, the septum ring hangs through the columella channel. both nostrils are set separately.");
  for (const [key, label] of [["nostril", "right nostril"], ["nostril_l", "left nostril"], ["septum", "septum"]]) {
    const cfg = S.bust.nose[key];
    const row = el("div", "row");
    row.appendChild(el("label", null, label));
    const piece = document.createElement("select");
    for (const o of NOSE_PIECES[key === "septum" ? "septum" : "nostril"]) {
      const op = document.createElement("option"); op.value = o; op.textContent = o; piece.appendChild(op);
    }
    piece.value = cfg.piece;
    piece.addEventListener("change", () => { cfg.piece = piece.value; buildPiercings(); saveState(); });
    const metal = document.createElement("select");
    for (const [k, m] of Object.entries(METALS)) {
      const o = document.createElement("option"); o.value = k; o.textContent = m.label; metal.appendChild(o);
    }
    metal.value = cfg.metal;
    metal.addEventListener("change", () => { cfg.metal = metal.value; buildPiercings(); saveState(); });
    row.append(piece, metal);
    nose.appendChild(row);
  }

  const neck = section(PANEL, "necklace");
  hint(neck, "the chain is a verlet settle: it falls under gravity, the resting shells push back, and the surplus hangs free. the pendant is weight that drags the droop. same length, same curve, every time.");
  const styles = [["none", "none"], ["choker", "choker (40cm)"], ["princess", "princess (46cm)"], ["custom", "custom length"]];
  selectControl(neck, "style", styles.map(([v, l]) => ({ value: v, label: l })),
    () => S.bust.necklace.style,
    (v) => {
      S.bust.necklace.style = v;
      if (v === "choker") S.bust.necklace.length_cm = 40;
      if (v === "princess") S.bust.necklace.length_cm = 46;
    },
    { apply: () => { buildNecklace(); renderBustPanel(); } });
  if (S.bust.necklace.style === "custom") {
    slider(neck, "length", 36, 60, 0.5,
      () => S.bust.necklace.length_cm,
      (v) => { S.bust.necklace.length_cm = v; },
      { apply: () => buildNecklace(), fmt: (v) => v.toFixed(1) + "cm" });
  }
  selectControl(neck, "metal", Object.entries(METALS).map(([k, m]) => ({ value: k, label: m.label })),
    () => S.bust.necklace.metal,
    (v) => { S.bust.necklace.metal = v; },
    { apply: () => buildNecklace() });
  const prow = el("div", "row");
  prow.appendChild(el("label", null, "pendant"));
  const pcb = document.createElement("input"); pcb.type = "checkbox";
  pcb.checked = S.bust.necklace.pendant;
  pcb.addEventListener("change", () => { S.bust.necklace.pendant = pcb.checked; buildNecklace(); saveState(); });
  prow.appendChild(pcb);
  neck.appendChild(prow);
}
