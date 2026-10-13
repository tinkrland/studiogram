// ===== social commerce export: the decoupled listing layer =====
// the studio never authors commerce values. the platform (sculptura/
// kirosculp) exports a listing manifest: sku, title, price, pdp url, keyed
// by release reference. the studio imports it by reference, gates every
// row against the registry (release id, version, mesh hash must match),
// and joins rows to photos through the mesh hash the photo's gate record
// already carries. commerce data lives beside scene state, never inside
// it (invariant 5), exactly like saved hands. built per
// [spec/social-commerce.md](../spec/social-commerce.md).

let LISTINGS = [];       // imported manifest rows: platform-authored values only
let MANIFEST_META = null; // { schema, manifest_version, imported_utc, accepted, refused }
try {
  const raw = typeof localStorage === "undefined" ? null : JSON.parse(localStorage.getItem("studiogram_listings"));
  if (raw && Array.isArray(raw.listings)) { LISTINGS = raw.listings; MANIFEST_META = raw.meta || null; }
} catch (e) { LISTINGS = []; }

function storeListings() {
  try {
    localStorage.setItem("studiogram_listings", JSON.stringify({ listings: LISTINGS, meta: MANIFEST_META }));
  } catch (e) { /* storage full: the manifest can be re-imported */ }
}

// the import gate: a listing row may only bind to a release the registry
// already verified, and its declared mesh hash must equal the registry's.
// this is the anti-drift property at import time: the commerce row and
// the geometry it sells resolve to one hash or the row is refused.
async function importListingManifest(parsed) {
  if (!parsed || parsed.schema !== "sculptura-listing-manifest" || !Array.isArray(parsed.listings)) {
    return { ok: false, refused: [{ reason: "not a sculptura listing manifest (schema mismatch)" }] };
  }
  if (parsed.manifest_version !== 1) {
    return { ok: false, refused: [{ reason: "unsupported manifest version " + parsed.manifest_version }] };
  }
  const accepted = [], refused = [];
  for (const row of parsed.listings) {
    const rec = byRelease.get(row.release_id);
    if (!rec) { refused.push({ release_id: row.release_id || "(missing)", reason: "unknown release id" }); continue; }
    if (row.version !== rec.version) { refused.push({ release_id: row.release_id, reason: "version mismatch" }); continue; }
    if (row.mesh_sha256 !== rec.assets.mesh_sha256) { refused.push({ release_id: row.release_id, reason: "mesh hash mismatch: the listing does not bind to the registry's geometry" }); continue; }
    if (!row.sku || !row.title || typeof row.price !== "number" || !row.pdp_url) {
      refused.push({ release_id: row.release_id, reason: "missing a required value (sku, title, price, pdp_url)" }); continue;
    }
    accepted.push({
      release_id: row.release_id, version: row.version, mesh_sha256: row.mesh_sha256,
      sku: row.sku, title: row.title, description: row.description || "",
      price: row.price, currency: row.currency || "USD", pdp_url: row.pdp_url,
      image_url: row.image_url || "", brand: row.brand || "", max_handling_days: row.max_handling_days || 30,
    });
  }
  LISTINGS = accepted.sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  MANIFEST_META = { schema: parsed.schema, manifest_version: 1, imported_utc: nowUtc(), accepted: accepted.length, refused: refused.length };
  storeListings();
  renderCommerceBar();
  return { ok: true, accepted: accepted.length, refused };
}

// the join: a photo binds to listing rows through its verified gate
// entries. only verified entries bind (a failed gate never authorizes
// commerce), and one photo may carry several products (a stack, a set
// shot), which platform tagging already supports.
function photoProducts(photo) {
  const hashes = new Set((photo.gate || []).filter((g) => g.verified).map((g) => g.mesh_sha256));
  return LISTINGS.filter((l) => hashes.has(l.mesh_sha256));
}

// alt text is composed, never authored: manifest title plus the photo's
// recorded name, both already deterministic values.
function altText(photo, products) {
  const p = products[0];
  return (p ? p.title + ", " : "") + "studio photograph, view " + photo.name;
}

// the commerce card: the per-set sidecar that pairs with the exported
// pngs. platform-side uploads can paste from it without re-typing, and
// the mesh hash rows are the provenance: image and listing resolve to
// the same geometry.
function commerceCard(set) {
  const photos = photosInSet(set);
  return {
    schema: "studiogram-commerce-card", card_version: 1,
    set: set.name, generated_utc: nowUtc(),
    photos: photos.map((photo) => {
      const products = photoProducts(photo);
      return {
        name: photo.name, file: exportFilename(photo),
        width: photoDims(photo).width, height: photoDims(photo).height,
        alt: altText(photo, products),
        bound: products.length > 0,
        products: products.map((p) => ({
          sku: p.sku, title: p.title, price: p.price, currency: p.currency,
          pdp_url: p.pdp_url, release_id: p.release_id, version: p.version,
          mesh_sha256: p.mesh_sha256,
        })),
      };
    }),
  };
}

