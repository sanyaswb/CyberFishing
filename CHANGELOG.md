# CyberFishing changelog

## v0.23.50 - Anomaly-Driven Unique Fish

### Added

- Added a species-level `anomalyVariant` policy with its own chance, anomaly identifier and allowed locations.
- Added an independent anomaly roll after a base fish bite and exposed `hasAnomaly` on the caught-fish state.
- Added production checks for every configured level-specific unique fish asset.

### Changed

- A fish is now unique only when it carries an anomaly; weight still determines its level and star rarity but no longer decides uniqueness.
- Routed anomalous crucian-stalker catches to `crucian_stalker--{level}-uniq.webp`, including all six weight levels.
- Kept fixed catches and live DevTools edits synchronized through the same anomaly, rarity and image resolvers.
- Removed the obsolete `rarityProfile`, `uniqueAtHalfSteps` and `uniqueAnomalyId` implementation instead of retaining a compatibility branch.

### Tests

- Added regressions for exact anomaly chance boundaries, location restrictions, ordinary maximum-weight fish, anomalous level-six fish, all six fixed-catch skins and live DevTools anomaly toggles.

## v0.23.49 - Rarity Architecture Completion

### Added

- Added mandatory startup validation for the production rarity scale, fish database, rarity profiles, weight ranges, visual effects and color stops.
- Added a standalone production rarity check and regressions for unreachable unique thresholds, incorrect maximum levels, clamped upper bands, range gaps/overlaps and duplicate/unordered color stops.
- Added `FishVisualVariantResolver` as the single image-selection policy used by regular bites, fixed catches and live DevTools updates.
- Added level-specific unique image routing through `visual.uniqueImagePattern`; crucian-stalker unique files are expected as `crucian_stalker--{level}-uniq.webp` and remain user-supplied.

### Changed

- Moved rarity frame, background, glow, pulse and dash values into `CONFIG.rarity.visual`; Victory now consumes a ready visual descriptor instead of owning rarity values.
- Derived the ordinary maximum color from the penultimate color stop and removed the duplicated `preMaximumPosition` setting.
- Made the rarity scale explicitly immutable until restart and reject invalid scale relations during validation.
- Extracted fixed-catch construction and hooked-fish profile synchronization so all gameplay and debug paths share the same rarity and visual resolvers.

### Fixed

- Prevented species configurations where maximum rarity is unreachable or multiple upper weight bands collapse into the same maximum score.
- Kept unique sprite selection gated by both maximum rarity and the species anomaly policy.

### Tests

- Added coverage for production configuration, unique sprite routing, fixed catches, DevTools weight edits, configurable Victory effects and 6/9/12-level visual scales.

## v0.23.48 - Rarity Domain Hardening

### Changed

- Moved unique-fish eligibility and anomaly selection from `visual` into a species `rarityProfile`.
- Restricted unique state, golden animation and the `inside` anomaly to an explicit maximum `12/12` rarity result; a non-maximum level-6 fish is no longer unique.
- Added optional `visual.uniqueImagePath` support while retaining the level image when no dedicated asset exists.
- Replaced duplicated Victory colors with a shared six-stop rarity palette and normalized interpolation for arbitrary level counts such as 5, 6, 9 or 12.
- Extracted star rendering and rarity pulse calculation from `VictoryRenderer`; normalized star geometry is now cached outside the render loop.
- Renamed the domain maximum marker from `isCrown` to `isMaximum`.

### Fixed

- Removed Victory's inaccurate rarity fallback calculation when weight-range data is unavailable; missing domain rarity now produces an explicit unknown descriptor.
- Fixed the five-level Victory gradient so levels 4 and 5 no longer share the same red color.
- Added rarity configuration validation for scale consistency, color stops, unique profiles, sequential levels and gram-normalized range gaps or overlaps.

### Tests

- Added regression coverage for non-maximum level-6 fish, unique anomaly/image routing, Victory rarity transfer and unknown fallback, 5/6/9/12-level gradients, and invalid rarity configurations.

## v0.23.47 - Gap-Safe Fish Rarity Resolution

### Fixed

- Centralized fish level, unique-state and rarity classification in `FishRarityResolver`.
- Normalized configured weight boundaries to integer grams so decimal gaps such as `0.250–0.251kg` cannot fall through to the maximum level.
- Fixed a `0.2505kg` crucian-stalker resolving as level 6, unique and using the level-6 image; it now resolves as level 2 with the level-2 image.
- Removed the duplicated level-by-weight algorithms from normal bite generation and debug fixed catches.
- Routed live DevTools weight edits through the same resolver and kept level, rarity, unique state, anomaly and image path synchronized.
- Made invalid weights fall back safely to the first level instead of producing a unique maximum-level fish.

### Tests

- Added direct resolver and full `BiteSystem` regression coverage for the `0.2505kg` boundary case.

## v0.23.46 - Fish Rarity Stars

### Added

- Added a fish rarity calculator with 12 half-star steps across six visual stars.
- Split each fish level's gram range into seven equal rarity bands, including derived ranges for species without explicit level ranges.
- Added a dedicated Victory rarity row with half-filled stars, a 12/12 crown and the numeric rarity score.
- Added an animated gold panel, frame and image glow for maximum-rarity anomalous or unique fish.
- Marked the rarest clean crucian-stalker variant with its `inside` anomaly identifier.

### Fixed

- Raised the Victory canvas above every DOM interface layer while the catch result is active.

## v0.23.45 - Inventory One-Click Equip

### Fixed

- Removed rejected-item and rejected-slot highlighting from inventory selection; incompatible items now remain visually neutral.
- Changed the first inventory click to equip immediately when an item has exactly one valid target slot.
- Preserved item selection, second-click auto-equip and explicit slot selection when multiple valid target slots exist.
- Allowed a selected multi-slot item to replace an item in an already occupied compatible slot.
- Added a dedicated equip-target selection policy and regression checks for immediate, multi-slot and rejected-target scenarios.

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
