# Feature Specification: Reuse instead of copies

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: reuse, same behavior

Found with a copy detector over `src/` (repeated windows of normalized lines) and checked by hand.

## Items
1. **DEV GodMode = production reader.** `src/dev/god_mode.js` was a byte-for-byte copy of
   `GameplayOverrideReader` (only the class name and `typeof x !== "undefined"` vs `x !== undefined` differ, which
   are equivalent). Development startup composes `GameplayOverrideReader`; the copy is deleted. The parity
   check against the copy becomes explicit expected values.
2. **Fight equipment built once.** `FightSessionFactory.create` repeated `createEquipment` line for line (rod, reel,
   hook, line system). `create` calls `createEquipment`; the line system is now built before the fish, which is
   independent of it (the line system receives no RNG; the fish does).
3. **Three-band gradient color.** `FightStatusBarsRenderer` and `CastingRenderFrameBuilder` carried the same
   `#gradientColor`; one presentation function serves both.

4. **LocationMap zone scaling.** The constructor and `refreshConfig` repeated the design-grid scaling block;
   `#scaleZones(ratio)` holds it once and each caller keeps its own order of steps. The real config has ratio 1, so a
   differential (HEAD vs new, cell sizes 40/20/80, constructor + refresh) proved identical grids, bounds and zones.
5. **Durability-adjusted item load.** `TackleLoadLimitPolicy` (closure) and `TackleStressSystem.effectiveItemMaxLoadKg`
   (static, only used inside the class) carried the same formula; `durabilityAdjustedMaxLoadKg` in
   `domain/items/condition/durability_max_load.js` serves both. `WeakestTackleLimitResolver` keeps its own variant: it
   clamps negative durability differently, so merging it would change results for invalid input.
6. **Cast target resolution.** `ScoutingState` and `WaitingState` (recast) repeated the cast target request and two
   accuracy helpers; `GameState` (their base, which already shares `getEffectiveCastDistance`) now provides
   `resolveCastTarget` and the rod accuracy getters with the same order of reads. No check covers the cast release
   path, so the move is verbatim and was exercised by a browser cast (line lands in the water, 0 console errors).

Not merged (differences are real): DEV reel console tables (different rows), `FishForceSystem` twin force frames
(different base power).

## Acceptance
All checks; guard; game-cycle digest unchanged; browser smoke.
