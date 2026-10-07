# Implementation Plan: Inventory decomposition

**Spec**: [spec.md](spec.md) · **Rules**: `DEVELOPMENT_RULES.md`, `docs/architecture.md`

## Technical context
Native ESM, no build. Layers per `utils/architecture-check.js`. Evidence per step: focused checks, `npm run check`,
game-cycle digest, architecture guard, browser smoke at the end of each phase. One commit per step.

## Constitution check (DEVELOPMENT_RULES)
- One responsibility per module, constructor injection, bootstrap is the only composer → `PlayerInventory` is
  composed in `bootstrap/production/inventory_composition_root.js`, not inside the class.
- Domain/Application never touch browser globals → unchanged (guard enforces).
- Player-facing text → presentation catalog injected (rod cast labels).
- Behavior preservation over cleanup → the stale line-capacity context is preserved and reported.
- No hot-loop allocations added: `getEquipped()` keeps its cache; the display-stat writer runs only on cache misses.

## Target structure

```text
src/game/domain/equipment/tackle_load_limit_policy.js            # getMaxTackleLoadKg formula (pure)
src/game/presentation/inventory/rod_cast_display_labels.js       # player-facing labels
src/game/application/inventory/rod_cast_display_stats_writer.js  # writes rod display stats + maxDistance
src/game/application/inventory/persistence/legacy_inventory_save_source.js  # legacy keys + migration + seeding
src/game/application/inventory/inventory_item_view_context.js    # runtime context for item views
src/game/application/inventory/player_inventory.js               # gameplay port over Inventory V2
src/game/application/inventory/inventory_ui_state.js             # UI navigation state
src/game/application/inventory/inventory_gameplay_commands.js    # gameplay-driven commands
src/game/application/inventory/inventory_item_removal_service.js # consume/remove/release helpers
src/game/application/inventory/inventory_command_result.js       # success/failure builders
src/bootstrap/production/inventory_composition_root.js           # + PlayerInventory composition
```

Deleted: `inventory_manager.js`, `inventory_equipment.js`, `equipment_validator.js`, `line_inventory_controller.js`
(and the V1-only scenarios of `inventory-lifecycle` / `line-allocation` checks, whose V2 equivalents live in the
`inventory-v2-*` checks).

## Phases
- **A — InventoryManager** (A1 domain policy, A2 rod display stats + labels, A3 legacy save source,
  A4 item view context, A5 `PlayerInventory` + bootstrap composition + V1 removal + test migration).
- **B — InventoryV2CommandService** (B1 result builders, B2 item removal service, B3 gameplay commands,
  B4 UI state).
- **C — Acceptance**: full checks, digest, guard, fresh clone, browser smoke; release 0.29.0; tag `stage7-closed`.

## Risks
- Startup order: legacy source must run before V2 composition, and the view factory needs the view context
  before V2 exists → view context is created first and receives providers later (same as today's closures).
- Tests that construct `InventoryManager` or read its source text must move to the new modules without losing
  assertions about production behavior.
