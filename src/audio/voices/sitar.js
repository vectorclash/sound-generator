import { audio } from '../context.js';
import { state, SCALES, SCALE_NAMES, LOOKAHEAD, beat, rand, pick, midiToHz, scaleNotes } from '../../state.js';

export const sitarVoice = (() => {
  let nextTime = 0;
  let lastMidi = -1;

  function play(t) {
    const { ctx, masterGain, reverbNode } = audio;
    if (Math.random() < 0.2) return beat() * pick([0.5, 1]);

    const scale = SCALES[SCALE_NAMES[state.scaleIdx]];
    const notes = scaleNotes(state.rootMidi + 36, scale, 2);
    let midi;
    if (lastMidi > 0 && Math.random() < 0.55) {
      const idx = notes.indexOf(lastMidi);
      if (idx >= 0) midi = notes[Math.max(0, Math.min(notes.length - 1, idx + pick([-2, -1, 1, 2])))];
    }
    if (!midi) midi = pick(notes);
    lastMidi = midi;

    const hz   = midiToHz(midi);
    const dur  = beat() * pick([1, 1.5, 2]);
    const gain = rand(0.08, 0.14);

    // Main plucked string
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = hz;
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);

    // Jawari buzz — detuned pair creates characteristic beating shimmer
    const buzz    = ctx.createOscillator();
    const buzzEnv = ctx.createGain();
    buzz.type = 'sine';
    buzz.frequency.value = hz * 1.004;
    buzzEnv.gain.setValueAtTime(gain * 0.35, t);
    buzzEnv.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);

    // Sympathetic string — quiet root drone that blooms slowly
    const symp    = ctx.createOscillator();
    const sympEnv = ctx.createGain();
    symp.type = 'sine';
    symp.frequency.value = midiToHz(state.rootMidi + 36);
    sympEnv.gain.setValueAtTime(0, t);
    sympEnv.gain.linearRampToValueAtTime(gain * 0.07, t + 0.08);
    sympEnv.gain.exponentialRampToValueAtTime(0.001, t + dur + 1.2);

    osc.connect(env); env.connect(masterGain);
    buzz.connect(buzzEnv); buzzEnv.connect(masterGain);
    symp.connect(sympEnv); sympEnv.connect(masterGain);
    const wet = ctx.createGain(); wet.gain.value = 0.18;
    env.connect(wet); wet.connect(reverbNode);

    osc.start(t); osc.stop(t + dur + 0.05);
    buzz.start(t); buzz.stop(t + dur * 0.6 + 0.05);
    symp.start(t); symp.stop(t + dur + 1.3);

    return beat() * pick([0.5, 1, 1, 1.5]);
  }

  return {
    name: 'sitar',
    tick(now) {
      while (nextTime < now + LOOKAHEAD) {
        if (!nextTime) nextTime = now;
        nextTime += play(nextTime);
      }
    },
    reset(now) { nextTime = now; lastMidi = -1; },
  };
})();
