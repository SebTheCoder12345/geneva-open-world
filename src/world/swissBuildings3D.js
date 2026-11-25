import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { WORLD_BOUNDS, getGroundHeight } from './cityData.js';
import { createGenevaFacadeArrays } from './genevaFacadesPBR.js';
import { pointInPolygon } from '../game/collisions.js';

function hash21(x, z) {
  let px = (x * 123.34) % 1;
  let pz = (z * 456.21) % 1;
  if (px < 0) px += 1;
  if (pz < 0) pz += 1;
  const d = px * (px + 45.32) + pz * (pz + 45.32);
  const v = (px + d) * (pz + d);
  return v - Math.floor(v);
}

// =================================================================================================
// REAL-WORLD GENEVA ARCHITECTURAL STYLE & LANDMARK CLASSIFIER (Per Actual OSM Building Footprint!)
// Replaces arbitrary 34m checkerboard hashing so every single Geneva building has 1 coherent real
// architectural facade matched to Quai du Général-Guisan, Rue du Rhône, Place du Molard,
// Vieille-Ville (Bourg-de-Four & Grand-Rue), Quartier des Banques, and Rive Droite grand hotels!
// =================================================================================================
const CORNICE_PALETTE = [
  [0.83, 0.79, 0.72], // 0: Quai Ivory Belle Epoque
  [0.74, 0.74, 0.72], // 1: Quai Silver-Grey Ashlar
  [0.80, 0.75, 0.66], // 2: Grand Watch Palace Cream
  [0.84, 0.83, 0.80], // 3: Cartier Modernist Off-White
  [0.76, 0.74, 0.69], // 4: Fairmont / UBS Travertine
  [0.77, 0.72, 0.64], // 5: Bourg-de-Four Pale Molasse
  [0.78, 0.69, 0.56], // 6: Old Town Warm Ochre
  [0.64, 0.59, 0.50], // 7: Grand-Rue Medieval Molasse
];

const HERITAGE_AWNINGS = [
  [0.34, 0.10, 0.12], // Bordeaux burgundy
  [0.10, 0.23, 0.16], // Swiss alpine forest green
  [0.11, 0.16, 0.24], // Geneva navy slate
  [0.44, 0.21, 0.14], // Warm terracotta canvas
  [0.62, 0.56, 0.45], // Unbleached linen cream
];

function classifyBuildingProfile(cx, cz, name = '', kind = '', idx = 0) {
  const n = (name || '').toLowerCase();
  const k = (kind || '').toLowerCase();
  const s1 = hash21(Math.round(cx * 0.5) + idx * 0.17, Math.round(cz * 0.5) + 11.3);
  const s2 = hash21(Math.round(cx * 0.5) + 37.1, Math.round(cz * 0.5) + idx * 0.29);
  const s3 = hash21(idx * 1.13 + 7.7, Math.round(cx + cz) * 0.25);

  let monType = 0.0;
  let upperLayer = 0;
  let groundLayer = 8;
  let canopyKind = 'none';
  let hasBalcony3D = false;
  let hasEaveCornice = true;
  let hasPilasters = false;

  // 1. Exact Monumental Landmarks (Cathédrale Saint-Pierre, Grand Théâtre, Musée Rath, Tour du Molard, Churches)
  if (
    Math.hypot(cx - -124.0, cz - 543.0) < 52.0 ||
    k === 'church' ||
    k === 'synagogue' ||
    /cath[ée]drale|[ée]glise|eglise|temple |auditoire de calvin|beth yaacov/.test(n)
  ) {
    monType = 2.0;
    upperLayer = 7;
    groundLayer = 10;
    hasEaveCornice = false;
  } else if (
    Math.hypot(cx - -150.4, cz - 228.9) < 10.5 ||
    /tour du molard|tour de l'ile/.test(n)
  ) {
    monType = 3.0;
    upperLayer = 7;
    groundLayer = 10;
    hasEaveCornice = false;
  } else if (
    Math.hypot(cx - -570.0, cz - 468.0) < 44.0 ||
    Math.hypot(cx - -508.0, cz - 466.0) < 26.0 ||
    /grand th[ée][âa]tre|mus[ée]e rath|conservatoire|victoria hall|uni bastions/.test(n)
  ) {
    monType = 1.0;
    upperLayer = 0;
    groundLayer = 8;
    hasPilasters = true;
  }
  // 2. Named Modern Swiss Hotels, Private Banks, Glass Lakeside Pavilions & Contemporary Icons
  else if (
    /la potini[èe]re|le lacustre|pavillon/.test(n) ||
    (cz > 145 && cz < 200 && cx > -140 && cx < 135 && Math.hypot(cx - 75, cz - 178) < 28)
  ) {
    upperLayer = 4;
    groundLayer = 11;
    hasEaveCornice = false;
  } else if (
    /fairmont|union bancaire|credit suisse|soci[ée]t[ée] g[ée]n[ée]rale|cr[ée]dit agricole|jacob safra|bank of|sgs|ubs|spaces|clart[ée]|gare cornavin|rothschild|syz/.test(
      n
    )
  ) {
    upperLayer = s1 > 0.42 ? 4 : 3;
    groundLayer = 11;
    canopyKind = 'modern_metal';
    hasEaveCornice = false;
  }
  // 3. Named Grand Belle Époque Palaces & Department Stores (Hôtel Métropole, Four Seasons, Richemond, Globus)
  else if (
    /m[ée]tropole|four seasons|bergues|richemond|angleterre|beau-rivage|ritz|paix|bristol|longemalle|cigogne|globus|ambassador|mandarin/.test(
      n
    )
  ) {
    upperLayer = /m[ée]tropole|globus|four seasons/.test(n) ? 2 : 0;
    groundLayer = /globus/.test(n) ? 9 : 8;
    hasBalcony3D = true;
    hasPilasters = true;
    canopyKind = /globus/.test(n) ? 'modern_metal' : 'none';
  }
  // 4. Named Medieval Old Town Landmarks (Maison Tavel, Musée Réforme, Taverne Madeleine)
  else if (/maison tavel|r[ée]forme|madeleine|petersh[öo]fli|chez ma cousine/.test(n)) {
    upperLayer = 7;
    groundLayer = 10;
    canopyKind = s2 > 0.45 ? 'fabric_awning' : 'none';
  }
  // 5. District & Real Street-Corridor Architectural Mapping
  else {
    // True diagonal Quai du Général-Guisan shoreline axis (matches 1:1 lakeside curve from Pont du Mont-Blanc to Hôtel Métropole!)
    const quaiAxisZ = 240.0 + cx * 0.34;
    const inQuaiFront = cx > -225 && cx < 185 && Math.abs(cz - quaiAxisZ) < 24.0;
    const inRueDuRhone = !inQuaiFront && cz >= 220 && cz <= 332 && cx > -250 && cx < 165;
    const inMolardMarket = !inQuaiFront && cz >= 205 && cz <= 345 && cx <= -138 && cx > -340;
    const inOldTown = cz > 340 && cx > -355 && cx < 185;
    const inBankDistrict = cz > 75 && cz < 455 && cx < -280;
    const inRiveDroiteQuai = cz < -55 && cz > -540 && cx > -360 && cx < 260;

    if (inQuaiFront) {
      // Photo-matched directly to ref_01_quai_general_guisan.jpg — alternating bright ivory Rolex, darker slate-taupe Hermès/Chanel, warm limestone Patek & Métropole!
      if (cx < -46) {
        upperLayer = 0; // Bright ivory Belle Epoque
        groundLayer = 8; // Semi-circular arched stone arcades!
      } else if (cx < -30) {
        upperLayer = 1; // Slate-taupe dressed ashlar (Hermès / Chanel)
        groundLayer = 8;
      } else if (cx < -14) {
        upperLayer = 2; // Patek Philippe wide triple-bay watch palace
        groundLayer = 8;
      } else if (cx < 32) {
        upperLayer = 0;
        groundLayer = 9;
        canopyKind = 'modern_metal';
      } else if (cx < 63) {
        upperLayer = 1; // Darker slate-taupe dressed ashlar right beside Rolex (matches ref_01!)
        groundLayer = 8;
      } else if (cx < 86) {
        upperLayer = 0; // ROLEX bright ivory Belle Époque landmark palace + arched Bucherer ground floor!
        groundLayer = 8;
      } else if (cx < 118) {
        upperLayer = 2; // Patek / Montblanc warm limestone grand triple-bay palace!
        groundLayer = 9;
        canopyKind = 'modern_metal';
      } else {
        upperLayer = 1; // Cool stone neighbor flanking Hôtel Métropole
        groundLayer = 8;
      }
      hasBalcony3D = true;
      hasPilasters = true;
    } else if (inRueDuRhone) {
      // Photo-matched directly to ref_03_rue_du_rhone_east.jpg & ref_04_rue_du_rhone.jpg!
      if (cx >= -145 && cx <= -82 && cz <= 252) {
        // Cartier iconic crisp off-white modernist concrete grid + huge blue-green reflective glass bays (ref_03 left!)
        upperLayer = 3;
        groundLayer = 9;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      } else if (cx >= -120 && cx <= -65 && cz > 252 && cz <= 278) {
        // Dior carved warm cream limestone + 3D wrought-iron balconies + cantilevered dark-bronze canopy (ref_03 right!)
        upperLayer = 0;
        groundLayer = 9;
        canopyKind = 'modern_metal';
        hasBalcony3D = true;
        hasPilasters = true;
      } else if (s1 < 0.26) {
        upperLayer = 0;
        groundLayer = 9;
        hasBalcony3D = true;
        hasPilasters = true;
        canopyKind = s2 > 0.35 ? 'modern_metal' : 'none';
      } else if (s1 < 0.50) {
        upperLayer = 3; // Crisp Swiss modernist concrete & glass luxury house
        groundLayer = 9;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      } else if (s1 < 0.68) {
        upperLayer = 1; // Slate-taupe dressed ashlar
        groundLayer = 8;
        hasBalcony3D = true;
        hasPilasters = true;
      } else if (s1 < 0.84) {
        upperLayer = 4; // Contemporary travertine & glass curtain wall
        groundLayer = 11;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      } else {
        upperLayer = 2; // Grand cream triple-bay house
        groundLayer = 8;
        hasBalcony3D = true;
        hasPilasters = true;
      }
    } else if (inOldTown) {
      // Photo-matched directly to real_oldtown_1.jpg (Bourg-de-Four) & grandrue_1.jpg (Grand-Rue)!
      if (s1 < 0.44) upperLayer = 5; // Pale molasse limestone + crisp white louvered shutters
      else if (s1 < 0.78) upperLayer = 6; // Warm ochre lime-plaster + heritage olive-slate shutters
      else upperLayer = 7; // Weathered medieval molasse stone & cross-mullions
      groundLayer = 10; // Rusticated stone, oiled-oak brasserie & arched porte cochère
      canopyKind = s2 > 0.44 ? 'fabric_awning' : 'none';
      hasBalcony3D = false;
    } else if (inMolardMarket) {
      if (s1 < 0.30) upperLayer = 0;
      else if (s1 < 0.52) upperLayer = 5;
      else if (s1 < 0.72) upperLayer = 1;
      else if (s1 < 0.88) upperLayer = 3;
      else upperLayer = 2;
      groundLayer = upperLayer === 5 ? 10 : 9;
      canopyKind = upperLayer === 3 ? 'modern_metal' : s2 > 0.40 ? 'fabric_awning' : 'modern_metal';
      hasBalcony3D = upperLayer === 0 || upperLayer === 1 || upperLayer === 2;
      hasEaveCornice = upperLayer !== 3;
      hasPilasters = upperLayer === 0 || upperLayer === 2;
    } else if (inBankDistrict) {
      if (s1 < 0.34) {
        upperLayer = 4;
        groundLayer = 11;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      } else if (s1 < 0.62) {
        upperLayer = 3;
        groundLayer = 9;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      } else if (s1 < 0.82) {
        upperLayer = 1;
        groundLayer = 8;
        hasBalcony3D = true;
        hasPilasters = true;
      } else {
        upperLayer = 0;
        groundLayer = 8;
        hasBalcony3D = true;
      }
    } else if (inRiveDroiteQuai) {
      if (s1 < 0.34) {
        upperLayer = 0;
        groundLayer = 8;
        hasBalcony3D = true;
        hasPilasters = true;
      } else if (s1 < 0.56) {
        upperLayer = 2;
        groundLayer = 8;
        hasBalcony3D = true;
        hasPilasters = true;
      } else if (s1 < 0.76) {
        upperLayer = 1;
        groundLayer = 9;
        hasBalcony3D = true;
      } else {
        upperLayer = s1 < 0.90 ? 4 : 3;
        groundLayer = 11;
        canopyKind = 'modern_metal';
        hasEaveCornice = false;
      }
    } else {
      // Eaux-Vives, Plainpalais, Champel, St-Gervais authentic Geneva urban fabric
      if (s1 < 0.28) {
        upperLayer = 0;
        groundLayer = 8;
        hasBalcony3D = s2 > 0.45;
      } else if (s1 < 0.50) {
        upperLayer = 5;
        groundLayer = 10;
        canopyKind = s2 > 0.62 ? 'fabric_awning' : 'none';
      } else if (s1 < 0.70) {
        upperLayer = 1;
        groundLayer = 9;
        hasBalcony3D = s2 > 0.55;
      } else if (s1 < 0.85) {
        upperLayer = 6;
        groundLayer = 10;
        canopyKind = s2 > 0.65 ? 'fabric_awning' : 'none';
      } else if (s1 < 0.94) {
        upperLayer = 3;
        groundLayer = 9;
        hasEaveCornice = false;
      } else {
        upperLayer = 4;
        groundLayer = 11;
        hasEaveCornice = false;
      }
    }
  }

  const corniceRgb = CORNICE_PALETTE[upperLayer] || CORNICE_PALETTE[0];
  const awningRgb = HERITAGE_AWNINGS[Math.floor(s3 * HERITAGE_AWNINGS.length) % HERITAGE_AWNINGS.length];

  return {
    upperLayer,
    groundLayer,
    warmth: s2,
    monType,
    corniceRgb,
    canopyKind,
    awningRgb,
    hasBalcony3D,
    hasEaveCornice,
    hasPilasters,
  };
}

