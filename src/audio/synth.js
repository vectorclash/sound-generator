import { audio } from './context.js';
import { midiToHz, clamp } from '../state.js';

// ─── Small synthesis toolkit shared by the voices ─────────────────────────────

export function osc(type, hz, t, stop, detune = 0) {
  const o = audio.ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.detune.value = detune;
  o.start(t);
  o.stop(stop);
  return o;
}

export function gain(value = 1) {
  const g = audio.ctx.createGain();
  g.gain.value = value;
  return g;
}

export function filter(type, hz, q = 0.7) {
  const f = audio.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

// Route `node` into a send bus (reverb/echo) at `level`.
export function send(node, dest, level) {
  if (!(level > 0)) return;
  const g = gain(level);
  node.connect(g);
  g.connect(dest);
}

// Percussive envelope: a short linear attack from silence (so no waveform
// starts on a step), then an exponential fall to -60 dB over `decay` seconds.
export function perc(param, t, peak, decay, attack = 0.002) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(Math.max(peak * 1e-3, 1e-6), t + attack + decay);
  return t + attack + decay;
}

// Attack / hold / release. `hold` is measured from `t`. Returns the end time.
export function ahr(param, t, peak, attack, hold, release) {
  const h = Math.max(attack, hold);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, t + h);
  param.linearRampToValueAtTime(0, t + h + release);
  return t + h + release;
}

// Sine LFO whose output (±depth) can be connected to any AudioParam.
// `delay` fades the modulation in — players add vibrato after the attack.
export function lfo(hz, depth, t, stop, delay = 0, fadeIn = 0.3) {
  const o = osc('sine', hz, t, stop);
  const g = gain(delay > 0 ? 0 : depth);
  if (delay > 0) {
    g.gain.setValueAtTime(0, t);
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(depth, t + delay + fadeIn);
  }
  o.connect(g);
  return g;
}

// ─── Waveshaping ──────────────────────────────────────────────────────────────
const curves = new Map();
// Soft saturation (tanh). `bias` adds asymmetry → even harmonics.
export function shaper(drive = 2, bias = 0) {
  const key = `${drive}|${bias}`;
  let curve = curves.get(key);
  if (!curve) {
    curve = new Float32Array(1024);
    const norm = Math.tanh(drive * (1 + Math.abs(bias)));
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = (Math.tanh(drive * (x + bias)) - Math.tanh(drive * bias)) / norm;
    }
    curves.set(key, curve);
  }
  const ws = audio.ctx.createWaveShaper();
  ws.curve = curve;
  ws.oversample = '2x';
  return ws;
}

// ─── Plucked string (Karplus–Strong, Jaffe–Smith extensions) ─────────────────
// A burst of noise circulates in a delay line one period long. A two-point
// averaging filter in the loop removes a little high end on every pass, so
// upper partials die away faster than the fundamental — which is exactly what
// a real string does, and why this sounds like a string rather than a beep.
//
//   t60    — seconds for the fundamental to decay by 60 dB
//   bright — 0…1, lowpass on the excitation (finger/felt ≈ 0.2, pick ≈ 0.8)
//   pick   — pluck position along the string (0.5 = middle: hollow, 0.08 =
//            near the bridge: nasal/twangy); comb-filters the excitation
//   stretch— loop-filter weight; < 0.5 keeps the highs ringing longer
//
// Rendered into an AudioBuffer (the loop runs faster than real time), with a
// first-order allpass supplying the fractional part of the delay so the pitch
// is in tune rather than rounded to a whole-sample period.
export function pluckBuffer(midi, { t60 = 1.5, bright = 0.5, pick = 0.25, stretch = 0.5, length = t60 } = {}) {
  const ctx = audio.ctx;
  const sr  = ctx.sampleRate;
  const f   = midiToHz(midi);
  const len = Math.max(1, Math.floor(sr * length));
  const buf = ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);

  const S      = clamp(stretch, 0.05, 0.5);
  const period = sr / f;
  let N = Math.floor(period - S);
  let d = period - S - N;          // fractional delay for the allpass
  if (d < 0.1) { N -= 1; d += 1; } // keep the allpass away from its unstable edge
  N = Math.max(2, N);
  const C = (1 - d) / (1 + d);
  const g = Math.pow(0.001, 1 / (f * t60)); // per-period loss for the requested T60

  // Excitation: filtered noise, comb-filtered at the pluck position, zero-mean.
  const line = new Float32Array(N);
  const k    = 0.05 + 0.95 * clamp(bright, 0, 1);
  let lp = 0, mean = 0;
  for (let i = 0; i < N; i++) {
    lp += k * ((Math.random() * 2 - 1) - lp);
    line[i] = lp;
  }
  const p = Math.max(1, Math.round(clamp(pick, 0.02, 0.5) * N));
  const exc = new Float32Array(N);
  for (let i = 0; i < N; i++) exc[i] = line[i] - line[(i - p + N) % N];
  let peak = 0;
  for (let i = 0; i < N; i++) mean += exc[i];
  mean /= N;
  for (let i = 0; i < N; i++) { exc[i] -= mean; peak = Math.max(peak, Math.abs(exc[i])); }
  for (let i = 0; i < N; i++) line[i] = exc[i] / (peak || 1);

  let idx = 0, prev = 0, apIn = 0, apOut = 0;
  for (let n = 0; n < len; n++) {
    const x = line[idx];
    out[n] = x;
    const y  = g * ((1 - S) * x + S * prev);
    prev = x;
    const ap = C * (y - apOut) + apIn; // fractional-delay allpass
    apIn = y; apOut = ap;
    line[idx] = ap;
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  return buf;
}

// Play a rendered buffer. Returns the source so callers can bend its pitch
// (source.detune) or connect it onward.
export function playBuffer(buf, t, stop) {
  const src = audio.ctx.createBufferSource();
  src.buffer = buf;
  src.start(t);
  src.stop(Math.min(stop, t + buf.duration));
  return src;
}
