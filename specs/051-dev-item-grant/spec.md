# Feature Specification: DEV item grant

**Created**: 2026-10-11 · **Status**: Implemented · **Kind**: DEV tool + inventory use case (backlog G-004)

## Problem (verified)
The owner put the sliding float (spec 050) in the item catalog only. No starting inventory, shop or DEV tool could add
a catalog item to the inventory, so catalog-only items could not be tested in game.

## Change
- `InventoryItemGrantService` (application/inventory) adds a new catalog item to the inventory: a fresh instance id,
  the requested quantity, location inventory.
  - The add runs inside the inventory transaction, whose commit saves the inventory, and the facade then announces one
    change.
  - An unknown item id or a quantity that is not a positive integer is rejected without a save.
- `createPlayerInventory` composes the service over the composed repository, transaction, hydrator and instance id
  factory. `PlayerInventory.grantCatalogItem(itemId, quantity)` forwards to it. The tackle lock does not apply,
  because equipment does not change.
- DevTools take an optional `grantCatalogItem` port and render the section "🎁 ВИДАТИ ПРЕДМЕТ": one button per
  catalog item (icon, name, id). It shows `✓×n` after each successful grant and `✗` on a failure.
- `GameCompositionRoot` passes the port with the DevTools options. DevTools are composed only by Development startup,
  so production never calls the grant. Production gets no DEV dependency.

## Evidence
- `player-inventory` check, written first (it failed: `grantCatalogItem is not a function`), now passes:
  - a granted `float_sliding` appears in the view, is saved once in `player_inventory_v2`, announces one
    `inventory-changed` and survives a restart;
  - `bread ×3` keeps its quantity;
  - an unknown id and quantity 0 are rejected without a save.
- Game-cycle report unchanged (`7b9baea3…ed5b6`). Architecture 2/2, Quick 13/13, Full 39/39.
- Browser (Claude, built-in browser, dev.html, 0 console errors):
  - DevTools → "ВИДАТИ ПРЕДМЕТ" lists 25 catalog records; granting the sliding float shows `✓×1` and the float
    appears in the inventory.
  - Equipped on the 5 m bamboo rod with 10 m line, the cast panel reads 10.0 m at depth 0.1/2/5 m with the sliding
    float, and 10.0/8.0/5.0 m with the day float (spec 050 confirmed in game).
