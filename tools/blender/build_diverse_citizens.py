import bpy
import bmesh
import math
import os
from mathutils import Vector

SRC_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\rpm_human.glb"
OUT_DIR = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models"

def load_clean_base():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC_GLB)
    for name in ["Wolf3D_Headwear", "Wolf3D_Beard", "Icosphere"]:
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o, do_unlink=True)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    return (
        arm,
        bpy.data.objects["Wolf3D_Head"],
        bpy.data.objects["Wolf3D_Body"],
        bpy.data.objects["Wolf3D_Outfit_Top"],
        bpy.data.objects["Wolf3D_Outfit_Bottom"],
        bpy.data.objects["Wolf3D_Outfit_Footwear"],
    )

def make_mat(name, col, rough=0.72, metal=0.04, clearcoat=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*col, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs and clearcoat > 0:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    m.diffuse_color = (*col, 1.0)
    return m

def bind(obj, arm, parent, bone_weights):
    # Bake exact armature-space coordinates into vertices before skinning so handbags/briefcases/caps never detach!
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.parent = parent
    for bn, w in bone_weights.items():
        vg = obj.vertex_groups.new(name=bn)
        vg.add(list(range(len(obj.data.vertices))), w, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm

def trim_coat_to_waist(top_obj, hem_z=0.99, shoulder_scale=1.0, waist_taper=1.0, smooth_front=True):
    bm = bmesh.new()
    bm.from_mesh(top_obj.data)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    del_f = [f for f in bm.faces if max(abs(v.co.x) for v in f.verts) < 0.24 and (sum(v.co.z for v in f.verts) / len(f.verts)) < hem_z]
    if del_f:
        bmesh.ops.delete(bm, geom=del_f, context="FACES")
    bm.verts.ensure_lookup_table()
    front_v = []
    for v in bm.verts:
        if abs(v.co.x) < 0.24 and v.co.z < hem_z + 0.12:
            if v.co.z < hem_z + 0.018:
                v.co.z = hem_z
            v.co.x *= waist_taper
            v.co.y = (v.co.y + 0.01) * waist_taper - 0.01
        if 1.32 < v.co.z < 1.54 and abs(v.co.x) > 0.11:
            v.co.x *= shoulder_scale
        if smooth_front and abs(v.co.x) < 0.17 and v.co.y < -0.05 and v.co.z > 1.24:
            max_fwd = -0.138 if v.co.z < 1.44 else (-0.112 + (v.co.z - 1.44) * 0.45)
            if v.co.y < max_fwd:
                v.co.y = max_fwd
            front_v.append(v)
    if front_v:
        for _ in range(5):
            bmesh.ops.smooth_vert(bm, verts=front_v, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    loose = [v for v in bm.verts if len(v.link_faces) == 0]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.normal_update()
    bm.to_mesh(top_obj.data)
    bm.free()
    top_obj.data.update()

def add_scalp_hair(head_obj, arm, mat, top_puff=0.018, name="Ped_Hair"):
    mesh = head_obj.data.copy()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = head_obj.parent
    obj.matrix_local = head_obj.matrix_local.copy()
    for vg in head_obj.vertex_groups:
        obj.vertex_groups.new(name=vg.name)
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.003)
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    keep = set()
    for f in bm.faces:
        c = f.calc_center_median()
        hl = 1.758 - max(0.0, (c.y + 0.092)) * 0.88
        near_ear = abs(c.x) > 0.076 and (-0.078 < c.y < 0.014) and c.z < 1.746
        if c.z >= hl and c.y > -0.114 and not near_ear:
            keep.add(f)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f not in keep], context="FACES")
    loose = [v for v in bm.verts if len(v.link_faces) == 0]
    if loose: bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.normal_update()
    hc = Vector((0.0, -0.02, 1.70))
    for v in bm.verts:
        tt = max(0.0, min(1.0, (v.co.z - 1.67) / 0.16))
        rad = (v.co - hc).normalized()
        is_b = any(e.is_boundary for e in v.link_edges)
        v.co += rad * (0.004 if is_b else (0.008 + (tt ** 1.3) * top_puff))
    non_b = [v for v in bm.verts if not any(e.is_boundary for e in v.link_edges)]
    bmesh.ops.smooth_vert(bm, verts=non_b, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.006)
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    for p in obj.data.polygons: p.use_smooth = True
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj

