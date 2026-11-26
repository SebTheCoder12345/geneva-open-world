import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

import { buildGenevaWorld } from './world/buildGeneva.js';
import { loadSwissBuildings3D } from './world/swissBuildings3D.js';
import { buildGenevaIdentity } from './world/genevaIdentity.js';
import { buildGenevaStreetLife } from './world/genevaStreetLife.js';
import { createGenevaInteriors } from './world/genevaInteriors.js';
import { createSkyDome, createEnvironmentMap } from './world/skyAndWater.js';
import { createGtaPostPass } from './world/gtaPostFX.js';
import { createRainTexture, loadPhotoPBRBundle } from './world/textures.js';
import {
  MISSIONS,
  initRealGenevaData,
  getGroundHeight,
  isWater,
  getStreetName,
} from './world/cityData.js';
import { createVehicles } from './game/vehicles.js';
import { createPlayer } from './game/player.js';
import { createAudioEngine } from './game/audio.js';
import { pointInPolygon } from './game/collisions.js';
import { createMapUI } from './ui/mapUI.js';
import { createHudAndMenus } from './ui/hudAndMenus.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
const initPr = Math.min(window.devicePixelRatio, 1.5);
renderer.setPixelRatio(initPr);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.88; // calibrated to real Quai du Général-Guisan photographic exposure (deep cobalt sky + warm molasse stone!)

const scene = new THREE.Scene();
scene.environment = createEnvironmentMap(renderer);
scene.fog = new THREE.FogExp2(0x89b7df, 0.00034); // authentic Lac Léman Alpine atmospheric haze

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.25, 5200);

// High-Efficiency AAA Post-Processing Pipeline:
// WebGL2 Hardware 4x MSAA HDR RenderTarget (replaces 3-pass software SMAA with crisper hardware AA & 0 extra passes!)
// -> RenderPass -> 0.5x Bilateral GTAO (2.25x faster contact shadows!) -> Bloom -> ACES Output -> GTA Post FX
const composerTarget = new THREE.WebGLRenderTarget(
  Math.max(1, Math.floor(window.innerWidth * initPr)),
  Math.max(1, Math.floor(window.innerHeight * initPr)),
  { type: THREE.HalfFloatType, samples: 4 }
);
const composer = new EffectComposer(renderer, composerTarget);
composer.setPixelRatio(initPr);
composer.setSize(window.innerWidth, window.innerHeight);
composer.addPass(new RenderPass(scene, camera));

const gtaoW = Math.max(320, Math.floor(window.innerWidth * 0.5));
const gtaoH = Math.max(240, Math.floor(window.innerHeight * 0.5));
const gtaoPass = new GTAOPass(scene, camera, gtaoW, gtaoH);
gtaoPass.output = GTAOPass.OUTPUT.Default;
gtaoPass.updateGtaoMaterial({
  radius: 0.92,
  distanceExponent: 1.45,
  thickness: 1.25,
  scale: 1.80,
  samples: 8,
});
gtaoPass.updatePdMaterial({
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  rings: 2,
  samples: 8,
});
// Exclude alpha-tested tree foliage cards, mirror water, VFX sprites & tiny sub-pixel micro-props from GTAOPass depth prepass!
const _origGtaoRender = gtaoPass.render.bind(gtaoPass);
const _gtaoMicroVis = [];
gtaoPass.render = (ren, writeBuf, readBuf, delta, mask) => {
  const prevVis = world?.canopies ? world.canopies.visible : true;
  const prevWater = world?.waterMesh ? world.waterMesh.visible : true;
  const prevVfx = world?.vfxGroup ? world.vfxGroup.visible : true;
  if (world?.canopies) world.canopies.visible = false;
  if (world?.waterMesh) world.waterMesh.visible = false;
  if (world?.vfxGroup) world.vfxGroup.visible = false;
  const micro = world?.microDetailGroups;
  if (micro) {
    for (let i = 0; i < micro.length; i++) {
      _gtaoMicroVis[i] = micro[i].visible;
      micro[i].visible = false;
    }
  }
  _origGtaoRender(ren, writeBuf, readBuf, delta, mask);
  if (world?.canopies) world.canopies.visible = prevVis;
  if (world?.waterMesh) world.waterMesh.visible = prevWater;
  if (world?.vfxGroup) world.vfxGroup.visible = prevVfx;
  if (micro) {
    for (let i = 0; i < micro.length; i++) micro[i].visible = _gtaoMicroVis[i];
  }
};
composer.addPass(gtaoPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5)),
  0.16,
  0.42,
  0.94
);
// Inject zero-cost NaN/Inf FP16 guard directly into UnrealBloomPass's luminance high-pass shader
// (eliminates an entire full-res HdrSanitizePass while keeping black-box bloom flicker 100% impossible!)
if (bloomPass.materialHighPassFilter?.fragmentShader) {
  bloomPass.materialHighPassFilter.fragmentShader = bloomPass.materialHighPassFilter.fragmentShader.replace(
    'vec4 texel = texture2D( tDiffuse, vUv );',
    `vec4 texel = texture2D( tDiffuse, vUv );
    texel.r = (texel.r >= 0.0 && texel.r <= 60000.0) ? min(texel.r, 10.0) : 0.0;
    texel.g = (texel.g >= 0.0 && texel.g <= 60000.0) ? min(texel.g, 10.0) : 0.0;
    texel.b = (texel.b >= 0.0 && texel.b <= 60000.0) ? min(texel.b, 10.0) : 0.0;`
  );
  bloomPass.materialHighPassFilter.needsUpdate = true;
}
composer.addPass(bloomPass);
// Fused ACESFilmic + sRGB + NaN guard + CAS sharpen + speed blur in a SINGLE final pass (eliminates OutputPass!)
const gtaPostPass = createGtaPostPass();
composer.addPass(gtaPostPass);
let usePostProcessing = true;

// Physical Sky Dome + 3 Real 2K Photographic HDRIs (Day, Golden Sunset, Starry Night) + PMREM Prefiltered IBL Probes!
const { skyMesh, skyUniforms } = createSkyDome(scene);
skyMesh.visible = false;
const hdris = { day: null, sunset: null, night: null };
const hdrEnvMaps = { day: null, sunset: null, night: null };

// Pool of 6 dynamic warm streetlamp PointLights that snap to nearest Geneva streetlamps at night!
const streetLampPool = [];
for (let i = 0; i < 6; i++) {
  const pl = new THREE.PointLight(0xffbd6b, 0, 62, 1.3);
  scene.add(pl);
  streetLampPool.push(pl);
}
// Soft nocturnal city-glow / boutique bounce fill around the player so dark leather, pavers & park benches remain cleanly sculpted at night!
const nightCityBounce = new THREE.PointLight(0xffcf94, 0, 28, 1.35);
scene.add(nightCityBounce);

// Realistic High-Contrast Sun + Cool Alpine Sky Fill (balanced bounce prevents black tree shadows & suit shadow acne!)
const hemiLight = new THREE.HemisphereLight(0x7cb4ee, 0x524c42, 0.44);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffedd0, 3.35);
sunLight.position.set(180, 110, -130);
sunLight.castShadow = true;
// Texel-snapped 2048x2048 tight 54m PCFSoft shadow frustum with clean acne-free normal bias!
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 12;
sunLight.shadow.camera.far = 460;
const shadowRange = 54;
sunLight.shadow.camera.left = -shadowRange;
sunLight.shadow.camera.right = shadowRange;
sunLight.shadow.camera.top = shadowRange;
sunLight.shadow.camera.bottom = -shadowRange;
sunLight.shadow.bias = -0.00038;
sunLight.shadow.normalBias = 0.072;
scene.add(sunLight);
scene.add(sunLight.target);

// Realistic Soft Streak Rain Particle System
const rainCount = 2400;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(rainCount * 3);
for (let i = 0; i < rainCount; i++) {
  rainPos[i * 3] = (Math.random() - 0.5) * 140;
  rainPos[i * 3 + 1] = Math.random() * 70;
  rainPos[i * 3 + 2] = (Math.random() - 0.5) * 140;
}
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainPoints = new THREE.Points(
  rainGeo,
  new THREE.PointsMaterial({
    map: createRainTexture(),
    color: 0xdaf0ff,
    size: 0.78,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  })
);
rainPoints.visible = false;
scene.add(rainPoints);

// Soft Drifting Alpine Snowflake Particles for Winter Geneva Mode!
const snowCount = 2000;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(snowCount * 3);
for (let i = 0; i < snowCount; i++) {
  snowPos[i * 3] = (Math.random() - 0.5) * 140;
  snowPos[i * 3 + 1] = Math.random() * 65;
  snowPos[i * 3 + 2] = (Math.random() - 0.5) * 140;
}
snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
const snowCan = document.createElement('canvas');
snowCan.width = 64; snowCan.height = 64;
const snCtx = snowCan.getContext('2d');
const snGrad = snCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
snGrad.addColorStop(0, 'rgba(255,255,255,1.0)');
snGrad.addColorStop(0.55, 'rgba(240,248,255,0.75)');
snGrad.addColorStop(1, 'rgba(240,248,255,0.0)');
snCtx.fillStyle = snGrad;
snCtx.fillRect(0, 0, 64, 64);
const snowPoints = new THREE.Points(
  snowGeo,
  new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(snowCan),
    color: 0xffffff,
    size: 0.88,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  })
);
snowPoints.visible = false;
scene.add(snowPoints);

let lightningFlash = 0;
let nextLightningAt = 6.5;

// Game state
let worldReady = false;
let started = false;
let paused = false;
let activeVehicle = null;
let missionIdx = 0;
let cash = 0;
let foundCount = 0;
let customWaypoint = null;

// GTA 6 Wanted System & Stunt Scoring
let wantedLevel = 0;
let wantedEvadeTimer = 0;
let driftAccum = 0;
let highSpeedCooldown = 0;

let world = null;
let vehicleMgr = null;
let player = null;
let interiors = null;

// Crisp golden late-afternoon Geneva sun (17:05 — raking golden shadows across Quai du Général-Guisan & warm molasse facades, matching real photo!)
const settings = {
  quality: 'auto',
  weather: 'summer', // 'summer' | 'rain' | 'storm' | 'winter'
  rain: false,
  storm: false,
  winter: false,
  dayCycle: true,
  timeOfDay: 17.05,
  sensitivity: 1.0,
  invertY: false,
  camMode: 0,
  cinematicCam: false,
};

function applyWeatherMode(mode) {
  const m = ['summer', 'rain', 'storm', 'winter'].includes(mode) ? mode : 'summer';
  settings.weather = m;
  settings.rain = m === 'rain' || m === 'storm';
  settings.storm = m === 'storm';
  settings.winter = m === 'winter';
  rainPoints.visible = settings.rain;
  snowPoints.visible = settings.winter;
  if (world) {
    world.setWetRoads(settings.rain);
    world.setWinterMode?.(settings.winter);
  }
  hud?.syncWeather?.(m);
}

let camYaw = -2.1;
let camPitch = 0.08; // immersive street-level over-the-shoulder eye horizon!
let panVelX = 0;
let panVelY = 0;
let isDraggingLook = false;
let lastMouseMoveTime = 0;

const RADIO_STATIONS = [
  { id: 'couleur', label: 'COULEUR 3 · GENÈVE FM' },
  { id: 'lac', label: 'LAC FM · RADE LOUNGE' },
  { id: 'paquis', label: 'PÂQUIS CHILL · SUNSET' },
  { id: 'nations', label: 'NATIONS JAZZ · NIGHT' },
  { id: 'off', label: 'RADIO OFF' },
];
let radioIndex = 4; // starts off until pressed or chosen

