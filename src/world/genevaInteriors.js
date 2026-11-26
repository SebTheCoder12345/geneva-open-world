import * as THREE from 'three';
import { getGroundHeight } from './cityData.js';

// =================================================================================================
// ENTERABLE 3D SIGNATURE GENEVA INTERIORS (0 draw calls when outside — instant seamless portal!)
// 1. Maison Horlogère · Rue du Rhône Luxury Watch Boutique (Rolex / Patek VIP Salon)
// 2. Banque Privée de Genève (Travertine Marble Lobby & Swiss 24k Gold Bullion Vault)
// 3. Buvette des Bains · Lakeside Fondue & Espresso Chalet (Les Bains des Pâquis!)
// =================================================================================================

function makeInteriorPlaque(title, sub, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, 492, 108);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'bold 28px "Georgia", serif';
  ctx.fillText(title, 256, 56, 456);
  ctx.font = 'bold 16px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(sub, 256, 94, 456);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMarbleFloorTex(baseHex, veinHex) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = veinHex;
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.strokeRect(i * 128, 0, 128, 512);
    ctx.strokeRect(0, i * 128, 512, 128);
  }
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.moveTo((i * 73) % 512, 0);
    ctx.bezierCurveTo((i * 131) % 512, 170, (i * 97) % 512, 340, (i * 193) % 512, 512);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export function createGenevaInteriors(scene, worldGroup, registerInteractable) {
  const interiorsRoot = new THREE.Group();
  interiorsRoot.name = 'Geneva_Enterable_Interiors';
  scene.add(interiorsRoot);

  // Exterior doorway welcome markers (subtle glowing gold doormat + brass pillar so players spot enterable venues!)
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xf0c966, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const doorwayMarkerGroup = new THREE.Group();
  worldGroup.add(doorwayMarkerGroup);

  const animatedWatches = [];
  const rooms = new Map();
  let activeRoom = null;
  let savedOutdoorPos = null;

  function buildShell(id, title, subtitle, originY, width, depth, height, floorColor, wallColor, accentColor, entryWorld) {
    const g = new THREE.Group();
    g.position.set(0, originY, 0);
    g.visible = false;
    interiorsRoot.add(g);

    const floorMat = new THREE.MeshStandardMaterial({
      map: makeMarbleFloorTex(floorColor, '#a89c88'),
      roughness: 0.44,
      metalness: 0.04,
      envMapIntensity: 0.14,
    });
    const wallMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.78, metalness: 0.03, envMapIntensity: 0.16 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xeae5db, roughness: 0.88, envMapIntensity: 0.12 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xd8b24c, roughness: 0.24, metalness: 0.84, envMapIntensity: 0.45 });
    const exitDoorMat = new THREE.MeshStandardMaterial({
      map: makeInteriorPlaque('SORTIE · GENÈVE', 'PRESS [E] TO STEP OUTSIDE', '#163828', '#f2d98a'),
      roughness: 0.38,
      envMapIntensity: 0.18,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), floorMat);
    floor.position.y = -0.15;
    floor.receiveShadow = true;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(width, 0.3, depth), ceilMat);
    ceil.position.y = height + 0.15;

    const wallN = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.3), wallMat);
    wallN.position.set(0, height * 0.5, -depth * 0.5);
    const wallS = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.3), wallMat);
    wallS.position.set(0, height * 0.5, depth * 0.5);
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, depth), wallMat);
    wallW.position.set(-width * 0.5, height * 0.5, 0);
    const wallE = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, depth), wallMat);
    wallE.position.set(width * 0.5, height * 0.5, 0);

    // Exit door on South wall (+Z)
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.75, 0.14), exitDoorMat);
    exitDoor.position.set(0, 1.38, depth * 0.5 - 0.18);

    // Header plaque on North feature wall (-Z)
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 1.15, 0.12),
      new THREE.MeshStandardMaterial({ map: makeInteriorPlaque(title, subtitle, accentColor, '#f7df96'), roughness: 0.32 })
    );
    sign.position.set(0, height - 1.25, -depth * 0.5 + 0.22);

    // Balanced soft warm architectural interior illumination (zero ceiling hotspot or harsh grazing specular on suit!)
    const light1 = new THREE.PointLight(0xffe6bd, 6.5, 28, 1.35);
    light1.position.set(0, height - 0.55, -depth * 0.24);
    const light2 = new THREE.PointLight(0xfff1d8, 4.5, 26, 1.35);
    light2.position.set(0, height - 0.55, depth * 0.36);

    g.add(floor, ceil, wallN, wallS, wallW, wallE, exitDoor, sign, light1, light2);

    // Place a sleek glowing gold threshold mat at the exterior Geneva street doorway!
    const ey = entryWorld.y ?? (getGroundHeight(entryWorld.x, entryWorld.z) + 0.265);
    const matRing = new THREE.Mesh(new THREE.RingGeometry(0.65, 0.92, 24).rotateX(-Math.PI / 2), markerMat);
    matRing.position.set(entryWorld.x, ey, entryWorld.z);
    doorwayMarkerGroup.add(matRing);

    const room = {
      id,
      title,
      group: g,
      originY,
      height,
      halfW: width * 0.5 - 0.75,
      halfD: depth * 0.5 - 0.75,
      spawn: { x: 0, y: originY, z: depth * 0.5 - 3.6, yaw: Math.PI },
      exitDoorLocal: { x: 0, z: depth * 0.5 - 1.1 },
      entryWorld: { x: entryWorld.x, y: ey, z: entryWorld.z, yaw: entryWorld.yaw || 0 },
      interactables: [],
      brassMat,
    };
    rooms.set(id, room);

    // Register exterior doorway interactable
    if (registerInteractable) {
      registerInteractable({
        id: `enter_interior_${id}`,
        type: 'interior_enter',
        interiorId: id,
        label: `ENTER ${title}`,
        subtitle: `Stepping inside ${title}… (Walk around & press E at displays or the exit door)`,
        toast: title,
        x: entryWorld.x,
        y: ey,
        z: entryWorld.z,
        persistent: false,
        radius: 3.1,
        priority: 1.35,
      });
    }
    return room;
  }

  // -----------------------------------------------------------------------------------------------
  // 1. MAISON HORLOGÈRE — RUE DU RHÔNE LUXURY WATCH BOUTIQUE (near Quai du Général-Guisan / Rolex!)
  // -----------------------------------------------------------------------------------------------
  {
    const r = buildShell(
      'watch_boutique',
      'MAISON HORLOGÈRE · GENÈVE',
      'HAUTE HORLOGERIE · RUE DU RHÔNE',
      620,
      14,
      14,
      4.8,
      '#ece6da',
      '#183024',
      '#0e2c1e',
      { x: 66.5, z: 222.0, yaw: 0.35 }
    );
    const walnut = new THREE.MeshStandardMaterial({ color: 0x3f2414, roughness: 0.42 });
    const velvet = new THREE.MeshStandardMaterial({ color: 0x104a32, roughness: 0.85 });
    const glassDome = new THREE.MeshPhysicalMaterial({ color: 0xdff2ff, transparent: true, opacity: 0.34, roughness: 0.05, clearcoat: 1.0 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf4c84c, roughness: 0.16, metalness: 0.94 });

    // 4 Illuminated Mahogany & Glass Tourbillon Watch Display Pedestals!
    const pedCoords = [[-3.8, -2.5], [3.8, -2.5], [-3.8, 2.2], [3.8, 2.2]];
    for (const [px, pz] of pedCoords) {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), walnut);
      ped.position.set(px, 0.575, pz);
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.14, 16), velvet);
      cushion.position.set(px, 1.22, pz);
      const dome = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.78, 0.96), glassDome);
      dome.position.set(px, 1.54, pz);
      // Rotating miniature 18k gold Geneva wristwatch!
      const watch = new THREE.Group();
      watch.position.set(px, 1.48, pz);
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.038, 8, 18), walnut);
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16).rotateX(Math.PI * 0.5), goldMat);
      bezel.position.z = 0.18;
      watch.add(strap, bezel);
      r.group.add(ped, cushion, dome, watch);
      animatedWatches.push(watch);
    }

    // VIP Emerald Velvet Consultation Desk at back of salon
    const desk = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.88, 1.4), walnut);
    desk.position.set(0, 0.44, -4.4);
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.08, 1.48), velvet);
    deskTop.position.set(0, 0.92, -4.4);
    r.group.add(desk, deskTop);

    r.interactables.push({
      id: 'watch_try_tourbillon',
      label: 'ADMIRE GENEVA TOURBILLON (+CHF 250 VIP)',
      subtitle: 'Master Watchmaker: "A 18k rose-gold Geneva Seal Tourbillon — reserved for our finest clients." (+CHF 250)',
      toast: 'POINÇON DE GENÈVE · +CHF 250',
      x: 0,
      z: -3.2,
      radius: 2.8,
      rewardCash: 250,
    });
  }

  // -----------------------------------------------------------------------------------------------
  // 2. BANQUE PRIVÉE DE GENÈVE — MARBLE PRIVATE BANK LOBBY & SWISS GOLD BULLION VAULT!
  // -----------------------------------------------------------------------------------------------
  {
    const r = buildShell(
      'private_bank',
      'BANQUE PRIVÉE DE GENÈVE',
      'GESTION DE FORTUNE · RUE DU RHÔNE',
      680,
      16,
      16,
      5.4,
      '#eae8e2',
      '#d9d3c7',
      '#16243a',
      { x: -64.0, z: 222.0, yaw: 0.1 }
    );
    const marbleCol = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.34 });
    const darkOak = new THREE.MeshStandardMaterial({ color: 0x352216, roughness: 0.46 });
    const goldBarMat = new THREE.MeshStandardMaterial({ color: 0xffcf40, roughness: 0.14, metalness: 0.96 });
    const vaultSteel = new THREE.MeshStandardMaterial({ color: 0x3b444f, roughness: 0.28, metalness: 0.86 });

    // 4 Fluted Carrara Marble Lobby Columns
    for (const cx of [-4.6, 4.6]) {
      for (const cz of [-3.5, 2.5]) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 5.4, 14), marbleCol);
        col.position.set(cx, 2.7, cz);
        r.group.add(col);
      }
    }
    // Private Banking Reception Desk
    const desk = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.12, 1.35), darkOak);
    desk.position.set(0, 0.56, -1.8);
    const brassTrim = new THREE.Mesh(new THREE.BoxGeometry(5.68, 0.08, 1.42), r.brassMat);
    brassTrim.position.set(0, 1.14, -1.8);
    r.group.add(desk, brassTrim);

    // Circular Swiss Steel Vault Door & Gleaming 24k Gold Bullion Pyramid Display!
    const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.35, 24).rotateX(Math.PI * 0.5), vaultSteel);
    vaultDoor.position.set(0, 2.1, -7.65);
    const vaultWheel = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.07, 8, 18), r.brassMat);
    vaultWheel.position.set(0, 2.1, -7.42);
    r.group.add(vaultDoor, vaultWheel);

    // Pyramid of Swiss 999.9 Gold Bars on velvet plinth!
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.96, 1.35), darkOak);
    plinth.position.set(0, 0.48, -5.2);
    r.group.add(plinth);
    for (let row = 0; row < 3; row++) {
      for (let b = 0; b < 3 - row; b++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.24), goldBarMat);
        bar.position.set((b - (2 - row) * 0.5) * 0.54, 1.06 + row * 0.17, -5.2);
        r.group.add(bar);
      }
    }

    r.interactables.push({
      id: 'bank_collect_bonus',
      label: 'COLLECT BANKER DIVIDEND (+CHF 750)',
      subtitle: 'Private Banker: "Your quarterly Geneva portfolio dividend has cleared. +CHF 750 credited!"',
      toast: 'BANQUE PRIVÉE · +CHF 750',
      x: 0,
      z: -0.6,
      radius: 3.0,
      rewardCash: 750,
    });
  }

  // -----------------------------------------------------------------------------------------------
  // 3. BUVETTE DES BAINS — LAKESIDE FONDUE & ESPRESSO CHALET (AT LES BAINS DES PÂQUIS!)
  // -----------------------------------------------------------------------------------------------
  {
    const r = buildShell(
      'buvette_bains',
      'BUVETTE DES BAINS · CHALET',
      'FONDUE MOITIÉ-MOITIÉ · PLAT DU JOUR · LAC LÉMAN',
      740,
      13,
      12,
      4.2,
      '#94714c',
      '#6b4b31',
      '#144278',
      { x: 434.5, z: -505.2, y: 1.96, yaw: 1.24 }
    );
    const pine = new THREE.MeshStandardMaterial({ color: 0xab7f52, roughness: 0.76, envMapIntensity: 0.18 });
    const darkTimber = new THREE.MeshStandardMaterial({ color: 0x4c321e, roughness: 0.80, envMapIntensity: 0.16 });
    const slateTop = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.48, metalness: 0.12, envMapIntensity: 0.22 });
    const copper = new THREE.MeshStandardMaterial({ color: 0xc86b38, roughness: 0.28, metalness: 0.82, envMapIntensity: 0.45 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdbe2ea, roughness: 0.20, metalness: 0.90, envMapIntensity: 0.55 });
    const cheese = new THREE.MeshStandardMaterial({ color: 0xf6d874, roughness: 0.36, envMapIntensity: 0.2 });
    const runnerMat = new THREE.MeshStandardMaterial({ color: 0xb8242e, roughness: 0.84, envMapIntensity: 0.15 });
    const lampGlow = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffc466, emissiveIntensity: 1.2, roughness: 0.2 });

    // Crafted Swiss Wooden Chalet Bar Counter + Overhanging Dark Slate Bar Top + Vertical Timber Slats + Espresso Machine!
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.04, 1.05), pine);
    barBase.position.set(0, 0.52, -3.6);
    const barTop = new THREE.Mesh(new THREE.BoxGeometry(7.05, 0.10, 1.28), slateTop);
    barTop.position.set(0, 1.09, -3.55);
    const footRail = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 6.7, 8).rotateZ(Math.PI * 0.5), r.brassMat);
    footRail.position.set(0, 0.22, -2.96);
    r.group.add(barBase, barTop, footRail);
    for (let sx = -3.1; sx <= 3.11; sx += 0.62) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.02, 0.06), darkTimber);
      slat.position.set(sx, 0.52, -3.05);
      r.group.add(slat);
    }
    // 3 Chalet Bar Stools along the counter
    for (const bsx of [-2.1, 0.2, 2.2]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.72, 8), darkTimber);
      leg.position.set(bsx, 0.36, -2.42);
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.07, 14), pine);
      seat.position.set(bsx, 0.74, -2.42);
      r.group.add(leg, seat);
    }
    // Classic Red Swiss Espresso Machine with Chrome Grouphead & Warm Porcelain Cups
    const espresso = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.58, 0.52), new THREE.MeshStandardMaterial({ color: 0xb81f28, roughness: 0.28, metalness: 0.45, envMapIntensity: 0.35 }));
    espresso.position.set(-1.6, 1.43, -3.65);
    const groupHead = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.14, 0.22), chrome);
    groupHead.position.set(-1.6, 1.54, -3.34);
    const dripTray = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.05, 0.26), chrome);
    dripTray.position.set(-1.6, 1.17, -3.34);
    r.group.add(espresso, groupHead, dripTray);
    // Warm Hanging Chalet Pendant Lamps over the bar!
    for (const lx of [-2.2, 0.0, 2.2]) {
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.1, 6), darkTimber);
      cord.position.set(lx, 3.65, -3.55);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 12, 1, true), copper);
      shade.position.set(lx, 3.05, -3.55);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), lampGlow);
      bulb.position.set(lx, 2.98, -3.55);
      r.group.add(cord, shade, bulb);
    }

    // 4 Crafted Four-Legged Swiss Wooden Fondue Tables with Red Runners, Benches & Copper Caquelons!
    for (const [tx, tz] of [[-3.4, 0.4], [3.4, 0.4], [-3.4, 3.1], [3.4, 3.1]]) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.09, 1.08), pine);
      top.position.set(tx, 0.76, tz);
      const runner = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.015, 1.10), runnerMat);
      runner.position.set(tx, 0.812, tz);
      r.group.add(top, runner);
      for (const [lx, lz] of [[-1.02, -0.42], [1.02, -0.42], [-1.02, 0.42], [1.02, 0.42]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), darkTimber);
        leg.position.set(tx + lx, 0.36, tz + lz);
        r.group.add(leg);
      }
      for (const bSide of [-0.82, 0.82]) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.34), pine);
        bench.position.set(tx, 0.45, tz + bSide);
        const bLegL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.28), darkTimber);
        bLegL.position.set(tx - 0.82, 0.21, tz + bSide);
        const bLegR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.28), darkTimber);
        bLegR.position.set(tx + 0.82, 0.21, tz + bSide);
        r.group.add(bench, bLegL, bLegR);
      }
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, 0.16, 14), copper);
      pot.position.set(tx, 0.89, tz);
      const fon = new THREE.Mesh(new THREE.CircleGeometry(0.21, 14).rotateX(-Math.PI / 2), cheese);
      fon.position.set(tx, 0.975, tz);
      r.group.add(pot, fon);
    }

    r.interactables.push({
      id: 'buvette_order_fondue',
      label: 'ORDER GENEVA FONDUE & SPRITZ',
      subtitle: 'Buvette des Bains: "Bon appétit! Gruyère & Vacherin Fribourgeois Fondue Moitié-Moitié served warm!"',
      toast: 'BUVETTE DES BAINS · FONDUE!',
      x: 0,
      z: -2.0,
      radius: 3.1,
      rewardCash: 0,
    });
  }

  function enterInterior(id, playerState) {
    const room = rooms.get(id);
    if (!room) return null;
    // Only restore savedOutdoorPos if the player actually walked in from this venue's exterior doorway!
    // If entered via teleport/preset from across Geneva, exit MUST return cleanly to room.entryWorld (e.g. Les Bains des Pâquis)!
    const distToEntry = Math.hypot(playerState.x - room.entryWorld.x, playerState.z - room.entryWorld.z);
    savedOutdoorPos =
      distToEntry < 14.0
        ? { x: playerState.x, y: playerState.y, z: playerState.z, yaw: playerState.yaw }
        : null;
    if (activeRoom) activeRoom.group.visible = false;
    activeRoom = room;
    room.group.visible = true;
    playerState.x = room.spawn.x;
    playerState.y = room.spawn.y;
    playerState.z = room.spawn.z;
    playerState.yaw = room.spawn.yaw;
    playerState.vx = 0;
    playerState.vy = 0;
    playerState.vz = 0;
    playerState.grounded = true;
    playerState.swimming = false;
    return room;
  }

  function exitInterior(playerState) {
    if (!activeRoom) return null;
    const prev = activeRoom;
    prev.group.visible = false;
    activeRoom = null;
    const dest = savedOutdoorPos || prev.entryWorld;
    playerState.x = dest.x;
    playerState.y = dest.y;
    playerState.z = dest.z;
    playerState.yaw = dest.yaw || 0;
    playerState.vx = 0;
    playerState.vy = 0;
    playerState.vz = 0;
    playerState.grounded = true;
    return prev;
  }

  function clampPlayerInside(playerState) {
    if (!activeRoom) return;
    playerState.x = Math.max(-activeRoom.halfW, Math.min(activeRoom.halfW, playerState.x));
    playerState.z = Math.max(-activeRoom.halfD, Math.min(activeRoom.halfD, playerState.z));
    if (playerState.y < activeRoom.originY) {
      playerState.y = activeRoom.originY;
      playerState.vy = 0;
      playerState.grounded = true;
    }
  }

  function findNearestInteriorAction(px, pz) {
    if (!activeRoom) return null;
    const dExit = Math.hypot(px - activeRoom.exitDoorLocal.x, pz - activeRoom.exitDoorLocal.z);
    if (dExit < 2.6) {
      return { kind: 'exit', label: `EXIT ${activeRoom.title}` };
    }
    for (const it of activeRoom.interactables) {
      if (Math.hypot(px - it.x, pz - it.z) < (it.radius || 2.8)) {
        return { kind: 'action', item: it, label: it.label };
      }
    }
    return null;
  }

  function update(elapsed) {
    if (!activeRoom) return;
    for (let i = 0; i < animatedWatches.length; i++) {
      animatedWatches[i].rotation.y = elapsed * 1.1 + i * 1.5;
    }
  }

  return {
    enterInterior,
    exitInterior,
    clampPlayerInside,
    findNearestInteriorAction,
    getActiveRoom: () => activeRoom,
    isInside: () => activeRoom !== null,
    update,
  };
}
