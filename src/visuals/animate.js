import { scene, camera, renderer, clock } from './scene.js';
import { updateShapes } from './shapes.js';
import { updateStars } from './stars.js';
import { updateNebulae } from './nebula.js';
import { audio } from '../audio/context.js';
import { state } from '../state.js';

let cameraAngle = 0;
let audioStartT = null;
const FADE_IN   = 2.5; // seconds to ramp audio reactivity from 0 → full

// Reusable zero-filled freq array for the idle state (shapes stay at rest)
const zeroFreq = new Uint8Array(256);

function animate(timestamp) {
  requestAnimationFrame(animate);
  clock.update(timestamp);

  const t   = clock.getElapsed();
  const hue = (state.rootMidi * 15 + state.era * 40) % 360;

  let energy = 0, bass = 0, fade = 0, freqData = zeroFreq;

  if (audio.started && audio.analyser) {
    if (!audioStartT) audioStartT = t;
    fade = Math.min(1, (t - audioStartT) / FADE_IN);

    audio.analyser.getByteFrequencyData(audio.freqData);
    freqData = audio.freqData;

    let rawEnergy = 0;
    for (let i = 0; i < freqData.length; i++) rawEnergy += freqData[i];
    rawEnergy /= freqData.length * 255;

    let rawBass = 0;
    for (let i = 0; i < 8; i++) rawBass += freqData[i];
    rawBass /= 8 * 255;

    energy = rawEnergy * fade;
    bass   = rawBass * fade;
  }

  // Always update shapes and stars — idle energy=0 keeps everything at rest
  // but still visible and gently moving
  updateShapes(freqData, energy, bass, hue);
  updateStars(energy, bass, hue, t);
  updateNebulae(energy, bass, hue, t);

  // Camera: lerp from flat idle orbit (r=7, y=1.5) to wavy active orbit (r=7.5)
  const activeY = Math.sin(cameraAngle * 0.37) * 2.2 + 1.0;
  const camY    = 1.5 + (activeY - 1.5) * fade;
  const camR    = 7.0 + 0.5 * fade;
  cameraAngle  += 0.003 + energy * 0.0018;

  camera.position.set(Math.sin(cameraAngle) * camR, camY, Math.cos(cameraAngle) * camR);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

export function startAnimation() {
  animate();
}
