# CyberFishing changelog

## v0.19.37 - Rod Control axis tension mode

- Added `RodControlTensionModeResolver` for immutable same/side/opposite direction classification.
- Rod Control tension now compares autonomous fish velocity with the normalized control axis.
- Direction classification uses normalized alignment instead of the sign of raw canvas X velocity.
- Added configurable same-direction, opposite-direction, and minimum fish-speed thresholds.
- Preserved the existing `0 / 1 / 2.5` tension multipliers and legacy `fishVelocityX` fallback.
- Added alignment, projection speed, autonomous speed, and control-axis debug diagnostics.
- Added regression coverage for horizontal, vertical, diagonal, near-zero, rotated-axis, threshold, and legacy cases.

## v0.19.36 - Fish direction profile fallback

- Added base `radialRange` and `lateralRange` settings to fish movement profiles.
- Added `FishDirectionIntentSampler` for isolated radial/lateral intent sampling.
- Fish behavior now resolves direction ranges by state override, movement profile, then engine default.
- State direction overrides can provide radial and lateral ranges independently.
- Removed repeated direction ranges from ordinary fish states while preserving dash-specific overrides.
- Added config labels, validation, and regression coverage for every fallback level and legacy fish configs.

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