function buildOsmStyleLookup(realData) {
  const CELL = 32;
  const grid = new Map();
  const buildings = realData?.buildings || [];

  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const pts = b?.p;
    if (!pts || pts.length < 3) continue;
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      sx = 0,
      sz = 0;
    for (let k = 0; k < pts.length; k++) {
      const px = pts[k][0];
      const pz = pts[k][1];
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
      sx += px;
      sz += pz;
    }
    const cx = sx / pts.length;
    const cz = sz / pts.length;
    const profile = classifyBuildingProfile(cx, cz, b.n, b.k, i);
    const rec = { pts, minX, maxX, minZ, maxZ, cx, cz, profile };

    const gx0 = Math.floor((minX - 5) / CELL);
    const gx1 = Math.floor((maxX + 5) / CELL);
    const gz0 = Math.floor((minZ - 5) / CELL);
    const gz1 = Math.floor((maxZ + 5) / CELL);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const key = `${gx},${gz}`;
        let arr = grid.get(key);
        if (!arr) {
          arr = [];
          grid.set(key, arr);
        }
        arr.push(rec);
      }
    }
  }

  function isPointInsideAnyBuilding(px, pz) {
    const arr = grid.get(`${Math.floor(px / CELL)},${Math.floor(pz / CELL)}`);
    if (!arr) return false;
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (px < r.minX || px > r.maxX || pz < r.minZ || pz > r.maxZ) continue;
      if (pointInPolygon(px, pz, r.pts)) return true;
    }
    return false;
  }

  function lookupProfile(cx, cz, nx, nz) {
    // Probe 3.5m inward from the exterior wall plane so all faces of the same building pick the SAME OSM footprint!
    const bx = cx - nx * 3.5;
    const bz = cz - nz * 3.5;
    const arr = grid.get(`${Math.floor(bx / CELL)},${Math.floor(bz / CELL)}`);
    if (arr) {
      // Pass 1: exact point-in-polygon match
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (bx < r.minX || bx > r.maxX || bz < r.minZ || bz > r.maxZ) continue;
        if (pointInPolygon(bx, bz, r.pts)) return r.profile;
      }
      // Pass 2: nearest OSM footprint within 4.5m AABB padding (bridges tiny swisstopo vs OSM corner deltas!)
      let bestRec = null;
      let bestD2 = Infinity;
      for (let i = 0; i < arr.length; i++) {
        const r = arr[i];
        if (bx < r.minX - 4.5 || bx > r.maxX + 4.5 || bz < r.minZ - 4.5 || bz > r.maxZ + 4.5) continue;
        const d2 = (bx - r.cx) * (bx - r.cx) + (bz - r.cz) * (bz - r.cz);
        if (d2 < bestD2) {
          bestD2 = d2;
          bestRec = r;
        }
      }
      if (bestRec) return bestRec.profile;
    }
    // Fallback for far outer perimeter outside OSM footprint table
    const cellX = Math.floor(bx / 36.0) * 36.0 + 18.0;
    const cellZ = Math.floor(bz / 36.0) * 36.0 + 18.0;
    return classifyBuildingProfile(cellX, cellZ, '', '', Math.abs(Math.floor(cellX) * 7 + Math.floor(cellZ) * 13));
  }

  return { lookupProfile, isPointInsideAnyBuilding };
}

// =================================================================================================
// ULTRA-FAST BATCHED 3D ARCHITECTURAL RELIEF GEOMETRY HELPERS (Cornices, Pilasters, Canopies, Balconies)
// Emits flat-shaded oriented 3D boxes & sloped Geneva fabric awnings directly into 4 shared buffers!
// =================================================================================================
function makeTrimBuf(hasColor = false) {
  return { pos: [], norm: [], col: hasColor ? [] : null };
}

function pushQuad(buf, a, b, c, d, nx, ny, nz, r = 1, g = 1, bl = 1) {
  buf.pos.push(
    a[0], a[1], a[2],
    b[0], b[1], b[2],
    c[0], c[1], c[2],
    a[0], a[1], a[2],
    c[0], c[1], c[2],
    d[0], d[1], d[2]
  );
  for (let i = 0; i < 6; i++) {
    buf.norm.push(nx, ny, nz);
    if (buf.col) buf.col.push(r, g, bl);
  }
}

