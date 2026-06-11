## v0.19.35 - Radial fish fight movement

- Replaced hardcoded upward fish escape movement with configurable radial and lateral fight intent.
- Added `FishFightDirectionResolver` to convert line-space intent into a normalized world-space direction.
- Added per-state direction ranges and agility settings for peaceful, predator, and preset fish profiles.
- Refactored drag calculation to affect only outward radial velocity while preserving tangent and inward movement.
- Kept movement inside already released slack line free from drag and added correct taut-boundary prediction.
- Added radial intent, direction, force, and velocity diagnostics to the fight overlay.
- Added config validation and dedicated regression coverage for 2D fish movement and radial drag.

## v0.19.34 - Fixed-length line constraint

- Added an immutable line constraint state that separates drag payout blocking from a physically empty spool.
- Taut Rod Control movement now follows the fixed released-line radius whenever line length cannot increase.
- Rod Control drag protection now reads actual payout capability instead of inferring it from line reserve alone.
- Added `freeReleasedLineMeters` to distinguish movement inside already released line from new spool payout.
- Drag calculations now receive the actual spool reserve instead of a mixed line-absorption flag.
- Fish can move freely inside the released-line radius even with holding drag or an empty spool.
- Frames that reach the released-line radius are split between free movement and drag-resolved movement, preventing overshoot and clamp jitter.
- Drag, payout, and fixed-radius constraints now engage only after the line becomes taut.
- Extended line release diagnostics with explicit `drag_holding` and `spool_empty` reasons.
- Added configuration, debug overlay fields, and regression coverage for locked, slipping, empty-spool, slack-line, and slack-to-taut transition states.

## v0.19.33 - Drag-aware Rod Control tension

- Rod Control X now uses remaining drag tension reserve while drag can release line.
- Opposite-direction tension multipliers are included in the effective lateral force limit.
- Exhausted drag reserve prevents Rod Control from adding lateral tension or fish movement.
- Locked drag and fully extended line still allow Rod Control overload and tackle stress.
- Tackle stress now uses visible clamped tension after successful drag slip while retaining raw tension for diagnostics.
- Added Rod Control drag-reserve and tension stress-source diagnostics.

## v0.19.32 - Direction-aware relative Rod Aim speed

- Merged direction-aware Rod Aim speed with the relative fish-load speed model.
- Moving the rod in the same X direction as the fish now uses `rodAim.returnSpeedMultiplier`.
- Moving against the fish keeps the line-state speed multiplier from tight-line/free-line/drag-slip.
- Added Rod Aim direction-speed diagnostics and regression coverage.

## v0.19.31 - Relative Rod Aim speed

- Reworked Rod Aim weight speed from absolute fish weight to fish load relative to rod/tackle strength.
- Added configurable non-linear Rod Aim speed curve with min/max speed ratios.
- Very light fish now keeps near-base or above-base horizontal rod aim speed.
- Fish close to tackle limit now slows Rod Aim toward the configured minimum speed ratio.
- Added Rod Aim load-ratio diagnostics and regression coverage.

## v0.19.30 - Rod Aim fish follow

- Split Rod Control into player-driven rod aim and physics-limited fish lateral follow.
- Rod aim can now move sideways even when the fish starts centered under the rod.
- Fish now follows the current rod aim X through angle, load-reserve and force-limited lateral movement.
- Rod aim speed now scales by fish weight, line state, drag-slip state and load reserve.
- Added Rod Aim config labels, debug fields and regression coverage.

## v0.19.29 - Rod Control decoupled visual target

- Restored Rod Control alignment toward the configured rod X target.
- Added configurable actual-rod versus base-rod target selection.
- Tight-line visual rod movement now follows actual lateral fish displacement instead of raw A/D or swipe input.
- Free-line / drag-slip visual movement can remain input-driven without teleporting the fish.
- Added target, angle, direction-factor and visual-driving diagnostics for Rod Control.

## v0.19.28 - Simple force-driven Rod Control.

- Rod Control input now directly defines lateral force percentage and direction.
- Fish X movement no longer depends on visual rod position, alignment, or visual limits.
- Fight and line geometry now use the stable base rod position.
- Visual rod movement is input-driven, eases in and out, and slows from 100% to 50% as fish weight rises from 30% to 100% of rod load.
- Removed Rod Control alignment, line-coupling, lateral reel-hold phase, and target-position complexity.

## v0.19.27 - Configurable Rod Control center.

- Added `physics.fight.rodControl.alignment.useActualRodPositionAsTarget`.
- `false` keeps the stable base rod coordinate captured at Rod Control start.
- `true` makes alignment and the 0% center follow the current visually shifted rod position.
- Added debug visibility and regression coverage for both target modes.

## v0.19.26 - Rod Control lateral reel hold continuation

- Removed the meter-based Rod Control X stroke as a gameplay movement limit.
- Added explicit Rod Control phases, including `rod_sweep`, `lateral_reel_hold`, and `blocked_at_limit`.
- Visual rod limits now stop only visual movement; safe reel-hold continuation can keep moving an unaligned fish.
- Lateral reel hold uses reel load safety and retrieve speed without requiring or recovering vertical slack.
- Delivered Rod Control force is no longer reduced by per-frame applied movement.
- Gameplay now reads an immutable rod visual frame instead of debug data.
- Removed obsolete X-stroke configuration and overlay metrics.

