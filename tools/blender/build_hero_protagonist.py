import bpy
import bmesh
import math
import os
from mathutils import Vector

SRC_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\rpm_human.glb"
OUT_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\protagonist_hero.glb"
PREVIEW_BACK = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\hero_preview_back.png"
PREVIEW_FRONT = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\hero_preview_front.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC_GLB)

# Remove Victorian hat/wig, handlebar mustache & stray Icosphere
for name in ["Wolf3D_Headwear", "Wolf3D_Beard", "Icosphere"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
head_obj = bpy.data.objects["Wolf3D_Head"]
top_obj = bpy.data.objects["Wolf3D_Outfit_Top"]
bot_obj = bpy.data.objects["Wolf3D_Outfit_Bottom"]
foot_obj = bpy.data.objects["Wolf3D_Outfit_Footwear"]

def bind_to_bones(obj, bone_weights):
    # Bake exact world/armature-space coordinates into mesh vertices so nothing ever shifts or drops on skinning!
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.parent = top_obj.parent
    obj.matrix_local = top_obj.matrix_local.copy()
    for bname, weight in bone_weights.items():
        vg = obj.vertex_groups.new(name=bname)
        vg.add(list(range(len(obj.data.vertices))), weight, "REPLACE")
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = armature

def make_pbr_mat(name, img=None, base_col=(0.15, 0.15, 0.15, 1.0), rough=0.55, metal=0.05, clearcoat=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs and clearcoat > 0:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    if img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.diffuse_color = base_col
    else:
        bsdf.inputs["Base Color"].default_value = base_col
        mat.diffuse_color = base_col
    return mat

def make_packed_image(name, w, h, fn):
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    px = [0.0] * (w * h * 4)
    for y in range(h):
        v = y / (h - 1)
        for x in range(w):
            u = x / (w - 1)
            r, g, b = fn(u, v, x, y)
            idx = (y * w + x) * 4
            px[idx] = max(0.0, min(1.0, r))
            px[idx + 1] = max(0.0, min(1.0, g))
            px[idx + 2] = max(0.0, min(1.0, b))
            px[idx + 3] = 1.0
    img.pixels.foreach_set(px)
    img.pack()
    return img

def h2(x, y):
    n = math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - math.floor(n)

# 1. Cleanly sculpt Wolf3D_Outfit_Top into a 360-degree razor-clean ZIPPED OBSIDIAN MOTO LEATHER JACKET!
#    Flatten the Victorian lapel rose & bow-tie vertices smoothly back onto the torso chest surface so ZERO bumps or holes remain!
bm = bmesh.new()
bm.from_mesh(top_obj.data)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

HEM_Z = 1.015
del_faces = [f for f in bm.faces if max(abs(v.co.x) for v in f.verts) < 0.24 and (sum(v.co.z for v in f.verts) / len(f.verts)) < HEM_Z]
if del_faces:
    bmesh.ops.delete(bm, geom=del_faces, context="FACES")

bm.verts.ensure_lookup_table()
front_smooth_verts = []
for v in bm.verts:
    if abs(v.co.x) < 0.24 and v.co.z < 1.13:
        if v.co.z < HEM_Z + 0.02:
            v.co.z = HEM_Z
        t = max(0.0, (1.13 - v.co.z) / (1.13 - HEM_Z))
        v.co.x *= 1.0 + 0.02 * t
        v.co.y = (v.co.y + 0.015) * (1.0 + 0.035 * t) - 0.015
    # Broad athletic moto-jacket shoulders
    if 1.35 < v.co.z < 1.52 and abs(v.co.x) > 0.13:
        v.co.x *= 1.06
        v.co.z += 0.008
    # Smoothly flatten out the Victorian bow-tie & lapel rose protrusions on the front chest (-Y) into a sleek modern chest!
    if abs(v.co.x) < 0.18 and v.co.y < -0.05 and v.co.z > 1.24:
        # Clamp extreme forward protrusion of bow-tie & rose cleanly onto smooth torso curve
        max_fwd = -0.140 if v.co.z < 1.44 else (-0.115 + (v.co.z - 1.44) * 0.45)
        if v.co.y < max_fwd:
            v.co.y = max_fwd
        front_smooth_verts.append(v)

# Apply 6 passes of Laplacian smooth ONLY to front upper chest/throat so bow-tie & rose melt into smooth leather!
for _ in range(6):
    bmesh.ops.smooth_vert(bm, verts=front_smooth_verts, factor=0.65, use_axis_x=True, use_axis_y=True, use_axis_z=True)

loose_v = [v for v in bm.verts if len(v.link_faces) == 0]
if loose_v:
    bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
bm.normal_update()
bm.to_mesh(top_obj.data)
bm.free()
top_obj.data.update()

# 2. High-detail packed PBR textures
def leather_tex(u, v, x, y):
    pebble = (math.sin(x * 1.9 + math.cos(y * 1.7)) * 0.015) + (h2(x, y) - 0.5) * 0.022
    quilt = 0.014 if (abs(((x + y) % 24) - 12) < 1.2 or abs(((x - y) % 24) - 12) < 1.2) else 0.0
    base = 0.095 + pebble - quilt * 0.35
    return (base, base * 1.03, base * 1.10)

def charcoal_denim_tex(u, v, x, y):
    twill = math.sin((x + y) * 1.8) * 0.018 + (h2(x, y) - 0.5) * 0.022
    fade = 1.0 + 0.16 * math.exp(-((v - 0.48) / 0.24) ** 2)
    return ((0.095 + twill) * fade, (0.108 + twill) * fade, (0.132 + twill) * fade)

def hair_tex(u, v, x, y):
    strand = math.sin(u * 240.0 + math.sin(v * 22.0) * 1.4) * 0.026 + (h2(x, y) - 0.5) * 0.018
    return (0.085 + strand, 0.062 + strand * 0.85, 0.045 + strand * 0.7)

img_leather = make_packed_image("HeroLeather", 256, 256, leather_tex)
img_denim = make_packed_image("HeroCharcoalDenim", 256, 256, charcoal_denim_tex)
img_hair = make_packed_image("HeroHair", 256, 256, hair_tex)

mat_leather = make_pbr_mat("Hero_LeatherBlack", img_leather, base_col=(0.10, 0.106, 0.118, 1.0), rough=0.35, metal=0.10, clearcoat=0.40)
mat_crimson = make_pbr_mat("Hero_CrimsonAccent", None, base_col=(0.78, 0.08, 0.11, 1.0), rough=0.32, metal=0.08, clearcoat=0.45)
mat_tee = make_pbr_mat("Hero_LayeredTee", None, base_col=(0.90, 0.89, 0.87, 1.0), rough=0.82, metal=0.0)
mat_rib = make_pbr_mat("Hero_RibHem", None, base_col=(0.055, 0.060, 0.068, 1.0), rough=0.82, metal=0.0)
mat_denim = make_pbr_mat("Hero_Denim", img_denim, base_col=(0.10, 0.11, 0.135, 1.0), rough=0.78, metal=0.02)
mat_metal = make_pbr_mat("Hero_SilverMetal", None, base_col=(0.86, 0.88, 0.92, 1.0), rough=0.15, metal=0.96)
mat_pack = make_pbr_mat("Hero_SlingPack", None, base_col=(0.14, 0.15, 0.175, 1.0), rough=0.56, metal=0.12)
mat_shades = make_pbr_mat("Hero_Sunglasses", None, base_col=(0.02, 0.028, 0.04, 1.0), rough=0.04, metal=0.88, clearcoat=1.0)
mat_hair = make_pbr_mat("Hero_HairMat", img_hair, base_col=(0.085, 0.062, 0.045, 1.0), rough=0.46, metal=0.04)

top_obj.data.materials.clear()
top_obj.data.materials.append(mat_leather)

# 3. Sleek Center Metallic Moto Zipper + Popped Biker Stand-Collar + Ribbed Waistband + Layered Crisp White Tee Hem!
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, -0.138, 1.245), rotation=(0.03, 0.0, 0.0))
zip_c = bpy.context.active_object
zip_c.name = "Hero_Center_Zipper"
zip_c.scale = (0.015, 0.014, 0.44)
bpy.ops.object.transform_apply(scale=True)
zip_c.data.materials.append(mat_metal)
bind_to_bones(zip_c, {"Spine1": 0.45, "Spine2": 0.55})

