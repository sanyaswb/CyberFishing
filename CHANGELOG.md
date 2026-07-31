# CyberFishing changelog

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
