import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function loadImg(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function loadTex(url, srgb = true, repeat = 1) {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(url);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 16;
  return tex;
}

// Preload all real Poly Haven & ambientCG PBR photographs and surface maps
export async function loadPhotoPBRBundle() {
  const [
    asphaltImg,
    paverImg,
    stoneImg,
    ashlarImg,
    brickImg,
    barkImg,
    leafColorImg,
    leafOpacityImg,
    realOldTownImg,
    realOldTown2Img,
    grandRueImg,
    groundArcadeImg,
    upperQuaiImg,
    facGlass01Img,
    facOffice05Img,
    facOffice07Img,
  ] = await Promise.all([
    loadImg('/textures/asphalt_diff.jpg'),
    loadImg('/textures/paver_diff.jpg'),
    loadImg('/textures/stone_wall_diff.jpg'),
    loadImg('/textures/euro_ashlar_diff.jpg'),
    loadImg('/textures/euro_brick_diff.jpg'),
    loadImg('/textures/bark_diff.jpg'),
    loadImg('/textures/pbr/LeafSet009_1K-JPG_Color.jpg'),
    loadImg('/textures/pbr/LeafSet009_1K-JPG_Opacity.jpg'),
    loadImg('/textures/facades/real_oldtown_1.jpg'),
    loadImg('/textures/facades/real_oldtown_2.jpg'),
    loadImg('/textures/facades/grandrue_1.jpg'),
    loadImg('/textures/facades/geneva_ground_arcade.jpg'),
    loadImg('/textures/facades/geneva_upper_quai_4x4.jpg'),
    loadImg('/textures/pbr/Facade001_1K-JPG_Color.jpg'),
    loadImg('/textures/pbr/Facade005_1K-JPG_Color.jpg'),
    loadImg('/textures/pbr/Facade007_1K-JPG_Color.jpg'),
  ]);

  return {
    asphaltImg,
    paverImg,
    stoneImg,
    ashlarImg,
    brickImg,
    barkImg,
    leafColorImg,
    leafOpacityImg,
    realOldTownImg,
    realOldTown2Img,
    grandRueImg,
    groundArcadeImg,
    upperQuaiImg,
    facGlass01Img,
    facOffice05Img,
    facOffice07Img,
    asphaltNor: loadTex('/textures/asphalt_nor.jpg', false, 1),
    asphaltRough: loadTex('/textures/asphalt_rough.jpg', false, 1),
    paverDiff: loadTex('/textures/paver_diff.jpg', true, 1),
    paverNor: loadTex('/textures/paver_nor.jpg', false, 1),
    paverRough: loadTex('/textures/paver_rough.jpg', false, 1),
    parkGrassDiff: loadTex('/textures/park_grass_diff.jpg', true, 1),
    parkGrassNor: loadTex('/textures/park_grass_nor.jpg', false, 1),
    stoneNor: loadTex('/textures/stone_wall_nor.jpg', false, 2),
    ashlarNor: loadTex('/textures/euro_ashlar_nor.jpg', false, 2),
    barkDiff: loadTex('/textures/bark_diff.jpg', true, 2),
    barkNor: loadTex('/textures/bark_nor.jpg', false, 2),
    barkRough: loadTex('/textures/bark_rough.jpg', false, 2),
    alpineRockDiff: loadTex('/textures/alpine_rock_diff.jpg', true, 1),
    alpineRockNor: loadTex('/textures/alpine_rock_nor.jpg', false, 1),
    slateRoofDiff: loadTex('/textures/slate_roof_diff.jpg', true, 2),
    slateRoofNor: loadTex('/textures/slate_roof_nor.jpg', false, 2),
    slateRoofRough: loadTex('/textures/slate_roof_rough.jpg', false, 2),
    // Real ambientCG photographed modern Swiss office glass/stone facade PBR set (exact 3.0m floor scale)
    modernFacadeColor: loadTex('/textures/pbr/Facade015_1K-JPG_Color.jpg', true, 0.22),
    modernFacadeNor: loadTex('/textures/pbr/Facade015_1K-JPG_NormalGL.jpg', false, 0.22),
    modernFacadeRough: loadTex('/textures/pbr/Facade015_1K-JPG_Roughness.jpg', false, 0.22),
    modernFacadeMetal: loadTex('/textures/pbr/Facade015_1K-JPG_Metalness.jpg', false, 0.22),
    modernFacadeEmissive: loadTex('/textures/pbr/Facade015_1K-JPG_Emission.jpg', true, 0.22),
  };
}

// Fast Sobel normal map generator from a crisp architectural height canvas (gives true 3D sunlit stone ledges & window recesses!)
function buildNormalFromHeightCanvas(hCan, strength = 2.4) {
  const w = hCan.width;
  const h = hCan.height;
  const src = hCan.getContext('2d').getImageData(0, 0, w, h).data;
  const outCan = makeCanvas(w, h);
  const octx = outCan.getContext('2d');
  const out = octx.createImageData(w, h);
  const od = out.data;

  const sample = (x, y) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255.0;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const u = sample(x, y - 1);
      const d = sample(x, y + 1);
      let nx = (l - r) * strength;
      let ny = (d - u) * strength; // OpenGL Y+ normal convention
      let nz = 1.0;
      const inv = 1.0 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const i = (y * w + x) * 4;
      od[i] = Math.round((nx * 0.5 + 0.5) * 255);
      od[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      od[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      od[i + 3] = 255;
    }
  }
  octx.putImageData(out, 0, 0);
  const tex = new THREE.CanvasTexture(outCan);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  return tex;
}

// =================================================================================================
// 2K AAA PBR GENEVA ARCHITECTURAL FACADE SYSTEM (2-Tier: Separate Ground Shopfronts + Upper Stories!)
// Zero stretched street photos, zero zebra-stripe mid-wall repeats, razor-sharp up close AND across the lake!
// =================================================================================================
export function createGenevaArchitecturalMaterials(photoBundle) {
  function seededRand(seed) {
    let s = seed * 9301 + 49297;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  // Helper: draw realistic tiled Poly Haven stone/plaster substrate onto a canvas
  function paintRealStoneBase(ctx, w, h, img, baseHex, overlayAlpha = 0.62, tileSz = 512) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, w, h);
    if (img) {
      ctx.save();
      ctx.globalAlpha = overlayAlpha;
      for (let y = 0; y < h; y += tileSz) {
        for (let x = 0; x < w; x += tileSz) {
          ctx.drawImage(img, x, y, tileSz, tileSz);
        }
      }
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = baseHex;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  // Build a crisp 1024x1024 SEAMLESS 4-Story x 4-Bay Upper Facade PBR Material (exact 12.8m x 12.8m metric tile!)
  function buildUpperFacade({
    baseHex,
    trimHex,
    shutterHex,
    hasShutters = true,
    hasBalconies = true,
    hasAshlarJoints = true,
    stoneImg,
    seed = 1,
  }) {
    const W = 1024;
    const H = 1024;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const hc = makeCanvas(W, H);
    const hctx = hc.getContext('2d');
    const rc = makeCanvas(W, H);
    const rctx = rc.getContext('2d');
    const ec = makeCanvas(W, H);
    const ectx = ec.getContext('2d');

    const rand = seededRand(seed);

    // 1. Real Poly Haven limestone/plaster base
    paintRealStoneBase(ctx, W, H, stoneImg, baseHex, 0.58, 512);
    hctx.fillStyle = '#a8a8a8';
    hctx.fillRect(0, 0, W, H);
    rctx.fillStyle = '#dcdcdc'; // matte stone/plaster ~0.86 roughness
    rctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, W, H);

    // Subtle organic plaster/stone weathering variation per story
    for (let i = 0; i < 160; i++) {
      const gx = rand() * W;
      const gy = rand() * H;
      const gw = 40 + rand() * 140;
      const gh = 20 + rand() * 80;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,252,245,0.035)' : 'rgba(30,26,22,0.04)';
      ctx.fillRect(gx, gy, gw, gh);
    }

    // Dressed stone horizontal ashlar mortar joints
    if (hasAshlarJoints) {
      ctx.fillStyle = 'rgba(42, 38, 32, 0.14)';
      hctx.fillStyle = '#848484';
      for (let y = 0; y < H; y += 32) {
        ctx.fillRect(0, y, W, 2);
        hctx.fillRect(0, y, W, 2);
        // Staggered vertical stone joints
        const off = ((y / 32) % 2) * 64;
        for (let x = off; x < W; x += 128) {
          ctx.fillRect(x, y, 2, 32);
          hctx.fillRect(x, y, 2, 32);
        }
      }
    }

    const floors = 4;
    const bays = 4;
    const floorH = H / floors; // 256px per story (exact 3.2m!)
    const bayW = W / bays;     // 256px per bay (exact 3.0m!)

    for (let f = 0; f < floors; f++) {
      const fy = f * floorH;

      // Carved stone horizontal stringcourse / cornice band between every floor!
      ctx.fillStyle = trimHex;
      ctx.fillRect(0, fy, W, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(0, fy, W, 3);
      ctx.fillStyle = 'rgba(20,18,15,0.34)';
      ctx.fillRect(0, fy + 15, W, 6);
      hctx.fillStyle = '#e8e8e8';
      hctx.fillRect(0, fy, W, 15);
      hctx.fillStyle = '#606060';
      hctx.fillRect(0, fy + 15, W, 5);

      for (let b = 0; b < bays; b++) {
        const bx = b * bayW;
        const winW = 104;
        const winH = 164;
        const wx = bx + (bayW - winW) * 0.5;
        const wy = fy + 44;

        // Carved projecting stone window surround & header lintel
        ctx.fillStyle = trimHex;
        ctx.fillRect(wx - 10, wy - 14, winW + 20, winH + 24);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(wx - 12, wy - 18, winW + 24, 9);
        ctx.fillStyle = 'rgba(18,16,14,0.36)';
        ctx.fillRect(wx - 10, wy - 9, winW + 20, 6);
        hctx.fillStyle = '#d4d4d4';
        hctx.fillRect(wx - 10, wy - 14, winW + 20, winH + 24);
        hctx.fillStyle = '#f4f4f4';
        hctx.fillRect(wx - 13, wy - 18, winW + 26, 10);

        // Deep recessed window box shadow + realistic reflective architectural glass + interior room depth!
        ctx.fillStyle = '#060a0f';
        ctx.fillRect(wx, wy, winW, winH);
        hctx.fillStyle = '#0c0c0c'; // deep inset architectural cavity in normal map!
        hctx.fillRect(wx, wy, winW, winH);

        // Realistic dark interior gradient + sky reflection + subtle room curtains/blinds (matches ref_01 & ref_03!)
        const lit = rand() > 0.52;
        const curtainType = rand();
        const g = ctx.createLinearGradient(wx, wy, wx, wy + winH);
        g.addColorStop(0.0, '#0a1420');
        g.addColorStop(0.28, '#17293c');
        g.addColorStop(0.68, '#0c1520');
        g.addColorStop(1.0, '#060b11');
        ctx.fillStyle = g;
        ctx.fillRect(wx + 5, wy + 5, winW - 10, winH - 10);

        // Cast shadow from overhanging stone lintel onto upper pane
        const lintelSh = ctx.createLinearGradient(wx, wy + 5, wx, wy + 34);
        lintelSh.addColorStop(0.0, 'rgba(0,0,0,0.68)');
        lintelSh.addColorStop(1.0, 'rgba(0,0,0,0.0)');
        ctx.fillStyle = lintelSh;
        ctx.fillRect(wx + 5, wy + 5, winW - 10, 29);

        // Subtle interior ceiling/curtain depth inside the room
        if (curtainType > 0.45) {
          ctx.fillStyle = 'rgba(218, 212, 198, 0.22)';
          ctx.fillRect(wx + 7, wy + 10, 20, winH - 18);
          ctx.fillRect(wx + winW - 27, wy + 10, 20, winH - 18);
        } else if (curtainType > 0.2) {
          // Half-lowered Swiss venetian blind with fine horizontal slats
          ctx.fillStyle = 'rgba(182, 184, 186, 0.30)';
          ctx.fillRect(wx + 6, wy + 6, winW - 12, winH * 0.34);
          ctx.fillStyle = 'rgba(20, 24, 30, 0.28)';
          for (let bs = wy + 10; bs < wy + winH * 0.38; bs += 6) ctx.fillRect(wx + 6, bs, winW - 12, 2);
        }

        // Crisp diagonal Alpine blue sky & sunlit cloud reflection sheen across glass
        ctx.save();
        ctx.beginPath();
        ctx.rect(wx + 5, wy + 5, winW - 10, winH - 10);
        ctx.clip();
        ctx.fillStyle = 'rgba(165, 206, 244, 0.22)';
        ctx.beginPath();
        ctx.moveTo(wx, wy + winH * 0.62);
        ctx.lineTo(wx + winW, wy + winH * 0.08);
        ctx.lineTo(wx + winW, wy + winH * 0.34);
        ctx.lineTo(wx, wy + winH * 0.86);
        ctx.fill();
        ctx.restore();

        // Mirror-glossy glass roughness (reflects real PMREM 2K HDRI clouds & Alps crisply!)
        rctx.fillStyle = '#0c0c0c';
        rctx.fillRect(wx + 5, wy + 5, winW - 10, winH - 10);

        // Warm European apartment glow at night (~48% rooms lit with warm/cool variation)
        if (lit) {
          const eg = ectx.createLinearGradient(wx, wy, wx, wy + winH);
          const warm = rand() > 0.25;
          eg.addColorStop(0, warm ? '#ffe0a3' : '#d6eaff');
          eg.addColorStop(1, warm ? '#c98838' : '#7ea8cc');
          ectx.fillStyle = eg;
          ectx.fillRect(wx + 8, wy + 8, winW - 16, winH - 16);
        }

        // Crisp painted French wooden casement frame & mullions
        ctx.fillStyle = '#e8e4da';
        ctx.fillRect(wx + 2, wy + 2, winW - 4, 6);
        ctx.fillRect(wx + 2, wy + winH - 8, winW - 4, 6);
        ctx.fillRect(wx + 2, wy + 2, 6, winH - 4);
        ctx.fillRect(wx + winW - 8, wy + 2, 6, winH - 4);
        ctx.fillRect(wx + winW * 0.5 - 3, wy + 4, 6, winH - 8);
        ctx.fillRect(wx + 4, wy + winH * 0.35, winW - 8, 5);
        ctx.fillRect(wx + 4, wy + winH * 0.68, winW - 8, 4);
        hctx.fillStyle = '#707070';
        hctx.fillRect(wx + winW * 0.5 - 3, wy + 4, 6, winH - 8);
        hctx.fillRect(wx + 4, wy + winH * 0.35, winW - 8, 5);
        rctx.fillStyle = '#a8a8a8';
        rctx.fillRect(wx + winW * 0.5 - 3, wy + 4, 6, winH - 8);
        rctx.fillRect(wx + 4, wy + winH * 0.35, winW - 8, 5);

        // Authentic Genevan Louvered Shutters flanking the window!
        if (hasShutters) {
          const shW = 46;
          for (const side of [-1, 1]) {
            const sx = side < 0 ? wx - shW - 6 : wx + winW + 6;
            // Drop shadow onto limestone wall
            ctx.fillStyle = 'rgba(16, 14, 12, 0.32)';
            ctx.fillRect(sx + (side < 0 ? -4 : 4), wy + 4, shW, winH);
            // Shutter frame
            ctx.fillStyle = shutterHex;
            ctx.fillRect(sx, wy, shW, winH);
            ctx.strokeStyle = 'rgba(20, 20, 20, 0.28)';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 1, wy + 1, shW - 2, winH - 2);
            // Crisp horizontal louvered slats
            ctx.fillStyle = 'rgba(22, 22, 22, 0.24)';
            hctx.fillStyle = '#d8d8d8';
            hctx.fillRect(sx, wy, shW, winH);
            for (let sy = wy + 10; sy < wy + winH - 10; sy += 8) {
              ctx.fillRect(sx + 6, sy, shW - 12, 3);
              hctx.fillStyle = '#a0a0a0';
              hctx.fillRect(sx + 6, sy, shW - 12, 3);
            }
          }
        }

        // Carved projecting stone sill + wrought-iron Geneva Juliet balcony railing!
        ctx.fillStyle = trimHex;
        ctx.fillRect(wx - 14, wy + winH + 4, winW + 28, 12);
        ctx.fillStyle = 'rgba(18, 15, 12, 0.38)';
        ctx.fillRect(wx - 14, wy + winH + 16, winW + 28, 7);
        hctx.fillStyle = '#ffffff';
        hctx.fillRect(wx - 14, wy + winH + 4, winW + 28, 12);

        if (hasBalconies && (f === 1 || f === 3 || !hasShutters)) {
          const balY = wy + winH - 42;
          const balH = 46;
          ctx.fillStyle = '#1c2026';
          ctx.fillRect(wx - 6, balY, winW + 12, 4);
          ctx.fillRect(wx - 6, balY + balH - 4, winW + 12, 4);
          for (let rx = wx - 4; rx <= wx + winW + 4; rx += 11) {
            ctx.fillRect(rx, balY, 3, balH);
          }
          rctx.fillStyle = '#484848';
          rctx.fillRect(wx - 6, balY, winW + 12, 4);
        }
      }
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 16;

    const normalMap = buildNormalFromHeightCanvas(hc, 2.2);
    const roughnessMap = new THREE.CanvasTexture(rc);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = 16;

    const emissiveMap = new THREE.CanvasTexture(ec);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

    const mat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(1.42, 1.42),
      roughnessMap,
      emissive: new THREE.Color(0xffcf82),
      emissiveMap,
      emissiveIntensity: 0.0,
      roughness: 0.90,
      metalness: 0.24,
      envMapIntensity: 1.85,
      vertexColors: true,
    });
    injectWindowParallax(mat);
    return mat;
  }

  // AAA GTA 6 / Spider-Man GLSL 3D Window Interior Parallax + Fresnel Sky Glass Reflection!
  function injectWindowParallax(mat) {
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        `varying vec3 vBldWorldPos;\nvarying vec3 vBldWorldNorm;\n` +
        shader.vertexShader.replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
          vBldWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vBldWorldNorm = normalize(mat3(modelMatrix) * objectNormal);`
        );
      shader.fragmentShader =
        `varying vec3 vBldWorldPos;\nvarying vec3 vBldWorldNorm;\n` +
        shader.fragmentShader.replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          // Detect glossy architectural window panes (roughness < 0.24) and add 3D interior room parallax + crisp Fresnel sky mirror!
          float glassMask = 1.0 - smoothstep(0.10, 0.24, roughnessFactor);
          if (glassMask > 0.02) {
            vec3 V = normalize(cameraPosition - vBldWorldPos);
            vec3 N = normalize(vBldWorldNorm);
            vec3 T = normalize(cross(vec3(0.0, 1.0, 0.0), N) + vec3(0.0001));
            vec3 B = cross(N, T);
            vec2 viewTan = vec2(dot(V, T), dot(V, B)) / max(0.32, abs(dot(V, N)));
            vec2 roomCell = fract(vMapUv * 4.0 - viewTan * 0.24);
            float backWall = smoothstep(0.16, 0.84, roomCell.y) * (0.65 + 0.35 * sin(roomCell.x * 3.14159));
            vec3 roomCol = mix(vec3(0.025, 0.04, 0.065), vec3(0.16, 0.14, 0.115), backWall);
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.8);
            vec3 skyRefl = mix(vec3(0.18, 0.36, 0.58), vec3(0.74, 0.86, 0.98), clamp(fresnel * 1.55, 0.0, 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(roomCol, skyRefl, 0.34 + fresnel * 0.58), glassMask * 0.72);
            roughnessFactor = mix(roughnessFactor, 0.05, glassMask);
          }`
        );
    };
  }

  // Build crisp dedicated GROUND-FLOOR Boutique / Stone Arcade PBR Material (mapped strictly v: 0..1 at street level!)
  function buildGroundMaterial(kind) {
    const W = 1024;
    const H = 512;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const hc = makeCanvas(W, H);
    const hctx = hc.getContext('2d');
    const rc = makeCanvas(W, H);
    const rctx = rc.getContext('2d');
    const ec = makeCanvas(W, H);
    const ectx = ec.getContext('2d');

    hctx.fillStyle = '#b4b4b4';
    hctx.fillRect(0, 0, W, H);
    rctx.fillStyle = '#d4d4d4';
    rctx.fillRect(0, 0, W, H);
    ectx.fillStyle = '#000000';
    ectx.fillRect(0, 0, W, H);

    if (kind === 'luxury') {
      // Rue du Rhone polished dark charcoal granite + champagne bronze Swiss watchmaker boutique
      paintRealStoneBase(ctx, W, H, photoBundle?.stoneImg, '#2c313a', 0.35, 512);
      ctx.fillStyle = '#c4a668';
      ctx.fillRect(0, 22, W, 8);
      hctx.fillStyle = '#e8e8e8';
      hctx.fillRect(0, 0, W, 24);
      // Authentic Geneva gold-on-anthracite haute horlogerie fascia signboards
      const signs = ['GENÈVE · HORLOGERIE', 'MAISON DU LAC', 'RUE DU RHÔNE'];
      ctx.font = 'bold 20px Georgia, serif';
      ctx.textAlign = 'center';

      for (let i = 0; i < 3; i++) {
        const bx = 34 + i * 332;
        const bw = 286;
        const by = 82;
        const bh = 394;
        // Fascia nameplate above each showcase
        ctx.fillStyle = '#181c22';
        ctx.fillRect(bx + 18, 36, bw - 36, 34);
        ctx.strokeStyle = '#c4a668';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx + 20, 38, bw - 40, 30);
        ctx.fillStyle = '#e8cf96';
        ctx.fillText(signs[i], bx + bw * 0.5, 59);
        // Deep recessed polished bronze portal frame + shadow
        ctx.fillStyle = '#9a8255';
        ctx.fillRect(bx - 10, by - 10, bw + 20, bh + 20);
        // Deep dark reflective showcase window
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, '#283d52');
        g.addColorStop(0.48, '#101924');
        g.addColorStop(1, '#1c242e');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);
        // Warm illuminated Swiss watch display vitrines inside glass
        ctx.fillStyle = 'rgba(242, 218, 174, 0.22)';
        ctx.fillRect(bx + 24, by + bh - 132, bw - 48, 96);
        ctx.fillStyle = 'rgba(255, 236, 192, 0.28)';
        ctx.fillRect(bx + 54, by + 34, 48, 16);
        ctx.fillRect(bx + bw - 102, by + 34, 48, 16);
        // Crisp glass reflection & mullions
        ctx.fillStyle = '#665b46';
        ctx.fillRect(bx + bw * 0.5 - 3, by, 6, bh);
        ctx.fillRect(bx, by + 72, bw, 5);

        hctx.fillStyle = '#181818';
        hctx.fillRect(bx, by, bw, bh);
        rctx.fillStyle = '#0c0c0c';
        rctx.fillRect(bx, by, bw, bh);
        ectx.fillStyle = '#ffdfa6';
        ectx.fillRect(bx + 12, by + 16, bw - 24, bh - 28);
      }
    } else if (kind === 'pavilion') {
      // Dedicated Single-Story Jardin Anglais / Lakeside Sandstone & Conservatory Glass Pavilion!
      paintRealStoneBase(ctx, W, H, photoBundle?.stoneImg, '#d9d1c2', 0.55, 512);
      // Top stone entablature cornice
      ctx.fillStyle = '#e4ddd0';
      ctx.fillRect(0, 0, W, 58);
      ctx.fillStyle = 'rgba(25,22,18,0.35)';
      ctx.fillRect(0, 58, W, 10);
      // Lower dressed granite plinth (bottom 110px only!)
      ctx.save();
      ctx.translate(0, H - 110);
      paintRealStoneBase(ctx, W, 110, photoBundle?.ashlarImg, '#9d9586', 0.5, 256);
      ctx.restore();
      ctx.fillStyle = '#d6cebe';
      ctx.fillRect(0, H - 114, W, 12);

      // 4 graceful slender dark-bronze panoramic pavilion windows
      for (let i = 0; i < 4; i++) {
        const bx = 34 + i * 248;
        const bw = 204;
        const by = 88;
        const bh = 304;
        ctx.fillStyle = '#262b30';
        ctx.fillRect(bx - 6, by - 6, bw + 12, bh + 12);
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, '#2a4258');
        g.addColorStop(0.55, '#172634');
        g.addColorStop(1, '#111922');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);
        // Fine French conservatory mullions
        ctx.fillStyle = '#3c434a';
        ctx.fillRect(bx + bw * 0.5 - 3, by, 6, bh);
        ctx.fillRect(bx, by + bh * 0.35, bw, 5);
        ctx.fillRect(bx, by + bh * 0.7, bw, 4);

        hctx.fillStyle = '#242424';
        hctx.fillRect(bx, by, bw, bh);
        rctx.fillStyle = '#141414';
        rctx.fillRect(bx, by, bw, bh);
        // Realistic cozy Geneva lakeside café night glow (soft warm pendant ceiling glow, dark lower counter silhouette & crisp mullions!)
        const pEg = ectx.createLinearGradient(bx, by, bx, by + bh);
        pEg.addColorStop(0.0, '#c69352');
        pEg.addColorStop(0.45, '#8a5d2e');
        pEg.addColorStop(0.76, '#3c2614');
        pEg.addColorStop(1.0, '#18100a');
        ectx.fillStyle = pEg;
        ectx.fillRect(bx + 10, by + 12, bw - 20, bh - 24);
        // Warm overhead bistro pendant lamp pool inside each conservatory bay
        const lampGlow = ectx.createRadialGradient(bx + bw * 0.5, by + 58, 6, bx + bw * 0.5, by + 68, 72);
        lampGlow.addColorStop(0.0, 'rgba(255, 224, 165, 0.72)');
        lampGlow.addColorStop(1.0, 'rgba(255, 195, 110, 0.0)');
        ectx.fillStyle = lampGlow;
        ectx.fillRect(bx + 10, by + 12, bw - 20, bh * 0.55);
        // Keep French mullions dark in the emissive mask so panes read crisply at night!
        ectx.fillStyle = '#000000';
        ectx.fillRect(bx + bw * 0.5 - 4, by, 8, bh);
        ectx.fillRect(bx, by + bh * 0.35 - 2, bw, 7);
        ectx.fillRect(bx, by + bh * 0.7 - 2, bw, 6);
      }
    } else {
      // Classic Geneva Dressed Rusticated Limestone Arcade with Arched/Recessed Shopfronts
      paintRealStoneBase(ctx, W, H, photoBundle?.stoneImg, '#cfc6b5', 0.55, 512);
      // Rusticated horizontal limestone bands
      ctx.fillStyle = 'rgba(35, 30, 24, 0.24)';
      hctx.fillStyle = '#707070';
      for (let y = 38; y < H; y += 44) {
        ctx.fillRect(0, y, W, 3);
        hctx.fillRect(0, y, W, 3);
      }
      // Heavy moulded stone cornice separating ground floor from 1st floor
      ctx.fillStyle = '#dfd8ca';
      ctx.fillRect(0, 0, W, 36);
      ctx.fillStyle = 'rgba(20,18,14,0.38)';
      ctx.fillRect(0, 36, W, 10);
      hctx.fillStyle = '#f2f2f2';
      hctx.fillRect(0, 0, W, 36);

      for (let i = 0; i < 3; i++) {
        const bx = 38 + i * 332;
        const bw = 278;
        const by = 82;
        const bh = 420;
        // Carved timber & bronze European shopfront surround
        ctx.fillStyle = kind === 'cafe' ? '#4a3525' : '#2a3038';
        ctx.fillRect(bx - 12, by - 12, bw + 24, bh + 12);
        const g = ctx.createLinearGradient(bx, by, bx, by + bh);
        g.addColorStop(0, '#1e3042');
        g.addColorStop(0.55, '#121b24');
        g.addColorStop(1, '#1b1d20');
        ctx.fillStyle = g;
        ctx.fillRect(bx, by, bw, bh);
        // Subtle transom window bar & doorway division
        ctx.fillStyle = kind === 'cafe' ? '#634832' : '#4a525e';
        ctx.fillRect(bx, by + 76, bw, 8);
        ctx.fillRect(bx + bw * 0.65, by, 8, bh);

        hctx.fillStyle = '#202020';
        hctx.fillRect(bx, by, bw, bh);
        rctx.fillStyle = '#161616';
        rctx.fillRect(bx, by, bw, bh);
        ectx.fillStyle = kind === 'cafe' ? '#ffcf86' : '#ffe3b3';
        ectx.fillRect(bx + 12, by + 16, bw - 24, bh - 24);
      }
    }

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 16;

    const normalMap = buildNormalFromHeightCanvas(hc, 2.2);
    const roughnessMap = new THREE.CanvasTexture(rc);
    roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;

    const emissiveMap = new THREE.CanvasTexture(ec);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;

    const gMat = new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughnessMap,
      emissive: new THREE.Color(0xffcc78),
      emissiveMap,
      emissiveIntensity: 0.0,
      roughness: 0.88,
      metalness: 0.28,
      envMapIntensity: 1.55,
      vertexColors: true,
    });
    injectWindowParallax(gMat);
    return gMat;
  }

  // 5 Distinct Upper-Story Architectural Styles (seamless 1:1 metric 4-floor x 4-bay PBR!)
  const upperMats = [
    // 0: Grand Geneva Molasse Cream-Golden Sandstone (Quai du Général-Guisan, Hôtel Métropole & Lakefront Palaces!)
    buildUpperFacade({
      baseHex: '#e0d3b8',
      trimHex: '#ede3cf',
      shutterHex: '#dcd6c8',
      hasShutters: false,
      hasBalconies: true,
      hasAshlarJoints: true,
      stoneImg: photoBundle?.stoneImg,
      seed: 11,
    }),
    // 1: Vieille-Ville & Rues-Basses Classic Warm Molasse Sandstone with Light Louvered Shutters
    buildUpperFacade({
      baseHex: '#d5c3a4',
      trimHex: '#e6dcc8',
      shutterHex: '#e6e2d8',
      hasShutters: true,
      hasBalconies: true,
      hasAshlarJoints: true,
      stoneImg: photoBundle?.stoneImg,
      seed: 22,
    }),
    // 2: Warm Champagne-Grey Genevan Limestone Ashlar with Sage-Grey Shutters & Wrought-Ironwork
    buildUpperFacade({
      baseHex: '#cfc9bc',
      trimHex: '#e2ddd2',
      shutterHex: '#7d8a84',
      hasShutters: true,
      hasBalconies: true,
      hasAshlarJoints: true,
      stoneImg: photoBundle?.stoneImg,
      seed: 33,
    }),
    // 3: Warm Ochre-Terracotta Old-Town Swiss Plaster with Dark Timber Shutters
    buildUpperFacade({
      baseHex: '#cfa984',
      trimHex: '#e4d8c4',
      shutterHex: '#4f463e',
      hasShutters: true,
      hasBalconies: true,
      hasAshlarJoints: false,
      stoneImg: photoBundle?.stoneImg,
      seed: 44,
    }),
    // 4: Modern Swiss Private Bank Glass & Stone Tower (REAL ambientCG Facade015 PBR!)
    new THREE.MeshStandardMaterial({
      map: photoBundle?.modernFacadeColor || null,
      normalMap: photoBundle?.modernFacadeNor || null,
      normalScale: new THREE.Vector2(0.75, 0.75),
      roughnessMap: photoBundle?.modernFacadeRough || null,
      metalnessMap: photoBundle?.modernFacadeMetal || null,
      emissive: new THREE.Color(0xffdfa8),
      emissiveMap: photoBundle?.modernFacadeEmissive || null,
      emissiveIntensity: 0.0,
      color: new THREE.Color(0xd2dae4),
      roughness: 0.52,
      metalness: 0.58,
      vertexColors: true,
    }),
  ];

  // Dedicated Ground-Floor Shopfront & Park Pavilion Materials (never repeated on upper stories!)
  const groundMats = [
    buildGroundMaterial('arcade'),
    buildGroundMaterial('luxury'),
    buildGroundMaterial('cafe'),
    buildGroundMaterial('pavilion'), // index 3: single-story park kiosks & Jardin Anglais pavilions!
  ];

  return { upperMats, groundMats };
}

