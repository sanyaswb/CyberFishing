# CyberFishing changelog

## v0.23.44 - Embedded Float Ballast

### Fixed

- Removed the standalone `sinker_light` item, its inventory category entry, its default/debug instances and the float-rig sinker slot.
- Moved the former light/medium/heavy sinking profile, sinking reference depth and current compensation into the float configuration.
- Added a dedicated `feederRig` equipment slot for feeder springs while preserving feeder physics, hook capacity, chum support and automatic bottom-depth behavior.
- Updated casting, rendering, equipment loss and inventory UI paths to distinguish floats from feeder rigs.
- Added save migration that moves legacy feeder springs from `sinkerId` to `feederRigId` and discards obsolete standalone sinker instances.
- Renamed the surface-depth fallback to remove the obsolete sinker dependency from runtime terminology.
- Added regression checks for embedded float ballast, preserved feeder parameters and legacy inventory migration.

## v0.23.43 - Float Depth Line Budget

### Fixed

- Changed the float-rig depth selector trigger from the sinker to the equipped float.
- Derived maximum float depth from equipped line length minus rod length.
- Reduced float cast distance and fight radial line limit by the selected depth while preserving the full cast at the `0.1m` surface preset.
- Added a live cast-distance bar that grows or shrinks with the selected depth and respects the location height limit.
- Allowed an equipped float to reach the selected depth without requiring a separate sinker; an equipped sinker still controls its sinking profile.
- Kept feeder rods on automatic bottom depth without reducing their cast distance.
- Added regression checks for pole, reel-float, float-without-sinker and unchanged feeder scenarios.

## v0.23.42 - Tackle-Aware Rod Stroke

### Fixed

- Changed pole-rod stroke capacity to use the full equipped line length.
- Kept reel-equipped rod stroke capacity tied to the physical rod length.
- Added a dedicated rod-stroke capacity resolver and passed the active line-system state into the pull system.
- Added regression checks for a 5m pole rod with 10m of line and a 3m reel rod with 10m of line.

## v0.23.41 - Rod-Length Line Reserve

### Fixed

- Changed the minimum line requirement to two rod lengths: one along the rod and one as casting reserve.
- Changed 5m pole rods to equip exactly 10m of line and cast up to 10m.
- Disabled the legacy fixed `+1m` pole-rod allowance through the physics configuration.
- Changed reel rods to fill up to reel capacity only when the reel can hold the two-rod-length minimum.
- Added regression checks for 5m pole rods, 3m rods with 10m reels, and rejection of 10m reels on 6m rods.

## v0.23.40 - Build-Aware Line Segment Reconciliation

### Fixed

- Fixed detached fishing line segments not merging back into their source spool when equipment was removed through rod, reel, build-switch, compatibility, or other cascade paths.
- Added build-aware line merging so exact-source and fallback reconciliation cannot merge line segments across equipment builds or into the general inventory.
- Preserved real line losses when returning equipped line segments to inventory.
- Made build switches and rod-type replacements persist once and emit one `inventory-changed` event per operation.
- Added regression checks for direct and cascade unequip, build switching, cache reload, fallback matching, line loss, and repeated equip cycles.

## v0.23.39 - Rod Control Hold-Style Force

- Changed Rod Control X force to use the available player tension budget, similar to Rod Hold, instead of a fixed `rodControl.force.maxForceKg` cap.
- Removed fish-weight force division from Rod Control X so fish weight no longer silently reduces lateral force through `fishWeightResistanceMultiplier`.
- Added `RodControlAngleResolver` as the single source for Rod Control line angle and angle ratio calculation.
- Reduced the full-force Rod Control angle from `45°` to `20°`.
- Changed the HUD Rod Control bar to show raw control input while the label also shows delivered lateral tension.
- Exposed the configured full-force angle in the Rod Control geometry debug section.
- Cleaned the unused Rod Control fish-weight input and removed direct drag reserve cutting from the control channel.

## v0.23.37 - Player Reel Fatigue Debug Alignment

- Aligned Player Reel Fatigue debug and HUD fallback mode with the new `reel_hold_session` source.
- Added explicit debug aliases for ReelHold capability state: `reelHoldActive`, `reelHoldEngaged` and `reelHoldRecoveringLine`.
- Improved overlay separation between Player Reel Fatigue Session and ReelHold Pull Capability.
- Documented fight lifecycle handling for the session latch and reset it explicitly on new fight start/end paths.
- Added regression coverage for reel hold session source consistency and debug alias presence.

## v0.23.36 - Player Reel Fatigue Session Latch

- Added `PlayerReelFatigueSession` to separate player reel fatigue session state from per-frame reel hold pull capability.
- Changed Player Pressure Fatigue source mode to `reel_hold_session` so stroke drops, drag slip and load blockers no longer restart grace or start recovery.
- Added `reelHoldCanPull`, `reelHoldBlockedReason` and player reel fatigue session debug fields.
- Added regression coverage for stroke drop, drag slip, drag/reel limit blockers, release recovery and release during grace.

## v0.23.35 - Reel hold debug speed

- Made `reelHoldAppliedSpeedMps` use the real frame `dtSec` passed into the debug snapshot.
- Added reel hold debug fields for previous-frame movement state and current-frame calculated state.
- Exposed reel hold movement dt and previous/current engagement states in console diagnostics.
- Added regression coverage for reel hold applied speed.
