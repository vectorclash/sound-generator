import { state, rootName, scaleName, TICK_MS, SCALE_NAMES, pick } from './state.js';
import { audio, initAudio } from './audio/context.js';
import {
  tick, pickVoices, setActiveVoices, resetTickTimer,
  bassVoice, padVoice, melodyVoice, textureVoice, pluckVoice,
  bellVoice, arpeggioVoice, malletVoice, droneVoice, fluteVoice,
  choirVoice, stringsVoice, rhodesVoice, organVoice, glassVoice,
  harpVoice, brassVoice, drumsVoice,
  vibraphoneVoice, clavinetVoice, sitarVoice, kalimbaVoice,
  activeVoices, eraTimer, ERA_DURATION,
} from './audio/scheduler.js';
import { startAnimation } from './visuals/animate.js';

// ─── Definitions ──────────────────────────────────────────────────────────────
const ROOT_NAMES   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const SCALE_LABELS = ['AEOLIAN','DORIAN','PHRYGIAN','PENT MINOR','PENT MAJOR','LYDIAN','MIXOLYDIAN'];

const GENRES = [
  { name:'AMBIENT', scaleIdx:5, tempo:65,  density:0.25, brightness:0.25, spaciousness:0.88 },
  { name:'DARK',    scaleIdx:2, tempo:72,  density:0.45, brightness:0.12, spaciousness:0.65 },
  { name:'JAZZ',    scaleIdx:1, tempo:112, density:0.75, brightness:0.50, spaciousness:0.40 },
  { name:'ELEC',    scaleIdx:3, tempo:128, density:0.82, brightness:0.72, spaciousness:0.28 },
  { name:'ORCH',    scaleIdx:0, tempo:82,  density:0.60, brightness:0.38, spaciousness:0.78 },
  { name:'ZEN',     scaleIdx:4, tempo:56,  density:0.18, brightness:0.40, spaciousness:0.94 },
];

const BASS_SUBTYPES  = ['sub','plucked','walking','synth','rumble'];
const DRUMS_SUBTYPES = ['minimal','four_four','jungle','shuffle','trap','ghost','halftime','breakbeat','bossanova'];
const BASS_LABELS    = { sub:'SUB', plucked:'PLUCK', walking:'WALK', synth:'SYNTH', rumble:'RUMBLE' };
const DRUMS_LABELS   = { minimal:'MINIMAL', four_four:'4/4', jungle:'JUNGLE', shuffle:'SHUFFLE', trap:'TRAP', ghost:'GHOST', halftime:'HALF TIME', breakbeat:'BREAK', bossanova:'BOSSA' };

const SIMPLE_VOICES = [
  { key:'pad',      voice:padVoice },
  { key:'melody',   voice:melodyVoice },
  { key:'texture',  voice:textureVoice },
  { key:'pluck',    voice:pluckVoice },
  { key:'bell',     voice:bellVoice },
  { key:'arpeggio', voice:arpeggioVoice },
  { key:'mallet',   voice:malletVoice },
  { key:'drone',    voice:droneVoice },
  { key:'flute',    voice:fluteVoice },
  { key:'choir',    voice:choirVoice },
  { key:'strings',  voice:stringsVoice },
  { key:'rhodes',     voice:rhodesVoice },
  { key:'organ',      voice:organVoice },
  { key:'glass',      voice:glassVoice },
  { key:'harp',       voice:harpVoice },
  { key:'brass',      voice:brassVoice },
  { key:'vibraphone', voice:vibraphoneVoice },
  { key:'clavinet',   voice:clavinetVoice },
  { key:'sitar',      voice:sitarVoice },
  { key:'kalimba',    voice:kalimbaVoice },
];

