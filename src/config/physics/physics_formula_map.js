/**
 * Fishing fight physics formula map.
 *
 * This file is intentionally data-only: it explains which config/state values
 * feed each debug output. Runtime systems still own the calculations.
 */
const PHYSICS_FORMULA_MAP = Object.freeze({
  fishMotionLoad: Object.freeze({
    title: "Fish Motion Load",
    description:
      "Навантаження, яке з'являється через рух риби відносно води/течії.",
    formula:
      "dynamicFishForceKg = fishWeightKg * relativeSpeedMps * speciesSpeedForceMultiplier * speciesWaterResistanceMultiplier * speedLoadKgPerKgPerMps * directionMultiplier",
    sources: Object.freeze([
      "fish.weightKg",
      "runtime.relativeSpeedMps",
      "fish.physics.resistanceProfile.speedForceMultiplier",
      "fish.physics.resistanceProfile.waterResistanceMultiplier",
      "physics.environment.water.fishMotionLoad.speedLoadKgPerKgPerMps",
      "physics.fight.fishForce.dynamicLoadFromMotion.directionMultiplier",
      "physics.fight.fishForce.dynamicLoadFromMotion.enabled",
    ]),
    outputs: Object.freeze([
      "dynamicFishForceKg",
      "directionResistanceMultiplier",
      "totalFishForceKg",
    ]),
    debugGroup: "РИБА → СНАСТЬ",
  }),

  fishTotalForce: Object.freeze({
    title: "Fish Total Force",
    description:
      "Підсумкова сила риби після поведінки, динамічного навантаження і виснаження.",
    formula:
      "totalFishForceKg = max(staticFishForceKg * minPowerRatio, (staticFishForceKg * behaviorPowerRatio + dynamicFishForceKg) * exhaustionPowerMultiplier)",
    sources: Object.freeze([
      "fish.physics.forceProfile.basePower",
      "fish.physics.forceProfile.minPowerRatio",
      "fish.behaviorProfile.behaviors[state].powerRatio",
      "dynamicFishForceKg",
      "fishCondition.currentExhaustion",
      "fishCondition.maxEndurance",
    ]),
    outputs: Object.freeze([
      "staticFishForceKg",
      "totalFishForceKg",
      "exhaustionPowerMultiplier",
    ]),
    debugGroup: "РИБА → СНАСТЬ",
  }),

  playerPressure: Object.freeze({
    title: "Player Pull Pressure",
    description:
      "Сирий тиск гравця від rod pull і частина, яка реально передається в натяг.",
    formula:
      "effectivePlayerPressureKg = playerPullPressureKg * pressureTransferRatio",
    sources: Object.freeze([
      "rodPullResult.forceKg",
      "physics.fight.fishRetrieve.playerPressureTransfer.referenceWeightKg",
      "physics.fight.fishRetrieve.playerPressureTransfer.minTransferRatio",
      "physics.fight.fishRetrieve.playerPressureTransfer.blockedTransferRatio",
      "fishWeightKg",
      "fishOppositionKg",
      "movementBlocked",
    ]),
    outputs: Object.freeze([
      "playerPullPressureKg",
      "effectivePlayerPressureKg",
      "pressureTransferRatio",
    ]),
    debugGroup: "ГРАВЕЦЬ → РИБА",
  }),

  fishRetrieveOpposition: Object.freeze({
    title: "Fish Retrieve Opposition",
    description:
      "Опір, який треба перебороти перед тим, як риба почне рухатися до гравця.",
    formula:
      "fishOppositionKg = bodyResistanceKg + activeAwayForceKg; surplusForceKg = max(0, playerPullPressureKg - fishOppositionKg)",
    sources: Object.freeze([
      "fish.weightKg",
      "fish.physics.retrieveProfile.passiveBodyResistanceMultiplier",
      "fish.physics.retrieveProfile.activeAwayMultiplier",
      "physics.fight.fishRetrieve.passiveBodyResistance.tautBodyResistanceKgPerKg",
      "physics.fight.fishRetrieve.activeFishResistance.activeAwayForceMultiplier",
      "totalFishForceKg",
      "awayFromPlayerRatio",
    ]),
    outputs: Object.freeze([
      "bodyResistanceKg",
      "activeAwayForceKg",
      "fishOppositionKg",
      "surplusForceKg",
    ]),
    debugGroup: "ГРАВЕЦЬ → РИБА",
  }),

  pullWaterDrag: Object.freeze({
    title: "Pull Water Drag",
    description:
      "Опір води при протягуванні риби до гравця. Визначає швидкість при наявній надлишковій силі.",
    formula:
      "waterDragCapacityKg = fishWeightKg * dragKgPerKgAtReferenceSpeed * fishWaterDragMultiplier; retrieveSpeedMps = referencePullSpeedMps * sqrt(surplusForceKg / waterDragCapacityKg)",
    sources: Object.freeze([
      "fish.weightKg",
      "fish.physics.retrieveProfile.waterDragMultiplier",
      "fish.physics.retrieveProfile.referencePullSpeedMultiplier",
      "physics.fight.fishRetrieve.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed",
      "physics.fight.fishRetrieve.waterDragWhilePulling.referencePullSpeedMetersPerSecond",
      "surplusForceKg",
    ]),
    outputs: Object.freeze([
      "fishRetrieveWaterDragCapacityKg",
      "fishRetrieveWaterDragKg",
      "fishRetrieveSpeedMps",
      "fishRetrieveAppliedMoveMeters",
    ]),
    debugGroup: "ВОДА ПРИ ПІДТЯГУВАННІ",
  }),

  finalLineTension: Object.freeze({
    title: "Final Line Tension",
    description:
      "Фінальний натяг, який бачить снасть після passive retrieve tension, active fish force і обмежень фрикціону/ліски.",
    formula:
      "rawTensionKg = passiveRetrieveTensionKg + activeAwayForceKg; tensionKg = dragCanSlip ? dragLimitKg : rawTensionKg",
    sources: Object.freeze([
      "passiveRetrieveTensionKg",
      "activeAwayForceKg",
      "dragLimitKg",
      "dragLocked",
      "lineHasReserve",
      "hardLineLimit",
      "maxTackleLoadKg",
    ]),
    outputs: Object.freeze([
      "rawTensionKg",
      "tensionKg",
      "shouldSlipDrag",
      "tensionMode",
    ]),
    debugGroup: "ФІНАЛЬНИЙ НАТЯГ",
  }),
});
