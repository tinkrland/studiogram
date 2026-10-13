// renders a contact sheet of every nail shape on the index finger, close up,
// at a chosen length. a visual check: run from the repo root,
//   node scripts/nail-sheet.mjs [length 0..1] [finger] [out.png]
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const length = parseFloat(process.argv[2] ?? "0.8");
const finger = process.argv[3] ?? "index";
const out = process.argv[4] ?? "/tmp/nail-sheet.png";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 800 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + join(root, "artifact", "index.html") + "#qa", { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => document.querySelector("#vpmode")?.textContent.includes("orbit"));
await page.waitForFunction(() => window.__sg && window.__sg.HAND.loaded);
const keys = await page.evaluate(() => window.__sg.NAIL_SHAPE_ORDER);
const tiles = [];
for (const key of keys) {
  const shot = await page.evaluate(async (key, length, finger) => {
    const { S, HAND, THREE, camera, controls, renderer, renderFrame, applyFinish, applyNails, NAIL_FRAME, bname } = window.__sg;
    S.hand.nails.shape = key; S.hand.nails.length = length; S.hand.finish = "porcelain";
    applyFinish(); applyNails();
    // aim the orbit camera at the fingertip, looking down onto the nail
    const bone = HAND.bones.get(bname((finger === "thumb" ? "thumb" : "finger_" + finger) + ".03.L"));
    bone.updateWorldMatrix(true, false);
    const tip = new THREE.Vector3(0, NAIL_FRAME[finger].tip, 0); bone.localToWorld(tip);
    const o = bone.getWorldPosition(new THREE.Vector3());
    const up = new THREE.Vector3(0, 0, NAIL_FRAME[finger].s); bone.localToWorld(up); up.sub(o).normalize();
    controls.target.copy(tip);
    camera.position.copy(tip).addScaledVector(up, 0.11);
    camera.fov = 14; camera.updateProjectionMatrix();
    S.live.position = camera.position.toArray(); S.live.target = tip.toArray(); S.live.fov = 14;
    controls.update(); renderFrame();
    return renderer.domElement.toDataURL("image/png");  }, key, length, finger);
  tiles.push({ key, shot });
}
// stitch with a canvas in the page
const sheet = await page.evaluate(async (tiles) => {
  const imgs = await Promise.all(tiles.map((t) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = t.shot; })));
  const cols = 6, rows = Math.ceil(tiles.length / cols), tw = 300, th = 230;
  const cv = document.createElement("canvas"); cv.width = cols * tw; cv.height = rows * th;
  const g = cv.getContext("2d"); g.fillStyle = "#222"; g.fillRect(0, 0, cv.width, cv.height);
  imgs.forEach((im, i) => {
    const sx = (im.width - im.height * (tw / th)) / 2, sw = im.height * (tw / th);
    g.drawImage(im, sx, 0, sw, im.height, (i % cols) * tw, Math.floor(i / cols) * th, tw, th);
    g.fillStyle = "#fff"; g.font = "14px sans-serif"; g.fillText(tiles[i].key, (i % cols) * tw + 8, Math.floor(i / cols) * th + 18);
  });
  return cv.toDataURL("image/png");
}, tiles);
import { writeFileSync } from "node:fs";
writeFileSync(out, Buffer.from(sheet.split(",")[1], "base64"));
console.log("wrote", out, keys.length, "shapes");
await browser.close();
