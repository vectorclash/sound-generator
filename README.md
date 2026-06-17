# Infinite Music Generator

A self-contained, browser-based generative music system. Built entirely with the Web Audio API and Three.js — no server, no runtime dependencies beyond a CDN script tag.

Run `npm install && npm run dev` and open `http://localhost:8000/` (ES modules need to be served over HTTP, not opened via `file://`).

---

## Modes

### Infinite Mode

Click **PLAY** to start. The button toggles to **STOP**, allowing playback to be halted without switching modes. The system runs indefinitely, slowly evolving through eras of music. The composition auto-generates, shifts key and scale every 38 seconds, and continuously drifts in texture and density. A live status bar shows root note, scale, tempo, era number, and era progress.

### Manual Mode

Full control over every parameter. The panel is divided into three collapsible sections — **GENRE**, **FEEL**, and **INSTRUMENTS** — to reduce visual clutter.

**Genre presets** (AMBIENT, DARK, JAZZ, ELEC, ORCH, ZEN, BLUES, FOLK, DREAM, FUNK, EPIC) instantly configure a musically coherent combination of scale, tempo, density, brightness, spaciousness, and the two harmony controls — e.g. JAZZ and BLUES loosen the chord-tone lock and move chords every 4 beats, while AMBIENT, ZEN, and DREAM keep tight, consonant voices over long 8-beat chords. **RANDOM** picks a fresh random combination of all parameters and instruments. Entering Manual mode with no instruments selected automatically randomises.

**SHARE** encodes the full current configuration — key, scale, tempo, all five feel sliders, and every enabled instrument — as a 13-byte binary payload in the URL hash (`#c=…`, 18 base64url characters). Clicking the button copies the URL to the clipboard. Loading that URL restores the exact configuration. (Older 11-byte links from before the harmony controls still load — the two new fields fall back to their defaults.)

**Controls:**
| Control | Range | Effect |
|---|---|---|
| BPM | 50–140 | Tempo |
| Density | 0–1 | Note volume and presence |
| Brightness | 0–1 | Filter cutoff on pad and clavinet |
| Spaciousness | 0–1 | Reverb send on pad |
| Harmony | 0–1 | How strongly melodic voices lock to chord tones — 0 lets them roam the whole scale (looser, more random), 1 keeps them strictly on the chord (tighter, more consonant). Triads and bass always follow the progression. |
| Chord | 2–8 beats | How often the chord progression advances — low = fast harmonic motion, high = long, slow-changing chords |

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
| **Choir** | Three detuned sawtooth oscillators (−12 / 0 / +12 cents) per chord note through a bandpass formant filter. The filter centre frequency sweeps from a vowel-like low position to a brighter one over the note duration, simulating mouth-shape movement. Sawtooths are essential here — pure sines have insufficient harmonic content at the frequencies where the bandpass resonates. |
| **Brass** | Two detuned oscillators (±6 cents) sharing a single resonant lowpass filter (Q=3.8) for natural ensemble spread. |
| **Organ** | Additive harmonics (fundamental + 2nd + 3rd) at drawbar-like levels. A Leslie rotary speaker effect is simulated per note: a ~7 Hz LFO with a small gain node connects to the note bus, producing ±7% amplitude modulation (rotary cabinet speed). |

#### Melodic voices

| Instrument | Synthesis |
|---|---|
| **Melody** | Sine/triangle, stepwise motion (65% chance), scales with `density`. |
| **Flute** | Sine with delayed-onset pitch vibrato (LFO connected to `frequency`, not gain — true pitch vibrato, not tremolo). Vibrato ramps in 0.28 s after attack onset to simulate a player's natural technique. Brief highpass noise burst on attack for breath transient. |
| **Rhodes** | Sine carrier + brief inharmonic "clunk" partial on attack (7.1× fundamental). Exponential decay. |
| **Vibraphone** | Sine fundamental + inharmonic partial at 2.756× (short metallic click). Slow 6 Hz amplitude tremolo via LFO on a gain node, simulating the motor-driven rotating discs. |
| **Sitar** | Additive synthesis (fundamental + 2nd + 3rd harmonic, each with a different exponential decay rate so higher partials die faster). A meend pitch ornament glides from a semitone above the target down to the final pitch. Jawari shimmer is simulated by a second oscillator detuned 0.3% creating a beating relationship. A narrow bandpass noise burst provides the pluck transient. Five sympathetic strings (tuned to the root, an octave up) bloom in slowly and decay independently. |

