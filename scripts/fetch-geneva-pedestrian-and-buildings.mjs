import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../public/data');
fs.mkdirSync(dataDir, { recursive: true });

// Exact swisstopo WGS84 -> LV95 (EPSG:2056) conversion matching geneva-1to1.json
function wgs84ToLv95(lat, lon) {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lam = (lon * 3600 - 26782.5) / 10000;
  const E =
    2600072.37 +
    211455.93 * lam -
    10938.51 * lam * phi -
    0.36 * lam * phi * phi -
    44.54 * lam * lam * lam;
  const N =
    1200147.07 +
    308807.95 * phi +
    3745.25 * lam * lam +
    76.63 * phi * phi -
    194.56 * lam * lam * phi +
    119.79 * phi * phi * phi;
  return [E, N];
}

const ORIGIN = { lat: 46.2060, lon: 6.1500 };
const [ORIGIN_E, ORIGIN_N] = wgs84ToLv95(ORIGIN.lat, ORIGIN.lon);

const BBOX = {
  south: 46.1995,
  west: 6.1410,
  north: 46.2125,
  east: 6.1610,
};

function toLocal(lat, lon) {
  const [E, N] = wgs84ToLv95(lat, lon);
  return [
    Math.round((E - ORIGIN_E) * 100) / 100,
    Math.round(-(N - ORIGIN_N) * 100) / 100,
  ];
}

const ENDPOINTS = [
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function queryOverpass(query, label) {
  for (const url of ENDPOINTS) {
    console.log(`[Overpass:${label}] Querying ${url}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'GenevaOpenWorld1to1/2.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`  HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`  Failed: ${err.message}`);
    }
  }
  throw new Error(`All Overpass endpoints failed for ${label}`);
}

