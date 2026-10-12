import bpy, json
result = {"objects": [], "armatures": [], "meshes": [], "textures": []}
for obj in bpy.data.objects:
    info = {"name": obj.name, "type": obj.type,
            "loc": list(obj.location), "rot": list(obj.rotation_euler), "scale": list(obj.scale),
            "parent": obj.parent.name if obj.parent else None}
    if obj.type == "MESH":
        mesh = obj.data
        info["verts"] = len(mesh.vertices)
        info["faces"] = len(mesh.polygons)
        info["uv_layers"] = [uv.name for uv in mesh.uv_layers]
        mats = []
        for m in mesh.materials:
            slots = []
            for s in m.texture_paint_slots if hasattr(m, "texture_paint_slots") else []:
                slots.append(s.name if hasattr(s, "name") else str(s))
            texs = [t.name for t in m.texture_slots if t and t.texture] if hasattr(m, "texture_slots") else []
            mats.append({"name": m.name, "textures": texs or slots})
        info["materials"] = mats
    if obj.type == "ARMATURE":
        bones = []
        for b in obj.data.bones:
            bones.append({"name": b.name, "head": list(b.head_local), "tail": list(b.tail_local), "parent": b.parent.name if b.parent else None})
        info["bones"] = bones
        info["bone_count"] = len(bones)
        if obj.animation_data and obj.animation_data.action:
            info["action"] = obj.animation_data.action.name
    result["objects"].append(info)
print("===HANDJSON===")
print(json.dumps(result, indent=1))
