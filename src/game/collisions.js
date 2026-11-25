// Unified Solid Physics Collision Solver for 1:1 Geneva
// Supports:
//   - 'poly': Exact 2D footprint polygons (all 2,378 diagonal Geneva buildings — ZERO invisible AABB walls!)
//   - 'box':  Axis-aligned bounding boxes
//   - 'cyl':  Vertical cylinders (tree trunks, lamp posts, traffic lights, bollards, lighthouse)
//   - 'obb':  Oriented bounding boxes (bridge parapets, lakeside railings, parked/AI cars, TPG buses, trams, helicopter)

export function pointInPolygon(px, pz, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], zi = pts[i][1];
    const xj = pts[j][0], zj = pts[j][1];
    const intersect = (zi > pz) !== (zj > pz) && px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function createStaticColliderGrid(cellSize = 28) {
  const grid = new Map();

  function insert(col) {
    let minX, maxX, minZ, maxZ;
    if (col.kind === 'cyl') {
      minX = col.x - col.r;
      maxX = col.x + col.r;
      minZ = col.z - col.r;
      maxZ = col.z + col.r;
    } else if (col.kind === 'obb') {
      const c = Math.abs(Math.cos(col.yaw));
      const s = Math.abs(Math.sin(col.yaw));
      const ex = col.halfW * c + col.halfL * s;
      const ez = col.halfW * s + col.halfL * c;
      minX = col.x - ex;
      maxX = col.x + ex;
      minZ = col.z - ez;
      maxZ = col.z + ez;
    } else {
      minX = col.minX;
      maxX = col.maxX;
      minZ = col.minZ;
      maxZ = col.maxZ;
    }
    // Pad grid insertion by 2.2m so vehicles straddling cell borders never miss a wall edge
    const pad = 2.2;
    const cx0 = Math.floor((minX - pad) / cellSize);
    const cx1 = Math.floor((maxX + pad) / cellSize);
    const cz0 = Math.floor((minZ - pad) / cellSize);
    const cz1 = Math.floor((maxZ + pad) / cellSize);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const key = `${cx},${cz}`;
        let arr = grid.get(key);
        if (!arr) {
          arr = [];
          grid.set(key, arr);
        }
        arr.push(col);
      }
    }
  }

  let _qStamp = 1;
  const _rectOut = [];

  function query(x, z) {
    return grid.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) || [];
  }

  // Zero-GC multi-cell broadphase query for oriented vehicles (cars, 12m buses, helicopter) so straddling cell boundaries NEVER misses a collider!
  function queryRect(minX, maxX, minZ, maxZ) {
    const cx0 = Math.floor(minX / cellSize);
    const cx1 = Math.floor(maxX / cellSize);
    const cz0 = Math.floor(minZ / cellSize);
    const cz1 = Math.floor(maxZ / cellSize);
    if (cx0 === cx1 && cz0 === cz1) {
      return grid.get(`${cx0},${cz0}`) || [];
    }
    _qStamp++;
    if (_qStamp > 1e9) _qStamp = 1;
    _rectOut.length = 0;
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const arr = grid.get(`${cx},${cz}`);
        if (!arr) continue;
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i];
          if (c._qStamp !== _qStamp) {
            c._qStamp = _qStamp;
            _rectOut.push(c);
          }
        }
      }
    }
    return _rectOut;
  }

  return { insert, query, queryRect };
}

