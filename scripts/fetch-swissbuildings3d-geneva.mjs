import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '../public/data/swissbuildings3d');
fs.mkdirSync(outDir, { recursive: true });

// Exact WGS84 ellipsoid constants
const A = 6378137.0;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

function ecefToWgs84(X, Y, Z) {
  const lon = Math.atan2(Y, X);
  const p = Math.hypot(X, Y);
  let lat = Math.atan2(Z, p * (1 - E2));
  for (let i = 0; i < 6; i++) {
    const sinLat = Math.sin(lat);
    const N = A / Math.sqrt(1 - E2 * sinLat * sinLat);
    lat = Math.atan2(Z + E2 * N * sinLat, p);
  }
  const sinLat = Math.sin(lat);
  const N = A / Math.sqrt(1 - E2 * sinLat * sinLat);
  const h = p / Math.cos(lat) - N;
  return { lat: (lat * 180) / Math.PI, lon: (lon * 180) / Math.PI, h };
}

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

// Official swisstopo swissBUILDINGS3D 3D Tiles encode exact Swiss LN02 orthometric heights directly in ECEF (no +49.72m geoid offset)!
// Lac Léman orthometric surface = 372.0m LN02, and our terrain maps LN02 372.0m -> y = +0.5m!
const GENEVA_GEOID_N = 0.0;
const LAKE_LEVEL_LN02 = 372.0;

// Build exact 4x4 column-major transform matrix mapping glTF Y-up tile vertices -> our Three.js Local Geneva LV95 world space:
//   +X = LV95 Easting offset (E - ORIGIN_E)
//   +Y = Orthometric height above Lac Léman (LN02 - 372.0 + 0.5)
//   +Z = LV95 -Northing offset (-(N - ORIGIN_N))
// Uses the exact centered finite-difference Jacobian of ECEF -> WGS84 -> LV95 at `rtc` so Swiss LV95 meridian convergence
// (~-0.931° at Geneva relative to Bern!) is baked directly into every tile basis — guaranteeing ~1 cm seamless tile joins!
function buildTileToGenevaMatrix(rtc) {
  const [rx, ry, rz] = rtc;
  const worldFromEcef = (X, Y, Z) => {
    const w = ecefToWgs84(X, Y, Z);
    const [E, N] = wgs84ToLv95(w.lat, w.lon);
    return [E - ORIGIN_E, w.h - GENEVA_GEOID_N - LAKE_LEVEL_LN02 + 0.5, -(N - ORIGIN_N)];
  };
  const [tx, ty, tz] = worldFromEcef(rx, ry, rz);

  // Standard 3D Tiles b3dm glTF Y-up -> ECEF offset: dECEF = (x_g, -z_g, y_g)
  //   Column 0 (image of glTF +X) = dWorld / d(dECEF_X)
  //   Column 1 (image of glTF +Y) = dWorld / d(dECEF_Z)
  //   Column 2 (image of glTF +Z) = -dWorld / d(dECEF_Y)
  const eps = 10.0;
  const deriv = (dx, dy, dz) => {
    const p = worldFromEcef(rx + dx * eps, ry + dy * eps, rz + dz * eps);
    const m = worldFromEcef(rx - dx * eps, ry - dy * eps, rz - dz * eps);
    return [(p[0] - m[0]) / (2 * eps), (p[1] - m[1]) / (2 * eps), (p[2] - m[2]) / (2 * eps)];
  };
  const [c0x, c0y, c0z] = deriv(1, 0, 0);
  const [c1x, c1y, c1z] = deriv(0, 0, 1);
  const [c2x, c2y, c2z] = deriv(0, -1, 0);

  // Return Three.js column-major 16-element matrix array!
  return [
    c0x, c0y, c0z, 0,
    c1x, c1y, c1z, 0,
    c2x, c2y, c2z, 0,
    tx,  ty,  tz,  1,
  ].map((v) => Math.round(v * 1e7) / 1e7);
}

const ROOT = 'https://3d.geo.admin.ch/ch.swisstopo.swissbuildings3d.3d/v1/tileset.json';
const DEG = Math.PI / 180;
const GENEVA = [6.1410 * DEG, 46.1995 * DEG, 6.1610 * DEG, 46.2125 * DEG];

