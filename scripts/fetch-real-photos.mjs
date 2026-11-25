import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const facDir = path.resolve(__dirname, '../public/textures/facades');
const texDir = path.resolve(__dirname, '../public/textures');
fs.mkdirSync(facDir, { recursive: true });

// 1. Inspect Xbot mocap skeleton & clips
const xb = fs.readFileSync(path.resolve(__dirname, '../public/models/xbot_anims.glb'));
const xj = JSON.parse(xb.slice(20, 20 + xb.readUInt32LE(12)).toString('utf8'));
console.log('Xbot anims:', xj.animations.map((a) => a.name));
const xRoot = xj.nodes[xj.scenes[0].nodes[0]];
console.log('Xbot root:', xRoot.name, 'scale:', xRoot.scale, 'rot:', xRoot.rotation);
for (const nm of ['mixamorigHips', 'mixamorigLeftArm', 'mixamorigLeftUpLeg', 'mixamorigLeftLeg']) {
  const n = xj.nodes.find((x) => x.name === nm);
  console.log(' ', nm, 'rot:', n?.rotation?.map((v) => +v.toFixed(2)), 'tr:', n?.translation?.map((v) => +v.toFixed(2)));
}

// Clean up any sepia/statue downloads from earlier
for (const f of ['geneva_facade_3.jpg', 'geneva_facade_4.jpg', 'haussmann_facade_1.jpg', 'haussmann_facade_2.jpg', 'haussmann_facade_3.jpg']) {
  try { fs.unlinkSync(path.join(facDir, f)); } catch {}
}

// 2. Fetch REAL color architectural facade photographs from Wikimedia Commons
async function searchClean(query, outPrefix, max) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=25' +
    '&gsrsearch=' + encodeURIComponent(query) +
    '&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1024&format=json';
  const data = await fetch(api, { headers: { 'User-Agent': 'GenevaOpenWorld/1.0 (educational)' } }).then((r) => r.json());
  const pages = Object.values(data.query?.pages || {});
  let n = 0;
  for (const p of pages) {
    if (n >= max) break;
    const title = p.title || '';
    if (/Marville|18\d\d|19[0-5]\d|statue|faun|portrait|map|plan|logo|sign|drawing|gravure|carte|plaque/i.test(title)) continue;
    const ii = p.imageinfo?.[0];
    if (!ii || ii.mime !== 'image/jpeg' || !ii.thumburl || ii.width < 900) continue;
    const r = await fetch(ii.thumburl, { headers: { 'User-Agent': 'GenevaOpenWorld/1.0 (educational)' } });
    if (!r.ok) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const name = `${outPrefix}_${n + 1}.jpg`;
    fs.writeFileSync(path.join(facDir, name), buf);
    console.log('Saved', name, `${Math.round(buf.length / 1024)}KB <-`, title);
    n++;
  }
}

await searchClean('Rue du Rhone Geneva building facade', 'real_rhone', 2);
await searchClean('Quai du Mont-Blanc Geneva hotel', 'real_quai', 2);
await searchClean('Place du Bourg-de-Four Geneva', 'real_oldtown', 2);
await searchClean('European stone building facade windows orthographic texture', 'real_euro', 3);

// 3. Also download a real CC0 photographed Poly Haven European sandstone/ashlar block wall & red brick facade
for (const [id, pref] of [['castle_brick_02_red', 'euro_brick'], ['stone_brick_wall_001', 'euro_ashlar']]) {
  try {
    const meta = await fetch('https://api.polyhaven.com/files/' + id, { headers: { 'User-Agent': 'GenevaAAA/1.0' } }).then((r) => r.json());
    for (const [k, suf] of [['Diffuse', '_diff.jpg'], ['nor_gl', '_nor.jpg']]) {
      const url = meta[k]?.['1k']?.jpg?.url;
      if (url) {
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
        fs.writeFileSync(path.join(texDir, pref + suf), buf);
        console.log('Saved', pref + suf, Math.round(buf.length / 1024), 'KB');
      }
    }
  } catch (e) { console.warn('PolyHaven skip', id, e.message); }
}
