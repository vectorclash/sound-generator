# Infinite Music Generator

A self-contained, browser-based generative music system that plays endlessly and slowly transforms over time. Built entirely with the Web Audio API and Three.js — no server, no build step, no dependencies beyond a CDN script tag.

Open `index.html` in any modern browser and click **PLAY**.

---

## How it works

The system has two parallel engines running at all times: an **audio engine** that generates and schedules music, and a **visual engine** that renders a 3D scene reacting to the sound.

---

## Audio Engine

### Synthesis approach

All sound is generated in real time using the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API). There are no audio files or samples — every note is a raw oscillator node created, played, and discarded on the fly. Each note spawns its own small signal chain:

```
OscillatorNode → BiquadFilterNode → GainNode (envelope) → masterGain → AnalyserNode → output
                                                         ↘ GainNode (wet) → ConvolverNode (reverb) ↗
```

### The four voices

Four independent voices run simultaneously, each keeping its own internal clock and scheduling notes slightly ahead of time (120ms lookahead). The scheduler fires on a 60ms interval and fills the lookahead window. This is a standard Web Audio technique that avoids audio glitches from JavaScript's uneven timer execution.

#### 1. Pad
Slow, sustained chords. Each chord event picks a scale degree at random, builds a 3-note chord (root, third, fifth by scale steps), and plays all three notes at once through a sawtooth oscillator → lowpass filter chain. Duration is 3–8 beats. The filter cutoff is modulated by the `brightness` state parameter, creating tonal shifts from dark/muffled to bright/open as the music evolves.

#### 2. Bass
Low-frequency root movement. Each note plays the scale root, fifth, or minor third at a very low MIDI octave (MIDI 36–48). A triangle oscillator is paired with a sine sub-oscillator at half frequency for added weight. Notes are 1–3 beats long with a fast attack and exponential decay, giving a plucked/punchy feel. No reverb — bass stays dry to preserve low-end clarity.

#### 3. Melody
A single-voice melodic line two octaves above the bass. Has a 25% rest probability per event, which creates natural breathing room. When a new note is chosen, there is a 65% chance it moves by one step from the previous note (stepwise motion), making the melody feel like a real phrase rather than random jumping. Oscillator type switches randomly between sine and triangle for timbre variety. Volume scales with the `density` state parameter.

#### 4. Texture
Sparse, high-register shimmer. A 40% chance of rest per event, with durations of 1.5–4 seconds and heavy reverb send (90% wet). This voice sits mostly in the background, occasionally surfacing with a long, floating sine tone that adds spaciousness without cluttering the harmonic content.

### Musical scales

Seven scales are available, each defined as a list of semitone intervals from the root:

| Scale | Intervals | Character |
|---|---|---|
| Aeolian | 0 2 3 5 7 8 10 | Natural minor — dark, classical |
| Dorian | 0 2 3 5 7 9 10 | Minor with raised 6th — jazzy, open |
| Phrygian | 0 1 3 5 7 8 10 | Flat 2nd — tense, Iberian flavour |
| Minor pentatonic | 0 3 5 7 10 | 5 notes — sparse, bluesy |
| Major pentatonic | 0 2 4 7 9 | 5 notes — open, optimistic |
| Lydian | 0 2 4 6 7 9 11 | Raised 4th — floating, ethereal |
| Mixolydian | 0 2 4 5 7 9 10 | Flat 7th — bright but unresolved |

MIDI note numbers are converted to Hz with the formula `C2_hz × 2^((midi−24)/12)` where C2 = 65.406 Hz.

### Reverb

A convolution reverb is synthesised at startup by filling a stereo audio buffer with exponentially-decaying white noise. The noise is shaped with `amplitude = random × (1 − i/length)^decay` where `decay = 2.8`. This produces a natural-sounding room tail without any IR files. Duration is 4 seconds. The reverb output feeds back into the master chain through a 0.45 gain node.

---

## Evolution Engine

The music evolves at two timescales: continuous micro-drift and periodic era transitions.

### Continuous drift

On every tick (~60ms), three state parameters randomly walk within bounded ranges:

- **`brightness`** (0.05–0.95) — maps to the pad filter cutoff (400Hz–2400Hz). Controls how bright or muffled the pad voice sounds.
- **`density`** (0.1–1.0) — scales melody note volume. Higher density = a more present, forward melody.
- **`spaciousness`** (0.1–0.9) — scales the pad's reverb send (20%–80%). Higher = more diffuse and washed out.

Each parameter drifts by a small random delta (±0.001–0.002) per tick, creating slow, barely-perceptible tonal movement between era transitions.

### Era transitions

Every 38 seconds an era change fires:

1. **Root note shifts** by a musical interval chosen from `[−7, −5, −2, 0, 0, 2, 5, 7]` semitones, bounded to MIDI 24–48. The doubled `0` entry makes staying in the same key twice as likely as any single shift, preventing constant key changes.
2. **Scale changes** to a randomly selected one of the seven available modes.
3. **Tempo drifts** by ±8 BPM, bounded to 52–130 BPM.
4. **Brightness, spaciousness, and density** jump to new random values across their full ranges, creating a more noticeable textural shift at the era boundary.

