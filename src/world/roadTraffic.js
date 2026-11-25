import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { getGroundHeight } from './cityData.js';
import { createShadowBlobTexture } from './textures.js';
import { batchStaticGroup, batchVehicleTemplate } from './staticBatcher.js';

// Shared Blender GLB template cache so drivable TPG Bus + AI TPG Buses + Stadler Trams share pre-batched GPU buffers!
const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

let busTemplatePromise = null;
let tramTemplatePromise = null;
let carTemplatePromise = null;
let gwagonTemplatePromise = null;
let sedanTemplatePromise = null;
let vanTemplatePromise = null;
let vespaTemplatePromise = null;
let chargerTemplatePromise = null;
let porscheTemplatePromise = null;
let rs6TemplatePromise = null;

function preBatchBusTemplate(scene) {
  // Tag named dynamic-livery/LED/taillight parts with dedicated placeholder materials BEFORE merging 153 meshes -> ~18!
  const mAccent = new THREE.MeshStandardMaterial({ name: '__BUS_ACCENT' });
  const mLedFront = new THREE.MeshBasicMaterial({ name: '__BUS_LED_FRONT' });
  const mLedRear = new THREE.MeshBasicMaterial({ name: '__BUS_LED_REAR' });
  const mTail = new THREE.MeshStandardMaterial({ name: '__BUS_TAILLIGHT' });
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.name === 'body_lower' || obj.name === 'front_bumper' || obj.name === 'rear_bumper') {
      obj.material = mAccent;
    } else if (obj.name === 'led_front' || obj.name === 'led_side_l' || obj.name === 'led_side_r') {
      obj.material = mLedFront;
    } else if (obj.name === 'led_rear') {
      obj.material = mLedRear;
    } else if (obj.name.startsWith('taillight_')) {
      obj.material = mTail;
    }
  });
  return batchVehicleTemplate(scene, { label: 'TpgBusTpl' });
}

function preBatchTramTemplate(scene) {
  // Tag named dynamic-livery/LED parts BEFORE merging all 165 Stadler Tango meshes -> ~10 draw calls!
  const mAccent = new THREE.MeshStandardMaterial({ name: '__TRAM_ACCENT' });
  const mLed = new THREE.MeshBasicMaterial({ name: '__TRAM_LED' });
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    if (obj.name.startsWith('tram_skirt_') || obj.name.startsWith('cab_nose_')) {
      obj.material = mAccent;
    } else if (obj.name.startsWith('led_front_')) {
      obj.material = mLed;
    }
  });
  batchStaticGroup(scene, { label: 'TpgTramTpl', minMeshes: 2, disposeSource: true, staticMatrix: true });
  return scene;
}

function preBatchCarTemplate(scene, label) {
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  return batchVehicleTemplate(scene, { label });
}

export function loadBusTemplate() {
  if (!busTemplatePromise) {
    busTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/tpg_bus.glb', (g) => resolve(preBatchBusTemplate(g.scene)), undefined, () => resolve(null));
    });
  }
  return busTemplatePromise;
}

export function loadTramTemplate() {
  if (!tramTemplatePromise) {
    tramTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/tpg_tram.glb', (g) => resolve(preBatchTramTemplate(g.scene)), undefined, () => resolve(null));
    });
  }
  return tramTemplatePromise;
}

export function loadGwagonTemplate() {
  if (!gwagonTemplatePromise) {
    gwagonTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/suv_gwagon.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'GwagonTpl')), undefined, () => resolve(null));
    });
  }
  return gwagonTemplatePromise;
}

export function loadSedanTemplate() {
  if (!sedanTemplatePromise) {
    sedanTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/sedan_euro.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'SedanTpl')), undefined, () => resolve(null));
    });
  }
  return sedanTemplatePromise;
}

export function loadVanTemplate() {
  if (!vanTemplatePromise) {
    vanTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/van_swiss.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'VanTpl')), undefined, () => resolve(null));
    });
  }
  return vanTemplatePromise;
}

export function loadVespaTemplate() {
  if (!vespaTemplatePromise) {
    vespaTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/vespa_scooter.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'VespaTpl')), undefined, () => resolve(null));
    });
  }
  return vespaTemplatePromise;
}

export function loadChargerTemplate() {
  if (!chargerTemplatePromise) {
    chargerTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/dodge_charger.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'ChargerTpl')), undefined, () => resolve(null));
    });
  }
  return chargerTemplatePromise;
}

export function loadPorscheTemplate() {
  if (!porscheTemplatePromise) {
    porscheTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/porsche_911.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'PorscheTpl')), undefined, () => resolve(null));
    });
  }
  return porscheTemplatePromise;
}

export function loadRs6Template() {
  if (!rs6TemplatePromise) {
    rs6TemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/audi_rs6.glb', (g) => resolve(preBatchCarTemplate(g.scene, 'Rs6Tpl')), undefined, () => resolve(null));
    });
  }
  return rs6TemplatePromise;
}

// Cached Swiss Canton of Geneva Rear License Plate Texture (+ GE · 184 902 [Geneva Crest]) for Vespa & Hero Vehicles!
let _gePlateTex = null;
function getGenevaPlateTexture() {
  if (_gePlateTex) return _gePlateTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f4f7';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#181c22';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 120);
  // Swiss Cross crest (left)
  ctx.fillStyle = '#d52b1e';
  ctx.fillRect(16, 18, 36, 42);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 26, 8, 26);
  ctx.fillRect(21, 35, 26, 8);
  // Geneva Canton crest (right)
  ctx.fillStyle = '#ffd100';
  ctx.fillRect(204, 18, 18, 42);
  ctx.fillStyle = '#d52b1e';
  ctx.fillRect(222, 18, 18, 42);
  // Crisp bold Swiss license typography
  ctx.fillStyle = '#12151a';
  ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GE', 128, 56);
  ctx.font = 'bold 44px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('184 902', 128, 108);
  _gePlateTex = new THREE.CanvasTexture(c);
  _gePlateTex.colorSpace = THREE.SRGBColorSpace;
  _gePlateTex.anisotropy = 8;
  return _gePlateTex;
}

let _leatherBumpTex = null;
function getLeatherBumpTexture() {
  if (_leatherBumpTex) return _leatherBumpTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 100 + Math.floor(Math.sin(i * 0.37) * 28 + Math.cos(i * 0.91) * 24);
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  _leatherBumpTex = new THREE.CanvasTexture(c);
  _leatherBumpTex.wrapS = _leatherBumpTex.wrapT = THREE.RepeatWrapping;
  _leatherBumpTex.repeat.set(6, 6);
  return _leatherBumpTex;
}

