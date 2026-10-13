// forearm follicle candidates exported from the base mesh's uv space.
// injected at build time from the mesh itself — no hand-picked region.
const HAIR_REGION = /*__HAIRPTS__*/[];

// nail-plate uv points per finger, exported the same way: the brightest
// texels of each distal phalanx, clustered. the plate is where polish goes.
const NAIL_REGION = /*__NAILPTS__*/{};

// surface layer: skin tone tints the base texture and body hair is drawn
// as follicle strokes into the composite, before any material assignment.
// one canvas rebuild serves both — the state is the truth, the texture is
// derived. hair candidates come from the forearm's uv region, so density
// stays anchored to the surface regardless of morph weights.
// ---- skin tone: presets first, adjustable after ----
// a preset is a starting albedo, grouped the way the owner's reference
// sheets group them: fair through deep, each row a different undertone.
// the creator picks one, then nudges it with lightness / warmth / depth, so
// a preset is a prefill on the same controls as manual tuning, never a
// separate rendering path (the same rule as backdrops).
const SKIN_PRESETS = [
  // sampled from the owner's uploaded skin-tone reference sheets: the nine
  // distinct swatch colours those charts carry, ordered light to deep. the
  // panel shows them by group; the three adjustments stack on top of a pick.
  { key: "petal",     label: "petal",     group: "light",  hex: "#f1c8b0" },
  { key: "shell",     label: "shell",     group: "light",  hex: "#e6b89d" },
  { key: "sand",      label: "sand",      group: "light",  hex: "#dbac88" },
  { key: "golden",    label: "golden",    group: "medium", hex: "#d49d79" },
  { key: "tan",       label: "tan",      group: "medium", hex: "#c58a63" },
  { key: "caramel",   label: "caramel",   group: "medium", hex: "#b37856" },
  { key: "bronze",    label: "bronze",    group: "deep",   hex: "#9f6c4e" },
  { key: "chestnut",  label: "chestnut",  group: "deep",   hex: "#8b593f" },
  { key: "espresso",  label: "espresso",  group: "deep",   hex: "#724932" },
];
const SKIN_GROUPS = ["light", "medium", "deep"];
const skinPreset = (key) => SKIN_PRESETS.find((p) => p.key === key) || SKIN_PRESETS.find((p) => p.key === "golden");

const hexToRgb01 = (hex) => { const h = hex.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); };
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const linToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055);