// Resolve a moving circle (player or vehicle) solidly against an exact Polygon, AABB, Cylinder, or OBB!
// Returns { x, z, floorY, hit, nx, nz }
export function resolveCircleAgainstCollider(px, py, pz, radius, col, allowStandOnTop = true) {
  let x = px;
  let z = pz;
  let floorY = -999;
  let hit = false;
  let nx = 0;
  let nz = 0;

  const maxY = col.maxY ?? 999;
  if (py > maxY + 0.25) return { x, z, floorY, hit, nx, nz };

  if (col.kind === 'poly') {
    // Fast AABB broadphase reject before exact wall-edge polygon distance test
    if (x < col.minX - radius || x > col.maxX + radius || z < col.minZ - radius || z > col.maxZ + radius) {
      return { x, z, floorY, hit, nx, nz };
    }
    const pts = col.pts;
    const n = pts.length;
    let bestD2 = Infinity;
    let bestCx = x;
    let bestCz = z;
    let bestEx = 0;
    let bestEz = 1;

    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const vx = b[0] - a[0];
      const vz = b[1] - a[1];
      const l2 = vx * vx + vz * vz;
      let t = 0;
      if (l2 > 1e-8) {
        t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / l2));
      }
      const cx = a[0] + t * vx;
      const cz = a[1] + t * vz;
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestCx = cx;
        bestCz = cz;
        bestEx = vx;
        bestEz = vz;
      }
    }

    const inside = pointInPolygon(x, z, pts);
    if (inside || bestD2 < radius * radius) {
      if (allowStandOnTop && col.walkableTop !== false && py >= maxY - 1.4) {
        floorY = maxY;
      } else {
        const d = Math.sqrt(bestD2);
        if (d > 1e-5) {
          if (inside) {
            nx = (bestCx - x) / d;
            nz = (bestCz - z) / d;
            const push = d + radius;
            x += nx * push;
            z += nz * push;
          } else {
            nx = (x - bestCx) / d;
            nz = (z - bestCz) / d;
            const push = radius - d;
            x += nx * push;
            z += nz * push;
          }
        } else {
          // Exactly on wall edge — push along outward edge normal
          const eLen = Math.hypot(bestEx, bestEz) || 1;
          nx = -bestEz / eLen;
          nz = bestEx / eLen;
          if (pointInPolygon(x + nx * 0.05, z + nz * 0.05, pts)) {
            nx = -nx;
            nz = -nz;
          }
          x += nx * radius;
          z += nz * radius;
        }
        hit = true;
      }
    }
  } else if (col.kind === 'cyl') {
    const dx = x - col.x;
    const dz = z - col.z;
    const minD = radius + col.r;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD * minD) {
      if (allowStandOnTop && col.walkableTop && py >= maxY - 0.85) {
        floorY = maxY;
      } else {
        const d = Math.sqrt(d2) || 0.001;
        nx = dx / d;
        nz = dz / d;
        const push = minD - d;
        x += nx * push;
        z += nz * push;
        hit = true;
      }
    }
  } else if (col.kind === 'obb') {
    // Transform world delta into OBB local frame (+Z along col.yaw, +X to right)
    const cosY = Math.cos(col.yaw);
    const sinY = Math.sin(col.yaw);
    const dx = x - col.x;
    const dz = z - col.z;
    const lx = dx * cosY - dz * sinY;
    const lz = dx * sinY + dz * cosY;

    const clx = Math.max(-col.halfW, Math.min(col.halfW, lx));
    const clz = Math.max(-col.halfL, Math.min(col.halfL, lz));
    const dlx = lx - clx;
    const dlz = lz - clz;
    const d2 = dlx * dlx + dlz * dlz;

    if (d2 < radius * radius) {
      if (allowStandOnTop && col.walkableTop && py >= maxY - 1.1) {
        floorY = maxY;
      } else {
        let lnx = 0, lnz = 0, push = 0;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          lnx = dlx / d;
          lnz = dlz / d;
          push = radius - d;
        } else {
          // Center is inside OBB — push out along nearest local face
          const pxW = col.halfW - Math.abs(lx);
          const pzL = col.halfL - Math.abs(lz);
          if (pxW < pzL) {
            lnx = lx >= 0 ? 1 : -1;
            push = pxW + radius;
          } else {
            lnz = lz >= 0 ? 1 : -1;
            push = pzL + radius;
          }
        }
        // Transform push vector back to world space (inverse rotation)
        nx = lnx * cosY + lnz * sinY;
        nz = -lnx * sinY + lnz * cosY;
        x += nx * push;
        z += nz * push;
        hit = true;
      }
    }
  } else {
    // Classic AABB ('box')
    const cx = Math.max(col.minX, Math.min(x, col.maxX));
    const cz = Math.max(col.minZ, Math.min(z, col.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (allowStandOnTop && col.walkableTop !== false && py >= maxY - 1.4) {
        floorY = maxY;
      } else {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          nx = dx / d;
          nz = dz / d;
          const push = radius - d;
          x += nx * push;
          z += nz * push;
        } else {
          const dL = Math.abs(x - col.minX);
          const dR = Math.abs(col.maxX - x);
          const dT = Math.abs(z - col.minZ);
          const dB = Math.abs(col.maxZ - z);
          const m = Math.min(dL, dR, dT, dB);
          if (m === dL) { x = col.minX - radius; nx = -1; }
          else if (m === dR) { x = col.maxX + radius; nx = 1; }
          else if (m === dT) { z = col.minZ - radius; nz = -1; }
          else { z = col.maxZ + radius; nz = 1; }
        }
        hit = true;
      }
    }
  }

  return { x, z, floorY, hit, nx, nz };
}

