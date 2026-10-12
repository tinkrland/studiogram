import bpy, os, json, math
import numpy as np
src = "assets/rigged-hand/"

# ============================================================
# morphs.py — authors the studio-spec section 2.1 morphology
# blend targets on the single base hand mesh, then re-exports
# the glb. one mesh, seven authored shape keys:
#   presentation_male, presentation_female   (influence 0/1)
#   build, finger_length, finger_thickness,  (slider -1..1)
#   palm_width, palm_proportions              (slider -1..1)
# every slider in the app is driven by a target that exists
# here first, per agents.md 9.
# ============================================================

# --- cleanup: identical to export_hand.py so bone names match ---
keep = {"Armature", "Hand"}
for obj in list(bpy.data.objects):
    if obj.name not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)

arm = bpy.data.objects["Armature"]
hand = bpy.data.objects["Hand"]

bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for bone in list(arm.data.edit_bones):
    if bone.name.endswith(".R") or bone.name in ("ribs.001", "shoulder.L", "upper_arm.L"):
        arm.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode="OBJECT")

for mname in ("Edge Split", "EdgeSplit", "EDGE_SPLIT"):
    m = hand.modifiers.get(mname)
    if m: hand.modifiers.remove(m)
for m in list(hand.modifiers):
    if m.type == "EDGE_SPLIT" or m.type == "DISPLACE":
        hand.modifiers.remove(m)

# --- reset the armature to rest before anything bakes geometry. this
# file carries a saved pose; an applied modifier would bake it in.
for pb in arm.pose.bones:
    pb.location = (0.0, 0.0, 0.0)
    if pb.rotation_mode == "QUATERNION":
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    else:
        pb.rotation_euler = (0.0, 0.0, 0.0)
    pb.scale = (1.0, 1.0, 1.0)

# --- apply subsurf destructively: glTF cannot bake modifiers while
# exporting shape keys, so the smooth geometry must live in the mesh itself
# before targets are authored. applied at bind pose, weights intact.
bpy.context.view_layer.objects.active = hand
sub0 = hand.modifiers.get("Subsurf") or hand.modifiers.get("Subsurf2")
if sub0 is None:
    sub0 = hand.modifiers.new("Subsurf2", "SUBSURF")
sub0.levels = 2
sub0.render_levels = 2
bpy.ops.object.modifier_apply(modifier=sub0.name)
print("APPLIEDVERTS", len(hand.data.vertices))

# --- bind-pose geometry in world space ---
mesh = hand.data
mw = hand.matrix_world
aw = arm.matrix_world
n = len(mesh.vertices)
basis = np.empty(n * 3)
mesh.vertices.foreach_get("co", basis)
basis = basis.reshape(n, 3)
from mathutils import Vector
verts = [mw @ Vector(basis[i]) for i in range(n)]

def bone_seg(name):
    b = arm.data.bones.get(name)
    if b is None: return None
    return (aw @ b.head_local).copy(), (aw @ b.tail_local).copy()

def seg_closest(p, a, b):
    ab = b - a
    ab2 = ab.dot(ab)
    t = 0.0 if ab2 < 1e-12 else max(0.0, min(1.0, (p - a).dot(ab) / ab2))
    q = a + ab * t
    return q, t

def smoothstep(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3.0 - 2.0 * x)

FINGERS = ["index", "middle", "ring", "pinky"]
CHAIN = {}
for f in FINGERS:
    CHAIN[f] = [f"finger_{f}.{s}.L" for s in ("01", "02", "03")]
CHAIN["thumb"] = [f"thumb.{s}.L" for s in ("01", "02", "03")]

# --- per-vertex finger fields: nearest segment, radial dir, chain dir, weight ---
finger_segs = []
for f, names in CHAIN.items():
    for nm in names:
        s = bone_seg(nm)
        if s: finger_segs.append((f, s[0], s[1]))

# chain direction per finger: mcp head -> distal tail
chain_dir = {}
for f, names in CHAIN.items():
    h = bone_seg(names[0]); t = bone_seg(names[-1])
    if h and t:
        d = (t[1] - h[0])
        if d.length > 1e-9: chain_dir[f] = d.normalized()

# mcp anchors (palm knuckle line) and wrist anchor
mcps = []
for f in FINGERS:
    h = bone_seg(CHAIN[f][0])
    if h: mcps.append(h[0])
mcp_mean = 1 / len(mcps) * sum(mcps, Vector((0, 0, 0)))
wrist_seg = bone_seg("hand.L")
W = wrist_seg[0] if wrist_seg else Vector((0, 0, 0))
fore_seg = bone_seg("forearm.L")

palm_axis = (mcp_mean - W)
palm_len = palm_axis.length
palm_axis = palm_axis.normalized() if palm_len > 1e-9 else Vector((0, 0, 1))

