import bpy
import bmesh
import math
import os
from mathutils import Vector

SRC_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\rpm_human.glb"
OUT_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\protagonist_hero.glb"
PREVIEW_FRONT = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\banker_preview_front.png"
PREVIEW_BACK = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\banker_preview_back.png"
PREVIEW_CLOSEUP = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\banker_preview_closeup.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC_GLB)

# Remove Victorian top-hat, handlebar mustache & stray Icosphere
for name in ["Wolf3D_Headwear", "Wolf3D_Beard", "Icosphere"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
head_obj = bpy.data.objects["Wolf3D_Head"]
top_obj = bpy.data.objects["Wolf3D_Outfit_Top"]
bot_obj = bpy.data.objects["Wolf3D_Outfit_Bottom"]
foot_obj = bpy.data.objects["Wolf3D_Outfit_Footwear"]

# Grab original high-resolution fabric / stitching normal maps so tailored creases & oxford seams stay hyper-realistic!
def find_normal_image(obj):
    for m in obj.data.materials:
        if m and m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image and ("-N" in n.image.name or "normal" in n.image.name.lower()):
                    return n.image
    return None

top_norm_img = find_normal_image(top_obj)
bot_norm_img = find_normal_image(bot_obj)
foot_norm_img = find_normal_image(foot_obj)

def h2(x, y):
    n = math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - math.floor(n)

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

def make_pbr_mat(name, img=None, norm_img=None, norm_strength=0.55, base_col=(0.1, 0.12, 0.18, 1.0), rough=0.55, metal=0.04, clearcoat=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs and clearcoat > 0:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    if "Sheen Weight" in bsdf.inputs and rough > 0.55 and metal < 0.1:
        bsdf.inputs["Sheen Weight"].default_value = 0.24
    if img:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        mat.diffuse_color = base_col
    else:
        bsdf.inputs["Base Color"].default_value = base_col
        mat.diffuse_color = base_col
    if norm_img:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = norm_img
        norm_img.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = norm_strength
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat

def bind_to_bones(obj, bone_weights):
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

def get_mesh_islands(bm):
    bm.faces.ensure_lookup_table()
    visited = set()
    islands = []
    for f in bm.faces:
        if f.index in visited:
            continue
        stack = [f]
        comp = []
        visited.add(f.index)
        while stack:
            cf = stack.pop()
            comp.append(cf)
            for e in cf.edges:
                for nf in e.link_faces:
                    if nf.index not in visited:
                        visited.add(nf.index)
                        stack.append(nf)
        islands.append(comp)
    return islands

# ==============================================================================
# 1. BESPOKE SAVILE ROW / RUE DU RHONE LUXURY FABRIC TEXTURES (512x512 packed!)
# ==============================================================================
def navy_pinstripe_wool_tex(u, v, x, y):
    # Authentic Savile Row Super-150s rich midnight-navy worsted wool + crisp silver-chalk pinstripe!
    twill = math.sin((x + y) * 1.45) * 0.008 + (h2(x, y) - 0.5) * 0.011
    stripe_dist = abs(((x % 16) - 8.0))
    stripe = max(0.0, 1.0 - stripe_dist / 1.15) * 0.072
    r = 0.068 + twill + stripe * 0.80
    g = 0.102 + twill + stripe * 0.88
    b = 0.184 + twill + stripe * 1.00
    return (r, g, b)

def navy_waistcoat_tex(u, v, x, y):
    # Rich tonal Savile Row waistcoat with subtle micro-herringbone weave (contrasts tastefully against jacket!)
    herring = math.sin((x if ((x // 8) % 2 == 0) else -x) * 1.35 + y * 1.35) * 0.010 + (h2(x, y) - 0.5) * 0.010
    return (0.086 + herring, 0.122 + herring, 0.212 + herring)

def lapel_silk_wool_tex(u, v, x, y):
    # Sleek midnight-navy silk-faced peak lapel with subtle fine sheen
    weave = math.sin((x - y) * 2.0) * 0.006 + (h2(x, y) - 0.5) * 0.007
    return (0.052 + weave, 0.078 + weave, 0.145 + weave)

def silk_tie_tex(u, v, x, y):
    # Deep Hermès Burgundy / Oxblood Jacquard Silk with classy diagonal woven repp stripe!
    diag = (x + y * 0.85) % 20
    rib = max(0.0, 1.0 - abs(diag - 10.0) / 1.4) * 0.075
    micro = math.sin((x - y) * 2.4) * 0.010
    r = 0.345 + micro + rib * 0.95
    g = 0.032 + micro * 0.4 + rib * 0.45
    b = 0.062 + micro * 0.5 + rib * 0.48
    return (r, g, b)

def poplin_shirt_tex(u, v, x, y):
    # Crisp snow-white Egyptian cotton poplin weave
    weave = (math.sin(x * 2.6) + math.sin(y * 2.6)) * 0.005 + (h2(x, y) - 0.5) * 0.007
    return (0.935 + weave, 0.948 + weave, 0.968 + weave)

def black_calfskin_tex(u, v, x, y):
    # Mirror-shined Italian black calfskin leather micro-grain (for oxfords & dress belt!)
    grain = (h2(x, y) - 0.5) * 0.012 + math.sin(x * 1.7 + y * 1.3) * 0.005
    return (0.036 + grain, 0.037 + grain, 0.044 + grain)

def mahogany_sole_tex(u, v, x, y):
    # Goodyear-welted stacked mahogany leather dress shoe sole
    grain = (h2(x, y) - 0.5) * 0.015
    return (0.14 + grain, 0.068 + grain * 0.7, 0.038 + grain * 0.5)

def exec_hair_tex(u, v, x, y):
    # Warm rich espresso-chestnut executive side-part hair strands
    strand = math.sin(u * 260.0 + math.sin(v * 18.0) * 1.1) * 0.026 + (h2(x, y) - 0.5) * 0.014
    return (0.105 + strand, 0.070 + strand * 0.82, 0.048 + strand * 0.68)

img_suit_wool = make_packed_image("BankerSuitNavyPinstripe", 512, 512, navy_pinstripe_wool_tex)
img_vest_wool = make_packed_image("BankerWaistcoatNavy", 256, 256, navy_waistcoat_tex)
img_lapel = make_packed_image("BankerLapelNavy", 256, 256, lapel_silk_wool_tex)
img_silk_tie = make_packed_image("BankerBurgundySilkTie", 256, 256, silk_tie_tex)
img_shirt = make_packed_image("BankerCrispWhitePoplin", 256, 256, poplin_shirt_tex)
img_calfskin = make_packed_image("BankerItalianCalfskin", 128, 128, black_calfskin_tex)
img_sole = make_packed_image("BankerMahoganySole", 128, 128, mahogany_sole_tex)
img_hair = make_packed_image("BankerExecHair", 256, 256, exec_hair_tex)

# Bespoke Luxury Materials (preserving original ReadyPlayerMe tailored seam/fold normal maps!)
mat_suit_top = make_pbr_mat("Banker_SuitJacket", img_suit_wool, top_norm_img, 0.55, (0.075, 0.11, 0.195, 1.0), rough=0.72, metal=0.02)
mat_lapel = make_pbr_mat("Banker_SatinLapel", img_lapel, top_norm_img, 0.42, (0.055, 0.082, 0.15, 1.0), rough=0.44, metal=0.05, clearcoat=0.18)
mat_waistcoat = make_pbr_mat("Banker_Waistcoat", img_vest_wool, top_norm_img, 0.52, (0.088, 0.125, 0.215, 1.0), rough=0.68, metal=0.03)
mat_shirt = make_pbr_mat("Banker_CrispShirt", img_shirt, top_norm_img, 0.32, (0.94, 0.95, 0.97, 1.0), rough=0.60, metal=0.0)
mat_tie = make_pbr_mat("Banker_BurgundySilkTie", img_silk_tie, None, 0.0, (0.36, 0.035, 0.068, 1.0), rough=0.28, metal=0.06, clearcoat=0.26)
mat_pocket_sq = make_pbr_mat("Banker_WhitePocketSquare", None, None, 0.0, (0.97, 0.975, 0.99, 1.0), rough=0.36, metal=0.0)
mat_horn_btn = make_pbr_mat("Banker_HornButton", None, None, 0.0, (0.10, 0.072, 0.052, 1.0), rough=0.18, metal=0.14, clearcoat=0.65)
mat_gold = make_pbr_mat("Banker_18kGold", None, None, 0.0, (0.88, 0.72, 0.34, 1.0), rough=0.15, metal=0.96, clearcoat=0.35)
mat_watch_dial = make_pbr_mat("Banker_WatchSunburstDial", None, None, 0.0, (0.04, 0.11, 0.28, 1.0), rough=0.08, metal=0.65, clearcoat=1.0)
mat_watch_strap = make_pbr_mat("Banker_AlligatorStrap", None, None, 0.0, (0.085, 0.048, 0.030, 1.0), rough=0.30, metal=0.04, clearcoat=0.38)
mat_trousers = make_pbr_mat("Banker_SuitTrousers", img_suit_wool, bot_norm_img, 0.52, (0.075, 0.11, 0.195, 1.0), rough=0.72, metal=0.02)
mat_belt_leather = make_pbr_mat("Banker_ItalianBelt", img_calfskin, bot_norm_img, 0.25, (0.035, 0.036, 0.042, 1.0), rough=0.22, metal=0.06, clearcoat=0.45)
mat_socks = make_pbr_mat("Banker_DressSocks", None, None, 0.0, (0.055, 0.072, 0.115, 1.0), rough=0.82, metal=0.0)
mat_oxford_upper = make_pbr_mat("Banker_OxfordCalfskin", img_calfskin, foot_norm_img, 0.45, (0.035, 0.036, 0.042, 1.0), rough=0.14, metal=0.08, clearcoat=0.84)
mat_oxford_sole = make_pbr_mat("Banker_WeltLeatherSole", img_sole, foot_norm_img, 0.32, (0.14, 0.068, 0.038, 1.0), rough=0.42, metal=0.04)
mat_oxford_lace = make_pbr_mat("Banker_WaxedLaces", None, None, 0.0, (0.025, 0.025, 0.030, 1.0), rough=0.38, metal=0.02)
mat_shades_lens = make_pbr_mat("Banker_ShadesLens", None, None, 0.0, (0.020, 0.030, 0.044, 1.0), rough=0.03, metal=0.84, clearcoat=1.0)
mat_tortoise = make_pbr_mat("Banker_TortoiseFrame", None, None, 0.0, (0.11, 0.065, 0.038, 1.0), rough=0.18, metal=0.12, clearcoat=0.75)
mat_hair = make_pbr_mat("Banker_ExecHair", img_hair, None, 0.0, (0.105, 0.070, 0.048, 1.0), rough=0.40, metal=0.04)

# ==============================================================================
# 2. TAILOR Wolf3D_Outfit_Top INTO A SAVILE ROW 3-PIECE INVESTMENT BANKER SUIT!
# ==============================================================================
top_obj.data.materials.clear()
top_obj.data.materials.append(mat_suit_top)   # 0: Midnight-navy pinstripe jacket & sleeves
top_obj.data.materials.append(mat_lapel)      # 1: Sleeker midnight-navy silk-wool lapels
top_obj.data.materials.append(mat_waistcoat)  # 2: Bespoke 3-piece waistcoat
top_obj.data.materials.append(mat_shirt)      # 3: Crisp snow-white dress shirt & French cuffs
top_obj.data.materials.append(mat_horn_btn)   # 4: Polished dark horn buttons
top_obj.data.materials.append(mat_gold)       # 5: 18k brushed-gold cufflinks

bm = bmesh.new()
bm.from_mesh(top_obj.data)
uv_layer = bm.loops.layers.uv.active
islands = get_mesh_islands(bm)

faces_to_delete = []

for comp in islands:
    xs = [l.vert.co.x for f in comp for l in f.loops]
    ys = [l.vert.co.y for f in comp for l in f.loops]
    zs = [l.vert.co.z for f in comp for l in f.loops]
    us = [l[uv_layer].uv.x for f in comp for l in f.loops]
    vs = [l[uv_layer].uv.y for f in comp for l in f.loops]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)
    min_u, max_u = min(us), max(us)
    min_v, max_v = min(vs), max(vs)

    # A. DELETE Victorian red lapel rose
    if min_u > 0.24 and max_u < 0.42 and max_v < 0.38 and 1.35 < min_z < 1.48:
        faces_to_delete.extend(comp)
        continue
    # B. DELETE Victorian green rose leaves
    if min_u > 0.04 and max_u < 0.14 and min_v > 0.80 and max_v < 0.97 and min_z > 1.34:
        faces_to_delete.extend(comp)
        continue
    # C. DELETE Victorian bow-tie islands
    if min_z > 1.500 and max_z < 1.580 and max_y < -0.050 and min_u > 0.22 and max_u < 0.44 and min_v > 0.37 and max_v < 0.65:
        faces_to_delete.extend(comp)
        continue

    # D. ASSIGN BESPOKE MATERIALS BY ISLAND ANATOMY
    if (min_x > 0.41 or max_x < -0.41) and min_u > 0.74 and max_u < 0.79 and min_v > 0.87:
        for f in comp: f.material_index = 5  # 18k gold cufflinks!
    elif (min_x > 0.37 or max_x < -0.37) and min_u > 0.74 and min_v > 0.76:
        for f in comp: f.material_index = 3  # Crisp white French cuffs!
    elif max(abs(min_x), abs(max_x)) < 0.115 and (
        max_u < 0.125 or (min_u > 0.78 and min_v > 0.88) or (min_z > 1.56 and max_z < 1.63)
    ):
        for f in comp: f.material_index = 3  # Crisp white dress shirt & spread collar!
    elif min_u > 0.125 and max_u < 0.265 and max(abs(min_x), abs(max_x)) < 0.11:
        for f in comp: f.material_index = 2  # Bespoke 3-piece waistcoat!
    elif len(comp) == 64 and (max_x - min_x) < 0.035 and (max_z - min_z) < 0.035:
        for f in comp: f.material_index = 4  # Polished horn buttons!
    else:
        for f in comp:
            avg_u = sum(l[uv_layer].uv.x for l in f.loops) / len(f.loops)
            avg_v = sum(l[uv_layer].uv.y for l in f.loops) / len(f.loops)
            if avg_u > 0.815 and avg_v < 0.72 and f.calc_center_median().z > 1.15:
                f.material_index = 1  # Subtle silk-sheen peak lapels!
            else:
                f.material_index = 0  # Midnight-navy Savile Row pinstripe worsted wool!

if faces_to_delete:
    bmesh.ops.delete(bm, geom=faces_to_delete, context="FACES")

# Cleanly trim Victorian swallowtail back tails into a RAZOR-LEVEL modern Savile Row suit jacket hem (Z = 0.865m)!
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
TAIL_HEM_Z = 0.865
tail_del = []
for f in bm.faces:
    cz = sum(v.co.z for v in f.verts) / len(f.verts)
    mx = max(abs(v.co.x) for v in f.verts)
    if mx < 0.25 and cz < TAIL_HEM_Z - 0.008:
        tail_del.append(f)
if tail_del:
    bmesh.ops.delete(bm, geom=tail_del, context="FACES")

# Level ALL bottom hem vertices cleanly onto Z = TAIL_HEM_Z so back silhouette is 100% symmetrical & razor-straight!
bm.verts.ensure_lookup_table()
for v in bm.verts:
    if abs(v.co.x) < 0.25 and v.co.z < TAIL_HEM_Z + 0.042:
        is_bound = any(e.is_boundary for e in v.link_edges)
        if is_bound or v.co.z < TAIL_HEM_Z + 0.015:
            v.co.z = TAIL_HEM_Z
        v.co.x *= 1.035
        v.co.y = (v.co.y + 0.01) * 1.045 - 0.01
    # Crisp structured Savile Row roped shoulders
    if 1.38 < v.co.z < 1.54 and 0.14 < abs(v.co.x) < 0.24:
        t_sh = math.sin(min(1.0, (v.co.z - 1.38) / 0.16) * math.pi)
        v.co.x *= 1.0 + 0.045 * t_sh
        v.co.z += 0.006 * t_sh

loose_v = [v for v in bm.verts if len(v.link_faces) == 0]
if loose_v:
    bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
bm.normal_update()
bm.to_mesh(top_obj.data)
bm.free()
top_obj.data.update()

# ==============================================================================
# 3. TAILOR Wolf3D_Outfit_Bottom (Matching Navy Pinstripe Trousers + Black Italian Belt + 18k Gold Buckle!)
# ==============================================================================
bot_obj.data.materials.clear()
bot_obj.data.materials.append(mat_trousers)      # 0: Midnight-navy pinstripe dress trousers
bot_obj.data.materials.append(mat_belt_leather)  # 1: Black Italian calfskin belt
bot_obj.data.materials.append(mat_gold)          # 2: 18k brushed-gold belt buckle
bot_obj.data.materials.append(mat_socks)         # 3: Dark silk dress socks

bm_b = bmesh.new()
bm_b.from_mesh(bot_obj.data)
uv_b = bm_b.loops.layers.uv.active
for comp in get_mesh_islands(bm_b):
    zs = [l.vert.co.z for f in comp for l in f.loops]
    us = [l[uv_b].uv.x for f in comp for l in f.loops]
    vs = [l[uv_b].uv.y for f in comp for l in f.loops]
    min_z, max_z = min(zs), max(zs)
    min_u, max_u = min(us), max(us)
    min_v, max_v = min(vs), max(vs)
    if min_z > 1.00 and min_u > 0.45 and max_u < 0.54 and min_v > 0.10 and max_v < 0.60:
        for f in comp: f.material_index = 2
    elif min_z > 1.01 and min_v > 0.91:
        for f in comp: f.material_index = 1
    elif max_z < 0.14:
        for f in comp: f.material_index = 3
    else:
        for f in comp: f.material_index = 0

bm_b.normal_update()
bm_b.to_mesh(bot_obj.data)
bm_b.free()
bot_obj.data.update()

# ==============================================================================
# 4. POLISH Wolf3D_Outfit_Footwear (Mirror-Shined Black Italian Cap-Toe Oxfords + Mahogany Leather Soles!)
# ==============================================================================
foot_obj.data.materials.clear()
foot_obj.data.materials.append(mat_oxford_upper)  # 0: Mirror-shined black calfskin oxford upper
foot_obj.data.materials.append(mat_oxford_sole)   # 1: Dark mahogany Goodyear-welted leather sole & heel
foot_obj.data.materials.append(mat_oxford_lace)   # 2: Waxed black dress shoelaces
foot_obj.data.materials.append(mat_socks)         # 3: Dark silk dress socks

bm_f = bmesh.new()
bm_f.from_mesh(foot_obj.data)
for comp in get_mesh_islands(bm_f):
    zs = [l.vert.co.z for f in comp for l in f.loops]
    min_z, max_z = min(zs), max(zs)
    if max_z < 0.042:
        for f in comp: f.material_index = 1
    elif len(comp) == 40 and min_z > 0.08:
        for f in comp: f.material_index = 2
    elif len(comp) == 20 and min_z > 0.09:
        for f in comp: f.material_index = 3
    else:
        for f in comp: f.material_index = 0

bm_f.normal_update()
bm_f.to_mesh(foot_obj.data)
bm_f.free()
foot_obj.data.update()

# ==============================================================================
# 5. BESPOKE 3D SCULPTED INVESTMENT BANKER ACCESSORIES!
# ==============================================================================

# 5A. Sculpted Full-Windsor Burgundy Silk Tie (snugly nested under spread collar & tucked 100% cleanly behind waistcoat V!)
bm_tie = bmesh.new()
knot_rings = [
    (1.564, 0.023, -0.066, -0.080),  # snug right under collar fold!
    (1.548, 0.025, -0.072, -0.091),  # full Windsor knot brow
    (1.530, 0.017, -0.077, -0.093),  # tapered knot base
    (1.516, 0.013, -0.082, -0.095),  # crisp silk dimple pinch
]
blade_rings = [
    (1.495, 0.022, -0.092, -0.104),
    (1.464, 0.028, -0.107, -0.118),
    (1.430, 0.031, -0.122, -0.132),
    (1.396, 0.031, -0.128, -0.136),  # hugs shirt chest smoothly right above vest V!
    (1.366, 0.024, -0.122, -0.129),  # tucks cleanly BEHIND waistcoat V-neck (ZERO poke-through!)
    (1.340, 0.016, -0.116, -0.122),
]
all_rings = knot_rings + blade_rings
ring_verts = []
for z, hw, y_back, y_front in all_rings:
    y_mid = (y_back + y_front) * 0.5
    pts = [
        (-hw, y_mid, z),
        (-hw * 0.55, y_front - 0.0018, z),
        (0.0, y_front + 0.0012, z),
        (hw * 0.55, y_front - 0.0018, z),
        (hw, y_mid, z),
        (0.0, y_back, z),
    ]
    ring_verts.append([bm_tie.verts.new(p) for p in pts])

for ri in range(len(ring_verts) - 1):
    r0, r1 = ring_verts[ri], ring_verts[ri + 1]
    for si in range(len(r0)):
        s2 = (si + 1) % len(r0)
        bm_tie.faces.new((r0[si], r0[s2], r1[s2], r1[si]))
bm_tie.faces.new(ring_verts[0])
bm_tie.faces.new(list(reversed(ring_verts[-1])))
bm_tie.normal_update()

uv_t = bm_tie.loops.layers.uv.verify()
for f in bm_tie.faces:
    for l in f.loops:
        l[uv_t].uv = ((l.vert.co.x + 0.05) * 6.0, (l.vert.co.z - 1.32) * 3.5)

tie_mesh = bpy.data.meshes.new("Banker_SilkTie_Mesh")
bm_tie.to_mesh(tie_mesh)
bm_tie.free()
for p in tie_mesh.polygons: p.use_smooth = True
tie_obj = bpy.data.objects.new("Banker_SilkTie", tie_mesh)
bpy.context.collection.objects.link(tie_obj)
tie_obj.data.materials.append(mat_tie)
bind_to_bones(tie_obj, {"Spine2": 0.85, "Neck": 0.15})

# 18k Brushed-Gold Tie Bar clipped neatly across silk tie!
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.003, -0.134, 1.422), rotation=(0.28, 0.0, 0.0))
tie_bar = bpy.context.active_object
tie_bar.name = "Banker_GoldTieBar"
tie_bar.scale = (0.044, 0.0055, 0.0068)
bpy.ops.object.transform_apply(scale=True)
bev = tie_bar.modifiers.new("Bevel", "BEVEL"); bev.width = 0.0016; bev.segments = 2
bpy.ops.object.modifier_apply(modifier="Bevel")
tie_bar.data.materials.append(mat_gold)
bind_to_bones(tie_bar, {"Spine2": 1.0})

# 5B. Crisp White Presidential Folded Silk Pocket Square + Tailored Breast Welt Pocket (Left Chest = +X)
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.114, -0.123, 1.385), rotation=(0.18, 0.06, -0.34))
psq = bpy.context.active_object
psq.name = "Banker_PocketSquare"
psq.scale = (0.056, 0.008, 0.022)
bpy.ops.object.transform_apply(scale=True)
bev = psq.modifiers.new("Bevel", "BEVEL"); bev.width = 0.002; bev.segments = 2
bpy.ops.object.modifier_apply(modifier="Bevel")
psq.data.materials.append(mat_pocket_sq)
bind_to_bones(psq, {"Spine2": 1.0})

bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.116, -0.126, 1.374), rotation=(0.18, 0.06, -0.34))
welt = bpy.context.active_object
welt.name = "Banker_BreastWelt"
welt.scale = (0.068, 0.010, 0.012)
bpy.ops.object.transform_apply(scale=True)
welt.data.materials.append(mat_lapel)
bind_to_bones(welt, {"Spine2": 1.0})

