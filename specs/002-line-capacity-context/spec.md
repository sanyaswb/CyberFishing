# Feature Specification: Line capacity follows the current equipment

**Branch**: `develop` · **Created**: 2026-10-08 · **Status**: Approved by owner (chat, 2026-10-08) · **Kind**: behavior fix

## Problem (verified)
`InventoryItemViewContext` builds the line-capacity context of item views from the equipment of the *legacy save
that seeded the inventory at startup* (`player_equipment.lineId/reelId`). The fight reports the live line state
with the current inventory id (`FishingRuntimeServices.getLineCapacityState().lineInstanceId`).
`ItemCapacityResolver` treats a line as "equipped in the reel" only when its id equals
`equippedLineInstanceId`, so for every player with a current save the equipped line never matches:
- the capacity bar of the equipped line shows the spool length, not the reel capacity;
- during a fight it never shows the live remaining length ("active_reel").

## Requirement
- **FR-001**: `equippedLineInstanceId` is the line attached to the currently equipped reel (or, without a reel,
  the equipped terminal line); `reelCapacityMeters` is the equipped reel's effective `lineCapacityMeters` (the value the fight, landing
  and casting rules use; `lineCapacityMeters` is not an instance override stat, so the old `statOverrides` branch
  never applied to current items); `activeState` unchanged.
- **FR-002**: The context reads the live inventory equipment state each time (no snapshot); the legacy save is only
  used for the one-time migration.
- **FR-003**: Before the inventory is composed the context reports no equipped line (no crash).

## Acceptance
- A test equips a reel with a line and proves the line's view context carries the reel capacity and, with a live
  fight state, the active remaining length; unequipping clears it.
- All checks pass; game-cycle output unchanged (it does not render item views); browser smoke.

## Player-visible change
The equipped line's "remaining line" bar uses the reel capacity and, during a fight, the live remaining length.