def export_ped(filename):
    path = os.path.join(OUT_DIR, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_skins=True,
        export_all_influences=False,
    )
    print("EXPORTED CITIZEN:", filename, os.path.getsize(path))

# ==============================================================================
# 1. GENEVA CHIC WOMAN (Long flowing hair, camel trench coat, feminine silhouette, designer handbag & shades!)
# ==============================================================================
def build_woman_chic():
    arm, head, body, top, bot, foot = load_clean_base()
    # Keep elegant knee-length tailored trench coat silhouette! Narrow shoulders & cinch waist!
    trim_coat_to_waist(top, hem_z=0.72, shoulder_scale=0.87, waist_taper=0.88, smooth_front=True)
    # Slimmer feminine trousers/leggings
    for v in bot.data.vertices:
        v.co.x *= 0.90
        v.co.y = (v.co.y + 0.01) * 0.92 - 0.01
    bot.data.update()

    m_coat = make_mat("Ped_Top", (0.72, 0.58, 0.43), rough=0.74) # Chic Geneva camel trench!
    m_pants = make_mat("Ped_Bottom", (0.12, 0.13, 0.16), rough=0.78)
    m_hair = make_mat("Ped_Hair", (0.34, 0.21, 0.12), rough=0.45) # Warm flowing chestnut hair!
    m_bag = make_mat("Ped_Accessory", (0.48, 0.12, 0.15), rough=0.35, clearcoat=0.4) # Burgundy leather designer tote!
    m_gold = make_mat("Ped_Gold", (0.88, 0.72, 0.34), rough=0.22, metal=0.92)
    m_shades = make_mat("Ped_Shades", (0.04, 0.03, 0.04), rough=0.05, metal=0.8, clearcoat=1.0)
    m_shoe = make_mat("Ped_Shoe", (0.14, 0.10, 0.09), rough=0.45)

    top.data.materials.clear(); top.data.materials.append(m_coat)
    bot.data.materials.clear(); bot.data.materials.append(m_pants)
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)
    add_scalp_hair(head, arm, m_hair, top_puff=0.022)

    # Long flowing wavy hair cascading cleanly over back & shoulders!
    bm_lh = bmesh.new()
    segs = 22
    rings = 7
    rows = []
    for ri in range(rings):
        tr = ri / (rings - 1)
        z = 1.76 - tr * 0.38
        # Gently sweeps outward past neck over back of shoulders!
        rx = 0.098 + tr * 0.052 + math.sin(tr * math.pi) * 0.018
        ry = 0.095 + tr * 0.025
        cy = 0.005 + tr * 0.055
        row = []
        for si in range(segs):
            # Wraps from right temple around back of head to left temple (open across face!)
            ang = -math.pi * 0.18 + (si / (segs - 1)) * (math.pi * 1.36)
            wave = math.sin(si * 1.6 + tr * 4.0) * 0.008 * tr
            row.append(bm_lh.verts.new((math.cos(ang) * (rx + wave), math.sin(ang) * (ry + wave) + cy, z)))
        rows.append(row)
    for ri in range(rings - 1):
        for si in range(segs - 1):
            bm_lh.faces.new((rows[ri][si], rows[ri][si + 1], rows[ri + 1][si + 1], rows[ri + 1][si]))
    bmesh.ops.solidify(bm_lh, geom=list(bm_lh.faces), thickness=0.024)
    bm_lh.normal_update()
    lh_mesh = bpy.data.meshes.new("LongHair_Mesh")
    bm_lh.to_mesh(lh_mesh); bm_lh.free()
    for p in lh_mesh.polygons: p.use_smooth = True
    lh_obj = bpy.data.objects.new("Ped_Hair_Long", lh_mesh)
    bpy.context.collection.objects.link(lh_obj)
    lh_obj.data.materials.append(m_hair)
    bind(lh_obj, arm, head.parent, {"Head": 0.72, "Spine2": 0.28})

    # Chic waist trench belt with gold buckle
    bpy.ops.mesh.primitive_torus_add(major_radius=0.155, minor_radius=0.016, major_segments=26, minor_segments=8, location=(0, -0.01, 1.07))
    belt = bpy.context.active_object; belt.scale = (1.02, 0.78, 1.5); bpy.ops.object.transform_apply(scale=True)
    belt.data.materials.append(m_coat); bind(belt, arm, top.parent, {"Spine": 0.6, "Hips": 0.4})

    # 3D Designer Tote Handbag carried in right hand!
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.44, -0.02, 0.80))
    bag = bpy.context.active_object; bag.name = "Ped_Handbag"; bag.scale = (0.11, 0.30, 0.24)
    bpy.ops.object.transform_apply(scale=True)
    b = bag.modifiers.new("Bevel", "BEVEL"); b.width = 0.022; b.segments = 2; bpy.ops.object.modifier_apply(modifier="Bevel")
    bag.data.materials.append(m_bag)
    for p in bag.data.polygons: p.use_smooth = True
    bind(bag, arm, top.parent, {"RightHand": 1.0})

    # Oversized luxury sunglasses
    for sx in (-0.036, 0.036):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.028, location=(sx, -0.118, 1.724))
        sh = bpy.context.active_object; sh.scale = (1.15, 0.35, 0.88); bpy.ops.object.transform_apply(scale=True)
        sh.data.materials.append(m_shades); bind(sh, arm, head.parent, {"Head": 1.0})

    export_ped("ped_woman_chic.glb")

