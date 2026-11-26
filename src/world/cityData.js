// 1:1 Real Geneva Geospatial Engine (Swiss LV95 metric coordinates)
// +X = East (exact meters), +Z = South (exact meters)
// Origin (0,0) = 46.2060° N, 6.1500° E (Rade de Genève)

export let WORLD_BOUNDS = {
  minX: -706.5,
  maxX: 860.7,
  minZ: -708.6,
  maxZ: 711.0,
};

export const SPAWNS = {
  rade: {
    name: 'Rade & Jardin Anglais',
    x: -10,
    z: 148,
    yaw: 0.74,
  },
  vieilleville: {
    name: 'Vieille-Ville',
    x: -42,
    z: 598,
    yaw: -0.6,
  },
  paquis: {
    name: "Pâquis & Jet d'Eau",
    x: -78,
    z: -215,
    yaw: 2.35,
  },
  bastions: {
    name: 'Place de Neuve & Bastions',
    x: -512,
    z: 495,
    yaw: 0.7,
  },
  bains: {
    name: 'Bains des Pâquis',
    x: 422,
    z: -512,
    yaw: 1.24,
  },
};

// All vehicles precisely parallel-parked along real OSM Geneva curbs (0.0° road-tangent alignment, zero lane/crosswalk blocking!)
export const VEHICLE_SPAWNS = {
  cars: [
    // Quai du Général-Guisan & Jardin Anglais curated curb lineup (cleanly outside AI traffic lanes!)
    { id: 'vespa_1',   label: 'GENEVA VESPA',       x: -4.9,   z: 151.9,  yaw: 0.64,  color: 0xc91418, style: 'scooter', maxSpeed: 32 },
    { id: 'coupe_red', label: 'FERRARI 458',        x: 14.0,   z: 159.2,  yaw: -2.48, color: 0xc91a1a, style: 'coupe',   maxSpeed: 52 },
    { id: 'charger_1', label: 'DODGE CHARGER SRT',  x: 13.0,   z: 174.6,  yaw: 0.66,  color: 0x262c34, style: 'charger', maxSpeed: 54 },
    { id: 'porsche_1', label: 'PORSCHE 911 GT3',    x: 29.2,   z: 178.8,  yaw: -2.48, color: 0xe6b800, style: 'porsche', maxSpeed: 56 },
    { id: 'gwagon_1',  label: 'MERCEDES G-WAGON',   x: 28.4,   z: 194.2,  yaw: 0.66,  color: 0xf4f6f9, style: 'gwagon',  maxSpeed: 42 },
    // Pâquis & Quai du Mont-Blanc (right beside Pâquis spawn!)
    { id: 'rs6_1',     label: 'AUDI RS6 AVANT',     x: -85.9,  z: -208.0, yaw: 2.46,  color: 0x5c6470, style: 'rs6',     maxSpeed: 50 },
    { id: 'police_1',  label: 'GENEVA POLICE',      x: -124.8, z: -176.1, yaw: -0.67, color: 0xf1f3f5, style: 'police',  maxSpeed: 50 },
    // Rue du Rhône / Place du Molard
    { id: 'taxi_1',    label: 'GENEVA TAXI',        x: -105.7, z: 227.3,  yaw: -1.89, color: 0xf5b700, style: 'taxi',    maxSpeed: 40 },
    // Place de Neuve & Bastions (right beside Bastions spawn!)
    { id: 'sedan_1',   label: 'SWISS LUXURY SEDAN', x: -496.1, z: 517.8,  yaw: 1.17,  color: 0xbcc4cf, style: 'sedan',   maxSpeed: 44 },
    // Vieille-Ville (right near Bourg-de-Four / Rue Verdaine spawn!)
    { id: 'vieille_1', label: 'PORSCHE 911 SILVER', x: -29.3,  z: 558.5,  yaw: 2.43,  color: 0xd6dce4, style: 'porsche', maxSpeed: 56 },
    // 9 Ridable Geneva Electric Trottinettes (Tier Purple, Voi Coral & Lime Green neatly parked on dry sidewalks!)
    { id: 'trot_1', label: 'TIER E-SCOOTER', x: -2.4, z: 159.4, yaw: 2.05, color: 0x7b4ce2, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_2', label: 'VOI E-SCOOTER',  x: 9.2,  z: 174.6, yaw: -0.85, color: 0xf26522, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_3', label: 'LIME E-SCOOTER', x: 40.0, z: 162.0, yaw: 1.3,  color: 0x26b85c, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_4', label: 'VOI E-SCOOTER',  x: -42.0, z: 156.0, yaw: 0.4, color: 0xf26522, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_5', label: 'TIER E-SCOOTER', x: -92.0, z: 154.0, yaw: 1.9, color: 0x7b4ce2, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_6', label: 'LIME E-SCOOTER', x: -132.0, z: -135.0, yaw: 0.8, color: 0x26b85c, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_7', label: 'VOI E-SCOOTER',  x: -68.0, z: -225.0, yaw: -1.1, color: 0xf26522, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_8', label: 'TIER E-SCOOTER', x: 72.0, z: 195.0, yaw: 0.25, color: 0x7b4ce2, style: 'escooter', maxSpeed: 12.5 },
    { id: 'trot_9', label: 'LIME E-SCOOTER', x: 102.0, z: 192.0, yaw: -1.5, color: 0x26b85c, style: 'escooter', maxSpeed: 12.5 },
  ],
  bus: { id: 'tpg_bus_25', label: 'TPG BUS · LIGNE 25', x: 77.4, z: 228.2, yaw: -2.16, maxSpeed: 28 },
  boat: { id: 'mouette_1', label: 'MOUETTE BOAT', x: 68, z: 72, yaw: 1.1 },
  heli: { id: 'heli_1', label: 'SWISS HELICOPTER', x: 112, z: 166, yaw: 0.9 },
};

export const LANDMARKS = [
  { id: 'jetdeau', name: "Jet d'Eau", x: 457.8, z: -147.0, type: 'landmark' },
  { id: 'pont', name: 'Pont du Mont-Blanc', x: -102.0, z: 4.0, type: 'bridge' },
  { id: 'jardin', name: 'Jardin Anglais & Horloge Fleurie', x: 139.4, z: 208.0, type: 'park' },
  { id: 'molard', name: 'Place du Molard & Tour du Molard', x: -150.4, z: 245.0, type: 'landmark' },
  { id: 'brunswick', name: 'Monument Brunswick (Square des Alpes)', x: -75.5, z: -274.6, type: 'landmark' },
  { id: 'cathedral', name: 'Cathédrale Saint-Pierre', x: -123.1, z: 540.5, type: 'landmark' },
  { id: 'rousseau', name: 'Île Rousseau & Pont des Bergues', x: -166.6, z: -4.0, type: 'park' },
  { id: 'paquis', name: 'Bains des Pâquis & Phare', x: 571.1, z: -463.1, type: 'landmark' },
  { id: 'neuve', name: 'Place de Neuve & Grand Théâtre', x: -511.9, z: 523.7, type: 'landmark' },
  { id: 'reformateurs', name: 'Mur des Réformateurs (Bastions)', x: -325.4, z: 636.7, type: 'landmark' },
  { id: 'bourg', name: 'Place du Bourg-de-Four', x: -77.1, z: 632.4, type: 'landmark' },
  { id: 'helipad', name: 'Jardin Anglais Helipad', x: 112.0, z: 166.0, type: 'heli' },
  { id: 'mouette', name: 'Mouette Dock (Jardin Anglais)', x: 68.0, z: 72.0, type: 'boat' },
];

export const COLLECTIBLES = [
  { id: 1, name: 'Horloge Fleurie Chrono', x: 139.4, z: 208.0, yOffset: 1.4 },
  { id: 2, name: 'Pont du Mont-Blanc Crest', x: -102.0, z: 4.0, yOffset: 1.4 },
  { id: 3, name: 'Île Rousseau Statue', x: -181.3, z: -8.5, yOffset: 1.4 },
  { id: 4, name: "Jet d'Eau Jetée Tip", x: 457.8, z: -147.0, yOffset: 1.4 },
  { id: 5, name: 'Phare des Pâquis', x: 571.1, z: -463.1, yOffset: 1.4 },
  { id: 6, name: 'Cathédrale Saint-Pierre', x: -115.0, z: 506.0, yOffset: 1.4 },
  { id: 7, name: 'Place du Bourg-de-Four', x: -18.5, z: 655.7, yOffset: 1.4 },
  { id: 8, name: 'Place du Molard', x: -158.0, z: 335.0, yOffset: 1.4 },
  { id: 9, name: 'Quai du Mont-Blanc Rotonde', x: 16.0, z: -275.0, yOffset: 1.4 },
  { id: 10, name: 'Place de Neuve · Grand Théâtre', x: -517.6, z: 491.8, yOffset: 1.4 },
  { id: 11, name: 'Rues-Basses Rooftop (Heli)', x: -85.0, z: 255.0, yOffset: 26.0 },
  { id: 12, name: "Jet d'Eau Sky Ring (Heli)", x: 457.8, z: -147.0, yOffset: 92.0 },
];

export const MISSIONS = [
  {
    tag: 'JOB 01',
    title: 'Get in the Alpine coupe',
    sub: 'Red coupe, by Jardin Anglais',
    type: 'enter_vehicle',
    vehicleId: 'coupe_red',
    target: { x: 14.0, z: 159.2 },
    reward: 250,
    subtitle: 'Dispatcher: Welcome to 1:1 Geneva. Take the red Alpine coupe by Jardin Anglais.',
  },
  {
    tag: 'JOB 02',
    title: 'Cross Pont du Mont-Blanc',
    sub: 'Drive north across Lac Léman to Quai du Mont-Blanc',
    type: 'reach',
    target: { x: -112, z: -185 },
    radius: 34,
    reward: 500,
    subtitle: 'Dispatcher: Head northwest over Pont du Mont-Blanc toward Quai du Mont-Blanc.',
  },
  {
    tag: 'JOB 03',
    title: 'Board the Mouette water taxi',
    sub: 'Yellow Mouette docked off Jardin Anglais',
    type: 'enter_vehicle',
    vehicleId: 'mouette_1',
    target: { x: 68, z: 72 },
    reward: 600,
    subtitle: "Dispatcher: Head back to Jardin Anglais pier and take a yellow Mouette across the Rade.",
  },
  {
    tag: 'JOB 04',
    title: "Fly past the 140m Jet d'Eau",
    sub: 'Take off in the Swiss Rescue Helicopter at Jardin Anglais',
    type: 'reach_air',
    target: { x: 457.8, z: -147.0, y: 78 },
    radius: 52,
    reward: 1500,
    subtitle: "Dispatcher: The Swiss Rescue Helicopter is waiting in Jardin Anglais. Climb up to the Jet d'Eau!",
  },
  {
    tag: 'FREE ROAM',
    title: 'Explore 1:1 Geneva',
    sub: 'Discover all 12 Swiss chronometers across real Geneva',
    type: 'freeroam',
    target: { x: -123.1, z: 540.5 },
    reward: 0,
    subtitle: 'Dispatcher: All of central Geneva is yours. Press Tab anytime for the Swiss topographic map.',
  },
];

// Runtime 1:1 elevation grid, pixel-accurate water mask & named road lookup
let elevData = null;
let waterMask = null;
const MASK_RES = 512;
let namedRoadSegments = [];
let osmBridgeSegments = [];

export function distToSegment(px, pz, x1, z1, x2, z2) {
  const vx = x2 - x1;
  const vz = z2 - z1;
  const wx = px - x1;
  const wz = pz - z1;
  const c1 = vx * wx + vz * wz;
  if (c1 <= 0) return Math.hypot(px - x1, pz - z1);
  const c2 = vx * vx + vz * vz;
  if (c2 <= c1) return Math.hypot(px - x2, pz - z2);
  const t = c1 / c2;
  return Math.hypot(px - (x1 + t * vx), pz - (z1 + t * vz));
}

export function initRealGenevaData(data, mapImage) {
  if (data.boundsMeters) WORLD_BOUNDS = data.boundsMeters;
  elevData = data.elevation || null;

  // Build spatial array of named OSM roads for real 1:1 street name HUD + all OSM water bridges (Ponts de l'Île, etc.)!
  namedRoadSegments = [];
  osmBridgeSegments = [];
  for (const r of data.roads || []) {
    if (!r.p || r.p.length < 2) continue;
    const hw = (r.w || 7.5) * 0.5 + 2.6;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [x1, z1] = r.p[i];
      const [x2, z2] = r.p[i + 1];
      if (r.n) namedRoadSegments.push({ x1, z1, x2, z2, n: r.n, br: r.br });
      if (r.br && !(r.n && /Mont-Blanc/.test(r.n))) {
        osmBridgeSegments.push({ x1, z1, x2, z2, hw, n: r.n || '' });
      }
    }
  }

  // Extract 1:1 pixel-accurate water mask from official swisstopo map (geneva-map.jpg)
  if (mapImage) {
    const c = document.createElement('canvas');
    c.width = MASK_RES;
    c.height = MASK_RES;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(mapImage, 0, 0, MASK_RES, MASK_RES);
    const img = ctx.getImageData(0, 0, MASK_RES, MASK_RES).data;

    // First identify Swiss map cyan-blue water pixels
    const rawBlue = new Uint8Array(MASK_RES * MASK_RES);
    for (let i = 0; i < MASK_RES * MASK_RES; i++) {
      const r = img[i * 4];
      const g = img[i * 4 + 1];
      const b = img[i * 4 + 2];
      // swisstopo pixelkarte water blue is roughly rgb(170..210, 215..245, 240..255)
      if (b > 215 && g > 195 && b - r > 24 && r < 215) {
        rawBlue[i] = 1;
      }
    }

    // Also include text/label pixels completely surrounded by blue water (robust 5-px closing pass for map labels!)
    const closed = new Uint8Array(rawBlue);
    for (let y = 5; y < MASK_RES - 5; y++) {
      for (let x = 5; x < MASK_RES - 5; x++) {
        const idx = y * MASK_RES + x;
        if (rawBlue[idx]) continue;
        // If blue on both left/right and top/bottom within 5px, it's just a map text label ("Genève-Molard (lac)") over water!
        const horiz = (rawBlue[idx - 3] || rawBlue[idx - 4] || rawBlue[idx - 5]) &&
                      (rawBlue[idx + 3] || rawBlue[idx + 4] || rawBlue[idx + 5]);
        const vert = (rawBlue[idx - 3 * MASK_RES] || rawBlue[idx - 4 * MASK_RES] || rawBlue[idx - 5 * MASK_RES]) &&
                     (rawBlue[idx + 3 * MASK_RES] || rawBlue[idx + 4 * MASK_RES] || rawBlue[idx + 5 * MASK_RES]);
        if (horiz && vert) closed[idx] = 1;
      }
    }

    // Automatically extract ALL connected real Geneva water basins (>= 18 px):
    // Main Lac Léman, Lac Léman north of Bains des Pâquis, Genève-Molard, Île Rousseau channels,
    // AND every bridge-divided channel of the Rhône river (Pont des Bergues, Pont de la Machine, Ponts de l'Île, Quai de la Poste)!
    waterMask = new Uint8Array(MASK_RES * MASK_RES);
    const seenWater = new Uint8Array(MASK_RES * MASK_RES);
    const wComp = [];
    for (let i = 0; i < MASK_RES * MASK_RES; i++) {
      if (!closed[i] || seenWater[i]) continue;
      wComp.length = 0;
      seenWater[i] = 1;
      wComp.push(i);
      let head = 0;
      while (head < wComp.length) {
        const cur = wComp[head++];
        const cx = cur % MASK_RES;
        const cy = (cur / MASK_RES) | 0;
        if (cx > 0 && closed[cur - 1] && !seenWater[cur - 1]) { seenWater[cur - 1] = 1; wComp.push(cur - 1); }
        if (cx < MASK_RES - 1 && closed[cur + 1] && !seenWater[cur + 1]) { seenWater[cur + 1] = 1; wComp.push(cur + 1); }
        if (cy > 0 && closed[cur - MASK_RES] && !seenWater[cur - MASK_RES]) { seenWater[cur - MASK_RES] = 1; wComp.push(cur - MASK_RES); }
        if (cy < MASK_RES - 1 && closed[cur + MASK_RES] && !seenWater[cur + MASK_RES]) { seenWater[cur + MASK_RES] = 1; wComp.push(cur + MASK_RES); }
      }
      if (wComp.length >= 18) {
        for (let k = 0; k < wComp.length; k++) waterMask[wComp[k]] = 1;
      }
    }

    // Connected-components hole-filler: eliminate map labels ("Genève-Jardin-Anglais (lac)"), ferry lines & buoys
    // trapped inside Lac Léman so zero fake dirt pyramids poke out of the water!
    // Protect real Geneva islands: Île Rousseau (-181, -8) AND L'Île / Pont de la Machine islands (x < -340, 15 < z < 165)!
    const visited = new Uint8Array(MASK_RES * MASK_RES);
    const [irPx, irPy] = worldToMaskPx(-181.3, -8.5);
    const [ileMinPx, ileMinPy] = worldToMaskPx(-660, 15);
    const [ileMaxPx, ileMaxPy] = worldToMaskPx(-340, 165);
    const comp = [];
    for (let i = 0; i < MASK_RES * MASK_RES; i++) {
      if (waterMask[i] || visited[i]) continue;
      comp.length = 0;
      visited[i] = 1;
      comp.push(i);
      let touchesBorder = false;
      let isRealIsland = false;
      let ptr = 0;
      while (ptr < comp.length) {
        const cur = comp[ptr++];
        const cx = cur % MASK_RES;
        const cy = (cur / MASK_RES) | 0;
        if (cx === 0 || cx === MASK_RES - 1 || cy === 0 || cy === MASK_RES - 1) touchesBorder = true;
        if (Math.hypot(cx - irPx, cy - irPy) < 14) isRealIsland = true;
        if (cx >= ileMinPx && cx <= ileMaxPx && cy >= ileMinPy && cy <= ileMaxPy) isRealIsland = true;
        const nbs = [
          cx > 0 ? cur - 1 : -1,
          cx < MASK_RES - 1 ? cur + 1 : -1,
          cy > 0 ? cur - MASK_RES : -1,
          cy < MASK_RES - 1 ? cur + MASK_RES : -1,
        ];
        for (const nb of nbs) {
          if (nb >= 0 && !waterMask[nb] && !visited[nb]) {
            visited[nb] = 1;
            comp.push(nb);
          }
        }
      }
      // Fill any isolated non-water map-label / ferry-line island inside Lac Léman & Genève-Molard (< 950 px) except real islands!
      if (!touchesBorder && !isRealIsland && comp.length < 950) {
        for (let k = 0; k < comp.length; k++) waterMask[comp[k]] = 1;
      }
    }
  }
}

