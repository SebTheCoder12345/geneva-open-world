import * as THREE from 'three';
import { getGroundHeight } from './cityData.js';
import { batchStaticGroup } from './staticBatcher.js';

function makeInscribedPlaque(text, sub = '', bg = '#d6cfc2', fg = '#2c2822', w = 512, h = 128) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = sub ? 'bold 34px Georgia, serif' : 'bold 40px Georgia, serif';
  ctx.fillText(text, w * 0.5, sub ? h * 0.50 : h * 0.62, w - 36);
  if (sub) {
    ctx.font = '600 20px Georgia, serif';
    ctx.fillText(sub, w * 0.5, h * 0.80, w - 36);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// High-detail Horloge Fleurie 1024px Geneva seasonal flowerbed clock dial texture!
function createHorlogeFleurieTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const ctx = c.getContext('2d');
  const cx = S * 0.5;
  const cy = S * 0.5;

  // Deep emerald turf base
  ctx.fillStyle = '#2d6b34';
  ctx.fillRect(0, 0, S, S);

  // Outer crimson & scarlet begonia floral border ring
  ctx.fillStyle = '#c82832';
  ctx.beginPath();
  ctx.arc(cx, cy, 495, 0, Math.PI * 2);
  ctx.fill();

  // Golden marigold inner floral wreath
  ctx.fillStyle = '#e8b632';
  ctx.beginPath();
  ctx.arc(cx, cy, 442, 0, Math.PI * 2);
  ctx.fill();

  // White alyssum hour-numeral floral track
  ctx.fillStyle = '#f4f0e4';
  ctx.beginPath();
  ctx.arc(cx, cy, 412, 0, Math.PI * 2);
  ctx.fill();

  // Emerald grass inner floral dial
  ctx.fillStyle = '#337a3b';
  ctx.beginPath();
  ctx.arc(cx, cy, 326, 0, Math.PI * 2);
  ctx.fill();

  // 12 floral petal sectors alternating sage & rich lawn green
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * Math.PI * 2;
    const a1 = ((i + 0.5) / 12) * Math.PI * 2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(15,45,18,0.14)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 324, a0, a1);
    ctx.closePath();
    ctx.fill();
  }

  // Organic floral stipple texture across all flower rings so it looks like 6,500 real planted blossoms!
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < 3200; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 490;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    const dotR = 3 + rand() * 5;
    if (r > 442) ctx.fillStyle = rand() > 0.35 ? '#e43844' : '#9c1420';
    else if (r > 412) ctx.fillStyle = rand() > 0.4 ? '#f6cf54' : '#c88c1a';
    else if (r > 326) ctx.fillStyle = rand() > 0.4 ? '#ffffff' : '#dfd8c6';
    else ctx.fillStyle = rand() > 0.5 ? '#438f48' : '#245e2c';
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // 12 crisp crimson/gold floral hour numerals & minute tick blossoms
  ctx.fillStyle = '#a81c26';
  ctx.font = 'bold 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let h = 0; h < 12; h++) {
    const a = (h / 12) * Math.PI * 2 - Math.PI * 0.5;
    const nx = cx + Math.cos(a) * 368;
    const ny = cy + Math.sin(a) * 368;
    ctx.fillText(romans[h], nx, ny);
  }

  // Central iconic Swiss red-and-white floral shield crest!
  ctx.fillStyle = '#c81c28';
  ctx.beginPath();
  ctx.arc(cx, cy, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f2d37c';
  ctx.lineWidth = 10;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 22, cy - 68, 44, 136);
  ctx.fillRect(cx - 68, cy - 22, 136, 44);

  // Subtle 'GENÈVE' floral banner arc
  ctx.fillStyle = '#fff5d6';
  ctx.font = 'bold 38px Georgia, serif';
  ctx.fillText('GENÈVE', cx, cy + 210);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

// Create a sculpted classical bronze equestrian statue (reusable for Monument Brunswick & Général Dufour!)
function createEquestrianBronze(bronzeMat, scale = 1.0) {
  const g = new THREE.Group();
  g.scale.setScalar(scale);

  // Horse barrel torso
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.25, 8, 12).rotateZ(Math.PI / 2), bronzeMat);
  body.position.set(0, 1.48, 0);
  body.castShadow = true;
  // Muscular arched horse neck & sculpted head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.34, 0.92, 10), bronzeMat);
  neck.position.set(0.78, 2.02, 0);
  neck.rotation.z = -0.52;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.24), bronzeMat);
  head.position.set(1.12, 2.38, 0);
  head.rotation.z = -0.35;
  // Sweeping tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 0.95, 8), bronzeMat);
  tail.position.set(-0.98, 1.18, 0);
  tail.rotation.z = 0.35;
  // 4 sculpted legs (one front leg raised in classic heroic equestrian pose!)
  const legGeo = new THREE.CylinderGeometry(0.09, 0.065, 1.32, 8);
  const legSpecs = [
    [-0.58, 0.66, -0.22, 0.08],
    [-0.58, 0.66, 0.22, -0.14],
    [0.54, 0.66, 0.22, 0.06],
  ];
  for (const [lx, ly, lz, rz] of legSpecs) {
    const leg = new THREE.Mesh(legGeo, bronzeMat);
    leg.position.set(lx, ly, lz);
    leg.rotation.z = rz;
    leg.castShadow = true;
    g.add(leg);
  }
  const raisedUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.08, 0.66, 8), bronzeMat);
  raisedUpper.position.set(0.68, 1.18, -0.22);
  raisedUpper.rotation.z = -0.95;
  const raisedLower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.64, 8), bronzeMat);
  raisedLower.position.set(0.95, 0.85, -0.22);
  raisedLower.rotation.z = 0.12;

  // Rider (General / Duke upright in saddle with cloak, outstretched arm & bicorne hat!)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.88, 10), bronzeMat);
  torso.position.set(0.04, 2.26, 0);
  torso.castShadow = true;
  const rHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bronzeMat);
  rHead.position.set(0.06, 2.86, 0);
  const bicorne = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.44), bronzeMat);
  bicorne.position.set(0.06, 3.02, 0);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.72, 8), bronzeMat);
  arm.position.set(0.36, 2.54, 0.22);
  arm.rotation.z = -1.15;

  g.add(body, neck, head, tail, raisedUpper, raisedLower, torso, rHead, bicorne, arm);
  return g;
}

/**
 * Builds all hand-crafted iconic Geneva corner landmarks at their exact Swiss LV95 GPS coordinates
 * so locals instantly recognize every square, bridge, statue, fountain, and lakeside corner!
 */