def add_waist_ring(name, z_lo, z_hi, rx0, ry0, mat, bone_mix):
    bm_r = bmesh.new()
    segs = 36
    rings = 4
    rows = []
    for ri in range(rings):
        tr = ri / (rings - 1)
        z = z_lo + tr * (z_hi - z_lo)
        bulge = 1.0 + 0.025 * math.sin(tr * math.pi)
        rx = rx0 * bulge
        ry = ry0 * bulge
        cy = -0.006
        row = [bm_r.verts.new((math.cos(si / segs * math.pi * 2) * rx, math.sin(si / segs * math.pi * 2) * ry + cy, z)) for si in range(segs)]
        rows.append(row)
    for ri in range(rings - 1):
        for si in range(segs):
            s2 = (si + 1) % segs
            bm_r.faces.new((rows[ri][si], rows[ri][s2], rows[ri + 1][s2], rows[ri + 1][si]))
    bmesh.ops.solidify(bm_r, geom=list(bm_r.faces), thickness=0.010)
    bm_r.normal_update()
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm_r.to_mesh(mesh)
    bm_r.free()
    for p in mesh.polygons: p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    bind_to_bones(obj, bone_mix)
    return obj

add_waist_ring("Hero_Jacket_Waistband", 0.985, 1.038, 0.184, 0.146, mat_rib, {"Hips": 0.45, "Spine": 0.55})
add_waist_ring("Hero_Layered_Tee_Hem", 0.942, 0.992, 0.174, 0.138, mat_tee, {"Hips": 0.72, "Spine": 0.28})

