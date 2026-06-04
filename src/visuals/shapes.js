import * as THREE from 'three';
import { scene } from './scene.js';

// ─── Wireframe icosahedron ────────────────────────────────────────────────────
const icoGeo     = new THREE.IcosahedronGeometry(1.5, 5);
export const icoOrigPos = icoGeo.attributes.position.array.slice();
const icoMat     = new THREE.MeshBasicMaterial({
  color: 0x334466, wireframe: true, transparent: true, opacity: 0.75,
});
export const icoMesh = new THREE.Mesh(icoGeo, icoMat);
scene.add(icoMesh);

// ─── Inner glow sphere ────────────────────────────────────────────────────────
const glowGeo = new THREE.SphereGeometry(1.0, 32, 32);
const glowMat = new THREE.MeshBasicMaterial({
  color: 0x112244, transparent: true, opacity: 0.35,
  blending: THREE.AdditiveBlending, depthWrite: false,
});
const glowMesh = new THREE.Mesh(glowGeo, glowMat);
scene.add(glowMesh);

// ─── Frequency bars — ring of 64 pillars, up + down mirror ───────────────────
const BAR_COUNT   = 64;
const RING_RADIUS = 3.2;
const freqBars     = [];
const freqBarsDown = [];

for (let i = 0; i < BAR_COUNT; i++) {
  const angle = (i / BAR_COUNT) * Math.PI * 2;

  const bGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
  bGeo.translate(0, 0.5, 0); // pivot at bottom — grows upward
  const bMat = new THREE.MeshBasicMaterial({
    color: 0x446699, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const bar = new THREE.Mesh(bGeo, bMat);
  bar.position.set(Math.cos(angle) * RING_RADIUS, -0.4, Math.sin(angle) * RING_RADIUS);
  scene.add(bar);
  freqBars.push(bar);

  const dGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
  dGeo.translate(0, -0.5, 0); // pivot at top — grows downward
  const dBar = new THREE.Mesh(dGeo, bMat); // share material with up bar
  dBar.position.set(Math.cos(angle) * RING_RADIUS, -0.4, Math.sin(angle) * RING_RADIUS);
  scene.add(dBar);
  freqBarsDown.push(dBar);
}

// ─── Update (called each animation frame) ────────────────────────────────────
const _col = new THREE.Color();

export function updateShapes(freqData, energy, bass, hue) {
  // Icosahedron vertex deformation
  const pos = icoMesh.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    const ox = icoOrigPos[i], oy = icoOrigPos[i + 1], oz = icoOrigPos[i + 2];
    const len = Math.sqrt(ox * ox + oy * oy + oz * oz);
    const nx = ox / len, ny = oy / len, nz = oz / len;
    const t   = Math.abs(Math.atan2(nz, nx) / Math.PI) * 0.5 + Math.abs(ny) * 0.5;
    const bin = Math.floor(t * freqData.length * 0.75);
    const disp = 1.5 + (freqData[bin] / 255) * 1.1 + bass * 0.5;
    pos[i] = nx * disp; pos[i + 1] = ny * disp; pos[i + 2] = nz * disp;
  }
  icoMesh.geometry.attributes.position.needsUpdate = true;
  _col.setHSL(hue / 360, 0.65, 0.55);
  icoMat.color.copy(_col);
  icoMesh.rotation.y += 0.003 + energy * 0.006;
  icoMesh.rotation.x += 0.001 + energy * 0.002;

  // Glow sphere
  _col.setHSL(hue / 360, 0.85, 0.25);
  glowMat.color.copy(_col);
  glowMat.opacity = 0.15 + bass * 0.65;
  glowMesh.scale.setScalar(1.0 + bass * 0.6);

  // Frequency bars
  for (let i = 0; i < BAR_COUNT; i++) {
    const val = freqData[Math.floor(i * freqData.length / BAR_COUNT)] / 255;
    const bh  = ((hue + i * (360 / BAR_COUNT)) % 360) / 360;
    _col.setHSL(bh, 0.85, 0.35 + val * 0.45);
    freqBars[i].scale.y = 0.04 + val * 3.5;
    freqBars[i].material.color.copy(_col);
    freqBars[i].material.opacity = 0.25 + val * 0.75;
    freqBarsDown[i].scale.y = 0.04 + val * 3.5; // material is shared — color/opacity update above applies
  }
}