// ─── UI refs ──────────────────────────────────────────────────────────────────
const startBtn        = document.getElementById('start-btn');
const infoEl          = document.getElementById('info');
const stateEl         = document.getElementById('state-line');
const infiniteUi      = document.getElementById('infinite-ui');
const manualUi        = document.getElementById('manual-ui');
const genreBtnsEl     = document.getElementById('genre-btns');
const rootSelect      = document.getElementById('manual-root');
const scaleSelect     = document.getElementById('manual-scale');
const bpmSlider       = document.getElementById('manual-bpm-slider');
const bpmValue        = document.getElementById('manual-bpm-value');
const densitySlider   = document.getElementById('density-slider');
const densityVal      = document.getElementById('density-val');
const brightSlider    = document.getElementById('bright-slider');
const brightVal       = document.getElementById('bright-val');
const spaceSlider     = document.getElementById('space-slider');
const spaceVal        = document.getElementById('space-val');
const lengthInput     = document.getElementById('manual-length');
const lengthValue     = document.getElementById('manual-length-value');
const voiceGroups     = document.getElementById('voice-groups');
const manualPlayBtn        = document.getElementById('manual-play-btn');
const manualExportBtn      = document.getElementById('manual-export-btn');
const manualStatus         = document.getElementById('manual-status');
const exportCountdown      = document.getElementById('export-countdown');
const exportProgressWrap   = document.getElementById('export-progress-wrap');
const exportProgressBar    = document.getElementById('export-progress-bar');
const clearInstrumentsBtn  = document.getElementById('clear-instruments-btn');
const modeTabs             = document.querySelectorAll('.mode-tab');

// ─── Enable state (all off by default) ───────────────────────────────────────
const manualEnabled = {};
BASS_SUBTYPES.forEach(s  => { manualEnabled[`bass:${s}`]  = false; });
DRUMS_SUBTYPES.forEach(s => { manualEnabled[`drums:${s}`] = false; });
SIMPLE_VOICES.forEach(({ key }) => { manualEnabled[key] = false; });

// ─── Playback state ───────────────────────────────────────────────────────────
let currentMode       = 'infinite';
let infiniteRunning   = false;
let infiniteInterval  = null;
let manualPlaying     = false;
let manualInterval    = null;
let currentRecorder   = null;
let exportId          = 0;      // incremented on each new export or cancellation
let exportPreTimeout  = null;
let exportTailTimeout = null;

// ─── Populate selects ─────────────────────────────────────────────────────────
ROOT_NAMES.forEach((name, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = name;
  rootSelect.appendChild(o);
});
SCALE_LABELS.forEach((label, i) => {
  const o = document.createElement('option');
  o.value = i; o.textContent = label;
  scaleSelect.appendChild(o);
});

// ─── Genre buttons ────────────────────────────────────────────────────────────
GENRES.forEach(g => {
  const btn = document.createElement('button');
  btn.className = 'genre-btn';
  btn.textContent = g.name;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    scaleSelect.value      = g.scaleIdx;
    bpmSlider.value        = g.tempo;
    bpmValue.textContent   = g.tempo;
    densitySlider.value    = g.density;
    densityVal.textContent = g.density.toFixed(2);
    brightSlider.value     = g.brightness;
    brightVal.textContent  = g.brightness.toFixed(2);
    spaceSlider.value      = g.spaciousness;
    spaceVal.textContent   = g.spaciousness.toFixed(2);
    // Apply to live state immediately (takes effect even while playing)
    state.scaleIdx      = g.scaleIdx;
    state.tempo         = g.tempo;
    state.density       = g.density;
    state.brightness    = g.brightness;
    state.spaciousness  = g.spaciousness;
  });
  genreBtnsEl.appendChild(btn);
});

