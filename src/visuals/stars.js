import * as THREE from 'three';
import { scene } from './scene.js';

// ─── Sprite textures ──────────────────────────────────────────────────────────
const texLoader = new THREE.TextureLoader();
const smallTex  = texLoader.load('images/star-sprite-small.png');
const largeTex  = texLoader.load('images/star-sprite-large.png');

// ─── Layer factory ────────────────────────────────────────────────────────────
function makeStarLayer(count, rMin, rMax, speedMin, speedMax) {
  const pos = new Float32Array(count * 3);
  const cyl = new Float32Array(count * 5); // [rCyl, baseAngle, yBase, phase, speed]
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = rMin + Math.random() * (rMax - rMin);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    cyl[i * 5]     = Math.sqrt(x * x + z * z);
    cyl[i * 5 + 1] = Math.atan2(z, x);
    cyl[i * 5 + 2] = y;
    cyl[i * 5 + 3] = Math.random() * Math.PI * 2;
    cyl[i * 5 + 4] = speedMin + Math.random() * (speedMax - speedMin);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return { pos, cyl, geo };
}

// ─── Small star layer (Points) ────────────────────────────────────────────────
export const SMALL_COUNT = 7500;
const smallLayer = makeStarLayer(SMALL_COUNT, 10, 45, 0.4, 1.4);

const smallMat = new THREE.PointsMaterial({
  size: 0.6, map: smallTex, color: 0x99ccff,
  transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
  sizeAttenuation: true, alphaTest: 0.01, fog: false,
});
scene.add(new THREE.Points(smallLayer.geo, smallMat));

// ─── Large star layer (Sprites — no GPU point-size cap) ───────────────────────
export const LARGE_COUNT = 80;
const largeLayer = makeStarLayer(LARGE_COUNT, 8, 35, 0.2, 0.7);

const largeSpriteMat = new THREE.SpriteMaterial({
  map: largeTex, color: 0xff99cc,
  transparent: true, opacity: 1.0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
});
const largeSprites = [];
for (let i = 0; i < LARGE_COUNT; i++) {
  const sprite = new THREE.Sprite(largeSpriteMat.clone());
  sprite.userData.baseScale = 1.5 + Math.random() * 5.5; // 1.5–7.0
  sprite.scale.setScalar(sprite.userData.baseScale);
  sprite.position.set(largeLayer.pos[i * 3], largeLayer.pos[i * 3 + 1], largeLayer.pos[i * 3 + 2]);
  scene.add(sprite);
  largeSprites.push(sprite);
}

// ─── Flow field constants (irrational ratios → aperiodic organic motion) ─────
const PHI = 1.6180339887, RT2 = 1.4142135623, RT3 = 1.7320508075;

function applyFlow(pos, cyl, count, ft, audioMod) {
  for (let i = 0; i < count; i++) {
    const rCyl    = cyl[i * 5];
    const baseAng = cyl[i * 5 + 1];
    const yBase   = cyl[i * 5 + 2];
    const phase   = cyl[i * 5 + 3];
    const spd     = cyl[i * 5 + 4];
    // Spatial seeds — nearby stars share similar values → coherent flow
    const sx = baseAng, sy = yBase * 0.016, sr = rCyl * 0.011;
    // Angular drift
    const angFlow =
        Math.sin(sx * PHI      + ft * 0.71 + phase)          * 0.07
      + Math.sin(sy * RT2      + ft * 0.44 * PHI + sr)       * 0.04
      + Math.sin(sx * RT3 + sy * PHI + ft * 0.29)            * 0.025;
    const angle = baseAng + angFlow * spd + ft * 0.025 * spd;
    // Radial breathing
    const radFlow =
        Math.sin(sx * RT2      + ft * 0.51 + phase * PHI)    * 2.2
      + Math.sin(sy * PHI      + ft * 0.28 * RT2 + sr * RT3) * 1.1
      + Math.sin(sr            + ft * 0.19 + phase)          * 0.7;
    const r = rCyl + radFlow * audioMod;
    // Vertical undulation
    const yFlow =
        Math.sin(sx            + ft * 0.58 + phase * RT2)    * 2.2
      + Math.sin(sy * RT3 + sx * PHI * 0.4 + ft * 0.35)     * 1.4
      + Math.sin(sr * PHI      + ft * 0.22 + phase * RT3)    * 0.9;
    pos[i * 3]     = Math.cos(angle) * r;
    pos[i * 3 + 1] = yBase + yFlow * audioMod;
    pos[i * 3 + 2] = Math.sin(angle) * r;
  }
}

// ─── Update (called each animation frame) ────────────────────────────────────
const _col = new THREE.Color();

export function updateStars(energy, bass, hue, t) {
  const ft       = t * 0.06;
  const audioMod = 1.0 + energy * 0.35 + bass * 0.25;

  applyFlow(smallLayer.pos, smallLayer.cyl, SMALL_COUNT, ft, audioMod);
  applyFlow(largeLayer.pos, largeLayer.cyl, LARGE_COUNT, ft, audioMod);
  smallLayer.geo.attributes.position.needsUpdate = true;

  _col.setHSL(((hue + 30)  % 360) / 360, 0.75, 0.70);
  smallMat.color.copy(_col);
  smallMat.size    = 0.6  + energy * 0.15 + bass * 0.10;
  smallMat.opacity = 0.9;

  _col.setHSL(((hue + 180) % 360) / 360, 0.90, 0.80);
  const audioPulse = 1.0 + energy * 0.6 + bass * 0.5;
  for (let i = 0; i < LARGE_COUNT; i++) {
    largeSprites[i].position.set(
      largeLayer.pos[i * 3],
      largeLayer.pos[i * 3 + 1],
      largeLayer.pos[i * 3 + 2],
    );
    largeSprites[i].scale.setScalar(largeSprites[i].userData.baseScale * audioPulse);
    largeSprites[i].material.color.copy(_col);
  }
}
