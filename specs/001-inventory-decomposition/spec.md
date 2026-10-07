# Feature Specification: Inventory decomposition (Stage 7 final step)

**Feature Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Implemented (see tasks.md); class names below predate the removal of the "V2" marker
**Input**: "Розподіл InventoryManager (~1400 рядків: сховище предметів, екіпірування і форматування характеристик
для показу) та InventoryCommandService (~1300) — останній великий крок перед релізом і тегом закриття Stage 7."

## Context (facts verified in code, v0.28.0+)

- Production constructs `InventoryManager` at exactly one site (`game_composition_root.js`) and always passes
  `composeInventoryV2`. Every public method therefore runs its Inventory V2 branch; the classic (V1) item store,
  equipment state, build boxes, cascades, line splitting and V1 hydration run only in the test
  `inventory-lifecycle` (constructed without `composeInventoryV2`).
- In production the V1 store is used only at startup: legacy save keys `player_inventory`/`player_equipment` are
  migrated (`InventoryItemIdMigrationPolicy`, `EquipmentStateMigrationPolicy`), configured items are seeded, and
  the result is handed to Inventory V2 as `legacyItems`/`legacyEquipment` (consumed only when no V2 save exists).
- `InventoryManager` also: guards UI actions while tackle is in the water (lock), emits `inventory-changed`,
  caches the equipped read model and writes rod cast-distance display stats with Ukrainian labels into it,
  computes the tackle load limit, feeds runtime context (reel config, line capacity, freshness exposure) to item
  views, and refreshes item data.
- `InventoryV2CommandService` mixes (a) inventory UI navigation state (open, category, filters, sort, selection,
  highlighted slot, panel mode, placement order), (b) player commands that interpret UI gestures, and
  (c) gameplay-driven commands (consume, line break, auto-refill after retrieve/hand chum/boat return).

## User Scenarios & Testing

### User Story 1 — Player inventory behaves exactly as before (Priority: P1)
A player opens the inventory, equips/unequips items, builds assemblies and loadouts, fishes (bait/chum
consumption, line breaks, auto-refill) and reloads the page; everything works and saves as before.

**Independent Test**: all inventory, items and gameplay checks pass unchanged in meaning; game-cycle stdout
SHA256 stays `7b9baea38feaa4b550e20bc2d22d5eed7875a8c7fb6f3fdf9e176ddf573ed5b6`; browser smoke of both pages.

**Acceptance Scenarios**:
1. **Given** an existing V2 save, **When** the game starts, **Then** the same items, equipment and settings load.
2. **Given** only a legacy (V1) save, **When** the game starts, **Then** it migrates to V2 exactly as before
   (including the sinker → feeder rig migration and seeded configured items).
3. **Given** tackle in the water, **When** the player tries to change equipment, **Then** the same lock warning
   appears and only the same safe actions (open/close/category/back/auto settings) are allowed.

### User Story 2 — Each responsibility has one owner (Priority: P1)
A developer finds the code for legacy save loading, tackle load limit, rod cast display stats, item-view runtime
context, gameplay inventory port, UI navigation state, player commands and gameplay commands in separate modules
with constructor injection and no hidden composition.

**Independent Test**: architecture guard passes; no module mixes UI state with gameplay commands; player-facing
labels live in presentation.

### Edge Cases
- `crypto.randomUUID` unavailable (insecure context): the timestamp/counter id fallback still produces ids.
- DEV item data edits (`refreshItemData`) still refresh views and reel capacity lookups.
- The stale line-capacity context (it reads the startup legacy equipment, not V2 equipment) is preserved
  byte-for-byte and reported as a pre-existing defect, not fixed here.

## Requirements

### Functional Requirements
- **FR-001**: Remove the V1 runtime paths that production cannot reach (V1 equip/unequip/build/cascade/line
  split/consume/hydration, `equipBuild`, `disassembleBuild`, `equipItem`, `unequipItem`, `removeItem`,
  `validateEquip*`, `getCompatibilityInfo`, `getInventoryItems`, `find*ByType`, the readiness fallback) and the
  classes used only by them (`InventoryEquipment`, `EquipmentValidator`, `LineInventoryController`).
- **FR-002**: Legacy save reading + migration + seeding becomes one persistence module used once at startup.
- **FR-003**: The tackle load limit formula moves unchanged to a Domain policy.
- **FR-004**: Rod cast-distance display stats move to their own writer; labels are a presentation catalog
  injected by bootstrap.
- **FR-005**: Item-view runtime context (reel config, line capacity, freshness exposure) gets one owner.
- **FR-006**: The gameplay inventory port (`PlayerInventory`) keeps the production API used today: `getEquipped`,
  `setLock`/`isLocked`, `inventoryV2Facade`, `dispatchInventoryV2Action`, `setBoatChargeProvider`,
  `setFreshnessExposureProvider`, `setLineCapacityStateProvider`, `handleRodRetrieved`, `handleHandChumUsed`,
  `handleBoatReturned`, `evaluateCastReadiness`, `breakEquippedLine`, `consumeItem`, `consumeHandChum`,
  `consumeEquipped`, `onInventoryChanged`, `refreshItemData`, `dispose`. Bootstrap composes it.
- **FR-007**: `InventoryV2CommandService` keeps UI action dispatch and player commands; UI navigation state moves
  to `InventoryV2UiState`; gameplay-driven commands move to `InventoryV2GameplayCommands`; shared item removal
  (consume within a transaction, subtree removal, loadout release, equipment reference clearing) moves to one
  service; result builders become shared functions.
- **FR-008**: Save format, storage keys, ids, formulas, messages, timing and event payloads stay identical.

### Key Entities
`LegacyInventorySaveSource`, `TackleLoadLimitPolicy`, `RodCastDisplayStatsWriter` (+ `ROD_CAST_DISPLAY_LABELS`),
`InventoryItemViewContext`, `PlayerInventory`, `InventoryV2UiState`, `InventoryV2GameplayCommands`,
`InventoryItemRemovalService`, `inventoryCommandSuccess/Failure`.

## Success Criteria
- **SC-001**: 0 failing checks; game-cycle digest unchanged; architecture guard passes with no new edge type.
- **SC-002**: `inventory_manager.js` (1,406 lines) is deleted; no new module exceeds ~400 lines;
  `inventory_command_service.js` shrinks by the UI-state and gameplay parts.
- **SC-003**: Native `index.html`/`dev.html`: inventory opens, equips, saves and reloads; 0 console errors.