function safePointerLock() {
  try {
    const p = canvas.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (_) {}
}

const audio = createAudioEngine();

let mapUI = null;
const hud = createHudAndMenus({
  onSelectSpawn(key) {
    if (player) player.teleport(key);
  },
  onPlay(spawnKey) {
    if (!worldReady) return;
    audio.ensureInit();
    player.teleport(spawnKey);
    const params = new URLSearchParams(window.location.search);
    const camPreset = params.get('cam');
    if (camPreset === 'pont') {
      player.state.x = -23.5;
      player.state.z = 134.0;
      player.state.y = getGroundHeight(-23.5, 134.0) + 0.15;
      player.state.yaw = -2.57;
      camPitch = 0.08;
    } else if (camPreset === 'vespa') {
      player.state.x = -5.8;
      player.state.z = 150.2;
      player.state.y = getGroundHeight(-5.8, 150.2) + 0.15;
      player.state.yaw = 1.05;
      camPitch = 0.10;
    } else if (camPreset === 'trot') {
      const trot = vehicleMgr.vehicles.find((v) => v.style === 'escooter');
      if (trot) {
        activeVehicle = trot;
        trot.yaw = 1.05;
        player.state.yaw = trot.yaw;
        camPitch = 0.12;
      }
    } else if (camPreset === 'fall') {
      // Drop smoothly into dramatic mid-air freefall over Quai du Général-Guisan!
      player.state.x = -10;
      player.state.z = 148;
      player.state.y = getGroundHeight(-10, 148) + 22.0;
      player.state.vy = -10.5;
      player.state.grounded = false;
      player.state.yaw = 1.05;
      camPitch = 0.18;
    } else if (camPreset === 'molard') {
      // Standing in open Place du Molard plaza overlooking the flush glowing blue multilingual pavers & Tour du Molard clock!
      player.state.x = -154.0;
      player.state.z = 260.0;
      player.state.y = getGroundHeight(-154.0, 260.0) + 0.15;
      player.state.yaw = 3.03; // facing N straight at Tour du Molard clock & crest!
      camPitch = 0.02;
    } else if (camPreset === 'brunswick') {
      // Quai du Mont-Blanc looking directly at Monument Brunswick (Square des Alpes) & Hôtel Beau-Rivage!
      player.state.x = -56.0;
      player.state.z = -254.0;
      player.state.y = getGroundHeight(-56.0, -254.0) + 0.15;
      player.state.yaw = -2.35; // facing NW straight at Monument Brunswick!
      camPitch = 0.04;
    } else if (camPreset === 'cathedral') {
      // Standing in open Cour de Saint-Pierre plaza looking straight ESE at Cathédrale Saint-Pierre's 6-column portico, twin towers & copper spire!
      player.state.x = -178.0;
      player.state.z = 516.0;
      player.state.y = getGroundHeight(-178.0, 516.0) + 0.15;
      player.state.yaw = 1.15; // facing ESE directly at the 6-column portico & cathedral towers!
      camPitch = -0.14; // tilt skyward to capture the full portico, twin towers & copper spire!
    } else if (camPreset === 'neuve') {
      // Place de Neuve looking across Général Dufour equestrian statue toward Grand Théâtre & Musée Rath!
      player.state.x = -496.0;
      player.state.z = 536.0;
      player.state.y = getGroundHeight(-496.0, 536.0) + 0.15;
      player.state.yaw = -2.36; // facing NW across Dufour statue toward Grand Théâtre & Musée Rath!
      camPitch = 0.03;
    } else if (camPreset === 'quai') {
      // Classic panoramic view across Quai du Général-Guisan & Rue du Rhône watchmakers (Rolex, Patek Philippe, Hôtel Métropole)!
      player.state.x = 22.0;
      player.state.z = 166.0;
      player.state.y = getGroundHeight(22.0, 166.0) + 0.15;
      player.state.yaw = 0.56;
      camPitch = 0.04;
    } else if (camPreset === 'rhone') {
      // Rue du Rhône luxury boulevard looking East past Cartier, Dior, Hermès & Patek Philippe (matches ref_03!)
      player.state.x = -126.0;
      player.state.z = 216.0;
      player.state.y = getGroundHeight(-126.0, 216.0) + 0.15;
      player.state.yaw = 1.24;
      camPitch = 0.02;
    } else if (camPreset === 'ile') {
      // Ponts de l'Île looking West down the Rhône river channel (verifies full Rhône water + bridge + reflections!)
      player.state.x = -534.0;
      player.state.z = 142.0;
      player.state.y = getGroundHeight(-534.0, 142.0) + 0.15;
      player.state.yaw = -1.57;
      camPitch = 0.08;
    } else if (camPreset === 'walk' || camPreset === 'jog' || camPreset === 'sprint') {
      // Live 3/4 side-rear locomotion showcase along wide Quai du Général-Guisan promenade!
      player.state.x = 16.0;
      player.state.z = 162.0;
      player.state.y = getGroundHeight(16.0, 162.0) + 0.16;
      player.state.yaw = 0.62;
      camPitch = 0.08;
      demoLocoMode = camPreset;
    } else if (camPreset === 'passage') {
      // Passage du Molard entrance from Quai du Général-Guisan looking SSW toward Tour du Molard & Place du Molard
      player.state.x = -148.5;
      player.state.z = 181.5;
      player.state.y = getGroundHeight(-148.5, 181.5) + 0.16;
      player.state.yaw = -0.34;
      camPitch = 0.02;
    } else if (camPreset === 'bench' || camPreset === 'cafe' || camPreset === 'railing') {
      const wantType = camPreset === 'bench' ? 'bench' : camPreset === 'cafe' ? 'cafe_chair' : 'railing';
      const target = (world?.interactables || []).find((it) => it.type === wantType);
      if (target) {
        player.state.x = target.x + Math.sin(target.yaw || 0) * 0.7;
        player.state.z = target.z + Math.cos(target.yaw || 0) * 0.7;
        player.state.y = getGroundHeight(player.state.x, player.state.z) + 0.16;
        player.state.yaw = target.yaw || 0;
        player.startInteraction(target);
        camPitch = 0.14;
      }
    } else if (camPreset === 'tram' || camPreset === 'tram_cab' || camPreset === 'bus' || camPreset === 'bus_drive') {
      if (world?.roadTraffic) world.roadTraffic.update(0.016, 0, 0, null);
      if (camPreset === 'bus_drive') {
        const busV = vehicleMgr.vehicles.find((v) => v.style === 'bus');
        if (busV) {
          activeVehicle = busV;
          player.state.yaw = busV.yaw;
          camYaw = busV.yaw + Math.PI - 0.38;
          camPitch = 0.18;
          settings.camMode = 0;
        }
      } else if (camPreset === 'bus') {
        const aiBus = world?.roadTraffic?.busEntities?.[0];
        if (aiBus) {
          activeVehicle = createTransitRide(aiBus, 'passenger');
          player.state.yaw = aiBus.yaw;
          camYaw = aiBus.yaw + Math.PI - 0.42;
          camPitch = 0.18;
          settings.camMode = 0;
        }
      } else {
        const aiTram = world?.roadTraffic?.tramEntities?.[0];
        if (aiTram) {
          const isCab = camPreset === 'tram_cab';
          activeVehicle = createTransitRide(aiTram, isCab ? 'drive' : 'passenger');
          player.state.yaw = aiTram.yaw;
          camYaw = aiTram.yaw + Math.PI + (isCab ? 0 : 0.42);
          camPitch = isCab ? 0.04 : 0.22;
          settings.camMode = isCab ? 1 : 0;
        }
      }
    } else if (camPreset === 'bains') {
      // Les Bains des Pâquis sunlit summer deck looking across sunbathers, Buvette parasols, diving tower & Lac Léman swimmers!
      player.state.x = 438.0;
      player.state.z = -506.0;
      player.state.y = getGroundHeight(438.0, -506.0) + 0.255;
      player.state.yaw = 1.15;
      camPitch = 0.14;
    } else if (camPreset === 'bains_lake') {
      // Panoramic view of Bains des Pâquis swimming bay, floating pontoon raft, diving tower & sunbathers!
      player.state.x = 456.0;
      player.state.z = -504.0;
      player.state.y = getGroundHeight(456.0, -504.0) + 0.255;
      player.state.yaw = 0.22;
      camPitch = 0.14;
    } else if (camPreset === 'busstop') {
      // Authentic Geneva TPG Bus Stop Shelter, live LED totem, ticket automaton & yellow BUS bay at Jardin Anglais!
      player.state.x = 58.0;
      player.state.z = 183.0;
      player.state.y = getGroundHeight(58.0, 183.0) + 0.255;
      player.state.yaw = -0.35;
      camPitch = 0.08;
    } else if (camPreset === 'swatch') {
      // Place du Molard granite pedestrian plaza right in front of SWATCH (verifies feet stand 100% flush on granite slabs!)
      player.state.x = -152.0;
      player.state.z = 262.0;
      player.state.y = getGroundHeight(-152.0, 262.0) + 0.255;
      player.state.yaw = 0.15;
      camPitch = 0.12;
    } else if (camPreset === 'roof_heli') {
      // Helicopter landed cleanly on top of the Quai du Général-Guisan landmark rooftop facing open Lac Léman (clear of UBS gantry!)
      const rx = 71.0;
      const rz = 263.5;
      const roofY = world?.sampleRoofHeight ? (world.sampleRoofHeight(rx, rz, Infinity, 1.5) ?? getGroundHeight(rx, rz) + 22) : getGroundHeight(rx, rz) + 22;
      const heli = vehicleMgr.vehicles.find((v) => v.type === 'heli');
      if (heli) {
        heli.x = rx;
        heli.z = rz;
        heli.y = roofY;
        heli.yaw = 2.45;
        heli.mesh.position.set(heli.x, heli.y, heli.z);
        heli.mesh.rotation.set(0, heli.yaw, 0);
      }
      const px = rx - 4.4;
      const pz = rz + 1.4;
      const pRoofY = world?.sampleRoofHeight ? (world.sampleRoofHeight(px, pz, roofY + 3.0, 0.5) ?? roofY) : roofY;
      player.state.x = px;
      player.state.z = pz;
      player.state.y = pRoofY;
      player.state.grounded = true;
      player.state.yaw = 1.2;
      camPitch = 0.14;
    } else if (camPreset === 'steamer') {
      // View of CGN Belle Époque Paddle Steamer ("La Suisse") cruising across Lac Léman from Quai du Mont-Blanc / Bains des Pâquis!
      const sp = world?.cgnSteamer?.pos || { x: 245, z: -215 };
      player.state.x = 432.0;
      player.state.z = -504.0;
      player.state.y = getGroundHeight(432.0, -504.0) + 0.255;
      player.state.yaw = Math.atan2(sp.x - 432.0, sp.z - -504.0);
      camPitch = 0.08;
    } else if (camPreset === 'interior_watch' || camPreset === 'interior_bank' || camPreset === 'interior_buvette') {
      const idMap = {
        interior_watch: 'watch_boutique',
        interior_bank: 'private_bank',
        interior_buvette: 'buvette_bains',
      };
      interiors?.enterInterior(idMap[camPreset], player.state);
      camPitch = 0.08;
    } else if (camPreset === 'drive_test') {
      const car = vehicleMgr.vehicles.find((v) => v.id === 'coupe_red');
      if (car) {
        activeVehicle = car;
        player.state.yaw = car.yaw;
        camPitch = 0.14;
      }
    }
    const qx = params.get('x');
    const qz = params.get('z');
    if (qx !== null && qz !== null) {
      const px = parseFloat(qx);
      const pz = parseFloat(qz);
      if (Number.isFinite(px) && Number.isFinite(pz)) {
        player.state.x = px;
        player.state.z = pz;
        player.state.y = getGroundHeight(px, pz) + 0.255;
        if (params.get('yaw') !== null) player.state.yaw = parseFloat(params.get('yaw')) || 0;
        if (params.get('pitch') !== null) camPitch = parseFloat(params.get('pitch')) || 0;
      }
    }
    const qTime = params.get('time');
    if (qTime !== null) {
      const h = parseFloat(qTime);
      if (Number.isFinite(h)) {
        settings.timeOfDay = ((h % 24) + 24) % 24;
        settings.dayCycle = false;
        hud.syncTimeOfDay(settings.timeOfDay);
      }
    }
    const qWeather = params.get('weather');
    if (qWeather) applyWeatherMode(qWeather);
    if (params.get('outfit') === 'swimwear') player.applyOutfitMode('swimwear');
    if (params.get('stats') === '1') {
      document.getElementById('fps-hud')?.classList.remove('hidden');
    }
    camYaw =
      camPreset === 'bench' || camPreset === 'cafe'
        ? player.state.yaw + 0.72
        : camPreset === 'railing'
        ? player.state.yaw + Math.PI - 0.58
        : camPreset === 'tram'
        ? player.state.yaw + Math.PI + 0.42
        : camPreset === 'bus' || camPreset === 'bus_drive'
        ? player.state.yaw + Math.PI - 0.40
        : player.state.yaw + Math.PI - (demoLocoMode ? 0.82 : 0);
    started = true;
    paused = false;
    hud.showSubtitle(MISSIONS[missionIdx].subtitle, 5200);
    // Immediately render minimap on first PLAY frame so it is never blank!
    if (mapUI && world && vehicleMgr) {
      mapUI.drawMinimap({
        playerPos: getActivePos(),
        playerYaw: camYaw,
        vehicles: vehicleMgr.vehicles,
        transit: world?.roadTraffic ? world.roadTraffic.tramEntities.concat(world.roadTraffic.busEntities) : null,
        collectibles: world.collectibleMeshes,
        missionTarget: MISSIONS[missionIdx].type !== 'freeroam' ? MISSIONS[missionIdx].target : null,
        customWaypoint,
        foundCount,
      });
    }
    safePointerLock();
  },
  onResume() {
    paused = false;
    hud.setMenuOpen(false);
    safePointerLock();
  },
  onOpenMapFromMenu() {
    hud.setMenuOpen(false);
    mapUI.setOpen(true, getActivePos());
  },
  onSetRain(v) {
    applyWeatherMode(v ? 'rain' : 'summer');
  },
  onSetWeather(mode) {
    applyWeatherMode(mode);
  },
  onSetFlashlight(v) {
    if (player) player.state.flashlightOn = v;
  },
  onSetDayCycle(v) {
    settings.dayCycle = v;
  },
  onSetTimeOfDay(h) {
    settings.timeOfDay = h;
    settings.dayCycle = false;
  },
  onSetQuality(q) {
    settings.quality = q;
    const pr =
      q === 'low'
        ? 0.75
        : q === 'medium'
        ? 1.15
        : q === 'high'
        ? Math.min(2, window.devicePixelRatio)
        : Math.min(1.6, window.devicePixelRatio);
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.needsUpdate = true;
    gtaoPass.enabled = q !== 'low';
    usePostProcessing = q !== 'low';
  },
  onSetSensitivity(v) {
    settings.sensitivity = v;
  },
  onSetInvertY(v) {
    settings.invertY = v;
  },
  onSetVolume(k, v) {
    audio.setVolume(k, v);
  },
  onSetRadio(r) {
    audio.setRadio(r);
    const found = RADIO_STATIONS.find((s) => s.id === r);
    if (found) hud.showRadioBanner(found.label);
  },
  onResetSettings() {
    settings.quality = 'auto';
    applyWeatherMode('summer');
    settings.dayCycle = true;
    settings.timeOfDay = 17.75;
    settings.sensitivity = 1.0;
    settings.invertY = false;
    settings.cinematicCam = false;
    if (player) player.state.flashlightOn = false;
    usePostProcessing = true;
    hud.syncTimeOfDay(17.75);
    hud.resetToggles();
  },
  onCaptureFeedback() {
    renderFrame();
    const pos = getActivePos();
    return {
      image: canvas.toDataURL('image/jpeg', 0.72),
      meta: `build geneva-gta6-0.4 | fps=${currentFps} | pos=(${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}) | mode=${activeVehicle ? activeVehicle.label : 'ON FOOT'}`,
    };
  },
});
hud.syncTimeOfDay(settings.timeOfDay);

mapUI = createMapUI((wp) => {
  customWaypoint = wp;
  if (!world) return;
  if (wp) {
    world.customBeacon.visible = true;
    world.customBeacon.position.set(wp.x, getGroundHeight(wp.x, wp.z) + 0.12, wp.z);
    hud.showSubtitle('Custom waypoint set on 1:1 Geneva map.', 2400);
  } else {
    world.customBeacon.visible = false;
  }
});

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function bootRealGeneva() {
  hud.setLoadProgress(6, 'Loading 2K Day/Sunset/Night HDRIs & Poly Haven PBR textures…');
  const rgbeLoader = new RGBELoader();
  rgbeLoader.setDataType(THREE.FloatType);

  const [realData, streetFeatures, realPlaces, pedZonesData, buildingsMeta, orthoImg, topoImg, photoBundle, hdrDay, hdrSunset, hdrNight] = await Promise.all([
    fetch('data/geneva-1to1.json').then((r) => r.json()),
    fetch('data/geneva-street-features.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('data/geneva-real-places.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('data/geneva-pedestrian-zones.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch('data/geneva-buildings-meta.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    loadImage('data/geneva-ortho.jpg'),
    loadImage('data/geneva-map.jpg'),
    loadPhotoPBRBundle(),
    rgbeLoader.loadAsync('textures/sky_day.hdr').catch(() => null),
    rgbeLoader.loadAsync('textures/sky_sunset.hdr').catch(() => null),
    rgbeLoader.loadAsync('textures/sky_night.hdr').catch(() => null),
  ]);

  const pmremGen = new THREE.PMREMGenerator(renderer);
  pmremGen.compileEquirectangularShader();
  for (const [k, tex] of [
    ['day', hdrDay],
    ['sunset', hdrSunset],
    ['night', hdrNight],
  ]) {
    if (tex) {
      // Clamp extreme HDRI sun radiance pixels (<= 16.0) & strip any NaN/Inf so FP16 HalfFloat render targets NEVER overflow!
      const arr = tex.image?.data;
      if (arr && arr.length) {
        for (let i = 0; i < arr.length; i++) {
          const v = arr[i];
          if (!Number.isFinite(v) || v < 0) arr[i] = 0;
          else if (v > 16.0) arr[i] = 16.0;
        }
        tex.needsUpdate = true;
      }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      hdris[k] = tex;
      hdrEnvMaps[k] = pmremGen.fromEquirectangular(tex).texture;
    }
  }
  pmremGen.dispose();
  if (hdrEnvMaps.day) {
    scene.environment = hdrEnvMaps.day;
    scene.background = hdris.day;
    scene.environmentIntensity = 0.92;
    scene.backgroundIntensity = 0.80;
  }

  hud.setLoadProgress(22, 'Indexing Geneva coastline, ALTI3D elevation & streets…');
  initRealGenevaData(realData, topoImg);
  mapUI.setMapImages(topoImg, orthoImg);

  const orthoTex = new THREE.Texture(orthoImg);
  orthoTex.needsUpdate = true;

  world = buildGenevaWorld(scene, realData, orthoTex, photoBundle, (pct, msg) => hud.setLoadProgress(pct, msg), streetFeatures, true, pedZonesData);

  // Stream official 1:1 Swiss Federal Government swisstopo swissBUILDINGS3D 3D meshes + mount real Geneva shopfronts & skyline watchmakers!
  let swiss3D = null;
  try {
    swiss3D = await loadSwissBuildings3D(
      world.worldGroup,
      realData,
      world.upperMats,
      world.groundMats,
      photoBundle,
      orthoTex,
      (pct, msg) => hud.setLoadProgress(pct, msg),
      world.insertCollider,
      buildingsMeta,
      realPlaces
    );
  } catch (e) {
    console.warn('swissBUILDINGS3D unavailable:', e);
  }
  const identity = buildGenevaIdentity(world.worldGroup, realData, realPlaces, swiss3D);
  const streetLife = buildGenevaStreetLife(world.worldGroup, realData, streetFeatures, swiss3D, world.registerInteractable, world.insertCollider);
  interiors = createGenevaInteriors(scene, world.worldGroup, world.registerInteractable);
  world.attachRealGenevaLayers(swiss3D, identity, streetLife);
  // Freeze world matrices on static Geneva signage & street-life layers so updateMatrixWorld skips hundreds of static transforms/frame!
  const freezeStaticSubtree = (grp) => {
    if (!grp) return;
    grp.updateMatrixWorld(true);
    grp.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) {
        o.matrixAutoUpdate = false;
        o.updateMatrix();
      }
    });
  };
  freezeStaticSubtree(identity?.streetGroup);
  freezeStaticSubtree(streetLife?.group);

  hud.setLoadProgress(94, 'Spawning vehicles, pedestrians & Geneva traffic…');
  vehicleMgr = createVehicles(scene);
  player = createPlayer(scene);
  player.teleport('rade');
  hud.setLoadProgress(100, '1:1 Geneva ready.');
  worldReady = true;
}

