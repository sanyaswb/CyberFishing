# Float rocking on the water

Owner request, 2026-10-22 (TK-038, TK-039). Status: stage 1 (simple rocking) works on the owner's phone (v0.46.12);
stage 2 (landing settle, weather, ballast, wave tempo) implemented in v0.46.13, owner check pending.

The float on animated water rocks, so the scene feels alive: a standing float moves up and down and a little sideways,
a lying one moves up and down and turns about the middle of its body. The stronger the waves, the stronger the
rocking. Visual only: gameplay, its random numbers and the game-cycle report never change. DevTools turns it on and
off and edits every setting live, next to the water's waves.

## Owner criteria

| # | Criterion | Where it is met |
| --- | --- | --- |
| 1 | Stronger waves rock the float more | Strength = water `amplitude` / 20; tempo follows the waves' speed / wavelength (stage 2) |
| 2 | Standing: up/down and a little left/right | `bobPx`, `swayPx` |
| 3 | Lying: up/down plus a turn about the middle of the lying body | `bobPx`, `lyingTurnDeg`; the render model turns the visible body about its middle |
| 4 | Simple and realistic, no synchrony with individual waves | Slow sines of time with unrelated frequencies |
| 5 | DevTools: on/off and settings, next to the waves | `CONFIG.canvas.water.floatRocking`, labelled, schema-checked, live; live status row |
| 6 | Stage 2: livelier after landing, wind and rain, ballast, wave tempo (owner, TK-039) | Multipliers below, each smooth |

## Model

`FloatWaveRocking` (presentation, `game/presentation/fishing/float_wave_rocking.js`) gives, per frame, the waterline
point's offset `dx`, `dy` (logical pixels) and the body's turn `turnRad`. One instance is composed in
`GameCompositionRoot` and shared by the render model and the DEV scene section. Allocation-free (one reused result,
one reused status record).

### Motion

```
phase    += 2π × dt / period                 // integrated, so a tempo change never jumps
bob       = 0.7 sin(phase) + 0.3 sin(1.7 phase + 1.3)
sway      = sin(0.63 phase + 2.1)
turn      = 0.75 sin(0.81 phase + 0.6) + 0.25 sin(1.9 phase + 2.4)
lying     = min(1, |lean| / lyingAngleDeg)    // spec 127 pose; a lean between mixes standing and lying

dy        = bobPx × strength × bob
dx        = swayPx × strength × sway × (1 − lying)
turnRad   = lyingTurnDeg × strength × turn × lying
```

### Strength and tempo

```
strength  = amplitude / 20                    // water.amplitude; 20 is the default: sizes as written
          × surface(y)                        // water metric surface size: far water calmer
          × biteShare (in a bite step)
          × landing                           // stage 2: 1 + (landingBoost − 1)(1 − u)², u = time since cast / landingSettleSec
          × weather                           // stage 2: 1 + windShare |windDeg| / 30 + rainShare (rainMult − 1), smoothed (τ 0.6 s)
          × (1 − ballastCalm × draft)         // stage 2: draft = restDraft / 0.3 (heavy ballast = 1)

period    = periodSec / waveTempo × (1 + ballastSlow × draft)
waveTempo = 1 + waveTempoShare × ((speed / wavelength) / (40 / 200) − 1), clamped to 0.25…4
```

- **Landing:** `cast()` places the float on the water and increments its cast serial (`FloatEntity`); the rocking
  starts its settle timer when it sees a new serial. The pose (spec 127) also starts a new cast at that moment.
- **Wind:** the float's wind tilt `windDeg` (breeze and gusts of the location's wind) is already reduced by the float's
  wind compensation (its quality over `windCompensation`, `WaterEntity._applyPhysics`), so a better float rocks less
  in the wind. A hooked fish has no wind tilt. Rain: the weather snapshot's `rainMult` (1 when dry).
- **Ballast:** `restDraft` (share of the body under water at rest) comes from the float's ballast profile
  (light 0, medium 0.15, heavy 0.3): a heavier float sits deeper, rocks less and slower.
