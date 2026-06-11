# Line and rod stroke debug model

## Goal

`LINE`, `ROD STROKE` and `AUTO RECOVERY` overlay blocks make the line spool, won rod-stroke distance and reel recovery visible.

The runtime contract separates four concepts:

- fish distance: real distance from rod tip to fish;
- released line: physical line currently available between rod and fish;
- remaining line: physical line still on the reel spool;
- rod stroke won: Y-distance won by rod hold that still has to be recovered by the reel;
- pump credit: diagnostic `releasedLineMeters - fishDistanceMeters`, not a source of truth.

## LINE fields

- `fishDistanceMeters`: current distance from rod tip to fish.
- `totalLineMeters`: equipped line length on the reel spool.
- `releasedLineMeters`: current released line length.
- `remainingLineMeters`: remaining releasable line on the spool.
- `recoverableLineMeters`: diagnostic `max(0, releasedLineMeters - fishDistanceMeters)`.
- `lineReleasedThisFrameMeters`: line released by drag/slip this frame.
- `lineRecoveredThisFrameMeters`: line recovered by reel/recovery this frame.
- `lineHasReserve`: whether line can still be released.
- `spoolEmpty`: no remaining line reserve.
- `fullyExtended`: fish distance is at the current released-line limit.
- `hardLineLimit`: no more line can be released and constraint/extension is active.

## ROD STROKE fields

- `rodStrokeCapacityMeters`: maximum rod stroke distance for the current cycle.
- `rodStrokeWonMeters`: won Y-distance that still has not been recovered.
- `rodStrokeUsedMeters`: compatibility alias for won Y-distance.
- `rodStrokeUnrecoveredMeters`: compatibility alias for won Y-distance.
- `rodStrokeRatio`: `rodStrokeWonMeters / rodStrokeCapacityMeters`.
- `strokeYGainedMeters`: deprecated compatibility alias for gained line distance.
- `strokeYLostMeters`: deprecated compatibility alias for lost line distance.
- `initialPumpCreditMeters`: diagnostic recoverable line at frame start.
- `finalPumpCreditMeters`: diagnostic recoverable line after line release/recovery/constraint.
- `strokeRecoveredMeters`: stroke reduced by reel auto recovery.
- `strokeSyncedMeters`: always diagnostic in the new model; pump credit does not sync stroke.
- `strokeResetReason`: why stroke was reduced/reset by direct recovery.
- `strokeSyncReason`: why stroke was clamped to pump credit.

## AUTO RECOVERY fields

- `autoRecoverActive`: whether reel auto recovery recovered won stroke this frame.
- `autoRecoverBlockedReason`: why recovery could not happen.
- `autoRecoverSpeedMetersPerSec`: actual recovery speed after tension efficiency.
- `autoRecoverReelEfficiency`: `1 - clamp01(tensionKg / reelMaxLoadKg)`.
- `autoRecoveredMeters`: meters recovered from both line spool and rod stroke this frame.

## Reason values

`strokeResetReason`:

- `none`: no direct stroke recovery happened this frame.
- `new_pull_cycle`: new pull stroke cycle started.
- `stroke_capacity_initialized`: active pull initialized an empty stroke capacity.
- `recovered_by_reel`: reel/line recovery reduced unrecovered stroke.
- `pump_credit_zero`: legacy reason; pump credit no longer clears stroke.

`strokeSyncReason`:

- `none`: sync did not reduce stroke.
- `debug_only`: pump credit sync was called but did not mutate stroke.
- `synced_to_pump_credit`: legacy reason; no longer used as source of truth.
- `pump_credit_zero`: legacy reason; no longer used as source of truth.

## Important rule

`LineSpoolState` owns physical line length. `RodStrokeState` owns won Y-distance. `ReelAutoRecoveryCalculator` owns tension-based recovery speed. Pump credit remains a debug value only and must not reset or clamp rod stroke.
