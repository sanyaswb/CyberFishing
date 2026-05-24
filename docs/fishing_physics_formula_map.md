# Fishing Physics Formula Map

Цей документ пояснює не “де лежить параметр”, а **який параметр на який debug output впливає**. Одиниця `Kg` у fight physics є gameplay load unit, прив'язаною до кг навантаження снасті, а не повною фізичною моделлю ньютонів.

## 1. РИБА → СНАСТЬ

### Fish Motion Load

Навантаження від руху риби у воді:

```txt
dynamicFishForceKg =
  fishWeightKg
  * relativeSpeedMps
  * fish.physics.resistanceProfile.speedForceMultiplier
  * fish.physics.resistanceProfile.waterResistanceMultiplier
  * physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps
  * directionResistanceMultiplier
```

**Sources:**

- `fish.weightKg`
- `runtime.relativeSpeedMps`
- `fish.physics.resistanceProfile.speedForceMultiplier`
- `fish.physics.resistanceProfile.waterResistanceMultiplier`
- `physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps`
- `physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier`
- `physics.fight.fishForce.dynamicLoadFromMotion.enabled`

**Outputs:**

- `dynamicFishForceKg`
- `directionResistanceMultiplier`
- `totalFishForceKg`

### Fish Total Force

Підсумкова сила риби:

```txt
totalFishForceKg = max(
  staticFishForceKg * minPowerRatio,
  (staticFishForceKg * behaviorPowerRatio + dynamicFishForceKg)
    * exhaustionPowerMultiplier
)
```

**Sources:**

- `fish.physics.forceProfile.basePower`
- `fish.physics.forceProfile.minPowerRatio`
- `fish.behaviorProfile.behaviors[state].powerRatio`
- `dynamicFishForceKg`
- `fishCondition.currentExhaustion`
- `fishCondition.maxPoints`

**Outputs:**

- `staticFishForceKg`
- `totalFishForceKg`
- `exhaustionPowerMultiplier`

## 2. ГРАВЕЦЬ → РИБА

### Player Pull Pressure

Передача тиску гравця в натяг:

```txt
effectivePlayerPressureKg =
  playerPullPressureKg * pressureTransferRatio
```

`pressureTransferRatio` залежить від ваги риби, опору риби, blocked-state і глобальних параметрів transfer-моделі.

**Sources:**

- `rodPullResult.forceKg`
- `fishWeightKg`
- `fishOppositionKg`
- `movementBlocked`
- `physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg`
- `physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio`
- `physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio`

**Outputs:**

- `playerPullPressureKg`
- `effectivePlayerPressureKg`
- `pressureTransferRatio`

### Fish Retrieve Opposition

Опір риби проти підтягування:

```txt
bodyResistanceKg =
  fishWeightKg
  * physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg
  * fish.physics.retrieveProfile.passiveBodyResistanceMultiplier

activeAwayForceKg =
  totalFishForceKg
  * awayFromPlayerRatio
  * physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier
  * fish.physics.retrieveProfile.activeAwayMultiplier

fishOppositionKg = bodyResistanceKg + activeAwayForceKg
surplusForceKg = max(0, playerPullPressureKg - fishOppositionKg)
```

**Outputs:**

- `bodyResistanceKg`
- `activeAwayForceKg`
- `fishOppositionKg`
- `fishRetrieveSurplusForceKg`

## 3. ВОДА ПРИ ПІДТЯГУВАННІ

### Pull Water Drag

Це саме “опір води при підтягуванні”, а не динамічна сила риби від власного руху:

```txt
waterDragCapacityKg =
  fishWeightKg
  * physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed
  * fish.physics.retrieveProfile.waterDragMultiplier

retrieveSpeedMps =
  referencePullSpeedMetersPerSecond
  * fish.physics.retrieveProfile.referencePullSpeedMultiplier
  * sqrt(surplusForceKg / waterDragCapacityKg)
```

**Sources:**

- `fish.weightKg`
- `fish.physics.retrieveProfile.waterDragMultiplier`
- `fish.physics.retrieveProfile.referencePullSpeedMultiplier`
- `physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed`
- `physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond`
- `fishRetrieveSurplusForceKg`

**Outputs:**

- `fishRetrieveWaterDragCapacityKg`
- `fishRetrieveWaterDragKg`
- `fishRetrieveSpeedMps`
- `fishRetrieveDesiredMoveMeters`
- `fishRetrieveAppliedMoveMeters`

## 4. ФІНАЛЬНИЙ НАТЯГ

```txt
passiveRetrieveTensionKg =
  tautBodyResistanceKg
  + effectivePlayerPressureKg
  + accelerationLoadKg
  + blockedSurplusForceKg

fishRetrieveLineTensionKg = passiveRetrieveTensionKg + activeAwayForceKg
rawTensionKg = fishRetrieveLineTensionKg

tensionKg =
  dragCanSlip ? dragLimitKg : rawTensionKg
```

**Sources:**

- `passiveRetrieveTensionKg`
- `activeAwayForceKg`
- `dragLimitKg`
- `dragLocked`
- `lineCanRelease`
- `hardLineLimit`
- `maxTackleLoadKg`

**Outputs:**

- `rawTensionKg`
- `tensionKg`
- `shouldSlipDrag`
- `tensionMode`

## Debug pipeline

Overlay `FIGHT PHYSICS` має показувати ті самі причинні блоки:

```txt
РИБА → СНАСТЬ
ГРАВЕЦЬ → РИБА
ВОДА ПРИ ПІДТЯГУВАННІ
ФІНАЛЬНИЙ НАТЯГ
```
