# Tasks: Inventory decomposition

Each task: implement → focused check → `npm run check` → game-cycle digest → guard → commit.

## Phase A — InventoryManager
- [ ] A1 `TackleLoadLimitPolicy` (domain) with the exact `getMaxTackleLoadKg` formula; manager delegates.
- [ ] A2 `RodCastDisplayStatsWriter` + `ROD_CAST_DISPLAY_LABELS` (presentation), injected by bootstrap.
- [ ] A3 `LegacyInventorySaveSource`: legacy cache keys, id/equipment migration, configured seeding.
- [ ] A4 `InventoryItemViewContext`: reel config, line-capacity context (legacy snapshot, preserved), freshness.
- [ ] A5 `PlayerInventory` composed in bootstrap; delete `InventoryManager` and V1-only classes; migrate tests
      (`inventory-lifecycle` legacy-save scenario via V2, `cast-and-lure`/`freshness` source assertions).
- [ ] A6 Browser smoke (inventory open/equip/reload) and commit.

## Phase B — InventoryV2CommandService
- [ ] B1 `inventoryCommandSuccess/Failure` shared builders.
- [ ] B2 `InventoryItemRemovalService` (consume within transaction, subtree removal, loadout release, root clear).
- [ ] B3 `InventoryV2GameplayCommands` (consume*, breakEquippedLine, rodRetrieved, handChumUsed, boatReturned);
      gameplay bridge uses it.
- [ ] B4 `InventoryV2UiState` owns navigation state; command service uses it.

## Phase C — Acceptance and closure
- [ ] C1 Full checks, digest, guard, fresh clone + `npm ci`, browser smoke of both pages.
- [ ] C2 Release 0.29.0 (CHANGELOG, version pins), tag `v0.29.0` and `stage7-closed`, update docs/architecture.md.