// Oriented 3D box aligned with wall tangent (tx, tz), outward normal (nx, nz), and world +Y up.
// depth0..depth1 measured outward from the wall plane along (nx, nz).
function pushWallBox(buf, cx, cy, cz, tx, tz, nx, nz, halfLen, halfH, depth0, depth1, r = 1, g = 1, bl = 1) {
  const lx = tx * halfLen;
  const lz = tz * halfLen;
  const n0x = nx * depth0;
  const n0z = nz * depth0;
  const n1x = nx * depth1;
  const n1z = nz * depth1;
  const y0 = cy - halfH;
  const y1 = cy + halfH;

  // Back 4 corners (at depth0) & Front 4 corners (at depth1)
  const bbl = [cx - lx + n0x, y0, cz - lz + n0z];
  const bbr = [cx + lx + n0x, y0, cz + lz + n0z];
  const btr = [cx + lx + n0x, y1, cz + lz + n0z];
  const btl = [cx - lx + n0x, y1, cz - lz + n0z];

  const fbl = [cx - lx + n1x, y0, cz - lz + n1z];
  const fbr = [cx + lx + n1x, y0, cz + lz + n1z];
  const ftr = [cx + lx + n1x, y1, cz + lz + n1z];
  const ftl = [cx - lx + n1x, y1, cz - lz + n1z];

  // Front face (+N)
  pushQuad(buf, fbl, fbr, ftr, ftl, nx, 0, nz, r, g, bl);
  // Top face (+Y)
  pushQuad(buf, ftl, ftr, btr, btl, 0, 1, 0, Math.min(1, r * 1.07), Math.min(1, g * 1.07), Math.min(1, bl * 1.07));
  // Bottom soffit (-Y)
  pushQuad(buf, bbl, bbr, fbr, fbl, 0, -1, 0, r * 0.72, g * 0.72, bl * 0.72);
  // Left cap (-T)
  pushQuad(buf, bbl, fbl, ftl, btl, -tx, 0, -tz, r * 0.88, g * 0.88, bl * 0.88);
  // Right cap (+T)
  pushQuad(buf, fbr, bbr, btr, ftr, tx, 0, tz, r * 0.88, g * 0.88, bl * 0.88);
}

// Sloped European fabric café/boutique awning + hanging front valance drop
function pushSlopedAwning(buf, cx, yTop, cz, tx, tz, nx, nz, halfLen, proj, dropH, valanceH, r, g, bl) {
  const lx = tx * halfLen;
  const lz = tz * halfLen;
  const yBot = yTop - dropH;

  const tl = [cx - lx + nx * 0.04, yTop, cz - lz + nz * 0.04];
  const tr = [cx + lx + nx * 0.04, yTop, cz + lz + nz * 0.04];
  const br = [cx + lx + nx * proj, yBot, cz + lz + nz * proj];
  const blp = [cx - lx + nx * proj, yBot, cz - lz + nz * proj];

  const invS = 1 / Math.hypot(dropH, proj);
  const snx = nx * (dropH * invS);
  const sny = proj * invS;
  const snz = nz * (dropH * invS);

  // Sloped top fabric plane
  pushQuad(buf, blp, br, tr, tl, snx, sny, snz, r, g, bl);
  // Front vertical scalloped valance lip
  const vr = [br[0], yBot - valanceH, br[2]];
  const vl = [blp[0], yBot - valanceH, blp[2]];
  pushQuad(buf, vl, vr, br, blp, nx, 0, nz, r * 0.92, g * 0.92, bl * 0.92);
  // Side triangular fabric skirts (rendered as narrow quads so canopy looks solid from side angles)
  const wbl = [cx - lx + nx * 0.04, yBot, cz - lz + nz * 0.04];
  const wbr = [cx + lx + nx * 0.04, yBot, cz + lz + nz * 0.04];
  pushQuad(buf, wbl, blp, tl, tl, -tx, 0, -tz, r * 0.78, g * 0.78, bl * 0.78);
  pushQuad(buf, br, wbr, tr, tr, tx, 0, tz, r * 0.78, g * 0.78, bl * 0.78);
}

