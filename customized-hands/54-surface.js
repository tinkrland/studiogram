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
function skinToneColor(t) {
  // multiply tint from untouched (t=0) to a deep tone (t=1). multiply only
  // darkens and warms; the base skin texture keeps all its detail.
  const a = Math.min(1, Math.max(0, t));
  const c0 = [1.0, 1.0, 1.0];
  const c1 = [0.52, 0.36, 0.29];
  return c0.map((v, i) => v + (c1[i] - v) * a);
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
  const tone = S.hand.skin?.tone ?? 0.4;
  const hair = S.hand.skin?.hair ?? 0.35;
  HAND.skinMaterials.forEach((mat, i) => {
    const base = mat.map;
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
    // tone tint, multiply keeps the texture's shading structure
    if (tone > 0.001) {
      const c = skinToneColor(tone);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgb(${Math.round(c[0]*255)}, ${Math.round(c[1]*255)}, ${Math.round(c[2]*255)})`;
      ctx.fillRect(0, 0, size, size);
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
    // nail appearance: polish tints the nail plates. painted into the
    // composite so it rides posing, morphs, and the finish swap like any
    // other surface detail — visible on the skin finish.
    const nails = S.hand.nails;
    if (nails?.style === "polished" && NAIL_REGION && Object.keys(NAIL_REGION).length) {
      ctx.globalCompositeOperation = "source-over";
      const col = nails.color || "#b23a48";
      // one soft ellipse per nail plate: center, radii and angle come from
      // the plate points, so the tint stays inside the plate, not on skin.
      for (const plate of Object.values(NAIL_REGION)) {
        const [cu, cv] = plate.c;
        const [ru, rv] = plate.r;
        ctx.save();
        ctx.translate(cu * size, cv * size);
        ctx.rotate(plate.a || 0);
        ctx.scale(Math.max(ru, 1e-4) * size, Math.max(rv, 1e-4) * size);
        const g = ctx.createRadialGradient(0, 0, 0.55, 0, 0, 1);
        g.addColorStop(0, hexA(col, 0.78));
        g.addColorStop(0.72, hexA(col, 0.55));
        g.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
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

