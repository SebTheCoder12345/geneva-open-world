import * as THREE from 'three';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_Z = new THREE.Vector3(0, 0, 1);

// Compute a node's orientation & position strictly relative to modelRoot (100% immune to group.rotation.y / scene placement!)
function getModelRelativeMatrix(node, modelRoot) {
  const chain = [];
  let cur = node;
  while (cur && cur !== modelRoot) {
    chain.push(cur);
    cur = cur.parent;
  }
  const m = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  for (let i = chain.length - 1; i >= 0; i--) {
    local.compose(chain[i].position, chain[i].quaternion, chain[i].scale);
    m.multiply(local);
  }
  return m;
}

function getModelRelativeQuaternion(node, modelRoot) {
  const chain = [];
  let cur = node;
  while (cur && cur !== modelRoot) {
    chain.push(cur);
    cur = cur.parent;
  }
  const q = new THREE.Quaternion();
  for (let i = chain.length - 1; i >= 0; i--) {
    q.multiply(chain[i].quaternion);
  }
  return q;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// Biomechanical Leg Cycle Solver (exact human walk / jog / sprint kinematics!)
// phase = 0: mid-swing passing forward | PI/2: foot strike | PI: mid-stance | 3*PI/2: toe-off triple-extension push!
function evalLegCycle(phase, walkW, jogW, sprintW, crouchW, out) {
  const s = Math.sin(phase);

  // 1. ASYMMETRIC THIGH DRIVE:
  //    - Walk: balanced compact urban stride
  //    - Jog: rhythmic mid-stride knee drive (no awkward high-stepping)
  //    - Sprint: explosive front-side high-knee drive + strong glute hip-extension back behind torso!
  const walkFwd = 0.43, walkBack = 0.35;
  const jogFwd = 0.72, jogBack = 0.50;
  const sprintFwd = 1.16, sprintBack = 0.68;

  const fwdAmp = (walkFwd * walkW + jogFwd * jogW + sprintFwd * sprintW) * (1 - crouchW * 0.28);
  const backAmp = (walkBack * walkW + jogBack * jogW + sprintBack * sprintW) * (1 - crouchW * 0.34);

  // Subtle 2nd-harmonic shaping creates crisp front-side knee snap & paw-back deceleration right before foot-strike!
  const shapedS = s + 0.11 * Math.sin(2 * phase) * (jogW * 0.55 + sprintW);
  const thigh = shapedS >= 0 ? -shapedS * fwdAmp : -shapedS * backAmp;

  // 2. DUAL-PEAK ATHLETIC KNEE FLEXION:
  //    Peak A (Swing recovery right after toe-off -> mid-swing): folds heel tightly toward glute in sprint (~114°!),
  //           moderate recovery fold in jog (~78°), clean toe-clearance in walk (~48°)!
  //    Peak B (Stance contact & weight-acceptance): lands with soft athletic knee cushion (~16°-22° in jog/sprint,
  //           avoiding stiff overstriding peg-leg!) then compresses smoothly through mid-stance!
  const swingBell = Math.pow(Math.max(0, Math.cos(phase + 0.32)), 1.38);
  const swingKneeAmp = (0.84 * walkW + 1.36 * jogW + 1.96 * sprintW) * (1 - crouchW * 0.22);

  // Soft landing shock-absorption cushion centered cleanly from initial contact (PI/2) through mid-stance (0.72*PI)
  const stanceBell = Math.pow(Math.max(0, Math.sin(phase - 0.38)), 1.95);
  const stanceKneeAmp = 0.18 * walkW + 0.42 * jogW + 0.52 * sprintW;

  // Soft base knee readiness during running so landing knee NEVER locks straight!
  const runSoftKnee = 0.05 + 0.08 * jogW + 0.10 * sprintW;
  const knee = runSoftKnee + swingBell * swingKneeAmp + stanceBell * stanceKneeAmp;

  // 3. REALISTIC ANKLE ROLL + FOREFOOT TOE-OFF (LeftFoot / LeftToeBase):
  //    - Walk: clean heel-first dorsiflexion (-X) at contact -> flat sole -> strong push-off (+X)
  //    - Jog/Sprint: athletic mid-foot / ball-of-foot strike (minimal heel slap) -> elastic calf triple-extension push-off!
  const heelStrike = Math.pow(Math.max(0, Math.sin(phase + 0.22)), 2.0);
  const toeOff = Math.pow(Math.max(0, -Math.sin(phase - 0.26)), 1.75);
  const swingDorsi = swingBell * (0.06 * walkW - 0.08 * jogW - 0.16 * sprintW);

  const foot =
    -heelStrike * (0.24 * walkW + 0.06 * jogW - 0.06 * sprintW) +
    toeOff * (0.44 * walkW + 0.58 * jogW + 0.74 * sprintW) +
    swingDorsi;

  // Natural Chicago sneaker forefoot bend as heel lifts off the granite pavers during push-off!
  const toe = -toeOff * (0.48 * walkW + 0.60 * jogW + 0.70 * sprintW);

  out.thigh = thigh;
  out.knee = knee;
  out.foot = foot;
  out.toe = toe;
}

// Mathematically exact Model-Space + Anatomical Arm-Plane Skeletal Animator for ReadyPlayerMe / Mixamo Y-up humans
// Pure Model Space: +X = character's left, +Y = up, +Z = forward
// Auto-neutralizes each rig's A-pose / T-pose arm angles & rest elbow bend at init so shoulder swings stay
// strictly sagittal and elbows fold cleanly forward/inward ("cheek-to-hip") with ZERO chicken-wing flare!
export function createHumanAnimator(modelRoot) {
  const bones = {};
  const restLocal = {};
  const restParentModel = {};
  const invRestParentModel = {};
  const restModelPos = {};

  modelRoot.traverse((obj) => {
    if (obj.isBone) {
      bones[obj.name] = obj;
      restLocal[obj.name] = obj.quaternion.clone();
      const pm = obj.parent ? getModelRelativeQuaternion(obj.parent, modelRoot) : new THREE.Quaternion();
      restParentModel[obj.name] = pm;
      invRestParentModel[obj.name] = pm.clone().invert();
      const mat = getModelRelativeMatrix(obj, modelRoot);
      restModelPos[obj.name] = new THREE.Vector3().setFromMatrixPosition(mat);
    }
  });

  // Precompute exact A-pose/T-pose neutralization quaternions for Left & Right arms directly from rest bone vectors!
  const armNeutral = {};
  const invArmNeutral = {};
  const foreNeutral = {};
  const DOWN_VEC = new THREE.Vector3(0, -1, 0);

  for (const side of ['Left', 'Right']) {
    const armN = `${side}Arm`;
    const foreN = `${side}ForeArm`;
    const handN = `${side}Hand`;
    if (bones[armN] && bones[foreN] && bones[handN]) {
      const uDir = restModelPos[foreN].clone().sub(restModelPos[armN]).normalize();
      const fDir = restModelPos[handN].clone().sub(restModelPos[foreN]).normalize();

      // 1. Bring rest upper arm cleanly to vertical hang (0, -1, 0)
      const qU = new THREE.Quaternion().setFromUnitVectors(uDir, DOWN_VEC);
      // 2. Align the natural anatomical elbow bend plane cleanly with +Z (pure forward sagittal plane!)
      const fAfterU = fDir.clone().applyQuaternion(qU);
      const horizLen = Math.hypot(fAfterU.x, fAfterU.z);
      const twistY = horizLen > 0.05 ? -Math.atan2(fAfterU.x, fAfterU.z) : 0;
      const qAlignPlane = new THREE.Quaternion().setFromAxisAngle(AXIS_Y, twistY);
      const qArmN = qAlignPlane.multiply(qU);

      // 3. Remove rest-pose elbow pre-bend (~26°) so elbowBend=0 is dead straight and elbowBend=PI/2 is an EXACT 90° bend!
      const fAfterArm = fDir.clone().applyQuaternion(qArmN);
      const qForeN = new THREE.Quaternion().setFromUnitVectors(fAfterArm, DOWN_VEC);

      armNeutral[side] = qArmN;
      invArmNeutral[side] = qArmN.clone().invert();
      foreNeutral[side] = qForeN;
    }
  }

  // Pre-collect finger & thumb bones (zero per-frame string allocations!) for natural relaxed hands -> athletic runner fists!
  const fingerBones = [];
  const leftThumbBones = [];
  const rightThumbBones = [];
  const fingerNames = ['Index', 'Middle', 'Ring', 'Pinky'];
  const segWeights = [0.85, 1.05, 0.72];
  for (const fn of fingerNames) {
    for (let si = 0; si < 3; si++) {
      const seg = String(si + 1);
      const lb = `LeftHand${fn}${seg}`;
      const rb = `RightHand${fn}${seg}`;
      if (bones[lb]) fingerBones.push({ name: lb, w: segWeights[si] });
      if (bones[rb]) fingerBones.push({ name: rb, w: segWeights[si] });
    }
  }
  for (const seg of ['2', '3']) {
    if (bones[`LeftHandThumb${seg}`]) leftThumbBones.push(`LeftHandThumb${seg}`);
    if (bones[`RightHandThumb${seg}`]) rightThumbBones.push(`RightHandThumb${seg}`);
  }

  const qModel = new THREE.Quaternion();
  const qPart = new THREE.Quaternion();
  const qArmSwing = new THREE.Quaternion();
  const qArmAbd = new THREE.Quaternion();
  const qArmTwist = new THREE.Quaternion();
  const qArmModel = new THREE.Quaternion();
  const qForeBend = new THREE.Quaternion();
  const qForePron = new THREE.Quaternion();
  const qForeModel = new THREE.Quaternion();
  const qCurlTmp = new THREE.Quaternion();
  const qThumbTmp = new THREE.Quaternion();
  const legL = { thigh: 0, knee: 0, foot: 0, toe: 0 };
  const legR = { thigh: 0, knee: 0, foot: 0, toe: 0 };

  // Apply exact rotation (rx, ry, rz) in pure character Model Space (+X left, +Y up, +Z forward)
  function setModelRot(name, rx = 0, ry = 0, rz = 0) {
    const b = bones[name];
    if (!b) return;
    qModel.identity();
    if (ry !== 0) {
      qPart.setFromAxisAngle(AXIS_Y, ry);
      qModel.multiply(qPart);
    }
    if (rz !== 0) {
      qPart.setFromAxisAngle(AXIS_Z, rz);
      qModel.multiply(qPart);
    }
    if (rx !== 0) {
      qPart.setFromAxisAngle(AXIS_X, rx);
      qModel.multiply(qPart);
    }
    // Transform pure model-space rotation into bone-local space: inv(P_model) * Q_model * P_model * Q_rest
    b.quaternion
      .copy(invRestParentModel[name])
      .multiply(qModel)
      .multiply(restParentModel[name])
      .multiply(restLocal[name]);
  }

  // Exact Anatomical Arm Kinematics (ZERO A-pose cross-coupling, ZERO chicken-wing flare!):
  //   swingPitch: sagittal shoulder drive (- = forward toward chin/chest, + = backward past hip)
  //   abduct: outward ribcage clearance in radians (+ = clears ribs cleanly on both Left & Right)
  //   inwardTwist: humeral internal rotation (+ = directs bent forearm cleanly inward toward sternum/chin!)
  //   elbowBend: TRUE anatomical elbow flexion in radians (0 = dead straight, PI/2 = exact 90° forward!)
  //   forePronate: subtle forearm rotation (+ = palm turns more downward, - = more thumb-up/inward)
  function setAnatomicalArm(side, swingPitch, abduct, inwardTwist, elbowBend, forePronate = 0) {
    const armN = `${side}Arm`;
    const foreN = `${side}ForeArm`;
    const qNeutralA = armNeutral[side];
    const invNeutralA = invArmNeutral[side];
    const qNeutralF = foreNeutral[side];
    if (!qNeutralA || !qNeutralF || !bones[armN] || !bones[foreN]) return;

    const sgn = side === 'Left' ? 1 : -1;

    // 1. Upper Arm: neutralize A-pose -> internal hinge twist -> ribcage clearance -> pure sagittal swing!
    qArmTwist.setFromAxisAngle(AXIS_Y, -sgn * inwardTwist);
    qArmAbd.setFromAxisAngle(AXIS_Z, sgn * abduct);
    qArmSwing.setFromAxisAngle(AXIS_X, swingPitch);

    qArmModel.copy(qArmSwing).multiply(qArmAbd).multiply(qArmTwist).multiply(qNeutralA);
    bones[armN].quaternion
      .copy(invRestParentModel[armN])
      .multiply(qArmModel)
      .multiply(restParentModel[armN])
      .multiply(restLocal[armN]);

    // 2. Forearm: exact anatomical hinge bend + pronation strictly in the neutralized upper-arm frame!
    qForeBend.setFromAxisAngle(AXIS_X, -elbowBend);
    qForePron.setFromAxisAngle(AXIS_Y, -sgn * forePronate);
    qForeModel.copy(invNeutralA).multiply(qForeBend).multiply(qForePron).multiply(qNeutralF).multiply(qNeutralA);

    bones[foreN].quaternion
      .copy(invRestParentModel[foreN])
      .multiply(qForeModel)
      .multiply(restParentModel[foreN])
      .multiply(restLocal[foreN]);
  }

  // Curl fingers smoothly into the palm on their TRUE anatomical bone-local +X flexion axis + tuck thumbs naturally!
  function setFingerCurl(curlAmt) {
    if (fingerBones.length === 0) return;
    const c = clamp01(curlAmt);
    for (let i = 0; i < fingerBones.length; i++) {
      const fb = fingerBones[i];
      qCurlTmp.setFromAxisAngle(AXIS_X, c * fb.w * 1.15);
      bones[fb.name].quaternion.copy(restLocal[fb.name]).multiply(qCurlTmp);
    }
    const thumbCurl = c * 0.52;
    qCurlTmp.setFromAxisAngle(AXIS_X, -thumbCurl);
    qThumbTmp.setFromAxisAngle(AXIS_Z, -thumbCurl * 0.42);
    qCurlTmp.multiply(qThumbTmp);
    for (let i = 0; i < leftThumbBones.length; i++) {
      const n = leftThumbBones[i];
      bones[n].quaternion.copy(restLocal[n]).multiply(qCurlTmp);
    }
    qCurlTmp.setFromAxisAngle(AXIS_X, -thumbCurl);
    qThumbTmp.setFromAxisAngle(AXIS_Z, thumbCurl * 0.42);
    qCurlTmp.multiply(qThumbTmp);
    for (let i = 0; i < rightThumbBones.length; i++) {
      const n = rightThumbBones[i];
      bones[n].quaternion.copy(restLocal[n]).multiply(qCurlTmp);
    }
  }

  function resetRootTransform() {
    modelRoot.position.set(0, 0, 0);
    modelRoot.rotation.set(0, 0, 0);
  }

  // Full AAA 12-State Blended GTA Character Animation Controller!
  // Supports: Contrapposto Alive Idle, Natural Urban Walk, Athletic Jog, Explosive Sprint,
  //           Start-Burst Push-Off, Sprint Brake/Pivot Plant, Turn Banking, Crouch/Sneak,
  //           3-Phase Jump/Apex/Freefall Flail, Impact Landing Squat, 360° Parkour Roll,
  //           Knockdown & Get-Up, Grapple Zip, Swim/Tread, & 4 Emotes!
  function applyPose({
    gaitPhase = 0,
    speedNorm = 0,
    sprintBlend = 0,
    jogBlend = null,
    startBlend = 0,
    airBlend = 0,
    vy = 0,
    fallBlend = 0,
    landBlend = 0,
    crouchBlend = 0,
    brakeBlend = 0,
    hookBlend = 0,
    swimBlend = 0,
    rollProgress = 0,
    knockdownProgress = 0,
    emote = null,
    emoteProgress = 0,
    turnLean = 0,
    headLookYaw = 0,
    idleTime = 0,
  }) {
    resetRootTransform();

    // -------------------------------------------------------------------------
    // PRIORITY 1: HARD FALL / VEHICLE HIT KNOCKDOWN & GET-UP RECOVERY!
    // -------------------------------------------------------------------------
    if (knockdownProgress > 0.001 && knockdownProgress < 1.0) {
      const p = knockdownProgress;
      if (p < 0.28) {
        const t = p / 0.28;
        const e = 1 - (1 - t) * (1 - t);
        modelRoot.rotation.x = -e * Math.PI * 0.48;
        modelRoot.rotation.z = Math.sin(t * Math.PI) * 0.24;
        modelRoot.position.y = 0.16 + Math.sin(t * Math.PI) * 0.34;
        setModelRot('Hips', 0.12 * e, 0, 0);
        setModelRot('Spine', -0.22 * e, 0, 0);
        setModelRot('Spine1', -0.15 * e, 0, 0);
        setModelRot('Neck', 0.15 * e, 0, 0);
        setModelRot('Head', 0.22 * e, Math.sin(p * 18) * 0.15, 0);
        setModelRot('LeftUpLeg', -0.45 * (1 - e * 0.5), 0.16, 0.14);
        setModelRot('RightUpLeg', -0.28 * (1 - e * 0.4), -0.18, -0.14);
        setModelRot('LeftLeg', 0.55 * (1 - e * 0.6), 0, 0);
        setModelRot('RightLeg', 0.38 * (1 - e * 0.5), 0, 0);
        setModelRot('LeftArm', -1.25 * e, -0.2, -0.18);
        setModelRot('RightArm', -1.05 * e, 0.25, 0.14);
        setModelRot('LeftForeArm', -0.45, 0, 0);
        setModelRot('RightForeArm', -0.52, 0, 0);
      } else if (p < 0.56) {
        const t = (p - 0.28) / 0.28;
        const twitch = Math.sin(t * Math.PI * 3) * 0.04;
        modelRoot.rotation.x = -Math.PI * 0.48;
        modelRoot.position.y = 0.16;
        setModelRot('Hips', 0.08, 0, 0);
        setModelRot('Spine', -0.06 + twitch, 0, 0);
        setModelRot('Neck', 0.08, 0, 0);
        setModelRot('Head', 0.18, Math.sin(t * Math.PI * 2) * 0.26, 0);
        setModelRot('LeftUpLeg', -0.18, 0.18, 0.16);
        setModelRot('RightUpLeg', -0.08, -0.22, -0.18);
        setModelRot('LeftLeg', 0.32, 0, 0);
        setModelRot('RightLeg', 0.18, 0, 0);
        setModelRot('LeftArm', -0.32, -0.3, -0.12);
        setModelRot('RightArm', -0.24, 0.35, 0.10);
        setModelRot('LeftForeArm', -0.25, 0, 0);
        setModelRot('RightForeArm', -0.35, 0, 0);
      } else {
        const t = (p - 0.56) / 0.44;
        const s = t * t * (3 - 2 * t);
        const kneelPeak = Math.sin(t * Math.PI);
        modelRoot.rotation.x = -Math.PI * 0.48 * (1 - s);
        modelRoot.position.y = 0.16 * (1 - s) - kneelPeak * 0.28;
        setModelRot('Hips', 0.12 * kneelPeak, 0, 0);
        setModelRot('Spine', 0.45 * kneelPeak, 0, 0);
        setModelRot('Spine1', 0.25 * kneelPeak, 0, 0);
        setModelRot('Neck', -0.12 * kneelPeak, 0, 0);
        setModelRot('Head', -0.22 * kneelPeak, 0, 0);
        setModelRot('LeftUpLeg', -1.05 * kneelPeak, 0.08, 0);
        setModelRot('LeftLeg', 1.45 * kneelPeak, 0, 0);
        setModelRot('RightUpLeg', -0.45 * kneelPeak, -0.08, 0);
        setModelRot('RightLeg', 1.25 * kneelPeak, 0, 0);
        setModelRot('LeftArm', -0.65 * kneelPeak, -0.15, -0.34);
        setModelRot('RightArm', -0.82 * kneelPeak, 0.15, 0.34);
        setModelRot('LeftForeArm', -0.45 * kneelPeak, 0, 0);
        setModelRot('RightForeArm', -0.38 * kneelPeak, 0, 0);
      }
      return;
    }

    // -------------------------------------------------------------------------
    // PRIORITY 2: 360° PARKOUR FORWARD COMBAT ROLL (Hard Drop or Press G!)
    // -------------------------------------------------------------------------
    if (rollProgress > 0.001 && rollProgress < 1.0) {
      const r = rollProgress;
      const tuck = Math.sin(r * Math.PI);
      modelRoot.rotation.x = r * Math.PI * 2;
      modelRoot.rotation.z = tuck * 0.24;
      modelRoot.position.y = 0.52 * tuck;
      setModelRot('Hips', 0.25 * tuck, 0.14 * tuck, 0);
      setModelRot('Spine', 0.68 * tuck, 0, 0);
      setModelRot('Spine1', 0.52 * tuck, 0, 0);
      setModelRot('Neck', 0.22 * tuck, 0, 0);
      setModelRot('Head', 0.28 * tuck, -0.18 * tuck, 0);
      setModelRot('LeftUpLeg', -1.45 * tuck, 0.08, 0);
      setModelRot('RightUpLeg', -1.35 * tuck, -0.08, 0);
      setModelRot('LeftLeg', 1.95 * tuck, 0, 0);
      setModelRot('RightLeg', 1.85 * tuck, 0, 0);
      setModelRot('LeftArm', -1.25 * tuck, -0.35, -0.28);
      setModelRot('RightArm', -1.35 * tuck, 0.35, 0.28);
      setModelRot('LeftForeArm', -1.15 * tuck, 0, 0);
      setModelRot('RightForeArm', -1.15 * tuck, 0, 0);
      setFingerCurl(0.65 * tuck);
      return;
    }

    // -------------------------------------------------------------------------
    // PRIORITY 3: EXPRESSIVE EMOTES (1 Wave, 2 Cheer, 3 Backflip, 4 Watch Check)
    // -------------------------------------------------------------------------
    if (emote && emoteProgress > 0.001 && emoteProgress < 1.0) {
      const p = emoteProgress;
      if (emote === 'backflip') {
        if (p < 0.18) {
          const t = p / 0.18;
          modelRoot.position.y = -0.32 * t;
          setModelRot('Spine', 0.42 * t, 0, 0);
          setModelRot('LeftUpLeg', -0.92 * t, 0, 0);
          setModelRot('RightUpLeg', -0.92 * t, 0, 0);
          setModelRot('LeftLeg', 1.48 * t, 0, 0);
          setModelRot('RightLeg', 1.48 * t, 0, 0);
          setModelRot('LeftArm', 0.72 * t, 0, -0.38);
          setModelRot('RightArm', 0.72 * t, 0, 0.38);
        } else if (p < 0.84) {
          const t = (p - 0.18) / 0.66;
          const arc = Math.sin(t * Math.PI);
          modelRoot.position.y = arc * 1.45;
          modelRoot.rotation.x = -t * Math.PI * 2;
          setModelRot('Spine', -0.25 * (1 - arc) + 0.55 * arc, 0, 0);
          setModelRot('Head', -0.35 * arc, 0, 0);
          setModelRot('LeftUpLeg', -1.45 * arc, 0.08, 0);
          setModelRot('RightUpLeg', -1.45 * arc, -0.08, 0);
          setModelRot('LeftLeg', 1.95 * arc, 0, 0);
          setModelRot('RightLeg', 1.95 * arc, 0, 0);
          setModelRot('LeftArm', -1.45 * arc, -0.25, -0.25);
          setModelRot('RightArm', -1.45 * arc, 0.25, 0.25);
          setModelRot('LeftForeArm', -0.95 * arc, 0, 0);
          setModelRot('RightForeArm', -0.95 * arc, 0, 0);
        } else {
          const t = 1 - (p - 0.84) / 0.16;
          modelRoot.position.y = -0.28 * t;
          setModelRot('Spine', 0.28 * t, 0, 0);
          setModelRot('LeftUpLeg', -0.78 * t, 0.1, 0);
          setModelRot('RightUpLeg', -0.78 * t, -0.1, 0);
          setModelRot('LeftLeg', 1.25 * t, 0, 0);
          setModelRot('RightLeg', 1.25 * t, 0, 0);
          setModelRot('LeftArm', -0.35 * t, 0, -0.28);
          setModelRot('RightArm', -0.35 * t, 0, 0.28);
        }
        return;
      }
      if (emote === 'wave') {
        const env = Math.sin(Math.min(1, p * 4) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - p) * 4) * Math.PI * 0.5);
        const wag = Math.sin(p * Math.PI * 7) * 0.36;
        setModelRot('Hips', 0, -0.08 * env, 0.04 * env);
        setModelRot('Spine', -0.04 * env, 0.12 * env, -0.06 * env);
        setModelRot('Head', -0.06 * env, headLookYaw * 0.35, 0.08 * env);
        setModelRot('LeftArm', 0.08, 0, -0.52);
        setModelRot('LeftForeArm', -0.18, 0, 0);
        setModelRot('RightArm', -2.35 * env, 0.15 * env, (0.35 - 0.55 * env) + wag * 0.35);
        setModelRot('RightForeArm', -0.45 * env, 0, -0.25 * env + wag);
        setModelRot('LeftUpLeg', -0.04, 0, 0);
        setModelRot('RightUpLeg', 0.04, 0, 0);
        setModelRot('LeftLeg', 0.05, 0, 0);
        setModelRot('RightLeg', 0.05, 0, 0);
        setFingerCurl(0.12);
        return;
      }
      if (emote === 'cheer') {
        const hop = Math.max(0, Math.sin(p * Math.PI * 3)) * 0.24;
        const pump = Math.sin(p * Math.PI * 6) * 0.28;
        const env = Math.sin(p * Math.PI);
        modelRoot.position.y = hop;
        setModelRot('Spine', -0.12 * env, 0, 0);
        setModelRot('Head', -0.18 * env, 0, 0);
        setModelRot('LeftArm', -2.45 * env + pump, -0.18, -0.12);
        setModelRot('RightArm', -2.45 * env - pump, 0.18, 0.12);
        setModelRot('LeftForeArm', -0.55 * env, 0, 0);
        setModelRot('RightForeArm', -0.55 * env, 0, 0);
        setModelRot('LeftUpLeg', -0.25 * hop * 2, 0.08, 0);
        setModelRot('RightUpLeg', -0.25 * hop * 2, -0.08, 0);
        setModelRot('LeftLeg', 0.45 * hop * 2, 0, 0);
        setModelRot('RightLeg', 0.45 * hop * 2, 0, 0);
        setFingerCurl(0.8 * env);
        return;
      }
      if (emote === 'watch') {
        const env = Math.sin(Math.min(1, p * 4) * Math.PI * 0.5) * Math.sin(Math.min(1, (1 - p) * 4) * Math.PI * 0.5);
        const nod = Math.sin(p * Math.PI * 4) * 0.08 * env;
        setModelRot('Spine', 0.08 * env, -0.14 * env, 0);
        setModelRot('Head', 0.34 * env + nod, 0.28 * env, 0.08 * env);
        setModelRot('LeftArm', -0.72 * env, -0.42 * env, -0.40);
        setModelRot('LeftForeArm', -1.45 * env, 0.45 * env, 0);
        setModelRot('RightArm', 0.05, 0, 0.52);
        setModelRot('RightForeArm', -0.22, 0, 0);
        setModelRot('LeftUpLeg', -0.04, 0, 0);
        setModelRot('RightUpLeg', 0.04, 0, 0);
        setModelRot('LeftLeg', 0.05, 0, 0);
        setModelRot('RightLeg', 0.05, 0, 0);
        setFingerCurl(0.22);
        return;
      }
    }

    // -------------------------------------------------------------------------
    // PRIORITY 4: LAC LÉMAN SWIMMING & TREADING WATER!
    // -------------------------------------------------------------------------
    if (swimBlend > 0.05) {
      const swimMove = Math.min(1, speedNorm * 1.8);
      const swPhase = idleTime * (swimMove > 0.2 ? 5.6 : 2.8);
      const s = Math.sin(swPhase);
      const c = Math.cos(swPhase);
      modelRoot.rotation.x = swimBlend * swimMove * 1.24;
      modelRoot.position.y = Math.sin(idleTime * 2.6) * 0.055;
      const roll = s * 0.26 * swimMove;
      setModelRot('Hips', 0, 0, roll * 0.6);
      setModelRot('Spine', -0.12 * swimMove, s * 0.14 * swimMove, roll);
      setModelRot('Head', -0.95 * swimMove, headLookYaw * 0.35 + Math.max(0, s) * 0.32 * swimMove, 0);
      const lStroke = swimMove > 0.2 ? -1.45 + Math.sin(swPhase) * 1.35 : -0.45 + s * 0.25;
      const rStroke = swimMove > 0.2 ? -1.45 - Math.sin(swPhase) * 1.35 : -0.45 - s * 0.25;
      setModelRot('LeftArm', lStroke, -0.18, -0.22 - (1 - swimMove) * 0.25);
      setModelRot('RightArm', rStroke, 0.18, 0.22 + (1 - swimMove) * 0.25);
      setModelRot('LeftForeArm', -0.45 - Math.max(0, c) * 0.65 * swimMove, 0, 0);
      setModelRot('RightForeArm', -0.45 - Math.max(0, -c) * 0.65 * swimMove, 0, 0);
      const kick = Math.sin(swPhase * 2.0) * (0.28 + 0.14 * swimMove);
      setModelRot('LeftUpLeg', -0.18 * (1 - swimMove) + kick, 0, 0);
      setModelRot('RightUpLeg', -0.18 * (1 - swimMove) - kick, 0, 0);
      setModelRot('LeftLeg', 0.28 + Math.max(0, -kick) * 0.85, 0, 0);
      setModelRot('RightLeg', 0.28 + Math.max(0, kick) * 0.85, 0, 0);
      setModelRot('LeftFoot', 0.45 * swimMove, 0, 0);
      setModelRot('RightFoot', 0.45 * swimMove, 0, 0);
      setFingerCurl(0.15);
      return;
    }

    // -------------------------------------------------------------------------
    // PRIORITY 5: GRAPPLE-HOOK SUPERHERO ZIP POSE (Press X!)
    // -------------------------------------------------------------------------
    if (hookBlend > 0.05) {
      const h = hookBlend;
      modelRoot.rotation.x = 0.28 * h;
      setModelRot('Hips', 0.08 * h, -0.14 * h, 0);
      setModelRot('Spine', 0.16 * h, 0.18 * h, 0);
      setModelRot('Head', -0.34 * h, headLookYaw * 0.25, 0);
      setModelRot('RightArm', -2.42 * h, 0.12, 0.12);
      setModelRot('RightForeArm', -0.12, 0, 0);
      setModelRot('LeftArm', 0.62 * h, -0.25, -0.18);
      setModelRot('LeftForeArm', -0.48 * h, 0, 0);
      setModelRot('LeftUpLeg', -0.45 * h, 0.08, 0);
      setModelRot('LeftLeg', 0.92 * h, 0, 0);
      setModelRot('RightUpLeg', 0.26 * h, -0.06, 0);
      setModelRot('RightLeg', 0.58 * h, 0, 0);
      setModelRot('LeftFoot', 0.35 * h, 0, 0);
      setModelRot('RightFoot', 0.35 * h, 0, 0);
      setFingerCurl(0.85 * h);
      return;
    }

    // =========================================================================
    // BASE AAA 3-GAIT BLENDED LOCOMOTION (IDLE <-> WALK <-> JOG <-> SPRINT!)
    // + START-BURST + BRAKE/PIVOT + CORNER BANKING + CROUCH + 3-PHASE AIR/LAND!
    // =========================================================================
    const groundMask = 1 - airBlend;
    const moveBlend = smoothstep(0.02, 0.24, speedNorm);
    const idleW = (1 - moveBlend) * groundMask;

    // Derive clean continuous 3-gait weights (pedestrians at speedNorm=0.45 stay in natural stroll unless jogBlend/speedNorm > 0.50!)
    const sprintW = clamp01(sprintBlend) * moveBlend;
    const jogRaw =
      jogBlend !== null && jogBlend !== undefined
        ? clamp01(jogBlend)
        : smoothstep(0.48, 0.72, speedNorm) * (1 - sprintW * 0.85);
    const jogW = jogRaw * (1 - sprintW) * moveBlend * (1 - crouchBlend);
    const walkW = Math.max(0, moveBlend - jogW - sprintW);
    const runEnergy = clamp01(jogW * 0.65 + sprintW);

    const s = Math.sin(gaitPhase);
    const c = Math.cos(gaitPhase);
    // Double-frequency stride harmonics (2 cycles per full left+right gait cycle!)
    const cos2 = Math.cos(gaitPhase * 2.0);
    const sin2 = Math.sin(gaitPhase * 2.0);

    // Alive contrapposto idle micro-motion (organic breathing + slow hip weight shift + subtle gaze scanning)
    const breath = Math.sin(idleTime * 1.95) * (0.015 + runEnergy * 0.012);
    const idleWeightShift = Math.sin(idleTime * 0.72) * 0.5 + 0.5; // slowly shifts weight between right & neutral
    const idleHipLat = (0.018 + idleWeightShift * 0.014) * idleW;
    const idleHipTilt = (0.032 + idleWeightShift * 0.024) * idleW;
    const idleGlance = Math.sin(idleTime * 0.48) * Math.sin(idleTime * 0.21) * 0.26 * idleW;

    // 3-Phase air states: Jump launch -> apex -> high-speed freefall flail!
    const jumpLaunch = airBlend * clamp01(vy / 7.5);
    const flailT = idleTime * 13.5;
    const flailSin = Math.sin(flailT);
    const flailCos = Math.cos(flailT);

    // 1. TRUE BIOMECHANICAL PELVIS TRAJECTORY (VERTICAL + LATERAL WEIGHT SHIFT!)
    //    - WALK (inverted pendulum): HIGHEST at mid-stance (cos2 = +1), LOWEST at heel-strike double-support (cos2 = -1)!
    //    - JOG / SPRINT (spring-mass): LOWEST at stance loading (sneakers planted firmly at Y~0.02m), HIGHEST in crisp airborne flight right after toe-off!
    const walkBob = (cos2 * 0.030 - 0.018) * walkW;
    const jogBob = (-Math.sin(gaitPhase * 2.0 - 0.62) * 0.054 - 0.036) * jogW;
    const sprintBob = (-Math.sin(gaitPhase * 2.0 - 0.80) * 0.076 - 0.052) * sprintW;
    const strideBob = (walkBob + jogBob + sprintBob) * (1 - crouchBlend * 0.55) * (1 - brakeBlend * 0.75);

    const crouchDrop = crouchBlend * 0.34 * groundMask;
    const landDrop = landBlend * 0.28 * groundMask;
    const brakeDrop = brakeBlend * 0.14 * groundMask;
    modelRoot.position.y = strideBob * groundMask - crouchDrop - landDrop - brakeDrop;

    // Subtle lateral weight-shift onto planted stance foot during walking + tight athletic core stability in jog/sprint!
    const walkSwayX = -c * (0.028 * walkW + 0.014 * jogW + 0.009 * sprintW) * groundMask * (1 - brakeBlend);
    modelRoot.position.x = walkSwayX + idleHipLat;

    // Whole-body athletic forward drive lean from the ankles (tall proud runner posture — NEVER hunched lower back!)
    // + dynamic corner banking into turns!
    const bankRoll = -turnLean * (0.04 * walkW + 0.14 * jogW + 0.24 * sprintW) * groundMask;
    const wholeBodyDriveLean =
      (0.015 * walkW + 0.055 * jogW + 0.105 * sprintW + startBlend * 0.085) *
      groundMask *
      (1 - brakeBlend) *
      (1 - crouchBlend);
    modelRoot.rotation.z = bankRoll;
    modelRoot.rotation.x = wholeBodyDriveLean - brakeBlend * 0.10 * groundMask + fallBlend * 0.34;

    // 2. SPINE CHAIN: PROUD ATHLETIC CHEST POSTURE, PELVIC LIST, OPPOSING TORSO COUNTER-ROTATION & HEAD STABILIZATION!
    const baseSpineLean =
      0.025 * walkW +
      0.075 * jogW +
      0.135 * sprintW +
      startBlend * 0.075 * groundMask;
    const forwardLean =
      baseSpineLean * (1 - brakeBlend) +
      crouchBlend * 0.34 * groundMask +
      landBlend * 0.30 * groundMask -
      brakeBlend * 0.18 * groundMask +
      fallBlend * 0.22;

    // Pelvis yaw leads the advancing leg; ribcage counter-rotates smoothly opposite the hips!
    const hipYaw = -s * (0.090 * walkW + 0.135 * jogW + 0.185 * sprintW) * groundMask * (1 - brakeBlend) - brakeBlend * 0.24;
    // Trendelenburg pelvic list: planted stance hip stays UP while swing-leg hip dips slightly DOWN!
    const hipRoll =
      -c * (0.052 * walkW + 0.042 * jogW + 0.030 * sprintW) * groundMask * (1 - brakeBlend) +
      idleHipTilt -
      turnLean * 0.06 * groundMask +
      fallBlend * flailSin * 0.10;
    // Subtle athletic pelvic rhythm during stride
    const hipPitch =
      crouchBlend * 0.14 +
      landBlend * 0.16 +
      jogW * (0.03 + sin2 * 0.02) * groundMask +
      sprintW * (0.055 + sin2 * 0.035) * groundMask;

    const chestCounterYaw = -hipYaw * (1.72 * walkW + 1.82 * jogW + 1.92 * sprintW);
    const spineRollCounter = -hipRoll * 0.72 - turnLean * 0.04 * groundMask;

    setModelRot('Hips', hipPitch, hipYaw + idleW * -0.05, hipRoll);
    setModelRot('Spine', forwardLean * 0.44 + breath, chestCounterYaw * 0.38, spineRollCounter * 0.55 + fallBlend * flailCos * 0.08);
    setModelRot('Spine1', forwardLean * 0.34 + breath * 0.65, chestCounterYaw * 0.36, spineRollCounter * 0.30);
    setModelRot('Spine2', forwardLean * 0.22 + breath * 0.4, chestCounterYaw * 0.26, spineRollCounter * 0.15);

    // Neck + Head split keeps gaze silky-steady & level on the horizon across walk, jog, full sprint & corner banking!
    const totalBodyPitch = wholeBodyDriveLean + forwardLean + hipPitch * 0.5;
    const headPitchTotal = -totalBodyPitch * 0.90 + fallBlend * 0.48 + brakeBlend * 0.12;
    const headYawTotal = headLookYaw * 0.52 + idleGlance - (hipYaw + chestCounterYaw) * 0.78;
    const headRollTotal = -bankRoll * 0.55 - turnLean * 0.06;
    setModelRot('Neck', headPitchTotal * 0.44, headYawTotal * 0.44, headRollTotal * 0.45);
    setModelRot('Head', headPitchTotal * 0.56, headYawTotal * 0.56, headRollTotal * 0.55);

    // Clavicle/Shoulder athletic protraction-retraction synced WITH opposing arm drive (left forward while right pulls back!)
    // + relaxed dropped traps while running (zero stiff shrugging!)
    const armPhaseS = Math.sin(gaitPhase - 0.14);
    const shYaw = armPhaseS * (0.045 * walkW + 0.095 * jogW + 0.145 * sprintW) * groundMask * (1 - brakeBlend);
    const shDrop = (0.035 * jogW + 0.055 * sprintW) * groundMask;
    const shRaiseAir = fallBlend * 0.26;
    setModelRot('LeftShoulder', 0, shYaw, -shDrop + shRaiseAir - breath * 0.4);
    setModelRot('RightShoulder', 0, shYaw, shDrop - shRaiseAir + breath * 0.4);

    // 3. BIOMECHANICAL LEGS (LEFT & RIGHT EXACT HALF-CYCLE OFFSET + RELAXED CONTRAPPOSTO IDLE!)
    evalLegCycle(gaitPhase, walkW, jogW, sprintW, crouchBlend, legL);
    evalLegCycle(gaitPhase + Math.PI, walkW, jogW, sprintW, crouchBlend, legR);

    // Blend smoothly from relaxed contrapposto standing stance into active stride
    let lThigh = (-0.06 * idleW + legL.thigh * moveBlend) * groundMask;
    let rThigh = (0.04 * idleW + legR.thigh * moveBlend) * groundMask;
    let lKnee = (0.07 * idleW + legL.knee * moveBlend) * groundMask;
    let rKnee = (0.04 * idleW + legR.knee * moveBlend) * groundMask;
    let lFoot = (0.02 * idleW + legL.foot * moveBlend) * groundMask;
    let rFoot = (-0.02 * idleW + legR.foot * moveBlend) * groundMask;
    let lToe = legL.toe * moveBlend * groundMask;
    let rToe = legR.toe * moveBlend * groundMask;

    // Crouch, Impact Landing Squat & Athletic Sprint Brake/Pivot Plant!
    const squatHip = (crouchBlend * 0.76 + landBlend * 0.72) * groundMask;
    const squatKnee = (crouchBlend * 1.24 + landBlend * 1.22) * groundMask;
    lThigh -= squatHip + brakeBlend * 0.52 * groundMask;
    rThigh -= squatHip - brakeBlend * 0.34 * groundMask;
    lKnee += squatKnee + brakeBlend * 0.32 * groundMask;
    rKnee += squatKnee + brakeBlend * 0.62 * groundMask;
    lFoot -= squatKnee * 0.28 + brakeBlend * 0.26 * groundMask;
    rFoot -= squatKnee * 0.28 - brakeBlend * 0.24 * groundMask;

    // 3-Phase Air Blend (Athletic knee-drive jump launch -> apex tuck -> freefall flail)
    if (airBlend > 0.001) {
      const airLThigh = -0.58 - jumpLaunch * 0.54 + fallBlend * (0.20 + flailSin * 0.52);
      const airRThigh = -0.18 + jumpLaunch * 0.42 + fallBlend * (0.20 - flailSin * 0.52);
      const airLKnee = 0.92 + jumpLaunch * 0.58 + fallBlend * (0.15 + Math.max(0, flailCos) * 0.68);
      const airRKnee = 0.44 - jumpLaunch * 0.16 + fallBlend * (0.45 + Math.max(0, -flailCos) * 0.68);
      lThigh = lThigh + airLThigh * airBlend;
      rThigh = rThigh + airRThigh * airBlend;
      lKnee = lKnee + airLKnee * airBlend;
      rKnee = rKnee + airRKnee * airBlend;
      lFoot = lFoot + 0.30 * airBlend;
      rFoot = rFoot + 0.24 * airBlend;
    }

    // Subtle natural foot turnout in idle & sprint stability
    const lHipYaw = 0.075 * idleW + crouchBlend * 0.08 + fallBlend * 0.14 + brakeBlend * 0.14;
    const rHipYaw = -0.055 * idleW - crouchBlend * 0.08 - fallBlend * 0.14 - brakeBlend * 0.16;
    const lHipRoll = -idleHipTilt * 0.65 - 0.02 * idleW;
    const rHipRoll = -idleHipTilt * 0.65 + 0.02 * idleW;

    setModelRot('LeftUpLeg', lThigh, lHipYaw, lHipRoll);
    setModelRot('RightUpLeg', rThigh, rHipYaw, rHipRoll);
    setModelRot('LeftLeg', lKnee, 0, 0);
    setModelRot('RightLeg', rKnee, 0, 0);
    setModelRot('LeftFoot', lFoot, 0, 0);
    setModelRot('RightFoot', rFoot, 0, 0);
    setModelRot('LeftToeBase', lToe, 0, 0);
    setModelRot('RightToeBase', rToe, 0, 0);

    // 4. ANATOMICAL "CHEEK-TO-HIP" RUNNING ARMS, COMPACT RIB-TUCKED ELBOWS, NEUTRAL WRISTS & RUNNER FISTS!
    // Uses exact A-pose neutralization so shoulders swing purely forward/backward and elbows bend cleanly forward/inward
    // with ZERO chicken-wing flare or outward crab-claw twist!

    // Natural phase-lagged arm drive compensated for forward body lean so elbows drive crisply BEHIND the hip on backswing
    // and hands punch cleanly up to chest/chin height on upswing!
    const armFwdAmp = (0.30 * walkW + 0.50 * jogW + 0.84 * sprintW) * (1 - crouchBlend * 0.48);
    const armBackAmp = (0.26 * walkW + 0.58 * jogW + 0.92 * sprintW) * (1 - crouchBlend * 0.48);
    const armLeanComp = (0.03 * jogW + 0.06 * sprintW) * (1 - brakeBlend) * (1 - crouchBlend);
    const armS = armPhaseS;
    const lArmBase = (armS < 0 ? armS * armFwdAmp : armS * armBackAmp) + armLeanComp;
    const rArmBase = (-armS < 0 ? -armS * armFwdAmp : -armS * armBackAmp) + armLeanComp;

    let lArmSwing = (0.03 * idleW + lArmBase - crouchBlend * 0.26 - landBlend * 0.34 + brakeBlend * 0.38) * groundMask;
    let rArmSwing = (-0.02 * idleW + rArmBase - crouchBlend * 0.26 - landBlend * 0.34 - brakeBlend * 0.26) * groundMask;

    if (airBlend > 0.001) {
      const airLArm = -0.68 - jumpLaunch * 0.85 - fallBlend * (1.35 + flailSin * 0.62);
      const airRArm = -0.48 + jumpLaunch * 0.32 - fallBlend * (1.35 - flailSin * 0.62);
      lArmSwing += airLArm * airBlend;
      rArmSwing += airRArm * airBlend;
    }

    // TRUE Anatomical Elbow Flexion (0 = dead straight, PI/2 = exact 90° forward!):
    //   - Idle: relaxed soft ~14°-16° bend (0.24 / 0.28 rad)
    //   - Walk: fluid pendulum follow-through (~10° backswing -> ~28° forward upswing)
    //   - Jog: compact athletic runner bend (~82° backswing -> ~96° upswing!)
    //   - Sprint: explosive dynamic whip (~80° hip-brush backswing -> ~106° cheek-high upswing!)
    const elbowLag = Math.sin(gaitPhase - 0.34);
    const lUpFlex = Math.max(0, -elbowLag);
    const rUpFlex = Math.max(0, elbowLag);

    const lElbowGround =
      0.24 * idleW +
      (0.18 + lUpFlex * 0.30) * walkW +
      (1.42 + lUpFlex * 0.28) * jogW +
      (1.40 + lUpFlex * 0.46) * sprintW +
      crouchBlend * 0.82 +
      landBlend * 0.56 +
      brakeBlend * 0.45;
    const rElbowGround =
      0.28 * idleW +
      (0.18 + rUpFlex * 0.30) * walkW +
      (1.42 + rUpFlex * 0.28) * jogW +
      (1.40 + rUpFlex * 0.46) * sprintW +
      crouchBlend * 0.82 +
      landBlend * 0.56 +
      brakeBlend * 0.45;

    const lElbow = Math.max(
      0.12,
      lElbowGround * (1 - airBlend * 0.45) * (1 - fallBlend * 0.55) +
        jumpLaunch * 0.68 +
        fallBlend * (0.45 + Math.abs(flailCos) * 0.52)
    );
    const rElbow = Math.max(
      0.12,
      rElbowGround * (1 - airBlend * 0.45) * (1 - fallBlend * 0.55) +
        jumpLaunch * 0.54 +
        fallBlend * (0.45 + Math.abs(flailSin) * 0.52)
    );

    // Ribcage & moto-jacket clearance (keeps elbows cleanly tucked at x~0.18..0.24m — clears sling pack cleanly on backswing with ZERO chicken-wing flare!)
    const baseAbduct =
      0.135 * idleW +
      0.145 * walkW +
      0.205 * jogW +
      0.235 * sprintW +
      crouchBlend * 0.08 +
      landBlend * 0.22 +
      brakeBlend * 0.24;
    const lBackClear = Math.max(0, armS) * (0.06 * jogW + 0.14 * sprintW) * groundMask;
    const rBackClear = Math.max(0, -armS) * (0.06 * jogW + 0.14 * sprintW) * groundMask;
    const lAbduct = (baseAbduct + lBackClear) * (1 - fallBlend * 0.5) + airBlend * 0.16 + fallBlend * (0.42 + flailCos * 0.28);
    const rAbduct = (baseAbduct + rBackClear) * (1 - fallBlend * 0.5) + airBlend * 0.16 + fallBlend * (0.42 - flailCos * 0.28);

    // Subtle humeral internal rotation (layered cleanly with chestCounterYaw so hands track along parallel athletic rails x~0.11..0.21m!)
    const lInward =
      (0.06 * idleW + 0.08 * walkW + (0.09 + lUpFlex * 0.06) * jogW + (0.10 + lUpFlex * 0.07) * sprintW + crouchBlend * 0.12) *
      (1 - fallBlend);
    const rInward =
      (0.06 * idleW + 0.08 * walkW + (0.09 + rUpFlex * 0.06) * jogW + (0.10 + rUpFlex * 0.07) * sprintW + crouchBlend * 0.12) *
      (1 - fallBlend);

    // Subtle thumb-up athletic forearm alignment during running (neutral relaxed palms at idle/walk!)
    const forePron = -0.06 * runEnergy * (1 - fallBlend);

    setAnatomicalArm('Left', lArmSwing, lAbduct, lInward, lElbow, forePron);
    setAnatomicalArm('Right', rArmSwing, rAbduct, rInward, rElbow, forePron);

    // Firm neutral athletic wrists (zero limp wrist flop!) + anatomically curled relaxed runner fists!
    setModelRot('LeftHand', 0, 0, -0.04 * idleW);
    setModelRot('RightHand', 0, 0, 0.04 * idleW);
    const fingerCurl = 0.22 * idleW + 0.26 * walkW + 0.64 * jogW + 0.90 * sprintW + 0.50 * crouchBlend;
    setFingerCurl(clamp01(fingerCurl));
  }

  // Seated Vespa / Motor Scooter Rider Pose (feet on floorboard, hands forward gripping handlebars — Reference 5!)
  function applyScooterPose(steerLean = 0) {
    resetRootTransform();
    modelRoot.position.y = -0.32;
    setModelRot('Hips', 0.08, 0, steerLean * 0.12);
    setModelRot('Spine', 0.18, 0, steerLean * 0.08);
    setModelRot('Spine1', 0.12, 0, 0);
    setModelRot('Neck', -0.08, steerLean * 0.15, -steerLean * 0.05);
    setModelRot('Head', -0.14, steerLean * 0.20, -steerLean * 0.07);
    setModelRot('LeftUpLeg', -1.25, 0.12, 0);
    setModelRot('RightUpLeg', -1.25, -0.12, 0);
    setModelRot('LeftLeg', 1.32, 0, 0);
    setModelRot('RightLeg', 1.32, 0, 0);
    setModelRot('LeftFoot', 0.15, 0, 0);
    setModelRot('RightFoot', 0.15, 0, 0);
    setModelRot('LeftArm', -0.92, -0.14, -0.26);
    setModelRot('RightArm', -0.92, 0.14, 0.26);
    setModelRot('LeftForeArm', -0.36, 0, 0);
    setModelRot('RightForeArm', -0.36, 0, 0);
    setFingerCurl(0.85);
  }

  // Standing Electric Trottinette (E-Scooter) Rider Pose: staggered feet planted on deck, hands locked on rubber handlebar grips!
  function applyEScooterPose(steerLean = 0) {
    resetRootTransform();
    modelRoot.position.y = 0.0;
    setModelRot('Hips', 0.05, 0.16, steerLean * 0.16);
    setModelRot('Spine', 0.14, -0.08, steerLean * 0.10);
    setModelRot('Spine1', 0.08, -0.05, 0);
    setModelRot('Neck', -0.07, steerLean * 0.14, -steerLean * 0.05);
    setModelRot('Head', -0.11, steerLean * 0.18, -steerLean * 0.07);
    setModelRot('LeftUpLeg', -0.20, 0.06, -0.06);
    setModelRot('LeftLeg', 0.26, 0, 0);
    setModelRot('LeftFoot', -0.06, 0, 0);
    setModelRot('RightUpLeg', 0.16, -0.12, 0.06);
    setModelRot('RightLeg', 0.22, 0, 0);
    setModelRot('RightFoot', -0.18, 0, 0);
    setModelRot('LeftArm', -0.62, -0.26, -0.36);
    setModelRot('RightArm', -0.62, 0.26, 0.36);
    setModelRot('LeftForeArm', -0.24, 0, 0);
    setModelRot('RightForeArm', -0.24, 0, 0);
    setFingerCurl(0.85);
  }

  // Interactive World Object Animations:
  //   - 'bench'         : Relaxed reclined Geneva park bench sit (arm casually draped on backrest, organic leg shift & scenic glances!)
  //   - 'shelter_bench' : TPG bus-stop shelter wait (elbows toward knees, hands clasped, glancing down boulevard for tram/bus!)
  //   - 'cafe_chair'    : Geneva outdoor café terrace sit (3D porcelain espresso cup sip cycle + left arm resting on marble table!)
  //   - 'railing'       : Lac Léman wrought-iron lakeside railing lean (both forearms resting atop rail, contrapposto stance, gazing over lake!)
  //   - 'tpg_machine'   : Orange TPG ticket vending machine (3 crisp touchscreen taps + dip to retrieve printed Zone 10 ticket!)
  //   - 'fountain'      : Historic Geneva fountain drink (leans over stone rim, scoops cool Alpine water twice with cupped hands!)
  //   - 'bin'           : Stylish hook-shot litter toss into Ville de Genève bin + satisfied nod!
  //   - 'sign_read'     : Thoughtful hand-on-chin admiration / reading pose for TPG schedules, café menus & Geneva monuments!
  function applyInteractionPose({
    kind = 'bench',
    t = 0,
    blend = 1,
    duration = 2.4,
    headLookYaw = 0,
    idleTime = 0,
  }) {
    resetRootTransform();
    const e = clamp01(blend);
    const breath = Math.sin(idleTime * 1.85) * 0.016;
    const sitTransfer = Math.sin(e * Math.PI); // natural forward weight-shift mid sit-down / stand-up!

    if (kind === 'bench' || kind === 'shelter_bench') {
      const isShelter = kind === 'shelter_bench';
      modelRoot.position.y = -0.39 * e;
      modelRoot.position.z = -0.03 * e;

      // Natural relaxed seated legs (planted left sneaker, slightly extended right leg with gentle alive ankle sway!)
      const footTap = Math.sin(t * 1.15) * 0.045 * e;
      setModelRot('Hips', (isShelter ? 0.14 : -0.08) * e, (isShelter ? 0 : 0.06) * e, 0);
      setModelRot('LeftUpLeg', -1.42 * e, 0.14 * e, 0);
      setModelRot('RightUpLeg', (isShelter ? -1.42 : -1.30) * e, -0.16 * e, 0);
      setModelRot('LeftLeg', 1.38 * e, 0, 0);
      setModelRot('RightLeg', (isShelter ? 1.38 : 1.18) * e, 0, 0);
      setModelRot('LeftFoot', 0.08 * e, 0, 0);
      setModelRot('RightFoot', (isShelter ? 0.08 : 0.16) * e + footTap, 0, 0);
      setModelRot('LeftToeBase', 0, 0, 0);
      setModelRot('RightToeBase', 0, 0, 0);

      if (isShelter) {
        // Waiting for TPG bus/tram: forward-leaning attentive posture, forearms toward knees, looking down the road
        const busLook = Math.sin(t * 0.72) * 0.44 * e;
        setModelRot('Spine', 0.22 * e + sitTransfer * 0.16 + breath, 0, 0);
        setModelRot('Spine1', 0.14 * e + breath * 0.6, 0, 0);
        setModelRot('Spine2', 0.06 * e, 0, 0);
        setModelRot('Neck', -0.16 * e, (busLook + headLookYaw * 0.4) * 0.42, 0);
        setModelRot('Head', -0.18 * e, (busLook + headLookYaw * 0.4) * 0.58, 0);
        setModelRot('LeftShoulder', 0, -0.08 * e, -0.04 * e);
        setModelRot('RightShoulder', 0, 0.08 * e, 0.04 * e);
        setAnatomicalArm('Left', -0.78 * e, 0.14 + 0.08 * e, 0.06 + 0.36 * e, 0.24 + 1.02 * e, 0.08 * e);
        setAnatomicalArm('Right', -0.78 * e, 0.14 + 0.08 * e, 0.06 + 0.36 * e, 0.26 + 1.00 * e, 0.08 * e);
        setModelRot('LeftHand', 0, 0, 0);
        setModelRot('RightHand', 0, 0, 0);
        setFingerCurl(0.32 * e + 0.18 * (1 - e));
      } else {
        // Park bench: reclined effortlessly against green wooden slats, left arm casually draped atop backrest rim!
        const watchCycle = (t % 11.0) / 11.0;
        const watchEnv = smoothstep(0.68, 0.76, watchCycle) * (1 - smoothstep(0.84, 0.92, watchCycle)) * e;
        const glance = Math.sin(t * 0.46) * Math.cos(t * 0.19) * 0.36 * e * (1 - watchEnv);

        setModelRot('Spine', -0.11 * e + sitTransfer * 0.24 + breath, 0.07 * e, -0.03 * e);
        setModelRot('Spine1', -0.06 * e + sitTransfer * 0.12 + breath * 0.6, 0.05 * e, 0);
        setModelRot('Spine2', -0.02 * e, 0.03 * e, 0);
        const headPitch = 0.15 * e + watchEnv * 0.26 - sitTransfer * 0.16;
        const headYaw = glance + headLookYaw * 0.48 - watchEnv * 0.30;
        setModelRot('Neck', headPitch * 0.44, headYaw * 0.44, 0.04 * e);
        setModelRot('Head', headPitch * 0.56, headYaw * 0.56, 0.05 * e);
        setModelRot('LeftShoulder', 0, 0.16 * e, 0.12 * e);
        setModelRot('RightShoulder', 0, -0.05 * e, -0.04 * e);

        // Left arm draped smoothly along TOP edge of the green wooden backrest (y ~ 1.01m); right hand resting naturally on right thigh!
        const lBackSwing = 0.28 * e * (1 - sitTransfer * 0.7);
        const lBackAbd = 0.14 + 0.98 * e * (1 - sitTransfer * 0.65);
        setAnatomicalArm('Left', lBackSwing, lBackAbd, -0.18 * e, 0.24 + 0.32 * e, 0.24 * e);

        const rSwing = -0.22 * e - watchEnv * 0.66 - sitTransfer * 0.28;
        const rIn = 0.08 + 0.16 * e + watchEnv * 0.28;
        const rElbow = 0.26 + 0.68 * e + watchEnv * 0.92;
        setAnatomicalArm('Right', rSwing, 0.14 + 0.08 * e, rIn, rElbow, 0.18 * e * (1 - watchEnv));
        setModelRot('LeftHand', 0.14 * e, 0, 0);
        setModelRot('RightHand', 0, 0, 0);
        setFingerCurl(0.22);
      }
      return;
    }

    if (kind === 'cafe_chair') {
      // Outdoor Geneva café terrace: tucked neatly at marble table, left forearm on table, right hand sipping sculpted 3D espresso cup!
      modelRoot.position.y = -0.39 * e;
      modelRoot.position.z = -0.03 * e;

      const sipCycle = (t % 5.2) / 5.2;
      const sipEnv = smoothstep(0.16, 0.32, sipCycle) * (1 - smoothstep(0.46, 0.64, sipCycle)) * e;
      const lookAround = Math.sin(t * 0.52) * 0.28 * e * (1 - sipEnv * 0.85);

      setModelRot('Hips', 0.04 * e, 0, 0);
      setModelRot('LeftUpLeg', -1.44 * e, 0.09 * e, 0);
      setModelRot('RightUpLeg', -1.38 * e, -0.10 * e, 0);
      setModelRot('LeftLeg', 1.40 * e, 0, 0);
      setModelRot('RightLeg', 1.32 * e, 0, 0);
      setModelRot('LeftFoot', 0.06 * e, 0, 0);
      setModelRot('RightFoot', 0.08 * e, 0, 0);
      setModelRot('LeftToeBase', 0, 0, 0);
      setModelRot('RightToeBase', 0, 0, 0);

      setModelRot('Spine', 0.08 * e + sitTransfer * 0.22 + breath - sipEnv * 0.06, -0.04 * e, 0);
      setModelRot('Spine1', 0.05 * e + sitTransfer * 0.12 + breath * 0.6, 0, 0);
      setModelRot('Spine2', 0.02 * e, 0, 0);
      const headPitch = -0.06 * e - sipEnv * 0.16;
      const headYaw = lookAround + headLookYaw * 0.42;
      setModelRot('Neck', headPitch * 0.45, headYaw * 0.45, 0);
      setModelRot('Head', headPitch * 0.55, headYaw * 0.55, 0);
      setModelRot('LeftShoulder', 0, -0.06 * e, -0.03 * e);
      setModelRot('RightShoulder', 0, 0.04 * e + sipEnv * 0.06, 0.03 * sipEnv);

      // Left forearm resting comfortably on café tabletop
      setAnatomicalArm('Left', -0.62 * e, 0.14 + 0.10 * e, 0.08 + 0.30 * e, 0.24 + 1.12 * e, 0.22 * e);
      // Right arm holding espresso cup above table -> smoothly lifting cup right to lips during sipEnv!
      const rSwing = -0.56 * e - sipEnv * 0.52;
      const rIn = 0.08 + 0.26 * e + sipEnv * 0.24;
      const rElbow = 0.26 + 1.08 * e + sipEnv * 0.68;
      setAnatomicalArm('Right', rSwing, 0.14 + 0.08 * e + sipEnv * 0.06, rIn, rElbow, -0.12 * e);
      setModelRot('LeftHand', 0, 0, 0);
      setModelRot('RightHand', -0.14 * sipEnv, 0, 0);
      setFingerCurl(0.24 * (1 - e) + 0.72 * e);
      return;
    }

    if (kind === 'railing') {
      // Lac Léman wrought-iron lakeside railing lean: forearms resting atop rail, contrapposto stance, gazing across lake & Jet d'Eau!
      modelRoot.position.y = -0.04 * e;
      modelRoot.position.z = 0.08 * e;
      const gaze = Math.sin(t * 0.36) * 0.42 * e;
      const weightShift = Math.sin(t * 0.55) * 0.025 * e;

      setModelRot('Hips', 0.06 * e, -0.08 * e, 0.055 * e + weightShift);
      setModelRot('LeftUpLeg', 0.06 * e, 0.06 * e, -0.04 * e);
      setModelRot('RightUpLeg', -0.16 * e, -0.12 * e, -0.03 * e);
      setModelRot('LeftLeg', 0.08 * e, 0, 0);
      setModelRot('RightLeg', 0.28 * e, 0, 0);
      setModelRot('LeftFoot', -0.04 * e, 0, 0);
      setModelRot('RightFoot', -0.08 * e, 0, 0);
      setModelRot('LeftToeBase', 0, 0, 0);
      setModelRot('RightToeBase', 0, 0, 0);

      setModelRot('Spine', 0.22 * e + breath, 0.06 * e, -0.04 * e);
      setModelRot('Spine1', 0.15 * e + breath * 0.6, 0.04 * e, 0);
      setModelRot('Spine2', 0.08 * e, 0, 0);
      const headPitch = -0.36 * e;
      const headYaw = gaze + headLookYaw * 0.52;
      setModelRot('Neck', headPitch * 0.44, headYaw * 0.44, 0);
      setModelRot('Head', headPitch * 0.56, headYaw * 0.56, 0.04 * Math.sin(t * 0.36) * e);
      setModelRot('LeftShoulder', 0, -0.10 * e, 0.04 * e);
      setModelRot('RightShoulder', 0, 0.10 * e, -0.04 * e);

      // Both forearms resting cleanly atop the wrought-iron railing (~1.08m height) with hands meeting loosely in front!
      setAnatomicalArm('Left', -0.66 * e, 0.14 + 0.12 * e, 0.08 + 0.42 * e, 0.24 + 1.18 * e, 0.26 * e);
      setAnatomicalArm('Right', -0.66 * e, 0.14 + 0.12 * e, 0.08 + 0.42 * e, 0.26 + 1.16 * e, 0.26 * e);
      setModelRot('LeftHand', 0, 0, 0);
      setModelRot('RightHand', 0, 0, 0);
      setFingerCurl(0.28 * e + 0.18 * (1 - e));
      return;
    }

    // One-shot timed interactive animations (TPG ticket machine, historic fountain drink, litter toss, sign/monument inspection!)
    const p = clamp01(t / Math.max(0.5, duration));
    const env = smoothstep(0.0, 0.14, p) * (1 - smoothstep(0.84, 1.0, p)) * e;

    // Neutral relaxed grounded standing base for one-shot actions
    setModelRot('Hips', 0, -0.05 * env, 0.03 * env);
    setModelRot('LeftUpLeg', -0.05 * env, 0.06, -0.02);
    setModelRot('RightUpLeg', 0.04 * env, -0.06, 0.02);
    setModelRot('LeftLeg', 0.06, 0, 0);
    setModelRot('RightLeg', 0.05, 0, 0);
    setModelRot('LeftFoot', 0, 0, 0);
    setModelRot('RightFoot', 0, 0, 0);
    setModelRot('LeftToeBase', 0, 0, 0);
    setModelRot('RightToeBase', 0, 0, 0);

    if (kind === 'tpg_machine') {
      const tapEnv = smoothstep(0.06, 0.16, p) * (1 - smoothstep(0.52, 0.62, p)) * e;
      const tapJab = Math.pow(Math.max(0, Math.sin((p - 0.12) * Math.PI * 10)), 2) * tapEnv;
      const grabEnv = smoothstep(0.56, 0.68, p) * (1 - smoothstep(0.84, 0.96, p)) * e;
      const checkEnv = smoothstep(0.76, 0.85, p) * (1 - smoothstep(0.92, 1.0, p)) * e;

      modelRoot.position.y = -0.10 * grabEnv;
      setModelRot('LeftUpLeg', -0.06 - 0.24 * grabEnv, 0.06, 0);
      setModelRot('RightUpLeg', 0.04 - 0.24 * grabEnv, -0.06, 0);
      setModelRot('LeftLeg', 0.06 + 0.44 * grabEnv, 0, 0);
      setModelRot('RightLeg', 0.05 + 0.44 * grabEnv, 0, 0);
      setModelRot('Spine', 0.06 * tapEnv + 0.22 * grabEnv + breath, 0.06 * tapEnv, 0);
      setModelRot('Spine1', 0.04 * tapEnv + 0.12 * grabEnv, 0, 0);
      setModelRot('Spine2', 0, 0, 0);
      setModelRot('Neck', (0.14 * grabEnv - 0.06 * tapEnv) * 0.45, Math.sin(p * Math.PI * 4) * 0.08 * tapEnv, 0);
      setModelRot('Head', (0.18 * grabEnv - 0.06 * tapEnv + 0.16 * checkEnv) * 0.55, Math.sin(p * Math.PI * 4) * 0.10 * tapEnv, 0);
      setModelRot('LeftShoulder', 0, 0, 0);
      setModelRot('RightShoulder', 0, 0.10 * tapEnv, 0);

      // Left arm casual on hip; right arm taps glowing TPG screen 3 times -> retrieves ticket -> checks it!
      setAnatomicalArm('Left', 0.08 * env, 0.14 + 0.08 * env, 0.10, 0.28 + 0.44 * env, 0);
      const rSwing = -1.04 * tapEnv - 0.58 * grabEnv - 0.68 * checkEnv - tapJab * 0.14;
      const rElbow = 0.26 + 0.82 * tapEnv - tapJab * 0.34 + 0.50 * grabEnv + 1.15 * checkEnv;
      setAnatomicalArm('Right', rSwing, 0.14 + 0.06 * tapEnv, 0.08 + 0.22 * (tapEnv + checkEnv), rElbow, 0);
      setModelRot('LeftHand', 0, 0, 0);
      setModelRot('RightHand', 0, 0, 0);
      setFingerCurl(0.24 + 0.42 * grabEnv);
      return;
    }

    if (kind === 'fountain') {
      // Lean over carved Geneva fountain rim, scoop cool Alpine water twice with cupped hands & drink!
      const leanEnv = smoothstep(0.05, 0.20, p) * (1 - smoothstep(0.80, 0.96, p)) * e;
      const scoopEnv = smoothstep(0.16, 0.24, p) * (1 - smoothstep(0.76, 0.86, p)) * e;
      const drinkLift = (Math.sin((p - 0.26) * Math.PI * 6.5) * 0.5 + 0.5) * scoopEnv;

      modelRoot.position.y = -0.04 * leanEnv;
      setModelRot('LeftUpLeg', -0.26 * leanEnv, 0.08, 0);
      setModelRot('RightUpLeg', -0.20 * leanEnv, -0.08, 0);
      setModelRot('LeftLeg', 0.44 * leanEnv, 0, 0);
      setModelRot('RightLeg', 0.38 * leanEnv, 0, 0);
      setModelRot('Spine', (0.34 - 0.14 * drinkLift) * leanEnv + breath, 0, 0);
      setModelRot('Spine1', (0.20 - 0.08 * drinkLift) * leanEnv, 0, 0);
      setModelRot('Spine2', 0.08 * leanEnv, 0, 0);
      const hPitch = (0.22 - 0.48 * drinkLift) * leanEnv;
      setModelRot('Neck', hPitch * 0.45, 0, 0);
      setModelRot('Head', hPitch * 0.55, 0, 0);
      setModelRot('LeftShoulder', 0, -0.10 * leanEnv, 0);
      setModelRot('RightShoulder', 0, 0.10 * leanEnv, 0);

      const armSwing = -1.04 * leanEnv - 0.16 * drinkLift;
      const armIn = 0.08 + 0.28 * leanEnv + 0.22 * drinkLift;
      const armElbow = 0.24 + 0.42 * leanEnv + 1.52 * drinkLift;
      setAnatomicalArm('Left', armSwing, 0.14 + 0.10 * leanEnv, armIn, armElbow, -0.35 * leanEnv);
      setAnatomicalArm('Right', armSwing, 0.14 + 0.10 * leanEnv, armIn, armElbow, -0.35 * leanEnv);
      setModelRot('LeftHand', 0, 0, 0);
      setModelRot('RightHand', 0, 0, 0);
      setFingerCurl(0.45 * leanEnv);
      return;
    }

    if (kind === 'bin') {
      // Stylish casual basketball hook-shot toss into Geneva dark-green litter bin + approving nod!
      const windup = smoothstep(0.04, 0.24, p) * (1 - smoothstep(0.24, 0.42, p));
      const release = smoothstep(0.24, 0.50, p) * (1 - smoothstep(0.68, 0.94, p));
      const nod = Math.sin(clamp01((p - 0.58) / 0.32) * Math.PI) * 0.22;

      setModelRot('Spine', (-0.08 * release + 0.08 * windup) * e + breath, (-0.16 * windup + 0.18 * release) * e, 0);
      setModelRot('Spine1', 0, (-0.10 * windup + 0.12 * release) * e, 0);
      setModelRot('Spine2', 0, 0, 0);
      setModelRot('Neck', nod * 0.45, 0, 0);
      setModelRot('Head', nod * 0.55, 0, 0);
      setModelRot('LeftShoulder', 0, 0, 0);
      setModelRot('RightShoulder', 0, 0.12 * release, 0);

      setAnatomicalArm('Left', 0.08 * env, 0.15, 0.08, 0.26 + 0.18 * release, 0);
      const rSwing = 0.42 * windup - 1.48 * release;
      const rElbow = 0.26 + 1.10 * windup + 0.28 * release;
      setAnatomicalArm('Right', rSwing, 0.14 + 0.12 * release, 0.08 + 0.14 * release, rElbow, 0);
      setModelRot('LeftHand', 0, 0, 0);
      setModelRot('RightHand', 0.35 * release, 0, 0);
      setFingerCurl(0.65 * windup + 0.10 * release);
      return;
    }

    // Default 'sign_read': Thoughtful hand-on-chin Geneva monument / TPG schedule / menu reading pose!
    const scanYaw = Math.sin(p * Math.PI * 2.2) * 0.24 * env;
    const nod = Math.max(0, Math.sin((p - 0.62) * Math.PI * 3.5)) * 0.14 * env;
    setModelRot('Spine', -0.04 * env + breath, -0.08 * env, 0);
    setModelRot('Spine1', 0, -0.06 * env, 0);
    setModelRot('Spine2', 0, 0, 0);
    setModelRot('Neck', (-0.06 * env + nod) * 0.45, (scanYaw + headLookYaw * 0.35) * 0.45, 0);
    setModelRot('Head', (-0.08 * env + nod) * 0.55, (scanYaw + headLookYaw * 0.35) * 0.55, 0.06 * env);
    setModelRot('LeftShoulder', 0, -0.06 * env, 0);
    setModelRot('RightShoulder', 0, 0.08 * env, 0);

    // Left arm folded casually across waist; right hand lifted near chin in thoughtful inspection!
    setAnatomicalArm('Left', -0.24 * env, 0.14 + 0.06 * env, 0.08 + 0.48 * env, 0.24 + 1.24 * env, 0.20 * env);
    setAnatomicalArm('Right', -0.72 * env, 0.14 + 0.08 * env, 0.08 + 0.38 * env, 0.26 + 1.72 * env, -0.15 * env);
    setModelRot('LeftHand', 0, 0, 0);
    setModelRot('RightHand', 0, 0, 0);
    setFingerCurl(0.32 * env + 0.18 * (1 - env));
  }

  return { applyPose, applyInteractionPose, applyScooterPose, applyEScooterPose, bones };
}
