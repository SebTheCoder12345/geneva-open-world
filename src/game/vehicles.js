import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { getGroundHeight, isWater, clampToWorld, VEHICLE_SPAWNS } from '../world/cityData.js';
import {
  createShadowBlobTexture,
  createSmokeTexture,
  createTpgSideTexture,
  createTpgFrontTexture,
} from '../world/textures.js';
import {
  loadBusTemplate,
  setupBlenderTpgBus,
  loadGwagonTemplate,
  loadSedanTemplate,
  loadVespaTemplate,
  loadChargerTemplate,
  loadPorscheTemplate,
  loadRs6Template,
  cloneStyledBlenderVehicle,
} from '../world/roadTraffic.js';
import { batchStaticGroup, batchVehicleTemplate } from '../world/staticBatcher.js';
import { resolveCircleAgainstCollider, resolveOBBAgainstCollider } from './collisions.js';

// Real-life per-vehicle mass (kg), tire grip, braking & restitution profiles
function getVehiclePhysicsSpec(style) {
  switch (style) {
    case 'escooter':
      return { mass: 28, accel: 16.5, brake: 20, latGrip: 13.5, driftGrip: 8.0, steerMax: 2.85, restitution: 0.16 };
    case 'scooter':
      return { mass: 145, accel: 22.0, brake: 26, latGrip: 11.2, driftGrip: 4.5, steerMax: 2.35, restitution: 0.20 };
    case 'coupe':
    case 'porsche':
      return { mass: 1460, accel: 32.0, brake: 38, latGrip: 9.8, driftGrip: 2.15, steerMax: 2.25, restitution: 0.24 };
    case 'charger':
    case 'rs6':
      return { mass: 1960, accel: 30.0, brake: 35, latGrip: 8.8, driftGrip: 1.95, steerMax: 2.12, restitution: 0.22 };
    case 'gwagon':
      return { mass: 2550, accel: 24.5, brake: 30, latGrip: 7.8, driftGrip: 2.1, steerMax: 1.95, restitution: 0.20 };
    case 'bus':
      return { mass: 12500, accel: 12.8, brake: 21, latGrip: 7.4, driftGrip: 4.2, steerMax: 1.32, restitution: 0.14 };
    case 'van':
      return { mass: 2400, accel: 21.0, brake: 27, latGrip: 7.6, driftGrip: 2.6, steerMax: 1.85, restitution: 0.18 };
    default:
      return { mass: 1680, accel: 26.5, brake: 32, latGrip: 8.9, driftGrip: 2.15, steerMax: 2.15, restitution: 0.22 };
  }
}

// Authentic Geneva TPG City Bus (White + TPG Royal Blue + Orange tpg logo + glowing LED route screen!)
export function createTpgBusMesh(routeNum = '25', dest = 'JARDIN BOTANIQUE', badgeColor = '#3852a4') {
  const g = new THREE.Group();
  const sideMat = new THREE.MeshPhysicalMaterial({
    map: createTpgSideTexture(routeNum, dest, false),
    roughness: 0.24,
    metalness: 0.15,
    clearcoat: 0.85,
  });
  const frontMat = new THREE.MeshPhysicalMaterial({
    map: createTpgFrontTexture(routeNum, dest.split(' ')[0], badgeColor),
    roughness: 0.22,
    clearcoat: 0.9,
  });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xe6eaf0, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.88 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0d6de, roughness: 0.3, metalness: 0.85 });

  // Main low-floor European Mercedes Citaro bus body (2.55m wide x 3.05m tall x 11.8m long)
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.55, 2.75, 11.8),
    [sideMat, sideMat, roofMat, darkMat, frontMat, frontMat]
  );
  body.position.y = 1.68;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Roof AC & hybrid battery pods
  const ac1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.34, 3.4), roofMat);
  ac1.position.set(0, 3.22, 1.8);
  const ac2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.28, 2.2), roofMat);
  ac2.position.set(0, 3.18, -2.8);
  g.add(ac1, ac2);

  // Extended bus side mirrors
  for (const sx of [-1.42, 1.42]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.24), darkMat);
    mir.position.set(sx, 2.2, 5.75);
    g.add(mir);
  }

  // Glowing brake taillights
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1111, emissiveIntensity: 1.5 });
  for (const sx of [-1.05, 1.05]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.08), tailMat);
    tl.position.set(sx, 1.12, -5.92);
    g.add(tl);
  }

  // Spinning heavy-duty bus wheels
  const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.34, 16).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.36, 10).rotateZ(Math.PI / 2);
  const wheelMeshes = [];
  for (const [wx, wz] of [
    [-1.24, 3.4], [1.24, 3.4],
    [-1.24, -3.4], [1.24, -3.4],
  ]) {
    const w = new THREE.Group();
    w.position.set(wx, 0.5, wz);
    w.add(new THREE.Mesh(wheelGeo, wheelMat), new THREE.Mesh(rimGeo, rimMat));
    g.add(w);
    wheelMeshes.push(w);
  }

  return { group: g, tailMat, wheelMeshes };
}

function createMouetteMesh() {
  const g = new THREE.Group();
  const yellowMat = new THREE.MeshPhysicalMaterial({ color: 0xffc814, roughness: 0.2, clearcoat: 1.0 });
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, roughness: 0.25, clearcoat: 0.8 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0f2030, roughness: 0.06, metalness: 0.9, clearcoat: 1.0 });

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-4.4, 0.0);
  hullShape.lineTo(3.4, 0.0);
  hullShape.quadraticCurveTo(5.2, 0.4, 5.4, 1.15);
  hullShape.lineTo(-4.4, 1.05);
  hullShape.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 3.0,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.12,
    bevelSegments: 3,
  });
  hullGeo.translate(0, 0, -1.5);
  hullGeo.rotateY(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, yellowMat);
  hull.castShadow = true;
  g.add(hull);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.65, 1.28, 5.6), glassMat);
  cabin.position.set(0, 1.68, -0.4);
  g.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.18, 6.2), whiteMat);
  roof.position.set(0, 2.38, -0.4);
  g.add(roof);

  const nav = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xfff0b3, emissive: 0xffd27a, emissiveIntensity: 2.2 })
  );
  nav.position.set(0, 2.62, 2.3);
  g.add(nav);

  return g;
}

function createHelicopterMesh() {
  const g = new THREE.Group();
  const redMat = new THREE.MeshPhysicalMaterial({ color: 0xd41c1c, roughness: 0.16, metalness: 0.48, clearcoat: 1.0 });
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf7f8fa, roughness: 0.2, clearcoat: 0.9 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0d1b2a, roughness: 0.05, metalness: 0.92, clearcoat: 1.0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.38, metalness: 0.85 });

  const fShape = new THREE.Shape();
  fShape.moveTo(-2.6, 0.95);
  fShape.lineTo(2.4, 0.95);
  fShape.quadraticCurveTo(4.2, 1.05, 4.1, 1.85);
  fShape.quadraticCurveTo(3.4, 2.78, 1.8, 2.95);
  fShape.lineTo(-1.8, 2.95);
  fShape.quadraticCurveTo(-2.8, 2.6, -2.6, 0.95);

  const fGeo = new THREE.ExtrudeGeometry(fShape, {
    depth: 2.2,
    bevelEnabled: true,
    bevelThickness: 0.22,
    bevelSize: 0.18,
    bevelSegments: 4,
  });
  fGeo.translate(0, 0, -1.1);
  fGeo.rotateY(-Math.PI / 2);
  const fuse = new THREE.Mesh(fGeo, redMat);
  fuse.castShadow = true;
  g.add(fuse);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.18, 16, 12), glassMat);
  canopy.scale.set(0.96, 0.78, 1.38);
  canopy.position.set(0, 1.92, 2.55);
  g.add(canopy);

  const crossV = new THREE.Mesh(new THREE.BoxGeometry(2.68, 1.08, 0.34), whiteMat);
  crossV.position.set(0, 1.9, 0.1);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.68, 0.34, 1.08), whiteMat);
  crossH.position.set(0, 1.9, 0.1);
  g.add(crossV, crossH);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.55, 6.6, 10).rotateX(Math.PI / 2), redMat);
  tail.position.set(0, 2.25, -5.6);
  tail.castShadow = true;
  g.add(tail);

  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.1, 1.2), whiteMat);
  fin.position.set(0, 2.85, -8.6);
  fin.rotation.x = -0.18;
  g.add(fin);

  const strobeMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0xff2222, emissiveIntensity: 3.5 });
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), strobeMat);
  strobe.position.set(0, 4.0, -8.8);
  g.add(strobe);

  for (const sx of [-1.28, 1.28]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5.4, 10).rotateX(Math.PI / 2), darkMat);
    skid.position.set(sx, 0.14, 0.4);
    g.add(skid);
    for (const sz of [-0.9, 1.5]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8), darkMat);
      strut.position.set(sx * 0.85, 0.62, sz);
      g.add(strut);
    }
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.85, 10), darkMat);
  mast.position.set(0, 3.32, 0);
  g.add(mast);

  const mainRotor = new THREE.Group();
  mainRotor.position.set(0, 3.74, 0);
  mainRotor.add(
    new THREE.Mesh(new THREE.BoxGeometry(11.8, 0.06, 0.34), darkMat),
    new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 11.8), darkMat)
  );
  const rotorDiscMat = new THREE.MeshBasicMaterial({ color: 0x1a1e24, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
  const rotorDisc = new THREE.Mesh(new THREE.CircleGeometry(5.8, 28).rotateX(-Math.PI / 2), rotorDiscMat);
  mainRotor.add(rotorDisc);
  g.add(mainRotor);

  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.34, 2.85, -8.6);
  tailRotor.add(
    new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.8, 0.16), darkMat),
    new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 1.8), darkMat)
  );
  g.add(tailRotor);

  mainRotor.userData.noBatch = true;
  tailRotor.userData.noBatch = true;
  strobe.userData.noBatch = true;
  batchStaticGroup(g, { label: 'SwissHeliBatch', minMeshes: 2, disposeSource: true, staticMatrix: true });

  return { group: g, mainRotor, tailRotor, rotorDiscMat, strobeMat };
}

