import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../public/data/geneva-real-places.json');

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
    Math.round((E - ORIGIN_E) * 10) / 10,
    Math.round(-(N - ORIGIN_N) * 10) / 10,
  ];
}

// Central Geneva bounding box covering Quai du Général-Guisan, Rue du Rhône, Molard, Vieille-Ville, Quai du Mont-Blanc, Place de Neuve & Bastions
const BB = '46.1995,6.1410,46.2125,6.1610';

async function main() {
  const query = `
[out:json][timeout:30];
(
  node["name"]["shop"~"^(watches|jewelry|department_store|mall|clothes|shoes|bags|cosmetics|chocolate|bakery|supermarket|electronics|books)$"](${BB});
  node["name"]["tourism"~"^(hotel|attraction|museum|artwork|monument)$"](${BB});
  node["name"]["amenity"~"^(bank|theatre|fountain|place_of_worship|clock)$"](${BB});
  node["name"]["historic"](${BB});
  way["name"]["tourism"~"^(hotel|museum|attraction)$"](${BB});
  way["name"]["amenity"~"^(bank|theatre|place_of_worship|townhall)$"](${BB});
  way["name"]["historic"](${BB});
  way["name"]["shop"~"^(department_store|mall|watches)$"](${BB});
);
out center body;
`;

  const endpoints = [
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  let raw = null;
  for (const url of endpoints) {
    console.log(`[Overpass] Fetching real Geneva shops, watchmakers, hotels, monuments & banks from ${url}...`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(25000),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'GenevaOpenWorld1to1/1.0',
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        console.warn(`  HTTP ${res.status}`);
        continue;
      }
      raw = await res.json();
      break;
    } catch (e) {
      console.warn(`  Failed: ${e.message}`);
    }
  }
  if (!raw) throw new Error('Overpass fetch failed');

  const places = [];
  const seen = new Set();

  for (const el of raw.elements || []) {
    const t = el.tags || {};
    const name = (t.brand || t.name || '').trim();
    if (!name || name.length > 42) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const [x, z] = toLocal(lat, lon);

    const key = `${name.toLowerCase()}_${Math.round(x / 18)}_${Math.round(z / 18)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let category = 'shop';
    if (t.tourism === 'hotel') category = 'hotel';
    else if (t.amenity === 'bank') category = 'bank';
    else if (t.shop === 'watches' || t.shop === 'jewelry' || /rolex|patek|omega|cartier|bucherer|piaget|vacheron|audemars|breitling|tag heuer|chopard|hublot|iwc|tissot|swatch|jaeger|breguet|panerai|tudor|longines|blancpain|montblanc|tiffany|bulgari|van cleef/i.test(name)) category = 'watch';
    else if (t.shop === 'department_store' || t.shop === 'mall' || /bongénie|globus|manor|confédération/i.test(name)) category = 'dept';
    else if (t.amenity === 'cafe' || t.amenity === 'restaurant') category = 'cafe';
    else if (t.amenity === 'theatre' || t.tourism === 'museum' || t.amenity === 'place_of_worship' || t.historic) category = 'landmark';
    else if (t.amenity === 'fountain') category = 'fountain';

    places.push({
      name,
      category,
      x,
      z,
      street: t['addr:street'] || '',
      num: t['addr:housenumber'] || '',
      color: t['building:colour'] || '',
    });
  }

  fs.writeFileSync(outPath, JSON.stringify({
    source: 'OpenStreetMap Geneva Real Places & Brands',
    fetchedAt: new Date().toISOString(),
    count: places.length,
    places,
  }));

  const byCat = {};
  for (const p of places) byCat[p.category] = (byCat[p.category] || 0) + 1;
  console.log(`[DONE] Saved ${places.length} real Geneva brands, hotels, watchmakers & landmarks:`, byCat);
  console.log('Sample watchmakers & hotels:', places.filter((p) => p.category === 'watch' || p.category === 'hotel').slice(0, 18).map((p) => `${p.name} (${p.x},${p.z})`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