# ==============================================================================
# 2. LAKEFRONT ATHLEISURE / JOGGER WOMAN (High bouncing ponytail, over-ear headphones, puffer vest & bright sneakers!)
# ==============================================================================
def build_woman_athleisure():
    arm, head, body, top, bot, foot = load_clean_base()
    trim_coat_to_waist(top, hem_z=1.03, shoulder_scale=0.88, waist_taper=0.88, smooth_front=True)
    for v in bot.data.vertices:
        v.co.x *= 0.89
        v.co.y = (v.co.y + 0.01) * 0.90 - 0.01
    bot.data.update()

    m_top = make_mat("Ped_Top", (0.86, 0.34, 0.38), rough=0.58) # Coral/rose athletic zip-hoodie!
    m_pants = make_mat("Ped_Bottom", (0.09, 0.10, 0.12), rough=0.68) # Sleek black yoga leggings
    m_hair = make_mat("Ped_Hair", (0.72, 0.54, 0.28), rough=0.46) # Honey blonde hair!
    m_hp = make_mat("Ped_Accessory", (0.92, 0.93, 0.95), rough=0.22, metal=0.35, clearcoat=0.8) # White wireless headphones!
    m_shoe = make_mat("Ped_Shoe", (0.92, 0.94, 0.95), rough=0.45)

    top.data.materials.clear(); top.data.materials.append(m_top)
    bot.data.materials.clear(); bot.data.materials.append(m_pants)
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)
    add_scalp_hair(head, arm, m_hair, top_puff=0.014)

    # Sculpted High Ponytail bouncing off the back crown!
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.036, location=(0, 0.095, 1.775))
    tie = bpy.context.active_object; tie.data.materials.append(m_pants); bind(tie, arm, head.parent, {"Head": 1.0})

    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.068, radius2=0.022, depth=0.30, location=(0, 0.142, 1.64), rotation=(-0.32, 0, 0))
    pony = bpy.context.active_object; pony.name = "Ped_Hair_Ponytail"; pony.scale = (0.78, 0.85, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    for p in pony.data.polygons: p.use_smooth = True
    pony.data.materials.append(m_hair); bind(pony, arm, head.parent, {"Head": 1.0})

    # Over-ear Wireless Headphones (arch + twin earcups!)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.108, minor_radius=0.013, major_segments=24, minor_segments=8, location=(0, -0.018, 1.74), rotation=(math.pi / 2, 0, 0))
    arch = bpy.context.active_object; arch.data.materials.append(m_hp); bind(arch, arm, head.parent, {"Head": 1.0})
    for sx in (-0.104, 0.104):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.036, depth=0.028, location=(sx, -0.022, 1.71), rotation=(0, math.pi / 2, 0))
        cup = bpy.context.active_object; cup.data.materials.append(m_hp); bind(cup, arm, head.parent, {"Head": 1.0})

    export_ped("ped_woman_athleisure.glb")

