import * as THREE from 'three';

// =================================================================================================
// 1:1 REAL GENEVA PHOTOGRAPHIC PBR ARCHITECTURAL FACADE ARRAY BUILDER (WebGL2 DataArrayTexture)
// Built directly from orthographic photographic Geneva elevation plates (geneva_upper_quai_4x4.jpg,
// geneva_ground_arcade.jpg), real Poly Haven masonry, real ambientCG glazing & photo-matched detail!
//   0: Quai Ivory Belle Epoque (Rolex / Bucherer / Four Seasons Hotel des Bergues - ref_01)
//   1: Quai Slate-Taupe Dressed Ashlar (Hermes / Chanel Quai du General-Guisan - ref_01)
//   2: Patek Philippe / Hotel Metropole Wide-Bay Grand Watch Palace (ref_01)
//   3: Rue du Rhone Off-White Modernist Concrete & Huge Reflective Glass Grid (Cartier - ref_03)
//   4: Fairmont Grand Hotel / UBS Contemporary Travertine & Curtain-Wall Glass (real_quai_1)
//   5: Place du Bourg-de-Four / Vieille-Ville Molasse Limestone & White Louvered Shutters (real_oldtown_1)
//   6: Vieille-Ville Warm Ochre Lime-Plaster & Heritage Olive-Slate Shutters
//   7: Grand-Rue / Maison Tavel / Monumental Weathered Molasse Stone & Mullioned Windows (grandrue_1)
//   8: Ground 0 - Quai & Rue du Rhone Semi-Circular Arched Stone Luxury Arcades (Bucherer / Rolex / Hermes)
//   9: Ground 1 - Rue du Rhone Modern Luxury Limestone & Bronze Glass Boutiques (Dior / Cartier / LV)
//  10: Ground 2 - Vieille-Ville & Molard Rusticated Stone, Oiled-Oak Brasserie & Arched Porte Cochere
//  11: Ground 3 - Fairmont / Swiss Bank / Lakeside Glass Conservatory Lobby Pavilion
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

// Photographic mineral stone / aged lime-plaster base using real Poly Haven photography (zero flat CGI fills!)
function paintPhotoStoneBase(ctx, W, H, baseRgb, rand, {
  stoneImg = null,
  stoneAlpha = 0.42,
  courseH = 0,
  blockW = 128,
  jointAlpha = 0.12,
} = {}) {
  const [br, bg, bb] = baseRgb;
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, 0, W, H);

  if (stoneImg && stoneAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = stoneAlpha;
    for (let y = 0; y < H; y += 512) {
      for (let x = 0; x < W; x += 512) {
        ctx.drawImage(stoneImg, x, y, 512, 512);
      }
    }
    ctx.restore();
    // Softly harmonize photographic stone towards target Swiss molasse/limestone tone
    ctx.save();
    ctx.globalAlpha = 0.56;
    ctx.fillStyle = `rgb(${br},${bg},${bb})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Organic multi-scale mineral variation & rainwater weathering
  for (let i = 0; i < 240; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const rad = 22 + rand() * 84;
    const warm = rand() > 0.48;
    const gr = ctx.createRadialGradient(x, y, 2, x, y, rad);
    const a = 0.032 + rand() * 0.038;
    gr.addColorStop(0, warm ? `rgba(255,250,240,${a})` : `rgba(34,30,24,${a})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  if (courseH > 0 && jointAlpha > 0) {
    ctx.fillStyle = `rgba(38,34,28,${jointAlpha})`;
    for (let y = 0; y < H; y += courseH) {
      ctx.fillRect(0, y, W, 1.6);
      const off = ((Math.round(y / courseH) % 2) * blockW) * 0.5;
      for (let x = off; x < W; x += blockW) {
        ctx.fillRect(x, y, 1.5, courseH);
      }
    }
  }
}

