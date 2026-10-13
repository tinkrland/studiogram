// ===== the tag stage: plan the in-app tagging pass visually =====
// instagram's publishing api cannot set shopping tags (meta's docs,
// 2026-06-30), so a person places them in the instagram app. the stage
// is that planning surface: every photo of the set renders with
// draggable pins over its bound products (one pin per listing,
// multi-product shots carry several), the caption previews exactly as
// it will publish, and the reference sheet downloads as one jpeg with
// the numbered pins drawn on the frames - so the in-app pass is a
// mirror job, not a decision. pins are staging data, not authored
// commerce values: the sku comes from the verified listing join, only
// the x/y position (a percentage of the frame) is user-placed, and a
// pin can never bind a product the join did not already verify.

const TAG_STAGE_KEY = "studiogram_tag_stage";
const STAGE_JPEG = new Map(); // photo id -> jpeg data url, display cache only

let TAG_STAGE = {}; // { "<set slug>": { "<photo id>": [{ sku, x, y }] } }
try {
  const raw = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem(TAG_STAGE_KEY));
  if (raw && typeof raw === "object") TAG_STAGE = raw;
} catch (e) { TAG_STAGE = {}; }

function stageKey(setName) { return slug(String(setName || "")); }
function clampPct(v) { return Math.round(Math.min(98, Math.max(2, Number(v)))); }

// pure: read one photo's pins out of a store, tolerating anything
// missing and normalizing anything malformed (staging is convenience,
// never correctness: the join below stays the source of truth)
function pinsForStore(store, key, photoId) {
  const setEntry = store && store[key];
  const pins = setEntry && setEntry[photoId];
  if (!Array.isArray(pins)) return [];
  return pins
    .filter((p) => p && p.sku && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)))
    .map((p) => ({ sku: p.sku, x: clampPct(p.x), y: clampPct(p.y) }));
}

function stagePinsFor(photo) {
  return pinsForStore(TAG_STAGE, stageKey(activeSet().name), photo.id);
}

function stageSetPins(photo, pins) {
  const key = stageKey(activeSet().name);
  if (!TAG_STAGE[key]) TAG_STAGE[key] = {};
  if (pins && pins.length) TAG_STAGE[key][photo.id] = pins;
  else delete TAG_STAGE[key][photo.id];
  if (!Object.keys(TAG_STAGE[key]).length) delete TAG_STAGE[key];
  try {
    localStorage.setItem(TAG_STAGE_KEY, JSON.stringify(TAG_STAGE));
  } catch (e) { /* storage full: the publish runs fine without staging */ }
}

// pure: the publish product rows with pin positions merged. pins only
// locate products the verified join already bound; an orphan pin (sku
// the join no longer returns, a stale manifest row) is ignored.
function mergePinPositions(products, pins) {
  return (products || []).map((p) => {
    const pin = (pins || []).find((q) => q.sku === p.sku);
    return pin
      ? { sku: p.sku, title: p.title, pdp_url: p.pdp_url, x: pin.x, y: pin.y }
      : { sku: p.sku, title: p.title, pdp_url: p.pdp_url };
  });
}

function taggedProducts(photo) {
  return mergePinPositions(photoProducts(photo), stagePinsFor(photo));
}

// the frame for display: the same jpeg conversion the publish path
// uses (0.92 over a white matte), cached per photo for the session.
async function stageJpegFor(photo) {
  if (!STAGE_JPEG.has(photo.id)) {
    const b64 = await jpegFromPhoto(photo);
    STAGE_JPEG.set(photo.id, "data:image/jpeg;base64," + b64);
  }
  return STAGE_JPEG.get(photo.id);
}

let STAGE_SEL = 0; // selected photo index, module memory only

function closeTagStage() {
  const ov = $("#tagstage");
  if (ov) ov.remove();
}

