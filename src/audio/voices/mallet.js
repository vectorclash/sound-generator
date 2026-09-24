import { audio, getVoiceBus, noise } from '../context.js';
import { clamp, register, midiToHz } from '../../state.js';
import { createVoice } from '../transport.js';
import { createPhraser } from '../phrase.js';
import { osc, gain, filter, send, perc } from '../synth.js';

// Marimba: rosewood bars tuned so the first overtone is two octaves up (4×)
// and the next near 10× — the old version used 1:2:4, an octave that a
// marimba bar doesn't have. Low bars ring longer than high ones, and a soft
// yarn-mallet thump sits under the attack. Plays ostinato figures.
const phraser = createPhraser({ name: 'mallet', base: () => register(24, 45, 62), style: 'active', ostinato: true, repeat: 0.8 });

function play(t, b) {
  const ev = phraser.next(b);
  if (ev.midi === null) return ev.gap;

  const bus   = getVoiceBus('mallet').dry;
  const hz    = midiToHz(ev.midi);
  const peak  = 0.32 * ev.vel;
  const decay = clamp(0.4 * Math.pow(400 / hz, 0.6), 0.18, 1.4);

  const out = gain(1);
  for (const [ratio, level, d] of [[1, 1, 1], [3.93, 0.2, 0.22], [9.4, 0.05, 0.07]]) {
    if (hz * ratio > 16000) continue;
    const o = osc('sine', hz * ratio, t, t + decay + 0.05), e = gain(0);
    perc(e.gain, t, peak * level, decay * d);
    o.connect(e); e.connect(out);
  }
  const th = noise(t, 0.02), thLp = filter('lowpass', 1200), thE = gain(0);
  perc(thE.gain, t, peak * 0.3, 0.012, 0.001);
  th.connect(thLp); thLp.connect(thE); thE.connect(out);

  out.connect(bus);
  send(out, audio.reverbSend, 0.4);
  return ev.gap;
}

export const malletVoice = createVoice('mallet', play, { entry: 4, role: 'motion', onReset: phraser.reset });
