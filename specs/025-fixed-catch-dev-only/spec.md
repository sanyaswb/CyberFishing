# Feature Specification: Fixed Catch exists only in DEV

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: DEV/production separation, same behavior

## Problem (verified)
Production startup composed `FixedCatchFishFactory` and `WaitingState` carried the DEV Fixed Catch branch
(`config.debug.fixedCatch`, test fish template, bite sequence, forced anomaly). Owner decision D4 keeps Fixed Catch a
DEV balance tool and switches it off in production; the code still lived in the production graph.

## Solution
- `WaitingState` asks an optional `hookedFishOverride.apply({ hooked, baitCandidates, biteEnv })`; production composes
  none (the branch was always off there).
- `src/dev/fishing/fixed_catch_hook.js` holds the moved branch verbatim (`config`, `biteRules`, `devFlags`, fish
  factory injected). `FixedCatchFishFactory` moves byte-for-byte to `src/dev/fishing/`.
- `GameCompositionRoot({ createHookedFishOverride })` replaces `createFixedCatchFishFactory`; Development startup
  composes the hook with its factory.

## Evidence
Production graph 466 → 465 modules (no Fixed Catch); 38/38 checks, including the bait-compatibility scenarios that now
run `WaitingState` with the DEV hook and the startup checks (production supplies no Fixed Catch port, DEV composes the
hook with its factory); game-cycle digest unchanged; guard.