// the stage overlay. every open rebuilds it fresh, same discipline as
// the capture strip: pins load from storage, drag mutates, release
// re-renders, and the publish payload reads the same store.
function openTagStage() {
  const set = activeSet();
  const photos = photosInSet(set);
  if (!photos.length) { toast("capture a photo first: the stage previews the set"); return; }
  closeTagStage();
  if (STAGE_SEL >= photos.length) STAGE_SEL = 0;
  const ov = el("div");
  ov.id = "tagstage";
  Object.assign(ov.style, {
    position: "fixed", inset: "0", background: "rgba(10,10,12,0.74)", zIndex: 60,
    display: "flex", alignItems: "center", justifyContent: "center",
  });
  ov.addEventListener("pointerdown", (e) => { if (e.target === ov) closeTagStage(); });
  const panel = el("div");
  Object.assign(panel.style, {
    background: "var(--panel)", border: "1px solid var(--line)", borderRadius: "8px",
    width: "min(880px, 94vw)", maxHeight: "92vh", overflow: "auto", padding: "14px 16px",
  });
  ov.appendChild(panel);
  document.body.appendChild(ov);

  const head = el("div", "btnrow");
  head.style.alignItems = "center";
  const title = el("span", "cc-meta", `tag stage · "${set.name}" · the pins mirror the instagram app pass`);
  title.style.flex = "1";
  head.appendChild(title);
  const closeBtn = el("button", "btn mini", "close");
  closeBtn.addEventListener("click", closeTagStage);
  head.appendChild(closeBtn);
  panel.appendChild(head);

  // the caption exactly as it will publish (composed, never authored)
  const bound = photos.flatMap((p) => photoProducts(p));
  const titles = [...new Set(bound.map((p) => p.title))];
  const capText = composeCaption(titles, bound[0] ? bound[0].pdp_url : "");
  const capEl = el("div", "cc-meta", "caption: " + (capText || "(none: no verified bindings yet)"));
  capEl.style.overflowWrap = "anywhere";
  capEl.style.margin = "6px 0";
  panel.appendChild(capEl);

  // the photo picker: position in the carousel plus pin count
  const pick = el("div", "btnrow");
  photos.forEach((photo, i) => {
    const n = stagePinsFor(photo).length;
    const b = el("button", "btn mini" + (i === STAGE_SEL ? " primary" : ""), `${i + 1} · ${n} pin${n === 1 ? "" : "s"}`);
    b.addEventListener("click", () => { STAGE_SEL = i; openTagStage(); });
    pick.appendChild(b);
  });
  panel.appendChild(pick);

  // the frame plus the chip column (the frame may need reproduction)
  const body = el("div");
  Object.assign(body.style, { display: "flex", gap: "14px", flexWrap: "wrap" });
  panel.appendChild(body);
  stageJpegFor(photos[STAGE_SEL])
    .then((src) => renderStagePhoto(body, photos, src))
    .catch((e) => body.appendChild(el("span", "cc-meta", "frame unavailable: " + e.message)));

  const foot = el("div", "btnrow");
  const ref = el("button", "btn mini", "download tag reference sheet");
  ref.addEventListener("click", downloadTagReference);
  foot.appendChild(ref);
  const wipe = el("button", "btn mini danger", "clear this set's pins");
  wipe.addEventListener("click", () => {
    delete TAG_STAGE[stageKey(set.name)];
    try { localStorage.setItem(TAG_STAGE_KEY, JSON.stringify(TAG_STAGE)); } catch (e) {}
    openTagStage();
    toast(`pins cleared for "${set.name}"`);
  });
  foot.appendChild(wipe);
  const hint = el("span", "cc-meta", "double-click a pin to drop it · drag to move · unpinned photos publish fine, tags can come later");
  hint.style.alignSelf = "center";
  foot.appendChild(hint);
  panel.appendChild(foot);
}

// the selected photo: the frame with its pins, and the per-product
// chip column. pins are numbered in pin-list order, the same numbers
// the reference sheet prints.
function renderStagePhoto(body, photos, src) {
  const photo = photos[STAGE_SEL];
  const products = photoProducts(photo);
  const pins = stagePinsFor(photo);
  body.innerHTML = "";

  const wrap = el("div");
  Object.assign(wrap.style, { position: "relative", maxWidth: "420px", minWidth: "240px", flex: "0 0 auto", border: "1px solid var(--line)", borderRadius: "4px", alignSelf: "flex-start" });
  const img = el("img");
  img.src = src;
  Object.assign(img.style, { display: "block", width: "100%", userSelect: "none", webkitUserDrag: "none" });
  img.alt = altText(photo, products);
  wrap.appendChild(img);

  pins.forEach((pin, i) => {
    const mk = el("span", "", String(i + 1));
    Object.assign(mk.style, {
      position: "absolute", left: pin.x + "%", top: pin.y + "%", transform: "translate(-50%, -50%)",
      width: "22px", height: "22px", borderRadius: "50%", background: "var(--accent)", color: "#17150f",
      font: "600 12px system-ui", display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "grab", border: "2px solid var(--bg)",
    });
    mk.title = pin.sku;
    mk.addEventListener("dblclick", () => {
      stageSetPins(photo, pins.filter((q) => q.sku !== pin.sku));
      openTagStage();
    });
    mk.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      mk.setPointerCapture(e.pointerId);
      mk.style.cursor = "grabbing";
      const move = (ev) => {
        const r = img.getBoundingClientRect();
        pin.x = clampPct(((ev.clientX - r.left) / r.width) * 100);
        pin.y = clampPct(((ev.clientY - r.top) / r.height) * 100);
        mk.style.left = pin.x + "%";
        mk.style.top = pin.y + "%";
      };
      const up = () => {
        mk.removeEventListener("pointermove", move);
        mk.removeEventListener("pointerup", up);
        stageSetPins(photo, pins); // the same array objects, now moved
        openTagStage(); // rebuild: readouts and chips re-read the store
      };
      mk.addEventListener("pointermove", move);
      mk.addEventListener("pointerup", up);
    });
    wrap.appendChild(mk);
  });
  body.appendChild(wrap);

  const chips = el("div");
  Object.assign(chips.style, { flex: "1", minWidth: "220px", alignSelf: "flex-start" });
  body.appendChild(chips);
  renderStageChips(chips, photo, products);
}

