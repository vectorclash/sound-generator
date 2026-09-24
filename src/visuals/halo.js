import * as THREE from 'three';
import { scene, renderer } from './scene.js';
import { music, fifths, pcAngle, pcHue } from './music.js';

// ─── Harmonic halo ────────────────────────────────────────────────────────────
// A planetary ring of dust around the sphere that carries the same data the
// bar ring did, as part of the space scene:
//
//   angle    pitch class, around the circle of fifths (a key's scale is one
//            unbroken arc; a chord's tones sit close together)
//   ringlet  octave — seven concentric bands (C1 innermost … C7 outermost),
//            with gaps between them like the divisions in Saturn's rings
//   glow     the key's scale glows as a coloured arc, chord tones brighter
//   plume    a sounding note lights its patch of dust, which lifts off the
//            plane into a sparkling plume following the note's envelope;
//            the note's onset throws a brief burst outward
//
// The dust orbits (inner ringlets faster, as in any real ring), so it streams
// through the lit regions, which stay fixed in space. Positions, colour and
// size are all computed in the vertex shader; the CPU only uploads 12 + 84 + 84
// numbers per frame.
//
// On top, a chord constellation: a bright star on each chord tone, joined by
// dotted lines of light. On the circle of fifths a major and a minor triad are
// mirror-image triangles, so the harmony is literally a shape, and it glides
// to the next chord when the harmony moves.

const OCTAVES = 7, LOWEST = 24;               // C1 … B7 — the engine's range
const R_IN = 2.5, R_OUT = 4.1, PLANE_Y = -0.4;
const BAND = (R_OUT - R_IN) / OCTAVES;
const DUST = 16000;

// ── Dust ──────────────────────────────────────────────────────────────────────
const dustGeo = new THREE.BufferGeometry();
{
  const angle = new Float32Array(DUST), radius = new Float32Array(DUST);
  const y = new Float32Array(DUST), oct = new Float32Array(DUST), hash = new Float32Array(DUST * 3);
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
  for (let i = 0; i < DUST; i++) {
    const o = Math.floor(Math.random() * OCTAVES);
    angle[i]  = Math.random() * Math.PI * 2;
    radius[i] = R_IN + (o + 0.12 + 0.76 * Math.random()) * BAND; // gaps between ringlets
    y[i]      = PLANE_Y + gauss() * 0.035;
    oct[i]    = o;
    hash[3 * i] = Math.random(); hash[3 * i + 1] = Math.random(); hash[3 * i + 2] = Math.random();
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 3), 3)); // unused; required
  dustGeo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
  dustGeo.setAttribute('aRadius', new THREE.BufferAttribute(radius, 1));
  dustGeo.setAttribute('aY', new THREE.BufferAttribute(y, 1));
  dustGeo.setAttribute('aOct', new THREE.BufferAttribute(oct, 1));
  dustGeo.setAttribute('aHash', new THREE.BufferAttribute(hash, 3));
}

// Soft round point: a bright core with a gentle halo.
const POINT_FRAG = /* glsl */`
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * 0.6 + (1.0 - smoothstep(0.0, 0.35, r)) * 0.4;
    gl_FragColor = vec4(vColor, a);
  }
`;

const dustMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:  { value: 0 },
    uPx:    { value: 1 }, // drawing-buffer height / 750
    uLevel: { value: new Float32Array(12 * OCTAVES) }, // [sector * 7 + octave]
    uFlash: { value: new Float32Array(12 * OCTAVES) },
    uBase:  { value: new Float32Array(12) },           // key/chord glow per sector
    uColor: { value: new Float32Array(12 * 3) },       // per sector
  },
  vertexShader: /* glsl */`
    uniform float uTime, uPx;
    uniform float uLevel[${12 * OCTAVES}];
    uniform float uFlash[${12 * OCTAVES}];
    uniform float uBase[12];
    uniform vec3  uColor[12];
    attribute float aAngle, aRadius, aY, aOct;
    attribute vec3  aHash;
    varying vec3 vColor;
    const float TAU = 6.28318530718;
    void main() {
      float ang = aAngle + uTime * 0.16 * pow(3.2 / aRadius, 1.5); // Keplerian shear
      float u   = mod(ang / TAU * 12.0, 12.0);                     // sector coordinate
      float c   = floor(u + 0.5);
      int   sec = int(mod(c, 12.0));
      float w   = 1.0 - smoothstep(0.3, 0.5, abs(u - c));          // soft sector edges
      int   cell = sec * ${OCTAVES} + int(aOct);
      float lvl  = uLevel[cell] * w;
      float fl   = uFlash[cell] * w;

      // Lit dust lifts into a plume, most of it low, a few specks high, half
      // of it mirrored below the plane; an onset throws it briefly outward.
      float dir  = aHash.y < 0.5 ? 1.0 : -1.0;
      float lift = lvl * (0.12 + 2.1 * aHash.x * aHash.x) * dir;
      float r    = aRadius + fl * 0.4 * aHash.z;
      vec4  mv   = modelViewMatrix * vec4(cos(ang) * r, aY + lift, sin(ang) * r, 1.0);
      gl_Position = projectionMatrix * mv;

      float twinkle = 0.7 + 0.3 * sin(uTime * (1.5 + 3.0 * aHash.z) + aHash.y * 50.0);
      float bright  = (0.14 + 1.5 * uBase[sec] * w + 1.4 * lvl + 1.0 * fl) * twinkle;
      gl_PointSize  = uPx * (2.6 + 4.5 * lvl + 4.0 * fl) * (7.0 / -mv.z);
      vColor = uColor[sec] * bright;
    }
  `,
  fragmentShader: POINT_FRAG,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const dust = new THREE.Points(dustGeo, dustMat);
dust.frustumCulled = false; // positions come from the shader
scene.add(dust);

