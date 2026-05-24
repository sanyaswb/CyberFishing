/**
 * Decides how much raw player pull pressure becomes line load.
 */
class PlayerPressureTransferCalculator {
  calculate({
    fishWeightKg,
    fishOppositionKg,
    playerPullPressureKg,
    movementBlocked,
    isLineTaut,
    landingLift,
    retrieveConfig,
    globalRetrieveConfig,
    settingReader,
  } = {}) {
    const playerPullPressure = this.#positive(playerPullPressureKg);
    const pressureTransferRatio = this.#transferRatio({
      fishWeightKg,
      fishOppositionKg,
      playerPullPressureKg: playerPullPressure,
      movementBlocked,
      retrieveConfig,
      globalRetrieveConfig,
      settingReader,
    });
    const effectivePlayerPressureKg =
      isLineTaut !== false && !landingLift?.disablePlayerPressureLoad
        ? playerPullPressure * pressureTransferRatio
        : 0;
    const blockedSurplusForceKg =
      movementBlocked && isLineTaut !== false
        ? Math.max(0, playerPullPressure - effectivePlayerPressureKg)
        : 0;

    return Object.freeze({
      pressureTransferRatio,
      effectivePlayerPressureKg,
      blockedSurplusForceKg,
    });
  }

  #transferRatio({
    fishWeightKg,
    fishOppositionKg,
    playerPullPressureKg,
    movementBlocked,
    retrieveConfig,
    globalRetrieveConfig,
    settingReader,
  }) {
    const playerPullPressure = this.#positive(playerPullPressureKg);
    if (playerPullPressure <= 0.001) return 0;
    if (movementBlocked) {
      return this.#clamp01(
        settingReader(
          retrieveConfig,
          "blockedPlayerPressureTransferRatio",
          1,
          globalRetrieveConfig,
        ),
      );
    }

    const referenceWeight = Math.max(
      0.001,
      settingReader(
        retrieveConfig,
        "playerPressureTransferReferenceWeightKg",
        0.5,
        globalRetrieveConfig,
      ),
    );
    const minTransfer = this.#clamp01(
      settingReader(
        retrieveConfig,
        "minPlayerPressureTransferRatio",
        0.05,
        globalRetrieveConfig,
      ),
    );
    const weightTransfer = this.#positive(fishWeightKg) /
      (this.#positive(fishWeightKg) + referenceWeight);
    const loadTransfer = this.#positive(fishOppositionKg) / playerPullPressure;
    return this.#clamp01(Math.max(minTransfer, weightTransfer, loadTransfer));
  }

  #positive(value) {
    return Math.max(0, Number(value) || 0);
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
