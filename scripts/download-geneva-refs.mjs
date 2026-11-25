import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refOutDir = path.resolve(__dirname, '../.tmp-geneva-refs');
fs.mkdirSync(refOutDir, { recursive: true });

const FILES = [
  ['Quai_du_Général-Guisan,_Geneva_-_panoramio.jpg', 'ref_01_quai_general_guisan.jpg'],
  ['Geneve_jardin_Anglais_2011-09-13_13_50_00_PICT4755.JPG', 'ref_02_jardin_anglais.jpg'],
  ["Rue_du_Rhône_(Geneva)-vers_l'Est.jpg", 'ref_03_rue_du_rhone_east.jpg'],
  ['Rue_du_Rhone_Geneve.jpg', 'ref_04_rue_du_rhone.jpg'],
  ['Tramway_rue_Marché_Genève_5.jpg', 'ref_05_rues_basses_tram.jpg'],
  ['Place_du_Molard_(Geneva)-arrêt_TPG.jpg', 'ref_06_place_du_molard.jpg'],
];

const UA = 'GenevaOpenWorldTechArt/1.0 (https://en.wikipedia.org/wiki/Geneva; educational-3d-study)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const downloaded = [];
  for (const [wikiFile, outName] of FILES) {
    const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(wikiFile)}?width=1024`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) {
        console.warn(`Failed ${outName}: HTTP ${res.status}`);
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        const outPath = path.join(refOutDir, outName);
        fs.writeFileSync(outPath, buf);
        console.log(`Saved ${outName} (${Math.round(buf.length / 1024)} KB)`);
        downloaded.push({ outName, wikiFile, bytes: buf.length });
      }
    } catch (err) {
      console.warn(`Error ${outName}: ${err.message}`);
    }
    await sleep(1600);
  }
  console.log(`Done: ${downloaded.length}/${FILES.length} real Geneva street reference photos saved.`);
}

main();
