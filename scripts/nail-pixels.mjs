// pixel check for the nail plates, no eyes needed: renders the index
// fingertip close up twice, plates hidden and shown, and reports how many
// pixels changed and their bounding box. a plate that is missing, buried in
// the skin, or floating off the finger shows up as zero or misplaced change.
//   node scripts/nail-pixels.mjs [shape] [length] [finger]
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [shape = "oval", length = "0.6", finger = "index"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + join(root, "artifact", "index.html") + "#qa", { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => window.__sg && window.__sg.HAND.loaded);
const res = await page.evaluate(async (shape, length, finger) => {
  const sg = window.__sg, { S, HAND, NAIL, THREE_, camera, controls, renderer, renderFrame, applyNails } = sg;
  S.hand.finish = "porcelain"; sg.applyFinish();
  S.hand.nails.shape = shape; S.hand.nails.length = parseFloat(length); applyNails();
  const bone = HAND.bones.get(finger === "thumb" ? "thumb03L" : "finger_" + finger + "03L");
  const V = bone.position.constructor;
  bone.updateWorldMatrix(true, false);
  const tip = new V(0, sg.NAIL_FRAME[finger].tip - 0.006, 0).applyMatrix4(bone.matrixWorld);
  controls.target.copy(tip); camera.position.copy(tip).add(new V(0, 55, 25)); camera.fov = 12; camera.updateProjectionMatrix();
  renderer.setPixelRatio(1); renderer.setSize(480, 480, false); camera.aspect = 1; camera.updateProjectionMatrix();
  const grab = () => { renderFrame(); const c = document.createElement("canvas"); c.width = c.height = 480; const x = c.getContext("2d"); x.drawImage(renderer.domElement, 0, 0, 480, 480); return x.getImageData(0, 0, 480, 480).data; };
  for (const m of NAIL.plates.values()) m.visible = false;
  const off = grab();
  for (const m of NAIL.plates.values()) m.visible = true;
  const on = grab();
  let n = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let i = 0; i < off.length; i += 4) if (Math.abs(on[i] - off[i]) + Math.abs(on[i+1] - off[i+1]) + Math.abs(on[i+2] - off[i+2]) > 24) {
    n++; const px = (i / 4) % 480, py = Math.floor(i / 4 / 480); x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  return { changedPixels: n, bbox: n ? [x0, y0, x1, y1] : null };
}, shape, length, finger);
console.log(`${finger} ${shape} @${length}:`, JSON.stringify(res));
await browser.close();
