import bpy, json, statistics
bpy.ops.wm.open_mainfile(filepath="incoming_files/riggedhand/Hand_v.4_cycles.blend")
hand = bpy.data.objects["Hand"]; mesh = hand.data
arm = bpy.data.objects["Armature"]
img = bpy.data.images.load("incoming_files/riggedhand/HAND_C.jpg")
W, H = img.size
px = list(img.pixels)
def brightness(u, v):
    x = min(W-1, max(0, int(u * W))); y = min(H-1, max(0, int(v * H)))
    o = (y * W + x) * 4
    return px[o] + px[o+1] + px[o+2]
distal = ["finger_index.03.L","finger_middle.03.L","finger_ring.03.L","finger_pinky.03.L","thumb.03.L"]
uvl = mesh.uv_layers.active
for bname in distal:
    pb = arm.pose.bones[bname]
    Mi = hand.matrix_world.inverted() @ arm.matrix_world.inverted() @ pb.matrix
    vg = hand.vertex_groups.get(bname)
    dom = {}
    for li, loop in enumerate(mesh.loops):
        i = loop.vertex_index
        if i in dom: continue
        for g in mesh.vertices[i].groups:
            if g.group == vg.index and g.weight > 0.5:
                dom[i] = li; break
    verts = []
    for i, li in dom.items():
        loc = Mi @ mesh.vertices[i].co
        u, v = uvl.data[li].uv
        verts.append((loc.x, loc.y, loc.z, u, v, brightness(u, v)))
    # summarize local coordinate ranges and brightness correlation
    xs = [vv[0] for vv in verts]; ys = [vv[1] for vv in verts]; zs = [vv[2] for vv in verts]
    bs = [vv[5] for vv in verts]
    # brightness by z tercile and by x tercile
    def terc(sel):
        sel_v = [vv[5] for vv in verts if sel(vv)]
        return round(statistics.mean(sel_v), 3) if sel_v else None
    zt = statistics.quantiles(zs, n=3) if len(set(zs)) > 2 else [0,0]
    xt = statistics.quantiles(xs, n=3) if len(set(xs)) > 2 else [0,0]
    print(bname, "n", len(verts))
    print("   x range", round(min(xs),3), round(max(xs),3), "terciles", [round(t,3) for t in xt],
          "| b: lo", terc(lambda vv: vv[0] <= xt[0]), "mid", terc(lambda vv: xt[0] < vv[0] <= xt[1]), "hi", terc(lambda vv: vv[0] > xt[1]))
    print("   z range", round(min(zs),3), round(max(zs),3), "terciles", [round(t,3) for t in zt],
          "| b: lo", terc(lambda vv: vv[2] <= zt[0]), "mid", terc(lambda vv: zt[0] < vv[2] <= zt[1]), "hi", terc(lambda vv: vv[2] > zt[1]))
    print("   y range", round(min(ys),3), round(max(ys),3),
          "| b by y half: lower", terc(lambda vv: vv[1] <= statistics.median(ys)), "upper", terc(lambda vv: vv[1] > statistics.median(ys)))