// Cached shared vehicle PBR materials (avoids duplicating identical GPU shaders across 35+ Geneva cars/buses/trams!)
const _carPaintCache = new Map();
const _fallbackMatCache = new Map();
let _sharedVehMats = null;
function getSharedVehicleMats() {
  if (_sharedVehMats) return _sharedVehMats;
  _sharedVehMats = {
    vespaPaint: new THREE.MeshPhysicalMaterial({
      color: 0xd8121c,
      metalness: 0.34,
      roughness: 0.11,
      clearcoat: 1.0,
      clearcoatRoughness: 0.018,
      envMapIntensity: 2.1,
    }),
    chromeMat: new THREE.MeshPhysicalMaterial({
      color: 0xf4f7fa,
      metalness: 0.96,
      roughness: 0.05,
      clearcoat: 0.85,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.2,
    }),
    vespaSeatMat: new THREE.MeshStandardMaterial({
      color: 0x6e3d21, // Classic saddle-cognac Italian Vespa leather!
      roughness: 0.62,
      metalness: 0.04,
      bumpMap: getLeatherBumpTexture(),
      bumpScale: 0.012,
      envMapIntensity: 1.1,
    }),
    tireMat: new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.88,
      metalness: 0.02,
      envMapIntensity: 0.75,
    }),
    vespaHeadlightMat: new THREE.MeshPhysicalMaterial({
      color: 0xfff8e6,
      emissive: 0xffecc2,
      emissiveIntensity: 0.85,
      roughness: 0.04,
      metalness: 0.15,
      clearcoat: 1.0,
      envMapIntensity: 2.0,
    }),
    plateMat: new THREE.MeshStandardMaterial({
      map: getGenevaPlateTexture(),
      roughness: 0.32,
      metalness: 0.25,
      envMapIntensity: 1.2,
    }),
    plateBackingMat: new THREE.MeshStandardMaterial({
      color: 0xe6eaef,
      roughness: 0.35,
      metalness: 0.25,
    }),
    glassMat: new THREE.MeshPhysicalMaterial({
      color: 0x09131e,
      metalness: 0.28,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.0,
    }),
  };
  return _sharedVehMats;
}

function getCarPaintMat(colorHex) {
  let mat = _carPaintCache.get(colorHex);
  if (!mat) {
    mat = new THREE.MeshPhysicalMaterial({
      color: colorHex,
      metalness: 0.56,
      roughness: 0.13,
      clearcoat: 1.0,
      clearcoatRoughness: 0.025,
      envMapIntensity: 1.85,
    });
    _carPaintCache.set(colorHex, mat);
  }
  return mat;
}

function getSharedFallbackMat(origMat) {
  let cached = _fallbackMatCache.get(origMat.uuid);
  if (!cached) {
    cached = origMat.clone();
    cached.envMapIntensity = 1.45;
    _fallbackMatCache.set(origMat.uuid, cached);
  }
  return cached;
}

export function cloneStyledBlenderVehicle(template, colorHex) {
  const m = template.clone(true);
  const shared = getSharedVehicleMats();
  const paint = getCarPaintMat(colorHex);
  const wheelMeshes = [];
  const shadowMeshes = [];
  let tailMat = null;

  m.traverse((o) => {
    if (o.name === 'wheel_fl' || o.name === 'wheel_fr' || o.name === 'wheel_rl' || o.name === 'wheel_rr') {
      wheelMeshes.push(o);
    }
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    shadowMeshes.push(o);
    const matName = o.material?.name || '';
    if (o.name === 'license_plate') {
      o.material = shared.plateBackingMat;
      // Attach crisp planar-UV Swiss GE 184 902 license plate graphic cleanly on the rear (-Z) face!
      o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (bb) {
        const pw = Math.max(0.14, bb.max.x - bb.min.x);
        const ph = Math.max(0.085, bb.max.y - bb.min.y);
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.96, ph * 0.96), shared.plateMat);
        badge.position.set(
          (bb.min.x + bb.max.x) * 0.5,
          (bb.min.y + bb.max.y) * 0.5,
          bb.min.z - 0.004
        );
        badge.rotation.y = Math.PI;
        o.add(badge);
      }
    } else if (matName === 'VespaRed') {
      o.material = shared.vespaPaint;
    } else if (matName === 'CarPaint') {
      o.material = paint;
    } else if (matName === 'VespaChrome') {
      o.material = shared.chromeMat;
    } else if (matName === 'VespaSeat') {
      o.material = shared.vespaSeatMat;
    } else if (matName === 'VespaTire') {
      o.material = shared.tireMat;
    } else if (matName === 'VespaHeadlight') {
      o.material = shared.vespaHeadlightMat;
    } else if (matName === 'CarGlass' || matName === 'WindowGlass') {
      o.material = shared.glassMat;
    } else if (matName === 'Taillight' || matName === 'VespaTaillight') {
      if (!tailMat) {
        tailMat = new THREE.MeshPhysicalMaterial({
          color: 0xd91216,
          emissive: 0xff1616,
          emissiveIntensity: 2.3,
          roughness: 0.08,
          clearcoat: 1.0,
        });
      }
      o.material = tailMat;
    } else if (o.material) {
      o.material = getSharedFallbackMat(o.material);
    }
  });
  return { model: m, wheelMeshes, shadowMeshes, tailMat };
}

function loadCarTemplate() {
  if (!carTemplatePromise) {
    carTemplatePromise = new Promise((resolve) => {
      gltfLoader.load('/models/ferrari.glb', (g) => resolve(g.scene.children[0] || g.scene), undefined, () => resolve(null));
    });
  }
  return carTemplatePromise;
}

