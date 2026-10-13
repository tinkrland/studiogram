// numeric check of the nail shapes, no eyes needed. for each shape at a given
// slider length it reads the built plate geometry on the index finger and
// reports the silhouette: the free-edge reach at several points across the
// width (so oval vs square vs stiletto vs lipstick are distinguishable as
// numbers), plus the plate's total length and tip width.
//   node scripts/nail-silhouette.mjs [length 0..1] [finger]
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const length = parseFloat(process.argv[2] ?? "0.8");
const finger = process.argv[3] ?? "index";
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + join(root, "artifact", "index.html") + "#qa", { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => window.__sg && window.__sg.HAND.loaded);
const rows = await page.evaluate((length, finger) => {
  const { S, applyNails, NAIL_SHAPE_ORDER, NAIL_FRAME, NAIL } = window.__sg;
  const fr = NAIL_FRAME[finger];
  const out = [];
  for (const key of NAIL_SHAPE_ORDER) {
    S.hand.nails.shape = key; S.hand.nails.length = length; applyNails();
    const mesh = NAIL.plates.get(finger);
    const p = mesh.geometry.attributes.position, NU = 29;
    const NV = p.count / NU;
    // free-edge reach beyond the fingertip, at u = -1, -.5, 0, .5, 1 (metres -> mm)
    const reachAt = (c) => { let maxY = -1e9; for (let r = 0; r < NV; r++) maxY = Math.max(maxY, p.getY(r * NU + c)); return (maxY - fr.tip) * 1000; };
    const cols = [0, 7, 14, 21, 28];
    // widest and end width
    let maxW = 0, endW = 0;
    for (let r = 0; r < NV; r++) { const w = (p.getX(r * NU + 28) - p.getX(r * NU + 0)) * 1000; maxW = Math.max(maxW, w); if (r === NV - 1) endW = w; }
    out.push({ key, reach: cols.map((c) => +reachAt(c).toFixed(1)), maxW: +maxW.toFixed(1), endW: +endW.toFixed(1) });
  }
  return out;
}, length, finger);
console.log(`finger ${finger}, slider length ${length}. reach past the fingertip in mm at u = -1, -.5, 0, +.5, +1 (left edge .. right edge):`);
for (const r of rows) console.log(r.key.padEnd(17), r.reach.map((v) => String(v).padStart(6)).join(" "), "| widest", r.maxW, "end", r.endW);
await browser.close();