// Reusable SAT / OBB collision result object (zero per-frame GC allocations!)
const _obbOut = { hit: false, nx: 0, nz: 0, depth: 0, contactX: 0, contactZ: 0 };
const _satAxesX = new Float64Array(4);
const _satAxesZ = new Float64Array(4);
const _hullPtsX = new Float64Array(9);
const _hullPtsZ = new Float64Array(9);

function solveOBBvsOBB(ax, az, aCos, aSin, aHW, aHL, bx, bz, bCos, bSin, bHW, bHL, out) {
  // Local +X = (cos, -sin), Local +Z = (sin, cos)
  const aXx = aCos, aXz = -aSin;
  const aZx = aSin, aZz = aCos;
  const bXx = bCos, bXz = -bSin;
  const bZx = bSin, bZz = bCos;

  _satAxesX[0] = aXx; _satAxesZ[0] = aXz;
  _satAxesX[1] = aZx; _satAxesZ[1] = aZz;
  _satAxesX[2] = bXx; _satAxesZ[2] = bXz;
  _satAxesX[3] = bZx; _satAxesZ[3] = bZz;

  const dx = ax - bx;
  const dz = az - bz;

  let minOv = Infinity;
  let bestNx = 0;
  let bestNz = 1;
  let bestAxisIdx = 0;

  for (let i = 0; i < 4; i++) {
    const ux = _satAxesX[i];
    const uz = _satAxesZ[i];
    const centerProj = dx * ux + dz * uz;
    const dist = Math.abs(centerProj);
    const rA = aHW * Math.abs(aXx * ux + aXz * uz) + aHL * Math.abs(aZx * ux + aZz * uz);
    const rB = bHW * Math.abs(bXx * ux + bXz * uz) + bHL * Math.abs(bZx * ux + bZz * uz);
    const ov = rA + rB - dist;
    if (ov <= 0) {
      out.hit = false;
      return out;
    }
    if (ov < minOv) {
      minOv = ov;
      bestAxisIdx = i;
      if (centerProj >= 0) {
        bestNx = ux;
        bestNz = uz;
      } else {
        bestNx = -ux;
        bestNz = -uz;
      }
    }
  }

  // Exact world-space contact point on deepest support corner/edge for real rotational torque & sparks!
  let cx = ax;
  let cz = az;
  if (bestAxisIdx >= 2) {
    // Separating axis belongs to B -> contact is on A's deepest bumper corner/edge into B
    const dotX = aXx * bestNx + aXz * bestNz;
    const dotZ = aZx * bestNx + aZz * bestNz;
    let lx = Math.abs(dotX) < 0.14 ? 0 : dotX > 0 ? -aHW : aHW;
    let lz = Math.abs(dotZ) < 0.14 ? 0 : dotZ > 0 ? -aHL : aHL;
    if (lx === 0 && Math.abs(dotX) < 0.14) {
      // Flat bumper contact: project B's center onto A's bumper span so off-center hits still impart realistic torque
      const relX = (bx - ax) * aXx + (bz - az) * aXz;
      lx = Math.max(-aHW, Math.min(aHW, relX));
    }
    if (lz === 0 && Math.abs(dotZ) < 0.14) {
      const relZ = (bx - ax) * aZx + (bz - az) * aZz;
      lz = Math.max(-aHL, Math.min(aHL, relZ));
    }
    cx = ax + lx * aXx + lz * aZx;
    cz = az + lx * aXz + lz * aZz;
  } else {
    // Separating axis belongs to A -> contact is on B's deepest corner into A
    const dotX = bXx * bestNx + bXz * bestNz;
    const dotZ = bZx * bestNx + bZz * bestNz;
    let lx = Math.abs(dotX) < 0.14 ? 0 : dotX > 0 ? bHW : -bHW;
    let lz = Math.abs(dotZ) < 0.14 ? 0 : dotZ > 0 ? bHL : -bHL;
    if (lx === 0 && Math.abs(dotX) < 0.14) {
      const relX = (ax - bx) * bXx + (az - bz) * bXz;
      lx = Math.max(-bHW, Math.min(bHW, relX));
    }
    if (lz === 0 && Math.abs(dotZ) < 0.14) {
      const relZ = (ax - bx) * bZx + (az - bz) * bZz;
      lz = Math.max(-bHL, Math.min(bHL, relZ));
    }
    cx = bx + lx * bXx + lz * bZx;
    cz = bz + lx * bXz + lz * bZz;
  }

  out.hit = true;
  out.nx = bestNx;
  out.nz = bestNz;
  out.depth = minOv;
  out.contactX = cx;
  out.contactZ = cz;
  return out;
}

