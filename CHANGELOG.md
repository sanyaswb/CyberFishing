# CyberFishing changelog

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