async function main() {
  const bb = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;

  // 1. Fetch ALL 1:1 real Geneva pedestrian zones: footways, sidewalks, pedestrian plazas/areas,
  //    steps, park paths, cycleways, squares, and drinking fountains!
  const pedQuery = `
[out:json][timeout:45];
(
  way["highway"~"^(footway|pedestrian|path|steps|cycleway)$"](${bb});
  way["area:highway"~"^(pedestrian|footway)$"](${bb});
  way["place"="square"](${bb});
  way["leisure"~"^(park|garden|pitch)$"](${bb});
  way["landuse"~"^(grass|meadow|village_green)$"](${bb});
  node["amenity"="drinking_water"](${bb});
  node["amenity"="fountain"](${bb});
  node["amenity"="cafe"](${bb});
  node["amenity"="restaurant"](${bb});
);
out body;
>;
out skel qt;
`;

  const rawPed = await queryOverpass(pedQuery, 'pedestrian');
  const nodeMap = new Map();
  for (const el of rawPed.elements || []) {
    if (el.type === 'node') nodeMap.set(el.id, el);
  }

  const footways = [];
  const pedestrianPlazas = [];
  const steps = [];
  const cycleways = [];
  const lawns = [];
  const drinkingFountains = [];
  const cafes = [];

  for (const el of rawPed.elements || []) {
    if (el.type === 'node' && el.tags) {
      const [x, z] = toLocal(el.lat, el.lon);
      const t = el.tags;
      if (t.amenity === 'drinking_water' || t.amenity === 'fountain') {
        drinkingFountains.push({ x, z, name: t.name || '' });
      } else if (t.amenity === 'cafe' || t.amenity === 'restaurant') {
        if (t.outdoor_seating === 'yes' || t.amenity === 'cafe') {
          cafes.push({ x, z, name: t.name || '', outdoor: t.outdoor_seating === 'yes' ? 1 : 0 });
        }
      }
      continue;
    }
    if (el.type !== 'way' || !el.tags || !el.nodes || el.nodes.length < 2) continue;
    const pts = [];
    for (const nid of el.nodes) {
      const n = nodeMap.get(nid);
      if (n) pts.push(toLocal(n.lat, n.lon));
    }
    if (pts.length < 2) continue;
    const t = el.tags;
    const isClosed =
      el.nodes.length >= 4 && el.nodes[0] === el.nodes[el.nodes.length - 1];

    if (
      isClosed &&
      (t.area === 'yes' ||
        t['area:highway'] === 'pedestrian' ||
        t['area:highway'] === 'footway' ||
        t.place === 'square')
    ) {
      pedestrianPlazas.push({
        p: pts.slice(0, -1),
        n: t.name || '',
        s: t.surface || '',
      });
    } else if (
      isClosed &&
      (t.landuse === 'grass' || t.landuse === 'meadow' || t.landuse === 'village_green')
    ) {
      lawns.push({ p: pts.slice(0, -1), n: t.name || '' });
    } else if (t.highway === 'steps') {
      steps.push({
        p: pts,
        w: parseFloat(t.width) || 2.8,
        n: t.name || '',
        c: parseInt(t.step_count || '0', 10) || 0,
      });
    } else if (t.highway === 'cycleway') {
      cycleways.push({
        p: pts,
        w: parseFloat(t.width) || 2.2,
        n: t.name || '',
      });
    } else if (t.highway === 'footway' || t.highway === 'path' || t.highway === 'pedestrian') {
      // Skip indoor or underground tunnels/passages
      if (t.indoor === 'yes' || (t.tunnel && t.tunnel !== 'no') || parseInt(t.layer || '0', 10) < 0) continue;
      footways.push({
        p: pts,
        w: parseFloat(t.width) || (t.highway === 'pedestrian' ? 5.5 : t.footway === 'sidewalk' ? 2.6 : t.footway === 'crossing' ? 3.2 : 2.8),
        k: t.footway || t.highway,
        s: t.surface || '',
        n: t.name || '',
        br: t.bridge === 'yes' ? 1 : 0,
      });
    }
  }

  const pedOut = {
    source: 'OSM Overpass API 1:1 Geneva Pedestrian Zones',
    fetchedAt: new Date().toISOString(),
    footways,
    pedestrianPlazas,
    steps,
    cycleways,
    lawns,
    drinkingFountains,
    cafes,
  };
  const pedPath = path.join(dataDir, 'geneva-pedestrian-zones.json');
  fs.writeFileSync(pedPath, JSON.stringify(pedOut));
  console.log('[Saved] geneva-pedestrian-zones.json:', {
    footways: footways.length,
    pedestrianPlazas: pedestrianPlazas.length,
    steps: steps.length,
    cycleways: cycleways.length,
    lawns: lawns.length,
    drinkingFountains: drinkingFountains.length,
    cafes: cafes.length,
    kb: Math.round(fs.statSync(pedPath).size / 1024),
  });

  // 2. Fetch rich architectural tags for ALL buildings in central Geneva to enrich building styling 1:1!
  const bldQuery = `
[out:json][timeout:45];
(
  way["building"](${bb});
);
out center tags;
`;
  const rawBld = await queryOverpass(bldQuery, 'buildings_meta');
  const bldMeta = [];
  for (const el of rawBld.elements || []) {
    const t = el.tags || {};
    if (!el.center) continue;
    const [x, z] = toLocal(el.center.lat, el.center.lon);
    // Keep only entries with useful architectural or address info
    const rec = { x, z };
    if (t.name) rec.n = t.name;
    if (t.building && t.building !== 'yes') rec.k = t.building;
    if (t['building:levels']) rec.lv = parseFloat(t['building:levels']) || undefined;
    if (t['building:colour']) rec.col = t['building:colour'];
    if (t['building:material']) rec.mat = t['building:material'];
    if (t['roof:colour']) rec.rcol = t['roof:colour'];
    if (t['roof:material']) rec.rmat = t['roof:material'];
    if (t['roof:shape']) rec.rsh = t['roof:shape'];
    if (t['addr:street']) rec.st = t['addr:street'];
    if (t['addr:housenumber']) rec.hn = t['addr:housenumber'];
    if (t.start_date) rec.yr = t.start_date;
    if (t.historic) rec.his = t.historic;
    if (t.heritage) rec.her = t.heritage;
    if (t.shop) rec.sh = t.shop;
    if (t.amenity) rec.am = t.amenity;
    if (t.tourism) rec.to = t.tourism;
    if (Object.keys(rec).length > 2) bldMeta.push(rec);
  }
  const metaPath = path.join(dataDir, 'geneva-buildings-meta.json');
  fs.writeFileSync(metaPath, JSON.stringify({
    source: 'OSM Overpass API 1:1 Geneva Building Architecture Metadata',
    fetchedAt: new Date().toISOString(),
    count: bldMeta.length,
    buildings: bldMeta,
  }));
  console.log('[Saved] geneva-buildings-meta.json:', {
    count: bldMeta.length,
    withStreet: bldMeta.filter((b) => b.st).length,
    withLevels: bldMeta.filter((b) => b.lv).length,
    withColor: bldMeta.filter((b) => b.col).length,
    withMaterial: bldMeta.filter((b) => b.mat).length,
    withRoofMat: bldMeta.filter((b) => b.rmat || b.rcol).length,
    kb: Math.round(fs.statSync(metaPath).size / 1024),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