# 5C. 18k Rose-Gold Geneva Luxury Dress Watch tucked cleanly right at Left Wrist Bone (+X)!
bpy.ops.mesh.primitive_torus_add(
    major_radius=0.032, minor_radius=0.0055, major_segments=20, minor_segments=8,
    location=(0.440, -0.024, 1.045), rotation=(0.20, 0.92, 0.0)
)
w_strap = bpy.context.active_object
w_strap.name = "Banker_WatchStrap"
w_strap.data.materials.append(mat_watch_strap)
for p in w_strap.data.polygons: p.use_smooth = True
bind_to_bones(w_strap, {"LeftForeArm": 0.85, "LeftHand": 0.15})

bpy.ops.mesh.primitive_cylinder_add(
    vertices=20, radius=0.017, depth=0.008,
    location=(0.447, -0.051, 1.059), rotation=(1.35, 0.35, -0.45)
)
w_case = bpy.context.active_object
w_case.name = "Banker_GoldWatchCase"
w_case.data.materials.append(mat_gold)
for p in w_case.data.polygons: p.use_smooth = True
bind_to_bones(w_case, {"LeftForeArm": 0.85, "LeftHand": 0.15})

bpy.ops.mesh.primitive_cylinder_add(
    vertices=20, radius=0.014, depth=0.0086,
    location=(0.447, -0.051, 1.059), rotation=(1.35, 0.35, -0.45)
)
w_dial = bpy.context.active_object
w_dial.name = "Banker_WatchDial"
w_dial.data.materials.append(mat_watch_dial)
for p in w_dial.data.polygons: p.use_smooth = True
bind_to_bones(w_dial, {"LeftForeArm": 0.85, "LeftHand": 0.15})

