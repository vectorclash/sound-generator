import { audio, noise } from '../context.js';
import { state, beat, rand, pick, currentScale, midiToHz } from '../../state.js';
import { createVoice } from '../transport.js';
import { logNote } from '../notes.js';
import { harmony, bassRoot } from '../harmony.js';
import { osc, gain, filter, perc, ahr, pluckBuffer, playBuffer } from '../synth.js';

// ─── Bass ─────────────────────────────────────────────────────────────────────
// Every style is tied to the harmonic rhythm: the chord root lands on the
// arrival of each chord, no note is held across a chord change, and the last
// note before a change often *leads into* the next root (an approach tone) —
// that anticipation is most of what makes a bass line sound like a line.

const STYLES = ['sub', 'plucked', 'walking', 'synth', 'rumble'];
const LO = 28, HI = 55; // E1 … G3

// Plucked (finger bass): one-bar rhythms of [beats, note]. R root, F fifth,
// O octave, A approach into the next chord (a chord tone if none is coming).
const PLUCK_RHYTHMS = [
  [[1.5, 'R'], [0.5, 'R'], [1, 'F'], [1, 'A']],
  [[1, 'R'], [1, 'R'], [1, 'F'], [1, 'A']],
  [[0.75, 'R'], [0.75, 'R'], [0.5, 'O'], [1, 'F'], [1, 'A']],
  [[2, 'R'], [1.5, 'F'], [0.5, 'A']],
  [[1.5, 'R'], [1.5, 'F'], [1, 'A']],
];
// Synth: sixteenth-note patterns. Letters start a note, '-' holds it, '.' rests.
const SYNTH_PATTERNS = [
  'R.O.R.O.R.O.R.O.', // octave bounce (disco / electro)
  '..R-..R-..R-..R-', // off-beat eighths (house / trance)
  'R-.R-.R-R-.R-.O-', // 3-3-2 syncopation with an octave pickup
  'R-R-R-R-R-R-F-A-', // driving eighths into the change
];

let style  = 'sub';
let prev   = null; // last bass note (MIDI) — keeps root motion smooth
let curBar = -1;
let cell   = PLUCK_RHYTHMS[0];
let pattern = SYNTH_PATTERNS[0];

const inRange = m => Math.max(LO, Math.min(HI, m));
const inScale = m => currentScale().includes((((m - state.rootMidi) % 12) + 12) % 12);

function root(seg)     { return bassRoot(seg.degree, prev, LO, HI); }
function nextRoot(seg) { return bassRoot(seg.next, prev, LO, HI); }
function fifth(r)      { return r + 7 <= HI ? r + 7 : r - 5; }

// Lead into `target` from `from`: a chromatic half step (most common), a
// diatonic neighbour, or the target's own fifth (a dominant approach).
function approach(target, from) {
  const dir = from > target ? 1 : -1; // come in from the side we're already on
  const r = Math.random();
  if (r < 0.45) return inRange(target + dir);
  if (r < 0.8) {
    for (let d = 1; d <= 2; d++) if (inScale(target + dir * d)) return inRange(target + dir * d);
  }
  return inRange(target + (dir > 0 ? 7 : -5));
}

function resolve(code, b, len) {
  const seg = harmony.at(b);
  const r   = root(seg);
  if (b - seg.start < 1e-6) return r; // chord arrival always gets the root
  if (code === 'A') return b + len >= seg.end - 1e-6 ? approach(nextRoot(seg), prev ?? r) : fifth(r);
  if (code === 'F') return fifth(r);
  if (code === 'O') return r + 12 <= HI + 5 ? r + 12 : r;
  return r;
}

// Walking bass: steady quarters. Root on the chord's arrival, an approach
// note on the last beat before a change, and in between chord tones (on
// strong beats) or scale steps that head toward the next root without
// reaching it early.
function walkNote(b) {
  const seg = harmony.at(b);
  const k = b - seg.start, left = seg.end - b;
  if (k < 1e-6 || prev === null) return root(seg);
  const target = nextRoot(seg);
  if (left <= 1 + 1e-6) return approach(target, prev);
  const pcs = harmony.pcs(seg.degree, seg.seventh ? 4 : 3);
  const options = [];
  for (let m = prev - 5; m <= prev + 5; m++) {
    if (m === prev || m < LO || m > HI) continue;
    const chordTone = pcs.includes(m % 12);
    if (!chordTone && !inScale(m)) continue;
    let w = chordTone ? (Math.round(k) % 2 === 0 ? 4 : 2) : 1;
    if (Math.abs(target - m) < Math.abs(target - prev)) w += 1.5;
    if (m === target) w = 0.2;
    options.push([m, w]);
  }
  let total = options.reduce((s, [, w]) => s + w, 0), r = Math.random() * total;
  for (const [m, w] of options) if ((r -= w) <= 0) return m;
  return root(seg);
}

