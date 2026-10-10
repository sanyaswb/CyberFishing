# Feature Specification: Fish motion, rod movement and line stages out of the orchestrator

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: decomposition (closes the optional item "split
`FightPhysicsOrchestrator` by pipeline stage"), same behavior

## Problem (verified)
After spec 044, `FightPhysicsOrchestrator` still held 2,406 lines. Five method clusters remained, each coupled only
through config, physics config and a few shared per-session helpers (per-method acorn analysis):
- line constraint;
- pole fight sector;
- fish motion;
- rod pull and rod control with their movement application;
- line recovery.

## Solution
Each cluster moves unchanged into a class that the orchestrator builds once per fight session, in dependency order.
The same scripted move as spec 044 is used: one parse, a cross-reference proof, and import pruning.

| Class | Lines | Owns | Receives |
| --- | ---: | --- | --- |
| `FightLineConstraint` | 95 | line constraint resolver | config, physics config |
| `FightPoleSector` | 179 | sector and angle constraints (`reset()`) | config, physics config |
| `FightFishMotionStage` | 430 | motion scratch vectors/objects, catch-zone flag, motion resolvers, splitter, landing policy | config, physics config, recovery slowdown policy, line constraint, pole sector |
| `FightRodMovementStage` | 842 | stroke distance tracker, rod control projector, water probe point | config, physics config, pull motion smoother, recoverable line calculator, line constraint, pole sector |
| `FightLineRecoveryStage` | 223 | reel-hold recovery system and state (read back through `holdReelRecoverState`), loose line calculator | physics config, recoverable line calculator, line constraint |

- The orchestrator keeps the helpers several parts share: the pull motion smoother (its diagnostics feed the DEV
  snapshot), the recoverable line calculator, and the recovery slowdown policy with its state.
- It also keeps `step()` in pipeline order, input/anchor/delta-time resolution, the drag context, `writeFightFrame`
  and `resetPlayerPullMotion` (which delegates to the stages' `reset()`).
- `#getRuntimePhysicsConfig` (one line) is copied where a stage reads live physics settings.

The stages are internal parts of the per-session orchestrator, not shared or replaceable collaborators. Their
ownership is the same as when they were private fields, so they are built by the orchestrator, not by bootstrap.

## Result
- `FightPhysicsOrchestrator`: 4,740 lines before spec 043, 762 lines now.
- The fight pipeline is now ten application modules plus the DEV snapshot builder.
- Production has 475 modules and 735 imports.
- No per-step allocation was added: scratch objects moved with their stage and are still reused.

## Evidence
- The game-cycle digest was unchanged after every single extraction and after the constructor tidy-up:
  `7b9baea3…ed5b6`. It covers the fight pipeline end to end, including the frame/snapshot and diagnostics on/off
  parity checks.
- Checks: Architecture 2/2, Quick 13/13, Full 39/39.
- eslint-scope finds no unresolved names in any fight module, and every import is used.
- Timing of game-cycle runs (6 runs each, alternated) against spec 043: 1,680/1,784 ms before, 1,679/1,796 ms after.
  The difference is within noise.
- Browser smoke by Claude in the desktop browser pane: dev.html restarts and runs, all nine fight modules load
  natively, 0 errors.
