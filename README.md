# Infinite Music Generator

A self-contained, browser-based generative music system. Built entirely with the Web Audio API and Three.js — no server, no build step, no dependencies beyond a CDN script tag.

Open `index.html` in any modern browser.

---

## Modes

### Infinite Mode

Click **PLAY** and the system runs forever, slowly evolving through eras of music. The composition auto-generates, shifts key and scale every 38 seconds, and continuously drifts in texture and density. A live status bar shows root note, scale, tempo, era number, and era progress.

### Manual Mode

Full control over every parameter. Select instruments, set BPM, key, scale, and tonal shape, then click **PLAY** or **EXPORT**.

**Genre presets** (AMBIENT, DARK, JAZZ, ELEC, ORCH, ZEN) instantly configure a musically coherent combination of scale, tempo, density, brightness, and spaciousness. **RANDOM** picks a fresh random combination of all parameters and instruments.

**Controls:**
| Control | Range | Effect |
|---|---|---|
| BPM | 50–140 | Tempo |
| Density | 0–1 | Note volume and presence |
| Brightness | 0–1 | Filter cutoff on pad and clavinet |
| Spaciousness | 0–1 | Reverb send on pad |

**Export** records a WAV file of exactly the requested duration. A 3-2-1 countdown mutes any previously playing audio so the recording starts clean. At the end of the recording window, a 5 ms sample-accurate micro-ramp on the audio clock prevents a waveform discontinuity at the cut point. The raw MediaRecorder capture is decoded and trimmed to exactly `duration × sampleRate` samples before writing the WAV header, so a 10-second export is precisely 10 seconds.

---

## Audio Engine

### Signal routing

```
OscillatorNode → [filter] → GainNode (envelope) → masterGain → AnalyserNode → output
                                                 ↘ GainNode (wet) → ConvolverNode (reverb) → reverbGain ↗
```

All sound is generated in real time. There are no audio files — every note is a raw oscillator node created, connected, played, and discarded. The scheduler fires on a 60 ms interval and fills a 120 ms lookahead window (`LOOKAHEAD = 0.12`), a standard Web Audio technique that avoids glitches from JavaScript's uneven timer execution.

### Bass (always active in both modes)

Five subtypes share the same low-register role and can be selected in Manual mode:

| Subtype | Synthesis |
|---|---|
| SUB | Deep sine sweep (low-pass filtered sawtooth) |
| PLUCK | Triangle + sine sub at half frequency, fast decay |
| WALK | Walking bass line, stepping through scale notes |
| SYNTH | Sawtooth through resonant filter, synth-bass character |
| RUMBLE | Detuned pair of sines, slow LFO tremolo |

### Instruments

Twenty instruments are available. In Infinite mode, each era picks 3–5 at random from the pool. In Manual mode any combination can be selected.

#### Harmonic / pad voices

| Instrument | Synthesis |
|---|---|
| **Pad** | 3-note chord, sawtooth → lowpass filter, 3–8 beat sustain. Filter cutoff tracks `brightness` (400–2400 Hz). |
| **Drone** | Root + fifth, sawtooth/square, very long sustain. Lowpass filter tracks brightness. |
| **Texture** | Single long-sustain sine, 90% reverb wet. Sparse, high-register shimmer. |
| **Strings** | Layered detuned sawtooth oscillators with slow attack (bowed string envelope). |
| **Choir** | Two slightly detuned sines with slow LFO vibrato and a long, vowel-like envelope. |
| **Brass** | Sawtooth through a resonant lowpass with a bright attack transient. |
| **Organ** | Additive harmonics (fundamental + 2nd + 3rd) at drawbar-like levels, no envelope decay. |

#### Melodic voices

| Instrument | Synthesis |
|---|---|
| **Melody** | Sine/triangle, stepwise motion (65% chance), scales with `density`. |
| **Flute** | Sine with 4.5–6.5 Hz amplitude LFO (vibrato). |
| **Rhodes** | Sine carrier + brief inharmonic "clunk" partial on attack (7.1× fundamental). Exponential decay. |
| **Vibraphone** | Sine fundamental + inharmonic partial at 2.756× (short metallic click). Slow 6 Hz amplitude tremolo via LFO on a gain node, simulating the motor-driven rotating discs. |
| **Sitar** | Sawtooth main string + sine detuned 0.4% (creates jawari beating shimmer) + quiet root sympathetic string that blooms in slowly and sustains past the main note. |