// Sleek Ridable Geneva Electric Trottinette (Voi Coral / Lime Green / Tier Purple) with LED headlight, dash, brake tail & spinning wheels!
function createEScooterMesh(colorHex) {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.22,
    metalness: 0.28,
    clearcoat: 0.92,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.5,
  });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x181b20, roughness: 0.92, metalness: 0.04 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e232a, roughness: 0.36, metalness: 0.78 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.25, metalness: 0.88 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff8e6, emissive: 0xffecc0, emissiveIntensity: 2.2 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x12242a, emissive: 0x26e8a8, emissiveIntensity: 1.4 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1212, emissiveIntensity: 1.8 });

  // Painted aluminum standing deck + black anti-slip rubber grip tape
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.075, 1.12), frameMat);
  deck.position.set(0, 0.16, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.012, 0.88), gripMat);
  grip.position.set(0, 0.202, -0.04);

  // Angled steering neck, upright stem, dual rubber grips, LED battery dashboard & front headlight
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.18), darkMetal);
  neck.position.set(0, 0.22, 0.48);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 1.06, 10), frameMat);
  stem.position.set(0, 0.68, 0.42);
  stem.rotation.x = -0.20;
  stem.castShadow = true;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 10).rotateZ(Math.PI / 2), darkMetal);
  bar.position.set(0, 1.17, 0.31);
  for (const sx of [-0.21, 0.21]) {
    const gripH = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.13, 8).rotateZ(Math.PI / 2), gripMat);
    gripH.position.set(sx, 1.17, 0.31);
    g.add(gripH);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.022, 0.095), dashMat);
  dash.position.set(0, 1.19, 0.31);
  dash.rotation.x = -0.35;
  const headLight = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.045, 0.04), headMat);
  headLight.position.set(0, 1.13, 0.35);

  // Rear mudguard fender + glowing LED brake taillight
  const rearFender = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, 0.26), darkMetal);
  rearFender.position.set(0, 0.27, -0.49);
  rearFender.rotation.x = -0.22;
  const rearTail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.03), tailMat);
  rearTail.position.set(0, 0.25, -0.61);

  // Spinning front & rear rubber wheels with brushed alloy hubs
  const tireGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.068, 14).rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.078, 0.078, 0.072, 10).rotateZ(Math.PI / 2);
  const wheelMeshes = [];
  for (const wz of [0.50, -0.49]) {
    const wg = new THREE.Group();
    wg.position.set(0, 0.14, wz);
    wg.userData.noBatch = true;
    wg.add(new THREE.Mesh(tireGeo, gripMat), new THREE.Mesh(hubGeo, rimMat));
    g.add(wg);
    wheelMeshes.push(wg);
  }

  g.add(deck, grip, neck, stem, bar, dash, headLight, rearFender, rearTail);
  batchStaticGroup(g, { label: 'EScooterBatch', minMeshes: 2, disposeSource: true, staticMatrix: true });
  const shadowMeshes = [];
  g.traverse((o) => {
    if (o.isMesh && o.castShadow) shadowMeshes.push(o);
  });
  return { model: g, wheelMeshes, shadowMeshes, tailMat };
}