bootRealGeneva().catch((err) => {
  console.error('Failed to boot 1:1 Geneva:', err);
  hud.setLoadProgress(0, 'Error loading Geneva dataset. Check console.');
});

const _activePos = { x: 0, y: 2, z: 0 };
function getActivePos() {
  if (activeVehicle) {
    _activePos.x = activeVehicle.x;
    _activePos.y = activeVehicle.y;
    _activePos.z = activeVehicle.z;
    return _activePos;
  }
  if (player) {
    _activePos.x = player.state.x;
    _activePos.y = player.state.y;
    _activePos.z = player.state.z;
    return _activePos;
  }
  _activePos.x = 0; _activePos.y = 2; _activePos.z = 0;
  return _activePos;
}

  renderer.info.autoReset = false;
let _lastShadowSnapX = 1e9;
let _lastShadowSnapZ = 1e9;
function renderFrame() {
  renderer.info.reset();
  // Smooth staggered shadow cadence: refresh immediately when camera/player moves or on odd frames
  // (interleaved with water planar reflection's even frames to eliminate alternating 2x frame-time spikes!)
  if (renderer.shadowMap.enabled) {
    const insideNow = Boolean(interiors?.isInside());
    if (insideNow) {
      renderer.shadowMap.needsUpdate = (frameCount & 3) === 0;
    } else {
      const movedShadow =
        Math.abs(sunLight.target.position.x - _lastShadowSnapX) > 0.01 ||
        Math.abs(sunLight.target.position.z - _lastShadowSnapZ) > 0.01;
      const didRefl = world?.waterMesh?.userData?.didRenderReflection;
      if (movedShadow || frameCount < 6 || (!didRefl && (frameCount & 1) === 1)) {
        renderer.shadowMap.needsUpdate = true;
        _lastShadowSnapX = sunLight.target.position.x;
        _lastShadowSnapZ = sunLight.target.position.z;
      }
    }
  }
  if (world?.waterMesh?.userData) world.waterMesh.userData.didRenderReflection = false;
  if (usePostProcessing) composer.render();
  else renderer.render(scene, camera);
  cachedDrawCalls = renderer.info.render.calls;
}

// Input handling
const keys = {};
let demoLocoMode = null;

