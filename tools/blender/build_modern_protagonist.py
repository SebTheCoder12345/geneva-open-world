import bpy
import bmesh
import math
import os
from mathutils import Vector

SRC_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\rpm_human.glb"
OUT_GLB = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\protagonist_modern.glb"
PREVIEW_IMG = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\protagonist_preview.png"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC_GLB)

# 1. Remove Victorian hat/wig (Wolf3D_Headwear) and stray Icosphere!
for name in ["Wolf3D_Headwear", "Icosphere"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

armature = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
head_obj = bpy.data.objects["Wolf3D_Head"]
top_obj = bpy.data.objects["Wolf3D_Outfit_Top"]
bot_obj = bpy.data.objects["Wolf3D_Outfit_Bottom"]
foot_obj = bpy.data.objects["Wolf3D_Outfit_Footwear"]

# 2. Cleanly convert Victorian swallow-tail coat (Wolf3D_Outfit_Top) into a sleek modern waist-length bomber jacket!
bpy.context.view_layer.objects.active = top_obj
bm = bmesh.new()
bm.from_mesh(top_obj.data)
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# Cut cleanly above the swallow-tail back vent so ZERO coat-tail notch remains!
HEM_Z = 1.005
faces_to_del = []
for f in bm.faces:
    xs = [v.co.x for v in f.verts]
    zs = [v.co.z for v in f.verts]
    if max(abs(x) for x in xs) < 0.24 and (sum(zs) / len(zs)) < HEM_Z:
        faces_to_del.append(f)

if faces_to_del:
    bmesh.ops.delete(bm, geom=faces_to_del, context="FACES")

bm.verts.ensure_lookup_table()
# Smoothly level the jacket hem and keep a crisp tailored boxy-athletic silhouette over the waist
for v in bm.verts:
    if abs(v.co.x) < 0.24 and v.co.z < 1.12:
        if v.co.z < HEM_Z + 0.02:
            v.co.z = HEM_Z
        # Gently flare hem out slightly so it cleanly clears the top of the jeans without poking!
        t = max(0.0, (1.12 - v.co.z) / (1.12 - HEM_Z))
        dx = v.co.x
        dy = v.co.y + 0.015
        v.co.x = dx * (1.0 + 0.025 * t)
        v.co.y = dy * (1.0 + 0.04 * t) - 0.015
    if 1.36 < v.co.z < 1.50 and abs(v.co.x) > 0.14:
        v.co.x *= 1.035

loose_verts = [v for v in bm.verts if len(v.link_faces) == 0]
if loose_verts:
    bmesh.ops.delete(bm, geom=loose_verts, context="VERTS")

bm.normal_update()
bm.to_mesh(top_obj.data)
bm.free()
top_obj.data.update()

# Add a smooth, clean, anatomically tailored 3D ribbed bomber waistband ring (z = 0.962..1.028)
# Completely smooth oval ellipse around the waist — ZERO glute seam!
bm_band = bmesh.new()
segs = 36
rings = 5
z_lo, z_hi = 0.958, 1.028
ring_verts = []
for ri in range(rings):
    tr = ri / (rings - 1)
    z = z_lo + tr * (z_hi - z_lo)
    # Slight realistic elastic bomber tuck at bottom edge, smooth overlap into jacket at top
    bulge = 1.0 + 0.03 * math.sin(tr * math.pi)
    rx = (0.178 + 0.008 * tr) * bulge
    ry = (0.144 + 0.008 * tr) * bulge
    cy = -0.006 - 0.004 * tr
    row = []
    for si in range(segs):
        ang = (si / segs) * math.pi * 2.0
        x = math.cos(ang) * rx
        y = math.sin(ang) * ry + cy
        row.append(bm_band.verts.new((x, y, z)))
    ring_verts.append(row)

for ri in range(rings - 1):
    for si in range(segs):
        si2 = (si + 1) % segs
        bm_band.faces.new((
            ring_verts[ri][si],
            ring_verts[ri][si2],
            ring_verts[ri + 1][si2],
            ring_verts[ri + 1][si],
        ))

bmesh.ops.solidify(bm_band, geom=list(bm_band.faces), thickness=0.012)
bm_band.normal_update()
band_mesh = bpy.data.meshes.new("Modern_Jacket_Waistband_Mesh")
bm_band.to_mesh(band_mesh)
bm_band.free()
for poly in band_mesh.polygons:
    poly.use_smooth = True

band_obj = bpy.data.objects.new("Modern_Jacket_Waistband", band_mesh)
bpy.context.collection.objects.link(band_obj)
band_obj.parent = top_obj.parent
band_obj.matrix_local = top_obj.matrix_local.copy()
# Skin cleanly to Hips (0.55) + Spine (0.45) for buttery natural bending during sprint/scooter riding!
vg_hips = band_obj.vertex_groups.new(name="Hips")
vg_spine = band_obj.vertex_groups.new(name="Spine")
for v in band_mesh.vertices:
    t = max(0.0, min(1.0, (v.co.z - z_lo) / (z_hi - z_lo)))
    vg_hips.add([v.index], 1.0 - t * 0.65, "REPLACE")
    vg_spine.add([v.index], t * 0.65, "REPLACE")
arm_mod = band_obj.modifiers.new(name="Armature", type="ARMATURE")
arm_mod.object = armature

# 3. Sculpt a sleek, seamless, natural MODERN SHORT GTA HAIRCUT directly on Wolf3D_Head's cranium!
# (Zero center-seam groove — smooth continuous scalp crown with subtle organic swept hair volume!)
hair_mesh = head_obj.data.copy()
hair_obj = bpy.data.objects.new("Modern_Hair", hair_mesh)
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
# Weld ReadyPlayerMe's split UV seam along x=0 so the back of the hair is 100% seamless!
bmesh.ops.remove_doubles(bm_h, verts=bm_h.verts, dist=0.003)
bm_h.verts.ensure_lookup_table()
bm_h.faces.ensure_lookup_table()

keep_faces = set()
for f in bm_h.faces:
    c = f.calc_center_median()
    # Natural modern hairline: above forehead (-Y), neat behind ears, clean tapered neckline at nape (+Y)
    hairline_z = 1.758 - max(0.0, (c.y + 0.092)) * 0.90
    near_ear = abs(c.x) > 0.077 and (-0.078 < c.y < 0.012) and c.z < 1.744
    if c.z >= hairline_z and c.y > -0.115 and not near_ear:
        keep_faces.add(f)

del_hf = [f for f in bm_h.faces if f not in keep_faces]
bmesh.ops.delete(bm_h, geom=del_hf, context="FACES")
loose_hv = [v for v in bm_h.verts if len(v.link_faces) == 0]
if loose_hv:
    bmesh.ops.delete(bm_h, geom=loose_hv, context="VERTS")

bm_h.normal_update()
# Smooth continuous swept crown volume (NO x=0 mirror seam!)
head_center = Vector((0.0, -0.02, 1.70))
for v in bm_h.verts:
    top_t = max(0.0, min(1.0, (v.co.z - 1.64) / 0.19))
    radial = (v.co - head_center).normalized()
    # Subtle asymmetric organic hair tufts (offset phase so ZERO vertical centerline seam!)
    tuft = (
        math.sin((v.co.x + 0.041) * 52.0 + v.co.y * 28.0) * 0.0022
        + math.cos((v.co.y - 0.023) * 48.0 - v.co.z * 34.0) * 0.0018
    )
    is_boundary = any(e.is_boundary for e in v.link_edges)
    # Tight crisp modern fade at nape/sides (5mm), fuller swept crown on top (22mm)
    thick = 0.0045 if is_boundary else (0.0075 + (top_t ** 1.35) * 0.017 + tuft * top_t)
    v.co += radial * thick
    # Stylish slight side-swept top lift (asymmetric natural modern haircut!)
    if v.co.z > 1.765:
        v.co.z += 0.009 * top_t
        v.co.x += 0.004 * top_t

# 2 gentle passes of Laplacian smooth to guarantee silky-smooth AAA silhouette with zero creases!
non_bound = [v for v in bm_h.verts if not any(e.is_boundary for e in v.link_edges)]
bmesh.ops.smooth_vert(bm_h, verts=non_bound, factor=0.55, use_axis_x=True, use_axis_y=True, use_axis_z=True)
bmesh.ops.smooth_vert(bm_h, verts=non_bound, factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)

bmesh.ops.solidify(bm_h, geom=list(bm_h.faces), thickness=0.006)
bm_h.normal_update()
bm_h.to_mesh(hair_obj.data)
bm_h.free()
hair_obj.data.update()

for poly in hair_obj.data.polygons:
    poly.use_smooth = True

# 4. Crisp packed PBR textures for Modern Tailored Jacket, Indigo Denim Jeans, Sneakers & Hair!
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

# Sleek modern tailored charcoal-slate field/bomber jacket (readable folds in sunlight AND night!)
def jacket_tex(u, v, x, y):
    weave = (math.sin(x * 1.35) * math.cos(y * 1.35)) * 0.016 + (h2(x, y) - 0.5) * 0.02
    r = 0.21 + weave
    g = 0.235 + weave
    b = 0.265 + weave
    if abs((u * 4.0) % 1.0 - 0.5) < 0.01:
        r *= 0.84; g *= 0.84; b *= 0.84
    return (r, g, b)

# Rich dark-indigo selvedge denim jeans
def denim_tex(u, v, x, y):
    twill = math.sin((x + y) * 1.65) * 0.022 + (h2(x, y) - 0.5) * 0.024
    fade = 1.0 + 0.14 * math.exp(-((v - 0.48) / 0.22) ** 2)
    r = (0.115 + twill) * fade
    g = (0.155 + twill) * fade
    b = (0.245 + twill) * fade
    return (r, g, b)

# Natural textured dark espresso-chestnut hair
def hair_tex(u, v, x, y):
    strand = math.sin(u * 220.0 + math.sin(v * 20.0) * 1.3) * 0.028 + (h2(x, y) - 0.5) * 0.02
    r = 0.12 + strand * 1.15
    g = 0.085 + strand * 0.9
    b = 0.058 + strand * 0.7
    return (r, g, b)

img_jacket = make_packed_image("JacketFabric", 256, 256, jacket_tex)
img_denim = make_packed_image("DenimJeans", 256, 256, denim_tex)
img_hair = make_packed_image("HairStrands", 256, 256, hair_tex)

def make_pbr_mat(name, img=None, base_col=(0.2, 0.2, 0.2, 1.0), rough=0.72, metal=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if img:
        tex_node = nt.nodes.new("ShaderNodeTexImage")
        tex_node.image = img
        nt.links.new(tex_node.outputs["Color"], bsdf.inputs["Base Color"])
        mat.diffuse_color = (0.25, 0.28, 0.32, 1.0)
    else:
        bsdf.inputs["Base Color"].default_value = base_col
        mat.diffuse_color = base_col
    return mat

mat_jacket = make_pbr_mat("Modern_Jacket", img_jacket, rough=0.74, metal=0.04)
mat_jacket.diffuse_color = (0.21, 0.235, 0.265, 1.0)
mat_rib = make_pbr_mat("Modern_RibHem", None, base_col=(0.11, 0.125, 0.145, 1.0), rough=0.86, metal=0.0)
mat_denim = make_pbr_mat("Modern_Denim", img_denim, rough=0.82, metal=0.0)
mat_denim.diffuse_color = (0.12, 0.16, 0.25, 1.0)
mat_sneaker_sole = make_pbr_mat("Modern_SneakerSole", None, base_col=(0.82, 0.83, 0.84, 1.0), rough=0.52, metal=0.04)
mat_sneaker_up = make_pbr_mat("Modern_SneakerUpper", None, base_col=(0.15, 0.16, 0.18, 1.0), rough=0.58, metal=0.04)
mat_hair = make_pbr_mat("Modern_HairMat", img_hair, rough=0.56, metal=0.02)
mat_hair.diffuse_color = (0.12, 0.085, 0.058, 1.0)

top_obj.data.materials.clear()
top_obj.data.materials.append(mat_jacket)

band_obj.data.materials.clear()
band_obj.data.materials.append(mat_rib)

bot_obj.data.materials.clear()
bot_obj.data.materials.append(mat_denim)

foot_obj.data.materials.clear()
foot_obj.data.materials.append(mat_sneaker_up)
foot_obj.data.materials.append(mat_sneaker_sole)
for poly in foot_obj.data.polygons:
    avg_z = sum(foot_obj.data.vertices[vi].co.z for vi in poly.vertices) / len(poly.vertices)
    poly.material_index = 1 if avg_z < 0.036 else 0

hair_obj.data.materials.clear()
hair_obj.data.materials.append(mat_hair)

# 5. Export clean rigged Y-up GLB!
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
print("EXPORTED:", OUT_GLB, "size:", os.path.getsize(OUT_GLB))

# 6. Render back-3/4 color preview to verify clean silhouette, hair & jacket hem!
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x = 512
scene.render.resolution_y = 640
scene.render.filepath = PREVIEW_IMG

cam_data = bpy.data.cameras.new("PreviewCam")
cam = bpy.data.objects.new("PreviewCam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((0.82, 2.32, 1.32))
direction = Vector((0.0, -0.05, 1.05)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

bpy.ops.render.render(write_still=True)
print("RENDERED PREVIEW:", PREVIEW_IMG)