export function createVehicles(scene) {
  const vehicles = [];
  const vehiclesGroup = new THREE.Group();
  vehiclesGroup.name = 'Geneva_Parked_Road_Vehicles';
  scene.add(vehiclesGroup);
  const shadowBlobMat = new THREE.MeshBasicMaterial({
    map: createShadowBlobTexture(),
    transparent: true,
    opacity: 0.90,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });

  // Volumetric Tire Smoke & Water Wake Particle Pool (140 billowing sprites!)
  const smokePool = [];
  const smokeGeo = new THREE.BufferGeometry();
  const SMOKE_N = 140;
  const smokePos = new Float32Array(SMOKE_N * 3);
  for (let i = 0; i < SMOKE_N; i++) {
    smokePos[i * 3 + 1] = -999;
    smokePool.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokePoints = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({
      map: createSmokeTexture(),
      color: 0xf0f4f8,
      size: 3.4,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  smokePoints.frustumCulled = false;
  scene.add(smokePoints);

  let smokeCursor = 0;
  function spawnSmoke(x, y, z, vx = 0, vy = 1.6, vz = 0) {
    const p = smokePool[smokeCursor];
    smokeCursor = (smokeCursor + 1) % SMOKE_N;
    p.x = x + (Math.random() - 0.5) * 0.6;
    p.y = y + 0.25;
    p.z = z + (Math.random() - 0.5) * 0.6;
    p.vx = vx + (Math.random() - 0.5) * 1.6;
    p.vy = vy + Math.random() * 1.1;
    p.vz = vz + (Math.random() - 0.5) * 1.6;
    p.life = 0.85 + Math.random() * 0.5;
  }

  // Metallic Collision Spark Burst Pool (96 glowing amber-white sparks, 1 draw call!)
  const SPARK_N = 96;
  const sparkPool = [];
  const sparkGeo = new THREE.BufferGeometry();
  const sparkPos = new Float32Array(SPARK_N * 3);
  for (let i = 0; i < SPARK_N; i++) {
    sparkPos[i * 3 + 1] = -999;
    sparkPool.push({ x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkPoints = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      map: createSmokeTexture(),
      color: 0xffd26a,
      size: 0.68,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  sparkPoints.frustumCulled = false;
  scene.add(sparkPoints);

  let sparkCursor = 0;
  function spawnSparks(x, y, z, nx, nz, count = 8, power = 6) {
    const n = Math.min(24, Math.max(3, count));
    for (let i = 0; i < n; i++) {
      const p = sparkPool[sparkCursor];
      sparkCursor = (sparkCursor + 1) % SPARK_N;
      const spread = (Math.random() - 0.5) * 1.6;
      const tx = -nz;
      const tz = nx;
      const spd = power * (0.45 + Math.random() * 0.85);
      p.x = x + (Math.random() - 0.5) * 0.25;
      p.y = y + Math.random() * 0.35;
      p.z = z + (Math.random() - 0.5) * 0.25;
      p.vx = (nx * 0.7 + tx * spread) * spd;
      p.vy = 2.2 + Math.random() * (power * 0.55);
      p.vz = (nz * 0.7 + tz * spread) * spd;
      p.life = 0.22 + Math.random() * 0.28;
    }
  }

  const carHeadlight = new THREE.SpotLight(0xfff4d6, 0, 95, Math.PI / 4.0, 0.45, 1.1);
  scene.add(carHeadlight);
  scene.add(carHeadlight.target);

  const carVehicles = [];
  for (const d of VEHICLE_SPAWNS.cars) {
    const holder = new THREE.Group();
    const chassis = new THREE.Group(); // tilts for real suspension pitch & roll!
    holder.add(chassis);

    // Crisp grounded AO contact shadow tightly beneath tires (no floating gap!)
    const isScooter = d.style === 'scooter';
    const isEScooter = d.style === 'escooter';
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(isEScooter ? 0.52 : isScooter ? 0.92 : 3.15, isEScooter ? 1.38 : isScooter ? 2.05 : 5.65).rotateX(-Math.PI / 2),
      shadowBlobMat
    );
    shadowPlane.position.y = 0.025;
    holder.add(shadowPlane);

    const groundLift = isEScooter ? 0.16 : 0.30;
    const y = getGroundHeight(d.x, d.z) + groundLift;
    holder.position.set(d.x, y, d.z);
    holder.rotation.y = d.yaw;
    vehiclesGroup.add(holder);

    let tailMat = new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1111, emissiveIntensity: 1.6 });
    let wheelMeshes = [];
    let shadowMeshes = [];
    if (isEScooter) {
      const es = createEScooterMesh(d.color);
      chassis.add(es.model);
      wheelMeshes = es.wheelMeshes;
      shadowMeshes = es.shadowMeshes;
      tailMat = es.tailMat;
    } else if (d.style === 'coupe' || d.style === 'police' || d.style === 'taxi') {
      for (const sx of [-0.62, 0.62]) {
        const tl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), tailMat);
        tl.position.set(sx, 0.78, -2.14);
        chassis.add(tl);
      }
    }

    // Cobalt-Blue Neon Underglow + Nitro Exhaust Flame Cone on Ferrari 458 (inspired by Reference 2!)
    let underglowLight = null;
    let nitroFlame = null;
    if (d.style === 'coupe') {
      underglowLight = new THREE.PointLight(0x2878ff, 0, 14, 1.8);
      underglowLight.position.set(0, 0.25, 0);
      chassis.add(underglowLight);
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0x45b8ff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      nitroFlame = new THREE.Group();
      for (const ex of [-0.34, 0, 0.34]) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.85, 8).rotateX(-Math.PI / 2), flameMat);
        cone.position.set(ex, 0.38, -2.55);
        nitroFlame.add(cone);
      }
      nitroFlame.visible = false;
      chassis.add(nitroFlame);
    }

    let policeLights = null;
    if (d.style === 'police') {
      const matL = new THREE.MeshStandardMaterial({ color: 0x2b7fff, emissive: 0x2b7fff, emissiveIntensity: 3.2 });
      const matR = new THREE.MeshStandardMaterial({ color: 0xff2b2b, emissive: 0xff2b2b, emissiveIntensity: 3.2 });
      const barL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), matL);
      barL.position.set(-0.32, 1.28, -0.15);
      const barR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.24), matR);
      barR.position.set(0.32, 1.28, -0.15);
      chassis.add(barL, barR);
      policeLights = { matL, matR };
    } else if (d.style === 'taxi') {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.18, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffb82e, emissiveIntensity: 1.8 })
      );
      sign.position.set(0, 1.3, -0.12);
      chassis.add(sign);
    }

    const spec = getVehiclePhysicsSpec(d.style);
    const vObj = {
      id: d.id,
      type: 'car',
      style: d.style,
      label: d.label,
      color: d.color,
      mesh: holder,
      chassis,
      tailMat,
      underglowLight,
      nitroFlame,
      policeLights,
      wheelMeshes,
      shadowMeshes,
      _castShadow: true,
      x: d.x,
      y,
      z: d.z,
      yaw: d.yaw,
      vx: 0,
      vy: 0,
      vz: 0,
      yawVel: 0,
      speed: 0,
      slopePitch: 0,
      slopeRoll: 0,
      suspPitch: 0,
      suspRoll: 0,
      driftSlip: 0,
      mass: spec.mass,
      invMass: 1 / spec.mass,
      maxSpeed: d.maxSpeed,
      halfW: isEScooter ? 0.28 : isScooter ? 0.45 : d.style === 'gwagon' ? 1.08 : d.style === 'charger' ? 1.06 : 1.05,
      halfL: isEScooter ? 0.62 : isScooter ? 1.05 : d.style === 'charger' || d.style === 'rs6' ? 2.55 : 2.38,
      height: isEScooter ? 1.2 : isScooter ? 1.35 : d.style === 'gwagon' ? 2.0 : 1.5,
    };
    vehicles.push(vObj);
    carVehicles.push(vObj);
  }

  // Parked Drivable High-Poly Blender-Rendered Geneva TPG City Bus (Ligne 25) along Quai du Général-Guisan!
  if (VEHICLE_SPAWNS.bus) {
    const bd = VEHICLE_SPAWNS.bus;
    const busHolder = new THREE.Group();
    const busChassis = new THREE.Group();
    busHolder.add(busChassis);
    const busShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 12.8).rotateX(-Math.PI / 2), shadowBlobMat);
    busShadow.position.y = 0.06;
    busHolder.add(busShadow);

    const by = getGroundHeight(bd.x, bd.z) + 0.30;
    busHolder.position.set(bd.x, by, bd.z);
    busHolder.rotation.y = bd.yaw;
    vehiclesGroup.add(busHolder);

    const busObj = {
      id: bd.id,
      type: 'car',
      style: 'bus',
      label: bd.label,
      mesh: busHolder,
      chassis: busChassis,
      tailMat: new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: 0xff1111, emissiveIntensity: 1.4 }),
      policeLights: null,
      wheelMeshes: [],
      shadowMeshes: [],
      _castShadow: true,
      x: bd.x,
      y: by,
      z: bd.z,
      yaw: bd.yaw,
      vx: 0,
      vy: 0,
      vz: 0,
      yawVel: 0,
      speed: 0,
      slopePitch: 0,
      slopeRoll: 0,
      suspPitch: 0,
      suspRoll: 0,
      driftSlip: 0,
      mass: 12500,
      invMass: 1 / 12500,
      maxSpeed: bd.maxSpeed,
      halfW: 1.35,
      halfL: 6.1,
      height: 3.3,
    };
    vehicles.push(busObj);

    // Load the pre-batched high-poly Blender Mercedes Citaro C2 .glb into the drivable bus!
    loadBusTemplate().then((tpl) => {
      if (tpl) {
        const built = setupBlenderTpgBus(tpl, '25', 'JARDIN BOTANIQUE', '#d44292', 0xf26522);
        busChassis.add(built.model);
        busObj.wheelMeshes = built.wheelMeshes;
        busObj.shadowMeshes = built.shadowMeshes;
        busObj.tailMat = built.tailMat;
      } else {
        const fallback = createTpgBusMesh('25', 'JARDIN BOTANIQUE', '#d44292');
        busChassis.add(fallback.group);
        busObj.wheelMeshes = fallback.wheelMeshes;
        busObj.tailMat = fallback.tailMat;
      }
    });
  }

  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('draco/');
  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  // Load Ferrari GLB for sports/police/taxi (pre-batched ONCE from 51 meshes -> ~18 meshes!)
  // AND our pre-batched Blender GLBs for Dodge Charger SRT, Porsche 911 GT3, Audi RS6, G-Wagon, Euro Sedan & Red Vespa!
  gltfLoader.load(
    'models/ferrari.glb',
    (gltf) => {
      const template = gltf.scene.children[0] || gltf.scene;
      // Tag custom-styled Ferrari parts before pre-batching template ONCE
      const fBodyTag = new THREE.MeshStandardMaterial({ name: '__FERRARI_BODY' });
      const fDetailsTag = new THREE.MeshStandardMaterial({ name: '__FERRARI_DETAILS' });
      const fGlassTag = new THREE.MeshStandardMaterial({ name: '__FERRARI_GLASS' });
      template.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        if (obj.name === 'body') obj.material = fBodyTag;
        else if (obj.name.startsWith('rim_') || obj.name === 'trim') obj.material = fDetailsTag;
        else if (obj.name === 'glass') obj.material = fGlassTag;
      });
      batchVehicleTemplate(template, { label: 'FerrariTpl', keepNames: [] });

      const detailsMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.25 });
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x0b1622,
        metalness: 0.25,
        roughness: 0.05,
        transmission: 0.55,
        transparent: true,
      });

      for (const v of carVehicles) {
        if (['gwagon', 'sedan', 'scooter', 'escooter', 'charger', 'porsche', 'rs6'].includes(v.style)) continue;
        const carModel = template.clone(true);
        carModel.rotation.y = Math.PI;

        const bodyMat = new THREE.MeshPhysicalMaterial({
          color: v.color,
          metalness: 0.78,
          roughness: 0.14,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          envMapIntensity: 1.65,
        });

        carModel.traverse((obj) => {
          if (!obj.isMesh) return;
          const mName = obj.material?.name || '';
          // Only cast shadows from exterior body & wheel meshes (skips 250K+ hidden interior/carpet/seat triangles in shadow pass!)
          const isExteriorShadow =
            mName === '__FERRARI_BODY' ||
            mName === '__FERRARI_DETAILS' ||
            mName === 'Tires' ||
            mName === 'metal_gray' ||
            obj.name.startsWith('FerrariTpl_wheel_');
          obj.castShadow = isExteriorShadow;
          obj.receiveShadow = true;
          if (isExteriorShadow) v.shadowMeshes.push(obj);
          if (mName === '__FERRARI_BODY' || obj.name === 'body') obj.material = bodyMat;
          else if (mName === '__FERRARI_DETAILS' || obj.name.startsWith('rim_') || obj.name === 'trim') obj.material = detailsMat;
          else if (mName === '__FERRARI_GLASS' || obj.name === 'glass') obj.material = glassMat;
        });

        for (const wName of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) {
          const wObj = carModel.getObjectByName(wName);
          if (wObj) v.wheelMeshes.push(wObj);
        }

        v.chassis.add(carModel);
      }
    },
    undefined,
    (err) => console.warn('Ferrari GLB load error:', err)
  );

  Promise.all([
    loadGwagonTemplate(),
    loadSedanTemplate(),
    loadVespaTemplate(),
    loadChargerTemplate(),
    loadPorscheTemplate(),
    loadRs6Template(),
  ]).then(([gwTpl, sdTpl, vsTpl, chTpl, p9Tpl, rsTpl]) => {
    for (const v of carVehicles) {
      const tpl =
        v.style === 'gwagon'
          ? gwTpl
          : v.style === 'sedan'
          ? sdTpl
          : v.style === 'scooter'
          ? vsTpl
          : v.style === 'charger'
          ? chTpl
          : v.style === 'porsche'
          ? p9Tpl
          : v.style === 'rs6'
          ? rsTpl
          : null;
      if (!tpl) continue;
      const built = cloneStyledBlenderVehicle(tpl, v.color);
      v.chassis.add(built.model);
      v.wheelMeshes = built.wheelMeshes;
      v.shadowMeshes = built.shadowMeshes;
      if (built.tailMat) v.tailMat = built.tailMat;
    }
  });

  // Yellow Mouette water taxi
  const mSpawn = VEHICLE_SPAWNS.boat;
  const mouetteMesh = createMouetteMesh();
  mouetteMesh.position.set(mSpawn.x, 0.0, mSpawn.z);
  mouetteMesh.rotation.y = mSpawn.yaw;
  scene.add(mouetteMesh);
  vehicles.push({
    id: mSpawn.id,
    type: 'boat',
    label: mSpawn.label,
    mesh: mouetteMesh,
    x: mSpawn.x,
    y: 0.0,
    z: mSpawn.z,
    yaw: mSpawn.yaw,
    speed: 0,
    maxSpeed: 32,
  });

  // Swiss Rescue Helicopter
  const hSpawn = VEHICLE_SPAWNS.heli;
  const heli = createHelicopterMesh();
  const hy = getGroundHeight(hSpawn.x, hSpawn.z);
  heli.group.position.set(hSpawn.x, hy, hSpawn.z);
  heli.group.rotation.y = hSpawn.yaw;
  scene.add(heli.group);
  vehicles.push({
    id: hSpawn.id,
    type: 'heli',
    label: hSpawn.label,
    mesh: heli.group,
    mainRotor: heli.mainRotor,
    tailRotor: heli.tailRotor,
    rotorDiscMat: heli.rotorDiscMat,
    strobeMat: heli.strobeMat,
    x: hSpawn.x,
    y: hy,
    z: hSpawn.z,
    yaw: hSpawn.yaw,
    vx: 0,
    vy: 0,
    vz: 0,
    pitch: 0,
    roll: 0,
    rotorSpeed: 0.4,
  });

  // Promote any hijacked AI road-traffic car or friendly TPG Bus into a full player-drivable physics vehicle!
  let stolenCounter = 1;
  function adoptStolenTrafficVehicle(entity, friendly = false) {
    const holder = new THREE.Group();
    const chassis = new THREE.Group();
    holder.add(chassis);

    // Transfer contact shadow into holder (stays flat on asphalt) & vehicle 3D model into chassis (pitches/rolls/drifts!)
    const children = [...entity.mesh.children];
    for (const ch of children) {
      if (ch.name === 'contactShadow') holder.add(ch);
      else chassis.add(ch);
    }

    const y = getGroundHeight(entity.x, entity.z) + 0.30;
    holder.position.set(entity.x, y, entity.z);
    holder.rotation.y = entity.yaw;
    vehiclesGroup.add(holder);

    const speedByType = {
      ferrari: 56,
      porsche: 56,
      charger: 54,
      rs6: 50,
      sedan: 44,
      gwagon: 42,
      van: 38,
      bus: 28,
    };
    const tailMat =
      entity.tailMat ||
      new THREE.MeshStandardMaterial({ color: 0xff1e1e, emissive: 0xff1111, emissiveIntensity: 1.8 });

    const vStyle = entity.kind === 'bus' ? 'bus' : entity.vtype || 'sedan';
    const spec = getVehiclePhysicsSpec(vStyle);
    const initSpeed = friendly ? Math.max(0, entity.speed || 0) : Math.min(4, entity.speed * 0.25);
    const vObj = {
      id: `${friendly ? 'tpg_drive' : 'stolen'}_${stolenCounter++}`,
      type: 'car',
      style: vStyle,
      label: entity.label || 'STOLEN VEHICLE',
      dest: entity.dest || '',
      color: entity.color || 0x333a44,
      mesh: holder,
      chassis,
      tailMat,
      policeLights: null,
      wheelMeshes: entity.wheels || [],
      shadowMeshes: entity.shadowMeshes || [],
      _castShadow: true,
      x: entity.x,
      y,
      z: entity.z,
      yaw: entity.yaw,
      vx: Math.sin(entity.yaw) * initSpeed,
      vy: 0,
      vz: Math.cos(entity.yaw) * initSpeed,
      yawVel: 0,
      speed: initSpeed,
      slopePitch: 0,
      slopeRoll: 0,
      suspPitch: 0,
      suspRoll: 0,
      driftSlip: 0,
      mass: spec.mass,
      invMass: 1 / spec.mass,
      alarmTimer: friendly ? 0 : 5.5,
      stolen: !friendly,
      maxSpeed: speedByType[vStyle] || 44,
      halfW: entity.halfW || 1.05,
      halfL: entity.halfL || 2.38,
      height: entity.height || 1.55,
    };
    vehicles.push(vObj);
    return vObj;
  }

  // Dispatch the Geneva Police patrol car within active pursuit distance when a crime/carjacking is reported!
  function dispatchPoliceNear(px, pz, pyaw) {
    const cop = vehicles.find((v) => v.style === 'police');
    if (!cop) return;
    const dist = Math.hypot(cop.x - px, cop.z - pz);
    if (dist > 110) {
      // Spawn pursuing Geneva Police ~68m behind the stolen car on dry ground facing toward the suspect!
      for (const angOff of [Math.PI, Math.PI * 0.75, -Math.PI * 0.75, 0]) {
        const sx = px + Math.sin(pyaw + angOff) * 68;
        const sz = pz + Math.cos(pyaw + angOff) * 68;
        if (!isWater(sx, sz)) {
          const cl = clampToWorld(sx, sz);
          cop.x = cl.x;
          cop.z = cl.z;
          cop.y = getGroundHeight(cop.x, cop.z) + 0.30;
          cop.yaw = Math.atan2(px - cop.x, pz - cop.z);
          cop.speed = 16;
          cop.vx = Math.sin(cop.yaw) * 16;
          cop.vz = Math.cos(cop.yaw) * 16;
          cop.yawVel = 0;
          cop.mesh.position.set(cop.x, cop.y, cop.z);
          cop.mesh.rotation.y = cop.yaw;
          break;
        }
      }
    }
  }

  const _colRes = { hit: false, nx: 0, nz: 0, depth: 0, contactX: 0, contactZ: 0 };
  const _otherObb = { kind: 'obb', x: 0, z: 0, yaw: 0, halfW: 1.05, halfL: 2.38, maxY: 3.0 };

  // Full Oriented-Box (OBB) Rigid-Body Collision Solver with Conservation-of-Momentum, Torque & Impact Sparks!
  function resolveVehicleOBBCollisions(v, queryRectOrCell, trafficColliders, impactOut, isPlayerVeh) {
    const spec = getVehiclePhysicsSpec(v.style);
    const hw = v.halfW || 1.05;
    const hl = v.halfL || 2.38;
    const boundR = Math.hypot(hw, hl) + 0.6;

    const recordImpact = (impactSpd, isMetal, cx, cz, nx, nz) => {
      if (impactSpd < 1.6) return;
      // Suspension crunch jolt along impact normal in local vehicle frame
      const fx = Math.sin(v.yaw);
      const fz = Math.cos(v.yaw);
      const lx = Math.cos(v.yaw);
      const lz = -Math.sin(v.yaw);
      const jolt = Math.min(0.14, impactSpd * 0.0085);
      v.suspPitch += (nx * fx + nz * fz) * jolt;
      v.suspRoll += -(nx * lx + nz * lz) * jolt;
      if (impactSpd > 2.6) {
        spawnSparks(cx, v.y + 0.55, cz, nx, nz, Math.round(4 + impactSpd * 0.9), Math.min(12, 3.5 + impactSpd * 0.45));
      }
      if (isPlayerVeh && impactSpd > impactOut.intensity) {
        impactOut.intensity = impactSpd;
        impactOut.isMetal = isMetal;
      }
    };

    // 2 iterative passes guarantee clean resolution at tight wall corners & multi-car pileups!
    for (let iter = 0; iter < 2; iter++) {
      const near = queryRectOrCell(v.x - boundR, v.x + boundR, v.z - boundR, v.z + boundR);
      for (let i = 0; i < near.length; i++) {
        const col = near[i];
        const res = resolveOBBAgainstCollider(v.x, v.y, v.z, v.yaw, hw, hl, col, _colRes);
        if (!res.hit) continue;

        const push = res.depth + 0.004;
        v.x += res.nx * push;
        v.z += res.nz * push;

        const vn = v.vx * res.nx + v.vz * res.nz;
        if (vn < 0) {
          const impact = -vn;
          const rest = impact > 3.0 ? spec.restitution : 0.04;
          const j = (1 + rest) * impact;
          v.vx += res.nx * j;
          v.vz += res.nz * j;

          // Realistic tangential wall-scrape friction
          const tx = -res.nz;
          const tz = res.nx;
          const vt = v.vx * tx + v.vz * tz;
          const fric = Math.min(Math.abs(vt), impact * 0.24);
          if (Math.abs(vt) > 1e-4) {
            v.vx -= Math.sign(vt) * tx * fric;
            v.vz -= Math.sign(vt) * tz * fric;
          }

          // Off-center bumper corner hit applies real rotational yaw deflection!
          const rx = res.contactX - v.x;
          const rz = res.contactZ - v.z;
          const cross = rx * res.nz - rz * res.nx;
          const yawImpulse = Math.max(-2.8, Math.min(2.8, (-cross * impact * 0.14) / Math.max(1.2, hl)));
          v.yawVel += yawImpulse;

          recordImpact(impact, col.kind === 'cyl' && col.r < 0.35, res.contactX, res.contactZ, res.nx, res.nz);
        }
      }

      // 2. Real Conservation-of-Momentum Collisions Against Other Parked / Driven Vehicles!
      for (let i = 0; i < vehicles.length; i++) {
        const o = vehicles[i];
        if (o === v || o.type === 'boat') continue;
        _otherObb.x = o.x;
        _otherObb.z = o.z;
        _otherObb.yaw = o.yaw;
        _otherObb.halfW = o.halfW || (o.type === 'heli' ? 1.65 : 1.05);
        _otherObb.halfL = o.halfL || (o.type === 'heli' ? 4.2 : 2.38);
        _otherObb.maxY = o.y + (o.height || 2.0);
        const res = resolveOBBAgainstCollider(v.x, v.y, v.z, v.yaw, hw, hl, _otherObb, _colRes);
        if (!res.hit) continue;

        const invM1 = v.invMass || 1 / 1600;
        const invM2 = o.type === 'car' ? (o.invMass || 1 / 1600) : 0;
        const invSum = invM1 + invM2 || invM1;

        const sep = res.depth + 0.005;
        v.x += res.nx * sep * (invM1 / invSum);
        v.z += res.nz * sep * (invM1 / invSum);
        if (invM2 > 0) {
          o.x -= res.nx * sep * (invM2 / invSum);
          o.z -= res.nz * sep * (invM2 / invSum);
        }

        const rvx = v.vx - (o.vx || 0);
        const rvz = v.vz - (o.vz || 0);
        const vn = rvx * res.nx + rvz * res.nz;
        if (vn < 0) {
          const impact = -vn;
          const rest = 0.28;
          const j = ((1 + rest) * impact) / invSum;
          v.vx += res.nx * j * invM1;
          v.vz += res.nz * j * invM1;
          if (invM2 > 0) {
            o.vx = (o.vx || 0) - res.nx * j * invM2;
            o.vz = (o.vz || 0) - res.nz * j * invM2;
            // Angular spin transfer to BOTH colliding vehicles from off-center bumper impact!
            const r1x = res.contactX - v.x, r1z = res.contactZ - v.z;
            const r2x = res.contactX - o.x, r2z = res.contactZ - o.z;
            const c1 = r1x * res.nz - r1z * res.nx;
            const c2 = r2x * res.nz - r2z * res.nx;
            v.yawVel += Math.max(-2.6, Math.min(2.6, (-c1 * j * invM1 * 0.22) / Math.max(1.2, hl)));
            o.yawVel = (o.yawVel || 0) + Math.max(-3.0, Math.min(3.0, (c2 * j * invM2 * 0.28) / Math.max(1.2, _otherObb.halfL)));
            if (impact > 3.2) {
              o.alarmTimer = Math.max(o.alarmTimer || 0, 2.5);
            }
          }
          recordImpact(impact, true, res.contactX, res.contactZ, res.nx, res.nz);
        }
      }

      // 3. Real Mass-Weighted Collisions Against Moving AI Traffic (Cars, Vans, TPG Buses, 42-Ton Stadler Tango Trams!)
      for (let i = 0; i < trafficColliders.length; i++) {
        const tc = trafficColliders[i];
        if (tc.isPed) continue;
        const res = resolveOBBAgainstCollider(v.x, v.y, v.z, v.yaw, hw, hl, tc, _colRes);
        if (!res.hit) continue;

        const sep = res.depth + 0.008;
        v.x += res.nx * sep;
        v.z += res.nz * sep;

        const tVx = tc.vx || 0;
        const tVz = tc.vz || 0;
        const rvx = v.vx - tVx;
        const rvz = v.vz - tVz;
        const vn = rvx * res.nx + rvz * res.nz;
        if (vn < 0) {
          const impact = -vn;
          const m1 = v.mass || 1600;
          const m2 = tc.mass || 1650;
          const massRatio = m2 / (m1 + m2);
          const j = (1 + (tc.isTram ? 0.32 : 0.24)) * impact * Math.max(0.55, massRatio * 1.35);
          v.vx += res.nx * j;
          v.vz += res.nz * j;

          const rx = res.contactX - v.x;
          const rz = res.contactZ - v.z;
          const cross = rx * res.nz - rz * res.nx;
          v.yawVel += Math.max(-3.0, Math.min(3.0, (-cross * impact * 0.16) / Math.max(1.2, hl)));

          if (tc.onHit) tc.onHit(impact);
          recordImpact(impact, true, res.contactX, res.contactZ, res.nx, res.nz);
        }
      }
    }
  }

  function getVehicleColliders(excludeVehicle = null) {
    const out = [];
    for (const v of vehicles) {
      if (v === excludeVehicle) continue;
      out.push({
        kind: 'obb',
        x: v.x,
        z: v.z,
        yaw: v.yaw,
        halfW: v.halfW || (v.type === 'heli' ? 1.65 : v.type === 'boat' ? 1.65 : 1.08),
        halfL: v.halfL || (v.type === 'heli' ? 4.2 : v.type === 'boat' ? 4.6 : 2.38),
        maxY: v.y + (v.height || (v.type === 'heli' ? 3.2 : 1.55)),
        walkableTop: true,
        speed: Math.hypot(v.vx || 0, v.vz || 0),
        isVehicle: true,
      });
    }
    return out;
  }

  function update(
    dt,
    elapsed,
    activeVehicle,
    keys,
    queryColliders,
    nightFactor = 0,
    wantedLevel = 0,
    targetPos = null,
    trafficColliders = [],
    queryCollidersRect = null,
    isRaining = false,
    sampleRoofHeight = null
  ) {
    carHeadlight.intensity = 0;
    let isDrifting = false;
    let isBoosting = false;
    let policeDist = 9999;
    const impactOut = { intensity: 0, isMetal: false };
    const queryRectFn = queryCollidersRect || ((minX, maxX, minZ, maxZ) => queryColliders((minX + maxX) * 0.5, (minZ + maxZ) * 0.5));

    for (const v of vehicles) {
      const controlled = v === activeVehicle;

      if (v.type === 'car') {
        const spec = getVehiclePhysicsSpec(v.style);
        const isScooter = v.style === 'scooter';
        const isEScooter = v.style === 'escooter';
        const isBus = v.style === 'bus';
        const isTwoWheeler = isScooter || isEScooter;

        let braking = false;
        let turn = 0;
        let forward = 0;
        let handbrake = false;

        // Decompose 2D world velocity into vehicle-local forward (vFwd) & lateral slip (vLat)
        let fx = Math.sin(v.yaw);
        let fz = Math.cos(v.yaw);
        let lx = Math.cos(v.yaw);
        let lz = -Math.sin(v.yaw);
        let vFwd = (v.vx || 0) * fx + (v.vz || 0) * fz;
        let vLat = (v.vx || 0) * lx + (v.vz || 0) * lz;

        // Sample 4-wheel terrain slope for authentic Old Town hills & Pont du Mont-Blanc bridge arches!
        const axleOff = Math.max(0.55, (v.halfL || 2.38) * 0.65);
        const trackOff = Math.max(0.25, (v.halfW || 1.05) * 0.85);
        const yF = getGroundHeight(v.x + fx * axleOff, v.z + fz * axleOff);
        const yR = getGroundHeight(v.x - fx * axleOff, v.z - fz * axleOff);
        const yL = getGroundHeight(v.x + lx * trackOff, v.z + lz * trackOff);
        const yRt = getGroundHeight(v.x - lx * trackOff, v.z - lz * trackOff);
        const targetSlopePitch = Math.max(-0.26, Math.min(0.26, Math.atan2(yR - yF, axleOff * 2)));
        const targetSlopeRoll = Math.max(-0.18, Math.min(0.18, Math.atan2(yRt - yL, trackOff * 2)));
        v.slopePitch = (v.slopePitch || 0) + (targetSlopePitch - (v.slopePitch || 0)) * Math.min(1, dt * 10);
        v.slopeRoll = (v.slopeRoll || 0) + (targetSlopeRoll - (v.slopeRoll || 0)) * Math.min(1, dt * 10);

        const wetGripMul = isRaining ? 0.72 : 1.0;

        if (controlled) {
          forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
          turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
          const boost = keys.KeyE && forward > 0 && !isBus ? 1.44 : 1.0;
          handbrake = !!keys.Space;
          braking = handbrake || (forward < 0 && vFwd > 1.2) || (forward > 0 && vFwd < -1.2);
          isBoosting = boost > 1.0 && Math.abs(vFwd) > 7;

          const maxFwd = v.maxSpeed * boost;
          const maxRev = isEScooter ? -4.5 : isBus ? -9.0 : -14.5;

          // Real longitudinal engine torque, hydraulic braking, aerodynamic drag & hill slope gravity!
          if (forward > 0) {
            const topRatio = Math.max(0.15, 1 - Math.max(0, vFwd) / (maxFwd * 1.12));
            const a = vFwd < -0.5 ? spec.brake * wetGripMul : spec.accel * boost * topRatio;
            vFwd += a * dt;
          } else if (forward < 0) {
            const a = vFwd > 0.5 ? spec.brake * wetGripMul : spec.accel * 0.52;
            vFwd -= a * dt;
          } else {
            // Engine braking + rolling resistance
            const rollDrag = isEScooter ? 3.8 : isBus ? 2.0 : 2.6;
            if (Math.abs(vFwd) <= rollDrag * dt) vFwd = 0;
            else vFwd -= Math.sign(vFwd) * rollDrag * dt;
          }

          // Real hill gravity pull along slope!
          if (Math.abs(vFwd) > 0.15 || forward !== 0) {
            vFwd += Math.sin(v.slopePitch) * 9.81 * dt;
          }
          // Aerodynamic drag proportional to v^2
          vFwd -= vFwd * Math.abs(vFwd) * 0.00045 * dt;

          if (handbrake) {
            const hbDecel = (isBus ? 22 : 19) * wetGripMul * dt;
            if (Math.abs(vFwd) <= hbDecel) vFwd = 0;
            else vFwd -= Math.sign(vFwd) * hbDecel;
          }
          vFwd = Math.max(maxRev, Math.min(maxFwd, vFwd));

          // Speed-sensitive Ackermann steering authority (crisp low-speed turns, planted high-speed stability!)
          const absSpd = Math.abs(vFwd);
          const lowRamp = Math.min(1, absSpd / (isEScooter ? 1.8 : isBus ? 4.8 : 4.2));
          const highTaper = 1 / (1 + absSpd * (isBus ? 0.025 : 0.016));
          const steerDir = vFwd >= -0.15 ? 1 : -1;
          const targetYawRate = turn * spec.steerMax * (handbrake && !isBus ? 1.38 : 1.0) * lowRamp * highTaper * steerDir;
          v.yawVel = (v.yawVel || 0) + (targetYawRate - (v.yawVel || 0)) * Math.min(1, dt * (handbrake ? 6.5 : 10.5));

          // Real lateral tire grip traction (dry vs wet asphalt vs handbrake drift!)
          const effGrip = (handbrake ? spec.driftGrip : spec.latGrip) * wetGripMul;
          vLat *= Math.exp(-effGrip * dt);
          if (handbrake && !isTwoWheeler && !isBus && absSpd > 8 && turn !== 0) {
            // Subtle weight-transfer rear kickout into controlled drift
            vLat -= turn * Math.min(5.2, absSpd * 0.18) * dt * 2.2;
          }

          isDrifting = !isTwoWheeler && !isBus && ((handbrake && absSpd > 9 && Math.abs(turn) > 0) || (Math.abs(vLat) > 3.2 && absSpd > 9));

          if (!isEScooter && !isBus && (isDrifting || (isBoosting && absSpd < 26))) {
            const rx = v.x - fx * 1.5;
            const rz = v.z - fz * 1.5;
            const sx = lx * 0.85;
            const sz = lz * 0.85;
            spawnSmoke(rx + sx, v.y, rz + sz);
            spawnSmoke(rx - sx, v.y, rz - sz);
          }

          if (nightFactor > 0.22) {
            const hlFront = isBus ? 5.9 : 2.2;
            const hlY = isBus ? 1.15 : 0.9;
            carHeadlight.intensity = nightFactor * (isBus ? 18.0 : 12.0);
            carHeadlight.position.set(v.x + fx * hlFront, v.y + hlY, v.z + fz * hlFront);
            carHeadlight.target.position.set(v.x + fx * (hlFront + 38), v.y + 0.2, v.z + fz * (hlFront + 38));
          }
        } else if (v.style === 'police' && wantedLevel > 0 && targetPos) {
          // ACTIVE GENEVA POLICE PURSUIT AI!!
          const dx = targetPos.x - v.x;
          const dz = targetPos.z - v.z;
          policeDist = Math.hypot(dx, dz);
          const desiredYaw = Math.atan2(dx, dz);
          let diff = desiredYaw - v.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          v.yawVel = Math.max(-2.4, Math.min(2.4, diff * 2.8));
          const chaseSpeed = Math.min(34 + wantedLevel * 4, policeDist > 12 ? 38 : 8);
          vFwd += (chaseSpeed - vFwd) * Math.min(1, dt * 3);
          vLat *= Math.exp(-8.0 * dt);
        } else {
          // Uncontrolled / parked vehicle: realistic handbraked tire drag & spin settle after getting bumped/rear-ended!
          vFwd *= Math.exp(-3.4 * dt);
          vLat *= Math.exp(-9.0 * dt);
          v.yawVel = (v.yawVel || 0) * Math.exp(-5.8 * dt);
          if (Math.abs(vFwd) < 0.04) vFwd = 0;
          if (Math.abs(vLat) < 0.04) vLat = 0;
          if (Math.abs(v.yawVel) < 0.015) v.yawVel = 0;
        }

        // Reconstruct world-space 2D rigid-body velocity
        v.vx = fx * vFwd + lx * vLat;
        v.vz = fz * vFwd + lz * vLat;

        // Continuous Swept Sub-Stepping (<= 0.38m per step -> ZERO wall/pole/car tunneling even at 200+ km/h!)
        const linSpd = Math.hypot(v.vx, v.vz);
        const stepDist = linSpd * dt + Math.abs(v.yawVel || 0) * dt * (v.halfL || 2.4);
        const isMoving = controlled || stepDist > 0.002 || (v.style === 'police' && wantedLevel > 0);
        if (isMoving) {
          const subSteps = Math.max(1, Math.min(8, Math.ceil(stepDist / 0.38)));
          const sdt = dt / subSteps;
          for (let s = 0; s < subSteps; s++) {
            v.yaw += (v.yawVel || 0) * sdt;
            const nx = v.x + v.vx * sdt;
            const nz = v.z + v.vz * sdt;
            // Guard both vehicle center & front bumper against driving off sheer lake walls into Lac Léman
            const cFx = Math.sin(v.yaw);
            const cFz = Math.cos(v.yaw);
            const frontWater = isWater(nx + cFx * (v.halfL || 2.2) * 0.85, nz + cFz * (v.halfL || 2.2) * 0.85);
            const centerWater = isWater(nx, nz);
            if (!centerWater && !frontWater) {
              const cl = clampToWorld(nx, nz);
              v.x = cl.x;
              v.z = cl.z;
            } else {
              v.vx *= -0.28;
              v.vz *= -0.28;
              v.yawVel *= 0.4;
            }
            resolveVehicleOBBCollisions(v, queryRectFn, trafficColliders, impactOut, controlled);
          }
        }

        // Sync signed forward speed for HUD speedometer, engine RPM audio, wheel spin & camera auto-center
        fx = Math.sin(v.yaw);
        fz = Math.cos(v.yaw);
        v.speed = v.vx * fx + v.vz * fz;

        // Real vertical gravity + smooth suspension compression/rebound over curbs & crests
        const groundLift = isEScooter ? 0.16 : 0.30;
        const targetY = getGroundHeight(v.x, v.z) + groundLift;
        if (v.y > targetY + 0.08) {
          v.vy = (v.vy || 0) - 22.0 * dt;
          v.y += v.vy * dt;
          if (v.y <= targetY) {
            if (v.vy < -2.2) v.suspPitch += Math.min(0.08, -v.vy * 0.012);
            v.y = targetY;
            v.vy = 0;
          }
        } else {
          v.y += (targetY - v.y) * Math.min(1, dt * 24);
          v.vy = 0;
        }

        // Real suspension pitch, body roll, authentic 2-wheel Vespa & E-Scooter corner lean & physical slip angle!
        const targetPitch = braking ? (isEScooter ? 0.04 : 0.068) : forward > 0 ? (isBoosting ? -0.058 : -0.028) : 0;
        const targetRoll = isEScooter
          ? -turn * Math.min(1, Math.abs(v.speed) / 8) * 0.34
          : isScooter
          ? -turn * Math.min(1, Math.abs(v.speed) / 14) * 0.42
          : -turn * Math.min(1, Math.abs(v.speed) / 24) * (isDrifting ? 0.11 : 0.065) - Math.max(-0.08, Math.min(0.08, vLat * 0.008));
        const targetSlip = isDrifting && !isTwoWheeler ? Math.max(-0.34, Math.min(0.34, -vLat * 0.032 + turn * 0.18)) : 0;
        v.suspPitch += (targetPitch - v.suspPitch) * Math.min(1, dt * 9);
        v.suspRoll += (targetRoll - v.suspRoll) * Math.min(1, dt * 8);
        v.driftSlip = (v.driftSlip || 0) + (targetSlip - (v.driftSlip || 0)) * Math.min(1, dt * 7);
        v.chassis.rotation.set(v.suspPitch, v.driftSlip, v.suspRoll);

        if (v.underglowLight) {
          const wantGlow = nightFactor > 0.25 || isBoosting;
          v.underglowLight.intensity = wantGlow ? (isBoosting ? 18 : 10 * Math.max(0.35, nightFactor)) : 0;
        }
        if (v.nitroFlame) {
          v.nitroFlame.visible = controlled && isBoosting;
          if (v.nitroFlame.visible) {
            const flick = 0.8 + Math.random() * 0.55;
            v.nitroFlame.scale.set(1, 1, flick);
          }
        }

        const wRad = isBus ? 0.49 : isEScooter ? 0.14 : isScooter ? 0.26 : 0.36;
        for (const w of v.wheelMeshes) w.rotation.x -= (v.speed * dt) / wRad;
        if (v.alarmTimer > 0) {
          v.alarmTimer = Math.max(0, v.alarmTimer - dt);
          const alarmFlash = Math.sin(elapsed * 20) > 0;
          v.tailMat.emissiveIntensity = alarmFlash ? 6.8 : 0.35;
        } else {
          v.tailMat.emissiveIntensity = braking ? 5.2 : 1.1 + nightFactor * 1.6;
        }

        if (v.policeLights) {
          const fast = wantedLevel > 0 ? 22 : 12;
          const flash = Math.sin(elapsed * fast) > 0;
          const boostStrobe = wantedLevel > 0 ? 6.0 : 3.2;
          v.policeLights.matL.emissiveIntensity = flash ? boostStrobe : 0.25;
          v.policeLights.matR.emissiveIntensity = flash ? 0.25 : boostStrobe;
        }

        v.mesh.position.set(v.x, v.y, v.z);
        v.mesh.rotation.order = 'YXZ';
        v.mesh.rotation.set(v.slopePitch || 0, v.yaw, v.slopeRoll || 0);

        // Distance & shadow culling on parked/non-active cars (skip far vehicles & keep shadows inside 64m sun frustum!)
        if (targetPos) {
          const d2 = (v.x - targetPos.x) * (v.x - targetPos.x) + (v.z - targetPos.z) * (v.z - targetPos.z);
          const vis = controlled || d2 < 175 * 175;
          v.mesh.visible = vis;
          const wantShadow = controlled || (vis && d2 < 64 * 64);
          if (v._castShadow !== wantShadow && v.shadowMeshes && v.shadowMeshes.length > 0) {
            v._castShadow = wantShadow;
            for (let k = 0; k < v.shadowMeshes.length; k++) v.shadowMeshes[k].castShadow = wantShadow;
          }
        }
      } else if (v.type === 'boat') {
        if (controlled) {
          const forward = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
          const turn = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
          if (forward !== 0) v.speed += forward * 17 * dt;
          else v.speed *= Math.pow(0.35, dt);
          v.speed = Math.max(-8, Math.min(v.maxSpeed, v.speed));
          v.yaw += turn * 1.45 * dt;

          // Foamy water wake spray behind Mouette!
          if (Math.abs(v.speed) > 4) {
            spawnSmoke(v.x - Math.sin(v.yaw) * 4.5, 0.15, v.z - Math.cos(v.yaw) * 4.5, 0, 0.7, 0);
          }
        } else {
          v.speed *= Math.pow(0.2, dt);
        }

        const fx = Math.sin(v.yaw);
        const fz = Math.cos(v.yaw);
        const nx = v.x + fx * v.speed * dt;
        const nz = v.z + fz * v.speed * dt;
        const bowOk = isWater(nx + fx * 3.8, nz + fz * 3.8);
        const sternOk = isWater(nx - fx * 3.8, nz - fz * 3.8);
        if (isWater(nx, nz) && bowOk && sternOk) {
          const cl = clampToWorld(nx, nz);
          v.x = cl.x;
          v.z = cl.z;
        } else {
          if (controlled && Math.abs(v.speed) > 4) {
            impactOut.intensity = Math.max(impactOut.intensity, Math.abs(v.speed) * 0.6);
          }
          v.speed *= -0.25;
        }
        // Solid collision against piers, Phare des Pâquis lighthouse & bridge parapets
        const nearBoat = queryRectFn(v.x - 6, v.x + 6, v.z - 6, v.z + 6);
        for (let i = 0; i < nearBoat.length; i++) {
          const res = resolveOBBAgainstCollider(v.x, 1.0, v.z, v.yaw, 1.65, 4.6, nearBoat[i], _colRes);
          if (res.hit) {
            v.x += res.nx * (res.depth + 0.02);
            v.z += res.nz * (res.depth + 0.02);
            v.speed *= -0.25;
          }
        }
        v.y = Math.sin(elapsed * 2.2) * 0.12;
        v.mesh.position.set(v.x, v.y, v.z);
        v.mesh.rotation.set(
          Math.sin(elapsed * 2.0) * 0.03 - v.speed * 0.005,
          v.yaw,
          Math.cos(elapsed * 1.7) * 0.03
        );
      } else if (v.type === 'heli') {
        // Compute real 3D Geneva rooftop landing pad height across helicopter center + 4 landing skid corners!
        const sampleHeliFloor = (hx, hz, hy, hYaw) => {
          let fl = getGroundHeight(hx, hz);
          if (sampleRoofHeight) {
            const cosH = Math.cos(hYaw);
            const sinH = Math.sin(hYaw);
            const maxRef = hy + 2.2;
            const pts = [
              [0, 0],
              [1.25, 1.8], [-1.25, 1.8],
              [1.25, -1.8], [-1.25, -1.8],
            ];
            for (let k = 0; k < pts.length; k++) {
              const sx = hx + cosH * pts[k][0] + sinH * pts[k][1];
              const sz = hz - sinH * pts[k][0] + cosH * pts[k][1];
              const ry = sampleRoofHeight(sx, sz, maxRef, 0.45);
              if (ry !== null && ry > fl) fl = ry;
            }
          }
          return fl;
        };

        let heliFloorY = sampleHeliFloor(v.x, v.z, v.y, v.yaw);
        if (controlled) {
          v.rotorSpeed = Math.min(30, v.rotorSpeed + 18 * dt);
          const lift = (keys.Space ? 1 : 0) - (keys.ShiftLeft || keys.ShiftRight ? 1 : 0);
          const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
          const strafe = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
          const yawIn = (keys.KeyQ ? 1 : 0) - (keys.KeyE ? 1 : 0);

          v.yaw += yawIn * 1.65 * dt;
          const fx = Math.sin(v.yaw);
          const fz = Math.cos(v.yaw);
          const rx = Math.cos(v.yaw);
          const rz = -Math.sin(v.yaw);

          v.vx += (fx * fwd - rx * strafe) * 52 * dt;
          v.vz += (fz * fwd - rz * strafe) * 52 * dt;
          v.vy += lift * 28 * dt;

          v.vx *= Math.pow(0.28, dt);
          v.vz *= Math.pow(0.28, dt);
          v.vy *= Math.pow(0.18, dt);

          const hSteps = Math.max(1, Math.min(4, Math.ceil((Math.hypot(v.vx, v.vz) * dt) / 0.85)));
          const hsdt = dt / hSteps;
          for (let hs = 0; hs < hSteps; hs++) {
            const cl = clampToWorld(v.x + v.vx * hsdt, v.z + v.vz * hsdt);
            v.x = cl.x;
            v.z = cl.z;
            const prevHy = v.y;
            v.y = Math.min(280, v.y + v.vy * hsdt);

            // Real 3D swissBUILDINGS3D rooftop landing pad height directly beneath helicopter skids!
            heliFloorY = sampleHeliFloor(v.x, v.z, Math.max(prevHy, v.y), v.yaw);
            const onRoofZone = heliFloorY > getGroundHeight(v.x, v.z) + 2.0 && prevHy >= heliFloorY - 1.2;

            // Solid 3D building wall collision (never pushes skids off while landing on top of a real 3D roof!)
            const nearH = queryRectFn(v.x - 6, v.x + 6, v.z - 6, v.z + 6);
            for (let i = 0; i < nearH.length; i++) {
              const col = nearH[i];
              const maxY = col.maxY ?? 999;
              if (onRoofZone && (col.kind === 'poly' || col.isWall) && maxY <= heliFloorY + 3.2) {
                continue;
              }
              if (v.y >= maxY - 1.2 && v.y <= maxY + 0.8 && col.walkableTop !== false) {
                const resTop = resolveOBBAgainstCollider(v.x, maxY - 1.5, v.z, v.yaw, 1.6, 3.6, col, _colRes);
                if (resTop.hit && maxY > heliFloorY) heliFloorY = maxY;
                continue;
              }
              if (v.y < maxY - 0.8) {
                const resSide = resolveOBBAgainstCollider(v.x, v.y + 0.6, v.z, v.yaw, 2.0, 4.4, col, _colRes);
                if (resSide.hit) {
                  v.x += resSide.nx * (resSide.depth + 0.05);
                  v.z += resSide.nz * (resSide.depth + 0.05);
                  const vn = v.vx * resSide.nx + v.vz * resSide.nz;
                  if (vn < 0) {
                    const imp = -vn;
                    v.vx += resSide.nx * imp * 1.25;
                    v.vz += resSide.nz * imp * 1.25;
                    if (imp > 3.0) {
                      spawnSparks(resSide.contactX, v.y + 1.8, resSide.contactZ, resSide.nx, resSide.nz, 10, 7);
                      impactOut.intensity = Math.max(impactOut.intensity, imp);
                      impactOut.isMetal = true;
                    }
                  }
                }
              }
            }
            if (v.y < heliFloorY) {
              v.y = heliFloorY;
              if (v.vy < 0) v.vy = 0;
              // Skid friction damps horizontal drift smoothly on rooftop touchdown!
              v.vx *= Math.pow(0.08, hsdt);
              v.vz *= Math.pow(0.08, hsdt);
            }
          }

          const landedNow = v.y <= heliFloorY + 0.14;
          v.pitch += ((landedNow ? 0 : fwd * 0.22) - v.pitch) * Math.min(1, dt * 6);
          v.roll += ((landedNow ? 0 : -strafe * 0.24) - v.roll) * Math.min(1, dt * 6);

          // Rotor downwash spray when hovering low over ground OR rooftop!
          if (v.y - heliFloorY < 16 && v.rotorSpeed > 14) {
            const ang = Math.random() * Math.PI * 2;
            spawnSmoke(v.x + Math.cos(ang) * 4, heliFloorY + 0.3, v.z + Math.sin(ang) * 4, Math.cos(ang) * 6, 0.8, Math.sin(ang) * 6);
          }
        } else {
          // Parked / exited helicopter stays rock-solid on top of ANY Geneva rooftop!
          v.rotorSpeed = Math.max(0.5, v.rotorSpeed - 6 * dt);
          v.vx *= Math.pow(0.1, dt);
          v.vz *= Math.pow(0.1, dt);
          if (v.y > heliFloorY) {
            v.vy -= 9.8 * dt;
            v.y = Math.max(heliFloorY, v.y + v.vy * dt);
          } else {
            v.y = heliFloorY;
            v.vy = 0;
          }
          v.pitch *= Math.pow(0.05, dt);
          v.roll *= Math.pow(0.05, dt);
        }

        v.mainRotor.rotation.y += v.rotorSpeed * dt;
        v.tailRotor.rotation.x += v.rotorSpeed * 1.6 * dt;
        v.rotorDiscMat.opacity = Math.min(0.32, Math.max(0, (v.rotorSpeed - 8) / 20) * 0.32);
        v.strobeMat.emissiveIntensity = Math.sin(elapsed * 8) > 0.65 ? 4.5 : 0.2;

        v.mesh.position.set(v.x, v.y, v.z);
        v.mesh.rotation.order = 'YXZ';
        v.mesh.rotation.set(v.pitch, v.yaw, v.roll);
      }
    }

    // Update billowing smoke / wake particle pool
    const sp = smokeGeo.attributes.position.array;
    for (let i = 0; i < SMOKE_N; i++) {
      const p = smokePool[i];
      if (p.life > 0) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 0.96;
        p.vz *= 0.96;
        sp[i * 3] = p.x;
        sp[i * 3 + 1] = p.y;
        sp[i * 3 + 2] = p.z;
      } else {
        sp[i * 3 + 1] = -999;
      }
    }
    smokeGeo.attributes.position.needsUpdate = true;

    // Update bright metallic collision sparks with gravity!
    const skp = sparkGeo.attributes.position.array;
    for (let i = 0; i < SPARK_N; i++) {
      const p = sparkPool[i];
      if (p.life > 0) {
        p.life -= dt;
        p.vy -= 18.0 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.vx *= 0.96;
        p.vz *= 0.96;
        skp[i * 3] = p.x;
        skp[i * 3 + 1] = p.y;
        skp[i * 3 + 2] = p.z;
      } else {
        skp[i * 3 + 1] = -999;
      }
    }
    sparkGeo.attributes.position.needsUpdate = true;

    const impactShake = impactOut.intensity > 2.2 ? Math.min(0.32, (impactOut.intensity - 1.5) * 0.016) : 0;
    return {
      isDrifting,
      isBoosting,
      policeDist,
      crashIntensity: impactOut.intensity,
      crashIsMetal: impactOut.isMetal,
      impactShake,
    };
  }

  return { group: vehiclesGroup, vehicles, getVehicleColliders, adoptStolenTrafficVehicle, dispatchPoliceNear, update };
}
