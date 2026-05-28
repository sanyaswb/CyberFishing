# CyberFishing changelog

## v0.19.10 - fish tension separation

- Fixed fish tension so it stays based on `fishOppositionKg` instead of dropping to `dragBlockedForceKg` when player hold wins.
- Kept `fishWonForceKg` as the escape-speed and drag-slip source only.
- Added a regression check for the hold-wins case where fish escape force is zero but total tension remains fish opposition plus player hold tension.
- Updated formula docs so `totalTensionKg = fishTensionKg + playerHoldTensionKg`.

## v0.19.9 - drag debug cleanup

- Removed legacy drag read-model fields from `PlayerForceSystem` and fight debug output.
- Kept `PlayerForceSystem` responsible for player force context plus drag limits only.
- Changed `shouldSlipDrag` debug source to come from the resolved drag calculation path.
- Replaced the fish speed diagnostic's old effective drag ratio output with fish-won Y, blocked drag, excess Y and final Y speed fields.

## v0.19.8 - fish-won drag model

- Added `DragForceCalculator` to share the fish-won-force drag split between escape speed and tension.
- Changed fish escape speed to use `fishWonForceKg = max(0, fishOppositionKg - effectiveRodHoldKg)` instead of any total tension value.
- Changed Y drag to split fish-won force into blocked drag force and excess escape force.
- Added resolved drag tension diagnostics for blocked drag force and player hold tension.
- Added debug/formula fields for fish-won force, fish-won Y force, blocked drag force and excess Y force.
- Guarded open drag so 0% drag has no excess force/speed and cannot double-count fish-won speed.
- Changed Y drag projection to use the normalized movement Y component, so 45 degree movement contributes about 0.707 instead of 0.5.

## v0.19.7 - authoritative fight movement

- Removed agility-based velocity approach from `FightPhysicsSystem`; agility now smooths fish behavior state transitions only.
- Added `WaterEntity.applyHookedFightMovement()` so hooked fight movement uses the simplified model target velocity directly.
- Bypassed generic WaterEntity velocity damping for hooked fight movement; `physics.water.motionResistance` and reel drag remain the official movement limiters.
- Added fight movement debug fields for target speed, actual speed and damping state.
- Updated `fish-speed-delta-check.js` so actual coordinate speed must match model speed at drag 0 when the line is unconstrained.

## v0.19.6 - fight diagnostics and landing fixes

- Added landing lift tension so real fish weight transfers into tension only while holding in the landing zone.
- Added catch-resolution console diagnostics with landing reason, lift state, rod hold, tension and stress values.
- Changed lastDash trigger checks to use a horizontal landing zone by default instead of radial distance.
- Kept movable hold tension cap active when rod stroke is full; only real movement blockage disables the cap.
- Removed the reelHold post-stroke delay and gated reelHold by full rod stroke plus safe drag/load reserve.
- Added `check:fish-speed` with `fish-speed-delta-check.js` to compare actual coordinate speed against overlay model speed.
- Stabilized the fish speed diagnostic by normalizing behavior multipliers, disabling lastDash and warming up behavior state before measuring.

## v0.19.5 - production simplified fight cleanup

- Removed unused legacy fight helper files for pressure transfer, water-drag retrieve resistance and dynamic motion load.
- Kept `physics.retrieve` only for lure/pole/bite gameplay, not fight tension.
- Cleaned `FightPhysicsConfigAdapter`, `FishRetrieveResult`, overlay/debug rows and docs around the simplified model.
- Updated formula documentation to describe passive fish force, active fish force, rodHold, movable tension cap, stress and reelHold.
- Reduced active JavaScript file count and removed dead script tags from `index.html`.

## v0.19.4 - final reelHold simplified model

- Kept reelHold as a separate post-stroke recovery channel instead of mixing it into rodHold force.
- Removed old fish resistance/retrieve profile data from presets and predator species.
- Cleaned the active fight config so the old pressure-transfer, retrieve water-drag and dynamic relative-speed force groups are no longer stored in global fight physics.
- Updated FishPhysicsProfile runtime normalization to focus on forceProfile, staminaProfile, movementProfile and behaviorProfile only.
- Reworked golden/fight/rod tests to cover the final simplified formulas and the small-fish movable tension cap.
- Updated overlay metric formulas to describe the simplified model and reelHold breakdown.
- Updated validation labels for rodHold/reelHold config leaves.

## v0.19.3 - crucian simplified fish profile

- Cleaned `crucian_stalker` fish physics for the simplified fight model.
- Removed legacy `minPowerRatio`, `maxSpeedMetersPerSec`, resistance, retrieve and behavior ratio aliases from the crucian profile.
- Relaxed fish config validation so legacy resistance/retrieve profile fields remain optional compatibility data.

## v0.19.2 - movable hold tension cap

- Added `physics.fight.tension.movableHoldTensionCapRatio`.
- Capped player hold tension by `fishPassiveKg * movableHoldTensionCapRatio` while the fish can move toward the player.
- Kept full raw hold tension when movement is blocked, so constraints can still create line-break risk.
- Exposed raw hold tension and movable cap values in fight debug/overlay formula data.

## v0.19.1 - tension overlay breakdown

- Added explicit tension breakdown fields for fish tension, player hold tension and total tension.
- Added rod, line and hook stress ratios to tension/debug data.
- Added hook max-load support with an open-ended fallback when hook load is not configured.
- Reworked fight overlay into Fish, Player, Movement and Tension sections for the simplified model.
- Updated overlay metric inspector entries for the simplified fight formulas.

## v0.19.0 - simplified fight pipeline

- Removed the old pressure-transfer retrieve model from the active fight pipeline.
- Fish force now uses passive body resistance plus active state/direction force without relative-speed dynamic force.
- Rod hold now charges from zero to `rodLimitKg - fishTensionKg`.
- Effective rod hold works against fish movement while `holdTensionRatio` controls only the hold contribution to tension.
- Final tension now comes from fish tension plus player hold tension.
