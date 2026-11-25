import bpy
import bmesh
import math
from mathutils import Vector, Matrix

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
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 0.99 and "Alpha" in bsdf.inputs:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.blend_method = 'BLEND' if hasattr(mat, 'blend_method') else None
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

def create_detailed_wheel(name, loc, radius=0.49, width=0.32, tire_mat=None, rim_mat=None, hub_mat=None, parent=None):
    holder = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(holder)
    holder.location = loc
    if parent:
        holder.parent = parent

    # Tire (beveled cylinder rotated along X axle)
    mesh = bpy.data.meshes.new(name + "_tire")
    tire = bpy.data.objects.new(name + "_tire", mesh)
    bpy.context.collection.objects.link(tire)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=28, radius1=radius, radius2=radius, depth=width)
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges if len(e.link_faces) == 2], offset=0.055, segments=3, affect='EDGES', clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = True
    tire.rotation_euler = (0, math.pi / 2, 0)
    tire.data.materials.append(tire_mat)
    tire.parent = holder

    # Deep alloy rim barrel
    rim = add_cylinder(name + "_rim", radius * 0.62, width + 0.02, 24, (0, 0, 0), (0, math.pi / 2, 0), rim_mat, holder)
    # Central axle hub cap
    add_cylinder(name + "_hub", radius * 0.22, width + 0.055, 16, (0, 0, 0), (0, math.pi / 2, 0), hub_mat, holder)
    # 8 lug bolts around hub
    for k in range(8):
        a = (k / 8.0) * math.pi * 2
        ly = math.cos(a) * radius * 0.38
        lz = math.sin(a) * radius * 0.38
        add_cylinder(f"{name}_lug_{k}", 0.018, width + 0.045, 8, (0, ly, lz), (0, math.pi / 2, 0), hub_mat, holder)
    return holder

