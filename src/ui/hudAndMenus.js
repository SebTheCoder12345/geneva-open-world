const BOOT_TIPS = [
  'Take any car along Quai du Général-Guisan. <kbd>F</kbd> gets in and out, <kbd>W A S D</kbd> drives.',
  "Fly the Swiss Rescue Helicopter from the Rade Helipad and circle the 140m Jet d'Eau.",
  'Board the yellow Mouette water taxi by the Rade pier to cruise across Lac Léman.',
  'Press <kbd>X</kbd> to fire your grapple hook and zip onto Geneva rooftops.',
  'Press <kbd>TAB</kbd> to open the interactive Geneva city map and drop custom waypoints.',
  'Press <kbd>ESC</kbd> or <kbd>P</kbd> to change time of day, toggle rain, or tune Geneva radio stations.',
];

export function createHudAndMenus(callbacks) {
  const els = {
    boot: document.getElementById('boot'),
    loadbar: document.getElementById('loadbar'),
    loadeta: document.getElementById('loadeta'),
    loadtxt: document.getElementById('loadtxt'),
    playbtn: document.getElementById('playbtn'),
    lwcap: document.getElementById('lwcap'),
    hud: document.getElementById('hud'),

    missionTag: document.getElementById('mission-tag'),
    missionTitle: document.getElementById('mission-title'),
    missionSub: document.getElementById('mission-sub'),
    wpIcon: document.getElementById('wp-icon'),
    wpText: document.getElementById('wp-text'),
    compassTrack: document.getElementById('compass-track'),
    cashDisplay: document.getElementById('cash-display'),
    vcLabel: document.getElementById('vc-label'),
    vcValue: document.getElementById('vc-value'),
    vcUnit: document.getElementById('vc-unit'),
    vcFill: document.getElementById('vc-fill'),
    fpsHud: document.getElementById('fps-hud'),
    wantedStars: document.getElementById('wanted-stars'),
    radioBanner: document.getElementById('radio-banner'),
    stuntToast: document.getElementById('stunt-toast'),
    streetPill: document.getElementById('street-pill'),
    actionPrompt: document.getElementById('action-prompt'),
    apKey: document.getElementById('ap-key'),
    apText: document.getElementById('ap-text'),
    hookPrompt: document.getElementById('hook-prompt'),
    subtitleBar: document.getElementById('subtitle-bar'),

    ctmenu: document.getElementById('ctmenu'),
    menuFps: document.getElementById('menu-fps-readout'),

    fbmodal: document.getElementById('fbmodal'),
    fbThumb: document.getElementById('fb-thumb'),
    fbMeta: document.getElementById('fb-meta'),
    fbNote: document.getElementById('fb-note'),

    creditsModal: document.getElementById('credits-modal'),
  };

  let tipIdx = 0;
  setInterval(() => {
    if (els.boot.classList.contains('hidden')) return;
    tipIdx = (tipIdx + 1) % BOOT_TIPS.length;
    els.lwcap.innerHTML = BOOT_TIPS[tipIdx];
  }, 5200);

  let selectedSpawn = 'rade';
  document.querySelectorAll('.district-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.district-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSpawn = btn.dataset.spawn;
      callbacks.onSelectSpawn(selectedSpawn);
    });
  });

  els.playbtn.addEventListener('click', () => {
    els.boot.classList.add('fade-out');
    setTimeout(() => els.boot.classList.add('hidden'), 460);
    els.hud.classList.remove('hidden');
    callbacks.onPlay(selectedSpawn);
  });

  // Pause menu tabs
  document.querySelectorAll('.ct-nav[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ct-nav[data-tab]').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.ct-pane').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('menu-resume').addEventListener('click', () => callbacks.onResume());
  document.getElementById('menu-open-map').addEventListener('click', () => callbacks.onOpenMapFromMenu());
  document.getElementById('menu-feedback').addEventListener('click', () => openFeedback());
  document.getElementById('menu-reset').addEventListener('click', () => {
    callbacks.onResetSettings();
    showSubtitle('Settings reset to defaults.', 2600);
  });

  // Corner pills
  document.getElementById('fsbtn').addEventListener('click', () => toggleFullscreen());
  document.getElementById('fblink').addEventListener('click', () => openFeedback());

  // Settings bindings
  function bindToggle(id, initial, onChange) {
    const btn = document.getElementById(id);
    let val = initial;
    const render = () => {
      btn.classList.toggle('on', val);
      btn.textContent = val ? 'On' : 'Off';
    };
    render();
    btn.addEventListener('click', () => {
      val = !val;
      render();
      onChange(val);
    });
    return (nextVal) => {
      val = nextVal;
      render();
    };
  }

  const setTogFps = bindToggle('tog-fps', false, (v) => {
    els.fpsHud.classList.toggle('hidden', !v);
  });
  const setTogFs = bindToggle('tog-fs', false, () => toggleFullscreen());
  const setTogRain = bindToggle('tog-rain', false, (v) => callbacks.onSetRain(v));
  const setTogFlash = bindToggle('tog-flash', false, (v) => callbacks.onSetFlashlight(v));
  const setTogDayCycle = bindToggle('tog-daycycle', true, (v) => callbacks.onSetDayCycle(v));
  const setTogInvert = bindToggle('tog-invert', false, (v) => callbacks.onSetInvertY(v));

  let subsEnabled = true;
  const setTogSubs = bindToggle('tog-subs', true, (v) => {
    subsEnabled = v;
    if (!v) els.subtitleBar.classList.add('hidden');
  });

  // Quality segmented control
  document.querySelectorAll('#quality-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#quality-seg button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      callbacks.onSetQuality(btn.dataset.q);
    });
  });

  // Radio segmented control
  document.querySelectorAll('#radio-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#radio-seg button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      callbacks.onSetRadio(btn.dataset.r);
    });
  });

  // Weather & Season segmented control (Summer / Rain / Alpine Storm / Winter Geneva)
  function syncWeather(mode) {
    document.querySelectorAll('#weather-seg button').forEach((b) => {
      b.classList.toggle('active', b.dataset.w === mode);
    });
    setTogRain(mode === 'rain' || mode === 'storm');
  }
  document.querySelectorAll('#weather-seg button').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncWeather(btn.dataset.w);
      callbacks.onSetWeather?.(btn.dataset.w);
    });
  });

  // Sliders
  const rngTod = document.getElementById('rng-tod');
  const todVal = document.getElementById('tod-val');
  function formatTime(h) {
    const hh = Math.floor(h) % 24;
    const mm = Math.floor((h - Math.floor(h)) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  rngTod.addEventListener('input', () => {
    const v = parseFloat(rngTod.value);
    todVal.textContent = formatTime(v);
    callbacks.onSetTimeOfDay(v);
  });

  const rngSens = document.getElementById('rng-sens');
  const sensVal = document.getElementById('sens-val');
  rngSens.addEventListener('input', () => {
    const v = parseFloat(rngSens.value);
    sensVal.textContent = `${v.toFixed(2)}×`;
    callbacks.onSetSensitivity(v);
  });

  const bindVol = (id, valId, key) => {
    const r = document.getElementById(id);
    const lbl = document.getElementById(valId);
    r.addEventListener('input', () => {
      lbl.textContent = `${r.value}%`;
      callbacks.onSetVolume(key, parseFloat(r.value) / 100);
    });
  };
  bindVol('rng-vol-master', 'vol-master-val', 'master');
  bindVol('rng-vol-eng', 'vol-eng-val', 'engine');
  bindVol('rng-vol-city', 'vol-city-val', 'city');
  bindVol('rng-vol-radio', 'vol-radio-val', 'radio');

  const rngSubSize = document.getElementById('rng-subsize');
  const subSizeVal = document.getElementById('subsize-val');
  const subPreview = document.getElementById('sub-preview');
  rngSubSize.addEventListener('input', () => {
    subSizeVal.textContent = `${rngSubSize.value}%`;
    const px = (14 * parseFloat(rngSubSize.value)) / 100;
    subPreview.style.fontSize = `${px}px`;
    els.subtitleBar.style.fontSize = `${px}px`;
  });

  // Feedback modal
  function openFeedback() {
    const snap = callbacks.onCaptureFeedback();
    els.fbThumb.src = snap.image;
    els.fbMeta.textContent = snap.meta;
    els.fbNote.value = '';
    els.fbmodal.classList.remove('hidden');
  }
  document.getElementById('fb-close').addEventListener('click', () => els.fbmodal.classList.add('hidden'));
  document.getElementById('fb-cancel').addEventListener('click', () => els.fbmodal.classList.add('hidden'));
  document.getElementById('fb-send').addEventListener('click', () => {
    const reports = JSON.parse(localStorage.getItem('geneva_feedback') || '[]');
    reports.push({ at: new Date().toISOString(), meta: els.fbMeta.textContent, note: els.fbNote.value });
    localStorage.setItem('geneva_feedback', JSON.stringify(reports));
    els.fbmodal.classList.add('hidden');
    showSubtitle('Feedback saved locally. Thank you!', 2600);
  });

  // Credits modal
  document.getElementById('credits-open').addEventListener('click', (e) => {
    e.preventDefault();
    els.creditsModal.classList.remove('hidden');
  });
  document.getElementById('credits-close').addEventListener('click', () => {
    els.creditsModal.classList.add('hidden');
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setTogFs(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setTogFs(false);
    }
  }

  let subTimer = null;
  function showSubtitle(text, ms = 4200) {
    if (!subsEnabled) return;
    els.subtitleBar.textContent = text;
    els.subtitleBar.classList.remove('hidden');
    if (subTimer) clearTimeout(subTimer);
    subTimer = setTimeout(() => els.subtitleBar.classList.add('hidden'), ms);
  }

  let radioTimer = null;
  function showRadioBanner(label) {
    els.radioBanner.textContent = `📻 ${label}`;
    els.radioBanner.classList.remove('hidden');
    if (radioTimer) clearTimeout(radioTimer);
    radioTimer = setTimeout(() => els.radioBanner.classList.add('hidden'), 2800);
  }

  let stuntTimer = null;
  function showStuntToast(label) {
    els.stuntToast.textContent = label;
    els.stuntToast.classList.remove('hidden');
    if (stuntTimer) clearTimeout(stuntTimer);
    stuntTimer = setTimeout(() => els.stuntToast.classList.add('hidden'), 2200);
  }

  // Dirty-checking DOM helper so we NEVER trigger layout/style recalculation 60x/sec when HUD values haven't changed!
  const _lastText = new WeakMap();
  function setText(el, val) {
    if (!el) return;
    if (_lastText.get(el) !== val) {
      _lastText.set(el, val);
      el.textContent = val;
    }
  }
  let lastCompassStep = -999;
  let lastVcWidth = '';
  let lastWanted = -1;
  let lastPrompt = null;
  let lastPromptKey = 'F';

  return {
    setLoadProgress(pct, label) {
      els.loadbar.style.width = `${pct}%`;
      els.loadtxt.textContent = `${Math.round(pct)}%`;
      els.loadeta.textContent = label;
      document.title = pct < 100 ? `${Math.round(pct)}% · GENEVA` : 'GENEVA';
      if (pct >= 100) {
        els.playbtn.disabled = false;
        els.playbtn.classList.add('ready');
      }
    },
    setMenuOpen(open) {
      els.ctmenu.classList.toggle('hidden', !open);
    },
    isMenuOpen() {
      return !els.ctmenu.classList.contains('hidden');
    },
    openFeedback,
    toggleFullscreen,
    showSubtitle,
    showRadioBanner,
    showStuntToast,
    syncTimeOfDay(h) {
      rngTod.value = h.toFixed(1);
      todVal.textContent = formatTime(h);
    },
    syncWeather,
    updateHud({
      mission,
      missionDist,
      waypointText,
      waypointIcon,
      cash,
      vehicle,
      foundCount,
      totalCollectibles,
      street,
      promptText,
      promptKey = 'F',
      fps,
      drawCalls = 0,
      quality,
      wantedLevel = 0,
      camYaw = 0,
    }) {
      // Live GTA/Open-World Top Compass Heading Bar (only rebuild HTML when 45-deg step actually changes!)
      if (els.compassTrack) {
        const deg = (((-camYaw * 180) / Math.PI) % 360 + 360) % 360;
        const baseStep = Math.round(deg / 45);
        if (baseStep !== lastCompassStep) {
          lastCompassStep = baseStep;
          const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
          let html = '';
          for (let k = -2; k <= 2; k++) {
            const lbl = dirs[(((baseStep + k) % 8) + 8) % 8];
            const isCard = lbl.length === 1;
            html += `<span class="cmp-item${k === 0 ? ' active' : ''}${isCard ? ' card' : ''}">${lbl}</span>`;
          }
          els.compassTrack.innerHTML = html;
        }
      }
      if (wantedLevel !== lastWanted) {
        lastWanted = wantedLevel;
        if (wantedLevel > 0) {
          els.wantedStars.classList.remove('hidden');
          setText(els.wantedStars, '★'.repeat(wantedLevel) + '☆'.repeat(5 - wantedLevel));
        } else {
          els.wantedStars.classList.add('hidden');
        }
      }
      setText(els.missionTag, mission.tag);
      setText(els.missionTitle, mission.title);
      setText(
        els.missionSub,
        mission.type === 'freeroam' ? mission.sub : `${mission.sub} · ${Math.round(missionDist)} m`
      );

      setText(els.wpIcon, waypointIcon);
      setText(els.wpText, waypointText);
      setText(els.cashDisplay, `CHF ${cash.toLocaleString()}`);
      setText(els.streetPill, street);

      let nextWidth = '0%';
      if (vehicle) {
        setText(els.vcLabel, vehicle.label);
        if (vehicle.type === 'heli') {
          setText(els.vcValue, `ALT ${Math.round(vehicle.y)} m`);
          setText(els.vcUnit, `${Math.round(Math.hypot(vehicle.vx, vehicle.vz) * 3.6)} km/h`);
          nextWidth = `${Math.round(Math.min(100, (vehicle.y / 140) * 100))}%`;
        } else {
          const kmh = Math.round(Math.abs(vehicle.speed) * 3.6);
          setText(els.vcValue, `${kmh} km/h`);
          const isTransit = vehicle.type === 'tram' || vehicle.type === 'transit_bus';
          const unitLabel =
            vehicle.type === 'boat'
              ? 'LAC LÉMAN'
              : vehicle.type === 'tram'
              ? vehicle.transitMode === 'drive'
                ? 'TRAM RAIL'
                : 'PASSENGER'
              : vehicle.type === 'transit_bus'
              ? 'PASSENGER'
              : vehicle.style === 'bus'
              ? 'TPG BUS'
              : 'DRIVE';
          setText(els.vcUnit, unitLabel);
          const maxGauge = isTransit || vehicle.style === 'bus' ? 65 : 150;
          nextWidth = `${Math.round(Math.min(100, (kmh / maxGauge) * 100))}%`;
        }
        els.hookPrompt.classList.add('hidden');
      } else {
        setText(els.vcLabel, 'ON FOOT');
        setText(els.vcValue, `${foundCount} / ${totalCollectibles}`);
        setText(els.vcUnit, 'CHRONOS');
        nextWidth = `${Math.round((foundCount / Math.max(1, totalCollectibles)) * 100)}%`;
        els.hookPrompt.classList.remove('hidden');
      }
      if (nextWidth !== lastVcWidth) {
        lastVcWidth = nextWidth;
        els.vcFill.style.width = nextWidth;
      }

      if (promptText !== lastPrompt || promptKey !== lastPromptKey) {
        lastPrompt = promptText;
        lastPromptKey = promptKey;
        if (promptText) {
          setText(els.apKey, promptKey);
          setText(els.apText, promptText);
          els.actionPrompt.classList.toggle('steal', promptText.startsWith('STEAL '));
          els.actionPrompt.classList.remove('hidden');
        } else {
          els.actionPrompt.classList.remove('steal');
          els.actionPrompt.classList.add('hidden');
        }
      }

      setText(els.fpsHud, drawCalls > 0 ? `${fps} FPS · ${drawCalls} DC` : `${fps} FPS`);
      setText(els.menuFps, `${fps} fps on ${quality[0].toUpperCase() + quality.slice(1)}`);
    },
    resetToggles() {
      setTogFps(false);
      setTogRain(false);
      setTogFlash(false);
      setTogDayCycle(true);
      setTogInvert(false);
      setTogSubs(true);
    },
  };
}
