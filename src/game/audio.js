// Procedural Web Audio API GTA Sound Engine (V8 Ferrari growl, drift screech, Swiss two-tone siren, Jet d'Eau mist & radio)
export function createAudioEngine() {
  let ctx = null;
  let masterGain = null;
  let engGain = null;
  let cityGain = null;
  let radioGain = null;
  let screechGain = null;
  let sirenGain = null;

  let engOsc = null;
  let engSubOsc = null;
  let engFilter = null;
  let sirenOsc = null;
  let sharedNoiseBuf = null;
  let muted = false;

  const vols = {
    master: 0.8,
    engine: 0.85,
    city: 0.75,
    radio: 0.6,
  };

  let radioStation = 'off';
  let radioTimer = null;

  const CHORDS = {
    couleur: [220, 261.63, 329.63, 392.0],
    lac: [196, 246.94, 293.66, 369.99],
    paquis: [174.61, 220, 261.63, 329.63],
    nations: [233.08, 293.66, 349.23, 440],
  };

  function ensureInit() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();

    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : vols.master;
    masterGain.connect(ctx.destination);

    engGain = ctx.createGain();
    engGain.gain.value = 0;
    engGain.connect(masterGain);

    cityGain = ctx.createGain();
    cityGain.gain.value = vols.city * 0.06;
    cityGain.connect(masterGain);

    radioGain = ctx.createGain();
    radioGain.gain.value = vols.radio * 0.14;
    radioGain.connect(masterGain);

    screechGain = ctx.createGain();
    screechGain.gain.value = 0;
    screechGain.connect(masterGain);

    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenGain.connect(masterGain);

    // Filtered white noise buffer (shared for lake breeze, footsteps, sneaker scuffs & tire drift screech!)
    const bufSize = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    sharedNoiseBuf = noiseBuf;

    const lakeNoise = ctx.createBufferSource();
    lakeNoise.buffer = noiseBuf;
    lakeNoise.loop = true;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 420;
    lakeNoise.connect(lpf);
    lpf.connect(cityGain);
    lakeNoise.start();

    // Tire screech bandpass filter
    const screechNoise = ctx.createBufferSource();
    screechNoise.buffer = noiseBuf;
    screechNoise.loop = true;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 1450;
    bpf.Q.value = 6.5;
    screechNoise.connect(bpf);
    bpf.connect(screechGain);
    screechNoise.start();

    // Dual-oscillator Ferrari V8 / Helicopter engine
    engOsc = ctx.createOscillator();
    engOsc.type = 'sawtooth';
    engOsc.frequency.value = 55;
    engSubOsc = ctx.createOscillator();
    engSubOsc.type = 'triangle';
    engSubOsc.frequency.value = 27.5;
    engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 220;
    engOsc.connect(engFilter);
    engSubOsc.connect(engFilter);
    engFilter.connect(engGain);
    engOsc.start();
    engSubOsc.start();

    // Authentic Swiss two-tone police siren oscillator
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 440;
    sirenOsc.connect(sirenGain);
    sirenOsc.start();
  }

  function applyVolumes() {
    if (!ctx) return;
    masterGain.gain.setTargetAtTime(muted ? 0 : vols.master, ctx.currentTime, 0.05);
    radioGain.gain.setTargetAtTime(vols.radio * 0.14, ctx.currentTime, 0.05);
  }

  function playChime(isMission = false) {
    ensureInit();
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    const notes = isMission ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now + idx * 0.08);
      g.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.42);
      o.connect(g);
      g.connect(masterGain);
      o.start(now + idx * 0.08);
      o.stop(now + idx * 0.08 + 0.45);
    });
  }

  function playRadioPulse() {
    if (!ctx || muted || radioStation === 'off') return;
    const notes = CHORDS[radioStation] || CHORDS.couleur;
    const freq = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.7 ? 2 : 1);
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = radioStation === 'nations' ? 'sine' : 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.28, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    o.connect(g);
    g.connect(radioGain);
    o.start(now);
    o.stop(now + 1.35);
  }

  function setRadio(station) {
    radioStation = station;
    if (radioTimer) clearInterval(radioTimer);
    radioTimer = null;
    if (station !== 'off') {
      ensureInit();
      playRadioPulse();
      radioTimer = setInterval(playRadioPulse, 1100);
    }
  }

  function update(activeVehicle, playerPos, telemetry = {}, wantedLevel = 0, elapsed = 0) {
    if (!ctx) return;
    const now = ctx.currentTime;

    const dJet = Math.hypot(playerPos.x - 457.8, playerPos.z - -147.0);
    const jetBoost = Math.max(0, 1 - dJet / 180) * 0.16;
    cityGain.gain.setTargetAtTime(vols.city * (0.04 + jetBoost), now, 0.1);

    if (activeVehicle) {
      if (activeVehicle.type === 'heli') {
        const spd = Math.hypot(activeVehicle.vx, activeVehicle.vy, activeVehicle.vz);
        engOsc.type = 'triangle';
        engOsc.frequency.setTargetAtTime(28 + spd * 0.45, now, 0.08);
        engSubOsc.frequency.setTargetAtTime(14 + spd * 0.22, now, 0.08);
        engFilter.frequency.setTargetAtTime(160 + spd * 3, now, 0.08);
        engGain.gain.setTargetAtTime(vols.engine * 0.15, now, 0.1);
      } else if (activeVehicle.style === 'escooter') {
        // Sleek quiet Geneva electric trotinette brushless hub-motor whine!
        const spd = Math.abs(activeVehicle.speed || 0);
        const boostPitch = telemetry.isBoosting ? 1.18 : 1.0;
        const baseFreq = (185 + spd * 24) * boostPitch;
        engOsc.type = 'sine';
        engOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
        engSubOsc.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.05);
        engFilter.frequency.setTargetAtTime(950 + spd * 60, now, 0.05);
        engGain.gain.setTargetAtTime(spd > 0.3 ? vols.engine * (0.018 + Math.min(0.055, spd * 0.004)) : 0, now, 0.08);
      } else if (activeVehicle.type === 'tram' || activeVehicle.style === 'tram') {
        // Authentic Geneva Stadler Tango electric traction inverter hum + soft rail resonance!
        const spd = Math.abs(activeVehicle.speed || 0);
        const baseFreq = 98 + spd * 13.5;
        engOsc.type = 'sine';
        engOsc.frequency.setTargetAtTime(baseFreq, now, 0.07);
        engSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.07);
        engFilter.frequency.setTargetAtTime(420 + spd * 38, now, 0.07);
        engGain.gain.setTargetAtTime(spd > 0.25 ? vols.engine * (0.022 + Math.min(0.068, spd * 0.0045)) : vols.engine * 0.008, now, 0.1);
      } else if (activeVehicle.style === 'bus') {
        // Authentic Mercedes Citaro TPG City Bus deep low-RPM engine purr!
        const spd = Math.abs(activeVehicle.speed || 0);
        const baseFreq = 36 + spd * 1.55;
        engOsc.type = 'sawtooth';
        engOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
        engSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.08);
        engFilter.frequency.setTargetAtTime(125 + spd * 6.5, now, 0.08);
        engGain.gain.setTargetAtTime(vols.engine * (0.042 + Math.min(0.075, spd * 0.003)), now, 0.1);
      } else {
        const spd = Math.abs(activeVehicle.speed || 0);
        const boostPitch = telemetry.isBoosting ? 1.25 : 1.0;
        const baseFreq = (52 + spd * 2.7) * boostPitch;
        engOsc.type = 'sawtooth';
        engOsc.frequency.setTargetAtTime(baseFreq, now, 0.05);
        engSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
        engFilter.frequency.setTargetAtTime(180 + spd * 11 * boostPitch, now, 0.05);
        engGain.gain.setTargetAtTime(vols.engine * (0.055 + Math.min(0.12, spd * 0.0035)), now, 0.08);
      }
    } else {
      engGain.gain.setTargetAtTime(0, now, 0.12);
    }

    // Tire screech during drift!
    screechGain.gain.setTargetAtTime(telemetry.isDrifting ? vols.engine * 0.11 : 0, now, 0.04);

    // Authentic Swiss two-tone police siren (A4 440Hz / D5 587Hz) when Wanted!
    if (wantedLevel > 0) {
      const tone = Math.sin(elapsed * 5.2) > 0 ? 587.33 : 440.0;
      const prox = Math.max(0.2, 1 - (telemetry.policeDist || 80) / 280);
      sirenOsc.frequency.setTargetAtTime(tone, now, 0.02);
      sirenGain.gain.setTargetAtTime(vols.engine * 0.075 * prox, now, 0.08);
    } else {
      sirenGain.gain.setTargetAtTime(0, now, 0.1);
    }
  }

  // GTA Car Stealing SFX: mechanical door-yank/slam thud + 5 European dual-tone car alarm pulses!
  function playCarStealAlarm() {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;

    // 1. Low door-yank / heavy door-slam thud
    const slam = ctx.createOscillator();
    const slamG = ctx.createGain();
    slam.type = 'sine';
    slam.frequency.setValueAtTime(125, now);
    slam.frequency.exponentialRampToValueAtTime(38, now + 0.16);
    slamG.gain.setValueAtTime(0.001, now);
    slamG.gain.linearRampToValueAtTime(0.32 * vols.engine, now + 0.015);
    slamG.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    slam.connect(slamG);
    slamG.connect(masterGain);
    slam.start(now);
    slam.stop(now + 0.24);

    // 2. Crisp 5-beep European dual-tone car alarm horn
    for (let i = 0; i < 5; i++) {
      const t0 = now + 0.22 + i * 0.42;
      for (const freq of [520, 655]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(freq, t0);
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(0.08 * vols.engine, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
        o.connect(g);
        g.connect(masterGain);
        o.start(t0);
        o.stop(t0 + 0.24);
      }
    }
  }

  // Crisp low-end impact thud for hard rooftop landings, parkour combat rolls & vehicle knockdowns!
  function playImpactThud(strength = 1.0) {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(115 + strength * 30, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.18);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(Math.min(0.42, 0.24 * strength * vols.engine), now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Filtered burst splash SFX when plunging into Lac Léman!
  function playWaterSplash() {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.42);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.14));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(920, now);
    filt.frequency.exponentialRampToValueAtTime(280, now + 0.36);
    filt.Q.value = 0.85;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * vols.city, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
    src.connect(filt);
    filt.connect(g);
    g.connect(masterGain);
    src.start(now);
  }

  // Crisp procedural two-layer sneaker-on-granite footstep synced to exact heel-strike (zero GC buffers!)
  function playFootstep(kind = 'jog', foot = 'L', intensity = 0.7) {
    if (!ctx || !masterGain || !sharedNoiseBuf || muted) return;
    if (ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const footJitter = (foot === 'L' ? 0.94 : 1.06) * (0.95 + Math.random() * 0.10);
    const volScale =
      (kind === 'crouch' ? 0.24 : kind === 'walk' ? 0.48 : kind === 'sprint' ? 1.05 : 0.74) *
      (0.55 + intensity * 0.45) *
      vols.city;

    // 1. Subtle rubber-sole low heel thump
    const thump = ctx.createOscillator();
    const thumpG = ctx.createGain();
    thump.type = 'triangle';
    const baseHz = (kind === 'sprint' ? 128 : kind === 'jog' ? 110 : 92) * footJitter;
    thump.frequency.setValueAtTime(baseHz, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.048);
    thumpG.gain.setValueAtTime(0.001, now);
    thumpG.gain.linearRampToValueAtTime(0.11 * volScale, now + 0.005);
    thumpG.gain.exponentialRampToValueAtTime(0.0008, now + 0.055);
    thump.connect(thumpG);
    thumpG.connect(masterGain);
    thump.start(now);
    thump.stop(now + 0.06);

    // 2. Tactile Swiss granite grit transient
    const grit = ctx.createBufferSource();
    grit.buffer = sharedNoiseBuf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = (kind === 'sprint' ? 1850 : kind === 'jog' ? 1550 : 1220) * footJitter;
    bpf.Q.value = 1.6;
    const gritG = ctx.createGain();
    gritG.gain.setValueAtTime(0.001, now);
    gritG.gain.linearRampToValueAtTime(0.075 * volScale, now + 0.004);
    gritG.gain.exponentialRampToValueAtTime(0.0008, now + (kind === 'sprint' ? 0.046 : 0.036));
    grit.connect(bpf);
    bpf.connect(gritG);
    gritG.connect(masterGain);
    grit.start(now, Math.random() * 1.4, 0.06);
  }

  // Crisp rubber-sole sneaker scuff for 180° pivot turns & hard sprint stops!
  function playShoeScuff() {
    if (!ctx || !masterGain || !sharedNoiseBuf || muted) return;
    if (ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = sharedNoiseBuf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(2200, now);
    bpf.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    bpf.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.095 * vols.city, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.14);
    src.connect(bpf);
    bpf.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.4, 0.15);
  }

  // Subtle athletic push-off whoosh when jumping!
  function playJumpPush() {
    if (!ctx || !masterGain || !sharedNoiseBuf || muted) return;
    if (ctx.state === 'suspended') return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = sharedNoiseBuf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.setValueAtTime(520, now);
    bpf.frequency.exponentialRampToValueAtTime(1400, now + 0.10);
    bpf.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.07 * vols.city, now + 0.018);
    g.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
    src.connect(bpf);
    bpf.connect(g);
    g.connect(masterGain);
    src.start(now, Math.random() * 1.4, 0.14);
  }

  // Iconic Geneva TPG Stadler Tango double-strike brass/electric tram warning bell (DING-DING!)
  function playTramBell() {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    for (const offset of [0, 0.19]) {
      const t0 = now + offset;
      for (const [freq, amp, decay] of [
        [1318.5, 0.13, 0.55],
        [2637.0, 0.07, 0.38],
        [3951.0, 0.035, 0.22],
      ]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.001, t0);
        g.gain.linearRampToValueAtTime(amp * vols.engine, t0 + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0008, t0 + decay);
        o.connect(g);
        g.connect(masterGain);
        o.start(t0);
        o.stop(t0 + decay + 0.02);
      }
    }
  }

  // Swiss TPG door button beep + pneumatic sliding door air hiss!
  function playTransitDoor() {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    for (const [idx, freq] of [880, 1174.66].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      const t0 = now + idx * 0.075;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.09 * vols.city, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.16);
      o.connect(g);
      g.connect(masterGain);
      o.start(t0);
      o.stop(t0 + 0.18);
    }
    if (sharedNoiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = sharedNoiseBuf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(1800, now + 0.08);
      bpf.frequency.exponentialRampToValueAtTime(680, now + 0.38);
      bpf.Q.value = 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now + 0.08);
      g.gain.linearRampToValueAtTime(0.085 * vols.city, now + 0.13);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.40);
      src.connect(bpf);
      bpf.connect(g);
      g.connect(masterGain);
      src.start(now + 0.08, Math.random() * 1.2, 0.34);
    }
  }

  // Authentic Swiss 3-note TPG next-stop cabin announcement chime (G5 -> E5 -> C5)!
  function playTpgStopChime() {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    const notes = [783.99, 659.25, 523.25];
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = now + idx * 0.14;
      g.gain.setValueAtTime(0.001, t0);
      g.gain.linearRampToValueAtTime(0.11 * vols.city, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      o.connect(g);
      g.connect(masterGain);
      o.start(t0);
      o.stop(t0 + 0.45);
    });
  }

  // Realistic layered vehicle crash / metallic bumper crunch SFX (rate-limited so wall-scrapes sound clean!)
  let lastCrashTime = 0;
  function playCarCrash(intensity = 6, isMetal = true) {
    ensureInit();
    if (!ctx || !masterGain || muted) return;
    const now = ctx.currentTime;
    if (now - lastCrashTime < 0.18) return;
    lastCrashTime = now;
    const lvl = Math.min(1.0, Math.max(0.18, (intensity - 1.8) / 18));

    // 1. Heavy low-frequency chassis impact thud
    const thud = ctx.createOscillator();
    const thudG = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(115 + lvl * 45, now);
    thud.frequency.exponentialRampToValueAtTime(30, now + 0.16 + lvl * 0.12);
    thudG.gain.setValueAtTime(0.001, now);
    thudG.gain.linearRampToValueAtTime((0.22 + lvl * 0.28) * vols.engine, now + 0.008);
    thudG.gain.exponentialRampToValueAtTime(0.001, now + 0.22 + lvl * 0.14);
    thud.connect(thudG);
    thudG.connect(masterGain);
    thud.start(now);
    thud.stop(now + 0.40);

    // 2. Bandpass metallic panel crunch / concrete grind burst
    if (sharedNoiseBuf) {
      const src = ctx.createBufferSource();
      src.buffer = sharedNoiseBuf;
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.setValueAtTime(isMetal ? 1450 : 620, now);
      bpf.frequency.exponentialRampToValueAtTime(isMetal ? 480 : 210, now + 0.24);
      bpf.Q.value = isMetal ? 2.2 : 1.1;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.001, now);
      ng.gain.linearRampToValueAtTime((0.14 + lvl * 0.24) * vols.engine, now + 0.01);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18 + lvl * 0.18);
      src.connect(bpf);
      bpf.connect(ng);
      ng.connect(masterGain);
      src.start(now, Math.random() * 1.2, 0.40);
    }

    // 3. Subtle metallic fender ring on hard car-to-car or pole hits
    if (isMetal && lvl > 0.32) {
      const ring = ctx.createOscillator();
      const rg = ctx.createGain();
      ring.type = 'triangle';
      ring.frequency.setValueAtTime(640 + Math.random() * 180, now);
      ring.frequency.exponentialRampToValueAtTime(290, now + 0.18);
      rg.gain.setValueAtTime(0.001, now);
      rg.gain.linearRampToValueAtTime(0.08 * lvl * vols.engine, now + 0.006);
      rg.gain.exponentialRampToValueAtTime(0.0008, now + 0.20);
      ring.connect(rg);
      rg.connect(masterGain);
      ring.start(now);
      ring.stop(now + 0.22);
    }
  }

  return {
    ensureInit,
    playChime,
    playCarStealAlarm,
    playCarCrash,
    playImpactThud,
    playWaterSplash,
    playFootstep,
    playShoeScuff,
    playJumpPush,
    playTramBell,
    playTransitDoor,
    playTpgStopChime,
    setRadio,
    getRadio: () => radioStation,
    update,
    setVolume(key, v01) {
      vols[key] = v01;
      applyVolumes();
    },
    toggleMute() {
      muted = !muted;
      applyVolumes();
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