// the albedo the creator ends up with: preset hex, then three adjustments.
//   lightness  -1..1  scales luminance in linear light
//   warmth     -1..1  shifts undertone: warm pushes red/yellow, cool pushes pink/blue
//   depth      -1..1  saturation: less = muted/greyer, more = richer
// returns linear rgb. all three default to 0, so a bare preset is the swatch.
function skinAlbedo() {
  const sk = S.hand.skin || {};
  const base = hexToRgb01(skinPreset(sk.preset).hex).map(srgbToLin);
  const L = sk.lightness || 0, W = sk.warmth || 0, D = sk.depth || 0;
  let c = base.map((v) => v * Math.pow(2, L * 0.9));
  const lum = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  c = c.map((v) => lum + (v - lum) * (1 + D * 0.7));
  c = [c[0] * (1 + W * 0.10), c[1] * (1 + W * 0.02), c[2] * (1 - W * 0.14)];
  return c.map((v) => Math.min(1, Math.max(0, v)));
}
// saves that predate presets carry skin.tone (0..1, a multiply tint on the
// pink-tan texture). map each to the preset whose swatch the old tint
// rendered closest to, so an old scene keeps its look. the old default
// (tone 0.4, about #a46d5d) lands on bronze; new scenes open on golden.
function migrateSkin(sk) {
  const d = { preset: "golden", lightness: 0, warmth: 0, depth: 0, hair: 0.35 };
  if (!sk || typeof sk !== "object") return d;
  if (sk.preset && SKIN_PRESETS.some((p) => p.key === sk.preset)) return { ...d, ...sk, tone: undefined };
  const t = Math.min(1, Math.max(0, typeof sk.tone === "number" ? sk.tone : 0.4));
  // old rendered colour = texture mean (0.80,0.57,0.51) * lerp(1, [.52,.36,.29], t)
  const old = [0.80, 0.57, 0.51].map((v, i) => v * (1 + ([0.52, 0.36, 0.29][i] - 1) * t));
  let best = null, bd = 1e9;
  for (const pr of SKIN_PRESETS) {
    const c = hexToRgb01(pr.hex);
    const dist = Math.hypot(c[0] - old[0], c[1] - old[1], c[2] - old[2]);
    if (dist < bd) { bd = dist; best = pr.key; }
  }
  return { ...d, preset: best, hair: typeof sk.hair === "number" ? sk.hair : d.hair };
}
function skinAlbedoHex() {
  const c = skinAlbedo().map((v) => Math.round(Math.min(1, Math.max(0, linToSrgb(v))) * 255));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function applySurface() {
  if (!HAND.skinMeshes || !HAND.skinMaterials) return;
  const hair = S.hand.skin?.hair ?? 0.35;
  HAND.skinMaterials.forEach((mat, i) => {
    // always the pristine glb map: once the skin finish is on, mat.map is the
    // surface canvas itself, and drawing a canvas onto itself erases it
    const base = HAND.baseMaps?.get(i) || mat.map;
    if (!base || !base.image) return;
    const size = 1024;
    let cv = HAND.surfaceCanvas?.get(i);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = size; cv.height = size;
      if (!HAND.surfaceCanvas) HAND.surfaceCanvas = new Map();
      HAND.surfaceCanvas.set(i, cv);
      HAND.surfaceTexture = HAND.surfaceTexture || new Map();
      const tex = new THREE.CanvasTexture(cv);
      tex.flipY = false;               // gltf uv convention
      tex.colorSpace = THREE.SRGBColorSpace;
      HAND.surfaceTexture.set(i, tex);
    }
    const ctx = cv.getContext("2d");
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(base.image, 0, 0, size, size);
    // skin colour: the albedo is the colour, the base texture contributes only
    // its shading (creases, knuckles, veins) as a soft overlay. building the
    // colour from the albedo instead of tinting the pink-tan texture is what
    // lets a pale preset stay pale without clipping and a deep one stay deep.
    {
      const a = skinAlbedo().map((v) => Math.round(linToSrgb(v) * 255));
      const shade = ctx.getImageData(0, 0, size, size);
      const d = shade.data;
      const BASE_LUM = 0.338;            // median linear luminance of the hand colour map over the texels the mesh covers
      const DETAIL = 0.55;               // how much of the texture's shading survives (0 flat, 1 all)
      for (let q = 0; q < d.length; q += 4) {
        const lr = srgbToLin(d[q] / 255), lg = srgbToLin(d[q + 1] / 255), lb = srgbToLin(d[q + 2] / 255);
        const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
        const rel = 1 + (y / BASE_LUM - 1) * DETAIL;               // 1 = average shading
        const k = Math.min(1.35, Math.max(0.35, rel));
        d[q]     = Math.min(255, Math.round(linToSrgb(srgbToLin(a[0] / 255) * k) * 255));
        d[q + 1] = Math.min(255, Math.round(linToSrgb(srgbToLin(a[1] / 255) * k) * 255));
        d[q + 2] = Math.min(255, Math.round(linToSrgb(srgbToLin(a[2] / 255) * k) * 255));
      }
      ctx.putImageData(shade, 0, 0);
    }
    // body hair: forearm follicle candidates, deterministic per index
    if (hair > 0.001 && Array.isArray(HAIR_REGION) && HAIR_REGION.length) {
      const rnd = mulberry32(0x5EED0001 + i);
      ctx.globalCompositeOperation = "source-over";
      const n = Math.round(HAIR_REGION.length * Math.min(1, hair));
      for (let k = 0; k < n; k++) {
        const [u, v] = HAIR_REGION[k];
        const x = u * size, y = v * size;
        const ang = rnd() * Math.PI;
        const len = 4 + rnd() * 6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.strokeStyle = `rgba(52, 34, 24, ${0.28 + rnd() * 0.3})`;
        ctx.lineWidth = 1.1 + rnd() * 0.7;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
    // nail polish is on the nail plate itself (53-nails.js), not painted into
    // the skin atlas: a painted ellipse would smudge around the real plate.
    ctx.globalCompositeOperation = "source-over";
    paintTattoos(ctx, size);
    const tex = HAND.surfaceTexture.get(i);
    tex.needsUpdate = true;
    if (S.hand.finish === "skin" && mat.map !== tex) { mat.map = tex; mat.needsUpdate = true; }
  });
  if (S.hand.finish !== "skin") restoreBaseMaps();
}
function restoreBaseMaps() {
  HAND.skinMaterials?.forEach((mat, i) => {
    const base = HAND.baseMaps?.get(i);
    if (base && mat.map !== base) { mat.map = base; mat.needsUpdate = true; }
  });
}

