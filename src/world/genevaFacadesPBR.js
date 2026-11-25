import * as THREE from 'three';

// =================================================================================================
// 1:1 REAL GENEVA PHOTO-MATCHED PBR ARCHITECTURAL FACADE ARRAY BUILDER (WebGL2 DataArrayTexture)
// 12 authentic Geneva architectural layers (8 Upper-Story Styles + 4 Street-Level Ground Styles):
//   0: Quai Ivory Belle Epoque (Rolex / Bucherer / Four Seasons Hotel des Bergues - ref_01)
//   1: Quai Pale Silver-Grey Dressed Ashlar (Hermes / Chanel Quai du General-Guisan - ref_01)
//   2: Patek Philippe / Hotel Metropole Wide-Bay Grand Watch Palace (ref_01)
//   3: Rue du Rhone Off-White Modernist Concrete & Huge Reflective Glass Grid (Cartier - ref_03)
//   4: Fairmont Grand Hotel / UBS Contemporary Travertine & Curtain-Wall Glass (real_quai_1, ref_03/04)
//   5: Place du Bourg-de-Four / Vieille-Ville Molasse Limestone & White Louvered Shutters (real_oldtown_1)
//   6: Vieille-Ville Warm Ochre Lime-Plaster & Heritage Olive-Slate Shutters
//   7: Grand-Rue / Maison Tavel / Monumental Weathered Molasse Stone & Mullioned Windows (grandrue_1)
//   8: Ground 0 - Quai & Rue du Rhone Semi-Circular Arched Stone Luxury Arcades (ref_01 Bucherer/Hermes)
//   9: Ground 1 - Rue du Rhone Modern Luxury Limestone & Bronze Glass Boutiques (ref_03 Dior/Cartier)
//  10: Ground 2 - Vieille-Ville & Molard Rusticated Stone, Oak Brasserie & Arched Porte Cochere (real_oldtown_1/2)
//  11: Ground 3 - Fairmont / Swiss Bank / Lakeside Glass Conservatory Pavilion (real_quai_1)
// =================================================================================================

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function seededRand(seed) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Organic micro-grained mineral limestone/plaster base (NEVER uses vertical-seam concrete panels!)
function paintMineralStone(ctx, hctx, W, H, baseRgb, rand, {
  ashlarImg = null,
  ashlarAlpha = 0.0,
  courseH = 32,
  jointAlpha = 0.11,
  blockW = 128,
  plasterMottle = 0.06,
} = {}) {
  const [br, bg, bb] = baseRgb;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, W, H);
  hctx.fillStyle = '#a4a4a4';
  hctx.fillRect(0, 0, W, H);

  // Subtle organic multi-scale limestone / lime-plaster mottling (no harsh rectangles!)
  for (let i = 0; i < 360; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const rad = 18 + rand() * 88;
    const warm = rand() > 0.5;
    const gr = ctx.createRadialGradient(x, y, 2, x, y, rad);
    const a = plasterMottle * (0.35 + rand() * 0.65);
    gr.addColorStop(0, warm ? `rgba(255,250,240,${a})` : `rgba(38,34,28,${a * 0.9})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  // Optional real Poly Haven photographed ashlar stone blend for medieval / rustic Geneva molasse
  if (ashlarImg && ashlarAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = ashlarAlpha;
    for (let y = 0; y < H; y += 512) {
      for (let x = 0; x < W; x += 512) {
        ctx.drawImage(ashlarImg, x, y, 512, 512);
      }
    }
    ctx.restore();
    // Re-harmonize towards target Swiss molasse stone hue
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Fine mineral grain speckles
  for (let i = 0; i < 2400; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const s = 1 + rand() * 2.2;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,252,246,0.06)' : 'rgba(28,24,20,0.065)';
    ctx.fillRect(x, y, s, s);
  }

  // Subtle dressed Geneva molasse ashlar coursing with per-block micro-tonal variation!
  if (courseH > 0 && jointAlpha > 0) {
    for (let y = 0; y < H; y += courseH) {
      const off = ((Math.round(y / courseH) % 2) * blockW) * 0.5;
      for (let x = -blockW; x < W + blockW; x += blockW) {
        const bx = x + off;
        const delta = (rand() - 0.5) * 10;
        ctx.fillStyle = delta > 0 ? `rgba(255,252,245,${delta * 0.0045})` : `rgba(24,20,16,${-delta * 0.005})`;
        ctx.fillRect(bx + 1, y + 1, blockW - 2, courseH - 2);
      }
    }
    ctx.fillStyle = `rgba(40,36,30,${jointAlpha})`;
    hctx.fillStyle = '#868686';
    for (let y = 0; y < H; y += courseH) {
      ctx.fillRect(0, y, W, 1.5);
      hctx.fillRect(0, y, W, 2);
      const off = ((Math.round(y / courseH) % 2) * blockW) * 0.5;
      for (let x = off; x < W; x += blockW) {
        ctx.fillRect(x, y, 1.5, courseH);
        hctx.fillRect(x, y, 2, courseH);
      }
    }
  }
}

// Draw a photorealistic recessed European architectural window with razor-thin frames,
// realistic dark reflective glass, varied curtains/blinds, subtle room depth & clean PBR masks!
function drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
  wx, wy, ww, wh,
  arched = false,
  frameCol = '#2a2e34',
  frameW = 2.5,
  mullionV = 1,      // 1 = classic French double casement, 2 = triple atelier window, 0 = single modern pane
  mullionH = 1,      // 1 = upper transom bar
  blindsProb = 0.35,
  curtainProb = 0.45,
  litProb = 0.46,
  recessDepth = 7,
  glassTint = 'classic', // 'classic' | 'modern_teal' | 'warm_shop'
}) {
  ctx.save();
  const clipShape = (targetCtx, inset = 0) => {
    const x = wx + inset, y = wy + inset, w = ww - inset * 2, h = wh - inset * 2;
    targetCtx.beginPath();
    if (arched) {
      const r = w * 0.5;
      targetCtx.arc(x + r, y + r, r, Math.PI, 0, false);
      targetCtx.lineTo(x + w, y + h);
      targetCtx.lineTo(x, y + h);
      targetCtx.closePath();
    } else {
      targetCtx.rect(x, y, w, h);
    }
  };

  // 1. Deep architectural stone reveal cavity (casts natural soft top & side interior shadow)
  clipShape(ctx, 0);
  ctx.fillStyle = '#090d12';
  ctx.fill();
  clipShape(hctx, 0);
  hctx.fillStyle = '#121212';
  hctx.fill();

  // Clip interior glazing inside reveal
  clipShape(ctx, 3);
  ctx.clip();

  // 2. Photorealistic dark reflective architectural glass base (NOT flat black — subtle Alpine sky gradient!)
  const g = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  if (glassTint === 'modern_teal') {
    g.addColorStop(0.0, '#132432');
    g.addColorStop(0.32, '#1e394a');
    g.addColorStop(0.72, '#11222e');
    g.addColorStop(1.0, '#0a141c');
  } else if (glassTint === 'warm_shop') {
    g.addColorStop(0.0, '#182430');
    g.addColorStop(0.42, '#161b20');
    g.addColorStop(0.78, '#26211a');
    g.addColorStop(1.0, '#121417');
  } else {
    g.addColorStop(0.0, '#0d1824');
    g.addColorStop(0.30, '#1a2c3e');
    g.addColorStop(0.68, '#0f1a25');
    g.addColorStop(1.0, '#080e14');
  }
  ctx.fillStyle = g;
  ctx.fillRect(wx, wy, ww, wh);

  // 3. Natural room-to-room interior detail (sheer Swiss curtains, external Venetian blinds, or muted room backdrop)
  const roomSeed = rand();
  if (roomSeed < blindsProb) {
    // Realistic Swiss slatted grey/off-white Venetian blind lowered to varied height (exact match to ref_03!)
    const dropFrac = 0.22 + rand() * 0.48;
    const bh = wh * dropFrac;
    ctx.fillStyle = glassTint === 'modern_teal' ? 'rgba(155, 162, 168, 0.44)' : 'rgba(198, 194, 184, 0.34)';
    ctx.fillRect(wx + 3, wy + 3, ww - 6, bh);
    ctx.fillStyle = 'rgba(20, 24, 30, 0.30)';
    for (let by = wy + 6; by < wy + bh; by += 4.5) {
      ctx.fillRect(wx + 3, by, ww - 6, 1.5);
    }
  } else if (roomSeed < blindsProb + curtainProb) {
    // Soft translucent off-white Swiss sheer drapes framing the window edges
    const drapeW = ww * (0.18 + rand() * 0.16);
    const cgL = ctx.createLinearGradient(wx, wy, wx + drapeW, wy);
    cgL.addColorStop(0, 'rgba(225, 220, 208, 0.34)');
    cgL.addColorStop(1, 'rgba(225, 220, 208, 0.04)');
    ctx.fillStyle = cgL;
    ctx.fillRect(wx + 3, wy + 4, drapeW, wh - 8);
    const cgR = ctx.createLinearGradient(wx + ww - drapeW, wy, wx + ww, wy);
    cgR.addColorStop(0, 'rgba(225, 220, 208, 0.04)');
    cgR.addColorStop(1, 'rgba(225, 220, 208, 0.32)');
    ctx.fillStyle = cgR;
    ctx.fillRect(wx + ww - drapeW - 3, wy + 4, drapeW, wh - 8);
  } else {
    // Subtle sunlit upper ceiling plane inside room
    ctx.fillStyle = 'rgba(195, 186, 168, 0.12)';
    ctx.fillRect(wx + 8, wy + 10, ww - 16, wh * 0.28);
  }

  // 4. Deep overhanging lintel & side-jamb reveal AO shadow (gives true 3D inset depth!)
  const topSh = ctx.createLinearGradient(wx, wy, wx, wy + recessDepth * 3.8);
  topSh.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  topSh.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = topSh;
  ctx.fillRect(wx, wy, ww, recessDepth * 3.8);

  const leftSh = ctx.createLinearGradient(wx, wy, wx + recessDepth * 2.2, wy);
  leftSh.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  leftSh.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = leftSh;
  ctx.fillRect(wx, wy, recessDepth * 2.2, wh);

  // Subtle diagonal sky reflection highlight
  ctx.fillStyle = glassTint === 'modern_teal' ? 'rgba(175, 214, 242, 0.18)' : 'rgba(162, 198, 232, 0.13)';
  ctx.beginPath();
  ctx.moveTo(wx - 4, wy + wh * 0.65);
  ctx.lineTo(wx + ww + 4, wy + wh * 0.08);
  ctx.lineTo(wx + ww + 4, wy + wh * 0.32);
  ctx.lineTo(wx - 4, wy + wh * 0.88);
  ctx.closePath();
  ctx.fill();

  // 5. Mirror-low roughness strictly inside glazing (r = 0.06 -> crisp sky Fresnel + 3D parallax!)
  rctx.save();
  clipShape(rctx, 4);
  rctx.fillStyle = '#0e0e0e';
  rctx.fill();
  rctx.restore();

  // 6. Realistic warm stochastic interior room illumination at night (strictly inside glass!)
  if (rand() < litProb) {
    ectx.save();
    clipShape(ectx, 5);
    ectx.clip();
    const warm = rand();
    const eg = ectx.createLinearGradient(wx, wy, wx, wy + wh);
    if (warm > 0.25) {
      eg.addColorStop(0.0, '#ffd898');
      eg.addColorStop(0.55, '#c88c42');
      eg.addColorStop(1.0, '#4f3216');
    } else {
      eg.addColorStop(0.0, '#dcebff');
      eg.addColorStop(0.60, '#7ea4c6');
      eg.addColorStop(1.0, '#2a3c4e');
    }
    const dim = 0.45 + rand() * 0.55;
    ectx.globalAlpha = dim;
    ectx.fillStyle = eg;
    ectx.fillRect(wx, wy, ww, wh);
    ectx.restore();
  }

  // 7. Razor-thin realistic architectural window frame & mullions (NO thick cartoon white crossbars!)
  ctx.strokeStyle = frameCol;
  ctx.lineWidth = frameW;
  clipShape(ctx, 3.5);
  ctx.stroke();

  ctx.fillStyle = frameCol;
  for (let mv = 1; mv <= mullionV; mv++) {
    const mx = wx + (ww * mv) / (mullionV + 1) - frameW * 0.5;
    ctx.fillRect(mx, wy + 2, frameW, wh - 4);
    hctx.fillStyle = '#5a5a5a';
    hctx.fillRect(mx, wy + 2, frameW, wh - 4);
    rctx.fillStyle = '#8a8a8a';
    rctx.fillRect(mx, wy + 2, frameW, wh - 4);
    ectx.fillStyle = '#000000';
    ectx.fillRect(mx - 0.5, wy, frameW + 1, wh);
  }
  if (mullionH > 0) {
    for (let mh = 1; mh <= mullionH; mh++) {
      const ty = wy + (arched ? ww * 0.5 : (wh * mh) / (mullionH + 2)) - frameW * 0.5;
      ctx.fillRect(wx + 2, ty, ww - 4, frameW);
      hctx.fillStyle = '#5a5a5a';
      hctx.fillRect(wx + 2, ty, ww - 4, frameW);
      rctx.fillStyle = '#8a8a8a';
      rctx.fillRect(wx + 2, ty, ww - 4, frameW);
      ectx.fillStyle = '#000000';
      ectx.fillRect(wx, ty - 0.5, ww, frameW + 1);
    }
  }
  ctx.restore();
}

// Draw refined ornate Geneva wrought-iron balcony railing (delicate thin iron bars, NOT clunky blocks!)
function drawWroughtIronBalcony(ctx, hctx, rctx, x, y, w, h, continuous = false) {
  ctx.fillStyle = 'rgba(12, 14, 18, 0.28)';
  ctx.fillRect(x, y + 3, w, h); // soft iron shadow onto stone/glass behind
  ctx.fillStyle = '#1b1f24';
  ctx.fillRect(x, y, w, 3.5);
  ctx.fillRect(x, y + 8, w, 2);
  ctx.fillRect(x, y + h - 3, w, 3);
  const step = continuous ? 10 : 9;
  for (let rx = x + 3; rx <= x + w - 3; rx += step) {
    ctx.fillRect(rx, y + 2, 1.8, h - 4);
  }
  // Subtle decorative oval rings along top frieze
  ctx.strokeStyle = '#1f242a';
  ctx.lineWidth = 1.4;
  for (let rx = x + 9; rx < x + w - 9; rx += 22) {
    ctx.beginPath();
    ctx.arc(rx, y + 4.5, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  hctx.fillStyle = '#d4d4d4';
  hctx.fillRect(x, y, w, 3.5);
  rctx.fillStyle = '#4c4c4c';
  rctx.fillRect(x, y, w, 3.5);
}

// Draw authentic delicately-louvered Swiss wooden shutters (matches real_oldtown_1.jpg!)
function drawGenevaShutter(ctx, hctx, rctx, x, y, w, h, shutterHex, side) {
  // Subtle cast drop shadow onto limestone wall
  ctx.fillStyle = 'rgba(16, 14, 12, 0.28)';
  ctx.fillRect(x + (side < 0 ? -3 : 3), y + 3, w, h);
  ctx.fillStyle = shutterHex;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(24, 24, 22, 0.34)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
  // Central horizontal stile dividing upper & lower louvered panels (authentic Swiss shutter!)
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 2, y + h * 0.49, w - 4, 6);
  ctx.fillStyle = 'rgba(20,20,18,0.22)';
  ctx.fillRect(x + 2, y + h * 0.49 + 6, w - 4, 2);

  hctx.fillStyle = '#cfcfcf';
  hctx.fillRect(x, y, w, h);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(x, y, w, h);

  // Fine crisp horizontal louver slats
  for (let sy = y + 6; sy < y + h - 6; sy += 4.5) {
    if (Math.abs(sy - (y + h * 0.51)) < 5) continue;
    ctx.fillStyle = 'rgba(18, 20, 22, 0.26)';
    ctx.fillRect(x + 4, sy, w - 8, 1.7);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(x + 4, sy + 1.7, w - 8, 1.0);
    hctx.fillStyle = '#a2a2a2';
    hctx.fillRect(x + 4, sy, w - 8, 1.8);
  }
}

// Draw realistic carved horizontal stone belt cornice with top sunlit highlight, soffit shadow & subtle rainwater patina
function drawStoneCornice(ctx, hctx, W, y, h, stoneRgb, dentils = false) {
  const [r, g, b] = stoneRgb;
  ctx.fillStyle = `rgb(${Math.min(255, r + 14)},${Math.min(255, g + 13)},${Math.min(255, b + 11)})`;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(0, y, W, 2.5);
  // Crisp molded underside shadow
  const sh = ctx.createLinearGradient(0, y + h, 0, y + h + 14);
  sh.addColorStop(0, 'rgba(18, 16, 12, 0.44)');
  sh.addColorStop(1, 'rgba(18, 16, 12, 0.0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, y + h, W, 14);

  if (dentils) {
    ctx.fillStyle = 'rgba(24, 20, 16, 0.26)';
    for (let dx = 4; dx < W; dx += 14) {
      ctx.fillRect(dx, y + h - 5, 6, 5);
    }
  }
  hctx.fillStyle = '#f2f2f2';
  hctx.fillRect(0, y, W, h);
  hctx.fillStyle = '#626262';
  hctx.fillRect(0, y + h, W, 6);
}

// Subtle realistic rainwater streak patina under stone window sills
function drawSillWeathering(ctx, wx, wy, ww, rand) {
  const wg = ctx.createLinearGradient(0, wy, 0, wy + 22);
  wg.addColorStop(0, `rgba(28, 25, 20, ${0.14 + rand() * 0.08})`);
  wg.addColorStop(1, 'rgba(28, 25, 20, 0.0)');
  ctx.fillStyle = wg;
  ctx.fillRect(wx - 4, wy, ww + 8, 22);
}

// =================================================================================================
// BUILD ALL 12 GENEVA FACADE LAYERS (8 UPPER + 4 GROUND) INTO 3 HARDWARE-MIPMAPPED DataArrayTextures
// =================================================================================================
export function createGenevaFacadeArrays(photoBundle) {
  const COL_SZ = 1024;
  const AUX_SZ = 512;
  const LAYERS = 12;

  const colBuf = new Uint8Array(COL_SZ * COL_SZ * 4 * LAYERS);
  const norRoughBuf = new Uint8Array(AUX_SZ * AUX_SZ * 4 * LAYERS);
  const emisBuf = new Uint8Array(AUX_SZ * AUX_SZ * 4 * LAYERS);

  const cCan = makeCanvas(COL_SZ, COL_SZ);
  const hCan = makeCanvas(COL_SZ, COL_SZ);
  const rCan = makeCanvas(COL_SZ, COL_SZ);
  const eCan = makeCanvas(COL_SZ, COL_SZ);
  const ctx = cCan.getContext('2d', { willReadFrequently: true });
  const hctx = hCan.getContext('2d', { willReadFrequently: true });
  const rctx = rCan.getContext('2d', { willReadFrequently: true });
  const ectx = eCan.getContext('2d', { willReadFrequently: true });

  const auxHCan = makeCanvas(AUX_SZ, AUX_SZ);
  const auxRCan = makeCanvas(AUX_SZ, AUX_SZ);
  const auxECan = makeCanvas(AUX_SZ, AUX_SZ);
  const ahctx = auxHCan.getContext('2d', { willReadFrequently: true });
  const arctx = auxRCan.getContext('2d', { willReadFrequently: true });
  const aectx = auxECan.getContext('2d', { willReadFrequently: true });

  // Copy 1024 color + downsampled 512 Sobel normal+roughness & emissive into DataArrayTexture layer (flipping Y so UV v=0 is bottom!)
  function commitLayer(layerIdx, normalStrength = 2.4) {
    const cData = ctx.getImageData(0, 0, COL_SZ, COL_SZ).data;
    const colBase = layerIdx * COL_SZ * COL_SZ * 4;
    const rowBytesC = COL_SZ * 4;
    for (let y = 0; y < COL_SZ; y++) {
      const dstY = COL_SZ - 1 - y;
      const srcOff = y * rowBytesC;
      colBuf.set(cData.subarray(srcOff, srcOff + rowBytesC), colBase + dstY * rowBytesC);
    }

    ahctx.drawImage(hCan, 0, 0, AUX_SZ, AUX_SZ);
    arctx.drawImage(rCan, 0, 0, AUX_SZ, AUX_SZ);
    aectx.drawImage(eCan, 0, 0, AUX_SZ, AUX_SZ);

    const hData = ahctx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;
    const rData = arctx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;
    const eData = aectx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;

    const auxBase = layerIdx * AUX_SZ * AUX_SZ * 4;
    const sampleH = (x, y) => {
      const wx = ((x % AUX_SZ) + AUX_SZ) % AUX_SZ;
      const wy = ((y % AUX_SZ) + AUX_SZ) % AUX_SZ;
      return hData[(wy * AUX_SZ + wx) * 4] / 255.0;
    };

    for (let y = 0; y < AUX_SZ; y++) {
      const dstY = AUX_SZ - 1 - y;
      for (let x = 0; x < AUX_SZ; x++) {
        const idxSrc = (y * AUX_SZ + x) * 4;
        const idxDst = auxBase + (dstY * AUX_SZ + x) * 4;
        const l = sampleH(x - 1, y);
        const r = sampleH(x + 1, y);
        const u = sampleH(x, y - 1);
        const d = sampleH(x, y + 1);
        let nx = (l - r) * normalStrength;
        let ny = (d - u) * normalStrength; // +Y points UP in world space
        let nz = 1.0;
        const inv = 1.0 / Math.hypot(nx, ny, nz);
        nx *= inv; ny *= inv; nz *= inv;
        norRoughBuf[idxDst] = Math.round((nx * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 3] = rData[idxSrc]; // packed roughness in .a!

        emisBuf[idxDst] = eData[idxSrc];
        emisBuf[idxDst + 1] = eData[idxSrc + 1];
        emisBuf[idxDst + 2] = eData[idxSrc + 2];
        emisBuf[idxDst + 3] = 255;
      }
    }
  }

  function clearWork(roughVal = '#dcdcdc') {
    hctx.fillStyle = '#a4a4a4';
    hctx.fillRect(0, 0, COL_SZ, COL_SZ);
    rctx.fillStyle = roughVal;
    rctx.fillRect(0, 0, COL_SZ, COL_SZ);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, COL_SZ, COL_SZ);
  }

  const W = COL_SZ;
  const H = COL_SZ;
  const floorH = H / 4; // 256px per story (3.2m)
  const bayW = W / 4;   // 256px per bay (3.0m)

  // ===============================================================================================
  // LAYER 0: QUAI IVORY BELLE EPOQUE (Exact match to Rolex / Bucherer in ref_01 & Four Seasons!)
  // ===============================================================================================
  {
    const rand = seededRand(101);
    clearWork('#dcdcdc');
    paintMineralStone(ctx, hctx, W, H, [232, 228, 218], rand, { courseH: 32, jointAlpha: 0.08, blockW: 128, plasterMottle: 0.045 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, f === 0 ? 18 : f === 2 ? 14 : 9, [238, 234, 224], f === 0);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 104, wh = f === 1 ? 174 : 158;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + (f === 1 ? 42 : 48);
        // Sculpted pale limestone surround & header cornice (piano nobile gets projecting pediment!)
        ctx.fillStyle = '#f0ece2';
        ctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);
        hctx.fillStyle = '#d2d2d2';
        hctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);
        if (f === 1 || f === 2) {
          ctx.fillStyle = '#f3efe6';
          ctx.fillRect(wx - 15, wy - 18, ww + 30, 10);
          ctx.fillStyle = 'rgba(20,18,14,0.34)';
          ctx.fillRect(wx - 13, wy - 8, ww + 26, 5);
          hctx.fillStyle = '#f5f5f5';
          hctx.fillRect(wx - 15, wy - 18, ww + 30, 10);
        }
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#2e3238',
          frameW: 2.2,
          mullionV: 1,
          mullionH: 1,
          blindsProb: 0.30,
          curtainProb: 0.52,
          litProb: 0.44,
        });
        // Carved stone sill + rainwater weathering
        ctx.fillStyle = '#eeeae0';
        ctx.fillRect(wx - 12, wy + wh + 2, ww + 24, 10);
        hctx.fillStyle = '#ededed';
        hctx.fillRect(wx - 12, wy + wh + 2, ww + 24, 10);
        drawSillWeathering(ctx, wx - 10, wy + wh + 12, ww + 20, rand);
        if (f === 0 || f === 2) {
          drawWroughtIronBalcony(ctx, hctx, rctx, wx - 6, wy + wh - 34, ww + 12, 36, false);
        }
      }
      // Continuous ornate wrought-iron balcony railing across entire piano nobile (matches Rolex building in ref_01!)
      if (f === 1) {
        drawWroughtIronBalcony(ctx, hctx, rctx, 0, fy + floorH - 42, W, 38, true);
      }
    }
    commitLayer(0, 2.5);
  }

  // ===============================================================================================
  // LAYER 1: QUAI SLATE-TAUPE DRESSED ASHLAR (Exact match to Hermes / Chanel building in ref_01!)
  // ===============================================================================================
  {
    const rand = seededRand(202);
    clearWork('#dadada');
    paintMineralStone(ctx, hctx, W, H, [158, 154, 144], rand, { courseH: 28, jointAlpha: 0.15, blockW: 112, plasterMottle: 0.05 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, f === 0 ? 16 : 10, [172, 168, 158], f === 0);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 96, wh = 152;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 48;
        // Subtle recessed stone spandrel tablet under each window (authentic Quai stone relief!)
        ctx.fillStyle = 'rgba(26,24,20,0.14)';
        ctx.fillRect(wx + 4, wy + wh + 14, ww - 8, 28);
        ctx.strokeStyle = 'rgba(255,252,244,0.20)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(wx + 4, wy + wh + 14, ww - 8, 28);
        // Clean beveled dressed stone jamb surround
        ctx.fillStyle = '#b4b0a4';
        ctx.fillRect(wx - 7, wy - 9, ww + 14, wh + 16);
        hctx.fillStyle = '#cfcfcf';
        hctx.fillRect(wx - 7, wy - 9, ww + 14, wh + 16);
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#24282e',
          frameW: 2.0,
          mullionV: 1,
          mullionH: 1,
          blindsProb: 0.42,
          curtainProb: 0.38,
          litProb: 0.42,
        });
        ctx.fillStyle = '#c0bcb0';
        ctx.fillRect(wx - 11, wy + wh + 2, ww + 22, 9);
        hctx.fillStyle = '#efefef';
        hctx.fillRect(wx - 11, wy + wh + 2, ww + 22, 9);
        drawSillWeathering(ctx, wx - 8, wy + wh + 11, ww + 16, rand);
        if (f === 1 || f === 3) {
          drawWroughtIronBalcony(ctx, hctx, rctx, wx - 4, wy + wh - 28, ww + 8, 30, false);
        }
      }
    }
    commitLayer(1, 2.6);
  }

  // ===============================================================================================
  // LAYER 2: PATEK PHILIPPE / HOTEL METROPOLE WIDE-BAY GRAND PALACE (ref_01 right & left!)
  // ===============================================================================================
  {
    const rand = seededRand(303);
    clearWork('#dadada');
    paintMineralStone(ctx, hctx, W, H, [218, 211, 196], rand, { courseH: 32, jointAlpha: 0.12, blockW: 128, plasterMottle: 0.05 });
    // Bold vertical sculpted stone pilasters dividing the 4 grand bays!
    for (let b = 0; b < 4; b++) {
      const px = b * bayW;
      ctx.fillStyle = '#e2dccd';
      ctx.fillRect(px, 0, 26, H);
      ctx.fillRect(px + bayW - 26, 0, 26, H);
      ctx.fillStyle = 'rgba(20,18,14,0.22)';
      ctx.fillRect(px + 26, 0, 4, H);
      ctx.fillRect(px + bayW - 30, 0, 4, H);
      hctx.fillStyle = '#dedede';
      hctx.fillRect(px, 0, 26, H);
      hctx.fillRect(px + bayW - 26, 0, 26, H);
    }
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, f === 0 ? 20 : 14, [226, 220, 206], f === 0 || f === 2);
      const isTopArched = f === 0;
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 166, wh = 164;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 44;
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          arched: isTopArched,
          frameCol: '#383a3e',
          frameW: 2.8,
          mullionV: 2, // iconic triple-lancet grand watchmaker studio bay (Patek Philippe ref_01!)
          mullionH: 1,
          blindsProb: 0.32,
          curtainProb: 0.40,
          litProb: 0.50,
        });
        ctx.fillStyle = '#e6e0d2';
        ctx.fillRect(wx - 8, wy + wh + 2, ww + 16, 11);
        hctx.fillStyle = '#f0f0f0';
        hctx.fillRect(wx - 8, wy + wh + 2, ww + 16, 11);
        drawSillWeathering(ctx, wx - 6, wy + wh + 13, ww + 12, rand);
      }
      if (f === 1) {
        drawWroughtIronBalcony(ctx, hctx, rctx, 0, fy + floorH - 38, W, 34, true);
      }
    }
    commitLayer(2, 2.7);
  }

  // ===============================================================================================
  // LAYER 3: RUE DU RHONE MODERNIST WHITE CONCRETE & HUGE REFLECTIVE GLASS GRID (Cartier ref_03!)
  // ===============================================================================================
  {
    const rand = seededRand(404);
    clearWork('#d2d2d2');
    paintMineralStone(ctx, hctx, W, H, [233, 231, 224], rand, { courseH: 0, jointAlpha: 0, plasterMottle: 0.035 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      // Crisp projecting off-white architectural concrete slab spandrel
      drawStoneCornice(ctx, hctx, W, fy, 26, [236, 234, 228], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        // Crisp vertical white concrete fins framing massive square reflective glass windows (70% glass!)
        const finW = 28;
        ctx.fillStyle = '#ebe9e2';
        ctx.fillRect(bx, fy, finW * 0.5, floorH);
        ctx.fillRect(bx + bayW - finW * 0.5, fy, finW * 0.5, floorH);
        hctx.fillStyle = '#ececec';
        hctx.fillRect(bx, fy, finW * 0.5, floorH);
        hctx.fillRect(bx + bayW - finW * 0.5, fy, finW * 0.5, floorH);

        const wx = bx + finW * 0.5 + 8;
        const wy = fy + 32;
        const ww = bayW - finW - 16;
        const wh = floorH - 46;
        // Deep bevel reveal shadow in white concrete frame
        ctx.fillStyle = '#b4b2aa';
        ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
        hctx.fillStyle = '#686868';
        hctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);

        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#24292e',
          frameW: 3.0,
          mullionV: 0,
          mullionH: 0,
          blindsProb: 0.52,
          curtainProb: 0.05,
          litProb: 0.48,
          recessDepth: 9,
          glassTint: 'modern_teal',
        });
      }
    }
    commitLayer(3, 2.8);
  }

  // ===============================================================================================
  // LAYER 4: FAIRMONT / UBS CONTEMPORARY TRAVERTINE & GLASS CURTAIN WALL (real_quai_1, ref_03/04!)
  // ===============================================================================================
  {
    const rand = seededRand(505);
    clearWork('#c8c8c8');
    paintMineralStone(ctx, hctx, W, H, [198, 193, 184], rand, { courseH: 64, jointAlpha: 0.09, blockW: 128, plasterMottle: 0.03 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      // Sleek honed travertine horizontal floor fascia
      ctx.fillStyle = '#cbc6bc';
      ctx.fillRect(0, fy, W, 38);
      ctx.fillStyle = 'rgba(20,24,28,0.32)';
      ctx.fillRect(0, fy + 38, W, 6);
      hctx.fillStyle = '#dedede';
      hctx.fillRect(0, fy, W, 38);

      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const pierW = 36;
        ctx.fillStyle = '#cac5ba';
        ctx.fillRect(bx, fy, pierW * 0.5, floorH);
        ctx.fillRect(bx + bayW - pierW * 0.5, fy, pierW * 0.5, floorH);
        hctx.fillStyle = '#e2e2e2';
        hctx.fillRect(bx, fy, pierW * 0.5, floorH);
        hctx.fillRect(bx + bayW - pierW * 0.5, fy, pierW * 0.5, floorH);

        const wx = bx + pierW * 0.5 + 4;
        const wy = fy + 40;
        const ww = bayW - pierW - 8;
        const wh = floorH - 44;

        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#383e46',
          frameW: 2.6,
          mullionV: 1,
          mullionH: 0,
          blindsProb: 0.40,
          curtainProb: 0.25,
          litProb: 0.54,
          recessDepth: 6,
          glassTint: 'modern_teal',
        });

        // Subtle real ambientCG photographed office glass reflection overlay inside modern glass!
        if (photoBundle?.facGlass01Img) {
          ctx.save();
          ctx.globalAlpha = 0.20;
          ctx.drawImage(photoBundle.facGlass01Img, wx + 4, wy + 4, ww - 8, wh - 8);
          ctx.restore();
        }

        // Sleek tinted glass balcony guardrail across lower third (exact match to Fairmont real_quai_1.jpg!)
        ctx.fillStyle = 'rgba(135, 168, 194, 0.22)';
        ctx.fillRect(wx, wy + wh - 56, ww, 52);
        ctx.fillStyle = '#7e8790';
        ctx.fillRect(wx, wy + wh - 57, ww, 3);
        rctx.fillStyle = '#181818';
        rctx.fillRect(wx, wy + wh - 56, ww, 52);
      }
    }
    commitLayer(4, 2.4);
  }

  // ===============================================================================================
  // LAYER 5: PLACE DU BOURG-DE-FOUR / VIEILLE-VILLE MOLASSE & WHITE LOUVERED SHUTTERS (real_oldtown_1!)
  // ===============================================================================================
  {
    const rand = seededRand(606);
    clearWork('#dedede');
    // Match the exact pale warm silver-beige limestone courses & crisp off-white louvered shutters of real_oldtown_1.jpg!
    paintMineralStone(ctx, hctx, W, H, [202, 198, 185], rand, { courseH: 26, jointAlpha: 0.16, blockW: 96, plasterMottle: 0.055 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 11, [208, 204, 192], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 92, wh = 158;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 44;
        ctx.fillStyle = '#d4d0c4';
        ctx.fillRect(wx - 6, wy - 8, ww + 12, wh + 14);
        hctx.fillStyle = '#c8c8c8';
        hctx.fillRect(wx - 6, wy - 8, ww + 12, wh + 14);

        const closedShutter = rand() > 0.88; // occasional closed wooden shutter for true lived-in Swiss authenticity!
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#dcd8cc',
          frameW: 2.4,
          mullionV: 1,
          mullionH: 2,
          blindsProb: 0.12,
          curtainProb: 0.65,
          litProb: closedShutter ? 0.0 : 0.42,
        });
        if (closedShutter) {
          drawGenevaShutter(ctx, hctx, rctx, wx + 2, wy + 2, ww * 0.48, wh - 4, '#dad8d0', -1);
          drawGenevaShutter(ctx, hctx, rctx, wx + ww * 0.5, wy + 2, ww * 0.48, wh - 4, '#dad8d0', 1);
        } else {
          const shW = 46;
          drawGenevaShutter(ctx, hctx, rctx, wx - shW - 4, wy, shW, wh, '#dedcd4', -1);
          drawGenevaShutter(ctx, hctx, rctx, wx + ww + 4, wy, shW, wh, '#dedcd4', 1);
        }
        ctx.fillStyle = '#d8d4c8';
        ctx.fillRect(wx - 10, wy + wh + 2, ww + 20, 9);
        hctx.fillStyle = '#ececec';
        hctx.fillRect(wx - 10, wy + wh + 2, ww + 20, 9);
        drawSillWeathering(ctx, wx - 8, wy + wh + 11, ww + 16, rand);
      }
    }
    commitLayer(5, 2.6);
  }

  // ===============================================================================================
  // LAYER 6: VIEILLE-VILLE WARM OCHRE-SANDSTONE LIME PLASTER & OLIVE-SLATE SHUTTERS!
  // ===============================================================================================
  {
    const rand = seededRand(707);
    clearWork('#e2e2e2');
    paintMineralStone(ctx, hctx, W, H, [206, 178, 142], rand, { courseH: 0, jointAlpha: 0, plasterMottle: 0.075 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 10, [218, 206, 186], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 92, wh = 152;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 48;
        // Carved pale Geneva limestone window frame around ochre plaster
        ctx.fillStyle = '#dfd4be';
        ctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#d6cfc0',
          frameW: 2.2,
          mullionV: 1,
          mullionH: 2,
          blindsProb: 0.15,
          curtainProb: 0.62,
          litProb: 0.45,
        });
        const shW = 46;
        drawGenevaShutter(ctx, hctx, rctx, wx - shW - 6, wy, shW, wh, '#56645a', -1);
        drawGenevaShutter(ctx, hctx, rctx, wx + ww + 6, wy, shW, wh, '#56645a', 1);
        ctx.fillStyle = '#e4dac6';
        ctx.fillRect(wx - 12, wy + wh + 2, ww + 24, 10);
        hctx.fillStyle = '#efefef';
        hctx.fillRect(wx - 12, wy + wh + 2, ww + 24, 10);
        drawSillWeathering(ctx, wx - 10, wy + wh + 12, ww + 20, rand);
      }
    }
    commitLayer(6, 2.5);
  }

  // ===============================================================================================
  // LAYER 7: GRAND-RUE / MAISON TAVEL / MONUMENTAL WEATHERED MOLASSE STONE (grandrue_1.jpg!)
  // ===============================================================================================
  {
    const rand = seededRand(808);
    clearWork('#e6e6e6');
    paintMineralStone(ctx, hctx, W, H, [168, 160, 145], rand, {
      ashlarImg: photoBundle?.ashlarImg,
      ashlarAlpha: 0.55,
      courseH: 36,
      jointAlpha: 0.16,
      blockW: 118,
      plasterMottle: 0.06,
    });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 14, [180, 172, 156], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 112, wh = 152;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 48;
        // Carved stone chamfered surround
        ctx.fillStyle = '#c4baa6';
        ctx.fillRect(wx - 11, wy - 12, ww + 22, wh + 20);
        hctx.fillStyle = '#d8d8d8';
        hctx.fillRect(wx - 11, wy - 12, ww + 22, wh + 20);
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy, ww, wh,
          frameCol: '#b6ac98',
          frameW: 5.5, // authentic Renaissance stone cross-mullion (fenetre a meneaux, grandrue_1.jpg!)
          mullionV: 1,
          mullionH: 1,
          blindsProb: 0.05,
          curtainProb: 0.35,
          litProb: 0.36,
          recessDepth: 9,
        });
        ctx.fillStyle = '#cac0ac';
        ctx.fillRect(wx - 14, wy + wh + 2, ww + 28, 11);
        hctx.fillStyle = '#f0f0f0';
        hctx.fillRect(wx - 14, wy + wh + 2, ww + 28, 11);
      }
    }
    commitLayer(7, 2.9);
  }

  // ===============================================================================================
  // LAYER 8 (GROUND 0): QUAI & RUE DU RHONE ARCHED STONE LUXURY ARCADES (ref_01 Bucherer / Hermes!)
  // ===============================================================================================
  {
    const rand = seededRand(901);
    clearWork('#dadada');
    paintMineralStone(ctx, hctx, W, H, [218, 213, 202], rand, { courseH: 48, jointAlpha: 0.16, blockW: 160, plasterMottle: 0.04 });
    // Top molded limestone entablature separating street level from 1st floor
    drawStoneCornice(ctx, hctx, W, 0, 56, [228, 223, 212], true);
    // Honed grey Swiss granite sidewalk kick-plinth along bottom
    ctx.fillStyle = '#6c6b68';
    ctx.fillRect(0, H - 56, W, 56);
    ctx.fillStyle = '#92908b';
    ctx.fillRect(0, H - 59, W, 6);
    hctx.fillStyle = '#d8d8d8';
    hctx.fillRect(0, H - 56, W, 56);

    // 3 Grand Semi-Circular Arched Stone Luxury Bays (NO cartoon gold boxes, NO fake text!)
    const bays = 3;
    const gBayW = W / bays;
    for (let i = 0; i < bays; i++) {
      const bx = i * gBayW;
      const ww = 248, wh = 760;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 196;
      const cx = wx + ww * 0.5;
      const r = ww * 0.5;

      // Carved stone voussoir arch ring & central sculpted keystone!
      ctx.save();
      ctx.strokeStyle = '#e2ddd0';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.arc(cx, wy + r, r + 11, Math.PI, 0, false);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(32,28,22,0.28)';
      ctx.lineWidth = 2;
      for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 9) {
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r, wy + r + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a) * (r + 24), wy + r + Math.sin(a) * (r + 24));
        ctx.stroke();
      }
      // Sculpted keystone
      ctx.fillStyle = '#ebe6da';
      ctx.fillRect(cx - 16, wy - 28, 32, 34);
      hctx.fillStyle = '#f2f2f2';
      hctx.fillRect(cx - 16, wy - 28, 32, 34);
      ctx.restore();

      drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
        wx, wy, ww, wh,
        arched: true,
        frameCol: '#1f2328',
        frameW: 5.5,
        mullionV: i === 1 ? 1 : 0,
        mullionH: 1,
        blindsProb: 0.0,
        curtainProb: 0.0,
        litProb: 0.85,
        recessDepth: 12,
        glassTint: 'warm_shop',
      });

      // Subtle luxury Swiss watch boutique recessed interior showcase backdrop & warm ceiling downlights!
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx + 8, wy + r, ww - 16, wh - r - 12);
      ctx.clip();
      const sBg = ctx.createLinearGradient(wx, wy + r, wx, wy + wh);
      sBg.addColorStop(0.0, 'rgba(240, 224, 194, 0.16)');
      sBg.addColorStop(0.55, 'rgba(36, 32, 26, 0.25)');
      sBg.addColorStop(1.0, 'rgba(18, 16, 14, 0.45)');
      ctx.fillStyle = sBg;
      ctx.fillRect(wx + 8, wy + r, ww - 16, wh - r);
      // Two soft halogen spotlight cones inside showcase
      for (const sx of [wx + ww * 0.32, wx + ww * 0.68]) {
        const sp = ctx.createRadialGradient(sx, wy + r + 35, 4, sx, wy + r + 70, 95);
        sp.addColorStop(0, 'rgba(255, 238, 200, 0.28)');
        sp.addColorStop(1, 'rgba(255, 238, 200, 0.0)');
        ctx.fillStyle = sp;
        ctx.fillRect(sx - 95, wy + r, 190, 200);
      }
      ctx.restore();
    }
    commitLayer(8, 2.7);
  }

  // ===============================================================================================
  // LAYER 9 (GROUND 1): RUE DU RHONE LUXURY LIMESTONE & BRONZE GLASS BOUTIQUES (ref_03 Dior/Cartier!)
  // ===============================================================================================
  {
    const rand = seededRand(902);
    clearWork('#d4d4d4');
    // Sleek honed pale warm Geneva limestone surround (real Rue du Rhone Dior/Cartier streetscape!)
    paintMineralStone(ctx, hctx, W, H, [214, 208, 196], rand, { courseH: 64, jointAlpha: 0.10, blockW: 170, plasterMottle: 0.035 });
    // Clean upper architectural stone frieze band (blank so real OSM brand signs mount seamlessly!)
    drawStoneCornice(ctx, hctx, W, 0, 44, [224, 219, 208], false);
    ctx.fillStyle = '#25282e';
    ctx.fillRect(0, 148, W, 14); // slim bronze storefront transom rail
    hctx.fillStyle = '#e0e0e0';
    hctx.fillRect(0, 148, W, 14);
    // Dark honed granite sidewalk kick-plinth
    ctx.fillStyle = '#383b40';
    ctx.fillRect(0, H - 52, W, 52);

    const bays = 3;
    const gBayW = W / bays;
    for (let i = 0; i < bays; i++) {
      const bx = i * gBayW;
      const ww = 282, wh = 790;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 172;
      // Sleek matte dark-bronze portal trim
      ctx.fillStyle = '#23262b';
      ctx.fillRect(wx - 10, wy - 10, ww + 20, wh + 14);
      hctx.fillStyle = '#626262';
      hctx.fillRect(wx - 10, wy - 10, ww + 20, wh + 14);

      drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
        wx, wy, ww, wh,
        frameCol: '#36322c',
        frameW: 4.5,
        mullionV: i === 1 ? 2 : 1,
        mullionH: 1,
        blindsProb: 0.0,
        curtainProb: 0.0,
        litProb: 0.88,
        recessDepth: 11,
        glassTint: 'warm_shop',
      });

      // Minimalist luxury showroom interior depth (warm backlit display wall + subtle mannequins/pedestals)
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx + 8, wy + 120, ww - 16, wh - 130);
      ctx.clip();
      const ig = ctx.createLinearGradient(wx, wy + 120, wx, wy + wh);
      ig.addColorStop(0.0, 'rgba(248, 236, 212, 0.22)');
      ig.addColorStop(0.65, 'rgba(182, 168, 146, 0.14)');
      ig.addColorStop(1.0, 'rgba(20, 18, 16, 0.35)');
      ctx.fillStyle = ig;
      ctx.fillRect(wx + 8, wy + 120, ww - 16, wh - 130);
      // Warm backlit travertine showroom niches
      ctx.fillStyle = 'rgba(255, 240, 206, 0.18)';
      ctx.fillRect(wx + 34, wy + 220, ww - 68, 340);
      ctx.restore();
    }
    commitLayer(9, 2.5);
  }

  // ===============================================================================================
  // LAYER 10 (GROUND 2): VIEILLE-VILLE STONE, OILED-OAK BRASSERIE & ARCHED PORTE COCHERE (real_oldtown_1/2!)
  // ===============================================================================================
  {
    const rand = seededRand(903);
    clearWork('#dedede');
    paintMineralStone(ctx, hctx, W, H, [196, 190, 176], rand, { courseH: 46, jointAlpha: 0.18, blockW: 136, plasterMottle: 0.06 });
    drawStoneCornice(ctx, hctx, W, 0, 48, [208, 202, 188], false);
    ctx.fillStyle = '#7c786e';
    ctx.fillRect(0, H - 46, W, 46);

    const bays = 3;
    const gBayW = W / bays;
    for (let i = 0; i < bays; i++) {
      const bx = i * gBayW;
      const ww = 256, wh = 768;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 198;

      if (i === 1) {
        // Authentic arched carved oiled-oak Geneva courtyard double-door (porte cochere from real_oldtown_1.jpg!)
        const cx = wx + ww * 0.5, r = ww * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, wy + r, r, Math.PI, 0, false);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.lineTo(wx, wy + wh);
        ctx.closePath();
        ctx.fillStyle = '#7a5230';
        ctx.fill();
        ctx.clip();
        // Rich carved wooden door panels & grain
        ctx.fillStyle = '#624024';
        ctx.fillRect(wx + 24, wy + r + 26, ww * 0.5 - 32, 220);
        ctx.fillRect(cx + 8, wy + r + 26, ww * 0.5 - 32, 220);
        ctx.fillRect(wx + 24, wy + r + 276, ww * 0.5 - 32, 260);
        ctx.fillRect(cx + 8, wy + r + 276, ww * 0.5 - 32, 260);
        ctx.strokeStyle = '#9a6d44';
        ctx.lineWidth = 4;
        ctx.strokeRect(wx + 24, wy + r + 26, ww * 0.5 - 32, 220);
        ctx.strokeRect(cx + 8, wy + r + 26, ww * 0.5 - 32, 220);
        ctx.strokeRect(wx + 24, wy + r + 276, ww * 0.5 - 32, 260);
        ctx.strokeRect(cx + 8, wy + r + 276, ww * 0.5 - 32, 260);
        ctx.fillStyle = '#382414';
        ctx.fillRect(cx - 3, wy, 6, wh);
        ctx.restore();
        hctx.fillStyle = '#686868';
        hctx.fillRect(wx, wy + r, ww, wh - r);
        rctx.fillStyle = '#b4b4b4';
        rctx.fillRect(wx, wy, ww, wh);
      } else {
        // Warm oiled-oak brasserie / patisserie wooden surround (matches Cafe du Bourg-de-Four real_oldtown_2.jpg!)
        ctx.fillStyle = '#735032';
        ctx.fillRect(wx - 16, wy - 24, ww + 32, wh + 28);
        ctx.strokeStyle = '#9a7149';
        ctx.lineWidth = 4;
        ctx.strokeRect(wx - 12, wy - 20, ww + 24, wh + 20);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 16, wy - 24, ww + 32, wh + 28);
        drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
          wx, wy: wy + 24, ww, wh: wh - 34,
          frameCol: '#593b22',
          frameW: 5.5,
          mullionV: 2,
          mullionH: 1,
          blindsProb: 0.0,
          curtainProb: 0.15,
          litProb: 0.90,
          recessDepth: 10,
          glassTint: 'warm_shop',
        });
      }
    }
    commitLayer(10, 2.7);
  }

  // ===============================================================================================
  // LAYER 11 (GROUND 3): FAIRMONT / SWISS BANK / LAKESIDE GLASS CONSERVATORY PAVILION (real_quai_1!)
  // ===============================================================================================
  {
    const rand = seededRand(904);
    clearWork('#cecece');
    paintMineralStone(ctx, hctx, W, H, [202, 198, 189], rand, { courseH: 80, jointAlpha: 0.08, blockW: 160, plasterMottle: 0.03 });
    drawStoneCornice(ctx, hctx, W, 0, 62, [212, 208, 199], false);
    ctx.fillStyle = '#4a4e54';
    ctx.fillRect(0, H - 38, W, 38);

    const bays = 3;
    const gBayW = W / bays;
    for (let i = 0; i < bays; i++) {
      const bx = i * gBayW;
      const ww = 290, wh = 850;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 112;
      ctx.fillStyle = '#2b3036';
      ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 12);
      drawRealisticWindow(ctx, hctx, rctx, ectx, rand, {
        wx, wy, ww, wh,
        frameCol: '#383e46',
        frameW: 4.0,
        mullionV: 2,
        mullionH: 1,
        blindsProb: 0.0,
        curtainProb: 0.0,
        litProb: 0.80,
        recessDepth: 8,
        glassTint: 'modern_teal',
      });
    }
    commitLayer(11, 2.2);
  }

  const colArray = new THREE.DataArrayTexture(colBuf, COL_SZ, COL_SZ, LAYERS);
  colArray.format = THREE.RGBAFormat;
  colArray.type = THREE.UnsignedByteType;
  // Use RGBA8 (NoColorSpace) so WebGL2 hardware generateMipmap(TEXTURE_2D_ARRAY) is 100% portable across all GPUs/ANGLE;
  // swissBuildings3D.js decodes sRGB -> Linear accurately in GLSL.
  colArray.colorSpace = THREE.NoColorSpace;
  colArray.wrapS = THREE.RepeatWrapping;
  colArray.wrapT = THREE.RepeatWrapping;
  colArray.generateMipmaps = true;
  colArray.minFilter = THREE.LinearMipmapLinearFilter;
  colArray.magFilter = THREE.LinearFilter;
  colArray.anisotropy = 16;
  colArray.needsUpdate = true;

  const norRoughArray = new THREE.DataArrayTexture(norRoughBuf, AUX_SZ, AUX_SZ, LAYERS);
  norRoughArray.format = THREE.RGBAFormat;
  norRoughArray.type = THREE.UnsignedByteType;
  norRoughArray.colorSpace = THREE.NoColorSpace;
  norRoughArray.wrapS = THREE.RepeatWrapping;
  norRoughArray.wrapT = THREE.RepeatWrapping;
  norRoughArray.generateMipmaps = true;
  norRoughArray.minFilter = THREE.LinearMipmapLinearFilter;
  norRoughArray.magFilter = THREE.LinearFilter;
  norRoughArray.anisotropy = 16;
  norRoughArray.needsUpdate = true;

  const emisArray = new THREE.DataArrayTexture(emisBuf, AUX_SZ, AUX_SZ, LAYERS);
  emisArray.format = THREE.RGBAFormat;
  emisArray.type = THREE.UnsignedByteType;
  emisArray.colorSpace = THREE.NoColorSpace;
  emisArray.wrapS = THREE.RepeatWrapping;
  emisArray.wrapT = THREE.RepeatWrapping;
  emisArray.generateMipmaps = true;
  emisArray.minFilter = THREE.LinearMipmapLinearFilter;
  emisArray.magFilter = THREE.LinearFilter;
  emisArray.needsUpdate = true;

  return { colArray, norRoughArray, emisArray, layerCount: LAYERS };
}
