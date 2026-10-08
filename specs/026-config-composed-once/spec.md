# Feature Specification: Configuration collaborators composed once, in bootstrap

**Created**: 2026-10-08 · **Status**: Implemented · **Kind**: hidden composition removal, same behavior

## Problem (verified)
- Six application classes (`BiteSystem`, `CatchResolutionService` per call, `FightService`, `FightSessionFactory`,
  `FightPhysicsOrchestrator`, `InventoryRuntimeConfigProvider`) created their own `FightPhysicsConfigAdapter` when the
  config carried none. Production always passes configs that carry the adapter bootstrap attaches
  (`createProductionConfigContext`; the composition root's runtime config forwards every own property). A probe that
  made every fallback throw failed only one check (inventory hydration builds fight equipment from `{}`), so the
  fallbacks were test-only hidden composition plus six application → config imports.
- `InventoryItemSnapshotMapper` (default freshness provider) and `LegacyItemStateMigration` read the authored
  `ITEM_PROGRESSION_CONFIG` through static imports.

## Solution
- The six classes read `config.fightPhysicsConfig` only (rule 4: the default is removed, no new validation).
- `InventoryCompositionRoot` composes one `freshnessCapabilityProvider` from `ITEM_PROGRESSION_CONFIG` (same
  expression, same object) and injects it into the mapper and the migration. Test compositions mirror it.

## Evidence
Production imports 715 → 708; 38/38 checks; game-cycle digest unchanged; guard. Remaining adapter constructions:
`createProductionConfigContext` and the composition root's guard for a config without one (bootstrap).