// ── Chord constellation ───────────────────────────────────────────────────────
const SLOTS = 4, DOTS = 64;                   // polygon corners; dots per edge
const R_CON = 3.3, CON_Y = PLANE_Y + 0.02;
const CON_POINTS = SLOTS + SLOTS * DOTS;
const conGeo = new THREE.BufferGeometry();
const conPos = new Float32Array(CON_POINTS * 3), conCol = new Float32Array(CON_POINTS * 3), conSize = new Float32Array(CON_POINTS);
const conKind = new Float32Array(CON_POINTS).fill(0).fill(1, 0, SLOTS); // corners first
conGeo.setAttribute('position', new THREE.BufferAttribute(conPos, 3).setUsage(THREE.DynamicDrawUsage));
conGeo.setAttribute('color', new THREE.BufferAttribute(conCol, 3).setUsage(THREE.DynamicDrawUsage));
conGeo.setAttribute('size', new THREE.BufferAttribute(conSize, 1).setUsage(THREE.DynamicDrawUsage));
conGeo.setAttribute('kind', new THREE.BufferAttribute(conKind, 1));
const conMat = new THREE.ShaderMaterial({
  uniforms: { uPx: { value: 1 } },
  vertexShader: /* glsl */`
    uniform float uPx;
    attribute vec3 color;
    attribute float size, kind;
    varying vec3 vColor;
    varying float vKind;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position  = projectionMatrix * mv;
      gl_PointSize = uPx * size * (7.0 / -mv.z);
      vColor = color;
      vKind = kind;
    }
  `,
  // Corners are drawn as a ring around a bright core — unmistakable against
  // the star field; edge dots are soft points.
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    varying float vKind;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float dot  = (1.0 - smoothstep(0.0, 1.0, r)) * 0.6 + (1.0 - smoothstep(0.0, 0.35, r)) * 0.4;
      float ring = exp(-pow((r - 0.72) / 0.09, 2.0)) + (1.0 - smoothstep(0.0, 0.22, r)) + 0.25 * (1.0 - r);
      gl_FragColor = vec4(vColor, clamp(mix(dot, ring, vKind), 0.0, 1.0));
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const constellation = new THREE.Points(conGeo, conMat);
constellation.frustumCulled = false;
scene.add(constellation);

const slots = Array.from({ length: SLOTS }, () => ({ angle: 0, color: new THREE.Color(), glow: 0 }));
let conAlpha = 0;

// ─── Update ───────────────────────────────────────────────────────────────────
const base = new Float32Array(12);
const _c = new THREE.Color(), _c2 = new THREE.Color();

function shortest(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function updateHalo({ hue, dt, t }) {
  const U = dustMat.uniforms;
  const px = renderer.domElement.height / 750; // sizes are authored for a 750px-tall view
  U.uTime.value = t;
  U.uPx.value = px;
  conMat.uniforms.uPx.value = px;
  const ease = 1 - Math.exp(-dt / 0.35);

  // Sector s holds the pitch class s fifths above C.
  for (let s = 0; s < 12; s++) {
    const pc = (s * 7) % 12;
    const target = music.chord.includes(pc) ? 0.26 : music.scale.has(pc) ? 0.13 : 0;
    base[s] += (target - base[s]) * ease;
    U.uBase.value[s] = base[s];
    _c.setHSL(pcHue(pc, hue) / 360, 0.85, 0.6);
    U.uColor.value[3 * s] = _c.r; U.uColor.value[3 * s + 1] = _c.g; U.uColor.value[3 * s + 2] = _c.b;
    for (let k = 0; k < OCTAVES; k++) {
      const midi = LOWEST + 12 * k + pc;
      U.uLevel.value[s * OCTAVES + k] = Math.min(1, music.noteLevel[midi] * 1.1);
      U.uFlash.value[s * OCTAVES + k] = music.flash[midi];
    }
  }

  // Constellation: corners glide to the chord tones (in circle-of-fifths
  // order, so the polygon is convex); a triad repeats its last corner.
  const chord = [...music.chord].sort((a, b) => fifths(a) - fifths(b));
  conAlpha += ((chord.length ? 1 : 0) - conAlpha) * ease;
  for (let i = 0; i < SLOTS; i++) {
    const s = slots[i];
    if (chord.length) {
      const pc = chord[Math.min(i, chord.length - 1)];
      s.angle += shortest(s.angle, pcAngle(pc)) * ease;
      _c.setHSL(pcHue(pc, hue) / 360, 0.8, 0.65);
      s.color.lerp(_c, ease);
      // A chord tone that is actually sounding makes its star flare.
      let lit = 0;
      for (let k = 0; k < OCTAVES; k++) lit = Math.max(lit, music.noteLevel[LOWEST + 12 * k + pc] + music.flash[LOWEST + 12 * k + pc]);
      s.glow += (lit - s.glow) * (1 - Math.exp(-dt / 0.08));
    }
  }
  let p = 0;
  for (let i = 0; i < SLOTS; i++) {
    const s = slots[i];
    conPos[3 * p] = Math.cos(s.angle) * R_CON; conPos[3 * p + 1] = CON_Y; conPos[3 * p + 2] = Math.sin(s.angle) * R_CON;
    _c.copy(s.color).multiplyScalar(conAlpha * (0.8 + 0.7 * s.glow));
    conCol[3 * p] = _c.r; conCol[3 * p + 1] = _c.g; conCol[3 * p + 2] = _c.b;
    conSize[p] = 26 + 16 * s.glow;
    p++;
  }
  for (let i = 0; i < SLOTS; i++) {
    const a = slots[i], b = slots[(i + 1) % SLOTS];
    const ax = Math.cos(a.angle) * R_CON, az = Math.sin(a.angle) * R_CON;
    const bx = Math.cos(b.angle) * R_CON, bz = Math.sin(b.angle) * R_CON;
    const span = Math.min(1, Math.hypot(bx - ax, bz - az) / 0.6); // a triad's repeated corner has no edge
    for (let j = 0; j < DOTS; j++) {
      const f = (j + 0.5) / DOTS;
      conPos[3 * p] = ax + (bx - ax) * f; conPos[3 * p + 1] = CON_Y; conPos[3 * p + 2] = az + (bz - az) * f;
      // Light travels along each edge from one chord tone to the next.
      const pulse = 0.55 + 0.45 * Math.sin((f - t * 0.6) * Math.PI * 4);
      _c2.copy(a.color).lerp(b.color, f).multiplyScalar(conAlpha * span * 0.7 * pulse);
      conCol[3 * p] = _c2.r; conCol[3 * p + 1] = _c2.g; conCol[3 * p + 2] = _c2.b;
      conSize[p] = 5;
      p++;
    }
  }
  for (const name of ['position', 'color', 'size']) conGeo.attributes[name].needsUpdate = true;
}
