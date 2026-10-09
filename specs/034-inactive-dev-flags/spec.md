# Feature Specification: Production composes inactive DEV flags

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: DEV isolation (owner decision 3 in
[follow-up decisions](../029-backend-foundation/follow-up-decisions.md)), production GodMode off

## Problem (verified)
Production startup composed the real `DevFlagsProvider` over `GameplayOverrideReader(CONFIG)`, so GodMode effects
followed the configuration (and its overrides) in production. `isDebugEnabled()` was true in production because the
production config has `debug.overlay: true`, so debug events were dispatched on the document with no production
listener. `BiteSystem` (fixed bite chance, bite sequence, forced anomaly) and `FightService` (fish stamina lock) also
read `config.debug.godMode` directly, bypassing the injected flags.

## Solution
- The D4 calling API stays: `isEnabled`, `godModeValue`, `isDebugEnabled`. Its contract and the production
  implementation `InactiveDevFlags` (all off, values absent) live in `game/application/session`.
- Production startup composes `InactiveDevFlags`; it no longer imports `DevFlagsProvider` or `GameplayOverrideReader`.
  Both moved to `src/dev/runtime/` (DEV-only implementations; the guard now keeps them out of production).
- `BiteSystem` receives the flags and reads its GodMode settings through `godModeValue("activeSettings")`, a new reader
  getter that returns the same live settings object while GodMode is on (same condition, same raw values, so the DEV
  bite debug payload is unchanged). Its write-only `#runtimeConfig` field is removed.
- `FightService` locks fish stamina only through `isEnabled("noFishStaminaLoss")`; the removed direct config read
  was implied by the flag in DEV (same config object).

Production effect: GodMode and debug event dispatch are off whatever the configuration or overrides say.
DEV is unchanged.

## Evidence
Architecture 2/2, Quick 13/13, Full 38/38; game-cycle digest unchanged `7b9baea3…ed5b6`;
production 467 → 466 modules, 705 → 704 imports. Checks: production startup composes `InactiveDevFlags` and ignores an
enabled GodMode config; `activeSettings` follows the master switch; a production `BiteSystem` ignores forced anomaly
while the DEV-composed one forces it; inactive flags return off for every flag and value.
Browser smoke by Claude in the desktop browser pane (hidden pane, frames driven by a timer-based
`requestAnimationFrame` after `game.stop()`/`start()`): index.html restarts and runs 116 frames, 0 debug events,
0 errors; dev.html restarts, 146 `debug-live-update` events in 2.5 s, 0 errors.
