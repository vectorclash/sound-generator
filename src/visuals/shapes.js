import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './scene.js';
import { music, pcAngle, pcHue } from './music.js';
import { audio } from '../audio/context.js';

// Unit direction (world space) for each pitch class, around the equator —
// the same directions as the halo's sectors.
const PC_DIR = Array.from({ length: 12 }, (_, pc) => new THREE.Vector3(Math.cos(pcAngle(pc)), 0, Math.sin(pcAngle(pc))));

// ─── Harmonic sphere: layered wireframe icosahedra ────────────────────────────
// Each layer listens to a part of the band. The shape as a whole bulges toward
// the current chord's pitch classes — the same directions as the lit halo
// sectors and the chord constellation — and morphs when the chord changes. Note onsets send ripples out
// from their pitch's direction (high notes start near the top); kick and snare
// punch the inner and outer layers. A faint spectral shimmer keeps it alive.
const LAYERS = [
  { radius: 0.60, opacity: 0.15, ry:  0.0045, rx:  0.0015, hueOff: -100, roles: ['bass'],           tone: 0, hit: 'kick'  },
  { radius: 0.80, opacity: 0.18, ry: -0.0035, rx:  0.0010, hueOff:  -75, roles: ['bass', 'motion'], tone: 2, hit: 'kick'  },
  { radius: 1.00, opacity: 0.21, ry:  0.0030, rx:  0.0010, hueOff:  -50, roles: ['motion'],         tone: 1, hit: null    },
  { radius: 1.25, opacity: 0.16, ry: -0.0022, rx: -0.0008, hueOff:  -25, roles: ['lead', 'motion'], tone: 3, hit: 'snare' },
  { radius: 1.50, opacity: 0.10, ry:  0.0016, rx: -0.0005, hueOff:    0, roles: ['lead', 'air'],    tone: 0, hit: 'snare' },
];
const RIPPLE_GAIN = { bass: 0.22, motion: 0.13, lead: 0.2, air: 0.16 };

