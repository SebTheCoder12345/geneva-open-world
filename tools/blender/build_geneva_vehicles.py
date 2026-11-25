import bpy
import bmesh
import math

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def make_mat(name, base_color, metallic=0.0, roughness=0.4, coat=0.0, emission=None, emission_strength=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
    if "Coat Roughness" in bsdf.inputs:
        bsdf.inputs["Coat Roughness"].default_value = 0.05
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 0.99 and "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
    return mat

def add_beveled_box(name, size, loc, rot=(0, 0, 0), bevel_w=0.04, bevel_seg=3, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if bevel_w > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel_w, segments=bevel_seg, affect='EDGES', clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def add_cylinder(name, radius, depth, segs, loc, rot=(0, 0, 0), mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=radius, radius2=radius, depth=depth)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

def create_car_wheel(name, loc, radius=0.39, width=0.27, tire_mat=None, rim_mat=None, hub_mat=None, parent=None):
    holder = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(holder)
    holder.location = loc
    if parent:
        holder.parent = parent

    mesh = bpy.data.meshes.new(name + "_tire")
    tire = bpy.data.objects.new(name + "_tire", mesh)
    bpy.context.collection.objects.link(tire)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=26, radius1=radius, radius2=radius, depth=width)
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges if len(e.link_faces) == 2], offset=0.05, segments=3, affect='EDGES', clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    tire.rotation_euler = (0, math.pi / 2, 0)
    tire.data.materials.append(tire_mat)
    tire.parent = holder

    add_cylinder(name + "_rim", radius * 0.66, width + 0.02, 22, (0, 0, 0), (0, math.pi / 2, 0), rim_mat, holder)
    add_cylinder(name + "_hub", radius * 0.22, width + 0.045, 14, (0, 0, 0), (0, math.pi / 2, 0), hub_mat, holder)
    # 5 alloy star spokes
    for k in range(5):
        a = (k / 5.0) * math.pi * 2
        sp = add_beveled_box(f"{name}_sp_{k}", (width + 0.032, radius * 0.56, 0.055), (0, math.cos(a) * radius * 0.3, math.sin(a) * radius * 0.3), (a, 0, 0), 0.01, 2, rim_mat, holder)
    return holder

def export_glb(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
    )
    print("Exported:", path)

