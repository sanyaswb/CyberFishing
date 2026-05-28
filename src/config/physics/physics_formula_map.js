const PHYSICS_FORMULA_MAP = Object.freeze({
  fishPassiveForce: Object.freeze({
    title: "Fish passive force / water weight",
    formula: "fishPassiveKg = fishWeightKg * tautBodyResistancePerKg * fishBasePower",
    sources: Object.freeze([
      "fish.weightKg",
      "physics.water.tautBodyResistancePerKg",
      "fish.physics.forceProfile.basePower",
    ]),
    outputs: Object.freeze(["fishPassiveKg"]),
  }),

  fishActiveForce: Object.freeze({
    title: "Fish active force",
    formula: "fishActiveKg = fishPassiveKg * stateForceMultiplier * directionMultiplier",
    sources: Object.freeze([
      "fishPassiveKg",
      "fish.behaviorProfile.behaviors[state].forceMultiplier",
      "physics.fight.directionForce",
    ]),
    outputs: Object.freeze(["fishActiveKg"]),
  }),

  fishOpposition: Object.freeze({
    title: "Fish opposition",
    formula: "fishOppositionKg = fishPassiveKg + fishActiveKg",
    sources: Object.freeze(["fishPassiveKg", "fishActiveKg"]),
    outputs: Object.freeze(["fishOppositionKg", "fishTensionKg"]),
  }),

  rodHold: Object.freeze({
    title: "Rod hold",
    formula: "rodHoldMaxKg = max(0, rodLimitKg - fishTensionKg); effectiveRodHoldKg = rodHoldKg * rodAngleMultiplier",
    sources: Object.freeze([
      "rod.maxLoadKg",
      "fishTensionKg",
      "physics.fight.rodHold.chargeTimeSeconds",
      "physics.fight.rodHold.anglePenalty",
    ]),
    outputs: Object.freeze(["rodHoldMaxKg", "effectiveRodHoldKg"]),
  }),

  holdToTension: Object.freeze({
    title: "Hold to tension",
    formula: "playerHoldTensionKg = fishCanMove ? min(effectiveRodHoldKg * holdTensionRatio, fishPassiveKg * movableHoldTensionCapRatio) : effectiveRodHoldKg * holdTensionRatio",
    sources: Object.freeze([
      "effectiveRodHoldKg",
      "rod.holdTensionRatio",
      "fishPassiveKg",
      "physics.fight.tension.movableHoldTensionCapRatio",
      "fishCanMoveTowardPlayer",
    ]),
    outputs: Object.freeze(["playerHoldTensionKg"]),
  }),

  totalTension: Object.freeze({
    title: "Total tension and equipment stress",
    formula: "totalTensionKg = dragBlockedForceKg + playerHoldTensionKg; stress = totalTensionKg / equipmentLimitKg",
    sources: Object.freeze(["fishTensionKg", "playerHoldTensionKg", "rod/line/hook limits"]),
    outputs: Object.freeze(["totalTensionKg", "rodStressRatio", "lineStressRatio", "hookStressRatio"]),
  }),

  movementSpeed: Object.freeze({
    title: "Movement speed",
    formula: "fishWonForceKg = max(0, fishOppositionKg - effectiveRodHoldKg); speedMps = sqrt(fishWonForceKg / motionResistance) * speedMultiplier",
    sources: Object.freeze([
      "effectiveRodHoldKg",
      "fishOppositionKg",
      "physics.water.motionResistance",
      "physics.water.speedMultiplier",
      "fish.physics.movementProfile.baseSpeed",
      "fish.behaviorProfile.behaviors[state].speedMultiplier",
    ]),
    outputs: Object.freeze(["fishWonForceKg", "winner", "speedMps", "speedPxPerSecond"]),
  }),

  dragForce: Object.freeze({
    title: "Drag force split",
    formula: "fishWonYForceKg = fishWonForceKg * yAwayRatio; dragBlockedForceKg = lineCanSlip ? min(fishWonYForceKg, dragLimitKg) : fishWonYForceKg; excessYForceKg = dragCanBeExceeded ? max(0, fishWonYForceKg - dragLimitKg) : 0",
    sources: Object.freeze([
      "fishWonForceKg",
      "yAwayRatio",
      "reel.dragMaxKg",
      "dragRatio",
      "line reserve / extension state",
    ]),
    outputs: Object.freeze(["dragBlockedForceKg", "excessYForceKg", "shouldSlipDrag"]),
  }),

  reelHold: Object.freeze({
    title: "Reel hold",
    formula: "reelHoldActive = rodStrokeIsFull && playerIsHolding && reelSafeMarginKg > 0; reelRetrieveSpeedMps = baseReelRetrieveSpeedMps * clamp01(reelSafeMarginKg / reelHoldLimitKg)",
    sources: Object.freeze([
      "rodStrokeRatio",
      "playerHoldActive",
      "reel.maxLoadKg",
      "totalTensionKg",
      "reel.retrieveSpeedMetersPerSec",
    ]),
    outputs: Object.freeze(["reelHoldActive", "reelSafeMarginKg", "reelRetrieveSpeedMps"]),
  }),
});