The status bar at the bottom of the screen shows the current root note, scale name, tempo, era number, and progress toward the next transition.

---

## Visual Engine

The 3D scene is rendered with [Three.js r134](https://threejs.org/) via WebGL. The renderer runs at the device's native pixel ratio (`window.devicePixelRatio`), so it looks sharp on Retina/HiDPI displays. The animation loop runs at the browser's frame rate via `requestAnimationFrame`.

### Scene objects

#### Wireframe icosahedron
A subdivided icosahedron (subdivision level 5, giving 5,120 triangular faces) sits at the origin. Every frame, the original vertex positions are stored and used as normals — each vertex is displaced radially outward by an amount derived from the frequency spectrum:

```
displacement = 1.5 + freqData[bin] / 255 × 1.1 + bass × 0.5
```

The frequency bin for each vertex is chosen by mapping the vertex's XZ angle and Y component to an index in the FFT array. This makes the sphere warp and spike differently on different faces depending on which frequencies are dominant at that moment. The icosahedron also slowly self-rotates, accelerating with audio energy.

#### Inner glow sphere
A smooth sphere slightly smaller than the icosahedron, rendered with `AdditiveBlending` and `depthWrite: false`. Its colour matches the current musical hue, and its opacity and scale pulse directly with the bass energy — on a strong low-frequency hit it blooms outward visibly.

#### Frequency bar ring
64 thin rectangular pillars arranged in a circle of radius 3.2 units. Each bar's geometry has its pivot translated to its base so `scale.y` makes it grow upward from the floor of the ring rather than expanding symmetrically. Each bar maps to a frequency bin; its height scales 0.04–3.54× depending on that bin's amplitude. Colour cycles around the hue wheel at 360/64 degrees per bar, all offset by the current musical hue, and bars use additive blending to glow when bright.

#### Star field
5,000 points distributed uniformly in a sphere shell between radii 15–95 units. Rather than storing just XYZ, each star stores its **cylindrical coordinates**: `(rCyl, baseAngle, yBase, phase, speed)`. Every frame, positions are recomputed from scratch in JavaScript and the buffer is flagged dirty:

**Torsional motion:** The twist angle for each star is:
```
angle = baseAngle
      + twistDynamic × (yBase / 55) × speed   ← height-dependent shear
      + t × 0.04 × speed                       ← slow base drift
```

`twistDynamic` is `twistAmt × (1 + energy×1.5 + bass×4)` where `twistAmt = sin(t×0.11)×1.8 + sin(t×0.07)×0.9` — two incommensurate sine waves that never align, so the motion has no obvious period and never looks like it's looping.

Stars at the top of the field (positive Y) twist in the opposite direction from stars at the bottom (negative Y), because `yBase/55` flips sign. This is the torsional shear: the field wrings and unwinds like a coil.

**Radial breathing:** `r = rCyl × (1 + sin(t×0.35 + phase)×0.04) × (1 + bass×0.18 + energy×0.06)`. Bass hits push the entire cloud outward. Each star has its own phase so they breathe slightly out of sync.

**Vertical pumping:** `yOffset = sin(t×0.28 + phase + 1.3) × (1.2 + energy×4.0)`. During loud passages the stars surge up and down noticeably.

### Color

A single hue value drives all colour in the scene:
```
hue = (rootMidi × 15 + era × 40) % 360
```

This means each root note has a characteristic hue (C is 0°/red, D is 30°/orange, etc.), and each new era shifts the palette by 40°. All scene objects — icosahedron, glow sphere, bars, stars — derive their colour from this hue, keeping the visual palette musically coherent.

### Camera

The camera orbits the origin on a 7.5-unit radius path, its angle incrementing each frame by `0.0035 + energy×0.0018`. The Y position oscillates: `sin(cameraAngle × 0.37) × 2.2 + 1.0`, giving a slow nodding motion. The two angular frequencies (1.0 and 0.37) are incommensurate, so the camera path never exactly repeats.

---

## Signal flow summary

```
setInterval (60ms)
  └─ tick()
       ├─ padVoice.tick()     → schedules oscillator nodes → masterGain
       ├─ bassVoice.tick()    → schedules oscillator nodes → masterGain
       ├─ melodyVoice.tick()  → schedules oscillator nodes → masterGain
       ├─ textureVoice.tick() → schedules oscillator nodes → reverbNode
       └─ evolve()            → drifts state parameters, fires era on timer

masterGain → AnalyserNode → AudioDestination
reverbNode → reverbGain  ↗

requestAnimationFrame
  └─ animate()
       ├─ analyser.getByteFrequencyData()  → freqData[]
       ├─ deform icosahedron vertices      ← freqData
       ├─ pulse inner glow                 ← bass
       ├─ scale frequency bars             ← freqData
       ├─ update 5000 star positions       ← t, energy, bass
       ├─ advance camera angle             ← energy
       └─ renderer.render(scene, camera)
```

---

## Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| [Three.js](https://threejs.org/) | r134 | 3D rendering (loaded from cdnjs CDN) |
| Web Audio API | — | Sound synthesis (built into browser) |

No build tools, no npm, no bundler. The entire application is a single HTML file.
