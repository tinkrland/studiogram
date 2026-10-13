import bpy, json, math

# open fresh copy of the cycles blend
bpy.ops.wm.open_mainfile(filepath="assets/rigged-hand/hand-v4-cycles.blend")

arm = bpy.data.objects["Armature"]
hand = bpy.data.objects["Hand"]

# cleanup as before
keep = {"Armature", "Hand"}
for obj in list(bpy.data.objects):
    if obj.name not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for bone in list(arm.data.edit_bones):
    if bone.name.endswith(".R") or bone.name in ("ribs.001", "shoulder.L", "upper_arm.L"):
        arm.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode="OBJECT")

# center at hand.L bone head
delta = (0.719, 0.162, -1.445)
for obj in (arm, hand):
    obj.location.x += delta[0]; obj.location.y += delta[1]; obj.location.z += delta[2]

# materials
src = "assets/rigged-hand/"
mat = hand.data.materials[0]
mat.name = "Skin"
mat.use_nodes = True
nt = mat.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (400, 0)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (100, 0)
bsdf.inputs["Roughness"].default_value = 0.55
tex = nt.nodes.new("ShaderNodeTexImage"); tex.location = (-300, 300)
tex.image = bpy.data.images.load(src + "hand-c.jpg"); tex.image.name = "hand_color"
ntex = nt.nodes.new("ShaderNodeTexImage"); ntex.location = (-300, -250)
ntex.image = bpy.data.images.load(src + "hand-n.jpg"); ntex.image.name = "hand_normal"
ntex.image.colorspace_settings.name = "Non-Color"
normal = nt.nodes.new("ShaderNodeNormalMap"); normal.location = (-100, 0)
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(ntex.outputs["Color"], normal.inputs["Color"])
nt.links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

# remove edge split / displace, apply subsurf into the mesh
for m in list(hand.modifiers):
    if m.type in ("EDGE_SPLIT", "DISPLACE"):
        hand.modifiers.remove(m)
sub = hand.modifiers.get("Subsurf") or hand.modifiers.new("Subsurf2", "SUBSURF")
sub.levels = 2; sub.render_levels = 2
bpy.context.view_layer.objects.active = hand
bpy.ops.object.modifier_apply(modifier=sub.name)

# light rig for previews
bpy.ops.object.light_add(type="AREA", location=(2, 2, 3))
key = bpy.context.object
key.data.energy = 600; key.data.size = 3; key.rotation_euler = (0.9, 0.3, 0.4)
bpy.ops.object.light_add(type="AREA", location=(-2, 1, 1))
fill = bpy.context.object
fill.data.energy = 200; fill.data.size = 3