// =================================================================================================
// CREATE PHOTO-MATCHED 12-LAYER PBR GENEVA ARCHITECTURAL MATERIALS (WebGL2 sampler2DArray!)
// - 12 authentic Geneva facade layers (8 upper + 4 ground) with 100% matched Normal, Roughness, Emissive
// - True 3D Window Interior Parallax (ray-box rooms behind real window panes!)
// - Physically plausible Schlick Fresnel Alpine Sky & Lake reflections on glass!
// - Zero fake grey spandrel smears, zero cartoon thick white crossbars, zero dFdx grazing noise!
// =================================================================================================
function createSwissBuildingsMaterials(upperMats, groundMats, photoBundle, orthoTex) {
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const boundsVec = new THREE.Vector4(minX, minZ, maxX - minX, maxZ - minZ);
  const nightUniform = { value: 0.0 };

  const facadeArrays = createGenevaFacadeArrays(photoBundle);

  let ashlarTex = photoBundle?.slateRoofDiff || upperMats[0].map;
  if (photoBundle?.ashlarImg) {
    ashlarTex = new THREE.CanvasTexture(photoBundle.ashlarImg);
    ashlarTex.colorSpace = THREE.SRGBColorSpace;
    ashlarTex.wrapS = ashlarTex.wrapT = THREE.RepeatWrapping;
    ashlarTex.anisotropy = 16;
  }

  // 1. WALL MATERIAL: Pre-baked vertex `uv` = (uMeters, hAboveGround), `aFaceN` = (nx, ny, nz),
  //    `aMeta` = (upperLayer 0..7, warmth 0..1, monType 0..3, groundLayer 8..11)
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.06,
    envMapIntensity: 1.45,
    side: THREE.DoubleSide,
  });

  wallMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNightGlow = nightUniform;
    shader.uniforms.uFacCol = { value: facadeArrays.colArray };
    shader.uniforms.uFacNorRough = { value: facadeArrays.norRoughArray };
    shader.uniforms.uFacEmis = { value: facadeArrays.emisArray };
    shader.uniforms.uAshlarTex = { value: ashlarTex };

    shader.vertexShader =
      `attribute vec4 aMeta;
attribute vec3 aFaceN;
varying vec2 vMetricUv;
varying vec4 vMeta;
varying vec3 vWorldFaceN;
varying vec3 vSwPos;
` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vMetricUv = uv;
        vMeta = aMeta;
        vWorldFaceN = aFaceN;
        vSwPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader =
      `precision highp sampler2DArray;
varying vec2 vMetricUv;
varying vec4 vMeta;
varying vec3 vWorldFaceN;
varying vec3 vSwPos;
uniform float uNightGlow;
uniform sampler2DArray uFacCol;
uniform sampler2DArray uFacNorRough;
uniform sampler2DArray uFacEmis;
uniform sampler2D uAshlarTex;

vec3 swSrgbToLin(vec3 c) {
  c = max(c, vec3(0.0));
  return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);
}

float swHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          float uMeters = vMetricUv.x;
          float hRel = max(0.0, vMetricUv.y);
          vec3 swFaceN = normalize(vWorldFaceN);
          if (!gl_FrontFacing) swFaceN = -swFaceN;
          vec2 horizN = swFaceN.xz;
          float hLen = length(horizN);
          vec2 facTang = hLen > 0.08 ? vec2(horizN.y, -horizN.x) / hLen : vec2(1.0, 0.0);

          float upperLayer = clamp(floor(vMeta.x + 0.5), 0.0, 7.0);
          float warmth = vMeta.y;
          float monType = vMeta.z;
          float groundLayer = clamp(floor(vMeta.w + 0.5), 8.0, 11.0);

          // Ground floor (0 .. 4.65m) vs Upper floors (4.65m+) with crisp dressed-stone belt molding!
          float isUpper = smoothstep(4.56, 4.74, hRel);
          float isModLayer = step(2.5, upperLayer) * step(upperLayer, 4.5);

          vec2 gUv = vec2(uMeters / 10.6, clamp(hRel / 4.68, 0.006, 0.994));
          vec2 uUv = mix(
            vec2(uMeters / 12.0, max(0.0, hRel - 4.65) / 12.8),
            vec2(uMeters / 13.8, max(0.0, hRel - 4.65) / 13.4),
            isModLayer
          );

          vec3 gCol = swSrgbToLin(texture(uFacCol, vec3(gUv, groundLayer)).rgb);
          vec4 gNR  = texture(uFacNorRough, vec3(gUv, groundLayer));
          vec3 gEm  = swSrgbToLin(texture(uFacEmis, vec3(gUv, groundLayer)).rgb);

          vec3 uCol = swSrgbToLin(texture(uFacCol, vec3(uUv, upperLayer)).rgb);
          vec4 uNR  = texture(uFacNorRough, vec3(uUv, upperLayer));
          vec3 uEm  = swSrgbToLin(texture(uFacEmis, vec3(uUv, upperLayer)).rgb);

          vec3 facadeCol = mix(gCol, uCol, isUpper);
          vec3 swNormSample = mix(gNR.rgb, uNR.rgb, isUpper);
          float swRoughSample = mix(gNR.a, uNR.a, isUpper);
          vec3 swEmisSample = mix(gEm, uEm, isUpper);

          // Subtle honed Swiss Jura granite splash plinth right at the sidewalk edge (hRel < 0.36m)
          float plinthMask = (1.0 - smoothstep(0.24, 0.38, hRel)) * step(0.15, swRoughSample);
          facadeCol = mix(facadeCol, vec3(0.085, 0.086, 0.088), plinthMask * 0.65);

          // Clean carved stone belt-course molding transitioning ground floor into piano nobile (4.54..4.78m)
          float beltBand = smoothstep(4.48, 4.58, hRel) * (1.0 - smoothstep(4.74, 4.86, hRel)) * (1.0 - isModLayer * 0.55);
          float beltShadow = smoothstep(4.42, 4.52, hRel) * (1.0 - smoothstep(4.52, 4.60, hRel)) * (1.0 - isModLayer * 0.55);
          facadeCol = mix(facadeCol, facadeCol * 1.12 + vec3(0.04, 0.036, 0.03), beltBand * 0.45);
          facadeCol *= (1.0 - beltShadow * 0.28);

          // Monumental carved Geneva molasse stone (Cathédrale Saint-Pierre, Grand Théâtre, Musée Rath, Tour du Molard)
          // Uses real photo-matched PBR DataArrayTexture layers + ashlar stone masonry + true 3D glass Fresnel & normal relief (ZERO flat grey rectangles!)
          if (monType > 0.5) {
            vec2 ashUv = vec2(uMeters / 5.2, vSwPos.y / 5.2);
            vec3 ashCol = texture2D(uAshlarTex, ashUv).rgb;
            float isOpera = step(0.5, monType) * step(monType, 1.5);
            float monLayer = isOpera > 0.5 ? 2.0 : 7.0;
            vec2 monUv = vec2(uMeters / 13.6, max(0.0, hRel) / 14.2);
            vec3 mCol = swSrgbToLin(texture(uFacCol, vec3(monUv, monLayer)).rgb);
            vec4 mNR  = texture(uFacNorRough, vec3(monUv, monLayer));
            vec3 mEm  = swSrgbToLin(texture(uFacEmis, vec3(monUv, monLayer)).rgb);
            float mIsStone = smoothstep(0.14, 0.30, mNR.a);
            vec3 ashTint = mix(vec3(0.42, 0.37, 0.30), vec3(0.52, 0.47, 0.39), isOpera) * (0.72 + 0.46 * ashCol);
            facadeCol = mix(mCol, mix(mCol, ashTint, 0.34), mIsStone);
            swNormSample = mNR.rgb;
            swRoughSample = mNR.a;
            swEmisSample = mEm * 0.72;
          } else {
            // Subtle per-building limestone / plaster warmth nuance (+/-6% so adjacent buildings never look cloned!)
            vec3 bldTint = mix(
              vec3(0.94 + warmth * 0.11, 0.94 + warmth * 0.09, 0.92 + warmth * 0.07),
              vec3(0.97 + warmth * 0.05, 0.97 + warmth * 0.05, 0.97 + warmth * 0.05),
              isModLayer
            );
            facadeCol *= bldTint;
          }

          // Horizontal stone ledges, parapets & window sills: clean dressed limestone (zero smeared windows!)
          float isHoriz = smoothstep(0.55, 0.80, abs(swFaceN.y));
          vec3 ledgeCol = vec3(0.36, 0.33, 0.28) * (swFaceN.y < 0.0 ? 0.48 : 1.0);
          facadeCol = mix(facadeCol, ledgeCol, isHoriz);
          swRoughSample = mix(swRoughSample, 0.86, isHoriz);
          swEmisSample *= (1.0 - isHoriz);

          // =====================================================================================
          // TRUE 3D WINDOW INTERIOR PARALLAX + SCHLICK FRESNEL ALPINE SKY REFLECTIONS!
          // Strictly masked to real architectural glass panes via per-layer PBR roughness channel!
          // =====================================================================================
          float glassMask = (1.0 - smoothstep(0.11, 0.24, swRoughSample)) * (1.0 - isHoriz);
          vec3 swParallaxEmis = vec3(0.0);
          if (glassMask > 0.01) {
            vec3 viewDirW = normalize(cameraPosition - vSwPos);
            vec3 swT = vec3(facTang.x, 0.0, facTang.y);
            vec3 swB = vec3(0.0, 1.0, 0.0);
            float vDotN = max(0.06, abs(dot(viewDirW, swFaceN)));
            vec2 viewTan = vec2(dot(viewDirW, swT), dot(viewDirW, swB));

            // Room cell coordinates aligned to Geneva window bays
            vec2 roomScale = mix(vec2(3.53, 4.68), mix(vec2(3.0, 3.2), vec2(3.45, 3.35), isModLayer), isUpper);
            vec2 roomCoord = vec2(uMeters, max(0.0, hRel - isUpper * 4.65)) / roomScale;
            vec2 roomId = floor(roomCoord);
            vec2 roomUv = fract(roomCoord); // [0..1] across one room bay
            float rSeed = swHash21(roomId + vec2(upperLayer * 13.7, warmth * 29.1));

            // Ray-box intersection into recessed 3D room (depth = 0.62 behind glass plane)
            vec3 rd = normalize(vec3(-viewTan.x, -viewTan.y, -vDotN));
            vec3 ro = vec3(roomUv.x, roomUv.y, 0.0);
            float tX = rd.x > 0.001 ? (1.0 - ro.x) / rd.x : (rd.x < -0.001 ? -ro.x / rd.x : 99.0);
            float tY = rd.y > 0.001 ? (1.0 - ro.y) / rd.y : (rd.y < -0.001 ? -ro.y / rd.y : 99.0);
            float tZ = abs(rd.z) > 0.001 ? 0.62 / abs(rd.z) : 99.0;
            float tHit = min(min(tX, tY), tZ);
            vec3 hitP = ro + rd * tHit;

            // 3D room shading: ceiling slab, warm plaster walls, dark oak floor, recessed boutique/office lighting!
            float hitCeil = step(tY, min(tX, tZ)) * step(0.0, rd.y);
            float hitFloor = step(tY, min(tX, tZ)) * step(rd.y, 0.0);
            float hitBack = step(tZ, min(tX, tY));
            float isShopGlass = 1.0 - isUpper;
            vec3 wallTint = mix(
              mix(vec3(0.46, 0.41, 0.34), vec3(0.36, 0.40, 0.44), step(0.62, rSeed) * isModLayer),
              vec3(0.62, 0.53, 0.40),
              isShopGlass
            );
            vec3 roomCol = wallTint;
            roomCol = mix(roomCol, vec3(0.68, 0.62, 0.54), hitCeil);
            roomCol = mix(roomCol, vec3(0.16, 0.12, 0.09), hitFloor);
            // Warm interior ceiling lamps & luxury boutique display vitrines shifting in true 3D parallax!
            float lampSpot = hitCeil * smoothstep(0.28, 0.05, length(hitP.xz - vec2(0.5, -0.32)));
            float backFixture = hitBack * smoothstep(0.42, 0.12, abs(hitP.x - 0.5)) * smoothstep(0.78, 0.32, hitP.y);
            float depthFade = exp(-tHit * 1.05);
            vec3 dayRoomUpper = roomCol * (0.24 + 0.18 * depthFade) + vec3(0.24, 0.20, 0.14) * lampSpot * 0.42;
            vec3 dayRoomShop  = roomCol * (0.44 + 0.34 * depthFade) + vec3(0.75, 0.58, 0.34) * (lampSpot * 0.85 + backFixture * 0.48);
            vec3 dayRoom = mix(dayRoomUpper, dayRoomShop, isShopGlass);

            // Physically crisp Schlick Fresnel reflection of Lac Léman & Alpine Geneva sky (matches ref_01 & ref_03!)
            float fres = 0.20 + 0.72 * pow(1.0 - vDotN, 2.8);
            vec3 reflDir = reflect(-viewDirW, swFaceN);
            float skyElev = clamp(reflDir.y * 0.5 + 0.5, 0.0, 1.0);
            float nightAmt = clamp(uNightGlow * 0.72, 0.0, 1.0);

            // Day Alpine sky reflection (bright cerulean sky, sunlit cloud wisps + opposite sandstone facade reflection)
            float cloudWave = smoothstep(0.44, 0.82, sin(reflDir.x * 5.2 + reflDir.z * 3.8 + vSwPos.y * 0.05) * 0.5 + 0.5);
            vec3 skyDay = mix(vec3(0.52, 0.68, 0.86), vec3(0.20, 0.42, 0.76), smoothstep(0.48, 0.92, skyElev));
            skyDay = mix(skyDay, vec3(0.88, 0.92, 0.96), cloudWave * 0.38 * smoothstep(0.44, 0.76, skyElev));
            vec3 oppBldDay = vec3(0.20, 0.19, 0.17) * (0.72 + 0.38 * smoothstep(0.18, 0.50, skyElev));
            vec3 reflDay = mix(oppBldDay, skyDay, smoothstep(0.42, 0.55, skyElev));

            // Night Alpine sky + warm Rue du Rhône streetlamp horizon shimmer
            vec3 skyNight = mix(vec3(0.032, 0.052, 0.095), vec3(0.012, 0.024, 0.052), smoothstep(0.50, 0.92, skyElev));
            float cityGlowBand = exp(-abs(reflDir.y) * 9.0);
            vec3 reflNight = skyNight + vec3(0.16, 0.10, 0.045) * cityGlowBand * 0.65;

            vec3 skyRefl = mix(reflDay, reflNight, nightAmt);

            // Blend authentic texture glass/curtain detail + 3D room depth + Fresnel sky mirror reflection
            float reflWeight = fres * mix(mix(0.88, 0.62, isShopGlass), 0.56, nightAmt);
            vec3 glassBase = mix(facadeCol * 0.62 + dayRoom * 0.75, skyRefl, reflWeight);
            facadeCol = mix(facadeCol, glassBase, glassMask);

            // At night, lit 3D room interiors glow with parallax ceiling fixtures & warm walls!
            float emisLum = dot(swEmisSample, vec3(0.299, 0.587, 0.114));
            if (emisLum > 0.015) {
              vec3 lit3DRoom = swEmisSample * (0.55 + 0.68 * depthFade) + vec3(1.15, 0.88, 0.54) * (lampSpot * 1.15 + backFixture * 0.32) * emisLum;
              swParallaxEmis = lit3DRoom * glassMask;
            }
          }

          // Grounded street-level ambient occlusion
          float groundAO = mix(0.76, 1.0, smoothstep(0.0, 2.2, hRel));
          diffuseColor.rgb = facadeCol * groundAO;
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = clamp(swRoughSample, 0.06, 0.92);
          `
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
          metalnessFactor = mix(0.04, 0.24, glassMask);
          `
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          // Smooth hardware-anisotropic normal-map relief (recessed windows, louvered shutters & carved cornices!)
          vec3 swMapN = swNormSample * 2.0 - 1.0;
          swMapN.xy *= 1.12 * (1.0 - isHoriz) * (1.0 - glassMask * 0.85);
          vec3 swWorldT = vec3(facTang.x, 0.0, facTang.y);
          vec3 swWorldB = vec3(0.0, 1.0, 0.0);
          vec3 swWorldPerturb = normalize(swWorldT * swMapN.x + swWorldB * swMapN.y + swFaceN * max(0.32, swMapN.z));
          normal = normalize((viewMatrix * vec4(swWorldPerturb, 0.0)).xyz);
          `
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec3 finalNightEmis = mix(swEmisSample, swParallaxEmis, step(0.02, glassMask));
          totalEmissiveRadiance += finalNightEmis * uNightGlow * 1.08;
          `
        );
  };

  // 2. ROOF MATERIAL: Refined Geneva Standing-Seam Zinc Mansards + Subtle Dark-Lead Dormer Lucarnes +
  //    Weathered Swiss Terracotta Old Town Tiles + Verdigris Copper Cathédrale Spire + swisstopo Orthophoto Flat Roofs!
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.64,
    metalness: 0.26,
    envMapIntensity: 1.24,
    side: THREE.DoubleSide,
  });

  roofMat.onBeforeCompile = (shader) => {
    shader.uniforms.uOrthoTex = { value: orthoTex };
    shader.uniforms.uSlateTex = { value: photoBundle?.slateRoofDiff || upperMats[0].map };
    shader.uniforms.uBounds = { value: boundsVec };
    shader.uniforms.uNightGlow = nightUniform;

    shader.vertexShader =
      `attribute vec4 aMeta;