# dorsal direction: average vertex normal in the palm band
normals = np.empty(n * 3)
mesh.vertices.foreach_get("normal", normals)
normals = normals.reshape(n, 3)
dorsal = Vector((0.0, 0.0, 0.0)); dcnt = 0
for i in range(n):
    t = (verts[i] - W).dot(palm_axis) / palm_len
    if 0.2 < t < 0.7:
        dorsal += Vector(normals[i])
        dcnt += 1
if dcnt: dorsal /= dcnt
else: dorsal = Vector((0, 1, 0))
lateral = palm_axis.cross(dorsal)
if lateral.length > 1e-9: lateral = lateral.normalized()

print("PALM axis", tuple(round(c, 3) for c in palm_axis), "len", round(palm_len, 4))
print("LATERAL", tuple(round(c, 3) for c in lateral), "dorsal", tuple(round(c, 3) for c in dorsal))

# --- displacement fields (meters) ---
d_thick = np.zeros((n, 3))   # finger radial unit dir * weight
d_len = np.zeros((n, 3))    # finger chain dir * weight
w_finger = np.zeros(n)
for i in range(n):
    p = verts[i]
    best = None
    for f, a, b in finger_segs:
        q, t = seg_closest(p, a, b)
        d = (p - q).length
        if best is None or d < best[0]:
            best = (d, q, f)
    d, q, f = best
    w = smoothstep(1.0 - d / 0.012)          # full inside 12mm of a finger axis
    w_finger[i] = w
    if w > 0 and d > 1e-6:
        d_thick[i] = ((p - q) / d) * w
    if f in chain_dir and w > 0:
        d_len[i] = chain_dir[f] * w

# palm weight: along-axis band, radial falloff around the palm slab
d_width = np.zeros((n, 3))   # lateral dir * weight
d_palm = np.zeros((n, 3))    # lateral + dorsal-flatten mix * weight
for i in range(n):
    p = verts[i]
    t = (p - W).dot(palm_axis) / palm_len
    if t < -0.05 or t > 1.1: continue
    wa = smoothstep((t + 0.05) / 0.25) * smoothstep((1.1 - t) / 0.35)  # fade at wrist and knuckles
    # radial distance from palm axis line
    q = W + palm_axis * (p - W).dot(palm_axis)
    r = (p - q).length
    wr = smoothstep(1.0 - (r - 0.02) / 0.03)   # full within 20mm, gone by 50mm
    w = wa * wr
    if w <= 0: continue
    d_width[i] = np.array(lateral) * w
    # palm proportions: broaden + slightly flatten the dorsal dome
    dd = np.array(lateral) * 0.6 + np.array(dorsal) * -0.25
    d_palm[i] = dd * w

# build/forearm: radial around forearm axis, stronger toward the elbow end
d_build = np.zeros((n, 3))
if fore_seg:
    fa, fb = fore_seg
    fab = fb - fa
    fl2 = fab.dot(fab)
    for i in range(n):
        p = verts[i]
        t = (p - fa).dot(fab) / fl2
        if t < -0.2 or t > 1.3: continue
        q, _ = seg_closest(p, fa, fb)
        d = (p - q).length
        w = smoothstep(1.0 - d / 0.03) * (0.25 + 0.75 * smoothstep((t + 0.2) / 1.0))
        if w > 0 and d > 1e-6:
            d_build[i] = ((p - q) / d) * w

# --- nails: the dorsal cap at each fingertip. two targets: length extends
# the plate along the finger axis; shape flattens the dorsal bulge toward a
# squarer profile. same mask family, dorsal-side only, narrow lateral band.
d_nlen = np.zeros((n, 3))
d_nshape = np.zeros((n, 3))
nail_hits = 0
dorsal_u = dorsal.normalized() if dorsal.length > 1e-9 else Vector((0, 1, 0))
for f, names in CHAIN.items():
    seg = bone_seg(names[-1])
    if not seg: continue
    a, b = seg
    cdir = chain_dir.get(f)
    for i in range(n):
        p = verts[i]
        q, t = seg_closest(p, a, b)
        if t < 0.72: continue                     # only the last stretch of the finger
        d = (p - q).length
        if d < 1e-6 or d > 0.011: continue          # fingertip radius only
        r = (p - q) / d
        dor = r.dot(dorsal_u)
        if dor < 0.45: continue                    # dorsal side only (the nail face)
        if abs(r.dot(lateral)) > 0.62: continue    # plate spans the finger centre, not the sides
        w = smoothstep((t - 0.72) / 0.28) * smoothstep((0.011 - d) / 0.004)
        if w <= 0: continue
        nail_hits += 1
        if cdir: d_nlen[i] = np.array(cdir) * w
        d_nshape[i] = -np.array(r) * w * dor       # flatten the bulge toward the axis
