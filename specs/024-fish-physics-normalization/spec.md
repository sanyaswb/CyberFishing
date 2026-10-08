# Feature Specification: Normalize the fish's runtime physics once, not every fight step

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: hot-loop optimization, same behavior

## Problem (verified)
`FishForceSystem.calculate` ran `FishPhysicsProfile.toRuntimeConfig(fish.getPhysicsConfig())` on every fight step.
The fish already stores normalized physics and replaces the object (never mutates it) in `updateRuntimeStats`;
`toRuntimeConfig` is pure. Profile of production-mode fights: ~6% of `FightService.updateFight`.

## Solution
`FishForceSystem` keeps the last physics object and its normalized result and recomputes only when the fish returns
a different object. A fish without physics returns a fresh `{}` per call, so it recomputes as before.

## Evidence
38/38 checks; game-cycle digest unchanged; fight frame parity checks pass. Benchmark (seeded production fight,
median of 8): 144 ms vs 154 ms per fight (~7%).

## Measured, not changed
`FightPhysicsConfigAdapter` getters build fresh normalized objects (~236 `firstFinite` calls and ~30 getter objects per
step, ~10% of the step). Caching them needs a revision signal from the runtime config context and an audit of ~100
call sites for mutation of the returned objects; recorded for a separate decision.
