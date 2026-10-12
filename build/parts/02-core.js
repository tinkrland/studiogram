const DEG = Math.PI / 180;
// ===== core: helpers, canonical json, hashing, state =====
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
window.addEventListener("error", (e) => {
  const b = $("#errbox");
  b.style.display = "block";
  b.textContent += "error: " + e.message + "\n  at " + (e.filename || "?") + ":" + (e.lineno || "?") + "\n";
});
window.addEventListener("unhandledrejection", (e) => {
  const b = $("#errbox");
  b.style.display = "block";
  b.textContent += "promise rejection: " + (e.reason && e.reason.message ? e.reason.message : e.reason) + "\n";
});

// canonical json: sorted keys, no whitespace. identical rule to the release chain.
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
async function sha256hex(value) {
  const data = new TextEncoder().encode(canonical(value));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const nowUtc = () => new Date().toISOString().replace(/\.\d+Z$/, "Z");

// ===== the release registry (fixtures) =====
// these stand in for real design releases from the studio server. each record
// carries the schema fields, the placement info that travels with the design,
// and a tamper-evident hash chain: mesh_sha256 over the mesh spec, record_hash
// over the record, prev_hash linking to the predecessor. the ingestion gate
// recomputes all of it and never trusts a declared claim.
