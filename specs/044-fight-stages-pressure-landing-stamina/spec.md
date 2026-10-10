# Feature Specification: Player pressure, landing/tension and stamina stages out of the orchestrator

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: decomposition (split `FightPhysicsOrchestrator` by
pipeline stage), same behavior

## Problem (verified)
After spec 043, `FightPhysicsOrchestrator` still had 3,355 lines with more than 70 private methods. Per-method coupling
(acorn analysis) shows three clusters. Each one owns its calculators and state and reads only `#config`,
`#physicsConfig` or `#logger` from the orchestrator:
- **Player pressure** (pipeline steps `resolve_player_force_budget` … `update_player_pressure_fatigue`): 11 methods,
  7 calculators and states.
- **Landing/tension** (`update_final_tension`, `resolve_landing_frame`): 6 methods, the lift calculator, its
  readiness policy and the session's lift hold.
- **Stamina frame** (`resolve_stamina_frame`): 9 methods, the balance frame and the one-time overflow warning.

## Solution
Each cluster moves unchanged into its own application class, constructed per fight session by the orchestrator
with its dependencies:

| Class | Dependencies | Public entry points |
| --- | --- | --- |
| `FightPlayerPressureStage` | config, physicsConfig | the seven step entry points; `reset()` resets both fatigue states |
| `FightLandingTensionStage` | config, physicsConfig | `updateTension`, `calculateTension` (tension preview), `buildLandingFrame` |
| `FightStaminaFrameBuilder` | config, logger | `buildStaminaFrame`; `reset()` re-arms the overflow warning |

- Methods that only the stage calls stay private there. `resetPlayerPullMotion` delegates to the two `reset()`s.
- Pure helpers shared across stages become modules:
  - `isLineTaut` joins `hasLineReserve` in `game/domain/fishing/line_state_queries.js` (renamed from spec 043's
    `line_reserve.js`);
  - `hasFinitePoint` joins `engine/math/number_normalization.js`, with its exact body (it returns the falsy point
    itself).
- A scripted move takes all member ranges from one parse and proves that neither side references the other's private
  members afterwards. Unused imports are pruned.

## Result
- The orchestrator is 3,355 → 2,417 lines.
- The new stages have 447, 269 and 273 lines.
- Production has 470 modules and 727 imports.
- Stage objects are allocated once per fight session, never per step.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 39/39.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`. The digest covers the whole fight pipeline, including the fight
  frame / snapshot parity and the diagnostics on/off parity.
- eslint-scope finds no unresolved names, and every import is used.
- Timing of game-cycle runs (6 runs each, alternated): previous commit 1,687 and 1,690 ms, new 1,694 and 1,676 ms.
  The difference is within noise.
