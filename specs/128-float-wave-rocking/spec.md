# Float rocking on the water waves

Owner request, 2026-10-22 (TK-038). Status: v0.46.11 implemented the wave-pattern model below; the owner saw no
motion and asked for a simpler one, implemented in v0.46.12 (see "Simplified model" at the end, which supersedes the
Model, Drawing details about sampling, Settings and D1/D2/D4). Owner visual and phone check pending.

The float stands motionless on animated water. It must rock with the waves, with the strength and amplitude of the
water's own wave settings, so the scene feels alive:

- a **standing** float moves up and down and slightly left and right;
- a **lying** float moves up and down and at the same time turns about the middle of its lying body.

Simple animations, visual only. DevTools turns rocking on and off and edits its settings, like the waves.

## Owner criteria

| # | Criterion | Where it is met |
| --- | --- | --- |
| 1 | Rocking follows the strength and amplitude of the water waves | One wave pattern for the water and the float; amplitude, wavelength, speed and perspective come from `CONFIG.canvas.water` and the water metric |
| 2 | Standing: up/down and a little left/right | Vertical displacement of the water under the float, plus its horizontal displacement times `swayShare` |
| 3 | Lying: up/down plus rotation about the middle of the lying body | The water's height at both ends of the visible body: their mean lifts the float, their difference tilts it; the rotation pivots on the body's middle |
| 4 | Simple, realistic | A sampled function of time and place, no extra springs or state; it adds to the spec 127 pose |
| 5 | DevTools: on/off and settings, next to the waves | `CONFIG.canvas.water.floatRocking`, labelled, schema-checked, applied live |

## Current state (verified in the code)

| Part | Code | Fact |
| --- | --- | --- |
| Water waves | `platform/browser/scene/water_wave_field.js` | Crossing sine waves (3 along X, 2 along Y, fixed directions/shares/phases) on the water plane; per row the surface scale `s` (1 at the shore, `farScale` far away) scales spacing and height; ground metres along rows (spec 126 R4). Writes a displacement map; red = horizontal, green = vertical shift |
| Water renderer | `platform/browser/scene/pixi_water_renderer.js` | Steps at `water.frameRate`; shift = `amplitude` art px × art scale (logical px per art px) × `verticalShare` for Y; the pattern drifts with the current (`currentScale`). WebGL scene only: the 2D canvas draws no waves |
| Water settings | `CONFIG.canvas.water` | `enabled`, `frameRate` 30, `amplitude` 20, `verticalShare` 1, `wavelength` 200, `speed` 40, `currentScale` 1 |
| Float pose | `game/presentation/fishing/float_pose_animator.js` (spec 127) | Lean vector + draft through damped springs; projected to `rotationDeg`, `foreshortening`, `visibleShare`; lying when the lean reaches `lyingAngleDeg` |
| Float model | `FishingEquipmentRenderModelBuilder.buildFloat` | `x`, `y` = the waterline point on screen; `rotationRad`; `bodyHeight`, `visibleShare`; both renderers (`FloatRenderer`, `PixiFloatRenderer`) draw from the waterline point up, rotated about it |

The wave pattern lives in the platform layer, which presentation cannot import, and the float knows nothing of the
water's motion.

## Model

### One wave pattern (TK-038.1)

The waves' definition and evaluation move to a pure engine module, `engine/animation/crossing_wave_pattern.js`
(reusable mechanism, no game knowledge):

- the wave sets (`WAVES_X`, `WAVES_Y`) and the row evaluation that `WaterWaveField` uses today, unchanged;
- a point sample: `sample(surfaceX, groundY, timeSec, { wavelength, speed }, out)` → `out.x`, `out.y` in −1…1, the
  same sums the field writes for that point (before its edge envelope and surface scale).

`WaterWaveField` keeps its output byte for byte (the check compares a written map with the current one). The float
samples the same function, so it rises on the same crests the water shows.

### Rocking of the float (TK-038.2)

A stateless `FloatWaveRocking` (presentation) computes, for one frame:

```
time      = frame clock (real seconds, the base the water renderer steps on)
surface   = the float's surface position from the water metric (ground metres → near-edge art px, as the field)
s         = metric.surfaceScaleAt(y)                     // perspective: far water rocks less
A         = water.amplitude × artScale × s               // logical px of the water's shift at the float
standing  = { dy: A × verticalShare × bobShare × sampleY,
              dx: A × swayShare × sampleX,
              turn: 0 }
lying     = { dy: A × verticalShare × bobShare × (hTip + hBottom) / 2,
              dx: 0,
              turn: clamp(rotationGain × atan((hTip − hBottom) × A × verticalShare / visibleLength), ±maxRotationDeg) }
            // hTip, hBottom: sampleY at the two ends of the visible lying body
w         = lying share = min(1, |lean| / lyingAngleDeg)  // from the spec 127 pose, smooth by construction
result    = mix(standing, lying, w) × (bite ? biteShare : 1) × (enabled ? 1 : 0)
```

