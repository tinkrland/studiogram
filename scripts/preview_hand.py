import bpy, json
result = {}
src = "assets/rigged-hand/"
# report dimensions and vertex groups of the hand mesh
hand = bpy.data.objects.get("Hand") or bpy.data.objects.get("Cube.005")
dg = []
for v in hand.data.vertices:
    dg.append(list(v.co))
xs = [c[0] for c in dg]; ys = [c[1] for c in dg]; zs = [c[2] for c in dg]
result["dims"] = [max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)]
result["min"] = [min(xs), min(ys), min(zs)]
result["vg_count"] = len(hand.vertex_groups)
result["vg_names"] = [g.name for g in hand.vertex_groups][:40]
result["modifiers"] = [m.type for m in hand.modifiers]
skin = hand.modifiers.get("Armature")
result["armature_mod_target"] = skin.object.name if skin and skin.object else None

# check uv layout bounds
uvl = hand.data.uv_layers.active
if uvl:
    us = [uv.uv[0] for uv in uvl.data]; vs = [uv.uv[1] for uv in uvl.data]
    result["uv_bounds"] = [min(us), max(us), min(vs), max(vs)]

print("===INFO===")
print(json.dumps(result, indent=1))

# assign textures for the preview render
mat = hand.data.materials[0]
mat.use_nodes = True
nt = mat.node_tree
for n in nt.nodes: nt.nodes.remove(n)
out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (400, 0)
bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (100, 0)
tex = nt.nodes.new("ShaderNodeTexImage"); tex.location = (-300, 300)
tex.image = bpy.data.images.load(src + "hand-c.jpg")
nrm = nt.nodes.new("ShaderNodeTexCoord"); nrm.location = (-500, 300)
normal = nt.nodes.new("ShaderNodeNormalMap"); normal.location = (-100, 0)
ntex = nt.nodes.new("ShaderNodeTexImage"); ntex.location = (-300, -250)
ntex.image = bpy.data.images.load(src + "hand-n.jpg")
ntex.image.colorspace_settings.name = "Non-Color"
nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
nt.links.new(ntex.outputs["Color"], normal.inputs["Color"])
nt.links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])
nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

# simple studio light setup
import mathutils
bpy.ops.object.light_add(type="AREA", location=(2, 2, 3))
key = bpy.context.object
key.data.energy = 600; key.data.size = 3; key.rotation_euler = (0.9, 0.3, 0.4)
bpy.ops.object.light_add(type="AREA", location=(-2, 1, 1))
fill = bpy.context.object
fill.data.energy = 200; fill.data.size = 3

# camera aimed at the hand region
cam_data = bpy.data.cameras.new("PrevCam")
cam = bpy.data.objects.new("PrevCam", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (-0.4, 1.6, 1.75)
dir_target = mathutils.Vector((-0.79, -0.17, 1.45))
direction = dir_target - cam.location
rot_q = direction.to_track_quat("-Z", "Y")
cam.rotation_euler = rot_q.to_euler()
cam_data.lens = 85
scene = bpy.context.scene
scene.camera = cam
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = 900
scene.render.resolution_y = 700
world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg: bg.inputs["Color"].default_value = (0.9, 0.88, 0.85, 1)
scene.render.filepath = "app/preview1.png"
bpy.ops.render.render(write_still=True)
print("preview1 rendered")
# second angle: from the other side
cam.location = (-1.6, 1.0, 1.7)
direction = dir_target - cam.location
cam.rotation_euler = (direction.to_track_quat("-Z", "Y")).to_euler()
scene.render.filepath = "app/preview2.png"
bpy.ops.render.render(write_still=True)
print("preview2 rendered")