// Generate crisp glowing Amber LED Dot-Matrix Destination Display texture for Blender TPG Bus / Tram!
function createLedDisplayTexture(routeNum, dest, badgeColor = '#f26522', compact = false) {
  const w = compact ? 256 : 512;
  const h = 128;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#0a0d12';
  ctx.fillRect(0, 0, w, h);

  // Subtle LED matrix grid lines
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < h; y += 8) ctx.fillRect(0, y, w, 1);

  if (compact) {
    ctx.save();
    // Rear bus LED box face UV is vertically inverted in GLB; flip canvas Y so "25" reads upright!
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.fillStyle = badgeColor;
    ctx.fillRect(16, 16, w - 32, h - 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 68px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(routeNum, w * 0.5, h * 0.54);
    ctx.restore();
  } else {
    // Route badge box
    ctx.fillStyle = badgeColor;
    ctx.fillRect(12, 16, 108, h - 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(routeNum, 66, h * 0.54);

    // Glowing amber destination text
    ctx.fillStyle = '#ffb82e';
    ctx.font = 'bold 38px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(dest, 136, h * 0.54);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const _busAccentCache = new Map();
const _tramAccentCache = new Map();
const _busGlassCache = new Map();
const _tramGlassCache = new Map();

// Configure a cloned pre-batched Blender TPG Mercedes Citaro C2 Bus with custom route LED, livery color & spinning wheels!
export function setupBlenderTpgBus(template, routeNum = '25', dest = 'JARDIN BOTANIQUE', badgeColor = '#d44292', liveryHex = 0xf26522) {
  const model = template.clone(true);
  const wheelMeshes = [];
  const shadowMeshes = [];
  let tailMat = null;

  let accentMat = _busAccentCache.get(liveryHex);
  if (!accentMat) {
    accentMat = new THREE.MeshPhysicalMaterial({
      color: liveryHex,
      metalness: 0.16,
      roughness: 0.22,
      clearcoat: 0.92,
      clearcoatRoughness: 0.06,
    });
    _busAccentCache.set(liveryHex, accentMat);
  }
  const ledFrontTex = createLedDisplayTexture(routeNum, dest, badgeColor, false);
  const ledRearTex = createLedDisplayTexture(routeNum, dest, badgeColor, true);
  const ledFrontMat = new THREE.MeshBasicMaterial({ map: ledFrontTex });
  const ledRearMat = new THREE.MeshBasicMaterial({ map: ledRearTex });

  model.traverse((obj) => {
    if (obj.name === 'wheel_fl' || obj.name === 'wheel_fr' || obj.name === 'wheel_rl' || obj.name === 'wheel_rr') {
      wheelMeshes.push(obj);
    }
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    shadowMeshes.push(obj);

    const mName = obj.material?.name || '';
    if (mName === '__BUS_ACCENT' || obj.name === 'body_lower' || obj.name === 'front_bumper' || obj.name === 'rear_bumper') {
      obj.material = accentMat;
    } else if (mName === '__BUS_LED_FRONT' || obj.name === 'led_front' || obj.name === 'led_side_l' || obj.name === 'led_side_r') {
      obj.material = ledFrontMat;
    } else if (mName === '__BUS_LED_REAR' || obj.name === 'led_rear') {
      obj.material = ledRearMat;
    } else if (mName === '__BUS_TAILLIGHT' || obj.name.startsWith('taillight_')) {
      if (!tailMat) {
        tailMat = new THREE.MeshStandardMaterial({
          color: 0xd91818,
          emissive: 0xff1414,
          emissiveIntensity: 1.6,
          roughness: 0.14,
        });
      }
      obj.material = tailMat;
    } else if (obj.material && mName === 'TPG_TintedGlass') {
      let gm = _busGlassCache.get(obj.material.uuid);
      if (!gm) {
        gm = obj.material.clone();
        gm.transparent = true;
        gm.opacity = 0.24;
        gm.depthWrite = false;
        gm.roughness = 0.08;
        gm.metalness = 0.12;
        gm.envMapIntensity = 0.35;
        _busGlassCache.set(obj.material.uuid, gm);
      }
      obj.material = gm;
    }
  });

  if (!tailMat) tailMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff1111, emissiveIntensity: 1.4 });
  return { model, wheelMeshes, shadowMeshes, tailMat };
}

// Configure a cloned pre-batched Blender Stadler Tango Tram with route LED & authentic Geneva livery!
function setupBlenderTpgTram(template, routeNum = '14', dest = 'MEYRIN', badgeColor = '#6c3fb5', liveryHex = 0x3852a4) {
  const model = template.clone(true);
  const shadowMeshes = [];
  let accentMat = _tramAccentCache.get(liveryHex);
  if (!accentMat) {
    accentMat = new THREE.MeshPhysicalMaterial({
      color: liveryHex,
      metalness: 0.18,
      roughness: 0.2,
      clearcoat: 0.94,
      clearcoatRoughness: 0.05,
    });
    _tramAccentCache.set(liveryHex, accentMat);
  }
  const ledTex = createLedDisplayTexture(routeNum, dest, badgeColor, false);
  const ledMat = new THREE.MeshBasicMaterial({ map: ledTex });

  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    shadowMeshes.push(obj);
    const mName = obj.material?.name || '';
    if (mName === '__TRAM_ACCENT' || obj.name.startsWith('tram_skirt_') || obj.name.startsWith('cab_nose_')) {
      obj.material = accentMat;
    } else if (mName === '__TRAM_LED' || obj.name.startsWith('led_front_')) {
      obj.material = ledMat;
    } else if (obj.material && mName === 'Tram_Glass') {
      let gm = _tramGlassCache.get(obj.material.uuid);
      if (!gm) {
        gm = obj.material.clone();
        gm.transparent = true;
        gm.opacity = 0.24;
        gm.depthWrite = false;
        gm.roughness = 0.08;
        gm.metalness = 0.12;
        gm.envMapIntensity = 0.35;
        _tramGlassCache.set(obj.material.uuid, gm);
      }
      obj.material = gm;
    }
  });
  return { model, shadowMeshes };
}

// =================================================================================================
// 1:1 OSM ROAD POLYLINE STITCHER & ARC-LENGTH SPLINE SAMPLER
// Guarantees every car, bus, and tram follows the EXACT 1:1 Swiss roads & curves of Geneva!
// =================================================================================================
function buildPolylineMeta(pts) {
  const clean = [];
  for (const p of pts) {
    if (clean.length === 0 || Math.hypot(p[0] - clean[clean.length - 1][0], p[1] - clean[clean.length - 1][1]) > 0.6) {
      clean.push(p);
    }
  }
  const cumLen = [0];
  for (let i = 1; i < clean.length; i++) {
    cumLen.push(cumLen[i - 1] + Math.hypot(clean[i][0] - clean[i - 1][0], clean[i][1] - clean[i - 1][1]));
  }
  return { pts: clean, cumLen, totalLen: cumLen[cumLen.length - 1] || 0 };
}

function stitchRoadChains(roads, nameRegex, allowedKinds) {
  const segs = [];
  for (const r of roads || []) {
    if (!r.n || !r.p || r.p.length < 2) continue;
    if (!nameRegex.test(r.n)) continue;
    if (allowedKinds && !allowedKinds.includes(r.k)) continue;
    segs.push(r.p.slice());
  }

  const used = new Uint8Array(segs.length);
  const chains = [];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    let chain = segs[i].slice();
    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < segs.length; j++) {
        if (used[j]) continue;
        const s = segs[j];
        const cH = chain[0], cT = chain[chain.length - 1];
        const sH = s[0], sT = s[s.length - 1];
        if (dist(cT, sH) < 5.5) { chain = chain.concat(s.slice(1)); used[j] = 1; changed = true; }
        else if (dist(cT, sT) < 5.5) { chain = chain.concat(s.slice(0, -1).reverse()); used[j] = 1; changed = true; }
        else if (dist(cH, sT) < 5.5) { chain = s.slice(0, -1).concat(chain); used[j] = 1; changed = true; }
        else if (dist(cH, sH) < 5.5) { chain = s.slice(1).reverse().concat(chain); used[j] = 1; changed = true; }
      }
    }
    chains.push(buildPolylineMeta(chain));
  }

  // Second pass: join collinear gaps across intersections (up to 34m!) so avenues stay long and continuous!
  let merged = true;
  while (merged) {
    merged = false;
    chains.sort((a, b) => b.totalLen - a.totalLen);
    outer: for (let i = 0; i < chains.length; i++) {
      if (chains[i].totalLen < 25) continue;
      for (let j = i + 1; j < chains.length; j++) {
        if (chains[j].totalLen < 25) continue;
        const a = chains[i].pts;
        const b = chains[j].pts;
        const aTailDir = [a[a.length - 1][0] - a[a.length - 2][0], a[a.length - 1][1] - a[a.length - 2][1]];
        const aTailLen = Math.hypot(aTailDir[0], aTailDir[1]) || 1;
        aTailDir[0] /= aTailLen; aTailDir[1] /= aTailLen;

        const candidates = [
          { gap: dist(a[a.length - 1], b[0]), from: a[a.length - 1], to: b[0], next: b[1], mode: 'TH' },
          { gap: dist(a[a.length - 1], b[b.length - 1]), from: a[a.length - 1], to: b[b.length - 1], next: b[b.length - 2], mode: 'TT' },
        ];
        for (const c of candidates) {
          if (c.gap < 34) {
            const gx = (c.to[0] - c.from[0]) / (c.gap || 1);
            const gz = (c.to[1] - c.from[1]) / (c.gap || 1);
            const nx = c.next[0] - c.to[0];
            const nz = c.next[1] - c.to[1];
            const nl = Math.hypot(nx, nz) || 1;
            const align1 = aTailDir[0] * gx + aTailDir[1] * gz;
            const align2 = aTailDir[0] * (nx / nl) + aTailDir[1] * (nz / nl);
            if (align1 > 0.62 && align2 > 0.55) {
              const joined = c.mode === 'TH' ? a.concat(b) : a.concat(b.slice().reverse());
              chains[i] = buildPolylineMeta(joined);
              chains.splice(j, 1);
              merged = true;
              break outer;
            }
          }
        }
      }
    }
  }

  return chains.filter((c) => c.totalLen >= 140).sort((a, b) => b.totalLen - a.totalLen);
}