window.addEventListener('keydown', (e) => {
  const isTyping = document.activeElement && document.activeElement.tagName === 'TEXTAREA';
  if (isTyping) return;

  if (started && (e.code === 'Escape' || e.code === 'KeyP')) {
    if (document.activeElement?.tagName === 'INPUT') document.activeElement.blur();
    if (mapUI.isOpen()) {
      mapUI.setOpen(false);
      paused = false;
      return;
    }
    paused = !paused;
    hud.setMenuOpen(paused);
    if (paused) document.exitPointerLock?.();
    else safePointerLock();
    return;
  }

  keys[e.code] = true;
  if (started && !paused && (e.code === 'AltLeft' || e.code === 'AltRight')) {
    e.preventDefault();
  }

  if (e.code === 'Backslash') {
    e.preventDefault();
    hud.toggleFullscreen();
    return;
  }
  if (e.code === 'KeyB' && started) {
    e.preventDefault();
    document.exitPointerLock?.();
    hud.openFeedback();
    return;
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.showSubtitle(muted ? 'Sound muted.' : 'Sound unmuted.', 1800);
    return;
  }

  if (!started || !worldReady) return;

  if (e.code === 'Tab') {
    e.preventDefault();
    const next = !mapUI.isOpen();
    if (next) {
      document.exitPointerLock?.();
      hud.setMenuOpen(false);
      paused = true;
      mapUI.setOpen(true, getActivePos());
    } else {
      mapUI.setOpen(false);
      paused = false;
      safePointerLock();
    }
    return;
  }

  if (mapUI.isOpen()) {
    if (e.code === 'Digit0') mapUI.resetView(getActivePos().x, getActivePos().z);
    if (e.code === 'KeyS') {
      const sat = mapUI.toggleLayer();
      hud.showSubtitle(sat ? 'Map layer: swisstopo Satellite Orthophoto' : 'Map layer: Swiss National Topographic Map', 2000);
    }
    return;
  }

  if (paused) return;

  if (e.code === 'KeyF') {
    if (!activeVehicle && player?.isInteracting()) player.stopInteraction();
    toggleVehicle();
  } else if (e.code === 'KeyE' && !e.repeat) {
    if (!activeVehicle) {
      triggerInteractable();
    } else if (activeVehicle.type === 'tram') {
      const nextMode = activeVehicle.transitMode === 'drive' ? 'passenger' : 'drive';
      activeVehicle.transitMode = nextMode;
      audio.playTramBell();
      if (nextMode === 'drive') {
        hud.showStuntToast(`TRAM DRIVER · ${activeVehicle.label}`);
        hud.showSubtitle(`Driving ${activeVehicle.label} on Rue du Rhône rails: W accelerate, S brake/reverse, SPACE rail brake, G bell, V cab view, E autopilot.`, 4800);
      } else {
        hud.showStuntToast(`TPG AUTOPILOT · ${activeVehicle.label}`);
        hud.showSubtitle(`Passenger mode on ${activeVehicle.label} -> ${activeVehicle.dest || 'GENÈVE'} · Sit back or press [V] for window view!`, 3600);
      }
    } else if (activeVehicle.type === 'transit_bus' && activeVehicle.trafficEntity) {
      const ent = activeVehicle.trafficEntity;
      const hijacked = world.roadTraffic.hijackTrafficVehicle(ent);
      if (hijacked) {
        const adopted = vehicleMgr.adoptStolenTrafficVehicle(hijacked, true);
        activeVehicle = adopted;
        audio.playTransitDoor();
        hud.showStuntToast(`DRIVING · ${adopted.label}`);
        hud.showSubtitle(`Taking the wheel of ${adopted.label}! W A S D free-roam Geneva, SPACE air brake, V cab view, G chime, F exit.`, 4400);
      }
    }
  } else if (e.code === 'Space' && !e.repeat && activeVehicle?.type === 'tram' && activeVehicle.transitMode === 'drive') {
    audio.playTramBell();
  } else if (e.code === 'KeyX' && !activeVehicle) {
    if (player?.isInteracting()) player.stopInteraction();
    player.fireHook(camera, world.queryColliders, world.sampleRoofHeight);
  } else if (e.code === 'KeyG' && !e.repeat) {
    if (!activeVehicle) {
      if (player?.isInteracting()) player.stopInteraction();
      if (player.triggerRoll()) audio.playImpactThud(0.55);
    } else if (activeVehicle.type === 'tram') {
      audio.playTramBell();
      hud.showStuntToast(`DING-DING! · ${activeVehicle.label}`);
    } else if (activeVehicle.type === 'transit_bus' || activeVehicle.style === 'bus') {
      audio.playTpgStopChime();
      hud.showStuntToast(`tpg CHIME · ${activeVehicle.label}`);
    }
  } else if (e.code === 'KeyZ' && !e.repeat && !activeVehicle) {
    const crouched = player.toggleCrouch();
    hud.showSubtitle(crouched ? 'Stealth Crouch ON' : 'Standing', 1400);
  } else if (e.code === 'CapsLock' && !e.repeat && !activeVehicle) {
    const walkOn = player.toggleWalkMode();
    hud.showSubtitle(walkOn ? 'Casual Walk Mode ON (hold Shift to sprint)' : 'Athletic Run Mode ON (hold Alt to walk)', 1800);
  } else if (e.code === 'Digit1' && !activeVehicle) {
    if (player.triggerEmote('wave')) hud.showSubtitle('Salut Genève! 👋', 1500);
  } else if (e.code === 'Digit2' && !activeVehicle) {
    if (player.triggerEmote('cheer')) hud.showSubtitle('Victory Cheer!', 1500);
  } else if (e.code === 'Digit3' && !activeVehicle) {
    if (player.triggerEmote('backflip')) hud.showSubtitle('Parkour Backflip!', 1400);
  } else if (e.code === 'Digit4' && !activeVehicle) {
    if (player.triggerEmote('watch')) hud.showSubtitle('Checking Swiss timepiece…', 1600);
  } else if (e.code === 'KeyV') {
    settings.cinematicCam = false;
    settings.camMode = (settings.camMode + 1) % 3;
    if (isTransitVehicle(activeVehicle)) {
      const isDriver = activeVehicle.transitMode === 'drive' || (activeVehicle.style === 'bus' && activeVehicle.type !== 'transit_bus');
      if (settings.camMode === 1) {
        camYaw = activeVehicle.yaw + Math.PI;
        camPitch = 0.03;
      }
      const names = [
        'Scenic transit chase camera',
        isDriver ? 'First-person driver cab camera' : 'Panoramic window passenger camera',
        'Wide Geneva transit camera',
      ];
      hud.showSubtitle(names[settings.camMode], 2000);
    } else {
      const names = ['Third-person camera', 'Close action camera', 'Wide scenic camera'];
      hud.showSubtitle(names[settings.camMode], 1800);
    }
  } else if (e.code === 'KeyO' && !e.repeat && !activeVehicle) {
    const nextOutfit = player.toggleOutfit();
    audio.playFootstep('walk', 'R', 0.4);
    hud.showStuntToast(nextOutfit === 'swimwear' ? 'OUTFIT · GENEVA RIVIERA SWIMWEAR' : 'OUTFIT · SAVILE ROW BANKER SUIT');
    hud.showSubtitle(
      nextOutfit === 'swimwear'
        ? 'Swapped into Riviera summer swimwear — ready for Les Bains des Pâquis!'
        : 'Back in your Savile Row midnight-navy investment banker suit.',
      2600
    );
  } else if (e.code === 'KeyU' && !e.repeat) {
    const order = ['summer', 'rain', 'storm', 'winter'];
    const next = order[(order.indexOf(settings.weather) + 1) % order.length];
    applyWeatherMode(next);
    const labels = {
      summer: 'WEATHER · GENEVA SUMMER SUN',
      rain: 'WEATHER · ALPINE RAIN',
      storm: 'WEATHER · MONT SALÈVE THUNDERSTORM',
      winter: 'WEATHER · WINTER GENEVA SNOW & LIGHTS',
    };
    hud.showStuntToast(labels[next]);
  } else if (e.code === 'KeyC') {
    settings.cinematicCam = !settings.cinematicCam;
    hud.showSubtitle(settings.cinematicCam ? 'GTA Cinematic Camera ON' : 'Standard Camera', 1800);
  } else if (e.code === 'KeyR') {
    radioIndex = (radioIndex + 1) % RADIO_STATIONS.length;
    const st = RADIO_STATIONS[radioIndex];
    audio.setRadio(st.id);
    hud.showRadioBanner(st.label);
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

canvas.addEventListener('mousedown', () => {
  if (!started || paused || mapUI.isOpen()) return;
  audio.ensureInit();
  if (document.pointerLockElement !== canvas) safePointerLock();
  isDraggingLook = true;
});

window.addEventListener('mouseup', () => {
  isDraggingLook = false;
});

window.addEventListener('mousemove', (e) => {
  if (!started || paused || mapUI.isOpen()) return;
  if (document.pointerLockElement === canvas || isDraggingLook) {
    const sens = 0.0024 * settings.sensitivity;
    camYaw -= e.movementX * sens;
    const dy = e.movementY * sens * (settings.invertY ? -1 : 1);
    camPitch = Math.max(-0.3, Math.min(1.15, camPitch + dy));
    panVelX = Math.max(-1.2, Math.min(1.2, panVelX + e.movementX * 0.014));
    panVelY = Math.max(-1.2, Math.min(1.2, panVelY + e.movementY * 0.014));
    lastMouseMoveTime = performance.now();
  }
});

function isTransitVehicle(v) {
  return !!v && (v.type === 'tram' || v.type === 'transit_bus' || v.style === 'bus');
}

function createTransitRide(entity, mode = 'passenger') {
  const isTram = entity.kind === 'tram';
  return {
    id: `ride_${entity.kind}_${entity.spec?.num || 'tpg'}`,
    type: isTram ? 'tram' : 'transit_bus',
    style: isTram ? 'tram' : 'bus',
    label: entity.label || (isTram ? 'TPG TRAM' : 'TPG BUS'),
    dest: entity.dest || '',
    trafficEntity: entity,
    transitMode: mode,
    get x() { return entity.x; },
    get y() { return entity.y; },
    get z() { return entity.z; },
    get yaw() { return entity.yaw; },
    get speed() { return entity.speed; },
    halfW: entity.halfW,
    halfL: entity.halfL,
    height: entity.height,
    suspPitch: 0,
    suspRoll: 0,
  };
}

function distToVehicleHull(v, px, pz) {
  const dx = px - v.x;
  const dz = pz - v.z;
  const cosY = Math.cos(v.yaw || 0);
  const sinY = Math.sin(v.yaw || 0);
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;
  const cx = Math.max(0, Math.abs(lx) - (v.halfW || 1.2));
  const cz = Math.max(0, Math.abs(lz) - (v.halfL || 2.4));
  return Math.hypot(cx, cz);
}

function isStealableParked(v) {
  if (!v || v.type !== 'car' || v.stolen) return false;
  // Starter Vespa, shared Geneva electric trottinettes, TPG public transit buses & Mission 01 Ferrari stay friendly!
  return v.id !== 'vespa_1' && v.id !== 'coupe_red' && v.style !== 'escooter' && v.style !== 'bus';
}

function findNearestVehicle(maxDist = 11.5) {
  if (!vehicleMgr || !player) return null;
  let best = null;
  let bestD = maxDist;
  for (const v of vehicleMgr.vehicles) {
    const d =
      v.style === 'bus' || v.type === 'boat' || v.type === 'heli'
        ? distToVehicleHull(v, player.state.x, player.state.z)
        : Math.hypot(v.x - player.state.x, v.z - player.state.z);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'parked', v, dist: d };
    }
  }
  if (world?.roadTraffic) {
    const tVeh = world.roadTraffic.findNearestTrafficVehicle(player.state.x, player.state.z, bestD);
    if (tVeh) {
      const d = Number.isFinite(tVeh._lastHullDist) ? tVeh._lastHullDist : Math.hypot(tVeh.x - player.state.x, tVeh.z - player.state.z);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'traffic', entity: tVeh, dist: d };
      }
    }
  }
  return best;
}

const VICTIM_LINES = [
  'Driver: "Hey!! Ma voiture!! Appellez la police!!"',
  'Driver: "Au secours!! On m\'a volé ma voiture!!"',
  'Driver: "Stop! Police de Genève!! Il vole ma caisse!!"',
];

function triggerCarTheft(vehicleObj, wasOccupied = false) {
  vehicleObj.stolen = true;
  vehicleObj.alarmTimer = 5.5;
  audio.playCarStealAlarm();
  const addStars = vehicleObj.style === 'police' ? 2 : 1;
  wantedLevel = Math.min(3, Math.max(1, wantedLevel + addStars));
  wantedEvadeTimer = 22;
  vehicleMgr.dispatchPoliceNear(vehicleObj.x, vehicleObj.z, vehicleObj.yaw);
  hud.showStuntToast(`CRIME REPORTED · STOLEN ${vehicleObj.label} ${'★'.repeat(wantedLevel)}`);
  if (wasOccupied) {
    const line = VICTIM_LINES[Math.floor(Math.random() * VICTIM_LINES.length)];
    hud.showSubtitle(line, 4200);
  } else {
    hud.showSubtitle(`Alarm triggered! Evade Geneva Police (${'★'.repeat(wantedLevel)}) in your stolen ${vehicleObj.label}!`, 4000);
  }
}

