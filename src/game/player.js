import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getGroundHeight, isWater, SPAWNS, clampToWorld } from '../world/cityData.js';
import { createShadowBlobTexture } from '../world/textures.js';
import { createHumanAnimator } from './humanAnim.js';
import { resolveCircleAgainstCollider } from './collisions.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Grounded contact shadow directly beneath shoes
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: createShadowBlobTexture(),
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    })
  );
  contactShadow.position.y = 0.04;
  group.add(contactShadow);

  let animator = null;
  let gaitPhase = 0;
  let jogBlend = 0;
  let sprintBlend = 0;
  let startBlend = 0;
  let walkToggled = false;
  let pivotTimer = 0;
  let airBlend = 0;
  let fallBlend = 0;
  let fallTime = 0;
  let maxFallSpeed = 0;
  let landBlend = 0;
  let crouchBlend = 0;
  let crouchToggled = false;
  let brakeBlend = 0;
  let hookBlend = 0;
  let swimBlend = 0;
  let wasSwimming = false;
  let rollTimer = 0;
  const ROLL_DUR = 0.62;
  let knockdownTimer = 0;
  const KNOCKDOWN_DUR = 1.85;
  let emote = null;
  let emoteTimer = 0;
  let emoteDur = 1.4;
  let interact = null; // { item, phase: 'enter'|'active'|'exit', t, enterDur, exitDur, startX, startY, startZ, startYaw, anchorX, anchorY, anchorZ, anchorYaw, exitX, exitY, exitZ, sfxFired }
  let espressoProp = null;
  let turnLean = 0;
  let idleClock = 0;
  let coyoteTimer = 0;
  let prevHorizSpeed = 0;
  let lastFootstepHalf = -1;
  let wasBrakingHard = false;
  const locoOut = {
    gaitPhase: 0,
    speed: 0,
    speedNorm: 0,
    jogBlend: 0,
    sprintBlend: 0,
    crouchBlend: 0,
    landBlend: 0,
    seatedDrop: 0,
    interacting: false,
    turnLean: 0,
    grounded: true,
    walkMode: false,
  };

  const loader = new GLTFLoader();
  loader.load(
    '/models/protagonist_hero.glb?v=banker2',
    (gltf) => {
      const modelRoot = gltf.scene;
      modelRoot.scale.set(1.0, 1.0, 1.0);
      // Bespoke Geneva Investment Banker Hero (Savile Row midnight-navy pinstripe 3-piece suit, crisp white spread-collar shirt & French cuffs,
      // sculpted Hermès burgundy Windsor silk tie & 18k gold tie bar, presidential pocket square, gold cufflinks & Geneva dress watch, Clubmaster shades,
      // tailored executive side-part haircut, black Italian belt with gold buckle & mirror-shined cap-toe oxfords!)
      const tuneBankerMat = (mat) => {
        if (!mat) return mat;
        const m = mat.clone();
        const n = m.name || '';
        if (/Gold|Watch|Shade|Oxford|Belt|Horn/i.test(n)) {
          m.envMapIntensity = 1.65;
        } else if (/Tie|Lapel|Pocket/i.test(n)) {
          m.envMapIntensity = 1.05;
        } else if (/Suit|Waistcoat|Shirt|Socks/i.test(n)) {
          m.envMapIntensity = 0.62;
        } else {
          m.envMapIntensity = 0.88;
        }
        return m;
      };
      modelRoot.traverse((obj) => {
        if (obj.isMesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.frustumCulled = false;
          if (Array.isArray(obj.material)) {
            obj.material = obj.material.map(tuneBankerMat);
          } else if (obj.material) {
            obj.material = tuneBankerMat(obj.material);
          }
        }
      });
      group.add(modelRoot);
      animator = createHumanAnimator(modelRoot);

      // Attach sculpted miniature Swiss porcelain espresso cup to RightHand (hidden 99.9% of time -> 0 DC unless sitting at a Geneva café!)
      if (animator?.bones?.RightHand) {
        const cupGroup = new THREE.Group();
        cupGroup.name = 'GenevaEspressoCup';
        const porcMat = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.22, metalness: 0.05 });
        const cremaMat = new THREE.MeshStandardMaterial({ color: 0x3b1e0e, roughness: 0.18, metalness: 0.1 });
        const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.028, 0.068, 12), porcMat);
        const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.034, 12).rotateX(-Math.PI / 2), cremaMat);
        coffee.position.y = 0.028;
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 10), porcMat);
        handle.position.set(0.042, 0.004, 0);
        cupGroup.add(cupBody, coffee, handle);
        // Position neatly in curled right fingers (local bone frame of RightHand)
        cupGroup.position.set(0.02, 0.085, 0.03);
        cupGroup.rotation.set(0, 0, Math.PI * 0.45);
        cupGroup.visible = false;
        animator.bones.RightHand.add(cupGroup);
        espressoProp = cupGroup;
      }
    },
    undefined,
    (err) => console.warn('Human GLB load error:', err)
  );

  // Grapple hook rope visual
  const hookGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const hookLine = new THREE.Line(hookGeo, new THREE.LineBasicMaterial({ color: 0xffb82e, linewidth: 2 }));
  hookLine.visible = false;
  scene.add(hookLine);

  // Flashlight
  const flashlight = new THREE.SpotLight(0xfff3d4, 0, 80, Math.PI / 5, 0.45, 1.1);
  flashlight.position.set(0, 1.6, 0);
  scene.add(flashlight);
  scene.add(flashlight.target);

  const state = {
    x: SPAWNS.rade.x,
    y: 2,
    z: SPAWNS.rade.z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: SPAWNS.rade.yaw,
    grounded: true,
    swimming: false,
    hookTarget: null,
    hookTimer: 0,
    flashlightOn: false,
  };

  function resetActionStates() {
    rollTimer = 0;
    knockdownTimer = 0;
    emote = null;
    emoteTimer = 0;
    interact = null;
    if (espressoProp) espressoProp.visible = false;
    fallTime = 0;
    fallBlend = 0;
    maxFallSpeed = 0;
    landBlend = 0;
  }

  function startInteraction(item) {
    if (!item || !state.grounded || state.swimming || knockdownTimer > 0 || rollTimer > 0) return false;
    emote = null;
    emoteTimer = 0;
    crouchToggled = false;
    state.vx = 0;
    state.vz = 0;

    let anchorX = item.x;
    let anchorZ = item.z;
    let anchorY = Number.isFinite(item.y) ? item.y : getGroundHeight(anchorX, anchorZ) + 0.16;
    let anchorYaw = Number.isFinite(item.yaw) ? item.yaw : state.yaw;

    if (item.benchWidth) {
      // Slide seat anchor cleanly along bench length to where the player actually walked up!
      const cosY = Math.cos(anchorYaw);
      const sinY = Math.sin(anchorYaw);
      const dx = state.x - item.x;
      const dz = state.z - item.z;
      const localX = dx * cosY - dz * sinY;
      const halfSpan = item.benchWidth * 0.46;
      const clampedX = Math.max(-halfSpan, Math.min(halfSpan, localX));
      const localZ = item.seatLocalZ || 0.08;
      anchorX = item.x + cosY * clampedX + sinY * localZ;
      anchorZ = item.z - sinY * clampedX + cosY * localZ;
      anchorY = Number.isFinite(item.y) ? item.y : getGroundHeight(anchorX, anchorZ) + 0.16;
    } else if (item.rimRadius) {
      // Approach circular fountain / monument / bin from player's exact angle and face squarely inward!
      const dx = state.x - item.x;
      const dz = state.z - item.z;
      const len = Math.hypot(dx, dz) || 1;
      const ux = dx / len;
      const uz = dz / len;
      anchorX = item.x + ux * item.rimRadius;
      anchorZ = item.z + uz * item.rimRadius;
      anchorY = getGroundHeight(anchorX, anchorZ) + 0.16;
      anchorYaw = Math.atan2(-ux, -uz);
    }

    let exitX = Number.isFinite(item.exitX) ? item.exitX : anchorX + Math.sin(anchorYaw) * (item.exitDist ?? 0.72);
    let exitZ = Number.isFinite(item.exitZ) ? item.exitZ : anchorZ + Math.cos(anchorYaw) * (item.exitDist ?? 0.72);
    if (item.rimRadius) {
      // One-shot circular prop interactions finish right where he stood
      exitX = anchorX;
      exitZ = anchorZ;
    }
    const exitY = getGroundHeight(exitX, exitZ) + 0.16;

    interact = {
      item,
      phase: 'enter',
      t: 0,
      activeT: 0,
      enterDur: item.persistent ? 0.46 : 0.30,
      exitDur: item.persistent ? 0.38 : 0.24,
      startX: state.x,
      startY: state.y,
      startZ: state.z,
      startYaw: state.yaw,
      anchorX,
      anchorY,
      anchorZ,
      anchorYaw,
      exitX,
      exitY,
      exitZ,
      sfxFired: false,
    };
    return true;
  }

  function stopInteraction() {
    if (!interact) return false;
    if (interact.phase === 'exit') return true;
    interact.phase = 'exit';
    interact.t = 0;
    interact.exitStartX = state.x;
    interact.exitStartY = state.y;
    interact.exitStartZ = state.z;
    interact.exitStartYaw = state.yaw;
    return true;
  }

  function isInteracting() {
    return interact !== null;
  }

  function getActiveInteraction() {
    return interact ? interact.item : null;
  }

  function teleport(spawnKey) {
    const sp = SPAWNS[spawnKey] || SPAWNS.rade;
    state.x = sp.x;
    state.z = sp.z;
    state.y = getGroundHeight(sp.x, sp.z) + 0.18;
    state.vx = state.vy = state.vz = 0;
    state.yaw = sp.yaw;
    state.grounded = true;
    state.swimming = false;
    state.hookTarget = null;
    hookLine.visible = false;
    resetActionStates();
    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.yaw;
  }

  function triggerRoll() {
    if (!state.grounded || state.swimming || knockdownTimer > 0 || rollTimer > 0) return false;
    rollTimer = ROLL_DUR;
    emote = null;
    emoteTimer = 0;
    const fx = Math.sin(state.yaw);
    const fz = Math.cos(state.yaw);
    state.vx = fx * 7.8;
    state.vz = fz * 7.8;
    return true;
  }

  function triggerKnockdown(nx = 0, nz = 1, launchSpeed = 8.5) {
    if (knockdownTimer > 0.35) return false;
    knockdownTimer = KNOCKDOWN_DUR;
    rollTimer = 0;
    emote = null;
    emoteTimer = 0;
    state.hookTarget = null;
    hookLine.visible = false;
    state.vx = nx * launchSpeed;
    state.vz = nz * launchSpeed;
    if (state.grounded) {
      state.vy = 3.2;
      state.grounded = false;
    }
    return true;
  }

  function toggleCrouch() {
    if (state.swimming || knockdownTimer > 0) return crouchToggled;
    crouchToggled = !crouchToggled;
    if (crouchToggled) {
      emote = null;
      emoteTimer = 0;
    }
    return crouchToggled;
  }

  function toggleWalkMode() {
    walkToggled = !walkToggled;
    return walkToggled;
  }

  function getLocomotionState() {
    return locoOut;
  }

  function triggerEmote(name) {
    if (!state.grounded || state.swimming || knockdownTimer > 0 || rollTimer > 0) return false;
    const durations = { wave: 1.7, cheer: 1.55, backflip: 1.08, watch: 1.9 };
    emote = name;
    emoteDur = durations[name] || 1.5;
    emoteTimer = emoteDur;
    crouchToggled = false;
    state.vx *= 0.2;
    state.vz *= 0.2;
    return true;
  }

  function fireHook(camera, queryColliders) {
    if (knockdownTimer > 0) return;
    rollTimer = 0;
    emote = null;
    emoteTimer = 0;
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = new THREE.Vector3(state.x, state.y + 1.6, state.z);
    let target = origin.clone().addScaledVector(dir, 42);

    for (let d = 4; d <= 75; d += 2.5) {
      const p = origin.clone().addScaledVector(dir, d);
      const near = queryColliders(p.x, p.z);
      let hit = false;
      for (const b of near) {
        if (p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y <= b.maxY) {
          target = new THREE.Vector3(p.x, Math.min(b.maxY + 1.2, p.y + 2), p.z);
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    target.y = Math.max(getGroundHeight(target.x, target.z) + 1.5, target.y);
    state.hookTarget = target;
    state.hookTimer = 1.15;
    state.grounded = false;
    state.swimming = false;
    hookLine.visible = true;
  }

  // Visibly mount player on either the seated Red Geneva Vespa OR standing on a Geneva Electric Trottinette!
  function updateScooterRider(scooter) {
    group.visible = true;
    hookLine.visible = false;
    contactShadow.visible = false;
    resetActionStates();
    const sinY = Math.sin(scooter.yaw);
    const cosY = Math.cos(scooter.yaw);
    const isStanding = scooter.style === 'escooter';
    const seatBack = isStanding ? -0.12 : -0.18;
    const deckOffsetY = isStanding ? 0.18 : 0.56;
    group.position.set(scooter.x + sinY * seatBack, scooter.y + deckOffsetY, scooter.z + cosY * seatBack);
    group.rotation.order = 'YXZ';
    group.rotation.set(scooter.suspPitch, scooter.yaw, scooter.suspRoll);
    state.x = scooter.x;
    state.y = scooter.y;
    state.z = scooter.z;
    state.yaw = scooter.yaw;
    state.grounded = true;
    state.swimming = false;
    if (animator) {
      if (isStanding) animator.applyEScooterPose(scooter.suspRoll * 1.6);
      else animator.applyScooterPose(scooter.suspRoll * 1.4);
    }
  }

  // Visibly seat player inside a Geneva TPG Bus or Stadler Tango Tram (either panoramic window seat or driver cab!)
  function updateTransitRider(transit, isFirstPersonCam = false, dt = 0.016, elapsed = 0, cameraYaw = 0) {
    hookLine.visible = false;
    contactShadow.visible = false;
    flashlight.intensity = 0;
    resetActionStates();

    const isTram = transit.type === 'tram' || transit.style === 'tram';
    const isDriver = transit.transitMode === 'drive' || (!transit.transitMode && transit.style === 'bus');
    let lx = 0, ly = 0.60, lz = 0;
    if (isTram) {
      ly = 0.72;
      if (isDriver) {
        lx = 0.0;
        lz = 15.95;
      } else {
        lx = -0.76;
        lz = 13.02;
      }
    } else {
      ly = 0.60;
      if (isDriver) {
        lx = 0.58;
        lz = 4.78;
      } else {
        lx = -0.82;
        lz = 2.75;
      }
    }

    const sinY = Math.sin(transit.yaw);
    const cosY = Math.cos(transit.yaw);
    const wx = transit.x + lx * cosY + lz * sinY;
    const wz = transit.z - lx * sinY + lz * cosY;
    const wy = transit.y + ly;

    group.visible = !isFirstPersonCam;
    group.position.set(wx, wy, wz);
    group.rotation.order = 'YXZ';
    group.rotation.set(transit.suspPitch || 0, transit.yaw, transit.suspRoll || 0);

    state.x = wx;
    state.y = wy;
    state.z = wz;
    state.yaw = transit.yaw;
    state.vx = 0;
    state.vy = 0;
    state.vz = 0;
    state.grounded = true;
    state.swimming = false;

    if (animator && !isFirstPersonCam) {
      let headLook = (cameraYaw + Math.PI) - transit.yaw;
      while (headLook > Math.PI) headLook -= Math.PI * 2;
      while (headLook < -Math.PI) headLook += Math.PI * 2;
      headLook = Math.max(-0.75, Math.min(0.75, headLook));
      animator.applyInteractionPose(isDriver ? 'shelter_bench' : 'bench', 1.0, elapsed, headLook, 1.0);
    }
  }

  const _fxReusable = { cameraShake: 0, impactSfx: null, toast: null, footstep: null, scuff: false, jump: false };

  function update(dt, keys, cameraYaw, queryColliders, visible = true, dynamicColliders = []) {
    const fxOut = _fxReusable;
    fxOut.cameraShake = 0;
    fxOut.impactSfx = null;
    fxOut.toast = null;
    fxOut.footstep = null;
    fxOut.scuff = false;
    fxOut.jump = false;
    group.visible = visible;
    contactShadow.visible = visible;
    group.rotation.set(0, state.yaw, 0);
    if (!visible) {
      hookLine.visible = false;
      flashlight.intensity = 0;
      resetActionStates();
      return fxOut;
    }

    let isSprinting = false;
    let isWalking = false;
    let isCrouching = false;
    let yawRate = 0;
    const wasGrounded = state.grounded;

    // Tick action timers cleanly
    if (rollTimer > 0) rollTimer = Math.max(0, rollTimer - dt);
    if (knockdownTimer > 0) knockdownTimer = Math.max(0, knockdownTimer - dt);
    if (pivotTimer > 0) pivotTimer = Math.max(0, pivotTimer - dt);
    if (emoteTimer > 0) {
      emoteTimer = Math.max(0, emoteTimer - dt);
      if (emoteTimer <= 0) emote = null;
    }

    const inWaterNow = isWater(state.x, state.z) && state.y <= 0.18;
    state.swimming = inWaterNow && !state.hookTarget;
    if (state.swimming && !wasSwimming) {
      fxOut.impactSfx = 'splash';
      fxOut.cameraShake = 0.08;
      fallTime = 0;
      maxFallSpeed = 0;
      rollTimer = 0;
      knockdownTimer = 0;
      emote = null;
      emoteTimer = 0;
    }
    wasSwimming = state.swimming;

    if (interact) {
      // Smooth cinematic interactive object state machine (bench sit, café espresso, lake railing lean, TPG ticket, fountain, bin, landmark!)
      const hasMoveExit =
        interact.item.persistent &&
        interact.phase === 'active' &&
        interact.activeT > 0.25 &&
        (keys.KeyW || keys.KeyA || keys.KeyS || keys.KeyD || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || keys.Space);
      if (hasMoveExit) {
        stopInteraction();
      }

      const it = interact.item;
      const isSeated = it.type === 'bench' || it.type === 'shelter_bench' || it.type === 'cafe_chair';
      let blend = 1;

      const lerpYaw = (a, b, f) => {
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return a + d * f;
      };

      if (interact.phase === 'enter') {
        interact.t += dt;
        const u = Math.min(1, interact.t / interact.enterDur);
        const s = u * u * (3 - 2 * u);
        state.x = interact.startX + (interact.anchorX - interact.startX) * s;
        state.y = interact.startY + (interact.anchorY - interact.startY) * s;
        state.z = interact.startZ + (interact.anchorZ - interact.startZ) * s;
        state.yaw = lerpYaw(interact.startYaw, interact.anchorYaw, s);
        blend = s;
        if (u >= 1) {
          interact.phase = 'active';
          interact.t = 0;
        }
      } else if (interact.phase === 'active') {
        interact.activeT += dt;
        state.x = interact.anchorX;
        state.y = interact.anchorY;
        state.z = interact.anchorZ;
        state.yaw = interact.anchorYaw;
        blend = 1;
        // Mid-action audio cue for fountain water splash!
        if (!interact.sfxFired && it.type === 'fountain' && interact.activeT > 0.72) {
          interact.sfxFired = true;
          fxOut.impactSfx = 'splash';
        }
        if (!it.persistent && interact.activeT >= (it.duration || 2.4)) {
          stopInteraction();
        }
      } else if (interact.phase === 'exit') {
        interact.t += dt;
        const u = Math.min(1, interact.t / interact.exitDur);
        const s = u * u * (3 - 2 * u);
        const sx = interact.exitStartX ?? interact.anchorX;
        const sy = interact.exitStartY ?? interact.anchorY;
        const sz = interact.exitStartZ ?? interact.anchorZ;
        state.x = sx + (interact.exitX - sx) * s;
        state.y = sy + (interact.exitY - sy) * s;
        state.z = sz + (interact.exitZ - sz) * s;
        blend = 1 - s;
        if (u >= 1) {
          interact = null;
          if (espressoProp) espressoProp.visible = false;
        }
      }

      state.vx = 0;
      state.vy = 0;
      state.vz = 0;
      state.grounded = true;
      idleClock += dt;

      if (espressoProp) {
        espressoProp.visible = !!(interact && interact.item.type === 'cafe_chair' && blend > 0.45);
      }

      let headLook = (cameraYaw + Math.PI) - state.yaw;
      while (headLook > Math.PI) headLook -= Math.PI * 2;
      while (headLook < -Math.PI) headLook += Math.PI * 2;
      headLook = Math.max(-0.85, Math.min(0.85, headLook));

      locoOut.speed = 0;
      locoOut.speedNorm = 0;
      locoOut.jogBlend = 0;
      locoOut.sprintBlend = 0;
      locoOut.crouchBlend = 0;
      locoOut.landBlend = 0;
      locoOut.seatedDrop = isSeated ? 0.36 * blend : it.type === 'railing' ? 0.08 * blend : 0;
      locoOut.interacting = interact !== null;
      locoOut.turnLean = 0;
      locoOut.grounded = true;

      if (animator && interact) {
        animator.applyInteractionPose({
          kind: interact.item.type,
          t: interact.activeT,
          blend,
          duration: interact.item.duration || 2.4,
          headLookYaw: headLook,
          idleTime: idleClock,
        });
      }

      contactShadow.visible = visible;
      contactShadow.material.opacity = 0.72;
      group.position.set(state.x, state.y, state.z);
      group.rotation.y = state.yaw;
      flashlight.intensity = state.flashlightOn ? 6.0 : 0;
      return fxOut;
    }

    if (espressoProp && espressoProp.visible) espressoProp.visible = false;
    locoOut.seatedDrop = 0;
    locoOut.interacting = false;

    if (state.hookTarget) {
      state.hookTimer -= dt;
      const dx = state.hookTarget.x - state.x;
      const dy = state.hookTarget.y - state.y;
      const dz = state.hookTarget.z - state.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < 2.6 || state.hookTimer <= 0) {
        state.hookTarget = null;
        hookLine.visible = false;
        state.vy = 5.2;
      } else {
        const pull = 44;
        state.vx = (dx / dist) * pull;
        state.vz = (dz / dist) * pull;
        state.x += state.vx * dt;
        state.y += (dy / dist) * pull * dt;
        state.z += state.vz * dt;
        state.yaw = Math.atan2(dx, dz);
        const pts = hookLine.geometry.attributes.position;
        pts.setXYZ(0, state.x, state.y + 1.48, state.z);
        pts.setXYZ(1, state.hookTarget.x, state.hookTarget.y, state.hookTarget.z);
        pts.needsUpdate = true;
      }
      maxFallSpeed = 0;
      fallTime = 0;
    } else {
      const lockedControl = knockdownTimer > 0;
      const rollingNow = rollTimer > 0;
      const fwd = lockedControl || rollingNow ? 0 : (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const side = lockedControl || rollingNow ? 0 : (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
      const hasInput = fwd !== 0 || side !== 0;

      isCrouching = !state.swimming && !lockedControl && (!!keys.ControlLeft || !!keys.ControlRight || crouchToggled);
      isSprinting = !isCrouching && !lockedControl && !rollingNow && !!(keys.ShiftLeft || keys.ShiftRight);
      isWalking = !isCrouching && !isSprinting && !state.swimming && (!!keys.AltLeft || !!keys.AltRight || walkToggled);

      // Cancel stationary emotes immediately if player starts moving or jumping
      if ((hasInput || keys.Space) && emote && emote !== 'backflip') {
        emote = null;
        emoteTimer = 0;
      }

      // Authentic 3-tier urban speeds: Casual Walk 2.15 m/s | Athletic Jog 5.05 m/s | Explosive Sprint 9.6 m/s!
      const maxSpeed = state.swimming
        ? isSprinting ? 5.2 : 3.4
        : isCrouching
        ? 2.4
        : isSprinting
        ? 9.6
        : isWalking
        ? 2.15
        : 5.05;

      let targetVx = 0;
      let targetVz = 0;
      let inputDirX = 0;
      let inputDirZ = 0;
      if (hasInput) {
        const len = Math.hypot(fwd, side);
        const nf = fwd / len;
        const ns = side / len;
        const fx = -Math.sin(cameraYaw);
        const fz = -Math.cos(cameraYaw);
        const rx = Math.cos(cameraYaw);
        const rz = -Math.sin(cameraYaw);
        inputDirX = fx * nf + rx * ns;
        inputDirZ = fz * nf + rz * ns;
        targetVx = inputDirX * maxSpeed;
        targetVz = inputDirZ * maxSpeed;
      } else if (rollingNow) {
        const rSpeed = 7.4 * (0.45 + 0.55 * (rollTimer / ROLL_DUR));
        targetVx = Math.sin(state.yaw) * rSpeed;
        targetVz = Math.cos(state.yaw) * rSpeed;
      }

      const curSpeed = Math.hypot(state.vx, state.vz);

      // Detect crisp 180° athletic pivot-plant when reversing sharply from a fast jog/sprint!
      if (state.grounded && !state.swimming && !rollingNow && !lockedControl && hasInput && curSpeed > 4.6 && pivotTimer <= 0) {
        const dotDir = (state.vx * inputDirX + state.vz * inputDirZ) / curSpeed;
        if (dotDir < -0.58) {
          pivotTimer = 0.20;
          fxOut.scuff = true;
        }
      }

      // Explosive sprint push-off burst lean when launching from standstill / slow walk into sprint!
      const pushingOff = state.grounded && !state.swimming && hasInput && isSprinting && curSpeed < 6.8;
      startBlend += ((pushingOff ? 1 : 0) - startBlend) * (1 - Math.exp(-dt * (pushingOff ? 11 : 7)));

      // Frame-rate-independent critically-damped momentum (snappy responsive feel with grounded weight!)
      const accelRate = lockedControl
        ? 4.0
        : state.swimming
        ? 4.8
        : rollingNow
        ? 12.0
        : state.grounded
        ? pivotTimer > 0
          ? 14.5
          : hasInput
          ? isSprinting
            ? 7.8
            : isWalking
            ? 12.0
            : 10.2
          : curSpeed > 6.0
          ? 8.8
          : 12.8
        : 3.2;
      const damp = 1 - Math.exp(-accelRate * dt);
      state.vx += (targetVx - state.vx) * damp;
      state.vz += (targetVz - state.vz) * damp;
      if (!hasInput && !rollingNow && Math.hypot(state.vx, state.vz) < 0.06) {
        state.vx = 0;
        state.vz = 0;
      }

      const horizSpeed = Math.hypot(state.vx, state.vz);
      // Detect crisp sprint hard-stop braking OR 180° pivot plant for athletic GTA skid-stop!
      const isBrakingHard =
        state.grounded &&
        !state.swimming &&
        !rollingNow &&
        !lockedControl &&
        (pivotTimer > 0 || (prevHorizSpeed > 5.8 && horizSpeed < prevHorizSpeed - 0.10 && !hasInput));
      if (isBrakingHard && !wasBrakingHard && horizSpeed > 3.2) {
        fxOut.scuff = true;
      }
      wasBrakingHard = isBrakingHard;
      brakeBlend += ((isBrakingHard ? 1 : 0) - brakeBlend) * (1 - Math.exp(-dt * (isBrakingHard ? 16 : 9)));
      prevHorizSpeed = horizSpeed;

      // Smooth heading alignment with true angular-rate tracking for organic athletic corner banking!
      if (!lockedControl && !rollingNow && (horizSpeed > 0.25 || hasInput)) {
        const aimVx = hasInput && pivotTimer > 0 ? inputDirX : state.vx;
        const aimVz = hasInput && pivotTimer > 0 ? inputDirZ : state.vz;
        if (Math.hypot(aimVx, aimVz) > 0.05) {
          const targetYaw = Math.atan2(aimVx, aimVz);
          let diff = targetYaw - state.yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnRate = state.swimming ? 5.5 : pivotTimer > 0 ? 15.0 : isSprinting ? 8.8 : isWalking ? 11.5 : 11.2;
          const step = diff * (1 - Math.exp(-turnRate * dt));
          state.yaw += step;
          yawRate = dt > 0.0001 ? step / dt : 0;
        }
      }

      const prevX = state.x;
      const prevZ = state.z;

      // Coyote-time jump, Parkour vault boost & Lake shore climb-out!
      if (state.grounded) coyoteTimer = 0.14;
      else coyoteTimer = Math.max(0, coyoteTimer - dt);

      if (keys.Space && !lockedControl && !rollingNow) {
        if (state.swimming) {
          const fx = Math.sin(state.yaw);
          const fz = Math.cos(state.yaw);
          if (!isWater(state.x + fx * 2.2, state.z + fz * 2.2)) {
            state.vy = 9.2;
            state.vx = fx * 4.5;
            state.vz = fz * 4.5;
            state.swimming = false;
            state.grounded = false;
            fxOut.jump = true;
          }
        } else if (coyoteTimer > 0) {
          const fx = Math.sin(state.yaw);
          const fz = Math.cos(state.yaw);
          const nearFront = queryColliders(state.x + fx * 0.9, state.z + fz * 0.9);
          let vaulting = false;
          for (let i = 0; i < nearFront.length; i++) {
            const c = nearFront[i];
            if (c.walkableTop && c.maxY > state.y + 0.3 && c.maxY < state.y + 1.45) {
              vaulting = true;
              break;
            }
          }
          state.vy = vaulting ? 9.8 : 8.6;
          if (vaulting) {
            state.vx += fx * 2.8;
            state.vz += fz * 2.8;
          }
          crouchToggled = false;
          state.grounded = false;
          coyoteTimer = 0;
          fxOut.jump = true;
        }
      }

      if (state.swimming) {
        // Buoyant lake surface float (head & shoulders cleanly above Lac Léman!)
        const swimSurfaceY = -0.84;
        state.y += (swimSurfaceY - state.y) * Math.min(1, dt * 8);
        state.vy = 0;
        state.grounded = false;
      } else {
        state.vy = Math.max(-42, state.vy - 23.5 * dt);
        state.y += state.vy * dt;
      }

      // Swept sub-stepped movement + 3-pass solid collision resolution (ZERO tunneling through thin walls, benches, café tables or cars!)
      const playerRadius = 0.48;
      const moveDist = Math.hypot(state.vx * dt, state.vz * dt);
      const pSteps = Math.max(1, Math.min(5, Math.ceil(moveDist / 0.28)));
      const pdt = dt / pSteps;
      let floorY = getGroundHeight(state.x, state.z) + 0.16;
      if (isWater(state.x, state.z)) floorY = -0.86;

      for (let ps = 0; ps < pSteps; ps++) {
        const clamped = clampToWorld(state.x + state.vx * pdt, state.z + state.vz * pdt);
        if (state.grounded && isWalking && !state.swimming && isWater(clamped.x, clamped.z) && !isWater(prevX, prevZ)) {
          state.vx = 0;
          state.vz = 0;
        } else {
          state.x = clamped.x;
          state.z = clamped.z;
        }

        const gHere = isWater(state.x, state.z) ? -0.86 : getGroundHeight(state.x, state.z) + 0.16;
        if (ps === pSteps - 1) floorY = gHere;

        for (let iter = 0; iter < 3; iter++) {
          const near = queryColliders(state.x, state.z);
          for (let i = 0; i < near.length; i++) {
            const res = resolveCircleAgainstCollider(state.x, state.y, state.z, playerRadius, near[i], true);
            if (res.floorY > floorY) floorY = res.floorY;
            if (res.hit) {
              state.x = res.x;
              state.z = res.z;
              const vn = state.vx * res.nx + state.vz * res.nz;
              if (vn < 0) {
                state.vx -= res.nx * vn;
                state.vz -= res.nz * vn;
              }
            }
          }
          for (let i = 0; i < dynamicColliders.length; i++) {
            const dc = dynamicColliders[i];
            const res = resolveCircleAgainstCollider(state.x, state.y, state.z, playerRadius, dc, dc.walkableTop !== false);
            if (res.floorY > floorY) floorY = res.floorY;
            if (res.hit) {
              state.x = res.x;
              state.z = res.z;
              // GTA Vehicle Knockdown: if hit by a moving Geneva car/bus on foot, tumble onto the asphalt & get back up!
              if (dc.isVehicle && (dc.speed || 0) > 4.2 && knockdownTimer <= 0 && !state.swimming) {
                if (triggerKnockdown(res.nx, res.nz, 9.2)) {
                  fxOut.impactSfx = 'hard';
                  fxOut.cameraShake = 0.22;
                  fxOut.toast = 'KNOCKED DOWN!';
                }
              } else {
                const vn = state.vx * res.nx + state.vz * res.nz;
                if (vn < 0) {
                  state.vx -= res.nx * vn;
                  state.vz -= res.nz * vn;
                }
              }
            }
          }
        }
      }

      if (!state.swimming) {
        if (state.y <= floorY) {
          // Track landing impact severity when touching down after a jump or rooftop/helicopter fall!
          if (!wasGrounded && maxFallSpeed > 4.5) {
            if (maxFallSpeed > 22.5) {
              // Massive rooftop / helicopter drop -> Dramatic Hard Fall Knockdown + Push-Up Recovery!
              triggerKnockdown(Math.sin(state.yaw), Math.cos(state.yaw), 3.2);
              fxOut.impactSfx = 'hard';
              fxOut.cameraShake = 0.28;
              fxOut.toast = 'HARD LANDING!';
            } else if (maxFallSpeed > 13.5) {
              // Medium-high rooftop drop -> Automatic 360° Parkour Combat Roll!
              rollTimer = ROLL_DUR;
              const fx = Math.sin(state.yaw);
              const fz = Math.cos(state.yaw);
              state.vx = fx * 7.2;
              state.vz = fz * 7.2;
              fxOut.impactSfx = 'roll';
              fxOut.cameraShake = 0.13;
              fxOut.toast = 'PARKOUR LANDING ROLL';
            } else {
              // Normal jump -> crisp shock-absorbing knee landing squat!
              landBlend = Math.min(1.0, maxFallSpeed / 12.0);
              fxOut.impactSfx = 'soft';
            }
          }
          if (state.grounded && floorY - state.y < 0.6) {
            state.y += (floorY - state.y) * Math.min(1, dt * 22);
          } else {
            state.y = floorY;
          }
          state.vy = 0;
          state.grounded = true;
          fallTime = 0;
          maxFallSpeed = 0;
        } else if (state.y - floorY > 0.28) {
          state.grounded = false;
          if (state.vy < -1.0) {
            fallTime += dt;
            if (-state.vy > maxFallSpeed) maxFallSpeed = -state.vy;
          }
        }
      }

      // Smooth crouch & landing recovery blends
      crouchBlend += ((isCrouching && state.grounded ? 1 : 0) - crouchBlend) * Math.min(1, dt * 11);
      landBlend = Math.max(0, landBlend - dt * 3.8);
    }

    // Drive full 12-state GTA skeletal animator with exact zero-foot-slide stride sync & heel-strike footsteps!
    idleClock += dt;
    const speed = Math.hypot(state.vx, state.vz);
    const speedNorm = Math.min(1, speed / 9.2);

    // Smooth continuous 3-gait targets: Walk (< 3.1 m/s) <-> Jog (3.1..6.6 m/s) <-> Explosive Sprint (> 6.4 m/s)!
    const targetJog = !isCrouching && speed > 2.95 ? Math.min(1, (speed - 2.95) / 1.85) : 0;
    const targetSprint = !isCrouching && speed > 6.1 ? Math.min(1, (speed - 6.1) / 2.6) : 0;
    jogBlend += (targetJog - jogBlend) * (1 - Math.exp(-dt * 9.5));
    sprintBlend += (targetSprint - sprintBlend) * (1 - Math.exp(-dt * 8.5));
    airBlend += ((state.grounded || state.swimming ? 0 : 1) - airBlend) * (1 - Math.exp(-dt * 13));
    const isFreefalling = !state.grounded && !state.swimming && !state.hookTarget && (state.vy < -6.2 || fallTime > 0.42);
    fallBlend += ((isFreefalling ? 1 : 0) - fallBlend) * (1 - Math.exp(-dt * (isFreefalling ? 7 : 12)));
    hookBlend += ((state.hookTarget ? 1 : 0) - hookBlend) * (1 - Math.exp(-dt * 14));
    swimBlend += ((state.swimming ? 1 : 0) - swimBlend) * (1 - Math.exp(-dt * 9));

    // Smooth angular-velocity corner banking (proportional to turn sharpness & speed — zero flicker!)
    const targetLean = Math.max(-1, Math.min(1, yawRate * 0.24)) * Math.min(1, speed / 5.2);
    turnLean += (targetLean - turnLean) * (1 - Math.exp(-dt * 9.5));

    // Exact biomechanical stride-length sync (ZERO foot sliding at ANY speed from crouch -> walk -> jog -> sprint!)
    // One full 2*PI cycle = 2 steps (Left + Right). Stride length scales naturally with gait!
    const groundedMoving = speed > 0.18 && state.grounded && !state.swimming && rollTimer <= 0 && knockdownTimer <= 0;
    if (groundedMoving) {
      const strideCycleMeters =
        isCrouching
          ? 1.18
          : 1.38 * (1 - jogBlend) + (2.38 * (1 - sprintBlend) + 3.45 * sprintBlend) * jogBlend;
      const dPhase = (speed / Math.max(0.9, strideCycleMeters)) * Math.PI * 2 * dt;
      gaitPhase += dPhase;

      // Exact heel-strike detection at gaitPhase = PI/2 (Left heel) and 3*PI/2 (Right heel)!
      const shiftedHalf = Math.floor((gaitPhase - Math.PI * 0.5) / Math.PI);
      if (shiftedHalf !== lastFootstepHalf && brakeBlend < 0.55) {
        lastFootstepHalf = shiftedHalf;
        const foot = (shiftedHalf & 1) === 0 ? 'L' : 'R';
        const kind = isCrouching ? 'crouch' : sprintBlend > 0.45 ? 'sprint' : jogBlend > 0.45 ? 'jog' : 'walk';
        const intensity = Math.min(1, 0.28 + speedNorm * 0.72);
        fxOut.footstep = { foot, kind, intensity };
      }
    } else if (state.grounded && rollTimer <= 0 && knockdownTimer <= 0) {
      // Gently settle gaitPhase toward neutral upright rest when stopping so legs don't freeze awkwardly mid-air!
      const nearestNeutral = Math.round(gaitPhase / Math.PI) * Math.PI;
      gaitPhase += (nearestNeutral - gaitPhase) * (1 - Math.exp(-dt * 8));
      lastFootstepHalf = Math.floor((gaitPhase - Math.PI * 0.5) / Math.PI);
    }

    // Subtle head look toward camera look direction
    let headLook = (cameraYaw + Math.PI) - state.yaw;
    while (headLook > Math.PI) headLook -= Math.PI * 2;
    while (headLook < -Math.PI) headLook += Math.PI * 2;
    headLook = Math.max(-0.7, Math.min(0.7, headLook));

    // Export lightweight live locomotion state for smooth camera stride micro-bob & crouch eye-drop
    locoOut.gaitPhase = gaitPhase;
    locoOut.speed = speed;
    locoOut.speedNorm = speedNorm;
    locoOut.jogBlend = jogBlend;
    locoOut.sprintBlend = sprintBlend;
    locoOut.crouchBlend = crouchBlend;
    locoOut.landBlend = landBlend;
    locoOut.turnLean = turnLean;
    locoOut.grounded = state.grounded && !state.swimming;
    locoOut.walkMode = walkToggled;

    if (animator) {
      animator.applyPose({
        gaitPhase,
        speedNorm,
        jogBlend,
        sprintBlend,
        startBlend,
        airBlend,
        vy: state.vy,
        fallBlend,
        landBlend,
        crouchBlend,
        brakeBlend,
        hookBlend,
        swimBlend,
        rollProgress: rollTimer > 0 ? 1 - rollTimer / ROLL_DUR : 0,
        knockdownProgress: knockdownTimer > 0 ? 1 - knockdownTimer / KNOCKDOWN_DUR : 0,
        emote,
        emoteProgress: emoteTimer > 0 ? 1 - emoteTimer / emoteDur : 0,
        turnLean,
        headLookYaw: headLook,
        idleTime: idleClock,
      });
    }

    // Contact shadow fades smoothly when jumping/falling high or swimming!
    const heightAboveGround = Math.max(0, state.y - getGroundHeight(state.x, state.z));
    contactShadow.visible = visible && !state.swimming;
    contactShadow.material.opacity = state.grounded ? 0.78 : Math.max(0.06, 0.78 - heightAboveGround * 0.06);

    group.position.set(state.x, state.y, state.z);
    group.rotation.y = state.yaw;

    flashlight.intensity = state.flashlightOn ? 6.0 : 0;
    if (state.flashlightOn) {
      flashlight.position.set(state.x, state.y + 1.6, state.z);
      flashlight.target.position.set(
        state.x - Math.sin(cameraYaw) * 22,
        state.y + 0.5,
        state.z - Math.cos(cameraYaw) * 22
      );
    }

    return fxOut;
  }

  return {
    state,
    group,
    teleport,
    fireHook,
    triggerRoll,
    triggerKnockdown,
    toggleCrouch,
    toggleWalkMode,
    startInteraction,
    stopInteraction,
    isInteracting,
    getActiveInteraction,
    getLocomotionState,
    triggerEmote,
    updateScooterRider,
    updateTransitRider,
    update,
  };
}
