// checks every skin preset against its swatch in the live app. it samples
// only the texels the mesh actually covers (a vertex-uv sweep), because the
// atlas has large unused gutters that never appear on the model.
//   node scripts/skin-presets-check.mjs
import puppeteer from "puppeteer-core";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const browser = await puppeteer.launch({ executablePath: "/usr/bin/google-chrome", headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader", "--allow-file-access-from-files"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + join(root, "artifact", "index.html") + "#qa", { waitUntil: "networkidle0", timeout: 90000 });
await page.waitForFunction(() => window.__sg && window.__sg.HAND.loaded);
const rows = await page.evaluate(() => {
  const sg = window.__sg, { S, HAND, SKIN_PRESETS, applySurface, applyFinish } = sg;
  S.hand.finish = "skin"; applyFinish();
  const uv = HAND.skinned.geometry.attributes.uv, n = uv.count;
  const out = [];
  for (const pr of SKIN_PRESETS) {
    S.hand.skin = { preset: pr.key, lightness: 0, warmth: 0, depth: 0, hair: 0 };
    applySurface();
    const cv = HAND.surfaceCanvas.get(0), W = cv.width, d = cv.getContext("2d").getImageData(0, 0, W, W).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.min(W - 1, Math.floor(uv.getX(i) * W)), y = Math.min(W - 1, Math.floor(uv.getY(i) * W)), o = (y * W + x) * 4;
      r += d[o]; g += d[o + 1]; b += d[o + 2];
    }
    out.push({ key: pr.key, hex: pr.hex, mean: [r / n, g / n, b / n].map(Math.round) });
  }
  return out;
});
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
let worst = 0;
for (const r of rows) { const t = hexRgb(r.hex); const err = Math.max(...r.mean.map((v, i) => Math.abs(v - t[i]))); worst = Math.max(worst, err);
  console.log(r.key.padEnd(11), r.hex, "covered-texel mean", r.mean.join(",").padEnd(11), "max err", err); }
console.log(worst <= 8 ? "PASS" : "FAIL", "worst error", worst, "(limit 8)");
await browser.close();
process.exit(worst <= 8 ? 0 : 1);