# 5D. Ultra-Classy Persol / Clubmaster Tortoiseshell & Brushed-Gold Executive Sunglasses!
for sx in (-1, 1):
    # Softly contoured dark smoked polarized lens
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.0335, -0.111, 1.721), rotation=(0.04, 0.0, sx * -0.14))
    lens = bpy.context.active_object
    lens.name = f"Banker_ShadeLens_{sx}"
    lens.scale = (0.049, 0.006, 0.031)
    bpy.ops.object.transform_apply(scale=True)
    b = lens.modifiers.new("Bevel", "BEVEL"); b.width = 0.0095; b.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")
    lens.data.materials.append(mat_shades_lens)
    for p in lens.data.polygons: p.use_smooth = True
    bind_to_bones(lens, {"Head": 1.0})

    # Delicate lower brushed-gold rim hugging lens cleanly
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.0335, -0.1095, 1.7205), rotation=(0.04, 0.0, sx * -0.14))
    rim = bpy.context.active_object
    rim.name = f"Banker_ShadeRim_{sx}"
    rim.scale = (0.0525, 0.005, 0.034)
    bpy.ops.object.transform_apply(scale=True)
    b = rim.modifiers.new("Bevel", "BEVEL"); b.width = 0.010; b.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")
    rim.data.materials.append(mat_gold)
    for p in rim.data.polygons: p.use_smooth = True
    bind_to_bones(rim, {"Head": 1.0})

    # Clubmaster dark-tortoiseshell upper brow line (ultra-classy Geneva banker vibe!)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.0345, -0.1115, 1.7375), rotation=(0.04, 0.0, sx * -0.14))
    brow_c = bpy.context.active_object
    brow_c.name = f"Banker_ShadeBrow_{sx}"
    brow_c.scale = (0.053, 0.0075, 0.0065)
    bpy.ops.object.transform_apply(scale=True)
    b = brow_c.modifiers.new("Bevel", "BEVEL"); b.width = 0.0022; b.segments = 2
    bpy.ops.object.modifier_apply(modifier="Bevel")
    brow_c.data.materials.append(mat_tortoise)
    for p in brow_c.data.polygons: p.use_smooth = True
    bind_to_bones(brow_c, {"Head": 1.0})

    # Ultra-slim brushed-gold temple arm tapering cleanly to ear
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(sx * 0.068, -0.062, 1.731), rotation=(0.02, 0.0, sx * -0.09))
    arm = bpy.context.active_object
    arm.name = f"Banker_ShadeTemple_{sx}"
    arm.scale = (0.004, 0.104, 0.0042)
    bpy.ops.object.transform_apply(scale=True)
    arm.data.materials.append(mat_gold)
    bind_to_bones(arm, {"Head": 1.0})