def add_uv_plane(name, w, h, loc, rot, mat, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    v0 = bm.verts.new((-w * 0.5, -h * 0.5, 0))
    v1 = bm.verts.new(( w * 0.5, -h * 0.5, 0))
    v2 = bm.verts.new(( w * 0.5,  h * 0.5, 0))
    v3 = bm.verts.new((-w * 0.5,  h * 0.5, 0))
    face = bm.faces.new((v0, v1, v2, v3))
    uv_layer = bm.loops.layers.uv.new("UVMap")
    uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv
    bm.to_mesh(mesh)
    bm.free()
    obj.location = loc
    obj.rotation_euler = rot
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj

# ==============================================================================
# 1. HIGH-POLY GENEVA TPG MERCEDES-BENZ CITARO C2 CITY BUS (public/models/tpg_bus.glb)
# Blender space: Front = -Y (y = -6.0), Rear = +Y (y = +6.0), Up = +Z (z = 0..3.15)
# Exported glTF (Y-up): Front = +Z, Up = +Y!
# ==============================================================================
def build_tpg_bus(export_path):
    clear_scene()

    mat_white = make_mat("TPG_PearlWhite", (0.94, 0.95, 0.97), metallic=0.12, roughness=0.20, coat=0.9)
    mat_accent = make_mat("TPG_Accent", (0.93, 0.34, 0.08), metallic=0.18, roughness=0.22, coat=0.9) # Modern TPG Orange (swappable to Blue!)
    mat_dark = make_mat("TPG_DarkTrim", (0.07, 0.08, 0.10), metallic=0.25, roughness=0.42, coat=0.3)
    mat_chrome = make_mat("TPG_Chrome", (0.85, 0.88, 0.92), metallic=0.95, roughness=0.14)
    mat_glass = make_mat("TPG_TintedGlass", (0.04, 0.08, 0.12), metallic=0.15, roughness=0.05, coat=1.0, alpha=0.68)
    mat_tire = make_mat("TPG_Rubber", (0.04, 0.045, 0.05), metallic=0.0, roughness=0.88)
    mat_rim = make_mat("TPG_AlloyRim", (0.78, 0.81, 0.86), metallic=0.88, roughness=0.22)
    mat_seat = make_mat("TPG_SeatBlue", (0.12, 0.24, 0.56), metallic=0.0, roughness=0.78)
    mat_floor = make_mat("TPG_CabinFloor", (0.22, 0.24, 0.27), metallic=0.0, roughness=0.85)
    mat_headlight = make_mat("TPG_Headlight", (1.0, 0.97, 0.88), metallic=0.1, roughness=0.08, emission=(1.0, 0.96, 0.84), emission_strength=3.5)
    mat_taillight = make_mat("TPG_Taillight", (0.85, 0.05, 0.05), metallic=0.1, roughness=0.12, emission=(1.0, 0.08, 0.06), emission_strength=2.4)
    mat_amber = make_mat("TPG_AmberMarker", (1.0, 0.62, 0.06), metallic=0.1, roughness=0.2, emission=(1.0, 0.65, 0.08), emission_strength=2.2)
    mat_led_front = make_mat("TPG_LED_Front", (0.06, 0.07, 0.09), roughness=0.2)
    mat_led_side = make_mat("TPG_LED_Side", (0.06, 0.07, 0.09), roughness=0.2)
    mat_yellow_btn = make_mat("TPG_YellowBtn", (0.98, 0.80, 0.08), roughness=0.3, emission=(0.98, 0.8, 0.1), emission_strength=0.6)

    root = bpy.data.objects.new("TPG_Citaro_Bus", None)
    bpy.context.collection.objects.link(root)

    # Underbody dark chassis frame
    add_beveled_box("chassis_base", (2.38, 11.4, 0.24), (0, 0, 0.42), bevel_w=0.04, bevel_seg=2, mat=mat_dark, parent=root)

    # Lower vibrant TPG colored apron (swappable per bus line in Three.js!)
    add_beveled_box("body_lower", (2.54, 11.75, 0.66), (0, 0.05, 0.72), bevel_w=0.08, bevel_seg=4, mat=mat_accent, parent=root)

    # Front sculpted Citaro C2 curved bumper & aerodynamic nose lower chin
    add_beveled_box("front_bumper", (2.52, 0.52, 0.56), (0, -5.78, 0.66), bevel_w=0.14, bevel_seg=5, mat=mat_accent, parent=root)
    add_beveled_box("front_grille", (1.58, 0.08, 0.22), (0, -6.01, 0.62), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)
    # Chrome Mercedes-style front accent bar
    add_beveled_box("front_chrome_bar", (1.62, 0.06, 0.045), (0, -6.02, 0.78), bevel_w=0.015, bevel_seg=2, mat=mat_chrome, parent=root)

    # Rear engine hood & sculpted bumper
    add_beveled_box("rear_bumper", (2.52, 0.48, 0.58), (0, 5.82, 0.68), bevel_w=0.12, bevel_seg=4, mat=mat_accent, parent=root)
    add_beveled_box("rear_upper", (2.52, 0.44, 1.98), (0, 5.76, 1.96), bevel_w=0.12, bevel_seg=4, mat=mat_white, parent=root)
    add_beveled_box("rear_vent_grille", (1.7, 0.06, 0.58), (0, 5.98, 1.24), bevel_w=0.015, bevel_seg=2, mat=mat_dark, parent=root)

    # Pearl-white sleek roof crown + header fascia (wraps smoothly around top above panoramic glass!)
    add_beveled_box("roof_crown", (2.52, 11.75, 0.44), (0, 0.02, 2.86), bevel_w=0.14, bevel_seg=5, mat=mat_white, parent=root)
    # Front sloped aerodynamic brow above windshield
    add_beveled_box("front_brow", (2.48, 0.58, 0.52), (0, -5.66, 2.76), rot=(0.24, 0, 0), bevel_w=0.13, bevel_seg=5, mat=mat_white, parent=root)

    # Sleek roof electric-bus battery shroud & dual HVAC pods
    add_beveled_box("roof_pod_front", (1.92, 4.1, 0.34), (0, -1.6, 3.22), bevel_w=0.10, bevel_seg=4, mat=mat_white, parent=root)
    add_beveled_box("roof_pod_rear", (1.88, 3.2, 0.32), (0, 3.1, 3.20), bevel_w=0.10, bevel_seg=4, mat=mat_white, parent=root)
    add_beveled_box("roof_hvac_vent", (1.3, 1.6, 0.08), (0, -1.6, 3.39), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)

    # Mid-body Pearl-White Structural Pillars & Side Belt Rail (real 3D depth framing panoramic glass!)
    add_beveled_box("belt_rail_l", (0.08, 11.4, 0.22), (-1.24, 0.05, 1.12), bevel_w=0.025, bevel_seg=2, mat=mat_white, parent=root)
    add_beveled_box("belt_rail_r", (0.08, 11.4, 0.22), ( 1.24, 0.05, 1.12), bevel_w=0.025, bevel_seg=2, mat=mat_white, parent=root)

    # Structural side pillars (A, B, C, D, E, F) framing windows & 3 Geneva passenger doors
    pillar_ys = [-5.58, -3.75, -1.75, 0.15, 2.05, 3.95, 5.55]
    for idx, py in enumerate(pillar_ys):
        pw = 0.24 if idx in (0, 6) else 0.14
        for sx in (-1.23, 1.23):
            add_beveled_box(f"pillar_{idx}_{'l' if sx < 0 else 'r'}", (0.09, pw, 1.64), (sx, py, 1.94), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)

    # 3D Recessed Panoramic Tinted Glass Windows (left, right, curved raked front windshield, rear)
    add_beveled_box("glass_side_l", (0.03, 11.0, 1.48), (-1.22, 0.0, 1.94), bevel_w=0.0, bevel_seg=1, mat=mat_glass, parent=root)
    add_beveled_box("glass_side_r", (0.03, 11.0, 1.48), ( 1.22, 0.0, 1.94), bevel_w=0.0, bevel_seg=1, mat=mat_glass, parent=root)
    # Raked curved front panoramic windshield (Mercedes Citaro signature angle!)
    add_beveled_box("windshield_front", (2.34, 0.08, 1.72), (0, -5.88, 1.78), rot=(0.14, 0, 0), bevel_w=0.02, bevel_seg=2, mat=mat_glass, parent=root)
    # Dual front windshield wiper blades
    for wx in (-0.42, 0.42):
        add_beveled_box(f"wiper_{wx}", (0.72, 0.035, 0.035), (wx, -5.99, 1.06), rot=(0, 0.12, 0.08), bevel_w=0.008, bevel_seg=1, mat=mat_dark, parent=root)
    # Rear glass window
    add_beveled_box("glass_rear", (2.06, 0.05, 0.92), (0, 5.97, 2.18), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)

    # Double-leaf Swiss sliding doors on right curb side (x = -1.25 in Blender = +X right in glTF? Wait: -Y fwd -> right side is -X!)
    # Wait: Facing -Y with +Z up: forward=(0,-1,0), up=(0,0,1), right = fwd x up = (-1,0,0) = -X!
    for dy in (-4.65, -0.8, 3.0):
        # Recessed door glass extending lower to low-floor curb + yellow Swiss open button!
        add_beveled_box(f"door_glass_{dy}", (0.04, 1.28, 2.12), (-1.23, dy, 1.54), bevel_w=0.01, bevel_seg=1, mat=mat_glass, parent=root)
        add_beveled_box(f"door_seam_{dy}", (0.055, 0.04, 2.14), (-1.24, dy, 1.54), bevel_w=0.008, bevel_seg=1, mat=mat_dark, parent=root)
        add_beveled_box(f"door_btn_{dy}", (0.06, 0.11, 0.14), (-1.26, dy, 1.24), bevel_w=0.015, bevel_seg=2, mat=mat_yellow_btn, parent=root)

    # 3D INTERIOR PASSENGER CABIN (visible through tinted panoramic glass!)
    add_beveled_box("cabin_floor", (2.28, 10.8, 0.06), (0, 0.1, 0.62), bevel_w=0.0, bevel_seg=1, mat=mat_floor, parent=root)
    # Driver dashboard & seat
    add_beveled_box("driver_dash", (1.05, 0.58, 0.68), (0.58, -5.25, 1.15), bevel_w=0.06, bevel_seg=2, mat=mat_dark, parent=root)
    add_cylinder("steering_wheel", 0.24, 0.04, 14, (0.58, -4.92, 1.48), (0.65, 0, 0), mat_dark, root)
    # Rows of 3D blue passenger seats + chrome grab poles
    for row_i in range(9):
        sy = -3.8 + row_i * 1.02
        for side_x in (-0.84, 0.84):
            if side_x < 0 and (abs(sy + 0.8) < 0.75 or abs(sy - 3.0) < 0.75):
                continue # keep door vestibules clear!
            add_beveled_box(f"seat_base_{row_i}_{side_x}", (0.52, 0.44, 0.12), (side_x, sy, 1.04), bevel_w=0.03, bevel_seg=2, mat=mat_seat, parent=root)
            add_beveled_box(f"seat_back_{row_i}_{side_x}", (0.50, 0.11, 0.66), (side_x, sy + 0.18, 1.38), rot=(-0.14, 0, 0), bevel_w=0.03, bevel_seg=2, mat=mat_seat, parent=root)
        if row_i % 2 == 0:
            for pole_x in (-0.42, 0.42):
                add_cylinder(f"grab_pole_{row_i}_{pole_x}", 0.022, 2.05, 8, (pole_x, sy, 1.66), (0, 0, 0), mat_chrome, root)

    # Extended European Bus Wing Mirrors on sleek curved brackets
    for sx in (-1, 1):
        add_beveled_box(f"mirror_arm_{sx}", (0.28, 0.05, 0.05), (sx * 1.32, -5.85, 2.38), bevel_w=0.01, bevel_seg=1, mat=mat_dark, parent=root)
        add_beveled_box(f"mirror_head_{sx}", (0.14, 0.18, 0.44), (sx * 1.44, -5.94, 2.22), bevel_w=0.04, bevel_seg=3, mat=mat_dark, parent=root)

    # 3D Sculpted Recessed Headlight & Taillight Clusters + Roof Amber Marker LEDs
    for sx in (-1, 1):
        add_beveled_box(f"headlight_housing_{sx}", (0.42, 0.08, 0.22), (sx * 0.94, -5.99, 0.72), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)
        add_beveled_box(f"headlight_led_{sx}", (0.34, 0.06, 0.14), (sx * 0.94, -6.02, 0.72), bevel_w=0.02, bevel_seg=2, mat=mat_headlight, parent=root)
        add_beveled_box(f"taillight_{sx}", (0.22, 0.08, 0.54), (sx * 1.06, 6.02, 1.18), bevel_w=0.025, bevel_seg=2, mat=mat_taillight, parent=root)
        add_beveled_box(f"roof_marker_f_{sx}", (0.14, 0.06, 0.06), (sx * 1.04, -5.78, 2.98), bevel_w=0.015, bevel_seg=2, mat=mat_amber, parent=root)
        add_beveled_box(f"roof_marker_r_{sx}", (0.14, 0.06, 0.06), (sx * 1.04, 5.92, 2.96), bevel_w=0.015, bevel_seg=2, mat=mat_taillight, parent=root)

    # Named UV-mapped LED Route Destination Displays (swapped dynamically per TPG route in Three.js!)
    # Front LED header above windshield (facing -Y -> rot X = pi/2, Z = 0)
    add_uv_plane("led_front", 1.88, 0.34, (0, -5.84, 2.66), (math.pi * 0.5 + 0.14, 0, 0), mat_led_front, root)
    # Rear small route number LED
    add_uv_plane("led_rear", 0.56, 0.28, (0, 6.01, 2.74), (math.pi * 0.5, 0, math.pi), mat_led_front, root)
    # Side curb-facing LED + TPG branding plates
    add_uv_plane("led_side_r", 1.45, 0.26, (-1.28, -2.75, 2.52), (math.pi * 0.5, 0, -math.pi * 0.5), mat_led_side, root)
    add_uv_plane("led_side_l", 1.45, 0.26, ( 1.28, -2.75, 2.52), (math.pi * 0.5, 0,  math.pi * 0.5), mat_led_side, root)

    # 3D Sculpted Wheel Arch Flanges + 4 High-Poly Wheels (named wheel_fl/fr/rl/rr!)
    wheel_specs = [
        ("wheel_fl", ( 1.14, -3.45, 0.49)),
        ("wheel_fr", (-1.14, -3.45, 0.49)),
        ("wheel_rl", ( 1.14,  3.25, 0.49)),
        ("wheel_rr", (-1.14,  3.25, 0.49)),
    ]
    for wname, wloc in wheel_specs:
        # Dark sculpted rubber wheel arch lip
        arch = add_cylinder(wname + "_arch", 0.58, 0.14, 20, (wloc[0] * 1.07, wloc[1], 0.52), (0, math.pi / 2, 0), mat_dark, root)
        create_detailed_wheel(wname, wloc, radius=0.49, width=0.32, tire_mat=mat_tire, rim_mat=mat_rim, hub_mat=mat_dark, parent=root)

    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
    )
    print("Exported Blender TPG Bus:", export_path)

