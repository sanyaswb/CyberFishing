# Feature Specification: Normalized physics settings computed once per config revision

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: hot-loop optimization, same behavior

## Problem (verified)
`FightPhysicsConfigAdapter` getters rebuilt their normalized objects on every call: per fight step ~30 getter
objects and ~236 `firstFinite` calls, and in the browser every config read walks the runtime config view
(`readLive`). Profile of production-mode fights: ~10% of the step.

## Solution
The adapter takes an optional `revision` function. With it, every zero-argument getter computes once per revision
and returns the same object until the revision changes; without it (plain config objects in tests and tools)
nothing changes. Production and DEV compose the adapter with the runtime config override store revision; every
runtime config write (view setter, `set`, `reset`, `resetAll`, `importOverrides`) goes through the store and
advances it.

## Evidence
- Mutation probe: all checks and the game-cycle ran with every getter result deep-frozen and cloned — no consumer
  mutates or relies on the identity of a getter result; digest unchanged.
- `config-runtime-check`: on the actual production composition, unchanged config reuses the normalized objects,
  a live override reaches the adapter (including the nested water settings inside rod control), reset and reset all
  restore the value.
- 38/38 checks; game-cycle digest unchanged; guard.
- Benchmark (seeded production fight with a constant revision, plain config objects): 142 → 130 ms (~9%); the
  browser additionally skips the runtime config view walk on every read.
