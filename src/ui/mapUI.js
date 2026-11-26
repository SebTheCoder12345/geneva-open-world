import { LANDMARKS, WORLD_BOUNDS } from '../world/cityData.js';

export function createMapUI(onSetCustomWaypoint) {
  const miniCanvas = document.getElementById('minimap');
  const mctx = miniCanvas.getContext('2d');

  const fullWrap = document.getElementById('fullmap');
  const fullCanvas = document.getElementById('fullmap-canvas');
  const fctx = fullCanvas.getContext('2d');
  const foundLabel = document.getElementById('fm-found');
  const scaleTxt = document.getElementById('fm-scale-txt');

  let topoImg = null;
  let orthoImg = null;
  let useSatellite = false;

  // Full map camera state
  let isOpen = false;
  let camX = 40;
  let camZ = 40;
  let zoom = 0.72; // pixels per meter
  let dragging = false;
  let dragMoved = false;
  let lastMx = 0;
  let lastMy = 0;

  function setMapImages(topo, ortho) {
    topoImg = topo;
    orthoImg = ortho;
  }

  function toggleLayer() {
    useSatellite = !useSatellite;
    return useSatellite;
  }

  function resizeFull() {
    fullCanvas.width = window.innerWidth;
    fullCanvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeFull);
  resizeFull();

  fullCanvas.addEventListener('mousedown', (e) => {
    if (!isOpen) return;
    if (e.button === 2) {
      onSetCustomWaypoint(null);
      return;
    }
    dragging = true;
    dragMoved = false;
    lastMx = e.clientX;
    lastMy = e.clientY;
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging || !isOpen) return;
    const dx = e.clientX - lastMx;
    const dy = e.clientY - lastMy;
    if (Math.hypot(dx, dy) > 4) dragMoved = true;
    camX -= dx / zoom;
    camZ -= dy / zoom;
    lastMx = e.clientX;
    lastMy = e.clientY;
  });

  window.addEventListener('mouseup', (e) => {
    if (!dragging) return;
    dragging = false;
    if (!dragMoved && isOpen && e.button === 0) {
      const wx = camX + (e.clientX - fullCanvas.width * 0.5) / zoom;
      const wz = camZ + (e.clientY - fullCanvas.height * 0.5) / zoom;
      onSetCustomWaypoint({ x: wx, z: wz });
    }
  });

  fullCanvas.addEventListener('contextmenu', (e) => e.preventDefault());

  fullCanvas.addEventListener('wheel', (e) => {
    if (!isOpen) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.88 : 1.14;
    zoom = Math.max(0.45, Math.min(3.5, zoom * factor));
  }, { passive: false });

  function resetView(px = 0, pz = 0) {
    camX = px;
    camZ = pz;
    zoom = 0.78;
  }

  function setOpen(open, playerPos) {
    isOpen = open;
    fullWrap.classList.toggle('hidden', !open);
    if (open) {
      resizeFull();
      if (playerPos) resetView(playerPos.x, playerPos.z);
    }
  }

  function drawMinimap(state) {
    const { playerPos, playerYaw, vehicles, transit, collectibles, missionTarget, customWaypoint } = state;
    const w = miniCanvas.width;
    const h = miniCanvas.height;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const scale = 0.56; // px per meter

    mctx.clearRect(0, 0, w, h);
    mctx.save();
    mctx.beginPath();
    mctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    mctx.clip();

    mctx.fillStyle = '#182430';
    mctx.fillRect(0, 0, w, h);

    // Rotate official Swiss map to match camera/player heading
    mctx.translate(cx, cy);
    mctx.rotate(playerYaw);

    const img = topoImg || orthoImg;
    if (img) {
      const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
      const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
      const dx0 = (WORLD_BOUNDS.minX - playerPos.x) * scale;
      const dz0 = (WORLD_BOUNDS.minZ - playerPos.z) * scale;
      mctx.drawImage(img, dx0, dz0, spanX * scale, spanZ * scale);
    }

    // Collectibles
    for (const c of collectibles) {
      if (c.collected) continue;
      const dx = (c.x - playerPos.x) * scale;
      const dz = (c.z - playerPos.z) * scale;
      mctx.fillStyle = '#ffb82e';
      mctx.strokeStyle = '#111';
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(dx, dz, 3.8, 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();
    }

    // Helicopter & Mouette
    for (const v of vehicles) {
      if (v.type !== 'heli' && v.type !== 'boat') continue;
      const dx = (v.x - playerPos.x) * scale;
      const dz = (v.z - playerPos.z) * scale;
      mctx.fillStyle = v.type === 'heli' ? '#ff3b3b' : '#ffe033';
      mctx.strokeStyle = '#111';
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(dx, dz, 4.8, 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();
    }

    // Live Geneva TPG Trams (orange) & TPG Buses (royal blue) on minimap radar!
    if (transit) {
      for (const t of transit) {
        const dx = (t.x - playerPos.x) * scale;
        const dz = (t.z - playerPos.z) * scale;
        mctx.fillStyle = t.kind === 'tram' ? '#f26522' : '#3862c8';
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 1.4;
        mctx.beginPath();
        mctx.arc(dx, dz, t.kind === 'tram' ? 4.4 : 3.8, 0, Math.PI * 2);
        mctx.fill();
        mctx.stroke();
      }
    }

    // Mission target ring
    if (missionTarget) {
      const dx = (missionTarget.x - playerPos.x) * scale;
      const dz = (missionTarget.z - playerPos.z) * scale;
      mctx.strokeStyle = '#ffb82e';
      mctx.lineWidth = 3;
      mctx.beginPath();
      mctx.arc(dx, dz, 7.2, 0, Math.PI * 2);
      mctx.stroke();
    }

    // Custom waypoint
    if (customWaypoint) {
      const dx = (customWaypoint.x - playerPos.x) * scale;
      const dz = (customWaypoint.z - playerPos.z) * scale;
      mctx.fillStyle = '#00e5ff';
      mctx.strokeStyle = '#111';
      mctx.lineWidth = 1.5;
      mctx.beginPath();
      mctx.arc(dx, dz, 5.5, 0, Math.PI * 2);
      mctx.fill();
      mctx.stroke();
    }

    mctx.restore();

    // Player heading chevron
    mctx.save();
    mctx.translate(cx, cy);
    mctx.fillStyle = '#2b8cff';
    mctx.strokeStyle = '#ffffff';
    mctx.lineWidth = 2.2;
    mctx.beginPath();
    mctx.moveTo(0, -9.5);
    mctx.lineTo(6.8, 7.5);
    mctx.lineTo(0, 3.8);
    mctx.lineTo(-6.8, 7.5);
    mctx.closePath();
    mctx.fill();
    mctx.stroke();
    mctx.restore();
  }

  function drawFullMap(state) {
    if (!isOpen) return;
    const { playerPos, vehicles, transit, collectibles, missionTarget, customWaypoint, foundCount } = state;
    const w = fullCanvas.width;
    const h = fullCanvas.height;

    foundLabel.textContent = `FOUND ${foundCount} / ${collectibles.length}`;
    scaleTxt.textContent = `${Math.round(80 / zoom)} m`;

    fctx.fillStyle = '#0d1218';
    fctx.fillRect(0, 0, w, h);

    const toScreen = (wx, wz) => [
      w * 0.5 + (wx - camX) * zoom,
      h * 0.5 + (wz - camZ) * zoom,
    ];

    // Draw official 1:1 Swiss Topographic Map or Satellite Ortho!
    const img = useSatellite ? orthoImg || topoImg : topoImg || orthoImg;
    if (img) {
      const [bx0, bz0] = toScreen(WORLD_BOUNDS.minX, WORLD_BOUNDS.minZ);
      const spanX = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
      const spanZ = WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ;
      fctx.drawImage(img, bx0, bz0, spanX * zoom, spanZ * zoom);
    }

    // Landmark labels with crisp dark pill backing + smart 2D collision avoidance (zero overlap or top-bar clipping!)
    fctx.font = '700 11.5px "Helvetica Neue", sans-serif';
    fctx.textAlign = 'center';
    const placedPills = [];
    const pillOverlaps = (x0, y0, x1, y1) => {
      if (y0 < 108) return true; // never clip behind top legend bar!
      for (let i = 0; i < placedPills.length; i++) {
        const b = placedPills[i];
        if (x0 < b[2] + 4 && x1 > b[0] - 4 && y0 < b[3] + 3 && y1 > b[1] - 3) return true;
      }
      return false;
    };
    for (const lm of LANDMARKS) {
      const [sx, sy] = toScreen(lm.x, lm.z);
      fctx.fillStyle = lm.type === 'heli' ? '#ff3b3b' : lm.type === 'boat' ? '#ffe033' : '#ffb82e';
      fctx.strokeStyle = '#111';
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(sx, sy, 5, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();

      const tw = fctx.measureText(lm.name).width + 12;
      const th = 17;
      // Try above dot, then below dot, then shifted right/left so neighboring landmarks never overlap!
      const candidates = [
        [sx - tw * 0.5, sy - 24],
        [sx - tw * 0.5, sy + 9],
        [sx + 10, sy - 9],
        [sx - tw - 10, sy - 9],
      ];
      let chosen = null;
      for (const [bx, by] of candidates) {
        if (!pillOverlaps(bx, by, bx + tw, by + th)) {
          chosen = [bx, by];
          break;
        }
      }
      if (chosen) {
        const [bx, by] = chosen;
        placedPills.push([bx, by, bx + tw, by + th]);
        fctx.fillStyle = 'rgba(11, 12, 14, 0.84)';
        fctx.fillRect(bx, by, tw, th);
        fctx.fillStyle = lm.type === 'heli' ? '#ff6b6b' : lm.type === 'boat' ? '#ffe066' : '#ffd27a';
        fctx.fillText(lm.name, bx + tw * 0.5, by + 13);
      }
    }

    // Collectibles
    for (const c of collectibles) {
      if (c.collected) continue;
      const [sx, sy] = toScreen(c.x, c.z);
      fctx.fillStyle = '#ffb82e';
      fctx.strokeStyle = '#111';
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();
    }

    // Live vehicles
    for (const v of vehicles) {
      if (v.type !== 'heli' && v.type !== 'boat') continue;
      const [sx, sy] = toScreen(v.x, v.z);
      fctx.fillStyle = v.type === 'heli' ? '#ff3b3b' : '#ffe033';
      fctx.strokeStyle = '#fff';
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();
    }

    // Live Geneva TPG Trams & Buses with line badges on full Swiss map!
    if (transit) {
      fctx.font = '700 10px Inter, system-ui, sans-serif';
      fctx.textAlign = 'center';
      for (const t of transit) {
        const [sx, sy] = toScreen(t.x, t.z);
        const isTram = t.kind === 'tram';
        fctx.fillStyle = isTram ? '#f26522' : '#3862c8';
        fctx.strokeStyle = '#fff';
        fctx.lineWidth = 1.8;
        fctx.beginPath();
        fctx.arc(sx, sy, isTram ? 8.5 : 7.5, 0, Math.PI * 2);
        fctx.fill();
        fctx.stroke();
        if (t.spec?.num) {
          fctx.fillStyle = '#fff';
          fctx.fillText(t.spec.num, sx, sy + 3.5);
        }
      }
    }

    if (missionTarget) {
      const [sx, sy] = toScreen(missionTarget.x, missionTarget.z);
      fctx.strokeStyle = '#ffb82e';
      fctx.lineWidth = 3.5;
      fctx.beginPath();
      fctx.arc(sx, sy, 13, 0, Math.PI * 2);
      fctx.stroke();
    }

    if (customWaypoint) {
      const [sx, sy] = toScreen(customWaypoint.x, customWaypoint.z);
      fctx.fillStyle = '#00e5ff';
      fctx.strokeStyle = '#111';
      fctx.lineWidth = 2;
      fctx.beginPath();
      fctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
      fctx.fill();
      fctx.stroke();
    }

    const [px, py] = toScreen(playerPos.x, playerPos.z);
    fctx.fillStyle = '#2b8cff';
    fctx.strokeStyle = '#ffffff';
    fctx.lineWidth = 2.8;
    fctx.beginPath();
    fctx.arc(px, py, 8, 0, Math.PI * 2);
    fctx.fill();
    fctx.stroke();
  }

  return {
    isOpen: () => isOpen,
    setOpen,
    setMapImages,
    toggleLayer,
    resetView,
    drawMinimap,
    drawFullMap,
  };
}