// ─── Randomize ────────────────────────────────────────────────────────────────
function randomize() {
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));

  const root         = Math.floor(Math.random() * 12);
  const scale        = Math.floor(Math.random() * SCALE_LABELS.length);
  const bpm          = Math.floor(Math.random() * 91) + 50; // 50–140
  const density      = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100;
  const brightness   = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100;
  const spaciousness = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100;

  rootSelect.value        = root;
  scaleSelect.value       = scale;
  bpmSlider.value         = bpm;
  bpmValue.textContent    = bpm;
  densitySlider.value     = density;
  densityVal.textContent  = density.toFixed(2);
  brightSlider.value      = brightness;
  brightVal.textContent   = brightness.toFixed(2);
  spaceSlider.value       = spaciousness;
  spaceVal.textContent    = spaciousness.toFixed(2);

  state.rootMidi     = 36 + root;
  state.scaleIdx     = scale;
  state.tempo        = bpm;
  state.density      = density;
  state.brightness   = brightness;
  state.spaciousness = spaciousness;

  // Clear all instruments first
  Object.keys(manualEnabled).forEach(k => {
    manualEnabled[k] = false;
    if (cbElements[k]) cbElements[k].checked = false;
  });

  // Bass: ~60% chance, one random subtype
  if (Math.random() < 0.6) {
    const sub = BASS_SUBTYPES[Math.floor(Math.random() * BASS_SUBTYPES.length)];
    manualEnabled[`bass:${sub}`] = true;
    if (cbElements[`bass:${sub}`]) cbElements[`bass:${sub}`].checked = true;
  }

  // Drums: ~60% chance, one random subtype
  if (Math.random() < 0.6) {
    const sub = DRUMS_SUBTYPES[Math.floor(Math.random() * DRUMS_SUBTYPES.length)];
    manualEnabled[`drums:${sub}`] = true;
    if (cbElements[`drums:${sub}`]) cbElements[`drums:${sub}`].checked = true;
  }

  // Simple voices: ~40% chance each, guarantee at least 2
  const simpleKeys = SIMPLE_VOICES.map(v => v.key);
  let picked = simpleKeys.filter(() => Math.random() < 0.4);
  if (picked.length < 2) {
    const pool = [...simpleKeys].sort(() => Math.random() - 0.5);
    picked = pool.slice(0, 2 + Math.floor(Math.random() * 3));
  }
  picked.forEach(k => {
    manualEnabled[k] = true;
    if (cbElements[k]) cbElements[k].checked = true;
  });

  if (manualPlaying) {
    const bassSubs = enabledBassSubtypes();
    if (bassSubs.length > 0) bassVoice.setStyle(pick(bassSubs));
    setActiveVoices(getManualVoices());
  }

  updatePlayEnabled();
}

const randomBtn = document.createElement('button');
randomBtn.className = 'genre-btn random-genre-btn';
randomBtn.textContent = 'RANDOM';
randomBtn.addEventListener('click', randomize);
genreBtnsEl.appendChild(randomBtn);

// ─── Build instrument panel ───────────────────────────────────────────────────
const cbElements = {}; // key → <input> — needed for exclusive-group deselection

function makeCheckbox(key, label, exclusiveKeys = null) {
  const lbl = document.createElement('label');
  lbl.className = 'inst-toggle';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = false;
  cb.addEventListener('change', () => {
    if (exclusiveKeys && cb.checked) {
      exclusiveKeys.forEach(k => {
        if (k !== key) { manualEnabled[k] = false; if (cbElements[k]) cbElements[k].checked = false; }
      });
    }
    manualEnabled[key] = cb.checked;
    if (manualPlaying) {
      const any = Object.values(manualEnabled).some(v => v);
      if (!any) {
        stopManualPlayback();
      } else {
        const bassSubs = enabledBassSubtypes();
        if (bassSubs.length > 0) bassVoice.setStyle(pick(bassSubs));
        setActiveVoices(getManualVoices());
      }
    }
    updatePlayEnabled();
  });
  cbElements[key] = cb;
  const span = document.createElement('span');
  span.className = 'inst-name';
  span.textContent = label;
  lbl.appendChild(cb);
  lbl.appendChild(span);
  return lbl;
}

function makeGroup(groupLabel, entries, exclusiveKeys = null) {
  const wrap = document.createElement('div');
  wrap.className = 'voice-group';
  const name = document.createElement('span');
  name.className = 'group-label';
  name.textContent = groupLabel;
  wrap.appendChild(name);
  const row = document.createElement('div');
  row.className = 'subtype-row';
  entries.forEach(([key, label]) => row.appendChild(makeCheckbox(key, label, exclusiveKeys)));
  wrap.appendChild(row);
  return wrap;
}

