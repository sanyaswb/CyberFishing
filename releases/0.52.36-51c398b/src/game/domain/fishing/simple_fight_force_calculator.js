import { nonNegativeFiniteOr } from "../../../engine/math/number_normalization.js";

/**
 * Calculates the simplified fish fight force model.
 *
 * Responsibility boundary:
 * - input: normalized fish, rod, hold and water values;
 * - output: passive/active/opposition force, hold/tension, net force and speed;
 * - no mutation of entity state and no dependency on Canvas/DOM.
 */
export class SimpleFightForceCalculator {
  calculate({
    fishWeightKg,
    fishBasePower = 1,
    fishBaseSpeed = 1,
    fishStateForceMultiplier = 1,
    fishStateSpeedMultiplier = 1,
    directionMultiplier = 1,
    tautBodyResistancePerKg = 0.2,
    rodLimitKg,
    rodHoldTensionCeilingMultiplier = 1,
    rodHoldKg,
    rodAngleMultiplier = 1,
    holdTensionRatio = 1,
    movableHoldTensionCapRatio = 1,
    fishCanMoveTowardPlayer = true,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    slack = false,
  } = {}) {
    const fishPassiveKg = this.calculateFishPassiveKg({
      fishWeightKg,
      tautBodyResistancePerKg,
      fishBasePower,
    });
    const fishActiveKg = this.calculateFishActiveKg({
      fishPassiveKg,
      fishStateForceMultiplier,
      directionMultiplier,
    });
    const fishOppositionKg = this.calculateFishOppositionKg({
      fishPassiveKg,
      fishActiveKg,
    });
    const fishTensionKg = slack ? 0 : fishOppositionKg;
    const rodHoldMaxKg = this.calculateRodHoldMaxKg({
      rodLimitKg,
      fishTensionKg,
      tensionCeilingMultiplier: rodHoldTensionCeilingMultiplier,
    });
    const rodHoldTensionCeilingKg = this.calculateTensionCeilingKg({
      rodLimitKg,
      tensionCeilingMultiplier: rodHoldTensionCeilingMultiplier,
    });
    const effectiveRodHoldKg = this.calculateEffectiveRodHoldKg({
      rodHoldKg,
      rodHoldMaxKg,
      rodAngleMultiplier,
    });
    const netForceKg = this.calculateNetForceKg({
      effectiveRodHoldKg,
      fishOppositionKg,
    });
    const playerHoldTensionKg = this.calculatePlayerHoldTensionKg({
      effectiveRodHoldKg,
      holdTensionRatio,
      fishOppositionKg,
      movableHoldTensionCapRatio,
      fishCanMoveTowardPlayer: fishCanMoveTowardPlayer && netForceKg > 0,
    });
    const totalTensionKg = this.calculateTotalTensionKg({
      fishTensionKg,
      playerHoldTensionKg,
    });
    const rawPlayerHoldTensionKg = this.calculateRawPlayerHoldTensionKg({
      effectiveRodHoldKg,
      holdTensionRatio,
    });
    const movableHoldTensionCapKg = this.calculateMovableHoldTensionCapKg({
      fishOppositionKg,
      movableHoldTensionCapRatio,
    });
    const speed = this.calculateSpeedMps({
      netForceKg,
      waterMotionResistance,
      waterSpeedMultiplier,
      fishBaseSpeed,
      fishStateSpeedMultiplier,
    });

    return Object.freeze({
      fishPassiveKg,
      fishActiveKg,
      fishOppositionKg,
      fishTensionKg,
      rodHoldTensionCeilingMultiplier: nonNegativeFiniteOr(
        rodHoldTensionCeilingMultiplier,
        1,
      ),
      rodHoldTensionCeilingKg,
      rodHoldMaxKg,
      effectiveRodHoldKg,
      rawPlayerHoldTensionKg,
      movableHoldTensionCapKg,
      movableHoldTensionCapApplied:
        fishCanMoveTowardPlayer &&
        netForceKg > 0 &&
        playerHoldTensionKg < rawPlayerHoldTensionKg,
      playerHoldTensionKg,
      totalTensionKg,
      netForceKg,
      speedMps: speed.speedMps,
      towardPlayerSpeedMps: speed.towardPlayerSpeedMps,
      awaySpeedMps: speed.awaySpeedMps,
      direction: speed.direction,
    });
  }

  calculateFishPassiveKg({
    fishWeightKg,
    tautBodyResistancePerKg = 0.2,
    fishBasePower = 1,
  } = {}) {
    return (
      nonNegativeFiniteOr(fishWeightKg) *
      nonNegativeFiniteOr(tautBodyResistancePerKg) *
      nonNegativeFiniteOr(fishBasePower, 1)
    );
  }

  calculateFishActiveKg({
    fishPassiveKg,
    fishStateForceMultiplier = 1,
    directionMultiplier = 1,
  } = {}) {
    return (
      nonNegativeFiniteOr(fishPassiveKg) *
      nonNegativeFiniteOr(fishStateForceMultiplier, 1) *
      nonNegativeFiniteOr(directionMultiplier, 1)
    );
  }