# Refined curved brushed-gold nose bridge cleanly joining both Clubmaster lenses!
bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, -0.1155, 1.727))
bridge = bpy.context.active_object
bridge.name = "Banker_ShadeBridge"
bridge.scale = (0.028, 0.0055, 0.0042)
bpy.ops.object.transform_apply(scale=True)
bridge.data.materials.append(mat_gold)
bind_to_bones(bridge, {"Head": 1.0})

# 5E. Classy Gentleman's Executive Side-Part Haircut (100% Solid Tapered Back/Sides + Sleek Swept Crown, ZERO scalp poke-through!)
hair_mesh = head_obj.data.copy()
hair_obj = bpy.data.objects.new("Banker_ExecHair_Base", hair_mesh)
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
    # Full tapered gentleman's scissor cut down back of head & temples, neat clearance around ears
    hairline_z = 1.766 - max(0.0, (c.y + 0.092)) * 0.98
    near_ear = abs(c.x) > 0.075 and (-0.072 < c.y < 0.012) and c.z < 1.744
    if c.z >= hairline_z and c.y > -0.106 and not near_ear:
        keep_faces.add(f)

del_hf = [f for f in bm_h.faces if f not in keep_faces]
bmesh.ops.delete(bm_h, geom=del_hf, context="FACES")
loose_hv = [v for v in bm_h.verts if len(v.link_faces) == 0]
if loose_hv:
    bmesh.ops.delete(bm_h, geom=loose_hv, context="VERTS")