# Popped Moto Biker Stand-Collar wrapping cleanly around neck (completely covers throat collar!)
bm_col = bmesh.new()
segs = 32
c_rows = []
for z, r in [(1.465, 0.100), (1.515, 0.092), (1.558, 0.092)]:
    row = []
    for si in range(segs):
        ang = -math.pi * 0.42 + (si / (segs - 1)) * (math.pi * 1.84)
        row.append(bm_col.verts.new((math.cos(ang) * r, math.sin(ang) * r - 0.022, z)))
    c_rows.append(row)
for ri in range(len(c_rows) - 1):
    for si in range(segs - 1):
        bm_col.faces.new((c_rows[ri][si], c_rows[ri][si + 1], c_rows[ri + 1][si + 1], c_rows[ri + 1][si]))
bmesh.ops.solidify(bm_col, geom=list(bm_col.faces), thickness=0.015)
bm_col.normal_update()
col_mesh = bpy.data.meshes.new("Hero_Biker_Collar_Mesh")
bm_col.to_mesh(col_mesh)
bm_col.free()
for p in col_mesh.polygons: p.use_smooth = True
col_obj = bpy.data.objects.new("Hero_Biker_Collar", col_mesh)
bpy.context.collection.objects.link(col_obj)
col_obj.data.materials.append(mat_leather)
bind_to_bones(col_obj, {"Spine2": 0.75, "Neck": 0.25})

# 4. Sleek 3D Matte-Black Urban Crossbody Tactical Sling Pack (back) + Front Diagonal Strap + Silver Quick-Release Buckle!
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.03, 0.148, 1.23), rotation=(0.05, -0.26, 0.0))
pack = bpy.context.active_object
pack.name = "Hero_Sling_Pack"
pack.scale = (0.195, 0.088, 0.31)
bpy.ops.object.transform_apply(scale=True)
bev = pack.modifiers.new("Bevel", "BEVEL"); bev.width = 0.030; bev.segments = 3
bpy.ops.object.modifier_apply(modifier="Bevel")
pack.data.materials.append(mat_pack)
for p in pack.data.polygons: p.use_smooth = True
bind_to_bones(pack, {"Spine1": 0.45, "Spine2": 0.55})

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.038, 0.193, 1.295), rotation=(0.05, -0.26, 0.0))
zip_bar = bpy.context.active_object
zip_bar.name = "Hero_Pack_Accent"
zip_bar.scale = (0.145, 0.016, 0.022)
bpy.ops.object.transform_apply(scale=True)
zip_bar.data.materials.append(mat_crimson)
bind_to_bones(zip_bar, {"Spine1": 0.45, "Spine2": 0.55})

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.052, 0.128, 1.385), rotation=(0.24, -0.52, 0.0))
strap_b = bpy.context.active_object
strap_b.name = "Hero_Sling_StrapBack"
strap_b.scale = (0.048, 0.020, 0.30)
bpy.ops.object.transform_apply(scale=True)
strap_b.data.materials.append(mat_rib)
bind_to_bones(strap_b, {"Spine2": 1.0})

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-0.068, 0.138, 1.375), rotation=(0.24, -0.52, 0.0))
buckle = bpy.context.active_object
buckle.name = "Hero_Sling_Buckle"
buckle.scale = (0.058, 0.028, 0.048)
bpy.ops.object.transform_apply(scale=True)
b = buckle.modifiers.new("Bevel", "BEVEL"); b.width = 0.006; b.segments = 2
bpy.ops.object.modifier_apply(modifier="Bevel")
buckle.data.materials.append(mat_metal)
bind_to_bones(buckle, {"Spine2": 1.0})

