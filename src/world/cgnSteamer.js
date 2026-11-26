import * as THREE from 'three';
import { batchStaticGroup } from './staticBatcher.js';

// =================================================================================================
// CGN BELLE ÉPOQUE PADDLE STEAMER — "LA SUISSE" (1910) CRUISING LAC LÉMAN!
// Authentic 1:1 Swiss white-and-gold Lake Geneva paddle steamer with rotating red side paddlewheels,
// tall cream/black funnel puffing rising steam rings, warm illuminated Belle Époque deck salons,
// Swiss red-and-white stern flag & foaming white wake trail!
// =================================================================================================

function createSteamerNameplate(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0f243d';
  ctx.fillRect(0, 0, 512, 96);
  ctx.strokeStyle = '#d8b24c';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 502, 86);
  ctx.fillStyle = '#f6dc8a';
  ctx.font = 'bold 42px "Georgia", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSalonWindowTex() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f2ea';
  ctx.fillRect(0, 0, 512, 128);
  // Row of Belle Époque arched teak-trimmed panorama salon windows
  for (let i = 0; i < 8; i++) {
    const x = 14 + i * 62;
    ctx.fillStyle = '#6c4224';
    ctx.fillRect(x - 3, 18, 48, 86);
    const g = ctx.createLinearGradient(0, 22, 0, 100);
    g.addColorStop(0, '#ffe3a6');
    g.addColorStop(1, '#c9883b');
    ctx.fillStyle = g;
    ctx.fillRect(x, 22, 42, 78);
    // Delicate wooden muntin crossbars
    ctx.fillStyle = '#5c361c';
    ctx.fillRect(x + 20, 22, 2, 78);
    ctx.fillRect(x, 54, 42, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

export function createCgnPaddleSteamer(worldGroup) {
  const root = new THREE.Group();
  root.name = 'CGN_La_Suisse_Paddle_Steamer';
  worldGroup.add(root);

  const hullWhite = new THREE.MeshPhysicalMaterial({ color: 0xf6f7f9, roughness: 0.24, clearcoat: 0.72 });
  const hullNavy = new THREE.MeshStandardMaterial({ color: 0x12263f, roughness: 0.36, metalness: 0.18 });
  const teakMat = new THREE.MeshStandardMaterial({ color: 0x8b5a34, roughness: 0.68, metalness: 0.06 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xdcb44e, roughness: 0.22, metalness: 0.88 });
  const paddleRed = new THREE.MeshStandardMaterial({ color: 0xc8222a, roughness: 0.36, metalness: 0.12 });
  const funnelCream = new THREE.MeshStandardMaterial({ color: 0xe6d4a4, roughness: 0.42 });
  const funnelBlack = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.55 });
  const salonTex = createSalonWindowTex();
  const salonMat = new THREE.MeshStandardMaterial({
    map: salonTex,
    emissiveMap: salonTex,
    emissive: new THREE.Color(0xffc978),
    emissiveIntensity: 0.12,
    roughness: 0.32,
  });

  // 1. Sleek 46m Belle Époque White Hull + Tapered Bow + Navy Waterline Boot + Golden Bowsprit
  const hullMain = new THREE.Mesh(new THREE.BoxGeometry(7.4, 2.5, 34.0), hullWhite);
  hullMain.position.set(0, 1.35, 0);
  hullMain.castShadow = true;
  hullMain.receiveShadow = true;

  const waterBoot = new THREE.Mesh(new THREE.BoxGeometry(7.55, 0.75, 34.2), hullNavy);
  waterBoot.position.set(0, 0.35, 0);

  // Tapered pointed Belle Époque bow (+Z) & graceful counter stern (-Z)
  const bowGeo = new THREE.ConeGeometry(4.95, 11.5, 4).rotateY(Math.PI / 4).rotateX(Math.PI * 0.5);
  const bow = new THREE.Mesh(bowGeo, hullWhite);
  bow.scale.set(1.06, 0.38, 1.0);
  bow.position.set(0, 1.38, 22.4);
  bow.castShadow = true;

  const stern = new THREE.Mesh(bowGeo, hullWhite);
  stern.scale.set(1.04, 0.36, 0.62);
  stern.rotation.y = Math.PI;
  stern.position.set(0, 1.35, -20.2);

  // Golden Belle Époque Bowsprit spear + gilded bow crest!
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 7.2, 8).rotateX(Math.PI * 0.42), brassMat);
  bowsprit.position.set(0, 2.75, 27.6);
  const bowScroll = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.12, 8, 16), brassMat);
  bowScroll.position.set(0, 2.0, 25.2);
  bowScroll.rotation.y = Math.PI * 0.5;

  // 2. Main Teak Promenade Deck + Panoramic Lower & Upper Salons + Sun Canopy Roof!
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.22, 36.5), teakMat);
  deck1.position.set(0, 2.65, 0);
  const lowerSalon = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.5, 25.5), salonMat);
  lowerSalon.position.set(0, 3.95, -1.0);
  lowerSalon.castShadow = true;

  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(8.0, 0.22, 30.5), teakMat);
  deck2.position.set(0, 5.25, -0.5);
  const upperSalon = new THREE.Mesh(new THREE.BoxGeometry(5.6, 2.15, 17.5), salonMat);
  upperSalon.position.set(0, 6.4, -2.5);
  upperSalon.castShadow = true;

  const sunCanopy = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.16, 24.0), hullWhite);
  sunCanopy.position.set(0, 7.62, -1.8);
  sunCanopy.castShadow = true;

  // Open Captain's Wheelhouse Bridge forward of the funnel
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.85, 3.2), teakMat);
  bridge.position.set(0, 6.2, 9.2);
  const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.16, 3.6), hullWhite);
  bridgeRoof.position.set(0, 7.2, 9.2);

  // Brass Promenade Railings along both decks
  for (const [ry, rLen, rW] of [[3.3, 35.8, 3.95], [5.85, 29.8, 3.85]]) {
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, rLen), brassMat);
      rail.position.set(side * rW, ry, -0.2);
      root.add(rail);
    }
  }

  // 3. Tall Iconic CGN Belle Époque Cream & Black Funnel + Twin Wooden Masts + Swiss Flag!
  const funnelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 5.6, 14), funnelCream);
  funnelBase.position.set(0, 9.8, 4.2);
  funnelBase.rotation.x = -0.07; // graceful historic steamer rake!
  funnelBase.castShadow = true;
  const funnelTop = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.93, 1.45, 14), funnelBlack);
  funnelTop.position.set(0, 13.1, 3.95);
  funnelTop.rotation.x = -0.07;

  const mastFwd = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 11.5, 8), teakMat);
  mastFwd.position.set(0, 10.8, 16.5);
  const mastAft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 10.2, 8), teakMat);
  mastAft.position.set(0, 10.2, -16.8);

  // Iconic large red-and-white Swiss Flag waving proudly off the stern!
  const swissFlagCan = document.createElement('canvas');
  swissFlagCan.width = 128;
  swissFlagCan.height = 128;
  const sfCtx = swissFlagCan.getContext('2d');
  sfCtx.fillStyle = '#d91822';
  sfCtx.fillRect(0, 0, 128, 128);
  sfCtx.fillStyle = '#ffffff';
  sfCtx.fillRect(50, 26, 28, 76);
  sfCtx.fillRect(26, 50, 76, 28);
  const swissFlagTex = new THREE.CanvasTexture(swissFlagCan);
  swissFlagTex.colorSpace = THREE.SRGBColorSpace;
  const swissFlag = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshStandardMaterial({ map: swissFlagTex, side: THREE.DoubleSide, roughness: 0.72 })
  );
  swissFlag.position.set(0, 6.2, -23.5);
  swissFlag.rotation.y = Math.PI * 0.5;
  const flagStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 5.2, 6), teakMat);
  flagStaff.position.set(0, 5.4, -22.0);
  flagStaff.rotation.x = -0.35;

  // 4. Twin Iconic Side Paddlewheel Housings + Real Rotating Red Wooden Paddlewheels!
  const nameMat = new THREE.MeshStandardMaterial({ map: createSteamerNameplate('LA SUISSE · CGN'), roughness: 0.35 });
  const paddleWheels = [];
  for (const side of [-1, 1]) {
    const boxOuter = new THREE.Mesh(new THREE.CylinderGeometry(3.45, 3.45, 1.95, 18, 1, false, 0, Math.PI).rotateZ(Math.PI * 0.5), hullWhite);
    boxOuter.position.set(side * 4.45, 2.2, 2.2);
    boxOuter.rotation.y = Math.PI * 0.5;
    boxOuter.castShadow = true;
    const goldRim = new THREE.Mesh(new THREE.TorusGeometry(3.46, 0.14, 8, 22, Math.PI), brassMat);
    goldRim.position.set(side * 5.44, 2.2, 2.2);
    goldRim.rotation.y = Math.PI * 0.5;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.96), nameMat);
    plate.position.set(side * 5.46, 3.65, 2.2);
    plate.rotation.y = side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    root.add(boxOuter, goldRim, plate);

    // Real rotating red wooden paddlewheel inside housing!
    const wheel = new THREE.Group();
    wheel.position.set(side * 4.4, 1.4, 2.2);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.65, 10).rotateZ(Math.PI * 0.5), paddleRed);
    wheel.add(hub);
    for (let b = 0; b < 10; b++) {
      const ang = (b / 10) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.44, 0.12), paddleRed);
      blade.position.set(0, Math.cos(ang) * 2.55, Math.sin(ang) * 2.55);
      blade.rotation.x = -ang;
      wheel.add(blade);
    }
    root.add(wheel);
    batchStaticGroup(wheel, { label: `CGN_Paddle_${side}`, minMeshes: 2, disposeSource: true, staticMatrix: true });
    wheel.userData.noBatch = true;
    paddleWheels.push(wheel);
  }

  // Gentle rising funnel steam puffs + white stern wake foam trail!
  const steamPuffs = [];
  const steamMat = new THREE.MeshBasicMaterial({ color: 0xf4f8fc, transparent: true, opacity: 0.42, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), steamMat);
    p.userData.noBatch = true;
    root.add(p);
    steamPuffs.push({ mesh: p, phase: i / 8 });
  }
  const wakeMat = new THREE.MeshBasicMaterial({ color: 0xeef9ff, transparent: true, opacity: 0.48, side: THREE.DoubleSide, depthWrite: false });
  const wakeMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 34.0).rotateX(-Math.PI / 2), wakeMat);
  wakeMesh.position.set(0, 0.08, -28.0);
  wakeMesh.userData.noBatch = true;
  root.add(wakeMesh);

  swissFlag.userData.noBatch = true;
  root.add(
    hullMain, waterBoot, bow, stern, bowsprit, bowScroll,
    deck1, lowerSalon, deck2, upperSalon, sunCanopy,
    bridge, bridgeRoof, funnelBase, funnelTop, mastFwd, mastAft,
    swissFlag, flagStaff
  );
  // Collapse ~34 static hull, salon, bridge, funnel & mast meshes into ~8 merged draw calls!
  batchStaticGroup(root, { label: 'CGN_LaSuisse_Hull', minMeshes: 2, disposeSource: true, staticMatrix: true });

  // Scenic open-water Lac Léman loop in La Rade (cleanly between Quai du Mont-Blanc, Bains des Pâquis & Jet d'Eau!)
  const loopCenterX = 245.0;
  const loopCenterZ = -215.0;
  const loopRx = 148.0;
  const loopRz = 135.0;
  const curPos = { x: loopCenterX, y: 0, z: loopCenterZ };

  function update(dt, elapsed, nightFactor = 0) {
    const ang = elapsed * 0.042 + 0.6;
    const x = loopCenterX + Math.cos(ang) * loopRx;
    const z = loopCenterZ + Math.sin(ang) * loopRz;
    const vx = -Math.sin(ang) * loopRx;
    const vz = Math.cos(ang) * loopRz;
    curPos.x = x;
    curPos.z = z;

    root.position.set(x, Math.sin(elapsed * 1.45) * 0.14, z);
    root.rotation.set(
      Math.sin(elapsed * 1.15) * 0.014,
      Math.atan2(vx, vz),
      Math.cos(elapsed * 1.35) * 0.018
    );

    // Spin both red side paddlewheels steadily!
    for (let i = 0; i < paddleWheels.length; i++) {
      paddleWheels[i].rotation.x += dt * 2.4;
    }
    swissFlag.rotation.y = Math.PI * 0.5 + Math.sin(elapsed * 5.2) * 0.22;

    // Gentle rising steamer funnel smoke puffs drifting aft
    for (let i = 0; i < steamPuffs.length; i++) {
      const sp = steamPuffs[i];
      const u = (elapsed * 0.24 + sp.phase) % 1.0;
      sp.mesh.position.set(Math.sin(elapsed * 1.2 + i) * 0.5, 14.0 + u * 6.5, 3.8 - u * 8.5);
      const sc = 0.6 + u * 2.2;
      sp.mesh.scale.set(sc, sc * 0.72, sc);
    }

    // Warm golden Belle Époque deck salons glow brightly at twilight & night!
    salonMat.emissiveIntensity = 0.12 + Math.max(0, (nightFactor - 0.15) / 0.85) * 1.55;
  }

  return { group: root, pos: curPos, update };
}
