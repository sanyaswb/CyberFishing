# CyberFishing changelog

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
