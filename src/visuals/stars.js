import * as THREE from 'three';
import { scene } from './scene.js';

// ─── Sprite textures ──────────────────────────────────────────────────────────
const texLoader = new THREE.TextureLoader();
const smallTex  = texLoader.load('images/star-sprite-small.png');

const largeTex = texLoader.load('images/star-sprite-large.png');

// ─── Star cluster config ──────────────────────────────────────────────────────
const CLUSTER = {
  freqLarge:  0.04,
  freqMid:    0.10,
  freqFine:   0.28,
  ampLarge:   0.60,
  ampMid:     0.28,
  ampFine:    0.12,
  contrast:   7,
  fill:       3.5,
};

// ─── 3D value noise for organic star clustering ───────────────────────────────
function nHash(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
function nLerp(a, b, t) { return a + (b - a) * t; }
function nSmooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = nSmooth(x - ix), fy = nSmooth(y - iy), fz = nSmooth(z - iz);
  return nLerp(
    nLerp(nLerp(nHash(ix,   iy,   iz  ), nHash(ix+1, iy,   iz  ), fx),
          nLerp(nHash(ix,   iy+1, iz  ), nHash(ix+1, iy+1, iz  ), fx), fy),
    nLerp(nLerp(nHash(ix,   iy,   iz+1), nHash(ix+1, iy,   iz+1), fx),
          nLerp(nHash(ix,   iy+1, iz+1), nHash(ix+1, iy+1, iz+1), fx), fy),
    fz
  );
}
function clusterDensity(x, y, z) {
  return valueNoise(x * CLUSTER.freqLarge, y * CLUSTER.freqLarge, z * CLUSTER.freqLarge) * CLUSTER.ampLarge
       + valueNoise(x * CLUSTER.freqMid,   y * CLUSTER.freqMid,   z * CLUSTER.freqMid)   * CLUSTER.ampMid
       + valueNoise(x * CLUSTER.freqFine,  y * CLUSTER.freqFine,  z * CLUSTER.freqFine)  * CLUSTER.ampFine;
}

// ─── Assign a color personality to each star at creation time ─────────────────
// Returns { hueFixed, hueVal, satVal, litVal }
//   hueFixed = true  → hueVal is an absolute hue (0–1), ignores musical hue
//   hueFixed = false → hueVal is a signed offset added to the musical hue
function starColorPersonality() {
  const t = Math.random();
  if (t < 0.38) {
    // Musical — tracks the palette hue with a small individual offset
    return { hueFixed: false, hueVal: (Math.random() - 0.5) * 0.08,
             satVal: 0.80 + Math.random() * 0.20, litVal: 0.48 + Math.random() * 0.16 };
  } else if (t < 0.62) {
    // Blue-white (O/B type) — fixed cool hue regardless of music
    return { hueFixed: true,  hueVal: 0.55 + Math.random() * 0.10,
             satVal: 0.65 + Math.random() * 0.30, litVal: 0.52 + Math.random() * 0.18 };
  } else if (t < 0.80) {
    // Warm orange/red (K/M type) — fixed warm hue
    return { hueFixed: true,  hueVal: 0.04 + Math.random() * 0.06,
             satVal: 0.85 + Math.random() * 0.15, litVal: 0.45 + Math.random() * 0.18 };
  } else {
    // Near-white / neutral — low saturation, any hue
    return { hueFixed: false, hueVal: (Math.random() - 0.5) * 0.20,
             satVal: 0.08 + Math.random() * 0.18, litVal: 0.65 + Math.random() * 0.20 };
  }
}

// ─── Layer factory ────────────────────────────────────────────────────────────
function makeStarLayer(count, rMin, rMax, speedMin, speedMax) {
  const pos      = new Float32Array(count * 3);
  const cyl      = new Float32Array(count * 5);
  const colors   = new Float32Array(count * 3);
  const hueFixed = new Uint8Array(count);
  const hueVal   = new Float32Array(count);
  const satVal   = new Float32Array(count);
  const litVal   = new Float32Array(count);

  let placed = 0;
  while (placed < count) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = rMin + Math.random() * (rMax - rMin);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    const d = clusterDensity(x, y, z);
    if (Math.random() > Math.pow(d, CLUSTER.contrast) * CLUSTER.fill) continue;

    cyl[placed * 5]     = Math.sqrt(x * x + z * z);
    cyl[placed * 5 + 1] = Math.atan2(z, x);
    cyl[placed * 5 + 2] = y;
    cyl[placed * 5 + 3] = Math.random() * Math.PI * 2;
    cyl[placed * 5 + 4] = speedMin + Math.random() * (speedMax - speedMin);
    pos[placed * 3] = x; pos[placed * 3 + 1] = y; pos[placed * 3 + 2] = z;

    const p = starColorPersonality();
    hueFixed[placed] = p.hueFixed ? 1 : 0;
    hueVal[placed]   = p.hueVal;
    satVal[placed]   = p.satVal;
    litVal[placed]   = p.litVal;

    placed++;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  return { pos, cyl, geo, colors, hueFixed, hueVal, satVal, litVal };
}

