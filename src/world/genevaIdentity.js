import * as THREE from 'three';
import { getGroundHeight, distToSegment } from './cityData.js';
import { batchStaticGroup } from './staticBatcher.js';

function polygonSignedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return a * 0.5;
}

// Brand-accurate Geneva luxury storefront & signage visual palettes
function getBrandTheme(name, category) {
  const n = name.toUpperCase();
  if (/ROLEX/.test(n)) return { bg: '#0b4628', fg: '#e8c468', border: '#e8c468', font: 'bold 46px Georgia, serif', awning: 0x0b4628, crown: true };
  if (/PATEK/.test(n)) return { bg: '#1e1b18', fg: '#ebd08c', border: '#cfa95c', font: 'bold 34px Georgia, serif', awning: 0x3b2e22 };
  if (/CARTIER/.test(n)) return { bg: '#5a121b', fg: '#f3d999', border: '#d8b468', font: 'italic bold 44px Georgia, serif', awning: 0x5a121b };
  if (/TIFFANY/.test(n)) return { bg: '#5bbbc2', fg: '#102024', border: '#ffffff', font: 'bold 34px Georgia, serif', awning: 0x5bbbc2 };
  if (/HERM[ÈE]S/.test(n)) return { bg: '#9e4414', fg: '#fff4e0', border: '#e6b87a', font: 'bold 42px Georgia, serif', awning: 0x9e4414 };
  if (/LOUIS VUITTON/.test(n)) return { bg: '#2b1e16', fg: '#f0d8a8', border: '#c5a166', font: 'bold 31px "Helvetica Neue", sans-serif', awning: 0x2b1e16 };
  if (/DIOR/.test(n)) return { bg: '#f4f2ee', fg: '#161616', border: '#2a2a2a', font: 'bold 46px Georgia, serif', awning: 0xdedad0 };
  if (/CHANEL/.test(n)) return { bg: '#111214', fg: '#ffffff', border: '#d8d8d8', font: 'bold 44px "Helvetica Neue", sans-serif', awning: 0x16181c };
  if (/OMEGA/.test(n)) return { bg: '#8a141c', fg: '#ffffff', border: '#e2c074', font: 'bold 44px "Helvetica Neue", sans-serif', awning: 0x701218 };
  if (/BUCHERER/.test(n)) return { bg: '#132138', fg: '#eccd86', border: '#d4af5c', font: 'bold 38px Georgia, serif', awning: 0x132138 };
  if (/CHOPARD|PIAGET|BLANCPAIN|VACHERON|AUDEMARS/.test(n)) return { bg: '#141e2e', fg: '#ecd08c', border: '#c9a65e', font: 'bold 34px Georgia, serif', awning: 0x182538 };
  if (/BONG[ÉE]NIE/.test(n)) return { bg: '#1d1c1a', fg: '#f5efe2', border: '#d0b072', font: 'bold 40px Georgia, serif', awning: 0x22201d };
  if (/GLOBUS/.test(n)) return { bg: '#181a1f', fg: '#f6d57a', border: '#f6d57a', font: 'bold 44px "Helvetica Neue", sans-serif', awning: 0x1e2228 };
  if (/MANOR/.test(n)) return { bg: '#c81c2c', fg: '#ffffff', border: '#ffffff', font: 'bold 46px "Helvetica Neue", sans-serif', awning: 0xa61824 };
  if (/MIGROS/.test(n)) return { bg: '#f26522', fg: '#ffffff', border: '#ffffff', font: 'bold 46px "Helvetica Neue", sans-serif', awning: 0xd9561a };
  if (/COOP/.test(n)) return { bg: '#ef7d00', fg: '#ffffff', border: '#fff2cc', font: 'bold 46px "Helvetica Neue", sans-serif', awning: 0xd16c00 };
  if (/UBS/.test(n)) return { bg: '#f7f7f7', fg: '#e60000', border: '#222222', font: 'bold 48px "Helvetica Neue", sans-serif', awning: 0x26292e };
  if (/FNAC/.test(n)) return { bg: '#e6a800', fg: '#161616', border: '#161616', font: 'bold 44px "Helvetica Neue", sans-serif', awning: 0x222222 };
  if (/APPLE/.test(n)) return { bg: '#1c1e22', fg: '#f0f2f5', border: '#7b828e', font: '600 38px "Helvetica Neue", sans-serif', awning: 0x2a2d33 };
  if (/PRADA|GUCCI|MONTBLANC/.test(n)) return { bg: '#161616', fg: '#f3e5c2', border: '#c4a86e', font: 'bold 40px Georgia, serif', awning: 0x1a1a1a };
  if (category === 'hotel') return { bg: '#1a2434', fg: '#efd18a', border: '#c9a65e', font: 'bold 30px Georgia, serif', awning: 0x1e2c3e };
  if (category === 'bank') return { bg: '#1e252e', fg: '#e4ecf5', border: '#9fb0c2', font: 'bold 34px "Helvetica Neue", sans-serif', awning: 0x222a34 };
  if (category === 'watch') return { bg: '#17202b', fg: '#e9cb82', border: '#c6a256', font: 'bold 34px Georgia, serif', awning: 0x1b2634 };
  return { bg: '#20262e', fg: '#f0e6d2', border: '#b89e68', font: 'bold 32px Georgia, serif', awning: 0x283038 };
}

