import { audio, getVoiceBus, noise } from '../context.js';
import { beat, pick, clamp, register, midiToHz } from '../../state.js';
import { createVoice } from '../transport.js';
import { createPhraser } from '../phrase.js';
import { osc, gain, filter, send, lfo, perc } from '../synth.js';

// Vibraphone: tuned aluminium bars. The bars are cut so their first overtone
// sits two octaves up (4×) and the next near 10× — not the 2.76× of an
// untuned bar, which the old version used and which rang out of tune against
// the chords. The motor-driven discs in the resonators give the pulsing
// tremolo; the pedal lets notes ring past their written length.
const phraser = createPhraser({ name: 'vibraphone', base: () => register(36, 53, 70), lead: true });
let motor = 5.5;

function play(t, b) {
  const ev = phraser.next(b);
  if (ev.midi === null) return ev.gap;

  const bus  = getVoiceBus('vibraphone').dry;
  const hz   = midiToHz(ev.midi);
  const ring = clamp(ev.dur * beat() * 1.6 + 0.8, 1, 4.5 * Math.sqrt(300 / hz));
  const peak = 0.22 * ev.vel;
  const end  = t + ring + 0.05;

  const trem = gain(1);
  if (motor) lfo(motor, 0.22, t, end).connect(trem.gain);

  for (const [ratio, level, decay] of [[1, 1, 1], [3.98, 0.22, 0.28], [9.95, 0.06, 0.07]]) {
    const o = osc('sine', hz * ratio, t, end);
    const e = gain(0);
    perc(e.gain, t, peak * level, ring * decay);
    o.connect(e); e.connect(trem);
  }
  // Soft mallet contact.
  const tick = noise(t, 0.02);
  const tickLp = filter('lowpass', 3500);
  const tickE = gain(0);
  perc(tickE.gain, t, peak * 0.25, 0.012, 0.001);
  tick.connect(tickLp); tickLp.connect(tickE); tickE.connect(bus);

  trem.connect(bus);
  send(trem, audio.reverbSend, 0.35);
  send(trem, audio.echoSend, 0.08);
  return ev.gap;
}

export const vibraphoneVoice = createVoice('vibraphone', play, {
  entry: 4, role: 'lead',
  onReset: () => { phraser.reset(); motor = pick([0, 3.8, 5.5, 5.5]); },
});
