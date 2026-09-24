import { audio, getVoiceBus } from '../context.js';
import { state, beat, rand, lerp, register, midiToHz } from '../../state.js';
import { createVoice } from '../transport.js';
import { logNote } from '../notes.js';
import { createPhraser } from '../phrase.js';
import { osc, gain, send, lfo } from '../synth.js';

// Soft synth lead: triangle with a quiet octave partial and delayed vibrato.
// One consistent timbre (it used to flip between sine and triangle per note).
const phraser = createPhraser({ name: 'melody', base: () => register(64, 28, 81), lead: true });

function play(t, b) {
  const ev = phraser.next(b);
  if (ev.midi === null) return ev.gap;

  const bus  = getVoiceBus('melody').dry;
  const hz   = midiToHz(ev.midi);
  const dur  = ev.dur * beat();
  const peak = 0.15 * ev.vel * lerp(0.6, 1.0, state.density);
  const end  = t + dur + 0.5;
  logNote('melody', t, ev.midi, dur, ev.vel);

  const env = gain(0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.025);
  env.gain.setTargetAtTime(peak * 0.72, t + 0.025, 0.3);
  env.gain.setTargetAtTime(0, t + dur, 0.07);

  const main = osc('triangle', hz, t, end, rand(-3, 3));
  const oct  = osc('sine', hz * 2, t, end);
  const octG = gain(0.16);
  const vib  = lfo(rand(4.8, 5.6), 11, t, end, Math.min(0.3, dur * 0.5), 0.35); // cents
  vib.connect(main.detune); vib.connect(oct.detune);

  main.connect(env); oct.connect(octG); octG.connect(env);
  env.connect(bus);
  send(env, audio.reverbSend, 0.5);
  send(env, audio.echoSend, 0.12);
  return ev.gap;
}

export const melodyVoice = createVoice('melody', play, { entry: 4, role: 'lead', onReset: phraser.reset });
