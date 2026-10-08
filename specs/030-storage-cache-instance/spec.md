# Feature Specification: LocalStorageCache is an instance over injected storage

**Created**: 2026-10-09 · **Status**: Implemented · **Kind**: platform composition, same behavior

## Problem (verified)
`LocalStorageCache` was a class with static methods over the global `localStorage` and `console`. Composition
passed the class object itself as `cache`, `InventoryCompositionRoot` fell back to it twice, and DEV tools
(`DevTools`, `DevToolsUI`, `OverlayWindowDragController`) imported and called it directly.

## Solution
- Instance methods (`get`, `set`, `remove`, `clearAll`, `printStorageUsage`) over a constructor-injected `storage`
  and `logger`; key prefix, JSON bytes and warning texts unchanged.
- `GameCompositionRoot` creates one over `windowTarget.localStorage` with `ConsoleLogger` and passes it to the
  inventory, game controls and chum service. `InventoryCompositionRoot` no longer falls back to a global.
- Development startup creates one for DEV window positions and section states and passes it to the overlay drag
  controller, `DevTools` and `DevToolsUI`.

## Evidence
38/38 checks (platform check: same prefix, JSON bytes, read fallback with one warning, `clearAll` keeps foreign keys);
game-cycle digest unchanged; guard (production imports 703 → 702). dev.html: DevTools section state persists, storage
report printed, 0 errors; index.html: inventory loads from the save, 0 errors.
