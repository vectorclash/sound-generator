import { audio, getVoiceBus, noise } from '../context.js';
import { beat, register, midiToHz } from '../../state.js';
import { createVoice } from '../transport.js';
import { logNote } from '../notes.js';
import { createPhraser } from '../phrase.js';
import { osc, gain, filter, send, lfo, perc } from '../synth.js';

// Flute: a nearly sinusoidal tone with weak 2nd/3rd harmonics (they thin out
// in the upper register), breath noise that runs through the whole note — not
// just the attack — and vibrato that is partly pitch, partly amplitude, eased
// in after the note has spoken. The attack starts slightly flat and settles,
// as a flute's pitch does while the air column locks in.
const phraser = createPhraser({ name: 'flute', base: () => register(36, 60, 74), lead: true });

function play(t, b) {
  const ev = phraser.next(b);
  if (ev.midi === null) return ev.gap;

  const bus  = getVoiceBus('flute').dry;
  const hz   = midiToHz(ev.midi);
  const dur  = ev.dur * beat();
  const peak = 0.12 * ev.vel;
  const end  = t + dur + 0.4;
  const high = hz > 700;
  logNote('flute', t, ev.midi, dur, ev.vel);

  const env = gain(0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.07);
  env.gain.setTargetAtTime(0, t + dur, 0.06);

  const trem = gain(1);
  lfo(5.1, 0.07, t, end, 0.3, 0.35).connect(trem.gain);
  const vib = lfo(5.1, 13, t, end, 0.3, 0.35);

  for (const [n, level] of [[1, 1], [2, high ? 0.12 : 0.25], [3, high ? 0.03 : 0.07]]) {
    const o = osc('sine', hz * n, t, end);
    o.detune.setValueAtTime(-14, t);
    o.detune.linearRampToValueAtTime(0, t + 0.07);
    vib.connect(o.detune);
    const g = gain(level);
    o.connect(g); g.connect(trem);
  }
  trem.connect(env);

  // Breath: noise band-passed around the note, under the tone for its length…
  const air = noise(t, dur + 0.4);
  const airBp = filter('bandpass', hz, 3.5);
  const airG = gain(0.35);
  air.connect(airBp); airBp.connect(airG); airG.connect(env);

  // …plus a brief breathy "chiff" as the note starts.
  const chiff = noise(t, 0.12);
  const chiffHp = filter('highpass', hz * 2.2);
  const chiffEnv = gain(0);
  perc(chiffEnv.gain, t, peak * 0.22, 0.09, 0.01);
  chiff.connect(chiffHp); chiffHp.connect(chiffEnv); chiffEnv.connect(bus);

  env.connect(bus);
  send(env, audio.reverbSend, 0.55);
  return ev.gap;
}

export const fluteVoice = createVoice('flute', play, { entry: 4, role: 'lead', onReset: phraser.reset });