// Zero-GC reusable output for sampleRoute (called 34x/frame!)
const _sampleOut = { x: 0, z: 0, yaw: 0, fx: 0, fz: 1 };

function samplePointAt(route, d, outIdx) {
  const cl = route.cumLen;
  let l = 0, h = cl.length - 2;
  while (l < h) {
    const m = (l + h + 1) >> 1;
    if (cl[m] <= d) l = m;
    else h = m - 1;
  }
  const sl = Math.max(0.001, cl[l + 1] - cl[l]);
  const u = (d - cl[l]) / sl;
  const p0 = route.pts[l];
  const p1 = route.pts[l + 1];
  _samplePtBuf[outIdx] = p0[0] + (p1[0] - p0[0]) * u;
  _samplePtBuf[outIdx + 1] = p0[1] + (p1[1] - p0[1]) * u;
}
const _samplePtBuf = new Float64Array(4);

// Sample smooth exact position, tangent yaw & right-hand Swiss lane offset along a stitched 1:1 road polyline!
function sampleRoute(route, distMeters, dir = 1, laneOffset = 2.0) {
  const clamped = Math.max(0.5, Math.min(route.totalLen - 0.5, distMeters));
  const cl = route.cumLen;
  let lo = 0, hi = cl.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cl[mid] <= clamped) lo = mid;
    else hi = mid - 1;
  }
  const segLen = Math.max(0.001, cl[lo + 1] - cl[lo]);
  const t = (clamped - cl[lo]) / segLen;
  const p0 = route.pts[lo];
  const p1 = route.pts[lo + 1];

  const bx = p0[0] + (p1[0] - p0[0]) * t;
  const bz = p0[1] + (p1[1] - p0[1]) * t;

  // Look-ahead smoothing (7m window) eliminates jerky vertex snapping at polyline corners!
  const lookD = 7.0;
  const dAhead = Math.min(route.totalLen - 0.2, clamped + lookD * dir);
  const dBack = Math.max(0.2, clamped - lookD * dir);
  samplePointAt(route, dBack, 0);
  samplePointAt(route, dAhead, 2);
  let fx = _samplePtBuf[2] - _samplePtBuf[0];
  let fz = _samplePtBuf[3] - _samplePtBuf[1];
  const fl = Math.hypot(fx, fz) || 1;
  fx /= fl;
  fz /= fl;

  // Swiss right-hand driving side offset: right vector of (fx, fz) in Y-up Three.js is (-fz, fx)!
  const rx = -fz;
  const rz = fx;

  _sampleOut.x = bx + rx * laneOffset;
  _sampleOut.z = bz + rz * laneOffset;
  _sampleOut.yaw = Math.atan2(fx, fz);
  _sampleOut.fx = fx;
  _sampleOut.fz = fz;
  return _sampleOut;
}

