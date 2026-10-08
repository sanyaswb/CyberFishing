# Feature Specification: Names follow responsibilities; files follow classes

**Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Approved by owner (chat, 2026-10-08) · **Kind**: structural, no behavior change

## Problem (verified)
- 29 modules export a class whose name differs from the file (`UIManager` in `game_controls.js`, `DragSystem` in
  `drag_control_service.js`, `StaminaController` in `stamina_system.js`, 9 DEV overlays without "Overlay", ...).
- 7 classes use catch-all names (`*Manager`, `*Utils`): `UIManager`, `InputManager`, `CacheManager`,
  `ChumManager`, `CastManager`, `LocationManager`, `UIUtils`.
- Two "ports" are adapters (`InventoryEquipmentTransitionPort extends EquipmentTransitionPort`).
- Some files hold unrelated classes (`game_world_service.js`: location selection, environment simulation and the
  game world; `bite_service.js`: bite system and the recast penalty).
- `ChumController` (578 lines of chum aiming/boat control) lives in `bootstrap/` and constructs its platform UI
  itself; bootstrap must only compose.

## Requirements
- **FR-001** Rename classes and files so each class name states its responsibility and each file is named after
  its (main) exported class; no `Manager`/`Utils`/`Helper` class names.
- **FR-002** Split files whose classes have different responsibilities; class bodies move byte-for-byte.
- **FR-003** Move `ChumController` to `game/application/chum/`; bootstrap injects its UI.
- **FR-004** Architecture guard enforces: a module exporting classes is named after one of them; no class name ends
  in `Manager`, `Util(s)` or `Helper(s)`. Negative fixtures for both.
- **FR-005** No behavior, save, timing or DOM change (console diagnostic prefixes follow class renames).

## Acceptance
All checks; game-cycle SHA256 unchanged (`7b9baea3...d5b6`); guard with new rules; browser smoke of both pages.
