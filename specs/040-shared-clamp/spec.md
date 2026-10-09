# Feature Specification: Private clamp copies use the shared functions

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: reuse, same results (finalization review 10)

## Problem (verified)
Spec 021 merged helpers whose normalized source matched exactly, so copies that differed only in variable names
remained. That left 13 generic clamp helpers (plus one wrapper) in 11 modules, with four semantics: finite or 0 on 0..1; finite or a
fallback on min..max; finite or `min` returned unclamped; and `|| 0`. `RenderMath.clamp` repeated the body of
`clampNumber`.

## Solution
`engine/math/number_normalization.js` gains two functions with the exact bodies:
- `clampFinite(value, min, max, fallback = min)`: a non-finite value is replaced by the fallback, then clamped;
- `clampFiniteOrMin(value, min, max)`: a non-finite value returns `min` as given.

Each copy maps to the function with its semantics:

| Function | Former copies |
| --- | --- |
| `clampUnitFinite` | `#clamp01` in `BiteSystem` (with its `#clampChance` wrapper), `CastDistanceCalculator`, `RodControlAngleResolver`, `RodLateralControlSystem` and `RodVisualOffsetSystem`; `clamp01` of DEV `LocationDebugDataProvider` (no other caller) |
| `clampFinite` | `FloatTackleLineBudgetPolicy`, `LineConstraintStateResolver`; `RodControlTensionModeResolver` with explicit fallbacks 0 / 0.35 / -0.35; `FishFightDirectionResolver` with fallback 0 on -1..1 (0 lies inside the bounds, so the former unclamped 0 is the same) |
| `clampFiniteOrMin` | `LineSpoolState`, `RodVisualOffsetSystem#clamp` (they differ from `clampFinite` when `max` is NaN) |
| `clampNumber` | `DragControlService#clamp` keeps its bound-binding wrapper; `RenderMath.clamp` delegates |

Kept on purpose:
- `CastPowerAim#clamp` has no number conversion, so NaN propagates.
- The domain-specific helpers stay: screen X, bounds, cast power, power debuff, alpha, and the DEV overlay window
  clamps.

## Evidence
- Differential test (scratch): 780 cases with NaN, ±Infinity, null, undefined, strings, booleans, objects, reversed
  bounds and NaN bounds. Every removed body equals its replacement (`Object.is`). The first mapping found 6
  differences for NaN `max`, which led to `clampFiniteOrMin`.
- Checks: Architecture 2/2, Quick 13/13, Full 39/39.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`. Fight physics, line spool, rod control and bite rolls run through
  the shared functions.
- Production 466 modules, 718 imports.
- Browser smoke by Claude in the desktop browser pane: dev.html restarted, 87 frames, live bite chances in the DEV
  updates, 0 errors.