// Authentic Sky-Transparent Geneva Silhouette Cutout Rooftop Watchmaker / Hotel Letters (matches ref_01_quai_general_guisan.jpg!)
// Blue Alpine sky shines right through the open iron rooftop rail & sculpted silhouette typography!
function createSkylineCutoutTexture(label, sub, theme, { twinCrowns = false } = {}) {
  const w = 1024;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  // Subtle horizontal dark wrought-iron structural mounting bars behind the skyline letters (just like Rolex & Patek in ref_01!)
  ctx.fillStyle = '#1e2329';
  ctx.fillRect(36, 178, w - 72, 10);
  ctx.fillRect(36, 114, w - 72, 6);
  for (let x = 70; x <= w - 70; x += 110) {
    ctx.fillRect(x, 114, 7, 134);
  }

  // Optional iconic twin 5-point golden Geneva crowns flanking ROLEX (exact match to ref_01_quai_general_guisan.jpg!)
  function drawGoldCrown(cx, cy, s = 1.0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = '#ecc85c';
    ctx.strokeStyle = '#6e4e10';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-44, 34);
    ctx.lineTo(-56, -16);
    ctx.lineTo(-24, 8);
    ctx.lineTo(0, -34);
    ctx.lineTo(24, 8);
    ctx.lineTo(56, -16);
    ctx.lineTo(44, 34);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 5 crown jewel pearls
    for (const [px, py] of [[-56, -22], [-28, -28], [0, -40], [28, -28], [56, -22]]) {
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const display = label.toUpperCase();
  const isShort = display.length <= 10;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = isShort ? 'bold 118px Georgia, serif' : display.length <= 16 ? 'bold 88px Georgia, serif' : 'bold 64px Georgia, serif';

  // Crisp metallic drop-outline + gleaming white/gold face so silhouette letters pop against bright blue sky AND clouds!
  ctx.lineWidth = 11;
  ctx.strokeStyle = '#1a1d22';
  const textY = sub ? 132 : 144;
  ctx.strokeText(display, w * 0.5, textY, twinCrowns ? w - 320 : w - 100);
  ctx.fillStyle = twinCrowns ? '#f7f4ec' : theme.fg;
  ctx.fillText(display, w * 0.5, textY, twinCrowns ? w - 320 : w - 100);

  if (twinCrowns) {
    drawGoldCrown(106, 134, 1.05);
    drawGoldCrown(w - 106, 134, 1.05);
  }

  if (sub) {
    ctx.font = 'bold 30px "Helvetica Neue", Arial, sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#161a20';
    ctx.strokeText(sub.toUpperCase(), w * 0.5, 206, w - 140);
    ctx.fillStyle = '#f0d894';
    ctx.fillText(sub.toUpperCase(), w * 0.5, 206, w - 140);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

function drawFasciaTile(ctx, ox, oy, w, h, label, sub, theme) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.border;
  ctx.lineWidth = 4;
  ctx.strokeRect(5, 5, w - 10, h - 10);

  // Draw optional golden 5-point watchmaker crown above Rolex / Swiss luxury marque
  let textY = sub ? h * 0.52 : h * 0.65;
  if (theme.crown) {
    ctx.fillStyle = theme.fg;
    const cx = w * 0.5;
    const cy = 26;
    ctx.beginPath();
    ctx.moveTo(cx - 18, cy + 8);
    ctx.lineTo(cx - 22, cy - 8);
    ctx.lineTo(cx - 9, cy + 1);
    ctx.lineTo(cx, cy - 12);
    ctx.lineTo(cx + 9, cy + 1);
    ctx.lineTo(cx + 22, cy - 8);
    ctx.lineTo(cx + 18, cy + 8);
    ctx.closePath();
    ctx.fill();
    textY = h * 0.74;
  }

  ctx.fillStyle = theme.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = theme.font;
  const display = label.toUpperCase();
  const maxW = w - 36;
  ctx.fillText(display, w * 0.5, textY, maxW);

  if (sub) {
    ctx.fillStyle = theme.fg;
    ctx.globalAlpha = 0.82;
    ctx.font = '600 15px "Helvetica Neue", sans-serif';
    ctx.fillText(sub.toUpperCase(), w * 0.5, h * 0.83, maxW);
    ctx.globalAlpha = 1.0;
  }
  ctx.restore();
}

// Iconic Geneva blue enamel street sign plaque ('Plaque de rue de Genève') drawn into shared plaque atlas!
function drawStreetPlaqueTile(ctx, ox, oy, w, h, streetName, district = 'VILLE DE GENÈVE') {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(w / 512, h / 176);
  // Classic cobalt Geneva enamel blue
  ctx.fillStyle = '#133a7c';
  ctx.fillRect(0, 0, 512, 176);
  // Crisp white rounded double border
  ctx.strokeStyle = '#f2f5fa';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 160);
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 476, 140);

  // Small top Canton/City header
  ctx.fillStyle = '#c8daf5';
  ctx.font = '600 18px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(district, 256, 48);

  // Bold white Geneva street title (split neatly onto 2 lines if long)
  ctx.fillStyle = '#ffffff';
  const upper = streetName.toUpperCase();
  const words = upper.split(' ');
  if (upper.length > 16 && words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    ctx.font = 'bold 38px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(words.slice(0, mid).join(' '), 256, 98, 444);
    ctx.fillText(words.slice(mid).join(' '), 256, 140, 444);
  } else {
    ctx.font = 'bold 42px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(upper, 256, 118, 448);
  }
  ctx.restore();
}