bm_h.normal_update()
head_center = Vector((0.0, -0.018, 1.705))
# Record every vertex's exact original skull radius BEFORE smoothing so smoothing can NEVER sink hair inside the scalp!
orig_radii = {v: (v.co - head_center).length for v in bm_h.verts}

# Gentle hairline polish (only 1 pass) then enforce strict outward clearance above the skull!
bound_v = [v for v in bm_h.verts if any(e.is_boundary for e in v.link_edges)]
bmesh.ops.smooth_vert(bm_h, verts=bound_v, factor=0.35, use_axis_x=True, use_axis_y=False, use_axis_z=True)

for v in bm_h.verts:
    top_t = max(0.0, min(1.0, (v.co.z - 1.720) / 0.110))
    vec = v.co - head_center
    cur_r = vec.length
    radial = vec / max(1e-5, cur_r)
    is_bound = any(e.is_boundary for e in v.link_edges)
    part_groove = math.exp(-((v.co.x - 0.036) / 0.014) ** 2) * top_t * (1.0 if v.co.y < 0.04 else 0.25)
    sweep_boost = max(0.0, (0.036 - v.co.x) / 0.095) * 0.008 * top_t
    # Strict positive outward clearance everywhere (6.5mm tapered back/sides -> 20mm sculpted crown!)
    min_clear = 0.0052 if is_bound else (0.0085 + (top_t ** 1.25) * 0.014 + sweep_boost - part_groove * 0.004)
    target_r = max(cur_r, orig_radii[v]) + min_clear
    v.co = head_center + radial * target_r
    if v.co.z > 1.770:
        v.co.z += 0.006 * top_t - part_groove * 0.003
        v.co.y += 0.003 * top_t

