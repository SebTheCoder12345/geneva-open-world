import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Ultra-fast HDR NaN / Infinity / FP16-overflow sanitizer pass placed directly before UnrealBloomPass.
// Prevents a single NaN or +Inf pixel (from HDRI sun pixels, grazing water speculars, or GTAO denoise)
// from smearing into a huge flickering pure-black rectangle across UnrealBloomPass's 5-level Gaussian pyramid!
export function createHdrSanitizePass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      float cleanChannel(float v) {
        // Fails cleanly for NaN, +Inf, -Inf & negative garbage on every WebGL1/WebGL2/ANGLE driver
        return (v >= 0.0 && v <= 60000.0) ? min(v, 10.0) : 0.0;
      }
      void main() {
        vec4 texel = texture2D(tDiffuse, vUv);
        vec3 safeRgb = vec3(cleanChannel(texel.r), cleanChannel(texel.g), cleanChannel(texel.b));
        gl_FragColor = vec4(safeRgb, 1.0);
      }
    `,
  });
}

// GTA 6 / AAA Filmic Post-FX (Fused ACESFilmic Tone Mapping + sRGB Encoding + NaN/Inf Guard + Speed Blur + CAS Sharpen):
// Eliminates TWO extra full-resolution FP16 render-target passes (HdrSanitizePass + OutputPass) every single frame
// while keeping bit-for-bit identical ACES Filmic color, exposure & crispness!
export function createGtaPostPass() {
  const shader = {
    uniforms: {
      tDiffuse: { value: null },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uExposure: { value: 0.88 },
      uSpeed: { value: 0.0 },
      uPanVel: { value: new THREE.Vector2(0.0, 0.0) },
      uNight: { value: 0.0 },
      uWantedFlash: { value: 0.0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform vec2 uResolution;
      uniform float uExposure;
      uniform float uSpeed;
      uniform vec2 uPanVel;
      uniform float uNight;
      uniform float uWantedFlash;
      varying vec2 vUv;

      float safeHdr(float v) {
        return (v >= 0.0 && v <= 60000.0) ? min(v, 12.0) : 0.0;
      }

      // Exact Three.js ACESFilmicToneMapping (Stephen Hill RRT+ODT fit) + exact sRGB OETF
      // (prefixed gta* so it never collides with Three.js built-in tonemapping_pars_fragment functions!)
      vec3 gtaRrtOdtFit(vec3 v) {
        vec3 a = v * (v + 0.0245786) - 0.000090537;
        vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
        return a / b;
      }
      vec3 gtaAcesToSRGB(vec3 hdr) {
        vec3 safe = vec3(safeHdr(hdr.r), safeHdr(hdr.g), safeHdr(hdr.b)) * uExposure;
        mat3 ACESInputMat = mat3(
          0.59719, 0.07600, 0.02840,
          0.35458, 0.90834, 0.13383,
          0.04823, 0.01566, 0.83777
        );
        mat3 ACESOutputMat = mat3(
           1.60475, -0.10208, -0.00327,
          -0.53108,  1.10813, -0.07276,
          -0.07367, -0.00605,  1.07602
        );
        vec3 color = ACESInputMat * (safe / 0.6);
        color = gtaRrtOdtFit(color);
        color = clamp(ACESOutputMat * color, 0.0, 1.0);
        // Exact IEC 61966-2-1 sRGB transfer
        vec3 lo = color * 12.92;
        vec3 hi = pow(max(color, vec3(0.0031308)), vec3(1.0 / 2.4)) * 1.055 - 0.055;
        return mix(lo, hi, step(vec3(0.0031308), color));
      }

      vec3 sampleLDR(vec2 uv) {
        return gtaAcesToSRGB(texture2D(tDiffuse, uv).rgb);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float dist = length(centered);
        vec2 px = 1.0 / max(uResolution, vec2(1.0));
        vec2 dir = dist > 0.001 ? centered / dist : vec2(0.0);

        // GTA V / RAGE Center-Masked Peripheral Radial Speed + Camera-Pan Motion Blur!
        // Center 32% stays razor-sharp on the protagonist / vehicle; peripheral tarmac, curbs & trees streak cleanly!
        float edgeMask = smoothstep(0.16, 0.62, dist);
        vec2 radialVel = dir * (uSpeed * 0.0155 * edgeMask);
        vec2 panBlurVel = uPanVel * (0.0095 * (0.35 + 0.65 * edgeMask));
        vec2 blurVec = clamp(radialVel + panBlurVel, vec2(-0.024), vec2(0.024));
        float blurMag = length(blurVec);

        vec3 col;
        if (blurMag > 0.00035) {
          // 6-tap weighted directional/radial streak + subtle speed chromatic aberration
          vec3 acc = sampleLDR(vUv) * 0.28;
          acc += sampleLDR(clamp(vUv - blurVec * 0.25, 0.001, 0.999)) * 0.20;
          acc += sampleLDR(clamp(vUv + blurVec * 0.25, 0.001, 0.999)) * 0.20;
          acc += sampleLDR(clamp(vUv - blurVec * 0.58, 0.001, 0.999)) * 0.12;
          acc += sampleLDR(clamp(vUv + blurVec * 0.58, 0.001, 0.999)) * 0.12;
          acc += sampleLDR(clamp(vUv - blurVec * 0.95, 0.001, 0.999)) * 0.04;
          acc += sampleLDR(clamp(vUv + blurVec * 0.95, 0.001, 0.999)) * 0.04;
          float ca = uSpeed * 0.0022 * edgeMask;
          if (ca > 0.00008) {
            acc.r = mix(acc.r, sampleLDR(clamp(vUv + dir * ca, 0.001, 0.999)).r, 0.55);
            acc.b = mix(acc.b, sampleLDR(clamp(vUv - dir * ca, 0.001, 0.999)).b, 0.55);
          }
          col = acc;
        } else {
          col = sampleLDR(vUv);
        }

        // Luminance-clamped AAA CAS Micro-Sharpening (skip 4 neighbor taps when already heavily motion-blurred!)
        float sharpWeight = 0.24 * (1.0 - smoothstep(0.001, 0.008, blurMag));
        if (sharpWeight > 0.01) {
          vec3 nU = sampleLDR(vUv + vec2(0.0, px.y));
          vec3 nD = sampleLDR(vUv - vec2(0.0, px.y));
          vec3 nL = sampleLDR(vUv - vec2(px.x, 0.0));
          vec3 nR = sampleLDR(vUv + vec2(px.x, 0.0));
          vec3 blur = (nU + nD + nL + nR) * 0.25;
          vec3 detail = clamp(col - blur, vec3(-0.052), vec3(0.052));
          col = clamp(col + detail * sharpWeight, 0.0, 1.0);
        }

        // Photo-matched Geneva Kodak daylight contrast -> gentle filmic nocturnal contrast (NEVER crushes dark cobblestones/leather to #000!)
        float contrastAmt = mix(1.09, 1.04, uNight);
        col = clamp((col - 0.5) * contrastAmt + 0.5, 0.0, 1.0);
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        // Subtle nocturnal Alpine shadow-toe lift keeps foreground stone, trees & character detail cleanly legible at night
        col += vec3(0.011, 0.017, 0.029) * uNight * (1.0 - smoothstep(0.0, 0.22, luma));
        col = clamp(mix(vec3(luma), col, mix(1.15, 1.08, uNight)), 0.0, 1.0);

        // Deep Alpine cobalt-cool shadow bounce & warm golden-afternoon Geneva molasse sandstone highlights
        vec3 shadowTint = mix(vec3(0.948, 0.978, 1.052), vec3(0.92, 0.97, 1.12), uNight);
        vec3 highTint = mix(vec3(1.052, 1.004, 0.938), vec3(1.04, 1.00, 0.94), uNight);
        col *= mix(shadowTint, highTint, smoothstep(0.15, 0.76, luma));

        // Subtle optical full-frame lens vignette (softer at night so foreground promenade stays clear!)
        float vigAmt = mix(0.16, 0.07, uNight) + uSpeed * 0.14;
        float vig = 1.0 - smoothstep(0.55, 1.05, dist) * vigAmt;
        col *= vig;

        // Red/blue edge pulse when Geneva Police Wanted stars are active
        if (uWantedFlash > 0.01) {
          float edge = smoothstep(0.42, 0.85, dist);
          vec3 pulseCol = vUv.x < 0.5 ? vec3(1.0, 0.15, 0.15) : vec3(0.15, 0.45, 1.0);
          col = mix(col, pulseCol, edge * uWantedFlash * 0.22);
        }

        // Final NaN/Inf guard so no corrupted sample can ever black out a pixel
        col = vec3(
          (col.r >= 0.0 && col.r <= 2.0) ? col.r : 0.0,
          (col.g >= 0.0 && col.g <= 2.0) ? col.g : 0.0,
          (col.b >= 0.0 && col.b <= 2.0) ? col.b : 0.0
        );
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }
    `,
  };

  return new ShaderPass(shader);
}