# camera looking at origin area (hand at origin after centering)
import mathutils
cam_data = bpy.data.cameras.new("PrevCam")
cam = bpy.data.objects.new("PrevCam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (0.0, 0.85, 0.35)
direction = mathutils.Vector((0, 0, 0)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 60
scene = bpy.context.scene
scene.camera = cam
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 640
scene.render.resolution_y = 560
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg: bg.inputs["Color"].default_value = (0.92, 0.90, 0.87, 1)

# pose mode
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
pb = arm.pose.bones

FINGERS = ["thumb", "finger_index", "finger_middle", "finger_ring", "finger_pinky"]

def set_rot(name, rx=0, ry=0, rz=0):
    b = pb.get(name)
    if b:
        b.rotation_mode = "XYZ"
        b.rotation_euler = (rx, ry, rz)

def reset_pose():
    for b in pb:
        b.rotation_euler = (0, 0, 0)

def pose_flat():
    # natural relaxed spread
    set_rot("hand.L", rx=math.radians(0), ry=math.radians(-6), rz=math.radians(4))
    for f, spread in zip(FINGERS[1:], [0.08, 0.05, -0.04, -0.10]):
        set_rot(f + ".01.L", rz=spread)
    for f in FINGERS[1:]:
        set_rot(f + ".01.L", rx=0.06)
        set_rot(f + ".02.L", rx=0.08)
        set_rot(f + ".03.L", rx=0.06)

def pose_presenting():
    # ring finger straight, others relaxed-curled, slight spread
    set_rot("hand.L", ry=math.radians(-6), rz=math.radians(6))
    # index
    set_rot("finger_index.01.L", rx=0.35, rz=0.10)
    set_rot("finger_index.02.L", rx=0.45)
    set_rot("finger_index.03.L", rx=0.30)
    # middle
    set_rot("finger_middle.01.L", rx=0.28, rz=0.04)
    set_rot("finger_middle.02.L", rx=0.38)
    set_rot("finger_middle.03.L", rx=0.28)
    # ring straight
    set_rot("finger_ring.01.L", rx=0.02, rz=-0.02)
    set_rot("finger_ring.02.L", rx=0.02)
    set_rot("finger_ring.03.L", rx=0.02)
    # pinky
    set_rot("finger_pinky.01.L", rx=0.35, rz=-0.12)
    set_rot("finger_pinky.02.L", rx=0.45)
    set_rot("finger_pinky.03.L", rx=0.35)
    # thumb tucked beside
    set_rot("thumb.01.L", rx=0.05, rz=0.10)
    set_rot("thumb.02.L", rx=0.15)
    set_rot("thumb.03.L", rx=0.08)

def pose_pointing():
    # index extended, others curled
    set_rot("hand.L", ry=math.radians(-4), rz=math.radians(2))
    set_rot("finger_index.01.L", rx=-0.02, rz=0.02)
    for f in ["finger_middle", "finger_ring", "finger_pinky"]:
        set_rot(f + ".01.L", rx=0.85)
        set_rot(f + ".02.L", rx=0.95)
        set_rot(f + ".03.L", rx=0.55)
    set_rot("thumb.01.L", rx=0.25, rz=0.35)
    set_rot("thumb.02.L", rx=0.30)
    set_rot("thumb.03.L", rx=0.20)

def pose_fist():
    set_rot("hand.L", ry=math.radians(-6), rz=math.radians(4))
    for f in FINGERS[1:]:
        set_rot(f + ".01.L", rx=1.15)
        set_rot(f + ".02.L", rx=1.15)
        set_rot(f + ".03.L", rx=0.65)
    set_rot("thumb.01.L", rz=0.55, rx=0.15)
    set_rot("thumb.02.L", rx=0.45)
    set_rot("thumb.03.L", rx=0.30)

def pose_spread():
    set_rot("hand.L", ry=math.radians(-6), rz=math.radians(2))
    for f, spread in zip(FINGERS[1:], [0.22, 0.10, -0.10, -0.24]):
        set_rot(f + ".01.L", rz=spread, rx=0.04)
        set_rot(f + ".02.L", rx=0.05)
        set_rot(f + ".03.L", rx=0.04)
    set_rot("thumb.01.L", rz=0.30, rx=-0.05)
    set_rot("thumb.02.L", rx=0.05)

POSES = {
    "flat": pose_flat,
    "presenting": pose_presenting,
    "pointing": pose_pointing,
    "fist": pose_fist,
    "spread": pose_spread,
}

presets = {}
for name, fn in POSES.items():
    reset_pose()
    fn()
    deltas = {}
    for b in pb:
        r = b.rotation_euler
        if abs(r.x) > 1e-5 or abs(r.y) > 1e-5 or abs(r.z) > 1e-5:
            deltas[b.name] = [round(r.x, 4), round(r.y, 4), round(r.z, 4)]
    presets[name] = deltas
    scene.render.filepath = f"posing-studio/pose_{name}.png"
    bpy.ops.render.render(write_still=True)
    print("rendered", name, "bones touched:", len(deltas))

with open("posing-studio/poses.json", "w") as f:
    json.dump(presets, f, indent=1)
print("poses written:", list(presets.keys()))
