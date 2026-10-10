# Feature Specification: Fight diagnostics snapshot outside the orchestrator

**Created**: 2026-10-10 · **Status**: Implemented · **Kind**: decomposition (optional item: split
`FightPhysicsOrchestrator`), DEV isolation, same behavior

## Problem (verified)
`FightPhysicsOrchestrator` had 4,740 lines. Its largest member was `#buildDebugSnapshot` (1,221 lines) plus eight
private summary helpers, which produced the DEV fight snapshot. A `diagnosticsEnabled` flag switched it on for
Development and the checks, and production only ever skipped it. The snapshot code only reads: the step's values,
`#fightFrame`, `#physicsConfig`, the pull smoother's diagnostics and `#playerMaxPowerY`. It writes no orchestrator
state.

## Solution
- `FightDiagnosticsSnapshotBuilder` (`src/dev/fishing`) holds the moved code unchanged. `build(stepValues, context)`
  takes the four orchestrator reads as `{ fightFrame, physicsConfig, playerPullMotion, playerMaxPowerY }`. It is
  stateless, so one instance serves every fight session.
- The orchestrator receives an optional `diagnosticsSnapshotBuilder` instead of the flag. `FightSessionFactory`
  passes its `fightDiagnosticsBuilder`, and `GameCompositionRoot` passes it from the new optional DEV factory
  `createFightDiagnosticsBuilder`, which replaces `collectFightDiagnostics`. Development startup composes the builder,
  production composes none, and the guard now keeps the snapshot code out of the production graph.
- Both classes share the domain function `hasLineReserve` (`game/domain/fishing/line_reserve.js`) instead of a
  private copy.

## Result
- The orchestrator is 4,740 → 3,355 lines.
- Production gains `line_reserve.js` (467 modules / 720 imports). The 1,394-line builder is reachable only from DEV.
- Production hot loop: the flag test becomes a null test, with no new allocation. DEV allocates the build context
  object once per step, only while it collects diagnostics.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 39/39.
  - Game-cycle composes the builder. Its silent parity checks still prove that every production fight-frame value
    equals the snapshot, and that a fight with and without the snapshot produces identical traces.
  - The config-runtime check covers the DEV factory and its optional-callback validation.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`.
- eslint-scope finds no unresolved names in either file, and every import is used. A first transform shadowed the
  import with a local `const lineHasReserve`; renaming the function to `hasLineReserve` fixed it before any check ran.
- Browser smoke by Claude in the desktop browser pane:
  - dev.html restarts and runs, and the builder module is loaded;
  - index.html restarts and runs, and the builder module is not loaded;
  - 0 errors.