# Clean front chest crossbody strap sitting flush outside zipped leather jacket!
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.00, -0.144, 1.26), rotation=(0.06, 0.56, 0.0))
strap_f = bpy.context.active_object
strap_f.name = "Hero_Sling_StrapFront"
strap_f.scale = (0.046, 0.016, 0.42)
bpy.ops.object.transform_apply(scale=True)
strap_f.data.materials.append(mat_rib)
bind_to_bones(strap_f, {"Spine1": 0.45, "Spine2": 0.55})

# 5. Brushed-Steel Swiss Luxury Chronograph Watch + Full Wrap-Around Wayfarer Shades
bpy.ops.mesh.primitive_torus_add(major_radius=0.042, minor_radius=0.010, major_segments=18, minor_segments=8,
                                 location=(0.415, -0.025, 1.065), rotation=(0.2, 0.95, 0.0))
watch = bpy.context.active_object
watch.name = "Hero_Swiss_Watch"
watch.data.materials.append(mat_metal)
for p in watch.data.polygons: p.use_smooth = True
bind_to_bones(watch, {"LeftForeArm": 0.85, "LeftHand": 0.15})

for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.036, -0.118, 1.724), rotation=(0.04, 0.0, sx * -0.18))
    lens = bpy.context.active_object
    lens.name = f"Hero_Shade_{sx}"
    lens.scale = (0.056, 0.012, 0.036)
    bpy.ops.object.transform_apply(scale=True)
    b = lens.modifiers.new("Bevel", "BEVEL"); b.width = 0.006; b.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")
    lens.data.materials.append(mat_shades)
    bind_to_bones(lens, {"Head": 1.0})

    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.072, -0.068, 1.732), rotation=(0.0, 0.0, sx * -0.08))
    arm = bpy.context.active_object
    arm.name = f"Hero_Shade_Arm_{sx}"
    arm.scale = (0.009, 0.105, 0.011)
    bpy.ops.object.transform_apply(scale=True)
    arm.data.materials.append(mat_rib)
    bind_to_bones(arm, {"Head": 1.0})

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, -0.121, 1.739))
brow = bpy.context.active_object
brow.name = "Hero_Shade_Brow"
brow.scale = (0.132, 0.013, 0.010)
bpy.ops.object.transform_apply(scale=True)
brow.data.materials.append(mat_rib)
bind_to_bones(brow, {"Head": 1.0})

# 6. Sculpted Modern Tapered Fade + Layered Swept Quiff Haircut
hair_mesh = head_obj.data.copy()
hair_obj = bpy.data.objects.new("Hero_Hair", hair_mesh)
bpy.context.collection.objects.link(hair_obj)
hair_obj.parent = head_obj.parent
hair_obj.matrix_local = head_obj.matrix_local.copy()
for vg in head_obj.vertex_groups:
    hair_obj.vertex_groups.new(name=vg.name)
for mod in head_obj.modifiers:
    if mod.type == "ARMATURE":
        m = hair_obj.modifiers.new(name="Armature", type="ARMATURE")
        m.object = mod.object

bm_h = bmesh.new()
bm_h.from_mesh(hair_obj.data)
bmesh.ops.remove_doubles(bm_h, verts=bm_h.verts, dist=0.003)
bm_h.verts.ensure_lookup_table()
bm_h.faces.ensure_lookup_table()

keep_faces = set()
for f in bm_h.faces:
    c = f.calc_center_median()
    hairline_z = 1.762 - max(0.0, (c.y + 0.092)) * 0.88
    near_ear = abs(c.x) > 0.075 and (-0.078 < c.y < 0.014) and c.z < 1.748
    if c.z >= hairline_z and c.y > -0.112 and not near_ear:
        keep_faces.add(f)

del_hf = [f for f in bm_h.faces if f not in keep_faces]
bmesh.ops.delete(bm_h, geom=del_hf, context="FACES")
loose_hv = [v for v in bm_h.verts if len(v.link_faces) == 0]
if loose_hv:
    bmesh.ops.delete(bm_h, geom=loose_hv, context="VERTS")