const drumsKeys = DRUMS_SUBTYPES.map(s => `drums:${s}`);
voiceGroups.appendChild(makeGroup('BASS',  BASS_SUBTYPES.map(s  => [`bass:${s}`,  BASS_LABELS[s]])));
voiceGroups.appendChild(makeGroup('DRUMS', DRUMS_SUBTYPES.map(s => [`drums:${s}`, DRUMS_LABELS[s]]), drumsKeys));

const divider = document.createElement('div');
divider.className = 'voices-divider';
voiceGroups.appendChild(divider);

const grid = document.createElement('div');
grid.className = 'inst-grid';
SIMPLE_VOICES.forEach(({ key }) => grid.appendChild(makeCheckbox(key, key.toUpperCase())));
voiceGroups.appendChild(grid);

// ─── Play-enabled gate ────────────────────────────────────────────────────────
function updatePlayEnabled() {
  const any = Object.values(manualEnabled).some(v => v);
  manualPlayBtn.disabled = !any;
  if (!currentRecorder) manualExportBtn.disabled = !any;
}
updatePlayEnabled();

// ─── Live slider / select updates (take effect mid-playback) ─────────────────
function clearGenreHighlight() {
  document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
}

bpmSlider.addEventListener('input', () => {
  state.tempo = parseInt(bpmSlider.value, 10);
  bpmValue.textContent = bpmSlider.value;
  clearGenreHighlight();
});
densitySlider.addEventListener('input', () => {
  state.density = parseFloat(densitySlider.value);
  densityVal.textContent = state.density.toFixed(2);
  clearGenreHighlight();
});
brightSlider.addEventListener('input', () => {
  state.brightness = parseFloat(brightSlider.value);
  brightVal.textContent = state.brightness.toFixed(2);
  clearGenreHighlight();
});
spaceSlider.addEventListener('input', () => {
  state.spaciousness = parseFloat(spaceSlider.value);
  spaceVal.textContent = state.spaciousness.toFixed(2);
  clearGenreHighlight();
});
lengthInput.addEventListener('input', () => {
  lengthValue.textContent = `${lengthInput.value}s`;
});
scaleSelect.addEventListener('change', clearGenreHighlight);
rootSelect.addEventListener('change',  clearGenreHighlight);

// ─── Mode toggle ──────────────────────────────────────────────────────────────
modeTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    if (mode === currentMode) return;

    if (currentMode === 'infinite' && infiniteRunning) {
      clearInterval(infiniteInterval);
      infiniteInterval = null;
      infiniteRunning  = false;
      startBtn.style.display = '';
      infoEl.classList.remove('active');
      stateEl.classList.remove('active');
      stateEl.textContent = '';
    }
    if (currentMode === 'manual' && manualPlaying) stopManualPlayback();

    currentMode = mode;
    modeTabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    infiniteUi.style.display = mode === 'infinite' ? '' : 'none';
    manualUi.classList.toggle('active', mode === 'manual');
  });
});

// ─── Infinite mode ────────────────────────────────────────────────────────────
function updateInfiniteDisplay() {
  const prog       = Math.round((eraTimer / ERA_DURATION) * 100);
  const voiceNames = [
    `bass(${bassVoice.style})`,
    ...activeVoices.map(v => v.style ? `${v.name}(${v.style})` : v.name),
  ].join(' · ');
  stateEl.textContent = `${rootName()} ${scaleName()}  ·  ${Math.round(state.tempo)} bpm  ·  era ${state.era}  [${prog}%]\n${voiceNames}`;
}