#### Percussive / plucked voices

| Instrument | Synthesis |
|---|---|
| **Pluck** | Bandpass-filtered white noise burst with fast decay. |
| **Harp** | Sine fundamental + 2nd harmonic (decaying at 28% of the note duration for a brief metallic brightness on attack). Narrow bandpass noise burst (Q=30) provides the pluck transient. Arpeggiated chord patterns. |
| **Mallet** | Fundamental + octave + 4th harmonic (the 4th is characteristic of marimba resonator tubes). Each partial has its own decay rate — higher partials die faster. |
| **Bell** | Four inharmonic partials at 1×, 2.756×, 5.404×, and 8.801× the fundamental (a close approximation of real tubular bell mode ratios). Each partial has an independent exponential decay, so the timbre evolves over the note duration. |
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

### Harmony engine

All pitched voices share a single harmonic context (`src/audio/harmony.js`) so that, at any instant, the pad, choir, bass, arpeggio and melody all agree on which chord is sounding. This is what keeps the music coherent instead of each voice wandering through the scale independently.

**Chord progressions.** A chord is stored as a root *scale degree* (an index into the active scale). Building the triad by stacking diatonic thirds — degree, +2, +4 — automatically yields the correct chord quality for whatever mode is active (minor in Aeolian, major in Lydian, and so on). A small library of progressions is defined as degree sequences; 7-note scales draw from classic resolving motions (`i–iv–v–i`, `i–VI–iv–v`, `i–VI–ii–v`, …) and 5-note pentatonic scales from gentler ones. Every chord is diatonic, so the same progression sounds good in any mode.

**The chord clock.** The progression advances on a beat clock: each chord lasts `state.chordBeats` beats — set live by the **Chord** control in Manual mode, and re-rolled to 4 or 8 each era in Infinite mode. `harmony.tick(now)` runs once per scheduler tick at the real audio time, so every voice scheduling within the lookahead window reads the same current chord. A new progression is drawn whenever the scale changes — at the start of playback and on each era transition.

**How voices use it:**

| Voice role | Behaviour |
|---|---|
| **Triadic** (pad, choir, organ, strings) | Play the current chord directly via `harmony.chordMidis()` — octave-correct ascending voicings. |
| **Arpeggio / harp** | Arpeggiate the current chord across octaves (4–7 stacked thirds), so every note of the sweep is a chord tone. |
| **Bass** | Locks to the chord root, occasionally its fifth; the walking style steps root – third – fifth – third through the current chord. |
| **Melodic** (melody, flute, bell, rhodes, vibraphone, kalimba, pluck, mallet, clavinet, sitar, brass, texture, glass) | Bias note choice toward chord tones (strength set by the **Harmony** control, default ~78%) while still allowing passing tones for melodic colour, and keep their existing stepwise-motion logic. |
| **Drone** | Stays on the global tonic (root + fifth) as a pedal tone, grounding the progression underneath. |

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
3. **Chord progression** is re-drawn for the new scale (see Harmony engine)
4. **Tempo** drifts ±8 BPM, bounded to 52–130 BPM
5. **Brightness, spaciousness, density** jump to new random values
6. A new set of 3–5 voices is drawn from the pool

---

## Visual Engine