  calculateFishOppositionKg({ fishPassiveKg, fishActiveKg } = {}) {
    return nonNegativeFiniteOr(fishPassiveKg) + nonNegativeFiniteOr(fishActiveKg);
  }

  calculateRodHoldMaxKg({
    rodLimitKg,
    fishTensionKg,
    tensionCeilingMultiplier = 1,
  } = {}) {
    return Math.max(
      0,
      this.calculateTensionCeilingKg({
        rodLimitKg,
        tensionCeilingMultiplier,
      }) - nonNegativeFiniteOr(fishTensionKg),
    );
  }

  calculateTensionCeilingKg({
    rodLimitKg,
    tensionCeilingMultiplier = 1,
  } = {}) {
    return (
      nonNegativeFiniteOr(rodLimitKg) *
      nonNegativeFiniteOr(tensionCeilingMultiplier, 1)
    );
  }

  calculateEffectiveRodHoldKg({
    rodHoldKg,
    rodHoldMaxKg,
    rodAngleMultiplier = 1,
  } = {}) {
    const cappedHold = Math.min(
      nonNegativeFiniteOr(rodHoldKg),
      nonNegativeFiniteOr(rodHoldMaxKg),
    );
    return cappedHold * this.#ratio(rodAngleMultiplier, 1);
  }

  calculatePlayerHoldTensionKg({
    effectiveRodHoldKg,
    holdTensionRatio = 1,
    fishOppositionKg,
    movableHoldTensionCapRatio = 1,
    fishCanMoveTowardPlayer = false,
  } = {}) {
    const rawTension = this.calculateRawPlayerHoldTensionKg({
      effectiveRodHoldKg,
      holdTensionRatio,
    });
    if (!fishCanMoveTowardPlayer) return rawTension;

    return Math.min(
      rawTension,
      this.calculateMovableHoldTensionCapKg({
        fishOppositionKg,
        movableHoldTensionCapRatio,
      }),
    );
  }

  calculateRawPlayerHoldTensionKg({
    effectiveRodHoldKg,
    holdTensionRatio = 1,
  } = {}) {
    return nonNegativeFiniteOr(effectiveRodHoldKg) * this.#ratio(holdTensionRatio, 1);
  }

  calculateMovableHoldTensionCapKg({
    fishOppositionKg,
    movableHoldTensionCapRatio = 1,
  } = {}) {
    // Cap is based on current fish opposition, not passive water weight.
    // This keeps small movable fish safe, but lets active fish transfer more tension.
    return (
      nonNegativeFiniteOr(fishOppositionKg) *
      nonNegativeFiniteOr(movableHoldTensionCapRatio, 1)
    );
  }

  calculateTotalTensionKg({ fishTensionKg, playerHoldTensionKg } = {}) {
    return nonNegativeFiniteOr(fishTensionKg) + nonNegativeFiniteOr(playerHoldTensionKg);
  }

  calculateNetForceKg({ effectiveRodHoldKg, fishOppositionKg } = {}) {
    return nonNegativeFiniteOr(effectiveRodHoldKg) - nonNegativeFiniteOr(fishOppositionKg);
  }

  calculateSpeedMps({
    netForceKg,
    waterMotionResistance = 1000,
    waterSpeedMultiplier = 64,
    fishBaseSpeed = 1,
    fishStateSpeedMultiplier = 1,
  } = {}) {
    const netForce = Number(netForceKg) || 0;
    const resistance = Math.max(0.000001, nonNegativeFiniteOr(waterMotionResistance, 1000));
    const speedMultiplier = nonNegativeFiniteOr(waterSpeedMultiplier, 64);
    const towardPlayerSpeedMps =
      Math.sqrt(Math.max(netForce, 0) / resistance) * speedMultiplier;
    const awaySpeedMps =
      Math.sqrt(Math.max(-netForce, 0) / resistance) *
      speedMultiplier *
      nonNegativeFiniteOr(fishBaseSpeed, 1) *
      nonNegativeFiniteOr(fishStateSpeedMultiplier, 1);

    if (towardPlayerSpeedMps > 0) {
      return Object.freeze({
        speedMps: towardPlayerSpeedMps,
        towardPlayerSpeedMps,
        awaySpeedMps: 0,
        direction: "toward_player",
      });
    }

    if (awaySpeedMps > 0) {
      return Object.freeze({
        speedMps: awaySpeedMps,
        towardPlayerSpeedMps: 0,
        awaySpeedMps,
        direction: "away",
      });
    }

    return Object.freeze({
      speedMps: 0,
      towardPlayerSpeedMps: 0,
      awaySpeedMps: 0,
      direction: "none",
    });
  }

  #ratio(value, fallback = 1) {
    return Math.max(0, Math.min(1, nonNegativeFiniteOr(value, fallback)));
  }
}
