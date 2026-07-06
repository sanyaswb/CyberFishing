# Line and rod stroke debug model

## Goal

`LINE`, `ROD STROKE` and `AUTO RECOVERY` overlay blocks make the line spool, won rod-stroke distance and reel recovery visible.

The runtime contract separates four concepts:

- fish distance: real distance from rod tip to fish;
- released line: physical line currently available between rod and fish;
- remaining line: physical line still on the reel spool;
- rod stroke won: line-distance won by rod hold that still has to be recovered by the reel;
- recoverable line: diagnostic `max(0, releasedLineMeters - fishDistanceMeters)`.

## LINE fields

- `fishDistanceMeters`: current distance from rod tip to fish.
- `totalLineMeters`: equipped line length on the reel spool.
- `releasedLineMeters`: current released line length.
- `remainingLineMeters`: remaining releasable line on the spool.
- `recoverableLineMeters`: diagnostic `max(0, releasedLineMeters - fishDistanceMeters)`.
- `initialRecoverableLineMeters`: recoverable line at frame start.
- `finalRecoverableLineMeters`: recoverable line after line release/recovery/constraint.
- `lineReleasedThisFrameMeters`: line released by drag/slip this frame.
- `lineRecoveredThisFrameMeters`: line recovered by reel/recovery this frame.
- `lineHasReserve`: whether line can still be released.
- `spoolEmpty`: no remaining line reserve.
- `fullyExtended`: fish distance is at the current released-line limit.
- `hardLineLimit`: no more line can be released and constraint/extension is active.

## ROD STROKE fields

- `rodStrokeCapacityMeters`: maximum rod stroke distance for the current cycle.
- `rodStrokeWonMeters`: won line-distance that still has not been recovered.
- `rodStrokeUsedMeters`: compatibility alias for won line-distance.
- `rodStrokeUnrecoveredMeters`: compatibility alias for won line-distance.
- `rodStrokeRatio`: `rodStrokeWonMeters / rodStrokeCapacityMeters`.
- `strokeRecoveredMeters`: stroke reduced by reel auto recovery.
- `strokeResetReason`: why stroke was reduced/reset by direct recovery.

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

## Important rule

`LineSpoolState` owns physical line length. `RodStrokeState` owns won line-distance. `ReelAutoRecoveryCalculator` owns tension-based recovery speed. Recoverable line remains a line diagnostic only and must not reset or clamp rod stroke.
