import { state, rootName, scaleName, TICK_MS } from './state.js';
import { audio, initAudio } from './audio/context.js';
import { tick, pickVoices, bassVoice, activeVoices, eraTimer, ERA_DURATION } from './audio/scheduler.js';
import { startAnimation } from './visuals/animate.js';

// ─── UI refs ──────────────────────────────────────────────────────────────────
const startBtn  = document.getElementById('start-btn');
const infoEl    = document.getElementById('info');
const stateEl   = document.getElementById('state-line');
const bpmSlider = document.getElementById('bpm-slider');
const bpmValue  = document.getElementById('bpm-value');

// ─── BPM slider ───────────────────────────────────────────────────────────────
bpmSlider.addEventListener('input', () => {
  state.tempo = parseInt(bpmSlider.value, 10);
  bpmValue.textContent = bpmSlider.value;
});

// ─── State display ────────────────────────────────────────────────────────────
function updateStateDisplay() {
  const prog       = Math.round((eraTimer / ERA_DURATION) * 100);
  const voiceNames = [`bass(${bassVoice.style})`, ...activeVoices.map(v => v.style ? `${v.name}(${v.style})` : v.name)].join(' · ');
  stateEl.textContent = `${rootName()} ${scaleName()}  ·  ${Math.round(state.tempo)} bpm  ·  era ${state.era}  [${prog}%]\n${voiceNames}`;
  // Keep slider in sync when era evolution shifts the tempo
  bpmSlider.value     = Math.round(state.tempo);
  bpmValue.textContent = Math.round(state.tempo);
}

// ─── Start ────────────────────────────────────────────────────────────────────
startBtn.addEventListener('click', () => {
  if (audio.started) return;

  initAudio();

  startBtn.style.display = 'none';
  infoEl.classList.add('active');
  stateEl.classList.add('active');
  document.getElementById('bpm-control').classList.add('active');

  state.scaleIdx  = 0;
  state.rootMidi  = 36;
  state.tempo     = 78;
  bpmSlider.value = 78;
  bpmValue.textContent = '78';

  pickVoices();
  bassVoice.reroll();

  setInterval(() => {
    tick();
    updateStateDisplay();
  }, TICK_MS);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
startAnimation();
