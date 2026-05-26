# CyberFishing simplified fight physics formula map

This document describes the production fight model used from `v0.19.5`.
The old pressure-transfer / retrieve-water-drag / dynamic-relative-speed fight model is no longer the active model.

## Core idea

```txt
fish = passive water weight + active state/direction force
player = rodHold force
movement = rodHold force - fish opposition
tension = fish tension + capped player hold tension
reelHold = safe line recovery after rod stroke is full, not extra fight force
```

## 1. Fish passive force

```js
fishPassiveKg =
  fishWeightKg
  * physics.water.tautBodyResistancePerKg
  * fish.physics.forceProfile.basePower;
```

Meaning: the fish's effective water weight on a taut line.

## 2. Fish active force

```js
fishActiveKg =
  fishPassiveKg
  * fishStateForceMultiplier
  * directionMultiplier;
```

`fishStateForceMultiplier` comes from the active behavior state.
`directionMultiplier` comes from `physics.fight.directionForce`.

## 3. Fish opposition

```js
fishOppositionKg = fishPassiveKg + fishActiveKg;
fishTensionKg = isLineSlack ? 0 : fishOppositionKg;
```

Meaning: the force the player must exceed to move the fish toward the player.

## 4. Rod hold

```js
rodHoldMaxKg = Math.max(0, rodLimitKg - fishTensionKg);
effectiveRodHoldKg = min(rodHoldKg, rodHoldMaxKg) * rodAngleMultiplier;
```

Full `effectiveRodHoldKg` works against the fish. It is not clamped by the line.
A weak line can still break if the player over-holds.

## 5. Hold contribution to tension

```js
rawPlayerHoldTensionKg = effectiveRodHoldKg * holdTensionRatio;
movableHoldTensionCapKg = fishPassiveKg * movableHoldTensionCapRatio;

playerHoldTensionKg = fishCanMoveTowardPlayer
  ? Math.min(rawPlayerHoldTensionKg, movableHoldTensionCapKg)
  : rawPlayerHoldTensionKg;
```

Meaning: when the fish can move, excess player force becomes speed instead of unlimited line tension.
When movement is blocked, full raw hold tension loads the tackle.

## 6. Total tension and stress

```js
totalTensionKg = fishTensionKg + playerHoldTensionKg;
rodStressRatio = totalTensionKg / rodLimitKg;
lineStressRatio = totalTensionKg / lineLimitKg;
hookStressRatio = totalTensionKg / hookLimitKg;
```

Meaning: each tackle component is evaluated independently from the same total tension.

## 7. Movement winner and speed

```js
netForceKg = effectiveRodHoldKg - fishOppositionKg;

if (netForceKg > 0) {
  speedMps = Math.sqrt(netForceKg / physics.water.motionResistance)
    * physics.water.speedMultiplier;
  direction = "toward_player";
}

if (netForceKg < 0) {
  speedMps = Math.sqrt(-netForceKg / physics.water.motionResistance)
    * physics.water.speedMultiplier
    * fish.physics.movementProfile.baseSpeed
    * fishStateSpeedMultiplier;
  direction = "away";
}
```

`stateSpeedMultiplier` affects movement speed only. It does not add tension.

## 8. Reel hold

```js
reelSafeMarginKg = reelHoldLimitKg - totalTensionKg;

reelHoldActive =
  rodStrokeRatio >= 1.0
  && playerHoldActive
  && reelSafeMarginKg > 0
  && !dragSlipping;

reelRetrieveSpeedMps =
  baseReelRetrieveSpeedMps
  * clamp01(reelSafeMarginKg / reelHoldLimitKg)
  * reelBearingBonusMultiplier;
```

Reel hold is safe post-stroke line recovery. It does not add to `netForceKg`.