bm_h.normal_update()
head_center = Vector((0.0, -0.02, 1.70))
for v in bm_h.verts:
    top_t = max(0.0, min(1.0, (v.co.z - 1.715) / 0.115))
    radial = (v.co - head_center).normalized()
    is_bound = any(e.is_boundary for e in v.link_edges)
    thick = 0.0035 if is_bound else (0.0055 + (top_t ** 1.4) * 0.020)
    v.co += radial * thick
    if v.co.z > 1.775:
        v.co.z += 0.010 * top_t
        v.co.x += 0.005 * top_t

non_b = [v for v in bm_h.verts if not any(e.is_boundary for e in v.link_edges)]
bmesh.ops.smooth_vert(bm_h, verts=non_b, factor=0.55, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bmesh.ops.solidify(bm_h, geom=list(bm_h.faces), thickness=0.006)
bm_h.normal_update()
bm_h.to_mesh(hair_obj.data)
bm_h.free()
hair_obj.data.update()
for p in hair_obj.data.polygons: p.use_smooth = True
hair_obj.data.materials.clear()
hair_obj.data.materials.append(mat_hair)

lock_specs = [
    (-0.042, -0.048, 1.832, 0.036, 0.088, 0.024, (0.22, 0.14, -0.28)),
    (-0.015, -0.056, 1.842, 0.040, 0.095, 0.026, (0.26, 0.06, -0.22)),
    ( 0.016, -0.050, 1.844, 0.042, 0.096, 0.026, (0.24, -0.05, -0.18)),
    ( 0.044, -0.038, 1.834, 0.036, 0.088, 0.024, (0.20, -0.16, -0.12)),
    (-0.010,  0.008, 1.840, 0.052, 0.086, 0.024, (-0.18, 0.04, -0.15)),
    ( 0.028,  0.014, 1.832, 0.046, 0.082, 0.022, (-0.22, -0.10, -0.10)),
]
for idx, (lx, ly, lz, sx, sy, sz, rot) in enumerate(lock_specs):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=1.0, location=(lx, ly, lz), rotation=rot)
    lk = bpy.context.active_object
    lk.name = f"Hero_Hair_Lock_{idx}"
    lk.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    lk.data.materials.append(mat_hair)
    for p in lk.data.polygons: p.use_smooth = True
    bind_to_bones(lk, {"Head": 1.0})

# 7. Charcoal Slim Moto Denim + Chicago Red/Black/White High-Top Sneakers
bot_obj.data.materials.clear()
bot_obj.data.materials.append(mat_denim)

mat_shoe_black = make_pbr_mat("Hero_ShoeBlack", None, base_col=(0.08, 0.085, 0.095, 1.0), rough=0.46, metal=0.05)
mat_shoe_red = make_pbr_mat("Hero_ShoeRed", None, base_col=(0.76, 0.08, 0.10, 1.0), rough=0.40, metal=0.06, clearcoat=0.28)
mat_shoe_white = make_pbr_mat("Hero_ShoeWhite", None, base_col=(0.90, 0.91, 0.92, 1.0), rough=0.46, metal=0.04)

foot_obj.data.materials.clear()
foot_obj.data.materials.append(mat_shoe_black)
foot_obj.data.materials.append(mat_shoe_red)
foot_obj.data.materials.append(mat_shoe_white)
for poly in foot_obj.data.polygons:
    vs = [foot_obj.data.vertices[vi].co for vi in poly.vertices]
    az = sum(v.z for v in vs) / len(vs)
    ay = sum(v.y for v in vs) / len(vs)
    if az < 0.036:
        poly.material_index = 2
    elif ay > 0.015 or az > 0.095:
        poly.material_index = 1
    else:
        poly.material_index = 0

os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_skins=True,
    export_all_influences=False,
)
print("EXPORTED CLEAN 360 HERO:", OUT_GLB, os.path.getsize(OUT_GLB))

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x = 512
scene.render.resolution_y = 640
cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
scene.collection.objects.link(cam)
scene.camera = cam

cam.location = Vector((0.78, 2.35, 1.30))
cam.rotation_euler = (Vector((0.0, -0.02, 1.02)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = PREVIEW_BACK
bpy.ops.render.render(write_still=True)

cam.location = Vector((-0.85, -2.35, 1.32))
cam.rotation_euler = (Vector((0.0, -0.02, 1.08)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = PREVIEW_FRONT
bpy.ops.render.render(write_still=True)
print("RENDERED CLEAN 360 HERO PREVIEWS!")
