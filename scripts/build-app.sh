#!/bin/bash
# deterministic build: parts -> one self-contained html artifact + node-checkable mjs
set -e
cd "$(dirname "$0")/.."
python3 - <<'PYEOF'
import pathlib, base64
parts = pathlib.Path("app/parts")
js = ""
for name in ["02-core.js", "03-registry-state.js", "04-scene.js", "05-hand.js", "06-jewelry.js", "07-panels.js", "08-boot.js"]:
    js += parts.joinpath(name).read_text() + "\n"
fixtures = pathlib.Path("app/fixtures.json").read_text()
js = js.replace("const REGISTRY = /*__FIXTURES__*/[];", "const REGISTRY = " + fixtures + ";")
js = js.replace("/*__POSES__*/{}", pathlib.Path("app/poses.json").read_text().strip())
hair = pathlib.Path("app/hair-region.json").read_text()
js = js.replace("const HAIR_REGION = /*__HAIRPTS__*/[];", "const HAIR_REGION = " + hair + ";")
nails = pathlib.Path("app/nail-region.json").read_text()
js = js.replace("const NAIL_REGION = /*__NAILPTS__*/{};", "const NAIL_REGION = " + nails + ";")
b64 = base64.b64encode(pathlib.Path("app/hand.glb").read_bytes()).decode()
js = js.replace('"__HANDGLB__"', '"' + b64 + '"')
head = parts.joinpath("01-head.html").read_text()
pathlib.Path("artifact/index.html").write_text(head + js + "\n</script>\n</body>\n</html>\n")
pathlib.Path("artifact/app.mjs").write_text(js)
print("built", round(len(js)/1e6, 1), "MB inline")
PYEOF
node --check artifact/app.mjs && echo "syntax OK"
