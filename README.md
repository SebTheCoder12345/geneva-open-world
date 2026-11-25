# GENEVA — 1:1 Open-World Browser Sandbox

An interactive 3D open-world **1:1 real-scale Geneva** built with **Three.js**, **swisstopo** (`swissimage`, `pixelkarte-farbe`, `swissALTI3D`), **OpenStreetMap**, and **Poly Haven CC0** HDRI & PBR assets — inspired by [CROSSTOWN](https://nyc.somethingbig.ai/).

Walk the quays, drive a Ferrari across Pont du Mont-Blanc, board a yellow Mouette water taxi on Lac Léman, or fly a Swiss Rescue Helicopter past the 140 m Jet d'Eau — directly in your browser.

## Features
- **1:1 Real Geneva (2.23 km², Swiss LV95 metric scale):**
  - 2,378 real OpenStreetMap building footprints with 3D stone cornices, boutique awnings, sloped Geneva mansard roofs, PBR weathered limestone facades, and real `swisstopo` orthophoto rooftops.
  - 1,330 real named streets paved with photographed PBR asphalt, granite flagstone sidewalks, and cobblestones.
  - 1,315 real OSM street & park trees with branched bark trunks and alpha-cutout leaf canopies.
  - Real `swisstopo ALTI3D` elevation + pixel-accurate Lac Léman & Rhône water mask.
  - Landmarks at exact GPS coordinates: **Jet d'Eau** (140 m volumetric spray), **Pont du Mont-Blanc** with fluttering Swiss & Geneva flags, **Jardin Anglais & working Horloge Fleurie**, **Cathédrale Saint-Pierre**, **Île Rousseau**, **Bains des Pâquis & Le Phare**, and an articulated **TPG Tram**.
- **AAA WebGL Rendering:**
  - Three real 2K photographic Poly Haven HDRIs (**Day**, **Golden Sunset**, **Starry Night**) + dynamic streetlamp point lights at night.
  - `EffectComposer` with `GTAOPass` (Ground Truth Ambient Occlusion), `UnrealBloomPass`, ACES Filmic `OutputPass`, custom GTA filmic grading/vignette/chromatic aberration pass, and `SMAAPass` anti-aliasing.
  - 4096×4096 player-tracking soft shadows + custom GLSL Lac Léman water shader.
- **GTA Sandbox Gameplay:**
  - Real rigged human character & pedestrians, high-poly Ferrari 458 fleet (with suspension pitch/roll, drift tire smoke & brake lights), yellow Mouette boat (water wake), and Swiss Rescue Helicopter.
  - Wanted Stars (`★`–`★★★★★`) with active Geneva Police cruiser pursuit & Swiss two-tone Web Audio siren.
  - Official **swisstopo Swiss Topographic Map** in the circular minimap & full-screen `Tab` map (press `S` in map for Satellite toggle).

## Controls
| Key | Action |
| --- | --- |
| `W A S D` | Move / Drive / Fly |
| `Shift` | Sprint / Descend (Helicopter) |
| `Space` | Jump / Handbrake Drift / Ascend (Helicopter) |
| `F` | Enter / Exit Vehicle (Car, Mouette, Helicopter) |
| `E` | Nitro Boost (Car) / Yaw Right (Helicopter) |
| `X` | Grapple Hook (On Foot) |
| `R` | Cycle Geneva Radio Stations |
| `V` / `C` | Cycle Camera / Toggle GTA Cinematic Camera |
| `Tab` | Full-Screen 1:1 Swiss City Map (`S` toggles Satellite) |
| `Esc` / `P` | Pause & Settings Menu (Graphics, Rain, Time of Day, Audio) |
| `M` / `\` | Mute Sound / Full Screen |

## Run Locally
```bash
npm install
npm run dev
```

## Build for Production
```bash
npm run build
npm run preview
```

## Data & Asset Credits
- **swisstopo** (`ch.swisstopo.swissimage`, `ch.swisstopo.pixelkarte-farbe`, `swissALTI3D`)
- **OpenStreetMap** contributors (building footprints, roads, street names, trees)
- **Poly Haven** (CC0 2K HDRIs & PBR textures)
- **Three.js** example GLB models (`ferrari.glb`, `readyplayer.me.glb`)
