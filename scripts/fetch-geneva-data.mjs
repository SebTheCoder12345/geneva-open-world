import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/data');
fs.mkdirSync(outDir, { recursive: true });

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

// 1:1 Real Geneva Bounding Box centered on the Rade de Genève (exact Swiss LV95 metric frame!)
export const ORIGIN = { lat: 46.2060, lon: 6.1500 };
const [ORIGIN_E, ORIGIN_N] = wgs84ToLv95(ORIGIN.lat, ORIGIN.lon);

export const BBOX = {
  south: 46.1995,
  west: 6.1410,
  north: 46.2125,
  east: 6.1610,
};

const [MIN_E, MIN_N] = wgs84ToLv95(BBOX.south, BBOX.west);
const [MAX_E, MAX_N] = wgs84ToLv95(BBOX.north, BBOX.east);

function toLocal(lat, lon) {
  const [E, N] = wgs84ToLv95(lat, lon);
  return [
    Math.round((E - ORIGIN_E) * 10) / 10,
    Math.round(-(N - ORIGIN_N) * 10) / 10,
  ];
}

async function fetchOverpass() {
  const { south, west, north, east } = BBOX;
  const bb = `${south},${west},${north},${east}`;
  const query = `
[out:json][timeout:60];
(
  way["building"](${bb});
  relation["building"](${bb});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|pedestrian|living_street|service)$"](${bb});
  way["man_made"~"^(pier|breakwater|groyne)$"](${bb});
  way["natural"="water"](${bb});
  relation["natural"="water"](${bb});
  way["waterway"="riverbank"](${bb});
  way["leisure"~"^(park|garden)$"](${bb});
  node["natural"="tree"](${bb});
);
out body;
>;
out skel qt;
`;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const url of endpoints) {
    console.log(`Fetching 1:1 Geneva OSM data from ${url}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Accept': 'application/json, */*',
          'User-Agent': 'GenevaOpenWorldBuilder/1.0 (https://localhost)',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`Overpass ${url} returned ${res.status}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      console.warn(`Overpass ${url} failed:`, err.message);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

function processOsm(raw) {
  const nodes = new Map();
  const ways = new Map();
  for (const el of raw.elements) {
    if (el.type === 'node') nodes.set(el.id, el);
    else if (el.type === 'way') ways.set(el.id, el);
  }

  const buildings = [];
  const roads = [];
  const piers = [];
  const parks = [];
  const trees = [];
  const water = [];

  for (const el of raw.elements) {
    if (el.type === 'node' && el.tags?.natural === 'tree') {
      trees.push(toLocal(el.lat, el.lon));
      continue;
    }
    if (el.type !== 'way' || !el.tags || !el.nodes || el.nodes.length < 2) continue;

    const coords = [];
    for (const nid of el.nodes) {
      const n = nodes.get(nid);
      if (n) coords.push(toLocal(n.lat, n.lon));
    }
    if (coords.length < 2) continue;

    const t = el.tags;

    if (t.building) {
      if (coords.length < 4) continue;
      // Drop duplicate closing point for clean Earcut/Shape extrusion
      const pts = coords.slice(0, -1);
      // Estimate realistic Geneva height in meters
      let h = 0;
      if (t.height) h = parseFloat(t.height);
      if (!h || Number.isNaN(h)) {
        const levels = parseFloat(t['building:levels'] || '0');
        if (levels > 0) h = levels * 3.4 + 2.0;
        else h = 16 + ((el.id % 5) * 2.2);
      }
      h = Math.max(4.5, Math.min(58, Math.round(h * 10) / 10));
      buildings.push({
        p: pts,
        h,
        n: t.name || '',
        k: t.building,
        c: t['building:colour'] || '',
        r: t['roof:shape'] || '',
      });
    } else if (t.highway) {
      const widthMap = {
        primary: 13,
        secondary: 11,
        tertiary: 9.5,
        residential: 7.5,
        unclassified: 7.5,
        living_street: 6.5,
        pedestrian: 6.0,
        service: 4.5,
      };
      roads.push({
        p: coords,
        w: widthMap[t.highway] || 7.5,
        n: t.name || '',
        k: t.highway,
        br: t.bridge === 'yes' ? 1 : 0,
      });
    } else if (t.man_made === 'pier' || t.man_made === 'breakwater' || t.man_made === 'groyne') {
      piers.push({ p: coords, n: t.name || '' });
    } else if (t.leisure === 'park' || t.leisure === 'garden') {
      if (coords.length >= 4) parks.push({ p: coords.slice(0, -1), n: t.name || '' });
    } else if (t.natural === 'water' || t.waterway === 'riverbank') {
      if (coords.length >= 4) water.push(coords.slice(0, -1));
    }
  }

  return {
    origin: ORIGIN,
    originLv95: [Math.round(ORIGIN_E), Math.round(ORIGIN_N)],
    bbox: BBOX,
    boundsMeters: {
      minX: Math.round((MIN_E - ORIGIN_E) * 10) / 10,
      maxX: Math.round((MAX_E - ORIGIN_E) * 10) / 10,
      minZ: Math.round(-(MAX_N - ORIGIN_N) * 10) / 10,
      maxZ: Math.round(-(MIN_N - ORIGIN_N) * 10) / 10,
    },
    buildings,
    roads,
    piers,
    parks,
    trees,
    water,
  };
}

async function fetchSwisstopoImage(layer, filename, width = 2048, height = 2048, format = 'image/jpeg') {
  const url =
    `https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=${layer}&STYLES=&CRS=EPSG:2056&BBOX=${Math.round(MIN_E)},${Math.round(MIN_N)},${Math.round(MAX_E)},${Math.round(MAX_N)}` +
    `&WIDTH=${width}&HEIGHT=${height}&FORMAT=${format}`;
  console.log(`Fetching swisstopo ${layer} (${width}x${height})...`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'GenevaOpenWorldBuilder/1.0' },
  });
  if (!res.ok) throw new Error(`swisstopo ${layer} failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(path.join(outDir, filename), buf);
  console.log(`Saved ${filename} (${Math.round(buf.length / 1024)} KB)`);
}

async function fetchElevationGrid() {
  // Sample 17x17 real Swiss ALTI3D elevations uniformly in LV95 metric space
  const nx = 17;
  const nz = 17;
  const grid = [];
  console.log(`Sampling ${nx}x${nz} real swisstopo ALTI3D elevation grid...`);
  for (let iz = 0; iz < nz; iz++) {
    const N = MAX_N - (iz / (nz - 1)) * (MAX_N - MIN_N);
    const row = [];
    const promises = [];
    for (let ix = 0; ix < nx; ix++) {
      const E = MIN_E + (ix / (nx - 1)) * (MAX_E - MIN_E);
      const url = `https://api3.geo.admin.ch/rest/services/height?easting=${Math.round(E)}&northing=${Math.round(N)}&sr=2056`;
      promises.push(
        fetch(url)
          .then((r) => (r.ok ? r.json() : { height: '372.0' }))
          .then((d) => parseFloat(d.height || '372.0'))
          .catch(() => 372.0)
      );
    }
    const vals = await Promise.all(promises);
    for (const v of vals) row.push(Math.round(v * 10) / 10);
    grid.push(row);
  }
  return { nx, nz, lakeLevel: 372.0, grid };
}

async function main() {
  const [rawOsm, elev] = await Promise.all([
    fetchOverpass(),
    fetchElevationGrid(),
    fetchSwisstopoImage('ch.swisstopo.swissimage', 'geneva-ortho.jpg', 3072, 3072, 'image/jpeg'),
    fetchSwisstopoImage('ch.swisstopo.pixelkarte-farbe', 'geneva-map.jpg', 2048, 2048, 'image/jpeg'),
  ]);

  const data = processOsm(rawOsm);
  data.elevation = elev;

  const jsonPath = path.join(outDir, 'geneva-1to1.json');
  fs.writeFileSync(jsonPath, JSON.stringify(data));
  console.log(
    `DONE! Saved ${jsonPath} (${Math.round(fs.statSync(jsonPath).size / 1024)} KB): ` +
      `${data.buildings.length} buildings, ${data.roads.length} roads, ${data.trees.length} trees, ${data.piers.length} piers.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