// ─── Sounds ───────────────────────────────────────────────────────────────────
function subBass(t, midi, dur) {
  logNote('bass', t, midi, dur, 0.8);
  const hz = midiToHz(midi), end = t + dur + 0.1;
  const lp = filter('lowpass', 320, 0.7);
  osc('sine', hz, t, end).connect(lp);
  const tri = osc('triangle', hz, t, end), triG = gain(0.5);
  tri.connect(triG); triG.connect(lp);
  if (hz / 2 >= 35) { // a sub-octave only where it's still audible
    const s = osc('sine', hz / 2, t, end), sG = gain(0.5);
    s.connect(sG); sG.connect(lp);
  }
  const env = gain(0);
  ahr(env.gain, t, rand(0.09, 0.12), 0.03, dur - 0.06, 0.05);
  lp.connect(env); env.connect(audio.dry);
}

function stringBass(t, midi, dur, { bright, pick: pos, t60, level }) {
  logNote('bass', t, midi, dur, 0.85);
  const src = playBuffer(pluckBuffer(midi, { t60, bright, pick: pos, stretch: 0.5, length: Math.min(t60, dur + 0.2) }), t, t + dur + 0.2);
  const lp = filter('lowpass', 1800, 0.7);
  const env = gain(0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(level, t + 0.004);
  env.gain.setTargetAtTime(0, t + dur, 0.03);
  src.connect(lp); lp.connect(env); env.connect(audio.dry);
  // Finger/string thump under the attack.
  const th = noise(t, 0.03), thLp = filter('lowpass', 220), thE = gain(0);
  perc(thE.gain, t, level * 0.5, 0.02, 0.001);
  th.connect(thLp); thLp.connect(thE); thE.connect(audio.dry);
}

function synthBass(t, midi, dur) {
  logNote('bass', t, midi, dur, 0.85);
  const hz = midiToHz(midi), end = t + dur + 0.1;
  const peak = rand(0.085, 0.11);
  for (const detune of [-8, 8]) {
    const o = osc('sawtooth', hz, t, end, detune);
    const lp = filter('lowpass', 80, 6);
    lp.frequency.setValueAtTime(80, t);
    lp.frequency.exponentialRampToValueAtTime(600 + 500 * state.brightness, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(180, t + Math.max(0.06, dur * 0.8));
    const env = gain(0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.006);
    env.gain.setTargetAtTime(0, t + dur, 0.02);
    o.connect(lp); lp.connect(env); env.connect(audio.dry);
  }
}

function rumbleBass(t, midi, dur) {
  logNote('bass', t, midi, dur, 0.7);
  const hz = midiToHz(midi), end = t + dur + 0.6;
  const peak = rand(0.07, 0.09);
  const lp = filter('lowpass', 300, 1.5);
  osc('square', hz, t, end).connect(lp);
  if (hz / 2 >= 35) osc('sine', hz / 2, t, end).connect(lp);
  const env = gain(0);
  ahr(env.gain, t, peak, 0.2, dur - 0.1, 0.5);
  const trem = osc('sine', rand(3, 6), t, end), tremG = gain(peak * 0.3);
  trem.connect(tremG); tremG.connect(env.gain);
  lp.connect(env); env.connect(audio.dry);
}

// ─── Scheduling ───────────────────────────────────────────────────────────────
function play(t, b) {
  const bar = Math.floor(b / 4 + 1e-9), pos = b - bar * 4;
  if (bar !== curBar) {
    curBar = bar;
    if (Math.random() < 0.3) cell = pick(PLUCK_RHYTHMS);
    if (Math.random() < 0.15) pattern = pick(SYNTH_PATTERNS);
  }

  if (style === 'sub' || style === 'rumble') {
    const seg = harmony.at(b), len = seg.end - b;
    prev = root(seg);
    (style === 'sub' ? subBass : rumbleBass)(t, prev, len * beat());
    return len;
  }

  if (style === 'walking') {
    prev = walkNote(b);
    stringBass(t, prev, beat() * 0.95, { bright: 0.22, pick: 0.28, t60: 1.2, level: 0.5 });
    return 1;
  }

  if (style === 'plucked') {
    let acc = 0;
    for (const [len, code] of cell) {
      if (Math.abs(acc - pos) < 1e-6) {
        const midi = resolve(code, b, len);
        prev = midi;
        stringBass(t, midi, len * beat() * 0.9, { bright: 0.4, pick: 0.18, t60: 1.6, level: 0.42 });
        return len;
      }
      if (acc > pos) return acc - pos;
      acc += len;
    }
    return 4 - pos;
  }

  // synth: one sixteenth step at a time
  const i = Math.round(pos * 4) % 16, ch = pattern[i];
  if (ch !== '.' && ch !== '-') {
    let n = 1;
    while (i + n < 16 && pattern[i + n] === '-') n++;
    const midi = resolve(ch, b, n / 4);
    prev = midi;
    synthBass(t, midi, (n / 4) * beat() * 0.9);
  }
  return 0.25;
}

const voice = createVoice('bass', play, { onReset: () => { prev = null; curBar = -1; } });

export const bassVoice = {
  ...voice,
  get style() { return style; },
  reroll() { style = pick(STYLES); cell = pick(PLUCK_RHYTHMS); pattern = pick(SYNTH_PATTERNS); },
  setStyle(s) { style = s; },
};