// PURE Photorealistic Seamless Fine-Grain Swiss Asphalt PBR Triad (Zero horizontal seams, fine mineral sparkle & tire-track specular!)
export function createPureAsphaltTextures(photoBundle) {
  const w = 1024;
  const h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const hc = makeCanvas(w, h);
  const hctx = hc.getContext('2d');
  const rc = makeCanvas(w, h);
  const rctx = rc.getContext('2d');

  // 1. Seamless high-frequency fine-grain Swiss tarmac substrate (no coarse gravel stretch or horizontal seam!)
  const colImg = ctx.createImageData(w, h);
  const hgtImg = hctx.createImageData(w, h);
  const rghImg = rctx.createImageData(w, h);
  const cd = colImg.data;
  const hd = hgtImg.data;
  const rd = rghImg.data;

  // Fast deterministic tileable hash for realistic 1-2cm mineral aggregate + subtle asphalt macro mottling
  const hash = (ix, iy) => {
    const n = Math.sin(((ix & 1023) * 127.1 + (iy & 1023) * 311.7)) * 43758.5453;
    return n - Math.floor(n);
  };

  for (let y = 0; y < h; y++) {
    const macroY = Math.sin((y / h) * Math.PI * 4) * 0.5 + 0.5;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const g1 = hash(x, y);
      const g2 = hash(x >> 1, y >> 1);
      const g3 = hash(x >> 3, y >> 3);
      // Periodic macro bituminous density variation (zero edge seams!)
      const mottle =
        Math.sin((x / w) * Math.PI * 6 + macroY * 2.1) *
        Math.cos((y / h) * Math.PI * 4 - (x / w) * Math.PI * 2) * 0.5 + 0.5;

      // Authentic Geneva Quai du Général-Guisan charcoal-slate tarmac (#343940 base + fine mineral aggregate flecks)
      const grain = (g1 * 0.45 + g2 * 0.35 + g3 * 0.20) - 0.5;
      const sparkle = g1 > 0.965 ? 18 : 0; // tiny quartz/granite mineral aggregate glints
      const base = 60 + mottle * 11 + grain * 26 + sparkle;
      cd[idx] = Math.max(24, Math.min(130, base * 0.97));
      cd[idx + 1] = Math.max(26, Math.min(134, base * 1.00));
      cd[idx + 2] = Math.max(30, Math.min(142, base * 1.05));
      cd[idx + 3] = 255;

      // Subtle micro-grain height for crisp specular sheen (not lumpy pebbles!)
      const hv = Math.max(0, Math.min(255, Math.round(128 + grain * 86 + (sparkle > 0 ? 22 : 0))));
      hd[idx] = hd[idx + 1] = hd[idx + 2] = hv;
      hd[idx + 3] = 255;

      // Base asphalt roughness (~0.76 = 194, polished lower in wheel tracks below)
      const rv = Math.max(135, Math.min(238, Math.round(196 - grain * 32 - (sparkle > 0 ? 48 : 0))));
      rd[idx] = rd[idx + 1] = rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }
  ctx.putImageData(colImg, 0, 0);
  hctx.putImageData(hgtImg, 0, 0);
  rctx.putImageData(rghImg, 0, 0);

  // Dual wheel-path rubber tire wear + glossy specular bitumen polishing in roughnessMap!
  const tracks = [0.18, 0.34, 0.66, 0.82];
  for (const tx of tracks) {
    const cx = w * tx;
    const trW = w * 0.085;
    const gCol = ctx.createLinearGradient(cx - trW, 0, cx + trW, 0);
    gCol.addColorStop(0.0, 'rgba(10,12,16,0.0)');
    gCol.addColorStop(0.5, 'rgba(10,12,16,0.28)');
    gCol.addColorStop(1.0, 'rgba(10,12,16,0.0)');
    ctx.fillStyle = gCol;
    ctx.fillRect(cx - trW, 0, trW * 2, h);

    // Polished smoother tire-track specular sheen (roughness ~0.44 inside worn wheel paths!)
    const gRgh = rctx.createLinearGradient(cx - trW, 0, cx + trW, 0);
    gRgh.addColorStop(0.0, 'rgba(105,105,105,0.0)');
    gRgh.addColorStop(0.5, 'rgba(105,105,105,0.68)');
    gRgh.addColorStop(1.0, 'rgba(105,105,105,0.0)');
    rctx.fillStyle = gRgh;
    rctx.fillRect(cx - trW, 0, trW * 2, h);
  }

  // Subtle periodic bituminous tar-sealed longitudinal micro-cracks (wrap seamlessly!)
  ctx.strokeStyle = 'rgba(14, 16, 20, 0.42)';
  rctx.strokeStyle = 'rgba(60, 60, 60, 0.75)'; // tar seal glints softly in low sun!
  hctx.strokeStyle = 'rgba(72, 72, 72, 0.65)';
  ctx.lineWidth = 3;
  rctx.lineWidth = 4;
  hctx.lineWidth = 3;
  const crackPaths = [
    [[w * 0.25, 110], [w * 0.27, 250], [w * 0.24, 410], [w * 0.26, 520]],
    [[w * 0.72, 540], [w * 0.75, 690], [w * 0.71, 845], [w * 0.73, 940]],
  ];
  for (const pts of crackPaths) {
    for (const targetCtx of [ctx, rctx, hctx]) {
      targetCtx.beginPath();
      targetCtx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) targetCtx.lineTo(pts[i][0], pts[i][1]);
      targetCtx.stroke();
    }
  }

  // Crisp subtle gutter shadow strictly hugging left/right curb joints
  const gL = ctx.createLinearGradient(0, 0, 44, 0);
  gL.addColorStop(0, 'rgba(0,0,0,0.42)');
  gL.addColorStop(0.45, 'rgba(0,0,0,0.14)');
  gL.addColorStop(1, 'rgba(0,0,0,0.0)');
  ctx.fillStyle = gL;
  ctx.fillRect(0, 0, 44, h);

  const gR = ctx.createLinearGradient(w - 44, 0, w, 0);
  gR.addColorStop(0, 'rgba(0,0,0,0.0)');
  gR.addColorStop(0.55, 'rgba(0,0,0,0.14)');
  gR.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = gR;
  ctx.fillRect(w - 44, 0, 44, h);

  // Authentic Swiss thermoplastic road markings (realistic narrower 12cm edge lines & weathered dashed center!)
  ctx.fillStyle = 'rgba(218, 222, 226, 0.72)';
  ctx.fillRect(34, 0, 10, h);
  ctx.fillRect(w - 44, 0, 10, h);
  rctx.fillStyle = 'rgba(175, 175, 175, 0.65)';
  rctx.fillRect(34, 0, 10, h);
  rctx.fillRect(w - 44, 0, 10, h);

  ctx.fillStyle = 'rgba(226, 229, 232, 0.80)';
  for (let y = 32; y < h; y += 256) {
    ctx.fillRect(w * 0.5 - 6, y, 12, 118);
    // Slight weathered tire scuffs across paint stripes
    ctx.fillStyle = 'rgba(54, 58, 66, 0.22)';
    ctx.fillRect(w * 0.5 - 6, y + 36, 12, 12);
    ctx.fillStyle = 'rgba(226, 229, 232, 0.80)';
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;

  const normalMap = buildNormalFromHeightCanvas(hc, 1.35);
  const roughnessMap = new THREE.CanvasTexture(rc);
  roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = 16;

  return { map, normalMap, roughnessMap };
}

