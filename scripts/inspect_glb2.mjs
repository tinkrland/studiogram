import fs from "node:fs";
const buf = fs.readFileSync("app/hand.glb");
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
const nodeById = (id) => json.nodes[id];
// find nodes that are skin joints and their world-ish placement
const joints = json.skins[0].joints.map(nodeById);
for (const n of json.nodes) {
  if (["forearm.L", "hand.L", "finger_ring.01.L"].includes(n.name)) {
    console.log(n.name, "translation:", JSON.stringify(n.translation), "children:", JSON.stringify(n.children));
  }
}
// mesh node transforms
for (const n of json.nodes) {
  if (n.mesh !== undefined) {
    console.log("mesh node:", n.name, "translation:", JSON.stringify(n.translation), "rotation:", JSON.stringify(n.rotation), "scale:", JSON.stringify(n.scale), "skin:", n.skin);
  }
}
// armature root nodes (no parent)
const childIds = new Set();
for (const n of json.nodes) if (n.children) for (const c of n.children) childIds.add(c);
json.nodes.forEach((n, i) => { if (!childIds.has(i)) console.log("root node:", n.name, "translation:", JSON.stringify(n.translation)); });
const posA = json.accessors[json.meshes[0].primitives[0].attributes.POSITION];
console.log("mesh bind bbox min:", posA.min, "max:", posA.max);