const layers = LAYERS.map((cfg, i) => {
  let geo = new THREE.IcosahedronGeometry(cfg.radius, 5);
  geo.deleteAttribute('normal');
  geo.deleteAttribute('uv');
  geo = mergeVertices(geo); // 2160 → 362 vertices: each point computed once
  const pos = geo.attributes.position;
  pos.setUsage(THREE.DynamicDrawUsage);
  const unit = new Float32Array(pos.array.length);
  const jitter = new Float32Array(pos.count);
  for (let v = 0; v < pos.count; v++) {
    const x = pos.array[3 * v], y = pos.array[3 * v + 1], z = pos.array[3 * v + 2];
    const len = Math.hypot(x, y, z);
    unit[3 * v] = x / len; unit[3 * v + 1] = y / len; unit[3 * v + 2] = z / len;
    jitter[v] = Math.random();
  }
  const mat = new THREE.MeshBasicMaterial({
    color: 0x334466, wireframe: true, transparent: true,
    opacity: cfg.opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.set(i * 0.38, i * 0.65, i * 0.22);
  scene.add(mesh);
  return { ...cfg, mesh, mat, pos, unit, jitter };
});

const glowMat  = new THREE.MeshBasicMaterial({ color: 0x112244, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
const glowMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 32, 32), glowMat);
scene.add(glowMesh);

// Chord lobes: per pitch class, eased toward the chord's shape.
const lobeAmp = new Float32Array(12);

// Log-spaced spectrum bands (90 Hz – 11 kHz) for the shimmer.
const BANDS = 16;
const bands = new Float32Array(BANDS);
function readBands(freqData) {
  bands.fill(0);
  if (!audio.analyser) return;
  const binHz = audio.ctx.sampleRate / audio.analyser.fftSize;
  for (let i = 0; i < BANDS; i++) {
    const lo = Math.floor(90 * Math.pow(11000 / 90, i / BANDS) / binHz);
    const hi = Math.max(lo + 1, Math.floor(90 * Math.pow(11000 / 90, (i + 1) / BANDS) / binHz));
    let m = 0;
    for (let b = lo; b < hi && b < freqData.length; b++) m = Math.max(m, freqData[b]);
    const v = Math.max(0, (m / 255 - 0.3) / 0.7);
    bands[i] = v * Math.sqrt(v);
  }
}

// ─── Update (called each animation frame) ────────────────────────────────────
const _target = new THREE.Color();
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const lobeBuf = new Float32Array(12 * 4), ripBuf = new Float32Array(24 * 6);

export function updateShapes({ freqData, energy, hue, dt, fade }) {
  const chord  = music.chord;
  const hits   = music.hits;
  const roles  = music.roleLevel;
  const ease   = 1 - Math.exp(-dt / 0.3);
  readBands(freqData);

  // ── Chord lobes ──
  for (let pc = 0; pc < 12; pc++) {
    const i = chord.indexOf(pc);
    const target = i < 0 ? 0 : (i === 0 ? 0.5 : 0.34) * (0.6 + 0.4 * roles.bed);
    lobeAmp[pc] += (target - lobeAmp[pc]) * ease;
  }

  // ── Layers ──
  for (const L of layers) {
    L.mesh.rotation.y += L.ry + energy * 0.006;
    L.mesh.rotation.x += L.rx + energy * 0.002;
    _q.copy(L.mesh.quaternion).invert(); // world → this layer's local frame

    let nl = 0;
    for (let pc = 0; pc < 12; pc++) {
      if (lobeAmp[pc] < 0.003) continue;
      _v.copy(PC_DIR[pc]).applyQuaternion(_q);
      lobeBuf[nl++] = _v.x; lobeBuf[nl++] = _v.y; lobeBuf[nl++] = _v.z; lobeBuf[nl++] = lobeAmp[pc];
    }
    let nr = 0;
    for (const r of music.ripples) {
      if (!L.roles.includes(r.role) || nr >= ripBuf.length) continue;
      _v.set(r.x, r.y, r.z).applyQuaternion(_q);
      const amp = r.vel * RIPPLE_GAIN[r.role] * Math.exp(-r.age / 0.55);
      ripBuf[nr++] = _v.x; ripBuf[nr++] = _v.y; ripBuf[nr++] = _v.z;
      ripBuf[nr++] = amp; ripBuf[nr++] = r.age * 1.8; ripBuf[nr++] = 0;
    }

    const punch = 1 + (L.hit === 'kick' ? 0.2 * hits.kick : L.hit === 'snare' ? 0.08 * hits.snare : 0) + 0.05 * hits.crash;
    const u = L.unit, p = L.pos.array, jit = L.jitter;
    for (let v = 0, n = L.pos.count; v < n; v++) {
      const x = u[3 * v], y = u[3 * v + 1], z = u[3 * v + 2];
      let d = 0;
      for (let j = 0; j < nl; j += 4) {
        const c = x * lobeBuf[j] + y * lobeBuf[j + 1] + z * lobeBuf[j + 2];
        if (c > 0) { const c3 = c * c * c; d += lobeBuf[j + 3] * c3 * c3; } // c⁶: distinct lobes
      }
      for (let j = 0; j < nr; j += 6) {
        const c = x * ripBuf[j] + y * ripBuf[j + 1] + z * ripBuf[j + 2];
        const off = Math.acos(c > 1 ? 1 : c < -1 ? -1 : c) - ripBuf[j + 4];
        d += ripBuf[j + 3] * Math.exp(-off * off * 16);
      }
      const band = Math.min(BANDS - 1, Math.floor(((y * 0.5 + 0.5) * 0.85 + jit[v] * 0.15) * BANDS));
      d += 0.16 * bands[band] * fade;
      const r = L.radius * (punch + d);
      p[3 * v] = x * r; p[3 * v + 1] = y * r; p[3 * v + 2] = z * r;
    }
    L.pos.needsUpdate = true;

    // Colour: each layer takes one chord tone (idle: the old fixed offsets).
    const tone = chord.length ? pcHue(chord[L.tone % chord.length], hue) : (hue + L.hueOff + 360) % 360;
    _target.setHSL(tone / 360, 0.65, 0.55);
    L.mat.color.lerp(_target, ease);
    const presence = Math.max(...L.roles.map(r => roles[r]));
    const flash = (L.hit ? hits[L.hit] * 0.8 : 0) + (L.radius > 1.4 ? hits.hat * 0.3 : 0);
    L.mat.opacity = L.opacity * (1 + 0.4 * presence + 0.6 * flash);
  }

  // ── Glow: the chord root's colour, breathing with the bass and the kick ──
  _target.setHSL((chord.length ? pcHue(chord[0], hue) : hue) / 360, 0.85, 0.25);
  glowMat.color.lerp(_target, ease);
  glowMat.opacity = 0.04 + 0.18 * hits.kick + 0.12 * roles.bass;
  glowMesh.scale.setScalar(1 + 0.35 * hits.kick + 0.3 * roles.bass);
}