function remapPlaneAtlasUV(planeGeo, u0, v0, u1, v1) {
  const uv = planeGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  }
  uv.needsUpdate = true;
}

/**
 * Mounts real 1:1 Geneva rooftop watchmaker/grand-hotel skyline signs, street-level luxury boutique
 * fascia signs from OpenStreetMap (geneva-real-places.json), and iconic blue enamel Geneva street plaques!
 */
export function buildGenevaIdentity(worldGroup, realData, realPlacesData, swiss3D = null) {
  const identityGroup = new THREE.Group();
  identityGroup.name = 'Geneva_Real_Identity_Signage';
  worldGroup.add(identityGroup);

  // Keep iconic skyline rooftop watchmakers separate from street-level signage so Lac Léman STILL reflects Rolex/Patek/Métropole!
  const rooftopGroup = new THREE.Group();
  rooftopGroup.name = 'Geneva_Rooftop_Watchmakers';
  identityGroup.add(rooftopGroup);

  const streetSignGroup = new THREE.Group();
  streetSignGroup.name = 'Geneva_Street_Signs_Batched';
  identityGroup.add(streetSignGroup);

  const emissiveSignMats = [];

  // Pre-index all building footprints with clockwise-oriented outward edge normals for zero-clipping facade snapping!
  const bldIndex = [];
  for (const b of realData.buildings || []) {
    if (!b.p || b.p.length < 3) continue;
    const area = polygonSignedArea(b.p);
    if (Math.abs(area) < 12) continue;
    const poly = area > 0 ? b.p.slice().reverse() : b.p;
    let cx = 0, cz = 0, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of poly) {
      cx += px; cz += pz;
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    cx /= poly.length;
    cz /= poly.length;
    bldIndex.push({ poly, cx, cz, minX, maxX, minZ, maxZ, h: b.h || 16 });
  }

  // Pre-index street segments for finding the exact street-facing side of any building!
  const roadSegs = [];
  for (const r of realData.roads || []) {
    if (!r.p || r.p.length < 2) continue;
    for (let i = 0; i < r.p.length - 1; i++) {
      roadSegs.push([r.p[i][0], r.p[i][1], r.p[i + 1][0], r.p[i + 1][1]]);
    }
  }

  function nearestRoadPoint(px, pz) {
    let bestD = 90;
    let bestPt = null;
    for (let i = 0; i < roadSegs.length; i++) {
      const [x1, z1, x2, z2] = roadSegs[i];
      if (px < Math.min(x1, x2) - bestD || px > Math.max(x1, x2) + bestD) continue;
      if (pz < Math.min(z1, z2) - bestD || pz > Math.max(z1, z2) + bestD) continue;
      const vx = x2 - x1, vz = z2 - z1;
      const l2 = vx * vx + vz * vz;
      if (l2 < 0.25) continue;
      const t = Math.max(0, Math.min(1, ((px - x1) * vx + (pz - z1) * vz) / l2));
      const rx = x1 + t * vx;
      const rz = z1 + t * vz;
      const d = Math.hypot(px - rx, pz - rz);
      if (d < bestD) {
        bestD = d;
        bestPt = [rx, rz];
      }
    }
    return bestPt;
  }

  // Snap a real GPS POI onto the exact street-facing exterior facade edge of its real Geneva building!
  function snapToStreetFacade(px, pz, outOffset = 0.42) {
    // 1. Find containing or nearest building within 24m
    let bestB = null;
    let bestBD = 24;
    for (let i = 0; i < bldIndex.length; i++) {
      const b = bldIndex[i];
      if (px < b.minX - bestBD || px > b.maxX + bestBD || pz < b.minZ - bestBD || pz > b.maxZ + bestBD) continue;
      const d = Math.hypot(b.cx - px, b.cz - pz);
      if (d < bestBD + 18) {
        // Compute minimum edge distance
        let minEdgeD = 1e9;
        for (let k = 0; k < b.poly.length; k++) {
          const [x1, z1] = b.poly[k];
          const [x2, z2] = b.poly[(k + 1) % b.poly.length];
          const ed = distToSegment(px, pz, x1, z1, x2, z2);
          if (ed < minEdgeD) minEdgeD = ed;
        }
        if (minEdgeD < bestBD) {
          bestBD = minEdgeD;
          bestB = b;
        }
      }
    }
    if (!bestB) return null;

    const roadPt = nearestRoadPoint(px, pz);
    // 2. Choose the exterior edge of bestB that best faces the road and is closest to (px, pz)
    let bestEdge = null;
    let bestScore = Infinity;
    for (let k = 0; k < bestB.poly.length; k++) {
      const [x1, z1] = bestB.poly[k];
      const [x2, z2] = bestB.poly[(k + 1) % bestB.poly.length];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 3.8) continue;
      const nx = -dz / len;
      const nz = dx / len;
      const t = Math.max(0.18, Math.min(0.82, ((px - x1) * dx + (pz - z1) * dz) / (len * len)));
      const ex = x1 + dx * t;
      const ez = z1 + dz * t;
      const dToPoi = Math.hypot(ex - px, ez - pz);
      let roadPenalty = 0;
      if (roadPt) {
        const toRoadX = roadPt[0] - ex;
        const toRoadZ = roadPt[1] - ez;
        const rLen = Math.hypot(toRoadX, toRoadZ) || 1;
        const align = (nx * toRoadX + nz * toRoadZ) / rLen;
        if (align < 0.1) roadPenalty += 18;
        roadPenalty += Math.min(18, rLen * 0.4);
      }
      const score = dToPoi + roadPenalty;
      if (score < bestScore) {
        bestScore = score;
        bestEdge = { ex, ez, nx, nz, len, bld: bestB };
      }
    }
    if (!bestEdge) return null;
    return {
      x: bestEdge.ex + bestEdge.nx * outOffset,
      z: bestEdge.ez + bestEdge.nz * outOffset,
      nx: bestEdge.nx,
      nz: bestEdge.nz,
      yaw: Math.atan2(bestEdge.nx, bestEdge.nz),
      edgeLen: bestEdge.len,
      bld: bestEdge.bld,
    };
  }

  // =================================================================================================
  // 1. ICONIC REAL GENEVA ROOFTOP SKYLINE WATCHMAKERS & GRAND HOTELS (Zero floating — bolted to real rooftops!)
  // =================================================================================================
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x22272d, roughness: 0.42, metalness: 0.78 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xd9b25f, roughness: 0.28, metalness: 0.85 });

  const rooftopLandmarks = [
    // Rive Gauche — Quai du Général-Guisan & Rue du Rhône (Sky-transparent silhouette letters matching ref_01_quai_general_guisan.jpg!)
    { label: 'ROLEX', sub: '', x: 52.0, z: 256.0, yaw: -2.62, width: 15.6, height: 3.9, twinCrowns: true, theme: getBrandTheme('ROLEX', 'watch') },
    { label: 'PATEK PHILIPPE', sub: 'GENÈVE', x: -38.0, z: 231.6, yaw: -2.62, width: 15.8, height: 3.7, hasClock: true, theme: { bg: 'transparent', fg: '#f2d992', border: '#cfa95c' } },
    { label: 'MONTBLANC', sub: '', x: 118.0, z: 278.0, yaw: -2.62, width: 12.8, height: 3.2, theme: { bg: 'transparent', fg: '#f4f2ec', border: '#c8c4bc' } },
    { label: 'HÔTEL MÉTROPOLE', sub: 'GENÈVE · ★★★★★', x: 157.1, z: 293.2, yaw: -2.62, width: 16.5, height: 3.5, theme: getBrandTheme('HÔTEL MÉTROPOLE', 'hotel') },
    { label: 'BUCHERER', sub: '1888', x: -9.2, z: 250.5, yaw: -2.62, width: 12.8, height: 3.2, theme: getBrandTheme('BUCHERER', 'watch') },
    { label: 'CHOPARD', sub: 'GENÈVE', x: -102.0, z: 218.0, yaw: -2.62, width: 12.4, height: 3.1, theme: getBrandTheme('CHOPARD', 'watch') },
    { label: 'GLOBUS', sub: '', x: -219.6, z: 253.9, yaw: 0.52, width: 12.4, height: 3.2, theme: getBrandTheme('GLOBUS', 'dept') },
    { label: 'BONGÉNIE', sub: 'GENÈVE', x: -231.6, z: 330.6, yaw: 0.42, width: 13.0, height: 3.2, theme: getBrandTheme('BONGÉNIE', 'dept') },
    { label: 'UBS', sub: '', x: 86.0, z: 266.0, yaw: -2.62, width: 10.6, height: 3.2, theme: { bg: 'transparent', fg: '#e62222', border: '#ffffff' } },
    // Rive Droite — Quai des Bergues & Quai du Mont-Blanc Grand Hotels!
    { label: 'FOUR SEASONS', sub: 'HÔTEL DES BERGUES', x: -235.0, z: -124.0, yaw: 0.48, width: 15.8, height: 3.6, theme: getBrandTheme('FOUR SEASONS', 'hotel') },
    { label: 'HÔTEL BEAU-RIVAGE', sub: 'GENÈVE · 1865', x: -13.6, z: -360.7, yaw: 0.92, width: 16.4, height: 3.6, theme: getBrandTheme('HÔTEL BEAU-RIVAGE', 'hotel') },
    { label: 'FAIRMONT GRAND HOTEL', sub: 'GENEVA', x: 49.9, z: -478.4, yaw: 0.92, width: 17.2, height: 3.5, theme: getBrandTheme('FAIRMONT', 'hotel') },
    { label: 'MANOR', sub: '', x: -555.9, z: -140.3, yaw: 1.55, width: 13.2, height: 3.4, theme: { bg: 'transparent', fg: '#df2232', border: '#ffffff' } },
    // Place de Neuve Cultural Institutions!
    { label: 'GRAND THÉÂTRE DE GENÈVE', sub: 'OPÉRA', x: -562.0, z: 482.0, yaw: 1.15, width: 16.2, height: 3.2, theme: { bg: 'transparent', fg: '#f3d991', border: '#c7a45a' } },
    { label: 'MUSÉE RATH', sub: 'BEAUX-ARTS', x: -508.0, z: 472.0, yaw: 0.35, width: 12.2, height: 2.8, theme: { bg: 'transparent', fg: '#f4e3b8', border: '#c9aa66' } },
  ];

  const rooftopEntries = [];
  for (const rs of rooftopLandmarks) {
    // Match actual OSM building fallback height
    let fallbackTopY = getGroundHeight(rs.x, rs.z) + 18.5;
    let bestD = 36;
    let bx = rs.x, bz = rs.z;
    for (const b of bldIndex) {
      if (b.h < 10) continue;
      const d = Math.hypot(b.cx - rs.x, b.cz - rs.z);
      if (d < bestD) {
        bestD = d;
        bx = b.cx;
        bz = b.cz;
        fallbackTopY = getGroundHeight(b.cx, b.cz) + b.h;
      }
    }
    const realRoofY = swiss3D?.getRealRoofHeight?.(bx, bz, 14);
    const roofY = realRoofY !== null && realRoofY !== undefined ? realRoofY : fallbackTopY;

    // Sky-transparent cutout silhouette texture — zero ugly billboard box blocking the Alpine sky!
    const tex = createSkylineCutoutTexture(rs.label, rs.sub, rs.theme, { twinCrowns: Boolean(rs.twinCrowns) });
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.36,
      emissive: new THREE.Color(rs.theme.fg || '#f0d58c'),
      emissiveMap: tex,
      emissiveIntensity: 0.24,
      roughness: 0.30,
      metalness: 0.55,
      side: THREE.DoubleSide,
    });
    emissiveSignMats.push(mat);

    const sg = new THREE.Group();
    sg.position.set(bx, roofY, bz);
    sg.rotation.y = rs.yaw;

    // Slender dark wrought-iron rooftop support struts bolting firmly into the real swisstopo roof!
    const legH = rs.height + 2.4;
    for (const lx of [-rs.width * 0.38, 0, rs.width * 0.38]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, legH, 0.14), steelMat);
      leg.position.set(lx, legH * 0.5 - 2.3, -0.10);
      sg.add(leg);
    }

    const board = new THREE.Mesh(new THREE.PlaneGeometry(rs.width, rs.height), mat);
    board.position.set(0, rs.height * 0.5 + 0.15, 0);
    board.castShadow = true;
    sg.add(board);

    // Iconic Patek Philippe Rue du Rhône carved pale-stone arched rooftop clock pediment (exact match to ref_01!)
    if (rs.hasClock) {
      const pedStone = new THREE.MeshStandardMaterial({ color: 0xcbc4b5, roughness: 0.78 });
      const pedArch = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, 0.55, 22).rotateX(Math.PI / 2), pedStone);
      pedArch.position.set(0, rs.height + 1.15, -0.05);
      const pedBase = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.35, 0.52), pedStone);
      pedBase.position.set(0, rs.height + 0.32, -0.05);
      const pedRing = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.12, 10, 22), goldTrimMat);
      pedRing.position.set(0, rs.height + 1.18, 0.24);
      const dialC = document.createElement('canvas');
      dialC.width = 256;
      dialC.height = 256;
      const dctx = dialC.getContext('2d');
      dctx.fillStyle = '#f2ede0';
      dctx.beginPath();
      dctx.arc(128, 128, 124, 0, Math.PI * 2);
      dctx.fill();
      dctx.strokeStyle = '#2a2722';
      dctx.lineWidth = 10;
      dctx.stroke();
      for (let h = 0; h < 12; h++) {
        const a = (h / 12) * Math.PI * 2;
        dctx.strokeStyle = '#1d1c19';
        dctx.lineWidth = h % 3 === 0 ? 8 : 4;
        dctx.beginPath();
        dctx.moveTo(128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86);
        dctx.lineTo(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108);
        dctx.stroke();
      }
      // Classic 10:10 watchmaker hands!
      dctx.strokeStyle = '#181818';
      dctx.lineWidth = 9;
      dctx.beginPath();
      dctx.moveTo(128, 128);
      dctx.lineTo(74, 92);
      dctx.moveTo(128, 128);
      dctx.lineTo(186, 86);
      dctx.stroke();
      const dTex = new THREE.CanvasTexture(dialC);
      dTex.colorSpace = THREE.SRGBColorSpace;
      const dMat = new THREE.MeshStandardMaterial({
        map: dTex,
        emissive: 0xffe4a0,
        emissiveMap: dTex,
        emissiveIntensity: 0.25,
        roughness: 0.2,
      });
      emissiveSignMats.push(dMat);
      const dFront = new THREE.Mesh(new THREE.CircleGeometry(1.16, 22), dMat);
      dFront.position.set(0, rs.height + 1.18, 0.26);
      const dBack = new THREE.Mesh(new THREE.CircleGeometry(1.16, 22), dMat);
      dBack.rotation.y = Math.PI;
      dBack.position.set(0, rs.height + 1.18, -0.34);
      sg.add(pedArch, pedBase, pedRing, dFront, dBack);
    }

    rooftopGroup.add(sg);
    rooftopEntries.push({ group: sg, bx, bz, fallbackTopY });
  }

  // Re-snap any outer rooftop signs (e.g. Beau-Rivage, Fairmont, Grand Théâtre, Manor) as soon as Phase-2 outer swissBUILDINGS3D tiles finish!
  if (swiss3D?.remainingDone) {
    swiss3D.remainingDone.then(() => {
      for (const e of rooftopEntries) {
        const ry = swiss3D.getRealRoofHeight(e.bx, e.bz, 14);
        if (ry !== null && ry !== undefined) e.group.position.y = ry;
      }
    });
  }

  // =================================================================================================
  // 2. REAL STREET-LEVEL LUXURY BOUTIQUE & SHOPFRONT FASCIA SIGNS (FROM OPENSTREETMAP REAL ADDRESSES!)
  // =================================================================================================
  const placedSigns = [];
  const awningMatCache = new Map();
  // Curated flagship street-level storefronts directly on Quai du Général-Guisan & Place du Molard so spawn corners feel 100% authentic!
  const curatedFlagships = [
    { name: 'Rolex', category: 'watch', x: 52.0, z: 235.0, street: 'Quai du Général-Guisan', num: '28' },
    { name: 'Patek Philippe', category: 'watch', x: -34.0, z: 206.0, street: 'Rue du Rhône', num: '41' },
    { name: 'Hôtel Métropole', category: 'hotel', x: 148.0, z: 274.0, street: 'Quai du Général-Guisan', num: '34' },
    { name: 'Bucherer', category: 'watch', x: 8.0, z: 222.0, street: 'Quai du Général-Guisan', num: '24' },
    { name: 'UBS', category: 'bank', x: 96.0, z: 258.0, street: 'Quai du Général-Guisan', num: '30' },
    { name: 'Vacheron Constantin', category: 'watch', x: -78.0, z: 186.0, street: 'Quai du Général-Guisan', num: '16' },
    { name: 'Globus', category: 'dept', x: -195.0, z: 248.0, street: 'Rue du Rhône', num: '48' },
  ];
  const rawPlaces = [...curatedFlagships, ...(realPlacesData?.places || [])];

  // Prioritize Geneva's iconic luxury watchmakers, fashion houses, grand hotels, department stores & Swiss banks first!
  const priorityWeight = (p) => {
    const n = p.name;
    if (/rolex|patek|cartier|hermès|hermes|louis vuitton|dior|chanel|omega|bucherer|chopard|piaget|blancpain|tiffany|prada|gucci|bongénie|bongenie|globus|manor|métropole|metropole|beau-rivage|fairmont|apple|fnac|migros|coop|ubs/i.test(n)) {
      return 0;
    }
    if (p.category === 'watch' || p.category === 'dept') return 1;
    if (p.category === 'hotel' || p.category === 'bank') return 2;
    return 3;
  };

  // Focus street-level fascia signs inside the prime walkable Geneva districts (Quais, Rue du Rhône, Molard, Vieille-Ville, Place de Neuve, Pâquis)
  const candidates = rawPlaces
    .filter((p) => {
      if (p.category === 'fountain' || p.category === 'landmark') return false;
      if (p.name.length < 3 || p.name.length > 28) return false;
      if (/horloge|paix de vienne|colombe/i.test(p.name)) return false;
      // Keep within walkable central Geneva radius
      return p.x > -620 && p.x < 320 && p.z > -520 && p.z < 640;
    })
    .sort((a, b) => priorityWeight(a) - priorityWeight(b));

  const MAX_STREET_SIGNS = 68;
  // Pack all 68 boutique fascia graphics into ONE crisp 2048x2048 Canvas atlas (4 cols x 17 rows = 512x120 px/sign -> 1 draw call!)
  const F_COLS = 4;
  const F_ROWS = 17;
  const F_CELL_W = 512;
  const F_CELL_H = 120;
  const fasciaAtlasCan = document.createElement('canvas');
  fasciaAtlasCan.width = F_COLS * F_CELL_W; // 2048
  fasciaAtlasCan.height = F_ROWS * F_CELL_H; // 2040
  const fasciaAtlasCtx = fasciaAtlasCan.getContext('2d');
  fasciaAtlasCtx.fillStyle = '#181c22';
  fasciaAtlasCtx.fillRect(0, 0, fasciaAtlasCan.width, fasciaAtlasCan.height);
  const fasciaAtlasTex = new THREE.CanvasTexture(fasciaAtlasCan);
  fasciaAtlasTex.colorSpace = THREE.SRGBColorSpace;
  fasciaAtlasTex.anisotropy = 8;
  const fasciaAtlasMat = new THREE.MeshStandardMaterial({
    map: fasciaAtlasTex,
    emissive: new THREE.Color(0xfff4dc),
    emissiveMap: fasciaAtlasTex,
    emissiveIntensity: 0.16,
    roughness: 0.34,
    metalness: 0.25,
  });
  emissiveSignMats.push(fasciaAtlasMat);

  for (const p of candidates) {
    if (placedSigns.length >= MAX_STREET_SIGNS) break;
    // Keep clean breathing spacing so neighboring boutique signs never overlap!
    if (placedSigns.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 11.5)) continue;

    const snap = snapToStreetFacade(p.x, p.z, 0.24);
    if (!snap || snap.edgeLen < 5.2) continue;
    if (placedSigns.some((s) => Math.hypot(s.x - snap.x, s.z - snap.z) < 9.0)) continue;

    const tileIdx = placedSigns.length;
    const col = tileIdx % F_COLS;
    const row = Math.floor(tileIdx / F_COLS);
    const ox = col * F_CELL_W;
    const oy = row * F_CELL_H;

    const theme = getBrandTheme(p.name, p.category);
    // Keep every fascia & awning strictly inside its real building facade edge (zero corner overhang!)
    const signW = Math.min(Math.max(3.6, snap.edgeLen * 0.40), Math.min(7.4, snap.edgeLen * 0.78));
    const signH = 0.88;
    const baseY = getGroundHeight(snap.x + snap.nx * 1.1, snap.z + snap.nz * 1.1);

    drawFasciaTile(
      fasciaAtlasCtx,
      ox,
      oy,
      F_CELL_W,
      F_CELL_H,
      p.name,
      p.street ? `${p.street}${p.num ? ' ' + p.num : ''}` : '',
      theme
    );

    const fg = new THREE.Group();
    fg.position.set(snap.x, baseY + 4.35, snap.z);
    fg.rotation.y = snap.yaw;

    // Single-material backing box + UV-mapped atlas front face -> ALL 68 signs collapse into 2 draw calls total!
    const backing = new THREE.Mesh(new THREE.BoxGeometry(signW, signH, 0.44), steelMat);
    const faceGeo = new THREE.PlaneGeometry(signW * 0.99, signH * 0.99);
    const u0 = (ox + 2) / fasciaAtlasCan.width;
    const u1 = (ox + F_CELL_W - 2) / fasciaAtlasCan.width;
    const v1 = 1.0 - (oy + 2) / fasciaAtlasCan.height;
    const v0 = 1.0 - (oy + F_CELL_H - 2) / fasciaAtlasCan.height;
    remapPlaneAtlasUV(faceGeo, u0, v0, u1, v1);
    const face = new THREE.Mesh(faceGeo, fasciaAtlasMat);
    face.position.z = 0.224;
    fg.add(backing, face);

    // Tailored Swiss boutique fabric awning flush against the building facade (batched cleanly via shared material palette!)
    const awColorHex = theme.awning || 0x1c2832;
    let awMat = awningMatCache.get(awColorHex);
    if (!awMat) {
      awMat = new THREE.MeshStandardMaterial({ color: awColorHex, roughness: 0.88, side: THREE.DoubleSide });
      awningMatCache.set(awColorHex, awMat);
    }
    const awTop = new THREE.Mesh(new THREE.BoxGeometry(signW * 0.96, 0.06, 1.05), awMat);
    awTop.position.set(0, -0.68, 0.48);
    awTop.rotation.x = 0.34;
    const awValance = new THREE.Mesh(new THREE.BoxGeometry(signW * 0.96, 0.22, 0.05), awMat);
    awValance.position.set(0, -0.96, 0.96);
    fg.add(awTop, awValance);

    streetSignGroup.add(fg);
    placedSigns.push({ x: snap.x, z: snap.z, name: p.name });
  }
  fasciaAtlasTex.needsUpdate = true;

  // =================================================================================================
  // 3. ICONIC BLUE ENAMEL GENEVA STREET NAME PLAQUES ('PLAQUES DE RUE DE GENÈVE') — 1 ATLAS DRAW CALL!
  // =================================================================================================
  const streetPlaques = [
    { name: 'Quai du Général-Guisan', x: -16, z: 162, district: 'LA RADE · GENÈVE' },
    { name: 'Quai du Général-Guisan', x: 96, z: 224, district: 'JARDIN ANGLAIS' },
    { name: 'Rue du Rhône', x: -45, z: 225, district: 'RUES-BASSES' },
    { name: 'Rue du Rhône', x: -128, z: 215, district: 'RUES-BASSES' },
    { name: 'Place du Molard', x: -152, z: 242, district: 'CENTRE HISTORIQUE' },
    { name: 'Rue du Marché', x: -206, z: 282, district: 'RUES-BASSES' },
    { name: 'Quai du Mont-Blanc', x: -135, z: -165, district: 'RIVE DROITE' },
    { name: 'Quai du Mont-Blanc', x: -58, z: -268, district: 'SQUARE DES ALPES' },
    { name: 'Quai des Bergues', x: -232, z: -102, district: 'RIVE DROITE' },
    { name: 'Place de Neuve', x: -512, z: 478, district: 'QUARTIER DES ARTS' },
    { name: 'Cour de Saint-Pierre', x: -155, z: 536, district: 'VIEILLE-VILLE' },
    { name: 'Place du Bourg-de-Four', x: -64, z: 626, district: 'VIEILLE-VILLE' },
    { name: 'Promenade des Bastions', x: -348, z: 615, district: 'PARC DES BASTIONS' },
    { name: 'Rue de Rive', x: 18, z: 410, district: 'RIVE · GENÈVE' },
  ];

  const P_COLS = 2;
  const P_ROWS = 7;
  const P_CELL_W = 512;
  const P_CELL_H = 146;
  const plaqueAtlasCan = document.createElement('canvas');
  plaqueAtlasCan.width = P_COLS * P_CELL_W; // 1024
  plaqueAtlasCan.height = P_ROWS * P_CELL_H; // 1022
  const plaqueAtlasCtx = plaqueAtlasCan.getContext('2d');
  plaqueAtlasCtx.fillStyle = '#133a7c';
  plaqueAtlasCtx.fillRect(0, 0, plaqueAtlasCan.width, plaqueAtlasCan.height);
  const plaqueAtlasTex = new THREE.CanvasTexture(plaqueAtlasCan);
  plaqueAtlasTex.colorSpace = THREE.SRGBColorSpace;
  plaqueAtlasTex.anisotropy = 8;
  const plaqueAtlasMat = new THREE.MeshStandardMaterial({
    map: plaqueAtlasTex,
    roughness: 0.24,
    metalness: 0.18,
  });

  let plaqueIdx = 0;
  for (const sp of streetPlaques) {
    const snap = snapToStreetFacade(sp.x, sp.z, 0.34);
    if (!snap) continue;
    const baseY = getGroundHeight(snap.x + snap.nx * 0.9, snap.z + snap.nz * 0.9);
    const col = plaqueIdx % P_COLS;
    const row = Math.floor(plaqueIdx / P_COLS);
    const ox = col * P_CELL_W;
    const oy = row * P_CELL_H;
    drawStreetPlaqueTile(plaqueAtlasCtx, ox, oy, P_CELL_W, P_CELL_H, sp.name, sp.district);

    const pg = new THREE.Group();
    pg.position.set(snap.x, baseY + 3.45, snap.z);
    pg.rotation.y = snap.yaw;
    const pBack = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.50, 0.06), steelMat);
    const pFaceGeo = new THREE.PlaneGeometry(1.40, 0.49);
    const u0 = (ox + 2) / plaqueAtlasCan.width;
    const u1 = (ox + P_CELL_W - 2) / plaqueAtlasCan.width;
    const v1 = 1.0 - (oy + 2) / plaqueAtlasCan.height;
    const v0 = 1.0 - (oy + P_CELL_H - 2) / plaqueAtlasCan.height;
    remapPlaneAtlasUV(pFaceGeo, u0, v0, u1, v1);
    const pFace = new THREE.Mesh(pFaceGeo, plaqueAtlasMat);
    pFace.position.z = 0.034;
    pg.add(pBack, pFace);
    streetSignGroup.add(pg);
    plaqueIdx++;
  }
  plaqueAtlasTex.needsUpdate = true;

  // Merge all 68 boutique signs, 136 awnings & 14 enamel street plaques (~550 draw calls -> ~10 draw calls!)
  batchStaticGroup(streetSignGroup, { label: 'GenevaStreetSignsBatch' });

  function updateNight(nightFactor) {
    const glow = Math.max(0, (nightFactor - 0.22) / 0.78);
    const target = 0.14 + glow * 1.15;
    for (let i = 0; i < emissiveSignMats.length; i++) {
      emissiveSignMats[i].emissiveIntensity = target;
    }
  }

  return { group: identityGroup, streetGroup: streetSignGroup, rooftopGroup, placedCount: placedSigns.length, updateNight };
}
