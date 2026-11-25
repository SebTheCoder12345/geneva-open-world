import * as THREE from 'three';
import { getGroundHeight, isWater } from './cityData.js';
import { batchStaticGroup } from './staticBatcher.js';

function createRoadStencilTexture(kind) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 512);

  if (kind === 'bustaxi') {
    // Authentic Geneva yellow 'BUS / TAXI' asphalt lane stencil (matches ref_03_rue_du_rhone_east.jpg!)
    ctx.fillStyle = 'rgba(242, 198, 48, 0.84)';
    ctx.font = 'bold 74px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.translate(128, 175);
    ctx.scale(1.0, 1.55);
    ctx.fillText('BUS', 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(128, 365);
    ctx.scale(0.95, 1.55);
    ctx.fillText('TAXI', 0, 0);
    ctx.restore();
  } else {
    // Crisp Swiss white straight-ahead asphalt lane arrow (matches ref_03!)
    ctx.fillStyle = 'rgba(235, 238, 242, 0.80)';
    ctx.beginPath();
    ctx.moveTo(128, 34);
    ctx.lineTo(192, 176);
    ctx.lineTo(154, 176);
    ctx.lineTo(154, 474);
    ctx.lineTo(102, 474);
    ctx.lineTo(102, 176);
    ctx.lineTo(64, 176);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createTpgMachineTexture() {
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 384;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e8eaee';
  ctx.fillRect(0, 0, 192, 384);
  // Signature Swiss TPG orange header band (matches ref_06_place_du_molard.jpg!)
  ctx.fillStyle = '#f26522';
  ctx.fillRect(0, 0, 192, 72);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('tpg', 96, 42);
  ctx.font = '600 13px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('BILLETS · TICKETS', 96, 62);
  // Glowing blue interactive route/ticket screen
  ctx.fillStyle = '#184b8c';
  ctx.fillRect(22, 92, 148, 118);
  ctx.fillStyle = '#5eb8ff';
  ctx.fillRect(30, 102, 132, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(30, 136, 60, 26);
  ctx.fillRect(102, 136, 60, 26);
  ctx.fillRect(30, 172, 132, 26);
  // Coin & card reader panel
  ctx.fillStyle = '#2d333b';
  ctx.fillRect(22, 226, 148, 86);
  ctx.fillStyle = '#14171a';
  ctx.fillRect(42, 330, 108, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Adds authentic Geneva street life & micro-realism matched directly to real Geneva reference photos:
 * - Outdoor Geneva café terraces (Place du Molard, Place du Bourg-de-Four, Jardin Anglais)
 * - White stone cube boutique topiary planters (Rue du Rhône & Quai du Général-Guisan, matching ref_03!)
 * - Jardin Anglais lush lakeside floral garden beds (matching ref_01 foreground!)
 * - TPG orange ticket vending machines (matching ref_06!)
 * - Stenciled Swiss yellow 'BUS / TAXI' & white directional road arrows (matching ref_03!)
 * - Instanced 3D Geneva stone rooftop chimneys + terracotta pots mounted on real swissBUILDINGS3D roofs (matching ref_01 skyline!)
 */
export function buildGenevaStreetLife(worldGroup, realData, streetFeatures, swiss3D = null, registerInteractable = null, insertCollider = null) {
  const lifeGroup = new THREE.Group();
  lifeGroup.name = 'Geneva_Real_Street_Life';
  worldGroup.add(lifeGroup);

  const dummy = new THREE.Object3D();

  // Build quick road-exclusion helper so café tables & planters NEVER intrude into traffic lanes!
  const roadSegs = [];
  for (const r of realData.roads || []) {
    if (!r.p || r.p.length < 2 || r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'service') continue;
    const hw = (r.w || 8.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      roadSegs.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw, r.n || '']);
    }
  }
  function nearVehRoad(x, z, pad = 0.6) {
    for (let i = 0; i < roadSegs.length; i++) {
      const [x1, z1, x2, z2, hw] = roadSegs[i];
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

  // =================================================================================================
  // 1. OUTDOOR GENEVA CAFÉ TERRACES (PLACE DU MOLARD, BOURG-DE-FOUR & JARDIN ANGLAIS — 4 InstancedMeshes!)
  // =================================================================================================
  const rawCafeSpots = [
    // Place du Molard east & west pedestrian café terraces (cleanly flanking the glowing blue paver promenade!)
    [-165.5, 250.0], [-166.2, 256.5], [-166.8, 263.0], [-167.4, 269.5],
    [-146.5, 251.5], [-146.0, 258.0], [-145.5, 264.5],
    // Place du Bourg-de-Four historic Old Town outdoor terraces!
    [-68.0, 626.0], [-64.0, 631.0], [-71.0, 640.0], [-83.5, 638.0], [-86.0, 628.0],
    // Jardin Anglais lakeside pavilion café terrace!
    [72.0, 184.0], [77.5, 187.0], [83.0, 190.0], [88.5, 186.0],
    // Place de la Fusterie / Rue du Marché café spots
    [-258.0, 232.0], [-264.0, 236.0], [-252.0, 228.0],
  ];
  const cafeSpots = rawCafeSpots.filter(([x, z]) => !nearVehRoad(x, z, 0.9) && !isWater(x, z));

  if (cafeSpots.length > 0) {
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.45, metalness: 0.72 });
    const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xebe6dc, roughness: 0.36, metalness: 0.08 });
    const chairSeatMat = new THREE.MeshStandardMaterial({ color: 0x8c5a38, roughness: 0.78 });
    const umbrellaMat = new THREE.MeshStandardMaterial({ color: 0xf0eadc, roughness: 0.84, side: THREE.DoubleSide });

    const tableTopInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 14), tableTopMat, cafeSpots.length);
    const tableLegInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.24, 0.74, 8), ironMat, cafeSpots.length);
    const chairInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.46, 0.42), chairSeatMat, cafeSpots.length * 3);
    const umbPoleInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.38, 6), ironMat, cafeSpots.length);
    const umbCanopyInst = new THREE.InstancedMesh(new THREE.ConeGeometry(1.42, 0.46, 8), umbrellaMat, cafeSpots.length);

    tableTopInst.castShadow = true;
    umbCanopyInst.castShadow = true;
    umbCanopyInst.receiveShadow = true;
    chairInst.castShadow = true;

    let ci = 0;
    cafeSpots.forEach(([x, z], idx) => {
      const y = getGroundHeight(x, z) + 0.16;
      dummy.position.set(x, y + 0.74, z);
      dummy.rotation.set(0, idx * 0.7, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tableTopInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, y + 0.37, z);
      dummy.updateMatrix();
      tableLegInst.setMatrixAt(idx, dummy.matrix);

      if (insertCollider) {
        insertCollider({ kind: 'cyl', x, z, r: 0.56, maxY: y + 1.0, walkableTop: true });
      }

      // Show parasol on alternating tables for natural European café rhythm!
      const hasUmb = idx % 2 === 0;
      dummy.position.set(x, y + 1.19, z);
      dummy.scale.set(hasUmb ? 1 : 0.001, hasUmb ? 1 : 0.001, hasUmb ? 1 : 0.001);
      dummy.updateMatrix();
      umbPoleInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, y + 2.32, z);
      dummy.updateMatrix();
      umbCanopyInst.setMatrixAt(idx, dummy.matrix);

      // 3 woven bistro chairs tucked naturally around each marble table
      for (let k = 0; k < 3; k++) {
        const a = idx * 0.9 + (k / 3) * Math.PI * 2;
        const cx = x + Math.cos(a) * 0.74;
        const cz = z + Math.sin(a) * 0.74;
        dummy.position.set(cx, y + 0.25, cz);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        chairInst.setMatrixAt(ci++, dummy.matrix);
        if (registerInteractable && k === 0) {
          // Register primary open café seat at each marble bistro table
          registerInteractable({
            id: `molard_cafe_${idx}`,
            type: 'cafe_chair',
            label: 'SIT AT CAFÉ · ESPRESSO',
            activeLabel: 'STAND UP',
            subtitle: 'Enjoying a Swiss espresso at a Geneva café terrace… (E or WASD to stand)',
            toast: 'GENEVA CAFÉ TERRACE · ESPRESSO',
            x: cx,
            y,
            z: cz,
            yaw: Math.atan2(-Math.cos(a), -Math.sin(a)),
            exitX: x + Math.cos(a) * 1.48,
            exitZ: z + Math.sin(a) * 1.48,
            persistent: true,
            radius: 2.35,
            priority: 1.15,
          });
        }
      }
    });
    lifeGroup.add(tableTopInst, tableLegInst, chairInst, umbPoleInst, umbCanopyInst);
  }

  // =================================================================================================
  // 2. WHITE STONE CUBE LUXURY BOUTIQUE PLANTERS + BOXWOOD TOPIARIES (MATCHING DIOR / CARTIER IN ref_03!)
  // =================================================================================================
  const rawPlanters = [
    // Rue du Rhône luxury boutiques (Dior, Cartier, Hermès, Patek Philippe, Louis Vuitton)
    [-118.0, 224.0], [-108.0, 222.5], [-98.0, 221.0], [-88.0, 223.5], [-76.0, 226.0],
    [-64.0, 228.5], [-52.0, 231.0], [-40.0, 233.5], [-28.0, 236.5], [-16.0, 239.5],
    // Quai du Général-Guisan boutique sidewalk
    [12.0, 178.0], [26.0, 186.0], [42.0, 195.0], [58.0, 204.0], [76.0, 214.0],
    // Place du Molard luxury shopfront flanks
    [-162.5, 242.0], [-163.5, 246.5], [-144.5, 244.0], [-143.8, 248.5],
  ];
  const planterSpots = rawPlanters.filter(([x, z]) => !nearVehRoad(x, z, 0.55) && !isWater(x, z));
  if (planterSpots.length > 0) {
    const potMat = new THREE.MeshStandardMaterial({ color: 0xe8e5dd, roughness: 0.76 });
    const topiaryMat = new THREE.MeshStandardMaterial({ color: 0x265428, roughness: 0.88 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x4b3b2c, roughness: 0.90 });

    const potInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.64, 0.66, 0.64), potMat, planterSpots.length);
    const stemInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.055, 0.52, 6), stemMat, planterSpots.length);
    const ballInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), topiaryMat, planterSpots.length);
    potInst.castShadow = true;
    potInst.receiveShadow = true;
    ballInst.castShadow = true;

    planterSpots.forEach(([x, z], idx) => {
      const y = getGroundHeight(x, z) + 0.16;
      dummy.position.set(x, y + 0.33, z);
      dummy.rotation.set(0, 0.42, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      potInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, y + 0.86, z);
      dummy.updateMatrix();
      stemInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, y + 1.24, z);
      dummy.scale.set(1, 0.94, 1);
      dummy.updateMatrix();
      ballInst.setMatrixAt(idx, dummy.matrix);

      if (insertCollider) {
        insertCollider({ kind: 'obb', x, z, yaw: 0.42, halfW: 0.36, halfL: 0.36, maxY: y + 1.5, walkableTop: true });
      }
    });
    lifeGroup.add(potInst, stemInst, ballInst);
  }

  // =================================================================================================
  // 3. JARDIN ANGLAIS CURVED GRANITE-BORDERED LAKESIDE FLOWERBEDS (MATCHING ref_01 FOREGROUND — BATCHED!)
  // =================================================================================================
  {
    const flowerBeds = [
      { x: 40.0, z: 152.0, r: 3.2 },
      { x: 64.0, z: 158.0, r: 3.8 },
      { x: 96.0, z: 172.0, r: 3.2 },
    ];
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xc9c3b8, roughness: 0.82 });
    const turfMat = new THREE.MeshStandardMaterial({ color: 0x2c5c2a, roughness: 0.92 });
    const bloomMats = [
      new THREE.MeshStandardMaterial({ color: 0xd9283c, roughness: 0.78 }), // Geneva scarlet begonia
      new THREE.MeshStandardMaterial({ color: 0x8e6bd6, roughness: 0.78 }), // Alpine lavender
      new THREE.MeshStandardMaterial({ color: 0xf4c83c, roughness: 0.78 }), // Golden marigold
      new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.78 }), // White alyssum
    ];

    const flowerGroup = new THREE.Group();
    for (const fb of flowerBeds) {
      const y = getGroundHeight(fb.x, fb.z) + 0.14;
      const fg = new THREE.Group();
      fg.position.set(fb.x, y, fb.z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(fb.r, 0.22, 8, 28).rotateX(Math.PI / 2), curbMat);
      rim.position.y = 0.22;
      rim.receiveShadow = true;
      const bed = new THREE.Mesh(new THREE.CylinderGeometry(fb.r - 0.12, fb.r + 0.08, 0.36, 24), turfMat);
      bed.position.y = 0.18;
      bed.receiveShadow = true;
      fg.add(rim, bed);

      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2;
        const rad = (k % 3 === 0 ? 0.36 : k % 3 === 1 ? 0.64 : 0.84) * (fb.r - 0.35);
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.32 + (k % 3) * 0.08, 7, 5), bloomMats[k % bloomMats.length]);
        tuft.scale.set(1.25, 0.58, 1.25);
        tuft.position.set(Math.cos(a) * rad, 0.44, Math.sin(a) * rad);
        fg.add(tuft);
      }
      flowerGroup.add(fg);
      if (insertCollider) {
        insertCollider({ kind: 'cyl', x: fb.x, z: fb.z, r: fb.r + 0.16, maxY: y + 0.55, walkableTop: true });
      }
    }
    batchStaticGroup(flowerGroup, { label: 'JardinFlowerBeds' });
    lifeGroup.add(flowerGroup);
  }

  // =================================================================================================
  // 4. ORANGE & WHITE 'tpg' TICKET VENDING MACHINES BESIDE REAL TPG STOPS (2 InstancedMeshes = 2 DC!)
  // =================================================================================================
  {
    const tpgStops = (streetFeatures?.tpgStops || []).slice(0, 14);
    const validMachines = tpgStops.filter(([x, z]) => !nearVehRoad(x, z, 0.45) && !isWater(x, z));
    if (validMachines.length > 0) {
      const tpgTex = createTpgMachineTexture();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdce0e6, roughness: 0.42, metalness: 0.35 });
      const frontMat = new THREE.MeshStandardMaterial({
        map: tpgTex,
        emissive: 0x3b86d6,
        emissiveMap: tpgTex,
        emissiveIntensity: 0.22,
        roughness: 0.32,
      });
      const bodyInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.76, 1.88, 0.56), bodyMat, validMachines.length);
      const faceInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.74, 1.84), frontMat, validMachines.length);
      bodyInst.castShadow = true;
      const cosR = Math.cos(0.55);
      const sinR = Math.sin(0.55);
      validMachines.forEach(([tx, tz], idx) => {
        const ty = getGroundHeight(tx, tz) + 0.16;
        const bx = tx + 1.2;
        const bz = tz + 0.4;
        dummy.position.set(bx, ty + 0.94, bz);
        dummy.rotation.set(0, 0.55, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bodyInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(bx + sinR * 0.285, ty + 0.94, bz + cosR * 0.285);
        dummy.updateMatrix();
        faceInst.setMatrixAt(idx, dummy.matrix);

        if (insertCollider) {
          insertCollider({ kind: 'obb', x: bx, z: bz, yaw: 0.55, halfW: 0.42, halfL: 0.32, maxY: ty + 1.92, walkableTop: false });
        }

        if (registerInteractable) {
          const standX = bx + sinR * 0.92;
          const standZ = bz + cosR * 0.92;
          registerInteractable({
            id: `tpg_machine_${idx}`,
            type: 'tpg_machine',
            label: 'BUY TPG TICKET',
            subtitle: 'Purchased Unireso Zone 10 Genève Day Pass! Valid on all TPG trams, buses & Mouettes.',
            toast: 'TPG ZONE 10 TICKET · PRINTED',
            x: standX,
            y: getGroundHeight(standX, standZ) + 0.16,
            z: standZ,
            yaw: 0.55 + Math.PI,
            persistent: false,
            duration: 2.75,
            radius: 2.3,
            priority: 1.0,
          });
        }
      });
      lifeGroup.add(bodyInst, faceInst);
    }
  }

  // =================================================================================================
  // 5. SWISS YELLOW 'BUS / TAXI' & WHITE LANE ARROWS PAINTED ON MAJOR GENEVA STREETS (ref_03!)
  // =================================================================================================
  {
    const busTaxiMat = new THREE.MeshStandardMaterial({
      map: createRoadStencilTexture('bustaxi'),
      transparent: true,
      roughness: 0.80,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const arrowMat = new THREE.MeshStandardMaterial({
      map: createRoadStencilTexture('arrow'),
      transparent: true,
      roughness: 0.80,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const stencilGeo = new THREE.PlaneGeometry(2.1, 4.4).rotateX(-Math.PI / 2);

    const busCoords = [];
    const arrowCoords = [];
    for (const r of realData.roads || []) {
      if (!r.p || r.p.length < 2 || !r.n) continue;
      const isMajor = /Général-Guisan|Rhône|Mont-Blanc|Neuve|Marché|Rive|Croix-d'Or/i.test(r.n);
      if (!isMajor || r.br) continue;
      for (let i = 0; i < r.p.length - 1; i++) {
        const [x1, z1] = r.p[i];
        const [x2, z2] = r.p[i + 1];
        const segLen = Math.hypot(x2 - x1, z2 - z1);
        if (segLen < 16) continue;
        const mx = (x1 + x2) * 0.5;
        const mz = (z1 + z2) * 0.5;
        if (isWater(mx, mz)) continue;
        const ang = Math.atan2(x2 - x1, z2 - z1);
        const px = -(z2 - z1) / segLen;
        const pz = (x2 - x1) / segLen;
        if (/Rhône|Marché|Croix-d'Or/i.test(r.n) && busCoords.length < 24) {
          busCoords.push([mx + px * 1.9, mz + pz * 1.9, ang]);
        }
        if (arrowCoords.length < 48) {
          arrowCoords.push([mx - px * 1.9, mz - pz * 1.9, ang + Math.PI]);
        }
      }
    }

    if (busCoords.length > 0) {
      const bInst = new THREE.InstancedMesh(stencilGeo, busTaxiMat, busCoords.length);
      busCoords.forEach(([x, z, ang], idx) => {
        dummy.position.set(x, getGroundHeight(x, z) + 0.305, z);
        dummy.rotation.set(0, ang, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        bInst.setMatrixAt(idx, dummy.matrix);
      });
      lifeGroup.add(bInst);
    }
    if (arrowCoords.length > 0) {
      const aInst = new THREE.InstancedMesh(stencilGeo, arrowMat, arrowCoords.length);
      arrowCoords.forEach(([x, z, ang], idx) => {
        dummy.position.set(x, getGroundHeight(x, z) + 0.305, z);
        dummy.rotation.set(0, ang, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        aInst.setMatrixAt(idx, dummy.matrix);
      });
      lifeGroup.add(aInst);
    }
  }

  // =================================================================================================
  // 6. 380 INSTANCED 3D GENEVA STONE CHIMNEYS + TERRACOTTA FLUE POTS ON REAL swissBUILDINGS3D ROOFS!
  // (Recreates the unmistakable European rooftop chimney skyline seen in ref_01_quai_general_guisan.jpg!)
  // =================================================================================================
  function populateRealRooftopChimneys() {
    if (!swiss3D?.getRealRoofHeight) return;
    const coords = [];
    for (let i = 0; i < (realData.buildings || []).length && coords.length < 380; i += 4) {
      const b = realData.buildings[i];
      if (!b.p || b.p.length < 3 || b.h < 12) continue;
      let cx = 0, cz = 0;
      for (const [px, pz] of b.p) { cx += px; cz += pz; }
      cx /= b.p.length; cz /= b.p.length;
      // Keep chimneys off Cathédrale Saint-Pierre, Grand Théâtre & Tour du Molard!
      if (Math.hypot(cx - -124, cz - 543) < 55) continue;
      if (Math.hypot(cx - -570, cz - 468) < 48) continue;
      if (Math.hypot(cx - -150, cz - 229) < 14) continue;

      const ry = swiss3D.getRealRoofHeight(cx, cz, 8);
      if (ry === null || ry === undefined || ry < 14) continue;
      coords.push([cx + ((i % 5) - 2) * 1.4, ry - 0.65, cz + (((i * 3) % 5) - 2) * 1.4, (i % 6) * 0.5]);
      // Add a paired chimney on large Geneva Haussmann roofs!
      if (b.p.length >= 6 && coords.length < 380) {
        coords.push([cx - 3.2, ry - 0.72, cz + 2.4, (i % 4) * 0.7]);
      }
    }
    if (coords.length === 0) return;

    const stackMat = new THREE.MeshStandardMaterial({ color: 0xc2b8a6, roughness: 0.86 });
    const potMat = new THREE.MeshStandardMaterial({ color: 0x9c563a, roughness: 0.78 });
    const stacks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, 2.35, 0.78), stackMat, coords.length);
    const pots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.17, 0.45, 7), potMat, coords.length * 2);
    stacks.castShadow = true;

    let pi = 0;
    coords.forEach(([x, y, z, yaw], idx) => {
      dummy.position.set(x, y + 0.9, z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 0.85 + (idx % 3) * 0.18, 1);
      dummy.updateMatrix();
      stacks.setMatrixAt(idx, dummy.matrix);

      const topY = y + 0.9 + 1.18 * (0.85 + (idx % 3) * 0.18);
      for (const off of [-0.28, 0.28]) {
        dummy.position.set(x + Math.cos(yaw) * off, topY + 0.18, z - Math.sin(yaw) * off);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pots.setMatrixAt(pi++, dummy.matrix);
      }
    });
    lifeGroup.add(stacks, pots);
  }

  // Populate chimneys right after all 107 swissBUILDINGS3D tiles finish streaming (so every single chimney sits flush on real roofs!)
  if (swiss3D?.remainingDone) {
    swiss3D.remainingDone.then(() => populateRealRooftopChimneys());
  } else {
    populateRealRooftopChimneys();
  }

  return { group: lifeGroup };
}