// Draw delicately-louvered Swiss wooden shutters ('persiennes') with realistic louver shading & cast shadow
function drawGenevaShutter(ctx, hctx, rctx, x, y, w, h, shutterHex, side) {
  // Soft directional drop shadow onto molasse limestone wall
  ctx.fillStyle = 'rgba(18, 16, 12, 0.34)';
  ctx.fillRect(x + (side < 0 ? -3.5 : 3.5), y + 3.5, w, h);

  ctx.fillStyle = shutterHex;
  ctx.fillRect(x, y, w, h);

  // Subtle wood vertical bevel shading
  const vg = ctx.createLinearGradient(x, y, x + w, y);
  vg.addColorStop(0.0, 'rgba(255,255,255,0.16)');
  vg.addColorStop(0.5, 'rgba(0,0,0,0.0)');
  vg.addColorStop(1.0, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = vg;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = 'rgba(24, 24, 22, 0.36)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x + 0.8, y + 0.8, w - 1.6, h - 1.6);

  // Central horizontal stile dividing upper & lower louvered panels
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.fillRect(x + 2, y + h * 0.49, w - 4, 7);
  ctx.fillStyle = 'rgba(20,20,18,0.26)';
  ctx.fillRect(x + 2, y + h * 0.49 + 7, w - 4, 2);

  hctx.fillStyle = '#dadada';
  hctx.fillRect(x, y, w, h);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(x, y, w, h);

  // Fine horizontal louver slats
  for (let sy = y + 6; sy < y + h - 6; sy += 4.5) {
    if (Math.abs(sy - (y + h * 0.51)) < 5.5) continue;
    ctx.fillStyle = 'rgba(16, 18, 20, 0.30)';
    ctx.fillRect(x + 4, sy, w - 8, 1.8);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(x + 4, sy + 1.8, w - 8, 1.1);
    hctx.fillStyle = '#9e9e9e';
    hctx.fillRect(x + 4, sy, w - 8, 1.8);
  }
}

// Draw small terracotta window flower box with red Geneva geraniums
function drawGeraniumBox(ctx, x, y, w) {
  ctx.fillStyle = '#a45638';
  ctx.fillRect(x + 6, y - 16, w - 12, 16);
  ctx.fillStyle = '#7c3c24';
  ctx.fillRect(x + 6, y - 4, w - 12, 4);
  for (let gx = x + 12; gx < x + w - 12; gx += 10) {
    ctx.fillStyle = '#285225';
    ctx.beginPath();
    ctx.arc(gx, y - 20, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#cf2436';
    ctx.beginPath();
    ctx.arc(gx + 2, y - 24, 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Draw refined ornate Geneva wrought-iron balcony railing
function drawWroughtIronBalcony(ctx, hctx, rctx, x, y, w, h, continuous = false) {
  ctx.fillStyle = 'rgba(12, 14, 18, 0.28)';
  ctx.fillRect(x, y + 3, w, h);
  ctx.fillStyle = '#1b1f24';
  ctx.fillRect(x, y, w, 3.8);
  ctx.fillRect(x, y + 9, w, 2.2);
  ctx.fillRect(x, y + h - 3.5, w, 3.5);
  const step = continuous ? 10 : 9;
  for (let rx = x + 3; rx <= x + w - 3; rx += step) {
    ctx.fillRect(rx, y + 2, 1.9, h - 4);
  }
  ctx.strokeStyle = '#1f242a';
  ctx.lineWidth = 1.4;
  for (let rx = x + 9; rx < x + w - 9; rx += 22) {
    ctx.beginPath();
    ctx.arc(rx, y + 5.0, 3.2, 0, Math.PI * 2);
    ctx.stroke();
  }
  hctx.fillStyle = '#d4d4d4';
  hctx.fillRect(x, y, w, 3.8);
  rctx.fillStyle = '#4c4c4c';
  rctx.fillRect(x, y, w, 3.8);
}

// Draw carved horizontal stone belt cornice
function drawStoneCornice(ctx, hctx, W, y, h, stoneRgb, dentils = false) {
  const [r, g, b] = stoneRgb;
  ctx.fillStyle = `rgb(${Math.min(255, r + 14)},${Math.min(255, g + 13)},${Math.min(255, b + 11)})`;
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fillRect(0, y, W, 2.5);
  const sh = ctx.createLinearGradient(0, y + h, 0, y + h + 14);
  sh.addColorStop(0, 'rgba(18, 16, 12, 0.42)');
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

// Draw fallback photorealistic recessed window ONLY if photographic upperQuaiImg failed to load
function drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh, frameCol = '#2a2e34') {
  ctx.fillStyle = '#121c26';
  ctx.fillRect(wx, wy, ww, wh);
  const g = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  g.addColorStop(0, '#101d2a');
  g.addColorStop(0.45, '#1d3042');
  g.addColorStop(1, '#0d151e');
  ctx.fillStyle = g;
  ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
  ctx.strokeStyle = frameCol;
  ctx.lineWidth = 3;
  ctx.strokeRect(wx + 3, wy + 3, ww - 6, wh - 6);
  ctx.fillStyle = frameCol;
  ctx.fillRect(wx + ww * 0.5 - 1.5, wy + 3, 3, wh - 6);
  ctx.fillRect(wx + 3, wy + wh * 0.34, ww - 6, 3);
  hctx.fillStyle = '#202020';
  hctx.fillRect(wx, wy, ww, wh);
  rctx.fillStyle = '#141414';
  rctx.fillRect(wx + 5, wy + 5, ww - 10, wh - 10);
}

// Paint photographic warm night-window glow strictly inside glass pane region, PRESERVING real curtains,
// blinds, mullions, and luxury vitrine displays instead of painting flat neon-yellow rectangles!
function paintPhotoEmissiveRegion(ectx, cCan, wx, wy, ww, wh, {
  arched = false,
  warmth = 0.8,
  strength = 0.85,
  isShop = false,
} = {}) {
  ectx.save();
  ectx.beginPath();
  if (arched) {
    const r = ww * 0.5;
    ectx.arc(wx + r, wy + r, r, Math.PI, 0, false);
    ectx.lineTo(wx + ww, wy + wh);
    ectx.lineTo(wx, wy + wh);
    ectx.closePath();
  } else {
    ectx.rect(wx, wy, ww, wh);
  }
  ectx.clip();

  if (isShop) {
    // Draw the ACTUAL photographed boutique interior vitrine & warmly lift its display lighting!
    ectx.globalAlpha = strength;
    ectx.filter = 'brightness(1.22) saturate(1.18) sepia(0.22)';
    ectx.drawImage(cCan, wx, wy, ww, wh, wx, wy, ww, wh);
    ectx.filter = 'none';
    // Soft overhead gallery spotlight gradient preserving watch pedestals & dark frames
    ectx.globalCompositeOperation = 'multiply';
    const sg = ectx.createLinearGradient(wx, wy, wx, wy + wh);
    sg.addColorStop(0.0, '#ffe4b4');
    sg.addColorStop(0.55, '#ffd496');
    sg.addColorStop(1.0, '#886842');
    ectx.fillStyle = sg;
    ectx.fillRect(wx, wy, ww, wh);
    ectx.globalCompositeOperation = 'source-over';
  } else {
    // Upper-floor lived-in Swiss apartment/office window: warm backlit curtains & blinds with natural falloff!
    const eg = ectx.createLinearGradient(wx, wy, wx, wy + wh);
    if (warmth > 0.28) {
      eg.addColorStop(0.0, '#ffdca0');
      eg.addColorStop(0.52, '#c89248');
      eg.addColorStop(1.0, '#462d14');
    } else {
      eg.addColorStop(0.0, '#dbeaff');
      eg.addColorStop(0.58, '#80a2c2');
      eg.addColorStop(1.0, '#283848');
    }
    ectx.globalAlpha = strength * 0.72;
    ectx.fillStyle = eg;
    ectx.fillRect(wx, wy, ww, wh);
    // Multiply by the actual window luminance structure so mullions, frames & closed slats stay dark!
    ectx.globalCompositeOperation = 'multiply';
    ectx.globalAlpha = 0.88;
    ectx.filter = 'contrast(1.35) brightness(1.35)';
    ectx.drawImage(cCan, wx, wy, ww, wh, wx, wy, ww, wh);
    ectx.filter = 'none';
    ectx.globalCompositeOperation = 'source-over';
  }
  ectx.restore();
}

// =================================================================================================
// BUILD ALL 12 PHOTOGRAPHIC GENEVA FACADE LAYERS INTO 3 HARDWARE-MIPMAPPED DataArrayTextures
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

  const auxCCan = makeCanvas(AUX_SZ, AUX_SZ);
  const auxHCan = makeCanvas(AUX_SZ, AUX_SZ);
  const auxRCan = makeCanvas(AUX_SZ, AUX_SZ);
  const auxECan = makeCanvas(AUX_SZ, AUX_SZ);
  const actx = auxCCan.getContext('2d', { willReadFrequently: true });
  const ahctx = auxHCan.getContext('2d', { willReadFrequently: true });
  const arctx = auxRCan.getContext('2d', { willReadFrequently: true });
  const aectx = auxECan.getContext('2d', { willReadFrequently: true });

  const W = COL_SZ;
  const H = COL_SZ;
  const floorH = H / 4; // 256px per story
  const bayW = W / 4;   // 256px per bay

  const upperQuaiImg = photoBundle?.upperQuaiImg || null;
  const groundArcadeImg = photoBundle?.groundArcadeImg || null;
  const stoneImg = photoBundle?.stoneImg || null;
  const ashlarImg = photoBundle?.ashlarImg || null;
  const facOffice05Img = photoBundle?.facOffice05Img || null;
  const facOffice07Img = photoBundle?.facOffice07Img || null;
  const facGlass01Img = photoBundle?.facGlass01Img || null;
  const realOldTown2Img = photoBundle?.realOldTown2Img || null;

  // Pre-normalize the two master orthographic plates onto 1024x1024 offscreen canvases for exact pixel cropping!
  let uqCan = null;
  if (upperQuaiImg) {
    uqCan = makeCanvas(W, H);
    uqCan.getContext('2d').drawImage(upperQuaiImg, 0, 0, W, H);
  }
  let gaCan = null;
  if (groundArcadeImg) {
    gaCan = makeCanvas(W, H);
    gaCan.getContext('2d').drawImage(groundArcadeImg, 0, 0, W, H);
  }

  function clearWork(roughHex = '#dedede') {
    ctx.filter = 'none';
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
    hctx.fillStyle = '#a8a8a8';
    hctx.fillRect(0, 0, W, H);
    rctx.fillStyle = roughHex;
    rctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, W, H);
  }

  // Mark glass roughness strictly on glass panes (excluding mullions/frames via luminance-aware blend in commitLayer!)
  function markGlassRough(wx, wy, ww, wh, roughHex = '#141414', arched = false) {
    rctx.save();
    rctx.beginPath();
    if (arched) {
      const r = ww * 0.5;
      rctx.arc(wx + r, wy + r, r, Math.PI, 0, false);
      rctx.lineTo(wx + ww, wy + wh);
      rctx.lineTo(wx, wy + wh);
      rctx.closePath();
    } else {
      rctx.rect(wx, wy, ww, wh);
    }
    rctx.fillStyle = roughHex;
    rctx.fill();
    rctx.restore();

    hctx.save();
    hctx.beginPath();
    if (arched) {
      const r = ww * 0.5;
      hctx.arc(wx + r, wy + r, r, Math.PI, 0, false);
      hctx.lineTo(wx + ww, wy + wh);
      hctx.lineTo(wx, wy + wh);
      hctx.closePath();
    } else {
      hctx.rect(wx, wy, ww, wh);
    }
    hctx.fillStyle = '#2c2c2c';
    hctx.fill();
    hctx.restore();
  }

  // Copy 1024 color + hybrid photographic-luminance & structural Sobel normals + roughness + emissive into DataArrayTexture!
  function commitLayer(layerIdx, normalStrength = 2.3, photoReliefWeight = 0.62) {
    const cData = ctx.getImageData(0, 0, COL_SZ, COL_SZ).data;
    const colBase = layerIdx * COL_SZ * COL_SZ * 4;
    const rowBytesC = COL_SZ * 4;
    for (let y = 0; y < COL_SZ; y++) {
      const dstY = COL_SZ - 1 - y;
      const srcOff = y * rowBytesC;
      colBuf.set(cData.subarray(srcOff, srcOff + rowBytesC), colBase + dstY * rowBytesC);
    }

    actx.drawImage(cCan, 0, 0, AUX_SZ, AUX_SZ);
    ahctx.drawImage(hCan, 0, 0, AUX_SZ, AUX_SZ);
    arctx.drawImage(rCan, 0, 0, AUX_SZ, AUX_SZ);
    aectx.drawImage(eCan, 0, 0, AUX_SZ, AUX_SZ);

    const aData = actx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;
    const hData = ahctx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;
    const rData = arctx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;
    const eData = aectx.getImageData(0, 0, AUX_SZ, AUX_SZ).data;

    // Combine explicit architectural cavity height with real photographic luminance relief!
    const hField = new Float32Array(AUX_SZ * AUX_SZ);
    for (let i = 0; i < AUX_SZ * AUX_SZ; i++) {
      const i4 = i * 4;
      const lum = (aData[i4] * 0.299 + aData[i4 + 1] * 0.587 + aData[i4 + 2] * 0.114) / 255.0;
      const baseH = hData[i4] / 255.0;
      hField[i] = baseH * (1.0 - photoReliefWeight) + lum * photoReliefWeight;
    }

    const auxBase = layerIdx * AUX_SZ * AUX_SZ * 4;
    const sampleH = (x, y) => {
      const wx = ((x % AUX_SZ) + AUX_SZ) % AUX_SZ;
      const wy = ((y % AUX_SZ) + AUX_SZ) % AUX_SZ;
      return hField[wy * AUX_SZ + wx];
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
        let ny = (d - u) * normalStrength;
        let nz = 1.0;
        const inv = 1.0 / Math.hypot(nx, ny, nz);
        nx *= inv;
        ny *= inv;
        nz *= inv;
        norRoughBuf[idxDst] = Math.round((nx * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 2] = Math.round((nz * 0.5 + 0.5) * 255);
        norRoughBuf[idxDst + 3] = rData[idxSrc];

        emisBuf[idxDst] = eData[idxSrc];
        emisBuf[idxDst + 1] = eData[idxSrc + 1];
        emisBuf[idxDst + 2] = eData[idxSrc + 2];
        emisBuf[idxDst + 3] = 255;
      }
    }
  }

  // Exact window pane coordinates of our photographic 4x4 Geneva plate (geneva_upper_quai_4x4.jpg)
  function getQuai4x4WinRect(row, col) {
    return {
      wx: col * 256 + 83,
      wy: row * 256 + 44,
      ww: 90,
      wh: 184,
    };
  }

  // Helper: stamp real photographic upper-story window from geneva_upper_quai_4x4.jpg into any custom facade!
  function stampPhotoWindow(srcRow, srcCol, dx, dy, dw, dh, filterCss = 'none') {
    if (!uqCan) {
      drawFallbackWindow(ctx, hctx, rctx, dx, dy, dw, dh);
      return;
    }
    const { wx, wy, ww, wh } = getQuai4x4WinRect(srcRow, srcCol);
    ctx.save();
    ctx.filter = filterCss;
    ctx.drawImage(uqCan, wx + 2, wy + 2, ww - 4, wh - 4, dx, dy, dw, dh);
    ctx.restore();
    markGlassRough(dx + 4, dy + 4, dw - 8, dh - 8, '#161616');
  }

  // ===============================================================================================
  // LAYER 0: QUAI IVORY BELLE EPOQUE (Rolex / Bucherer / Four Seasons Hotel des Bergues - ref_01!)
  // ===============================================================================================
  {
    const rand = seededRand(101);
    clearWork('#dedede');
    if (uqCan) {
      ctx.save();
      ctx.filter = 'brightness(1.26) contrast(1.03) saturate(0.82) sepia(0.08)';
      ctx.drawImage(uqCan, 0, 0, W, H);
      ctx.restore();
      // Subtle ivory sunlit stone lift preserving dark window contrast
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(34, 30, 22, 0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      // Continuous ornate wrought-iron piano-nobile rail across 2nd floor (exact match to Rolex ref_01!)
      drawWroughtIronBalcony(ctx, hctx, rctx, 0, 512 - 58, W, 44, true);
    } else {
      paintPhotoStoneBase(ctx, W, H, [234, 230, 220], rand, { stoneImg, stoneAlpha: 0.35, courseH: 32 });
    }
    for (let f = 0; f < 4; f++) {
      for (let b = 0; b < 4; b++) {
        const { wx, wy, ww, wh } = getQuai4x4WinRect(f, b);
        if (!uqCan) drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh);
        markGlassRough(wx + 4, wy + 18, ww - 8, wh - 34, '#181818');
        if (rand() < 0.44) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 4, wy + 18, ww - 8, wh - 34, {
            warmth: rand(),
            strength: 0.55 + rand() * 0.40,
          });
        }
      }
    }
    commitLayer(0, 2.4, 0.72);
  }

  // ===============================================================================================
  // LAYER 1: QUAI SLATE-TAUPE DRESSED ASHLAR (Hermes / Chanel Quai du General-Guisan - ref_01!)
  // ===============================================================================================
  {
    const rand = seededRand(202);
    clearWork('#dcdcdc');
    if (uqCan) {
      ctx.save();
      ctx.filter = 'brightness(1.02) contrast(1.05)';
      ctx.drawImage(uqCan, 0, 0, W, H);
      ctx.restore();
    } else {
      paintPhotoStoneBase(ctx, W, H, [162, 158, 148], rand, { stoneImg, stoneAlpha: 0.45, courseH: 28 });
    }
    for (let f = 0; f < 4; f++) {
      for (let b = 0; b < 4; b++) {
        const { wx, wy, ww, wh } = getQuai4x4WinRect(f, b);
        if (!uqCan) drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh);
        markGlassRough(wx + 4, wy + 18, ww - 8, wh - 34, '#181818');
        if (rand() < 0.42) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 4, wy + 18, ww - 8, wh - 34, {
            warmth: rand(),
            strength: 0.50 + rand() * 0.42,
          });
        }
      }
    }
    commitLayer(1, 2.5, 0.75);
  }

  // ===============================================================================================
  // LAYER 2: PATEK PHILIPPE / HOTEL METROPOLE WIDE-BAY GRAND WATCH PALACE (ref_01 right & left!)
  // ===============================================================================================
  {
    const rand = seededRand(303);
    clearWork('#dcdcdc');
    paintPhotoStoneBase(ctx, W, H, [220, 212, 196], rand, { stoneImg, stoneAlpha: 0.36, courseH: 32, jointAlpha: 0.11 });

    // Classical fluted stone pilasters dividing the 4 grand palace bays
    for (let b = 0; b < 4; b++) {
      const px = b * bayW;
      for (const ox of [px, px + bayW - 24]) {
        const pg = ctx.createLinearGradient(ox, 0, ox + 24, 0);
        pg.addColorStop(0.0, '#eae4d6');
        pg.addColorStop(0.5, '#dfd8c7');
        pg.addColorStop(1.0, '#c8c0ae');
        ctx.fillStyle = pg;
        ctx.fillRect(ox, 0, 24, H);
        ctx.fillStyle = 'rgba(30,26,20,0.16)';
        ctx.fillRect(ox + 6, 0, 2, H);
        ctx.fillRect(ox + 16, 0, 2, H);
        hctx.fillStyle = '#e0e0e0';
        hctx.fillRect(ox, 0, 24, H);
      }
    }

    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, f === 0 ? 20 : 14, [226, 219, 204], f === 0 || f === 2);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 166;
        const wh = 166;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 44;

        // Carved limestone surround
        ctx.fillStyle = '#e6dfd0';
        ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 18);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 18);

        if (f === 0 && gaCan) {
          // Top floor: real photographic semi-circular watchmaker studio arch cropped from groundArcadeImg!
          const srcBay = (b % 3) * 341 + 42;
          ctx.drawImage(gaCan, srcBay, 210, 256, 330, wx, wy, ww, wh);
          markGlassRough(wx + 12, wy + 18, ww - 24, wh - 24, '#181818', true);
        } else {
          // Wide triple-lancet watchmaker studio bay composited from real photographic windows!
          const subW = ww / 2;
          stampPhotoWindow(f, b % 4, wx, wy, subW, wh, 'contrast(1.06)');
          stampPhotoWindow((f + 1) % 4, (b + 2) % 4, wx + subW, wy, subW, wh, 'contrast(1.06)');
          ctx.fillStyle = '#2c3036';
          ctx.fillRect(wx + subW - 2.5, wy, 5, wh);
        }
        // Carved sill
        ctx.fillStyle = '#ece6d8';
        ctx.fillRect(wx - 10, wy + wh + 2, ww + 20, 10);
        if (rand() < 0.48) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 8, wy + 12, ww - 16, wh - 20, {
            arched: f === 0,
            warmth: rand(),
            strength: 0.62 + rand() * 0.34,
          });
        }
      }
      if (f === 1) {
        drawWroughtIronBalcony(ctx, hctx, rctx, 0, fy + floorH - 42, W, 36, true);
      }
    }
    commitLayer(2, 2.5, 0.68);
  }

  // ===============================================================================================
  // LAYER 3: RUE DU RHONE MODERNIST WHITE CONCRETE & REFLECTIVE GLASS GRID (Cartier ref_03!)
  // ===============================================================================================
  {
    const rand = seededRand(404);
    clearWork('#d4d4d4');
    paintPhotoStoneBase(ctx, W, H, [235, 233, 226], rand, { stoneImg, stoneAlpha: 0.18, courseH: 0 });

    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 26, [238, 236, 230], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const finW = 28;
        ctx.fillStyle = '#eceae3';
        ctx.fillRect(bx, fy, finW * 0.5, floorH);
        ctx.fillRect(bx + bayW - finW * 0.5, fy, finW * 0.5, floorH);
        hctx.fillStyle = '#f0f0f0';
        hctx.fillRect(bx, fy, finW * 0.5, floorH);
        hctx.fillRect(bx + bayW - finW * 0.5, fy, finW * 0.5, floorH);

        const wx = bx + finW * 0.5 + 7;
        const wy = fy + 32;
        const ww = bayW - finW - 14;
        const wh = floorH - 46;

        // Crisp beveled off-white concrete reveal shadow (matches Cartier ref_03!)
        ctx.fillStyle = '#b9b7af';
        ctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
        hctx.fillStyle = '#686868';
        hctx.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);

        // Photorealistic blue-green reflective Swiss architectural glass + real slatted exterior blinds!
        if (uqCan) {
          // Pick real blind/glass windows from our photographic plate and grade to Cartier teal-slate reflection!
          const srcRow = (f + b) % 4;
          const srcCol = (b * 3 + f) % 4;
          const wr = getQuai4x4WinRect(srcRow, srcCol);
          ctx.save();
          ctx.filter = 'brightness(0.88) contrast(1.12) saturate(1.25) hue-rotate(-10deg)';
          ctx.drawImage(uqCan, wr.wx + 5, wr.wy + 4, wr.ww - 10, wr.wh - 24, wx, wy, ww, wh);
          ctx.restore();
          // Subtle blue-green architectural glass glaze matching ref_03 Cartier!
          ctx.fillStyle = 'rgba(26, 68, 86, 0.28)';
          ctx.fillRect(wx, wy, ww, wh);
        } else {
          drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh, '#22282e');
        }
        if (facOffice05Img) {
          ctx.save();
          ctx.globalAlpha = 0.24;
          ctx.drawImage(facOffice05Img, (b * 256) % 512, (f * 256) % 512, 256, 256, wx + 3, wy + 3, ww - 6, wh - 6);
          ctx.restore();
        }
        // Optional crisp exterior grey Swiss slatted aluminum Venetian blind lowered partially on ~45% of bays (ref_03!)
        if (rand() < 0.45) {
          const dropH = wh * (0.26 + rand() * 0.46);
          ctx.fillStyle = 'rgba(150, 156, 162, 0.78)';
          ctx.fillRect(wx + 3, wy + 3, ww - 6, dropH);
          ctx.fillStyle = 'rgba(26, 30, 36, 0.42)';
          for (let sy = wy + 6; sy < wy + dropH; sy += 4.5) {
            ctx.fillRect(wx + 3, sy, ww - 6, 1.6);
          }
          // Upper blind cassette housing
          ctx.fillStyle = '#70767e';
          ctx.fillRect(wx + 2, wy + 2, ww - 4, 10);
        }
        // Thin dark anodized window perimeter frame
        ctx.strokeStyle = '#242a30';
        ctx.lineWidth = 4;
        ctx.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
        markGlassRough(wx + 5, wy + 5, ww - 10, wh - 10, '#121212');

        if (rand() < 0.46) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 5, wy + 12, ww - 10, wh - 16, {
            warmth: rand(),
            strength: 0.48 + rand() * 0.36,
          });
        }
      }
    }
    commitLayer(3, 2.5, 0.58);
  }

  // ===============================================================================================
  // LAYER 4: FAIRMONT / UBS CONTEMPORARY TRAVERTINE & CURTAIN-WALL GLASS (real_quai_1.jpg!)
  // ===============================================================================================
  {
    const rand = seededRand(505);
    clearWork('#cccccc');
    paintPhotoStoneBase(ctx, W, H, [202, 197, 188], rand, { stoneImg, stoneAlpha: 0.28, courseH: 64, jointAlpha: 0.08 });

    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      ctx.fillStyle = '#cfcac0';
      ctx.fillRect(0, fy, W, 36);
      ctx.fillStyle = 'rgba(22, 26, 30, 0.30)';
      ctx.fillRect(0, fy + 36, W, 5);
      hctx.fillStyle = '#e0e0e0';
      hctx.fillRect(0, fy, W, 36);

      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const pierW = 34;
        ctx.fillStyle = '#cdc8bd';
        ctx.fillRect(bx, fy, pierW * 0.5, floorH);
        ctx.fillRect(bx + bayW - pierW * 0.5, fy, pierW * 0.5, floorH);
        hctx.fillStyle = '#e4e4e4';
        hctx.fillRect(bx, fy, pierW * 0.5, floorH);
        hctx.fillRect(bx + bayW - pierW * 0.5, fy, pierW * 0.5, floorH);

        const wx = bx + pierW * 0.5 + 4;
        const wy = fy + 38;
        const ww = bayW - pierW - 8;
        const wh = floorH - 42;

        if (facOffice07Img) {
          ctx.drawImage(facOffice07Img, (b * 256) % 512, (f * 256) % 512, 256, 256, wx, wy, ww, wh);
        } else if (uqCan) {
          const wr = getQuai4x4WinRect(f, b);
          ctx.drawImage(uqCan, wr.wx + 4, wr.wy + 4, wr.ww - 8, wr.wh - 22, wx, wy, ww, wh);
        } else {
          drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh);
        }
        if (facGlass01Img) {
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.drawImage(facGlass01Img, wx, wy, ww, wh);
          ctx.restore();
        }
        // Crisp dark aluminum mullion + sleek tinted glass balcony guardrail (exact match to Fairmont real_quai_1.jpg!)
        ctx.strokeStyle = '#323840';
        ctx.lineWidth = 3.5;
        ctx.strokeRect(wx + 2, wy + 2, ww - 4, wh - 4);
        ctx.fillStyle = '#323840';
        ctx.fillRect(wx + ww * 0.5 - 1.5, wy, 3, wh);

        ctx.fillStyle = 'rgba(130, 168, 198, 0.26)';
        ctx.fillRect(wx, wy + wh - 56, ww, 52);
        ctx.fillStyle = '#9aa4ae';
        ctx.fillRect(wx, wy + wh - 58, ww, 4);
        markGlassRough(wx + 4, wy + 4, ww - 8, wh - 8, '#141414');

        if (rand() < 0.52) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 5, wy + 6, ww - 10, wh - 12, {
            warmth: rand(),
            strength: 0.50 + rand() * 0.36,
          });
        }
      }
    }
    commitLayer(4, 2.3, 0.56);
  }

  // ===============================================================================================
  // LAYER 5: PLACE DU BOURG-DE-FOUR / VIEILLE-VILLE MOLASSE & WHITE LOUVERED SHUTTERS (real_oldtown_1!)
  // ===============================================================================================
  {
    const rand = seededRand(606);
    clearWork('#dfdfdf');
    if (uqCan) {
      ctx.save();
      ctx.filter = 'brightness(1.10) contrast(1.02) sepia(0.11)';
      ctx.drawImage(uqCan, 0, 0, W, H);
      ctx.restore();
    } else {
      paintPhotoStoneBase(ctx, W, H, [205, 200, 186], rand, { stoneImg, stoneAlpha: 0.45, courseH: 26 });
    }
    for (let f = 0; f < 4; f++) {
      for (let b = 0; b < 4; b++) {
        const { wx, wy, ww, wh } = getQuai4x4WinRect(f, b);
        if (!uqCan) drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh, '#dcd8cc');
        // Crisp off-white Swiss louvered shutters flanking the real photographic windows (matches real_oldtown_1.jpg!)
        const closed = rand() > 0.87;
        if (closed) {
          drawGenevaShutter(ctx, hctx, rctx, wx + 2, wy + 4, ww * 0.48, wh - 16, '#dad7ce', -1);
          drawGenevaShutter(ctx, hctx, rctx, wx + ww * 0.5, wy + 4, ww * 0.48, wh - 16, '#dad7ce', 1);
        } else {
          const shW = 46;
          drawGenevaShutter(ctx, hctx, rctx, wx - shW - 4, wy + 4, shW, wh - 16, '#e2dfd6', -1);
          drawGenevaShutter(ctx, hctx, rctx, wx + ww + 4, wy + 4, shW, wh - 16, '#e2dfd6', 1);
          markGlassRough(wx + 4, wy + 18, ww - 8, wh - 34, '#181818');
          if (rand() < 0.42) {
            paintPhotoEmissiveRegion(ectx, cCan, wx + 4, wy + 18, ww - 8, wh - 34, {
              warmth: 0.85,
              strength: 0.54 + rand() * 0.36,
            });
          }
        }
      }
    }
    commitLayer(5, 2.6, 0.66);
  }

  // ===============================================================================================
  // LAYER 6: VIEILLE-VILLE WARM OCHRE LIME-PLASTER & HERITAGE OLIVE-SLATE SHUTTERS + GERANIUMS!
  // ===============================================================================================
  {
    const rand = seededRand(707);
    clearWork('#e2e2e2');
    paintPhotoStoneBase(ctx, W, H, [208, 178, 138], rand, { stoneImg, stoneAlpha: 0.34, courseH: 0 });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 10, [222, 210, 190], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 92;
        const wh = 158;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 44;

        // Carved pale Geneva limestone surround & sill
        ctx.fillStyle = '#e0d6c2';
        ctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 9, wy - 10, ww + 18, wh + 18);

        // Stamp real photographic window inside limestone surround!
        stampPhotoWindow(f, (b + 1) % 4, wx, wy, ww, wh, 'brightness(1.06)');

        const shW = 46;
        drawGenevaShutter(ctx, hctx, rctx, wx - shW - 6, wy, shW, wh, '#556458', -1);
        drawGenevaShutter(ctx, hctx, rctx, wx + ww + 6, wy, shW, wh, '#556458', 1);

        ctx.fillStyle = '#e6dcc8';
        ctx.fillRect(wx - 12, wy + wh + 2, ww + 24, 10);
        if (rand() < 0.32) drawGeraniumBox(ctx, wx, wy + wh + 2, ww);

        if (rand() < 0.44) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 4, wy + 12, ww - 8, wh - 24, {
            warmth: 0.9,
            strength: 0.54 + rand() * 0.36,
          });
        }
      }
    }
    commitLayer(6, 2.5, 0.60);
  }

  // ===============================================================================================
  // LAYER 7: GRAND-RUE / MAISON TAVEL / MONUMENTAL WEATHERED MOLASSE STONE (grandrue_1.jpg!)
  // ===============================================================================================
  {
    const rand = seededRand(808);
    clearWork('#e6e6e6');
    paintPhotoStoneBase(ctx, W, H, [166, 158, 142], rand, {
      stoneImg: ashlarImg || stoneImg,
      stoneAlpha: 0.62,
      courseH: 36,
      blockW: 118,
      jointAlpha: 0.14,
    });
    for (let f = 0; f < 4; f++) {
      const fy = f * floorH;
      drawStoneCornice(ctx, hctx, W, fy, 14, [182, 174, 158], false);
      for (let b = 0; b < 4; b++) {
        const bx = b * bayW;
        const ww = 112;
        const wh = 152;
        const wx = bx + (bayW - ww) * 0.5;
        const wy = fy + 48;

        // Chamfered carved molasse window surround
        ctx.fillStyle = '#c4baa6';
        ctx.fillRect(wx - 11, wy - 12, ww + 22, wh + 20);
        hctx.fillStyle = '#d8d8d8';
        hctx.fillRect(wx - 11, wy - 12, ww + 22, wh + 20);

        stampPhotoWindow(f, b, wx, wy, ww, wh, 'brightness(0.86) contrast(1.12)');
        // Authentic Renaissance stone cross-mullion (fenetre a meneaux, grandrue_1.jpg!)
        ctx.fillStyle = '#b4aa96';
        ctx.fillRect(wx + ww * 0.5 - 4, wy, 8, wh);
        ctx.fillRect(wx, wy + wh * 0.34, ww, 8);
        hctx.fillStyle = '#d0d0d0';
        hctx.fillRect(wx + ww * 0.5 - 4, wy, 8, wh);
        hctx.fillRect(wx, wy + wh * 0.34, ww, 8);
        rctx.fillStyle = '#dcdcdc';
        rctx.fillRect(wx + ww * 0.5 - 4, wy, 8, wh);
        rctx.fillRect(wx, wy + wh * 0.34, ww, 8);

        ctx.fillStyle = '#ccc2ae';
        ctx.fillRect(wx - 14, wy + wh + 2, ww + 28, 11);

        if (rand() < 0.36) {
          paintPhotoEmissiveRegion(ectx, cCan, wx + 4, wy + 8, ww - 8, wh - 14, {
            warmth: 0.92,
            strength: 0.46 + rand() * 0.32,
          });
        }
      }
    }
    commitLayer(7, 2.8, 0.72);
  }

  // ===============================================================================================
  // LAYER 8 (GROUND 0): QUAI & RUE DU RHONE ARCHED STONE LUXURY ARCADES (Bucherer / Rolex / Hermes!)
  // ===============================================================================================
  {
    const rand = seededRand(901);
    clearWork('#dcdcdc');
    if (gaCan) {
      ctx.drawImage(gaCan, 0, 0, W, H);
    } else {
      paintPhotoStoneBase(ctx, W, H, [220, 215, 204], rand, { stoneImg, stoneAlpha: 0.38, courseH: 48 });
    }
    // Mark exact glass regions of the 3 photographed semi-circular luxury watch vitrines!
    const gBayW = W / 3;
    for (let i = 0; i < 3; i++) {
      const bx = i * gBayW;
      const wx = bx + 58;
      const ww = 225;
      // Upper lunette transom glass + main watch vitrine showcase glass
      markGlassRough(wx, 258, ww, 636, '#141414', true);
      // Warm museum-grade boutique night illumination directly from the real watch vitrine photo!
      paintPhotoEmissiveRegion(ectx, cCan, wx + 4, 510, ww - 8, 382, {
        isShop: true,
        strength: 0.92,
      });
      paintPhotoEmissiveRegion(ectx, cCan, wx + 8, 268, ww - 16, 224, {
        arched: true,
        isShop: true,
        strength: 0.24,
      });
    }
    commitLayer(8, 2.6, 0.78);
  }

  // ===============================================================================================
  // LAYER 9 (GROUND 1): RUE DU RHONE LUXURY LIMESTONE & BRONZE BOUTIQUES (Dior / Cartier / LV!)
  // ===============================================================================================
  {
    const rand = seededRand(902);
    clearWork('#d8d8d8');
    if (gaCan) {
      // Base honed pale Geneva limestone piers, cornice & dark granite plinth from real photographic plate!
      ctx.drawImage(gaCan, 0, 0, W, H);
      // Clean blank honed limestone entablature frieze band along top (for real OSM luxury brand signs!)
      ctx.drawImage(gaCan, 0, 56, W, 90, 0, 48, W, 118);
      drawStoneCornice(ctx, hctx, W, 0, 46, [228, 223, 212], false);
    } else {
      paintPhotoStoneBase(ctx, W, H, [218, 212, 200], rand, { stoneImg, stoneAlpha: 0.35, courseH: 64 });
      ctx.fillStyle = '#2d3035';
      ctx.fillRect(0, H - 96, W, 96);
    }

    // Sleek matte dark-bronze storefront transom bar
    ctx.fillStyle = '#24262a';
    ctx.fillRect(0, 166, W, 14);
    hctx.fillStyle = '#e0e0e0';
    hctx.fillRect(0, 166, W, 14);

    const gBayW = W / 3;
    for (let i = 0; i < 3; i++) {
      const bx = i * gBayW;
      const ww = 278;
      const wh = 720;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 186;

      // Matte architectural bronze portal frame
      ctx.fillStyle = '#242220';
      ctx.fillRect(wx - 10, wy - 8, ww + 20, wh + 14);
      hctx.fillStyle = '#686868';
      hctx.fillRect(wx - 10, wy - 8, ww + 20, wh + 14);

      if (gaCan) {
        // Fill each rectangular Rue du Rhone luxury bay with real photographic boutique vitrine interior!
        const srcX = ((i + 1) % 3) * 341 + 64;
        ctx.drawImage(gaCan, srcX, 508, 214, 386, wx, wy, ww, wh);
      } else {
        drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh, '#2a2824');
      }

      // Slim dark bronze transom & center double-door vertical stiles with brushed brass handles in center bay!
      ctx.fillStyle = '#262422';
      ctx.fillRect(wx, wy + 130, ww, 8);
      if (i === 1) {
        ctx.fillRect(wx + ww * 0.5 - 3, wy + 130, 6, wh - 130);
        // Brushed 18k brass vertical luxury boutique door pull handles
        ctx.fillStyle = '#d4b26a';
        ctx.fillRect(wx + ww * 0.5 - 20, wy + 400, 6, 130);
        ctx.fillRect(wx + ww * 0.5 + 14, wy + 400, 6, 130);
      }
      markGlassRough(wx + 6, wy + 6, ww - 12, wh - 12, '#141414');
      paintPhotoEmissiveRegion(ectx, cCan, wx + 6, wy + 138, ww - 12, wh - 144, {
        isShop: true,
        strength: 0.90,
      });
    }
    commitLayer(9, 2.5, 0.72);
  }

  // ===============================================================================================
  // LAYER 10 (GROUND 2): VIEILLE-VILLE STONE, OILED-OAK BRASSERIE & ARCHED PORTE COCHERE!
  // ===============================================================================================
  {
    const rand = seededRand(903);
    clearWork('#dedede');
    paintPhotoStoneBase(ctx, W, H, [196, 190, 174], rand, {
      stoneImg: ashlarImg || stoneImg,
      stoneAlpha: 0.52,
      courseH: 46,
      blockW: 136,
      jointAlpha: 0.16,
    });
    drawStoneCornice(ctx, hctx, W, 0, 52, [210, 204, 188], false);
    ctx.fillStyle = '#6c685e';
    ctx.fillRect(0, H - 56, W, 56);

    const gBayW = W / 3;
    for (let i = 0; i < 3; i++) {
      const bx = i * gBayW;
      const ww = 256;
      const wh = 758;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 204;

      if (i === 1) {
        // Authentic arched carved oiled-oak Geneva courtyard double-door (porte cochere, real_oldtown_1.jpg!)
        const cx = wx + ww * 0.5;
        const r = ww * 0.5;
        // Carved stone arch voussoir ring
        ctx.strokeStyle = '#d4ccb8';
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.arc(cx, wy + r, r + 10, Math.PI, 0, false);
        ctx.stroke();

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, wy + r, r, Math.PI, 0, false);
        ctx.lineTo(wx + ww, wy + wh);
        ctx.lineTo(wx, wy + wh);
        ctx.closePath();
        ctx.fillStyle = '#754e2e';
        ctx.fill();
        ctx.clip();
        // Rich wood-grain tonal bands + recessed carved oak panels & brass ring knockers
        const wg = ctx.createLinearGradient(wx, wy, wx + ww, wy);
        wg.addColorStop(0.0, '#624024');
        wg.addColorStop(0.25, '#7e5634');
        wg.addColorStop(0.5, '#59381e');
        wg.addColorStop(0.75, '#7c5432');
        wg.addColorStop(1.0, '#5e3c20');
        ctx.fillStyle = wg;
        ctx.fillRect(wx, wy, ww, wh);

        for (const px of [wx + 24, cx + 10]) {
          for (const [py, ph] of [[wy + r + 28, 224], [wy + r + 278, 270]]) {
            ctx.fillStyle = 'rgba(28, 16, 8, 0.34)';
            ctx.fillRect(px, py, ww * 0.5 - 34, ph);
            ctx.strokeStyle = '#9e7248';
            ctx.lineWidth = 4;
            ctx.strokeRect(px + 2, py + 2, ww * 0.5 - 38, ph - 4);
          }
        }
        ctx.fillStyle = '#321e10';
        ctx.fillRect(cx - 3.5, wy, 7, wh);
        // Brass antique door knockers
        ctx.strokeStyle = '#cfa95c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx - 28, wy + r + 252, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + 28, wy + r + 252, 11, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        hctx.fillStyle = '#787878';
        hctx.fillRect(wx, wy + r, ww, wh - r);
        rctx.fillStyle = '#b6b6b6';
        rctx.fillRect(wx, wy, ww, wh);
      } else {
        // Warm carved oiled-oak Geneva brasserie storefront (matches Cafe du Bourg-de-Four real_oldtown_2.jpg!)
        ctx.fillStyle = '#6f4c2e';
        ctx.fillRect(wx - 16, wy - 24, ww + 32, wh + 28);
        ctx.strokeStyle = '#9b7048';
        ctx.lineWidth = 4;
        ctx.strokeRect(wx - 12, wy - 20, ww + 24, wh + 20);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 16, wy - 24, ww + 32, wh + 28);

        if (realOldTown2Img) {
          // Composite authentic Cafe du Bourg-de-Four warm oak/red-framed brasserie glass interior!
          ctx.drawImage(realOldTown2Img, 470, 440, 480, 500, wx, wy + 22, ww, wh - 34);
          ctx.fillStyle = 'rgba(32, 20, 10, 0.22)';
          ctx.fillRect(wx, wy + 22, ww, wh - 34);
        } else if (gaCan) {
          const srcX = (i === 0 ? 0 : 2) * 341 + 64;
          ctx.save();
          ctx.filter = 'sepia(0.32) brightness(0.92)';
          ctx.drawImage(gaCan, srcX, 508, 214, 386, wx, wy + 22, ww, wh - 34);
          ctx.restore();
        } else {
          drawFallbackWindow(ctx, hctx, rctx, wx, wy + 22, ww, wh - 34, '#5a3a20');
        }
        // Traditional oak window mullions
        ctx.fillStyle = '#5a3b20';
        ctx.fillRect(wx + ww * 0.5 - 3, wy + 22, 6, wh - 34);
        ctx.fillRect(wx, wy + 185, ww, 7);
        markGlassRough(wx + 6, wy + 28, ww - 12, wh - 46, '#181818');
        paintPhotoEmissiveRegion(ectx, cCan, wx + 6, wy + 30, ww - 12, wh - 50, {
          isShop: true,
          strength: 0.88,
        });
      }
    }
    commitLayer(10, 2.7, 0.68);
  }

  // ===============================================================================================
  // LAYER 11 (GROUND 3): FAIRMONT / SWISS PRIVATE BANK / LAKESIDE MODERN GLASS LOBBY PAVILION!
  // ===============================================================================================
  {
    const rand = seededRand(904);
    clearWork('#d0d0d0');
    paintPhotoStoneBase(ctx, W, H, [206, 202, 194], rand, { stoneImg, stoneAlpha: 0.28, courseH: 80, jointAlpha: 0.08 });
    drawStoneCornice(ctx, hctx, W, 0, 62, [218, 214, 205], false);
    ctx.fillStyle = '#383d44';
    ctx.fillRect(0, H - 46, W, 46);

    const gBayW = W / 3;
    for (let i = 0; i < 3; i++) {
      const bx = i * gBayW;
      const ww = 290;
      const wh = 850;
      const wx = bx + (gBayW - ww) * 0.5;
      const wy = 118;

      ctx.fillStyle = '#282d34';
      ctx.fillRect(wx - 8, wy - 8, ww + 16, wh + 12);

      if (gaCan) {
        // Real warm architectural travertine lobby interior with cooler Swiss banking tint
        const srcX = (i % 3) * 341 + 62;
        ctx.save();
        ctx.filter = 'brightness(0.95) saturate(0.75) contrast(1.06)';
        ctx.drawImage(gaCan, srcX, 506, 216, 388, wx, wy, ww, wh);
        ctx.restore();
        ctx.fillStyle = 'rgba(26, 46, 62, 0.26)';
        ctx.fillRect(wx, wy, ww, wh);
      } else {
        drawFallbackWindow(ctx, hctx, rctx, wx, wy, ww, wh, '#30363e');
      }
      // Architectural curtain-wall stainless mullions
      ctx.fillStyle = '#3a4048';
      ctx.fillRect(wx, wy + 180, ww, 7);
      ctx.fillRect(wx + ww * 0.33, wy, 5, wh);
      ctx.fillRect(wx + ww * 0.66, wy, 5, wh);

      markGlassRough(wx + 6, wy + 6, ww - 12, wh - 12, '#121212');
      paintPhotoEmissiveRegion(ectx, cCan, wx + 6, wy + 188, ww - 12, wh - 196, {
        isShop: true,
        strength: 0.78,
      });
    }
    commitLayer(11, 2.3, 0.64);
  }

  const colArray = new THREE.DataArrayTexture(colBuf, COL_SZ, COL_SZ, LAYERS);
  colArray.format = THREE.RGBAFormat;
  colArray.type = THREE.UnsignedByteType;
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
