class RodLateralControlSystem {
  #stroke = new RodAxisStrokeState();
  #result = this.#createResult();

  update({
    dtSec,
    inputState,
    rod,
    rodLimitKg,
    maxTackleLoadKg,
    fishTensionKg,
    fishVelocityX,
    fishWeightKg,
    config,
  } = {}) {
    const cfg = config || {};
    if (cfg.enabled === false) {
      this.#result = this.#createResult({ blockedReason: "disabled" });
      return this.#result;
    }

    const dt = Math.max(0, Number(dtSec) || 0);
    const capacity = this.#resolveCapacityMeters({ rod, config: cfg });
    this.#stroke.setCapacity(capacity);

    const active = !!inputState?.rodControlActive;
    const directionX = active ? Math.sign(Number(inputState?.rodControlDirectionX) || 0) : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const strokeCfg = cfg.stroke || {};
    const recoverSpeed = Math.max(
      0,
      Number(strokeCfg.recoveryRateMetersPerSecond) ||
        Number(strokeCfg.recoveryRatePerSecond) ||
        0.65,
    );
    const recoveredMeters = active ? 0 : this.#stroke.recover(recoverSpeed * dt);
    const snapshot = this.#stroke.getSnapshot();
    const minRatio = Math.max(0, Number(strokeCfg.minRatioToApply) || 0.02);
    const depleted = snapshot.depleted || snapshot.remainingMeters <= 0.000001;
    const canApply =
      active &&
      directionX !== 0 &&
      inputRatio >= minRatio &&
      capacity > 0 &&
      !depleted;
    const blockedReason = this.#resolveBlockedReason({
      active,
      directionX,
      inputRatio,
      minRatio,
      capacity,
      depleted,
    });
    const availableRatio =
      capacity > 0 ? Math.max(0, snapshot.remainingMeters / capacity) : 0;
    const forceKg = canApply
      ? this.#resolveForceKg({
          inputRatio,
          availableRatio,
          rodLimitKg,
          maxTackleLoadKg,
          fishTensionKg,
          fishWeightKg,
          config: cfg,
        })
      : 0;
    const desiredMoveMeters = canApply
      ? this.#resolveMoveMeters({
          dt,
          inputRatio,
          availableMeters: snapshot.remainingMeters,
          fishWeightKg,
          config: cfg,
        })
      : 0;
    const tensionMultiplier = canApply
      ? this.#resolveTensionMultiplier({
          directionX,
          fishVelocityX,
          config: cfg,
        })
      : 0;
    const playerTensionKg = forceKg * tensionMultiplier;

    this.#result = {
      active,
      canApply,
      directionX,
      inputRatio,
      forceKg,
      playerTensionKg,
      tensionMultiplier,
      desiredMoveMeters,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      capacityMeters: snapshot.capacityMeters,
      usedMeters: snapshot.usedMeters,
      remainingMeters: snapshot.remainingMeters,
      ratio: snapshot.ratio,
      depleted,
      recovering: !active && snapshot.usedMeters > 0,
      recoveredMeters,
      blockedReason,
      visualRatio: active ? Math.max(inputRatio, snapshot.ratio) : snapshot.ratio,
    };
    return this.#result;
  }

  recordAppliedMovement({ movedMeters = 0, movedPx = 0 } = {}) {
    const used = this.#stroke.use(movedMeters);
    const snapshot = this.#stroke.getSnapshot();
    this.#result.appliedMoveMeters = Math.max(0, Number(movedMeters) || 0);
    this.#result.appliedMovePx = Math.max(0, Number(movedPx) || 0);
    this.#result.usedMeters = snapshot.usedMeters;
    this.#result.remainingMeters = snapshot.remainingMeters;
    this.#result.ratio = snapshot.ratio;
    this.#result.depleted = snapshot.depleted;
    this.#result.usedThisFrameMeters = used;
    return this.#result;
  }

  getState() {
    return this.#result;
  }

  reset() {
    this.#stroke.reset();
    this.#result = this.#createResult();
  }

  #resolveCapacityMeters({ rod, config }) {
    const stroke = config.stroke || {};
    const direct = Number(stroke.capacityMeters ?? stroke.capacity);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const ratio = Math.max(
      0,
      Number(stroke.capacityByRodLengthRatio) || 0.5,
    );
    const rodLength =
      Number(rod?.lengthMeters) ||
      Number(rod?.getLengthMeters?.()) ||
      Number(rod?.engineStats?.lengthMeters) ||
      1;
    return Math.max(0, rodLength * ratio);
  }

  #resolveForceKg({
    inputRatio,
    availableRatio,
    rodLimitKg,
    maxTackleLoadKg,
    fishTensionKg,
    fishWeightKg,
    config,
  }) {
    const forceCfg = config.force || {};
    const configuredMax = Math.max(0, Number(forceCfg.maxForceKg) || 0.45);
    const tackleLimit = Math.max(
      0,
      Number(rodLimitKg) || Number(maxTackleLoadKg) || configuredMax,
    );
    const rodHoldLikeLimit = Math.max(
      0,
      tackleLimit - Math.max(0, Number(fishTensionKg) || 0),
    );
    const weightResistance = Math.max(
      0.15,
      1 +
        Math.max(0, Number(fishWeightKg) || 0) *
          Math.max(0, Number(forceCfg.fishWeightResistanceMultiplier) || 0),
    );
    return (
      Math.min(configuredMax, rodHoldLikeLimit || configuredMax) *
      this.#clamp01(inputRatio) *
      Math.max(0.15, this.#clamp01(availableRatio)) /
      weightResistance
    );
  }

  #resolveMoveMeters({ dt, inputRatio, availableMeters, fishWeightKg, config }) {
    const forceCfg = config.force || {};
    const speedPxPerSecond = Math.max(
      0,
      Number(forceCfg.sideMovePxPerSecond) || 120,
    );
    const pixelsPerMeter = Math.max(
      1,
      Number(config.pixelsPerMeter) ||
        Number(config.force?.pixelsPerMeter) ||
        50,
    );
    const weightResistance = Math.max(
      0.25,
      1 +
        Math.max(0, Number(fishWeightKg) || 0) *
          Math.max(0, Number(forceCfg.fishWeightResistanceMultiplier) || 0),
    );
    const desired =
      (speedPxPerSecond / pixelsPerMeter) *
      Math.max(0, dt) *
      this.#clamp01(inputRatio) /
      weightResistance;
    return Math.min(Math.max(0, Number(availableMeters) || 0), desired);
  }

  #resolveTensionMultiplier({ directionX, fishVelocityX, config }) {
    const tension = config.tension || {};
    const fishDirection = Math.sign(Number(fishVelocityX) || 0);
    if (fishDirection === 0 || directionX === 0) {
      return Math.max(0, Number(tension.sideMultiplier) || 1);
    }
    if (fishDirection !== directionX) {
      return Math.max(
        0,
        Number(tension.oppositeDirectionMultiplier ??
          tension.oppositeSideMultiplier) || 2.5,
      );
    }
    return Math.max(
      0,
      Number(tension.sameDirectionMultiplier ??
        tension.towardPlayerMultiplier) || 0,
    );
  }

  #resolveBlockedReason({ active, directionX, inputRatio, minRatio, capacity, depleted }) {
    if (!active) return "inactive";
    if (directionX === 0) return "no_direction";
    if (inputRatio < minRatio) return "below_min_ratio";
    if (capacity <= 0) return "no_capacity";
    if (depleted) return "stroke_depleted";
    return "none";
  }

  #createResult(overrides = {}) {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputRatio: 0,
      forceKg: 0,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      desiredMoveMeters: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      capacityMeters: 0,
      usedMeters: 0,
      remainingMeters: 0,
      ratio: 0,
      depleted: false,
      recovering: false,
      recoveredMeters: 0,
      usedThisFrameMeters: 0,
      blockedReason: "inactive",
      visualRatio: 0,
      ...overrides,
    };
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