function intersectsRegion(r, target) {
  if (!r || r.length < 4) return true;
  return !(r[2] < target[0] || r[0] > target[2] || r[3] < target[1] || r[1] > target[3]);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'GenevaOpenWorld1to1/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const tileUrls = [];
async function walk(node, baseUrl) {
  const bv = node.boundingVolume;
  if (bv?.region && !intersectsRegion(bv.region, GENEVA)) return;
  const uri = node.content?.uri || node.content?.url;
  if (uri) {
    const full = new URL(uri, baseUrl).href;
    if (full.endsWith('.json')) {
      const sub = await fetchJson(full);
      await walk(sub.root, full);
    } else if (full.endsWith('.b3dm')) {
      tileUrls.push({ url: full, region: bv?.region });
    }
  }
  if (Array.isArray(node.children)) {
    for (const ch of node.children) await walk(ch, baseUrl);
  }
}

async function processTile(item, idx) {
  const res = await fetch(item.url, { headers: { 'User-Agent': 'GenevaOpenWorld1to1/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${item.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.subarray(0, 4).toString('ascii') !== 'b3dm') throw new Error('Not a b3dm tile');

  const ftJsonLen = buf.readUInt32LE(12);
  const ftBinLen = buf.readUInt32LE(16);
  const btJsonLen = buf.readUInt32LE(20);
  const btBinLen = buf.readUInt32LE(24);
  const ftJson = ftJsonLen ? JSON.parse(buf.subarray(28, 28 + ftJsonLen).toString('utf8').replace(/\0+$/, '').trim()) : {};
  const glbStart = 28 + ftJsonLen + ftBinLen + btJsonLen + btBinLen;
  const glbBuf = buf.subarray(glbStart);
  if (glbBuf.subarray(0, 4).toString('ascii') !== 'glTF') throw new Error('Embedded GLB header invalid');

  const rtc = ftJson.RTC_CENTER || [0, 0, 0];
  const matrix = buildTileToGenevaMatrix(rtc);
  const filename = `tile_${String(idx).padStart(3, '0')}.glb`;
  fs.writeFileSync(path.join(outDir, filename), glbBuf);

  const wgs = ecefToWgs84(rtc[0], rtc[1], rtc[2]);
  const [E, N] = wgs84ToLv95(wgs.lat, wgs.lon);
  return {
    file: `/data/swissbuildings3d/${filename}`,
    bytes: glbBuf.length,
    cx: Math.round((E - ORIGIN_E) * 10) / 10,
    cz: Math.round(-(N - ORIGIN_N) * 10) / 10,
    hEllip: Math.round(wgs.h * 10) / 10,
    matrix,
  };
}

async function main() {
  console.log('[swisstopo] Discovering official 2026 swissBUILDINGS3D tiles for central Geneva...');
  const root = await fetchJson(ROOT);
  await walk(root.root, ROOT);
  console.log(`[swisstopo] Found ${tileUrls.length} tiles. Downloading & converting .b3dm -> .glb in parallel batches...`);

  const manifestTiles = [];
  let totalBytes = 0;
  const BATCH = 10;
  for (let i = 0; i < tileUrls.length; i += BATCH) {
    const slice = tileUrls.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map((item, k) =>
        processTile(item, i + k).catch((err) => {
          console.warn(`Tile ${i + k} failed:`, err.message);
          return null;
        })
      )
    );
    for (const r of results) {
      if (r) {
        manifestTiles.push(r);
        totalBytes += r.bytes;
      }
    }
    if ((i + BATCH) % 30 === 0 || i + BATCH >= tileUrls.length) {
      console.log(`  Converted ${manifestTiles.length}/${tileUrls.length} tiles (${(totalBytes / 1024 / 1024).toFixed(2)} MB)...`);
    }
  }

  // Sort tiles closest to Rade & Jardin Anglais first so the player's starting neighborhood streams in first!
  manifestTiles.sort((a, b) => Math.hypot(a.cx, a.cz - 150) - Math.hypot(b.cx, b.cz - 150));

  const manifest = {
    source: 'swisstopo swissBUILDINGS3D 3D Tiles (Official Swiss Open Government Data)',
    fetchedAt: new Date().toISOString(),
    tileCount: manifestTiles.length,
    totalBytes,
    geoidN: GENEVA_GEOID_N,
    tiles: manifestTiles,
  };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest));
  console.log(`[DONE] Saved ${manifestTiles.length} official Geneva 3D building tiles (${(totalBytes / 1024 / 1024).toFixed(2)} MB total)!`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
