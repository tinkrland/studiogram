#!/bin/bash
# deterministic build: domain-ordered parts -> one self-contained html artifact
# + node-checkable mjs. the manifest order is the program order; the split
# parts concatenate to the exact same bytes the old single-part files did.
set -e
cd "$(dirname "$0")/.."
python3 - <<'PYEOF'
import pathlib, base64
root = pathlib.Path(".")
manifest = [
    "core/02-core.js", "core/03-registry-state.js",
    "core/40-render.js", "lighting/41-lighting.js", "setdesign/42-backdrops.js",
    "core/43-render-composite.js", "camera/45-camera-modes.js",
    "customized-hands/50-model.js", "customized-hands/52-morphology.js",
    "customized-hands/54-surface.js", "customized-hands/56-tattoos.js",
    "dollification/58-finish.js", "posing-studio/60-posing.js",
    "jewelry/70-jewelry.js",
    "core/80-panel-infra.js", "customized-hands/82-subject-panel.js",
    "jewelry/84-jewelry-panel.js", "posing-studio/86-pose-panel.js",
    "camera/88-camera-panel.js", "lighting/90-light-panel.js",
    "setdesign/92-scene-panel.js", "core/93-panel-shell.js",
    "socmed-integration/95-captures.js",
    "core/96-state-io.js", "core/98-boot.js", "core/99-qa.js",
]
js = "".join((root / p).read_text() for p in manifest)
fixtures = (root / "core/fixtures.json").read_text()
js = js.replace("const REGISTRY = /*__FIXTURES__*/[];", "const REGISTRY = " + fixtures + ";")
js = js.replace("/*__POSES__*/{}", (root / "posing-studio/poses.json").read_text().strip())
hair = (root / "customized-hands/hair-region.json").read_text()
js = js.replace("const HAIR_REGION = /*__HAIRPTS__*/[];", "const HAIR_REGION = " + hair + ";")
nails = (root / "customized-hands/nail-region.json").read_text()
js = js.replace("const NAIL_REGION = /*__NAILPTS__*/{};", "const NAIL_REGION = " + nails + ";")
b64 = base64.b64encode((root / "assets/hand.glb").read_bytes()).decode()
js = js.replace('"__HANDGLB__"', '"' + b64 + '"')
head = (root / "core/01-head.html").read_text()
pathlib.Path("artifact/index.html").write_text(head + js + "\n</script>\n</body>\n</html>\n")
pathlib.Path("artifact/app.mjs").write_text(js)
print("built", round(len(js)/1e6, 1), "MB inline")
PYEOF
node --check artifact/app.mjs && echo "syntax OK"