attribute vec3 aFaceN;
varying vec2 vRoofMetricUv;
varying vec4 vRoofMeta;
varying vec3 vRoofFaceN;
varying vec3 vRoofWorldPos;
` +
      shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vRoofMetricUv = uv;
        vRoofMeta = aMeta;
        vRoofFaceN = aFaceN;
        vRoofWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader =
      `varying vec2 vRoofMetricUv;
varying vec4 vRoofMeta;
varying vec3 vRoofFaceN;
varying vec3 vRoofWorldPos;
uniform sampler2D uOrthoTex;
uniform sampler2D uSlateTex;
uniform vec4 uBounds;
uniform float uNightGlow;
` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec3 swRN = normalize(vRoofFaceN);
          if (!gl_FrontFacing) swRN = -swRN;
          float rUMeters = vRoofMetricUv.x;
          float isClay = vRoofMeta.x;
          float rSeed = vRoofMeta.y;
          float isCath = vRoofMeta.z;

          vec2 orthoUv = vec2(
            (vRoofWorldPos.x - uBounds.x) / uBounds.z,
            1.0 - (vRoofWorldPos.z - uBounds.y) / uBounds.w
          );
          vec3 orthoCol = texture2D(uOrthoTex, clamp(orthoUv, 0.002, 0.998)).rgb;

          vec2 slateUv = vec2(rUMeters / 6.4, vRoofWorldPos.y / 3.6);
          vec3 slateTexCol = texture2D(uSlateTex, slateUv).rgb;

          // Authentic blue-charcoal Geneva standing-seam zinc mansards & weathered Vieille-Ville clay tiles
          float seamRib = smoothstep(0.86, 0.98, abs(sin(rUMeters * 4.2)));
          vec3 zincCol = vec3(0.068, 0.080, 0.098) * (0.78 + 0.62 * slateTexCol) * (1.0 - seamRib * 0.22);
          vec3 clayBase = mix(vec3(0.22, 0.072, 0.036), vec3(0.16, 0.064, 0.038), rSeed);
          float tileRow = smoothstep(0.80, 0.96, abs(sin(vRoofWorldPos.y * 8.5)));
          vec3 clayCol = clayBase * (0.76 + 0.62 * slateTexCol) * (1.0 - tileRow * 0.16);
          vec3 slopedCol = mix(zincCol, clayCol, isClay);

          // Refined, architectural Geneva Mansard Dormer Windows ('lucarnes') — ONLY on real steep mansard slopes!
          float isMansardSlope = step(0.26, swRN.y) * step(swRN.y, 0.68) * (1.0 - isCath);
          float dormU = fract(rUMeters / 5.2);
          float dormV = fract(vRoofWorldPos.y / 4.2);
          float inDormFrame = step(0.36, dormU) * step(dormU, 0.64) * step(0.24, dormV) * step(dormV, 0.74) * isMansardSlope;
          float inDormGlass = step(0.41, dormU) * step(dormU, 0.59) * step(0.30, dormV) * step(dormV, 0.66) * isMansardSlope;
          float dormLit = step(0.62, fract(sin(floor(rUMeters / 5.2) * 12.9898 + floor(vRoofWorldPos.y / 4.2) * 78.233) * 43758.5453)) * inDormGlass;
          vec3 lucarneSurround = mix(vec3(0.14, 0.15, 0.165), vec3(0.22, 0.19, 0.15), isClay);
          slopedCol = mix(slopedCol, lucarneSurround, inDormFrame * 0.85);
          slopedCol = mix(slopedCol, vec3(0.022, 0.036, 0.056), inDormGlass * 0.94);

          // Cathédrale Saint-Pierre oxidized verdigris copper central spire & alpine slate nave roof!
          if (isCath > 0.5) {
            float isSpire = smoothstep(50.0, 58.0, vRoofWorldPos.y);
            vec3 copperCol = vec3(0.042, 0.165, 0.125) * (0.80 + 0.45 * slateTexCol);
            vec3 cathSlate = vec3(0.055, 0.062, 0.072) * (0.78 + 0.55 * slateTexCol);
            slopedCol = mix(cathSlate, copperCol, isSpire);
          }

          // Only truly flat roofs (> 97.5% vertical normal) use cool gravel/zinc orthophoto blend; ALL pitched hip/mansard roofs stay rich Geneva zinc/clay!
          float isFlat = smoothstep(0.975, 0.995, swRN.y);
          float isUnder = smoothstep(-0.15, -0.45, swRN.y);
          vec3 flatRoofCol = mix(orthoCol * 0.42, vec3(0.11, 0.12, 0.135), 0.45);
          vec3 finalRoof = mix(slopedCol, flatRoofCol, isFlat * 0.88);
          finalRoof = mix(finalRoof, vec3(0.045, 0.042, 0.038), isUnder);
          diffuseColor.rgb = finalRoof;
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(mix(0.56, 0.09, inDormGlass), 0.86, smoothstep(0.975, 0.995, swRN.y));
          `
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.96, 0.70, 0.34) * dormLit * uNightGlow * 0.72;
          `
        );
  };

  // 3. Shared materials for the 4 batched 3D architectural relief meshes (+4 draw calls total!)
  const trimStoneMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.84,
    metalness: 0.04,
    envMapIntensity: 0.95,
  });
  const trimMetalMat = new THREE.MeshStandardMaterial({
    color: 0x25282e,
    roughness: 0.34,
    metalness: 0.74,
    envMapIntensity: 1.55,
  });
  const trimIronMat = new THREE.MeshStandardMaterial({
    color: 0x16191e,
    roughness: 0.42,
    metalness: 0.78,
    envMapIntensity: 1.32,
  });
  const trimAwningMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.90,
    metalness: 0.0,
    side: THREE.DoubleSide,
  });

  return {
    wallMat,
    roofMat,
    nightUniform,
    trimMats: { trimStoneMat, trimMetalMat, trimIronMat, trimAwningMat },
  };
}

/**
 * Loads official 1:1 Swiss Federal Government swisstopo swissBUILDINGS3D (.glb) tiles,
 * assigns per-building photo-matched Geneva styles via real OSM building footprints,
 * deduplicates overlapping coplanar triangles (eliminating ALL building Z-fighting!),
 * pre-bakes exact metric UVs & face normals (eliminating ALL grazing-angle dFdx window glitches!),
 * extrudes real 3D street-facing cornices, pilasters, canopies, awnings & wrought-iron balconies,
 * and merges all 107 tiles into tightly frustum-culled 4x4 Spatial Super-Chunks!
 */
export async function loadSwissBuildings3D(
  worldGroup,
  realData,
  upperMats,
  groundMats,
  photoBundle,
  orthoTex,
  onProgress = () => {},
  insertCollider = null
) {
  const res = await fetch('/data/swissbuildings3d/manifest.json');
  if (!res.ok) throw new Error('swissBUILDINGS3D manifest missing');
  const manifest = await res.json();

  const { wallMat, roofMat, nightUniform, trimMats } = createSwissBuildingsMaterials(
    upperMats,
    groundMats,
    photoBundle,
    orthoTex
  );

  const osmLookup = buildOsmStyleLookup(realData);

  const swissGroup = new THREE.Group();
  swissGroup.name = 'swisstopo_swissBUILDINGS3D_Geneva';
  worldGroup.add(swissGroup);

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // Fast 4m spatial rooftop-height grid recorded from REAL swissBUILDINGS3D vertices
  const roofMaxY = new Map();
  function getRealRoofHeight(x, z, searchRadius = 10) {
    const gx0 = Math.floor(x / 4);
    const gz0 = Math.floor(z / 4);
    const rCells = Math.ceil(searchRadius / 4);
    let bestY = null;
    for (let dz = -rCells; dz <= rCells; dz++) {
      for (let dx = -rCells; dx <= rCells; dx++) {
        const y = roofMaxY.get(`${gx0 + dx},${gz0 + dz}`);
        if (y !== undefined && (bestY === null || y > bestY)) bestY = y;
      }
    }
    return bestY;
  }

  // Global exact 3-vertex triangle deduplication sets across ALL 107 tiles
  const seenWallTris = new Set();
  const seenRoofTris = new Set();
  const seenWallCols = new Set();

  // Spatial 4x4 chunk buckets (~350m x 350m per chunk -> tight frustum culling!)
  const GRID_N = 4;
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  function makeBucketMap() {
    const map = new Map();
    return {
      get(cx, cz) {
        const ix = Math.max(0, Math.min(GRID_N - 1, Math.floor(((cx - minX) / spanX) * GRID_N)));
        const iz = Math.max(0, Math.min(GRID_N - 1, Math.floor(((cz - minZ) / spanZ) * GRID_N)));
        const key = ix + iz * GRID_N;
        let b = map.get(key);
        if (!b) {
          b = { pos: [], norm: [], uv: [], faceN: [], meta: [] };
          map.set(key, b);
        }
        return b;
      },
      map,
    };
  }

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fN = new THREE.Vector3();
  const tileWorldMat = new THREE.Matrix4();
  const nodeWorldMat = new THREE.Matrix4();

  function classifyRoofMeta(cx, cz) {
    const isCath = Math.hypot(cx - -124.0, cz - 543.0) < 52.0 ? 1.0 : 0.0;
    const inOldTown = cz > 335.0 && cx > -355.0 && cx < 180.0;
    const rSeed = hash21(Math.floor(cx / 26.0), Math.floor(cz / 26.0));
    const isClay = inOldTown ? 0.94 : rSeed > 0.78 ? 1.0 : 0.0;
    return [isClay, rSeed, isCath, 0.0];
  }

  function bakeTileIntoBuckets(gltfScene, tileMatrixArr, wallBuckets, roofBuckets, wallTrimMap) {
    tileWorldMat.fromArray(tileMatrixArr);
    gltfScene.matrixAutoUpdate = false;
    gltfScene.matrix.copy(tileWorldMat);
    gltfScene.updateMatrixWorld(true);

    gltfScene.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry?.attributes?.position) return;
      const origMat = obj.material;
      const c = origMat?.color;
      const isRoof = c ? c.r > 0.55 && c.g < 0.45 && c.b < 0.45 : false;

      const geo = obj.geometry;
      const posAttr = geo.attributes.position;
      const index = geo.index;
      nodeWorldMat.copy(obj.matrixWorld);

      const triCount = index ? index.count / 3 : posAttr.count / 3;
      const seenSet = isRoof ? seenRoofTris : seenWallTris;
      const bucketMap = isRoof ? roofBuckets : wallBuckets;

      // Fast pre-pass on wall meshes: record local eave elevation per 2.5m cell so every building's
      // upper-story UVs align to an EXACT integer number of complete floors (ZERO sliced windows at rooflines!)
      let wallEaveGrid = null;
      if (!isRoof) {
        wallEaveGrid = new Map();
        const vTmp = v0;
        for (let vi = 0; vi < posAttr.count; vi++) {
          vTmp.fromBufferAttribute(posAttr, vi).applyMatrix4(nodeWorldMat);
          const ek = `${Math.floor(vTmp.x / 2.5)},${Math.floor(vTmp.z / 2.5)}`;
          const prev = wallEaveGrid.get(ek);
          if (prev === undefined || vTmp.y > prev) wallEaveGrid.set(ek, vTmp.y);
        }
      }

      for (let t = 0; t < triCount; t++) {
        const i0 = index ? index.getX(t * 3) : t * 3;
        const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;

        v0.fromBufferAttribute(posAttr, i0).applyMatrix4(nodeWorldMat);
        v1.fromBufferAttribute(posAttr, i1).applyMatrix4(nodeWorldMat);
        v2.fromBufferAttribute(posAttr, i2).applyMatrix4(nodeWorldMat);

        // Record real rooftop elevation envelope
        if (isRoof || v0.y > 6.0) {
          const gx = Math.floor(v0.x / 4);
          const gz = Math.floor(v0.z / 4);
          const rk = `${gx},${gz}`;
          const my = Math.max(v0.y, v1.y, v2.y);
          const prev = roofMaxY.get(rk);
          if (prev === undefined || my > prev) roofMaxY.set(rk, my);
        }

        // Exact geometric face normal + degenerate sliver triangle guard
        e1.subVectors(v1, v0);
        e2.subVectors(v2, v0);
        fN.crossVectors(e1, e2);
        const area2 = fN.length();
        if (area2 < 1e-4) continue;
        fN.divideScalar(area2);

        const cx = (v0.x + v1.x + v2.x) / 3;
        const cy = (v0.y + v1.y + v2.y) / 3;
        const cz = (v0.z + v1.z + v2.z) / 3;

        // Exact sorted 5cm quantized 3-vertex deduplication
        let k0 = `${Math.round(v0.x * 20)},${Math.round(v0.y * 20)},${Math.round(v0.z * 20)}`;
        let k1 = `${Math.round(v1.x * 20)},${Math.round(v1.y * 20)},${Math.round(v1.z * 20)}`;
        let k2 = `${Math.round(v2.x * 20)},${Math.round(v2.y * 20)},${Math.round(v2.z * 20)}`;
        if (k0 > k1) {
          const tmp = k0;
          k0 = k1;
          k1 = tmp;
        }
        if (k1 > k2) {
          const tmp = k1;
          k1 = k2;
          k2 = tmp;
        }
        if (k0 > k1) {
          const tmp = k0;
          k0 = k1;
          k1 = tmp;
        }
        const dedupKey = `${k0}|${k1}|${k2}`;
        if (seenSet.has(dedupKey)) continue;
        seenSet.add(dedupKey);

        // Ensure roof faces point upward (+Y) cleanly if any CityGML roof polygon had flipped winding
        if (isRoof && fN.y < -0.25 && cy > 8.0) {
          fN.negate();
        }

        const hLen = Math.hypot(fN.x, fN.z);
        const tx = hLen > 0.08 ? fN.z / hLen : 1.0;
        const tz = hLen > 0.08 ? -fN.x / hLen : 0.0;

        // Horizontal bounding-box midpoint ensures both triangles of every vertical wall quad share identical groundY & building style!
        const minXTri = Math.min(v0.x, v1.x, v2.x);
        const maxXTri = Math.max(v0.x, v1.x, v2.x);
        const minZTri = Math.min(v0.z, v1.z, v2.z);
        const maxZTri = Math.max(v0.z, v1.z, v2.z);
        const midX = (minXTri + maxXTri) * 0.5;
        const midZ = (minZTri + maxZTri) * 0.5;

        const bucket = bucketMap.get(cx, cz);
        const groundY = isRoof ? 0 : getGroundHeight(midX, midZ);

        let meta;
        let wallProfile = null;
        if (isRoof) {
          meta = classifyRoofMeta(midX, midZ);
        } else {
          wallProfile = osmLookup.lookupProfile(midX, midZ, fN.x, fN.z);
          meta = [wallProfile.upperLayer, wallProfile.warmth, wallProfile.monType, wallProfile.groundLayer];
        }

        // Longest horizontal edge for both solid ground wall colliders & 3D architectural relief!
        if (!isRoof && Math.abs(fN.y) < 0.35) {
          const minYTri = Math.min(v0.y, v1.y, v2.y);
          const maxYTri = Math.max(v0.y, v1.y, v2.y);

          const pairs = [
            [v0, v1],
            [v1, v2],
            [v2, v0],
          ];
          let bestA = null;
          let bestB = null;
          let bestLen = 0;
          for (let pi = 0; pi < 3; pi++) {
            const pa = pairs[pi][0];
            const pb = pairs[pi][1];
            if (Math.abs(pa.y - pb.y) < 2.2) {
              const segL = Math.hypot(pb.x - pa.x, pb.z - pa.z);
              if (segL > bestLen) {
                bestLen = segL;
                bestA = pa;
                bestB = pb;
              }
            }
          }

          if (bestA && bestLen >= 0.45) {
            const aFirst = bestA.x < bestB.x || (bestA.x === bestB.x && bestA.z < bestB.z);
            const p1 = aFirst ? bestA : bestB;
            const p2 = aFirst ? bestB : bestA;

            // Register solid ground-level wall OBB collider
            if (insertCollider && minYTri < groundY + 3.2 && maxYTri > groundY + 1.4) {
              const colKey = `${Math.round(p1.x * 4)},${Math.round(p1.z * 4)}|${Math.round(p2.x * 4)},${Math.round(p2.z * 4)}`;
              if (!seenWallCols.has(colKey)) {
                seenWallCols.add(colKey);
                insertCollider({
                  kind: 'obb',
                  isWall: true,
                  walkableTop: false,
                  x: (p1.x + p2.x) * 0.5,
                  z: (p1.z + p2.z) * 0.5,
                  yaw: Math.atan2(p2.x - p1.x, p2.z - p1.z),
                  halfW: 0.28,
                  halfL: bestLen * 0.5 + 0.08,
                  maxY: maxYTri,
                });
              }
            }

            // Collect vertical exterior wall segments across central Geneva for batched 3D architectural relief!
            if (
              wallTrimMap &&
              Math.abs(fN.y) < 0.18 &&
              bestLen >= 3.2 &&
              hLen > 0.7 &&
              Math.abs(midX) < 520 &&
              midZ > -520 &&
              midZ < 760
            ) {
              const trimKey = `${Math.round(p1.x * 2)},${Math.round(p1.z * 2)}|${Math.round(p2.x * 2)},${Math.round(p2.z * 2)}`;
              const existing = wallTrimMap.get(trimKey);
              if (existing) {
                if (minYTri < existing.minY) existing.minY = minYTri;
                if (maxYTri > existing.maxY) existing.maxY = maxYTri;
              } else {
                const segDx = p2.x - p1.x;
                const segDz = p2.z - p1.z;
                const segTx = segDx / bestLen;
                const segTz = segDz / bestLen;
                wallTrimMap.set(trimKey, {
                  cx: (p1.x + p2.x) * 0.5,
                  cz: (p1.z + p2.z) * 0.5,
                  tx: segTx,
                  tz: segTz,
                  nx: fN.x / hLen,
                  nz: fN.z / hLen,
                  len: bestLen,
                  minY: minYTri,
                  maxY: maxYTri,
                  groundY,
                  profile: wallProfile,
                });
              }
            }
          }
        }

        // Compute exact integer-floor vertical UV scale so EVERY Geneva building terminates cleanly on a full cornice (ZERO half-sliced top windows!)
        let vScale = 1.0;
        if (!isRoof && Math.abs(fN.y) < 0.35 && wallProfile && wallProfile.monType < 0.5) {
          const eaveLocal = wallEaveGrid
            ? wallEaveGrid.get(`${Math.floor(midX / 2.5)},${Math.floor(midZ / 2.5)}`)
            : undefined;
          const eaveY = Math.max(eaveLocal ?? -1e9, v0.y, v1.y, v2.y);
          const eaveH = eaveY - groundY;
          if (eaveH > 7.4 && eaveH < 48.0) {
            const isMod = wallProfile.upperLayer === 3 || wallProfile.upperLayer === 4;
            const targetFloorH = isMod ? 3.35 : 3.2;
            const nFloors = Math.max(1, Math.round((eaveH - 4.65) / targetFloorH));
            const targetTop = 4.65 + (nFloors - 0.015) * targetFloorH;
            vScale = Math.max(0.84, Math.min(1.16, targetTop / eaveH));
          }
        }

        // Emit 3 flat-faceted vertices with exact metric UVs (uMeters, hAboveGround), face normals & coherent style meta!
        const verts = [v0, v1, v2];
        for (let k = 0; k < 3; k++) {
          const vp = verts[k];
          bucket.pos.push(vp.x, vp.y, vp.z);
          bucket.norm.push(fN.x, fN.y, fN.z);
          bucket.faceN.push(fN.x, fN.y, fN.z);
          bucket.uv.push(vp.x * tx + vp.z * tz, isRoof ? vp.y : (vp.y - groundY) * vScale);
          bucket.meta.push(meta[0], meta[1], meta[2], meta[3]);
        }
      }

      geo.dispose();
      if (origMat && origMat.dispose) origMat.dispose();
    });
  }

  // Build 4 batched 3D architectural relief meshes from collected street-facing wall segments (+4 draw calls!)
  function flushArchitecturalTrim(wallTrimMap, tag) {
    if (!wallTrimMap || wallTrimMap.size === 0) return 0;
    const stoneBuf = makeTrimBuf(true);
    const metalBuf = makeTrimBuf(false);
    const ironBuf = makeTrimBuf(false);
    const awningBuf = makeTrimBuf(true);

    for (const seg of wallTrimMap.values()) {
      const { cx, cz, tx, tz, len, minY, maxY, groundY, profile } = seg;
      if (!profile || profile.monType > 0.5) continue;
      // Only trim grounded street walls that reach at least 1 upper story
      const wallH = maxY - groundY;
      if (minY > groundY + 2.8 || wallH < 7.2) continue;

      // Guarantee true outward street-facing normal & zero courtyard/party-wall clipping!
      let nx = seg.nx;
      let nz = seg.nz;
      const out1 = osmLookup.isPointInsideAnyBuilding(cx + nx * 1.15, cz + nz * 1.15);
      const in1 = osmLookup.isPointInsideAnyBuilding(cx - nx * 1.15, cz - nz * 1.15);
      if (out1 && in1) continue; // Interior party wall between touching buildings -> skip!
      if (out1 && !in1) {
        nx = -nx;
        nz = -nz;
      }
      // Enforce exact right-handed wall tangent (T x Up = +N) so every extruded 3D face has CCW outward winding!
      const wtx = nz;
      const wtz = -nx;

      // Require at least 2.6m of open air directly outside the wall (skips tight inner lightwells!)
      if (osmLookup.isPointInsideAnyBuilding(cx + nx * 2.5, cz + nz * 2.5)) continue;
      // Also check wide open street frontage before adding deeper projecting canopies/balconies
      const openWide = !osmLookup.isPointInsideAnyBuilding(cx + nx * 4.2, cz + nz * 4.2);

      const halfSpan = Math.max(0.8, len * 0.5 - 0.14);
      const [sr, sg, sb] = profile.corniceRgb;

      // 1. Ground-to-First-Floor Dressed Stone Belt Cornice (sits cleanly at 4.92m above street fascia signs!)
      if (profile.upperLayer !== 3 && profile.upperLayer !== 4) {
        pushWallBox(stoneBuf, cx, groundY + 4.92, cz, wtx, wtz, nx, nz, halfSpan, 0.13, -0.02, 0.25, sr, sg, sb);
      }

      // 2. Crowning Top Eave Cornice (casts authentic raking Geneva sun shadows down historic facades!)
      if (profile.hasEaveCornice && wallH >= 10.5 && wallH <= 32.0) {
        pushWallBox(stoneBuf, cx, maxY - 0.24, cz, wtx, wtz, nx, nz, halfSpan, 0.17, -0.02, 0.34, sr, sg, sb);
      }

      // 3. Ground-Floor Carved Stone Pilasters along luxury Quai & Rue du Rhône colonnades
      if (profile.hasPilasters && len >= 5.2 && openWide) {
        const bayCount = Math.max(1, Math.min(10, Math.round(len / 3.8)));
        const step = len / bayCount;
        for (let b = 0; b <= bayCount; b++) {
          const offset = -len * 0.5 + b * step;
          if (Math.abs(offset) > halfSpan - 0.12) continue;
          const px = cx + wtx * offset;
          const pz = cz + wtz * offset;
          pushWallBox(stoneBuf, px, groundY + 2.36, pz, wtx, wtz, nx, nz, 0.21, 2.34, -0.02, 0.16, sr * 0.96, sg * 0.96, sb * 0.96);
        }
      }

      // 4. Belle Époque 3D Projecting Piano Nobile & Upper Stone Balconies + Wrought-Iron Railings (ref_01 & ref_03 Dior!)
      if (profile.hasBalcony3D && len >= 5.4 && openWide) {
        const balSpan = Math.max(1.4, halfSpan - 0.32);
        const balLevels = [groundY + 5.04];
        if (wallH >= 15.0) balLevels.push(groundY + 11.42);

        for (let li = 0; li < balLevels.length; li++) {
          const by = balLevels[li];
          if (by > maxY - 2.6) continue;
          const proj = li === 0 ? 0.68 : 0.62;
          // Stone balcony slab
          pushWallBox(stoneBuf, cx, by, cz, wtx, wtz, nx, nz, balSpan, 0.09, -0.02, proj, sr, sg, sb);
          // Carved limestone corbel brackets beneath balcony slab
          const nCorb = Math.max(2, Math.min(8, Math.round((balSpan * 2) / 3.2) + 1));
          for (let ci = 0; ci < nCorb; ci++) {
            const u = -balSpan + 0.35 + (ci / Math.max(1, nCorb - 1)) * Math.max(0.1, balSpan * 2 - 0.7);
            pushWallBox(
              stoneBuf,
              cx + wtx * u,
              by - 0.22,
              cz + wtz * u,
              wtx,
              wtz,
              nx,
              nz,
              0.11,
              0.15,
              -0.02,
              proj * 0.78,
              sr * 0.90,
              sg * 0.90,
              sb * 0.90
            );
          }

          // Delicate 3D Wrought-Iron Balcony Railing (top handrail, lower bar, side returns & vertical pickets!)
          const railTopY = by + 1.00;
          const railMidY = by + 0.86;
          const railBotY = by + 0.13;
          const rDepth0 = proj - 0.06;
          const rDepth1 = proj - 0.01;
          pushWallBox(ironBuf, cx, railTopY, cz, wtx, wtz, nx, nz, balSpan, 0.026, rDepth0, rDepth1);
          pushWallBox(ironBuf, cx, railMidY, cz, wtx, wtz, nx, nz, balSpan, 0.016, rDepth0, rDepth1);
          pushWallBox(ironBuf, cx, railBotY, cz, wtx, wtz, nx, nz, balSpan, 0.02, rDepth0, rDepth1);
          // End returns back to facade wall
          pushWallBox(ironBuf, cx - wtx * (balSpan - 0.025), railTopY, cz - wtz * (balSpan - 0.025), wtx, wtz, nx, nz, 0.025, 0.025, 0.0, proj - 0.02);
          pushWallBox(ironBuf, cx + wtx * (balSpan - 0.025), railTopY, cz + wtz * (balSpan - 0.025), wtx, wtz, nx, nz, 0.025, 0.025, 0.0, proj - 0.02);
          // Vertical wrought-iron balusters (spaced ~0.58m so silhouette reads crisply at tiny vertex cost!)
          const pCount = Math.max(4, Math.min(34, Math.round((balSpan * 2) / 0.58)));
          for (let pi = 0; pi <= pCount; pi++) {
            const u = -balSpan + (pi / pCount) * (balSpan * 2);
            pushWallBox(ironBuf, cx + wtx * u, by + 0.56, cz + wtz * u, wtx, wtz, nx, nz, 0.016, 0.44, rDepth0, rDepth1);
          }
        }
      }

      // 5. Sleek Rue du Rhône & Modern Swiss Dark-Bronze Cantilevered Sidewalk Canopies ('marquises', ref_03 & ref_04!)
      if (profile.canopyKind === 'modern_metal' && len >= 5.2 && openWide) {
        const canSpan = Math.max(1.5, halfSpan - 0.28);
        const cyCan = groundY + 3.82;
        pushWallBox(metalBuf, cx, cyCan, cz, wtx, wtz, nx, nz, canSpan, 0.075, -0.02, 1.38);
        // Slender steel tension brackets along the canopy
        const tCount = Math.max(2, Math.min(6, Math.round((canSpan * 2) / 4.2) + 1));
        for (let ti = 0; ti < tCount; ti++) {
          const u = -canSpan + 0.5 + (ti / Math.max(1, tCount - 1)) * Math.max(0.1, canSpan * 2 - 1.0);
          pushWallBox(metalBuf, cx + wtx * u, cyCan + 0.24, cz + wtz * u, wtx, wtz, nx, nz, 0.025, 0.18, 0.0, 0.88);
        }
      }

      // 6. Vieille-Ville & Place du Molard Heritage Sloped Fabric Café/Boutique Awnings!
      if (profile.canopyKind === 'fabric_awning' && len >= 4.4 && openWide) {
        const awSpan = Math.max(1.2, Math.min(halfSpan - 0.36, 5.2));
        const [ar, ag, ab] = profile.awningRgb;
        pushSlopedAwning(awningBuf, cx, groundY + 3.56, cz, wtx, wtz, nx, nz, awSpan, 1.24, 0.48, 0.22, ar, ag, ab);
        // Dark-iron wall roller box housing the retracted fabric
        pushWallBox(metalBuf, cx, groundY + 3.60, cz, wtx, wtz, nx, nz, awSpan + 0.06, 0.07, -0.02, 0.14);
      }
    }

    let added = 0;
    const specs = [
      { name: `swiss3D_${tag}_trimStone`, buf: stoneBuf, mat: trimMats.trimStoneMat, castShadow: true },
      { name: `swiss3D_${tag}_trimMetal`, buf: metalBuf, mat: trimMats.trimMetalMat, castShadow: true },
      { name: `swiss3D_${tag}_trimIron`, buf: ironBuf, mat: trimMats.trimIronMat, castShadow: false },
      { name: `swiss3D_${tag}_trimAwning`, buf: awningBuf, mat: trimMats.trimAwningMat, castShadow: true },
    ];
    for (const sp of specs) {
      if (sp.buf.pos.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(sp.buf.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(sp.buf.norm, 3));
      if (sp.buf.col) geo.setAttribute('color', new THREE.Float32BufferAttribute(sp.buf.col, 3));
      geo.computeBoundingBox();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, sp.mat);
      mesh.name = sp.name;
      mesh.castShadow = sp.castShadow;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      swissGroup.add(mesh);
      added++;
    }
    return added;
  }

  function flushBucketsToScene(wallBuckets, roofBuckets, tag) {
    let chunksCreated = 0;
    for (const [isRoof, bMap] of [
      [false, wallBuckets.map],
      [true, roofBuckets.map],
    ]) {
      const mat = isRoof ? roofMat : wallMat;
      for (const [cellKey, b] of bMap.entries()) {
        if (b.pos.length === 0) continue;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
        geo.setAttribute('aFaceN', new THREE.Float32BufferAttribute(b.faceN, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
        geo.setAttribute('aMeta', new THREE.Float32BufferAttribute(b.meta, 4));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = `swiss3D_${tag}_${isRoof ? 'roof' : 'wall'}_${cellKey}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = true;
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        swissGroup.add(mesh);
        chunksCreated++;
      }
    }
    return chunksCreated;
  }

  async function loadAndBakeBatch(tileSlice, wallBuckets, roofBuckets, wallTrimMap) {
    await Promise.all(
      tileSlice.map(async (tile) => {
        try {
          const gltf = await gltfLoader.loadAsync(tile.file);
          bakeTileIntoBuckets(gltf.scene, tile.matrix, wallBuckets, roofBuckets, wallTrimMap);
        } catch (err) {
          console.warn('[swissBUILDINGS3D] Skipped tile', tile.file, err?.message || err);
        }
      })
    );
  }

  const tiles = manifest.tiles || [];
  const CORE_COUNT = Math.min(36, tiles.length);
  const BATCH = 12;
  let loaded = 0;

  // Phase 1 (Before PLAY): load & bake core 36 central Geneva tiles + 3D architectural relief!
  const coreWalls = makeBucketMap();
  const coreRoofs = makeBucketMap();
  const coreTrimMap = new Map();
  for (let i = 0; i < CORE_COUNT; i += BATCH) {
    const slice = tiles.slice(i, Math.min(CORE_COUNT, i + BATCH));
    await loadAndBakeBatch(slice, coreWalls, coreRoofs, coreTrimMap);
    loaded += slice.length;
    const pct = 64 + Math.round((loaded / CORE_COUNT) * 14);
    onProgress(pct, `Sculpting 1:1 photo-matched Geneva architecture (${loaded}/${tiles.length})…`);
  }
  flushBucketsToScene(coreWalls, coreRoofs, 'core');
  flushArchitecturalTrim(coreTrimMap, 'core');
  coreTrimMap.clear();

  // Phase 2 (Background stream right after boot): load & merge remaining outer 71 tiles!
  const remainingDone = (async () => {
    const outerWalls = makeBucketMap();
    const outerRoofs = makeBucketMap();
    const outerTrimMap = new Map();
    for (let i = CORE_COUNT; i < tiles.length; i += BATCH) {
      const slice = tiles.slice(i, Math.min(tiles.length, i + BATCH));
      await loadAndBakeBatch(slice, outerWalls, outerRoofs, outerTrimMap);
      loaded += slice.length;
    }
    flushBucketsToScene(outerWalls, outerRoofs, 'outer');
    flushArchitecturalTrim(outerTrimMap, 'outer');
    outerTrimMap.clear();
    seenWallTris.clear();
    seenRoofTris.clear();
    seenWallCols.clear();
    dracoLoader.dispose();
    return loaded;
  })();

  return {
    group: swissGroup,
    nightUniform,
    getRealRoofHeight,
    roofMaxY,
    remainingDone,
    tileCount: tiles.length,
  };
}