non_b = [v for v in bm_h.verts if not any(e.is_boundary for e in v.link_edges)]
bmesh.ops.smooth_vert(bm_h, verts=non_b, factor=0.40, use_axis_x=True, use_axis_y=True, use_axis_z=True)
# Re-enforce minimum skull clearance after interior smooth so ZERO scalp ever pokes through!
for v in bm_h.verts:
    vec = v.co - head_center
    r_now = vec.length
    min_r = orig_radii[v] + 0.0055
    if r_now < min_r and r_now > 1e-5:
        v.co = head_center + (vec / r_now) * min_r

bmesh.ops.solidify(bm_h, geom=list(bm_h.faces), thickness=0.0055)
bm_h.normal_update()
bm_h.to_mesh(hair_obj.data)
bm_h.free()
hair_obj.data.update()
for p in hair_obj.data.polygons: p.use_smooth = True
hair_obj.data.materials.clear()
hair_obj.data.materials.append(mat_hair)

# Sleek contoured executive side-swept top crown (tucked cleanly inside silhouette — ZERO sticking-out horns!)
sweep_specs = [
    (-0.006, -0.018, 1.816, 0.062, 0.088, 0.020, (0.10, 0.10, 0.12)),
    (-0.028, -0.010, 1.808, 0.046, 0.080, 0.018, (0.08, 0.22, 0.08)),
    ( 0.046, -0.010, 1.804, 0.028, 0.072, 0.015, (0.08, -0.26, -0.06)),
    (-0.002,  0.022, 1.810, 0.060, 0.072, 0.018, (-0.18, 0.04, 0.04)),
]
for idx, (lx, ly, lz, sx, sy, sz, rot) in enumerate(sweep_specs):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=1.0, location=(lx, ly, lz), rotation=rot)
    lk = bpy.context.active_object
    lk.name = f"Banker_HairSweep_{idx}"
    lk.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    lk.data.materials.append(mat_hair)
    for p in lk.data.polygons: p.use_smooth = True
    bind_to_bones(lk, {"Head": 1.0})

