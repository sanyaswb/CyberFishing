# Feature Specification: New player's inventory without the legacy conversion

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: save compatibility (owner decision 2 in
[follow-up decisions](../029-backend-foundation/follow-up-decisions.md)), same save bytes

## Problem (verified)
A new player's starting inventory came from the legacy path:
1. `LegacyInventorySaveSource.load()` fell back from the missing classic keys to `CONFIG.player`.
2. It created items with `InventoryItemFactory` and seeded configured items and build templates.
3. `InventoryLegacyMigration` (1,199 lines, with `LegacyItemStateMigration`) converted the result into schema 4.

Retiring the legacy classes would therefore also break a new player's start. The legacy source was also loaded on
every startup, even when a current save existed and its result was unused.

## Solution
- `StartingInventorySnapshotFactory` (`game/application/inventory/persistence`) builds the schema-4 snapshot
  directly.
  - It lays the configured items into a `FlatInventoryItemRepository` with the inventory location.
  - Assemblies, equipment and loadouts are empty; settings and refill memory come from `AutoRefillSettings` and
    `AutoRefillMemory`.
  - Serialization reuses the current `InventorySnapshotFactory` and `InventoryItemSnapshotMapper`.
  - Starting equipment and build templates are rejected with a clear error (both are empty in the configuration);
    they are not silently dropped.
- `InventoryCompositionRoot` accepts `startingStateProvider`. It is read only when neither a current nor a
  previous-schema save exists, and it is tried before the legacy conversion.
- Player composition passes two lazy providers:
  - the starting state, when `LegacyInventorySaveSource.hasSave()` finds no classic key;
  - the legacy state, loaded only when a classic save is converted.

  The legacy classes stay for classic saves, and that code is unchanged. Removal policy is unchanged: no date, and
  not before the cloud import is verified.

Not observable: migration warnings were never consumed. A classic save is no longer read when a current save
exists, so a corrupt classic key no longer logs a read warning there.

## Evidence
- Checks: Architecture 2/2, Quick 13/13, Full 38/38; save round trips byte-identical.
- Game-cycle digest unchanged: `7b9baea3…ed5b6`.
- Production 465 → 466 modules, 703 → 712 imports.
- A new player's save is byte-identical to the former legacy conversion. This was checked against a dump taken
  before the change (3,488 bytes) and is now pinned by the player inventory check, which compares it with the
  conversion of the same configuration forced through a classic key.
- The player inventory check also covers: only the current save is written, starting equipment is rejected, and
  settings are normalized.

Browser smoke by Claude in the desktop browser pane:
- On the `127.0.0.1:4173` origin, index.html left only `fishing_game_player_inventory_v2` (schema 4, 20 items,
  nothing equipped) and the inventory shows 20 cards.
- On `localhost`, dev.html loads the existing save with 20 cards.
- 0 errors on both.
