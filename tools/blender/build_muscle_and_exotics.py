import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

OUT_DIR = r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models"
PREVIEW_IMG = r"C:\Users\sebas\.gemini\antigravity\brain\0b924601-4595-4364-9094-3f6908efb165\scratch\charger_preview.png"

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def make_mat(name, col, rough=0.25, metal=0.2, emission=None, em_strength=1.0, clearcoat=0.0):
    m = bpy.data.materials.new(name=name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*col, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if "Coat Weight" in bsdf.inputs and clearcoat > 0:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
    if emission is not None:
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
            bsdf.inputs["Emission Strength"].default_value = em_strength
    m.diffuse_color = (*col, 1.0)
    return m

def add_box(name, size, loc, mat, rot=(0, 0, 0), bevel=0.025, segs=2):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        bev = obj.modifiers.new("Bevel", "BEVEL")
        bev.width = bevel
        bev.segments = segs
        bpy.ops.object.modifier_apply(modifier="Bevel")
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def add_cyl(name, r, depth, loc, mat, rot=(0, 0, 0), verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def add_lofted_profile(name, slices, mat, mirror_x=True):
    """Build sleek sculpted automotive body from longitudinal Y-slices (y, [(x, z), ...])."""
    bm = bmesh.new()
    rings = []
    for y, pts in slices:
        if mirror_x:
            # pts go from bottom-center (0, z_bot) -> right side (+x) -> top-center (0, z_top)
            full = list(pts) + [(-x, z) for (x, z) in reversed(pts[1:-1])]
        else:
            full = pts
        row = [bm.verts.new((x, y, z)) for (x, z) in full]
        rings.append(row)
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    # Cap front & rear
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj

def add_sport_wheel(name, loc, radius, width, tire_mat, rim_mat, caliper_mat, spokes=5):
    """Note: with export_yup=True, Blender -Y = Three.js +Z (forward), Blender +X = Three.js +X, Blender +Z = Three.js +Y."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = loc

    # Tire torus/cylinder
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=radius, depth=width, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
    tire = bpy.context.active_object
    tire.name = name + "_tire"
    bev = tire.modifiers.new("Bevel", "BEVEL")
    bev.width = 0.045
    bev.segments = 3
    bpy.ops.object.modifier_apply(modifier="Bevel")
    tire.data.materials.append(tire_mat)
    for p in tire.data.polygons: p.use_smooth = True
    tire.parent = root

    # Recessed dark brake rotor & inner barrel (so forged spokes & Brembo calipers pop cleanly in 3D!)
    dark_hub_mat = bpy.data.materials.get("DarkTrim") or tire_mat
    rotor = add_cyl(name + "_rotor", radius * 0.62, width * 0.45, (0, 0, 0), dark_hub_mat, rot=(0, math.pi / 2, 0), verts=22)
    rotor.parent = root

    # Outer forged alloy rim lip ring on outer side
    side = 1 if loc[0] >= 0 else -1
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius * 0.66, minor_radius=0.026,
        major_segments=26, minor_segments=10,
        location=(side * (width * 0.49), 0, 0), rotation=(0, math.pi / 2, 0)
    )
    lip = bpy.context.active_object
    lip.name = name + "_lip"
    lip.data.materials.append(rim_mat)
    for p in lip.data.polygons: p.use_smooth = True
    lip.parent = root

    # Crisp 3D forged multi-spoke face standing proud over recessed dark rotor!
    for i in range(spokes):
        a = (i / spokes) * math.pi * 2.0
        for off in (-0.13, 0.13):
            ang = a + off
            sp = add_box(f"{name}_sp_{i}_{off:.1f}", (0.04, radius * 0.63, 0.034),
                         (side * (width * 0.495), math.cos(ang) * radius * 0.31, math.sin(ang) * radius * 0.31),
                         rim_mat, rot=(ang, 0, 0), bevel=0.006, segs=1)
            sp.parent = root

    # Center hub cap
    hub = add_cyl(name + "_hub", radius * 0.16, width * 1.02, (0, 0, 0), rim_mat, rot=(0, math.pi / 2, 0), verts=14)
    hub.parent = root

    # Visible performance brake caliper peeking cleanly behind spokes!
    cal = add_box(name + "_caliper", (0.09, 0.16, 0.25), (side * (width * 0.42), 0.14, 0.05), caliper_mat, bevel=0.015, segs=1)
    cal.parent = root
    return root

# ==============================================================================
# 1. DODGE CHARGER SRT HELLCAT WIDEBODY (5.10m x 1.99m x 1.46m, -Y = Forward!)
# ==============================================================================
def build_dodge_charger():
    clear_scene()
    paint = make_mat("CarPaint", (0.14, 0.16, 0.19), rough=0.14, metal=0.65, clearcoat=1.0)
    dark = make_mat("DarkTrim", (0.04, 0.045, 0.052), rough=0.45, metal=0.3)
    glass = make_mat("CarGlass", (0.03, 0.05, 0.08), rough=0.04, metal=0.25, clearcoat=1.0)
    chrome = make_mat("Chrome", (0.85, 0.88, 0.92), rough=0.14, metal=0.95)
    tire = make_mat("Tire", (0.055, 0.058, 0.062), rough=0.86, metal=0.02)
    rim = make_mat("Rim", (0.28, 0.26, 0.24), rough=0.22, metal=0.88) # aggressive SRT dark satin bronze-gunmetal!
    caliper = make_mat("BrakeCaliper", (0.86, 0.06, 0.06), rough=0.24, metal=0.3) # Red Brembo 6-piston!
    headlight = make_mat("Headlight", (0.98, 0.99, 1.0), rough=0.08, metal=0.1, emission=(1.0, 0.97, 0.92), em_strength=4.5)
    taillight = make_mat("Taillight", (0.95, 0.05, 0.06), rough=0.10, metal=0.1, emission=(1.0, 0.06, 0.06), em_strength=4.8)

    # Sculpted Widebody Fastback Lower & Upper Fuselage (Y from -2.55 front to +2.55 rear)
    # Cross-section: bottom-center -> rocker -> widebody fender -> beltline -> greenhouse/hood -> roof-center
    slices = [
        # Front chin splitter / bumper (-2.55)
        (-2.55, [(0, 0.22), (0.82, 0.22), (0.93, 0.42), (0.92, 0.68), (0.76, 0.78), (0, 0.80)]),
        # Front nose / grille surround (-2.38)
        (-2.38, [(0, 0.23), (0.88, 0.24), (0.97, 0.50), (0.95, 0.82), (0.80, 0.90), (0, 0.93)]),
        # Front wheel arch widebody flare (-1.52)
        (-1.52, [(0, 0.24), (0.94, 0.25), (1.03, 0.56), (0.98, 0.90), (0.82, 0.96), (0, 0.98)]),
        # A-pillar / cowl base (-0.82)
        (-0.82, [(0, 0.24), (0.92, 0.26), (0.97, 0.58), (0.94, 0.94), (0.82, 0.99), (0, 1.01)]),
        # Front doors / windshield crest (-0.18)
        (-0.18, [(0, 0.24), (0.93, 0.26), (0.96, 0.58), (0.94, 0.97), (0.70, 1.43), (0, 1.46)]),
        # B-pillar / roof peak (+0.45)
        ( 0.45, [(0, 0.24), (0.93, 0.26), (0.96, 0.60), (0.95, 0.99), (0.68, 1.43), (0, 1.46)]),
        # C-pillar fastback sweep (+1.18)
        ( 1.18, [(0, 0.25), (0.94, 0.27), (1.02, 0.60), (0.98, 1.02), (0.72, 1.32), (0, 1.35)]),
        # Rear wheel arch widebody haunch (+1.62)
        ( 1.62, [(0, 0.26), (0.94, 0.28), (1.04, 0.62), (0.99, 1.04), (0.80, 1.09), (0, 1.10)]),
        # Rear decklid (+2.32)
        ( 2.32, [(0, 0.28), (0.88, 0.30), (0.97, 0.62), (0.94, 1.01), (0.78, 1.06), (0, 1.07)]),
        # Rear fascia (+2.55)
        ( 2.55, [(0, 0.30), (0.82, 0.32), (0.91, 0.60), (0.89, 0.96), (0.74, 1.01), (0, 1.02)]),
    ]
    add_lofted_profile("charger_body", slices, paint)

    # Flush Dark Greenhouse Windshield, Rear Window & Proud Side Door Glass Wrap + Crisp B-Pillar Dividers!
    glass_slices = [
        (-0.82, [(0, 1.00), (0.80, 0.99), (0.80, 1.01), (0, 1.02)]),
        (-0.18, [(0, 1.02), (0.935, 1.01), (0.715, 1.40), (0, 1.44)]),
        ( 0.45, [(0, 1.03), (0.945, 1.02), (0.695, 1.40), (0, 1.44)]),
        ( 1.18, [(0, 1.05), (0.945, 1.04), (0.735, 1.29), (0, 1.34)]),
        ( 1.66, [(0, 1.07), (0.78, 1.08), (0.78, 1.09), (0, 1.10)]),
    ]
    add_lofted_profile("charger_glass", glass_slices, glass)
    for sx in (-1, 1):
        add_box(f"b_pillar_{sx}", (0.04, 0.14, 0.42), (sx * 0.84, 0.28, 1.22), dark, rot=(0, sx * -0.45, 0), bevel=0.008)

    # Aggressive Widebody Wheel Arch Flares (prominent bolted/integrated Hellcat stance!)
    for sx in (-1, 1):
        for wy in (-1.52, 1.56):
            add_cyl(f"flare_{sx}_{wy:.1f}", 0.44, 0.14, (sx * 0.97, wy, 0.42), paint, rot=(0, math.pi / 2, 0), verts=20)
            # Dark inner wheel well liner
            add_cyl(f"well_{sx}_{wy:.1f}", 0.41, 0.22, (sx * 0.88, wy, 0.40), dark, rot=(0, math.pi / 2, 0), verts=18)

    # Functional SRT Hellcat Hood Scoop + Dual Recessed Heat Extractors!
    add_box("hood_scoop_outer", (0.58, 0.72, 0.08), (0, -1.58, 0.98), paint, rot=(0.04, 0, 0), bevel=0.025)
    add_box("hood_scoop_mouth", (0.48, 0.08, 0.045), (0, -1.94, 0.97), dark, bevel=0.008)
    for sx in (-0.42, 0.42):
        add_box(f"hood_vent_{sx:.1f}", (0.24, 0.34, 0.03), (sx, -1.32, 0.985), dark, rot=(0.03, 0, 0), bevel=0.008)

    # Signature Dodge "Mail-Slot" Upper Grille + Aggressive Lower Chin Intake + Front Splitter
    add_box("upper_grille", (1.28, 0.09, 0.18), (0, -2.53, 0.72), dark, bevel=0.015)
    add_box("lower_grille", (1.46, 0.10, 0.24), (0, -2.54, 0.42), dark, bevel=0.015)
    add_box("front_splitter", (1.88, 0.26, 0.05), (0, -2.48, 0.21), dark, bevel=0.015)
    # Dual glowing LED halo projector headlights flanking mail-slot grille
    for sx in (-0.74, 0.74):
        add_box(f"headlight_{sx:.1f}", (0.34, 0.10, 0.14), (sx, -2.50, 0.73), headlight, rot=(0, 0, sx * -0.14), bevel=0.018)

    # Side Scalloped Door Coves & Aggressive Side Rocker Skirts + Wing Mirrors
    for sx in (-1, 1):
        add_box(f"side_skirt_{sx}", (0.12, 2.35, 0.09), (sx * 0.95, 0.02, 0.23), dark, bevel=0.018)
        add_box(f"mirror_{sx}", (0.22, 0.16, 0.11), (sx * 0.99, -0.58, 1.04), paint, bevel=0.025)

    # ICONIC DODGE CHARGER FULL-WIDTH "RACETRACK" LED TAILLIGHT BAR + REAR SPOILER + DUAL EXHAUSTS!
    add_box("rear_bezel", (1.76, 0.08, 0.24), (0, 2.53, 0.83), dark, bevel=0.02)
    # Continuous glowing crimson racetrack LED loop (top bar + bottom bar + side curves)
    add_box("racetrack_top", (1.66, 0.05, 0.045), (0, 2.56, 0.91), taillight, bevel=0.01)
    add_box("racetrack_bot", (1.66, 0.05, 0.045), (0, 2.56, 0.75), taillight, bevel=0.01)
    for sx in (-0.81, 0.81):
        add_box(f"racetrack_side_{sx:.1f}", (0.055, 0.05, 0.20), (sx, 2.56, 0.83), taillight, bevel=0.01)
    # Body-color SRT performance rear decklid spoiler
    add_box("rear_spoiler", (1.68, 0.24, 0.065), (0, 2.46, 1.075), dark, rot=(-0.12, 0, 0), bevel=0.018)
    # Rear diffuser + 4 fins + large dual 4.5-inch chrome exhaust tips
    add_box("rear_diffuser", (1.62, 0.16, 0.22), (0, 2.50, 0.34), dark, bevel=0.02)
    for fx in (-0.36, -0.12, 0.12, 0.36):
        add_box(f"diff_fin_{fx:.2f}", (0.03, 0.18, 0.16), (fx, 2.54, 0.30), dark, bevel=0.005)
    for sx in (-0.62, 0.62):
        add_cyl(f"exhaust_{sx:.1f}", 0.068, 0.22, (sx, 2.54, 0.31), chrome, rot=(math.pi / 2, 0, 0), verts=16)

    # 4 Wide 20x11-inch SRT Wheels (Y = -1.52 front, +1.56 rear)
    add_sport_wheel("wheel_fl", (-0.94, -1.52, 0.37), 0.37, 0.31, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_fr", ( 0.94, -1.52, 0.37), 0.37, 0.31, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_rl", (-0.95,  1.56, 0.37), 0.37, 0.32, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_rr", ( 0.95,  1.56, 0.37), 0.37, 0.32, tire, rim, caliper, spokes=5)

    out_path = os.path.join(OUT_DIR, "dodge_charger.glb")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_yup=True)
    print("EXPORTED:", out_path, os.path.getsize(out_path))

    # Render quick 3/4 rear preview of Dodge Charger SRT!
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 400
    scene.render.filepath = PREVIEW_IMG
    cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
    scene.collection.objects.link(cam)
    cam.location = Vector((3.4, 4.2, 1.55))
    cam.rotation_euler = (Vector((0, 0.1, 0.68)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    bpy.ops.render.render(write_still=True)

# ==============================================================================
# 2. PORSCHE 911 GT3 (992) (4.57m x 1.85m x 1.28m, -Y = Forward!)
# ==============================================================================
def build_porsche_911():
    clear_scene()
    paint = make_mat("CarPaint", (0.86, 0.88, 0.91), rough=0.12, metal=0.68, clearcoat=1.0)
    dark = make_mat("DarkTrim", (0.04, 0.045, 0.052), rough=0.42, metal=0.35)
    glass = make_mat("CarGlass", (0.03, 0.05, 0.08), rough=0.04, metal=0.25, clearcoat=1.0)
    chrome = make_mat("Chrome", (0.85, 0.88, 0.92), rough=0.14, metal=0.95)
    tire = make_mat("Tire", (0.055, 0.058, 0.062), rough=0.86, metal=0.02)
    rim = make_mat("Rim", (0.76, 0.78, 0.81), rough=0.18, metal=0.92)
    caliper = make_mat("BrakeCaliper", (0.94, 0.72, 0.04), rough=0.22, metal=0.3) # Yellow PCCB Ceramic!
    headlight = make_mat("Headlight", (0.98, 0.99, 1.0), rough=0.08, metal=0.1, emission=(1.0, 0.98, 0.92), em_strength=4.5)
    taillight = make_mat("Taillight", (0.96, 0.05, 0.06), rough=0.08, metal=0.1, emission=(1.0, 0.06, 0.06), em_strength=5.0)

    slices = [
        (-2.28, [(0, 0.17), (0.74, 0.18), (0.86, 0.36), (0.82, 0.56), (0.64, 0.64), (0, 0.66)]),
        (-1.85, [(0, 0.18), (0.82, 0.19), (0.92, 0.44), (0.88, 0.72), (0.72, 0.78), (0, 0.78)]),
        (-1.26, [(0, 0.18), (0.86, 0.20), (0.94, 0.48), (0.90, 0.80), (0.74, 0.84), (0, 0.84)]),
        (-0.62, [(0, 0.18), (0.86, 0.20), (0.92, 0.48), (0.88, 0.84), (0.66, 1.18), (0, 1.24)]),
        ( 0.05, [(0, 0.18), (0.86, 0.20), (0.92, 0.50), (0.89, 0.86), (0.62, 1.26), (0, 1.28)]),
        ( 0.82, [(0, 0.19), (0.89, 0.21), (0.96, 0.54), (0.94, 0.90), (0.66, 1.14), (0, 1.18)]),
        ( 1.38, [(0, 0.20), (0.90, 0.22), (0.98, 0.56), (0.95, 0.92), (0.74, 0.98), (0, 1.00)]),
        ( 2.04, [(0, 0.23), (0.84, 0.25), (0.92, 0.54), (0.89, 0.88), (0.72, 0.92), (0, 0.93)]),
        ( 2.26, [(0, 0.26), (0.76, 0.28), (0.84, 0.52), (0.82, 0.82), (0.66, 0.86), (0, 0.87)]),
    ]
    add_lofted_profile("p911_body", slices, paint)

    glass_slices = [
        (-0.90, [(0, 0.85), (0.76, 0.85), (0.76, 0.86), (0, 0.87)]),
        (-0.18, [(0, 0.88), (0.895, 0.87), (0.645, 1.23), (0, 1.27)]),
        ( 0.35, [(0, 0.89), (0.905, 0.89), (0.645, 1.22), (0, 1.26)]),
        ( 1.28, [(0, 0.94), (0.83, 0.94), (0.675, 1.05), (0, 1.08)]),
    ]
    add_lofted_profile("p911_glass", glass_slices, glass)

    # Iconic circular Porsche sloped matrix headlights!
    for sx in (-0.68, 0.68):
        add_cyl(f"p911_hl_{sx:.1f}", 0.135, 0.08, (sx, -1.94, 0.72), headlight, rot=(1.15, 0, sx * -0.18), verts=18)
        add_box(f"p911_mir_{sx:.1f}", (0.18, 0.14, 0.09), (sx * 0.93, -0.45, 0.92), paint, bevel=0.025)

    # Front GT3 splitter & twin hood nostrils + full-width razor LED rear light bar + swan-neck GT3 wing!
    add_box("p911_front_intake", (1.42, 0.12, 0.22), (0, -2.26, 0.31), dark, bevel=0.015)
    add_box("p911_splitter", (1.76, 0.22, 0.04), (0, -2.22, 0.16), dark, bevel=0.012)
    add_box("p911_lightbar", (1.62, 0.06, 0.05), (0, 2.26, 0.77), taillight, bevel=0.012)
    add_box("p911_rear_grille", (1.52, 0.10, 0.22), (0, 2.24, 0.38), dark, bevel=0.015)
    # Swan-neck GT3 carbon rear wing
    add_box("gt3_wing_blade", (1.64, 0.28, 0.045), (0, 2.12, 1.13), dark, rot=(-0.08, 0, 0), bevel=0.012)
    for sx in (-0.82, 0.82):
        add_box(f"gt3_endplate_{sx:.1f}", (0.03, 0.34, 0.16), (sx, 2.12, 1.11), dark, bevel=0.008)
    for sx in (-0.34, 0.34):
        add_box(f"gt3_strut_{sx:.1f}", (0.04, 0.14, 0.24), (sx, 2.04, 1.01), dark, bevel=0.008)
    # Twin center-exit GT3 titanium exhaust pipes
    for sx in (-0.11, 0.11):
        add_cyl(f"p911_ex_{sx:.2f}", 0.055, 0.18, (sx, 2.26, 0.27), chrome, rot=(math.pi / 2, 0, 0), verts=14)

    add_sport_wheel("wheel_fl", (-0.88, -1.26, 0.35), 0.35, 0.28, tire, rim, caliper, spokes=6)
    add_sport_wheel("wheel_fr", ( 0.88, -1.26, 0.35), 0.35, 0.28, tire, rim, caliper, spokes=6)
    add_sport_wheel("wheel_rl", (-0.91,  1.28, 0.36), 0.36, 0.32, tire, rim, caliper, spokes=6)
    add_sport_wheel("wheel_rr", ( 0.91,  1.28, 0.36), 0.36, 0.32, tire, rim, caliper, spokes=6)

    out_path = os.path.join(OUT_DIR, "porsche_911.glb")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_yup=True)
    print("EXPORTED:", out_path, os.path.getsize(out_path))

# ==============================================================================
# 3. AUDI RS6 AVANT (4.99m x 1.95m x 1.46m — Swiss Geneva Executive Super-Wagon!)
# ==============================================================================
def build_audi_rs6():
    clear_scene()
    paint = make_mat("CarPaint", (0.28, 0.31, 0.35), rough=0.14, metal=0.62, clearcoat=1.0)
    dark = make_mat("DarkTrim", (0.04, 0.045, 0.052), rough=0.42, metal=0.32)
    glass = make_mat("CarGlass", (0.03, 0.05, 0.08), rough=0.04, metal=0.25, clearcoat=1.0)
    chrome = make_mat("Chrome", (0.85, 0.88, 0.92), rough=0.15, metal=0.94)
    tire = make_mat("Tire", (0.055, 0.058, 0.062), rough=0.86, metal=0.02)
    rim = make_mat("Rim", (0.68, 0.70, 0.74), rough=0.20, metal=0.90)
    caliper = make_mat("BrakeCaliper", (0.88, 0.07, 0.07), rough=0.24, metal=0.3)
    headlight = make_mat("Headlight", (0.98, 0.99, 1.0), rough=0.08, metal=0.1, emission=(1.0, 0.98, 0.95), em_strength=4.5)
    taillight = make_mat("Taillight", (0.95, 0.05, 0.06), rough=0.08, metal=0.1, emission=(1.0, 0.06, 0.06), em_strength=4.5)

    # Long Sleek Avant Wagon Profile (roof extends all the way back to +1.96!)
    slices = [
        (-2.49, [(0, 0.21), (0.80, 0.22), (0.92, 0.44), (0.90, 0.74), (0.76, 0.84), (0, 0.86)]),
        (-2.15, [(0, 0.22), (0.88, 0.23), (0.98, 0.50), (0.94, 0.88), (0.80, 0.94), (0, 0.96)]),
        (-1.48, [(0, 0.22), (0.92, 0.24), (1.01, 0.54), (0.97, 0.92), (0.82, 0.98), (0, 1.00)]),
        (-0.80, [(0, 0.22), (0.91, 0.24), (0.96, 0.56), (0.94, 0.96), (0.80, 1.01), (0, 1.03)]),
        (-0.18, [(0, 0.22), (0.91, 0.24), (0.96, 0.56), (0.94, 0.98), (0.72, 1.43), (0, 1.46)]),
        ( 0.85, [(0, 0.22), (0.92, 0.24), (0.97, 0.58), (0.95, 1.00), (0.71, 1.43), (0, 1.46)]),
        ( 1.56, [(0, 0.23), (0.93, 0.25), (1.01, 0.60), (0.97, 1.02), (0.70, 1.41), (0, 1.44)]),
        ( 2.02, [(0, 0.25), (0.90, 0.27), (0.97, 0.60), (0.94, 1.01), (0.68, 1.37), (0, 1.40)]),
        ( 2.48, [(0, 0.28), (0.82, 0.30), (0.90, 0.58), (0.88, 0.98), (0.68, 1.10), (0, 1.12)]),
    ]
    add_lofted_profile("rs6_body", slices, paint)

    glass_slices = [
        (-0.80, [(0, 1.01), (0.80, 1.00), (0.80, 1.02), (0, 1.03)]),
        (-0.14, [(0, 1.03), (0.945, 1.02), (0.735, 1.39), (0, 1.44)]),
        ( 1.88, [(0, 1.05), (0.945, 1.04), (0.695, 1.35), (0, 1.39)]),
        ( 2.38, [(0, 1.03), (0.78, 1.03), (0.69, 1.15), (0, 1.17)]),
    ]
    add_lofted_profile("rs6_glass", glass_slices, glass)

    # Signature Audi RS Hexagonal Honeycomb Singleframe Grille + Sharp Matrix LEDs
    add_box("rs6_grille", (1.12, 0.10, 0.44), (0, -2.48, 0.52), dark, bevel=0.03)
    for sx in (-0.72, 0.72):
        add_box(f"rs6_hl_{sx:.1f}", (0.38, 0.10, 0.11), (sx, -2.44, 0.76), headlight, rot=(0, 0, sx * -0.18), bevel=0.015)
        add_box(f"rs6_side_vent_{sx:.1f}", (0.28, 0.10, 0.24), (sx * 1.02, -2.44, 0.42), dark, bevel=0.015)
        add_box(f"rs6_rail_{sx:.1f}", (0.04, 1.95, 0.05), (sx * 0.85, 0.85, 1.46), chrome, bevel=0.01)
        add_box(f"rs6_mir_{sx:.1f}", (0.20, 0.15, 0.10), (sx * 0.98, -0.52, 1.04), chrome, bevel=0.025)
    # Full-width Audi RS rear LED taillight strip + twin signature giant oval RS exhausts!
    add_box("rs6_tailbar", (1.68, 0.06, 0.09), (0, 2.48, 0.92), taillight, bevel=0.015)
    add_box("rs6_diffuser", (1.58, 0.14, 0.22), (0, 2.46, 0.34), dark, bevel=0.02)
    for sx in (-0.60, 0.60):
        ex = add_cyl(f"rs6_ex_{sx:.1f}", 0.075, 0.20, (sx, 2.49, 0.31), chrome, rot=(math.pi / 2, 0, 0), verts=16)
        ex.scale = (1.35, 1.0, 0.82)

    add_sport_wheel("wheel_fl", (-0.93, -1.48, 0.37), 0.37, 0.30, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_fr", ( 0.93, -1.48, 0.37), 0.37, 0.30, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_rl", (-0.93,  1.52, 0.37), 0.37, 0.30, tire, rim, caliper, spokes=5)
    add_sport_wheel("wheel_rr", ( 0.93,  1.52, 0.37), 0.37, 0.30, tire, rim, caliper, spokes=5)

    out_path = os.path.join(OUT_DIR, "audi_rs6.glb")
    bpy.ops.export_scene.gltf(filepath=out_path, export_format="GLB", export_yup=True)
    print("EXPORTED:", out_path, os.path.getsize(out_path))

build_dodge_charger()
build_porsche_911()
build_audi_rs6()
print("ALL 3 NEW VEHICLES BUILT SUCCESSFULLY!")
