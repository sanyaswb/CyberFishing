/**
 * Domain value object for fish retrieve physics.
 *
 * It accepts both the new grouped config shape:
 *   passiveBodyResistance / activeFishResistance / waterDragWhilePulling /
 *   playerPressureTransfer
 * and the old flat shape used by early systems/tests.
 */
class FishRetrievePhysicsSettings {
  constructor({
    passiveBodyResistance = {},
    activeFishResistance = {},
    waterDragWhilePulling = {},
    playerPressureTransfer = {},
    lineState = {},
    balance = {},
  } = {}) {
    this.passiveBodyResistance = Object.freeze({
      tautBodyResistanceKgPerKg: this.#number(
        passiveBodyResistance.tautBodyResistanceKgPerKg,
        0.15,
      ),
    });
    this.activeFishResistance = Object.freeze({
      activeAwayForceMultiplier: this.#number(
        activeFishResistance.activeAwayForceMultiplier,
        1,
      ),
    });
    this.waterDragWhilePulling = Object.freeze({
      referencePullSpeedMetersPerSecond: this.#number(
        waterDragWhilePulling.referencePullSpeedMetersPerSecond,
        1,
      ),
      dragKgPerKgAtReferenceSpeed: this.#number(
        waterDragWhilePulling.dragKgPerKgAtReferenceSpeed,
        0.85,
      ),
    });
    this.playerPressureTransfer = Object.freeze({
      referenceWeightKg: this.#number(playerPressureTransfer.referenceWeightKg, 0.5),
      minTransferRatio: this.#number(playerPressureTransfer.minTransferRatio, 0.05),
      blockedTransferRatio: this.#number(
        playerPressureTransfer.blockedTransferRatio,
        1,
      ),
    });
    this.lineState = Object.freeze({
      looseLineTautToleranceMeters: this.#number(
        lineState.looseLineTautToleranceMeters,
        0.02,
      ),
    });
    this.balance = Object.freeze({
      epsilonKg: this.#number(balance.epsilonKg, 0.001),
    });
    Object.freeze(this);
  }

  static from(config = {}) {
    if (config instanceof FishRetrievePhysicsSettings) return config;
    const source = config || {};
    return new FishRetrievePhysicsSettings({
      passiveBodyResistance: {
        tautBodyResistanceKgPerKg: FishRetrievePhysicsSettings.#firstNumber(
          source.passiveBodyResistance?.tautBodyResistanceKgPerKg,
          source.tautBodyResistanceKgPerKg,
          source.staticBodyResistanceKgPerKg,
          0.15,
        ),
      },
      activeFishResistance: {
        activeAwayForceMultiplier: FishRetrievePhysicsSettings.#firstNumber(
          source.activeFishResistance?.activeAwayForceMultiplier,
          source.activeAwayForceMultiplier,
          1,
        ),
      },
      waterDragWhilePulling: {
        referencePullSpeedMetersPerSecond:
          FishRetrievePhysicsSettings.#firstNumber(
            source.waterDragWhilePulling?.referencePullSpeedMetersPerSecond,
            source.referencePullSpeedMetersPerSecond,
            1,
          ),
        dragKgPerKgAtReferenceSpeed: FishRetrievePhysicsSettings.#firstNumber(
          source.waterDragWhilePulling?.dragKgPerKgAtReferenceSpeed,
          source.waterDragKgPerKgAtReferenceSpeed,
          0.85,
        ),
      },
      playerPressureTransfer: {
        referenceWeightKg: FishRetrievePhysicsSettings.#firstNumber(
          source.playerPressureTransfer?.referenceWeightKg,
          source.playerPressureTransferReferenceWeightKg,
          0.5,
        ),
        minTransferRatio: FishRetrievePhysicsSettings.#firstNumber(
          source.playerPressureTransfer?.minTransferRatio,
          source.minPlayerPressureTransferRatio,
          0.05,
        ),
        blockedTransferRatio: FishRetrievePhysicsSettings.#firstNumber(
          source.playerPressureTransfer?.blockedTransferRatio,
          source.blockedPlayerPressureTransferRatio,
          1,
        ),
      },
      lineState: {
        looseLineTautToleranceMeters: FishRetrievePhysicsSettings.#firstNumber(
          source.lineState?.looseLineTautToleranceMeters,
          source.looseLineTautToleranceMeters,
          0.02,
        ),
      },
      balance: {
        epsilonKg: FishRetrievePhysicsSettings.#firstNumber(
          source.balance?.epsilonKg,
          source.balanceEpsilonKg,
          0.001,
        ),
      },
    });
  }

  toLegacyConfig() {
    return {
      tautBodyResistanceKgPerKg:
        this.passiveBodyResistance.tautBodyResistanceKgPerKg,
      activeAwayForceMultiplier:
        this.activeFishResistance.activeAwayForceMultiplier,
      referencePullSpeedMetersPerSecond:
        this.waterDragWhilePulling.referencePullSpeedMetersPerSecond,
      waterDragKgPerKgAtReferenceSpeed:
        this.waterDragWhilePulling.dragKgPerKgAtReferenceSpeed,
      playerPressureTransferReferenceWeightKg:
        this.playerPressureTransfer.referenceWeightKg,
      minPlayerPressureTransferRatio:
        this.playerPressureTransfer.minTransferRatio,
      blockedPlayerPressureTransferRatio:
        this.playerPressureTransfer.blockedTransferRatio,
      looseLineTautToleranceMeters: this.lineState.looseLineTautToleranceMeters,
      balanceEpsilonKg: this.balance.epsilonKg,
    };
  }

  static #firstNumber(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  #number(value, defaultValue) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
}