#### Percussive / plucked voices

| Instrument | Synthesis |
|---|---|
| **Pluck** | Bandpass-filtered white noise burst with fast decay. |
| **Harp** | Sine with fast attack, long exponential decay. Arpeggiated chord patterns. |
| **Mallet** | Fundamental + octave sine, short decay. Marimba character. |
| **Bell** | Sine fundamental + inharmonic partials, very long decay. Heavy reverb. |
| **Glass** | Pure sine with slow attack and very long decay. Minimal harmonic content. |
| **Arpeggio** | Rapid scale-note arpeggios, triangle oscillator. |
| **Kalimba** | Pure sine tine + brief inharmonic partial at 5.44× (metallic click). Occasionally plays two notes with a 40 ms thumb stagger. High reverb send. |
| **Clavinet** | Sawtooth through a tight bandpass filter (Q=2.8, tracks brightness). Very short 100–220 ms decay, no reverb. Staccato, rhythmic. |

### Drums

A separate drums voice runs independently and plays 16-step bar patterns. Nine patterns are available:

| Pattern | Character |
|---|---|
| MINIMAL | Kick on 1 and 3, snare on 2 and 4, no hi-hat |
| 4/4 | Standard rock: kick 1+3, snare 2+4, 8th-note hi-hats |
| JUNGLE | Syncopated kick, ghost snares, busy 16th-note hi-hats |
| SHUFFLE | Shuffle feel, dotted 8th hi-hat pattern |
| TRAP | Sparse kick, snare on 3, continuous 16th hi-hats |
| GHOST | Very sparse, atmospheric with ghost notes |
| HALF TIME | Snare only on beat 3, syncopated kick, clap layered on beat 3 |
| BREAK | Staggered kick (beats 1, 2-ah, 3-and), asymmetric hi-hats, ghost on last 16th |
| BOSSA | Partido alto kick pattern, ghost snares on 2+4, characteristic syncopated hi-hat |

Four synthesised drum sounds are used:

- **Kick** — sine frequency sweep (155 → 38 Hz) with a high square-wave click on attack
- **Snare** — highpass-filtered noise burst + tonal triangle body at 188 Hz
- **Hi-hat** — highpass-filtered noise (closed: 45 ms, open: 220 ms)
- **Clap** — three staggered bandpass-filtered noise bursts at 0 / 8 / 18 ms offsets, frequencies 1000 / 1200 / 1400 Hz, simulating fingers meeting at slightly different times

Kick and snare gains scale with `density`. Hi-hat gain scales with `brightness`.

### Musical scales

Seven scales defined as semitone intervals from the root:

| Scale | Intervals | Character |
|---|---|---|
| Aeolian | 0 2 3 5 7 8 10 | Natural minor — dark, classical |
| Dorian | 0 2 3 5 7 9 10 | Minor with raised 6th — jazzy, open |
| Phrygian | 0 1 3 5 7 8 10 | Flat 2nd — tense, Iberian flavour |
| Minor pentatonic | 0 3 5 7 10 | 5 notes — sparse, bluesy |
| Major pentatonic | 0 2 4 7 9 | 5 notes — open, optimistic |
| Lydian | 0 2 4 6 7 9 11 | Raised 4th — floating, ethereal |
| Mixolydian | 0 2 4 5 7 9 10 | Flat 7th — bright but unresolved |

MIDI note numbers convert to Hz with `C2_hz × 2^((midi−24)/12)` where C2 = 65.406 Hz.

### Reverb

A convolution reverb is synthesised at startup by filling a stereo buffer with exponentially-decaying white noise: `amplitude = random × (1 − i/length)^2.8`. Duration is 4 seconds. The reverb output feeds into the master chain through a separate `reverbGain` node (0.45). Both `masterGain` and `reverbGain` are controlled together for instant mute/unmute without leaving orphaned reverb tails.

---

## Evolution Engine (Infinite mode)

The music evolves at two timescales.

### Continuous drift

On every tick (~60 ms), three state parameters randomly walk:

- **`brightness`** (0.05–0.95) — pad filter cutoff, clavinet bandpass centre
- **`density`** (0.1–1.0) — melody and drum gain scaling
- **`spaciousness`** (0.1–0.9) — pad reverb send amount

Each drifts by ±0.001–0.002 per tick.

### Era transitions (every 38 seconds)

1. **Root note** shifts by a musical interval from `[−7, −5, −2, 0, 0, 2, 5, 7]` semitones (doubled `0` makes staying in key twice as likely), bounded to MIDI 24–48
2. **Scale** changes to a random mode
3. **Tempo** drifts ±8 BPM, bounded to 52–130 BPM
4. **Brightness, spaciousness, density** jump to new random values
5. A new set of 3–5 voices is drawn from the pool

---

## Visual Engine

Rendered with [Three.js r175](https://threejs.org/) via WebGL at native pixel ratio. Animation loop runs via `requestAnimationFrame`.

### Scene objects

**Wireframe icosahedron** — subdivision level 5 (5,120 faces). Each vertex is displaced radially by `1.5 + freqData[bin]/255 × 1.1 + bass × 0.5`. Frequency bins map to vertices via XZ angle and Y component, so different faces warp to different parts of the spectrum. Self-rotates, accelerating with audio energy.

**Inner glow sphere** — `AdditiveBlending`, opacity and scale pulse with bass energy.

**Frequency bar ring** — 64 rectangular bars in a circle of radius 3.2. Each bar maps to an FFT bin; height scales 0.04–3.54×. Colours cycle around the hue wheel with additive blending.

**Star field** — 5,000 points in a shell between radii 15–95. Each star stores cylindrical coordinates `(rCyl, baseAngle, yBase, phase, speed)` and positions are recomputed every frame:

- *Torsional shear*: twist angle = `baseAngle + twistDynamic × (yBase/55) × speed + t × 0.04 × speed`. Stars at positive and negative Y twist in opposite directions.
- *Radial breathing*: `r = rCyl × (1 + sin(t×0.35+phase)×0.04) × (1 + bass×0.18 + energy×0.06)`
- *Vertical pumping*: `yOffset = sin(t×0.28+phase+1.3) × (1.2 + energy×4.0)`

`twistDynamic = twistAmt × (1 + energy×1.5 + bass×4)` where `twistAmt = sin(t×0.11)×1.8 + sin(t×0.07)×0.9` — two incommensurate frequencies so the field never loops visibly.

### Colour

A single hue drives the entire palette: `hue = (rootMidi × 15 + era × 40) % 360`. Each root note has a characteristic colour; each era shifts the palette by 40°.

### Camera

Orbits the origin at radius 7.5, angle incrementing by `0.0035 + energy×0.0018`. Y position oscillates as `sin(cameraAngle × 0.37) × 2.2 + 1.0`. The frequencies 1.0 and 0.37 are incommensurate so the path never exactly repeats.

---

## Signal flow summary

```
setInterval (60ms)
  └─ tick()
       ├─ bassVoice.tick()       → masterGain
       ├─ [active voices].tick() → masterGain / reverbNode
       └─ evolve()               → drifts state, fires era (infinite mode only)

masterGain → AnalyserNode → AudioDestination
reverbNode → reverbGain   ↗

requestAnimationFrame
  └─ animate()
       ├─ analyser.getByteFrequencyData() → freqData[]
       ├─ deform icosahedron vertices     ← freqData
       ├─ pulse inner glow                ← bass
       ├─ scale frequency bars            ← freqData
       ├─ update 5000 star positions      ← t, energy, bass
       ├─ advance camera angle            ← energy
       └─ renderer.render(scene, camera)

Export path (manual mode)
  └─ MediaRecorder → masterGain → MediaStreamDestination
       ├─ Web Audio parameter automation schedules 5ms micro-ramp at exactly t+duration
       ├─ recorder.stop() fires ~200ms after duration
       └─ onstop: decodeAudioData → trim to duration×sampleRate samples → WAV download
```

---

## Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| [Three.js](https://threejs.org/) | r175 | 3D rendering (loaded from CDN) |
| Web Audio API | — | Sound synthesis (built into browser) |

No build tools, no npm, no bundler. The entire application is a single HTML file plus JS modules.