print("NAILHITS", nail_hits)

# --- authored magnitudes (real units, meters) ---
K_THICK = 0.0008   # 0.8mm radial on fingers
K_LEN = 0.0018     # 1.8mm along the chain
K_WIDTH = 0.0009   # 0.9mm lateral on the palm
K_PALM = 0.0007
K_BUILD = 0.0012   # 1.2mm radial on the forearm

K_NAILLEN = 0.0016   # 1.6mm of plate extension at full weight
K_NAILSHAPE = 0.0007 # 0.7mm flatten toward a squarer profile

TARGETS = {
    "finger_thickness": d_thick * K_THICK,
    "finger_length": d_len * K_LEN,
    "palm_width": d_width * K_WIDTH,
    "palm_proportions": d_palm * K_PALM,
    "build": d_build * K_BUILD,
    "nail_length": d_nlen * K_NAILLEN,
    "nail_shape": d_nshape * K_NAILSHAPE,
}
# presentations are authored combinations, their own blend targets on the same mesh
TARGETS["presentation_male"] = (
    d_thick * K_THICK * 0.62 + d_len * K_LEN * 0.05
    + d_width * K_WIDTH * 0.42 + d_build * K_BUILD * 0.60
)
TARGETS["presentation_female"] = (
    -d_thick * K_THICK * 0.72 + d_len * K_LEN * 0.22
    -d_width * K_WIDTH * 0.52 - d_build * K_BUILD * 0.55
    -d_palm * K_PALM * 0.30
)

# --- author as real shape keys ---
assert not mesh.shape_keys, "expected no pre-existing shape keys"
hand.shape_key_add(name="Basis", from_mix=False)
for name, delta in TARGETS.items():
    sk = hand.shape_key_add(name=name, from_mix=False)
    arr = (basis + delta).reshape(-1)
    sk.data.foreach_set("co", arr)
    sk.value = 0.0
print("KEYS", [k.name for k in mesh.shape_keys.key_blocks])

# --- forearm uv follicles: candidate body-hair locations the app composites
# into the skin texture. v is pre-flipped to gltf convention (1 - blender v).
import json
uvl = mesh.uv_layers.active
hair_pts = []
if fore_seg and uvl:
    fa, fb = fore_seg
    fab = fb - fa
    fl2 = fab.dot(fab)
    for li, loop in enumerate(mesh.loops):
        i = loop.vertex_index
        p = verts[i]
        t = (p - fa).dot(fab) / fl2
        if t < -0.05 or t > 1.05: continue
        q, _ = seg_closest(p, fa, fb)
        if (p - q).length > 0.032: continue
        u, v = uvl.data[li].uv
        hair_pts.append((round(u, 5), round(1.0 - v, 5)))
    stride = max(1, len(hair_pts) // 2200)
    hair_pts = hair_pts[::stride]
open("app/hair-region.json", "w").write(json.dumps(hair_pts))
print("HAIRPTS", len(hair_pts))

# --- material, same as export_hand.py ---
mat = hand.data.materials[0]
mat.name = "Skin"
mat.use_nodes = True
nt = mat.node_tree
for nd in list(nt.nodes): nt.nodes.remove(nd)
out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (400, 0)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (100, 0)
bsdf.inputs["Roughness"].default_value = 0.55
tex = nt.nodes.new("ShaderNodeTexImage"); tex.location = (-300, 300)
tex.image = bpy.data.images.load(src + "hand-c.jpg")
tex.image.name = "hand_color"
ntex = nt.nodes.new("ShaderNodeTexImage"); ntex.location = (-300, -250)
ntex.image = bpy.data.images.load(src + "hand-n.jpg")
ntex.image.name = "hand_normal"
ntex.image.colorspace_settings.name = "Non-Color"
normal = nt.nodes.new("ShaderNodeNormalMap"); normal.location = (-100, 0)
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(ntex.outputs["Color"], normal.inputs["Color"])
nt.links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

# no location delta: the shipped bind layout keeps the armature node at
# its original (0, 0.0246, 0) like the released glb; the app owns placement.
print("ARMLOC", tuple(round(v, 4) for v in arm.location))

# sanity: weight coverage
print("COVERAGE finger %.2f palm %.2f build %.2f" % (
    (w_finger > 0.5).mean(),
    (np.abs(d_width).sum(axis=1) > 0.3).mean(),
    (np.abs(d_build).sum(axis=1) > 0.3).mean()))

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
hand.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath="app/hand.glb",
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_animations=False,
    export_skins=True,
    export_morph=True,
    export_texcoords=True,
    export_normals=True,
    export_yup=True,
    export_materials="EXPORT",
    export_image_format="AUTO",
    export_extras=False,
)
print("GLBSIZE", os.path.getsize("app/hand.glb"))