function worldToMaskPx(x, z) {
  const u = (x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  const v = (z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ);
  return [Math.floor(u * MASK_RES), Math.floor(v * MASK_RES)];
}

export function clampToWorld(x, z) {
  const pad = 18;
  return {
    x: Math.max(WORLD_BOUNDS.minX + pad, Math.min(WORLD_BOUNDS.maxX - pad, x)),
    z: Math.max(WORLD_BOUNDS.minZ + pad, Math.min(WORLD_BOUNDS.maxZ - pad, z)),
  };
}

// Exact 1:1 LV95 geometry & smooth C1 sinusoidal arch curve for Pont du Mont-Blanc!
export const PMB_START = { x: -30.5, z: 118.5 };
export const PMB_END = { x: -173.9, z: -105.4 };

export function projectPontMontBlanc(x, z) {
  const vx = PMB_END.x - PMB_START.x;
  const vz = PMB_END.z - PMB_START.z;
  const len2 = vx * vx + vz * vz;
  const len = Math.sqrt(len2);
  const t = ((x - PMB_START.x) * vx + (z - PMB_START.z) * vz) / len2;
  const px = PMB_START.x + vx * t;
  const pz = PMB_START.z + vz * t;
  const lat = Math.hypot(x - px, z - pz);
  return { t, lat, len };
}

export function getPontMontBlancDeckY(t) {
  const tc = Math.max(0, Math.min(1, t));
  // Smooth real-world arch rising gently from 1.65m at BOTH quays to 2.90m mid-span (zero cliff or ski-jump step!)
  return 1.65 + 1.25 * Math.sin(Math.PI * tc);
}

// Solid stone jetties whose terrain should remain above water (unlike open bridges where water flows underneath!)
export function isSolidJetty(x, z) {
  // Jetée des Eaux-Vives (to Jet d'Eau)
  if (distToSegment(x, z, 558, 25, 457.8, -147.0) < 10.5) return true;
  if (Math.hypot(x - 457.8, z - -147.0) < 16) return true;
  // Bains des Pâquis Jetty, Expanded Bathing Pier & Lighthouse
  if (distToSegment(x, z, 280, -560, 571.1, -463.1) < 12) return true;
  if (distToSegment(x, z, 392, -522, 502, -485) < 18.0) return true;
  return false;
}

// Keep Pont du Mont-Blanc, Pont des Bergues, Ponts de l'Île, Jetée des Eaux-Vives & Bains des Pâquis always drivable/walkable
export function isOnBridgeOrPier(x, z) {
  // Pont du Mont-Blanc exact 24m wide LV95 deck + smooth shore abutments
  const pmb = projectPontMontBlanc(x, z);
  if (pmb.t >= -0.025 && pmb.t <= 1.025 && pmb.lat < 13.0) return true;
  // Pont des Bergues + iconic spur footbridge onto Île Rousseau!
  if (distToSegment(x, z, -264, 108, -220, -68) < 7.5) return true;
  if (distToSegment(x, z, -241, 14, -184, -4) < 3.6) return true;
  // Solid lakefront jetties
  if (isSolidJetty(x, z)) return true;
  // Débarcadère Genève-Molard wooden Mouette ferry pier (walkable over the water!)
  if (Math.abs(x - -118) < 3.4 && z >= 84 && z <= 122) return true;
  // All real OSM bridges (Ponts de l'Île north/south spans, etc.)!
  for (let i = 0; i < osmBridgeSegments.length; i++) {
    const s = osmBridgeSegments[i];
    if (distToSegment(x, z, s.x1, s.z1, s.x2, s.z2) < s.hw) return true;
  }
  return false;
}

export function isNearWaterMask(x, z, radiusMeters = 18) {
  if (!waterMask) return false;
  const [px, py] = worldToMaskPx(x, z);
  const rPx = Math.max(1, Math.ceil((radiusMeters / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * MASK_RES));
  for (let dy = -rPx; dy <= rPx; dy++) {
    const ny = py + dy;
    if (ny < 0 || ny >= MASK_RES) continue;
    for (let dx = -rPx; dx <= rPx; dx++) {
      const nx = px + dx;
      if (nx < 0 || nx >= MASK_RES) continue;
      if (waterMask[ny * MASK_RES + nx] === 1) return true;
    }
  }
  return false;
}

export function isWater(x, z) {
  if (isOnBridgeOrPier(x, z)) return false;
  if (!waterMask) return false;
  const [px, py] = worldToMaskPx(x, z);
  if (px < 0 || px >= MASK_RES || py < 0 || py >= MASK_RES) return false;
  return waterMask[py * MASK_RES + px] === 1;
}

export function getRawWaterMask(x, z) {
  if (!waterMask) return false;
  const [px, py] = worldToMaskPx(x, z);
  if (px < 0 || px >= MASK_RES || py < 0 || py >= MASK_RES) return false;
  return waterMask[py * MASK_RES + px] === 1;
}

// Bilinear interpolation of real swisstopo ALTI3D elevation with seamless Pont du Mont-Blanc arch blending
export function getGroundHeight(x, z) {
  const pmb = projectPontMontBlanc(x, z);
  if (pmb.t >= -0.025 && pmb.t <= 1.025 && pmb.lat < 13.0) {
    return getPontMontBlancDeckY(pmb.t);
  }
  if (isOnBridgeOrPier(x, z)) {
    // Wooden Débarcadère Genève-Molard pier deck
    if (Math.abs(x - -118) < 3.4 && z >= 84 && z <= 112) return 1.14;
    return 1.7;
  }
  if (isWater(x, z)) return 0.0;
  if (!elevData) return 1.8;

  const u = Math.max(0, Math.min(1, (x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)));
  const v = Math.max(0, Math.min(1, (z - WORLD_BOUNDS.minZ) / (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)));
  const gx = u * (elevData.nx - 1);
  const gz = v * (elevData.nz - 1);
  const ix = Math.min(elevData.nx - 2, Math.floor(gx));
  const iz = Math.min(elevData.nz - 2, Math.floor(gz));
  const fx = gx - ix;
  const fz = gz - iz;

  const g = elevData.grid;
  const h00 = g[iz][ix];
  const h10 = g[iz][ix + 1];
  const h01 = g[iz + 1][ix];
  const h11 = g[iz + 1][ix + 1];

  const hTop = h00 + (h10 - h00) * fx;
  const hBot = h01 + (h11 - h01) * fx;
  const asl = hTop + (hBot - hTop) * fz;

  // Lac Léman surface is 372.0m ASL; land quays sit cleanly at >= 1.55m above water
  const landH = Math.max(1.55, asl - elevData.lakeLevel + 0.5);
  // Smooth lateral apron blend right beside Pont du Mont-Blanc shore abutments (zero torn triangles!)
  if (pmb.t >= -0.06 && pmb.t <= 1.06 && pmb.lat < 22.0) {
    const blend = Math.max(0, Math.min(1, (pmb.lat - 13.0) / 9.0));
    const smooth = blend * blend * (3 - 2 * blend);
    return getPontMontBlancDeckY(pmb.t) * (1 - smooth) + landH * smooth;
  }
  return landH;
}

// Real 1:1 OSM street name lookup for the HUD!
export function getStreetName(x, z, y = 2) {
  if (y > 38) return 'GENEVA AIRSPACE · LAC LÉMAN';
  if (Math.hypot(x - 457.8, z - -147.0) < 35) return "JET D'EAU · JETÉE DES EAUX-VIVES";
  if (distToSegment(x, z, 375, -528, 520, -478) < 42) return 'BAINS DES PÂQUIS · PLAGE & BUVETTE';
  if (Math.hypot(x - 571.1, z - -463.1) < 55) return 'BAINS DES PÂQUIS · LE PHARE';
  if (Math.hypot(x - -181.3, z - -8.5) < 32) return 'ÎLE ROUSSEAU';
  if (isWater(x, z)) return x < -220 ? 'LE RHÔNE · GENÈVE' : 'LAC LÉMAN · LA RADE DE GENÈVE';

  let bestName = null;
  let bestDist = 42;
  for (let i = 0; i < namedRoadSegments.length; i++) {
    const s = namedRoadSegments[i];
    // Fast bbox pre-check
    if (
      x < Math.min(s.x1, s.x2) - bestDist ||
      x > Math.max(s.x1, s.x2) + bestDist ||
      z < Math.min(s.z1, s.z2) - bestDist ||
      z > Math.max(s.z1, s.z2) + bestDist
    ) {
      continue;
    }
    const d = distToSegment(x, z, s.x1, s.z1, s.x2, s.z2);
    if (d < bestDist) {
      bestDist = d;
      bestName = s.n;
    }
  }
  if (bestName) return bestName.toUpperCase();
  return z > 350 ? 'VIEILLE-VILLE · GENÈVE' : z < -100 ? 'RIVE DROITE · GENÈVE' : 'RIVE GAUCHE · GENÈVE';
}