startBtn.addEventListener('click', async () => {
  if (infiniteRunning) return;
  if (!audio.started || audio.ctx?.state === 'closed') initAudio();
  if (audio.ctx.state === 'suspended') await audio.ctx.resume();
  unmuteAudio();

  startBtn.style.display = 'none';
  infoEl.classList.add('active');
  stateEl.classList.add('active');

  state.scaleIdx = 0;
  state.rootMidi = 36;
  state.tempo    = 78;

  pickVoices();
  bassVoice.reroll();

  // Reset tick timer and all voice schedulers so a re-start after stopping
  // doesn't produce a stale-dt era jump or a catch-up note burst.
  resetTickTimer();
  const _now = audio.ctx.currentTime;
  bassVoice.reset(_now); drumsVoice.reset(_now);
  SIMPLE_VOICES.forEach(({ voice }) => voice.reset(_now));

  infiniteRunning  = true;
  infiniteInterval = setInterval(() => {
    tick();
    updateInfiniteDisplay();
  }, TICK_MS);
});

// ─── Manual helpers ───────────────────────────────────────────────────────────
function enabledBassSubtypes()  { return BASS_SUBTYPES.filter(s  => manualEnabled[`bass:${s}`]);  }
function enabledDrumsSubtypes() { return DRUMS_SUBTYPES.filter(s => manualEnabled[`drums:${s}`]); }

function getManualVoices() {
  const voices = [];
  const drumSubs = enabledDrumsSubtypes();
  if (drumSubs.length > 0) { drumsVoice.setStyle(pick(drumSubs)); voices.push(drumsVoice); }
  SIMPLE_VOICES.forEach(({ key, voice }) => { if (manualEnabled[key]) voices.push(voice); });
  return voices;
}

async function manualInit() {
  if (!audio.started || audio.ctx?.state === 'closed') initAudio();
  if (audio.ctx.state === 'suspended') await audio.ctx.resume();
  unmuteAudio();

  state.tempo        = parseInt(bpmSlider.value, 10);
  state.rootMidi     = 36 + parseInt(rootSelect.value, 10);
  state.scaleIdx     = parseInt(scaleSelect.value, 10);
  state.era          = 0;
  state.density      = parseFloat(densitySlider.value);
  state.brightness   = parseFloat(brightSlider.value);
  state.spaciousness = parseFloat(spaceSlider.value);

  const bassSubs = enabledBassSubtypes();
  if (bassSubs.length > 0) bassVoice.setStyle(pick(bassSubs));

  setActiveVoices(getManualVoices());

  // Reset every voice scheduler to now so stale nextTime values don't cause
  // a catch-up burst of past-timestamped notes on the first tick.
  const now = audio.ctx.currentTime;
  bassVoice.reset(now);
  drumsVoice.reset(now);
  SIMPLE_VOICES.forEach(({ voice }) => voice.reset(now));
}

function buildExportName(ext) {
  const root     = ROOT_NAMES[parseInt(rootSelect.value, 10)].replace('#', 's');
  const scale    = SCALE_LABELS[parseInt(scaleSelect.value, 10)].toLowerCase().replace(/\s+/g, '-');
  const bpm      = bpmSlider.value;
  const genreBtn = document.querySelector('.genre-btn.active');
  const prefix   = genreBtn ? genreBtn.textContent.toLowerCase() + '_' : '';
  return `${prefix}${root}_${scale}_${bpm}bpm.${ext}`;
}

function resetExportUI() {
  exportCountdown.textContent = '';
  exportCountdown.classList.remove('active', 'pulse');
  exportProgressWrap.classList.remove('active');
  exportProgressBar.style.width = '0%';
}

function showCountdownNumber(n) {
  exportCountdown.textContent = n;
  exportCountdown.classList.remove('pulse');
  void exportCountdown.offsetWidth; // force reflow to retrigger animation
  exportCountdown.classList.add('pulse');
}

function muteAudio(fadeSec = 0.08) {
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  [audio.masterGain.gain, audio.reverbGain.gain].forEach(p => {
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(0, now + fadeSec);
  });
}

function unmuteAudio() {
  if (!audio.ctx) return;
  const now = audio.ctx.currentTime;
  [[audio.masterGain.gain, 0.55], [audio.reverbGain.gain, 0.45]].forEach(([p, target]) => {
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(target, now + 0.05);
  });
}