// ─── Small star layer (Points) ────────────────────────────────────────────────
export const SMALL_COUNT = 7500;
const smallLayer = makeStarLayer(SMALL_COUNT, 10, 45, 0.4, 1.4);

const smallMat = new THREE.PointsMaterial({
  size: 0.6, map: smallTex,
  vertexColors: true, color: 0xffffff,
  transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
  sizeAttenuation: true, alphaTest: 0.01, fog: false,
});
scene.add(new THREE.Points(smallLayer.geo, smallMat));

// ─── Large star layer (Sprites — individual materials for per-star color) ──────
export const LARGE_COUNT = 80;
const largeLayer = makeStarLayer(LARGE_COUNT, 8, 35, 0.2, 0.7);

const largeSprites = [];
for (let i = 0; i < LARGE_COUNT; i++) {
  const baseScale = 1.5 + Math.random() * 5.5;
  const px = largeLayer.pos[i * 3], py = largeLayer.pos[i * 3 + 1], pz = largeLayer.pos[i * 3 + 2];

  const mat = new THREE.SpriteMaterial({
    map: largeTex, color: 0xffffff,
    transparent: true, opacity: 1.0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.userData.baseScale = baseScale;
  sprite.scale.setScalar(baseScale);
  sprite.position.set(px, py, pz);
  scene.add(sprite);
  largeSprites.push(sprite);
}

// ─── Flow field constants ─────────────────────────────────────────────────────
const PHI = 1.6180339887, RT2 = 1.4142135623, RT3 = 1.7320508075;

function applyFlow(pos, cyl, count, ft, audioMod) {
  for (let i = 0; i < count; i++) {
    const rCyl    = cyl[i * 5];
    const baseAng = cyl[i * 5 + 1];
    const yBase   = cyl[i * 5 + 2];
    const phase   = cyl[i * 5 + 3];
    const spd     = cyl[i * 5 + 4];
    const sx = baseAng, sy = yBase * 0.016, sr = rCyl * 0.011;
    const angFlow =
        Math.sin(sx * PHI      + ft * 0.71 + phase)          * 0.07
      + Math.sin(sy * RT2      + ft * 0.44 * PHI + sr)       * 0.04
      + Math.sin(sx * RT3 + sy * PHI + ft * 0.29)            * 0.025;
    const angle = baseAng + angFlow * spd + ft * 0.025 * spd;
    const radFlow =
        Math.sin(sx * RT2      + ft * 0.51 + phase * PHI)    * 2.2
      + Math.sin(sy * PHI      + ft * 0.28 * RT2 + sr * RT3) * 1.1
      + Math.sin(sr            + ft * 0.19 + phase)          * 0.7;
    const r = rCyl + radFlow * audioMod;
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

  // Per-star vertex colors: fixed types (blue-white, warm) hold their hue;
  // musical types drift with the palette hue
  const baseH = ((hue + 30) % 360) / 360;
  const { colors, hueFixed, hueVal, satVal, litVal } = smallLayer;
  for (let i = 0; i < SMALL_COUNT; i++) {
    const h = hueFixed[i] ? hueVal[i] : (baseH + hueVal[i] + 1) % 1;
    _col.setHSL(h, satVal[i], litVal[i]);
    colors[i * 3]     = _col.r;
    colors[i * 3 + 1] = _col.g;
    colors[i * 3 + 2] = _col.b;
  }
  smallLayer.geo.attributes.color.needsUpdate = true;
  smallMat.size    = 0.6 + energy * 0.15 + bass * 0.10;
  smallMat.opacity = 0.9;

  const audioPulse = 1.0 + energy * 0.6 + bass * 0.5;
  const lh = largeLayer.hueFixed, lv = largeLayer.hueVal,
        ls = largeLayer.satVal,   ll = largeLayer.litVal;
  for (let i = 0; i < LARGE_COUNT; i++) {
    const h = lh[i] ? lv[i] : (baseH + lv[i] + 1) % 1;
    _col.setHSL(h, ls[i], ll[i]);
    const px = largeLayer.pos[i * 3], py = largeLayer.pos[i * 3 + 1], pz = largeLayer.pos[i * 3 + 2];
    const sc = largeSprites[i].userData.baseScale * audioPulse;
    largeSprites[i].material.color.copy(_col);
    largeSprites[i].position.set(px, py, pz);
    largeSprites[i].scale.setScalar(sc);
  }
}
