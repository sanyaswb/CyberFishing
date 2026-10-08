# Feature Specification: Remove unreachable item progression UI

**Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Implemented 2026-10-08 (approved by owner in chat) · **Kind**: dead-code removal, same behavior

## Problem (verified)
`ItemProgressionDomAdapter` still carries UI that no code path executes:
- `appendTooltip` (progression section of the detailed tooltip) has no caller; inventory cards use the balance-only
  tooltip (`InventoryTooltipPresenter`), and `inventory-ui-check` already requires that the UI never calls it.
- `updateCapacity` has no caller; it only updates nodes that `appendTooltip` would have created.
- The slot line-capacity bar: `apply` builds it unless `renderCapacityBar === false`, and the only caller
  (`InventoryItemCardRenderer`) always passes `false` (the inventory resource meter replaced it).
- `clear` removes `.inv-slot__quality-bar`, `.inv-slot__rating-bar` and `.inv-tooltip-progression`, which nothing creates.

## Out of scope (reachable, kept)
- The rating-tier badge: `ratingTier` is a config-gated capability (resolver, sort criterion, parameters, validator).
  Production config does not enable it, but a config override does, and the badge then renders.
- `#applyVariables` / `has-item-progression`: they execute on every card with progression. After this removal no CSS
  reads the variables; removing them is a separate decision (recorded in the handoff list).

## Requirements
- **FR-001** Remove `appendTooltip`, `updateCapacity`, the slot capacity bar and the tooltip-only private methods,
  the `renderCapacityBar` option, the labels and CSS rules that only they used, and the dead `clear` selectors.
- **FR-002** Reachability proof: grep of every caller in `src/` and `utils/` (production, DEV, checks).
- **FR-003** Behavior identical: HEAD vs working-tree `apply`/`clear` output identical for the options the card
  renderer passes; game-cycle digest unchanged; css-usage check passes without new allowances.

## Acceptance
All checks; guard; game-cycle digest unchanged; browser smoke (inventory opens, cards render, 0 console errors).
