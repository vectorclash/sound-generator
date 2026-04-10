// ─── Audio context ────────────────────────────────────────────────────────────
// A single mutable object so all voice modules always see the live references.
export const audio = {
  ctx:        null,
  masterGain: null,
  reverbNode: null,
  analyser:   null,
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

export function initAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new AC();

  audio.masterGain = audio.ctx.createGain();
  audio.masterGain.gain.value = 0.55;

  audio.analyser = audio.ctx.createAnalyser();
  audio.analyser.fftSize = 512;
  audio.freqData = new Uint8Array(audio.analyser.frequencyBinCount);
  audio.waveData = new Uint8Array(audio.analyser.fftSize);

  audio.reverbNode = buildReverb(audio.ctx);
  const reverbGain = audio.ctx.createGain();
  reverbGain.gain.value = 0.45;

  audio.masterGain.connect(audio.analyser);
  audio.analyser.connect(audio.ctx.destination);
  audio.reverbNode.connect(reverbGain);
  reverbGain.connect(audio.analyser);

  audio.started = true;
}
