# Research: Live Bait and Aquarium

**Date**: 2026-10-11. Read-only inspection of current checkout; no implementation checks claimed.

## Catch outcome

**Decision**: Add a third action at the existing victory gesture/layout/render seam and commit disposition only on an accepted action.  
**Evidence**: `VictoryState.handleInput` currently transitions to scouting for both Claim and Release; `VictoryActionGestureResolver` recognizes two rectangles. The caught fish is available as `data.fish`.  
**Alternative considered**: Saving on victory entry would claim released fish and could repeat after re-entry.

## Fish and bait ownership

**Decision**: Maintain one owned fish record outside equipment inventory, with a `hook` disposition and read-only bait candidate. First implementation supports one live bait on one compatible free hook.  
**Evidence**: Inventory locations are closed to INVENTORY/ATTACHED/LOADOUT and its snapshot mapper allowlists fields. `WaitingState` reuses bait candidates; `BaitEffectivenessResolver` reads target fish `baitMultipliers`. `PlayingState.enter` consumes the first hook bait, but the bite match does not carry an instance ID.  
**Alternative considered**: A second writable bait item plus aquarium record duplicates identity. Expanding inventory locations or multi-hook selection now would require broader behavior/save changes.

## Source fish movement

**Decision**: Run a separate per-hook `FishBehavior` from source species physics and scale each state's output with one configured reduction coefficient; keep it out of hooked wild-fish combat.  
**Evidence**: `crucian_stalker` has `physics.movementProfile` and `physics.behaviorProfile.behaviors`. `FishBehavior` exposes state/motion data; `BaitFactory` builds tackle entities. `getStateData()` allocates, so the hot path needs a reused lightweight output.  
**Alternative considered**: A copied bait state table would drift from the fish catalog. A full `Fish` instance would pull in force/stamina/debuff behavior irrelevant to bait.

## Time and persistence

**Decision**: Store sampled remaining life, feed fraction, and last applied real time in a separate versioned local snapshot. Settle elapsed time at discrete boundaries.  
**Evidence**: Existing bait freshness decays on in-water exposure and cannot model death while pages are closed. Inventory uses schema 4 at `player_inventory_v2`; cloud progress v1 in spec 029 includes inventory and location chum only.  
**Alternative considered**: A UI countdown or implicit inventory-v4 extension would lose life facts or force a broad save migration.

## House and navigation

**Decision**: Preserve and complete the untracked house scaffold, add DEV navigation through development composition, and update page/release guards.  
**Evidence**: House HTML/presenter exist but are untracked; its entry imports a missing startup, and its CSS and art at the paths named by HTML are absent. The owner's named images are present as untracked root files; the aquarium PNG has transparency. Architecture/release scripts enumerate older pages.  
**Alternative considered**: Treating the scaffold as completed would ship a broken page; production importing DEV would reverse dependency direction.

## Capacity and economics

**Decision**: Use the owner-provided capacity table verbatim and present acquisition/upgrades as Free.  
**Rationale**: The informal progression formula does not generate the jumps at levels 5 and 10. No wallet or payment system is in scope.  
**Alternative considered**: Deriving capacity from the prose formula would contradict explicit values.

## Owner shared-feed revision (2026-10-12)

The shared aquarium record removes species-slot priority. Stable episode seeds and per-fish deadlines allow pure display projection and offline settlement without rerolling. Existing fish art provides individual skins; reduced derivatives avoid loading 2700 px assets for tiny sprites. The conversion utility previously compressed images but had no resize mode, so --thumbnails adds explicit bounded resizing without touching originals. Legacy special status was absent from snapshots; retaining unknown as null and separating those cards avoids an invented ordinary classification.
