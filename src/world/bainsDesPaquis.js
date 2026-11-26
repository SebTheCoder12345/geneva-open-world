import * as THREE from 'three';
import { batchStaticGroup } from './staticBatcher.js';

// =================================================================================================
// LES BAINS DES PÂQUIS — GENEVA'S ICONIC SUMMER LAKESIDE HOTSPOT (1:1 Jetée des Pâquis!)
// - Wide sun-bleached cedar timber bathing decks, stepped sunbathing bleachers & pebble beach cove
// - Authentic Buvette des Bains pavilion, chalkboard menu, striped changing cabanas & café string lights
// - Colorful striped summer parasols, communal Swiss picnic tables, wooden sun-loungers & beach towels
// - Iconic 3m / 5m / 10m white-steel diving tower, chrome swim ladders & Swiss lifebuoys
// - Yellow floating swim-zone buoy bay, bobbing wooden swim pontoon raft, SUPs & inflatable rings
// - 42+ lively animated summer people: 18 sunbathers on towels/loungers, 12 swimmers in Lac Léman,
//   and 12 Buvette/pier locals chatting, relaxing & enjoying summer by the Jet d'Eau!
// =================================================================================================

function createCedarDeckTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c5ab86';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 7711;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const planks = 12;
  const pw = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const tone = Math.round((rand() - 0.5) * 26);
    const r = Math.min(228, Math.max(156, 198 + tone));
    const g = Math.min(206, Math.max(134, 172 + tone));
    const b = Math.min(176, Math.max(106, 136 + tone));
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x + 1.5, 0, pw - 3, 512);
    // Subtle sun-bleached timber grain streaks
    for (let s = 0; s < 14; s++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,248,234,0.12)' : 'rgba(92,70,46,0.11)';
      ctx.fillRect(x + 2 + rand() * (pw - 5), 0, 1.4, 512);
    }
    // Plank butt joints
    const jy = Math.floor(rand() * 380) + 64;
    ctx.fillStyle = 'rgba(66,50,34,0.45)';
    ctx.fillRect(x + 1, jy, pw - 2, 2);
  }
  ctx.fillStyle = 'rgba(58,44,30,0.48)';
  for (let i = 0; i <= planks; i++) {
    ctx.fillRect(i * pw - 1, 0, 2.2, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 16);
  tex.anisotropy = 12;
  return tex;
}

function createPebbleBeachTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d6c7a5';
  ctx.fillRect(0, 0, 512, 512);
  let seed = 9187;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const cols = ['#e6dbc0', '#cbb996', '#b8ab92', '#9ea19e', '#dfd2b4', '#a49580', '#efe5cc'];
  for (let i = 0; i < 4200; i++) {
    ctx.fillStyle = cols[Math.floor(rand() * cols.length)];
    const x = rand() * 512;
    const y = rand() * 512;
    const rx = 2 + rand() * 5.2;
    const ry = 1.6 + rand() * 3.8;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 5);
  tex.anisotropy = 8;
  return tex;
}

