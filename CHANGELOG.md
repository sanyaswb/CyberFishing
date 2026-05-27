# CyberFishing changelog

## git

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

## v0.18.9 - simple fight force calculator

- Added `SimpleFightForceCalculator` for the simplified fight force model.
- Calculator now returns fish passive force, active force, opposition, rod hold max, hold tension, total tension, net force and movement speed.
- Wired the calculator into browser script loading for the next fight pipeline step.

## v0.18.8 — simplified fight configs

- Added `physics.water` config for passive body resistance, motion resistance and speed multiplier.
- Added `physics.fight.directionForce`, `physics.fight.rodHold` and `physics.fight.tension` config groups.
- Added adapter read APIs for the new simplified fight config groups.
- Added `holdTensionRatio` to rod `engineStats`.
- Added fish profile `movementProfile.baseSpeed` plus behavior `forceMultiplier` and `speedMultiplier` aliases.
- Updated config validation metadata for the new physics leaves.

## v0.18.7 — stamina endurance split

- Split fish condition resources into separate `maxStamina` and `maxEndurance` values.
- Kept endurance on the weight/level formula and derived stamina as `endurance * staminaRatioFromEndurance`.
- Added `CONFIG.stamina.fish.staminaRatioFromEndurance = 0.1`.
- Updated fight force, stamina controller, renderer and debug console reads to use separate stamina/endurance maxima.

## v0.18.6 — stamina weight scaling

- Changed fish stamina to scale from `baseStamina + weightKg * 1000 * level`.
- Removed stamina dependence on fish force `basePower` and `levelBasePower`.
- Added `staminaBossMultiplier` support for last-level fish below their level average weight.
- Passed level average weight into fight setup for generated and fixed debug catches.
- Added fight-system checks for weight/level stamina scaling and boss stamina multiplier.

## v0.18.5 — debug overlay simplification

- Renamed `overlay_devtools_links.js` to `overlay_metric_inspector.js`.
- Removed the unused `overlay_devtools_links_focus_patch.js` file.
- Rendered fight-physics metric buttons directly from `overlay.js` instead of post-render DOM decoration.
- Removed overlay metric `MutationObserver` and global inline-style DOM scans.
- Added semantic debug overlay row/label/value classes and scoped metric button event handling.
- Added overlay HTML caching and configurable `CONFIG.debug.overlayUpdateMs`.