// 1024x1024 FINE-GRAINED REAL PHOTOGRAPHED Tree Leaf Cluster (240 realistic ~16cm leaves from LeafSet009!)
export function createPhotoLeafClusterTexture(photoBundle) {
  const w = 1024;
  const h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const leafSprites = [];
  if (photoBundle?.leafColorImg && photoBundle?.leafOpacityImg) {
    const srcW = photoBundle.leafColorImg.naturalWidth || 1024;
    const srcH = photoBundle.leafColorImg.naturalHeight || 1024;
    const tmp = makeCanvas(srcW, srcH);
    const tctx = tmp.getContext('2d');
    tctx.drawImage(photoBundle.leafColorImg, 0, 0, srcW, srcH);
    const colData = tctx.getImageData(0, 0, srcW, srcH);

    const opCan = makeCanvas(srcW, srcH);
    const octx = opCan.getContext('2d');
    octx.drawImage(photoBundle.leafOpacityImg, 0, 0, srcW, srcH);
    const opData = octx.getImageData(0, 0, srcW, srcH).data;

    for (let i = 0; i < colData.data.length; i += 4) {
      colData.data[i] = Math.min(255, Math.floor(colData.data[i] * 0.86));
      colData.data[i + 1] = Math.min(255, Math.floor(colData.data[i + 1] * 0.94));
      colData.data[i + 2] = Math.min(255, Math.floor(colData.data[i + 2] * 0.82));
      colData.data[i + 3] = opData[i];
    }
    tctx.putImageData(colData, 0, 0);

    const cw = Math.floor(srcW / 3);
    const ch = Math.floor(srcH / 2);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const sp = makeCanvas(cw, ch);
        sp.getContext('2d').drawImage(tmp, col * cw, row * ch, cw, ch, 0, 0, cw, ch);
        leafSprites.push(sp);
      }
    }
  }

  let s = 2026;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // Delicate dark woody inner branches & sub-twigs
  ctx.strokeStyle = '#33271b';
  ctx.lineWidth = 6;
  const twigs = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + (rand() - 0.5) * 0.28;
    const len = 300 + rand() * 140;
    twigs.push({ a, len });
    ctx.beginPath();
    ctx.moveTo(512, 512);
    ctx.lineTo(512 + Math.cos(a) * len, 512 + Math.sin(a) * len);
    ctx.stroke();
  }

  // Stamp 320 airy layered photographed leaves (darker recessed interior -> sunlit olive-emerald outer tips!)
  for (let i = 0; i < 320; i++) {
    const tw = twigs[i % twigs.length];
    const along = 0.14 + Math.pow(rand(), 0.72) * 0.90;
    const lateral = (rand() - 0.5) * 124;
    const lx = 512 + Math.cos(tw.a) * (tw.len * along) - Math.sin(tw.a) * lateral;
    const ly = 512 + Math.sin(tw.a) * (tw.len * along) + Math.cos(tw.a) * lateral;
    const rot = tw.a + Math.PI * 0.5 + (rand() - 0.5) * 1.8;
    const sz = 40 + rand() * 34; // finer crisp individual leaves for authentic dappled sunlight & shadows!

    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    // Depth-layered foliage brightness: inner shaded core (0.68) vs outer sunlit crown leaves (1.0)
    ctx.globalAlpha = i < 110 ? 0.88 : 0.96;
    if (leafSprites.length > 0) {
      const sp = leafSprites[Math.floor(rand() * leafSprites.length)];
      ctx.drawImage(sp, -sz * 0.5, -sz * 0.5, sz, sz);
    } else {
      ctx.fillStyle = i < 110 ? '#314f28' : '#4f763d';
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 0.35, sz * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1.0;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Photorealistic Geneva Lakefront London Plane Tree ('Platane') Bark: blends real Poly Haven bark with soft organic mottled flaking!
export function createPlaneTreeBarkTextures(photoBundle = null) {
  const w = 512;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const hc = makeCanvas(w, h);
  const hctx = hc.getContext('2d');

  // 1. Real Poly Haven photographic tree bark base (eliminates cartoon polka-dot trunks!)
  ctx.fillStyle = '#5a554a';
  ctx.fillRect(0, 0, w, h);
  if (photoBundle?.barkImg) {
    ctx.drawImage(photoBundle.barkImg, 0, 0, w, h);
    ctx.fillStyle = 'rgba(135, 132, 118, 0.28)';
    ctx.fillRect(0, 0, w, h);
  }
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, w, h);

  let s = 4219;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  // 2. Soft low-contrast organic flaking plane-tree mottling (soft radial gradients, NEVER harsh polka-dots!)
  const patchCols = [
    'rgba(182, 176, 156, 0.22)',
    'rgba(148, 145, 126, 0.20)',
    'rgba(116, 114, 98, 0.20)',
    'rgba(84, 78, 66, 0.22)',
    'rgba(166, 160, 140, 0.18)',
  ];
  for (let i = 0; i < 85; i++) {
    const px = rand() * w;
    const py = rand() * h;
    const rx = 24 + rand() * 52;
    const ry = 42 + rand() * 88;
    const col = patchCols[Math.floor(rand() * patchCols.length)];
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        ctx.save();
        ctx.translate(px + ox, py + oy);
        ctx.scale(1, ry / rx);
        const grad = ctx.createRadialGradient(0, 0, rx * 0.15, 0, 0, rx);
        grad.addColorStop(0, col);
        grad.addColorStop(0.68, col);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // 3. Fine vertical woody bark ridges & crevices
  ctx.strokeStyle = 'rgba(26, 22, 18, 0.24)';
  hctx.strokeStyle = '#424242';
  for (let i = 0; i < 160; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const len = 35 + rand() * 95;
    ctx.lineWidth = 1.2 + rand() * 1.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 6, y + len);
    ctx.stroke();
    hctx.lineWidth = 1.8;
    hctx.beginPath();
    hctx.moveTo(x, y);
    hctx.lineTo(x + (rand() - 0.5) * 6, y + len);
    hctx.stroke();
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 3);
  map.anisotropy = 8;

  const normalMap = buildNormalFromHeightCanvas(hc, 2.0);
  normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(2, 3);
  return { map, normalMap };
}

// Authentic Geneva TPG City Bus & Stadler Tango Tram side livery texture
export function createTpgSideTexture(routeNum = '25', dest = 'JARDIN BOTANIQUE', isTram = false) {
  const w = 1024;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#f2f4f7';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#3c55a8';
  ctx.fillRect(0, h - 72, w, 72);
  ctx.fillStyle = '#2d4185';
  ctx.fillRect(0, h - 14, w, 14);

  ctx.fillStyle = '#cfd5dd';
  ctx.fillRect(0, 0, w, 18);

  const winCount = isTram ? 6 : 5;
  const winW = (w - 84) / winCount;
  for (let i = 0; i < winCount; i++) {
    const wx = 34 + i * winW;
    const isDoor = i === 1 || i === 3;
    const wy = 28;
    const wh = isDoor ? 196 : 126;

    ctx.fillStyle = '#0e141c';
    ctx.fillRect(wx - 2, wy - 2, winW - 10, wh + 4);
    const g = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    g.addColorStop(0, '#2a415a');
    g.addColorStop(0.42, '#131d28');
    g.addColorStop(1, '#0d151e');
    ctx.fillStyle = g;
    ctx.fillRect(wx + 2, wy + 2, winW - 18, wh - 4);

    if (isDoor) {
      ctx.fillStyle = '#475261';
      ctx.fillRect(wx + (winW - 14) * 0.5 - 1, wy, 3, wh);
      ctx.fillStyle = '#f7c81c';
      ctx.fillRect(wx + (winW - 14) * 0.5 - 6, wy + 124, 12, 16);
    }
  }

  ctx.fillStyle = '#f26522';
  ctx.font = 'bold 34px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('tpg', 44, 218);
  ctx.fillText('tpg', w - 120, 218);

  ctx.fillStyle = '#0f1216';
  ctx.fillRect(262, 166, 260, 30);
  ctx.fillStyle = '#ffb82e';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`${routeNum}  ${dest}`, 274, 187);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

export function createTpgFrontTexture(routeNum = '25', dest = 'RIVE', badgeColor = '#3c55a8') {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2f4f7';
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = '#3c55a8';
  ctx.fillRect(0, 186, 256, 70);

  ctx.fillStyle = '#0f1216';
  ctx.fillRect(18, 14, 220, 44);
  ctx.fillStyle = badgeColor;
  ctx.fillRect(22, 18, 48, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(routeNum, 46, 44);
  ctx.fillStyle = '#ffb82e';
  ctx.font = 'bold 17px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(dest, 78, 42);

  const wg = ctx.createLinearGradient(0, 62, 0, 166);
  wg.addColorStop(0, '#2a415a');
  wg.addColorStop(0.5, '#111c29');
  wg.addColorStop(1, '#0c141d');
  ctx.fillStyle = wg;
  ctx.fillRect(18, 62, 220, 104);

  ctx.strokeStyle = '#090c10';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(110, 164);
  ctx.lineTo(186, 102);
  ctx.stroke();

  ctx.fillStyle = '#f26522';
  ctx.font = 'bold 20px "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('tpg', 128, 182);

  ctx.fillStyle = '#fff5d6';
  ctx.beginPath();
  ctx.arc(38, 206, 11, 0, Math.PI * 2);
  ctx.arc(218, 206, 11, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createShadowBlobTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createSmokeTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(235, 238, 242, 0.72)');
  grad.addColorStop(0.45, 'rgba(215, 220, 228, 0.34)');
  grad.addColorStop(1, 'rgba(200, 208, 218, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMistTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
  grad.addColorStop(0.35, 'rgba(235, 248, 255, 0.45)');
  grad.addColorStop(0.7, 'rgba(215, 240, 255, 0.14)');
  grad.addColorStop(1, 'rgba(200, 235, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRainTexture() {
  const c = makeCanvas(32, 128);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(16, 0, 16, 128);
  grad.addColorStop(0, 'rgba(215, 238, 255, 0.0)');
  grad.addColorStop(0.3, 'rgba(215, 238, 255, 0.55)');
  grad.addColorStop(0.85, 'rgba(240, 250, 255, 0.9)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(14, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFlagTexture(kind = 'swiss') {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  if (kind === 'swiss') {
    ctx.fillStyle = '#d52b1e';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(50, 24, 28, 80);
    ctx.fillRect(24, 50, 80, 28);
  } else {
    ctx.fillStyle = '#ffd100';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#d52b1e';
    ctx.fillRect(64, 0, 64, 128);
    ctx.fillStyle = '#d52b1e';
    ctx.fillRect(22, 34, 24, 56);
    ctx.fillRect(14, 46, 38, 18);
    ctx.fillStyle = '#ffd100';
    ctx.beginPath();
    ctx.arc(96, 88, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(91, 28, 10, 54);
    ctx.fillRect(78, 32, 16, 10);
    ctx.fillRect(78, 48, 14, 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHelipadTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#232830';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#ffb82e';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(128, 128, 104, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(78, 66, 22, 124);
  ctx.fillRect(156, 66, 22, 124);
  ctx.fillRect(78, 118, 100, 20);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