# ==============================================================================
# 3. GENEVA PRIVATE BANKER (Tailored navy suit, crisp white collar/tie, silver hair & dark leather briefcase!)
# ==============================================================================
def build_banker_suit():
    arm, head, body, top, bot, foot = load_clean_base()
    trim_coat_to_waist(top, hem_z=0.92, shoulder_scale=1.04, waist_taper=0.98, smooth_front=True)

    m_suit = make_mat("Ped_Top", (0.12, 0.17, 0.27), rough=0.72)
    m_pants = make_mat("Ped_Bottom", (0.11, 0.15, 0.24), rough=0.74)
    m_hair = make_mat("Ped_Hair", (0.48, 0.49, 0.52), rough=0.52) # Distinguished silver-grey hair!
    m_case = make_mat("Ped_Accessory", (0.18, 0.11, 0.08), rough=0.38, clearcoat=0.3) # Executive dark-brown leather briefcase!
    m_shoe = make_mat("Ped_Shoe", (0.12, 0.08, 0.06), rough=0.32)

    top.data.materials.clear(); top.data.materials.append(m_suit)
    bot.data.materials.clear(); bot.data.materials.append(m_pants)
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)
    add_scalp_hair(head, arm, m_hair, top_puff=0.015)

    # 3D Executive Leather Briefcase held in right hand!
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.46, -0.02, 0.77))
    bc = bpy.context.active_object; bc.name = "Ped_Briefcase"; bc.scale = (0.09, 0.42, 0.30)
    bpy.ops.object.transform_apply(scale=True)
    b = bc.modifiers.new("Bevel", "BEVEL"); b.width = 0.016; b.segments = 2; bpy.ops.object.modifier_apply(modifier="Bevel")
    bc.data.materials.append(m_case)
    for p in bc.data.polygons: p.use_smooth = True
    bind(bc, arm, top.parent, {"RightHand": 1.0})

    export_ped("ped_banker_suit.glb")

# ==============================================================================
# 4. YOUNG GENEVA STREETWEAR LOCAL (Backward baseball cap, oversized hoodie + 3D hood & urban backpack — GTA 6 Reference 1!)
# ==============================================================================
def build_streetwear():
    arm, head, body, top, bot, foot = load_clean_base()
    trim_coat_to_waist(top, hem_z=0.95, shoulder_scale=1.06, waist_taper=1.08, smooth_front=True)

    m_hoodie = make_mat("Ped_Top", (0.20, 0.42, 0.28), rough=0.86) # Forest green oversized streetwear hoodie!
    m_pants = make_mat("Ped_Bottom", (0.58, 0.52, 0.42), rough=0.84) # Khaki cargo pants!
    m_hair = make_mat("Ped_Hair", (0.10, 0.08, 0.06), rough=0.55)
    m_cap = make_mat("Ped_Cap", (0.14, 0.16, 0.20), rough=0.72)
    m_pack = make_mat("Ped_Accessory", (0.15, 0.17, 0.22), rough=0.68)
    m_shoe = make_mat("Ped_Shoe", (0.88, 0.89, 0.91), rough=0.48)

    top.data.materials.clear(); top.data.materials.append(m_hoodie)
    bot.data.materials.clear(); bot.data.materials.append(m_pants)
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)
    add_scalp_hair(head, arm, m_hair, top_puff=0.010)

    # Backward Streetwear Baseball Snapback Cap (crown + backward visor bill sticking out +Y!)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=0.108, location=(0, -0.016, 1.768))
    cap = bpy.context.active_object; cap.scale = (0.98, 1.08, 0.78); bpy.ops.object.transform_apply(scale=True)
    cap.data.materials.append(m_cap); bind(cap, arm, head.parent, {"Head": 1.0})
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0.115, 1.745), rotation=(0.12, 0, 0))
    bill = bpy.context.active_object; bill.scale = (0.155, 0.105, 0.014); bpy.ops.object.transform_apply(scale=True)
    b = bill.modifiers.new("Bevel", "BEVEL"); b.width = 0.005; b.segments = 2; bpy.ops.object.modifier_apply(modifier="Bevel")
    bill.data.materials.append(m_cap); bind(bill, arm, head.parent, {"Head": 1.0})

    # Draped 3D Hoodie Hood resting behind neck + Full 3D Urban Backpack!
    bpy.ops.mesh.primitive_torus_add(major_radius=0.125, minor_radius=0.045, major_segments=18, minor_segments=10, location=(0, 0.035, 1.50), rotation=(0.35, 0, 0))
    hood = bpy.context.active_object; hood.scale = (1.1, 1.15, 0.8); bpy.ops.object.transform_apply(scale=True)
    hood.data.materials.append(m_hoodie); bind(hood, arm, top.parent, {"Spine2": 1.0})

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.185, 1.27))
    bp = bpy.context.active_object; bp.name = "Ped_Backpack"; bp.scale = (0.28, 0.14, 0.38)
    bpy.ops.object.transform_apply(scale=True)
    b = bp.modifiers.new("Bevel", "BEVEL"); b.width = 0.04; b.segments = 3; bpy.ops.object.modifier_apply(modifier="Bevel")
    bp.data.materials.append(m_pack)
    for p in bp.data.polygons: p.use_smooth = True
    bind(bp, arm, top.parent, {"Spine1": 0.4, "Spine2": 0.6})

    export_ped("ped_streetwear.glb")

