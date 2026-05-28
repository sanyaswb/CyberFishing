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
movableHoldTensionCapKg = fishOppositionKg * movableHoldTensionCapRatio;

playerHoldTensionKg = fishCanMoveTowardPlayer
  ? Math.min(rawPlayerHoldTensionKg, movableHoldTensionCapKg)
  : rawPlayerHoldTensionKg;
```

Meaning: when the fish can move, excess player force becomes speed instead of unlimited line tension.
When movement is blocked, full raw hold tension loads the tackle.

## 6. Drag blocked force, total tension and stress

```js
fishTensionKg = lineSlack ? 0 : fishOppositionKg;
totalTensionKg = fishTensionKg + playerHoldTensionKg;

rodStressRatio = totalTensionKg / rodLimitKg;
lineStressRatio = totalTensionKg / lineLimitKg;
hookStressRatio = totalTensionKg / hookLimitKg;
```

Meaning: fish-won force controls escape movement and drag slip, but it does not replace fish tension.
`totalTensionKg` is for tackle stress only; it is not a speed source.

## 7. Movement winner and speed

```js
fishWonForceKg = Math.max(0, fishOppositionKg - effectiveRodHoldKg);

towardPlayerForceKg = Math.max(0, effectiveRodHoldKg - fishOppositionKg);

if (towardPlayerForceKg > 0) {
  speedMps = Math.sqrt(towardPlayerForceKg / physics.water.motionResistance)
    * physics.water.speedMultiplier;
  direction = "toward_player";
}

if (fishWonForceKg > 0) {
  speedMps = Math.sqrt(fishWonForceKg / physics.water.motionResistance)
    * physics.water.speedMultiplier
    * fish.physics.movementProfile.baseSpeed
    * fishStateSpeedMultiplier;
  direction = "away";
}
```

`stateSpeedMultiplier` affects movement speed only. It does not add tension.
Fish escape speed is based on clean fish-won force, never on `totalTensionKg`.
`yAwayRatio` is the absolute normalized Y component of fish movement, so a 45 degree escape projects about 0.707 of fish-won force onto Y.

## 7.1. Y drag escape

```js
dragLimitKg = reelDragMaxKg * dragRatio;
fishWonYForceKg = fishWonForceKg * yAwayRatio;
dragCanBeExceeded = dragRatio > 0 && dragLimitKg > 0;
excessYForceKg = dragCanBeExceeded
  ? Math.max(0, fishWonYForceKg - dragLimitKg)
  : 0;

dragSlowedYSpeedPx = targetYSpeedPx * (1 - dragRatio);
excessYSpeedPx = speedFromForce(excessYForceKg) * Math.sign(targetYSpeedPx);

finalXSpeedPx = targetXSpeedPx;
finalYSpeedPx = lineCanSlip
  ? dragSlowedYSpeedPx + excessYSpeedPx
  : 0;
```

Implementation note: the zero-drag case has no excess force because an open drag blocks nothing and therefore cannot be exceeded.
Debug note: `PlayerForceSystem` exposes drag limits only. Runtime drag effect is read from `dragRatio`, `dragLimitKg`, `fishWonYForceKg`, `dragBlockedForceKg`, `excessYForceKg` and `finalYSpeedPxPerSec`.

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


## 9. Authoritative hooked movement

After the formula in section 7 produces target speed, hooked fish movement is applied directly:

```js
targetVelocityPxPerSec = moveDirection * speedMps * pixelsPerMeter;
position += targetVelocityPxPerSec * deltaTimeSeconds;
```

The generic `WaterEntity` velocity damping is skipped for hooked fight movement because the simplified fight model already includes water resistance and drag escape limiting.

`movementProfile.agility` still smooths behavior state transitions, but it does not damp stable fight speed.
