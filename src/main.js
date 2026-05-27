import { state, rootName, scaleName, TICK_MS, SCALE_NAMES, pick } from './state.js';
import { audio, initAudio } from './audio/context.js';
import {
  tick, pickVoices, setActiveVoices,
  bassVoice, padVoice, melodyVoice, textureVoice, pluckVoice,
  bellVoice, arpeggioVoice, malletVoice, droneVoice, fluteVoice,
  choirVoice, stringsVoice, rhodesVoice, organVoice, glassVoice,
  harpVoice, brassVoice, drumsVoice,
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
const DRUMS_SUBTYPES = ['minimal','four_four','jungle','shuffle','trap','ghost'];
const BASS_LABELS    = { sub:'SUB', plucked:'PLUCK', walking:'WALK', synth:'SYNTH', rumble:'RUMBLE' };
const DRUMS_LABELS   = { minimal:'MINIMAL', four_four:'4/4', jungle:'JUNGLE', shuffle:'SHUFFLE', trap:'TRAP', ghost:'GHOST' };

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
  { key:'rhodes',   voice:rhodesVoice },
  { key:'organ',    voice:organVoice },
  { key:'glass',    voice:glassVoice },
  { key:'harp',     voice:harpVoice },
  { key:'brass',    voice:brassVoice },
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
const manualPlayBtn   = document.getElementById('manual-play-btn');
const manualExportBtn = document.getElementById('manual-export-btn');
const manualStatus    = document.getElementById('manual-status');
const modeTabs        = document.querySelectorAll('.mode-tab');

// ─── Enable state (all off by default) ───────────────────────────────────────
const manualEnabled = {};
BASS_SUBTYPES.forEach(s  => { manualEnabled[`bass:${s}`]  = false; });
DRUMS_SUBTYPES.forEach(s => { manualEnabled[`drums:${s}`] = false; });
SIMPLE_VOICES.forEach(({ key }) => { manualEnabled[key] = false; });

// ─── Playback state ───────────────────────────────────────────────────────────
let currentMode      = 'infinite';
let infiniteRunning  = false;
let infiniteInterval = null;
let manualPlaying    = false;
let manualInterval   = null;
let currentRecorder  = null;

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

// ─── Build instrument panel ───────────────────────────────────────────────────
const cbElements = {}; // key → <input> — needed for exclusive-group deselection

function makeCheckbox(key, label, exclusiveKeys = null) {
  const lbl = document.createElement('label');
  lbl.className = 'inst-toggle';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = false;
  cb.addEventListener('change', () => {
    if (manualPlaying) stopManualPlayback();
    if (exclusiveKeys && cb.checked) {
      exclusiveKeys.forEach(k => {
        if (k !== key) { manualEnabled[k] = false; if (cbElements[k]) cbElements[k].checked = false; }
      });
    }
    manualEnabled[key] = cb.checked;
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

startBtn.addEventListener('click', () => {
  if (infiniteRunning) return;
  if (!audio.started) initAudio();

  startBtn.style.display = 'none';
  infoEl.classList.add('active');
  stateEl.classList.add('active');

  state.scaleIdx = 0;
  state.rootMidi = 36;
  state.tempo    = 78;

  pickVoices();
  bassVoice.reroll();

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

function manualInit() {
  if (!audio.started) initAudio();
  if (audio.ctx.state === 'suspended') audio.ctx.resume();

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
}

function buildExportName(ext) {
  const root     = ROOT_NAMES[parseInt(rootSelect.value, 10)].replace('#', 's');
  const scale    = SCALE_LABELS[parseInt(scaleSelect.value, 10)].toLowerCase().replace(/\s+/g, '-');
  const bpm      = bpmSlider.value;
  const genreBtn = document.querySelector('.genre-btn.active');
  const prefix   = genreBtn ? genreBtn.textContent.toLowerCase() + '_' : '';
  return `${prefix}${root}_${scale}_${bpm}bpm.${ext}`;
}

function stopManualPlayback() {
  if (manualInterval) { clearInterval(manualInterval); manualInterval = null; }
  manualPlaying = false;
  manualPlayBtn.textContent = 'PLAY';
  manualPlayBtn.classList.remove('playing');
  if (currentRecorder) {
    try { currentRecorder.stop(); } catch (_) {}
    currentRecorder = null;
  }
}

// ─── Manual play ─────────────────────────────────────────────────────────────
manualPlayBtn.addEventListener('click', () => {
  if (manualPlaying) {
    stopManualPlayback();
    manualStatus.textContent = '';
    manualStatus.classList.remove('active');
    return;
  }

  manualInit();
  const skipBass    = enabledBassSubtypes().length === 0;
  const durationSec = Math.max(5, parseInt(lengthInput.value, 10) || 10);
  const startTime   = Date.now();
  manualPlaying = true;
  manualPlayBtn.textContent = 'STOP';
  manualPlayBtn.classList.add('playing');
  manualStatus.classList.add('active');

  manualInterval = setInterval(() => {
    tick({ skipBass, skipEvolve: true });
    const remaining = durationSec - Math.floor((Date.now() - startTime) / 1000);
    if (remaining <= 0) { stopManualPlayback(); manualStatus.textContent = 'DONE'; return; }
    manualStatus.textContent = `${remaining}s remaining`;
  }, TICK_MS);
});

// ─── Manual export ────────────────────────────────────────────────────────────
manualExportBtn.addEventListener('click', () => {
  if (!window.MediaRecorder) {
    manualStatus.textContent = 'EXPORT NOT SUPPORTED IN THIS BROWSER';
    manualStatus.classList.add('active');
    return;
  }

  if (manualPlaying) stopManualPlayback();
  manualInit();

  const skipBass    = enabledBassSubtypes().length === 0;
  const durationSec = Math.max(5, parseInt(lengthInput.value, 10) || 10);
  const dest = audio.ctx.createMediaStreamDestination();
  audio.masterGain.connect(dest);

  const chunks  = [];
  const mtype   = ['audio/webm;codecs=opus','audio/webm',''].find(t => !t || MediaRecorder.isTypeSupported(t));
  const recorder = mtype ? new MediaRecorder(dest.stream, { mimeType: mtype }) : new MediaRecorder(dest.stream);
  currentRecorder = recorder;

  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    audio.masterGain.disconnect(dest);
    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const ext  = (blob.type || '').includes('webm') ? 'webm' : 'ogg';
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = buildExportName(ext);
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    currentRecorder = null;
    manualStatus.textContent = 'SAVED';
    manualExportBtn.textContent = 'EXPORT';
    manualExportBtn.disabled = false;
    manualExportBtn.classList.remove('recording');
    updatePlayEnabled();
  };

  recorder.start(200);
  manualExportBtn.textContent = 'RECORDING';
  manualExportBtn.disabled = true;
  manualExportBtn.classList.add('recording');

  const startTime = Date.now();
  manualPlaying = true;
  manualPlayBtn.textContent = 'STOP';
  manualPlayBtn.classList.add('playing');
  manualStatus.classList.add('active');

  manualInterval = setInterval(() => {
    tick({ skipBass, skipEvolve: true });
    const remaining = durationSec - Math.floor((Date.now() - startTime) / 1000);
    if (remaining <= 0) {
      clearInterval(manualInterval); manualInterval = null;
      manualPlaying = false;
      manualPlayBtn.textContent = 'PLAY';
      manualPlayBtn.classList.remove('playing');
      if (currentRecorder) recorder.stop();
      manualStatus.textContent = 'SAVING...';
      return;
    }
    manualStatus.textContent = `REC  ${remaining}s remaining`;
  }, TICK_MS);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
startAnimation();