# ==============================================================================
# 5. GENEVA LAKEFRONT SUMMER TOURIST (Bucket/Sun hat, short-sleeve tee + casual shorts exposing skin + camera!)
# ==============================================================================
def build_tourist_summer():
    arm, head, body, top, bot, foot = load_clean_base()
    # Trim BOTH jacket below waist AND trim sleeves to short-sleeve t-shirt (|x| > 0.30)!
    bm = bmesh.new()
    bm.from_mesh(top.data)
    del_f = [
        f for f in bm.faces
        if (max(abs(v.co.x) for v in f.verts) < 0.24 and sum(v.co.z for v in f.verts) / len(f.verts) < 0.99)
        or (max(abs(v.co.x) for v in f.verts) > 0.30)
    ]
    if del_f: bmesh.ops.delete(bm, geom=del_f, context="FACES")
    bm.verts.ensure_lookup_table()
    fv = []
    for v in bm.verts:
        if abs(v.co.x) < 0.17 and v.co.y < -0.05 and v.co.z > 1.24:
            if v.co.y < -0.135: v.co.y = -0.135
            fv.append(v)
    for _ in range(5):
        bmesh.ops.smooth_vert(bm, verts=fv, factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    loose = [v for v in bm.verts if len(v.link_faces) == 0]
    if loose: bmesh.ops.delete(bm, geom=loose, context="VERTS")
    bm.normal_update(); bm.to_mesh(top.data); bm.free(); top.data.update()

    # Keep short-sleeve arms + skin calves by tinting lower pants below knee (z < 0.50) to warm skin tone (shorts look!)
    m_tee = make_mat("Ped_Top", (0.90, 0.88, 0.82), rough=0.84) # Crisp sunlit cream polo/tee!
    m_shorts = make_mat("Ped_Bottom", (0.24, 0.36, 0.52), rough=0.82) # Summer navy chino shorts!
    m_skin_leg = make_mat("Ped_SkinExt", (0.76, 0.58, 0.45), rough=0.68)
    m_hat = make_mat("Ped_Cap", (0.78, 0.72, 0.58), rough=0.82) # Sun bucket hat!
    m_cam = make_mat("Ped_Accessory", (0.10, 0.11, 0.13), rough=0.32, metal=0.7)
    m_shoe = make_mat("Ped_Shoe", (0.85, 0.85, 0.84), rough=0.55)

    top.data.materials.clear(); top.data.materials.append(m_tee)
    bot.data.materials.clear(); bot.data.materials.append(m_shorts); bot.data.materials.append(m_skin_leg)
    for poly in bot.data.polygons:
        az = sum(bot.data.vertices[vi].co.z for vi in poly.vertices) / len(poly.vertices)
        poly.material_index = 1 if az < 0.54 else 0
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)

    # Classic summer bucket sun hat
    bpy.ops.mesh.primitive_cylinder_add(vertices=22, radius=0.106, depth=0.11, location=(0, -0.015, 1.80))
    hc = bpy.context.active_object; hc.data.materials.append(m_hat); bind(hc, arm, head.parent, {"Head": 1.0})
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.168, radius2=0.106, depth=0.055, location=(0, -0.015, 1.748))
    hb = bpy.context.active_object; hb.data.materials.append(m_hat); bind(hb, arm, head.parent, {"Head": 1.0})

    # DSLR Tourist Camera slung on chest!
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.165, 1.24))
    cam_b = bpy.context.active_object; cam_b.scale = (0.13, 0.08, 0.09); bpy.ops.object.transform_apply(scale=True)
    cam_b.data.materials.append(m_cam); bind(cam_b, arm, top.parent, {"Spine2": 1.0})
    bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.032, depth=0.07, location=(0, -0.22, 1.24), rotation=(math.pi / 2, 0, 0))
    lens = bpy.context.active_object; lens.data.materials.append(m_cam); bind(lens, arm, top.parent, {"Spine2": 1.0})

    export_ped("ped_tourist_summer.glb")