- **Up/down** is the water's own vertical shift under the float (`bobShare` 1 = exactly with the water).
- **Left/right** for a standing float is the water's horizontal shift times `swayShare` (small by default).
- **Lying turn** comes from the slope of the water between the body's ends: the float lies on the wave. Long waves
  under a short float give a small turn; `rotationGain` amplifies it, `maxRotationDeg` limits it.
- The transition between standing and lying needs no state: it follows the pose's lean, which is already smooth.
- No springs, no history: the same time and place give the same offsets at any frame rate.

### Drawing (TK-038.3)

`FishingRenderFrameBuilder` builds the rod line (`buildRodLine`, from `screenPosition`) before the float
(`buildFloat`). So the rocking is applied to one reused, rocked copy of the float's screen point before the line, and
both the line's end and the float use it:

- the waterline point moves by `dx`, `dy` (the line's end moves with it, so the line never detaches);
- for a lying float the turn pivots on the middle of the visible body: the middle point `m = p + h/2 × (sin r, −cos r)`
  stays put while the body turns by `turn`, so the waterline point moves to `m − R(turn) × (m − p)`; then
  `rotationRad += turn`. This needs the spec 127 pose, so `buildFloat` applies the pivot correction and the line end
  takes the same corrected point (the pose is advanced once, before the line, and read by both).

The renderers are unchanged: they already draw from `x`, `y` and `rotationRad`. Per frame: about ten sines and no
allocations (reused output objects), well inside the frame budget; still measured on a phone in both orientations
(docs/rendering.md).

### Settings (TK-038.3)

`CONFIG.canvas.water.floatRocking`, shown in DevTools inside the water group, applied live:

| Setting | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Rocking on/off |
| `bobShare` | `1` | Up/down as a share of the water's vertical shift under the float |
| `swayShare` | `0.3` | Standing float's left/right as a share of the water's horizontal shift |
| `rotationGain` | `2` | Multiplier of the lying float's tilt from the wave slope |
| `maxRotationDeg` | `12` | Limit of that tilt |
| `biteShare` | `0.5` | Rocking during a bite step, so bites stay readable (D3) |

Amplitude, wavelength, speed and vertical share are the water's own settings: changing the waves changes the rocking.

## Owner decisions

| # | Question | Recommendation |
| --- | --- | --- |
| D1 | When the water does not animate (`water.enabled` off, or the 2D canvas, which draws no waves), does the float rock? | Rocking follows `water.enabled` only, in both renderers: on the 2D canvas the float still rocks with the same settings |
| D2 | Should the float follow the current's drift of the wave pattern (exact phase with the visible ripple) or only its own place and time? | Own place and time: the float drifts with the current itself, so the pattern seen from the float hardly drifts; no renderer state is shared |
| D3 | During a bite step and while the fish is hooked, does the float rock? | Bite steps: `biteShare` 0.5; hooked/fight and landing: no rocking (the line holds the float) |
| D4 | Lying turn: from the wave slope (realistic, small on long waves) or a fixed-amplitude rotation in phase with the bob? | Wave slope with `rotationGain` 2 and a 12° limit; switching to a fixed amplitude later is one setting |

## Stages

1. **TK-038.1** Engine wave pattern; `WaterWaveField` uses it, byte-identical map.
2. **TK-038.2** `FloatWaveRocking` with deterministic checks.
3. **TK-038.3** Builder integration, config, labels, schema, DevTools.
4. **TK-038.4** Full, version, CHANGELOG, phone performance overlay (owner), gh-pages.

## Checks (extend `float-pose`, no new check id)

- The engine point sample equals the field's value at the same row/column (before envelope), and the field's map is
  byte-identical to the current implementation for fixed time/settings/metric.
- Disabled, amplitude 0 or `bobShare`/`swayShare` 0 → zero offsets and turn.
- Standing: |dy| ≤ A × verticalShare × bobShare and |dx| ≤ A × swayShare; a far float rocks less than a near one
  (surface scale).
- Lying: the middle of the visible body stays where the bob puts it while the body turns; the turn never exceeds
  `maxRotationDeg`; a flat wave (equal ends) gives no turn.
- The same time gives the same result at 30/60/144 FPS (no state); a lean between standing and lying mixes both.
- Bite step scales by `biteShare`; hooked/landing gives zero.
- The rod line's end equals the float's rocked waterline point in the same frame.
- Game-cycle report unchanged (visual only); config schema rejects invalid values.

Appearance (how much it rocks, whether it reads as water) is the owner's check on a phone, both orientations, with
the performance overlay.

## Implementation (v0.46.11)

- `engine/animation/crossing_wave_pattern.js` (`CrossingWavePattern`): the wave sets, `addRow` (the field's row
  recurrence, unchanged) and `sampleAt`. `WaterWaveField` uses it; its map was compared byte for byte with the
  previous implementation (442,368 bytes over three settings and four moments, including an epoch-sized time). The
  scene-layer check asserts that a point sample equals the field's texel at that place.
- `game/presentation/fishing/float_wave_rocking.js` (`FloatWaveRocking`): stateless, one reused result. Surface
  position as the field's (map pixels are art pixels; x over the surface size, rows in calibrated ground metres),
  without the field's centre offset and drift (D2: the phase is not locked to the visible ripple, the motion has its
  frequency, wavelength and amplitude). Signs follow Pixi 8.22.0 `DisplacementFilter`, which samples the art at
  p + offset: the art, and the float, move by -offset. The lying turn is the angle change of the visible body when
  each end moves with the water under it, times `rotationGain`, limited, weighted by the lying share.