- **Tempo:** at the default waves (speed 40, wavelength 200) the period is `periodSec`; faster or shorter waves rock
  faster. The phase is integrated, so DEV edits and ballast changes never make the float jump.
- **Smooth:** landing decays quadratically to 1; weather follows its target with a 0.6 s time constant; the frame
  time step is clamped to 0.1 s (a hidden tab does not jump).

### Drawing

`FishingEquipmentRenderModelBuilder.buildFloat` advances the spec 127 pose, then the rocking (only `kind === "float"`;
a hooked fish draws `hooked`): the waterline point moves by `dx`, `dy`; a lying body turns by `turnRad` about the
middle of its visible part (that middle only bobs). `FishingRenderFrameBuilder` builds the float before the rod line,
which ends at the float's drawn point. Both renderers (Pixi scene, 2D canvas) draw from `x`, `y`, `rotationRad`.

### Settings

`CONFIG.canvas.water.floatRocking` (DevTools: CONFIG → canvas → water → floatRocking):

| Setting | Default | Range | Meaning |
| --- | --- | --- | --- |
| `enabled` | `true` | | Rocking on/off (its own switch, not the water's) |
| `bobPx` | 8 | 0–60 | Up/down near the shore at amplitude 20, logical px |
| `swayPx` | 3 | 0–60 | Standing float sideways, logical px |
| `lyingTurnDeg` | 10 | 0–45 | Lying float's turn about its middle |
| `periodSec` | 2 | 0.2–20 | Seconds per rock at the default waves |
| `biteShare` | 0.5 | 0–1 | Rocking during a bite step |
| `landingBoost` | 3 | 1–10 | Rocking multiplier right after landing |
| `landingSettleSec` | 1.5 | 0–10 | Seconds to settle back to normal |
| `windShare` | 0.5 | 0–5 | Extra rocking per 30° of the float's wind tilt |
| `rainShare` | 0.3 | 0–5 | Extra rocking per +1 of the rain multiplier |
| `ballastCalm` | 0.5 | 0–1 | Share of rocking a heavy ballast removes |
| `ballastSlow` | 0.3 | 0–2 | How much slower a heavy ballast rocks |
| `waveTempoShare` | 1 | 0–2 | How much the waves' speed / wavelength sets the tempo (0: `periodSec` only) |

### DEV status

DevTools → "🖼️ СЦЕНА WebGL" → "покачування поплавка" (↻ refreshes): state (off / strength 0 / rocking), frames
asked, current up/down, sideways and turn, strength, lying share, and the stage 2 multipliers (landing, weather,
ballast, tempo).

## Checks (float-pose; render-frame composition)

- Sizes: standing bob ≈ `bobPx`, sway ≈ `swayPx`, no turn; lying turn ≈ `lyingTurnDeg`, no sway; a lean mixes both.
- Strength: amplitude × 2 = rocking × 2; amplitude 0 and the switch stop it; bite share; far water calmer.
- Stage 2: a new cast serial boosts by `landingBoost` and settles to 1 after `landingSettleSec`; wind tilt and rain
  raise the strength, smoothly (no jump in one frame); heavy ballast rocks less and slower than light; faster waves
  rock faster; a tempo change does not jump the offsets; the same input sequence gives the same output at 30/60/144 FPS
  within tolerance.
- The real builder with the real rocking moves the drawn float; the line ends at the rocked point; game-cycle
  unchanged.

## History

- v0.46.11: the first model sampled the water's own wave pattern (shared engine module) so the float rose on the same
  crests. On the owner's phone the float did not move, even with a ninefold bob; the cause stayed unknown (a probe of
  the published builder moved the model). The owner asked for a simpler model without synchrony.
- v0.46.12: the simple model above (stage 1); the water field back to its v0.46.10 code, the engine module removed;
  the DEV status row added. The owner confirmed it rocks "like on waves".
- v0.46.13: stage 2 (TK-039).