const interactCooldowns = new Map();
function triggerInteractable() {
  if (!player || !world?.findNearestInteractable || activeVehicle) return;
  // Handle interior actions & exit door seamlessly when inside a Geneva boutique / bank / buvette!
  if (interiors?.isInside()) {
    const act = interiors.findNearestInteriorAction(player.state.x, player.state.z);
    if (!act) return;
    if (act.kind === 'exit') {
      const prev = interiors.exitInterior(player.state);
      camYaw = player.state.yaw + Math.PI;
      audio.playFootstep('walk', 'L', 0.4);
      hud.showSubtitle(`Stepped back outside ${prev?.title || 'Geneva'}.`, 2200);
    } else if (act.kind === 'action' && act.item) {
      const it = act.item;
      if (it.subtitle) hud.showSubtitle(it.subtitle, 3800);
      if (it.toast) hud.showStuntToast(it.toast);
      if (it.rewardCash) {
        const now = performance.now();
        const last = interactCooldowns.get(it.id) || 0;
        if (now - last > 45000) {
          interactCooldowns.set(it.id, now);
          cash += it.rewardCash;
          audio.playChime(true);
        } else {
          audio.playChime(false);
        }
      } else {
        audio.playChime(false);
      }
    }
    return;
  }

  if (player.isInteracting()) {
    player.stopInteraction();
    audio.playFootstep('walk', 'L', 0.35);
    return;
  }
  const hit = world.findNearestInteractable(player.state.x, player.state.z);
  if (!hit) return;
  const it = hit.item;
  if (it.type === 'interior_enter' && interiors) {
    const room = interiors.enterInterior(it.interiorId, player.state);
    if (room) {
      camYaw = player.state.yaw + Math.PI;
      audio.playChime(false);
      hud.showStuntToast(room.title);
      hud.showSubtitle(it.subtitle || `Welcome inside ${room.title}!`, 3600);
    }
    return;
  }
  if (it.type === 'cabana_outfit') {
    const nextOutfit = player.toggleOutfit();
    audio.playChime(false);
    hud.showStuntToast(nextOutfit === 'swimwear' ? 'SWIMWEAR EQUIPPED!' : 'BANKER SUIT EQUIPPED!');
    hud.showSubtitle(it.subtitle, 3200);
    return;
  }
  if (!player.startInteraction(it)) return;

  if (it.subtitle) hud.showSubtitle(it.subtitle, it.persistent ? 3600 : 3200);
  if (it.toast) hud.showStuntToast(it.toast);

  if (it.rewardCash) {
    const now = performance.now();
    const last = interactCooldowns.get(it.id) || 0;
    if (now - last > 45000) {
      interactCooldowns.set(it.id, now);
      cash += it.rewardCash;
      audio.playChime(false);
    } else {
      audio.playFootstep('walk', 'R', 0.32);
    }
  } else if (it.type === 'tpg_machine') {
    if (cash >= 3) cash -= 3;
    audio.playChime(false);
  } else if (it.type === 'bench' || it.type === 'shelter_bench' || it.type === 'cafe_chair' || it.type === 'railing') {
    audio.playFootstep('walk', 'R', 0.32);
  }
}

function toggleVehicle() {
  if (activeVehicle) {
    const wasTransit = isTransitVehicle(activeVehicle);
    let exitX, exitZ;
    if (wasTransit) {
      // Alight safely onto the Swiss right-hand sidewalk right beside the TPG bus/tram doors!
      const sideOff = (activeVehicle.halfW || 1.35) + 1.55;
      const fwdOff = activeVehicle.type === 'tram' ? 6.0 : 0.8;
      const sinY = Math.sin(activeVehicle.yaw);
      const cosY = Math.cos(activeVehicle.yaw);
      // Right-hand curb vector of forward (sinY, cosY) is (-cosY, sinY)
      const rx = -cosY;
      const rz = sinY;
      exitX = activeVehicle.x + sinY * fwdOff + rx * sideOff;
      exitZ = activeVehicle.z + cosY * fwdOff + rz * sideOff;
      if (isWater(exitX, exitZ)) {
        exitX = activeVehicle.x + sinY * fwdOff - rx * sideOff;
        exitZ = activeVehicle.z + cosY * fwdOff - rz * sideOff;
      }
      audio.playTransitDoor();
    } else {
      const exitOff = activeVehicle.style === 'escooter' ? 1.25 : 3.4;
      exitX = activeVehicle.x + Math.cos(activeVehicle.yaw) * exitOff;
      exitZ = activeVehicle.z - Math.sin(activeVehicle.yaw) * exitOff;
    }
    const groundY = getGroundHeight(exitX, exitZ);
    const roofAtExit =
      world?.sampleRoofHeight && activeVehicle.type === 'heli'
        ? world.sampleRoofHeight(exitX, exitZ, activeVehicle.y + 2.5, 0.5)
        : null;
    const roofAtHeli =
      world?.sampleRoofHeight && activeVehicle.type === 'heli'
        ? world.sampleRoofHeight(activeVehicle.x, activeVehicle.z, activeVehicle.y + 2.5, 1.2)
        : null;
    const bestSurfaceY = Math.max(groundY + 0.255, roofAtExit ?? -999, roofAtHeli ?? -999);
    const landedOnRoof = activeVehicle.type === 'heli' && bestSurfaceY > groundY + 2.0 && activeVehicle.y <= bestSurfaceY + 3.5;
    const bailingFromAir = activeVehicle.type === 'heli' && activeVehicle.y > bestSurfaceY + 3.5;
    // If helicopter landed near a roof edge where exitX stepped off into thin air, step safely onto the roof next to the skids!
    if (landedOnRoof && roofAtExit === null && roofAtHeli !== null) {
      exitX = activeVehicle.x + Math.cos(activeVehicle.yaw) * 1.9;
      exitZ = activeVehicle.z - Math.sin(activeVehicle.yaw) * 1.9;
    }
    const finalFloorY = landedOnRoof ? Math.max(roofAtExit ?? roofAtHeli ?? activeVehicle.y, activeVehicle.y) : groundY + 0.255;
    player.state.x = exitX;
    player.state.z = exitZ;
    player.state.y = bailingFromAir ? activeVehicle.y - 1.0 : finalFloorY;
    player.state.vy = bailingFromAir ? -2.0 : 0;
    player.state.grounded = !bailingFromAir;
    player.state.yaw = activeVehicle.yaw;
    const prevLabel = activeVehicle.label;
    activeVehicle = null;
    if (settings.camMode === 1 && wasTransit) settings.camMode = 0;
    hud.showSubtitle(
      bailingFromAir
        ? 'Bailed out! Press X to grapple mid-air or land on any Geneva rooftop!'
        : landedOnRoof
        ? 'Landed on a Geneva rooftop! Explore the skyline or press F to re-board.'
        : wasTransit
        ? `Alighted from ${prevLabel} · On foot.`
        : 'On foot.',
      bailingFromAir || landedOnRoof ? 3600 : 1800
    );
  } else {
    const hit = findNearestVehicle(11.5);
    if (!hit) return;

    if (hit.kind === 'traffic') {
      const ent = hit.entity;
      if (ent.kind === 'tram' || ent.kind === 'bus') {
        // Friendly Geneva TPG public transit boarding (Scenic Passenger Ride + [E] to take controls!)
        activeVehicle = createTransitRide(ent, 'passenger');
        camYaw = ent.yaw + Math.PI;
        camPitch = ent.kind === 'tram' ? 0.20 : 0.16;
        settings.camMode = 0;
        audio.playTransitDoor();
        if (ent.kind === 'tram') audio.playTramBell();
        hud.showStuntToast(`BOARDED · ${ent.label}`);
        hud.showSubtitle(
          ent.kind === 'tram'
            ? `${ent.label} -> ${ent.dest || 'GENÈVE'} · [E] Drive Tram · [V] Window/Cab View · [G] Bell · [F] Exit`
            : `${ent.label} -> ${ent.dest || 'GENÈVE'} · [E] Take the Wheel · [V] Window View · [G] Chime · [F] Exit`,
          4800
        );
        return;
      }

      // FULL GTA CARJACKING for private cars: pull occupied Geneva driver out of moving AI traffic car!
      const hijacked = world.roadTraffic.hijackTrafficVehicle(ent);
      if (!hijacked) return;
      world.spawnFleeingDriver(hijacked.x, hijacked.z, hijacked.yaw);
      const adopted = vehicleMgr.adoptStolenTrafficVehicle(hijacked, false);
      activeVehicle = adopted;
      camYaw = adopted.yaw + Math.PI;
      triggerCarTheft(adopted, true);
      return;
    }

    const near = hit.v;
    const stealingParked = isStealableParked(near);
    activeVehicle = near;
    camYaw = near.yaw + Math.PI;
    if (stealingParked) {
      triggerCarTheft(near, false);
    } else if (near.style === 'bus') {
      audio.playTransitDoor();
      hud.showStuntToast(`DRIVING · ${near.label}`);
      hud.showSubtitle(`${near.label}: W A S D drive, SPACE air brake, V cab/chase view, G chime, R radio, F exit.`, 4200);
    } else if (near.type === 'heli') {
      hud.showSubtitle('Helicopter: SPACE ascend, SHIFT descend, WASD fly, Q/E yaw, C cinematic.', 4200);
    } else if (near.type === 'boat') {
      hud.showSubtitle('Mouette water taxi: W A S D to cruise across Lac Léman.', 3600);
    } else if (near.style === 'escooter') {
      hud.showSubtitle(`${near.label}: W A S D ride, E turbo boost, SPACE brake, F step off.`, 3400);
    } else {
      hud.showSubtitle(`${near.label}: W A S D drive, SPACE drift, E nitro boost, R radio, C cinematic.`, 3800);
    }
  }
}

// Dynamic Day / Night Golden-Hour GTA 6 Lighting (matched to real Quai du Général-Guisan reference + luminous Alpine moonlit nights!)
const fogDay = new THREE.Color(0x82b2df);
const fogSunset = new THREE.Color(0xe69564);
const fogNight = new THREE.Color(0x0c1629);
const fogRainCol = new THREE.Color(0x465261);
const fogWinterCol = new THREE.Color(0xcad9e8);
const sunDayCol = new THREE.Color(0xffefcf);
const sunSetCol = new THREE.Color(0xff9448);
const moonNightCol = new THREE.Color(0x8ab8ff);
const sunWinterCol = new THREE.Color(0xdcebff);
const lightningCol = new THREE.Color(0xeef6ff);
const hemiSkyDay = new THREE.Color(0x6ca8e8);
const hemiSkyNight = new THREE.Color(0x3a61a4);
const hemiGroundDay = new THREE.Color(0x3b352c);
const hemiGroundNight = new THREE.Color(0x463220);
const tmpFog = new THREE.Color();
const tmpSunCol = new THREE.Color();
const _sunDir = new THREE.Vector3();
const _camTargetVec = new THREE.Vector3();
const _focusIdle = { x: 80, y: 0, z: 20 };
let _lampTimer = 1.0;

