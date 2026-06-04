# CyberFishing changelog

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
