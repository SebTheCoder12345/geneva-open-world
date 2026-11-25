import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { batchStaticGroup } from './staticBatcher.js';
import {
  PMB_START,
  PMB_END,
  projectPontMontBlanc,
  getGroundHeight,
  getRawWaterMask,
  isOnBridgeOrPier,
} from './cityData.js';

// Living AAA Geneva Streetscape Props (inspired by real Geneva photos + open-world urban density!):
// - 3D Raised Granite Sidewalk Curbs & Road Reflectors
// - Outdoor Geneva Sidewalk Café Terraces (scalloped burgundy/cream umbrellas, tables, chairs, planters, chalkboards)
// - Parked Electric E-Scooters (purple/lime Voi/Lime style along curbs!)
// - Swiss Glass TPG Bus-Stop Shelters & Illuminated Route Totems
// - Blue/Slate Swiss Trash Bins & Steel Bicycle Racks
// - Overhead Swiss Directional Bridge/Boulevard Gantry Signs (PONT DU MONT-BLANC / LAUSANNE / RIVE)
// Every physical prop registers a solid collider in insertCollider!
export function buildGenevaStreetProps(worldGroup, realData, insertCollider, photoBundle = null, streetFeatures = null, registerInteractable = null) {
  const propsGroup = new THREE.Group();
  propsGroup.name = 'Geneva_Street_Props';
  worldGroup.add(propsGroup);
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c222a, roughness: 0.38, metalness: 0.82 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xa4adb8, roughness: 0.28, metalness: 0.88 });

  // Crisp Swiss Ticino Silver-Grey Granite Curb PBR Texture (matching ref_01, ref_03 & ref_06!)
  const curbCan = document.createElement('canvas');
  curbCan.width = 256;
  curbCan.height = 128;
  const cCtx = curbCan.getContext('2d');
  if (photoBundle?.ashlarImg) {
    cCtx.drawImage(photoBundle.ashlarImg, 0, 0, 256, 128);
    cCtx.fillStyle = 'rgba(208, 205, 198, 0.72)';
    cCtx.fillRect(0, 0, 256, 128);
  } else {
    cCtx.fillStyle = '#cfcbc2';
    cCtx.fillRect(0, 0, 256, 128);
  }
  // Fine granite mineral speckle + tight Swiss 1m granite block mortar seams (NO heavy black wall stripe!)
  for (let i = 0; i < 480; i++) {
    cCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.14)' : 'rgba(60,62,66,0.12)';
    cCtx.fillRect((i * 53) % 256, (i * 37) % 128, 2, 2);
  }
  cCtx.fillStyle = 'rgba(72, 70, 66, 0.30)';
  for (let x = 0; x < 256; x += 64) cCtx.fillRect(x, 0, 2, 128);
  const gCurb = cCtx.createLinearGradient(0, 0, 0, 128);
  gCurb.addColorStop(0.0, 'rgba(255, 254, 250, 0.22)');
  gCurb.addColorStop(0.82, 'rgba(0, 0, 0, 0.0)');
  gCurb.addColorStop(1.0, 'rgba(42, 44, 46, 0.16)');
  cCtx.fillStyle = gCurb;
  cCtx.fillRect(0, 0, 256, 128);
  const curbTex = new THREE.CanvasTexture(curbCan);
  curbTex.colorSpace = THREE.SRGBColorSpace;
  curbTex.wrapS = curbTex.wrapT = THREE.RepeatWrapping;
  curbTex.repeat.set(3, 1);

  const curbGraniteMat = new THREE.MeshStandardMaterial({
    map: curbTex,
    normalMap: photoBundle?.ashlarNor || null,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xdad6ce,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 1.15,
  });
  const graniteMat = new THREE.MeshStandardMaterial({ color: 0xc2bbb0, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4528, roughness: 0.78 });
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x2d5e2b, roughness: 0.9 });
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xd92638, roughness: 0.72 });
  const binBlueMat = new THREE.MeshStandardMaterial({ color: 0x1f5c99, roughness: 0.48, metalness: 0.25 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xa8d0e8,
    roughness: 0.06,
    metalness: 0.12,
    transparent: true,
    opacity: 0.44,
    clearcoat: 1.0,
  });

  // Safety guard: guarantee NO sidewalk prop (café terrace, e-scooter, trash bin, bus shelter) EVER spawns in water!
  function snapToDryShore(x, z, pad = 4.0) {
    let tz = z;
    for (let tries = 0; tries < 18; tries++) {
      const wet =
        getRawWaterMask(x, tz) ||
        getRawWaterMask(x + pad, tz) ||
        getRawWaterMask(x - pad, tz) ||
        getRawWaterMask(x, tz + pad) ||
        getRawWaterMask(x, tz - pad);
      if (!wet) return [x, tz];
      // Nudge southward onto dry Rive Gauche pavement (or westward if on Rive Droite)
      tz += z > 0 ? 3.0 : -3.0;
    }
    return null;
  }

  // Universal road-carriageway exclusion helper across ALL vehicular roads so ZERO sidewalk props ever touch asphalt!
  const allVehicleRoadSegs = [];
  for (const r of realData.roads || []) {
    if (!r.p || r.p.length < 2 || r.k === 'pedestrian' || r.k === 'living_street' || r.k === 'service') continue;
    const hw = (r.w || 8.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      allVehicleRoadSegs.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1], hw]);
    }
  }
  function isOnAnyRoad(x, z, pad = 0.4) {
    for (let k = 0; k < allVehicleRoadSegs.length; k++) {
      const [x1, z1, x2, z2, hw] = allVehicleRoadSegs[k];
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

  // 1. TERRAIN-FOLLOWING 3D GRANITE SIDEWALK CURBS + AMBER ROAD REFLECTORS (Zero floating beams or crossing cuts!)
  const primaryRoads = (realData.roads || []).filter((r) => r.p && r.p.length >= 2 && (r.k === 'primary' || r.k === 'trunk'));
  // Collect all primary road segments to skip curb blocks that cut across an intersecting road carriageway!
  const roadSegs = [];
  for (let ri = 0; ri < primaryRoads.length; ri++) {
    const r = primaryRoads[ri];
    const hw = (r.w || 9.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      roadSegs.push({ ri, x1: r.p[i][0], z1: r.p[i][1], x2: r.p[i + 1][0], z2: r.p[i + 1][1], hw });
    }
  }
  function isInsideOtherRoad(x, z, selfRi, pad = 0.55) {
    for (let k = 0; k < roadSegs.length; k++) {
      const s = roadSegs[k];
      if (s.ri === selfRi) continue;
      const m = s.hw + pad;
      if (x < Math.min(s.x1, s.x2) - m || x > Math.max(s.x1, s.x2) + m) continue;
      if (z < Math.min(s.z1, s.z2) - m || z > Math.max(s.z1, s.z2) + m) continue;
      const vx = s.x2 - s.x1, vz = s.z2 - s.z1;
      const len2 = vx * vx + vz * vz;
      if (len2 < 0.1) continue;
      const t = Math.max(0, Math.min(1, ((x - s.x1) * vx + (z - s.z1) * vz) / len2));
      const d = Math.hypot(x - (s.x1 + t * vx), z - (s.z1 + t * vz));
      if (d < m) return true;
    }
    return false;
  }

  const curbPositions = [];
  const reflectorPositions = [];
  for (let ri = 0; ri < primaryRoads.length; ri++) {
    const r = primaryRoads[ri];
    if (r.br) continue; // bridges already have carved stone parapets!
    const halfW = (r.w || 9.0) * 0.5;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const segLen = Math.hypot(dx, dz);
      if (segLen < 6.0) continue;
      const ang = Math.atan2(dx, dz);
      const px = (-dz / segLen) * (halfW + 0.13);
      const pz = (dx / segLen) * (halfW + 0.13);

      // Subdivide into terrain-hugging <=5.5m curb stones that match exact slope with zero floating ends!
      const subs = Math.max(1, Math.ceil(segLen / 5.5));
      const subLen = segLen / subs;
      for (let s = 0; s < subs; s++) {
        const t0 = s / subs;
        const t1 = (s + 1) / subs;
        const ax = x1 + dx * t0, az = z1 + dz * t0;
        const bx = x1 + dx * t1, bz = z1 + dz * t1;
        const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
        if (Math.hypot(mx, mz) > 520) continue;
        if (getRawWaterMask(mx, mz) && !isOnBridgeOrPier(mx, mz)) continue;

        for (const side of [-1, 1]) {
          const sxA = ax + px * side, szA = az + pz * side;
          const sxB = bx + px * side, szB = bz + pz * side;
          const smx = (sxA + sxB) * 0.5, smz = (szA + szB) * 0.5;
          // Check BOTH ends + midpoint so curb bars NEVER cross in an 'X' at sharp intersection islands!
          if (isInsideOtherRoad(smx, smz, ri, 0.55) || isInsideOtherRoad(sxA, szA, ri, 0.45) || isInsideOtherRoad(sxB, szB, ri, 0.45)) continue;
          // Skip procedural curb bars inside Pont du Mont-Blanc deck & abutments (bridge has its own carved granite walkways!)
          const pmbCheck = projectPontMontBlanc(smx, smz);
          if (pmbCheck.t >= -0.05 && pmbCheck.t <= 1.05 && pmbCheck.lat < 16.0) continue;
          const yA = getGroundHeight(sxA, szA) + 0.27;
          const yB = getGroundHeight(sxB, szB) + 0.27;
          if (Math.abs(yB - yA) > 0.55) continue; // skip abrupt bridge/shore ramp edges!
          const pitch = -Math.atan2(yB - yA, subLen);
          // Store exact road-outward unit normal (outX, outZ) so bollards always go onto sidewalks & grates always sit in the road gutter!
          const outX = (-dz / segLen) * side;
          const outZ = (dx / segLen) * side;
          curbPositions.push({ x: smx, y: (yA + yB) * 0.5 + 0.045, z: smz, len: subLen + 0.06, ang, pitch, outX, outZ });
        }

        if (s % 2 === 0 && !isInsideOtherRoad(mx, mz, ri)) {
          reflectorPositions.push([mx, getGroundHeight(mx, mz) + 0.30, mz]);
        }
      }
    }
  }

  if (curbPositions.length > 0) {
    // Sleek low-profile 15cm chamfered Swiss Ticino granite curb (catches pale silver sunlit top bevel cleanly!)
    const cShape = new THREE.Shape();
    cShape.moveTo(-0.13, -0.08);
    cShape.lineTo(0.13, -0.08);
    cShape.lineTo(0.13, 0.045);
    cShape.lineTo(0.085, 0.082);
    cShape.lineTo(-0.085, 0.082);
    cShape.lineTo(-0.13, 0.045);
    cShape.closePath();
    const curbGeo = new THREE.ExtrudeGeometry(cShape, { depth: 1.0, bevelEnabled: false });
    curbGeo.translate(0, 0, -0.5);
    const curbs = new THREE.InstancedMesh(curbGeo, curbGraniteMat, curbPositions.length);
    curbs.castShadow = true;
    curbs.receiveShadow = true;
    const d = new THREE.Object3D();
    d.rotation.order = 'YXZ';
    curbPositions.forEach((c, idx) => {
      d.position.set(c.x, c.y, c.z);
      d.rotation.set(c.pitch, c.ang, 0);
      d.scale.set(1, 1, c.len);
      d.updateMatrix();
      curbs.setMatrixAt(idx, d.matrix);
    });
    propsGroup.add(curbs);

    // 1B. GENEVA HERITAGE GREEN CAST-IRON BOLLARDS ('Bornes de Genève') + RECESSED CURB DRAINAGE GRATES ('Grilles d'égout')!
    const bollardSpots = [];
    const grateSpots = [];
    for (let idx = 0; idx < curbPositions.length; idx++) {
      const c = curbPositions[idx];
      if (Math.hypot(c.x - 10, c.z - 165) > 290) continue;
      // Place cast-iron drainage grates strictly INWARD on the road asphalt gutter (-outX, -outZ)!
      if (idx % 4 === 1) {
        const gx = c.x - c.outX * 0.44;
        const gz = c.z - c.outZ * 0.44;
        grateSpots.push({ x: gx, y: getGroundHeight(gx, gz) + 0.295, z: gz, ang: c.ang });
      }
      // Place dark Geneva green cast-iron bollards strictly OUTWARD onto BOTH left and right sidewalks (+outX, +outZ)!
      if (idx % 2 === 0 && Math.hypot(c.x - 15, c.z - 160) < 220) {
        const bx = c.x + c.outX * 0.58;
        const bz = c.z + c.outZ * 0.58;
        // Keep spawn walk path, purple e-scooter & parked curb Vespa clear
        if (Math.hypot(bx - -10, bz - 148) < 4.5) continue;
        if (Math.hypot(bx - -4.9, bz - 151.9) < 2.2) continue;
        if (Math.hypot(bx - -2.4, bz - 159.4) < 2.2) continue;
        if (!getRawWaterMask(bx, bz)) {
          bollardSpots.push([bx, getGroundHeight(bx, bz) + 0.16, bz]);
        }
      }
    }
    // Append exact real OSM Overpass GPS Geneva bollards
    if (streetFeatures?.bollards?.length) {
      for (const [bx, bz] of streetFeatures.bollards) {
        if (getRawWaterMask(bx, bz) || Math.hypot(bx - -10, bz - 148) < 5.0) continue;
        bollardSpots.push([bx, getGroundHeight(bx, bz) + 0.16, bz]);
      }
    }

    if (bollardSpots.length > 0) {
      const bolParts = [];
      const bBase = new THREE.CylinderGeometry(0.085, 0.105, 0.14, 10);
      bBase.translate(0, 0.07, 0);
      const bShaft = new THREE.CylinderGeometry(0.058, 0.074, 0.72, 10);
      bShaft.translate(0, 0.48, 0);
      const bCollar = new THREE.CylinderGeometry(0.072, 0.072, 0.06, 10);
      bCollar.translate(0, 0.78, 0);
      const bDome = new THREE.SphereGeometry(0.062, 10, 8);
      bDome.translate(0, 0.87, 0);
      bolParts.push(bBase, bShaft, bCollar, bDome);
      const bolGeo = mergeGeometries(bolParts, false);
      bolParts.forEach((g) => g.dispose());

      const genevaGreenBollardMat = new THREE.MeshStandardMaterial({
        color: 0x1c3a2b, // Authentic dark Geneva heritage cast-iron green!
        roughness: 0.38,
        metalness: 0.76,
      });
      const reflBandGeo = new THREE.CylinderGeometry(0.066, 0.066, 0.055, 10);
      reflBandGeo.translate(0, 0.69, 0);
      const reflBandMat = new THREE.MeshStandardMaterial({
        color: 0xeaf0f5,
        emissive: 0xd8e8ff,
        emissiveIntensity: 0.25,
        roughness: 0.22,
        metalness: 0.6,
      });
      const bolMesh = new THREE.InstancedMesh(bolGeo, genevaGreenBollardMat, bollardSpots.length);
      const bolBands = new THREE.InstancedMesh(reflBandGeo, reflBandMat, bollardSpots.length);
      bolMesh.castShadow = true;
      bolMesh.receiveShadow = true;
      bollardSpots.forEach(([bx, by, bz], idx) => {
        d.position.set(bx, by, bz);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        bolMesh.setMatrixAt(idx, d.matrix);
        bolBands.setMatrixAt(idx, d.matrix);
        insertCollider({ kind: 'cyl', x: bx, z: bz, r: 0.14, maxY: by + 0.95, walkableTop: true });
      });
      propsGroup.add(bolMesh, bolBands);
    }

    if (grateSpots.length > 0) {
      const grCan = document.createElement('canvas');
      grCan.width = 64;
      grCan.height = 128;
      const gCtx = grCan.getContext('2d');
      gCtx.fillStyle = '#2d3136';
      gCtx.fillRect(0, 0, 64, 128);
      gCtx.fillStyle = '#090b0d';
      for (let y = 10; y < 118; y += 14) gCtx.fillRect(8, y, 48, 7);
      const grTex = new THREE.CanvasTexture(grCan);
      grTex.colorSpace = THREE.SRGBColorSpace;
      const grMat = new THREE.MeshStandardMaterial({
        map: grTex,
        roughness: 0.52,
        metalness: 0.78,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5,
      });
      const grGeo = new THREE.PlaneGeometry(0.42, 0.78).rotateX(-Math.PI / 2);
      const grMesh = new THREE.InstancedMesh(grGeo, grMat, grateSpots.length);
      grateSpots.forEach((g, idx) => {
        d.position.set(g.x, g.y, g.z);
        d.rotation.set(0, g.ang, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        grMesh.setMatrixAt(idx, d.matrix);
      });
      propsGroup.add(grMesh);
    }
  }

  // 1C. AUTHENTIC CIRCULAR CAST-IRON 'SIG · GENÈVE' MANHOLE COVERS embedded flush in central Geneva asphalt!
  {
    const mhCan = document.createElement('canvas');
    mhCan.width = 128;
    mhCan.height = 128;
    const mCtx = mhCan.getContext('2d');
    mCtx.fillStyle = '#2a2e33';
    mCtx.beginPath();
    mCtx.arc(64, 64, 62, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.strokeStyle = '#525860';
    mCtx.lineWidth = 6;
    mCtx.stroke();
    mCtx.strokeStyle = '#181a1d';
    mCtx.lineWidth = 3;
    mCtx.beginPath();
    mCtx.arc(64, 64, 48, 0, Math.PI * 2);
    mCtx.stroke();
    for (let a = 0; a < 12; a++) {
      const ang = (a / 12) * Math.PI * 2;
      mCtx.beginPath();
      mCtx.moveTo(64 + Math.cos(ang) * 26, 64 + Math.sin(ang) * 26);
      mCtx.lineTo(64 + Math.cos(ang) * 48, 64 + Math.sin(ang) * 48);
      mCtx.stroke();
    }
    mCtx.fillStyle = '#757c84';
    mCtx.font = 'bold 18px sans-serif';
    mCtx.textAlign = 'center';
    mCtx.fillText('SIG', 64, 62);
    mCtx.font = 'bold 10px sans-serif';
    mCtx.fillText('GENÈVE', 64, 76);
    const mhTex = new THREE.CanvasTexture(mhCan);
    mhTex.colorSpace = THREE.SRGBColorSpace;
    const mhMat = new THREE.MeshStandardMaterial({
      map: mhTex,
      roughness: 0.48,
      metalness: 0.82,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
    });
    const mhCoords = [
      [-1, 149], [9, 154], [24, 164], [46, 178], [-28, 138], [-58, 152],
      [-92, 165], [-134, -128], [-98, -192], [78, 194], [118, 212],
    ];
    const mhGeo = new THREE.CircleGeometry(0.42, 18).rotateX(-Math.PI / 2);
    const mhMesh = new THREE.InstancedMesh(mhGeo, mhMat, mhCoords.length);
    const md = new THREE.Object3D();
    mhCoords.forEach(([mx, mz], idx) => {
      md.position.set(mx, getGroundHeight(mx, mz) + 0.30, mz);
      md.rotation.set(0, idx * 0.9, 0);
      md.updateMatrix();
      mhMesh.setMatrixAt(idx, md.matrix);
    });
    propsGroup.add(mhMesh);
  }

  // 1D. AUTHENTIC SWISS BLUE/WHITE PEDESTRIAN CROSSING SIGNS (Signal 4.11: Blue Square + White Triangle + Black Walker!)
  {
    const psCan = document.createElement('canvas');
    psCan.width = 128;
    psCan.height = 128;
    const pCtx = psCan.getContext('2d');
    pCtx.fillStyle = '#0055a5'; // Swiss Federal Highway Blue
    pCtx.fillRect(0, 0, 128, 128);
    pCtx.strokeStyle = '#ffffff';
    pCtx.lineWidth = 6;
    pCtx.strokeRect(5, 5, 118, 118);
    // White triangle inside blue square
    pCtx.fillStyle = '#ffffff';
    pCtx.beginPath();
    pCtx.moveTo(64, 18);
    pCtx.lineTo(110, 106);
    pCtx.lineTo(18, 106);
    pCtx.closePath();
    pCtx.fill();
    // Black crosswalk stripes & walking pedestrian icon
    pCtx.fillStyle = '#111418';
    for (let sx = 34; sx <= 86; sx += 13) pCtx.fillRect(sx, 93, 7, 10);
    pCtx.beginPath();
    pCtx.arc(64, 48, 7, 0, Math.PI * 2); // head
    pCtx.fill();
    pCtx.lineWidth = 5;
    pCtx.strokeStyle = '#111418';
    pCtx.beginPath();
    pCtx.moveTo(64, 55); pCtx.lineTo(62, 74); // torso
    pCtx.moveTo(63, 60); pCtx.lineTo(52, 71); // left arm
    pCtx.moveTo(63, 60); pCtx.lineTo(75, 68); // right arm
    pCtx.moveTo(62, 74); pCtx.lineTo(54, 91); // left leg
    pCtx.moveTo(62, 74); pCtx.lineTo(72, 91); // right leg
    pCtx.stroke();

    const psTex = new THREE.CanvasTexture(psCan);
    psTex.colorSpace = THREE.SRGBColorSpace;
    const psMat = new THREE.MeshStandardMaterial({ map: psTex, roughness: 0.34, metalness: 0.25 });
    // Instanced Swiss Signal 4.11 Pedestrian Crossing Signs strictly on DRY sidewalks (ZERO signs inside road lanes!)
    const pedSignSpots = [
      [3.5, 166.5, 1.05],  // right granite sidewalk facing spawn camera cleanly by Quai du Général-Guisan!
      [27, 158, 1.05],     // Jardin Anglais promenade crossing
      [-14.5, 121.5, 1.05],// near Pont du Mont-Blanc sidewalk
      [-158, -104, 1.05],
      [-70, 228, 1.82],
    ].filter(([px, pz]) => !isOnAnyRoad(px, pz, 0.35) && !getRawWaterMask(px, pz));
    const pPoleGeo = new THREE.CylinderGeometry(0.036, 0.04, 2.85, 8);
    pPoleGeo.translate(0, 1.42, 0);
    const pPlateGeo = new THREE.BoxGeometry(0.64, 0.64, 0.04);
    pPlateGeo.translate(0, 2.64, 0);
    const pPoles = new THREE.InstancedMesh(pPoleGeo, steelMat, pedSignSpots.length);
    const pPlates = new THREE.InstancedMesh(
      pPlateGeo,
      [steelMat, steelMat, steelMat, steelMat, psMat, psMat],
      pedSignSpots.length
    );
    pPoles.castShadow = true;
    pPlates.castShadow = true;
    const sd = new THREE.Object3D();
    pedSignSpots.forEach(([px, pz, pyaw], idx) => {
      const py = getGroundHeight(px, pz) + 0.16;
      sd.position.set(px, py, pz);
      sd.rotation.set(0, pyaw, 0);
      sd.scale.set(1, 1, 1);
      sd.updateMatrix();
      pPoles.setMatrixAt(idx, sd.matrix);
      pPlates.setMatrixAt(idx, sd.matrix);
      insertCollider({ kind: 'cyl', x: px, z: pz, r: 0.12, maxY: py + 2.9, walkableTop: false });
    });
    propsGroup.add(pPoles, pPlates);
  }

  if (reflectorPositions.length > 0) {
    const refMat = new THREE.MeshStandardMaterial({
      color: 0xffc83d,
      emissive: 0xffae19,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    const refGeo = new THREE.BoxGeometry(0.14, 0.04, 0.18);
    const refs = new THREE.InstancedMesh(refGeo, refMat, reflectorPositions.length);
    const d = new THREE.Object3D();
    reflectorPositions.forEach(([x, y, z], idx) => {
      d.position.set(x, y, z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      refs.setMatrixAt(idx, d.matrix);
    });
    propsGroup.add(refs);
  }

  // 2. OUTDOOR GENEVA SIDEWALK CAFÉ TERRACES (Burgundy/Cream Scalloped Umbrellas, Bistro Tables, Planters & Chalkboards!)
  const umbrellaBurgundy = new THREE.MeshStandardMaterial({ color: 0x8c1f2e, roughness: 0.78, side: THREE.DoubleSide });
  const umbrellaCream = new THREE.MeshStandardMaterial({ color: 0xeae2d2, roughness: 0.8, side: THREE.DoubleSide });
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e8, roughness: 0.35 });

  // Chalkboard menu A-frame texture
  const mCan = document.createElement('canvas');
  mCan.width = 128;
  mCan.height = 192;
  const mCtx = mCan.getContext('2d');
  mCtx.fillStyle = '#1b1f24';
  mCtx.fillRect(0, 0, 128, 192);
  mCtx.strokeStyle = '#7a5434';
  mCtx.lineWidth = 10;
  mCtx.strokeRect(5, 5, 118, 182);
  mCtx.fillStyle = '#f5ecd8';
  mCtx.font = 'bold 18px Georgia, serif';
  mCtx.textAlign = 'center';
  mCtx.fillText('CAFÉ', 64, 46);
  mCtx.fillText('DU LAC', 64, 68);
  mCtx.fillStyle = '#ffd27a';
  mCtx.font = '13px sans-serif';
  mCtx.fillText('ESPRESSO  4.50', 64, 108);
  mCtx.fillText('FONDUE   28.-', 64, 132);
  mCtx.fillText('CROISSANT 3.20', 64, 156);
  const menuMat = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(mCan), roughness: 0.85 });

  function addCafeTerrace(rawX, rawZ, yaw, umbrellas = 3, cream = false) {
    const dry = snapToDryShore(rawX, rawZ, 5.5);
    if (!dry) return;
    const [cx, cz] = dry;
    if (isOnAnyRoad(cx, cz, 1.8)) return;
    const cy = getGroundHeight(cx, cz) + 0.16;
    const g = new THREE.Group();
    g.position.set(cx, cy, cz);
    g.rotation.y = yaw;
    const uMat = cream ? umbrellaCream : umbrellaBurgundy;

    for (let i = 0; i < umbrellas; i++) {
      const tz = (i - (umbrellas - 1) * 0.5) * 3.4;
      // Bistro pedestal table + 2 chairs
      const tablePole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.74, 8), darkMetal);
      tablePole.position.set(0, 0.37, tz);
      const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.05, 14), tableTopMat);
      tableTop.position.set(0, 0.75, tz);
      tableTop.castShadow = true;
      g.add(tablePole, tableTop);

      for (const side of [-0.72, 0.72]) {
        const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), woodMat);
        chairSeat.position.set(side, 0.46, tz);
        const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.44, 0.4), woodMat);
        chairBack.position.set(side + (side > 0 ? 0.19 : -0.19), 0.68, tz);
        const chairLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.46, 6), darkMetal);
        chairLeg.position.set(side, 0.23, tz);
        g.add(chairSeat, chairBack, chairLeg);
      }

      // Large European café umbrella casting rich street shadows!
      const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 2.55, 8), woodMat);
      uPole.position.set(0, 1.3, tz);
      const uCanopy = new THREE.Mesh(new THREE.ConeGeometry(1.68, 0.58, 8), uMat);
      uCanopy.position.set(0, 2.58, tz);
      uCanopy.castShadow = true;
      uCanopy.receiveShadow = true;
      g.add(uPole, uCanopy);

      // Concrete planter box framing the street side of the terrace
      const planter = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 1.65), graniteMat);
      planter.position.set(1.45, 0.28, tz);
      planter.castShadow = true;
      const bush = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 1.48), bushMat);
      bush.position.set(1.45, 0.68, tz);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), flowerMat);
      bloom.position.set(1.45, 0.88, tz);
      g.add(planter, bush, bloom);
    }

    // Wooden sidewalk A-frame chalkboard menu sign
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.08), menuMat);
    board.position.set(1.55, 0.48, umbrellas * 1.7 + 0.5);
    board.rotation.y = 0.35;
    board.castShadow = true;
    g.add(board);

    propsGroup.add(g);
    // Solid OBB collider for terrace planters & tables!
    insertCollider({
      kind: 'obb',
      x: cx,
      z: cz,
      yaw,
      halfW: 1.65,
      halfL: umbrellas * 1.75,
      maxY: cy + 2.8,
      walkableTop: false,
    });

    // Register open-sidewalk café chairs & chalkboard menu as interactive Geneva café spots!
    if (registerInteractable) {
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      for (let i = 0; i < umbrellas; i++) {
        const tz = (i - (umbrellas - 1) * 0.5) * 3.4;
        // Open sidewalk side (side = -0.72) faces +X toward the bistro table; exits cleanly at local x = -2.25!
        const lx = -0.72;
        const chairX = cx + cosY * lx + sinY * tz;
        const chairZ = cz - sinY * lx + cosY * tz;
        const exitLx = -2.25;
        const exitX = cx + cosY * exitLx + sinY * tz;
        const exitZ = cz - sinY * exitLx + cosY * tz;
        registerInteractable({
          id: `terrace_chair_${Math.round(cx)}_${Math.round(cz)}_${i}`,
          type: 'cafe_chair',
          label: 'SIT AT CAFÉ · ESPRESSO',
          activeLabel: 'STAND UP',
          subtitle: 'Sipping a Geneva espresso on the lakeside terrace… (E or WASD to stand)',
          toast: 'CAFÉ DU LAC · ESPRESSO',
          x: chairX,
          y: cy,
          z: chairZ,
          yaw: yaw + Math.PI * 0.5,
          exitX,
          exitZ,
          persistent: true,
          radius: 2.7,
          priority: 1.15,
        });
      }
      // Sidewalk chalkboard menu board
      const bLx = 1.55, bLz = umbrellas * 1.7 + 0.5;
      const bx = cx + cosY * bLx + sinY * bLz;
      const bz = cz - sinY * bLx + cosY * bLz;
      registerInteractable({
        id: `cafe_menu_${Math.round(cx)}_${Math.round(cz)}`,
        type: 'sign_read',
        label: 'READ CAFÉ MENU',
        subtitle: 'CAFÉ DU LAC · Espresso CHF 4.50 · Croissant CHF 3.20 · Fondue Moitié-Moitié CHF 28.–',
        toast: 'CAFÉ DU LAC · GENÈVE',
        x: bx,
        y: cy,
        z: bz,
        rimRadius: 0.95,
        persistent: false,
        duration: 2.2,
        radius: 2.2,
        priority: 0.5,
      });
    }
  }

  // Place real-Geneva inspired outdoor café terraces strictly on DRY sidewalks clear of all roads!
  addCafeTerrace(24, 146, -0.45, 3, false);   // Jardin Anglais lakeside promenade café (visible right from spawn!)
  addCafeTerrace(-48, 162, -0.35, 3, true);   // Quai du Général-Guisan / Molard corner terrace
  addCafeTerrace(-104, 154, -0.12, 3, false); // Genève-Molard dry stone promenade terrace
  addCafeTerrace(-158, -142, 0.78, 3, false); // Quai du Mont-Blanc grand hotel promenade terrace
  addCafeTerrace(-102, -212, 0.78, 3, true);  // Quai du Mont-Blanc mid-promenade terrace

  // 3. ELECTRIC E-SCOOTERS ('Trottinettes') are now 100% ridable vehicles spawned in vehicles.js / cityData.js!

  // 4. SWISS GLASS TPG BUS-STOP SHELTERS & TOTEMS + BLUE SWISS STREET TRASH BINS!
  function createTpgSignTex(stopName) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f26522';
    ctx.fillRect(0, 0, 256, 44);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Helvetica Neue", sans-serif';
    ctx.fillText('tpg  BUS', 16, 31);
    ctx.fillStyle = '#141922';
    ctx.fillRect(0, 44, 256, 84);
    ctx.fillStyle = '#ffd27a';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(stopName, 14, 84);
    ctx.fillStyle = '#a8c2dc';
    ctx.font = '15px sans-serif';
    ctx.fillText('LIGNES  6 · 8 · 10 · 25', 14, 112);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const busStops = [
    { x: 56, z: 190, yaw: -0.45, name: 'JARDIN ANGLAIS' },
    { x: -134, z: -156, yaw: 2.35, name: 'QUAI MONT-BLANC' },
    { x: -72, z: 162, yaw: -0.22, name: 'MOLARD' },
  ].filter((bs) => !isOnAnyRoad(bs.x, bs.z, 1.4));
  for (const bs of busStops) {
    const by = getGroundHeight(bs.x, bs.z) + 0.16;
    const sh = new THREE.Group();
    sh.position.set(bs.x, by, bs.z);
    sh.rotation.y = bs.yaw;

    // Modern Swiss dark-steel & panoramic glass shelter
    for (const px of [-2.1, 0, 2.1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.65, 0.12), darkMetal);
      col.position.set(px, 1.32, -0.7);
      col.castShadow = true;
      sh.add(col);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.12, 1.95), darkMetal);
    roof.position.set(0, 2.68, 0.05);
    roof.castShadow = true;
    const backGlass = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.35, 0.06), glassMat);
    backGlass.position.set(0, 1.3, -0.7);
    const adPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 2.15, 1.45),
      new THREE.MeshBasicMaterial({ map: createTpgSignTex(bs.name) })
    );
    adPanel.position.set(2.15, 1.32, 0.0);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.08, 0.45), woodMat);
    bench.position.set(-0.4, 0.5, -0.38);
    // Tall TPG transit totem pole beside shelter (like Reference 1's blue bus stop sign!)
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.3, 8), steelMat);
    pole.position.set(-2.65, 1.65, 0.4);
    const signBox = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.42, 0.1), new THREE.MeshBasicMaterial({ map: createTpgSignTex(bs.name) }));
    signBox.position.set(-2.65, 3.05, 0.4);

    sh.add(roof, backGlass, adPanel, bench, pole, signBox);
    propsGroup.add(sh);
    insertCollider({ kind: 'obb', x: bs.x, z: bs.z, yaw: bs.yaw, halfW: 2.4, halfL: 0.95, maxY: by + 2.8, walkableTop: true });
    if (registerInteractable) {
      const cosY = Math.cos(bs.yaw), sinY = Math.sin(bs.yaw);
      const bLx = -0.4, bLz = -0.34;
      const bx = bs.x + cosY * bLx + sinY * bLz;
      const bz = bs.z - sinY * bLx + cosY * bLz;
      const ex = bs.x + cosY * bLx + sinY * 1.48;
      const ez = bs.z - sinY * bLx + cosY * 1.48;
      registerInteractable({
        id: `shelter_bench_${bs.name}`,
        type: 'shelter_bench',
        label: `WAIT AT TPG · ${bs.name}`,
        activeLabel: 'STAND UP',
        subtitle: `Waiting at TPG ${bs.name} · Next bus in 2 min… (E or WASD to stand)`,
        toast: `TPG STOP · ${bs.name}`,
        x: bx,
        y: by,
        z: bz,
        yaw: bs.yaw,
        benchWidth: 1.5,
        seatLocalZ: 0.06,
        exitX: ex,
        exitZ: ez,
        persistent: true,
        radius: 3.1,
        priority: 1.1,
      });
    }
  }

  // Instanced Authentic Geneva Municipal Rectangular Dark-Green Litter Bins ('Ville de Genève', merged with 53 real GPS OSM bins — 2 draw calls total!)
  const genevaBinMat = new THREE.MeshStandardMaterial({ color: 0x1e382b, roughness: 0.42, metalness: 0.58 });
  const binCoords = [
    [-6, 137], [28, 154], [64, 186], [-36, 148], [-98, 152],
    [-142, -138], [-88, -212], [116, 198], [156, 212], [2.5, 164.8], // cleanly UP on the right granite sidewalk!
  ];
  if (streetFeatures?.wasteBaskets?.length) {
    for (const [bx, bz] of streetFeatures.wasteBaskets) {
      if (getRawWaterMask(bx, bz) || isInsideOtherRoad(bx, bz, -1)) continue;
      if (Math.hypot(bx - -10, bz - 148) < 8) continue;
      if (binCoords.some(([ox, oz]) => Math.hypot(ox - bx, oz - bz) < 5.5)) continue;
      binCoords.push([bx, bz]);
    }
  }
  const validBins = [];
  for (const [rx, rz] of binCoords) {
    const dry = snapToDryShore(rx, rz, 2.2);
    if (dry) validBins.push(dry);
  }
  if (validBins.length > 0) {
    const binGreenParts = [];
    const bBody = new THREE.BoxGeometry(0.46, 0.72, 0.36); bBody.translate(0, 0.56, 0);
    const bHood = new THREE.BoxGeometry(0.52, 0.08, 0.42); bHood.translate(0, 0.96, 0);
    binGreenParts.push(bBody, bHood);
    const binGreenGeo = mergeGeometries(binGreenParts, false);
    binGreenParts.forEach((g) => g.dispose());

    const binDarkParts = [];
    const bPost = new THREE.BoxGeometry(0.12, 0.26, 0.12); bPost.translate(0, 0.13, 0);
    const bSlot = new THREE.BoxGeometry(0.34, 0.14, 0.38); bSlot.translate(0, 0.80, 0);
    binDarkParts.push(bPost, bSlot);
    const binDarkGeo = mergeGeometries(binDarkParts, false);
    binDarkParts.forEach((g) => g.dispose());

    const binGreenMesh = new THREE.InstancedMesh(binGreenGeo, genevaBinMat, validBins.length);
    const binDarkMesh = new THREE.InstancedMesh(binDarkGeo, darkMetal, validBins.length);
    binGreenMesh.castShadow = true;
    const bd = new THREE.Object3D();
    validBins.forEach(([bx, bz], idx) => {
      const by = getGroundHeight(bx, bz) + 0.16;
      bd.position.set(bx, by, bz);
      bd.rotation.set(0, -0.52, 0);
      bd.scale.set(1, 1, 1);
      bd.updateMatrix();
      binGreenMesh.setMatrixAt(idx, bd.matrix);
      binDarkMesh.setMatrixAt(idx, bd.matrix);
      insertCollider({ kind: 'cyl', x: bx, z: bz, r: 0.30, maxY: by + 1.02, walkableTop: false });
      if (registerInteractable) {
        registerInteractable({
          id: `bin_${idx}`,
          type: 'bin',
          label: 'TOSS LITTER (+CHF 10)',
          subtitle: 'Keeping Geneva spotless! +CHF 10 civic bonus.',
          toast: 'VILLE DE GENÈVE · +CHF 10',
          x: bx,
          y: by,
          z: bz,
          rimRadius: 0.85,
          persistent: false,
          duration: 1.45,
          rewardCash: 10,
          radius: 2.0,
          priority: 0.45,
        });
      }
    });
    propsGroup.add(binGreenMesh, binDarkMesh);
  }

  // 5. OVERHEAD SWISS GREEN & BLUE DIRECTIONAL GANTRY SIGNS (Pont du Mont-Blanc & Quai du Général-Guisan — Reference 2 & 5!)
  function createSwissGantry(x, z, yaw, width, leftLine, rightLine) {
    const gy = getGroundHeight(x, z);
    const gg = new THREE.Group();
    gg.position.set(x, gy, z);
    gg.rotation.y = yaw;

    for (const sx of [-width * 0.5, width * 0.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6.8, 10), steelMat);
      post.position.set(sx, 3.4, 0);
      post.castShadow = true;
      gg.add(post);
      const wx = x + Math.cos(yaw) * sx;
      const wz = z - Math.sin(yaw) * sx;
      insertCollider({ kind: 'cyl', x: wx, z: wz, r: 0.24, maxY: gy + 6.8, walkableTop: false });
    }
    const truss = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.34, 0.34), steelMat);
    truss.position.set(0, 6.45, 0);
    gg.add(truss);

    // Authentic Swiss National Highway Green (#007a3d) & Canton Blue (#0055a5) Illuminated Sign Boards!
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#007a3d';
    ctx.fillRect(0, 0, 250, 128);
    ctx.fillStyle = '#0055a5';
    ctx.fillRect(262, 0, 250, 128);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 238, 116);
    ctx.strokeRect(268, 6, 238, 116);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(leftLine, 125, 58);
    ctx.fillText('▲   A1', 125, 100);
    ctx.fillText(rightLine, 387, 58);
    ctx.fillText('GENÈVE CENTRE', 387, 100);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const signMat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.28,
      roughness: 0.4,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(width * 0.64, 1.55, 0.14), signMat);
    board.position.set(0, 6.3, 0.22);
    gg.add(board);

    worldGroup.add(gg);
  }

  // Place iconic Swiss directional gantry cleanly spanning OUTSIDE Pont du Mont-Blanc parapets (ZERO poles in traffic lanes!)
  {
    const pmbDx = PMB_END.x - PMB_START.x;
    const pmbDz = PMB_END.z - PMB_START.z;
    const pmbAng = Math.atan2(pmbDx, pmbDz);
    const gx = PMB_START.x + pmbDx * 0.10;
    const gz = PMB_START.z + pmbDz * 0.10;
    // Span 23.4m across the full 24m Pont du Mont-Blanc deck so legs bolt squarely onto the outer granite balustrade piers!
    createSwissGantry(gx, gz, pmbAng + Math.PI, 23.4, 'LAUSANNE', 'AÉROPORT');
  }

  // 6. AUTHENTIC GENEVA WHITE/ORANGE TPG STOP TOTEM PILLARS (matches ref_03 & ref_06_place_du_molard.jpg — driven by real GPS busStops!)
  {
    const totCan = document.createElement('canvas');
    totCan.width = 128;
    totCan.height = 384;
    const tCtx = totCan.getContext('2d');
    tCtx.fillStyle = '#eceef0';
    tCtx.fillRect(0, 0, 128, 384);
    // Iconic Geneva TPG Orange top banner
    tCtx.fillStyle = '#eb5e1c';
    tCtx.fillRect(0, 0, 128, 42);
    tCtx.fillStyle = '#ffffff';
    tCtx.font = 'bold 24px "Helvetica Neue", Arial, sans-serif';
    tCtx.fillText('tpg', 14, 29);
    // Stop name block
    tCtx.fillStyle = '#1c222a';
    tCtx.font = 'bold 17px "Helvetica Neue", Arial, sans-serif';
    tCtx.fillText('Jardin Anglais', 10, 68);
    // Colored Geneva circular transit line badges (2, 6, 8, 10, 25 — ref_06!)
    const badges = [
      ['2', '#6fa832'],
      ['6', '#0077b6'],
      ['8', '#1f7a4c'],
      ['10', '#d97706'],
      ['25', '#d44292'],
    ];
    badges.forEach(([num, col], i) => {
      const by = 92 + i * 32;
      tCtx.fillStyle = col;
      tCtx.beginPath();
      tCtx.arc(24, by, 12, 0, Math.PI * 2);
      tCtx.fill();
      tCtx.fillStyle = '#ffffff';
      tCtx.font = 'bold 13px sans-serif';
      tCtx.textAlign = 'center';
      tCtx.fillText(num, 24, by + 4);
      tCtx.fillStyle = '#2d343e';
      tCtx.font = '11px sans-serif';
      tCtx.textAlign = 'left';
      tCtx.fillText(['Rive · Eaux-Vives', 'Vernier · Plage', 'Veyrier · OMS', 'Aéroport · Rive', 'Jardin Botanique'][i], 42, by + 4);
    });
    // Bottom Geneva transit map schematic panel
    tCtx.fillStyle = '#d4e4f0';
    tCtx.fillRect(10, 252, 108, 108);
    tCtx.strokeStyle = '#eb5e1c';
    tCtx.lineWidth = 3;
    tCtx.beginPath();
    tCtx.moveTo(16, 336); tCtx.lineTo(54, 296); tCtx.lineTo(112, 268);
    tCtx.stroke();
    tCtx.strokeStyle = '#2563eb';
    tCtx.beginPath();
    tCtx.moveTo(22, 266); tCtx.lineTo(66, 304); tCtx.lineTo(106, 344);
    tCtx.stroke();

    const totTex = new THREE.CanvasTexture(totCan);
    totTex.colorSpace = THREE.SRGBColorSpace;
    const totFaceMat = new THREE.MeshStandardMaterial({ map: totTex, roughness: 0.36, metalness: 0.14 });
    const totSideMat = new THREE.MeshStandardMaterial({ color: 0xc8cfd6, roughness: 0.32, metalness: 0.72 });

    const totemSpots = [
      [8.2, 173.4, 1.05],  // right granite sidewalk along Quai du Général-Guisan (strictly clear of road!)
      [38, 152, -0.52],    // Jardin Anglais lakeside stop
    ];
    if (streetFeatures?.busStops?.length) {
      for (const bs of streetFeatures.busStops) {
        if (getRawWaterMask(bs.x, bs.z) || isOnAnyRoad(bs.x, bs.z, 0.45)) continue;
        if (totemSpots.some(([ox, oz]) => Math.hypot(ox - bs.x, oz - bs.z) < 18)) continue;
        totemSpots.push([bs.x, bs.z, 1.05]);
      }
    }
    const validTotems = totemSpots.filter(([tx, tz]) => !isOnAnyRoad(tx, tz, 0.35) && !getRawWaterMask(tx, tz));
    const totGeo = new THREE.BoxGeometry(0.64, 2.38, 0.14);
    totGeo.translate(0, 1.19, 0);
    const totMesh = new THREE.InstancedMesh(
      totGeo,
      [totSideMat, totSideMat, totSideMat, totSideMat, totFaceMat, totFaceMat],
      validTotems.length
    );
    totMesh.castShadow = true;
    const td = new THREE.Object3D();
    validTotems.forEach(([tx, tz, tyaw], idx) => {
      const ty = getGroundHeight(tx, tz) + 0.16;
      td.position.set(tx, ty, tz);
      td.rotation.set(0, tyaw, 0);
      td.scale.set(1, 1, 1);
      td.updateMatrix();
      totMesh.setMatrixAt(idx, td.matrix);
      insertCollider({ kind: 'cyl', x: tx, z: tz, r: 0.34, maxY: ty + 2.4, walkableTop: false });
      if (registerInteractable) {
        registerInteractable({
          id: `totem_${idx}`,
          type: 'sign_read',
          label: 'CHECK TPG SCHEDULE',
          subtitle: 'tpg Live · Tram 12 Moillesulaz: 2 min · Bus 6 Vernier: 4 min · Bus 8 Veyrier: 6 min',
          toast: 'TPG LIVE DEPARTURES',
          x: tx,
          y: ty,
          z: tz,
          rimRadius: 0.92,
          persistent: false,
          duration: 2.2,
          radius: 2.2,
          priority: 0.6,
        });
      }
    });
    if (validTotems.length > 0) propsGroup.add(totMesh);
  }

  // 7. GENEVA BOULEVARD OVERHEAD SUSPENDED CIRCULAR DOME STREETLAMPS & BRUSHED-STEEL SPAN POLES (auto-snapped to exact Quai & Rue du Rhône curbs!)
  {
    const spanSpecs = [];
    for (let idx = 0; idx < curbPositions.length; idx += 7) {
      const c = curbPositions[idx];
      if (Math.hypot(c.x - 15, c.z - 175) > 220) continue;
      const ax = c.x + c.outX * 1.05;
      const az = c.z + c.outZ * 1.05;
      // Opposite curb across the 13m carriageway
      const bx = c.x - c.outX * 14.3;
      const bz = c.z - c.outZ * 14.3;
      if (isOnAnyRoad(ax, az, 0.25) || isOnAnyRoad(bx, bz, 0.25)) continue;
      if (getRawWaterMask(ax, az) || getRawWaterMask(bx, bz)) continue;
      if (Math.hypot(ax - -10, az - 148) < 9 || Math.hypot(bx - -10, bz - 148) < 9) continue;
      const mx = (ax + bx) * 0.5, mz = (az + bz) * 0.5;
      if (spanSpecs.some((s) => Math.hypot((s.ax + s.bx) * 0.5 - mx, (s.az + s.bz) * 0.5 - mz) < 26)) continue;
      spanSpecs.push({ ax, az, bx, bz });
      if (spanSpecs.length >= 14) break;
    }
    if (spanSpecs.length > 0) {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.32, metalness: 0.78 });
      const wireMat = new THREE.MeshBasicMaterial({ color: 0x20252c });
      const domeMat = new THREE.MeshStandardMaterial({ color: 0x2e343c, roughness: 0.42, metalness: 0.65 });
      const lampGlowMat = new THREE.MeshStandardMaterial({
        color: 0xfff6e0,
        emissive: 0xffc86b,
        emissiveIntensity: 0.45,
        roughness: 0.15,
      });

      const poleGeo = new THREE.CylinderGeometry(0.085, 0.135, 7.6, 10);
      poleGeo.translate(0, 3.8, 0);
      const cableGeo = new THREE.BoxGeometry(0.028, 0.028, 1.0);
      const domeGeo = new THREE.CylinderGeometry(0.14, 0.36, 0.18, 12);
      const bulbGeo = new THREE.SphereGeometry(0.16, 10, 8);

      const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, spanSpecs.length * 2);
      const wireInst = new THREE.InstancedMesh(cableGeo, wireMat, spanSpecs.length * 2);
      const domeInst = new THREE.InstancedMesh(domeGeo, domeMat, spanSpecs.length);
      const bulbInst = new THREE.InstancedMesh(bulbGeo, lampGlowMat, spanSpecs.length);
      poleInst.castShadow = true;

      const sd = new THREE.Object3D();
      spanSpecs.forEach((sp, i) => {
        const ya = getGroundHeight(sp.ax, sp.az);
        const yb = getGroundHeight(sp.bx, sp.bz);
        sd.position.set(sp.ax, ya, sp.az);
        sd.rotation.set(0, 0, 0);
        sd.scale.set(1, 1, 1);
        sd.updateMatrix();
        poleInst.setMatrixAt(i * 2, sd.matrix);
        insertCollider({ kind: 'cyl', x: sp.ax, z: sp.az, r: 0.16, maxY: ya + 7.5, walkableTop: false });

        sd.position.set(sp.bx, yb, sp.bz);
        sd.updateMatrix();
        poleInst.setMatrixAt(i * 2 + 1, sd.matrix);
        insertCollider({ kind: 'cyl', x: sp.bx, z: sp.bz, r: 0.16, maxY: yb + 7.5, walkableTop: false });

        const dx = sp.bx - sp.ax, dz = sp.bz - sp.az;
        const len = Math.hypot(dx, dz);
        const ang = Math.atan2(dx, dz);
        const mx = (sp.ax + sp.bx) * 0.5;
        const mz = (sp.az + sp.bz) * 0.5;
        const my = (ya + yb) * 0.5 + 6.95;

        sd.position.set(mx, my, mz);
        sd.rotation.set(0, ang, 0);
        sd.scale.set(1, 1, len);
        sd.updateMatrix();
        wireInst.setMatrixAt(i * 2, sd.matrix);

        sd.position.set(mx, my - 0.55, mz);
        sd.updateMatrix();
        wireInst.setMatrixAt(i * 2 + 1, sd.matrix);

        sd.position.set(mx, my - 0.14, mz);
        sd.rotation.set(0, 0, 0);
        sd.scale.set(1, 1, 1);
        sd.updateMatrix();
        domeInst.setMatrixAt(i, sd.matrix);

        sd.position.set(mx, my - 0.28, mz);
        sd.updateMatrix();
        bulbInst.setMatrixAt(i, sd.matrix);
      });
      propsGroup.add(poleInst, wireInst, domeInst, bulbInst);
    }
  }

  // 8. REAL GPS EMBEDDED TWIN TPG TRAM TRACKS WITH BASALT COBBLESTONE INFILL STRIPS + CATENARY (matches ref_05_rues_basses_tram.jpg!)
  if (streetFeatures?.tramTracks?.length) {
    const cobInfill = [];
    const steelRails = [];
    const catWires = [];
    for (const tr of streetFeatures.tramTracks) {
      const pts = tr.p || [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[i + 1];
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.hypot(dx, dz);
        if (len < 1.2) continue;
        const mx = (x1 + x2) * 0.5, mz = (z1 + z2) * 0.5;
        if (getRawWaterMask(mx, mz)) continue;
        const ang = Math.atan2(dx, dz);
        const rx = -dz / len, rz = dx / len;
        const my = getGroundHeight(mx, mz);

        // Dark basalt cobblestone track-bed strip embedded flush in asphalt (1.55m wide, just like ref_05!)
        cobInfill.push({ x: mx, y: my + 0.295, z: mz, len: len + 0.12, ang });
        // Geneva meter-gauge twin steel rails (+-0.50m)
        for (const rOff of [-0.50, 0.50]) {
          steelRails.push({ x: mx + rx * rOff, y: my + 0.305, z: mz + rz * rOff, len: len + 0.12, ang });
        }
        // Overhead TPG tram contact wire (5.65m height)
        catWires.push({ x: mx, y: my + 5.65, z: mz, len: len + 0.14, ang });
      }
    }
    const td = new THREE.Object3D();
    if (cobInfill.length > 0) {
      const cobStripMat = new THREE.MeshStandardMaterial({
        map: photoBundle?.paverDiff || null,
        normalMap: photoBundle?.paverNor || null,
        normalScale: new THREE.Vector2(1.1, 1.1),
        color: 0x5c6066,
        roughness: 0.78,
        metalness: 0.08,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -5,
      });
      const cobGeo = new THREE.PlaneGeometry(1.58, 1.0).rotateX(-Math.PI / 2);
      const cobMesh = new THREE.InstancedMesh(cobGeo, cobStripMat, cobInfill.length);
      cobMesh.receiveShadow = true;
      cobInfill.forEach((it, idx) => {
        td.position.set(it.x, it.y, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, it.len);
        td.updateMatrix();
        cobMesh.setMatrixAt(idx, td.matrix);
      });
      propsGroup.add(cobMesh);
    }
    if (steelRails.length > 0) {
      const trRailMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 0.92, roughness: 0.22 });
      const trRailMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.075, 0.032, 1.0), trRailMat, steelRails.length);
      steelRails.forEach((it, idx) => {
        td.position.set(it.x, it.y, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, it.len);
        td.updateMatrix();
        trRailMesh.setMatrixAt(idx, td.matrix);
      });
      propsGroup.add(trRailMesh);
    }
    if (catWires.length > 0) {
      const trWireMesh = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.026, 0.026, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x1a1e24 }),
        catWires.length
      );
      catWires.forEach((it, idx) => {
        td.position.set(it.x, it.y, it.z);
        td.rotation.set(0, it.ang, 0);
        td.scale.set(1, 1, it.len);
        td.updateMatrix();
        trWireMesh.setMatrixAt(idx, td.matrix);
      });
      propsGroup.add(trWireMesh);
    }
  }

  // 9. REAL GPS GENEVA BICYCLE PARKING RACKS + PARKED CITY BICYCLES (strictly clear of roads — matches ref_03!)
  {
    const rackClusters = [
      [5.5, 169.5, 0.92], // cleanly on right granite sidewalk along Quai du Général-Guisan!
      [34, 152, -0.52],   // Jardin Anglais lakeside promenade
    ];
    if (streetFeatures?.bikeParking?.length) {
      for (const [bx, bz] of streetFeatures.bikeParking) {
        if (getRawWaterMask(bx, bz) || isOnAnyRoad(bx, bz, 1.4)) continue;
        if (rackClusters.some(([ox, oz]) => Math.hypot(ox - bx, oz - bz) < 14)) continue;
        rackClusters.push([bx, bz, 0.52]);
      }
    }
    const validRacks = rackClusters.filter(([cx, cz]) => !isOnAnyRoad(cx, cz, 0.8) && !getRawWaterMask(cx, cz));
    const hoopParts = [];
    const hL = new THREE.CylinderGeometry(0.025, 0.025, 0.78, 6); hL.translate(-0.34, 0.39, 0);
    const hR = new THREE.CylinderGeometry(0.025, 0.025, 0.78, 6); hR.translate(0.34, 0.39, 0);
    const hTop = new THREE.CylinderGeometry(0.025, 0.025, 0.70, 6).rotateZ(Math.PI / 2); hTop.translate(0, 0.78, 0);
    hoopParts.push(hL, hR, hTop);
    const hoopGeo = mergeGeometries(hoopParts, false); hoopParts.forEach((g) => g.dispose());

    const bikeParts = [];
    const bw1 = new THREE.TorusGeometry(0.31, 0.032, 6, 12); bw1.translate(-0.52, 0.32, 0);
    const bw2 = new THREE.TorusGeometry(0.31, 0.032, 6, 12); bw2.translate(0.52, 0.32, 0);
    const bFr = new THREE.BoxGeometry(0.86, 0.055, 0.055); bFr.translate(0, 0.62, 0);
    const bSeat = new THREE.BoxGeometry(0.24, 0.06, 0.14); bSeat.translate(-0.22, 0.88, 0);
    const bBar = new THREE.BoxGeometry(0.06, 0.06, 0.46); bBar.translate(0.42, 0.94, 0);
    bikeParts.push(bw1, bw2, bFr, bSeat, bBar);
    const bikeGeo = mergeGeometries(bikeParts, false); bikeParts.forEach((g) => g.dispose());

    const hoopInst = new THREE.InstancedMesh(hoopGeo, steelMat, validRacks.length * 4);
    const bikeInst = new THREE.InstancedMesh(
      bikeGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.45 }),
      validRacks.length * 3
    );
    hoopInst.castShadow = true;
    bikeInst.castShadow = true;
    const rd = new THREE.Object3D();
    const bikePal = [0x1c222a, 0xb8242c, 0x24568a, 0x266a42, 0xd8a828, 0xd8dee4];
    const bCol = new THREE.Color();
    let hIdx = 0, bIdx = 0;
    validRacks.forEach(([cx, cz, yaw], ci) => {
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      for (let s = 0; s < 4; s++) {
        const off = (s - 1.5) * 0.92;
        const hx = cx + cosY * off;
        const hz = cz - sinY * off;
        const hy = getGroundHeight(hx, hz) + 0.16;
        rd.position.set(hx, hy, hz);
        rd.rotation.set(0, yaw + Math.PI * 0.5, 0);
        rd.scale.set(1, 1, 1);
        rd.updateMatrix();
        hoopInst.setMatrixAt(hIdx++, rd.matrix);
        if (s < 3) {
          rd.position.set(hx + sinY * 0.14, hy, hz + cosY * 0.14);
          rd.updateMatrix();
          bikeInst.setMatrixAt(bIdx, rd.matrix);
          bCol.setHex(bikePal[(ci * 3 + s) % bikePal.length]);
          bikeInst.setColorAt(bIdx++, bCol);
        }
      }
      insertCollider({ kind: 'obb', x: cx, z: cz, yaw, halfW: 2.0, halfL: 0.72, maxY: getGroundHeight(cx, cz) + 1.2, walkableTop: false });
    });
    if (bikeInst.instanceColor) bikeInst.instanceColor.needsUpdate = true;
    if (validRacks.length > 0) propsGroup.add(hoopInst, bikeInst);
  }

  // 10. AUTHENTIC SWISS RED CAST-IRON FIRE HYDRANTS (ref_04) & BLUE 'P' PARKING SIGNS (ref_01 — strictly clear of roads!)
  {
    const hydMat = new THREE.MeshStandardMaterial({ color: 0xc91e24, roughness: 0.32, metalness: 0.45 });
    const hParts = [];
    const hBody = new THREE.CylinderGeometry(0.11, 0.135, 0.72, 10); hBody.translate(0, 0.36, 0);
    const hCap = new THREE.SphereGeometry(0.125, 10, 8); hCap.translate(0, 0.74, 0);
    const hNoz = new THREE.CylinderGeometry(0.055, 0.055, 0.34, 8).rotateZ(Math.PI / 2); hNoz.translate(0, 0.56, 0);
    hParts.push(hBody, hCap, hNoz);
    const hydGeo = mergeGeometries(hParts, false); hParts.forEach((g) => g.dispose());

    const hydSpots = [
      [-5.2, 155.8], [3.8, 167.2], [52, 194], [-34, 152], [-88, 156],
      [-128, -142], [18, 142], [74, 174],
    ].filter(([hx, hz]) => !isOnAnyRoad(hx, hz, 0.35) && !getRawWaterMask(hx, hz));
    const hydInst = new THREE.InstancedMesh(hydGeo, hydMat, hydSpots.length);
    hydInst.castShadow = true;
    const hd = new THREE.Object3D();
    hydSpots.forEach(([hx, hz], idx) => {
      const hy = getGroundHeight(hx, hz) + 0.16;
      hd.position.set(hx, hy, hz);
      hd.rotation.set(0, idx * 0.7, 0);
      hd.scale.set(1, 1, 1);
      hd.updateMatrix();
      hydInst.setMatrixAt(idx, hd.matrix);
      insertCollider({ kind: 'cyl', x: hx, z: hz, r: 0.18, maxY: hy + 0.9, walkableTop: true });
    });
    if (hydSpots.length > 0) propsGroup.add(hydInst);

    // Iconic Swiss Blue 'P' Parking + Red Prohibition Signpair (matches ref_01_quai_general_guisan.jpg!)
    const pCan = document.createElement('canvas');
    pCan.width = 128; pCan.height = 128;
    const pCtx = pCan.getContext('2d');
    pCtx.fillStyle = '#0055a5';
    pCtx.fillRect(0, 0, 128, 128);
    pCtx.strokeStyle = '#ffffff';
    pCtx.lineWidth = 6;
    pCtx.strokeRect(5, 5, 118, 118);
    pCtx.fillStyle = '#ffffff';
    pCtx.font = 'bold 88px "Helvetica Neue", Arial, sans-serif';
    pCtx.textAlign = 'center';
    pCtx.fillText('P', 64, 96);
    const pTex = new THREE.CanvasTexture(pCan);
    pTex.colorSpace = THREE.SRGBColorSpace;
    const pMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.34, metalness: 0.25 });

    const pSignSpots = [
      [3.5, 166.5, 1.05],
      [44, 189, 1.05],
      [-26, 146, 1.05],
      [-104, 152, 1.05],
    ].filter(([px, pz]) => !isOnAnyRoad(px, pz, 0.35) && !getRawWaterMask(px, pz));
    const psPoleGeo = new THREE.CylinderGeometry(0.035, 0.04, 2.7, 8); psPoleGeo.translate(0, 1.35, 0);
    const psPlateGeo = new THREE.BoxGeometry(0.56, 0.56, 0.04); psPlateGeo.translate(0, 2.48, 0);
    const psPoles = new THREE.InstancedMesh(psPoleGeo, steelMat, pSignSpots.length);
    const psPlates = new THREE.InstancedMesh(
      psPlateGeo,
      [steelMat, steelMat, steelMat, steelMat, pMat, pMat],
      pSignSpots.length
    );
    psPoles.castShadow = true;
    pSignSpots.forEach(([px, pz, pyaw], idx) => {
      const py = getGroundHeight(px, pz) + 0.16;
      hd.position.set(px, py, pz);
      hd.rotation.set(0, pyaw, 0);
      hd.scale.set(1, 1, 1);
      hd.updateMatrix();
      psPoles.setMatrixAt(idx, hd.matrix);
      psPlates.setMatrixAt(idx, hd.matrix);
      insertCollider({ kind: 'cyl', x: px, z: pz, r: 0.14, maxY: py + 2.8, walkableTop: false });
    });
    if (pSignSpots.length > 0) propsGroup.add(psPoles, psPlates);
  }

  // Merge all static sidewalk café terraces, tables, chairs, umbrellas, planters & bus shelter frames (~130 draw calls -> ~10 draw calls!)
  batchStaticGroup(propsGroup, { label: 'GenevaStreetPropsBatch' });
  return propsGroup;
}