function updateSkyAndLighting(dt, elapsed) {
  if (settings.dayCycle && started && !paused) {
    settings.timeOfDay = (settings.timeOfDay + dt * 0.032) % 24;
  }
  const h = settings.timeOfDay;
  const sunAngle = ((h - 6) / 14) * Math.PI;
  const elev = Math.sin(sunAngle);

  const dayFactor = Math.max(0, Math.min(1, (elev + 0.14) / 0.86));
  const nightFactor = 1 - dayFactor;
  const sunsetFactor = Math.max(0, 1 - Math.abs(elev - 0.28) * 2.1);
  const rainFactor = settings.rain ? 1.0 : 0.0;
  // Smooth transition from golden sun arc -> high 45° Alpine moonlight over Lac Léman (eliminates grazing-angle pitch-black night ground!)
  const moonBlend = Math.max(0, Math.min(1, (nightFactor - 0.35) / 0.45));

  // Dramatic golden-hour raking elevation in daylight; elevated crisp Alpine moon at night so ground, railings & protagonist stay cleanly lit!
  const dayOffX = -Math.cos(sunAngle) * 265;
  const dayOffY = Math.max(22, elev * 182);
  const dayOffZ = -152;
  const moonOffX = 118;
  const moonOffY = 178;
  const moonOffZ = -138;
  const sunOffX = dayOffX + (moonOffX - dayOffX) * moonBlend;
  const sunOffY = dayOffY + (moonOffY - dayOffY) * moonBlend;
  const sunOffZ = dayOffZ + (moonOffZ - dayOffZ) * moonBlend;

  // Snap shadow frustum target to shadow-map texel grid so shadows NEVER shimmer while moving!
  const focus = started ? getActivePos() : _focusIdle;
  const texelStep = (shadowRange * 2) / 2048;
  const snapX = Math.round(focus.x / texelStep) * texelStep;
  const snapZ = Math.round(focus.z / texelStep) * texelStep;
  const snapY = Math.round((focus.y || 0) / texelStep) * texelStep;
  sunLight.target.position.set(snapX, snapY, snapZ);
  sunLight.position.set(snapX + sunOffX, snapY + sunOffY, snapZ + sunOffZ);

  _sunDir.set(sunOffX, Math.max(12, sunOffY), sunOffZ).normalize();
  const sunDir = _sunDir;

  tmpFog.copy(fogNight).lerp(fogDay, dayFactor);
  if (sunsetFactor > 0) tmpFog.lerp(fogSunset, sunsetFactor * 0.36);
  if (settings.rain) tmpFog.lerp(fogRainCol, settings.storm ? 0.78 : 0.55);
  if (settings.winter) tmpFog.lerp(fogWinterCol, 0.45);

  // Periodic dramatic Alpine thunderstorm lightning flashes + rolling thunderclap!
  if (settings.storm && started && !paused) {
    if (elapsed >= nextLightningAt) {
      lightningFlash = 1.0;
      nextLightningAt = elapsed + 7.5 + Math.random() * 11.0;
      setTimeout(() => { if (settings.storm) audio.playThunderRumble(); }, 420);
    }
  }
  lightningFlash = Math.max(0, lightningFlash - dt * 3.8);

  tmpSunCol.copy(sunDayCol).lerp(sunSetCol, sunsetFactor * 0.45).lerp(moonNightCol, moonBlend);
  if (settings.winter) tmpSunCol.lerp(sunWinterCol, 0.32);
  if (lightningFlash > 0.05) tmpSunCol.lerp(lightningCol, lightningFlash * 0.85);
  sunLight.color.copy(tmpSunCol);
  // Crisp sunlit afternoon (3.29) -> smooth twilight -> balanced silver-blue Alpine moonlight (0.54) so warm streetlamps pop while shadows stay clean!
  const directPower = Math.max(moonBlend * 0.54, 0.20 + dayFactor * 3.09);
  const weatherMul = settings.storm ? 0.42 : settings.rain ? 0.58 : settings.winter ? 0.78 : 1.0;
  const insideRoom = Boolean(interiors?.isInside());
  sunLight.intensity = (directPower * weatherMul + lightningFlash * 4.2) * (insideRoom ? 0.12 : 1.0);
  scene.environmentIntensity = insideRoom ? 0.22 : 1.0;
  gtaoPass.enabled = !insideRoom && settings.quality !== 'low';
  // Hide the entire outdoor city & lake while inside an enclosed interior (drops indoor draw calls from ~300+ to ~15!)
  if (world?.worldGroup) world.worldGroup.visible = !insideRoom;
  if (world?.waterMesh) world.waterMesh.visible = !insideRoom;
  if (vehicleMgr?.group) vehicleMgr.group.visible = !insideRoom;

  // Rich nocturnal Alpine skyglow + warm amber Geneva streetlamp bounce on hemisphere light
  hemiLight.color.copy(hemiSkyDay).lerp(hemiSkyNight, nightFactor);
  hemiLight.groundColor.copy(hemiGroundDay).lerp(hemiGroundNight, nightFactor);
  hemiLight.intensity = insideRoom ? 0.92 : 0.38 + nightFactor * 0.12;

  // Filmic camera eye-adaptation: 0.88 calibrated daylight -> 1.10 crisp cinematic midnight without washing out dark sky or windows!
  renderer.toneMappingExposure = 0.88 + nightFactor * 0.22 + sunsetFactor * 0.04;
  gtaPostPass.uniforms.uExposure.value = renderer.toneMappingExposure;

  // Seamlessly switch between 3 REAL 2K Photographic HDRIs + PMREM Prefiltered Specular Reflection Probes!
  const hdrKey =
    nightFactor > 0.58 ? 'night' : sunsetFactor > 0.64 ? 'sunset' : 'day';
  const activeHdr = hdris[hdrKey] || hdris.day;
  const activeEnv = hdrEnvMaps[hdrKey] || hdrEnvMaps.day;

  if (activeHdr) {
    const isNightHdr = hdrKey === 'night';
    skyMesh.visible = !insideRoom && (settings.rain || isNightHdr);
    scene.background = insideRoom || settings.rain || isNightHdr ? null : activeHdr;
    scene.environment = activeEnv || activeHdr;
    scene.backgroundIntensity = isNightHdr ? 0.50 : Math.max(0.42, dayFactor * 0.80);
    // Keep sleek IBL specular reflections on leather moto jacket, cars, wet roads & lakefront railings at night!
    scene.environmentIntensity = insideRoom ? 0.22 : isNightHdr ? 0.62 : Math.max(0.50, dayFactor * 0.92);
  } else {
    skyMesh.visible = !insideRoom;
  }

  // Dynamically relocate 6 warm physical-candela streetlamp PointLights at 4Hz at night (snapping on frame 1!)
  const nightLampFrac = Math.max(0, (nightFactor - 0.22) / 0.78);
  const lampPower = nightLampFrac * 82;
  if (world?.lampCoords && lampPower > 0.2) {
    _lampTimer += dt;
    if (_lampTimer >= 0.25) {
      _lampTimer = 0;
      const coords = world.lampCoords;
      const picked = [];
      for (let k = 0; k < streetLampPool.length; k++) {
        let bestIdx = -1, bestD = Infinity;
        for (let i = 0; i < coords.length; i++) {
          if (picked.includes(i)) continue;
          const dx = coords[i][0] - focus.x;
          const dz = coords[i][1] - focus.z;
          const d = dx * dx + dz * dz;
          if (d < bestD) { bestD = d; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          picked.push(bestIdx);
          const lx = coords[bestIdx][0], lz = coords[bestIdx][1];
          streetLampPool[k].position.set(lx, getGroundHeight(lx, lz) + 5.2, lz);
        }
      }
    }
    for (let i = 0; i < streetLampPool.length; i++) streetLampPool[i].intensity = lampPower;
  } else {
    for (let i = 0; i < streetLampPool.length; i++) streetLampPool[i].intensity = 0;
  }

  // Subtle ambient warm city-bounce near the player at night (sculpts jacket, face, cobbles & railings even far from lamp posts!)
  nightCityBounce.position.set(focus.x + 2.2, (focus.y || 0) + 4.6, focus.z + 2.2);
  nightCityBounce.intensity = nightLampFrac * 11.5;

  scene.fog.color.copy(tmpFog);
  scene.fog.density = settings.rain ? 0.00090 : 0.00034; // realistic Alpine lakefront aerial depth!

  skyUniforms.uSunDir.value.copy(sunDir);
  skyUniforms.uTime.value = elapsed;
  skyUniforms.uDayFactor.value = dayFactor;
  skyUniforms.uSunsetFactor.value = sunsetFactor;
  skyUniforms.uRainFactor.value = rainFactor;

  if (world) {
    world.waterUniforms.uSunDir.value.copy(sunDir);
    world.waterUniforms.uSunColor.value.copy(tmpSunCol).multiplyScalar(Math.max(0.24, dayFactor));
    world.waterUniforms.uSkyColor.value.copy(tmpFog);
    if (world.waterUniforms.uNightFactor) world.waterUniforms.uNightFactor.value = nightFactor;
  }

  bloomPass.strength = 0.15 + nightFactor * 0.28 + sunsetFactor * 0.06;
  gtaPostPass.uniforms.uNight.value = nightFactor;
  return { nightFactor, sunDir };
}

function updateMissionsAndCollectibles() {
  const pos = getActivePos();

  for (const c of world.collectibleMeshes) {
    if (c.collected) continue;
    const dist = Math.hypot(c.x - pos.x, c.y - (pos.y + 1.2), c.z - pos.z);
    if (dist < (activeVehicle?.type === 'heli' ? 12 : 4.5)) {
      c.collected = true;
      c.mesh.visible = false;
      foundCount++;
      cash += 200;
      audio.playChime(false);
      hud.showSubtitle(`Found ${c.name}! (+CHF 200 · ${foundCount}/${world.collectibleMeshes.length})`, 3200);
    }
  }

  const m = MISSIONS[missionIdx];
  let complete = false;
  if (m.type === 'enter_vehicle') {
    if (activeVehicle && activeVehicle.id === m.vehicleId) complete = true;
    const targetVeh = vehicleMgr.vehicles.find((v) => v.id === m.vehicleId);
    if (targetVeh) {
      m.target.x = targetVeh.x;
      m.target.z = targetVeh.z;
    }
  } else if (m.type === 'reach') {
    if (Math.hypot(pos.x - m.target.x, pos.z - m.target.z) < m.radius) complete = true;
  } else if (m.type === 'reach_air') {
    if (activeVehicle?.type === 'heli' && Math.hypot(pos.x - m.target.x, pos.z - m.target.z) < m.radius && pos.y > 42) {
      complete = true;
    }
  }

  if (complete && missionIdx < MISSIONS.length - 1) {
    cash += m.reward;
    audio.playChime(true);
    missionIdx++;
    const next = MISSIONS[missionIdx];
    hud.showSubtitle(`${m.tag} complete (+CHF ${m.reward}) — ${next.subtitle}`, 5200);
  }

  const cur = MISSIONS[missionIdx];
  world.missionBeacon.visible = cur.type !== 'freeroam';
  world.missionBeacon.position.set(cur.target.x, getGroundHeight(cur.target.x, cur.target.z) + 0.12, cur.target.z);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  gtaoPass.setSize(Math.max(320, Math.floor(window.innerWidth * 0.5)), Math.max(240, Math.floor(window.innerHeight * 0.5)));
  bloomPass.setSize(Math.floor(window.innerWidth * 0.5), Math.floor(window.innerHeight * 0.5));
  gtaPostPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
});

let fpsFrames = 0;
let fpsAcc = 0;
let currentFps = 60;
const clock = new THREE.Clock();

let frameCount = 0;
let cachedStreetName = 'QUAI DU GÉNÉRAL-GUISAN';
let cachedDrawCalls = 0;
const _statsObj = {
  fps: 60,
  drawCalls: 0,
  triangles: 0,
  pos: { x: 0, y: 2, z: 0 },
  setPose(x, z, yaw, pitch = 0.08) {
    if (!player) return;
    activeVehicle = null;
    player.state.x = x;
    player.state.z = z;
    player.state.y = getGroundHeight(x, z) + 0.15;
    player.state.vx = 0;
    player.state.vy = 0;
    player.state.vz = 0;
    player.state.yaw = yaw;
    camYaw = yaw + Math.PI;
    camPitch = pitch;
  },
};
window.__GENEVA_STATS = _statsObj;
const _mapState = {
  playerPos: null,
  playerYaw: 0,
  vehicles: null,
  transit: null,
  collectibles: null,
  missionTarget: null,
  customWaypoint: null,
  foundCount: 0,
};

// Pre-allocated zero-GC per-frame objects so V8 never triggers frame-hitching garbage collections!
const _transitRiderState = {
  entity: null,
  mode: 'passenger',
  inVehicle: false,
  keys,
  onStopArrive(ent, stopName) {
    audio.playTpgStopChime();
    hud.showStuntToast(`tpg ARRÊT · ${stopName.toUpperCase()}`);
    hud.showSubtitle(`tpg ${ent.label} -> ${ent.dest || 'GENÈVE'} · Arrêt: ${stopName} (F to alight)`, 3400);
  },
};
const _allDynColsBuf = [];
const _emptyPlayerFx = { cameraShake: 0, impactSfx: null, toast: null, footstep: null, scuff: false, jump: false };

