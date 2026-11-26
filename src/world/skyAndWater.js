import * as THREE from 'three';
import { Water } from 'three/examples/jsm/objects/Water.js';

// Custom GLSL Physical Atmospheric Sky Dome (used as fallback & during rain)
export function createSkyDome(scene) {
  const skyUniforms = {
    uSunDir: { value: new THREE.Vector3(0.5, 0.35, 0.4).normalize() },
    uTime: { value: 0 },
    uDayFactor: { value: 1.0 },
    uSunsetFactor: { value: 0.2 },
    uRainFactor: { value: 0.0 },
  };

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: skyUniforms,
    vertexShader: `
      varying vec3 vWorldDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform float uTime;
      uniform float uDayFactor;
      uniform float uSunsetFactor;
      uniform float uRainFactor;
      varying vec3 vWorldDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = rot * p * 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, 0.0, 1.0);

        vec3 dayZenith = vec3(0.08, 0.28, 0.64);
        vec3 dayHorizon = vec3(0.52, 0.74, 0.92);

        vec3 setZenith = vec3(0.18, 0.24, 0.46);
        vec3 setHorizon = vec3(0.98, 0.56, 0.30);

        vec3 nightZenith = vec3(0.014, 0.028, 0.072);
        vec3 nightHorizon = vec3(0.045, 0.080, 0.145);

        vec3 zenith = mix(nightZenith, dayZenith, uDayFactor);
        vec3 horizon = mix(nightHorizon, dayHorizon, uDayFactor);
        zenith = mix(zenith, setZenith, uSunsetFactor * 0.75);
        horizon = mix(horizon, setHorizon, uSunsetFactor * 0.85);

        vec3 rainCol = vec3(0.28, 0.33, 0.40);
        zenith = mix(zenith, rainCol * 0.7, uRainFactor * 0.65);
        horizon = mix(horizon, rainCol, uRainFactor * 0.65);

        vec3 col = mix(horizon, zenith, pow(h, 0.52));

        float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
        vec3 sunCol = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.22), uSunsetFactor);
        col += sunCol * pow(sunAmt, 10.0) * 0.38 * (1.0 - uRainFactor * 0.7) * uDayFactor;
        col += sunCol * smoothstep(0.9985, 0.9996, sunAmt) * 2.2 * (1.0 - uRainFactor * 0.8) * uDayFactor;

        // Luminous Alpine Moon & soft silver-blue atmospheric halo aligned with moonlight direction at night!
        float nightAmt = smoothstep(0.35, 0.0, uDayFactor) * (1.0 - uRainFactor * 0.75);
        if (nightAmt > 0.01) {
          col += vec3(0.45, 0.64, 0.95) * pow(sunAmt, 18.0) * 0.28 * nightAmt;
          col += vec3(0.92, 0.96, 1.0) * smoothstep(0.9988, 0.9994, sunAmt) * 1.65 * nightAmt;
        }

        if (dir.y > 0.02) {
          vec2 uv = dir.xz / (dir.y + 0.18) * 1.45 + vec2(uTime * 0.008, uTime * 0.003);
          float cl = fbm(uv);
          float cloudMask = smoothstep(0.46 - uRainFactor * 0.15, 0.78, cl) * smoothstep(0.02, 0.22, dir.y);
          vec3 cloudLit = mix(vec3(0.085, 0.125, 0.20), vec3(1.0, 0.98, 0.95), uDayFactor);
          cloudLit = mix(cloudLit, vec3(1.0, 0.74, 0.52), uSunsetFactor * 0.75);
          cloudLit = mix(cloudLit, vec3(0.42, 0.46, 0.52), uRainFactor * 0.7);
          col = mix(col, cloudLit, cloudMask * (mix(0.42, 0.65, uDayFactor) + uRainFactor * 0.25));
        }

        if (uDayFactor < 0.35 && dir.y > 0.08) {
          float star = hash(floor(dir.xz * 420.0 / (dir.y + 0.2)));
          float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + star * 50.0);
          if (star > 0.9965) {
            col += vec3(0.9, 0.95, 1.0) * (1.0 - uDayFactor / 0.35) * twinkle * 0.9;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2800, 64, 40), skyMat);
  scene.add(skyMesh);

  return { skyMesh, skyUniforms };
}

// TRUE AAA REAL-TIME PLANAR REFLECTIVE LAC LÉMAN WATER!
// Reflects real 3D Geneva buildings, Pont du Mont-Blanc, Alps, Jet d'Eau & 2K clouds across animated normal-mapped waves!
export function createRealisticWater(scene) {
  const waterNormals = new THREE.TextureLoader().load('textures/waternormals.jpg', (tex) => {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
  });
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping;

  const waterGeo = new THREE.PlaneGeometry(2400, 2400);
  const waterMesh = new Water(waterGeo, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals,
    sunDirection: new THREE.Vector3(0.5, 0.35, 0.4).normalize(),
    sunColor: 0xfff3dc,
    waterColor: 0x062f45, // authentic deep Alpine sapphire-emerald Lac Léman color!
    distortionScale: 2.3,
    fog: true,
    alpha: 1.0,
  });

  // Water.js requires rotation on the MESH (not geometry) so its mirror normal points +Y!
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(140, 0.0, -80);

  // Calibrate crisp Lac Léman wave chop, shallow Molard emerald-turquoise depth tint & HDR Fresnel mirror reflections!
  waterMesh.material.uniforms.size.value = 3.2;
  waterMesh.material.uniforms.distortionScale.value = 1.85;
  waterMesh.material.uniforms.uNightFactor = { value: 0.0 };
  waterMesh.material.fragmentShader = waterMesh.material.fragmentShader
    .replace('uniform float alpha;', 'uniform float alpha;\nuniform float uNightFactor;')
    .replace('float rf0 = 0.3;', 'float rf0 = 0.04;')
    .replace(
      'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
      'vec3 surfaceNormal = normalize( noise.xzy * vec3( 2.15, 1.0, 2.15 ) + vec3( 0.0, 0.002, 0.0 ) );'
    )
    .replace(
      'vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);',
      `// Authentic Lac Léman & Rhône outflow shallow turquoise-emerald in daylight -> deep glossy midnight-sapphire mirror at night!
       float shallowRade = smoothstep(260.0, 15.0, length(worldPosition.xz - vec2(-45.0, 65.0)));
       float inRhone = smoothstep(-140.0, -260.0, worldPosition.x) * (1.0 - smoothstep(190.0, 250.0, worldPosition.z));
       float shallowZone = max(shallowRade, inRhone * 0.92);
       vec3 shallowAlpine = vec3(0.032, 0.25, 0.30);
       vec3 dayLakeCol = mix(waterColor, shallowAlpine, shallowZone * 0.62);
       vec3 nightLakeCol = vec3(0.005, 0.018, 0.042);
       vec3 baseLakeCol = mix(dayLakeCol, nightLakeCol, uNightFactor);
       vec3 deepTint = mix(baseLakeCol * 0.72, baseLakeCol * 1.48, clamp(surfaceNormal.y, 0.0, 1.0));
       float waveFoam = smoothstep(0.62, 0.95, length(surfaceNormal.xz)) * mix(0.14, 0.025, uNightFactor);
       vec3 safeRefl = clamp(max(reflectionSample, vec3(0.0)), vec3(0.0), vec3(6.0));
       vec3 safeSpec = clamp(max(specularLight, vec3(0.0)), vec3(0.0), vec3(6.0));
       vec3 refracted = (sunColor * clamp(diffuseLight, vec3(0.0), vec3(4.0)) * 0.24 + deepTint * (0.68 + 0.32 * max(0.0, dot(surfaceNormal, eyeDirection)))) * getShadowMask();
       vec3 reflected = safeRefl * mix(0.94, 0.98, uNightFactor) + sunColor * safeSpec * mix(1.35, 1.15, uNightFactor) + vec3(waveFoam);
       vec3 albedo = clamp(mix(refracted, reflected, clamp(reflectance * 0.90, 0.06, 0.90)), vec3(0.0), vec3(8.0));`
    )
    // OutputPass in EffectComposer already applies ACESFilmicToneMapping + sRGB encoding — strip duplicate pass!
    .replace('#include <tonemapping_fragment>', '')
    .replace('#include <colorspace_fragment>', '');
  waterMesh.material.needsUpdate = true;

  // High-efficiency planar mirror reflection controller (zero visible quality loss!):
  // 1) Skip mirror render during GTAO override passes
  // 2) Skip mirror render when camera is deep inland behind Geneva blocks (lake completely occluded!)
  // 3) Refresh wavy reflection texture at 30Hz (every 2nd frame) & exclude sub-pixel micro-props/shadows from mirror pass!
  const origBeforeRender = waterMesh.onBeforeRender;
  let reflFrame = 0;
  let hasInitialRefl = false;
  waterMesh.onBeforeRender = function (renderer, sc, cam, geo, mat, group) {
    if (sc.overrideMaterial) return;
    // Inland occlusion skip:
    // - East of Pont des Bergues (x >= -240): south of 6-story Quai du Général-Guisan wall (Rue du Rhône, Molard, Cathédrale)
    // - West of Pont des Bergues (x < -240): keep live planar reflections ON across BOTH Rhône channels (Ponts de l'Île, Bel-Air, Quai de la Poste),
    //   and skip only deep south inland (Place de Neuve, Bastions: z > 245)!
    const quayWallZ = 192.0 + (cam.position.x + 100.0) * 0.30;
    const occludedInland = cam.position.x >= -240.0 ? cam.position.z > quayWallZ : cam.position.z > 245.0;
    if (hasInitialRefl && cam.position.y < 14.0 && occludedInland) {
      return;
    }
    reflFrame++;
    if (hasInitialRefl && (reflFrame & 1) === 1) return;
    hasInitialRefl = true;

    const skipList = waterMesh.userData.skipInReflection || [];
    const prevVis = [];
    for (let i = 0; i < skipList.length; i++) {
      prevVis[i] = skipList[i].visible;
      skipList[i].visible = false;
    }
    const prevShadowAuto = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    origBeforeRender.call(this, renderer, sc, cam, geo, mat, group);
    renderer.shadowMap.autoUpdate = prevShadowAuto;
    for (let i = 0; i < skipList.length; i++) {
      skipList[i].visible = prevVis[i];
    }
  };

  scene.add(waterMesh);

  // Clean proxy uniforms compatible with existing main.js / buildGeneva.js updates
  const uTime = {
    get value() { return waterMesh.material.uniforms.time.value; },
    set value(v) { waterMesh.material.uniforms.time.value = v * 0.42; },
  };
  const waterUniforms = {
    uTime,
    uSunDir: waterMesh.material.uniforms.sunDirection,
    uSunColor: waterMesh.material.uniforms.sunColor,
    uSkyColor: { value: new THREE.Color(0x74b3e2) },
    uNightFactor: waterMesh.material.uniforms.uNightFactor,
  };

  return { waterMesh, waterUniforms };
}

// Procedural fallback IBL Environment Map
export function createEnvironmentMap(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();

  const geo = new THREE.SphereGeometry(50, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 sky = mix(vec3(0.75, 0.84, 0.95), vec3(0.22, 0.48, 0.85), clamp(y, 0.0, 1.0));
        vec3 ground = vec3(0.22, 0.24, 0.26);
        vec3 col = y >= 0.0 ? sky : mix(vec3(0.55, 0.62, 0.68), ground, clamp(-y * 2.5, 0.0, 1.0));
        float sun = pow(max(dot(vDir, normalize(vec3(0.6, 0.45, 0.4))), 0.0), 18.0);
        col += vec3(1.0, 0.92, 0.78) * sun * 2.5;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(geo, mat));

  const rt = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  geo.dispose();
  mat.dispose();
  return rt.texture;
}
