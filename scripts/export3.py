import bpy, os
bpy.ops.wm.open_mainfile(filepath="assets/rigged-hand/hand-v4-cycles.blend")
arm = bpy.data.objects["Armature"]; hand = bpy.data.objects["Hand"]
for obj in list(bpy.data.objects):
    if obj.name not in {"Armature", "Hand"}:
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for bone in list(arm.data.edit_bones):
    if bone.name.endswith(".R") or bone.name in ("ribs.001", "shoulder.L", "upper_arm.L"):
        arm.data.edit_bones.remove(bone)
bpy.ops.object.mode_set(mode="OBJECT")
# NOTE: the armature is deliberately NOT recentered here. glTF skinning binds
# mesh vertices to bones through inverse bind matrices recorded in this exact
# bind pose; moving the objects in blender breaks that agreement. the app
# positions the whole model with a wrapper transform instead.
src = "assets/rigged-hand/"
mat = hand.data.materials[0]; mat.name = "Skin"; mat.use_nodes = True
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
for m in list(hand.modifiers):
    if m.type in ("EDGE_SPLIT", "DISPLACE"): hand.modifiers.remove(m)
sub = hand.modifiers.get("Subsurf") or hand.modifiers.new("Subsurf2", "SUBSURF")
sub.levels = 2; sub.render_levels = 2
bpy.context.view_layer.objects.active = hand
bpy.ops.object.modifier_apply(modifier=sub.name)
print("verts after subsurf:", len(hand.data.vertices))
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); hand.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath="app/hand.glb",
    export_format="GLB", use_selection=True, export_apply=True,
    export_animations=False, export_skins=True, export_texcoords=True,
    export_normals=True, export_yup=True, export_materials="EXPORT",
    export_image_format="AUTO", export_extras=False,
)
print("GLBSIZE", os.path.getsize("app/hand.glb"))