function stopManualPlayback() {
  if (manualInterval)    { clearInterval(manualInterval);   manualInterval    = null; }
  if (exportPreTimeout)  { clearTimeout(exportPreTimeout);  exportPreTimeout  = null; }
  if (exportTailTimeout) { clearTimeout(exportTailTimeout); exportTailTimeout = null; }
  exportId++; // invalidate any active export phase
  muteAudio();
  manualPlaying = false;
  manualPlayBtn.textContent = 'PLAY';
  manualPlayBtn.classList.remove('playing');
  manualExportBtn.textContent = 'EXPORT';
  manualExportBtn.classList.remove('recording');
  resetExportUI();
  if (currentRecorder) {
    try { currentRecorder.stop(); } catch (_) {}
    currentRecorder = null;
  }
  updatePlayEnabled();
}

// ─── Manual play ─────────────────────────────────────────────────────────────
manualPlayBtn.addEventListener('click', async () => {
  if (manualPlaying) {
    stopManualPlayback();
    manualStatus.textContent = '';
    manualStatus.classList.remove('active');
    return;
  }

  await manualInit();
  manualPlaying = true;
  manualPlayBtn.textContent = 'STOP';
  manualPlayBtn.classList.add('playing');
  manualStatus.classList.add('active');
  manualStatus.textContent = 'PLAYING';

  manualInterval = setInterval(() => {
    tick({ skipBass: enabledBassSubtypes().length === 0, skipEvolve: true });
  }, TICK_MS);
});

// ─── Manual export ────────────────────────────────────────────────────────────
const PRE_SILENCE_MS = 3000; // muted immediately; countdown before recording
const TAIL_MS        = 200;  // buffer after audio cut for recorder to flush last chunk

