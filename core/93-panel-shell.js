function renderGateEntries() {
  const box = document.getElementById("gate-entries");
  if (!box) return;
  box.innerHTML = "";
  if (!GATE.entries.length) { box.appendChild(el("div", "empty", "no releases ingested yet")); return; }
  for (const e of [...GATE.entries].reverse().slice(0, 30)) {
    const item = el("div", "list-item");
    item.style.fontSize = "11px";
    item.appendChild(el("span", "name", `${e.release} v${e.version}`));
    const badge = el("span", e.verified ? "gate-ok" : "gate-bad", e.verified ? "hash verified" : "hash mismatch");
    item.appendChild(badge);
    box.appendChild(item);
  }
}

function renderPanel(tab) {
  currentTab = tab;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
  if (tab === "subject") renderSubjectPanel();
  else if (tab === "jewelry") renderJewelryPanel();
  else if (tab === "pose") renderPosePanel();
  else if (tab === "camera") renderCameraPanel();
  else if (tab === "light") renderLightPanel();
  else if (tab === "scene") renderScenePanel();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => renderPanel(b.dataset.tab)));