export function buildGenevaLandmarks(worldGroup, vfxGroup, insertCollider, photoBundle) {
  const lmGroup = new THREE.Group();
  lmGroup.name = 'Geneva_Iconic_Corner_Landmarks';
  worldGroup.add(lmGroup);

  // Photographic Poly Haven stone & ashlar textures + normal maps so EVERY Geneva monument has crisp carved masonry relief (zero flat plastic!)
  let ashlarDiff = null;
  if (photoBundle?.ashlarImg) {
    ashlarDiff = new THREE.CanvasTexture(photoBundle.ashlarImg);
    ashlarDiff.colorSpace = THREE.SRGBColorSpace;
    ashlarDiff.wrapS = ashlarDiff.wrapT = THREE.RepeatWrapping;
    ashlarDiff.repeat.set(2, 2);
    ashlarDiff.anisotropy = 12;
  }
  let stoneDiff = null;
  if (photoBundle?.stoneImg) {
    stoneDiff = new THREE.CanvasTexture(photoBundle.stoneImg);
    stoneDiff.colorSpace = THREE.SRGBColorSpace;
    stoneDiff.wrapS = stoneDiff.wrapT = THREE.RepeatWrapping;
    stoneDiff.repeat.set(2, 2);
    stoneDiff.anisotropy = 12;
  }

  const marbleMat = new THREE.MeshStandardMaterial({
    map: stoneDiff,
    normalMap: photoBundle?.stoneNor || null,
    normalScale: new THREE.Vector2(0.42, 0.42),
    color: 0xebe5da,
    roughness: 0.56,
    metalness: 0.05,
  });
  const marbleTrimMat = new THREE.MeshStandardMaterial({
    map: stoneDiff,
    normalMap: photoBundle?.stoneNor || null,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: 0xd5cec0,
    roughness: 0.66,
    metalness: 0.05,
  });
  const limestoneMat = new THREE.MeshStandardMaterial({
    map: stoneDiff,
    normalMap: photoBundle?.stoneNor || null,
    normalScale: new THREE.Vector2(0.68, 0.68),
    color: 0xe6dcc8, // sunlit golden-cream Geneva molasse limestone!
    roughness: 0.78,
    metalness: 0.04,
  });
  const graniteMat = new THREE.MeshStandardMaterial({
    map: stoneDiff,
    normalMap: photoBundle?.stoneNor || null,
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0xd0c9be, // pale Swiss Jura & Ticino granite!
    roughness: 0.74,
    metalness: 0.05,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    map: stoneDiff,
    normalMap: photoBundle?.stoneNor || null,
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: 0x9b9282,
    roughness: 0.84,
  });
  const oakPortalMat = new THREE.MeshStandardMaterial({ color: 0x382519, roughness: 0.72, metalness: 0.14 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x262c27, roughness: 0.34, metalness: 0.84 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0b958, roughness: 0.24, metalness: 0.88 });
  const ironGreenMat = new THREE.MeshStandardMaterial({ color: 0x1b3328, roughness: 0.38, metalness: 0.80 });
  const timberMat = new THREE.MeshStandardMaterial({ color: 0x7c5e3e, roughness: 0.86 });
  const waterPoolMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a7a96,
    roughness: 0.08,
    metalness: 0.12,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.84,
  });

  const nightPaverMats = [];
  const animatedSprayRings = [];

  // =================================================================================================
  // 1. PLACE DU MOLARD — GLOWING BLUE MULTILINGUAL PAVERS + TOUR DU MOLARD CLOCK & GENEVA CREST!
  // =================================================================================================
  {
    const greetings = [
      'Bonjour', 'Welcome', 'Salam', 'Shalom', 'Guten Tag', 'Buongiorno',
      'Hola', 'Ni Hao', 'Konnichiwa', 'Privet', 'Obrigado', 'Merhaba',
      'Namaste', 'Kalimera', 'Hej', 'Sawubona', 'Dzień dobry', 'Aloha',
      'Salut', 'Grüezi', 'Allegra', 'Ciao', 'Hallo', 'Szia',
    ];
    // Scatter 32 illuminated cobalt-blue pavers flush along the pedestrian heart of Place du Molard!
    const paverSpots = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 4; col++) {
        const px = -168 + col * 9.5 + (row % 2) * 3.8 + Math.sin(row * 2.1 + col) * 1.4;
        const pz = 244 + row * 8.2 + Math.cos(col * 1.7 + row) * 1.2;
        paverSpots.push([px, pz, greetings[(row * 4 + col) % greetings.length]]);
      }
    }
    const paverGeo = new THREE.PlaneGeometry(1.38, 0.68).rotateX(-Math.PI / 2);
    const upVec = new THREE.Vector3(0, 1, 0);
    const slopeNorm = new THREE.Vector3();
    const yawQuat = new THREE.Quaternion();
    const tiltQuat = new THREE.Quaternion();
    for (let i = 0; i < paverSpots.length; i++) {
      const [px, pz, word] = paverSpots[i];
      const py = getGroundHeight(px, pz) + 0.168;
      // Match exact Place du Molard cobble slope so ZERO glowing blue pavers ever hover off sloped terrain!
      const hL = getGroundHeight(px - 0.7, pz);
      const hR = getGroundHeight(px + 0.7, pz);
      const hU = getGroundHeight(px, pz - 0.7);
      const hD = getGroundHeight(px, pz + 0.7);
      slopeNorm.set(hL - hR, 1.4, hU - hD).normalize();
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#0d4ea8';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#6ec2ff';
      ctx.lineWidth = 6;
      ctx.strokeRect(5, 5, 246, 118);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(word, 128, 66, 224);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        emissive: new THREE.Color(0x2d8cff),
        emissiveMap: tex,
        emissiveIntensity: 0.65,
        roughness: 0.22,
        metalness: 0.10,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });
      nightPaverMats.push(mat);
      const tile = new THREE.Mesh(paverGeo, mat);
      tile.position.set(px, py, pz);
      tiltQuat.setFromUnitVectors(upVec, slopeNorm);
      yawQuat.setFromAxisAngle(upVec, -0.35 + ((i % 3) - 1) * 0.08);
      tile.quaternion.copy(tiltQuat).multiply(yawQuat);
      tile.receiveShadow = true;
      lmGroup.add(tile);
    }

    // Tour du Molard (-150.4, 228.9) Medieval Clock Dials & Geneva Coat of Arms Relief on South & North Faces!
    const tmX = -150.4;
    const tmZ = 228.9;
    const tmY = getGroundHeight(tmX, tmZ);
    const clockC = document.createElement('canvas');
    clockC.width = 256;
    clockC.height = 256;
    const cctx = clockC.getContext('2d');
    cctx.fillStyle = '#182234';
    cctx.beginPath();
    cctx.arc(128, 128, 122, 0, Math.PI * 2);
    cctx.fill();
    cctx.strokeStyle = '#e5bd60';
    cctx.lineWidth = 12;
    cctx.stroke();
    cctx.fillStyle = '#f2d07a';
    cctx.font = 'bold 26px Georgia, serif';
    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    const rom = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI * 0.5;
      cctx.fillText(rom[h], 128 + Math.cos(a) * 90, 128 + Math.sin(a) * 90);
    }
    cctx.strokeStyle = '#f8df96';
    cctx.lineWidth = 8;
    cctx.beginPath();
    cctx.moveTo(128, 128); cctx.lineTo(94, 82);
    cctx.moveTo(128, 128); cctx.lineTo(176, 98);
    cctx.stroke();
    const tmClockTex = new THREE.CanvasTexture(clockC);
    tmClockTex.colorSpace = THREE.SRGBColorSpace;
    const tmClockMat = new THREE.MeshStandardMaterial({
      map: tmClockTex,
      emissive: 0xffe096,
      emissiveMap: tmClockTex,
      emissiveIntensity: 0.32,
      roughness: 0.25,
    });
    nightPaverMats.push(tmClockMat);

    const crestTex = makeInscribedPlaque('TOUR DU MOLARD', 'GENEVA CIVITAS REFUGII · 1591', '#8b242a', '#f2cf78', 512, 160);
    const crestMat = new THREE.MeshStandardMaterial({ map: crestTex, roughness: 0.65 });

    const tmGroup = new THREE.Group();
    tmGroup.position.set(tmX, tmY, tmZ);
    tmGroup.rotation.y = -0.538; // exact outward normal of Tour du Molard South facade facing Place du Molard!
    const darkArchMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.85 });
    for (const side of [1, -1]) {
      const dial = new THREE.Mesh(new THREE.CircleGeometry(1.55, 24), tmClockMat);
      dial.position.set(0, 14.5, side * 4.32);
      if (side < 0) dial.rotation.y = Math.PI;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.14, 10, 24), goldMat);
      rim.position.set(0, 14.5, side * 4.29);
      const relief = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.32, 0.24), crestMat);
      relief.position.set(0, 10.4, side * 4.26);

      // Vaulted medieval Gothic stone entrance portal at the base of Tour du Molard + dressed stone voussoir surround!
      const archFrame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.3, 0.34), limestoneMat);
      archFrame.position.set(0, 2.2, side * 4.18);
      const archDoor = new THREE.Mesh(new THREE.BoxGeometry(2.35, 3.6, 0.38), side > 0 ? oakPortalMat : darkArchMat);
      archDoor.position.set(0, 1.85, side * 4.20);
      const archTop = new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.40, 16).rotateX(Math.PI / 2), side > 0 ? oakPortalMat : darkArchMat);
      archTop.position.set(0, 3.62, side * 4.20);
      const archRing = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.16, 8, 16, Math.PI), limestoneMat);
      archRing.position.set(0, 3.62, side * 4.24);
      if (side < 0) archRing.rotation.y = Math.PI;

      // Twin medieval arched mullioned windows on the middle tower story!
      for (const wx of [-2.1, 2.1]) {
        const wFrame = new THREE.Mesh(new THREE.BoxGeometry(1.18, 1.95, 0.24), limestoneMat);
        wFrame.position.set(wx, 6.8, side * 4.20);
        const wGlass = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.58, 0.28), darkArchMat);
        wGlass.position.set(wx, 6.8, side * 4.22);
        tmGroup.add(wFrame, wGlass);
      }

      // Medieval stone machicolation corbel belt wrapping beneath the dark slate turret roof!
      for (let cx = -3.8; cx <= 3.81; cx += 1.08) {
        const corbel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.46), limestoneMat);
        corbel.position.set(cx, 12.65, side * 4.28);
        tmGroup.add(corbel);
      }
      const belt = new THREE.Mesh(new THREE.BoxGeometry(8.8, 0.34, 0.48), limestoneMat);
      belt.position.set(0, 13.08, side * 4.28);
      tmGroup.add(dial, rim, relief, archFrame, archDoor, archTop, archRing, belt);
    }

    // Alternating medieval dressed stone corner quoins climbing all 4 corners of Tour du Molard!
    for (const qx of [-4.22, 4.22]) {
      for (const qz of [-4.05, 4.05]) {
        for (let qy = 0.8; qy < 12.6; qy += 1.15) {
          const isWide = Math.round(qy) % 2 === 0;
          const quoin = new THREE.Mesh(
            new THREE.BoxGeometry(isWide ? 0.68 : 0.46, 0.56, isWide ? 0.46 : 0.68),
            limestoneMat
          );
          quoin.position.set(qx, qy, qz);
          tmGroup.add(quoin);
        }
      }
    }
    lmGroup.add(tmGroup);
  }

  // =================================================================================================
  // 2. MONUMENT BRUNSWICK — SQUARE DES ALPES, QUAI DU MONT-BLANC (-75.5, -274.6)!
  // Towering White-Marble Neo-Gothic Venetian Mausoleum with Pinnacles & Equestrian Duke Statue!
  // =================================================================================================
  {
    const mbX = -75.5;
    const mbZ = -274.6;
    const mbY = getGroundHeight(mbX, mbZ);
    const mb = new THREE.Group();
    mb.position.set(mbX, mbY + 0.12, mbZ);
    mb.rotation.y = 0.92; // facing Lac Léman & Mont-Blanc!

    // Tiered octagonal white-grey granite garden terrace & staircases
    const base1 = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 7.4, 0.65, 8), graniteMat);
    base1.position.y = 0.32;
    base1.receiveShadow = true;
    const base2 = new THREE.Mesh(new THREE.CylinderGeometry(5.1, 5.5, 1.25, 6), marbleMat);
    base2.position.y = 1.25;
    base2.castShadow = true;
    base2.receiveShadow = true;
    mb.add(base1, base2);

    // Sculpted inner pink-marble sarcophagus & tomb effigy visible beneath the Gothic canopy!
    const sarc = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 1.45, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xc29e96, roughness: 0.44 })
    );
    sarc.position.set(0, 2.75, 0);
    sarc.castShadow = true;
    const effigy = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.4, 6, 10).rotateX(Math.PI / 2), marbleMat);
    effigy.position.set(0, 3.68, 0);
    mb.add(sarc, effigy);

    // 6 slender Neo-Gothic clustered white-marble columns supporting the soaring hexagonal spire!
    const colR = 3.65;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const cx = Math.cos(a) * colR;
      const cz = Math.sin(a) * colR;
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.15, 0.92), marbleMat);
      plinth.position.set(cx, 2.35, cz);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 6.2, 10), marbleMat);
      col.position.set(cx, 6.0, cz);
      col.castShadow = true;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.30, 0.55, 8), marbleMat);
      cap.position.set(cx, 9.2, cz);
      // Pointed corner Gothic pinnacle turret rising above each column!
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.1, 6), marbleMat);
      turret.position.set(cx, 10.6, cz);
      const pin = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.6, 6), marbleMat);
      pin.position.set(cx, 12.95, cz);
      pin.castShadow = true;
      mb.add(plinth, col, cap, turret, pin);

      // Pointed Venetian-Gothic trefoil arch connecting this column to the next column (signature Monument Brunswick detail!)
      const aNext = ((i + 1) / 6) * Math.PI * 2;
      const nx = Math.cos(aNext) * colR;
      const nz = Math.sin(aNext) * colR;
      const mx = (cx + nx) * 0.5;
      const mz = (cz + nz) * 0.5;
      const edgeAng = Math.atan2(nx - cx, nz - cz);
      const archSpan = new THREE.Group();
      archSpan.position.set(mx, 8.75, mz);
      archSpan.rotation.y = edgeAng;
      // Left & right pointed Gothic voussoir ribs meeting at an ogee peak + carved triangular Venetian gable!
      const ribL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 2.25), marbleTrimMat);
      ribL.position.set(0, 0.45, -0.82);
      ribL.rotation.x = 0.52;
      const ribR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 2.25), marbleTrimMat);
      ribR.position.set(0, 0.45, 0.82);
      ribR.rotation.x = -0.52;
      const gothicCusp = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.08, 6, 12).rotateY(Math.PI / 2), marbleMat);
      gothicCusp.position.set(0, 0.92, 0);
      const gableFinial = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.85, 4), marbleMat);
      gableFinial.position.set(0, 2.05, 0);
      archSpan.add(ribL, ribR, gothicCusp, gableFinial);
      mb.add(archSpan);
    }

    // Ornate Square des Alpes dark wrought-iron perimeter fence with gilded gold spear finials + lush rose/hydrangea flower beds!
    const roseRedMat = new THREE.MeshStandardMaterial({ color: 0xc9263c, roughness: 0.82 });
    const hydrangeaMat = new THREE.MeshStandardMaterial({ color: 0x6b8fd4, roughness: 0.82 });
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2a5228, roughness: 0.90 });
    for (let f = 0; f < 16; f++) {
      const fa = (f / 16) * Math.PI * 2;
      const fx = Math.cos(fa) * 7.85;
      const fz = Math.sin(fa) * 7.85;
      // Leave clean entrance opening facing Quai du Mont-Blanc (+Z)
      if (fz > 5.8 && Math.abs(fx) < 2.8) continue;
      const fPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 1.35, 6), ironGreenMat);
      fPost.position.set(fx, 0.72, fz);
      const fGold = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.22, 6), goldMat);
      fGold.position.set(fx, 1.48, fz);
      mb.add(fPost, fGold);
      if (f % 2 === 0) {
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), hedgeMat);
        bush.scale.set(1.2, 0.58, 1.2);
        bush.position.set(Math.cos(fa) * 6.95, 0.52, Math.sin(fa) * 6.95);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.26, 7, 5), f % 4 === 0 ? roseRedMat : hydrangeaMat);
        bloom.position.set(Math.cos(fa) * 6.85, 0.88, Math.sin(fa) * 6.85);
        mb.add(bush, bloom);
      }
    }

    // Gothic pointed gable cornice ring + towering central hexagonal marble pyramid spire!
    const entab = new THREE.Mesh(new THREE.CylinderGeometry(4.15, 4.05, 1.35, 6), marbleTrimMat);
    entab.position.y = 9.95;
    entab.castShadow = true;
    const spireBase = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.85, 2.2, 6), marbleMat);
    spireBase.position.y = 11.7;
    const spire = new THREE.Mesh(new THREE.ConeGeometry(2.65, 7.6, 6), marbleTrimMat);
    spire.position.y = 16.5;
    spire.castShadow = true;
    const finialPlinth = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 0.72, 8), marbleMat);
    finialPlinth.position.y = 19.65;
    mb.add(entab, spireBase, spire, finialPlinth);

    // Bronze Equestrian Statue of Duke Charles II of Brunswick crowning the pinnacle!
    const duke = createEquestrianBronze(bronzeMat, 0.85);
    duke.position.set(0, 20.0, 0);
    mb.add(duke);

    // Twin iconic white marble guardian lions flanking the Quai du Mont-Blanc front steps!
    for (const side of [-1, 1]) {
      const lp = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.05, 1.95), marbleMat);
      lp.position.set(side * 3.1, 1.15, 5.8);
      lp.castShadow = true;
      const lBody = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.62, 1.45), marbleMat);
      lBody.position.set(side * 3.1, 1.98, 5.8);
      const lHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), marbleMat);
      lHead.position.set(side * 3.1, 2.38, 6.38);
      mb.add(lp, lBody, lHead);
    }

    // Commemorative plaque
    const mbPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.72, 0.12),
      new THREE.MeshStandardMaterial({
        map: makeInscribedPlaque('MONUMENT BRUNSWICK', 'SQUARE DES ALPES · 1879', '#ded9ce', '#26231e'),
        roughness: 0.6,
      })
    );
    mbPlaque.position.set(0, 1.32, 5.42);
    mb.add(mbPlaque);

    lmGroup.add(mb);
    insertCollider({ kind: 'cyl', x: mbX, z: mbZ, r: 6.4, maxY: mbY + 23.0, walkableTop: false });
  }

  // =================================================================================================
  // 3. JARDIN ANGLAIS — FONTAINE DES QUATRE-SAISONS (105, 194) + UPGRADED HORLOGE FLEURIE (139.4, 208)!
  // =================================================================================================
  let hourHand = null, minHand = null, secHand = null;
  {
    // A. Fontaine des Quatre-Saisons (Ornate Tiered Victorian Bronze Fountain in Jardin Anglais!)
    const fX = 105.0;
    const fZ = 194.0;
    const fY = getGroundHeight(fX, fZ);
    const fnt = new THREE.Group();
    fnt.position.set(fX, fY + 0.12, fZ);

    // Wide circular carved Jura granite water basin
    const basinOuter = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.44, 10, 32).rotateX(Math.PI / 2), graniteMat);
    basinOuter.position.y = 0.48;
    basinOuter.castShadow = true;
    basinOuter.receiveShadow = true;
    const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 5.6, 0.78, 32), graniteMat);
    basinWall.position.y = 0.34;
    const waterDisc = new THREE.Mesh(new THREE.CircleGeometry(5.1, 32).rotateX(-Math.PI / 2), waterPoolMat);
    waterDisc.position.y = 0.62;

    // Sculpted 3-tier dark Victorian bronze fountain spire
    const ped1 = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.55, 1.55, 12), bronzeMat);
    ped1.position.y = 1.25;
    ped1.castShadow = true;
    const bowl1 = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 0.95, 0.65, 20), bronzeMat);
    bowl1.position.y = 2.25;
    bowl1.castShadow = true;
    const ped2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.82, 1.65, 12), bronzeMat);
    ped2.position.y = 3.25;
    const bowl2 = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 0.48, 0.48, 18), bronzeMat);
    bowl2.position.y = 4.22;
    const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.38, 1.25, 10), bronzeMat);
    finial.position.y = 5.0;

    // Shimmering animated water spray rings cascading down the bronze bowls!
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0xe6f6ff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const spray1 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 1.18, 1.65, 14, 1, true), sprayMat);
    spray1.position.y = 5.1;
    const spray2 = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 2.35, 1.85, 18, 1, true), sprayMat);
    spray2.position.y = 3.25;
    const spray3 = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 3.35, 1.55, 22, 1, true), sprayMat);
    spray3.position.y = 1.45;
    animatedSprayRings.push(spray1, spray2, spray3);

    fnt.add(basinWall, basinOuter, waterDisc, ped1, bowl1, ped2, bowl2, finial, spray1, spray2, spray3);
    lmGroup.add(fnt);
    insertCollider({ kind: 'cyl', x: fX, z: fZ, r: 5.5, maxY: fY + 1.2, walkableTop: false });

    // B. Upgraded Iconic Geneva Horloge Fleurie (139.4, 208.0) — High-Res 12-Numeral Floral Dial & Gold Hands!
    const fcX = 139.4;
    const fcZ = 208.0;
    const fcY = getGroundHeight(fcX, fcZ);
    const fcGroup = new THREE.Group();
    fcGroup.position.set(fcX, fcY + 0.14, fcZ);

    // Carved pale granite outer border ring + trimmed boxwood hedge base
    const fcCurb = new THREE.Mesh(new THREE.TorusGeometry(5.65, 0.28, 10, 36).rotateX(Math.PI / 2), graniteMat);
    fcCurb.position.y = 0.26;
    fcCurb.receiveShadow = true;
    const fcMound = new THREE.Mesh(
      new THREE.CylinderGeometry(5.45, 5.75, 0.56, 36),
      new THREE.MeshStandardMaterial({ color: 0x26542a, roughness: 0.92 })
    );
    fcMound.position.y = 0.28;
    fcMound.receiveShadow = true;

    // Gently tilted floral clock face (just like the real Horloge Fleurie tilted toward Quai du Général-Guisan!)
    const dialTilt = new THREE.Group();
    dialTilt.position.y = 0.62;
    dialTilt.rotation.y = -0.52;
    dialTilt.rotation.x = -0.14;

    const dialTex = createHorlogeFleurieTexture();
    const dialDisc = new THREE.Mesh(
      new THREE.CircleGeometry(5.38, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.86, metalness: 0.04 })
    );
    dialDisc.receiveShadow = true;

    // Gleaming golden hub cap + real Swiss precision hands!
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.32, 16), goldMat);
    hub.position.y = 0.16;

    hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 2.55), goldMat);
    hourHand.geometry.translate(0, 0, -1.05);
    hourHand.position.y = 0.18;
    hourHand.castShadow = true;

    minHand = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.12, 3.65), goldMat);
    minHand.geometry.translate(0, 0, -1.55);
    minHand.position.y = 0.26;
    minHand.castShadow = true;

    secHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.10, 4.15),
      new THREE.MeshStandardMaterial({ color: 0xd9242c, roughness: 0.28, metalness: 0.35 })
    );
    secHand.geometry.translate(0, 0, -1.78);
    secHand.position.y = 0.34;
    secHand.castShadow = true;

    dialTilt.add(dialDisc, hub, hourHand, minHand, secHand);
    fcGroup.add(fcCurb, fcMound, dialTilt);
    lmGroup.add(fcGroup);
    insertCollider({ kind: 'cyl', x: fcX, z: fcZ, r: 5.7, maxY: fcY + 0.9, walkableTop: true });
  }

  // =================================================================================================
  // 4. PONT DES BERGUES PEDESTRIAN FOOTBRIDGE + ÎLE ROUSSEAU STATUE (-166.6, -4.0)!
  // =================================================================================================
  {
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfff4d8,
      emissive: 0xffc468,
      emissiveIntensity: 0.45,
      roughness: 0.18,
    });
    nightPaverMats.push(lampGlowMat);

    function buildFootbridgeSpan(x1, z1, x2, z2, width, deckY) {
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const mx = (x1 + x2) * 0.5;
      const mz = (z1 + z2) * 0.5;
      const px = -dz / len;
      const pz = dx / len;

      const bg = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.55, len), graniteMat);
      deck.position.set(mx, deckY - 0.12, mz);
      deck.rotation.y = ang;
      deck.receiveShadow = true;
      bg.add(deck);

      // Heritage-green iron railings & white opal bridge globes on both edges
      const halfW = width * 0.48;
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, len), ironGreenMat);
        rail.position.set(mx + px * side * halfW, deckY + 1.15, mz + pz * side * halfW);
        rail.rotation.y = ang;
        const mid = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, len), ironGreenMat);
        mid.position.set(mx + px * side * halfW, deckY + 0.65, mz + pz * side * halfW);
        mid.rotation.y = ang;
        bg.add(rail, mid);
      }

      // Stone river piers & bridge globe lamps every ~24m
      const piers = Math.max(2, Math.floor(len / 24));
      for (let i = 1; i < piers; i++) {
        const t = i / piers;
        const rx = x1 + dx * t;
        const rz = z1 + dz * t;
        const pier = new THREE.Mesh(new THREE.BoxGeometry(width + 0.9, 4.4, 2.1), graniteMat);
        pier.position.set(rx, deckY - 2.3, rz);
        pier.rotation.y = ang;
        bg.add(pier);
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 8), ironGreenMat);
          post.position.set(rx + px * side * halfW, deckY + 1.65, rz + pz * side * halfW);
          const globe = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lampGlowMat);
          globe.position.set(rx + px * side * halfW, deckY + 3.35, rz + pz * side * halfW);
          bg.add(post, globe);
        }
      }
      lmGroup.add(bg);
    }

    // Main Pont des Bergues pedestrian bridge spanning the Rhône + iconic angled spur bridge onto Île Rousseau!
    buildFootbridgeSpan(-262, 105, -222, -68, 7.6, 1.72);
    buildFootbridgeSpan(-241, 14, -184, -4, 5.4, 1.72);

    // Statue of Jean-Jacques Rousseau (James Pradier, 1835) on Île Rousseau (-166.6, -4.0)!
    const rX = -166.6;
    const rZ = -4.0;
    const rY = getGroundHeight(rX, rZ);
    const rg = new THREE.Group();
    rg.position.set(rX, rY + 0.14, rZ);
    rg.rotation.y = 0.85; // facing the Rade & Mont-Blanc!

    const rStep = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.42, 3.4), graniteMat);
    rStep.position.y = 0.21;
    const rPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.15, 2.75, 2.15), limestoneMat);
    rPlinth.position.y = 1.78;
    rPlinth.castShadow = true;
    const rCap = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.34, 2.45), limestoneMat);
    rCap.position.y = 3.28;
    const rPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.68, 0.08),
      new THREE.MeshStandardMaterial({
        map: makeInscribedPlaque('J.-J. ROUSSEAU', 'CITOYEN DE GENÈVE · 1712–1778', '#252926', '#d8c28a'),
        roughness: 0.4,
      })
    );
    rPlaque.position.set(0, 2.0, 1.09);

    // Seated bronze philosopher statue with classical draped cloak, book & quill!
    const chair = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.88, 0.95), bronzeMat);
    chair.position.set(0, 3.88, -0.05);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.72, 0.92), bronzeMat);
    legs.position.set(0, 3.92, 0.35);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.15, 10), bronzeMat);
    torso.position.set(0, 4.78, -0.04);
    torso.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bronzeMat);
    head.position.set(0, 5.56, 0.04);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.54), bronzeMat);
    book.position.set(-0.22, 4.42, 0.38);

    rg.add(rStep, rPlinth, rCap, rPlaque, chair, legs, torso, head, book);
    lmGroup.add(rg);
    insertCollider({ kind: 'cyl', x: rX, z: rZ, r: 2.2, maxY: rY + 6.0, walkableTop: false });
  }

  // =================================================================================================
  // 5. PLACE DE NEUVE (GÉNÉRAL DUFOUR STATUE) + PARC DES BASTIONS (MUR DES RÉFORMATEURS + GIANT CHESS!)
  // =================================================================================================
  {
    // A. Equestrian Statue of Général Guillaume-Henri Dufour dead-center on Place de Neuve (-511.9, 523.7)!
    const dX = -511.9;
    const dZ = 523.7;
    const dY = getGroundHeight(dX, dZ);
    const dg = new THREE.Group();
    dg.position.set(dX, dY + 0.14, dZ);
    dg.rotation.y = 0.65;

    const dRing = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.2, 0.42, 24), graniteMat);
    dRing.position.y = 0.21;
    const dPlinth = new THREE.Mesh(new THREE.BoxGeometry(2.85, 3.55, 4.25), graniteMat);
    dPlinth.position.y = 2.15;
    dPlinth.castShadow = true;
    const dCap = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.42, 4.65), limestoneMat);
    dCap.position.y = 4.10;
    const dPlaque = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.68, 0.08),
      new THREE.MeshStandardMaterial({
        map: makeInscribedPlaque('AU GÉNÉRAL G.-H. DUFOUR', '1787 – 1875 · PLACE DE NEUVE', '#262928', '#e5cd8c'),
        roughness: 0.38,
      })
    );
    dPlaque.position.set(0, 2.35, 2.15);

    const dufourStatue = createEquestrianBronze(bronzeMat, 1.35);
    dufourStatue.position.set(0, 4.30, 0);
    dufourStatue.rotation.y = -Math.PI * 0.5;
    dg.add(dRing, dPlinth, dCap, dPlaque, dufourStatue);
    lmGroup.add(dg);
    insertCollider({ kind: 'cyl', x: dX, z: dZ, r: 4.5, maxY: dY + 8.5, walkableTop: false });

    // A2. Grand Théâtre de Genève Monumental Beaux-Arts Colonnade Portico (-556.5, 495.2, yaw = 0.456) facing Place de Neuve!
    {
      const gtX = -556.5;
      const gtZ = 495.2;
      const gtY = getGroundHeight(gtX, gtZ);
      const gt = new THREE.Group();
      gt.position.set(gtX, gtY - 0.1, gtZ);
      gt.rotation.y = 0.456;

      // Ground-floor rusticated stone arcade base with 5 arched grand opera entrance portals!
      const gtBase = new THREE.Mesh(new THREE.BoxGeometry(24.5, 6.2, 3.2), limestoneMat);
      gtBase.position.set(0, 3.1, 0.2);
      gtBase.castShadow = true;
      gtBase.receiveShadow = true;
      gt.add(gtBase);

      const portalDark = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.35, metalness: 0.45 });
      for (let p = -2; p <= 2; p++) {
        const px = p * 4.35;
        const archBox = new THREE.Mesh(new THREE.BoxGeometry(2.55, 3.85, 0.55), portalDark);
        archBox.position.set(px, 2.05, 1.72);
        const archTop = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.56, 14).rotateX(Math.PI / 2), portalDark);
        archTop.position.set(px, 3.98, 1.72);
        const archMold = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.16, 8, 16, Math.PI), marbleMat);
        archMold.position.set(px, 3.98, 1.82);
        gt.add(archBox, archTop, archMold);
      }

      // Upper classical loggia balcony + 4 pairs of paired Corinthian opera columns (Opéra Garnier-inspired Geneva masterpiece!)
      const balcony = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.72, 4.4), marbleMat);
      balcony.position.set(0, 6.45, 0.8);
      balcony.castShadow = true;
      const balRail = new THREE.Mesh(new THREE.BoxGeometry(25.2, 0.95, 0.34), limestoneMat);
      balRail.position.set(0, 7.25, 2.75);
      gt.add(balcony, balRail);

      const pairXs = [-9.6, -3.4, 3.4, 9.6];
      for (const px of pairXs) {
        for (const off of [-0.72, 0.72]) {
          const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.44, 9.2, 14), marbleMat);
          colShaft.position.set(px + off, 11.4, 2.35);
          colShaft.castShadow = true;
          const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.40, 0.68, 12), goldMat);
          colCap.position.set(px + off, 16.15, 2.35);
          gt.add(colShaft, colCap);
        }
      }
      // Classical Beaux-Arts crowning cornice entablature + sculpted gilded opera frieze!
      const gtEntab = new THREE.Mesh(new THREE.BoxGeometry(26.0, 2.1, 4.2), limestoneMat);
      gtEntab.position.set(0, 17.55, 0.75);
      gtEntab.castShadow = true;
      const gtFrieze = new THREE.Mesh(
        new THREE.BoxGeometry(16.8, 0.92, 0.16),
        new THREE.MeshStandardMaterial({
          map: makeInscribedPlaque('GRAND THÉÂTRE DE GENÈVE', 'MUSIQUE · DRAME · DANSE', '#d8cfbe', '#6e5218', 768, 128),
          roughness: 0.55,
        })
      );
      gtFrieze.position.set(0, 17.55, 2.92);
      // Gilded rooftop bronze sculptures / muses crowning the balustrade
      for (const sx of [-9.6, -3.4, 0, 3.4, 9.6]) {
        const muse = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 1.95, 8), goldMat);
        muse.position.set(sx, 19.55, 2.35);
        gt.add(muse);
      }
      gt.add(gtEntab, gtFrieze);
      lmGroup.add(gt);
    }

    // A3. Musée Rath Classical 6-Column Greek Temple Portico (-511.5, 483.2, yaw = 0.265) facing Place de Neuve!
    {
      const rthX = -511.5;
      const rthZ = 483.2;
      const rthY = getGroundHeight(rthX, rthZ);
      const rth = new THREE.Group();
      rth.position.set(rthX, rthY - 0.1, rthZ);
      rth.rotation.y = 0.265;
      for (let i = 0; i < 6; i++) {
        const cx = -6.75 + i * 2.7;
        const cShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 8.8, 12), limestoneMat);
        cShaft.position.set(cx, 5.0, 1.6);
        cShaft.castShadow = true;
        rth.add(cShaft);
      }
      const rEnt = new THREE.Mesh(new THREE.BoxGeometry(16.2, 1.75, 3.8), limestoneMat);
      rEnt.position.set(0, 10.1, 0.5);
      const rPedShape = new THREE.Shape();
      rPedShape.moveTo(-8.4, 0); rPedShape.lineTo(8.4, 0); rPedShape.lineTo(0, 3.1); rPedShape.closePath();
      const rPed = new THREE.Mesh(new THREE.ExtrudeGeometry(rPedShape, { depth: 3.4, bevelEnabled: false }).translate(0, 0, -1.7), limestoneMat);
      rPed.position.set(0, 10.95, 0.5);
      rth.add(rEnt, rPed);
      lmGroup.add(rth);
    }

    // B. Mur des Réformateurs ('Wall of the Reformers', Promenade des Bastions, -325.4, 636.7)!
    const mrX = -325.4;
    const mrZ = 636.7;
    const mrY = getGroundHeight(mrX, mrZ);
    const mr = new THREE.Group();
    mr.position.set(mrX, mrY, mrZ);
    mr.rotation.y = -0.32; // facing northwest across Parc des Bastions!

    // 52m wide monumental Jura limestone rampart wall
    const mainWall = new THREE.Mesh(new THREE.BoxGeometry(52.0, 9.6, 2.8), limestoneMat);
    mainWall.position.set(0, 4.8, 0);
    mainWall.castShadow = true;
    mainWall.receiveShadow = true;
    const coping = new THREE.Mesh(new THREE.BoxGeometry(52.8, 0.55, 3.2), graniteMat);
    coping.position.set(0, 9.8, 0);
    mr.add(mainWall, coping);

    // Iconic carved 'POST TENEBRAS LUX' frieze spanning the upper wall!
    const mottoTex = makeInscribedPlaque('POST   TENEBRAS   LUX', 'FAREL  ·  CALVIN  ·  BÈZE  ·  KNOX', '#dcd4c5', '#3b352c', 1024, 160);
    const mottoBoard = new THREE.Mesh(
      new THREE.PlaneGeometry(36.0, 2.6),
      new THREE.MeshStandardMaterial({ map: mottoTex, roughness: 0.86 })
    );
    mottoBoard.position.set(0, 7.6, -1.43);
    mottoBoard.rotation.y = Math.PI;
    mr.add(mottoBoard);

    // 4 Towering 5.2m Carved Limestone Reformer Statues (Farel, Calvin, Bèze, Knox) standing side-by-side!
    const statueXs = [-5.4, -1.8, 1.8, 5.4];
    for (const sx of statueXs) {
      const sPed = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.35, 1.55), graniteMat);
      sPed.position.set(sx, 0.72, -1.85);
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.72, 3.8, 10), limestoneMat);
      robe.position.set(sx, 3.3, -1.78);
      robe.castShadow = true;
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.85, 0.78), limestoneMat);
      shoulders.position.set(sx, 5.05, -1.78);
      const sHead = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), limestoneMat);
      sHead.position.set(sx, 5.82, -1.78);
      // Carved stone book held in front
      const bible = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.56, 0.18), limestoneMat);
      bible.position.set(sx + 0.18, 4.35, -2.28);
      mr.add(sPed, robe, shoulders, sHead, bible);
    }

    // Long stone reflecting pool running in front of the Wall of the Reformers!
    const poolCurb = new THREE.Mesh(new THREE.BoxGeometry(44.0, 0.45, 3.6), graniteMat);
    poolCurb.position.set(0, 0.22, -5.2);
    const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(42.4, 2.7).rotateX(-Math.PI / 2), waterPoolMat);
    poolWater.position.set(0, 0.47, -5.2);
    mr.add(poolCurb, poolWater);

    lmGroup.add(mr);
    insertCollider({ kind: 'obb', x: mrX, z: mrZ, yaw: -0.32, halfW: 26.2, halfL: 2.2, maxY: mrY + 10.0, walkableTop: false });

    // C. 4 Iconic Giant Outdoor Parc des Bastions Chessboards (-368, 586)!
    const chessC = document.createElement('canvas');
    chessC.width = 256;
    chessC.height = 256;
    const chCtx = chessC.getContext('2d');
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        chCtx.fillStyle = (r + c) % 2 === 0 ? '#e8e2d4' : '#262a2e';
        chCtx.fillRect(c * 32, r * 32, 32, 32);
      }
    }
    const chessTex = new THREE.CanvasTexture(chessC);
    chessTex.colorSpace = THREE.SRGBColorSpace;
    const chessBoardMat = new THREE.MeshStandardMaterial({ map: chessTex, roughness: 0.78 });
    const whitePieceMat = new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.42 });
    const blackPieceMat = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.36 });

    for (let b = 0; b < 4; b++) {
      const bx = -384 + b * 11.5;
      const bz = 588 + b * 3.8;
      const by = getGroundHeight(bx, bz) + 0.16;
      const bg = new THREE.Group();
      bg.position.set(bx, by, bz);
      bg.rotation.y = -0.32;
      const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 3.8), chessBoardMat);
      board.receiveShadow = true;
      bg.add(board);

      // 8 sculpted giant outdoor chess pieces mid-game on each board!
      const pieces = [
        [-1.1, -1.1, 0.95, whitePieceMat], [0.2, -0.6, 0.72, whitePieceMat], [1.1, -0.2, 0.82, whitePieceMat], [-0.4, 0.2, 0.62, whitePieceMat],
        [-0.9, 1.1, 0.95, blackPieceMat], [0.6, 0.8, 0.84, blackPieceMat], [1.2, 0.5, 0.68, blackPieceMat], [-0.2, 0.6, 0.62, blackPieceMat],
      ];
      for (const [px, pz, ph, pMat] of pieces) {
        const pBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, ph, 10), pMat);
        pBase.position.set(px, 0.06 + ph * 0.5, pz);
        pBase.castShadow = true;
        const pTop = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), pMat);
        pTop.position.set(px, 0.08 + ph + 0.08, pz);
        bg.add(pBase, pTop);
      }
      lmGroup.add(bg);
    }
  }

  // =================================================================================================
  // 6. VIEILLE-VILLE — CATHÉDRALE SAINT-PIERRE 6-COLUMN PORTICO + FONTAINE DU BOURG-DE-FOUR!
  // =================================================================================================
  {
    // A. Cathédrale Saint-Pierre Unmistakable 18th-Century Greco-Roman 6-Column Corinthian Portico!
    // Snapped to exact west facade midpoint (-155.8, 525.8) with exact outward normal (-0.906, -0.423 -> -2.01 rad) facing Cour de Saint-Pierre!
    const cpX = -155.8;
    const cpZ = 525.8;
    const cpY = getGroundHeight(cpX, cpZ);
    const cp = new THREE.Group();
    cp.position.set(cpX, cpY - 0.3, cpZ);
    cp.rotation.y = -2.01; // exact perpendicular outward normal facing WNW straight onto Cour de Saint-Pierre!

    // Broad classical carved limestone staircase
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(20.6 - s * 0.6, 0.34, 6.2 - s * 0.55), limestoneMat);
      step.position.set(0, s * 0.32 + 0.17, 1.8 - s * 0.25);
      step.receiveShadow = true;
      cp.add(step);
    }
    // 6 monumental fluted Corinthian columns across the portico front with molded Attic plinths & Corinthian capitals!
    for (let i = 0; i < 6; i++) {
      const cx = -8.25 + i * 3.3;
      const colBase = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.15, 1.62), graniteMat);
      colBase.position.set(cx, 2.05, 2.2);
      const colTorus = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.14, 8, 16).rotateX(Math.PI / 2), limestoneMat);
      colTorus.position.set(cx, 2.68, 2.2);
      const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.66, 12.6, 16), limestoneMat);
      colShaft.position.set(cx, 8.95, 2.2);
      colShaft.castShadow = true;
      colShaft.receiveShadow = true;
      const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.58, 1.15, 14), marbleTrimMat);
      colCap.position.set(cx, 15.65, 2.2);
      const abacus = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.28, 1.75), limestoneMat);
      abacus.position.set(cx, 16.32, 2.2);
      cp.add(colBase, colTorus, colShaft, colCap, abacus);
    }

    // Monumental arched oak-and-bronze Cathedral Portal Doors recessed cleanly behind the 6 Corinthian columns!
    const portalBackdrop = new THREE.Mesh(new THREE.BoxGeometry(19.6, 16.4, 0.9), limestoneMat);
    portalBackdrop.position.set(0, 9.2, -1.85);
    portalBackdrop.receiveShadow = true;
    cp.add(portalBackdrop);
    for (const [dx, dw, dh] of [[-5.6, 2.6, 5.2], [0, 4.0, 6.8], [5.6, 2.6, 5.2]]) {
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.7, dh + 0.5, 0.36), graniteMat);
      doorFrame.position.set(dx, 1.6 + dh * 0.5, -1.32);
      const doorWood = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.42), oakPortalMat);
      doorWood.position.set(dx, 1.6 + dh * 0.5, -1.28);
      const doorArch = new THREE.Mesh(new THREE.CylinderGeometry(dw * 0.5, dw * 0.5, 0.42, 16).rotateX(Math.PI / 2), oakPortalMat);
      doorArch.position.set(dx, 1.6 + dh, -1.28);
      const doorRim = new THREE.Mesh(new THREE.TorusGeometry(dw * 0.54, 0.16, 8, 16, Math.PI), marbleTrimMat);
      doorRim.position.set(dx, 1.6 + dh, -1.22);
      cp.add(doorFrame, doorWood, doorArch, doorRim);
    }
    // Carved classical stone architrave frieze + recessed shadowed triangular Greco-Roman tympanum pediment!
    const entab = new THREE.Mesh(new THREE.BoxGeometry(20.6, 2.45, 5.4), limestoneMat);
    entab.position.set(0, 17.55, 0.4);
    entab.castShadow = true;
    const corniceLip = new THREE.Mesh(new THREE.BoxGeometry(21.4, 0.42, 5.95), marbleTrimMat);
    corniceLip.position.set(0, 18.82, 0.45);
    const cathFrieze = new THREE.Mesh(
      new THREE.PlaneGeometry(16.0, 1.25),
      new THREE.MeshStandardMaterial({
        map: makeInscribedPlaque('CATHÉDRALE SAINT-PIERRE', 'GENÈVE · XIIe – XVIIIe SIÈCLE', '#cfc5b2', '#3a342a', 768, 128),
        roughness: 0.78,
      })
    );
    cathFrieze.position.set(0, 17.55, 3.14);

    const pedShape = new THREE.Shape();
    pedShape.moveTo(-10.7, 0);
    pedShape.lineTo(10.7, 0);
    pedShape.lineTo(0, 4.65);
    pedShape.closePath();
    const pedGeo = new THREE.ExtrudeGeometry(pedShape, { depth: 5.0, bevelEnabled: false });
    pedGeo.translate(0, 0, -2.5);
    const pediment = new THREE.Mesh(pedGeo, limestoneMat);
    pediment.position.set(0, 18.95, 0.4);
    pediment.castShadow = true;
    // Recessed darker inner tympanum triangle framed cleanly inside the raking pediment moldings!
    const innerShape = new THREE.Shape();
    innerShape.moveTo(-8.8, 0.35);
    innerShape.lineTo(8.8, 0.35);
    innerShape.lineTo(0, 3.85);
    innerShape.closePath();
    const innerTymp = new THREE.Mesh(new THREE.ShapeGeometry(innerShape), darkStoneMat);
    innerTymp.position.set(0, 18.95, 2.94);
    // Golden sunburst relief centered inside the shadowed triangular tympanum!
    const sunburst = new THREE.Mesh(new THREE.CircleGeometry(1.18, 20), goldMat);
    sunburst.position.set(0, 20.65, 3.00);
    cp.add(entab, corniceLip, cathFrieze, pediment, innerTymp, sunburst);
    lmGroup.add(cp);

    // B. Place du Bourg-de-Four Historic 18th-Century Flower Fountain (-77.1, 632.4)!
    const bfX = -77.1;
    const bfZ = 632.4;
    const bfY = getGroundHeight(bfX, bfZ);
    const bf = new THREE.Group();
    bf.position.set(bfX, bfY + 0.14, bfZ);

    const bfBasin = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.95, 0.96, 12), graniteMat);
    bfBasin.position.y = 0.48;
    bfBasin.castShadow = true;
    bfBasin.receiveShadow = true;
    const bfRim = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.24, 8, 16).rotateX(Math.PI / 2), limestoneMat);
    bfRim.position.y = 0.96;
    const bfWater = new THREE.Mesh(new THREE.CircleGeometry(2.48, 16).rotateX(-Math.PI / 2), waterPoolMat);
    bfWater.position.y = 0.88;
    const bfObelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.56, 3.65, 8), limestoneMat);
    bfObelisk.position.y = 2.15;
    bfObelisk.castShadow = true;
    const bfUrn = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), graniteMat);
    bfUrn.position.y = 4.18;
    // Iconic vibrant red & pink Geneva geraniums cascading around the Bourg-de-Four fountain pillar!
    const gerRed = new THREE.MeshStandardMaterial({ color: 0xd6243a, roughness: 0.78 });
    const gerPink = new THREE.MeshStandardMaterial({ color: 0xe66284, roughness: 0.78 });
    const gerLeaf = new THREE.MeshStandardMaterial({ color: 0x2d622b, roughness: 0.88 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.44, 8, 6), gerLeaf);
      leaf.position.set(Math.cos(a) * 0.72, 1.38, Math.sin(a) * 0.72);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), k % 2 === 0 ? gerRed : gerPink);
      bloom.position.set(Math.cos(a) * 0.88, 1.62, Math.sin(a) * 0.88);
      bf.add(leaf, bloom);
    }
    bf.add(bfBasin, bfRim, bfWater, bfObelisk, bfUrn);
    lmGroup.add(bf);
    insertCollider({ kind: 'cyl', x: bfX, z: bfZ, r: 2.9, maxY: bfY + 4.5, walkableTop: false });
  }

  // =================================================================================================
  // 7. BAINS DES PÂQUIS — TIMBER BATHING DECKS, BUVETTE/SAUNA PAVILION & 10M DIVING BOARD TOWER!
  // =================================================================================================
  {
    const bpX = 445.0;
    const bpZ = -504.0;
    const bp = new THREE.Group();
    bp.position.set(bpX, 1.65, bpZ);
    bp.rotation.y = 1.24; // aligned seamlessly along the Bains des Pâquis lakeside jetty toward Le Phare!

    // Sun-weathered lakeside wooden bathing sundeck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(22.0, 0.36, 46.0), timberMat);
    deck.position.set(0, -0.1, 0);
    deck.receiveShadow = true;
    bp.add(deck);

    // Classic wooden Buvette des Bains & Sauna pavilion with pitched timber roof
    const buvette = new THREE.Mesh(new THREE.BoxGeometry(10.5, 3.8, 16.5), timberMat);
    buvette.position.set(-4.2, 1.9, -4.0);
    buvette.castShadow = true;
    buvette.receiveShadow = true;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(10.2, 2.8, 4).rotateY(Math.PI / 4),
      new THREE.MeshStandardMaterial({ color: 0x3b444e, roughness: 0.72 })
    );
    roof.scale.set(0.85, 1, 1.35);
    roof.position.set(-4.2, 5.1, -4.0);
    roof.castShadow = true;
    const bSign = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.85, 0.14),
      new THREE.MeshStandardMaterial({
        map: makeInscribedPlaque('BAINS DES PÂQUIS', 'BUVETTE · SAUNA · GENÈVE', '#143b6b', '#ffffff'),
        roughness: 0.4,
      })
    );
    bSign.position.set(1.12, 3.35, -4.0);
    bSign.rotation.y = Math.PI * 0.5;
    bp.add(buvette, roof, bSign);

    // Iconic 10m Bains des Pâquis Multi-Tier Diving Board Tower (3m, 5m & 10m planks over Lac Léman!)
    const whiteSteel = new THREE.MeshStandardMaterial({ color: 0xedf2f7, roughness: 0.35, metalness: 0.55 });
    const diveGroup = new THREE.Group();
    diveGroup.position.set(9.8, 0, 14.5);
    for (const sx of [-0.9, 0.9]) {
      for (const sz of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 10.2, 8), whiteSteel);
        leg.position.set(sx, 5.1, sz);
        leg.castShadow = true;
        diveGroup.add(leg);
      }
    }
    for (const [py, len] of [[3.0, 3.4], [5.4, 3.8], [9.8, 4.4]]) {
      const plat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 2.2), whiteSteel);
      plat.position.set(0, py, 0);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.10, len),
        new THREE.MeshStandardMaterial({ color: 0x2268a8, roughness: 0.5 })
      );
      board.position.set(len * 0.5, py + 0.12, 0);
      board.rotation.y = Math.PI * 0.5;
      board.castShadow = true;
      diveGroup.add(plat, board);
    }
    bp.add(diveGroup);
    lmGroup.add(bp);
  }

  // Merge all static stone, marble, granite, bronze, gold & timber monument parts by material (~420 draw calls -> ~16 draw calls!)
  // Keep ONLY animated Horloge Fleurie clock hands & Fontaine des Quatre-Saisons water spray rings unbatched!
  if (hourHand) hourHand.userData.noBatch = true;
  if (minHand) minHand.userData.noBatch = true;
  if (secHand) secHand.userData.noBatch = true;
  for (const sp of animatedSprayRings) sp.userData.noBatch = true;
  batchStaticGroup(lmGroup, { label: 'GenevaLandmarksBatch' });

  function update(elapsed, nightFactor) {
    // Live Swiss Horloge Fleurie hands!
    if (hourHand && minHand && secHand) {
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      const m = now.getMinutes() + s / 60;
      const h = (now.getHours() % 12) + m / 60;
      hourHand.rotation.y = -(h / 12) * Math.PI * 2;
      minHand.rotation.y = -(m / 60) * Math.PI * 2;
      secHand.rotation.y = -(s / 60) * Math.PI * 2;
    }
    // Gentle shimmer on Fontaine des Quatre-Saisons water spray
    for (let i = 0; i < animatedSprayRings.length; i++) {
      const sp = animatedSprayRings[i];
      sp.rotation.y = elapsed * (0.8 + i * 0.35);
      sp.scale.y = 0.96 + Math.sin(elapsed * 5.2 + i * 1.4) * 0.05;
    }
    // Glow Place du Molard blue multilingual pavers & Tour du Molard clock brightly at twilight/night!
    const nightBoost = 0.48 + Math.max(0, (nightFactor - 0.15) / 0.85) * 1.35;
    for (let i = 0; i < nightPaverMats.length; i++) {
      nightPaverMats[i].emissiveIntensity = nightBoost;
    }
  }

  return { group: lmGroup, update };
}