// True 2D Oriented-Box (OBB) collision solver for full-length vehicles (cars, 12m TPG buses, Vespa, e-scooters, helicopter)!
// Eliminates front/rear bumper clipping into buildings, walls, poles, trees, railings, benches, café tables & other cars!
export function resolveOBBAgainstCollider(x, y, z, yaw, halfW, halfL, col, out = _obbOut) {
  out.hit = false;
  const maxY = col.maxY ?? 999;
  if (y > maxY + 0.12) return out;

  const aCos = Math.cos(yaw);
  const aSin = Math.sin(yaw);

  if (col.kind === 'obb') {
    // Fast bounding-radius reject before SAT
    const rSum = Math.hypot(halfW, halfL) + Math.hypot(col.halfW, col.halfL);
    const dx = x - col.x;
    const dz = z - col.z;
    if (dx * dx + dz * dz > rSum * rSum) return out;
    return solveOBBvsOBB(x, z, aCos, aSin, halfW, halfL, col.x, col.z, Math.cos(col.yaw), Math.sin(col.yaw), col.halfW, col.halfL, out);
  }

  if (col.kind === 'box') {
    const bx = (col.minX + col.maxX) * 0.5;
    const bz = (col.minZ + col.maxZ) * 0.5;
    const bHW = (col.maxX - col.minX) * 0.5;
    const bHL = (col.maxZ - col.minZ) * 0.5;
    const rSum = Math.hypot(halfW, halfL) + Math.hypot(bHW, bHL);
    const dx = x - bx;
    const dz = z - bz;
    if (dx * dx + dz * dz > rSum * rSum) return out;
    return solveOBBvsOBB(x, z, aCos, aSin, halfW, halfL, bx, bz, 1, 0, bHW, bHL, out);
  }

  if (col.kind === 'cyl') {
    const rMax = Math.hypot(halfW, halfL) + col.r;
    const dxC = col.x - x;
    const dzC = col.z - z;
    if (dxC * dxC + dzC * dzC > rMax * rMax) return out;

    // Cylinder center in vehicle A's local frame (+X = (cos,-sin), +Z = (sin,cos))
    const clx = dxC * aCos - dzC * aSin;
    const clz = dxC * aSin + dzC * aCos;
    const px = Math.max(-halfW, Math.min(halfW, clx));
    const pz = Math.max(-halfL, Math.min(halfL, clz));
    const dlx = px - clx;
    const dlz = pz - clz;
    const d2 = dlx * dlx + dlz * dlz;
    if (d2 >= col.r * col.r) return out;

    let lnx = 0;
    let lnz = 0;
    let depth = 0;
    if (d2 > 1e-6) {
      const d = Math.sqrt(d2);
      lnx = dlx / d;
      lnz = dlz / d;
      depth = col.r - d;
    } else {
      const penX = halfW - Math.abs(clx);
      const penZ = halfL - Math.abs(clz);
      if (penX < penZ) {
        lnx = clx >= 0 ? -1 : 1;
        depth = penX + col.r;
      } else {
        lnz = clz >= 0 ? -1 : 1;
        depth = penZ + col.r;
      }
    }
    out.hit = true;
    out.nx = lnx * aCos + lnz * aSin;
    out.nz = -lnx * aSin + lnz * aCos;
    out.depth = depth;
    out.contactX = x + px * aCos + pz * aSin;
    out.contactZ = z - px * aSin + pz * aCos;
    return out;
  }

  if (col.kind === 'poly') {
    // Broadphase AABB reject against oriented hull extents
    const ex = Math.abs(aCos) * halfW + Math.abs(aSin) * halfL + 0.05;
    const ez = Math.abs(aSin) * halfW + Math.abs(aCos) * halfL + 0.05;
    if (x + ex < col.minX || x - ex > col.maxX || z + ez < col.minZ || z - ez > col.maxZ) {
      return out;
    }

    const pts = col.pts;
    const n = pts.length;
    const aXx = aCos, aXz = -aSin;
    const aZx = aSin, aZz = aCos;

    // 9 exact vehicle hull sample points: 4 corners + 4 edge midpoints + center
    _hullPtsX[0] = x + halfW * aXx + halfL * aZx; _hullPtsZ[0] = z + halfW * aXz + halfL * aZz; // FL
    _hullPtsX[1] = x - halfW * aXx + halfL * aZx; _hullPtsZ[1] = z - halfW * aXz + halfL * aZz; // FR
    _hullPtsX[2] = x + halfW * aXx - halfL * aZx; _hullPtsZ[2] = z + halfW * aXz - halfL * aZz; // RL
    _hullPtsX[3] = x - halfW * aXx - halfL * aZx; _hullPtsZ[3] = z - halfW * aXz - halfL * aZz; // RR
    _hullPtsX[4] = x + halfL * aZx;               _hullPtsZ[4] = z + halfL * aZz;               // Front mid
    _hullPtsX[5] = x - halfL * aZx;               _hullPtsZ[5] = z - halfL * aZz;               // Rear mid
    _hullPtsX[6] = x + halfW * aXx;               _hullPtsZ[6] = z + halfW * aXz;               // Left mid
    _hullPtsX[7] = x - halfW * aXx;               _hullPtsZ[7] = z - halfW * aXz;               // Right mid
    _hullPtsX[8] = x;                             _hullPtsZ[8] = z;                             // Center

    let bestDepth = 0;
    let bestNx = 0;
    let bestNz = 1;
    let bestCx = x;
    let bestCz = z;

    // 1. Check if ANY vehicle corner/edge/center point penetrated inside the building footprint polygon
    for (let k = 0; k < 9; k++) {
      const hx = _hullPtsX[k];
      const hz = _hullPtsZ[k];
      if (!pointInPolygon(hx, hz, pts)) continue;

      let nearD2 = Infinity;
      let nearEx = hx;
      let nearEz = hz;
      let segVx = 1;
      let segVz = 0;
      for (let i = 0; i < n; i++) {
        const p0 = pts[i];
        const p1 = pts[(i + 1) % n];
        const vx = p1[0] - p0[0];
        const vz = p1[1] - p0[1];
        const l2 = vx * vx + vz * vz;
        const t = l2 > 1e-8 ? Math.max(0, Math.min(1, ((hx - p0[0]) * vx + (hz - p0[1]) * vz) / l2)) : 0;
        const cx = p0[0] + t * vx;
        const cz = p0[1] + t * vz;
        const ddx = cx - hx;
        const ddz = cz - hz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 < nearD2) {
          nearD2 = d2;
          nearEx = cx;
          nearEz = cz;
          segVx = vx;
          segVz = vz;
        }
      }
      const d = Math.sqrt(nearD2);
      const depth = d + 0.03;
      if (depth > bestDepth) {
        bestDepth = depth;
        if (d > 1e-5) {
          bestNx = (nearEx - hx) / d;
          bestNz = (nearEz - hz) / d;
        } else {
          const el = Math.hypot(segVx, segVz) || 1;
          bestNx = -segVz / el;
          bestNz = segVx / el;
          if (pointInPolygon(hx + bestNx * 0.05, hz + bestNz * 0.05, pts)) {
            bestNx = -bestNx;
            bestNz = -bestNz;
          }
        }
        bestCx = nearEx;
        bestCz = nearEz;
      }
    }

    // 2. Check if ANY sharp building polygon corner pokes inside the vehicle's OBB hull (catches side-door scrapes on corners!)
    for (let i = 0; i < n; i++) {
      const vx = pts[i][0] - x;
      const vz = pts[i][1] - z;
      const vlx = vx * aCos - vz * aSin;
      const vlz = vx * aSin + vz * aCos;
      if (Math.abs(vlx) < halfW && Math.abs(vlz) < halfL) {
        const penX = halfW - Math.abs(vlx);
        const penZ = halfL - Math.abs(vlz);
        let lnx = 0, lnz = 0, depth = 0;
        if (penX < penZ) {
          lnx = vlx >= 0 ? -1 : 1;
          depth = penX + 0.02;
        } else {
          lnz = vlz >= 0 ? -1 : 1;
          depth = penZ + 0.02;
        }
        if (depth > bestDepth) {
          bestDepth = depth;
          bestNx = lnx * aCos + lnz * aSin;
          bestNz = -lnx * aSin + lnz * aCos;
          bestCx = pts[i][0];
          bestCz = pts[i][1];
        }
      }
    }

    // 3. For long 12m buses (halfL > 3.5), also check intermediate spine points at ±halfL*0.5 so narrow pillars can't pass between midpoints!
    if (bestDepth === 0 && halfL > 3.5) {
      for (const frac of [-0.5, 0.5]) {
        for (const sx of [-halfW, halfW]) {
          const hx = x + sx * aXx + halfL * frac * aZx;
          const hz = z + sx * aXz + halfL * frac * aZz;
          if (!pointInPolygon(hx, hz, pts)) continue;
          let nearD2 = Infinity, nearEx = hx, nearEz = hz;
          for (let i = 0; i < n; i++) {
            const p0 = pts[i], p1 = pts[(i + 1) % n];
            const vx = p1[0] - p0[0], vz = p1[1] - p0[1];
            const l2 = vx * vx + vz * vz;
            const t = l2 > 1e-8 ? Math.max(0, Math.min(1, ((hx - p0[0]) * vx + (hz - p0[1]) * vz) / l2)) : 0;
            const cx = p0[0] + t * vx, cz = p0[1] + t * vz;
            const d2 = (cx - hx) * (cx - hx) + (cz - hz) * (cz - hz);
            if (d2 < nearD2) { nearD2 = d2; nearEx = cx; nearEz = cz; }
          }
          const d = Math.sqrt(nearD2);
          if (d + 0.03 > bestDepth) {
            bestDepth = d + 0.03;
            bestNx = d > 1e-5 ? (nearEx - hx) / d : aXx * (sx > 0 ? -1 : 1);
            bestNz = d > 1e-5 ? (nearEz - hz) / d : aXz * (sx > 0 ? -1 : 1);
            bestCx = nearEx;
            bestCz = nearEz;
          }
        }
      }
    }

    if (bestDepth > 0) {
      out.hit = true;
      out.nx = bestNx;
      out.nz = bestNz;
      out.depth = bestDepth;
      out.contactX = bestCx;
      out.contactZ = bestCz;
      return out;
    }
  }

  return out;
}