Rendered with [Three.js r175](https://threejs.org/) via WebGL at native pixel ratio. Animation loop runs via `requestAnimationFrame`.

### Scene objects

**Wireframe icosahedron** — subdivision level 5 (5,120 faces). Each vertex is displaced radially by `1.5 + freqData[bin]/255 × 1.1 + bass × 0.5`. Frequency bins map to vertices via XZ angle and Y component, so different faces warp to different parts of the spectrum. Self-rotates, accelerating with audio energy.

**Inner glow sphere** — `AdditiveBlending`, opacity and scale pulse with bass energy.

**Frequency bar ring** — 64 rectangular bars in a circle of radius 3.2. Each bar maps to an FFT bin; height scales 0.04–3.54×. Colours cycle around the hue wheel with additive blending.

**Star field** — 7,500 small point stars and 80 large sprite stars, placed using 3D value noise rejection sampling for organic clustering. Each star stores cylindrical coordinates and is animated every frame by a three-component aperiodic flow field using irrational-ratio frequencies (φ, √2, √3) so the motion never visibly repeats.

Small stars use a `PointsMaterial` with `vertexColors: true` — every star has a unique colour baked at placement time. Stars are divided into four personality types:

| Type | Proportion | Hue behaviour |
|---|---|---|
| Musical | ~38% | Follows the palette hue with a small personal offset |
| Blue-white (O/B type) | ~24% | Fixed cool hue (~198–234°) regardless of key |
| Warm orange/red (K/M type) | ~18% | Fixed warm hue (~14–40°) |
| Near-white neutral | ~20% | Low saturation, any hue |

Large stars are individual `Sprite` objects with two stacked layers: the original PNG for the soft diffuse halo, and a generated overlay providing the diffraction spikes and bright core. The overlay renders at 1.6× the halo scale (matching how diffraction spikes extend beyond the stellar disc in real telescope imagery). Both layers share the same per-star colour personality.

**Volumetric nebulae** — 22 large cloud sprites with elliptical aspect ratios and static rotations for organic variety. Each is a soft radial gradient (white-on-transparent, generated via canvas) rendered with `AdditiveBlending` at low opacity (0.14–0.32). Colour types are weighted toward fixed deep blues, purples, and magentas, with ~20% following the palette hue. Each nebula slowly orbits with an independent speed and direction, and floats vertically on an aperiodic sine cycle (period ~63–105 seconds). Overlapping clouds accumulate intensity, producing the volumetric impression without ray-marching.

**Animation fade-in** — when playback starts, `energy` and `bass` ramp from 0 to their real values over 2.5 seconds. The camera orbit radius and Y oscillation also lerp smoothly from their idle positions. This prevents an abrupt visual jump when the audio begins. Stars are animated and visible even before playback starts (at energy=0).

### Colour

A single hue drives the base palette: `hue = (rootMidi × 15 + era × 40) % 360`. Each root note has a characteristic colour; each era shifts it by 40°. Fixed-temperature star types (blue-white, warm) are anchored to their astrophysical colours and do not shift with the key.

### Camera

Orbits the origin at radius 7.5, angle incrementing by `0.0035 + energy×0.0018`. Y position oscillates as `sin(cameraAngle × 0.37) × 2.2 + 1.0`. The frequencies 1.0 and 0.37 are incommensurate so the path never exactly repeats.

---

## Signal flow summary

```
setInterval (60ms)
  └─ tick()
       ├─ harmony.tick()         → advances chord progression on the beat clock
       ├─ bassVoice.tick()       → masterGain   (reads current chord)
       ├─ [active voices].tick() → masterGain / reverbNode   (read current chord)
       └─ evolve()               → drifts state, fires era (infinite mode only)

masterGain → AnalyserNode → AudioDestination
reverbNode → reverbGain   ↗

requestAnimationFrame
  └─ animate()
       ├─ analyser.getByteFrequencyData() → freqData[]
       ├─ fade-in ramp (0→1 over 2.5 s)  → energy, bass scaled on play start
       ├─ deform icosahedron vertices     ← freqData
       ├─ pulse inner glow                ← bass
       ├─ scale frequency bars            ← freqData
       ├─ update 7500 star vertex colours ← hue, per-star personality
       ├─ update 7500 star positions      ← t, energy, bass (flow field)
       ├─ update 80 large star sprites    ← hue, energy, bass
       ├─ update 22 nebula sprites        ← hue, energy, bass, t
       ├─ lerp camera orbit               ← energy, fade
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

The app is bundled with [esbuild](https://esbuild.github.io/) (`npm run build`) into a single content-hashed JS file for production deploys; `three` is still loaded unbundled via the CDN import map. See `scripts/build.js`.