# ==============================================================================
# 2. HIGH-POLY GENEVA TPG STADLER TANGO ARTICULATED TRAM (public/models/tpg_tram.glb)
# 5 articulated modules with aerodynamic sloped Stadler cabs, interior seats, diamond pantograph!
# ==============================================================================
def build_tpg_tram(export_path):
    clear_scene()

    mat_white = make_mat("Tram_PearlWhite", (0.94, 0.95, 0.97), metallic=0.14, roughness=0.18, coat=0.95)
    mat_accent = make_mat("Tram_Accent", (0.23, 0.34, 0.66), metallic=0.18, roughness=0.22, coat=0.92) # Classic TPG Royal Blue (swappable to Orange!)
    mat_dark = make_mat("Tram_DarkTrim", (0.06, 0.07, 0.09), metallic=0.35, roughness=0.40)
    mat_bellow = make_mat("Tram_Bellow", (0.10, 0.11, 0.13), metallic=0.0, roughness=0.88)
    mat_glass = make_mat("Tram_Glass", (0.03, 0.07, 0.11), metallic=0.18, roughness=0.04, coat=1.0, alpha=0.72)
    mat_seat = make_mat("Tram_SeatOrange", (0.90, 0.36, 0.10), metallic=0.0, roughness=0.76)
    mat_headlight = make_mat("Tram_Headlight", (1.0, 0.97, 0.88), roughness=0.08, emission=(1.0, 0.96, 0.84), emission_strength=3.8)
    mat_taillight = make_mat("Tram_Taillight", (0.9, 0.06, 0.06), roughness=0.1, emission=(1.0, 0.08, 0.06), emission_strength=2.5)
    mat_steel = make_mat("Tram_Steel", (0.58, 0.62, 0.68), metallic=0.92, roughness=0.28)
    mat_led = make_mat("Tram_LED", (0.06, 0.07, 0.09), roughness=0.2)

    root = bpy.data.objects.new("TPG_Stadler_Tango_Tram", None)
    bpy.context.collection.objects.link(root)

    # 5 articulated modules along Y (-13.6 .. +13.6)
    mod_len = 6.2
    mod_gap = 0.68
    pitch = mod_len + mod_gap

    for idx in range(-2, 3):
        cy = idx * pitch
        # Lower sleek TPG colored skirt
        add_beveled_box(f"tram_skirt_{idx}", (2.34, mod_len, 0.72), (0, cy, 0.68), bevel_w=0.07, bevel_seg=3, mat=mat_accent, parent=root)
        # Bogie undercarriage & steel rail wheels
        add_beveled_box(f"tram_bogie_{idx}", (1.92, 2.2, 0.36), (0, cy, 0.28), bevel_w=0.03, bevel_seg=2, mat=mat_dark, parent=root)
        for wx in (-0.72, 0.72):
            for wy in (-0.75, 0.75):
                add_cylinder(f"tram_wheel_{idx}_{wx}_{wy}", 0.30, 0.12, 16, (wx, cy + wy, 0.30), (0, math.pi / 2, 0), mat_steel, root)
        # Upper white roofline crown + HVAC equipment shrouds
        add_beveled_box(f"tram_roof_{idx}", (2.32, mod_len, 0.42), (0, cy, 2.94), bevel_w=0.12, bevel_seg=4, mat=mat_white, parent=root)
        add_beveled_box(f"tram_hvac_{idx}", (1.68, 3.4, 0.26), (0, cy, 3.24), bevel_w=0.07, bevel_seg=3, mat=mat_white, parent=root)

        # Panoramic dark tinted glass sides + structural pillars + visible interior seats
        add_beveled_box(f"tram_glass_l_{idx}", (0.04, mod_len - 0.18, 1.66), (-1.14, cy, 1.88), bevel_w=0.0, bevel_seg=1, mat=mat_glass, parent=root)
        add_beveled_box(f"tram_glass_r_{idx}", (0.04, mod_len - 0.18, 1.66), ( 1.14, cy, 1.88), bevel_w=0.0, bevel_seg=1, mat=mat_glass, parent=root)
        for py in (-2.9, -1.0, 1.0, 2.9):
            for sx in (-1.15, 1.15):
                add_beveled_box(f"tram_pil_{idx}_{py}_{sx}", (0.07, 0.14, 1.72), (sx, cy + py, 1.88), bevel_w=0.015, bevel_seg=2, mat=mat_dark, parent=root)

        # 3D interior orange tram seats
        for sy in (-2.0, -0.7, 0.7, 2.0):
            for sx in (-0.78, 0.78):
                add_beveled_box(f"tseat_{idx}_{sy}_{sx}", (0.46, 0.42, 0.56), (sx, cy + sy, 1.24), bevel_w=0.03, bevel_seg=2, mat=mat_seat, parent=root)

        # Ribbed flexible accordion bellows connecting modules
        if idx < 2:
            by = cy + pitch * 0.5
            for rib in (-0.22, 0.0, 0.22):
                add_beveled_box(f"bellow_{idx}_{rib}", (2.14, 0.16, 2.66), (0, by + rib, 1.72), bevel_w=0.03, bevel_seg=2, mat=mat_bellow, parent=root)

    # Signature Aerodynamic Sloped Stadler Tango Double-Ended Nose Cabs (Front -Y & Rear +Y)
    for end_dir in (-1, 1):
        ey = end_dir * (2 * pitch + mod_len * 0.5)
        # Tapered curved TPG lower blue/orange nose apron
        add_beveled_box(f"cab_nose_{end_dir}", (2.22, 1.35, 0.88), (0, ey + end_dir * 0.62, 0.72), bevel_w=0.22, bevel_seg=5, mat=mat_accent, parent=root)
        # Sleek white side cowlings flanking the panoramic teardrop windshield
        for sx in (-1, 1):
            add_beveled_box(f"cab_cheek_{end_dir}_{sx}", (0.28, 1.25, 1.85), (sx * 1.02, ey + end_dir * 0.52, 2.02), rot=(end_dir * -0.18, 0, sx * end_dir * 0.12), bevel_w=0.09, bevel_seg=4, mat=mat_white, parent=root)
        # Raked curved panoramic Stadler windshield!
        add_beveled_box(f"cab_wind_{end_dir}", (1.92, 0.12, 1.82), (0, ey + end_dir * 0.96, 1.98), rot=(end_dir * -0.26, 0, 0), bevel_w=0.03, bevel_seg=2, mat=mat_glass, parent=root)
        # Roof aero dome fairing
        add_beveled_box(f"cab_brow_{end_dir}", (2.18, 1.05, 0.44), (0, ey + end_dir * 0.36, 2.92), rot=(end_dir * -0.18, 0, 0), bevel_w=0.14, bevel_seg=4, mat=mat_white, parent=root)
        # Twin round Stadler Tango headlights (matching tpg_tram_1.jpg!)
        for sx in (-0.72, 0.72):
            add_cylinder(f"tram_hl_{end_dir}_{sx}", 0.11, 0.12, 16, (sx, ey + end_dir * 1.24, 1.02), (math.pi / 2, 0, 0), mat_headlight if end_dir < 0 else mat_taillight, root)
        # Front LED route header inside top of windshield
        add_uv_plane(f"led_front_{'a' if end_dir < 0 else 'b'}", 1.48, 0.32, (0, ey + end_dir * 0.84, 2.74), (math.pi * 0.5 + (0.26 if end_dir < 0 else -0.26), 0, 0 if end_dir < 0 else math.pi), mat_led, root)

    # Articulated 3D Diamond Overhead Pantograph on Center Module!
    add_beveled_box("panto_base", (0.95, 1.15, 0.14), (0, 0, 3.42), bevel_w=0.02, bevel_seg=2, mat=mat_dark, parent=root)
    add_beveled_box("panto_lower_arm", (0.08, 1.45, 0.08), (0, -0.35, 3.92), rot=(-0.62, 0, 0), bevel_w=0.015, bevel_seg=2, mat=mat_steel, parent=root)
    add_beveled_box("panto_upper_arm", (0.08, 1.45, 0.08), (0, -0.35, 4.78), rot=(0.62, 0, 0), bevel_w=0.015, bevel_seg=2, mat=mat_steel, parent=root)
    # Dual curved carbon collector bow touching 5.45m overhead catenary wire!
    add_beveled_box("panto_bow_1", (1.68, 0.08, 0.06), (0, 0.14, 5.26), bevel_w=0.015, bevel_seg=2, mat=mat_dark, parent=root)
    add_beveled_box("panto_bow_2", (1.68, 0.08, 0.06), (0, 0.34, 5.26), bevel_w=0.015, bevel_seg=2, mat=mat_dark, parent=root)
    for sx in (-0.88, 0.88):
        add_beveled_box(f"panto_horn_{sx}", (0.26, 0.34, 0.05), (sx, 0.24, 5.18), rot=(0, sx * 0.42, 0), bevel_w=0.01, bevel_seg=2, mat=mat_steel, parent=root)

    bpy.ops.export_scene.gltf(
        filepath=export_path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
    )
    print("Exported Blender TPG Tram:", export_path)

if __name__ == "__main__":
    build_tpg_bus(r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\tpg_bus.glb")
    build_tpg_tram(r"C:\Users\sebas\.gemini\antigravity\scratch\geneva-open-world\public\models\tpg_tram.glb")
