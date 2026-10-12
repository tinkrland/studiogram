// qa: real mouse drags against the built artifact, headless chrome.
// exercises the two camera modes with actual pointer input. the orbit
// camera has ~10s of inertial damping after a drag, and pinned mode freezes
// the framing at pin time, so the checks are built on determinism rather
// than on a settled camera: a pinned shot must reproduce itself exactly,
// and a resumed orbit must visibly move away from the frozen framing.
// run from the repo root: node scripts/qa-drag.mjs
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const artifact = join(root, "artifact", "index.html");
const fails = [];
const check = (name, ok, detail = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails.push(name);
};

const diffRatio = (a, b) => {
  if (Buffer.compare(a, b) === 0) return 0;
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return 1;
  let diff = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    if (Math.abs(A.data[i] - B.data[i]) > 8 || Math.abs(A.data[i + 1] - B.data[i + 1]) > 8 ||
        Math.abs(A.data[i + 2] - B.data[i + 2]) > 8) diff += 4;
  }
  return diff / A.data.length;
};

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader",
         "--allow-file-access-from-files"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + artifact, { waitUntil: "networkidle0", timeout: 60000 });
await page.waitForFunction(() => document.querySelector("#vpmode")?.textContent.includes("orbit"));

const shot = async () => {
  await new Promise((r) => setTimeout(r, 600));
  // hide the overlays painted over the viewport (mode badge, info, toast):
  // the comparison must see the render, not the ui chrome on top of it
  await page.evaluate(() => {
    for (const id of ["vpmode", "vpoverlay", "toast"]) document.getElementById(id).style.visibility = "hidden";
  });
  const box = await page.evaluate(() => {
    const r = document.querySelector("#viewport canvas").getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const png = await page.screenshot({ clip: box });
  await page.evaluate(() => {
    for (const id of ["vpmode", "vpoverlay", "toast"]) document.getElementById(id).style.visibility = "visible";
  });
  return png;
};
const drag = async (dx, dy) => {
  const b = await page.evaluate(() => { const r = document.querySelector("#viewport canvas").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(cx + (dx * i) / 12, cy + (dy * i) / 12, { steps: 2 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 300));
};
const clickText = (t) => page.evaluate((t) =>
  [...document.querySelectorAll("button")].find((b) => b.textContent === t)?.click(), t);

// 1. drag: the orbit view must move (damping keeps it moving after release)
await drag(260, -140);
await drag(-180, 90);
const orbitMoving = await shot();

// 2. pin mid-motion and freeze the framing
await page.click('#tabs button[data-tab="camera"]');
await page.type('input[placeholder*="camera name"]', "qa pin");
await clickText("pin current view");
await clickText("go");
await new Promise((r) => setTimeout(r, 400));
check("mode badge shows pinned", (await page.$eval("#vpmode", (e) => e.textContent)) === "pinned: qa pin");
const pinnedA = await shot();

// 3. drags must not move the camera while pinned
await drag(300, -200);
await drag(-260, 160);
const pinnedAfterDrags = await shot();
const ignoreRatio = diffRatio(pinnedA, pinnedAfterDrags);
check("pointer drags ignored while pinned", ignoreRatio < 0.01, `${(ignoreRatio * 100).toFixed(2)}% differ`);

// 4. resume orbit: the frozen damping resumes and the view moves away
await clickText("free orbit");
await drag(200, 120); // plus fresh inertia
const orbitResumed = await shot();
const awayRatio = diffRatio(pinnedA, orbitResumed);
check("resumed orbit moves away from the pinned framing", awayRatio > 0.01, `${(awayRatio * 100).toFixed(1)}% differ`);

// 5. go back to the pin: the framing must reproduce exactly
await clickText("go");
await new Promise((r) => setTimeout(r, 400));
const pinnedB = await shot();
const reproduceRatio = diffRatio(pinnedA, pinnedB);
check("pinned shot reproduces its framing exactly", reproduceRatio < 0.01, `${(reproduceRatio * 100).toFixed(2)}% differ`);

// 6. unload flush: a drag mid-damping has not been persisted yet (the
//    debounce saves on quiet); beforeunload must flush it synchronously
await clickText("free orbit");
await drag(240, -160);
const stale = await page.evaluate(() => JSON.parse(localStorage.getItem("studiogram_state")).live.position);
await page.evaluate(() => dispatchEvent(new Event("beforeunload")));
const flushed = await page.evaluate(() => JSON.parse(localStorage.getItem("studiogram_state")).live.position);
check("unload flushes pending camera state", JSON.stringify(stale) !== JSON.stringify(flushed),
  `stale ${JSON.stringify(stale)} -> flushed ${JSON.stringify(flushed)}`);

// 7. a capture taken pinned records the pinned camera
await clickText("go");
await new Promise((r) => setTimeout(r, 400));
check("back to pinned for the capture", (await page.$eval("#vpmode", (e) => e.textContent)) === "pinned: qa pin");
await page.click("#btn-capture");
await new Promise((r) => setTimeout(r, 1500));
const strip = await page.evaluate(() => document.querySelector("#capstrip")?.textContent || "");
check("capture recorded as pinned", /pinned/.test(strip), "capture strip entry says pinned");

// 8. a catalog add during pinned mode animates objects, never the view
const camBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("studiogram_state")).live.position.join(","));
await page.click('#tabs button[data-tab="jewelry"]');
await new Promise((r) => setTimeout(r, 300));
await clickText("add to scene");
await new Promise((r) => setTimeout(r, 800));
const liveAfter = await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("studiogram_state"));
  return { pos: st.live.position.join(","), mode: st.live.mode };
});
check("catalog add kept the camera pinned", liveAfter.mode === "pinned", "mode still pinned");
check("catalog add did not move the camera", liveAfter.pos === camBefore, `camera ${camBefore} -> ${liveAfter.pos}`);

console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join(", ")}` : "\nall drag qa checks passed");
await browser.close();
process.exit(fails.length ? 1 : 0);