// ===== catalog feed builders: pure, deterministic, one row per listing =====
// v1 column sets; [spec/social-commerce.md](../spec/social-commerce.md)
// carries the platform notes and the made-to-order rules they encode.
// google merchant center serves pinterest's feed too, so one builder
// covers both. quantity is the made-to-order override (feeds want > 0
// while the platform's backend holds none) and availability ships as
// in stock with a published handling window, the standard mto pattern.
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function feedCSV(platform, listings) {
  const rows = (listings || LISTINGS).slice().sort((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
  let head, cell;
  if (platform === "google") {
    head = ["id", "title", "description", "link", "image_link", "availability", "price", "brand", "condition", "identifier_exists", "mpn", "min_handling_time", "max_handling_time", "quantity"];
    cell = (r, c) => ({
      id: r.sku, title: r.title, description: r.description, link: r.pdp_url,
      image_link: r.image_url, availability: "in_stock", price: r.price.toFixed(2) + " " + r.currency,
      brand: r.brand, condition: "new", identifier_exists: "false", mpn: r.release_id,
      min_handling_time: 7, max_handling_time: r.max_handling_days, quantity: 1,
    }[c]);
  } else if (platform === "meta") {
    head = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"];
    cell = (r, c) => ({
      id: r.sku, title: r.title, description: r.description, availability: "in stock",
      condition: "new", price: r.price.toFixed(2) + " " + r.currency, link: r.pdp_url,
      image_link: r.image_url, brand: r.brand,
    }[c]);
  } else if (platform === "tiktok") {
    head = ["id", "title", "description", "price", "currency", "availability", "brand", "pdp_url", "image_url", "handling_time_days"];
    cell = (r, c) => ({
      id: r.sku, title: r.title, description: r.description, price: r.price.toFixed(2),
      currency: r.currency, availability: "IN_STOCK", brand: r.brand, pdp_url: r.pdp_url,
      image_url: r.image_url, handling_time_days: r.max_handling_days,
    }[c]);
  } else {
    return null;
  }
  const lines = [head.join(",")];
  for (const r of rows) lines.push(head.map((c) => csvEscape(cell(r, c))).join(","));
  return lines.join("\n") + "\n";
}

function downloadCommerceCard() {
  const set = activeSet();
  if (!photosInSet(set).length) { toast(`"${set.name}" has no photos yet`); return; }
  if (!LISTINGS.length) { toast("no listing manifest imported yet. import one from the platform first."); return; }
  const card = commerceCard(set);
  const blob = new Blob([JSON.stringify(card, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  downloadLink(`${slug(set.name)}-commerce-card.json`, url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  const unbound = card.photos.filter((p) => !p.bound).length;
  toast(`commerce card exported for "${set.name}"${unbound ? ` · ${unbound} photo${unbound === 1 ? "" : "s"} without a verified listing binding` : ""}`);
}

function downloadFeedCSV(platform) {
  if (!LISTINGS.length) { toast("no listing manifest imported yet. import one from the platform first."); return; }
  const csv = feedCSV(platform);
  if (csv == null) { toast("unknown feed platform"); return; }
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  downloadLink(`${platform}-catalog-feed.csv`, url);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(`${platform} catalog feed exported (${LISTINGS.length} listing${LISTINGS.length === 1 ? "" : "s"})`);
}

// the commerce bar lives in the capture strip: one row under the photos.
// every render rebuilds it fresh, same as the set row above.
function renderCommerceBar() {
  const strip = $("#capstrip");
  let bar = $("#commercebar");
  if (bar) bar.remove();
  bar = el("div", "btnrow");
  bar.id = "commercebar";
  const boundInSet = new Set(photosInSet(activeSet()).flatMap((p) => photoProducts(p).map((l) => l.sku))).size;
  const status = el("span", "cc-meta",
    LISTINGS.length
      ? `listings: ${LISTINGS.length} imported · ${boundInSet} bound in this set` + (MANIFEST_META ? ` · imported ${MANIFEST_META.imported_utc}` : "")
      : "no listing manifest. the platform exports one per release batch.");
  status.style.alignSelf = "center";
  bar.appendChild(status);

  const fileInp = document.createElement("input");
  fileInp.type = "file"; fileInp.accept = "application/json"; fileInp.style.display = "none";
  fileInp.addEventListener("change", async () => {
    const f = fileInp.files[0];
    if (!f) return;
    try {
      const parsed = JSON.parse(await f.text());
      const res = await importListingManifest(parsed);
      if (res.ok) {
        toast(`listing manifest imported: ${res.accepted} accepted${res.refused.length ? `, ${res.refused.length} refused` : ""}`);
        for (const r of res.refused.slice(0, 3)) toast(`refused ${r.release_id}: ${r.reason}`);
      } else {
        toast(res.refused[0] ? `import refused: ${res.refused[0].reason}` : "import refused");
      }
    } catch (e) { toast("could not read the manifest file: " + e.message); }
    fileInp.value = "";
  });
  bar.appendChild(fileInp);
  const importBtn = el("button", "btn mini", "import listings");
  importBtn.title = "import a sculptura listing manifest (json)";
  importBtn.addEventListener("click", () => fileInp.click());
  bar.appendChild(importBtn);

  const cardBtn = el("button", "btn mini", "commerce card");
  cardBtn.title = "export this set's photo-to-listing sidecar (json)";
  cardBtn.addEventListener("click", downloadCommerceCard);
  bar.appendChild(cardBtn);

  const feedSel = document.createElement("select");
  feedSel.className = "btn mini"; feedSel.style.padding = "4px 8px";
  for (const [v, label] of [["google", "google/pinterest"], ["meta", "meta"], ["tiktok", "tiktok"]]) {
    const o = document.createElement("option"); o.value = v; o.textContent = label; feedSel.appendChild(o);
  }
  bar.appendChild(feedSel);
  const feedBtn = el("button", "btn mini", "feed csv");
  feedBtn.title = "export the catalog feed for the chosen platform";
  feedBtn.addEventListener("click", () => downloadFeedCSV(feedSel.value));
  bar.appendChild(feedBtn);
  strip.appendChild(bar);
}