function encodeWav(decoded, numSamples) {
  const nCh = decoded.numberOfChannels;
  const sr  = decoded.sampleRate;
  const n   = Math.min(decoded.length, numSamples);
  const pcm = n * nCh * 2;
  const ab  = new ArrayBuffer(44 + pcm);
  const dv  = new DataView(ab);
  const s4  = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  s4(0, 'RIFF'); dv.setUint32(4, 36 + pcm, true);
  s4(8, 'WAVE'); s4(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, nCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * nCh * 2, true); dv.setUint16(32, nCh * 2, true);
  dv.setUint16(34, 16, true); s4(36, 'data'); dv.setUint32(40, pcm, true);
  const chs = Array.from({ length: nCh }, (_, c) => decoded.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) {
    const x = Math.max(-1, Math.min(1, chs[c][i]));
    dv.setInt16(off, x < 0 ? x * 0x8000 : x * 0x7FFF, true);
    off += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

manualExportBtn.addEventListener('click', () => {
  if (!window.MediaRecorder) {
    manualStatus.textContent = 'EXPORT NOT SUPPORTED IN THIS BROWSER';
    manualStatus.classList.add('active');
    return;
  }

  if (manualPlaying) stopManualPlayback();

  const myId        = ++exportId;
  const durationSec = Math.max(5, parseInt(lengthInput.value, 10) || 10);

  manualPlaying = true;
  manualPlayBtn.textContent = 'STOP';
  manualPlayBtn.classList.add('playing');
  manualExportBtn.textContent = 'RECORDING';
  manualExportBtn.disabled = true;
  manualExportBtn.classList.add('recording');
  manualStatus.classList.add('active');
  manualStatus.textContent = 'CLEARING';

  // ── Phase 1: countdown 3-2-1, wait for existing sounds + reverb to clear ─
  exportCountdown.classList.add('active');
  [3, 2, 1].forEach((n, i) => {
    setTimeout(() => {
      if (exportId !== myId) return;
      showCountdownNumber(n);
    }, i * 1000);
  });

  exportPreTimeout = setTimeout(async () => {
    exportPreTimeout = null;
    if (exportId !== myId) return;
    exportCountdown.classList.remove('active', 'pulse');
    manualStatus.textContent = '';

    await manualInit();
    const skipBass = enabledBassSubtypes().length === 0;

    // Schedule a 5 ms micro-ramp to silence at exactly durationSec on the
    // audio clock — inaudible as a fade but prevents a waveform discontinuity.
    const endAudioTime = audio.ctx.currentTime + durationSec;
    [[audio.masterGain.gain, 0.55], [audio.reverbGain.gain, 0.45]].forEach(([p, v]) => {
      p.setValueAtTime(v, endAudioTime - 0.005);
      p.linearRampToValueAtTime(0, endAudioTime);
    });

    const dest    = audio.ctx.createMediaStreamDestination();
    audio.masterGain.connect(dest);
    const chunks  = [];
    const mtype   = ['audio/webm;codecs=opus', 'audio/webm', ''].find(t => !t || MediaRecorder.isTypeSupported(t));
    const recorder = mtype ? new MediaRecorder(dest.stream, { mimeType: mtype }) : new MediaRecorder(dest.stream);
    currentRecorder = recorder;

    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      audio.masterGain.disconnect(dest);
      currentRecorder = null;
      resetExportUI();

      function finalize() {
        manualExportBtn.textContent = 'EXPORT';
        manualExportBtn.disabled = false;
        manualExportBtn.classList.remove('recording');
        updatePlayEnabled();
      }

      if (exportId !== myId) { finalize(); return; }

      const blob         = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      const targetSamples = Math.round(durationSec * audio.ctx.sampleRate);
      manualStatus.textContent = 'SAVING...';
      blob.arrayBuffer()
        .then(ab => audio.ctx.decodeAudioData(ab))
        .then(decoded => {
          const wav = encodeWav(decoded, targetSamples);
          const url = URL.createObjectURL(wav);
          const a   = document.createElement('a');
          a.href = url; a.download = buildExportName('wav');
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          URL.revokeObjectURL(url);
          manualStatus.textContent = 'SAVED';
        })
        .catch(() => { manualStatus.textContent = 'EXPORT FAILED'; })
        .finally(finalize);
    };

    recorder.start(200);
    exportProgressWrap.classList.add('active');
    exportProgressBar.style.transition = 'none';
    exportProgressBar.style.width = '0%';

    // ── Phase 2: tick music for durationSec ─────────────────────────────────
    const recStart = Date.now();
    manualStatus.textContent = `REC  ${durationSec}s`;
    // Kick off the bar with a smooth transition from the start
    requestAnimationFrame(() => {
      exportProgressBar.style.transition = `width ${durationSec}s linear`;
      exportProgressBar.style.width = '100%';
    });

    manualInterval = setInterval(() => {
      if (exportId !== myId) { clearInterval(manualInterval); manualInterval = null; return; }

      const remaining = durationSec - (Date.now() - recStart) / 1000;

      if (remaining > 0) {
        tick({ skipBass, skipEvolve: true });
        manualStatus.textContent = `REC  ${Math.ceil(remaining)}s`;
      }

      if (remaining <= 0) {
        clearInterval(manualInterval); manualInterval = null;
        exportProgressBar.style.transition = 'none';
        exportProgressBar.style.width = '100%';
        manualStatus.textContent = 'FINISHING...';
        // ── Phase 3: let audio clock reach endAudioTime, then stop recorder ─
        exportTailTimeout = setTimeout(() => {
          exportTailTimeout = null;
          if (exportId !== myId) return;
          manualPlaying = false;
          manualPlayBtn.textContent = 'PLAY';
          manualPlayBtn.classList.remove('playing');
          if (currentRecorder) currentRecorder.stop();
        }, TAIL_MS);
      }
    }, TICK_MS);

  }, PRE_SILENCE_MS);
});

// ─── Clear instruments ────────────────────────────────────────────────────────
clearInstrumentsBtn.addEventListener('click', () => {
  if (manualPlaying) stopManualPlayback();
  Object.keys(manualEnabled).forEach(k => {
    manualEnabled[k] = false;
    if (cbElements[k]) cbElements[k].checked = false;
  });
  updatePlayEnabled();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
startAnimation();