function renderStageChips(chips, photo, products) {
  if (!products.length) {
    chips.appendChild(el("div", "cc-meta", "no verified listing bindings for this photo: it publishes untagged"));
    return;
  }
  products.forEach((p) => {
    const pin = stagePinsFor(photo).find((q) => q.sku === p.sku);
    const row = el("div", "btnrow");
    row.style.alignItems = "center";
    const name = el("span", "cc-meta", (pin ? `@ ${pin.x}%, ${pin.y}%  ` : "") + p.sku + (pin ? "" : "  (not pinned)"));
    name.style.flex = "1";
    name.style.overflowWrap = "anywhere";
    row.appendChild(name);
    const act = el("button", "btn mini", pin ? "unpin" : "place");
    act.addEventListener("click", () => {
      const pins = stagePinsFor(photo);
      stageSetPins(photo, pin ? pins.filter((q) => q.sku !== p.sku) : pins.concat([{ sku: p.sku, x: 50, y: 50 }]));
      openTagStage();
    });
    row.appendChild(act);
    chips.appendChild(row);
  });
}

// pure: the reference sheet layout - one column, one photo per band,
// a legend line per pin (a pinless photo still prints one line). the
// drawing step consumes exactly this plan.
function refSheetPlan(entries, sheetWidth) {
  const pad = 24, gap = 26, lineH = 28, legendPad = 34, headerH = 92;
  let y = headerH;
  const items = (entries || []).map((e, i) => {
    const w = Math.min(sheetWidth - pad * 2, e.width);
    const h = Math.round(e.height * (w / e.width));
    const lines = Math.max(1, (e.pins || []).length);
    const item = { index: i, x: pad, y, w, h, pins: e.pins || [], lines };
    y += h + legendPad + lines * lineH + gap;
    return item;
  });
  return { width: sheetWidth, height: y - gap + pad, headerH, pad, lineH, legendPad, items };
}

// the reference sheet: every frame with its numbered pins drawn on and
// the sku legend beneath, one jpeg for the whole set. this is the
// mirror guide for the instagram app pass.
async function downloadTagReference() {
  const set = activeSet();
  const photos = photosInSet(set).slice(0, 10); // the carousel takes at most 10
  if (!photos.length) { toast("capture a photo first: the reference shows the set"); return; }
  toast(`building the tag reference for ${photos.length} photo${photos.length === 1 ? "" : "s"}...`);
  const entries = [], frames = [];
  for (const photo of photos) {
    const dims = photoDims(photo);
    entries.push({ name: photo.name, width: dims.width, height: dims.height, pins: stagePinsFor(photo) });
  }
  for (const photo of photos) {
    try { frames.push(await stageJpegFor(photo)); }
    catch (e) { toast("reference stopped: " + e.message); return; }
  }
  try {
    const cv = document.createElement("canvas");
    await drawTagReference(cv, entries, frames, set.name);
    downloadLink(`${slug(set.name)}-tag-reference.jpg`, cv.toDataURL("image/jpeg", 0.92));
    toast(`tag reference exported for "${set.name}"`);
  } catch (e) { toast("reference failed: " + e.message); }
}

async function drawTagReference(cv, entries, frames, setName) {
  const plan = refSheetPlan(entries, 1080);
  cv.width = plan.width;
  cv.height = plan.height;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "600 26px system-ui";
  ctx.fillText(`tag reference · ${setName}`, plan.pad, 42);
  ctx.fillStyle = "#666666";
  ctx.font = "18px system-ui";
  ctx.fillText("mirror these pins on the same products in the instagram app after publishing. generated " + nowUtc(), plan.pad, 68);
  for (let i = 0; i < entries.length; i++) {
    const item = plan.items[i];
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("frame decode failed"));
      img.src = frames[i];
    });
    ctx.drawImage(img, item.x, item.y, item.w, item.h);
    // the carousel position badge on each frame
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(item.x, item.y, 92, 30);
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 18px system-ui";
    ctx.fillText("photo " + (i + 1), item.x + 10, item.y + 21);
    // the pins, numbered like the stage
    item.pins.forEach((pin, j) => {
      const px = item.x + (item.w * pin.x) / 100;
      const py = item.y + (item.h * pin.y) / 100;
      ctx.beginPath();
      ctx.arc(px, py, 21, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#1a1a1a";
      ctx.stroke();
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "600 20px system-ui";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(j + 1), px, py + 1);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    });
    // the legend
    ctx.font = "19px system-ui";
    ctx.fillStyle = "#222222";
    let ly = item.y + item.h + 26;
    if (!item.pins.length) {
      ctx.fillText("no staged product pins", item.x, ly);
    } else {
      item.pins.forEach((pin, j) => {
        ctx.fillText(`${j + 1}. ${pin.sku} at ${pin.x}%, ${pin.y}%`, item.x, ly);
        ly += plan.lineH;
      });
    }
  }
}