# ==============================================================================
# 6. ALPINE PUFFER & BEANIE LOCAL (Ribbed Swiss knit beanie + puffy quilted jacket baffles + boots!)
# ==============================================================================
def build_puffer_tech():
    arm, head, body, top, bot, foot = load_clean_base()
    trim_coat_to_waist(top, hem_z=0.97, shoulder_scale=1.10, waist_taper=1.12, smooth_front=True)
    # Puff out torso & sleeves into distinct quilted Alpine down-jacket volume!
    for v in top.data.vertices:
        if v.co.z > 0.99 and v.co.z < 1.50:
            ripple = 1.0 + 0.055 * math.sin(v.co.z * 52.0)
            if abs(v.co.x) < 0.23:
                v.co.x *= 1.08 * ripple
                v.co.y = (v.co.y + 0.01) * (1.14 * ripple) - 0.01
    top.data.update()

    m_puf = make_mat("Ped_Top", (0.76, 0.56, 0.14), rough=0.42, clearcoat=0.28) # Bold Alpine mustard/ochre puffer!
    m_pants = make_mat("Ped_Bottom", (0.14, 0.15, 0.17), rough=0.78)
    m_beanie = make_mat("Ped_Cap", (0.58, 0.14, 0.16), rough=0.92) # Knit Swiss burgundy beanie!
    m_shoe = make_mat("Ped_Shoe", (0.36, 0.24, 0.14), rough=0.65) # Tan hiking/urban boots!

    top.data.materials.clear(); top.data.materials.append(m_puf)
    bot.data.materials.clear(); bot.data.materials.append(m_pants)
    foot.data.materials.clear(); foot.data.materials.append(m_shoe)

    # Knit Ribbed Beanie + Folded Cuff
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=0.112, location=(0, -0.008, 1.785))
    bn = bpy.context.active_object; bn.scale = (0.98, 1.12, 0.96); bpy.ops.object.transform_apply(scale=True)
    bn.data.materials.append(m_beanie); bind(bn, arm, head.parent, {"Head": 1.0})
    bpy.ops.mesh.primitive_torus_add(major_radius=0.104, minor_radius=0.022, major_segments=22, minor_segments=10, location=(0, -0.016, 1.752), rotation=(0.18, 0, 0))
    cuff = bpy.context.active_object; cuff.data.materials.append(m_beanie); bind(cuff, arm, head.parent, {"Head": 1.0})

    export_ped("ped_puffer_tech.glb")

build_woman_chic()
build_woman_athleisure()
build_banker_suit()
build_streetwear()
build_tourist_summer()
build_puffer_tech()
print("ALL 6 DIVERSE GENEVA CITIZEN ARCHETYPES EXPORTED!")
