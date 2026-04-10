import { scene, camera, renderer, clock } from './scene.js';
import { icoMesh, updateShapes } from './shapes.js';
import { updateStars } from './stars.js';
import { audio } from '../audio/context.js';
import { state } from '../state.js';

let cameraAngle = 0;

function animate() {
  requestAnimationFrame(animate);

  if (!audio.started || !audio.analyser) {
    // Idle: gentle slow spin before playback starts
    icoMesh.rotation.y += 0.004;
    icoMesh.rotation.x += 0.001;
    cameraAngle += 0.003;
    camera.position.set(Math.sin(cameraAngle) * 7, 1.5, Math.cos(cameraAngle) * 7);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    return;
  }

  audio.analyser.getByteFrequencyData(audio.freqData);

  // Energy metrics
  let energy = 0;
  for (let i = 0; i < audio.freqData.length; i++) energy += audio.freqData[i];
  energy /= audio.freqData.length * 255;

  let bass = 0;
  for (let i = 0; i < 8; i++) bass += audio.freqData[i];
  bass /= 8 * 255;

  // Hue shifts with musical key + era
  const hue = (state.rootMidi * 15 + state.era * 40) % 360;
  const t   = clock.getElapsedTime();

  updateShapes(audio.freqData, energy, bass, hue);
  updateStars(energy, bass, hue, t);

  cameraAngle += 0.0035 + energy * 0.0018;
  camera.position.set(
    Math.sin(cameraAngle) * 7.5,
    Math.sin(cameraAngle * 0.37) * 2.2 + 1.0,
    Math.cos(cameraAngle) * 7.5,
  );
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
}

export function startAnimation() {
  animate();
}
