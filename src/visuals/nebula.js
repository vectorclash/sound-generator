import * as THREE from 'three';
import { scene } from './scene.js';

// ─── Soft radial gradient texture ─────────────────────────────────────────────
// Peak alpha = 1 so material.opacity is the sole brightness control
function makeNebulaTex() {
  const s = 512, h = s / 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx  = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0.00, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.18)');
  grad.addColorStop(0.80, 'rgba(255,255,255,0.04)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(canvas);
}

const nebulaTex = makeNebulaTex();

// ─── Color personalities ──────────────────────────────────────────────────────
function nebulaPersonality(t) {
  if (t < 0.35) {
    // Deep blue / teal — fixed
    return { hueFixed: true,  hueVal: 0.50 + Math.random() * 0.13,
             sat: 0.80 + Math.random() * 0.15, lit: 0.38 + Math.random() * 0.14 };
  } else if (t < 0.62) {
    // Purple / violet — fixed
    return { hueFixed: true,  hueVal: 0.67 + Math.random() * 0.13,
             sat: 0.82 + Math.random() * 0.14, lit: 0.35 + Math.random() * 0.14 };
  } else if (t < 0.80) {
    // Magenta / rose — fixed
    return { hueFixed: true,  hueVal: 0.84 + Math.random() * 0.12,
             sat: 0.80 + Math.random() * 0.16, lit: 0.38 + Math.random() * 0.14 };
  } else {
    // Follows musical hue
    return { hueFixed: false, hueVal: (Math.random() - 0.5) * 0.14,
             sat: 0.78 + Math.random() * 0.18, lit: 0.38 + Math.random() * 0.14 };
  }
}

// ─── Spawn nebulae ────────────────────────────────────────────────────────────
const NEBULA_COUNT = 22;
export const nebulae = [];
const _col = new THREE.Color();

for (let i = 0; i < NEBULA_COUNT; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi   = Math.acos(2 * Math.random() - 1);
  const r     = 18 + Math.random() * 28;
  const x     = r * Math.sin(phi) * Math.cos(theta);
  const y     = r * Math.sin(phi) * Math.sin(theta);
  const z     = r * Math.cos(phi);

  const p           = nebulaPersonality(Math.random());
  const baseOpacity = 0.14 + Math.random() * 0.18;  // 0.14–0.32

  // Elliptical shape + static rotation for organic variety
  const baseW  = 20 + Math.random() * 32;
  const baseH_ = baseW * (0.55 + Math.random() * 0.90);

  const mat = new THREE.SpriteMaterial({
    map:         nebulaTex,
    transparent: true,
    opacity:     baseOpacity,
    blending:    THREE.AdditiveBlending,
    depthWrite:  false,
    fog:         false,
    rotation:    Math.random() * Math.PI * 2,
  });
  _col.setHSL(p.hueVal, p.sat, p.lit);
  mat.color.copy(_col);

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(baseW, baseH_, 1);
  sprite.position.set(x, y, z);

  sprite.userData = {
    angle:      theta,
    baseR:      r,
    yBase:      y,
    orbitSpeed: (0.00015 + Math.random() * 0.00022) * (Math.random() < 0.5 ? 1 : -1),
    yAmp:       1.8 + Math.random() * 3.5,
    yPhase:     Math.random() * Math.PI * 2,
    ySpeed:     0.06 + Math.random() * 0.10,
    baseW, baseH_,
    baseOpacity,
    hueFixed:   p.hueFixed,
    hueVal:     p.hueVal,
    sat:        p.sat,
    lit:        p.lit,
  };

  scene.add(sprite);
  nebulae.push(sprite);
}

// ─── Update (called each animation frame) ────────────────────────────────────
export function updateNebulae(energy, bass, hue, t) {
  const baseH = ((hue + 30) % 360) / 360;
  for (const neb of nebulae) {
    const ud = neb.userData;

    ud.angle += ud.orbitSpeed;
    const nx = Math.cos(ud.angle) * ud.baseR;
    const ny = ud.yBase + Math.sin(t * ud.ySpeed + ud.yPhase) * ud.yAmp;
    const nz = Math.sin(ud.angle) * ud.baseR;
    neb.position.set(nx, ny, nz);

    const h = ud.hueFixed ? ud.hueVal : (baseH + ud.hueVal + 1) % 1;
    _col.setHSL(h, ud.sat, ud.lit);
    neb.material.color.copy(_col);

    const pulse = 1.0 + bass * 0.12 + energy * 0.05;
    neb.scale.set(ud.baseW * pulse, ud.baseH_ * pulse, 1);

    neb.material.opacity = ud.baseOpacity * (0.70 + energy * 0.40 + bass * 0.45);
  }
}