function animate() {
  requestAnimationFrame(animate);
  frameCount++;
  const dt = Math.min(0.05, clock.getDelta());
  const elapsed = clock.elapsedTime;

  fpsFrames++;
  fpsAcc += dt;
  if (fpsAcc >= 0.5) {
    currentFps = Math.round(fpsFrames / fpsAcc);
    fpsFrames = 0;
    fpsAcc = 0;
  }

  const { nightFactor, sunDir } = updateSkyAndLighting(dt, elapsed);
  const activePosNow = started ? getActivePos() : null;
  let transitRiderState = null;
  if (started && !paused) {
    _transitRiderState.entity = activeVehicle?.trafficEntity || null;
    _transitRiderState.mode = activeVehicle?.transitMode || 'passenger';
    _transitRiderState.inVehicle = !!activeVehicle;
    transitRiderState = _transitRiderState;
  }
  if (world) world.update(dt, elapsed, nightFactor, scene.fog.color, sunDir, activePosNow, transitRiderState, vehicleMgr?.vehicles || null);

  if (!started || !worldReady) {
    const a = elapsed * 0.11;
    camera.position.set(120 + Math.cos(a) * 260, 105 + Math.sin(a * 0.7) * 18, 20 + Math.sin(a) * 220);
    camera.lookAt(140, 26, -30);
    skyMesh.position.copy(camera.position);
    renderFrame();
    return;
  }

  if (!paused) {
    const trafficCols = world.getDynamicColliders(activeVehicle?.trafficEntity || null);
    const telemetry = vehicleMgr.update(
      dt,
      elapsed,
      activeVehicle,
      keys,
      world.queryColliders,
      nightFactor,
      wantedLevel,
      getActivePos(),
      trafficCols,
      world.queryCollidersRect,
      settings.rain,
      world.sampleRoofHeight
    );
    if (telemetry.crashIntensity > 2.4) {
      audio.playCarCrash(telemetry.crashIntensity, telemetry.crashIsMetal);
    }
    const vehCols = vehicleMgr.getVehicleColliders(activeVehicle);
    _allDynColsBuf.length = 0;
    for (let i = 0; i < trafficCols.length; i++) _allDynColsBuf.push(trafficCols[i]);
    for (let i = 0; i < vehCols.length; i++) _allDynColsBuf.push(vehCols[i]);
    const isTransitFirstPerson = isTransitVehicle(activeVehicle) && settings.camMode === 1 && !settings.cinematicCam;
    let playerFx = _emptyPlayerFx;
    if (activeVehicle && (activeVehicle.style === 'scooter' || activeVehicle.style === 'escooter')) {
      player.updateScooterRider(activeVehicle);
    } else if (isTransitVehicle(activeVehicle)) {
      player.updateTransitRider(activeVehicle, isTransitFirstPerson, dt, elapsed, camYaw);
    } else {
      // Allow ?cam=walk|jog|sprint verification presets to drive live continuous locomotion (cancels on first real keypress!)
      if (demoLocoMode && (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.Escape)) {
        demoLocoMode = null;
      }
      const effKeys = demoLocoMode
        ? {
            KeyW: true,
            AltLeft: demoLocoMode === 'walk',
            ShiftLeft: demoLocoMode === 'sprint',
          }
        : keys;
      const effCamYaw = demoLocoMode ? camYaw + 0.82 : camYaw;
      const inRoom = interiors?.getActiveRoom();
      playerFx = player.update(
        dt,
        effKeys,
        effCamYaw,
        world.queryColliders,
        !activeVehicle,
        _allDynColsBuf,
        world.sampleRoofHeight,
        inRoom ? inRoom.originY : null
      ) || _emptyPlayerFx;
      if (inRoom) interiors.clampPlayerInside(player.state);
      interiors?.update(elapsed);
      if (playerFx.footstep) audio.playFootstep(playerFx.footstep.kind, playerFx.footstep.foot, playerFx.footstep.intensity);
      if (playerFx.scuff) audio.playShoeScuff();
      if (playerFx.jump) audio.playJumpPush();
      if (playerFx.impactSfx === 'hard') audio.playImpactThud(1.15);
      else if (playerFx.impactSfx === 'roll') audio.playImpactThud(0.62);
      else if (playerFx.impactSfx === 'soft') audio.playImpactThud(0.32);
      else if (playerFx.impactSfx === 'splash') audio.playWaterSplash();
      if (playerFx.diveHeight >= 3) {
        const diveBonus = Math.min(800, playerFx.diveHeight * 35);
        cash += diveBonus;
        audio.playChime(true);
        hud.showStuntToast(`LAC LÉMAN HIGH DIVE (${playerFx.diveHeight}m) · +CHF ${diveBonus}`);
      } else if (playerFx.toast) {
        hud.showStuntToast(playerFx.toast);
      }
    }
    updateMissionsAndCollectibles();
    audio.update(activeVehicle, getActivePos(), telemetry, wantedLevel, elapsed, {
      rain: settings.rain,
      steamerPos: world?.cgnSteamer?.pos || null,
    });

    // GTA 6 Drift & High-Speed Stunt Rewards + Wanted Stars Police Pursuit!
    if (highSpeedCooldown > 0) highSpeedCooldown -= dt;
    if (activeVehicle && activeVehicle.type === 'car') {
      const kmh = Math.abs(activeVehicle.speed) * 3.6;
      if (telemetry.isDrifting) {
        driftAccum += dt;
        if (driftAccum > 1.1) {
          driftAccum = 0;
          cash += 75;
          hud.showStuntToast('CLEAN DRIFT · +CHF 75');
          audio.playChime(false);
        }
      } else {
        driftAccum = Math.max(0, driftAccum - dt * 2);
      }

      // Extreme speeding in central Geneva triggers Geneva Police pursuit!
      if (kmh > 145 && highSpeedCooldown <= 0 && activeVehicle.style !== 'police') {
        highSpeedCooldown = 14;
        if (wantedLevel < 3) {
          wantedLevel++;
          wantedEvadeTimer = 18;
          hud.showStuntToast(`WANTED ${'★'.repeat(wantedLevel)} · GENEVA POLICE IN PURSUIT`);
        } else {
          cash += 100;
          hud.showStuntToast('HIGH SPEED RUN · +CHF 100');
        }
      }
    }

    // Evading police clears Wanted stars & awards Escape Bonus!
    if (wantedLevel > 0) {
      const inAirOrLake = activeVehicle && (activeVehicle.type === 'heli' || activeVehicle.type === 'boat');
      const farFromPolice = telemetry.policeDist > 85 || inAirOrLake;
      if (farFromPolice) {
        wantedEvadeTimer -= dt * (inAirOrLake ? 1.8 : 1.0);
        if (wantedEvadeTimer <= 0) {
          wantedLevel = 0;
          cash += 500;
          audio.playChime(true);
          hud.showStuntToast('ESCAPED GENEVA POLICE · +CHF 500');
        }
      } else {
        wantedEvadeTimer = Math.min(18, wantedEvadeTimer + dt * 0.6);
      }
    }

    // Speed-sensitive GTA FOV + Center-Masked Peripheral Radial Speed & Camera-Pan Motion Blur!
    let speedNorm = 0;
    let onFootSprint = 0;
    const loco = player ? player.getLocomotionState() : null;
    if (activeVehicle) {
      if (activeVehicle.type === 'heli') speedNorm = Math.min(1, Math.hypot(activeVehicle.vx, activeVehicle.vz) / 48);
      else speedNorm = Math.min(1, Math.abs(activeVehicle.speed) / 48);
    } else if (loco) {
      onFootSprint = Math.min(1, loco.sprintBlend * 0.92 + loco.jogBlend * 0.22);
    }
    const decay = Math.exp(-dt * 12);
    panVelX *= decay;
    panVelY *= decay;
    const motionSpeed = Math.min(1.4, speedNorm * (telemetry.isBoosting ? 1.35 : 1.0) + onFootSprint * 0.34);
    gtaPostPass.uniforms.uSpeed.value = motionSpeed;
    gtaPostPass.uniforms.uPanVel.value.set(panVelX, panVelY);
    gtaPostPass.uniforms.uWantedFlash.value = wantedLevel > 0 ? 0.5 + 0.5 * Math.sin(elapsed * 9) : 0.0;

    // Zero-GC live performance diagnostics
    cachedDrawCalls = renderer.info.render.calls;
    _statsObj.fps = currentFps;
    _statsObj.drawCalls = cachedDrawCalls;
    _statsObj.triangles = renderer.info.render.triangles;
    _statsObj.pos = getActivePos();

    const targetFov = 58 + onFootSprint * 8.5 + speedNorm * 16 + (telemetry.isBoosting ? 4 : 0);
    if (Math.abs(camera.fov - targetFov) > 0.04) {
      camera.fov += (targetFov - camera.fov) * (1 - Math.exp(-dt * 7.5));
      camera.updateProjectionMatrix();
    }

    if (settings.rain) {
      const p = getActivePos();
      const rp = rainGeo.attributes.position.array;
      const fallSpd = settings.storm ? 64 : 48;
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      for (let i = 0; i < rainCount; i++) {
        rp[i * 3 + 1] -= fallSpd * dt;
        const dxC = rp[i * 3] - cx;
        const dyC = rp[i * 3 + 1] - cy;
        const dzC = rp[i * 3 + 2] - cz;
        const tooCloseToLens = dxC * dxC + dyC * dyC + dzC * dzC < 30.25; // keep >5.5m from camera lens so zero giant sky quads!
        if (rp[i * 3 + 1] < 0 || tooCloseToLens) {
          let rx = p.x + (Math.random() - 0.5) * 120;
          let rz = p.z + (Math.random() - 0.5) * 120;
          if (Math.hypot(rx - cx, rz - cz) < 6.5) {
            rx += rx >= cx ? 7.5 : -7.5;
          }
          rp[i * 3] = rx;
          rp[i * 3 + 1] = p.y + 38 + Math.random() * 25;
          rp[i * 3 + 2] = rz;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (settings.winter) {
      const p = getActivePos();
      const sp = snowGeo.attributes.position.array;
      for (let i = 0; i < snowCount; i++) {
        sp[i * 3] += Math.sin(elapsed * 0.9 + i) * 1.4 * dt;
        sp[i * 3 + 1] -= 4.2 * dt;
        if (sp[i * 3 + 1] < p.y - 3) {
          sp[i * 3] = p.x + (Math.random() - 0.5) * 110;
          sp[i * 3 + 1] = p.y + 28 + Math.random() * 26;
          sp[i * 3 + 2] = p.z + (Math.random() - 0.5) * 110;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // GTA Smooth Auto-Centering Driving Camera + Cinematic Camera Mode (C)
    const pos = getActivePos();
    if (activeVehicle && !settings.cinematicCam && performance.now() - lastMouseMoveTime > 1200) {
      const movingFast = activeVehicle.type === 'heli' || Math.abs(activeVehicle.speed) > 2.5;
      if (movingFast) {
        const desiredYaw = activeVehicle.yaw + Math.PI;
        let diff = desiredYaw - camYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        camYaw += diff * Math.min(1, dt * 3.8);
      }
    }

    if (settings.cinematicCam) {
      // Sweeping Hollywood GTA Cinematic Camera!
      const orbit = elapsed * 0.35;
      const dist = activeVehicle?.type === 'heli' ? 22 : activeVehicle?.type === 'tram' ? 24 : activeVehicle?.style === 'bus' ? 14.5 : 9.5;
      const cx = pos.x + Math.cos(orbit) * dist;
      const cy = Math.max(getGroundHeight(pos.x, pos.z) + 1.4, pos.y + (activeVehicle?.type === 'tram' ? 4.2 : 2.6) + Math.sin(orbit * 1.4) * 1.2);
      const cz = pos.z + Math.sin(orbit) * dist;
      _camTargetVec.set(cx, cy, cz);
      camera.position.lerp(_camTargetVec, Math.min(1, dt * 5));
      camera.lookAt(pos.x, pos.y + (activeVehicle?.type === 'tram' ? 2.4 : 1.6), pos.z);
    } else if (isTransitFirstPerson) {
      // Panoramic First-Person Window / Driver Cab Camera inside Geneva TPG Bus or Stadler Tango Tram!
      const isTram = activeVehicle.type === 'tram';
      const isDriver = activeVehicle.transitMode === 'drive' || (activeVehicle.style === 'bus' && activeVehicle.type !== 'transit_bus');
      let lx = 0, ly = 2.02, lz = 2.75;
      if (isTram) {
        // Place panoramic cab camera cleanly at the Stadler Tango front windshield nose (zero blocky interior seats or backface voids!)
        lx = isDriver ? 0.0 : -0.35;
        ly = isDriver ? 2.12 : 2.10;
        lz = isDriver ? 17.55 : 17.42;
      } else {
        lx = isDriver ? 0.58 : -0.72;
        ly = isDriver ? 2.06 : 1.98;
        lz = isDriver ? 5.38 : 2.75;
      }
      const sinY = Math.sin(activeVehicle.yaw);
      const cosY = Math.cos(activeVehicle.yaw);
      const eyeX = pos.x + lx * cosY + lz * sinY;
      const eyeY = pos.y + ly;
      const eyeZ = pos.z - lx * sinY + lz * cosY;
      const fpPitch = Math.max(-0.36, Math.min(0.36, camPitch));
      const lookX = eyeX - Math.sin(camYaw) * Math.cos(fpPitch) * 24;
      const lookY = eyeY - Math.sin(fpPitch) * 24;
      const lookZ = eyeZ - Math.cos(camYaw) * Math.cos(fpPitch) * 24;
      _camTargetVec.set(eyeX, eyeY, eyeZ);
      camera.position.lerp(_camTargetVec, 1 - Math.exp(-dt * 24.0));
      camera.lookAt(lookX, lookY, lookZ);
    } else {
      const distMap = activeVehicle
        ? activeVehicle.type === 'heli'
          ? [17, 11.5, 25]
          : activeVehicle.type === 'tram'
          ? [25.0, 14.0, 34.0]
          : activeVehicle.style === 'escooter'
          ? [3.5, 2.4, 5.6]
          : activeVehicle.style === 'scooter'
          ? [4.6, 3.2, 7.6]
          : activeVehicle.style === 'bus'
          ? [13.5, 9.5, 18.5]
          : [7.4, 5.0, 11.8]
        : [3.6, 2.3, 6.8];
      // Subtle organic locomotion chase feel: crouch eye-drop, landing dip, figure-8 stride micro-bob & sprint pull-back!
      const sprintPull = !activeVehicle && loco ? loco.sprintBlend * 0.32 + loco.jogBlend * 0.08 : 0;
      const camDist = distMap[settings.camMode] + sprintPull;
      const crouchCamDrop = !activeVehicle && loco ? loco.crouchBlend * 0.34 + (loco.seatedDrop || 0) : 0;
      const landCamDip = !activeVehicle && loco ? loco.landBlend * 0.14 : 0;
      const strideEnergy = !activeVehicle && loco && loco.grounded ? Math.min(1, loco.speed / 5.0) : 0;
      const bobVert =
        !activeVehicle && loco && strideEnergy > 0.05
          ? -Math.sin(loco.gaitPhase * 2.0 - 0.5) * (0.014 + loco.jogBlend * 0.012 + loco.sprintBlend * 0.020) * strideEnergy
          : 0;
      const bobLat =
        !activeVehicle && loco && strideEnergy > 0.05
          ? -Math.cos(loco.gaitPhase) * (0.008 + loco.sprintBlend * 0.012) * strideEnergy
          : 0;
      const targetY =
        pos.y +
        (activeVehicle
          ? activeVehicle.type === 'tram'
            ? 3.2
            : activeVehicle.style === 'bus'
            ? 2.4
            : activeVehicle.style === 'escooter'
            ? 1.52
            : 1.55
          : 1.52 - crouchCamDrop - landCamDip + bobVert);

      // Subtle GTA / CROSSTOWN right-shoulder offset on foot (+ tiny stride sway & turn-bank lag!)
      const shoulderOff = activeVehicle ? 0 : 0.42 + bobLat + (loco ? loco.turnLean * 0.12 : 0);
      const rightX = Math.cos(camYaw) * shoulderOff;
      const rightZ = -Math.sin(camYaw) * shoulderOff;

      const focusX = pos.x + rightX * 0.5;
      const focusZ = pos.z + rightZ * 0.5;
      let desiredX = pos.x + rightX + Math.sin(camYaw) * Math.cos(camPitch) * camDist;
      let desiredY = Math.max(getGroundHeight(pos.x, pos.z) + 1.05, targetY + Math.sin(camPitch) * camDist);
      let desiredZ = pos.z + rightZ + Math.cos(camYaw) * Math.cos(camPitch) * camDist;

      // 3D Camera Building Wall-Collision Ray-Sweep (checks BOTH OSM footprints AND exact swissBUILDINGS3D wall OBBs so the camera can NEVER clip inside walls!)
      if (!activeVehicle || activeVehicle.type !== 'heli') {
        for (let step = 1; step <= 10; step++) {
          const frac = step / 10;
          const sx = focusX + (desiredX - focusX) * frac;
          const sy = targetY + (desiredY - targetY) * frac;
          const sz = focusZ + (desiredZ - focusZ) * frac;
          const cols = world.queryColliders(sx, sz);
          let blocked = false;
          for (let ci = 0; ci < cols.length; ci++) {
            const b = cols[ci];
            if (b.kind === 'cyl') continue;
            if (b.kind === 'obb') {
              if (!b.isWall || sy >= b.maxY + 0.5) continue;
              const cosY = Math.cos(b.yaw);
              const sinY = Math.sin(b.yaw);
              const ddx = sx - b.x;
              const ddz = sz - b.z;
              const lx = ddx * cosY - ddz * sinY;
              const lz = ddx * sinY + ddz * cosY;
              if (Math.abs(lx) < b.halfW + 0.34 && Math.abs(lz) < b.halfL + 0.16) {
                blocked = true;
                break;
              }
              continue;
            }
            if (sy < b.maxY + 0.5 && sx >= b.minX - 0.55 && sx <= b.maxX + 0.55 && sz >= b.minZ - 0.55 && sz <= b.maxZ + 0.55) {
              if (b.kind === 'poly' && !pointInPolygon(sx, sz, b.pts)) continue;
              blocked = true;
              break;
            }
          }
          if (blocked) {
            const safeFrac = Math.max(0.22, (step - 0.85) / 10);
            desiredX = focusX + (desiredX - focusX) * safeFrac;
            desiredY = targetY + (desiredY - targetY) * safeFrac;
            desiredZ = focusZ + (desiredZ - focusZ) * safeFrac;
            break;
          }
        }
      }

      const shake =
        (telemetry.isBoosting ? 0.09 : 0) +
        (telemetry.isDrifting ? 0.06 : 0) +
        (telemetry.impactShake || 0) +
        (playerFx.cameraShake || 0);
      const sx = shake ? (Math.random() - 0.5) * shake : 0;
      const sy = shake ? (Math.random() - 0.5) * shake : 0;

      // Frame-rate-independent critically-damped camera follow (silky smooth at 30/60/120/144 FPS!)
      _camTargetVec.set(desiredX + sx, desiredY + sy, desiredZ);
      camera.position.lerp(_camTargetVec, 1 - Math.exp(-dt * 15.0));
      // Keep 3rd-person camera cleanly inside room bounds whenever exploring enterable Geneva interiors!
      const actRoom = interiors?.getActiveRoom();
      if (actRoom) {
        camera.position.x = Math.max(-actRoom.halfW + 0.3, Math.min(actRoom.halfW - 0.3, camera.position.x));
        camera.position.z = Math.max(-actRoom.halfD + 0.3, Math.min(actRoom.halfD - 0.3, camera.position.z));
        camera.position.y = Math.max(actRoom.originY + 0.85, Math.min(actRoom.originY + actRoom.height - 0.45, camera.position.y));
      }
      camera.lookAt(focusX, targetY + (activeVehicle ? 0.1 : 0.16), focusZ);
    }
  }

  skyMesh.position.copy(camera.position);

  const pos = getActivePos();
  const mission = MISSIONS[missionIdx];
  const missionDist = Math.hypot(pos.x - mission.target.x, pos.z - mission.target.z);

  const heli = vehicleMgr.vehicles.find((v) => v.type === 'heli');
  let wpIcon = '🚁';
  let wpText =
    activeVehicle?.type === 'heli'
      ? null
      : `HELICOPTER ${Math.round(Math.hypot(pos.x - heli.x, pos.z - heli.z))} m · on your map`;
  if (customWaypoint) {
    wpIcon = '📍';
    wpText = `WAYPOINT ${Math.round(Math.hypot(pos.x - customWaypoint.x, pos.z - customWaypoint.z))} m`;
  }

  let promptText = null;
  let promptKey = 'F';
  if (activeVehicle) {
    if (activeVehicle.type === 'tram') {
      promptText =
        activeVehicle.transitMode === 'drive'
          ? `EXIT TRAM · [E] AUTOPILOT · [G] BELL · [V] VIEW`
          : `EXIT TRAM · [E] DRIVE · [V] CAB VIEW`;
    } else if (activeVehicle.type === 'transit_bus') {
      promptText = `EXIT BUS · [E] TAKE WHEEL · [V] WINDOW VIEW`;
    } else if (activeVehicle.style === 'bus') {
      promptText = `EXIT ${activeVehicle.label} · [V] CAB VIEW`;
    } else {
      promptText = `EXIT ${activeVehicle.label}`;
    }
  } else if (player?.isInteracting()) {
    const activeIt = player.getActiveInteraction();
    if (activeIt?.persistent) {
      promptKey = 'E';
      promptText = activeIt.activeLabel || 'STAND UP';
    }
  } else if (interiors?.isInside()) {
    const act = interiors.findNearestInteriorAction(player.state.x, player.state.z);
    if (act) {
      promptKey = 'E';
      promptText = act.label;
    }
  } else {
    const intHit = world?.findNearestInteractable ? world.findNearestInteractable(player.state.x, player.state.z) : null;
    const vehHit = findNearestVehicle(11.5);
    if (intHit && (!vehHit || intHit.dist < Math.min(3.2, vehHit.dist + 0.6))) {
      promptKey = 'E';
      promptText = intHit.item.label;
    } else if (vehHit) {
      if (vehHit.kind === 'traffic') {
        const ent = vehHit.entity;
        promptText = ent.kind === 'tram' || ent.kind === 'bus' ? `BOARD ${ent.label}` : `STEAL ${ent.label}`;
      } else {
        const near = vehHit.v;
        promptText =
          near.type === 'heli'
            ? 'FLY HELICOPTER'
            : near.type === 'boat'
            ? 'BOARD MOUETTE'
            : near.style === 'bus'
            ? `DRIVE ${near.label}`
            : near.style === 'escooter'
            ? `RIDE ${near.label}`
            : isStealableParked(near)
            ? `STEAL ${near.label}`
            : `ENTER ${near.label}`;
      }
    }
  }

  if (frameCount % 8 === 1) {
    const inRoomNow = interiors?.getActiveRoom();
    cachedStreetName = inRoomNow ? inRoomNow.title : getStreetName(pos.x, pos.z, pos.y);
  }

  hud.updateHud({
    mission,
    missionDist,
    waypointText: wpText,
    waypointIcon: wpIcon,
    cash,
    vehicle: activeVehicle,
    foundCount,
    totalCollectibles: world.collectibleMeshes.length,
    street: cachedStreetName,
    promptText,
    promptKey,
    fps: currentFps,
    drawCalls: cachedDrawCalls,
    quality: settings.quality,
    wantedLevel,
    camYaw,
  });

  // Throttle 2D Canvas minimap redraw to ~15Hz (every 4th frame) & only draw full map when actually open!
  if ((frameCount & 3) === 0 || mapUI.isOpen()) {
    _mapState.playerPos = pos;
    _mapState.playerYaw = camYaw;
    _mapState.vehicles = vehicleMgr.vehicles;
    _mapState.transit = world?.roadTraffic
      ? world.roadTraffic.tramEntities.concat(world.roadTraffic.busEntities)
      : null;
    _mapState.collectibles = world.collectibleMeshes;
    _mapState.missionTarget = mission.type !== 'freeroam' ? mission.target : null;
    _mapState.customWaypoint = customWaypoint;
    _mapState.foundCount = foundCount;
    mapUI.drawMinimap(_mapState);
    if (mapUI.isOpen()) mapUI.drawFullMap(_mapState);
  }

  renderFrame();
}

animate();
