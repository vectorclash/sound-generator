import { audio } from './context.js';
import { state, SCALE_NAMES, TICK_MS, rand, pick } from '../state.js';

import { bassVoice }     from './voices/bass.js';
import { padVoice }      from './voices/pad.js';
import { melodyVoice }   from './voices/melody.js';
import { textureVoice }  from './voices/texture.js';
import { pluckVoice }    from './voices/pluck.js';
import { bellVoice }     from './voices/bell.js';
import { arpeggioVoice } from './voices/arpeggio.js';
import { malletVoice }   from './voices/mallet.js';
import { droneVoice }    from './voices/drone.js';
import { fluteVoice }    from './voices/flute.js';
import { choirVoice }    from './voices/choir.js';
import { stringsVoice }  from './voices/strings.js';
import { rhodesVoice }     from './voices/rhodes.js';
import { organVoice }      from './voices/organ.js';
import { glassVoice }      from './voices/glass.js';
import { harpVoice }       from './voices/harp.js';
import { brassVoice }      from './voices/brass.js';
import { drumsVoice }      from './voices/drums.js';
import { vibraphoneVoice } from './voices/vibraphone.js';
import { clavinetVoice }   from './voices/clavinet.js';
import { sitarVoice }      from './voices/sitar.js';
import { kalimbaVoice }    from './voices/kalimba.js';

export {
  bassVoice, padVoice, melodyVoice, textureVoice, pluckVoice,
  bellVoice, arpeggioVoice, malletVoice, droneVoice, fluteVoice,
  choirVoice, stringsVoice, rhodesVoice, organVoice, glassVoice,
  harpVoice, brassVoice, drumsVoice,
  vibraphoneVoice, clavinetVoice, sitarVoice, kalimbaVoice,
};

// ─── Voice pool ───────────────────────────────────────────────────────────────
// Bass always plays. Each era draws 3–5 from this pool at random.
// Drums are weighted with two slots so they appear ~1/3 of eras on average.
const VOICE_POOL = [
  padVoice, melodyVoice, textureVoice, pluckVoice,
  bellVoice, arpeggioVoice, malletVoice, droneVoice, fluteVoice, choirVoice,
  stringsVoice, rhodesVoice, organVoice, glassVoice, harpVoice, brassVoice,
  vibraphoneVoice, clavinetVoice, sitarVoice, kalimbaVoice,
  drumsVoice, drumsVoice,
];

export let activeVoices = [];

export function pickVoices() {
  const seen     = new Set();
  const shuffled = VOICE_POOL.slice().sort(() => Math.random() - 0.5).filter(v => {
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
  activeVoices = shuffled.slice(0, 3 + Math.floor(Math.random() * 3)); // 3–5
}

export function setActiveVoices(voices) {
  activeVoices = voices;
}

// ─── Era / evolution ──────────────────────────────────────────────────────────
export let eraTimer = 0;
export const ERA_DURATION = 38;

export function advanceEra() {
  state.era++;
  const shifts = [-7, -5, -2, 0, 0, 2, 5, 7];
  state.rootMidi     = Math.max(24, Math.min(48, state.rootMidi + pick(shifts)));
  state.scaleIdx     = Math.floor(Math.random() * SCALE_NAMES.length);
  state.tempo        = Math.max(52, Math.min(130, state.tempo + rand(-8, 8)));
  state.brightness   = rand(0.1, 0.9);
  state.spaciousness = rand(0.2, 0.85);
  state.density      = rand(0.2, 0.9);
  pickVoices();
  bassVoice.reroll();
  drumsVoice.reroll();
}

export function evolve(dt) {
  eraTimer += dt;
  if (eraTimer >= ERA_DURATION) {
    eraTimer -= ERA_DURATION;
    advanceEra();
  }
  state.brightness   = Math.max(0.05, Math.min(0.95, state.brightness   + (Math.random() - 0.5) * 0.002));
  state.density      = Math.max(0.10, Math.min(1.00, state.density      + (Math.random() - 0.5) * 0.001));
  state.spaciousness = Math.max(0.10, Math.min(0.90, state.spaciousness + (Math.random() - 0.5) * 0.001));
}

// ─── Tick ─────────────────────────────────────────────────────────────────────
let lastTickTime = 0;

export function resetTickTimer() { lastTickTime = 0; eraTimer = 0; }

export function tick({ skipBass = false, skipEvolve = false } = {}) {
  if (!audio.started) return;
  const now = audio.ctx.currentTime;
  const dt  = now - (lastTickTime || now);
  lastTickTime = now;

  if (!skipBass) bassVoice.tick(now);
  for (const v of activeVoices) v.tick(now);
  if (!skipEvolve) evolve(dt);
}

export { TICK_MS };