# ==============================================================================
# 1. LUXURY GENEVA MERCEDES G-WAGON SUV (public/models/suv_gwagon.glb)
# Iconic boxy G-Class silhouette with round LED halo headlights, wide fender flares, spare wheel on rear!
# Blender -Y = Front (+Z in glTF), +Z = Up (+Y in glTF)
# ==============================================================================
def build_gwagon(path):
    clear_scene()
    mat_paint = make_mat("CarPaint", (0.93, 0.94, 0.96), metallic=0.35, roughness=0.16, coat=1.0)
    mat_dark = make_mat("DarkTrim", (0.06, 0.07, 0.09), metallic=0.35, roughness=0.38, coat=0.4)
    mat_chrome = make_mat("Chrome", (0.90, 0.92, 0.95), metallic=0.96, roughness=0.12)
    mat_glass = make_mat("Glass", (0.03, 0.06, 0.10), metallic=0.25, roughness=0.04, coat=1.0)
    mat_tire = make_mat("Rubber", (0.04, 0.045, 0.05), roughness=0.88)
    mat_rim = make_mat("AlloyRim", (0.78, 0.80, 0.85), metallic=0.9, roughness=0.2)
    mat_hl = make_mat("Headlight", (1.0, 0.98, 0.92), roughness=0.05, emission=(1.0, 0.97, 0.88), emission_strength=4.2)
    mat_tl = make_mat("Taillight", (0.85, 0.04, 0.04), roughness=0.1, emission=(1.0, 0.08, 0.06), emission_strength=2.8)
    mat_amber = make_mat("TurnSignal", (1.0, 0.55, 0.05), roughness=0.15, emission=(1.0, 0.55, 0.05), emission_strength=2.2)

    root = bpy.data.objects.new("GWagon_SUV", None)
    bpy.context.collection.objects.link(root)

    # Lower main body shell + signature flat G-Class hood
    add_beveled_box("body_main", (1.92, 4.55, 0.78), (0, 0.08, 0.82), bevel_w=0.07, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("body_hood", (1.76, 1.52, 0.24), (0, -1.46, 1.24), bevel_w=0.06, bevel_seg=4, mat=mat_paint, parent=root)
    # Boxy G-Class greenhouse cabin (pillars + roof!)
    add_beveled_box("body_cabin", (1.80, 2.86, 0.78), (0, 0.68, 1.56), bevel_w=0.08, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("body_roof_rack", (1.68, 2.5, 0.06), (0, 0.72, 1.98), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)

    # Iconic G-Wagon widened boxy fender flares & side running boards
    for sx in (-1, 1):
        add_beveled_box(f"fender_f_{sx}", (0.18, 0.96, 0.42), (sx * 0.98, -1.44, 0.72), bevel_w=0.05, bevel_seg=3, mat=mat_paint, parent=root)
        add_beveled_box(f"fender_r_{sx}", (0.18, 0.96, 0.42), (sx * 0.98,  1.42, 0.72), bevel_w=0.05, bevel_seg=3, mat=mat_paint, parent=root)
        add_beveled_box(f"running_board_{sx}", (0.18, 1.92, 0.08), (sx * 0.99, -0.02, 0.44), bevel_w=0.02, bevel_seg=2, mat=mat_chrome, parent=root)
        add_beveled_box(f"side_molding_{sx}", (0.04, 4.35, 0.07), (sx * 0.97, 0.08, 1.02), bevel_w=0.01, bevel_seg=1, mat=mat_dark, parent=root)
        # Signature top-of-fender G-Wagon indicator pods!
        add_beveled_box(f"hood_indicator_{sx}", (0.09, 0.16, 0.07), (sx * 0.84, -1.92, 1.38), bevel_w=0.02, bevel_seg=2, mat=mat_amber, parent=root)
        # Side mirrors
        add_beveled_box(f"mirror_{sx}", (0.22, 0.14, 0.14), (sx * 1.04, -0.78, 1.38), bevel_w=0.03, bevel_seg=2, mat=mat_paint, parent=root)

    # Signature vertical AMG-style slatted black grille & heavy bumper
    add_beveled_box("front_bumper", (2.02, 0.34, 0.34), (0, -2.28, 0.56), bevel_w=0.06, bevel_seg=3, mat=mat_dark, parent=root)
    add_beveled_box("grille_frame", (1.06, 0.08, 0.44), (0, -2.22, 1.02), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)
    for gx in range(-4, 5):
        add_beveled_box(f"grille_slat_{gx}", (0.025, 0.09, 0.38), (gx * 0.11, -2.24, 1.02), bevel_w=0.005, bevel_seg=1, mat=mat_chrome, parent=root)
    add_cylinder("grille_emblem", 0.11, 0.05, 18, (0, -2.26, 1.02), (math.pi / 2, 0, 0), mat_chrome, root)

    # Iconic round G-Wagon LED projector headlights
    for sx in (-0.72, 0.72):
        add_cylinder(f"hl_bezel_{sx}", 0.15, 0.08, 20, (sx, -2.21, 1.02), (math.pi / 2, 0, 0), mat_dark, root)
        add_cylinder(f"hl_lens_{sx}", 0.12, 0.09, 20, (sx, -2.23, 1.02), (math.pi / 2, 0, 0), mat_hl, root)

    # Rear bumper, spare tire hard cover & rectangular LED taillights
    add_beveled_box("rear_bumper", (2.02, 0.28, 0.30), (0, 2.38, 0.56), bevel_w=0.05, bevel_seg=3, mat=mat_dark, parent=root)
    add_cylinder("spare_ring", 0.42, 0.24, 24, (0, 2.48, 1.18), (math.pi / 2, 0, 0), mat_chrome, root)
    add_cylinder("spare_cover", 0.39, 0.26, 24, (0, 2.50, 1.18), (math.pi / 2, 0, 0), mat_paint, root)
    for sx in (-0.78, 0.78):
        add_beveled_box(f"taillight_{sx}", (0.28, 0.08, 0.13), (sx, 2.36, 0.84), bevel_w=0.02, bevel_seg=2, mat=mat_tl, parent=root)

    # Tinted windows all around (flat windshield + side windows + rear glass)
    add_beveled_box("glass_front", (1.64, 0.06, 0.62), (0, -0.74, 1.56), rot=(0.18, 0, 0), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
    add_beveled_box("glass_rear", (1.58, 0.06, 0.56), (0, 2.11, 1.58), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
    add_beveled_box("glass_side_l", (0.04, 2.42, 0.56), (-0.91, 0.72, 1.56), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
    add_beveled_box("glass_side_r", (0.04, 2.42, 0.56), ( 0.91, 0.72, 1.56), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)

    # 4 Large AMG-style Alloy Wheels
    for wname, wloc in [
        ("wheel_fl", ( 0.94, -1.44, 0.42)),
        ("wheel_fr", (-0.94, -1.44, 0.42)),
        ("wheel_rl", ( 0.94,  1.42, 0.42)),
        ("wheel_rr", (-0.94,  1.42, 0.42)),
    ]:
        create_car_wheel(wname, wloc, radius=0.42, width=0.29, tire_mat=mat_tire, rim_mat=mat_rim, hub_mat=mat_dark, parent=root)

    export_glb(path)

# ==============================================================================
# 2. MODERN EUROPEAN LUXURY SEDAN (public/models/sedan_euro.glb — Audi/BMW/Mercedes feel!)
# ==============================================================================
def build_euro_sedan(path):
    clear_scene()
    mat_paint = make_mat("CarPaint", (0.76, 0.79, 0.84), metallic=0.72, roughness=0.16, coat=1.0)
    mat_dark = make_mat("DarkTrim", (0.06, 0.07, 0.09), metallic=0.35, roughness=0.38)
    mat_chrome = make_mat("Chrome", (0.90, 0.92, 0.95), metallic=0.96, roughness=0.12)
    mat_glass = make_mat("Glass", (0.03, 0.06, 0.11), metallic=0.25, roughness=0.04, coat=1.0)
    mat_tire = make_mat("Rubber", (0.04, 0.045, 0.05), roughness=0.88)
    mat_rim = make_mat("AlloyRim", (0.80, 0.82, 0.86), metallic=0.9, roughness=0.18)
    mat_hl = make_mat("Headlight", (1.0, 0.98, 0.92), roughness=0.05, emission=(1.0, 0.97, 0.88), emission_strength=4.2)
    mat_tl = make_mat("Taillight", (0.88, 0.04, 0.04), roughness=0.1, emission=(1.0, 0.08, 0.06), emission_strength=3.0)

    root = bpy.data.objects.new("Euro_Sedan", None)
    bpy.context.collection.objects.link(root)

    # Low sculpted aerodynamic body + sloped hood & trunk
    add_beveled_box("body_lower", (1.88, 4.65, 0.58), (0, 0.0, 0.62), bevel_w=0.14, bevel_seg=5, mat=mat_paint, parent=root)
    add_beveled_box("body_hood", (1.78, 1.55, 0.22), (0, -1.45, 0.92), rot=(0.06, 0, 0), bevel_w=0.10, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("body_trunk", (1.76, 1.05, 0.24), (0, 1.72, 0.96), rot=(-0.05, 0, 0), bevel_w=0.09, bevel_seg=4, mat=mat_paint, parent=root)
    # Sleek coupe-like roof greenhouse
    add_beveled_box("body_cabin", (1.58, 2.25, 0.56), (0, 0.15, 1.18), bevel_w=0.18, bevel_seg=5, mat=mat_paint, parent=root)
    add_beveled_box("trunk_spoiler", (1.56, 0.14, 0.06), (0, 2.24, 1.08), bevel_w=0.02, bevel_seg=2, mat=mat_paint, parent=root)

    # Front splitter, hexagonal European grille, sleek LED headlights, rear diffuser & twin exhausts
    add_beveled_box("front_grille", (0.94, 0.10, 0.30), (0, -2.31, 0.62), bevel_w=0.03, bevel_seg=2, mat=mat_dark, parent=root)
    add_beveled_box("rear_diffuser", (1.68, 0.16, 0.20), (0, 2.30, 0.42), bevel_w=0.04, bevel_seg=2, mat=mat_dark, parent=root)
    for sx in (-1, 1):
        add_beveled_box(f"hl_{sx}", (0.44, 0.12, 0.13), (sx * 0.68, -2.24, 0.76), rot=(0, 0, sx * -0.14), bevel_w=0.03, bevel_seg=2, mat=mat_hl, parent=root)
        add_beveled_box(f"tl_{sx}", (0.48, 0.10, 0.15), (sx * 0.68, 2.30, 0.84), bevel_w=0.025, bevel_seg=2, mat=mat_tl, parent=root)
        add_cylinder(f"exhaust_{sx}", 0.055, 0.18, 12, (sx * 0.58, 2.36, 0.36), (math.pi / 2, 0, 0), mat_chrome, root)
        add_beveled_box(f"mirror_{sx}", (0.18, 0.12, 0.10), (sx * 0.96, -0.62, 1.06), bevel_w=0.03, bevel_seg=2, mat=mat_paint, parent=root)

    # Raked front & rear glass + dark side windows
    add_beveled_box("glass_front", (1.46, 0.08, 0.72), (0, -0.82, 1.16), rot=(0.76, 0, 0), bevel_w=0.02, bevel_seg=2, mat=mat_glass, parent=root)
    add_beveled_box("glass_rear", (1.44, 0.08, 0.74), (0, 1.16, 1.18), rot=(-0.82, 0, 0), bevel_w=0.02, bevel_seg=2, mat=mat_glass, parent=root)
    add_beveled_box("glass_side_l", (0.04, 1.85, 0.42), (-0.79, 0.16, 1.18), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
    add_beveled_box("glass_side_r", (0.04, 1.85, 0.42), ( 0.79, 0.16, 1.18), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)

    for wname, wloc in [
        ("wheel_fl", ( 0.88, -1.42, 0.35)),
        ("wheel_fr", (-0.88, -1.42, 0.35)),
        ("wheel_rl", ( 0.88,  1.42, 0.35)),
        ("wheel_rr", (-0.88,  1.42, 0.35)),
    ]:
        create_car_wheel(wname, wloc, radius=0.35, width=0.25, tire_mat=mat_tire, rim_mat=mat_rim, hub_mat=mat_dark, parent=root)

    export_glb(path)

# ==============================================================================
# 3. SWISS POST / GENEVA COMMERCIAL DELIVERY VAN (public/models/van_swiss.glb)
# ==============================================================================
def build_swiss_van(path):
    clear_scene()
    mat_paint = make_mat("CarPaint", (0.98, 0.78, 0.06), metallic=0.14, roughness=0.24, coat=0.85) # Iconic Swiss Post Yellow!
    mat_dark = make_mat("DarkTrim", (0.07, 0.08, 0.10), metallic=0.2, roughness=0.52)
    mat_glass = make_mat("Glass", (0.03, 0.06, 0.10), metallic=0.2, roughness=0.05, coat=1.0)
    mat_tire = make_mat("Rubber", (0.04, 0.045, 0.05), roughness=0.88)
    mat_rim = make_mat("AlloyRim", (0.68, 0.71, 0.76), metallic=0.75, roughness=0.32)
    mat_hl = make_mat("Headlight", (1.0, 0.98, 0.90), roughness=0.06, emission=(1.0, 0.96, 0.86), emission_strength=3.8)
    mat_tl = make_mat("Taillight", (0.85, 0.04, 0.04), roughness=0.1, emission=(1.0, 0.08, 0.06), emission_strength=2.6)

    root = bpy.data.objects.new("Swiss_Van", None)
    bpy.context.collection.objects.link(root)

    # Tall European Mercedes Sprinter / VW Crafter cargo shell + sloped nose
    add_beveled_box("body_cargo", (2.02, 4.15, 1.88), (0, 0.56, 1.38), bevel_w=0.14, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("body_cab_nose", (1.96, 1.15, 0.88), (0, -2.02, 0.88), rot=(0.12, 0, 0), bevel_w=0.14, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("body_cab_roof", (1.94, 1.15, 0.85), (0, -1.45, 1.82), rot=(0.35, 0, 0), bevel_w=0.14, bevel_seg=4, mat=mat_paint, parent=root)
    add_beveled_box("bumper_f", (2.04, 0.34, 0.34), (0, -2.52, 0.54), bevel_w=0.06, bevel_seg=3, mat=mat_dark, parent=root)
    add_beveled_box("bumper_r", (2.04, 0.24, 0.28), (0,  2.66, 0.52), bevel_w=0.05, bevel_seg=3, mat=mat_dark, parent=root)
    add_beveled_box("grille", (1.18, 0.08, 0.34), (0, -2.56, 0.88), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)
    add_beveled_box("glass_wind", (1.76, 0.08, 0.88), (0, -1.96, 1.66), rot=(0.45, 0, 0), bevel_w=0.02, bevel_seg=2, mat=mat_glass, parent=root)
    for sx in (-1, 1):
        add_beveled_box(f"door_glass_{sx}", (0.04, 0.92, 0.68), (sx * 0.99, -1.45, 1.66), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
        add_beveled_box(f"hl_{sx}", (0.36, 0.08, 0.22), (sx * 0.78, -2.54, 0.88), bevel_w=0.02, bevel_seg=2, mat=mat_hl, parent=root)
        add_beveled_box(f"tl_{sx}", (0.20, 0.08, 0.62), (sx * 0.92, 2.64, 1.08), bevel_w=0.02, bevel_seg=2, mat=mat_tl, parent=root)
        add_beveled_box(f"mirror_{sx}", (0.16, 0.14, 0.30), (sx * 1.12, -1.68, 1.56), bevel_w=0.03, bevel_seg=2, mat=mat_dark, parent=root)

    for wname, wloc in [
        ("wheel_fl", ( 0.95, -1.62, 0.39)),
        ("wheel_fr", (-0.95, -1.62, 0.39)),
        ("wheel_rl", ( 0.95,  1.65, 0.39)),
        ("wheel_rr", (-0.95,  1.65, 0.39)),
    ]:
        create_car_wheel(wname, wloc, radius=0.39, width=0.26, tire_mat=mat_tire, rim_mat=mat_rim, hub_mat=mat_dark, parent=root)

    export_glb(path)

# ==============================================================================
# 4. DRIVABLE RED GENEVA VESPA MOTOR SCOOTER (public/models/vespa_scooter.glb — Reference 5!)
# Classic glossy red body, top-case trunk box, curved leg shield, handlebars, chrome mirrors, headlight & taillight!
# ==============================================================================
def build_vespa_scooter(path):
    clear_scene()
    mat_red = make_mat("VespaRed", (0.76, 0.07, 0.08), metallic=0.35, roughness=0.15, coat=1.0)
    mat_seat = make_mat("VespaSeat", (0.10, 0.11, 0.13), roughness=0.72)
    mat_chrome = make_mat("VespaChrome", (0.90, 0.92, 0.96), metallic=0.96, roughness=0.10)
    mat_dark = make_mat("VespaDark", (0.06, 0.07, 0.09), metallic=0.25, roughness=0.45)
    mat_tire = make_mat("VespaTire", (0.04, 0.045, 0.05), roughness=0.88)
    mat_hl = make_mat("VespaHeadlight", (1.0, 0.98, 0.90), roughness=0.05, emission=(1.0, 0.96, 0.86), emission_strength=4.5)
    mat_tl = make_mat("VespaTaillight", (0.92, 0.05, 0.05), roughness=0.08, emission=(1.0, 0.08, 0.06), emission_strength=3.2)

    root = bpy.data.objects.new("Vespa_Scooter", None)
    bpy.context.collection.objects.link(root)

    # Rear bulbous Vespa cowl + floorboard step-through + curved front leg shield!
    add_beveled_box("rear_cowl", (0.58, 0.92, 0.44), (0, 0.36, 0.56), bevel_w=0.16, bevel_seg=5, mat=mat_red, parent=root)
    add_beveled_box("floorboard", (0.48, 0.68, 0.10), (0, -0.22, 0.28), bevel_w=0.04, bevel_seg=3, mat=mat_dark, parent=root)
    add_beveled_box("front_shield", (0.54, 0.16, 0.86), (0, -0.62, 0.68), rot=(-0.22, 0, 0), bevel_w=0.07, bevel_seg=4, mat=mat_red, parent=root)
    add_beveled_box("front_fender", (0.22, 0.44, 0.14), (0, -0.78, 0.44), rot=(0.12, 0, 0), bevel_w=0.06, bevel_seg=4, mat=mat_red, parent=root)

    # Contoured leather saddle seat + glossy red rear top-case storage box (exact match to Reference 5!)
    add_beveled_box("seat", (0.38, 0.78, 0.16), (0, 0.24, 0.82), bevel_w=0.07, bevel_seg=4, mat=mat_seat, parent=root)
    add_beveled_box("top_rack", (0.34, 0.32, 0.04), (0, 0.82, 0.82), bevel_w=0.01, bevel_seg=2, mat=mat_chrome, parent=root)
    add_beveled_box("top_case", (0.44, 0.42, 0.34), (0, 0.84, 1.02), bevel_w=0.10, bevel_seg=4, mat=mat_red, parent=root)
    add_beveled_box("top_case_pad", (0.32, 0.06, 0.18), (0, 0.63, 1.00), bevel_w=0.025, bevel_seg=2, mat=mat_seat, parent=root)

    # Steering column, handlebars, grips, chrome mirrors, round Vespa headlight & rear taillight + Swiss plate!
    add_cylinder("steer_post", 0.045, 0.72, 12, (0, -0.62, 0.88), (-0.22, 0, 0), mat_red, root)
    add_beveled_box("head_nacelle", (0.28, 0.24, 0.18), (0, -0.68, 1.14), bevel_w=0.07, bevel_seg=4, mat=mat_red, parent=root)
    add_cylinder("handlebars", 0.022, 0.74, 10, (0, -0.66, 1.14), (0, math.pi / 2, 0), mat_chrome, root)
    for sx in (-0.34, 0.34):
        add_cylinder(f"grip_{sx}", 0.030, 0.14, 10, (sx, -0.66, 1.14), (0, math.pi / 2, 0), mat_dark, root)
        add_cylinder(f"mir_stem_{sx}", 0.01, 0.18, 8, (sx * 0.72, -0.68, 1.24), (0, sx * 0.25, 0), mat_chrome, root)
        add_cylinder(f"mir_head_{sx}", 0.06, 0.025, 14, (sx * 0.80, -0.68, 1.34), (math.pi / 2, 0, 0), mat_chrome, root)

    add_cylinder("headlight", 0.095, 0.08, 18, (0, -0.80, 1.14), (math.pi / 2, 0, 0), mat_hl, root)
    add_beveled_box("taillight", (0.18, 0.06, 0.11), (0, 0.84, 0.68), bevel_w=0.02, bevel_seg=2, mat=mat_tl, parent=root)
    add_beveled_box("license_plate", (0.18, 0.02, 0.14), (0, 0.86, 0.48), rot=(-0.22, 0, 0), bevel_w=0.005, bevel_seg=1, mat=mat_chrome, parent=root)
    add_cylinder("exhaust_pipe", 0.045, 0.55, 10, (-0.26, 0.42, 0.28), (math.pi / 2, 0, 0), mat_dark, root)

    # Front & Rear Scooter Wheels (named wheel_fl & wheel_rl so vehicles.js spins them!)
    create_car_wheel("wheel_fl", (0, -0.74, 0.26), radius=0.26, width=0.12, tire_mat=mat_tire, rim_mat=mat_chrome, hub_mat=mat_dark, parent=root)
    create_car_wheel("wheel_rl", (0,  0.54, 0.26), radius=0.26, width=0.14, tire_mat=mat_tire, rim_mat=mat_chrome, hub_mat=mat_dark, parent=root)

    export_glb(path)

if __name__ == "__main__":
    base = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models"
    build_gwagon(base + r"\suv_gwagon.glb")
    build_euro_sedan(base + r"\sedan_euro.glb")
    build_swiss_van(base + r"\van_swiss.glb")
    build_vespa_scooter(base + r"\vespa_scooter.glb")
