import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  WORLD_BOUNDS,
  COLLECTIBLES,
  PMB_START,
  PMB_END,
  projectPontMontBlanc,
  getPontMontBlancDeckY,
  getGroundHeight,
  getRawWaterMask,
  isOnBridgeOrPier,
  isSolidJetty,
  isNearWaterMask,
  isWater,
} from './cityData.js';
import {
  createGenevaArchitecturalMaterials,
  createPureAsphaltTextures,
  createPhotoLeafClusterTexture,
  createPlaneTreeBarkTextures,
  createFlagTexture,
  createHelipadTexture,
  createMistTexture,
} from './textures.js';
import { createRealisticWater } from './skyAndWater.js';
import { createRoadTrafficNetwork } from './roadTraffic.js';
import { buildGenevaStreetProps } from './streetProps.js';
import { buildGenevaLandmarks } from './genevaLandmarks.js';
import { buildBainsDesPaquis } from './bainsDesPaquis.js';
import { createCgnPaddleSteamer } from './cgnSteamer.js';
import { buildGenevaPedestrianZones } from './genevaPedestrianZones.js';
import { batchStaticGroup } from './staticBatcher.js';
import { createHumanAnimator } from '../game/humanAnim.js';
import { createStaticColliderGrid } from '../game/collisions.js';

function polygonSignedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a * 0.5;
}

// Build a mature European London Plane Tree ('Platane') branched trunk + organic irregular multi-cluster canopy for InstancedMesh!
function createRealisticTreeGeometries() {
  // 1. Mature London Plane Tree trunk with gnarled European pruning forks & spreading upper boughs
  const trunkParts = [];
  const main = new THREE.CylinderGeometry(0.22, 0.42, 3.8, 8);
  main.translate(0, 1.9, 0);
  trunkParts.push(main);

  const branchSpecs = [
    [0.15, 0.62, 3.1, 2.9, 0.14],
    [1.65, 0.56, 2.8, 3.1, 0.13],
    [3.25, 0.68, 3.2, 2.75, 0.14],
    [4.75, 0.52, 2.7, 3.25, 0.12],
    [0.95, 0.34, 2.5, 3.45, 0.11],
  ];
  for (const [a, tilt, len, startY, rad] of branchSpecs) {
    const br = new THREE.CylinderGeometry(rad * 0.45, rad, len, 6);
    br.translate(0, len * 0.5, 0);
    br.rotateZ(tilt);
    br.rotateY(a);
    br.translate(0, startY, 0);
    trunkParts.push(br);
  }
  const trunkGeo = mergeGeometries(trunkParts, false);
  trunkParts.forEach((g) => g.dispose());

  // 2. Irregular Asymmetric Spreading European Plane-Tree Foliage Clusters (18 airy layered leaf sprays, never uniform spheres!)
  const cardParts = [];
  const cardConfigs = [
    // Inner warm-shaded core
    [0.2, 5.4, -0.1, 4.5, 0.1, 0.12, 0.80],
    [-0.3, 5.6, 0.2, 4.4, Math.PI * 0.36, -0.14, 0.80],
    [0.1, 5.5, -0.2, 4.4, Math.PI * 0.72, 0.10, 0.82],
    // Wide spreading asymmetric outer plane-tree limbs
    [2.1, 5.1, 0.7, 4.0, 0.4, 0.32, 0.94],
    [-1.9, 5.3, -0.6, 3.9, 1.9, -0.28, 0.94],
    [0.6, 4.9, 2.1, 3.9, 1.1, 0.30, 0.92],
    [-0.8, 5.1, -2.0, 3.8, 2.5, -0.26, 0.92],
    [1.8, 6.0, -1.5, 3.7, 0.8, 0.38, 1.00],
    [-1.6, 6.2, 1.5, 3.7, 2.2, -0.35, 1.00],
    // Sunlit airy spreading upper crown (irregular silhouette!)
    [0.4, 7.3, 0.2, 4.3, 0.2, Math.PI * 0.36, 1.12],
    [1.4, 6.9, 1.1, 3.6, 1.4, Math.PI * 0.30, 1.08],
    [-1.3, 7.1, -0.9, 3.5, 2.7, -Math.PI * 0.32, 1.08],
    [1.6, 6.5, -1.2, 3.4, 0.6, Math.PI * 0.26, 1.04],
    [-1.4, 6.6, 1.3, 3.4, 2.1, -Math.PI * 0.24, 1.04],
    [2.5, 5.7, -0.3, 3.1, 1.2, 0.22, 0.98],
    [-2.4, 5.8, 0.4, 3.0, 2.8, -0.22, 0.98],
    // Lower airy overhanging bough skirts
    [1.7, 4.3, -0.4, 3.1, 0.9, -0.22, 0.86],
    [-1.6, 4.4, 0.5, 3.0, 2.4, 0.20, 0.86],
  ];

  for (const [cx, cy, cz, sz, ry, rx, shade] of cardConfigs) {
    // Circular botanical foliage discs (eliminates rectangular corner silhouettes!)
    const p = new THREE.CircleGeometry(sz * 0.54, 10);
    p.rotateX(rx);
    p.rotateY(ry);
    p.translate(cx, cy, cz);
    // AAA SpeedTree spherical canopy normals: eliminates flat-plane shading creases!
    const pPos = p.attributes.position;
    const pNorm = p.attributes.normal;
    const count = pPos.count;
    const cols = new Float32Array(count * 3);
    const vTmp = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      vTmp.set(pPos.getX(k), (pPos.getY(k) - 4.3) * 1.15 + 1.6, pPos.getZ(k)).normalize();
      pNorm.setXYZ(k, vTmp.x, vTmp.y, vTmp.z);
      // Natural vertical sky-occlusion gradient from bottom skirt to sunlit upper crown
      const vShade = Math.min(1.12, shade * (0.86 + Math.max(0, (pPos.getY(k) - 3.4) / 4.2) * 0.24));
      cols[k * 3] = vShade;
      cols[k * 3 + 1] = vShade;
      cols[k * 3 + 2] = vShade;
    }
    p.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    cardParts.push(p);
  }
  const canopyGeo = mergeGeometries(cardParts, false);
  cardParts.forEach((g) => g.dispose());

  return { trunkGeo, canopyGeo };
}