function createStripedFabricTexture(colA, colB, stripes = 10) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const sw = 256 / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colA : colB;
    ctx.fillRect(i * sw, 0, sw + 0.5, 256);
  }
  // Subtle woven linen grain
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 256, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBainsSignTexture(title, subtitle, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 496, 112);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'bold 42px "Georgia", serif';
  ctx.fillText(title, 256, 62);
  ctx.font = 'bold 20px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(subtitle, 256, 98);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBuvetteMenuTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 320;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e2426';
  ctx.fillRect(0, 0, 256, 320);
  ctx.strokeStyle = '#8b6542';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, 246, 310);
  ctx.fillStyle = '#ffd984';
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px "Georgia", serif';
  ctx.fillText('BUVETTE DES BAINS', 128, 46);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(32, 60);
  ctx.lineTo(224, 60);
  ctx.stroke();
  ctx.fillStyle = '#f2f5f7';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('PLAT DU JOUR    14.–', 128, 98);
  ctx.fillText('SALADE D\'ÉTÉ    12.–', 128, 134);
  ctx.fillText('FONDUE LAC      26.–', 128, 170);
  ctx.fillText('SPRITZ / BIÈRE   6.50', 128, 206);
  ctx.fillText('GLACE ARTISAN.   4.50', 128, 242);
  ctx.fillStyle = '#7ad4ff';
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillText('Eau du Lac : 23°C · Soleil', 128, 286);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildBainsDesPaquis(worldGroup, insertCollider = null, registerInteractable = null) {
  const bpX = 445.0;
  const bpZ = -504.0;
  const bpYaw = 1.24; // Local +Z = along Jetée toward Le Phare | +X = North into Lac Léman | -X = South toward Jet d'Eau!
  const deckTopY = 1.945; // 1cm flush under player floorY (getGroundHeight 1.70 + 0.255 = 1.955!)

  const root = new THREE.Group();
  root.name = 'Geneva_Bains_Des_Paquis';
  root.position.set(bpX, 0, bpZ);
  root.rotation.y = bpYaw;
  worldGroup.add(root);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  root.add(staticGroup, dynamicGroup);

  const cosY = Math.cos(bpYaw);
  const sinY = Math.sin(bpYaw);
  const toWorld = (lx, lz) => [bpX + cosY * lx + sinY * lz, bpZ - sinY * lx + cosY * lz];

  // Shared high-craft summer lakeside materials
  const cedarTex = createCedarDeckTexture();
  const cedarMat = new THREE.MeshStandardMaterial({ map: cedarTex, roughness: 0.78, metalness: 0.04 });
  const warmTimberMat = new THREE.MeshStandardMaterial({ color: 0x9b7148, roughness: 0.76, metalness: 0.05 });
  const darkTimberMat = new THREE.MeshStandardMaterial({ color: 0x62452b, roughness: 0.80, metalness: 0.04 });
  const seawallMat = new THREE.MeshStandardMaterial({ color: 0x8e8b82, roughness: 0.90, metalness: 0.04 });
  const pebbleMat = new THREE.MeshStandardMaterial({ map: createPebbleBeachTexture(), roughness: 0.92, metalness: 0.02 });
  const zincRoofMat = new THREE.MeshStandardMaterial({ color: 0x454f59, roughness: 0.52, metalness: 0.45 });
  const whiteSteelMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.30, metalness: 0.58 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdbe3ec, roughness: 0.16, metalness: 0.92 });
  const blueBoardMat = new THREE.MeshStandardMaterial({ color: 0x1e74b8, roughness: 0.42, metalness: 0.12 });
  const buoyYellowMat = new THREE.MeshStandardMaterial({ color: 0xffc814, roughness: 0.32, metalness: 0.08 });
  const buoyRedMat = new THREE.MeshStandardMaterial({ color: 0xd9262e, roughness: 0.35, metalness: 0.08 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c2, roughness: 0.88 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4b7438, roughness: 0.85 });
  const terracottaMat = new THREE.MeshStandardMaterial({ color: 0xb95f3c, roughness: 0.82 });
  const glassBottleMat = new THREE.MeshStandardMaterial({ color: 0x2a8f65, roughness: 0.18, metalness: 0.15 });
  const whitePaintMat = new THREE.MeshStandardMaterial({ color: 0xf6f7f9, roughness: 0.52 });
  const navyPaintMat = new THREE.MeshStandardMaterial({ color: 0x1c4578, roughness: 0.50 });

  // Vibrant summer parasol & beach towel fabrics (shared across all umbrellas/towels for tight draw calls!)
  const parasolMats = [
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#1598b5', '#faf8f2', 12), roughness: 0.74, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#e05646', '#faf8f2', 12), roughness: 0.74, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#f0b624', '#fffaf0', 12), roughness: 0.74, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#1e4b84', '#faf8f2', 12), roughness: 0.74, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#2c946b', '#faf8f2', 12), roughness: 0.74, side: THREE.DoubleSide }),
  ];
  const towelMats = [
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#1cb5d1', '#ffffff', 8), roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#f06458', '#fff5ea', 8), roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#f6c32c', '#ffffff', 8), roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#244f8c', '#f4f7fb', 10), roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#e878a8', '#fff8fc', 8), roughness: 0.88 }),
    new THREE.MeshStandardMaterial({ map: createStripedFabricTexture('#2ca87a', '#f7fff9', 8), roughness: 0.88 }),
  ];

  // ===============================================================================================
  // 1. EXPANDED TIMBER BATHING PIER, STONE BREAKWATER, STEPPED SUN-BLEACHERS & PEBBLE BEACH COVE!
  // ===============================================================================================
  // Stone breakwater foundation rising cleanly out of Lac Léman
  const seawall = new THREE.Mesh(new THREE.BoxGeometry(27.0, 2.9, 94.0), seawallMat);
  seawall.position.set(0, 0.28, 0);
  seawall.receiveShadow = true;
  staticGroup.add(seawall);

  // Main wide sun-bleached cedar timber bathing sundeck (top at y = deckTopY = 1.945m!)
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(26.6, 0.34, 93.0), cedarMat);
  mainDeck.position.set(0, deckTopY - 0.17, 0);
  mainDeck.receiveShadow = true;
  mainDeck.castShadow = true;
  staticGroup.add(mainDeck);

  // Extended timber walkway bridge linking cleanly west toward Quai du Mont-Blanc & east toward Le Phare
  const westApproach = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.32, 34.0), cedarMat);
  westApproach.position.set(-1.5, deckTopY - 0.16, -62.0);
  westApproach.receiveShadow = true;
  const eastApproach = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.32, 34.0), cedarMat);
  eastApproach.position.set(0, deckTopY - 0.16, 62.0);
  eastApproach.receiveShadow = true;
  staticGroup.add(westApproach, eastApproach);

  // Register solid walkableTop timber deck colliders across the full Bains des Pâquis pier & approaches
  // so players NEVER sink through overhanging wooden deck planks where the underlying lakebed slopes down!
  if (insertCollider) {
    insertCollider({ kind: 'obb', x: bpX, z: bpZ, yaw: bpYaw, halfW: 13.3, halfL: 46.5, maxY: deckTopY + 0.01, walkableTop: true });
    const [wx, wz] = toWorld(-1.5, -62.0);
    insertCollider({ kind: 'obb', x: wx, z: wz, yaw: bpYaw, halfW: 5.75, halfL: 17.0, maxY: deckTopY + 0.01, walkableTop: true });
    const [ex, ez] = toWorld(0, 62.0);
    insertCollider({ kind: 'obb', x: ex, z: ez, yaw: bpYaw, halfW: 5.25, halfL: 17.0, maxY: deckTopY + 0.01, walkableTop: true });
  }

  // Iconic South-Facing Wooden Amphitheater Sunbathing Bleacher Steps (facing the Jet d'Eau & Alps!)
  for (let tier = 0; tier < 3; tier++) {
    const stepW = 1.15;
    const stepY = deckTopY - 0.28 - tier * 0.46;
    const stepX = -13.3 - (tier + 0.5) * stepW;
    const bleacher = new THREE.Mesh(new THREE.BoxGeometry(stepW + 0.1, 0.48, 48.0), cedarMat);
    bleacher.position.set(stepX, stepY, 16.0);
    bleacher.receiveShadow = true;
    bleacher.castShadow = true;
    staticGroup.add(bleacher);
  }

  // Golden Pebble & Sand Beach Cove ('Plage des Pâquis') on south-west edge sloping softly into Lac Léman!
  const beachSlope = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.55, 24.0), pebbleMat);
  beachSlope.position.set(-15.8, 0.92, -26.0);
  beachSlope.rotation.z = 0.24;
  beachSlope.receiveShadow = true;
  const beachFlat = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.40, 24.0), pebbleMat);
  beachFlat.position.set(-11.4, deckTopY - 0.19, -26.0);
  beachFlat.receiveShadow = true;
  staticGroup.add(beachSlope, beachFlat);

  // North lakeside timber edge coping & low safety timber bollards
  for (let bz = -42; bz <= 42; bz += 8.4) {
    for (const bx of [12.9, -12.9]) {
      if (bx < 0 && bz < -12) continue;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.62, 8), darkTimberMat);
      post.position.set(bx, deckTopY + 0.31, bz);
      post.castShadow = true;
      staticGroup.add(post);
    }
  }

  // ===============================================================================================
  // 2. AUTHENTIC BUVETTE DES BAINS PAVILION, CHANGING CABANAS & FESTIVE CAFÉ STRING LIGHTS!
  // ===============================================================================================
  const buvX = -2.2;
  const buvZ = -24.5;
  // Main weathered-timber Buvette building with wide overhanging lakeside veranda
  const buvMain = new THREE.Mesh(new THREE.BoxGeometry(10.8, 3.55, 17.0), warmTimberMat);
  buvMain.position.set(buvX, deckTopY + 1.775, buvZ);
  buvMain.castShadow = true;
  buvMain.receiveShadow = true;
  const buvRoof = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.28, 21.4), zincRoofMat);
  buvRoof.position.set(buvX + 1.1, deckTopY + 3.72, buvZ);
  buvRoof.rotation.z = -0.05;
  buvRoof.castShadow = true;
  // Veranda timber support posts
  for (const pz of [-9.4, -4.7, 0, 4.7, 9.4]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.65, 0.22), darkTimberMat);
    col.position.set(buvX + 7.6, deckTopY + 1.825, buvZ + pz);
    col.castShadow = true;
    staticGroup.add(col);
  }
  // Open Buvette serving counter window + dark interior shadow + counter ledge + chalkboard menu
  const serveBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 1.55, 7.2),
    new THREE.MeshStandardMaterial({ color: 0x261c14, roughness: 0.9 })
  );
  serveBack.position.set(buvX + 5.38, deckTopY + 1.95, buvZ + 1.0);
  const counterLedge = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.14, 7.6), cedarMat);
  counterLedge.position.set(buvX + 5.75, deckTopY + 1.12, buvZ + 1.0);
  counterLedge.castShadow = true;
  const menuBoard = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 1.38, 1.12),
    new THREE.MeshStandardMaterial({ map: createBuvetteMenuTexture(), roughness: 0.72 })
  );
  menuBoard.position.set(buvX + 5.52, deckTopY + 1.95, buvZ - 4.4);
  // Iconic blue/white 'BAINS DES PÂQUIS · BUVETTE' overhead roof sign!
  const buvSignMat = new THREE.MeshStandardMaterial({
    map: createBainsSignTexture('BAINS DES PÂQUIS', 'BUVETTE · PLAGE · SAUNA · GENÈVE', '#144278', '#ffffff'),
    roughness: 0.38,
  });
  const buvSign = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 6.8), buvSignMat);
  buvSign.position.set(buvX + 8.35, deckTopY + 3.45, buvZ);
  // Charming terrace-facing (+Z) Buvette facade with striped blue/white awning, serving window & sign (no blank back wall!)
  const frontAwning = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 2.2), parasolMats[3]);
  frontAwning.position.set(buvX, deckTopY + 2.85, buvZ + 9.45);
  frontAwning.rotation.x = 0.28;
  frontAwning.castShadow = true;
  const frontWin = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.45, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x221912, roughness: 0.88 })
  );
  frontWin.position.set(buvX, deckTopY + 1.85, buvZ + 8.54);
  const frontBar = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.14, 0.72), cedarMat);
  frontBar.position.set(buvX, deckTopY + 1.08, buvZ + 8.85);
  frontBar.castShadow = true;
  const frontSign = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.88, 0.16), buvSignMat);
  frontSign.position.set(buvX, deckTopY + 3.42, buvZ + 8.62);
  const frontMenu = new THREE.Mesh(
    new THREE.BoxGeometry(1.12, 1.38, 0.10),
    new THREE.MeshStandardMaterial({ map: createBuvetteMenuTexture(), roughness: 0.72 })
  );
  frontMenu.position.set(buvX + 4.35, deckTopY + 1.75, buvZ + 8.58);
  staticGroup.add(buvMain, buvRoof, serveBack, counterLedge, menuBoard, buvSign, frontAwning, frontWin, frontBar, frontSign, frontMenu);

  // Solid OBB collider for Buvette pavilion so player can't clip inside walls
  if (insertCollider) {
    const [wx, wz] = toWorld(buvX, buvZ);
    insertCollider({ kind: 'obb', x: wx, z: wz, yaw: bpYaw, halfW: 5.5, halfL: 8.6, maxY: deckTopY + 4.2, walkableTop: false });
  }

  // Row of charming retro Swiss White & Navy Striped Changing Cabanas along north-west side!
  for (let c = 0; c < 6; c++) {
    const cz = -34.5 + c * 2.55;
    const cx = 10.6;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.45, 2.3), whitePaintMat);
    cab.position.set(cx, deckTopY + 1.225, cz);
    cab.castShadow = true;
    cab.receiveShadow = true;
    const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.05, 1.05), c % 2 === 0 ? navyPaintMat : parasolMats[0]);
    cabDoor.position.set(cx - 1.11, deckTopY + 1.08, cz);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.16, 2.48), navyPaintMat);
    cabRoof.position.set(cx - 0.1, deckTopY + 2.52, cz);
    cabRoof.rotation.z = 0.08;
    staticGroup.add(cab, cabDoor, cabRoof);
  }
  if (insertCollider) {
    const [wx, wz] = toWorld(10.6, -28.1);
    insertCollider({ kind: 'obb', x: wx, z: wz, yaw: bpYaw, halfW: 1.25, halfL: 7.8, maxY: deckTopY + 2.7, walkableTop: false });
  }
  // Interactive Changing Cabana: swap cleanly between Savile Row Banker Suit & Riviera Summer Swimwear!
  if (registerInteractable) {
    const [cxW, czW] = toWorld(8.6, -28.0);
    registerInteractable({
      id: 'bains_changing_cabana',
      type: 'cabana_outfit',
      label: 'CHANGE OUTFIT · SWIMWEAR / SUIT',
      subtitle: 'Changed outfit at the Bains des Pâquis cabanas! (Tip: press O anytime to toggle)',
      toast: 'BAINS DES PÂQUIS · CABINE',
      x: cxW,
      y: deckTopY,
      z: czW,
      rimRadius: 1.1,
      persistent: false,
      duration: 1.2,
      radius: 2.8,
      priority: 1.2,
    });
  }

  // Outdoor lakeside chrome freshwater shower post
  const shPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.45, 8), chromeMat);
  shPost.position.set(10.5, deckTopY + 1.225, -16.2);
  const shArm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8).rotateZ(Math.PI * 0.5), chromeMat);
  shArm.position.set(10.22, deckTopY + 2.36, -16.2);
  staticGroup.add(shPost, shArm);

  // ===============================================================================================
  // 3. LIVELY SUMMER BUVETTE TERRACE: COMMUNAL PICNIC TABLES, STRIPED PARASOLS & CAFÉ STRING LIGHTS!
  // ===============================================================================================
  const picnicSpots = [
    [-4.8, -5.5, 0, 0],
    [2.6, -5.5, 0, 1],
    [-4.8, 1.5, 0, 2],
    [2.6, 1.5, 0, 3],
    [-4.8, 8.2, 0, 4],
    [2.6, 8.2, 0, 0],
    [8.2, -5.5, Math.PI * 0.5, 1],
    [8.2, 2.0, Math.PI * 0.5, 2],
  ];
  picnicSpots.forEach(([tx, tz, rot, pIdx], idx) => {
    const tg = new THREE.Group();
    tg.position.set(tx, deckTopY, tz);
    tg.rotation.y = rot;
    // Swiss communal wooden picnic table + 2 side benches
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.92), warmTimberMat);
    top.position.y = 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    for (const bx of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.74, 0.86), darkTimberMat);
      leg.position.set(bx, 0.37, 0);
      tg.add(leg);
    }
    for (const bz of [-0.88, 0.88]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.07, 0.34), warmTimberMat);
      bench.position.set(0, 0.45, bz);
      bench.castShadow = true;
      tg.add(bench);
    }
    // Colorful drinks & summer plates on the table
    for (const [dx, dz] of [[-0.55, 0.12], [0.45, -0.15], [0.05, 0.20]]) {
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.14, 8), glassBottleMat);
      glass.position.set(dx, 0.87, dz);
      tg.add(glass);
    }
    // Big sunlit striped summer parasol overhead!
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 2.75, 8), darkTimberMat);
    pole.position.y = 1.38;
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.05, 0.62, 10), parasolMats[pIdx % parasolMats.length]);
    canopy.position.y = 2.74;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    tg.add(top, pole, canopy);
    staticGroup.add(tg);

    if (insertCollider) {
      const [wx, wz] = toWorld(tx, tz);
      insertCollider({ kind: 'obb', x: wx, z: wz, yaw: bpYaw + rot, halfW: 1.35, halfL: 1.05, maxY: deckTopY + 1.0, walkableTop: true });
    }
    if (registerInteractable && idx < 4) {
      const [wx, wz] = toWorld(tx, tz + 0.88);
      const [ex, ez] = toWorld(tx, tz + 2.05);
      registerInteractable({
        id: `bains_buvette_table_${idx}`,
        type: 'cafe_chair',
        label: 'RELAX AT BUVETTE DES BAINS',
        activeLabel: 'STAND UP',
        subtitle: 'Enjoying a summer drink at Buvette des Bains facing Lac Léman… (E or WASD to stand)',
        toast: 'BUVETTE DES BAINS · GENÈVE',
        x: wx,
        y: deckTopY,
        z: wz,
        yaw: bpYaw + Math.PI,
        exitX: ex,
        exitZ: ez,
        persistent: true,
        radius: 2.8,
        priority: 1.15,
      });
    }
  });

  // Potted Mediterranean olive/oleander planters framing the Buvette terrace
  for (const [px, pz] of [[-9.2, -9.5], [-9.2, 2.0], [-9.2, 12.0], [10.8, -9.5], [10.8, 2.5], [10.8, 12.0]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.30, 0.56, 10), terracottaMat);
    pot.position.set(px, deckTopY + 0.28, pz);
    pot.castShadow = true;
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), leafMat);
    bush.position.set(px, deckTopY + 0.88, pz);
    bush.scale.set(1.0, 1.25, 1.0);
    bush.castShadow = true;
    staticGroup.add(pot, bush);
  }

  // Festive overhead warm café string lights crisscrossing the Buvette terrace (glowing at golden hour & night!)
  const stringBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c6,
    emissive: 0xffb84d,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });
  const stringPoleCoords = [[-8.6, -9.0], [9.5, -9.0], [-8.6, 1.5], [9.5, 1.5], [-8.6, 12.0], [9.5, 12.0]];
  for (const [px, pz] of stringPoleCoords) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.1, 8), darkTimberMat);
    pole.position.set(px, deckTopY + 2.05, pz);
    staticGroup.add(pole);
  }
  const stringSpans = [
    [[-8.6, -9.0], [9.5, -9.0]],
    [[-8.6, 1.5], [9.5, 1.5]],
    [[-8.6, 12.0], [9.5, 12.0]],
    [[-8.6, -9.0], [9.5, 1.5]],
    [[9.5, -9.0], [-8.6, 1.5]],
    [[-8.6, 1.5], [9.5, 12.0]],
  ];
  const bulbCoords = [];
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x1e2228, roughness: 0.7, metalness: 0.35 });
  for (const [[x1, z1], [x2, z2]] of stringSpans) {
    const steps = 10;
    let prevPt = new THREE.Vector3(x1, deckTopY + 3.95, z1);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const sag = Math.sin(t * Math.PI) * 0.48;
      const curPt = new THREE.Vector3(x1 + (x2 - x1) * t, deckTopY + 3.95 - sag, z1 + (z2 - z1) * t);
      // Visible taut black festoon cable segment connecting every bulb cleanly to the timber poles!
      const segVec = new THREE.Vector3().subVectors(curPt, prevPt);
      const segLen = segVec.length();
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, segLen, 5), cableMat);
      wire.position.copy(prevPt).add(curPt).multiplyScalar(0.5);
      wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), segVec.normalize());
      staticGroup.add(wire);
      if (s < steps) {
        // Tiny dark festoon bulb socket bridging directly down from the taut cable into the warm bulb!
        const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.020, 0.055, 6), cableMat);
        socket.position.set(curPt.x, curPt.y - 0.026, curPt.z);
        staticGroup.add(socket);
        bulbCoords.push([curPt.x, curPt.y - 0.068, curPt.z]);
      }
      prevPt = curPt;
    }
  }
  const bulbInst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042, 6, 5), stringBulbMat, bulbCoords.length);
  const bDummy = new THREE.Object3D();
  bulbCoords.forEach(([bx, by, bz], i) => {
    bDummy.position.set(bx, by, bz);
    bDummy.rotation.set(0, 0, 0);
    bDummy.scale.set(1, 1, 1);
    bDummy.updateMatrix();
    bulbInst.setMatrixAt(i, bDummy.matrix);
  });
  dynamicGroup.add(bulbInst);

  // ===============================================================================================
  // 4. SUNBATHING ZONE: WOODEN DECK LOUNGERS, COLORFUL BEACH TOWELS, BEACH PARASOLS & ACCESSORIES!
  // ===============================================================================================
  // 8 Slatted wooden sun-loungers facing south toward the Jet d'Eau + interactive sunbathing spots!
  const loungerSpots = [
    [-9.2, 16.5, -Math.PI * 0.5, 0],
    [-9.2, 19.2, -Math.PI * 0.5, 1],
    [-9.2, 22.8, -Math.PI * 0.5, 2],
    [-9.2, 25.5, -Math.PI * 0.5, 3],
    [-9.2, 29.2, -Math.PI * 0.5, 4],
    [-9.2, 31.9, -Math.PI * 0.5, 5],
    [8.2, 16.5, Math.PI * 0.5, 0],
    [8.2, 19.5, Math.PI * 0.5, 1],
  ];
  loungerSpots.forEach(([lx, lz, rot, cIdx], idx) => {
    const lg = new THREE.Group();
    lg.position.set(lx, deckTopY, lz);
    lg.rotation.y = rot;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.08, 1.98), warmTimberMat);
    frame.position.set(0, 0.32, 0);
    frame.castShadow = true;
    for (const [fx, fz] of [[-0.32, -0.78], [0.32, -0.78], [-0.32, 0.78], [0.32, 0.78]]) {
      const fLeg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), darkTimberMat);
      fLeg.position.set(fx, 0.16, fz);
      lg.add(fLeg);
    }
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.07, 1.28), towelMats[cIdx % towelMats.length]);
    cushion.position.set(0, 0.39, 0.32);
    const backRest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.07, 0.72), towelMats[cIdx % towelMats.length]);
    backRest.position.set(0, 0.58, -0.62);
    backRest.rotation.x = 0.56;
    backRest.castShadow = true;
    lg.add(frame, cushion, backRest);
    staticGroup.add(lg);

    // Every pair of loungers shares a breezy angled beach parasol!
    if (idx % 2 === 0) {
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 2.35, 8), whiteSteelMat);
      up.position.set(lx + (lx < 0 ? 1.05 : -1.05), deckTopY + 1.18, lz + 1.35);
      const uc = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.45, 8), parasolMats[(idx / 2) % parasolMats.length]);
      uc.position.set(lx + (lx < 0 ? 1.05 : -1.05), deckTopY + 2.35, lz + 1.35);
      uc.castShadow = true;
      staticGroup.add(up, uc);
    }

    // Leave 2 loungers empty & interactive for the player to sunbathe!
    if (registerInteractable && (idx === 1 || idx === 4)) {
      const [wx, wz] = toWorld(lx, lz);
      const [ex, ez] = toWorld(lx + 1.6, lz);
      registerInteractable({
        id: `bains_lounger_${idx}`,
        type: 'bench',
        label: 'SUNBATHE · BAINS DES PÂQUIS',
        activeLabel: 'STAND UP',
        subtitle: 'Soaking up the summer sun at Les Bains des Pâquis facing the Jet d\'Eau… (E or WASD to stand)',
        toast: 'BAINS DES PÂQUIS · SUNBATHING',
        x: wx,
        y: deckTopY,
        z: wz,
        yaw: bpYaw + rot,
        benchWidth: 0.7,
        seatLocalZ: 0.1,
        exitX: ex,
        exitZ: ez,
        persistent: true,
        radius: 2.6,
        priority: 1.25,
      });
    }
  });

  // 16 Colorful Beach Towels laid naturally across the main timber deck, bleachers & pebble beach!
  const towelSpots = [
    // Main sun deck towels (occupied by sunbathers below!)
    { x: -3.2, y: deckTopY, z: 16.0, yaw: 0.12, mat: 0 },
    { x: -0.6, y: deckTopY, z: 17.2, yaw: -0.18, mat: 1 },
    { x: 3.1,  y: deckTopY, z: 15.8, yaw: 0.22, mat: 2 },
    { x: -4.2, y: deckTopY, z: 21.8, yaw: -0.08, mat: 3 },
    { x: -1.2, y: deckTopY, z: 22.6, yaw: 0.15, mat: 4 },
    { x: 2.5,  y: deckTopY, z: 21.5, yaw: -0.25, mat: 5 },
    { x: 6.4,  y: deckTopY, z: 24.0, yaw: 0.08, mat: 0 },
    { x: -3.5, y: deckTopY, z: 27.6, yaw: 0.24, mat: 1 },
    { x: 0.4,  y: deckTopY, z: 28.4, yaw: -0.14, mat: 2 },
    { x: 4.4,  y: deckTopY, z: 28.0, yaw: 0.05, mat: 3 },
    { x: -2.0, y: deckTopY, z: 33.8, yaw: -0.22, mat: 4 },
    { x: 2.4,  y: deckTopY, z: 34.4, yaw: 0.18, mat: 5 },
    // South sunbathing bleacher steps towels
    { x: -13.9, y: deckTopY - 0.04, z: 14.0, yaw: Math.PI * 0.5, mat: 2 },
    { x: -13.9, y: deckTopY - 0.04, z: 22.5, yaw: Math.PI * 0.5, mat: 0 },
    // Pebble beach cove towels
    { x: -11.4, y: deckTopY + 0.01, z: -22.5, yaw: 0.32, mat: 1 },
    { x: -11.6, y: deckTopY + 0.01, z: -28.8, yaw: -0.24, mat: 4 },
  ];
  const toteMatA = new THREE.MeshStandardMaterial({ color: 0xdcb87e, roughness: 0.85 });
  const toteMatB = new THREE.MeshStandardMaterial({ color: 0xe66a58, roughness: 0.82 });
  towelSpots.forEach((tw, idx) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.024, 1.98), towelMats[tw.mat % towelMats.length]);
    mesh.position.set(tw.x, tw.y + 0.014, tw.z);
    mesh.rotation.y = tw.yaw;
    mesh.receiveShadow = true;
    staticGroup.add(mesh);

    // Small woven straw beach tote or sandals beside towel for authentic lived-in summer feel!
    if (idx % 2 === 0) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.18), idx % 4 === 0 ? toteMatA : toteMatB);
      bag.position.set(tw.x + 0.68, tw.y + 0.14, tw.z - 0.55);
      bag.rotation.y = tw.yaw + 0.45;
      bag.castShadow = true;
      staticGroup.add(bag);
    }
  });

  // ===============================================================================================
  // 5. ICONIC 10M MULTI-TIER DIVING TOWER, CHROME SWIM LADDERS, BUOY BAY & FLOATING SWIM RAFT!
  // ===============================================================================================
  const diveGroup = new THREE.Group();
  diveGroup.position.set(11.4, deckTopY, 34.5);
  for (const sx of [-1.05, 1.05]) {
    for (const sz of [-1.05, 1.05]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 10.2, 8), whiteSteelMat);
      leg.position.set(sx, 5.1, sz);
      leg.castShadow = true;
      diveGroup.add(leg);
    }
  }
  // Access ladder rungs up the back of the diving tower
  for (let ry = 0.6; ry <= 9.6; ry += 0.45) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 6).rotateX(Math.PI * 0.5), chromeMat);
    rung.position.set(-1.08, ry, 0);
    diveGroup.add(rung);
  }
  for (const [py, len] of [[3.0, 3.6], [5.4, 4.1], [9.8, 4.6]]) {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.18, 2.35), whiteSteelMat);
    plat.position.set(0, py, 0);
    plat.castShadow = true;
    // Safety side guardrails on each diving platform
    for (const gz of [-1.08, 1.08]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.06), whiteSteelMat);
      rail.position.set(0, py + 0.96, gz);
      diveGroup.add(rail);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(len, 0.11, 0.72), blueBoardMat);
    board.position.set(len * 0.5 + 0.4, py + 0.12, 0);
    board.castShadow = true;
    diveGroup.add(plat, board);
  }
  staticGroup.add(diveGroup);
  if (insertCollider) {
    const [wx, wz] = toWorld(11.4, 34.5);
    insertCollider({ kind: 'obb', x: wx, z: wz, yaw: bpYaw, halfW: 1.35, halfL: 1.35, maxY: deckTopY + 10.2, walkableTop: false });
  }
  if (registerInteractable) {
    const [wx, wz] = toWorld(8.2, 34.5);
    registerInteractable({
      id: 'bains_diving_lookout',
      type: 'railing',
      label: 'WATCH DIVERS & LAC LÉMAN',
      activeLabel: 'STEP BACK',
      subtitle: 'Watching Geneva swimmers dive from the 10m tower into crystal-clear Lac Léman… (E or WASD)',
      toast: 'BAINS DES PÂQUIS · 10M TOWER',
      x: wx,
      y: deckTopY,
      z: wz,
      yaw: bpYaw + Math.PI * 0.5,
      persistent: true,
      radius: 2.8,
      priority: 0.9,
    });
  }

  // 6 Stainless-steel lakeside swim ladders descending directly into Lac Léman!
  const ladderSpots = [
    [13.35, -8.0, 0],
    [13.35, 10.0, 0],
    [13.35, 24.5, 0],
    [13.35, 40.5, 0],
    [-16.85, 10.0, Math.PI],
    [-16.85, 28.0, Math.PI],
  ];
  for (const [lx, lz, lRot] of ladderSpots) {
    const lad = new THREE.Group();
    lad.position.set(lx, deckTopY, lz);
    lad.rotation.y = lRot;
    for (const rz of [-0.30, 0.30]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.75, 8), chromeMat);
      rail.position.set(0.18, -0.52, rz);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 6, 10, Math.PI), chromeMat);
      arch.position.set(0, 0.85, rz);
      lad.add(rail, arch);
    }
    for (let s = 0; s < 5; s++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.60), chromeMat);
      step.position.set(0.18, -0.18 - s * 0.38, 0);
      lad.add(step);
    }
    staticGroup.add(lad);
  }

  // Swiss Red & White Lifebuoy Rings mounted along the pier edge
  for (const [bx, bz] of [[12.6, 4.0], [12.6, 28.0], [-12.6, 18.0]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 8), whiteSteelMat);
    post.position.set(bx, deckTopY + 0.675, bz);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.085, 8, 16), buoyRedMat);
    ring.position.set(bx + (bx > 0 ? -0.06 : 0.06), deckTopY + 0.98, bz);
    ring.rotation.y = Math.PI * 0.5;
    staticGroup.add(post, ring);
  }

  // Yellow Floating Swim-Zone Marker Buoy Line enclosing the north Lac Léman swimming bay!
  const buoyPts = [
    [14.0, -18.0], [22.0, -16.0], [32.0, -10.0], [38.0, 0.0],
    [40.0, 12.0], [39.0, 24.0], [35.0, 36.0], [26.0, 44.0], [14.0, 45.0],
  ];
  const buoyMeshes = [];
  for (let i = 0; i < buoyPts.length; i++) {
    const [bx, bz] = buoyPts[i];
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.30, 10, 8), i % 3 === 0 ? buoyRedMat : buoyYellowMat);
    buoy.position.set(bx, 0.14, bz);
    dynamicGroup.add(buoy);
    buoyMeshes.push({ mesh: buoy, baseY: 0.14, phase: i * 0.85 });
    if (i < buoyPts.length - 1) {
      const [nx, nz] = buoyPts[i + 1];
      const len = Math.hypot(nx - bx, nz - bz);
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 5).rotateX(Math.PI * 0.5), ropeMat);
      rope.position.set((bx + nx) * 0.5, 0.08, (bz + nz) * 0.5);
      rope.rotation.y = Math.atan2(nx - bx, nz - bz);
      staticGroup.add(rope);
    }
  }

  // Anchored Bobbing Wooden Floating Swim Pontoon Raft out in the swimming bay!
  const raftGroup = new THREE.Group();
  raftGroup.position.set(22.5, 0.22, 16.0);
  const raftDeck = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.28, 4.8), cedarMat);
  raftDeck.castShadow = true;
  raftDeck.receiveShadow = true;
  const raftFloat = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.22, 5.0), navyPaintMat);
  raftFloat.position.y = -0.18;
  const raftLadL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 6), chromeMat);
  raftLadL.position.set(-2.45, -0.1, -0.25);
  const raftLadR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 6), chromeMat);
  raftLadR.position.set(-2.45, -0.1, 0.25);
  raftGroup.add(raftDeck, raftFloat, raftLadL, raftLadR);
  dynamicGroup.add(raftGroup);

  // Floating Stand-Up Paddleboards (SUPs) & Colorful Inflatable Swim Rings drifting gently on Lac Léman!
  const floatingToys = [];
  const supColors = [0x1db8d4, 0xf26444, 0xf7c52b];
  const supCoords = [
    [20.5, -6.5, 0.65],
    [33.5, 25.0, -0.45],
    [-21.5, -18.0, 1.1],
  ];
  supCoords.forEach(([sx, sz, rot], idx) => {
    const sup = new THREE.Group();
    sup.position.set(sx, 0.12, sz);
    sup.rotation.y = rot;
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.84, 0.11, 3.15),
      new THREE.MeshStandardMaterial({ color: supColors[idx], roughness: 0.28, metalness: 0.08 })
    );
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.13, 1.85), whitePaintMat);
    const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.85, 6).rotateX(Math.PI * 0.5), darkTimberMat);
    paddle.position.set(0.12, 0.10, 0);
    paddle.rotation.y = 0.2;
    sup.add(board, pad, paddle);
    dynamicGroup.add(sup);
    floatingToys.push({ mesh: sup, baseY: 0.12, baseYaw: rot, phase: idx * 1.9 });
  });

  // ===============================================================================================
  // 6. 42+ LIVELY ANIMATED SUMMER PEOPLE: SUNBATHERS, SWIMMERS, DIVERS & BUVETTE TERRACE CROWD!
  // ===============================================================================================
  const skinPalette = [0xf5d0b5, 0xe8b996, 0xd8a07a, 0xbd815c, 0x8f5b3c, 0x623d28];
  const swimPalette = [0xe63946, 0x1d9bf0, 0xf6b922, 0x22a67a, 0xe86ca4, 0x1e3a6e, 0xf26522, 0x7b4ce2, 0xffffff];
  const hairPalette = [0x1c1510, 0x4b2f1c, 0xb88b4a, 0x7d361d, 0x2a2018, 0xd8b468, 0x5c4028];
  const skinMats = skinPalette.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.66 }));
  const swimMats = swimPalette.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.56 }));
  const hairMats = hairPalette.map((hex) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72 }));
  const shadesMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.15, metalness: 0.85 });
  const strawHatMat = new THREE.MeshStandardMaterial({ color: 0xe2c78e, roughness: 0.85 });

  // Shared smooth organic human-part geometries (zero boxy primitives!)
  const headGeo = new THREE.SphereGeometry(0.115, 10, 8);
  const torsoGeo = new THREE.CapsuleGeometry(0.145, 0.34, 6, 10);
  const hipGeo = new THREE.CapsuleGeometry(0.135, 0.10, 6, 10);
  const thighGeo = new THREE.CapsuleGeometry(0.068, 0.30, 5, 8);
  const calfGeo = new THREE.CapsuleGeometry(0.052, 0.30, 5, 8);
  const armGeo = new THREE.CapsuleGeometry(0.044, 0.44, 5, 8);
  const swimsuitTopGeo = new THREE.CylinderGeometry(0.148, 0.142, 0.16, 10);
  const trunksGeo = new THREE.CylinderGeometry(0.142, 0.148, 0.22, 10);

  const animatedSunbathers = [];
  const animatedSwimmers = [];
  const animatedCrowd = [];

  // Helper: Build a smooth lounging sunbather (lying on back, stomach, or propped up reading!)
  function createSunbather(x, y, z, yaw, seed, mode = 'back') {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;

    const skinM = skinMats[seed % skinMats.length];
    const swimM = swimMats[(seed * 3) % swimMats.length];
    const hairM = hairMats[(seed * 5) % hairMats.length];
    const isFemale = seed % 2 === 0;

    // Body rig rotated cleanly to lie horizontally along +Z (head at -Z, feet at +Z)
    const body = new THREE.Group();
    body.position.y = 0.15;

    const torso = new THREE.Mesh(torsoGeo, skinM);
    torso.rotation.x = Math.PI * 0.5;
    torso.scale.set(isFemale ? 0.92 : 1.08, 1.0, 0.72);
    torso.castShadow = true;
    body.add(torso);

    const hips = new THREE.Mesh(hipGeo, swimM);
    hips.position.set(0, -0.01, 0.27);
    hips.rotation.x = Math.PI * 0.5;
    hips.scale.set(isFemale ? 1.04 : 0.98, 1.0, 0.76);
    body.add(hips);

    if (isFemale) {
      const top = new THREE.Mesh(swimsuitTopGeo, swimM);
      top.rotation.x = Math.PI * 0.5;
      top.position.set(0, 0.015, -0.06);
      top.scale.set(0.94, 1.0, 0.78);
      body.add(top);
    } else {
      const tr = new THREE.Mesh(trunksGeo, swimM);
      tr.rotation.x = Math.PI * 0.5;
      tr.position.set(0, 0, 0.32);
      tr.scale.set(1.0, 1.0, 0.78);
      body.add(tr);
    }

    // Head + hair + shades or summer sunhat!
    const headPivot = new THREE.Group();
    headPivot.position.set(0, mode === 'propped' ? 0.20 : 0.05, -0.36);
    const head = new THREE.Mesh(headGeo, skinM);
    head.castShadow = true;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
    hair.position.set(0, 0.02, -0.01);
    hair.rotation.x = mode === 'stomach' ? Math.PI * 0.45 : -Math.PI * 0.35;
    headPivot.add(head, hair);

    if (seed % 3 !== 0 && mode !== 'stomach') {
      const shades = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.04, 0.05), shadesMat);
      shades.position.set(0, 0.08, 0.02);
      headPivot.add(shades);
    }
    if (seed % 4 === 0 && mode !== 'stomach') {
      const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.02, 14), strawHatMat);
      hatBrim.position.set(0, 0.06, -0.04);
      hatBrim.rotation.x = -0.35;
      headPivot.add(hatBrim);
    }
    body.add(headPivot);

    // Relaxed legs (one knee casually bent up on every 2nd sunbather for natural human variety!)
    for (const side of [-1, 1]) {
      const bendKnee = mode !== 'stomach' && ((seed + (side > 0 ? 1 : 0)) % 3 === 0);
      const thigh = new THREE.Mesh(thighGeo, skinM);
      const calf = new THREE.Mesh(calfGeo, skinM);
      thigh.castShadow = true;
      calf.castShadow = true;
      if (bendKnee) {
        thigh.position.set(side * 0.11, 0.12, 0.52);
        thigh.rotation.x = 0.82;
        calf.position.set(side * 0.11, 0.10, 0.78);
        calf.rotation.x = -0.86;
      } else {
        thigh.position.set(side * 0.11, -0.01, 0.56);
        thigh.rotation.x = Math.PI * 0.5;
        calf.position.set(side * 0.11, -0.02, 0.94);
        calf.rotation.x = Math.PI * 0.5;
      }
      body.add(thigh, calf);
    }

    // Relaxed arms (resting by side or tucked behind head)
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(armGeo, skinM);
      arm.castShadow = true;
      if (seed % 3 === 1 && mode === 'back') {
        arm.position.set(side * 0.22, 0.02, -0.22);
        arm.rotation.set(Math.PI * 0.5, 0, side * 0.55);
      } else {
        arm.position.set(side * 0.22, -0.01, 0.04);
        arm.rotation.set(Math.PI * 0.5, 0, side * 0.16);
      }
      body.add(arm);
    }

    if (mode === 'propped') {
      torso.rotation.x = Math.PI * 0.34;
      torso.position.y = 0.10;
    } else if (mode === 'stomach') {
      body.rotation.z = Math.PI;
      body.position.y = 0.13;
    }

    g.add(body);
    dynamicGroup.add(g);
    animatedSunbathers.push({ torso, headPivot, baseY: body.position.y, phase: seed * 1.13 });
  }

  // Populate 14 towels + 4 wooden loungers = 18 lively sunbathers across Bains des Pâquis!
  towelSpots.forEach((tw, idx) => {
    if (idx === 5 || idx === 11) return; // keep 2 towels casually open (owners currently swimming!)
    const mode = idx % 4 === 0 ? 'propped' : idx % 3 === 0 ? 'stomach' : 'back';
    createSunbather(tw.x, tw.y + 0.02, tw.z, tw.yaw, idx + 1, mode);
  });
  [0, 2, 3, 5].forEach((lIdx, k) => {
    const [lx, lz, rot] = loungerSpots[lIdx];
    createSunbather(lx, deckTopY + 0.42, lz, rot, 20 + k, 'propped');
  });

  // Helper: Build an animated swimmer in Lac Léman (either swimming freestyle laps OR floating on a swim ring!)
  const rippleGeo = new THREE.RingGeometry(0.45, 0.62, 18).rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xeef9ff, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false });

  function createSwimmer(spec, seed) {
    const g = new THREE.Group();
    const skinM = skinMats[seed % skinMats.length];
    const swimM = swimMats[(seed * 2 + 1) % swimMats.length];
    const hairM = hairMats[(seed * 3) % hairMats.length];

    const body = new THREE.Group();
    const head = new THREE.Mesh(headGeo, skinM);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65), hairM);
    hair.position.y = 0.02;
    const torso = new THREE.Mesh(torsoGeo, skinM);
    const suit = new THREE.Mesh(swimsuitTopGeo, swimM);

    const armLPivot = new THREE.Group();
    const armRPivot = new THREE.Group();
    const armL = new THREE.Mesh(armGeo, skinM);
    armL.position.y = -0.22;
    const armR = new THREE.Mesh(armGeo, skinM);
    armR.position.y = -0.22;
    armLPivot.add(armL);
    armRPivot.add(armR);

    const ripple = new THREE.Mesh(rippleGeo, rippleMat.clone());
    ripple.position.y = 0.06;
    g.add(ripple);

    if (spec.style === 'lap') {
      // Horizontal freestyle/breaststroke swimmer skimming the surface of Lac Léman!
      torso.rotation.x = Math.PI * 0.5;
      torso.position.set(0, -0.04, 0);
      suit.rotation.x = Math.PI * 0.5;
      suit.position.set(0, -0.03, 0.04);
      head.position.set(0, 0.09, 0.34);
      hair.position.set(0, 0.11, 0.33);
      armLPivot.position.set(0.19, 0.02, 0.18);
      armRPivot.position.set(-0.19, 0.02, 0.18);
      const legL = new THREE.Mesh(thighGeo, skinM);
      legL.rotation.x = Math.PI * 0.5;
      legL.position.set(0.09, -0.06, -0.42);
      const legR = new THREE.Mesh(thighGeo, skinM);
      legR.rotation.x = Math.PI * 0.5;
      legR.position.set(-0.09, -0.06, -0.42);
      body.add(torso, suit, head, hair, armLPivot, armRPivot, legL, legR);
    } else {
      // Vertical bather bobbing / floating in a bright summer inflatable swim ring!
      torso.position.set(0, -0.18, 0);
      suit.position.set(0, -0.10, 0);
      head.position.set(0, 0.24, 0);
      hair.position.set(0, 0.26, 0);
      armLPivot.position.set(0.20, 0.02, 0);
      armRPivot.position.set(-0.20, 0.02, 0);
      armLPivot.rotation.z = 0.65;
      armRPivot.rotation.z = -0.65;
      body.add(torso, suit, head, hair, armLPivot, armRPivot);
      if (spec.ringColor) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.46, 0.14, 10, 20).rotateX(Math.PI * 0.5),
          new THREE.MeshStandardMaterial({ color: spec.ringColor, roughness: 0.28, metalness: 0.06 })
        );
        ring.position.y = 0.04;
        body.add(ring);
      }
    }

    g.add(body);
    dynamicGroup.add(g);
    animatedSwimmers.push({
      group: g,
      body,
      armLPivot,
      armRPivot,
      ripple,
      ...spec,
      phase: seed * 1.47,
    });
  }

  // 10 Active Swimmers & Floaters right inside the Bains des Pâquis Lac Léman swimming bay!
  const swimmerSpecs = [
    { style: 'lap', cx: 23.0, cz: -4.0, rx: 5.5, rz: 7.5, speed: 0.34 },
    { style: 'lap', cx: 29.0, cz: 25.0, rx: 6.2, rz: 8.5, speed: -0.30 },
    { style: 'lap', cx: 21.0, cz: 34.0, rx: 5.0, rz: 5.8, speed: 0.36 },
    { style: 'lap', cx: 33.5, cz: 6.0,  rx: 4.5, rz: 9.0, speed: 0.28 },
    { style: 'lap', cx: -21.0, cz: 18.0, rx: 4.5, rz: 9.5, speed: -0.32 },
    { style: 'lap', cx: -22.0, cz: -24.0, rx: 4.2, rz: 6.8, speed: 0.30 },
    { style: 'float', cx: 18.5, cz: 16.5, ringColor: 0xff5c8a },
    { style: 'float', cx: 21.5, cz: 20.5, ringColor: 0x22c8e5 },
    { style: 'float', cx: 31.0, cz: -2.0, ringColor: 0xffc814 },
    { style: 'float', cx: -19.5, cz: -26.5, ringColor: 0xff7844 },
  ];
  swimmerSpecs.forEach((sp, i) => createSwimmer(sp, i + 3));

  // Helper: Build seated or standing summer local (at Buvette tables, on floating raft, chatting on pier, or on diving board!)
  function createSummerLocal(parent, x, y, z, yaw, seed, pose = 'stand') {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const skinM = skinMats[seed % skinMats.length];
    const topM = swimMats[(seed * 2) % swimMats.length];
    const botM = swimMats[(seed * 5 + 3) % swimMats.length];
    const hairM = hairMats[(seed * 3 + 1) % hairMats.length];

    const head = new THREE.Mesh(headGeo, skinM);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65), hairM);
    const torso = new THREE.Mesh(torsoGeo, pose === 'dive' ? skinM : topM);
    const hips = new THREE.Mesh(hipGeo, botM);
    torso.castShadow = true;
    head.castShadow = true;

    const armL = new THREE.Mesh(armGeo, skinM);
    const armR = new THREE.Mesh(armGeo, skinM);
    const legL = new THREE.Mesh(thighGeo, skinM);
    const legR = new THREE.Mesh(thighGeo, skinM);
    const calfL = new THREE.Mesh(calfGeo, skinM);
    const calfR = new THREE.Mesh(calfGeo, skinM);

    if (pose === 'sit') {
      hips.position.set(0, 0.55, 0);
      torso.position.set(0, 0.89, -0.02);
      head.position.set(0, 1.29, 0);
      hair.position.set(0, 1.31, -0.01);
      legL.position.set(0.11, 0.55, 0.22); legL.rotation.x = Math.PI * 0.5;
      legR.position.set(-0.11, 0.55, 0.22); legR.rotation.x = Math.PI * 0.5;
      calfL.position.set(0.11, 0.27, 0.42);
      calfR.position.set(-0.11, 0.27, 0.42);
      armL.position.set(0.21, 0.82, 0.14); armL.rotation.x = -0.65;
      armR.position.set(-0.21, 0.82, 0.14); armR.rotation.x = -0.65;
    } else {
      hips.position.set(0, 0.88, 0);
      torso.position.set(0, 1.22, 0);
      head.position.set(0, 1.62, 0);
      hair.position.set(0, 1.64, -0.01);
      legL.position.set(0.10, 0.62, 0);
      legR.position.set(-0.10, 0.62, 0);
      calfL.position.set(0.10, 0.24, 0);
      calfR.position.set(-0.10, 0.24, 0);
      armL.position.set(0.21, 1.15, 0); armL.rotation.z = 0.12;
      armR.position.set(-0.21, 1.15, 0); armR.rotation.z = -0.12;
    }
    g.add(hips, torso, head, hair, legL, legR, calfL, calfR, armL, armR);
    parent.add(g);
    animatedCrowd.push({ group: g, head, armL, armR, baseYaw: yaw, phase: seed * 1.31, pose });
  }

  // 2 Bathers sitting & dangling their legs off the floating wooden pontoon raft!
  createSummerLocal(raftGroup, -1.0, 0.06, -2.25, Math.PI, 41, 'sit');
  createSummerLocal(raftGroup, 0.85, 0.06, -2.25, Math.PI, 42, 'sit');

  // 6 Friends relaxing & chatting at Buvette picnic tables!
  createSummerLocal(dynamicGroup, -5.3, deckTopY, -6.38, 0, 50, 'sit');
  createSummerLocal(dynamicGroup, -4.2, deckTopY, -4.62, Math.PI, 51, 'sit');
  createSummerLocal(dynamicGroup, 2.2,  deckTopY, -6.38, 0, 52, 'sit');
  createSummerLocal(dynamicGroup, 3.1,  deckTopY, 2.38, Math.PI, 53, 'sit');
  createSummerLocal(dynamicGroup, -4.6, deckTopY, 7.32, 0, 54, 'sit');
  createSummerLocal(dynamicGroup, 2.5,  deckTopY, 9.08, Math.PI, 55, 'sit');

  // 5 Beachgoers chatting along the sunlit timber pier + 1 brave diver perched on the 5m board!
  createSummerLocal(dynamicGroup, 7.4, deckTopY, -13.0, -0.8, 60, 'stand');
  createSummerLocal(dynamicGroup, 6.2, deckTopY, -12.1, 2.2, 61, 'stand');
  createSummerLocal(dynamicGroup, -7.2, deckTopY, 13.5, -1.3, 62, 'stand');
  createSummerLocal(dynamicGroup, 5.5, deckTopY, 31.5, 1.1, 63, 'stand');
  createSummerLocal(dynamicGroup, 9.2, deckTopY, 28.5, 1.45, 64, 'stand');
  // Brave summer local who actually walks out, bounces on the 5m diving board, swan-dives into Lac Léman with 3D water splashes, and swims back!
  const diverObj = createSummerLocal(dynamicGroup, 11.4 + 3.85, deckTopY + 5.58, 34.5, Math.PI * 0.5, 65, 'dive');
  // 3D Splash Plume & Double Water Rings below the 5m/10m diving tower!
  const splashGroup = new THREE.Group();
  splashGroup.position.set(11.4 + 6.6, 0.10, 34.5);
  const splashMat = new THREE.MeshBasicMaterial({ color: 0xf4fcff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
  const splashCone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.8, 12, 1, true), splashMat);
  splashCone.position.y = 1.2;
  const splashRing1 = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.05, 22).rotateX(-Math.PI / 2), splashMat);
  const splashRing2 = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.55, 22).rotateX(-Math.PI / 2), splashMat);
  splashGroup.add(splashCone, splashRing1, splashRing2);
  dynamicGroup.add(splashGroup);

  // Winter Geneva Sauna Steam Plumes rising gently from the Bains des Pâquis sauna pavilion in Winter mode!
  const steamPuffs = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xf2f7fc, transparent: true, opacity: 0, depthWrite: false });
  for (let s = 0; s < 10; s++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.65, 1), steamMat);
    puff.position.set(buvX - 1.5, deckTopY + 4.1, buvZ - 4.0);
    dynamicGroup.add(puff);
    steamPuffs.push({ mesh: puff, phase: s / 10 });
  }

  // Batch all static Bains des Pâquis wood decks, bleachers, cabanas, parasols, towels, ladders & diving tower (~180 meshes -> ~14 DC!)
  batchStaticGroup(staticGroup, { label: 'BainsDesPaquisStaticBatch' });

  // Cache all shadow-casting meshes in dynamicGroup so we can toggle sun shadows cleanly by player distance!
  const dynShadowMeshes = [];
  dynamicGroup.traverse((o) => {
    if (o.isMesh && o.castShadow) dynShadowMeshes.push(o);
  });
  let dynShadowsOn = true;

  function update(elapsed, nightFactor = 0, winterFactor = 0, activePos = null) {
    // Distance-cull ~420 multi-part summer people/toys draw calls when player is > 270m away across Geneva!
    // Main static cedar pier, Buvette pavilion, cabanas, parasols & Le Phare remain 100% visible from across Lac Léman!
    const d2 = activePos ? (activePos.x - bpX) * (activePos.x - bpX) + (activePos.z - bpZ) * (activePos.z - bpZ) : 0;
    const nearBains = !activePos || d2 < 270 * 270;
    dynamicGroup.visible = nearBains;
    if (!nearBains) {
      stringBulbMat.emissiveIntensity = 0.35 + nightFactor * 2.6;
      return;
    }
    const wantDynShadow = !activePos || d2 < 78 * 78;
    if (wantDynShadow !== dynShadowsOn) {
      dynShadowsOn = wantDynShadow;
      for (let i = 0; i < dynShadowMeshes.length; i++) dynShadowMeshes[i].castShadow = wantDynShadow;
    }
    // 1. Gentle sunlit breathing & relaxed head turn for all 18 sunbathers
    for (let i = 0; i < animatedSunbathers.length; i++) {
      const sb = animatedSunbathers[i];
      sb.torso.scale.z = 0.72 + Math.sin(elapsed * 1.55 + sb.phase) * 0.025;
      sb.headPivot.rotation.z = Math.sin(elapsed * 0.45 + sb.phase) * 0.14;
    }

    // 2. Smooth animated swimming strokes, curved lake laps & water ripple rings for all 10 lake swimmers!
    for (let i = 0; i < animatedSwimmers.length; i++) {
      const sw = animatedSwimmers[i];
      if (sw.style === 'lap') {
        const a = elapsed * sw.speed + sw.phase;
        const x = sw.cx + Math.cos(a) * sw.rx;
        const z = sw.cz + Math.sin(a) * sw.rz;
        const vx = -Math.sin(a) * sw.rx * sw.speed;
        const vz = Math.cos(a) * sw.rz * sw.speed;
        sw.group.position.set(x, 0.06 + Math.sin(elapsed * 3.8 + sw.phase) * 0.04, z);
        sw.group.rotation.y = Math.atan2(vx, vz);
        const stroke = elapsed * 5.2 + sw.phase;
        sw.armLPivot.rotation.x = stroke;
        sw.armRPivot.rotation.x = stroke + Math.PI;
        sw.body.rotation.z = Math.sin(stroke) * 0.18;
      } else {
        sw.group.position.set(
          sw.cx + Math.sin(elapsed * 0.65 + sw.phase) * 0.45,
          0.08 + Math.sin(elapsed * 2.4 + sw.phase) * 0.07,
          sw.cz + Math.cos(elapsed * 0.55 + sw.phase) * 0.45
        );
        sw.group.rotation.y = sw.phase + Math.sin(elapsed * 0.4 + sw.phase) * 0.6;
        sw.armLPivot.rotation.x = Math.sin(elapsed * 2.2 + sw.phase) * 0.24;
        sw.armRPivot.rotation.x = -Math.sin(elapsed * 2.2 + sw.phase) * 0.24;
      }
      const ripCycle = (elapsed * 0.75 + sw.phase) % 1.0;
      const rs = 0.8 + ripCycle * 1.8;
      sw.ripple.scale.set(rs, rs, 1);
      sw.ripple.material.opacity = (1.0 - ripCycle) * 0.42;
    }

    // 3. Live 5m Swan-Dive Cycle + 3D Splash Plume + Gentle idle chat motion for Buvette & pier summer locals!
    const divePeriod = 9.0;
    const dtCycle = elapsed % divePeriod;
    let splashAlpha = 0;
    for (let i = 0; i < animatedCrowd.length; i++) {
      const c = animatedCrowd[i];
      c.head.rotation.y = Math.sin(elapsed * 1.2 + c.phase) * 0.24;
      if (c.pose === 'dive') {
        const boardX0 = 11.4 + 1.8;
        const boardTipX = 11.4 + 4.1;
        const boardY = deckTopY + 5.58;
        if (dtCycle < 2.2) {
          // Walk confidently out along the blue 5m board
          const u = dtCycle / 2.2;
          c.group.position.set(boardX0 + (boardTipX - boardX0) * u, boardY, 34.5);
          c.group.rotation.set(0, Math.PI * 0.5, 0);
          c.armL.rotation.x = Math.sin(dtCycle * 6.5) * 0.35;
          c.armR.rotation.x = -Math.sin(dtCycle * 6.5) * 0.35;
        } else if (dtCycle < 3.1) {
          // Springboard bounce & arms raise overhead
          const u = (dtCycle - 2.2) / 0.9;
          const hop = Math.abs(Math.sin(u * Math.PI * 2)) * 0.28;
          c.group.position.set(boardTipX, boardY + hop, 34.5);
          c.group.rotation.set(0, Math.PI * 0.5, 0);
          c.armL.rotation.x = -Math.PI * 0.72 * u;
          c.armR.rotation.x = -Math.PI * 0.72 * u;
        } else if (dtCycle < 4.55) {
          // Graceful parabolic swan-dive arc from 5m board into Lac Léman!
          const u = (dtCycle - 3.1) / 1.45;
          const dx = boardTipX + u * 2.65;
          const dy = boardY + 1.55 * u - (boardY + 2.2) * u * u;
          c.group.position.set(dx, dy, 34.5);
          c.group.rotation.set(0, Math.PI * 0.5, -u * Math.PI * 0.88);
          c.armL.rotation.x = -Math.PI * 0.92;
          c.armR.rotation.x = -Math.PI * 0.92;
        } else if (dtCycle < 6.0) {
          // Big white splash impact + resurfacing!
          const u = (dtCycle - 4.55) / 1.45;
          splashAlpha = Math.sin(Math.min(1, u * 1.15) * Math.PI);
          splashCone.scale.set(0.65 + u * 0.85, 0.35 + splashAlpha * 1.15, 0.65 + u * 0.85);
          splashRing1.scale.set(0.7 + u * 2.8, 0.7 + u * 2.8, 1);
          splashRing2.scale.set(0.5 + u * 3.6, 0.5 + u * 3.6, 1);
          c.group.position.set(boardTipX + 2.65, -1.1 + u * 0.55, 34.5);
          c.group.rotation.set(0, -Math.PI * 0.5, 0);
        } else {
          // Swim smoothly back toward the chrome diving-tower ladder
          const u = (dtCycle - 6.0) / 3.0;
          c.group.position.set(boardTipX + 2.65 - u * 4.2, -0.55 + Math.sin(elapsed * 5.0) * 0.06, 34.5 + u * 1.5);
          c.group.rotation.set(0, -Math.PI * 0.5, 0);
          c.armL.rotation.x = elapsed * 5.5;
          c.armR.rotation.x = elapsed * 5.5 + Math.PI;
        }
      } else {
        c.armR.rotation.x = (c.pose === 'sit' ? -0.65 : 0) + Math.sin(elapsed * 1.8 + c.phase) * 0.14;
      }
    }
    splashMat.opacity = splashAlpha * 0.78;
    splashGroup.visible = splashAlpha > 0.02;

    // 4. Winter Geneva Sauna Steam Plumes (warm rising mist over Bains des Pâquis in winter mode!)
    steamMat.opacity = winterFactor * 0.28;
    for (let s = 0; s < steamPuffs.length; s++) {
      const sp = steamPuffs[s];
      sp.mesh.visible = winterFactor > 0.05;
      if (!sp.mesh.visible) continue;
      const t = (elapsed * 0.18 + sp.phase) % 1.0;
      sp.mesh.position.set(
        buvX - 1.5 + Math.sin(elapsed * 0.7 + s) * (0.4 + t * 1.4),
        deckTopY + 4.1 + t * 5.6,
        buvZ - 4.0 + Math.cos(elapsed * 0.6 + s) * (0.4 + t * 1.2)
      );
      const sc = 0.55 + t * 2.1;
      sp.mesh.scale.set(sc, sc * 0.75, sc);
    }

    // 4. Bobbing floating swim pontoon raft, swim-zone buoys & paddleboards on Lac Léman waves!
    raftGroup.position.y = 0.20 + Math.sin(elapsed * 1.8) * 0.07;
    raftGroup.rotation.x = Math.sin(elapsed * 1.45) * 0.025;
    raftGroup.rotation.z = Math.cos(elapsed * 1.32) * 0.028;
    for (let i = 0; i < buoyMeshes.length; i++) {
      const b = buoyMeshes[i];
      b.mesh.position.y = b.baseY + Math.sin(elapsed * 2.3 + b.phase) * 0.055;
    }
    for (let i = 0; i < floatingToys.length; i++) {
      const f = floatingToys[i];
      f.mesh.position.y = f.baseY + Math.sin(elapsed * 2.1 + f.phase) * 0.055;
      f.mesh.rotation.y = f.baseYaw + Math.sin(elapsed * 0.45 + f.phase) * 0.12;
      f.mesh.rotation.z = Math.cos(elapsed * 1.7 + f.phase) * 0.035;
    }

    // 5. Warm festive Buvette café string lights glow brighter at sunset & night!
    stringBulbMat.emissiveIntensity = 0.35 + Math.max(0, (nightFactor - 0.12) / 0.88) * 3.1;
  }

  return { group: root, update };
}