# ==============================================================================
# 6. EXPORT CLEAN 360-DEGREE SKINNED GENEVA INVESTMENT BANKER HERO GLB!
# ==============================================================================
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
print("EXPORTED POLISHED GENEVA INVESTMENT BANKER:", OUT_GLB, os.path.getsize(OUT_GLB))

# ==============================================================================
# 7. RENDER FULL-BODY FRONT, BACK & CHEST/HEAD CLOSE-UP STUDIO PREVIEWS!
# ==============================================================================
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = 512
scene.render.resolution_y = 640
cam = bpy.data.objects.new("PreviewCam", bpy.data.cameras.new("PreviewCam"))
scene.collection.objects.link(cam)
scene.camera = cam

# Full-body Front 3/4 (head to polished oxfords!)
cam.location = Vector((-0.78, -2.65, 1.10))
cam.rotation_euler = (Vector((0.0, -0.02, 0.94)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = PREVIEW_FRONT
bpy.ops.render.render(write_still=True)

# Full-body Back 3/4 (matches 3rd-person game camera!)
cam.location = Vector((0.78, 2.65, 1.10))
cam.rotation_euler = (Vector((0.0, -0.02, 0.94)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = PREVIEW_BACK
bpy.ops.render.render(write_still=True)

# Tight Front Close-up (side-part hair, Clubmaster gold shades, Windsor burgundy silk tie, gold tie bar, pocket square, 3-piece waistcoat!)
cam.location = Vector((-0.24, -1.08, 1.56))
cam.rotation_euler = (Vector((0.0, -0.05, 1.48)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.render.filepath = PREVIEW_CLOSEUP
bpy.ops.render.render(write_still=True)

print("RENDERED POLISHED BANKER PREVIEWS!")