// =================================================================================================
// BUILD LIVING 1:1 ROAD-FOLLOWING GENEVA TRAFFIC NETWORK (Cars + Blender TPG Buses + Blender Trams!)
// =================================================================================================
export function createRoadTrafficNetwork(worldGroup, realData, insertCollider = null) {
  const trafficGroup = new THREE.Group();
  trafficGroup.name = 'Geneva_AI_Road_Traffic';
  worldGroup.add(trafficGroup);
  const routes = [];

  const rLakeside = stitchRoadChains(
    realData.roads,
    /Pont du Mont-Blanc|Quai du Mont-Blanc|Quai du Général-Guisan|Quai Gustave-Ador/,
    ['primary', 'secondary', 'trunk', 'unclassified']
  );
  const rRhone = stitchRoadChains(
    realData.roads,
    /Rue du Rhône|Cours de Rive/,
    ['primary', 'secondary', 'tertiary', 'unclassified', 'residential']
  );
  const rHelvetique = stitchRoadChains(
    realData.roads,
    /Boulevard Helvétique/,
    ['primary', 'secondary']
  );
  const rMontBlanc = stitchRoadChains(
    realData.roads,
    /Rue du Mont-Blanc|Rue des Alpes|Rue de Lausanne/,
    ['primary', 'secondary']
  );

  for (const r of [...rLakeside.slice(0, 3), ...rRhone.slice(0, 2), ...rHelvetique.slice(0, 1), ...rMontBlanc.slice(0, 1)]) {
    routes.push(r);
  }

  // Build instanced embedded twin grooved TPG steel tram rails + overhead tensioned catenary wires, cross-span cables & masts!
  const tramRoute = rRhone[0] || routes[0];
  const railMat = new THREE.MeshStandardMaterial({ color: 0x767e88, metalness: 0.88, roughness: 0.28 });
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1e2228 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x1c3428, roughness: 0.42, metalness: 0.78 });

  if (tramRoute && tramRoute.pts.length >= 2) {
    const railItems = [];
    const wireItems = [];
    const mastItems = [];
    for (let i = 0; i < tramRoute.pts.length - 1; i++) {
      const [x1, z1] = tramRoute.pts[i];
      const [x2, z2] = tramRoute.pts[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 1.2) continue;
      const ang = Math.atan2(dx, dz);
      const rx = -dz / segLen;
      const rz = dx / segLen;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const my = getGroundHeight(mx, mz);

      for (const laneOff of [-1.7, 1.7]) {
        const wx = mx + rx * laneOff;
        const wz = mz + rz * laneOff;
        // Lower contact wire + upper catenary messenger wire!
        wireItems.push({ x: wx, y: my + 5.55, z: wz, len: segLen + 0.2, ang });
        wireItems.push({ x: wx, y: my + 6.18, z: wz, len: segLen + 0.2, ang });

        for (const rOff of [-0.52, 0.52]) {
          const rpx = mx + rx * (laneOff + rOff);
          const rpz = mz + rz * (laneOff + rOff);
          railItems.push({ x: rpx, y: getGroundHeight(rpx, rpz) + 0.30, z: rpz, len: segLen + 0.15, ang });
        }
      }
      if (i % 3 === 0) {
        for (const side of [-1, 1]) {
          const cx = x1 + rx * 4.5 * side;
          const cz = z1 + rz * 4.5 * side;
          mastItems.push({ x: cx, y: getGroundHeight(cx, cz), z: cz, ang });
        }
        // Overhead cross-street suspension cable tying both catenary masts together!
        wireItems.push({ x: x1, y: getGroundHeight(x1, z1) + 5.88, z: z1, len: 9.0, ang: ang + Math.PI * 0.5 });
      }
    }

    const td = new THREE.Object3D();
    if (railItems.length > 0) {
      const rMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.085, 0.045, 1.0), railMat, railItems.length);
      railItems.forEach((it, idx) => {
        td.position.set(it.x, it.y, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, it.len);
        td.updateMatrix();
        rMesh.setMatrixAt(idx, td.matrix);
      });
      worldGroup.add(rMesh);
    }
    if (wireItems.length > 0) {
      const wMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.032, 0.032, 1.0), wireMat, wireItems.length);
      wireItems.forEach((it, idx) => {
        td.position.set(it.x, it.y, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, it.len);
        td.updateMatrix();
        wMesh.setMatrixAt(idx, td.matrix);
      });
      worldGroup.add(wMesh);
    }
    if (mastItems.length > 0) {
      const mMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.125, 6.4, 8), mastMat, mastItems.length);
      mMesh.castShadow = true;
      mastItems.forEach((it, idx) => {
        td.position.set(it.x, it.y + 3.2, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, 1);
        td.updateMatrix();
        mMesh.setMatrixAt(idx, td.matrix);
        if (insertCollider) {
          insertCollider({ kind: 'cyl', x: it.x, z: it.z, r: 0.18, maxY: it.y + 6.4, walkableTop: false });
        }
      });
      worldGroup.add(mMesh);
    }
  }

  // Spawn 27 Varied Realistic Geneva Road-Following Vehicles:
  // Mercedes G-Wagon SUVs, Modern European Sedans, Swiss Post & Commercial Vans, Porsche 911 GT3, Audi RS6 & Dodge Charger SRT!
  const trafficEntities = [];
  const fleetConfigs = [
    { vtype: 'gwagon', color: 0xf4f6f9 }, // Pearl White G-Wagon (Reference 1!)
    { vtype: 'sedan',  color: 0xbcc4cf }, // Metallic Silver Euro Sedan (Reference 3!)
    { vtype: 'van',    color: 0xffcc00 }, // Iconic Swiss Post Yellow Van!
    { vtype: 'gwagon', color: 0x161a20 }, // Obsidian Black Geneva G-Wagon
    { vtype: 'sedan',  color: 0x1a2d4a }, // Midnight Navy Executive Sedan
    { vtype: 'porsche',color: 0x9e1820 }, // Crimson Porsche 911 GT3
    { vtype: 'sedan',  color: 0x262a30 }, // Graphite Sedan
    { vtype: 'charger', color: 0xb8141a }, // TorRed Dodge Charger SRT Widebody!
    { vtype: 'van',     color: 0x204a78 }, // Blue Utility Delivery Van (Reference 1!)
    { vtype: 'porsche', color: 0xe6b800 }, // Guards Racing Yellow Porsche 911 GT3!
    { vtype: 'rs6',     color: 0x5c6470 }, // Nardo Grey Audi RS6 Avant!
    { vtype: 'gwagon',  color: 0x3b444f }, // Slate Grey G-Wagon
    { vtype: 'charger', color: 0x181c22 }, // Pitch Black Dodge Charger SRT Hellcat!
    { vtype: 'sedan',   color: 0xdcd7cc }, // Champagne Swiss Sedan
    { vtype: 'van',     color: 0xf0f2f5 }, // White Delivery Van
    { vtype: 'porsche', color: 0xd6dce4 }, // GT Silver Porsche 911 GT3!
    { vtype: 'gwagon',  color: 0x18382c }, // British Racing Green G-Wagon
    { vtype: 'rs6',     color: 0x1e3052 }, // Navarra Blue Audi RS6 Avant!
    { vtype: 'rs6',     color: 0xd8dee8 }, // Glacier Silver Audi RS6 Avant
    { vtype: 'charger', color: 0x1d4d8f }, // Frostbite Blue Dodge Charger SRT!
    { vtype: 'sedan',   color: 0x6b202a }, // Burgundy Euro Sedan
    { vtype: 'van',     color: 0xffcc00 }, // Swiss Post Yellow Van
    { vtype: 'gwagon',  color: 0xf2f4f7 }, // White G-Wagon
    { vtype: 'porsche', color: 0xc91a1a }, // Guards Red Porsche 911 GT3!
    { vtype: 'sedan',   color: 0x4b5666 }, // Steel Blue Euro Sedan
    { vtype: 'porsche', color: 0x1c2028 }, // Jet Black Porsche 911 GT3
    { vtype: 'sedan',   color: 0xe6e8ec }, // White Euro Sedan
  ];
  const carHolders = [];
  const trafficShadowMat = new THREE.MeshBasicMaterial({
    map: createShadowBlobTexture(),
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const vtypeLabels = {
    charger: 'DODGE CHARGER SRT',
    porsche: 'PORSCHE 911 GT3',
    rs6: 'AUDI RS6 AVANT',
    gwagon: 'MERCEDES G-WAGON',
    ferrari: 'FERRARI 458',
    van: 'SWISS POST VAN',
    sedan: 'SWISS LUXURY SEDAN',
  };
  for (let i = 0; i < fleetConfigs.length; i++) {
    const route = routes[i % routes.length];
    if (!route) continue;
    const fc = fleetConfigs[i];
    const holder = new THREE.Group();
    const sW = fc.vtype === 'van' ? 2.9 : 2.75;
    const sL = fc.vtype === 'van' ? 6.2 : 5.4;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(sW, sL).rotateX(-Math.PI / 2), trafficShadowMat);
    sh.position.y = 0.05;
    sh.name = 'contactShadow';
    holder.add(sh);
    trafficGroup.add(holder);
    const dir = i % 2 === 0 ? 1 : -1;
    const entity = {
      kind: 'car',
      vtype: fc.vtype,
      label: vtypeLabels[fc.vtype] || 'GENEVA CAR',
      mesh: holder,
      route,
      dist: ((i * 0.17 + 0.06) % 0.92) * route.totalLen,
      dir,
      laneOffset: 2.0,
      baseSpeed: fc.vtype === 'van' ? 9.5 : 10.5 + (i % 4) * 1.6,
      speed: 10.5,
      x: 0,
      y: 2,
      z: 0,
      yaw: 0,
      halfW: fc.vtype === 'van' ? 1.12 : 1.05,
      halfL: fc.vtype === 'van' ? 2.75 : fc.vtype === 'charger' || fc.vtype === 'rs6' ? 2.55 : 2.38,
      height: fc.vtype === 'van' ? 2.4 : fc.vtype === 'gwagon' ? 2.0 : 1.5,
      wheels: [],
      shadowMeshes: [],
      _castShadow: true,
      tailMat: null,
      color: fc.color,
    };
    trafficEntities.push(entity);
    carHolders.push(entity);
  }

  // Spawn 5 Pre-Batched High-Poly Blender-Rendered Geneva TPG City Buses following exact 1:1 Geneva roads!
  // Mix of modern 2025 Geneva White+Orange livery (#f26522) and classic White+TPG Royal Blue (#3852a4)!
  const busSpecs = [
    { routeIdx: 0, num: '25', dest: 'JARDIN BOTANIQUE', badge: '#d44292', livery: 0xf26522, dir: 1, frac: 0.14 },
    { routeIdx: 0, num: '6',  dest: 'VERNIER',          badge: '#0077b6', livery: 0x3852a4, dir: -1, frac: 0.72 },
    { routeIdx: 1, num: '8',  dest: 'VEYRIER',          badge: '#1f7a4c', livery: 0xf26522, dir: 1, frac: 0.28 },
    { routeIdx: 2, num: '10', dest: 'AÉROPORT',         badge: '#0096c7', livery: 0x3852a4, dir: -1, frac: 0.55 },
    { routeIdx: 3, num: '20', dest: 'BEL-AIR',          badge: '#e07a5f', livery: 0xf26522, dir: 1, frac: 0.42 },
  ];
  const busEntities = [];
  for (const bs of busSpecs) {
    const route = routes[bs.routeIdx % routes.length];
    if (!route) continue;
    const holder = new THREE.Group();
    const bsh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 12.8).rotateX(-Math.PI / 2), trafficShadowMat);
    bsh.position.y = 0.05;
    bsh.name = 'contactShadow';
    holder.add(bsh);
    trafficGroup.add(holder);
    const entity = {
      kind: 'bus',
      vtype: 'bus',
      label: `TPG BUS · LIGNE ${bs.num}`,
      dest: bs.dest,
      spec: bs,
      mesh: holder,
      route,
      dist: bs.frac * route.totalLen,
      dir: bs.dir,
      laneOffset: 2.35,
      baseSpeed: 8.8,
      maxSpeed: 15.0,
      speed: 8.5,
      stopTimer: 0,
      lastStopIdx: -1,
      x: 0,
      y: 2,
      z: 0,
      yaw: 0,
      halfW: 1.35,
      halfL: 6.1,
      height: 3.3,
      wheels: [],
      shadowMeshes: [],
      _castShadow: true,
      tailMat: null,
    };
    trafficEntities.push(entity);
    busEntities.push(entity);
  }

  // Spawn 3 Pre-Batched High-Poly Blender-Rendered 5-Module Stadler Tango TPG Trams following exact 1:1 Rue du Rhône rails!
  const tramSpecs = [
    { num: '12', dest: 'PALETTES',         badge: '#e68a00', livery: 0xf26522, dir: 1,  frac: 0.20 },
    { num: '14', dest: 'MEYRIN',           badge: '#6c3fb5', livery: 0x3852a4, dir: -1, frac: 0.56 },
    { num: '17', dest: 'LANCY-PONT-ROUGE', badge: '#0095a8', livery: 0xf26522, dir: 1,  frac: 0.84 },
  ];
  const tramEntities = [];
  if (tramRoute) {
    for (const ts of tramSpecs) {
      const holder = new THREE.Group();
      trafficGroup.add(holder);
      const entity = {
        kind: 'tram',
        vtype: 'tram',
        label: `TPG TRAM · LIGNE ${ts.num}`,
        dest: ts.dest,
        spec: ts,
        mesh: holder,
        route: tramRoute,
        dist: ts.frac * tramRoute.totalLen,
        dir: ts.dir,
        laneOffset: 1.7,
        baseSpeed: 9.2,
        maxSpeed: 16.5,
        speed: 9.0,
        stopTimer: 0,
        lastStopIdx: -1,
        x: 0,
        y: 2,
        z: 0,
        yaw: 0,
        halfW: 1.28,
        halfL: 17.6,
        height: 3.6,
        wheels: [],
        shadowMeshes: [],
        _castShadow: true,
      };
      trafficEntities.push(entity);
      tramEntities.push(entity);
    }
  }

  // Load all 6 pre-batched realistic Blender/GLB vehicle templates asynchronously into holders!
  Promise.all([
    loadGwagonTemplate(),
    loadSedanTemplate(),
    loadVanTemplate(),
    loadChargerTemplate(),
    loadPorscheTemplate(),
    loadRs6Template(),
  ]).then(([gwagonTpl, sedanTpl, vanTpl, chargerTpl, porscheTpl, rs6Tpl]) => {
    for (const ac of carHolders) {
      const tpl =
        ac.vtype === 'gwagon'
          ? gwagonTpl
          : ac.vtype === 'van'
          ? vanTpl
          : ac.vtype === 'charger'
          ? chargerTpl
          : ac.vtype === 'porsche'
          ? porscheTpl
          : ac.vtype === 'rs6'
          ? rs6Tpl
          : sedanTpl;
      if (!tpl) continue;
      const built = cloneStyledBlenderVehicle(tpl, ac.color);
      ac.mesh.add(built.model);
      ac.wheels = built.wheelMeshes;
      ac.shadowMeshes = built.shadowMeshes;
      ac.tailMat = built.tailMat;
    }
  });

  loadBusTemplate().then((tpl) => {
    if (!tpl) return;
    for (const ab of busEntities) {
      const built = setupBlenderTpgBus(tpl, ab.spec.num, ab.spec.dest, ab.spec.badge, ab.spec.livery);
      ab.mesh.add(built.model);
      ab.wheels = built.wheelMeshes;
      ab.shadowMeshes = built.shadowMeshes;
      ab.tailMat = built.tailMat;
    }
  });

  loadTramTemplate().then((tpl) => {
    if (!tpl) return;
    for (const tr of tramEntities) {
      const built = setupBlenderTpgTram(tpl, tr.spec.num, tr.spec.dest, tr.spec.badge, tr.spec.livery);
      tr.mesh.add(built.model);
      tr.shadowMeshes = built.shadowMeshes;
    }
  });

  // Real 1:1 Geneva TPG stops for authentic passenger stop pauses & chime announcements
  const GENEVA_TRANSIT_STOPS = [
    { name: 'Bel-Air',           x: -302, z: 214 },
    { name: 'Place du Molard',   x: -135, z: 222 },
    { name: 'Longemalle',        x: -45,  z: 245 },
    { name: 'Rive',              x: 105,  z: 298 },
    { name: 'Jardin Anglais',    x: 52,   z: 185 },
    { name: 'Pont du Mont-Blanc',x: -85,  z: 112 },
    { name: 'Quai des Bergues',  x: -145, z: -158 },
    { name: 'Place des Alpes',   x: -55,  z: -245 },
    { name: 'Quai Gustave-Ador', x: 265,  z: 205 },
  ];

  // Update all road-following cars, buses & trams with smooth heading, transit stop pauses, player hail-braking, obstacle awareness & manual rail driving!
  function update(dt, elapsed, nightFactor, activePos = null, riderState = null, obstacleVehicles = null) {
    const ax = activePos ? activePos.x : 0;
    const az = activePos ? activePos.z : 0;
    const hasFocus = !!activePos;
    const riddenEntity = riderState?.entity || null;
    const playerOnFoot = !riderState?.inVehicle;

    for (let i = 0; i < trafficEntities.length; i++) {
      const e = trafficEntities[i];
      const isRidden = e === riddenEntity;
      const isManualTram = isRidden && e.kind === 'tram' && riderState?.mode === 'drive';

      let targetSpeed = e.baseSpeed;
      let isBraking = false;

      if (e.impactStopTimer > 0) {
        e.impactStopTimer = Math.max(0, e.impactStopTimer - dt);
      }

      if (isManualTram) {
        // Authentic rail-bound Stadler Tango electric traction controls (W forward, S brake/reverse, SPACE magnetic rail brake!)
        const k = riderState.keys || {};
        const throttle = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
        const railBrake = !!k.Space;
        const maxFwd = e.maxSpeed || 16.5;
        const maxRev = -11.0;

        if (railBrake) {
          const decel = 26 * dt;
          if (Math.abs(e.speed) <= decel) e.speed = 0;
          else e.speed -= Math.sign(e.speed) * decel;
          isBraking = true;
        } else if (throttle > 0) {
          const accel = e.speed < 0 ? 18.0 : 8.5;
          e.speed = Math.min(maxFwd, e.speed + accel * dt);
          if (e.speed < 0) isBraking = true;
        } else if (throttle < 0) {
          const decel = e.speed > 0 ? 17.5 : 7.5;
          e.speed = Math.max(maxRev, e.speed - decel * dt);
          if (e.speed > 0) isBraking = true;
        } else {
          // Gentle electric coasting drag along steel rails
          e.speed *= Math.pow(0.45, dt);
          if (Math.abs(e.speed) < 0.06) e.speed = 0;
        }

        e.dist += e.speed * dt * e.dir;
        if (e.dist >= e.route.totalLen - 6) {
          e.dist = e.route.totalLen - 6;
          if (e.speed * e.dir > 0) e.speed = 0;
        } else if (e.dist <= 6) {
          e.dist = 6;
          if (e.speed * e.dir < 0) e.speed = 0;
        }
      } else {
        // Smart GTA traffic & TPG transit obstacle braking + polite player hail-stop for buses & trams!
        const fx = Math.sin(e.yaw);
        const fz = Math.cos(e.yaw);

        if (hasFocus && !isRidden) {
          const dx = ax - e.x;
          const dz = az - e.z;
          const ahead = dx * fx + dz * fz;
          const lat = Math.abs(-dx * fz + dz * fx);

          if (e.kind === 'bus' || e.kind === 'tram') {
            // Polite TPG boarding hail: when player is on foot near a bus/tram hull, slow smoothly and stop by the doors!
            if (playerOnFoot && Math.abs(ahead) < e.halfL + 3.2 && lat < e.halfW + 4.4) {
              targetSpeed = 0;
            } else if (playerOnFoot && ahead > -e.halfL && ahead < e.halfL + 11.5 && lat < e.halfW + 6.0) {
              targetSpeed = Math.min(targetSpeed, 2.8);
            } else if (ahead > e.halfL - 0.5 && ahead < e.halfL + 12.5 && lat < e.halfW + 1.45) {
              targetSpeed = 0;
            }
          } else if (ahead > e.halfL - 0.5 && ahead < e.halfL + 11.5 && lat < e.halfW + 1.45) {
            targetSpeed = 0;
          }
        }

        // Maintain safe following gap behind vehicles ahead on the same corridor (buses & cars)
        if (e.kind !== 'tram') {
          if (e.impactStopTimer > 0) targetSpeed = 0;
          for (let j = 0; j < trafficEntities.length; j++) {
            if (i === j) continue;
            const o = trafficEntities[j];
            const dx = o.x - e.x;
            const dz = o.z - e.z;
            const ahead = dx * fx + dz * fz;
            const lat = Math.abs(-dx * fz + dz * fx);
            const safeGap = e.halfL + o.halfL + 8.0;
            if (ahead > 1.0 && ahead < safeGap && lat < e.halfW + o.halfW + 0.7) {
              targetSpeed = Math.min(targetSpeed, ahead < safeGap * 0.65 ? 0 : o.speed * 0.7);
            }
          }
          // Politely brake for any player-parked or player-driven car blocking this traffic lane (no ghosting through parked cars!)
          if (obstacleVehicles && targetSpeed > 0) {
            for (let j = 0; j < obstacleVehicles.length; j++) {
              const pv = obstacleVehicles[j];
              if (pv.type !== 'car') continue;
              const dx = pv.x - e.x;
              const dz = pv.z - e.z;
              const ahead = dx * fx + dz * fz;
              const lat = Math.abs(-dx * fz + dz * fx);
              const safeGap = e.halfL + (pv.halfL || 2.4) + 6.5;
              if (ahead > 0.5 && ahead < safeGap && lat < e.halfW + (pv.halfW || 1.05) + 0.65) {
                targetSpeed = Math.min(targetSpeed, ahead < safeGap * 0.62 ? 0 : 2.5);
              }
            }
          }
        } else {
          // Keep safe spacing between Stadler Tango trams running on the same rail direction
          for (let j = 0; j < tramEntities.length; j++) {
            const o = tramEntities[j];
            if (o === e || o.dir !== e.dir) continue;
            const gap = (o.dist - e.dist) * e.dir;
            if (gap > 0 && gap < e.halfL * 2 + 16) {
              targetSpeed = Math.min(targetSpeed, gap < e.halfL * 2 + 8 ? 0 : Math.max(0, o.speed * 0.75));
            }
          }
        }

        // Authentic Geneva TPG stop pauses & next-stop announcements while player is riding as a passenger!
        if (isRidden && (e.kind === 'bus' || e.kind === 'tram')) {
          if (e.stopTimer > 0) {
            e.stopTimer = Math.max(0, e.stopTimer - dt);
            targetSpeed = 0;
          } else {
            for (let si = 0; si < GENEVA_TRANSIT_STOPS.length; si++) {
              if (si === e.lastStopIdx) continue;
              const st = GENEVA_TRANSIT_STOPS[si];
              const sd = Math.hypot(st.x - e.x, st.z - e.z);
              if (sd < 20) {
                e.lastStopIdx = si;
                e.stopTimer = 2.6;
                targetSpeed = 0;
                if (riderState?.onStopArrive) riderState.onStopArrive(e, st.name);
                break;
              }
            }
          }
        }

        e.speed += (targetSpeed - e.speed) * Math.min(1, dt * (targetSpeed < e.speed ? 5.2 : 2.3));
        isBraking = targetSpeed < 1.0;
        e.dist += e.speed * dt * e.dir;
        if (e.dist >= e.route.totalLen - 4) {
          e.dist = e.route.totalLen - 4;
          e.dir = -1;
          e.lastStopIdx = -1;
        } else if (e.dist <= 4) {
          e.dist = 4;
          e.dir = 1;
          e.lastStopIdx = -1;
        }
      }

      const sample = sampleRoute(e.route, e.dist, e.dir, e.laneOffset);
      e.x = sample.x;
      e.z = sample.z;

      // Distance culling (NEVER cull the bus/tram the player is currently riding!)
      const d2 = hasFocus ? (e.x - ax) * (e.x - ax) + (e.z - az) * (e.z - az) : 0;
      const maxVisD2 = e.kind === 'car' ? 175 * 175 : 225 * 225;
      const vis = isRidden || !hasFocus || d2 < maxVisD2;
      e.mesh.visible = vis;

      if (!vis) continue;

      e.y = getGroundHeight(e.x, e.z) + (e.kind === 'tram' ? 0.3 : 0.22);

      // Smooth angular interpolation around tight Geneva street corners
      let diff = sample.yaw - e.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.yaw += diff * Math.min(1, dt * 8.5);

      e.mesh.position.set(e.x, e.y, e.z);
      e.mesh.rotation.y = e.yaw;

      const wantShadow = isRidden || !hasFocus || d2 < 64 * 64;
      if (e._castShadow !== wantShadow && e.shadowMeshes.length > 0) {
        e._castShadow = wantShadow;
        for (let k = 0; k < e.shadowMeshes.length; k++) e.shadowMeshes[k].castShadow = wantShadow;
      }

      const wRad = e.kind === 'bus' ? 0.49 : 0.34;
      for (let k = 0; k < e.wheels.length; k++) e.wheels[k].rotation.x -= (e.speed * dt) / wRad;
      if (e.tailMat) {
        e.tailMat.emissiveIntensity = isBraking ? 4.5 : 1.0 + nightFactor * 1.4;
      }
    }
  }

  // Exact oriented-hull distance from (px, pz) to any car, 12m TPG Bus, or 35.6m Stadler Tango Tram!
  function distToEntityHull(e, px, pz) {
    const dx = px - e.x;
    const dz = pz - e.z;
    const cosY = Math.cos(e.yaw);
    const sinY = Math.sin(e.yaw);
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;
    const cx = Math.max(0, Math.abs(lx) - (e.halfW || 1.1));
    const cz = Math.max(0, Math.abs(lz) - (e.halfL || 2.4));
    return Math.hypot(cx, cz);
  }

  // Find the nearest boardable/stealable moving AI car, TPG Bus, or Stadler Tango Tram (hull-accurate!)
  function findNearestTrafficVehicle(px, pz, maxDist = 11.5) {
    let best = null;
    let bestD = maxDist;
    for (let i = 0; i < trafficEntities.length; i++) {
      const e = trafficEntities[i];
      const minChildren = e.kind === 'tram' ? 1 : 2;
      if (e.mesh.children.length < minChildren) continue;
      const hullD = distToEntityHull(e, px, pz);
      const limit = e.kind === 'tram' || e.kind === 'bus' ? Math.min(maxDist, 6.2) : maxDist;
      if (hullD < limit && hullD < bestD) {
        bestD = hullD;
        e._lastHullDist = hullD;
        best = e;
      }
    }
    return best;
  }

  // Remove a hijacked AI traffic vehicle from AI control so vehicleMgr promotes it to a full player-driven car!
  function hijackTrafficVehicle(entity) {
    const idx = trafficEntities.indexOf(entity);
    if (idx === -1) return null;
    trafficEntities.splice(idx, 1);
    const bIdx = busEntities.indexOf(entity);
    if (bIdx !== -1) busEntities.splice(bIdx, 1);
    trafficGroup.remove(entity.mesh);

    // Respawn a fresh replacement traffic car/bus far along the corridor after 16s so Geneva stays lively!
    setTimeout(() => {
      if (entity.kind === 'car') {
        const holder = new THREE.Group();
        const sW = entity.vtype === 'van' ? 2.9 : 2.75;
        const sL = entity.vtype === 'van' ? 6.2 : 5.4;
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(sW, sL).rotateX(-Math.PI / 2), trafficShadowMat);
        sh.position.y = 0.05;
        sh.name = 'contactShadow';
        holder.add(sh);
        trafficGroup.add(holder);
        const rep = {
          ...entity,
          mesh: holder,
          dist: (entity.dist + entity.route.totalLen * 0.52) % entity.route.totalLen,
          speed: entity.baseSpeed,
          wheels: [],
          shadowMeshes: [],
          _castShadow: true,
          tailMat: null,
        };
        const loaderFn =
          entity.vtype === 'gwagon'
            ? loadGwagonTemplate
            : entity.vtype === 'van'
            ? loadVanTemplate
            : entity.vtype === 'charger'
            ? loadChargerTemplate
            : entity.vtype === 'porsche'
            ? loadPorscheTemplate
            : entity.vtype === 'rs6'
            ? loadRs6Template
            : loadSedanTemplate;
        loaderFn().then((tpl) => {
          if (!tpl) return;
          const built = cloneStyledBlenderVehicle(tpl, entity.color);
          holder.add(built.model);
          rep.wheels = built.wheelMeshes;
          rep.shadowMeshes = built.shadowMeshes;
          rep.tailMat = built.tailMat;
          trafficEntities.push(rep);
        });
      } else if (entity.kind === 'bus' && entity.spec) {
        loadBusTemplate().then((tpl) => {
          if (!tpl) return;
          const holder = new THREE.Group();
          const bsh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 12.8).rotateX(-Math.PI / 2), trafficShadowMat);
          bsh.position.y = 0.05;
          bsh.name = 'contactShadow';
          holder.add(bsh);
          trafficGroup.add(holder);
          const built = setupBlenderTpgBus(tpl, entity.spec.num, entity.spec.dest, entity.spec.badge, entity.spec.livery);
          holder.add(built.model);
          const repBus = {
            ...entity,
            mesh: holder,
            dist: (entity.dist + entity.route.totalLen * 0.5) % entity.route.totalLen,
            speed: entity.baseSpeed,
            stopTimer: 0,
            lastStopIdx: -1,
            wheels: built.wheelMeshes,
            shadowMeshes: built.shadowMeshes,
            _castShadow: true,
            tailMat: built.tailMat,
          };
          trafficEntities.push(repBus);
          busEntities.push(repBus);
        });
      }
    }, 16000);

    return entity;
  }

  return {
    group: trafficGroup,
    trafficEntities,
    busEntities,
    tramEntities,
    findNearestTrafficVehicle,
    hijackTrafficVehicle,
    update,
  };
}
