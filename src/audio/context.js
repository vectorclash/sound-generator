// ─── Audio context ────────────────────────────────────────────────────────────
// A single mutable object so all voice modules always see the live references.
export const audio = {
  ctx:        null,
  masterGain: null,
  reverbGain: null,
  reverbNode: null,
  analyser:   null,
  masterOut:  null, // final node before destination — tap this for recording/export
  freqData:   null,
  waveData:   null,
  started:    false,
};

function buildReverb(ctx, duration = 4, decay = 2.8) {
  const sr  = ctx.sampleRate;
  const len = sr * duration;
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = buf;
  return conv;
}

// ─── Per-voice stereo buses ───────────────────────────────────────────────────
// Fixed pan position per instrument so the mix isn't a mono pile-up. Bass and
// drums are left out on purpose and connect straight to masterGain — centered
// low end keeps the mix coherent on mono/small speakers.
const VOICE_PAN = {
  pad: -0.35, melody: 0.3, texture: -0.55, pluck: 0.45, bell: -0.3,
  arpeggio: 0.5, mallet: -0.45, drone: 0.15, flute: 0.35, choir: -0.15,
  strings: -0.2, rhodes: 0.2, organ: -0.3, glass: 0.4, harp: -0.4,
  brass: 0.3, vibraphone: 0.45, clavinet: -0.5, sitar: 0.5, kalimba: -0.35,
};

const voiceBuses = new Map();

export function getVoiceBus(name) {
  let bus = voiceBuses.get(name);
  if (!bus) {
    const dry    = audio.ctx.createGain();
    const panner = audio.ctx.createStereoPanner();
    panner.pan.value = VOICE_PAN[name] ?? 0;
    dry.connect(panner);
    panner.connect(audio.masterGain);
    bus = { dry };
    voiceBuses.set(name, bus);
  }
  return bus;
}

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new AC();
  voiceBuses.clear();

  audio.masterGain = audio.ctx.createGain();
  audio.masterGain.gain.value = 0.55;

  audio.analyser = audio.ctx.createAnalyser();
  audio.analyser.fftSize = 512;
  audio.freqData = new Uint8Array(audio.analyser.frequencyBinCount);
  audio.waveData = new Uint8Array(audio.analyser.fftSize);

  audio.reverbNode = buildReverb(audio.ctx);
  audio.reverbGain = audio.ctx.createGain();
  audio.reverbGain.gain.value = 0.45;

  // ─── Master bus: gentle high-pass to clear sub-rumble + a soft compressor
  // for cohesion and to catch peaks when density/voice count stacks up.
  // Tuned conservatively so it doesn't squash the ambient dynamics.
  const highpass = audio.ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 30;

  const compressor = audio.ctx.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.knee.value      = 24;
  compressor.ratio.value     = 4;
  compressor.attack.value    = 0.01;
  compressor.release.value   = 0.25;

  audio.masterGain.connect(audio.analyser);
  audio.analyser.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(audio.ctx.destination);
  audio.masterOut = compressor;

  audio.reverbNode.connect(audio.reverbGain);
  audio.reverbGain.connect(audio.analyser);

  audio.started = true;
}