- `FishingEquipmentRenderModelBuilder` takes `floatRocking` (composed in `game_render_composition`, settings
  `config.canvas.water`) and applies it to `kind === "float"` only (a hooked fish draws `hooked`: D3); the turn keeps
  the visible body's middle. `FishingRenderFrameBuilder` builds the float before the rod line, which ends at the
  float's drawn point.
- Config `canvas.water.floatRocking`, schema ranges (bobShare/swayShare 0–3, rotationGain 0–10, maxRotationDeg 0–45,
  biteShare 0–1) and DEV labels; DevTools shows the group under the water settings.
- Checks: float-pose (bob/sway bounds, no turn standing, lying turn within its limit and no sway, mixed lean,
  switches, still water, amplitude 0, bite share, far water calmer, stateless; the builder's middle-pivot turn and
  bob), scene-layer (point sample = texel), render-frame composition (the line ends at the rocked float point,
  builder requires floatRocking). No tool, helper, fixture or dependency became obsolete.

## Simplified model (owner, v0.46.12)

Owner test of v0.46.11 on a phone: the float did not move, even with `bobShare` 9; the cause stayed unknown (a probe
of the published builder with the real config moved the model by ±45 px, and every link of the frame chain reads the
moved point). The owner asked for a simpler model without synchrony with the waves: the stronger the waves, the
stronger the rocking. It replaces the wave-pattern model above (TK-038.1 reverted: the water field is back to its
v0.46.10 bytes and the engine pattern module is removed; D2 and D4 no longer apply; D1 changes, see below).

- Motion: a few slow sines of time with unrelated frequencies, so it never looks mechanical. Standing: up/down
  `bobPx` (0.7/0.3 mix of two sines) and sideways `swayPx`; lying: the same up/down and a turn `lyingTurnDeg` about
  the middle of the visible body; a lean between mixes them by the lying share.
- Strength = water `amplitude` / 20 (the default amplitude rocks at the written sizes, 40 twice as much) × the surface
  size at the float (far water calmer) × `biteShare` during a bite step. Logical pixels, independent of the zoom.
- D1 now: rocking has its own switch and does not follow `canvas.water.enabled` (one fewer reason for no motion).
- Settings `canvas.water.floatRocking`: `enabled` true, `bobPx` 8, `swayPx` 3, `lyingTurnDeg` 10, `periodSec` 2,
  `biteShare` 0.5 (ranges 0–60 px, 0–45°, 0.2–20 s, 0–1).
- Diagnosis: `FloatWaveRocking.status` (frames asked, state off/still/active, last offsets, strength, lying share) is
  shown in DevTools → "🖼️ СЦЕНА WebGL" → "покачування поплавка" (↻ refreshes). The rocking is created once in the
  composition root and shared by the render model and the DEV section, so the row shows exactly what the frame used.
- Checks: float-pose (bob/sway/turn sizes, stateless, moves at epoch-sized clocks, mixed lean, amplitude ×2 = rocking
  ×2, amplitude 0, switch, bite share, far calmer, DEV status, and the real builder + real rocking moving the drawn
  float over 120 frames); render-frame composition (line ends at the rocked point). The scene-layer point-sample
  assertion went with the engine module.
