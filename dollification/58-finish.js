
// subject finish: the hand presents as a porcelain display hand by default,
// or with its original skin textures. jewelry photography favors the quiet
// matte doll — the piece is the subject, the hand is the stand.
function applyFinish() {
  if (!HAND.skinMeshes) return;
  if (S.hand.finish === "porcelain") {
    if (!HAND.dollMaterial) {
      HAND.dollMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.937, 0.902, 0.851), // warm ivory, slightly paler than skin
        roughness: 0.62, metalness: 0
      });
    }
    for (const m of HAND.skinMeshes) m.material = HAND.dollMaterial;
  } else {
    for (const [i, m] of HAND.skinMeshes.entries()) m.material = HAND.skinMaterials[i];
    applySurface();
  }
}