export function buildGenevaWorld(scene, realData, orthoTex, photoBundle, onProgress = () => {}, streetFeatures = null, useSwiss3D = true, pedZonesData = null) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);
  // Dedicated VFX container excluded from GTAOPass override prepass (zero black sprite boxes in sky!)
  const vfxGroup = new THREE.Group();
  worldGroup.add(vfxGroup);

  const emissiveMaterials = [];
  const { minX, maxX, minZ, maxZ } = WORLD_BOUNDS;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;

  onProgress(28, 'Sculpting 1:1 swisstopo ALTI3D terrain & photographic ground splats…');

  // 1. PHOTOREALISTIC 1:1 TERRAIN (higher-res 270x270 grid for razor-clean Genève-Molard shoreline!)
  const terrainGeo = new THREE.PlaneGeometry(spanX, spanZ, 270, 270);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + centerX;
    const wz = pos.getZ(i) + centerZ;
    const pmbProj = projectPontMontBlanc(wx, wz);
    // Keep terrain mesh submerged beneath Lac Léman, BOTH Rhône channels & ALL open water bridges
    // (Pont du Mont-Blanc, Pont des Bergues, Ponts de l'Île, Débarcadère Molard) while keeping solid stone jetties dry!
    const underPmbWater = pmbProj.t > 0.01 && pmbProj.t < 0.99 && pmbProj.lat < 20.0;
    const onOpenBridgeOverWater = isOnBridgeOrPier(wx, wz) && !isSolidJetty(wx, wz) && (underPmbWater || isNearWaterMask(wx, wz, 18));
    let y;
    if ((getRawWaterMask(wx, wz) && !isSolidJetty(wx, wz)) || onOpenBridgeOverWater) {
      y = -3.4;
    } else {
      y = getGroundHeight(wx, wz);
    }
    pos.setY(i, y);
  }
  terrainGeo.computeVertexNormals();

  orthoTex.colorSpace = THREE.SRGBColorSpace;
  orthoTex.anisotropy = 16;

  const terrainMat = new THREE.MeshStandardMaterial({
    map: orthoTex,
    roughness: 0.88,
    metalness: 0.04,
  });

  // Inject crisp tiled photographic paver & park-grass micro-detail into terrain fragment shader!
  if (photoBundle?.paverDiff && photoBundle?.parkGrassDiff) {
    terrainMat.onBeforeCompile = (shader) => {
      shader.uniforms.uPaverTex = { value: photoBundle.paverDiff };
      shader.uniforms.uGrassTex = { value: photoBundle.parkGrassDiff };
      shader.fragmentShader =
        `uniform sampler2D uPaverTex;\nuniform sampler2D uGrassTex;\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 detailUv = vMapUv * vec2(260.0, 240.0);
        vec3 paverCol = texture2D(uPaverTex, detailUv).rgb;
        vec3 grassCol = texture2D(uGrassTex, detailUv * 0.85).rgb;
        // Neutralize any pinkish-magenta satellite orthophoto artifacts on plazas/promenades
        float mag = smoothstep(0.03, 0.12, min(diffuseColor.r, diffuseColor.b) - diffuseColor.g);
        float lum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum * 0.96, lum * 0.95, lum * 0.92), mag * 0.88);
        // Detect real parks/lawns directly from swisstopo orthophoto greenness!
        float greenness = smoothstep(0.015, 0.095, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
        vec3 microDetail = mix(paverCol * 0.86, grassCol * 0.92, greenness);
        // Preserve 1:1 macro satellite hues with physically calibrated granite & grass brightness!
        diffuseColor.rgb = mix(diffuseColor.rgb, microDetail * (0.55 + 0.45 * diffuseColor.rgb), 0.78);
        `
      );
    };
  }

  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.position.set(centerX, 0, centerZ);
  terrain.receiveShadow = true;
  worldGroup.add(terrain);

  const outerGround = new THREE.Mesh(
    new THREE.RingGeometry(940, 1280, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x354636, roughness: 0.96 })
  );
  outerGround.position.set(centerX, -0.6, centerZ);
  worldGroup.add(outerGround);

  // 2. REAL-TIME PLANAR REFLECTIVE LAC LÉMAN WATER
  const { waterMesh, waterUniforms } = createRealisticWater(scene);

  // 3. CLEAN LAYERED 1:1 ROADS: Pure Dark Asphalt Roadway (y+0.155..0.21) + RAISED Granite Sidewalks (y+0.25) strictly flanking carriageways!
  // Eliminates upside-down sunken sidewalks, intersection curb overlaps & blotchy stains across all 1,330 real Geneva streets!
  onProgress(40, `Paving ${realData.roads.length} real 1:1 Geneva roads & raised granite sidewalks…`);
  const asphaltBuf = { pos: [], norm: [], uv: [] };
  const sidewalkBuf = { pos: [], norm: [], uv: [] };

  const roadHeightByClass = {
    primary: 0.21,
    trunk: 0.21,
    secondary: 0.19,
    tertiary: 0.17,
    residential: 0.155,
    unclassified: 0.155,
  };

  // Pre-index vehicular road segments so raised flanking sidewalks cleanly break at cross-street intersections!
  const allVehSegsPre = [];
  for (let ri = 0; ri < (realData.roads || []).length; ri++) {
    const r = realData.roads[ri];
    if (!r.p || r.p.length < 2) continue;
    if (r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'service' || r.k === 'footway') continue;
    const hw = (r.w || 8.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      allVehSegsPre.push([ri, r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw]);
    }
  }
  function inAnyOtherVehRoad(x, z, selfRi, pad = 0.25) {
    for (let k = 0; k < allVehSegsPre.length; k++) {
      const s = allVehSegsPre[k];
      if (s[0] === selfRi) continue;
      const m = s[5] + pad;
      if (x < Math.min(s[1], s[3]) - m || x > Math.max(s[1], s[3]) + m) continue;
      if (z < Math.min(s[2], s[4]) - m || z > Math.max(s[2], s[4]) + m) continue;
      const vx = s[3] - s[1], vz = s[4] - s[2];
      const l2 = vx * vx + vz * vz;
      if (l2 < 0.1) continue;
      const t = Math.max(0, Math.min(1, ((x - s[1]) * vx + (z - s[2]) * vz) / l2));
      if (Math.hypot(x - (s[1] + t * vx), z - (s[2] + t * vz)) < m) return true;
    }
    return false;
  }

  function pushRibbon(target, x1, z1, x2, z2, halfW, yLift, uvScaleLen, uvScaleW = 1, extendEnds = 0) {
    let dx = x2 - x1;
    let dz = z2 - z1;
    const rawLen = Math.hypot(dx, dz);
    if (rawLen < 0.4) return 0;

    // Slight tangent overlap at OSM road segment endpoints eliminates perpendicular hairline cracks!
    let sx1 = x1, sz1 = z1, sx2 = x2, sz2 = z2;
    if (extendEnds > 0) {
      const tx = (dx / rawLen) * extendEnds;
      const tz = (dz / rawLen) * extendEnds;
      sx1 -= tx; sz1 -= tz;
      sx2 += tx; sz2 += tz;
      dx = sx2 - sx1;
      dz = sz2 - sz1;
    }
    const segLen = Math.hypot(dx, dz);

    const steps = Math.max(1, Math.ceil(segLen / 4.5));
    const px = (-dz / segLen) * halfW;
    const pz = (dx / segLen) * halfW;
    let distAcc = 0;

    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const ax = sx1 + dx * t0;
      const az = sz1 + dz * t0;
      const bx = sx1 + dx * t1;
      const bz = sz1 + dz * t1;

      const subLen = segLen / steps;
      const v0 = distAcc / uvScaleLen;
      const v1 = (distAcc + subLen) / uvScaleLen;
      distAcc += subLen;

      const yAL = getGroundHeight(ax + px, az + pz) + yLift;
      const yAR = getGroundHeight(ax - px, az - pz) + yLift;
      const yBL = getGroundHeight(bx + px, bz + pz) + yLift;
      const yBR = getGroundHeight(bx - px, bz - pz) + yLift;

      target.pos.push(
        ax + px, yAL, az + pz,
        bx - px, yBR, bz - pz,
        ax - px, yAR, az - pz,
        ax + px, yAL, az + pz,
        bx + px, yBL, bz + pz,
        bx - px, yBR, bz - pz
      );
      for (let k = 0; k < 6; k++) target.norm.push(0, 1, 0);
      target.uv.push(
        0, v0,       uvScaleW, v1,  uvScaleW, v0,
        0, v0,       0, v1,         uvScaleW, v1
      );
    }
    return segLen;
  }

  for (let ri = 0; ri < (realData.roads || []).length; ri++) {
    const r = realData.roads[ri];
    if (!r.p || r.p.length < 2) continue;
    const isPed = r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'service' || r.k === 'footway';
    const isPmbBridge = Boolean(r.br && r.n && /Mont-Blanc/.test(r.n));
    const roadHalfW = isPmbBridge ? 8.05 : (r.w || 8.0) * 0.5;
    const swStripW = r.br ? 1.8 : r.k === 'primary' || r.k === 'trunk' ? 3.8 : 3.2;
    const roadLift = r.br ? 0.26 : (roadHeightByClass[r.k] || 0.16);

    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      // Never pave non-bridge paths across open Lac Léman water basins!
      if (!r.br && getRawWaterMask(mx, mz) && !isOnBridgeOrPier(mx, mz)) continue;

      if (isPed) {
        if (!inAnyOtherVehRoad(mx, mz, -1, 0.2)) {
          const pedHW = (r.w || 6.0) * 0.56;
          pushRibbon(sidewalkBuf, x1, z1, x2, z2, pedHW, 0.25, 4.2, pedHW * 0.45, 0.2);
        }
      } else {
        // Pure dark asphalt carriageway cleanly BELOW raised sidewalks
        pushRibbon(asphaltBuf, x1, z1, x2, z2, roadHalfW, roadLift, 14.0, 1, 0.35);

        // Raised left & right granite sidewalks (y + 0.25m — 4..9cm ABOVE asphalt!), skipping cross-street carriageways!
        if (!isPmbBridge) {
          const dx = x2 - x1, dz = z2 - z1;
          const segLen = Math.hypot(dx, dz);
          if (segLen >= 0.8) {
            const nx = -dz / segLen, nz = dx / segLen;
            const subs = Math.max(1, Math.ceil(segLen / 6.0));
            const offCenter = roadHalfW + swStripW * 0.5 + 0.08;
            for (let s = 0; s < subs; s++) {
              const t0 = s / subs, t1 = (s + 1) / subs;
              const ax = x1 + dx * t0, az = z1 + dz * t0;
              const bx = x1 + dx * t1, bz = z1 + dz * t1;
              for (const side of [-1, 1]) {
                const ox = nx * side * offCenter;
                const oz = nz * side * offCenter;
                const smx = (ax + bx) * 0.5 + ox;
                const smz = (az + bz) * 0.5 + oz;
                if (!r.br && getRawWaterMask(smx, smz)) continue;
                if (inAnyOtherVehRoad(smx, smz, ri, 0.45)) continue;
                pushRibbon(sidewalkBuf, ax + ox, az + oz, bx + ox, bz + oz, swStripW * 0.5, r.br ? 0.29 : 0.25, 4.2, swStripW * 0.28, 0.14);
              }
            }
          }
        }
      }
    }
  }

  const { map: roadMap, normalMap: roadNor, roughnessMap: roadRough } = createPureAsphaltTextures(photoBundle);
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: roadMap,
    normalMap: roadNor,
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: roadRough,
    roughness: 0.72,
    metalness: 0.08,
    envMapIntensity: 1.48,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  if (asphaltBuf.pos.length > 0) {
    const aGeo = new THREE.BufferGeometry();
    aGeo.setAttribute('position', new THREE.Float32BufferAttribute(asphaltBuf.pos, 3));
    aGeo.setAttribute('normal', new THREE.Float32BufferAttribute(asphaltBuf.norm, 3));
    aGeo.setAttribute('uv', new THREE.Float32BufferAttribute(asphaltBuf.uv, 2));
    const aMesh = new THREE.Mesh(aGeo, asphaltMat);
    aMesh.receiveShadow = true;
    worldGroup.add(aMesh);
  }

  const cobbleMat = new THREE.MeshStandardMaterial({
    map: photoBundle?.paverDiff || null,
    normalMap: photoBundle?.paverNor || null,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: photoBundle?.paverRough || null,
    color: new THREE.Color(0xc4c0b8), // harmonized Swiss Ticino silver-grey granite sidewalk tone (seamless with pedestrian plazas!)
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 1.05,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // Harmonize sidewalk paving hue seamlessly with the elevated Ticino granite plazas (ZERO dark-brown vs pale-white seams!)
  cobbleMat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vCobWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>\nvCobWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader =
      `varying vec3 vCobWorldPos;\n` +
      shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        // Harmonize sidewalk pavers seamlessly to Swiss Ticino silver-grey granite in Rues-Basses/Quais & warm porphyry in Vieille-Ville!
        float isOldTownCob = smoothstep(335.0, 365.0, vCobWorldPos.z) * step(-360.0, vCobWorldPos.x) * step(vCobWorldPos.x, 165.0);
        float lumCob = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        vec3 ticinoCol = vec3(0.42, 0.41, 0.39) * (0.72 + lumCob * 0.85);
        vec3 vieilleCol = mix(diffuseColor.rgb, vec3(lumCob * 1.03, lumCob * 1.00, lumCob * 0.96), 0.45);
        diffuseColor.rgb = mix(ticinoCol, vieilleCol, isOldTownCob);
        vec2 slabId = floor(vCobWorldPos.xz * 1.15);
        float slabHash = fract(sin(dot(slabId, vec2(127.1, 311.7))) * 43758.5453);
        diffuseColor.rgb *= (0.95 + slabHash * 0.10);`
      );
  };
  if (sidewalkBuf.pos.length > 0) {
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidewalkBuf.pos, 3));
    cGeo.setAttribute('normal', new THREE.Float32BufferAttribute(sidewalkBuf.norm, 3));
    cGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sidewalkBuf.uv, 2));
    const cMesh = new THREE.Mesh(cGeo, cobbleMat);
    cMesh.receiveShadow = true;
    worldGroup.add(cMesh);
  }

  // 4. 2-TIER 2K PBR ARCHITECTURAL EXTRUSION OF ALL 2,378 REAL GENEVA BUILDINGS!
  // Separate street-level shopfronts/pavilions (never repeated mid-wall!) + exact 3.2m metric upper stories!
  onProgress(58, `Constructing ${realData.buildings.length} 2K PBR 1:1 Geneva buildings…`);
  const { upperMats, groundMats } = createGenevaArchitecturalMaterials(photoBundle);
  for (const m of [...upperMats, ...groundMats]) emissiveMaterials.push(m);
  const upperBuckets = upperMats.map(() => ({ pos: [], norm: [], uv: [], col: [] }));
  const groundBuckets = groundMats.map(() => ({ pos: [], norm: [], uv: [], col: [] }));
  const mansardSlateBuf = { pos: [], norm: [], uv: [] };
  const mansardClayBuf = { pos: [], norm: [], uv: [] };
  const corniceBuf = { pos: [], norm: [] };
  const balconyBuf = { pos: [], norm: [] };
  const balconyRailBuf = { pos: [], norm: [] };
  const dormerBuf = { pos: [], norm: [] };
  const awningBuf = { pos: [], norm: [], col: [] };
  const roofBuf = { pos: [], norm: [], uv: [] };
  const chimneyCoords = [];

  const staticColliders = createStaticColliderGrid(28);
  const insertCollider = staticColliders.insert;
  const queryColliders = staticColliders.query;
  const queryCollidersRect = staticColliders.queryRect;

  // Unified Interactive Geneva World Objects Registry (benches, café chairs, lakeside railings, TPG machines, fountains, bins & landmarks!)
  const interactables = [];
  function registerInteractable(item) {
    interactables.push(item);
  }
  function findNearestInteractable(px, pz, maxDist = 2.8) {
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < interactables.length; i++) {
      const it = interactables[i];
      const d = Math.hypot(it.x - px, it.z - pz);
      const r = it.radius || maxDist;
      if (d <= r) {
        // Prefer objects slightly closer to their trigger center (and benches/chairs over distant landmarks)
        const prio = it.priority || 0;
        const score = d - prio * 0.45;
        if (score < bestScore) {
          bestScore = score;
          best = { item: it, dist: d };
        }
      }
    }
    return best;
  }

  function pushWallQuad(bucket, x1, z1, x2, z2, yBot, yTop, nx, nz, uSpan, vSpan, r, g, b, aoBot, aoTop) {
    bucket.pos.push(
      x1, yBot, z1,   x2, yBot, z2,   x2, yTop, z2,
      x1, yBot, z1,   x2, yTop, z2,   x1, yTop, z1
    );
    for (let k = 0; k < 6; k++) bucket.norm.push(nx, 0, nz);
    bucket.uv.push(
      0, 0,  uSpan, 0,  uSpan, vSpan,
      0, 0,  uSpan, vSpan,  0, vSpan
    );
    bucket.col.push(
      r * aoBot, g * aoBot, b * aoBot,
      r * aoBot, g * aoBot, b * aoBot,
      r * aoTop, g * aoTop, b * aoTop,
      r * aoBot, g * aoBot, b * aoBot,
      r * aoTop, g * aoTop, b * aoTop,
      r * aoTop, g * aoTop, b * aoTop
    );
  }

  for (let bi = 0; bi < realData.buildings.length; bi++) {
    const b = realData.buildings[bi];
    const pts = b.p;
    if (!pts || pts.length < 3) continue;

    const area = polygonSignedArea(pts);
    const absArea = Math.abs(area);
    if (absArea < 6) continue;
    const poly = area > 0 ? pts.slice().reverse() : pts;

    let bMinX = Infinity, bMaxX = -Infinity, bMinZ = Infinity, bMaxZ = -Infinity;
    for (const [px, pz] of poly) {
      if (px < bMinX) bMinX = px;
      if (px > bMaxX) bMaxX = px;
      if (pz < bMinZ) bMinZ = pz;
      if (pz > bMaxZ) bMaxZ = pz;
    }
    const cx = (bMinX + bMaxX) * 0.5;
    const cz = (bMinZ + bMaxZ) * 0.5;

    if (cx < minX || cx > maxX || cz < minZ || cz > maxZ) continue;
    if (Math.hypot(cx - 112, cz - 166) < 16) continue;
    if (Math.hypot(cx - -10, cz - 148) < 12) continue;

    const baseY = getGroundHeight(cx, cz) - 1.2;
    let h = b.h;
    const inJardinAnglais = cx > -10 && cx < 250 && cz > 90 && cz < 260;
    if (inJardinAnglais && absArea < 500) h = Math.min(h, 4.6);
    else if (absArea < 85 && h > 10) h = 5.2;

    const isPavilion = h < 6.5;
    const hasMansard = !isPavilion && h > 9.5 && absArea > 70;
    const mansardH = hasMansard ? 2.4 : 0;
    const wallTopY = baseY + h + 1.2 - mansardH;
    const roofTopY = baseY + h + 1.2;

    // Exact 2D footprint polygon collider ALWAYS active so diagonal Geneva buildings stay solid with ZERO invisible walls!
    insertCollider({ kind: 'poly', pts: poly, minX: bMinX, maxX: bMaxX, minZ: bMinZ, maxZ: bMaxZ, maxY: roofTopY });
    // When official 1:1 swisstopo swissBUILDINGS3D 3D meshes are active, skip generating generic extruded OSM boxes!
    if (useSwiss3D) continue;

    // Authentic Geneva Historic Molasse Sandstone & Haussmann Limestone across Quai du Général-Guisan, Rue du Rhône & Rues-Basses!
    // (In OSM most historic luxury sandstone blocks are tagged 'commercial' — never turn Hôtel Métropole & Rue du Rhône into blue glass boxes!)
    let uIdx = (bi * 7 + Math.abs(Math.floor(cx * 0.08))) % 4;
    const inHistoricQuayCore = cx > -320 && cx < 320 && cz > 105 && cz < 380;
    if (inHistoricQuayCore) {
      // Quai du Général-Guisan / Hôtel Métropole / Rue du Rhône: warm golden molasse sandstone & Haussmann limestone!
      uIdx = [0, 1, 0, 2, 1, 3][bi % 6];
    } else if ((b.k === 'office' || b.k === 'train_station') && bi % 3 === 0) {
      uIdx = 4; // occasional modern Swiss bank glass infill away from the historic quay frontage
    } else if (cz > 340 && cx > -360 && cx < 140) {
      // Historic Vieille-Ville: warm ochre sandstone & terracotta townhouses
      uIdx = bi % 3 === 0 ? 3 : 1;
    } else if (cz < -110 && cx > -220 && cx < 280) {
      // Quai du Mont-Blanc Grand Hotels: varied cream Haussmann, pale ashlar, warm sandstone
      uIdx = [0, 1, 2, 0, 3][bi % 5];
    }

    const gIdx =
      cz > 120 && cz < 320 && cx > -220 && cx < 220
        ? bi % 2 === 0 ? 1 : 0 // Rue du Rhone luxury watch boutiques & dressed stone arcades
        : bi % 3;

    // Subtle organic stone warmth variation per building + grounded street-level contact AO!
    const tint = 0.9 + ((bi * 37) % 100) / 100 * 0.14;
    const warmR = tint * (1.0 + (((bi * 17) % 10) - 5) * 0.015);
    const warmG = tint;
    const warmB = tint * (1.0 - (((bi * 17) % 10) - 5) * 0.015);
    const aoBot = 0.72;

    const roofPoly = hasMansard
      ? poly.map(([px, pz]) => [px + (cx - px) * 0.08, pz + (cz - pz) * 0.08])
      : poly;

    for (let i = 0; i < poly.length; i++) {
      const [x1, z1] = poly[i];
      const [x2, z2] = poly[(i + 1) % poly.length];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.25) continue;

      const nx = -dz / len;
      const nz = dx / len;
      const uSpan = len / 12.0;

      if (isPavilion) {
        // Dedicated single-story lakeside stone & conservatory glass pavilion (clean v: 0..1!)
        const pavU = Math.max(0.5, len / 7.5);
        pushWallQuad(groundBuckets[3], x1, z1, x2, z2, baseY, wallTopY, nx, nz, pavU, 1.0, warmR, warmG, warmB, aoBot, 1.0);
        // Belle Époque overhanging stone cornice & pitched dark-zinc pavilion roof skirt (no flat grey shoeboxes!)
        const pOver = 0.62;
        const pox = nx * pOver;
        const poz = nz * pOver;
        const pBot = wallTopY - 0.16;
        const pTop = wallTopY + 0.18;
        corniceBuf.pos.push(
          x1 + pox, pBot, z1 + poz,  x2 + pox, pBot, z2 + poz,  x2 + pox, pTop, z2 + poz,
          x1 + pox, pBot, z1 + poz,  x2 + pox, pTop, z2 + poz,  x1 + pox, pTop, z1 + poz,
          x1, pBot, z1,  x2, pBot, z2,  x2 + pox, pBot, z2 + poz,
          x1, pBot, z1,  x2 + pox, pBot, z2 + poz,  x1 + pox, pBot, z1 + poz
        );
        for (let k = 0; k < 6; k++) corniceBuf.norm.push(nx, 0, nz);
        for (let k = 0; k < 6; k++) corniceBuf.norm.push(0, -1, 0);
        // Sloped dark zinc hipped roof rising inward toward pavilion center
        const rIn1x = x1 + (cx - x1) * 0.24, rIn1z = z1 + (cz - z1) * 0.24;
        const rIn2x = x2 + (cx - x2) * 0.24, rIn2z = z2 + (cz - z2) * 0.24;
        const hipTop = wallTopY + 1.25;
        mansardSlateBuf.pos.push(
          x1 + pox, pTop, z1 + poz,  x2 + pox, pTop, z2 + poz,  rIn2x, hipTop, rIn2z,
          x1 + pox, pTop, z1 + poz,  rIn2x, hipTop, rIn2z,      rIn1x, hipTop, rIn1z
        );
        for (let k = 0; k < 6; k++) mansardSlateBuf.norm.push(nx * 0.65, 0.76, nz * 0.65);
        mansardSlateBuf.uv.push(0, 0, pavU, 0, pavU, 1, 0, 0, pavU, 1, 0, 1);
      } else {
        const groundTopY = Math.min(wallTopY, baseY + 5.2);
        const gSpanU = len / 9.5;
        // Tier 1: Street-level ground boutique / stone arcade (mapped strictly v: 0..1 ONCE!)
        pushWallQuad(groundBuckets[gIdx], x1, z1, x2, z2, baseY, groundTopY, nx, nz, gSpanU, 1.0, warmR, warmG, warmB, aoBot, 0.96);

        // Tier 2: Seamless upper stories at exact 3.2m metric floor height (4 floors = 12.8m per tile!)
        const upperH = wallTopY - groundTopY;
        if (upperH > 0.35) {
          const vSpan = uIdx === 4 ? upperH / 16.0 : upperH / 12.8;
          pushWallQuad(upperBuckets[uIdx], x1, z1, x2, z2, groundTopY, wallTopY, nx, nz, uSpan, vSpan, warmR, warmG, warmB, 0.95, 1.0);
        }
      }

      // 3D Overhanging Carved Stone Cornice + Ground-Floor Swiss Boutique Awnings!
      if (hasMansard && len > 4.0) {
        const overhang = 0.55;
        const cTop = wallTopY + 0.12;
        const cBot = wallTopY - 0.45;
        const ox = nx * overhang;
        const oz = nz * overhang;
        corniceBuf.pos.push(
          x1 + ox, cBot, z1 + oz,  x2 + ox, cBot, z2 + oz,  x2 + ox, cTop, z2 + oz,
          x1 + ox, cBot, z1 + oz,  x2 + ox, cTop, z2 + oz,  x1 + ox, cTop, z1 + oz,
          x1, cBot, z1,  x2, cBot, z2,  x2 + ox, cBot, z2 + oz,
          x1, cBot, z1,  x2 + ox, cBot, z2 + oz,  x1 + ox, cBot, z1 + oz
        );
        for (let k = 0; k < 6; k++) corniceBuf.norm.push(nx, 0, nz);
        for (let k = 0; k < 6; k++) corniceBuf.norm.push(0, -1, 0);

        // 3D Luxury Geneva Watchmaker & Café Fabric Awnings with Hanging Valance Skirts along Quai & Rue du Rhône!
        if (len > 6.0 && (inHistoricQuayCore || (bi + i) % 2 === 0)) {
          const awYTop = baseY + 5.05;
          const awYBot = baseY + 4.22;
          const valBot = awYBot - 0.24;
          const aox = nx * 1.55;
          const aoz = nz * 1.55;
          const ax1 = x1 + dx * 0.08, az1 = z1 + dz * 0.08;
          const ax2 = x1 + dx * 0.92, az2 = z1 + dz * 0.92;
          // Sloped canopy + vertical hanging fabric valance lip
          awningBuf.pos.push(
            ax1, awYTop, az1,  ax2, awYTop, az2,  ax2 + aox, awYBot, az2 + aoz,
            ax1, awYTop, az1,  ax2 + aox, awYBot, az2 + aoz,  ax1 + aox, awYBot, az1 + aoz,
            ax1 + aox, valBot, az1 + aoz,  ax2 + aox, valBot, az2 + aoz,  ax2 + aox, awYBot, az2 + aoz,
            ax1 + aox, valBot, az1 + aoz,  ax2 + aox, awYBot, az2 + aoz,  ax1 + aox, awYBot, az1 + aoz
          );
          const palAw = [
            [0.46, 0.11, 0.16], // Geneva Burgundy
            [0.11, 0.26, 0.19], // Heritage Geneva Green
            [0.12, 0.19, 0.30], // Swiss Navy
            [0.72, 0.65, 0.54], // Luxury Boutique Cream
          ];
          const aCol = palAw[(bi + i) % palAw.length];
          for (let k = 0; k < 6; k++) {
            awningBuf.norm.push(nx * 0.55, 0.83, nz * 0.55);
            awningBuf.col.push(aCol[0], aCol[1], aCol[2]);
          }
          for (let k = 0; k < 6; k++) {
            awningBuf.norm.push(nx, 0, nz);
            awningBuf.col.push(aCol[0] * 0.85, aCol[1] * 0.85, aCol[2] * 0.85);
          }
        }
      }

      // Sloped Geneva zinc/slate OR Vieille-Ville terracotta clay mansard bevel + 3D projecting balconies & roof dormers!
      if (hasMansard) {
        const isOldTownClay = (cz > 310 && cx > -360 && cx < 180) || bi % 7 === 0;
        const mBuf = isOldTownClay ? mansardClayBuf : mansardSlateBuf;
        const [rx1, rz1] = roofPoly[i];
        const [rx2, rz2] = roofPoly[(i + 1) % poly.length];
        mBuf.pos.push(
          x1, wallTopY, z1,    x2, wallTopY, z2,    rx2, roofTopY, rz2,
          x1, wallTopY, z1,    rx2, roofTopY, rz2,  rx1, roofTopY, rz1
        );
        const mnx = nx * 0.72;
        const mny = 0.69;
        const mnz = nz * 0.72;
        for (let k = 0; k < 6; k++) mBuf.norm.push(mnx, mny, mnz);
        mBuf.uv.push(0, 0, uSpan, 0, uSpan, 1, 0, 0, uSpan, 1, 0, 1);

        // 3D Haussmann Projecting Carved Stone Balconies + Wrought-Iron Juliet Railings (2nd & 4th floors!)
        if (len > 6.0 && uIdx !== 4 && (inHistoricQuayCore || (bi + i) % 2 === 0)) {
          const floorsBal = h > 16.5 ? [baseY + 8.55, baseY + 14.95] : [baseY + 8.55];
          const box = nx * 0.78;
          const boz = nz * 0.78;
          const bx1 = x1 + dx * 0.08, bz1 = z1 + dz * 0.08;
          const bx2 = x1 + dx * 0.92, bz2 = z1 + dz * 0.92;
          for (const bY of floorsBal) {
            if (bY > wallTopY - 1.6) continue;
            const bH = 0.34;
            balconyBuf.pos.push(
              bx1 + box, bY - bH, bz1 + boz,  bx2 + box, bY - bH, bz2 + boz,  bx2 + box, bY, bz2 + boz,
              bx1 + box, bY - bH, bz1 + boz,  bx2 + box, bY, bz2 + boz,       bx1 + box, bY, bz1 + boz,
              bx1, bY, bz1,                   bx2, bY, bz2,                   bx2 + box, bY, bz2 + boz,
              bx1, bY, bz1,                   bx2 + box, bY, bz2 + boz,       bx1 + box, bY, bz1 + boz
            );
            for (let k = 0; k < 6; k++) balconyBuf.norm.push(nx, 0, nz);
            for (let k = 0; k < 6; k++) balconyBuf.norm.push(0, 1, 0);

            // 3D Black Wrought-Iron Balcony Top Handrail & Mid Bar + Corner Posts
            const rTop = bY + 0.98;
            const rMid = bY + 0.52;
            const rThick = 0.07;
            balconyRailBuf.pos.push(
              bx1 + box, rTop - rThick, bz1 + boz,  bx2 + box, rTop - rThick, bz2 + boz,  bx2 + box, rTop, bz2 + boz,
              bx1 + box, rTop - rThick, bz1 + boz,  bx2 + box, rTop, bz2 + boz,           bx1 + box, rTop, bz1 + boz,
              bx1 + box, rMid - 0.04, bz1 + boz,    bx2 + box, rMid - 0.04, bz2 + boz,    bx2 + box, rMid, bz2 + boz,
              bx1 + box, rMid - 0.04, bz1 + boz,    bx2 + box, rMid, bz2 + boz,           bx1 + box, rMid, bz1 + boz
            );
            for (let k = 0; k < 12; k++) balconyRailBuf.norm.push(nx, 0, nz);
            // Vertical wrought-iron balusters every ~1.6m along the balcony rail
            const balN = Math.min(10, Math.max(3, Math.floor(len / 1.8)));
            const txB = (dx / len) * 0.035;
            const tzB = (dz / len) * 0.035;
            for (let bp = 0; bp <= balN; bp++) {
              const bf = bp / balN;
              const pxB = bx1 + (bx2 - bx1) * bf + box;
              const pzB = bz1 + (bz2 - bz1) * bf + boz;
              balconyRailBuf.pos.push(
                pxB - txB, bY, pzB - tzB,  pxB + txB, bY, pzB + tzB,  pxB + txB, rTop, pzB + tzB,
                pxB - txB, bY, pzB - tzB,  pxB + txB, rTop, pzB + tzB, pxB - txB, rTop, pzB - tzB
              );
              for (let k = 0; k < 6; k++) balconyRailBuf.norm.push(nx, 0, nz);
            }
          }
        }

        // 3D Geneva Mansard Dormer Windows ('lucarnes') projecting out of the sloped roofs!
        if (len > 6.5 && (inHistoricQuayCore || (bi + i) % 2 === 0)) {
          const dCount = Math.min(3, Math.floor(len / 7.5));
          for (let d = 0; d < dCount; d++) {
            const frac = (d + 0.5) / dCount;
            const dcx = x1 + dx * frac;
            const dcz = z1 + dz * frac;
            const dHalfW = 0.72;
            const tx = (dx / len) * dHalfW;
            const tz = (dz / len) * dHalfW;
            const dOutX = nx * 0.52;
            const dOutZ = nz * 0.52;
            const dy0 = wallTopY + 0.35;
            const dy1 = wallTopY + 1.85;
            // Dormer front window face + pitched top cap
            dormerBuf.pos.push(
              dcx - tx + dOutX, dy0, dcz - tz + dOutZ,  dcx + tx + dOutX, dy0, dcz + tz + dOutZ,  dcx + tx + dOutX, dy1, dcz + tz + dOutZ,
              dcx - tx + dOutX, dy0, dcz - tz + dOutZ,  dcx + tx + dOutX, dy1, dcz + tz + dOutZ,  dcx - tx + dOutX, dy1, dcz - tz + dOutZ,
              dcx - tx, dy1, dcz - tz,                  dcx + tx, dy1, dcz + tz,                  dcx + tx + dOutX, dy1, dcz + tz + dOutZ,
              dcx - tx, dy1, dcz - tz,                  dcx + tx + dOutX, dy1, dcz + tz + dOutZ,  dcx - tx + dOutX, dy1, dcz - tz + dOutZ
            );
            for (let k = 0; k < 6; k++) dormerBuf.norm.push(nx, 0, nz);
            for (let k = 0; k < 6; k++) dormerBuf.norm.push(0, 1, 0);
          }
        }
      }
    }

    // Orthophoto-mapped flat/inner roof crown
    const contour2D = roofPoly.map(([px, pz]) => new THREE.Vector2(px, pz));
    const tris = THREE.ShapeUtils.triangulateShape(contour2D, []);
    for (const [i0, i1, i2] of tris) {
      const [ax, az] = roofPoly[i0];
      const [bx, bz] = roofPoly[i2];
      const [cxp, czp] = roofPoly[i1];
      roofBuf.pos.push(ax, roofTopY, az, bx, roofTopY, bz, cxp, roofTopY, czp);
      roofBuf.norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      roofBuf.uv.push(
        (ax - minX) / spanX, 1 - (az - minZ) / spanZ,
        (bx - minX) / spanX, 1 - (bz - minZ) / spanZ,
        (cxp - minX) / spanX, 1 - (czp - minZ) / spanZ
      );
    }

    if (hasMansard && bi % 2 === 0 && chimneyCoords.length < 750) {
      chimneyCoords.push([cx + ((bi % 5) - 2) * 1.8, roofTopY, cz + (((bi * 3) % 5) - 2) * 1.8]);
    }
  }

  // Real Geneva watchmaker, grand hotel & luxury shopfront signage is mounted by genevaIdentity.js onto exact swissBUILDINGS3D rooftops & street facades!

  function addBucketMeshes(buckets, mats) {
    buckets.forEach((wb, idx) => {
      if (wb.pos.length === 0) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(wb.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(wb.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(wb.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(wb.col, 3));
      const mesh = new THREE.Mesh(geo, mats[idx]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      worldGroup.add(mesh);
    });
  }
  addBucketMeshes(upperBuckets, upperMats);
  addBucketMeshes(groundBuckets, groundMats);

  if (mansardSlateBuf.pos.length > 0) {
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mansardSlateBuf.pos, 3));
    mGeo.setAttribute('normal', new THREE.Float32BufferAttribute(mansardSlateBuf.norm, 3));
    mGeo.setAttribute('uv', new THREE.Float32BufferAttribute(mansardSlateBuf.uv, 2));
    const mansardMat = new THREE.MeshStandardMaterial({
      map: photoBundle?.slateRoofDiff || null,
      normalMap: photoBundle?.slateRoofNor || null,
      normalScale: new THREE.Vector2(1.0, 1.0),
      roughnessMap: photoBundle?.slateRoofRough || null,
      color: 0x5c6673,
      roughness: 0.7,
      metalness: 0.28,
    });
    const mMesh = new THREE.Mesh(mGeo, mansardMat);
    mMesh.castShadow = true;
    mMesh.receiveShadow = true;
    worldGroup.add(mMesh);
  }

  // Authentic Geneva Old-Town warm terracotta-brown clay tile mansards!
  if (mansardClayBuf.pos.length > 0) {
    const mcGeo = new THREE.BufferGeometry();
    mcGeo.setAttribute('position', new THREE.Float32BufferAttribute(mansardClayBuf.pos, 3));
    mcGeo.setAttribute('normal', new THREE.Float32BufferAttribute(mansardClayBuf.norm, 3));
    mcGeo.setAttribute('uv', new THREE.Float32BufferAttribute(mansardClayBuf.uv, 2));
    const clayMat = new THREE.MeshStandardMaterial({
      map: photoBundle?.slateRoofDiff || null,
      normalMap: photoBundle?.slateRoofNor || null,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap: photoBundle?.slateRoofRough || null,
      color: 0x8f4e37,
      roughness: 0.82,
      metalness: 0.08,
    });
    const mcMesh = new THREE.Mesh(mcGeo, clayMat);
    mcMesh.castShadow = true;
    mcMesh.receiveShadow = true;
    worldGroup.add(mcMesh);
  }

  if (balconyBuf.pos.length > 0) {
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(balconyBuf.pos, 3));
    bGeo.setAttribute('normal', new THREE.Float32BufferAttribute(balconyBuf.norm, 3));
    const bMesh = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0xded4c0, roughness: 0.82 }));
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    worldGroup.add(bMesh);
  }

  if (balconyRailBuf.pos.length > 0) {
    const brGeo = new THREE.BufferGeometry();
    brGeo.setAttribute('position', new THREE.Float32BufferAttribute(balconyRailBuf.pos, 3));
    brGeo.setAttribute('normal', new THREE.Float32BufferAttribute(balconyRailBuf.norm, 3));
    const brMesh = new THREE.Mesh(
      brGeo,
      new THREE.MeshStandardMaterial({ color: 0x1b2024, roughness: 0.42, metalness: 0.78, side: THREE.DoubleSide })
    );
    brMesh.castShadow = true;
    worldGroup.add(brMesh);
  }

  if (dormerBuf.pos.length > 0) {
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute('position', new THREE.Float32BufferAttribute(dormerBuf.pos, 3));
    dGeo.setAttribute('normal', new THREE.Float32BufferAttribute(dormerBuf.norm, 3));
    const dMesh = new THREE.Mesh(dGeo, new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.55, metalness: 0.35 }));
    dMesh.castShadow = true;
    worldGroup.add(dMesh);
  }

  if (corniceBuf.pos.length > 0) {
    const cGeo = new THREE.BufferGeometry();
    cGeo.setAttribute('position', new THREE.Float32BufferAttribute(corniceBuf.pos, 3));
    cGeo.setAttribute('normal', new THREE.Float32BufferAttribute(corniceBuf.norm, 3));
    const cMesh = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({ color: 0xd8cfc0, roughness: 0.84 }));
    cMesh.castShadow = true;
    cMesh.receiveShadow = true;
    worldGroup.add(cMesh);
  }

  if (awningBuf.pos.length > 0) {
    const awGeo = new THREE.BufferGeometry();
    awGeo.setAttribute('position', new THREE.Float32BufferAttribute(awningBuf.pos, 3));
    awGeo.setAttribute('normal', new THREE.Float32BufferAttribute(awningBuf.norm, 3));
    awGeo.setAttribute('color', new THREE.Float32BufferAttribute(awningBuf.col, 3));
    const awMesh = new THREE.Mesh(
      awGeo,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
    );
    awMesh.castShadow = true;
    awMesh.receiveShadow = true;
    worldGroup.add(awMesh);
  }

  if (roofBuf.pos.length > 0) {
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(roofBuf.pos, 3));
    rGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roofBuf.norm, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roofBuf.uv, 2));
    const roofMesh = new THREE.Mesh(
      rGeo,
      new THREE.MeshStandardMaterial({ map: orthoTex, roughness: 0.78, metalness: 0.14, side: THREE.DoubleSide })
    );
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    worldGroup.add(roofMesh);
  }

  // Instanced 3D Geneva Stone Chimneys + Terracotta Pots on rooftops (crisp European skyline silhouette!)
  if (chimneyCoords.length > 0) {
    const chBaseGeo = new THREE.BoxGeometry(1.35, 2.2, 0.95);
    const chCapGeo = new THREE.BoxGeometry(1.55, 0.22, 1.15);
    const chStackMat = new THREE.MeshStandardMaterial({ color: 0xbeb4a4, roughness: 0.88 });
    const chCapMat = new THREE.MeshStandardMaterial({ color: 0x564d46, roughness: 0.75 });
    const chStacks = new THREE.InstancedMesh(chBaseGeo, chStackMat, chimneyCoords.length);
    const chCaps = new THREE.InstancedMesh(chCapGeo, chCapMat, chimneyCoords.length);
    chStacks.castShadow = true;
    const chDummy = new THREE.Object3D();
    chimneyCoords.forEach(([x, y, z], idx) => {
      chDummy.position.set(x, y + 1.0, z);
      chDummy.rotation.set(0, (idx % 4) * 0.4, 0);
      chDummy.scale.set(1, 0.85 + (idx % 3) * 0.2, 1);
      chDummy.updateMatrix();
      chStacks.setMatrixAt(idx, chDummy.matrix);
      chDummy.position.set(x, y + 2.1 * (0.85 + (idx % 3) * 0.2), z);
      chDummy.scale.set(1, 1, 1);
      chDummy.updateMatrix();
      chCaps.setMatrixAt(idx, chDummy.matrix);
    });
    worldGroup.add(chStacks, chCaps);
  }

  // 5. HERO 1:1 LANDMARKS AT EXACT GPS COORDINATES — TRUE ARCHED PONT DU MONT-BLANC!
  onProgress(74, "Constructing 1:1 Jet d'Eau, Pont du Mont-Blanc & Cathédrale Saint-Pierre…");
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcfc7b8, roughness: 0.84, metalness: 0.05 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1f242b, roughness: 0.38, metalness: 0.82 });

  const pmbX1 = PMB_START.x, pmbZ1 = PMB_START.z;
  const pmbX2 = PMB_END.x, pmbZ2 = PMB_END.z;
  const pmbDx = pmbX2 - pmbX1;
  const pmbDz = pmbZ2 - pmbZ1;
  const pmbLen = Math.hypot(pmbDx, pmbDz);
  const pmbAng = Math.atan2(pmbDx, pmbDz);
  const perpX = -pmbDz / pmbLen;
  const perpZ = pmbDx / pmbLen;

  // Dressed Swiss Ashlar Stone & Pale Ticino Granite Coping + Ornate Geneva Heritage-Green Iron Railings!
  const quayStoneMat = new THREE.MeshStandardMaterial({
    map: photoBundle?.ashlarImg ? new THREE.CanvasTexture(photoBundle.ashlarImg) : null,
    normalMap: photoBundle?.ashlarNor || null,
    color: 0xc4bdb0,
    roughness: 0.84,
  });
  if (quayStoneMat.map) {
    quayStoneMat.map.colorSpace = THREE.SRGBColorSpace;
    quayStoneMat.map.wrapS = quayStoneMat.map.wrapT = THREE.RepeatWrapping;
    quayStoneMat.map.repeat.set(4, 1);
  }
  const copingMat = new THREE.MeshStandardMaterial({
    map: photoBundle?.paverDiff || null,
    normalMap: photoBundle?.paverNor || null,
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: 0xdcd7ce,
    roughness: 0.74,
  });
  const ironRailingMat = new THREE.MeshStandardMaterial({ color: 0x1b3328, roughness: 0.38, metalness: 0.80 });
  const pmbLampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff5dc,
    emissive: 0xffc668,
    emissiveIntensity: 0.48,
    roughness: 0.14,
  });

  // 16-segment smoothly cambered Pont du Mont-Blanc arched deck + twin wide granite pedestrian promenades + stone spandrel fascia!
  const pmbSegs = 16;
  const pmbSubLen = pmbLen / pmbSegs;
  const pmbDeckGeo = new THREE.BoxGeometry(24.0, 1.35, pmbSubLen + 0.35);
  const pmbWalkGeo = new THREE.BoxGeometry(3.8, 0.24, pmbSubLen + 0.35);
  const pmbFasciaGeo = new THREE.BoxGeometry(0.68, 1.75, pmbSubLen + 0.35);
  const pmbTopRailGeo = new THREE.BoxGeometry(0.11, 0.10, pmbSubLen + 0.15);
  const pmbMidRailGeo = new THREE.BoxGeometry(0.06, 0.06, pmbSubLen + 0.15);
  const pmbCurbWallGeo = new THREE.BoxGeometry(0.46, 0.34, pmbSubLen + 0.25);

  const pmbDeckInst = new THREE.InstancedMesh(pmbDeckGeo, quayStoneMat, pmbSegs);
  const pmbWalkInst = new THREE.InstancedMesh(pmbWalkGeo, copingMat, pmbSegs * 2);
  const pmbFasciaInst = new THREE.InstancedMesh(pmbFasciaGeo, stoneMat, pmbSegs * 2);
  const pmbCurbWallInst = new THREE.InstancedMesh(pmbCurbWallGeo, copingMat, pmbSegs * 2);
  const pmbTopRailInst = new THREE.InstancedMesh(pmbTopRailGeo, ironRailingMat, pmbSegs * 2);
  const pmbMidRailInst = new THREE.InstancedMesh(pmbMidRailGeo, ironRailingMat, pmbSegs * 4);
  pmbDeckInst.receiveShadow = true;
  pmbWalkInst.receiveShadow = true;
  pmbFasciaInst.castShadow = true;
  pmbFasciaInst.receiveShadow = true;
  pmbCurbWallInst.castShadow = true;
  pmbCurbWallInst.receiveShadow = true;

  const pd = new THREE.Object3D();
  pd.rotation.order = 'YXZ';
  for (let s = 0; s < pmbSegs; s++) {
    const t0 = s / pmbSegs;
    const t1 = (s + 1) / pmbSegs;
    const tm = (t0 + t1) * 0.5;
    const y0 = getPontMontBlancDeckY(t0);
    const y1 = getPontMontBlancDeckY(t1);
    const ym = (y0 + y1) * 0.5;
    const pitch = -Math.atan2(y1 - y0, pmbSubLen);
    const mx = pmbX1 + pmbDx * tm;
    const mz = pmbZ1 + pmbDz * tm;

    // Structural stone deck slab sitting cleanly right below the smooth 4-lane asphalt & granite sidewalks
    pd.position.set(mx, ym - 0.52, mz);
    pd.rotation.set(pitch, pmbAng, 0);
    pd.scale.set(1, 1, 1);
    pd.updateMatrix();
    pmbDeckInst.setMatrixAt(s, pd.matrix);

    let sideIdx = 0;
    for (const side of [-1, 1]) {
      const i2 = s * 2 + sideIdx;
      // Wide 3.8m pale Ticino granite pedestrian walkway flanking the 16.4m 4-lane road on BOTH sides!
      pd.position.set(mx + perpX * side * 9.9, ym + 0.14, mz + perpZ * side * 9.9);
      pd.rotation.set(pitch, pmbAng, 0);
      pd.updateMatrix();
      pmbWalkInst.setMatrixAt(i2, pd.matrix);

      // Exterior dressed stone bridge fascia edge beam
      pd.position.set(mx + perpX * side * 11.75, ym - 0.45, mz + perpZ * side * 11.75);
      pd.updateMatrix();
      pmbFasciaInst.setMatrixAt(i2, pd.matrix);

      // Low carved granite balustrade plinth + open ornate Geneva green cast-iron railings (see Lac Léman through them!)
      const rx = mx + perpX * side * 11.65;
      const rz = mz + perpZ * side * 11.65;
      pd.position.set(rx, ym + 0.34, rz);
      pd.updateMatrix();
      pmbCurbWallInst.setMatrixAt(i2, pd.matrix);

      pd.position.set(rx, ym + 1.24, rz);
      pd.updateMatrix();
      pmbTopRailInst.setMatrixAt(i2, pd.matrix);

      pd.position.set(rx, ym + 0.92, rz);
      pd.updateMatrix();
      pmbMidRailInst.setMatrixAt(s * 4 + sideIdx * 2, pd.matrix);

      pd.position.set(rx, ym + 0.62, rz);
      pd.updateMatrix();
      pmbMidRailInst.setMatrixAt(s * 4 + sideIdx * 2 + 1, pd.matrix);

      sideIdx++;
    }
  }
  worldGroup.add(pmbDeckInst, pmbWalkInst, pmbFasciaInst, pmbCurbWallInst, pmbTopRailInst, pmbMidRailInst);

  // Vertical wrought-iron balusters along BOTH sides of Pont du Mont-Blanc (1 single InstancedMesh draw call!)
  {
    const balStep = 1.65;
    const balCountSide = Math.floor(pmbLen / balStep);
    const balGeo = new THREE.BoxGeometry(0.055, 0.82, 0.055);
    const balInst = new THREE.InstancedMesh(balGeo, ironRailingMat, balCountSide * 2);
    let bi = 0;
    for (let k = 0; k < balCountSide; k++) {
      const t = (k + 0.5) / balCountSide;
      const bx = pmbX1 + pmbDx * t;
      const bz = pmbZ1 + pmbDz * t;
      const by = getPontMontBlancDeckY(t);
      for (const side of [-1, 1]) {
        pd.position.set(bx + perpX * side * 11.65, by + 0.86, bz + perpZ * side * 11.65);
        pd.rotation.set(0, pmbAng, 0);
        pd.scale.set(1, 1, 1);
        pd.updateMatrix();
        balInst.setMatrixAt(bi++, pd.matrix);
      }
    }
    worldGroup.add(balInst);
  }

  // Solid OBB parapet colliders along BOTH sides of Pont du Mont-Blanc (prevents falling into lake!)
  for (const side of [-1, 1]) {
    const px = (pmbX1 + pmbX2) * 0.5 + perpX * side * 11.65;
    const pz = (pmbZ1 + pmbZ2) * 0.5 + perpZ * side * 11.65;
    insertCollider({ kind: 'obb', x: px, z: pz, yaw: pmbAng, halfW: 0.55, halfL: pmbLen * 0.5, maxY: 4.5, walkableTop: false });
  }

  // 7 Authentic Stone River Cutwater Piers + Carved Balustrade Plinths + Globe Lamps + Swiss/Geneva Flags!
  const swissFlagMat = new THREE.MeshStandardMaterial({ map: createFlagTexture('swiss'), side: THREE.DoubleSide, roughness: 0.65 });
  const genevaFlagMat = new THREE.MeshStandardMaterial({ map: createFlagTexture('geneva'), side: THREE.DoubleSide, roughness: 0.65 });
  const flags = [];
  // Static container for all Pont du Mont-Blanc stone piers, shoreline seawalls, railings & planters -> batched into ~12 draw calls!
  const shorelineStaticGroup = new THREE.Group();
  shorelineStaticGroup.name = 'Geneva_Shoreline_Static';
  worldGroup.add(shorelineStaticGroup);

  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const bx = pmbX1 + pmbDx * t;
    const bz = pmbZ1 + pmbDz * t;
    const by = getPontMontBlancDeckY(t);

    // 7 Real River Stone Cutwater Piers spanning Lac Léman beneath Pont du Mont-Blanc + 2 Solid Shore Masonry Abutments!
    if (i === 0 || i === 10) {
      // Solid dressed-stone shore bridge abutment tying the bridge deck seamlessly into Quai du Général-Guisan & Quai du Mont-Blanc seawalls!
      const abut = new THREE.Mesh(new THREE.BoxGeometry(27.5, 5.2, 7.5), quayStoneMat);
      abut.position.set(bx, by - 2.65, bz);
      abut.rotation.y = pmbAng;
      abut.receiveShadow = true;
      shorelineStaticGroup.add(abut);
    } else if (i >= 1 && i <= 9) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(25.6, 6.2, 3.0), quayStoneMat);
      pier.position.set(bx, by - 3.6, bz);
      pier.rotation.y = pmbAng;
      pier.castShadow = true;
      pier.receiveShadow = true;
      shorelineStaticGroup.add(pier);
      // Pointed granite cutwater noses facing upstream (Lake) and downstream (Rhône)
      for (const side of [-1, 1]) {
        const nose = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.85, 5.8, 6), quayStoneMat);
        nose.position.set(bx + perpX * side * 12.8, by - 3.65, bz + perpZ * side * 12.8);
        shorelineStaticGroup.add(nose);
      }
    }

    // Carved Granite Balustrade Piers + Classic Globe Lamps + Iconic Swiss/Geneva Flagpoles on BOTH outer edges!
    for (const side of [-1, 1]) {
      const fx = bx + perpX * side * 11.65;
      const fz = bz + perpZ * side * 11.65;

      const capPier = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.38, 0.82), copingMat);
      capPier.position.set(fx, by + 0.72, fz);
      capPier.rotation.y = pmbAng;
      capPier.castShadow = true;
      capPier.receiveShadow = true;
      shorelineStaticGroup.add(capPier);

      if (i > 0 && i < 10) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 7.6, 8), ironRailingMat);
        pole.position.set(fx, by + 4.9, fz);
        pole.castShadow = true;
        shorelineStaticGroup.add(pole);

        // Classic white opal bridge globe lamp beside flagpole on alternating piers
        if (i % 2 === 1) {
          const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), pmbLampGlowMat);
          globe.position.set(fx - perpX * side * 0.42, by + 3.85, fz - perpZ * side * 0.42);
          shorelineStaticGroup.add(globe);
        }

        const fMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(2.3, 1.65, 4, 1),
          i % 2 === 0 ? swissFlagMat : genevaFlagMat
        );
        fMesh.position.set(fx + 1.15, by + 7.65, fz);
        worldGroup.add(fMesh);
        flags.push({ mesh: fMesh, phase: i * 0.7 + side });
      }
    }
  }

  // 140m Volumetric Jet d'Eau at exact GPS (457.8, -147.0)
  const jetX = 457.8;
  const jetZ = -147.0;
  const jetBase = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 14, 3.2, 24), stoneMat);
  jetBase.position.set(jetX, 0.2, jetZ);
  worldGroup.add(jetBase);

  const mistTex = createMistTexture();
  const jetCount = 950;
  const jetPositions = new Float32Array(jetCount * 3);
  const jetSeeds = new Float32Array(jetCount);
  for (let i = 0; i < jetCount; i++) {
    jetSeeds[i] = Math.random();
    jetPositions[i * 3] = jetX;
    jetPositions[i * 3 + 1] = 2 + jetSeeds[i] * 140;
    jetPositions[i * 3 + 2] = jetZ;
  }
  const jetGeo = new THREE.BufferGeometry();
  jetGeo.setAttribute('position', new THREE.BufferAttribute(jetPositions, 3));
  const jetPoints = new THREE.Points(
    jetGeo,
    new THREE.PointsMaterial({
      map: mistTex,
      color: 0xffffff,
      size: 16.0,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
    })
  );
  vfxGroup.add(jetPoints);

  const jetCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 2.1, 134, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xf0f9ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
  );
  jetCore.position.set(jetX, 69, jetZ);
  vfxGroup.add(jetCore);

  const jetLight = new THREE.PointLight(0xd8f0ff, 0, 220, 1.2);
  jetLight.position.set(jetX, 42, jetZ);
  worldGroup.add(jetLight);

  // Volumetric Sunlit Mist Glow Cone piercing through the 140m Jet d'Eau spray (smooth Fresnel edge-fade: zero hard cone silhouette!)
  const jetGlowMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.FrontSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xfff5e0) },
      uOpacity: { value: 0.085 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        vUv = uv;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalV;
      varying vec3 vViewPos;
      void main() {
        float ndv = abs(dot(normalize(vNormalV), normalize(vViewPos)));
        float radial = pow(clamp(ndv, 0.0, 1.0), 2.8);
        float vertical = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.18, vUv.y);
        float alpha = radial * vertical * uOpacity;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const jetRay = new THREE.Mesh(new THREE.CylinderGeometry(7, 24, 142, 24, 1, true), jetGlowMat);
  jetRay.position.set(jetX + 4, 71, jetZ + 2);
  jetRay.rotation.z = -0.10;
  vfxGroup.add(jetRay);

  // Sunlit Mist Rainbow Arc shimmering inside the 140m Jet d'Eau spray plume!
  const rbMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0.24 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float t = vUv.y;
        vec3 c = mix(vec3(0.45, 0.25, 0.95), vec3(0.15, 0.72, 1.0), smoothstep(0.0, 0.3, t));
        c = mix(c, vec3(0.25, 0.95, 0.45), smoothstep(0.25, 0.55, t));
        c = mix(c, vec3(1.0, 0.88, 0.2), smoothstep(0.5, 0.78, t));
        c = mix(c, vec3(1.0, 0.28, 0.18), smoothstep(0.75, 1.0, t));
        float edge = sin(vUv.x * 3.14159) * sin(vUv.y * 3.14159);
        gl_FragColor = vec4(c, edge * uOpacity);
      }
    `,
  });
  const jetRainbow = new THREE.Mesh(new THREE.RingGeometry(24, 32, 32, 1, 0, Math.PI), rbMat);
  jetRainbow.position.set(jetX + 20, 26, jetZ + 12);
  jetRainbow.rotation.y = -0.6;
  vfxGroup.add(jetRainbow);

  // =================================================================================================
  // 5B. REAL GENÈVE-MOLARD & QUAI DU MONT-BLANC WATERFRONT (Stone Seawall, Gradins, Railings, Pier & Boats!)
  // Replaces slanted terrain mud ramps along Genève-Molard with crisp vertical carved stone quays & piers!
  // =================================================================================================
  const wetStoneMat = new THREE.MeshStandardMaterial({ color: 0x383d3e, roughness: 0.35, metalness: 0.15 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x6b4d32, roughness: 0.84 });
  const glassCanopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x9ec8e2,
    roughness: 0.08,
    metalness: 0.15,
    transparent: true,
    opacity: 0.52,
    clearcoat: 1.0,
  });
  const flowerBushMat = new THREE.MeshStandardMaterial({ color: 0x2f5e2c, roughness: 0.9 });
  const geraniumMat = new THREE.MeshStandardMaterial({ color: 0xd62839, roughness: 0.75 });

  // Helper: trace exact 1:1 south shoreline contour along Genève-Molard -> Jardin Anglais -> Quai Gustave-Ador!
  // Starts strictly SOUTH of Pont du Mont-Blanc & Île Rousseau so the Genève-Molard seawall & railings never snag on bridges!
  const molardShorePts = [];
  for (let sx = -236; sx <= 290; sx += 5.0) {
    if (sx > -44 && sx < -16) continue;
    let foundZ = null;
    const zPmb = 118.5 + ((sx - -30.5) / -145.0) * -226.0;
    const zStart = sx < -32 ? Math.max(42, zPmb + 20) : 10;
    for (let sz = zStart; sz <= 215; sz += 1.2) {
      if (isOnBridgeOrPier(sx, sz)) continue;
      if (!getRawWaterMask(sx, sz) && getRawWaterMask(sx, sz - 4.5)) {
        foundZ = sz;
        break;
      }
    }
    if (foundZ !== null) molardShorePts.push([sx, foundZ]);
  }

  for (let i = 0; i < molardShorePts.length - 1; i++) {
    const [x1, z1] = molardShorePts[i];
    const [x2, z2] = molardShorePts[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 1.2 || segLen > 32) continue;
    const mx = (x1 + x2) * 0.5;
    const mz = (z1 + z2) * 0.5;
    const ang = Math.atan2(dx, dz);
    const qy = getGroundHeight(mx, mz + 3.0);

    // 1. Vertical Dressed-Stone Geneva Quay Seawall extending deeply below lake surface (erases mud slopes!)
    const wallH = qy + 2.2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, wallH, segLen + 0.5), quayStoneMat);
    wall.position.set(mx, qy - wallH * 0.5 + 0.16, mz);
    wall.rotation.y = ang;
    wall.receiveShadow = true;
    shorelineStaticGroup.add(wall);

    // Darkened wet-stone splash waterline band right at y = 0..0.42m!
    const wetBand = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.55, segLen + 0.5), wetStoneMat);
    wetBand.position.set(mx, 0.16, mz);
    wetBand.rotation.y = ang;
    shorelineStaticGroup.add(wetBand);

    // Light Ticino granite coping capstone on top of seawall
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.24, segLen + 0.5), copingMat);
    cap.position.set(mx, qy + 0.22, mz);
    cap.rotation.y = ang;
    cap.receiveShadow = true;
    shorelineStaticGroup.add(cap);

    // Tiered stone steps ('gradins') along the Genève-Molard suspended promenade stretch (-220 .. -52)!
    if (mx > -225 && mx < -48) {
      const nOutX = dz / segLen; // points toward -Z water
      const nOutZ = -dx / segLen;
      for (let st = 0; st < 2; st++) {
        const stepM = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, segLen + 0.35), copingMat);
        stepM.position.set(mx + nOutX * (1.05 + st * 0.78), qy - 0.36 - st * 0.46, mz + nOutZ * (1.05 + st * 0.78));
        stepM.rotation.y = ang;
        stepM.receiveShadow = true;
        shorelineStaticGroup.add(stepM);
      }
    }

    // Leave clean 9m boarding openings ONLY at Débarcadère Genève-Molard (x ~ -118) & Jardin Anglais Mouette dock (x ~ 66)
    const isDockGap = Math.abs(mx - -118) < 6.5 || Math.abs(mx - 66) < 6.5;
    if (!isDockGap) {
      // Ornate Geneva dark wrought-iron lakeside railing ('garde-corps')
      const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, segLen + 0.2), ironRailingMat);
      topRail.position.set(mx, qy + 1.24, mz);
      topRail.rotation.y = ang;
      const midRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, segLen + 0.2), ironRailingMat);
      midRail.position.set(mx, qy + 0.72, mz);
      midRail.rotation.y = ang;
      shorelineStaticGroup.add(topRail, midRail);

      const postCount = Math.max(2, Math.round(segLen / 1.8));
      for (let p = 0; p < postCount; p++) {
        const frac = p / postCount;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.0, 0.06), ironRailingMat);
        post.position.set(x1 + dx * frac, qy + 0.76, z1 + dz * frac);
        shorelineStaticGroup.add(post);
      }

      // Overlapping solid OBB railing collider so player & cars CANNOT slip diagonally into the lake!
      insertCollider({ kind: 'obb', x: mx, z: mz, yaw: ang, halfW: 0.75, halfL: segLen * 0.62, maxY: qy + 1.5, walkableTop: false });

      // Register scenic Lac Léman wrought-iron lakeside railing lookout spots (lean forearms on rail overlooking lake & Jet d'Eau!)
      if (i % 2 === 0 && segLen > 4.0) {
        const nOutX = dz / segLen; // points toward Lac Léman (-Z)
        const nOutZ = -dx / segLen;
        const standX = mx - nOutX * 0.62;
        const standZ = mz - nOutZ * 0.62;
        const standY = getGroundHeight(standX, standZ) + 0.16;
        if (!isWater(standX, standZ)) {
          registerInteractable({
            id: `railing_${i}`,
            type: 'railing',
            label: 'LEAN ON LAKE RAILING',
            activeLabel: 'STEP BACK',
            subtitle: "Taking in Lac Léman & the Jet d'Eau from the quay… (E or WASD to step back)",
            x: standX,
            y: standY,
            z: standZ,
            yaw: Math.atan2(nOutX, nOutZ),
            exitDist: -0.58,
            persistent: true,
            radius: 2.35,
            priority: 0.4,
          });
        }
      }

      // Signature Geneva precast granite flower planter boxes with shrubs & red geraniums every ~21m!
      if (i % 3 === 1) {
        const planter = new THREE.Group();
        planter.position.set(mx, qy + 0.28, mz + 1.15);
        planter.rotation.y = ang;
        planter.add(
          new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.62, 2.2), copingMat).translateY(0.31),
          new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.36, 1.95), flowerBushMat).translateY(0.76),
          new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), geraniumMat).translateY(0.95).translateZ(-0.55),
          new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), geraniumMat).translateY(0.95).translateZ(0.0),
          new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), geraniumMat).translateY(0.95).translateZ(0.55)
        );
        shorelineStaticGroup.add(planter);
        insertCollider({ kind: 'obb', x: mx, z: mz + 1.15, yaw: ang, halfW: 0.55, halfL: 1.15, maxY: qy + 1.2, walkableTop: true });
      }
    }
  }

  // Also add vertical dressed-stone seawall along Quai du Mont-Blanc (Rive Droite shore)!
  const qmbShorePts = [];
  for (let sz = -460; sz <= -110; sz += 10.0) {
    let foundX = null;
    for (let sx = 240; sx >= -190; sx -= 2.0) {
      if (!getRawWaterMask(sx, sz) && getRawWaterMask(sx + 5.0, sz)) {
        foundX = sx;
        break;
      }
    }
    if (foundX !== null) qmbShorePts.push([foundX, sz]);
  }
  for (let i = 0; i < qmbShorePts.length - 1; i++) {
    const [x1, z1] = qmbShorePts[i];
    const [x2, z2] = qmbShorePts[i + 1];
    const dx = x2 - x1, dz = z2 - z1;
    const segLen = Math.hypot(dx, dz);
    if (segLen < 2 || segLen > 28) continue;
    const mx = (x1 + x2) * 0.5, mz = (z1 + z2) * 0.5;
    const ang = Math.atan2(dx, dz);
    const qy = getGroundHeight(mx - 3, mz);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1.5, qy + 2.2, segLen + 0.6), quayStoneMat);
    wall.position.set(mx, qy - (qy + 2.2) * 0.5 + 0.16, mz);
    wall.rotation.y = ang;
    shorelineStaticGroup.add(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.24, segLen + 0.6), copingMat);
    cap.position.set(mx, qy + 0.22, mz);
    cap.rotation.y = ang;
    shorelineStaticGroup.add(cap);
    insertCollider({ kind: 'obb', x: mx, z: mz, yaw: ang, halfW: 0.5, halfL: segLen * 0.52, maxY: qy + 1.3, walkableTop: false });
  }

  // Solid dressed-stone decks, stone side parapets & iron railings for ALL secondary Rhône bridges (Ponts de l'Île, etc.)
  // Batched into shorelineStaticGroup (0 extra draw calls!) so water flows visibly right underneath every bridge span!
  for (const r of realData.roads || []) {
    if (!r.br || !r.p || r.p.length < 2) continue;
    if (r.n && /Mont-Blanc/i.test(r.n)) continue;
    const deckW = (r.w || 7.5) + 4.0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 1.5) continue;
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      if (!isNearWaterMask(mx, mz, 22)) continue;
      const ang = Math.atan2(dx, dz);
      const px = -dz / segLen;
      const pz = dx / segLen;
      const deckY = 1.72;
      const deck = new THREE.Mesh(new THREE.BoxGeometry(deckW, 0.85, segLen + 0.6), quayStoneMat);
      deck.position.set(mx, deckY - 0.36, mz);
      deck.rotation.y = ang;
      deck.receiveShadow = true;
      shorelineStaticGroup.add(deck);
      for (const side of [-1, 1]) {
        const halfD = deckW * 0.48;
        const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, segLen + 0.4), copingMat);
        parapet.position.set(mx + px * side * halfD, deckY + 0.30, mz + pz * side * halfD);
        parapet.rotation.y = ang;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, segLen + 0.2), ironRailingMat);
        rail.position.set(mx + px * side * halfD, deckY + 1.12, mz + pz * side * halfD);
        rail.rotation.y = ang;
        shorelineStaticGroup.add(parapet, rail);
      }
    }
  }

  // Collapse ~650 shoreline seawall, bridge pier, railing & planter meshes into ~12 merged static draw calls!
  batchStaticGroup(shorelineStaticGroup, { label: 'GenevaShorelineBatch' });

  // AUTHENTIC DÉBARCADÈRE GENÈVE-MOLARD (Wooden Mouette Ferry Pier, Glass Shelter, Mooring Pilings & Boats!)
  // Start strictly south of Pont du Mont-Blanc so the pier attaches cleanly to the real Genève-Molard stone quay!
  let molardPierZ = 142;
  const zPmbPier = 118.5 + ((-118 - -30.5) / -145.0) * -226.0;
  for (let sz = Math.max(42, zPmbPier + 24); sz <= 200; sz += 1.5) {
    if (!getRawWaterMask(-118, sz) && getRawWaterMask(-118, sz - 4.5)) {
      molardPierZ = sz;
      break;
    }
  }
  const molardPierX = -118;
  const pierGroup = new THREE.Group();
  pierGroup.position.set(molardPierX, 0, molardPierZ);
  // Wooden landing pier extending 17m north into Lac Léman (-Z)
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.34, 17.0), timberMat);
  pierDeck.position.set(0, 0.95, -8.2);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  pierGroup.add(pierDeck);
  // Sloped timber gangway connecting stone quay down to floating landing pontoon
  const gangway = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 5.2), timberMat);
  gangway.position.set(0, 1.38, -1.6);
  gangway.rotation.x = 0.2;
  pierGroup.add(gangway);
  // Steel mooring pilings & cast-iron bollards along the pier
  for (const px of [-2.4, 2.4]) {
    for (const pz of [-3.5, -8.5, -13.5, -16.4]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 4.2, 10), darkMetal);
      piling.position.set(px, 0.6, pz);
      pierGroup.add(piling);
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.45, 10), darkMetal);
      bollard.position.set(px * 0.88, 1.32, pz);
      pierGroup.add(bollard);
    }
  }
  // Slender Swiss Glass-and-Steel Mouettes Waiting Canopy + Glowing 'M1 · GENÈVE-MOLARD' Transit Sign!
  for (const px of [-2.1, 2.1]) {
    for (const pz of [-5.8, -11.4]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.75, 8), darkMetal);
      col.position.set(px, 2.45, pz);
      pierGroup.add(col);
    }
  }
  const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.1, 6.4), glassCanopyMat);
  canopyRoof.position.set(0, 3.85, -8.6);
  pierGroup.add(canopyRoof);
  const signCan = document.createElement('canvas');
  signCan.width = 512;
  signCan.height = 96;
  const sctx = signCan.getContext('2d');
  sctx.fillStyle = '#121822';
  sctx.fillRect(0, 0, 512, 96);
  sctx.fillStyle = '#f5a623';
  sctx.fillRect(10, 12, 86, 72);
  sctx.fillStyle = '#101418';
  sctx.font = 'bold 46px "Helvetica Neue", sans-serif';
  sctx.textAlign = 'center';
  sctx.fillText('M1', 53, 64);
  sctx.fillStyle = '#ffffff';
  sctx.font = 'bold 34px "Helvetica Neue", sans-serif';
  sctx.textAlign = 'left';
  sctx.fillText('GENÈVE-MOLARD', 114, 62);
  const signTex = new THREE.CanvasTexture(signCan);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const pierSign = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.58, 0.14), new THREE.MeshBasicMaterial({ map: signTex }));
  pierSign.position.set(0, 3.5, -5.4);
  pierGroup.add(pierSign);
  batchStaticGroup(pierGroup, { label: 'MolardPierBatch' });
  worldGroup.add(pierGroup);

  // 4 Moored Swiss Yachts & Cruisers bobbing gently off Genève-Molard + Autonomous Live Mouette Ferry Shuttle!
  const mooredBoats = [];
  const boatCoords = [
    [molardPierX - 18, molardPierZ - 14, 0.35, 0xf8f9fa],
    [molardPierX - 34, molardPierZ - 19, 0.25, 0x1b365d],
    [molardPierX + 22, molardPierZ - 16, -0.2, 0xf4f6f8],
    [molardPierX + 42, molardPierZ - 24, -0.35, 0x8b1e28],
  ];
  for (let i = 0; i < boatCoords.length; i++) {
    const [bx, bz, byaw, col] = boatCoords[i];
    const bGroup = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.95, 7.6),
      new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.18, clearcoat: 0.95 })
    );
    hull.position.y = 0.42;
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.9, 3.4),
      new THREE.MeshPhysicalMaterial({ color: 0xf6f8fa, roughness: 0.22, clearcoat: 0.9 })
    );
    cabin.position.set(0, 1.25, -0.5);
    const wind = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.42, 0.8),
      new THREE.MeshPhysicalMaterial({ color: 0x112030, roughness: 0.05, metalness: 0.85 })
    );
    wind.position.set(0, 1.38, 1.15);
    bGroup.add(hull, cabin, wind);
    bGroup.position.set(bx, 0, bz);
    bGroup.rotation.y = byaw;
    worldGroup.add(bGroup);
    mooredBoats.push({ mesh: bGroup, baseYaw: byaw, phase: i * 1.6 });
  }

  // Live Autonomous Yellow/Orange Mouette Genevoise Water Taxi cruising between Genève-Molard and Pâquis!
  const aiMouette = new THREE.Group();
  const mYellow = new THREE.MeshPhysicalMaterial({ color: 0xffb81c, roughness: 0.2, clearcoat: 0.95 });
  const mCabin = new THREE.MeshPhysicalMaterial({ color: 0x102030, roughness: 0.06, metalness: 0.85, clearcoat: 1.0 });
  const mRoof = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.3 });
  aiMouette.add(
    new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 8.6), mYellow).translateY(0.45),
    new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.15, 5.2), mCabin).translateY(1.45),
    new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.16, 5.8), mRoof).translateY(2.1)
  );
  worldGroup.add(aiMouette);
  const mouetteRoute = { x1: molardPierX + 8, z1: molardPierZ - 26, x2: 190, z2: -290, t: 0.12, dir: 1 };

  const copperMat = new THREE.MeshStandardMaterial({ color: 0x458572, roughness: 0.36, metalness: 0.45 });

  // Le Phare de Genève (Bains des Pâquis) + solid collider
  const lhX = 571.1, lhZ = -463.1;
  worldGroup.add(
    new THREE.Mesh(new THREE.CylinderGeometry(11, 12.5, 3.2, 20), stoneMat).translateX(lhX).translateY(0.2).translateZ(lhZ),
    new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 18, 16), new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.45 })).translateX(lhX).translateY(10.8).translateZ(lhZ),
    new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.8, 12), new THREE.MeshBasicMaterial({ color: 0xffe4a0 })).translateX(lhX).translateY(20.4).translateZ(lhZ),
    new THREE.Mesh(new THREE.ConeGeometry(2.0, 2.8, 12), copperMat).translateX(lhX).translateY(22.6).translateZ(lhZ)
  );
  insertCollider({ kind: 'cyl', x: lhX, z: lhZ, r: 2.3, maxY: 24, walkableTop: false });

  // Hand-crafted signature Geneva corner landmarks (Place du Molard pavers & Tour du Molard clock,
  // Monument Brunswick, upgraded Horloge Fleurie & Fontaine des Quatre-Saisons, Pont des Bergues + Île Rousseau statue,
  // Place de Neuve Général Dufour, Mur des Réformateurs + Bastions giant chess, Cathédrale Saint-Pierre 6-column portico,
  // Fontaine du Bourg-de-Four & Bains des Pâquis diving tower!)
  const genevaLandmarks = buildGenevaLandmarks(worldGroup, vfxGroup, insertCollider, photoBundle);

  // Register interactive Geneva fountains & iconic monuments!
  registerInteractable({
    id: 'fountain_4saisons',
    type: 'fountain',
    label: 'DRINK AT FOUNTAIN',
    subtitle: 'Refreshing Geneva Alpine water from Fontaine des Quatre-Saisons!',
    toast: 'ALPINE WATER · REFRESHED',
    x: 105.0,
    y: getGroundHeight(105.0, 194.0) + 0.16,
    z: 194.0,
    rimRadius: 3.65,
    persistent: false,
    duration: 2.8,
    radius: 5.5,
    priority: 1.0,
  });
  registerInteractable({
    id: 'fountain_bourgdefour',
    type: 'fountain',
    label: 'DRINK AT FOUNTAIN',
    subtitle: 'Cool 18th-century fountain water at Place du Bourg-de-Four!',
    toast: 'VIEILLE-VILLE FOUNTAIN · REFRESHED',
    x: -77.1,
    y: getGroundHeight(-77.1, 632.4) + 0.16,
    z: 632.4,
    rimRadius: 2.35,
    persistent: false,
    duration: 2.8,
    radius: 4.4,
    priority: 1.0,
  });
  registerInteractable({
    id: 'landmark_horloge',
    type: 'sign_read',
    label: 'ADMIRE HORLOGE FLEURIE',
    subtitle: "L'Horloge Fleurie (1955) · 6,500 seasonal blooms & world's longest 2.5m second hand.",
    toast: 'HORLOGE FLEURIE · JARDIN ANGLAIS',
    x: 139.4,
    y: getGroundHeight(139.4, 208.0) + 0.16,
    z: 208.0,
    rimRadius: 4.5,
    persistent: false,
    duration: 2.4,
    radius: 6.4,
    priority: 0.7,
  });
  registerInteractable({
    id: 'landmark_brunswick',
    type: 'sign_read',
    label: 'ADMIRE MONUMENT BRUNSWICK',
    subtitle: 'Monument Brunswick (1879) · Neo-Gothic Venetian mausoleum of Duke Charles II.',
    toast: 'MONUMENT BRUNSWICK · SQUARE DES ALPES',
    x: -75.5,
    y: getGroundHeight(-75.5, -274.6) + 0.16,
    z: -274.6,
    rimRadius: 7.4,
    persistent: false,
    duration: 2.4,
    radius: 9.2,
    priority: 0.7,
  });
  registerInteractable({
    id: 'landmark_reformateurs',
    type: 'sign_read',
    label: 'ADMIRE MUR DES RÉFORMATEURS',
    subtitle: 'Mur des Réformateurs (1909) · Farel, Calvin, Bèze & Knox — "Post Tenebras Lux".',
    toast: 'PARC DES BASTIONS · GENÈVE',
    x: -322.0,
    y: getGroundHeight(-322.0, 560.0) + 0.16,
    z: 560.0,
    rimRadius: 5.2,
    persistent: false,
    duration: 2.4,
    radius: 7.5,
    priority: 0.7,
  });

  // Monument National in Jardin Anglais (Bronze Helvetia & Geneva Twin Statues on Carved Granite Plinth — ref_01 & ref_02!)
  {
    const mnX = 48.0, mnZ = 148.0;
    const mnY = getGroundHeight(mnX, mnZ);
    const monGroup = new THREE.Group();
    monGroup.position.set(mnX, mnY + 0.14, mnZ);
    monGroup.rotation.y = -0.52;
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x262925, roughness: 0.34, metalness: 0.84 });
    const plinthStone = new THREE.MeshStandardMaterial({ color: 0xc8c2b6, roughness: 0.82, metalness: 0.04 });
    // Circular red/grey cobble border & vibrant lakeside flower ring (matching ref_01 foreground!)
    const ringBed = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.7, 0.28, 24),
      new THREE.MeshStandardMaterial({ color: 0x3b6e35, roughness: 0.92 })
    );
    ringBed.position.y = 0.14;
    const stoneRim = new THREE.Mesh(new THREE.TorusGeometry(4.55, 0.22, 8, 28).rotateX(Math.PI / 2), plinthStone);
    stoneRim.position.y = 0.26;
    // Tiered carved granite monument pedestal
    const step1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 3.4), plinthStone);
    step1.position.y = 0.48;
    const step2 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.42, 2.5), plinthStone);
    step2.position.y = 0.90;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.95, 2.35, 1.95), plinthStone);
    shaft.position.y = 2.25;
    shaft.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.32, 2.28), plinthStone);
    cap.position.y = 3.55;
    // Dark commemorative bronze plaque on front face
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(1.38, 1.05, 0.08), bronzeMat);
    plaque.position.set(0, 2.32, 0.98);
    // Twin draped bronze classical statues (Helvetia & Geneva standing arm-in-arm with shield & sword!)
    for (const sx of [-0.46, 0.46]) {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.46, 1.45, 10), bronzeMat);
      skirt.position.set(sx, 4.44, 0);
      skirt.castShadow = true;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.72, 10), bronzeMat);
      torso.position.set(sx, 5.42, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), bronzeMat);
      head.position.set(sx, 5.98, 0);
      monGroup.add(skirt, torso, head);
    }
    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.92, 0.62), bronzeMat);
    shield.position.set(-0.92, 4.78, 0.14);
    monGroup.add(ringBed, stoneRim, step1, step2, shaft, cap, plaque, shield);
    batchStaticGroup(monGroup, { label: 'MonumentNationalBatch' });
    worldGroup.add(monGroup);
    insertCollider({ kind: 'cyl', x: mnX, z: mnZ, r: 2.6, maxY: mnY + 6.4, walkableTop: false });
  }

  // Jardin Anglais Helipad
  const hpY = getGroundHeight(112, 166);
  const helipadPad = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ map: createHelipadTexture(), roughness: 0.72 })
  );
  helipadPad.rotation.x = -Math.PI / 2;
  helipadPad.position.set(112, hpY + 0.15, 166);
  helipadPad.receiveShadow = true;
  worldGroup.add(helipadPad);

  const padBeaconMat = new THREE.MeshBasicMaterial({ color: 0xffb82e });
  const padBeaconGroup = new THREE.Group();
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    const bm = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), padBeaconMat);
    bm.position.set(112 + Math.cos(ang) * 9.5, hpY + 0.35, 166 + Math.sin(ang) * 9.5);
    padBeaconGroup.add(bm);
  }
  batchStaticGroup(padBeaconGroup, { label: 'HelipadBeaconsBatch' });
  worldGroup.add(padBeaconGroup);

  // 6. REALISTIC BOTANICAL ALPHA-CUTOUT FOLIAGE TREES (ALL 1,315 REAL OSM GENEVA TREES!)
  onProgress(86, `Planting ${realData.trees.length} botanical Geneva plane trees…`);
  const validTrees = (realData.trees || []).filter(
    ([tx, tz]) =>
      tx > minX + 10 &&
      tx < maxX - 10 &&
      tz > minZ + 10 &&
      tz < maxZ - 10 &&
      !isWater(tx, tz) &&
      Math.hypot(tx - 112, tz - 166) > 15 &&
      Math.hypot(tx - 139.4, tz - 208.0) > 9
  );

  const { trunkGeo, canopyGeo } = createRealisticTreeGeometries();
  // Authentic Geneva London Plane Tree ('Platane') photographic bark with soft organic mottled flaking!
  const planeBark = createPlaneTreeBarkTextures(photoBundle);
  const barkMat = new THREE.MeshStandardMaterial({
    map: planeBark.map,
    normalMap: planeBark.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughness: 0.92,
  });
  const leafTex = createPhotoLeafClusterTexture(photoBundle);
  const canopyMat = new THREE.MeshStandardMaterial({
    map: leafTex,
    alphaTest: 0.40,
    side: THREE.DoubleSide,
    roughness: 0.80,
    metalness: 0.02,
    emissive: new THREE.Color(0x0d1b0a),
    emissiveIntensity: 0.32, // subtle sunlit chlorophyll translucency (eliminates pitch-black tree undersides!)
    vertexColors: true,
  });

  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, validTrees.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, validTrees.length);
  trunks.castShadow = true;
  canopies.castShadow = true;
  canopies.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const treeTint = new THREE.Color();
  validTrees.forEach(([tx, tz], idx) => {
    const ty = getGroundHeight(tx, tz);
    const sc = 0.92 + ((idx * 29) % 10) * 0.075;
    dummy.position.set(tx, ty, tz);
    dummy.scale.set(sc, sc * (0.98 + (idx % 3) * 0.09), sc);
    dummy.rotation.set(0, idx * 1.37, 0);
    dummy.updateMatrix();
    trunks.setMatrixAt(idx, dummy.matrix);
    canopies.setMatrixAt(idx, dummy.matrix);

    // Mature Geneva Jardin Anglais London plane-tree foliage variation (deep natural sunlit olive-forest green matching ref_01!)
    const hShift = ((idx * 17) % 10) / 10;
    treeTint.setHSL(0.268 + hShift * 0.036, 0.26, 0.39 + (idx % 4) * 0.042);
    canopies.setColorAt(idx, treeTint);
    // Solid tree trunk collider so neither player nor cars can phase through ANY of the 1,315 trees!
    insertCollider({ kind: 'cyl', x: tx, z: tz, r: 0.44 * sc, maxY: ty + 4.5, walkableTop: false });
  });
  canopies.instanceColor.needsUpdate = true;
  worldGroup.add(trunks, canopies);

  // Flush Silver-Granite Bordered Cast-Iron Tree Pits ('Fosses d'arbres de Genève') ONLY for paved street/quay trees (not grass park trees!)
  const treeGrateCan = document.createElement('canvas');
  treeGrateCan.width = 128;
  treeGrateCan.height = 128;
  const tgCtx = treeGrateCan.getContext('2d');
  // Pale Ticino granite outer curb border framing the cast-iron tree grate!
  tgCtx.fillStyle = '#c9c4ba';
  tgCtx.fillRect(0, 0, 128, 128);
  tgCtx.fillStyle = '#565c62';
  tgCtx.fillRect(14, 14, 100, 100);
  tgCtx.strokeStyle = '#7c8288';
  tgCtx.lineWidth = 3;
  tgCtx.strokeRect(16, 16, 96, 96);
  // Subtle recessed European radial iron drainage grille
  tgCtx.strokeStyle = '#31363b';
  tgCtx.lineWidth = 3;
  for (let r = 20; r <= 44; r += 11) {
    tgCtx.beginPath();
    tgCtx.arc(64, 64, r, 0, Math.PI * 2);
    tgCtx.stroke();
  }
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    tgCtx.beginPath();
    tgCtx.moveTo(64 + Math.cos(ang) * 16, 64 + Math.sin(ang) * 16);
    tgCtx.lineTo(64 + Math.cos(ang) * 48, 64 + Math.sin(ang) * 48);
    tgCtx.stroke();
  }
  const treeGrateTex = new THREE.CanvasTexture(treeGrateCan);
  treeGrateTex.colorSpace = THREE.SRGBColorSpace;
  const treeGrateMat = new THREE.MeshStandardMaterial({
    map: treeGrateTex,
    roughness: 0.72,
    metalness: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  // Exclude Jardin Anglais & Parc des Bastions interior lawn trees so only paved sidewalk/promenade trees get granite tree pits!
  const centralTreeGrates = validTrees.filter(([tx, tz]) => {
    if (Math.hypot(tx - 20, tz - 170) > 340) return false;
    const inJardinLawn = tx > 24 && tx < 225 && tz > 120 && tz < 230 && tz < 190 + tx * 0.24;
    if (inJardinLawn) return false;
    return true;
  });
  if (centralTreeGrates.length > 0) {
    const tgGeo = new THREE.PlaneGeometry(1.65, 1.65).rotateX(-Math.PI / 2);
    const tgMesh = new THREE.InstancedMesh(tgGeo, treeGrateMat, centralTreeGrates.length);
    tgMesh.receiveShadow = true;
    centralTreeGrates.forEach(([tx, tz], idx) => {
      dummy.position.set(tx, getGroundHeight(tx, tz) + 0.264, tz);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0.45, 0);
      dummy.updateMatrix();
      tgMesh.setMatrixAt(idx, dummy.matrix);
    });
    worldGroup.add(tgMesh);
  }

  // Universal road-carriageway exclusion helper for lamps, trees & benches (guarantees ZERO invisible/stray props on asphalt!)
  const vehRoadSegsBg = [];
  for (const r of realData.roads || []) {
    if (!r.p || r.p.length < 2 || r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'service') continue;
    const hw = (r.w || 8.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      vehRoadSegsBg.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw]);
    }
  }
  function isInsideRoadBg(x, z, pad = 0.25) {
    for (let k = 0; k < vehRoadSegsBg.length; k++) {
      const [x1, z1, x2, z2, hw] = vehRoadSegsBg[k];
      const m = hw + pad;
      if (x < Math.min(x1, x2) - m || x > Math.max(x1, x2) + m) continue;
      if (z < Math.min(z1, z2) - m || z > Math.max(z1, z2) + m) continue;
      const vx = x2 - x1, vz = z2 - z1;
      const l2 = vx * vx + vz * vz;
      if (l2 < 0.1) continue;
      const t = Math.max(0, Math.min(1, ((x - x1) * vx + (z - z1) * vz) / l2));
      if (Math.hypot(x - (x1 + t * vx), z - (z1 + t * vz)) < m) return true;
    }
    return false;
  }

  // 7. ORNATE CLASSIC GENEVA HERITAGE-GREEN LAKESIDE LAMPPOSTS (Fluted Pedestal + Dual Lantern Brackets + Banners!)
  const rawLampCoords = [];
  for (let i = 1; i < 16; i++) {
    const t = i / 15;
    const lx = -15 + t * 305;
    const lz = 132 + t * 145;
    if (Math.hypot(lx - -10, lz - 148) < 18) continue;
    rawLampCoords.push([lx, lz]);
  }
  // Right-side Quai du Général-Guisan ornate heritage streetlamps lining the sandstone boutique sidewalk!
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lx = -18 + t * 230;
    const lz = 159 + t * 116;
    if (Math.hypot(lx - -10, lz - 148) < 11) continue;
    rawLampCoords.push([lx, lz]);
  }
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    rawLampCoords.push([-160 + t * 280, -115 - t * 340]);
  }
  // Merge real OSM Overpass GPS Geneva streetlamps (deduplicated within 14m, kept strictly dry & clear of spawn/roads!)
  if (streetFeatures?.streetLamps?.length) {
    for (const [lx, lz] of streetFeatures.streetLamps) {
      if (isWater(lx, lz) || Math.hypot(lx - -10, lz - 148) < 12) continue;
      if (rawLampCoords.some(([ox, oz]) => Math.hypot(ox - lx, oz - lz) < 14)) continue;
      rawLampCoords.push([lx, lz]);
    }
  }
  const lampCoords = rawLampCoords.filter(([lx, lz]) => !isInsideRoadBg(lx, lz, 0.35) && !isWater(lx, lz));
  const genevaGreenIron = new THREE.MeshStandardMaterial({ color: 0x1c3428, roughness: 0.42, metalness: 0.78 });
  // Build merged ornate fluted Geneva lamppost geometry (pedestal base + tapered fluted shaft + scrolled crossarm + finial!)
  const lpParts = [];
  const lpBase = new THREE.CylinderGeometry(0.18, 0.26, 0.85, 8);
  lpBase.translate(0, 0.425, 0);
  const lpRing = new THREE.CylinderGeometry(0.21, 0.21, 0.14, 10);
  lpRing.translate(0, 0.88, 0);
  const lpShaft = new THREE.CylinderGeometry(0.068, 0.135, 4.95, 8);
  lpShaft.translate(0, 3.38, 0);
  const lpCap = new THREE.CylinderGeometry(0.15, 0.08, 0.22, 8);
  lpCap.translate(0, 5.82, 0);
  const lpArm = new THREE.BoxGeometry(0.95, 0.075, 0.075);
  lpArm.translate(0, 5.45, 0);
  const lpFinial = new THREE.ConeGeometry(0.08, 0.42, 6);
  lpFinial.translate(0, 6.38, 0);
  lpParts.push(lpBase, lpRing, lpShaft, lpCap, lpArm, lpFinial);
  const lampPostGeo = mergeGeometries(lpParts, false);
  lpParts.forEach((g) => g.dispose());

  const lampHoodGeo = new THREE.ConeGeometry(0.44, 0.36, 8);
  const lampBulbGeo = new THREE.CylinderGeometry(0.21, 0.15, 0.44, 6); // classic hexagonal Geneva glass lantern!
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2d2,
    emissive: 0xffb84d,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.08,
  });
  const lampPosts = new THREE.InstancedMesh(lampPostGeo, genevaGreenIron, lampCoords.length);
  const lampHoods = new THREE.InstancedMesh(lampHoodGeo, genevaGreenIron, lampCoords.length);
  const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, lampBulbMat, lampCoords.length);
  lampPosts.castShadow = true;

  // Vertical Geneva streetlamp festival banner texture!
  const bCan = document.createElement('canvas');
  bCan.width = 128;
  bCan.height = 256;
  const bCtx = bCan.getContext('2d');
  bCtx.fillStyle = '#9c1c26';
  bCtx.fillRect(0, 0, 128, 256);
  bCtx.strokeStyle = '#e8c46b';
  bCtx.lineWidth = 6;
  bCtx.strokeRect(8, 8, 112, 240);
  bCtx.fillStyle = '#ffffff';
  bCtx.fillRect(52, 42, 24, 72);
  bCtx.fillRect(28, 66, 72, 24);
  bCtx.fillStyle = '#f7e5b8';
  bCtx.font = 'bold 20px "Helvetica Neue", sans-serif';
  bCtx.textAlign = 'center';
  bCtx.fillText('GENÈVE', 64, 174);
  bCtx.font = '600 13px "Helvetica Neue", sans-serif';
  bCtx.fillText('LA RADE', 64, 202);
  const bannerTex = new THREE.CanvasTexture(bCan);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.72 });
  // Thin 3D box banner so GENÈVE reads forwards (never mirrored!) on BOTH front and back!
  const bannerGeo = new THREE.BoxGeometry(0.72, 1.55, 0.04);
  const banners = new THREE.InstancedMesh(
    bannerGeo,
    [darkMetal, darkMetal, darkMetal, darkMetal, bannerMat, bannerMat],
    lampCoords.length
  );

  lampCoords.forEach(([lx, lz], i) => {
    const ly = getGroundHeight(lx, lz);
    dummy.position.set(lx, ly, lz);
    dummy.scale.set(1, 1, 1);
    dummy.rotation.set(0, 0.48, 0);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, ly + 6.08, lz);
    dummy.updateMatrix();
    lampHoods.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx, ly + 5.74, lz);
    dummy.updateMatrix();
    lampBulbs.setMatrixAt(i, dummy.matrix);

    dummy.position.set(lx + 0.44, ly + 4.2, lz);
    dummy.rotation.set(0, 0.42, 0);
    dummy.updateMatrix();
    banners.setMatrixAt(i, dummy.matrix);
    // Solid cast-iron lamp post collider!
    insertCollider({ kind: 'cyl', x: lx, z: lz, r: 0.24, maxY: ly + 6.0, walkableTop: false });
  });
  worldGroup.add(lampPosts, lampHoods, lampBulbs, banners);

  // Instanced Authentic Swiss Yellow Pedestrian Crosswalks strictly clamped INSIDE road carriageways (ZERO stripes clipping sidewalks or doorways!)
  const cwMat = new THREE.MeshStandardMaterial({
    color: 0xf4c41c,
    roughness: 0.78,
    polygonOffset: true,
    polygonOffsetFactor: -5,
    polygonOffsetUnits: -5,
  });
  const crosswalkSpots = [
    [-20, 146, -0.52, 11.5],
    [22, 165, -0.52, 11.5],
    [-162, -98, -0.55, 11.5],
    [-75, 224, 0.25, 10.0],
  ];
  if (streetFeatures?.crossings?.length) {
    const roadSegList = [];
    for (const r of realData.roads || []) {
      if (!r.p || r.p.length < 2 || r.k === 'pedestrian' || r.k === 'service' || r.k === 'footway' || r.k === 'living_street') continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        roadSegList.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], r.w || 8.0]);
      }
    }
    for (const [cx, cz] of streetFeatures.crossings) {
      if (crosswalkSpots.length >= 44) break;
      if (Math.hypot(cx - 10, cz - 170) > 360 || isWater(cx, cz)) continue;
      if (crosswalkSpots.some(([ox, oz]) => Math.hypot(ox - cx, oz - cz) < 18)) continue;
      // Snap crosswalk center & perpendicular rotation cleanly onto the exact centerline of its host road!
      let bestD = 7.5;
      let bestRot = -0.52;
      let bestW = 8.0;
      let snapX = cx, snapZ = cz;
      for (let k = 0; k < roadSegList.length; k++) {
        const [x1, z1, x2, z2, rw] = roadSegList[k];
        const vx = x2 - x1, vz = z2 - z1;
        const l2 = vx * vx + vz * vz;
        if (l2 < 1) continue;
        const t = Math.max(0.08, Math.min(0.92, ((cx - x1) * vx + (cz - z1) * vz) / l2));
        const px = x1 + t * vx, pz = z1 + t * vz;
        const d = Math.hypot(cx - px, cz - pz);
        if (d < bestD) {
          bestD = d;
          bestRot = Math.atan2(vx, vz) + Math.PI * 0.5;
          bestW = rw;
          snapX = px;
          snapZ = pz;
        }
      }
      if (bestD < 6.5) crosswalkSpots.push([snapX, snapZ, bestRot, bestW]);
    }
  }
  const cwStripes = [];
  for (const [cxw, czw, rot, rw] of crosswalkSpots) {
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const halfSpan = Math.max(1.8, (rw || 8.0) * 0.5 - 0.75);
    const halfCount = Math.min(4, Math.max(1, Math.floor(halfSpan / 1.05)));
    for (let s = -halfCount; s <= halfCount; s++) {
      const off = s * 1.05;
      const sx = cxw + cosR * off;
      const sz = czw - sinR * off;
      // Guarantee every individual yellow stripe stays strictly inside asphalt (NEVER clipping sidewalks/doorways!)
      if (!isInsideRoadBg(sx, sz, -0.35)) continue;
      cwStripes.push([sx, getGroundHeight(sx, sz) + 0.222, sz, rot]);
    }
  }
  if (cwStripes.length > 0) {
    const cwGeo = new THREE.PlaneGeometry(0.52, 2.95).rotateX(-Math.PI / 2);
    const cwInst = new THREE.InstancedMesh(cwGeo, cwMat, cwStripes.length);
    const cwDummy = new THREE.Object3D();
    cwStripes.forEach(([sx, sy, sz, rot], idx) => {
      cwDummy.position.set(sx, sy, sz);
      cwDummy.rotation.set(0, rot, 0);
      cwDummy.updateMatrix();
      cwInst.setMatrixAt(idx, cwDummy.matrix);
    });
    worldGroup.add(cwInst);
  }

  // 7B. CYCLING SWISS TRAFFIC LIGHTS (strictly placed on dry sidewalks — BATCHED into 4 draw calls!)
  const trafficLightGroup = new THREE.Group();
  const tlSpots = [
    [-14.0, 122.0, -2.55], // Rive Gauche Pont du Mont-Blanc sidewalk corner (clear of asphalt!)
    [14.0, 186.0, -0.95],  // Quai du Général-Guisan boutique sidewalk
    [-154.0, -118.0, 2.55],// Quai du Mont-Blanc north bridge approach sidewalk
    [-85.0, 222.0, 0.2],   // Rue du Rhône intersection sidewalk
  ];
  const tlGreenMat = new THREE.MeshStandardMaterial({ color: 0x22ff66, emissive: 0x11ff55, emissiveIntensity: 3.0 });
  const tlAmberMat = new THREE.MeshStandardMaterial({ color: 0xffb82e, emissive: 0xffa800, emissiveIntensity: 0.2 });
  const tlRedMat = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff1111, emissiveIntensity: 0.2 });
  for (const [tx, tz, rot] of tlSpots) {
    const ty = getGroundHeight(tx, tz);
    const tl = new THREE.Group();
    tl.position.set(tx, ty, tz);
    tl.rotation.y = rot;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 8), darkMetal);
    post.position.y = 2.6;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.6), darkMetal);
    arm.position.set(0, 5.1, 1.2);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.05, 0.32), darkMetal);
    box.position.set(0, 4.75, 2.3);
    const rBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), tlRedMat);
    rBulb.position.set(0, 5.05, 2.46);
    const aBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), tlAmberMat);
    aBulb.position.set(0, 4.75, 2.46);
    const gBulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), tlGreenMat);
    gBulb.position.set(0, 4.45, 2.46);
    tl.add(post, arm, box, rBulb, aBulb, gBulb);
    trafficLightGroup.add(tl);
    insertCollider({ kind: 'cyl', x: tx, z: tz, r: 0.24, maxY: ty + 5.4, walkableTop: false });
  }
  batchStaticGroup(trafficLightGroup, { label: 'TrafficLightsBatch' });
  worldGroup.add(trafficLightGroup);

  // Instanced Authentic Geneva Heritage-Green Park Benches driven by 118 real OSM Overpass GPS benches (2 draw calls total!)
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x244a34, roughness: 0.68, metalness: 0.08 }); // classic Geneva painted wood slats!
  const bwParts = [];
  const bSeat = new THREE.BoxGeometry(2.1, 0.10, 0.52); bSeat.translate(0, 0.48, 0);
  const bBack = new THREE.BoxGeometry(2.1, 0.42, 0.09); bBack.translate(0, 0.78, -0.24);
  bwParts.push(bSeat, bBack);
  const bwGeo = mergeGeometries(bwParts, false); bwParts.forEach((g) => g.dispose());
  const bmParts = [];
  const bLegL = new THREE.BoxGeometry(0.10, 0.56, 0.52); bLegL.translate(-0.88, 0.28, 0);
  const bLegR = new THREE.BoxGeometry(0.10, 0.56, 0.52); bLegR.translate(0.88, 0.28, 0);
  bmParts.push(bLegL, bLegR);
  const bmGeo = mergeGeometries(bmParts, false); bmParts.forEach((g) => g.dispose());

  const benchSpots = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    benchSpots.push([20 + t * 175, 146 + t * 68, -0.35]);
  }
  if (streetFeatures?.benches?.length) {
    for (const b of streetFeatures.benches) {
      const [bx, bz, dir] = b;
      if (isWater(bx, bz) || isInsideRoadBg(bx, bz, 0.55) || Math.hypot(bx - -10, bz - 148) < 10) continue;
      if (Math.hypot(bx - 112, bz - 166) < 15) continue; // keep helipad clear
      if (benchSpots.some(([ox, oz]) => Math.hypot(ox - bx, oz - bz) < 3.2)) continue;
      const yaw = Number.isFinite(dir) ? (dir * Math.PI) / 180 : -0.35;
      benchSpots.push([bx, bz, yaw]);
    }
  }
  const benchWoodInst = new THREE.InstancedMesh(bwGeo, benchWood, benchSpots.length);
  const benchLegInst = new THREE.InstancedMesh(bmGeo, darkMetal, benchSpots.length);
  benchWoodInst.castShadow = true;
  benchWoodInst.receiveShadow = true;
  const bnDummy = new THREE.Object3D();
  benchSpots.forEach(([bx, bz, byaw], i) => {
    const by = getGroundHeight(bx, bz);
    bnDummy.position.set(bx, by + 0.16, bz);
    bnDummy.rotation.set(0, byaw, 0);
    bnDummy.updateMatrix();
    benchWoodInst.setMatrixAt(i, bnDummy.matrix);
    benchLegInst.setMatrixAt(i, bnDummy.matrix);
    insertCollider({ kind: 'obb', x: bx, z: bz, yaw: byaw, halfW: 1.08, halfL: 0.35, maxY: by + 1.05, walkableTop: true });
    registerInteractable({
      id: `bench_${i}`,
      type: 'bench',
      label: 'SIT ON BENCH',
      activeLabel: 'STAND UP',
      subtitle: 'Relaxing on a Geneva park bench… (Orbit mouse to look around · E or WASD to stand)',
      x: bx,
      y: by + 0.16,
      z: bz,
      yaw: byaw,
      benchWidth: 1.15,
      seatLocalZ: 0.08,
      exitDist: 0.88,
      persistent: true,
      radius: 2.75,
      priority: 1.2,
    });
  });
  worldGroup.add(benchWoodInst, benchLegInst);

  // 7C. LIVING GENEVA STREETSCAPE: Real GPS Bins, 12 TPG Bus Shelters & Totems, Bike Racks, Cobble Tram Tracks, Span Lamps, Hydrants & Curbs!
  const streetPropsGroup = buildGenevaStreetProps(worldGroup, realData, insertCollider, photoBundle, streetFeatures, registerInteractable);

  // 7C-2. LES BAINS DES PÂQUIS — Vibrant Summer Lakeside Beach Club, Sunbathers, Swimmers, Buvette Terrace & 10m Diving Tower!
  const bainsDesPaquis = buildBainsDesPaquis(worldGroup, insertCollider, registerInteractable);

  // 7C-3. CGN BELLE ÉPOQUE PADDLE STEAMER ("LA SUISSE") CRUISING LAC LÉMAN!
  const cgnSteamer = createCgnPaddleSteamer(worldGroup);

  // 7C-4. WINTER GENEVA GOLDEN CHRISTMAS GARLAND LIGHTS along Rue du Rhône & Quai du Général-Guisan (visible in Winter mode!)
  const christmasGroup = new THREE.Group();
  christmasGroup.name = 'Geneva_Winter_Christmas_Lights';
  christmasGroup.visible = false;
  worldGroup.add(christmasGroup);
  {
    const xmasBulbMat = new THREE.MeshBasicMaterial({ color: 0xffe296 });
    const xmasSpans = [];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      // Overhead festive spans across Rue du Rhône luxury corridor
      const rx = -175 + t * 285;
      const rz = 235 + t * 65;
      xmasSpans.push([[rx - 2, rz - 7.5], [rx + 2, rz + 7.5]]);
      // Quai du Général-Guisan promenade garlands
      const qx = -40 + t * 195;
      const qz = 152 + t * 92;
      xmasSpans.push([[qx - 3, qz - 6.5], [qx + 3, qz + 6.5]]);
    }
    const xmasCableMat = new THREE.MeshBasicMaterial({ color: 0x1e2228 });
    const pts = [];
    for (const [[x1, z1], [x2, z2]] of xmasSpans) {
      const baseY = getGroundHeight((x1 + x2) * 0.5, (z1 + z2) * 0.5) + 8.8;
      let prevV = new THREE.Vector3(x1, baseY, z1);
      for (let k = 1; k <= 10; k++) {
        const u = k / 10;
        const sag = Math.sin(u * Math.PI) * 1.15;
        const curV = new THREE.Vector3(x1 + (x2 - x1) * u, baseY - sag, z1 + (z2 - z1) * u);
        const seg = new THREE.Vector3().subVectors(curV, prevV);
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, seg.length(), 4), xmasCableMat);
        wire.position.copy(prevV).add(curV).multiplyScalar(0.5);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), seg.normalize());
        christmasGroup.add(wire);
        if (k < 10) pts.push([curV.x, curV.y - 0.12, curV.z]);
        prevV = curV;
      }
    }
    const xmasInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 6, 5), xmasBulbMat, pts.length);
    const xd = new THREE.Object3D();
    pts.forEach(([px, py, pz], idx) => {
      xd.position.set(px, py, pz);
      xd.updateMatrix();
      xmasInst.setMatrixAt(idx, xd.matrix);
    });
    christmasGroup.add(xmasInst);
  }

  // 7D. 1:1 REAL GENEVA PEDESTRIAN WALKING ZONES (101 Plazas, 1,715 Footways, 185 Stone Stairs, 102 Park Lawns, Rues-Basses Globe Lamps & SIG Fountains!)
  const pedZones = buildGenevaPedestrianZones(
    worldGroup,
    realData,
    pedZonesData,
    streetFeatures,
    photoBundle,
    insertCollider,
    registerInteractable
  );

  // 8. TRUE 3D SCULPTED MULTI-BIOME ALPINE MOUNTAIN MASSIF (Mont Salève, Pre-Alps, Mont-Blanc & Jura!)
  // Real 3D sloping ridges + undistorted world-space rock strata + slope-aware glacier snow + Rayleigh sky haze!
  const alpineUniforms = {
    uHorizonCol: { value: new THREE.Color(0x9ec8ea) },
    uAlpineRock: { value: photoBundle?.alpineRockDiff || null },
    uNightFactor: { value: 0.0 },
  };
  {
    const hash2 = (ix, iz) => {
      const n = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    };
    const vnoise = (x, z) => {
      const ix = Math.floor(x), iz = Math.floor(z);
      const fx = x - ix, fz = z - iz;
      const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
      const a = hash2(ix, iz), b = hash2(ix + 1, iz);
      const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
      return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
    };
    const ridgedFbm = (x, z) => {
      let sum = 0, amp = 0.54, freq = 1.0, weight = 1.0;
      for (let o = 0; o < 5; o++) {
        let n = 1.0 - Math.abs(vnoise(x * freq, z * freq) * 2.0 - 1.0);
        n = n * n * weight;
        weight = Math.min(1.0, Math.max(0.25, n * 1.65));
        sum += n * amp;
        freq *= 2.08;
        amp *= 0.48;
      }
      return sum;
    };

    const segA = 360;
    const segR = 36;
    const rMin = 1280;
    const rMax = 3550;
    const verts = [];
    const uvs = [];
    const indices = [];

    for (let ir = 0; ir <= segR; ir++) {
      const tr = ir / segR;
      const r = rMin + Math.pow(tr, 1.15) * (rMax - rMin);
      const env = Math.sin(Math.pow(tr, 0.8) * Math.PI * 0.94);

      for (let ia = 0; ia <= segA; ia++) {
        const ang = (ia / segA) * Math.PI * 2;
        const wx = Math.cos(ang) * r;
        const wz = Math.sin(ang) * r;

        const alpsBoost = 0.5 + 0.5 * Math.cos(ang - 0.65);
        const lakeOpen = Math.exp(-Math.pow(Math.atan2(Math.sin(ang + 0.48), Math.cos(ang + 0.48)) / 0.42, 2));
        // Authentic Mont Salève & distant Savoy Pre-Alps elevation profile from Quai du Général-Guisan!
        const maxPeakH = (128 + alpsBoost * 215) * (1.0 - lakeOpen * 0.62);

        // Multi-scale jagged Alpine peaks, rocky ridges & glacial spurs (no smooth Mount-Fuji cones!)
        const macroRidge = Math.pow(ridgedFbm(wx * 0.00135 + 4.3, wz * 0.00135 - 2.7), 1.15);
        const crags = ridgedFbm(wx * 0.0032 - 1.9, wz * 0.0032 + 5.1) * 0.34;
        const fineSpurs = vnoise(wx * 0.0068, wz * 0.0068) * 0.12;
        let y = -10 + env * (macroRidge * 0.72 + crags + fineSpurs) * maxPeakH;
        if (ir === 0) y = -12;

        verts.push(wx, y, wz);
        uvs.push((ia / segA) * 64, tr * 10);
      }
    }

    const row = segA + 1;
    for (let ir = 0; ir < segR; ir++) {
      for (let ia = 0; ia < segA; ia++) {
        const a = ir * row + ia;
        const b = a + 1;
        const c = (ir + 1) * row + ia;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }

    const ridgeGeo = new THREE.BufferGeometry();
    ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    ridgeGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    ridgeGeo.setIndex(indices);
    ridgeGeo.computeVertexNormals();

    const ridgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
      metalness: 0.0,
    });
    ridgeMat.onBeforeCompile = (shader) => {
      shader.uniforms.uHorizonCol = alpineUniforms.uHorizonCol;
      shader.uniforms.uAlpineRock = alpineUniforms.uAlpineRock;
      shader.uniforms.uNightFactor = alpineUniforms.uNightFactor;
      shader.vertexShader =
        `varying vec3 vAlpinePos;\nvarying vec3 vAlpineNorm;\n` +
        shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vAlpinePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vAlpineNorm = normalize(mat3(modelMatrix) * objectNormal);`
        );
      shader.fragmentShader =
        `uniform vec3 uHorizonCol;\nuniform sampler2D uAlpineRock;\nuniform float uNightFactor;\nvarying vec3 vAlpinePos;\nvarying vec3 vAlpineNorm;\n
        float aHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float aNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(aHash(i), aHash(i + vec2(1.0, 0.0)), f.x), mix(aHash(i + vec2(0.0, 1.0)), aHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ` +
        shader.fragmentShader
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            // Undistorted world-space triplanar Alpine rock strata + crisp fractured granite crags!
            vec3 rockTop = texture2D(uAlpineRock, vAlpinePos.xz * 0.0068).rgb;
            vec3 rockSide = texture2D(uAlpineRock, vec2((vAlpinePos.x + vAlpinePos.z) * 0.0085, vAlpinePos.y * 0.018)).rgb;
            vec3 rockMacro = texture2D(uAlpineRock, vAlpinePos.xz * 0.0018).rgb;
            float slope = clamp(vAlpineNorm.y, 0.0, 1.0);
            float nMacro = aNoise(vAlpinePos.xz * 0.0052);
            float nMid = aNoise(vAlpinePos.xz * 0.018 + vec2(nMacro * 1.4, -nMacro * 1.1));
            float nFine = aNoise(vAlpinePos.xz * 0.058 + vec2(vAlpinePos.y * 0.024, nMid * 1.6));
            float nMicro = aNoise(vAlpinePos.xz * 0.14 + vec2(vAlpinePos.y * 0.055, 0.0));
            // Sharp ridged granite couloir & rock-rib detail (eliminates smooth airbrushed white cones!)
            float ridgeCrease = 1.0 - abs(nMid * 2.0 - 1.0);
            float fineCrease = 1.0 - abs(nFine * 2.0 - 1.0);
            float cragDetail = ridgeCrease * 0.55 + fineCrease * 0.30 + nMicro * 0.15;

            // Directional rocky facet relief shading so sunlit ridges pop against dark shadowed couloirs
            float facetLight = 0.72 + 0.42 * smoothstep(0.28, 0.78, nFine * 0.65 + nMicro * 0.35);
            vec3 rockCol = mix(rockSide, rockTop, smoothstep(0.45, 0.86, slope));
            rockCol = rockCol * (0.42 + 0.68 * rockMacro) * (0.58 + 0.52 * cragDetail) * facetLight * vec3(0.70, 0.74, 0.80);

            float h = vAlpinePos.y;

            // Biome 1: Deep dark Swiss Spruce & Pine Conifer Foothills with organic rocky clearings
            vec3 pineDark = vec3(0.048, 0.088, 0.056);
            vec3 pineMid = vec3(0.105, 0.158, 0.092);
            vec3 pineCol = mix(pineDark, pineMid, nMid * 0.55 + nFine * 0.45);
            float treeline = 98.0 + (nMacro - 0.5) * 52.0 + (nMid - 0.5) * 28.0;
            float forestMask = (1.0 - smoothstep(treeline - 24.0, treeline + 32.0, h)) * smoothstep(0.64, 0.88, slope);

            // Biome 2: Rugged Mont Salève & Alpine Granite Cliffs
            vec3 baseTerrain = mix(rockCol, pineCol, forestMask);

            // Biome 3: Realistic Alpine Granite Ridges + High-Elevation Glacier Couloirs (subtle natural snowline, zero cartoon blobs!)
            float snowThresh = 136.0 + (nMacro - 0.5) * 48.0 + (0.5 - ridgeCrease) * 44.0;
            float altSnow = smoothstep(snowThresh, snowThresh + 42.0, h);
            float shelfCatch = smoothstep(0.76, 0.92, slope + (cragDetail - 0.50) * 0.32 + max(0.0, (h - 190.0) * 0.0007));
            float snowMask = smoothstep(0.32, 0.68, altSnow * shelfCatch);
            vec3 snowShadow = vec3(0.58, 0.70, 0.86);
            vec3 snowSun = vec3(0.88, 0.91, 0.96);
            vec3 snowCol = mix(snowShadow, snowSun, smoothstep(0.42, 0.88, slope * 0.65 + facetLight * 0.35));
            diffuseColor.rgb = mix(baseTerrain, snowCol, snowMask);
            `
          )
          .replace(
            '#include <dithering_fragment>',
            `// Authentic Swiss Alpine Rayleigh aerial perspective haze blending distant mountains softly into Geneva cobalt sky!
            float camDist = length(vAlpinePos.xz - cameraPosition.xz);
            float haze = smoothstep(900.0, 3400.0, camDist) * (0.76 - 0.16 * smoothstep(100.0, 260.0, vAlpinePos.y));
            vec3 skyHaze = mix(uHorizonCol * vec3(0.86, 0.95, 1.08), vec3(0.04, 0.07, 0.13), uNightFactor);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, skyHaze, clamp(haze, 0.0, 0.78));
            #include <dithering_fragment>`
          );
    };
    const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridgeMesh.position.set(centerX, 0, centerZ);
    ridgeMesh.receiveShadow = false;
    worldGroup.add(ridgeMesh);
  }

  // 8B. NEXT-LEVEL SKY & ATMOSPHERIC VFX: Volumetric Sun Corona, 3D Drifting Alpine Clouds, Seagulls & Breeze Motes!
  // 1. Volumetric Sun Corona Glow Halo tracking live sun direction
  const sunGlowCan = document.createElement('canvas');
  sunGlowCan.width = 256;
  sunGlowCan.height = 256;
  const sgCtx = sunGlowCan.getContext('2d');
  const sgGrad = sgCtx.createRadialGradient(128, 128, 4, 128, 128, 124);
  sgGrad.addColorStop(0.0, 'rgba(255, 250, 232, 0.95)');
  sgGrad.addColorStop(0.18, 'rgba(255, 232, 185, 0.52)');
  sgGrad.addColorStop(0.5, 'rgba(255, 210, 145, 0.14)');
  sgGrad.addColorStop(1.0, 'rgba(255, 200, 140, 0.0)');
  sgCtx.fillStyle = sgGrad;
  sgCtx.fillRect(0, 0, 256, 256);
  const sunGlowMat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunGlowCan),
    color: 0xfff3d4,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const sunCorona = new THREE.Sprite(sunGlowMat);
  sunCorona.scale.set(520, 520, 1);
  vfxGroup.add(sunCorona);

  // 2. Keep sky 100% pure real 2K photographic HDRI clouds (no artificial grey sprite ovals!)
  const clouds3D = [];
  const cloudMat = { opacity: 0 };

  // 3. Flock of 14 Animated Gliding Lake Geneva Seagulls soaring over Lac Léman & Genève-Molard!
  const seagullsGroup = new THREE.Group();
  seagullsGroup.name = 'Geneva_Seagulls';
  worldGroup.add(seagullsGroup);
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.7, side: THREE.DoubleSide });
  const seagulls = [];
  for (let i = 0; i < 14; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.55), gullMat);
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24).rotateX(-Math.PI / 2), gullMat);
    wingL.geometry.translate(-0.31, 0, 0);
    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24).rotateX(-Math.PI / 2), gullMat);
    wingR.geometry.translate(0.31, 0, 0);
    bird.add(body, wingL, wingR);
    seagullsGroup.add(bird);
    seagulls.push({
      group: bird,
      wingL,
      wingR,
      cx: -60 + (i % 5) * 90,
      cz: -140 + Math.floor(i / 5) * 115,
      cy: 16 + (i % 4) * 8,
      radius: 34 + (i % 5) * 18,
      speed: 0.34 + (i % 4) * 0.08,
      phase: i * 1.35,
    });
  }

  // 4. Drifting Golden Sunlit Lakeside Dust / Mist Motes
  const moteCount = 180;
  const motePos = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (Math.random() - 0.5) * 320;
    motePos[i * 3 + 1] = 2 + Math.random() * 26;
    motePos[i * 3 + 2] = 60 + (Math.random() - 0.5) * 260;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteMat = new THREE.PointsMaterial({
    map: mistTex,
    color: 0xffecc2,
    size: 0.85,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lakeMotes = new THREE.Points(moteGeo, moteMat);
  vfxGroup.add(lakeMotes);

  // 9. LIVING 1:1 ROAD-FOLLOWING TRAFFIC (16 Cars + 5 Blender TPG Buses + 2 Blender Stadler Trams) & PEDESTRIANS!
  onProgress(95, 'Spawning 1:1 road-following traffic, Blender TPG buses & lakeside boats…');
  const sailboats = [];
  for (let i = 0; i < 9; i++) {
    const sb = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.9, 6.4),
      new THREE.MeshPhysicalMaterial({ color: i % 2 === 0 ? 0xf8f9fa : 0x1d3557, roughness: 0.22, clearcoat: 0.9 })
    );
    hull.position.y = 0.4;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 8.8, 6), darkMetal);
    mast.position.y = 4.7;
    const sail = new THREE.Mesh(
      new THREE.ConeGeometry(2.5, 7.5, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide })
    );
    sail.scale.set(0.12, 1, 1);
    sail.position.set(0, 4.7, 0.8);
    sb.add(hull, mast, sail);
    worldGroup.add(sb);
    sailboats.push({
      mesh: sb,
      cx: 160 + (i % 3) * 140,
      cz: -260 + Math.floor(i / 3) * 125,
      radius: 36 + i * 6,
      speed: 0.09 + (i % 3) * 0.03,
      phase: i * 1.4,
    });
  }

  const roadTraffic = createRoadTrafficNetwork(worldGroup, realData, insertCollider);

  // 64 Truly Diverse Real Rigged Geneva Citizens walking strictly along verified 1:1 OSM sidewalks,
  // pedestrian plazas, park promenades & Pont du Mont-Blanc walkways (ZERO walking in vehicle asphalt lanes!)
  const pedestriansGroup = new THREE.Group();
  pedestriansGroup.name = 'Geneva_Pedestrians';
  worldGroup.add(pedestriansGroup);
  const pedestrians = [];

  // Build cumulative arc-length polyline records from verified road-free 1:1 Geneva pedestrian zones!
  const rawPaths =
    pedZones?.pedestrianWalkPaths?.length > 0
      ? pedZones.pedestrianWalkPaths
      : [
          [[14, 144], [52, 154], [92, 168], [134, 188], [182, 206]],
          [[-156, 240], [-155, 256], [-154, 272], [-153, 288]],
          [[-22.2, 113.2], [-94.0, 1.0], [-165.6, -110.7]],
        ];

  const pedPolylines = rawPaths.map((pts) => {
    const cum = [0];
    let total = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      total += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      cum.push(total);
    }
    return { pts, cum, total: Math.max(1, total) };
  });

  function samplePolyline(pl, dist) {
    const d = Math.max(0, Math.min(pl.total, dist));
    let seg = 0;
    while (seg < pl.cum.length - 2 && pl.cum[seg + 1] < d) seg++;
    const segLen = Math.max(0.001, pl.cum[seg + 1] - pl.cum[seg]);
    const frac = (d - pl.cum[seg]) / segLen;
    const [x1, z1] = pl.pts[seg];
    const [x2, z2] = pl.pts[seg + 1];
    return {
      x: x1 + (x2 - x1) * frac,
      z: z1 + (z2 - z1) * frac,
      dx: x2 - x1,
      dz: z2 - z1,
    };
  }

  const PED_COUNT = 64;
  for (let i = 0; i < PED_COUNT; i++) {
    const ped = new THREE.Group();
    pedestriansGroup.add(ped);
    // First 26 pedestrians populate the prime walkable promenades (Jardin Anglais, Molard, Fusterie, Pont du Mont-Blanc, Bourg-de-Four),
    // and the remaining 38 spread naturally across real OSM central Geneva footways & sidewalks!
    const plIdx = i < 26 ? i % Math.min(10, pedPolylines.length) : i % pedPolylines.length;
    const pl = pedPolylines[plIdx];
    const walkSpeedMps = 1.25 + (i % 5) * 0.16; // authentic 1.25..1.89 m/s human stroll speed!
    pedestrians.push({
      mesh: ped,
      animator: null,
      shadowMeshes: [],
      _castShadow: true,
      pl,
      dist: ((i * 0.237 + 0.06) % 0.94) * pl.total,
      dir: i % 2 === 0 ? 1 : -1,
      walkSpeedMps,
      phase: i * 1.17,
      archetypeIdx: i % 6,
    });
  }

  const pedLoader = new GLTFLoader();
  const pedArchetypeUrls = [
    'models/ped_woman_chic.glb',       // 0: Chic Geneva Woman (long hair, camel trench, designer tote, shades)
    'models/ped_streetwear.glb',       // 1: Streetwear Local (backward cap, oversized hoodie, backpack)
    'models/ped_woman_athleisure.glb', // 2: Lakefront Jogger Woman (high ponytail, headphones, zip-top, leggings)
    'models/ped_banker_suit.glb',      // 3: Geneva Private Banker (tailored suit, silver hair, leather briefcase)
    'models/ped_tourist_summer.glb',   // 4: Summer Tourist (bucket hat, short-sleeve polo, shorts, DSLR camera)
    'models/ped_puffer_tech.glb',      // 5: Alpine Local (knit beanie, quilted puffer jacket, boots)
  ];
  const pedTemplates = [];
  const fleeingDrivers = [];

  // Rich European wardrobe, hair, hat, accessory & natural skin-tone diversity palettes!
  const pedTopColors = [
    0xc49a6c, 0x2f6b47, 0xd8555c, 0x1e2c44, 0xede6d6, 0xd29c26,
    0x7c2530, 0x355c82, 0x4b5c42, 0xc86e42, 0x262b34, 0x7e6694,
    0xdcc9a8, 0x206875,
  ];
  const pedBottomColors = [0x1c2028, 0x283850, 0x8f7e64, 0x3a322c, 0x16181e, 0x444c58, 0x2e435e];
  const pedHairColors = [0x1a1410, 0x4c2e1c, 0xb88b4a, 0x7a331d, 0x281e18, 0x84888e, 0x624228];
  const pedCapColors = [0x1e2430, 0x8c1e26, 0x244834, 0xd4c8ae, 0x2c4b75, 0xc47b24];
  const pedAccColors = [0x6e1a22, 0x242830, 0x8c5a32, 0xebeef2, 0x1c3a56];
  // Realistic diverse skin-tone multipliers applied softly to ReadyPlayerMe skin texture
  const pedSkinTints = [0xffffff, 0xf2d8c4, 0xdcb494, 0xbd8d68, 0x8d5f42, 0x623f2a];

  function styleDiverseCitizen(tpl, seedIdx) {
    const m = SkeletonUtils.clone(tpl);
    const isFemale = seedIdx % 6 === 0 || seedIdx % 6 === 2;
    const hScale = isFemale ? 0.90 + (seedIdx % 4) * 0.025 : 0.95 + (seedIdx % 5) * 0.03;
    const wScale = isFemale ? 0.93 + (seedIdx % 3) * 0.03 : 0.96 + (seedIdx % 4) * 0.04;
    m.scale.set(hScale * wScale, hScale, hScale * wScale);

    const topCol = new THREE.Color(pedTopColors[seedIdx % pedTopColors.length]);
    const botCol = new THREE.Color(pedBottomColors[(seedIdx * 3) % pedBottomColors.length]);
    const hairCol = new THREE.Color(pedHairColors[(seedIdx * 5) % pedHairColors.length]);
    const capCol = new THREE.Color(pedCapColors[(seedIdx * 7) % pedCapColors.length]);
    const accCol = new THREE.Color(pedAccColors[(seedIdx * 2) % pedAccColors.length]);
    const skinTint = new THREE.Color(pedSkinTints[seedIdx % pedSkinTints.length]);

    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (!o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const cloned = mats.map((mt) => {
        const c = mt.clone();
        if (c.name === 'Ped_Top') c.color.copy(topCol);
        else if (c.name === 'Ped_Bottom') c.color.copy(botCol);
        else if (c.name === 'Ped_Hair') c.color.copy(hairCol);
        else if (c.name === 'Ped_Cap') c.color.copy(capCol);
        else if (c.name === 'Ped_Accessory') c.color.copy(accCol);
        else if (c.name === 'Ped_SkinExt') c.color.set(0xd8a888).multiply(skinTint);
        else if (c.name === 'Wolf3D_Skin' || c.name === 'Wolf3D_Body') c.color.multiply(skinTint);
        return c;
      });
      o.material = Array.isArray(o.material) ? cloned : cloned[0];
    });
    return m;
  }

  Promise.all(
    pedArchetypeUrls.map(
      (url) =>
        new Promise((resolve) => {
          pedLoader.load(url, (g) => resolve(g.scene), undefined, () => resolve(null));
        })
    )
  ).then((loaded) => {
    loaded.forEach((s) => { if (s) pedTemplates.push(s); });
    if (pedTemplates.length === 0) return;
    pedestrians.forEach((p, idx) => {
      const tpl = pedTemplates[p.archetypeIdx % pedTemplates.length];
      const m = styleDiverseCitizen(tpl, idx);
      const sm = [];
      m.traverse((o) => {
        if (o.isMesh) sm.push(o);
      });
      p.shadowMeshes = sm;
      p.mesh.add(m);
      p.animator = createHumanAnimator(m);
    });
  });

  // Spawn an animated panicked Geneva driver (randomly chosen from all 6 citizen archetypes!) ejected from a stolen car!
  function spawnFleeingDriver(carX, carZ, carYaw) {
    if (pedTemplates.length === 0) return;
    const g = new THREE.Group();
    const randSeed = Math.floor(Math.random() * 100);
    const tpl = pedTemplates[randSeed % pedTemplates.length];
    const m = styleDiverseCitizen(tpl, randSeed);
    g.add(m);
    const leftX = Math.cos(carYaw);
    const leftZ = -Math.sin(carYaw);
    const sx = carX + leftX * 2.2;
    const sz = carZ + leftZ * 2.2;
    const fleeYaw = Math.atan2(leftX - Math.sin(carYaw) * 0.45, leftZ - Math.cos(carYaw) * 0.45);
    g.position.set(sx, getGroundHeight(sx, sz) + 0.16, sz);
    g.rotation.y = fleeYaw;
    pedestriansGroup.add(g);
    fleeingDrivers.push({
      mesh: g,
      animator: createHumanAnimator(m),
      x: sx,
      z: sz,
      yaw: fleeYaw,
      life: 10.5,
      phase: Math.random() * 6,
    });
  }

  // 10. COLLECTIBLES & SLEEK VERTICAL-GRADIENT WAYPOINT BEACONS (No solid opaque orange block!)
  const collectibleMeshes = [];
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffca42,
    emissive: 0xff9d00,
    emissiveIntensity: 1.0,
    metalness: 0.9,
    roughness: 0.14,
  });
  for (const item of COLLECTIBLES) {
    const g = new THREE.Group();
    const gy = getGroundHeight(item.x, item.z) + item.yOffset;
    g.position.set(item.x, gy, item.z);
    g.add(
      new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 12, 28), goldMat),
      new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), goldMat)
    );
    vfxGroup.add(g);
    collectibleMeshes.push({ id: item.id, name: item.name, x: item.x, y: gy, z: item.z, collected: false, mesh: g });
  }

  // Sleek Non-Blocking AAA GTA Waypoint Marker: crisp ground halo ring + floating diamond + whisper-thin sky beam above car!
  function createGradientBeacon(hexColor) {
    const g = new THREE.Group();
    const col = new THREE.Color(hexColor);

    // 1. Crisp luminous ground target ring (flat on road around target, never hides the vehicle!)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.35, 2.72, 48).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.position.y = 0.22;
    g.add(ring);

    // 2. Floating rotating GTA objective diamond cleanly above vehicle roofline (sleek & non-intrusive!)
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 })
    );
    diamond.scale.set(0.75, 1.35, 0.75);
    diamond.position.y = 3.2;
    diamond.name = 'beaconDiamond';
    g.add(diamond);

    // 3. Razor-thin GTA waypoint pin filament (Reference 2 style: crisp 26m vertical pin, NEVER cuts a bar across sky clouds!)
    const beamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: col } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float fadeUp = pow(1.0 - vUv.y, 2.2);
          float fadeBot = smoothstep(0.0, 0.10, vUv.y);
          float alpha = fadeUp * fadeBot * 0.48;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.085, 26, 10, 1, true), beamMat);
    beam.position.y = 16.5; // sleek 26m laser pin right over vehicle, never slicing through clouds!
    g.add(beam);
    g.userData.diamond = diamond;
    g.userData.ring = ring;
    return g;
  }

  const missionBeacon = createGradientBeacon(0xffb82e);
  vfxGroup.add(missionBeacon);

  const customBeacon = createGradientBeacon(0x38e8ff);
  customBeacon.visible = false;
  vfxGroup.add(customBeacon);

  onProgress(100, '1:1 Geneva ready.');

  let rainWet = false;
  let winterFactor = 0.0;
  function setWetRoads(isRaining) {
    rainWet = isRaining;
    asphaltMat.roughness = isRaining ? 0.14 : 0.74;
    asphaltMat.metalness = isRaining ? 0.65 : 0.14;
    cobbleMat.roughness = isRaining ? 0.24 : 0.85;
    terrainMat.roughness = isRaining ? 0.28 : 0.88;
  }
  function setWinterMode(isWinter) {
    winterFactor = isWinter ? 1.0 : 0.0;
    christmasGroup.visible = isWinter;
    if (swiss3DRef?.winterUniform) swiss3DRef.winterUniform.value = winterFactor;
    terrainMat.color.setHex(isWinter ? 0xdde5ef : 0xffffff);
    cobbleMat.color.setHex(isWinter ? 0xd4dce6 : 0xc4c0b8);
    if (canopies?.material?.color) canopies.material.color.setHex(isWinter ? 0xd0ddec : 0xffffff);
  }

  function getDynamicColliders(excludeEntity = null) {
    const out = [];
    for (const e of roadTraffic.trafficEntities) {
      if (excludeEntity && e === excludeEntity) continue;
      const mass = e.kind === 'tram' ? 42000 : e.kind === 'bus' ? 12500 : e.vtype === 'van' ? 2400 : 1650;
      const spd = e.speed || 0;
      out.push({
        kind: 'obb',
        x: e.x,
        z: e.z,
        yaw: e.yaw,
        halfW: e.halfW,
        halfL: e.halfL,
        maxY: e.y + e.height,
        walkableTop: true,
        speed: Math.abs(spd),
        vx: Math.sin(e.yaw) * spd,
        vz: Math.cos(e.yaw) * spd,
        mass,
        isVehicle: true,
        isTram: e.kind === 'tram',
        onHit(impact) {
          if (e.kind !== 'tram' && impact > 2.2) {
            e.impactStopTimer = Math.max(e.impactStopTimer || 0, Math.min(3.5, 1.2 + impact * 0.12));
            e.speed *= 0.22;
          }
        },
      });
    }
    for (const p of pedestrians) {
      out.push({
        kind: 'cyl',
        x: p.mesh.position.x,
        z: p.mesh.position.z,
        r: 0.36,
        maxY: p.mesh.position.y + 1.85,
        walkableTop: false,
        isPed: true,
      });
    }
    return out;
  }

  let _worldFrame = 0;
  function update(dt, elapsed, nightFactor, horizonColor = null, sunDir = null, activePos = null, riderState = null, obstacleVehicles = null) {
    _worldFrame++;
    const hasFocus = !!activePos;
    const ax = activePos ? activePos.x : 0;
    const az = activePos ? activePos.z : 0;
    waterUniforms.uTime.value = elapsed;

    const jp = jetGeo.attributes.position.array;
    for (let i = 0; i < jetCount; i++) {
      jetSeeds[i] += dt * (0.34 + (i % 7) * 0.02);
      if (jetSeeds[i] > 1.0) jetSeeds[i] -= 1.0;
      const t = jetSeeds[i];
      const height = Math.sin(t * Math.PI * 0.84) * 140;
      const spread = 0.6 + t * t * 18.0;
      const windX = t * t * 14.0;
      const windZ = t * t * 6.0;
      jp[i * 3] = jetX + Math.cos(i * 2.3 + elapsed) * spread + windX;
      jp[i * 3 + 1] = 2.0 + Math.max(0, height);
      jp[i * 3 + 2] = jetZ + Math.sin(i * 1.9 + elapsed) * spread + windZ;
    }
    jetGeo.attributes.position.needsUpdate = true;
    jetLight.intensity = nightFactor * 22;
    rbMat.uniforms.uOpacity.value = Math.max(0, 1 - nightFactor * 1.4) * 0.24;

    if (sunDir) {
      const fx = activePos ? activePos.x : centerX;
      const fz = activePos ? activePos.z : centerZ;
      sunCorona.position.set(fx + sunDir.x * 2600, Math.max(40, sunDir.y * 2600), fz + sunDir.z * 2600);
      sunGlowMat.opacity = Math.max(0, 1 - nightFactor * 1.45) * 0.78;
    }
    cloudMat.opacity = Math.max(0.08, (1 - nightFactor * 0.72) * 0.34);
    for (const c of clouds3D) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > centerX + 2200) c.group.position.x = centerX - 2200;
    }
    for (const g of seagulls) {
      const a = elapsed * g.speed + g.phase;
      const nx = g.cx + Math.cos(a) * g.radius;
      const nz = g.cz + Math.sin(a) * g.radius * 0.72;
      const d2 = hasFocus ? (nx - ax) * (nx - ax) + (nz - az) * (nz - az) : 0;
      const vis = !hasFocus || d2 < 260 * 260;
      g.group.visible = vis;
      if (!vis) continue;
      const ny = g.cy + Math.sin(elapsed * 1.4 + g.phase) * 2.4;
      g.group.position.set(nx, ny, nz);
      g.group.rotation.y = -a;
      const flap = Math.sin(elapsed * 7.2 + g.phase * 2.0) * 0.45;
      g.wingL.rotation.z = flap;
      g.wingR.rotation.z = -flap;
    }
    moteMat.opacity = Math.max(0, (1 - nightFactor) * 0.34);
    const mp = moteGeo.attributes.position.array;
    for (let i = 0; i < moteCount; i++) {
      mp[i * 3] += dt * 0.65;
      mp[i * 3 + 1] += Math.sin(elapsed * 1.2 + i) * dt * 0.16;
      if (mp[i * 3] > 220) mp[i * 3] = -180;
    }
    moteGeo.attributes.position.needsUpdate = true;

    for (const mb of mooredBoats) {
      mb.mesh.position.y = Math.sin(elapsed * 1.9 + mb.phase) * 0.1;
      mb.mesh.rotation.set(Math.sin(elapsed * 1.6 + mb.phase) * 0.03, mb.baseYaw, Math.cos(elapsed * 1.4 + mb.phase) * 0.035);
    }
    mouetteRoute.t += dt * 0.014 * mouetteRoute.dir;
    if (mouetteRoute.t > 1) { mouetteRoute.t = 1; mouetteRoute.dir = -1; }
    if (mouetteRoute.t < 0) { mouetteRoute.t = 0; mouetteRoute.dir = 1; }
    const mx = mouetteRoute.x1 + (mouetteRoute.x2 - mouetteRoute.x1) * mouetteRoute.t;
    const mz = mouetteRoute.z1 + (mouetteRoute.z2 - mouetteRoute.z1) * mouetteRoute.t;
    aiMouette.position.set(mx, Math.sin(elapsed * 2.4) * 0.09, mz);
    aiMouette.rotation.y = Math.atan2((mouetteRoute.x2 - mouetteRoute.x1) * mouetteRoute.dir, (mouetteRoute.z2 - mouetteRoute.z1) * mouetteRoute.dir);

    for (const f of flags) {
      f.mesh.rotation.y = Math.sin(elapsed * 4.8 + f.phase) * 0.24;
    }

    genevaLandmarks.update(elapsed, nightFactor);
    if (bainsDesPaquis?.update) bainsDesPaquis.update(elapsed, nightFactor, winterFactor);
    if (cgnSteamer?.update) cgnSteamer.update(dt, elapsed, nightFactor);

    for (const sb of sailboats) {
      const a = elapsed * sb.speed + sb.phase;
      sb.mesh.position.set(sb.cx + Math.cos(a) * sb.radius, 0.05, sb.cz + Math.sin(a) * sb.radius * 0.7);
      sb.mesh.rotation.y = -a;
    }

    // Update all 1:1 road-following AI cars, Blender TPG buses & Blender Stadler Tango trams!
    roadTraffic.update(dt, elapsed, nightFactor, activePos, riderState, obstacleVehicles);



    // 64 Diverse rigged human pedestrians strolling strictly along 1:1 Geneva sidewalks & pedestrian plazas!
    for (let i = 0; i < pedestrians.length; i++) {
      const p = pedestrians[i];
      p.dist += dt * p.walkSpeedMps * p.dir;
      if (p.dist >= p.pl.total) { p.dist = p.pl.total; p.dir = -1; }
      if (p.dist <= 0) { p.dist = 0; p.dir = 1; }
      const samp = samplePolyline(p.pl, p.dist);
      const px = samp.x;
      const pz = samp.z;

      const d2 = hasFocus ? (px - ax) * (px - ax) + (pz - az) * (pz - az) : 0;
      const vis = !hasFocus || d2 < 105 * 105;
      p.mesh.visible = vis;
      if (!vis) {
        p.mesh.position.x = px;
        p.mesh.position.z = pz;
        continue;
      }

      p.mesh.position.set(px, getGroundHeight(px, pz) + 0.255, pz);
      p.mesh.rotation.y = Math.atan2(samp.dx * p.dir, samp.dz * p.dir);

      const wantShadow = !hasFocus || d2 < 52 * 52;
      if (p._castShadow !== wantShadow && p.shadowMeshes.length > 0) {
        p._castShadow = wantShadow;
        for (let k = 0; k < p.shadowMeshes.length; k++) p.shadowMeshes[k].castShadow = wantShadow;
      }

      if (p.animator && (wantShadow || ((_worldFrame + i) & 1) === 0)) {
        p.animator.applyPose({
          gaitPhase: elapsed * 6.4 + p.phase,
          speedNorm: 0.46,
          sprintBlend: 0,
          airBlend: 0,
          turnLean: 0,
          headLookYaw: 0,
          idleTime: elapsed + p.phase,
        });
      }
    }

    // Update panicked drivers fleeing on foot from stolen Geneva cars!
    for (let i = fleeingDrivers.length - 1; i >= 0; i--) {
      const f = fleeingDrivers[i];
      f.life -= dt;
      if (f.life <= 0) {
        pedestriansGroup.remove(f.mesh);
        fleeingDrivers.splice(i, 1);
        continue;
      }
      const nx = f.x + Math.sin(f.yaw) * 6.4 * dt;
      const nz = f.z + Math.cos(f.yaw) * 6.4 * dt;
      if (!isWater(nx, nz)) {
        f.x = nx;
        f.z = nz;
      } else {
        f.yaw += 1.4;
      }
      f.mesh.position.set(f.x, getGroundHeight(f.x, f.z) + 0.16, f.z);
      f.mesh.rotation.y = f.yaw;
      if (f.animator) {
        f.animator.applyPose({
          gaitPhase: elapsed * 12.5 + f.phase,
          speedNorm: 1.0,
          sprintBlend: 1.0,
          airBlend: 0,
          turnLean: 0,
          headLookYaw: 0,
          idleTime: elapsed,
        });
      }
    }

    for (const c of collectibleMeshes) {
      if (!c.collected) {
        c.mesh.rotation.y = elapsed * 1.9 + c.id;
        c.mesh.position.y = c.y + Math.sin(elapsed * 2.6 + c.id) * 0.35;
      }
    }

    // Cycle Swiss traffic lights (12s green, 2.5s amber, 8s red)
    const cycle = elapsed % 22.5;
    tlGreenMat.emissiveIntensity = cycle < 12 ? 3.5 : 0.1;
    tlAmberMat.emissiveIntensity = cycle >= 12 && cycle < 14.5 ? 3.5 : 0.1;
    tlRedMat.emissiveIntensity = cycle >= 14.5 ? 3.5 : 0.1;

    // Keep daytime windows dark & cloud-reflecting; turn on warm interior glow ONLY after sunset!
    const nightGlow = Math.max(0, (nightFactor - 0.32) / 0.68);
    const targetEmissive = Math.min(1.45, nightGlow * 1.55);
    for (const m of emissiveMaterials) m.emissiveIntensity = targetEmissive;
    if (swiss3DRef?.nightUniform) swiss3DRef.nightUniform.value = targetEmissive;
    if (identityRef?.updateNight) identityRef.updateNight(nightFactor);
    if (pedZones?.updateNight) pedZones.updateNight(nightFactor);
    lampBulbMat.emissiveIntensity = 0.1 + nightGlow * 3.4;

    // Glossy GTA-style satin night road reflections (Reference 2!) even when not raining!
    if (!rainWet) {
      asphaltMat.roughness = 0.74 - nightFactor * 0.42;
      asphaltMat.metalness = 0.10 + nightFactor * 0.34;
    }

    // Sync Alpine atmospheric sky-scatter haze with live time-of-day horizon color!
    alpineUniforms.uNightFactor.value = nightFactor;
    if (horizonColor) alpineUniforms.uHorizonCol.value.copy(horizonColor);

    // Animate sleek GTA waypoint diamonds & fade diamond cleanly when player stands right next to target!
    for (const b of [missionBeacon, customBeacon]) {
      if (b.visible && b.userData.diamond) {
        b.userData.diamond.rotation.y = elapsed * 2.4;
        b.userData.diamond.position.y = 3.15 + Math.sin(elapsed * 3.2) * 0.22;
        const pulse = 1.0 + Math.sin(elapsed * 3.6) * 0.06;
        b.userData.ring.scale.set(pulse, 1, pulse);
        if (activePos) {
          const d = Math.hypot(activePos.x - b.position.x, activePos.z - b.position.z);
          b.userData.diamond.visible = d > 6.5;
        }
      }
    }
  }

  let swiss3DRef = null;
  let identityRef = null;
  // Micro-detail & dynamic groups skipped ONLY in GTAO depth prepass and wavy Lac Léman mirror reflections
  // (keeps full 100% visual quality + real sun shadows & contact shadow blobs while cutting ~3,000+ redundant DC/frame!)
  const microDetailGroups = [streetPropsGroup, roadTraffic.group, pedestriansGroup, seagullsGroup];
  function attachRealGenevaLayers(swiss3D, identity, streetLife = null) {
    swiss3DRef = swiss3D;
    identityRef = identity;
    if (streetLife?.group) microDetailGroups.push(streetLife.group);
    // Only street-level boutique signs go in microDetailGroups; rooftop Rolex/Patek/Hôtel Métropole stay visible in lake reflections!
    if (identity?.streetGroup) microDetailGroups.push(identity.streetGroup);
    else if (identity?.group) microDetailGroups.push(identity.group);
    // Register micro-detail groups on waterMesh so wavy lake reflections skip sub-pixel props (80% faster water pass!)
    if (waterMesh) waterMesh.userData.skipInReflection = microDetailGroups;
  }

  // Exact 3D rooftop surface lookup (real swissBUILDINGS3D roof/terrace triangles + OSM fallback!)
  function sampleRoofHeight(x, z, maxBelowY = Infinity, radius = 0.35) {
    let bestY = null;
    if (swiss3DRef?.sampleRoofSupport) {
      bestY = swiss3DRef.sampleRoofSupport(x, z, radius, maxBelowY);
    }
    if (bestY === null) {
      const near = queryColliders(x, z);
      for (let i = 0; i < near.length; i++) {
        const c = near[i];
        if (c.kind !== 'poly' || c.walkableTop === false) continue;
        if (x < c.minX || x > c.maxX || z < c.minZ || z > c.maxZ) continue;
        const my = c.maxY ?? -999;
        if (my <= maxBelowY && (bestY === null || my > bestY)) {
          // Point-in-polygon fallback check
          let inside = false;
          const pts = c.pts;
          for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
            const xi = pts[a][0], zi = pts[a][1];
            const xj = pts[b][0], zj = pts[b][1];
            if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi) inside = !inside;
          }
          if (inside) bestY = my;
        }
      }
    }
    return bestY;
  }

  return {
    worldGroup,
    upperMats,
    groundMats,
    microDetailGroups,
    attachRealGenevaLayers,
    insertCollider,
    queryColliders,
    queryCollidersRect,
    sampleRoofHeight,
    registerInteractable,
    findNearestInteractable,
    interactables,
    getDynamicColliders,
    roadTraffic,
    spawnFleeingDriver,
    collectibleMeshes,
    missionBeacon,
    customBeacon,
    waterUniforms,
    waterMesh,
    vfxGroup,
    lampCoords,
    canopies,
    cgnSteamer,
    setWetRoads,
    setWinterMode,
    update,
  };
}
