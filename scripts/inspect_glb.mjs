import fs from "node:fs";
const buf = fs.readFileSync("app/hand.glb");
const magic = buf.readUInt32LE(0), jsonLen = buf.readUInt32LE(12), jsonType = buf.readUInt32LE(16);
console.log("magic ok:", magic === 0x46546c67, "json chunk bytes:", jsonLen);
const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString());
console.log("asset:", JSON.stringify(json.asset));
console.log("meshes:", json.meshes.length, "nodes:", json.nodes.length, "skins:", json.skins.length);
console.log("images:", json.images.map((i) => i.mimeType).join(", "));
const mesh = json.meshes[0];
let tris = 0, verts = 0;
for (const p of mesh.primitives) {
  const idx = json.accessors[p.indices];
  const posA = json.accessors[p.attributes.POSITION];
  tris += idx.count / 3; verts += posA.count;
  console.log("primitive: tris", idx.count / 3, "verts", posA.count, "min", JSON.stringify(posA.min), "max", JSON.stringify(posA.max));
}
console.log("skin joints:", json.skins[0].joints.length);
const nodeById = (id) => json.nodes[id];
const joints = json.skins[0].joints.map(nodeById);
console.log("joint names:", joints.map((j) => j.name).join(", "));
// report local transforms of interesting joints
for (const n of json.nodes) {
  if (["forearm.L", "hand.L", "finger_ring.01.L", "finger_ring.02.L", "finger_middle.01.L", "thumb.01.L", "palm.03.L"].includes(n.name)) {
    console.log(n.name, "translation:", JSON.stringify(n.translation), "rotation:", JSON.stringify(n.rotation), "scale:", JSON.stringify(n.scale), "children:", JSON.stringify(n.children));
  }
}
// images sizes
for (const b of json.bufferViews) {
  if (b.buffer === json.images.length ? true : false) break;
}
const binChunkStart = 20 + jsonLen;
const binChunkHeader = buf.slice(binChunkStart, binChunkStart + 8);
const binLen = binChunkHeader.readUInt32LE(0);
console.log("binary chunk bytes:", binLen);
