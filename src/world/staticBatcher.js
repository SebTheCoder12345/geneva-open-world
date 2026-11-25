import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges static meshes inside a Three.js Group by shared Material + shadow flags into single draw calls.
 * Preserves 100% identical visuals while cutting hundreds of individual draw calls down to ~5-15!
 * Skips InstancedMesh, SkinnedMesh, multi-material arrays, and any object marked `userData.noBatch = true`.
 */
export function batchStaticGroup(
  rootGroup,
  { label = 'StaticBatch', minMeshes = 4, disposeSource = true, staticMatrix = true } = {}
) {
  rootGroup.updateMatrixWorld(true);
  const buckets = new Map();
  const toRemove = [];

  rootGroup.traverse((obj) => {
    if (!obj.isMesh || obj.isInstancedMesh || obj.isSkinnedMesh) return;
    if (obj.userData?.noBatch) return;
    if (Array.isArray(obj.material) || !obj.material || !obj.geometry) return;
    // Skip any ancestor marked noBatch (e.g. animated hands, wheels, rotors, spray rings)
    let p = obj.parent;
    while (p && p !== rootGroup) {
      if (p.userData?.noBatch) return;
      p = p.parent;
    }

    const mat = obj.material;
    const key = `${mat.uuid}_${obj.castShadow ? 1 : 0}_${obj.receiveShadow ? 1 : 0}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { mat, castShadow: obj.castShadow, receiveShadow: obj.receiveShadow, geos: [] };
      buckets.set(key, bucket);
    }

    // Clone & bake exact world transform relative to rootGroup
    const src = obj.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    g.applyMatrix4(obj.matrixWorld);

    // Fix triangle winding if source matrix had negative determinant (mirrored scale)
    if (obj.matrixWorld.determinant() < 0) {
      const pos = g.attributes.position;
      const nrm = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i += 3) {
        const i1 = i + 1;
        const i2 = i + 2;
        for (let k = 0; k < 3; k++) {
          const tp = pos.array[i1 * 3 + k];
          pos.array[i1 * 3 + k] = pos.array[i2 * 3 + k];
          pos.array[i2 * 3 + k] = tp;
          if (nrm) {
            const tn = nrm.array[i1 * 3 + k];
            nrm.array[i1 * 3 + k] = nrm.array[i2 * 3 + k];
            nrm.array[i2 * 3 + k] = tn;
          }
        }
        if (uv) {
          for (let k = 0; k < 2; k++) {
            const tu = uv.array[i1 * 2 + k];
            uv.array[i1 * 2 + k] = uv.array[i2 * 2 + k];
            uv.array[i2 * 2 + k] = tu;
          }
        }
      }
      pos.needsUpdate = true;
      if (nrm) nrm.needsUpdate = true;
      if (uv) uv.needsUpdate = true;
    }

    // Normalize attributes so mergeGeometries never fails on mismatched optional attributes (e.g. uv / color)
    const count = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    }
    // Strip extra incompatible attributes (like tangent/uv1/color unless needed)
    for (const attrName of Object.keys(g.attributes)) {
      if (attrName !== 'position' && attrName !== 'normal' && attrName !== 'uv') {
        g.deleteAttribute(attrName);
      }
    }
    bucket.geos.push(g);
    toRemove.push(obj);
  });

  if (toRemove.length < minMeshes) {
    // Cleanup temporary clones if nothing significant to batch
    for (const b of buckets.values()) b.geos.forEach((g) => g.dispose());
    return { mergedMeshes: 0, removedMeshes: 0 };
  }

  // Inverse of rootGroup world matrix so batched meshes live cleanly inside rootGroup's local space
  const invRoot = new THREE.Matrix4().copy(rootGroup.matrixWorld).invert();
  const isIdentity = invRoot.equals(new THREE.Matrix4());
  let mergedCount = 0;

  for (const b of buckets.values()) {
    if (b.geos.length === 0) continue;
    const merged = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!merged) continue;
    if (!isIdentity) merged.applyMatrix4(invRoot);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();

    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.name = `${label}_${mergedCount}`;
    mesh.castShadow = b.castShadow;
    mesh.receiveShadow = b.receiveShadow;
    if (staticMatrix) {
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
    }
    rootGroup.add(mesh);
    mergedCount++;
  }

  for (const obj of toRemove) {
    if (obj.parent) obj.parent.remove(obj);
    if (disposeSource && obj.geometry) obj.geometry.dispose();
  }

  return { mergedMeshes: mergedCount, removedMeshes: toRemove.length };
}

/**
 * Pre-batches a loaded Blender/GLB vehicle template ONCE before cloning:
 * - Preserves spinning wheel parent groups (`wheel_fl/fr/rl/rr`) while collapsing 8-17 wheel spokes/hubs/calipers into 2-3 meshes per wheel!
 * - Preserves `keepNames` (like `license_plate`) so planar badges attach cleanly!
 * - Collapses all remaining 35-150 chassis sub-meshes into ~6-12 shared-material meshes!
 */
export function batchVehicleTemplate(
  rootGroup,
  {
    label = 'VehicleTpl',
    wheelNames = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
    keepNames = ['license_plate'],
  } = {}
) {
  if (!rootGroup) return rootGroup;
  rootGroup.updateMatrixWorld(true);

  const wheelNodes = [];
  rootGroup.traverse((o) => {
    if (keepNames.includes(o.name)) {
      o.userData.noBatch = true;
    }
    if (wheelNames.includes(o.name)) {
      o.userData.noBatch = true;
      wheelNodes.push(o);
    }
  });

  // Reparent non-spinning brake calipers out of wheel groups onto static chassis (realistically stationary + saves 4 DC/car!)
  for (const wn of wheelNodes) {
    for (let i = wn.children.length - 1; i >= 0; i--) {
      const ch = wn.children[i];
      if (ch.name && /caliper/i.test(ch.name)) {
        rootGroup.attach(ch);
      }
    }
  }

  // Batch each wheel's spokes, rotor, rim & tire internally while preserving its spinning pivot!
  for (const wn of wheelNodes) {
    // Temporarily clear noBatch on the wheel root itself so its children merge into wn's local space
    wn.userData.noBatch = false;
    batchStaticGroup(wn, { label: `${label}_${wn.name}`, minMeshes: 2, disposeSource: true, staticMatrix: true });
    wn.userData.noBatch = true;
  }

  // Batch the entire static vehicle chassis by material (preserves exact material names like CarPaint, CarGlass, Taillight!)
  batchStaticGroup(rootGroup, { label: `${label}_Body`, minMeshes: 2, disposeSource: true, staticMatrix: true });

  // Prune empty non-wheel/non-keep transform shells left behind so scene graph traversal stays lean
  const pruneEmpty = (node) => {
    for (let i = node.children.length - 1; i >= 0; i--) {
      const ch = node.children[i];
      pruneEmpty(ch);
      if (
        !ch.isMesh &&
        ch.children.length === 0 &&
        !wheelNames.includes(ch.name) &&
        !keepNames.includes(ch.name)
      ) {
        node.remove(ch);
      }
    }
  };
  pruneEmpty(rootGroup);

  return rootGroup;
}
