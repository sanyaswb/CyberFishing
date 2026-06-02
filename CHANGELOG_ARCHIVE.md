## v0.19.14 - spool-based line and Y stroke model

- Added `LineSpoolState`, Y-only rod stroke tracking and tension-based reel auto recovery.
- Changed reel line handling so the equipped line length is the full usable released-line limit.
- Changed rod stroke to track won Y-distance instead of pump credit / recoverable line.
- Kept pump credit as debug-only diagnostics and stopped it from resetting stroke.
- Updated fight overlay and checks for line spool, rod stroke and auto recovery fields.

## v0.19.13 - line and rod stroke visibility

- Added `LINE` overlay rows for fish distance, released line, remaining line, recoverable line and per-frame release/recovery.
- Added `ROD STROKE` overlay rows for stroke capacity, used/unrecovered stroke, pump credit and reset/sync reasons.
- Added rod stroke diagnostics for reel recovery and pump-credit synchronization.
- Added documentation for the line/stroke debug model.
- Kept drag threshold Y logic and simplified fight force formulas unchanged.

## v0.19.12 - drag threshold Y model

- Changed reel drag from percentage Y-speed slowdown to a force threshold.
- Y movement now starts only from fish-won Y force above `dragLimitKg`.
- Open drag blocks no Y force and keeps full fish-won Y speed.
- If line reserve is exhausted, Y escape is blocked and all fish-won Y force becomes line load.
- Added `DRAG / Y ESCAPE` overlay rows for drag limit, fish-won Y force, blocked force, escape force and final Y speed.
- Updated golden checks and formula docs for the threshold drag model.

## v0.19.11 - opposition-based movable hold cap

- Changed `movableHoldTensionCapKg` to scale from `fishOppositionKg` instead of passive fish water weight.
- Kept `rawPlayerHoldTensionKg`, `effectiveRodHoldKg`, `netForceKg` and drag Y logic unchanged.
- Added golden coverage for active opposition cap, small movable fish protection and blocked fish full hold tension.
- Updated overlay/formula docs and parameter metadata for the new cap source.

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
- Added movable player hold tension cap while the fish can move toward the player.
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

## v0.18.4 — overlay desktop click fix

- Integrated the desktop hover/click fix directly into `overlay_devtools_links.js`.
- Overlay metric buttons now inspect on `pointerdown`, so frequent overlay redraws cannot swallow the click.
- Removed hover style changes that caused visual flicker under the mouse cursor.
- Increased the button hit area to a stable 14x14 square without changing overlay layout.

## v0.18.3 — overlay console formulas

- Simplified overlay metric buttons: they now print formula details to the browser console instead of trying to control DevTools DOM focus.
- Added console tables with influencing `CONFIG.*` and `HOOKED_FISH.*` paths plus current runtime values.
- Kept the small overlay square buttons, but removed the fragile DevTools navigation behavior from the bridge.

## v0.18.2 — clean overlay DevTools paths

- Added stable `data-devtools-path` attributes to DevTools sections, rows and labels.
- Updated overlay link navigation to focus exact DevTools paths first instead of relying on truncated labels.
- Removed the need for the runtime `overlay_devtools_links_focus_patch.js` workaround.

## v0.18.1 — overlay DevTools links

- Added small overlay link buttons before supported debug metric labels.
- Buttons open DevTools and focus the related config/runtime parameter.
- Metrics with multiple influencing parameters cycle through those paths on repeated clicks.
- Focused DevTools rows pulse with a white highlight to guide the developer's eye.

## v0.18.0 — scaling configs

- Split `FISH_DB` into fish category files while preserving the public `FISH_DB` global.
- Added reusable fish physics presets and profile factory helpers.
- Added runtime config override store, export/import/reset support and immutable `BASE_CONFIG`.
- Routed DevTools CONFIG edits through runtime overrides instead of mutating the base config.
- Replaced vague passive retrieve naming with `passiveRetrievePowerRatio`.
- Removed `Infinity` from item config in favor of explicit open-ended ranges.
- Added fish DB structure and config override checks.

## v0.17.5 — architecture cleanup

- Split fight physics math into dedicated calculator classes.
- Added explicit FightPhysicsPipeline frame order for fight updates.
- Routed FishForceSystem, FishPullResistanceModel and TensionSystem through calculators.
- Started removing temporary fish physics compatibility aliases from runtime reads.

## v0.17.4 — safe balance

- Added project version source of truth and in-game version badge.
- Added config schema validation utility.
- Added headless balance simulator utility.
- Added physics units and naming convention documentation.

## v0.17.3 — physics transparency

- Added physics formula map.
- Grouped debug overlay by cause/effect blocks.
- Added golden tests for key formulas.
