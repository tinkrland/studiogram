// ----- subject panel -----
function renderSubjectPanel() {
  PANEL.innerHTML = "";
  const model = section(PANEL, "hand model");
  hint(model, "a rigged hand with a real skeleton. poses bend the rig's joints; attached jewelry rides its bone.");
  const stats = el("div", "list-item");
  stats.appendChild(el("span", "name", `${HAND.source.title} · ${HAND.boneCount} bones`));
  stats.appendChild(el("span", "dim", Object.keys(POSE_PRESETS).length + " poses"));
  model.appendChild(stats);
  if (HAND.loaded) {
    model.appendChild(el("div", "empty",
      "skinned mesh: " + HAND.skinned.geometry.attributes.position.count + " vertices"));
  }

  const finish = section(PANEL, "finish");
  hint(finish, "the hand presents as a matte porcelain display hand, or with its original skin textures. the piece is the subject; the hand is the stand.");
  const finishRow = el("div", "btnrow");
  for (const key of ["porcelain", "skin"]) {
    const b = el("button", "btn" + (S.hand.finish === key ? " primary" : ""), key);
    b.addEventListener("click", () => { S.hand.finish = key; applyFinish(); saveState(); renderSubjectPanel(); });
    finishRow.appendChild(b);
  }
  finish.appendChild(finishRow);

  const surface = section(PANEL, "surface");
  hint(surface,
    "the skin layer, independent of morphology: tone tints the base skin texture, body hair is follicle strokes composited on the forearm. available on every presentation preset; visible on the skin finish.");
  const scard = el("div", "card");
  const sk = S.hand.skin;
  // skin tone: pick a preset first (grouped fair to deep), then adjust it.
  // a hex field is deliberately not the first option: presets are the
  // starting point, the three sliders refine them.
  const swatchBox = el("div", "skin-swatches");
  const paintSwatches = () => {
    swatchBox.innerHTML = "";
    for (const g of SKIN_GROUPS) {
      const rowEl = el("div", "skin-row");
      rowEl.appendChild(el("span", "skin-group", g));
      for (const pr of SKIN_PRESETS.filter((x) => x.group === g)) {
        const b = el("button", "skin-swatch" + (sk.preset === pr.key ? " sel" : ""));
        b.style.background = pr.hex;
        b.title = pr.label + " " + pr.hex;
        b.setAttribute("aria-label", pr.label);
        b.addEventListener("click", () => {
          sk.preset = pr.key;
          sk.lightness = 0; sk.warmth = 0; sk.depth = 0;   // a fresh preset starts clean
          applySurface(); saveState(); renderSubjectPanel();
        });
        rowEl.appendChild(b);
      }
      swatchBox.appendChild(rowEl);
    }
  };
  paintSwatches();
  scard.appendChild(swatchBox);
  scard.appendChild(el("div", "hint", `${skinPreset(sk.preset).label} · adjusted ${skinAlbedoHex()}`));
  const adj = (label, key) => slider(scard, label, -1, 1, 0.05,
    () => sk[key] || 0, (v) => { sk[key] = v; },
    { apply: () => applySurface(), fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(2) });
  adj("lightness", "lightness");
  adj("warmth", "warmth");
  adj("depth", "depth");
  button(scard, "reset to preset", "btn mini", () => { sk.lightness = 0; sk.warmth = 0; sk.depth = 0; applySurface(); saveState(); renderSubjectPanel(); });
  slider(scard, "body hair", 0, 1, 0.05,
    () => sk.hair,
    (v) => { sk.hair = v; },
    { apply: () => applySurface(), fmt: (v) => v.toFixed(2) });
  surface.appendChild(scard);

  // nails: a real plate on each finger. pick a shape from the library, then
  // a length slider appears for it. polish colour tints the plate itself.
  const nails = section(PANEL, "nails");
  hint(nails, "pick a nail shape, then set its length. the plate is real geometry on each fingertip, so it follows posing and shows on both the porcelain and skin finishes.");
  const nl = S.hand.nails;
  const shapeGrid = el("div", "nail-shapes");
  for (const key of NAIL_SHAPE_ORDER) {
    const def = NAIL_SHAPES[key];
    const b = el("button", "nail-shape" + (nl.shape === key ? " sel" : ""));
    b.title = def.label;
    b.setAttribute("aria-label", def.label);
    b.appendChild(nailShapeIcon(key));
    b.appendChild(el("span", null, def.label));
    b.addEventListener("click", () => {
      nl.shape = key;
      if (typeof nl.length !== "number") nl.length = 0.4;
      applyNails(); saveState(); renderSubjectPanel();
    });
    shapeGrid.appendChild(b);
  }
  nails.appendChild(shapeGrid);
  if (nl.shape && NAIL_SHAPES[nl.shape]) {
    const lcard = el("div", "card");
    slider(lcard, "length", 0, 1, 0.01,
      () => nl.length,
      (v) => { nl.length = v; },
      { apply: () => applyNails(), fmt: (v) => (v * 100).toFixed(0) + "%" });
    nails.appendChild(lcard);
  }
  const nailRow = el("div", "row");
  nailRow.appendChild(el("label", null, "polish"));
  const nailBtns = el("div", "btnrow");
  nailBtns.style.margin = "0";
  for (const key of ["natural", "polished"]) {
    const b = el("button", "btn mini" + (nl.style === key ? " primary" : ""), key);
    b.addEventListener("click", () => { nl.style = key; applyNails(); applySurface(); renderSubjectPanel(); saveState(); });
    nailBtns.appendChild(b);
  }
  const ncol = document.createElement("input");
  ncol.type = "color"; ncol.value = nl.color || "#b23a48"; ncol.style.width = "42px";
  ncol.addEventListener("input", () => { nl.color = ncol.value; applyNails(); applySurface(); saveState(); });
  nailBtns.appendChild(ncol);
  nailRow.appendChild(nailBtns);
  nails.appendChild(nailRow);

  const tat = section(PANEL, "tattoos");
  hint(tat, "sleeve-on placement: pick a design, enter place mode, and the ink follows the surface under your cursor. the commit paints into the hand's texture, so it rides posing and morphs instead of sitting on top as geometry. click to commit, esc to leave. visible on the skin finish.");
  const drow = el("div", "btnrow");
  for (const k of DESIGN_ORDER) {
    const b = el("button", "btn mini" + (TATTOO.design === k ? " primary" : ""), k);
    b.addEventListener("click", () => {
      TATTOO.design = k;
      if (HAND.tattooGhost) HAND.tattooGhost.design = k;
      applySurface();
      renderSubjectPanel(); saveState();
    });
    drow.appendChild(b);
  }
  tat.appendChild(drow);
  const tcard = el("div", "card");
  slider(tcard, "size", 0.02, 0.15, 0.005,
    () => TATTOO.size,
    (v) => { TATTOO.size = v; if (HAND.tattooGhost) HAND.tattooGhost.w = v; },
    { apply: () => applySurface(), fmt: (v) => v.toFixed(3) });
  slider(tcard, "rotation", -Math.PI, Math.PI, 0.1,
    () => TATTOO.rot,
    (v) => { TATTOO.rot = v; if (HAND.tattooGhost) HAND.tattooGhost.rot = v; },
    { apply: () => applySurface(), fmt: (v) => Math.round(v * 57.3) + "°" });
  tat.appendChild(tcard);
  const trow = el("div", "btnrow");
  const placeBtn = el("button", "btn" + (TATTOO.active ? " primary" : ""), TATTOO.active ? "placing — click the hand, esc to finish" : "place tattoo");
  placeBtn.addEventListener("click", () => setTattooMode(!TATTOO.active));
  trow.appendChild(placeBtn);
  const clearBtn = el("button", "btn", "clear");
  clearBtn.addEventListener("click", () => {
    if (!S.hand.tattoos.length) { toast("no tattoos to clear"); return; }
    S.hand.tattoos = [];
    applySurface(); renderSubjectPanel(); saveState();
    toast("tattoos cleared");
  });
  trow.appendChild(clearBtn);
  tat.appendChild(trow);
  tat.appendChild(el("div", "empty",
    S.hand.tattoos.length ? S.hand.tattoos.length + " tattoo" + (S.hand.tattoos.length === 1 ? "" : "s") + " painted"
    : "no tattoos painted yet."));

  const morpho = section(PANEL, "morphology");
  hint(morpho,
    "seven authored blend targets on the one base mesh. presentation presets are blend weights, not different files; the sliders stack on top of them.");
  const presRow = el("div", "btnrow");
  for (const key of ["hand", "male hand", "female hand"]) {
    const b = el("button", "btn" + (S.hand.presentation === key ? " primary" : ""), key);
    b.addEventListener("click", () => {
      S.hand.presentation = key;
      applyMorphs();
      saveState();
      renderSubjectPanel();
    });
    presRow.appendChild(b);
  }
  morpho.appendChild(presRow);
  const mg = S.hand.morph;
  const morphDefs = [
    ["build", -1, 1, 0.05],
    ["finger length", -1, 1, 0.05],
    ["finger thickness", -1, 1, 0.05],
    ["palm width", -1, 1, 0.05],
    ["palm proportions", -1, 1, 0.05]
  ];
  const morphKeys = { "finger length": "finger_length", "finger thickness": "finger_thickness", "palm width": "palm_width", "palm proportions": "palm_proportions", "build": "build" };
  const morphDefs2 = [];   // nail length and shape moved to the nails section: a real plate with a shape library
  const mcard = el("div", "card");
  for (const [label, lo, hi, st, kOverride] of morphDefs.map((d) => [d[0], d[1], d[2], d[3], morphKeys[d[0]]]).concat(morphDefs2)) {
    const k = kOverride;
    slider(mcard, label, lo, hi, st,
      () => mg[k],
      (v) => { mg[k] = v; },
      { apply: () => applyMorphs(), fmt: (v) => v.toFixed(2) });
  }
  morpho.appendChild(mcard);

  // saved hands: the creator's hand library. a saved hand carries the full
  // shape-plus-surface set; pose and jewelry stay per-shoot.
  const saved = section(PANEL, "saved hands");
  hint(saved, "save a hand once. a saved configuration keeps the complete shape-plus-surface set: presentation, build, finish, tone, hair, and ink. pose and jewelry stay per-shoot. apply a saved hand to swap the subject without touching the shoot.");
  const saveRow = el("div", "row");
  const nameInp = document.createElement("input");
  nameInp.type = "text"; nameInp.placeholder = "name this hand";
  const saveBtn = el("button", "btn", "save current hand");
  saveRow.append(nameInp, saveBtn);
  saved.appendChild(saveRow);
  saveBtn.addEventListener("click", () => {
    const cfg = saveCurrentHand(nameInp.value);
    nameInp.value = "";
    toast(`saved hand '${cfg.name}' to the library`);
    renderSubjectPanel();
  });
  nameInp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") saveBtn.click(); });
  if (!SAVED_HANDS.length) {
    saved.appendChild(el("div", "empty", "no saved hands yet. shape one, name it, save it."));
  }
  for (const cfg of SAVED_HANDS) {
    const card = el("div", "card");
    const t = el("div", "t");
    t.appendChild(el("b", null, cfg.name));
    const h = cfg.hand;
    t.appendChild(el("span", null,
      h.presentation + " · " + h.finish + " · " + (migrateSkin(h.skin).preset.replace(/_/g, " ")) +
      " · " + (h.tattoos?.length || 0) + ((h.tattoos?.length || 0) === 1 ? " tattoo" : " tattoos")));
    card.appendChild(t);
    const meta = el("div", "meta",
      "build " + (h.morph?.build ?? 0).toFixed(2) +
      " · hair " + (h.skin?.hair ?? 0.35).toFixed(2) +
      " · saved " + (cfg.created_utc || "").slice(0, 10));
    card.appendChild(meta);
    const actions = el("div", "btnrow");
    const applyBtn = el("button", "btn mini", "apply");
    applyBtn.addEventListener("click", () => {
      applySavedHand(cfg);
      toast(`applied saved hand '${cfg.name}'`);
      renderSubjectPanel();
    });
    const delBtn = el("button", "btn mini", "delete");
    delBtn.addEventListener("click", () => {
      deleteSavedHand(cfg);
      toast(`removed saved hand '${cfg.name}'`);
      renderSubjectPanel();
    });
    actions.append(applyBtn, delBtn);
    card.appendChild(actions);
    saved.appendChild(card);
  }

  const credit = section(PANEL, "model credit");
  hint(credit,
    `'Rigged Hand' by ${HAND.source.author}, ${HAND.source.origin}. released under ${HAND.source.license}: free to use and adapt, including commercially, with this credit kept attached.`);
}
