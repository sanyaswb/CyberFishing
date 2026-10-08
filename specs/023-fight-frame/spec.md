# Feature Specification: Production fight frame without the DEV diagnostics snapshot

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: hot-loop optimization and separation, same behavior

## Problem (verified)
Every fight step `FightPhysicsOrchestrator.#buildDebugSnapshot` (1 225 lines) built a new object of about 675 fields,
in production too. Production read about 64 of them through `TackleStressSystem.getDiagnostics()`, which copied the
whole snapshot plus stress values into a new object on every call: once in `FightService.updateFight` (auto catch),
once in `GameApplication` (rod visual offset) and once in `FishingRenderFrameBuilder` (fight area, landing, HUD).
Gameplay, HUD and render therefore depended on a DEV diagnostics channel.

Profile (game-cycle, 501 fight steps): the snapshot alone took ~20% of `FightPhysicsOrchestrator.step`.

## Solution
- **Fight frame.** The orchestrator owns one reused object and writes, every step, exactly the values gameplay,
  HUD and render read (54 keys from the snapshot literal plus `fishWeightKg`/`lastDash` from the fish force
  diagnostics). The expressions are the snapshot's final ones; the snapshot now reads these keys from the frame,
  so each formula has one source.
- **Stress values.** `TackleStressSystem.getFightFrame()` writes the eight values that override the snapshot in
  `getDiagnostics()` (`tensionKg`, `targetTensionKg`, `visibleTensionKg`, `maxTackleLoadKg`, `rodMaxLoadKg`,
  rod/line/hook stress ratios) with the same expressions on every read and returns the frame.
- **Consumers.** `FightService.updateFight`, `GameApplication` (rod visual offset) and `FishingRenderFrameBuilder` read
  `getFightFrame()`; DEV keeps `getDiagnostics()`.
- **Composition.** `GameCompositionRoot({ collectFightDiagnostics })` → `FightSessionFactory({ fightDiagnostics })` →
  `FightPhysicsOrchestrator({ diagnosticsEnabled })`. Production: off (no snapshot, no pipeline debug data, no copies).
  Development startup and the checks that read diagnostics: on.

## Evidence
- `game-cycle-check`: in every frame of the long fights, every frame key equals the same key of the full DEV
  diagnostics (`Object.is`); a 900-frame seeded fight run with and without the snapshot produces identical frame
  and step-result traces. Both checks are silent so the reported check list (digest) stays the reference; negative
  runs (a 1e-9 change in a stress value, a mode-dependent frame value) fail them.
- game-cycle digest unchanged (7b9baea3...ed5b6); 38/38 checks; guard.
- Benchmark (same seeded fight, median of 8 after warm-up): 157 ms without vs 205 ms with the snapshot per fight
  (~23% less), before counting the three per-frame copies production no longer makes.

## Recorded, not changed
- `GameViewportFacade.updateRodVisualOffset` writes `rodVisual*`/`rodAim*` values into the object it receives. Before,
  that was a throwaway copy, so the DEV overlay section "Rod control visual" never received them; now the writes land
  in the production frame (no production reader). Showing them in DEV is a separate decision.
- `RodVisualOffsetSystem` reads `fishMoveX`, `fishVelocityX`, `targetVelocityX`, `forces` and
  `rodControlFishVelocityX`, which no diagnostics layer writes; it always falls back. A gameplay-visual decision.