## v0.19.25 - Fish-driven Rod Control

- Taut-line rod movement now follows actual lateral fish displacement instead of raw A/D or swipe input.
- Added explicit `tight_line`, `drag_slip`, and `free` visual coupling modes.
- Replaced fixed lateral movement speed with force- and water-resistance-derived pull speed.
- Drag slip can move the rod quickly and independently without teleporting the fish.
- Added coupling, visual-limit, pull-speed and reel-hold-source debug metrics.

## v0.19.24 - Direction-aware Rod Hold

- Rod Hold now opposes fish movement according to its direction.
- Fish movement toward the player is preserved instead of being suppressed by hold or drag.
- Fish own toward movement and Rod Pull movement now combine into a higher approach speed.
- Added configurable hold opposition ratios for toward, side and away movement.
- Added direction, opposing hold and combined-speed debug metrics.
- Added focused regression checks for all three direction cases.

## v0.19.23 - Tackle stress failure system

- Reworked tackle overload into a stress-based failure system.
- Stress tension now accumulates after main tension overload.
- Added failure roll every 500ms based on stress percentage.
- Stress at 100% now guarantees tackle failure.
- Added weakest-component failure selection with leader -> line -> rod tie priority.
- Line now breaks before rod when their max load is equal.
- Leader is lost first when leader, line and rod have equal max load.
- Fish resistance can now accumulate stress even without Rod Hold.

## v0.19.22 - Player pull motion smoothing

- Added a player pull motion smoothing layer for fish movement from Rod Hold and Rod Control.
- Added configurable `physics.fight.playerPullMotion.inertiaSeconds`.
- Smoothed player-applied fish movement now eases in and out while preserving Rod Control target clamping.
- Rod Control lateral tension now scales from the actually applied smoothed movement.
- Added player pull motion debug overlay metrics and focused smoother regression checks.

## v0.19.21.1 - Rod Control UX stabilization

- Rod Control can now work in parallel with Rod Hold.
- Rod Control HUD now shows delivered lateral force instead of alignment progress.
- Added explicit input power, angle efficiency, direction factor and delivered force metrics.
- Fixed stable target X for Rod Control alignment logic.
- Fixed the force reserve path so Rod Control gives no force without load reserve.
- Tightened drag/friction separation while Rod Control is active.
- Expanded Rod Control debug overlay metrics.
- Added Rod Control UX regression checks.

## v0.19.21 - Rod Control alignment model

- Reworked Rod Control X from lateral stroke meters to fish-to-rod X alignment progress.
- Added toward-rod direction checks so wrong-side A/D or swipe input is blocked without moving fish.
- Scaled lateral force, fish movement and rod visual offset by input power and line angle.
- Updated the Rod Control HUD bar, fight overlay metrics and focused checks for the alignment model.

## v0.19.20 - Rod Control X

- Added Rod Control X as a separate horizontal fight action with pointer/keyboard action lock.
- Added a lateral rod control stroke meter so side control depletes and must recover after release.
- Added lateral fish movement and lateral tension contribution with same/neutral/opposite direction multipliers.
- Added smoothed visual rod X offset with canvas/playable-zone clamping.
- Added a Rod Control UI bar and fight physics overlay section for balancing/debugging.

## v0.19.19.1 - Improve debug overlay DI and settings encapsulation

## v0.19.19 - overlay oop runtime

- Split debug overlay into class-based config, core, DOM, service and module layers.
- Replaced the monolithic overlay file with `src/debug/overlay/overlay_bootstrap.js`.
- Split fight physics overlay into dedicated section renderers for fish, rod hold, reel hold, drag, line, rod stroke, auto recovery, movement and tension.
- Moved overlay metric descriptions into `src/config/metadata/overlay_metric_descriptions.json`.
- Split overlay metric inspection into catalog, resolver, console inspector and DOM bridge services.
- Routed DevTools overlay toggles through `OverlaySettingsStore` while preserving `OVERLAY_MODULES` compatibility.

## v0.19.18 - debug metadata cleanup

- Moved DevTools parameter descriptions into `src/config/metadata`.
- Updated DevTools tooltip loading so parameter metadata lives in one shared metadata location.

## v0.19.17 - debug oop runtime

- Refactored debug console runtime into class-based core, service and module layers.
- Moved debug composition into `src/debug/debug.js` as the single root bootstrap.
- Removed small root debug wrapper files while preserving the public `window` debug API.
- Kept debug optional for prod through null-safe adapters and runtime smoke checks.

## v0.19.16 - fight tension and applied movement overlay

- Capped final line tension by drag when the reel can slip, while keeping raw tension for debug.
- Treated 100% drag as locked drag so it can bypass slip caps intentionally.
- Changed rod stroke loss so unrecovered Y-distance is lost when the fish moves away, even after hold is released.
- Split fight overlay movement speed into model fight speed and actual applied rod/reel-hold speed.
- Added reel hold overlay rows for applied frame movement and applied speed.

## v0.19.15 - reel hold stabilization

- Added `ReelHoldRecoverySystem` to remaining regression harnesses.
- Added parameter metadata for rod stroke capacity and reel hold timing thresholds.
- Narrowed hard tension blocking so stroke-full movement blocks do not disable movable hold tension caps.
- Updated the project version badge to match the delivered line / rod stroke patch.

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
