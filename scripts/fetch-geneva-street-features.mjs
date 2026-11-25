import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataOutDir = path.resolve(rootDir, 'public/data');
const refOutDir = path.resolve(rootDir, '.tmp-geneva-refs');
fs.mkdirSync(dataOutDir, { recursive: true });
fs.mkdirSync(refOutDir, { recursive: true });

// Official swisstopo WGS84 -> LV95 (EPSG:2056) exact metric coordinates
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

function toLocal(lat, lon) {
  const [E, N] = wgs84ToLv95(lat, lon);
  return [
    Math.round((E - ORIGIN_E) * 100) / 100,
    Math.round(-(N - ORIGIN_N) * 100) / 100,
  ];
}

// Active Geneva sector covering Quai du Général-Guisan, Jardin Anglais, Rue du Rhône, Rues-Basses & Pont du Mont-Blanc
const BBOX = {
  south: 46.2012,
  west: 6.1435,
  north: 46.2082,
  east: 6.1565,
};

async function fetchOverpassStreetFeatures() {
  const bb = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const query = `
[out:json][timeout:45];
(
  node["highway"="street_lamp"](${bb});
  node["barrier"="bollard"](${bb});
  node["amenity"="bench"](${bb});
  node["amenity"="waste_basket"](${bb});
  node["highway"="crossing"](${bb});
  node["highway"="traffic_signals"](${bb});
  node["highway"="bus_stop"](${bb});
  node["traffic_sign"](${bb});
  node["amenity"="bicycle_parking"](${bb});
  way["railway"="tram"](${bb});
  way["barrier"="bollard"](${bb});
);
out body;
>;
out skel qt;
`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const url of endpoints) {
    console.log(`[Overpass] Querying real Geneva street features from ${url}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'GenevaOpenWorldTechnicalArt/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`[Overpass] ${url} HTTP ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`[Overpass] ${url} failed: ${err.message}`);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

function processOverpassFeatures(raw) {
  const nodeMap = new Map();
  for (const el of raw.elements || []) {
    if (el.type === 'node') nodeMap.set(el.id, el);
  }

  const out = {
    source: 'OSM Overpass API (Geneva Real GPS)',
    bbox: BBOX,
    fetchedAt: new Date().toISOString(),
    streetLamps: [],
    bollards: [],
    benches: [],
    wasteBaskets: [],
    crossings: [],
    trafficSignals: [],
    busStops: [],
    trafficSigns: [],
    bikeParking: [],
    tramTracks: [],
  };

  for (const el of raw.elements || []) {
    if (el.type === 'node' && el.tags) {
      const [x, z] = toLocal(el.lat, el.lon);
      const t = el.tags;
      if (t.highway === 'street_lamp') out.streetLamps.push([x, z]);
      if (t.barrier === 'bollard') out.bollards.push([x, z]);
      if (t.amenity === 'bench') {
        const dir = t.direction ? Number(t.direction) : null;
        out.benches.push(Number.isFinite(dir) ? [x, z, dir] : [x, z]);
      }
      if (t.amenity === 'waste_basket') out.wasteBaskets.push([x, z]);
      if (t.highway === 'crossing') out.crossings.push([x, z]);
      if (t.highway === 'traffic_signals') out.trafficSignals.push([x, z]);
      if (t.highway === 'bus_stop') out.busStops.push({ x, z, name: t.name || 'TPG' });
      if (t.traffic_sign) out.trafficSigns.push({ x, z, sign: t.traffic_sign });
      if (t.amenity === 'bicycle_parking') out.bikeParking.push([x, z]);
    } else if (el.type === 'way' && el.tags) {
      const pts = (el.nodes || [])
        .map((id) => nodeMap.get(id))
        .filter(Boolean)
        .map((n) => toLocal(n.lat, n.lon));
      if (pts.length >= 2) {
        if (el.tags.railway === 'tram') {
          out.tramTracks.push({ name: el.tags.name || 'TPG Tram', p: pts });
        } else if (el.tags.barrier === 'bollard') {
          for (const pt of pts) out.bollards.push(pt);
        }
      }
    }
  }

  return out;
}

async function fetchWikimediaPhoto(searchTerm, outFilename) {
  const apiUrl =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    '&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch=' +
    encodeURIComponent(searchTerm) +
    '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1024';

  const res = await fetch(apiUrl, {
    headers: { 'User-Agent': 'GenevaOpenWorldTechnicalArt/1.0 (https://localhost)' },
  });
  if (!res.ok) throw new Error(`Wikimedia search failed: HTTP ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages || {});

  // Prefer horizontal street-level JPG/PNG photos with decent resolution
  const candidates = pages
    .map((p) => ({ title: p.title, info: p.imageinfo?.[0] }))
    .filter((c) => c.info && /image\/(jpeg|png)/.test(c.info.mime) && c.info.width >= 900 && c.info.width >= c.info.height * 0.95);

  const chosen = candidates[0] || pages.map((p) => ({ title: p.title, info: p.imageinfo?.[0] })).find((c) => c.info?.thumburl);
  if (!chosen) {
    console.warn(`[Wikimedia] No photo found for "${searchTerm}"`);
    return null;
  }

  const imgUrl = chosen.info.thumburl || chosen.info.url;
  const imgRes = await fetch(imgUrl, {
    headers: { 'User-Agent': 'GenevaOpenWorldTechnicalArt/1.0 (https://localhost)' },
  });
  if (!imgRes.ok) throw new Error(`Image download failed: HTTP ${imgRes.status}`);
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const outPath = path.join(refOutDir, outFilename);
  fs.writeFileSync(outPath, buf);
  console.log(`[Wikimedia] Saved ${outFilename} (${Math.round(buf.length / 1024)} KB) <- ${chosen.title}`);
  return { filename: outFilename, title: chosen.title, url: imgUrl, bytes: buf.length };
}

async function main() {
  // 1. Fetch exact real Geneva street-level GPS features via Overpass
  const rawOsm = await fetchOverpassStreetFeatures();
  const features = processOverpassFeatures(rawOsm);
  const featPath = path.join(dataOutDir, 'geneva-street-features.json');
  fs.writeFileSync(featPath, JSON.stringify(features));
  console.log('[Overpass] Saved real Geneva GPS street features:', {
    streetLamps: features.streetLamps.length,
    bollards: features.bollards.length,
    benches: features.benches.length,
    wasteBaskets: features.wasteBaskets.length,
    crossings: features.crossings.length,
    trafficSignals: features.trafficSignals.length,
    busStops: features.busStops.length,
    trafficSigns: features.trafficSigns.length,
    bikeParking: features.bikeParking.length,
    tramTracks: features.tramTracks.length,
  });

  // 2. Fetch real street-level Wikimedia Commons reference photos for visual gap audit
  const photoQueries = [
    ['"Quai du Général-Guisan" Genève', 'ref_01_quai_general_guisan.jpg'],
    ['"Jardin Anglais" Genève promenade', 'ref_02_jardin_anglais.jpg'],
    ['"Rue du Rhône" Genève', 'ref_03_rue_du_rhone.jpg'],
    ['"Rues-Basses" OR "Rue du Marché" Genève tram', 'ref_04_rues_basses_tram.jpg'],
    ['"Pont du Mont-Blanc" Genève', 'ref_05_pont_mont_blanc.jpg'],
    ['"Hôtel Métropole" Genève', 'ref_06_hotel_metropole_facade.jpg'],
  ];

  const manifest = [];
  for (const [q, fn] of photoQueries) {
    try {
      const m = await fetchWikimediaPhoto(q, fn);
      if (m) manifest.push(m);
    } catch (err) {
      console.warn(`[Wikimedia] Error fetching ${fn}: ${err.message}`);
    }
  }
  fs.writeFileSync(path.join(refOutDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`[Done] Downloaded ${manifest.length} real Geneva street photos into ${refOutDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
