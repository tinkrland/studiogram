
// morphology: seven authored blend targets on the single base mesh drive
// every hand variation. presentation presets set weights; the sliders stack
// on top. there is no second hand asset and never a slider without a target.
function applyMorphs() {
  for (const m of (HAND.skinMeshes || [])) {
    const dict = m.morphTargetDictionary;
    if (!dict) continue;
    const inf = m.morphTargetInfluences;
    for (const name of Object.keys(dict)) inf[dict[name]] = 0;
    if (S.hand.presentation === "male hand") inf[dict["presentation_male"]] = 1;
    if (S.hand.presentation === "female hand") inf[dict["presentation_female"]] = 1;
    for (const [k, v] of Object.entries(S.hand.morph)) {
      if (dict[k] !== undefined) inf[dict[k]] = v;
    }
  }
}

