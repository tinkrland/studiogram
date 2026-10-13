// ===== panels and controls =====
let currentTab = "subject";
const PANEL = $("#panelbody");

function section(parent, title) {
  const s = el("div", "section");
  s.appendChild(el("h3", null, title));
  parent.appendChild(s);
  return s;
}
function slider(parent, label, min, max, step, get, set, opts = {}) {
  const row = el("div", "row");
  const lab = el("label", null, label);
  const inp = document.createElement("input");
  inp.type = "range"; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
  const val = el("span", "val", opts.fmt ? opts.fmt(get()) : String(get()));
  inp.addEventListener("input", () => {
    const v = parseFloat(inp.value);
    set(v);
    val.textContent = opts.fmt ? opts.fmt(v) : String(v);
    if (opts.apply) opts.apply();
    saveState();
  });
  row.append(lab, inp, val);
  parent.appendChild(row);
  return { row, inp };
}
function selectControl(parent, label, options, get, set, opts = {}) {
  const row = el("div", "row");
  const lab = el("label", null, label);
  const sel = document.createElement("select");
  for (const o of options) {
    const op = document.createElement("option");
    op.value = o.value; op.textContent = o.label;
    sel.appendChild(op);
  }
  sel.value = get();
  sel.addEventListener("change", () => { set(sel.value); if (opts.apply) opts.apply(); saveState(); });
  row.append(lab, sel);
  parent.appendChild(row);
  return sel;
}
function button(parent, label, cls, fn) {
  const b = el("button", cls || "btn", label);
  b.addEventListener("click", fn);
  parent.appendChild(b);
  return b;
}
function hint(parent, text) { parent.appendChild(el("div", "hint", text)); }

