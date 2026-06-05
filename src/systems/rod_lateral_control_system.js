class RodLateralControlSystem {
  #result = this.#createResult();

  update({
    dtSec,
    inputState,
    fishPosition,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
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

    const active = !!inputState?.rodControlActive;
    const directionX = active
      ? Math.sign(this.#number(inputState?.rodControlDirectionX))
      : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const hasFish = this.#hasPoint(fishPosition);
    const forceFrame = this.#resolveForceFrame({
      inputRatio,
      rodLimitKg,
      maxTackleLoadKg,
      currentTensionKg,
      fishTensionKg,
      fishWeightKg,
      config: cfg,
    });
    const deliveredForceRatio = this.#clamp01(
      inputRatio * forceFrame.loadReserveRatio,
    );
    const forceKg = forceFrame.forceKg;
    const moveFrame = this.#resolveMoveFrame({
      dtSec,
      forceKg,
      config: cfg,
    });
    const canApply =
      active &&
      hasFish &&
      directionX !== 0 &&
      inputRatio > 0 &&
      forceFrame.loadReserveKg > 0 &&
      forceKg > 0 &&
      moveFrame.desiredMoveMeters > 0;
    const tensionMultiplier = this.#resolveTensionMultiplier({
      controlDirectionX: directionX,
      fishVelocityX,
      config: cfg,
    });

    this.#result = this.#createResult({
      active,
      canApply,
      directionX,
      inputDirectionX: directionX,
      inputRatio,
      requestedForceRatio: inputRatio,
      loadReserveKg: forceFrame.loadReserveKg,
      loadReserveRatio: forceFrame.loadReserveRatio,
      forceLimitKg: forceFrame.forceLimitKg,
      currentTensionKg: forceFrame.currentTensionKg,
      deliveredForceRatio: canApply ? deliveredForceRatio : 0,
      forceKg: canApply ? forceKg : 0,
      playerTensionKg: canApply ? forceKg * tensionMultiplier : 0,
      tensionMultiplier,
      desiredMoveMeters: canApply ? moveFrame.desiredMoveMeters : 0,
      desiredMovePx: canApply ? moveFrame.desiredMovePx : 0,
      maxPullSpeedMetersPerSecond:
        moveFrame.maxPullSpeedMetersPerSecond,
      visualControlRatio: inputRatio,
      blockedReason: this.#blockedReason({
        active,
        hasFish,
        directionX,
        inputRatio,
        loadReserveKg: forceFrame.loadReserveKg,
        forceKg,
      }),
    });
    return this.#result;
  }

  recordAppliedMovement({ movedMeters = 0, movedPx = 0 } = {}) {
    const desiredMoveMeters = Math.max(
      0,
      this.#number(this.#result.desiredMoveMeters),
    );
    const appliedMoveMeters = Math.max(0, this.#number(movedMeters));
    this.#result.appliedMoveMeters = appliedMoveMeters;
    this.#result.appliedMovePx = Math.max(0, this.#number(movedPx));
    this.#result.actualMovementRatio = desiredMoveMeters > 0
      ? this.#clamp01(appliedMoveMeters / desiredMoveMeters)
      : 0;
    return this.#result;
  }

  getState() {
    return this.#result;
  }

  reset() {
    this.#result = this.#createResult();
  }

  #resolveForceFrame({
    inputRatio,
    rodLimitKg,
    maxTackleLoadKg,
    currentTensionKg,
    fishTensionKg,
    fishWeightKg,
    config,
  }) {
    const forceCfg = config.force || {};
    const maxForceKg = Math.max(
      0,
      this.#number(forceCfg.maxForceKg, 0.22),
    );
    const tackleLimitKg = Math.max(
      0,
      this.#number(
        rodLimitKg,
        this.#number(maxTackleLoadKg, maxForceKg),
      ),
    );
    const resolvedCurrentTensionKg = Math.max(
      0,
      this.#number(currentTensionKg, this.#number(fishTensionKg)),
    );
    const loadReserveKg = Math.max(
      0,
      tackleLimitKg - resolvedCurrentTensionKg,
    );
    const forceLimitKg = Math.min(maxForceKg, loadReserveKg);
    const loadReserveRatio = maxForceKg > 0
      ? this.#clamp01(forceLimitKg / maxForceKg)
      : 0;
    const weightResistance = Math.max(
      0.25,
      1 +
        Math.max(0, this.#number(fishWeightKg)) *
          Math.max(
            0,
            this.#number(forceCfg.fishWeightResistanceMultiplier),
          ),
    );
    return {
      currentTensionKg: resolvedCurrentTensionKg,
      loadReserveKg,
      loadReserveRatio,
      forceLimitKg,
      forceKg:
        forceLimitKg * this.#clamp01(inputRatio) / weightResistance,
    };
  }

  #resolveMoveFrame({ dtSec, forceKg, config }) {
    const forceCfg = config.force || {};
    const waterCfg = config.water || {};
    const pixelsPerMeter = Math.max(
      1,
      this.#number(config.pixelsPerMeter, 50),
    );
    const resistance = Math.max(
      0.000001,
      this.#number(waterCfg.motionResistance, 1000),
    );
    const maxPullSpeedMetersPerSecond =
      Math.sqrt(Math.max(0, this.#number(forceKg)) / resistance) *
      Math.max(0, this.#number(waterCfg.speedMultiplier, 64)) *
      Math.max(
        0,
        this.#number(forceCfg.sidePullSpeedMultiplier, 1),
      );
    const desiredMoveMeters =
      maxPullSpeedMetersPerSecond *
      Math.max(0, this.#number(dtSec));
    return {
      desiredMoveMeters,
      desiredMovePx: desiredMoveMeters * pixelsPerMeter,
      maxPullSpeedMetersPerSecond,
    };
  }

  #resolveTensionMultiplier({ controlDirectionX, fishVelocityX, config }) {
    const tension = config.tension || {};
    const fishDirection = Math.sign(this.#number(fishVelocityX));
    if (fishDirection === 0 || controlDirectionX === 0) {
      return Math.max(0, this.#number(tension.sideMultiplier, 1));
    }
    if (fishDirection === controlDirectionX) {
      return Math.max(
        0,
        this.#number(tension.sameDirectionMultiplier, 0),
      );
    }
    return Math.max(
      0,
      this.#number(tension.oppositeDirectionMultiplier, 2.5),
    );
  }

  #blockedReason({
    active,
    hasFish,
    directionX,
    inputRatio,
    loadReserveKg,
    forceKg,
  }) {
    if (!active) return "no_input";
    if (!hasFish) return "no_fish";
    if (directionX === 0 || inputRatio <= 0) return "dead_zone";
    if (loadReserveKg <= 0) return "no_load_reserve";
    if (forceKg <= 0) return "no_force";
    return "none";
  }

  #hasPoint(point) {
    return (
      point &&
      Number.isFinite(Number(point.x)) &&
      Number.isFinite(Number(point.y))
    );
  }

  #createResult(overrides = {}) {
    return {
      active: false,
      canApply: false,
      directionX: 0,
      inputDirectionX: 0,
      inputRatio: 0,
      requestedForceRatio: 0,
      loadReserveKg: 0,
      loadReserveRatio: 0,
      forceLimitKg: 0,
      currentTensionKg: 0,
      deliveredForceRatio: 0,
      forceKg: 0,
      playerTensionKg: 0,
      tensionMultiplier: 0,
      desiredMoveMeters: 0,
      desiredMovePx: 0,
      appliedMoveMeters: 0,
      appliedMovePx: 0,
      actualMovementRatio: 0,
      maxPullSpeedMetersPerSecond: 0,
      visualControlRatio: 0,
      blockedReason: "no_input",
      ...overrides,
    };
  }

  #number(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, this.#number(value)));
  }
}
