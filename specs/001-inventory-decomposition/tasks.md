# Tasks: Inventory decomposition

Each task: implement → focused check → `npm run check` → game-cycle digest → guard → commit.
Names below are the final ones (the "V2" marker was dropped afterwards, commit `4af3e8f`).

## Phase A — InventoryManager (commit `4c7bb50`)
- [x] A1 `TackleLoadLimitPolicy` (domain) with the exact `getMaxTackleLoadKg` formula.
- [x] A2 `RodCastDisplayStatsWriter` + `ROD_CAST_DISPLAY_LABELS` (presentation), injected by bootstrap.
- [x] A3 `LegacyInventorySaveSource` (+ `LegacyInventoryItems`): legacy keys, id/equipment migration, seeding.
- [x] A4 `InventoryItemViewContext`: reel config, line-capacity context (legacy snapshot, preserved), freshness.
- [x] A5 `PlayerInventory` composed in `bootstrap/production/player_inventory_composition.js`; `InventoryManager`,
      `InventoryEquipment`, `EquipmentValidator`, `LineInventoryController`, `InventoryItemStackingPolicy`
      deleted; `player-inventory` check added; `inventory-lifecycle` replaced by `game-application-composition`.
- [x] A6 Differential run old vs new (72 steps × 2 scenarios, identical); browser smoke.

## Phase B — command service (commit `4778135`)
- [x] B1 `inventoryCommandSuccess/Failure`.
- [x] B2 `InventoryItemRemovalService`.
- [x] B3 `InventoryGameplayCommands`; the gameplay bridge depends on it.
- [x] B4 `InventoryUiState`; `InventoryCommandService` 1,294 → 952 lines.
- [x] Differential run against the previous commit in a worktree (144/152 steps, identical).

Decision (rule 9 of the owner's decomposition framework): the remaining `InventoryCommandService` interprets
player inventory actions into equipment, assembly and loadout transactions that share one core
(`#equipRootWithinTransaction`, `#validateEquipment`, `#findEquipmentSlot`); it is not split further only because
of its size. SC-002's "~400 lines" target therefore does not apply to it.

## Phase C — Acceptance and closure
- [x] C0 Drop the "V2" naming (owner request); the save key `fishing_game_player_inventory_v2` stays.
- [x] C1 Full checks (36/36), digest, guard, fresh clone + `npm ci`, browser smoke of both pages.
- [x] C2 Release 0.29.0 (`88576a4`), tags `v0.29.0` and `stage7-closed`.
