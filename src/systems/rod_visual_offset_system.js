class RodVisualOffsetSystem {
  #offsetPx = 0;
  #clamped = false;
  #frame = this.#createFrame();

  update({
    dtSec,
    inputState,
    fightDebug,
    config,
    canvasWidth,
  } = {}) {
    const cfg = config || {};
    const visualCfg = cfg.rodVisual || {};
    const aimCfg = cfg.rodAim || {};
    const enabled = cfg.enabled !== false && aimCfg.enabled !== false;
    const active = enabled && !!inputState?.rodControlActive;
    const inputDirection = active
      ? Math.sign(Number(inputState?.rodControlDirectionX) || 0)
      : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const direction = this.#resolveControlDirection({
      active,
      inputDirection,
      fightDebug,
    });
    const width = Math.max(0, Number(canvasWidth) || 0);
    const maxOffsetPx = Math.max(
      Number(aimCfg.fallbackMaxOffsetPx) ||
        Number(visualCfg.fallbackMaxOffsetPx) ||
        55,
      width * Math.max(
        0,
        Number(aimCfg.maxOffsetScreenRatio) ||
          Number(visualCfg.maxOffsetScreenRatio) ||
          0.05,
      ),
    );

    const lineModeFrame = this.#resolveLineMode({ fightDebug, visualCfg, aimCfg });
    const directionFrame = this.#resolveDirectionSpeedFrame({
      fightDebug,
      lineModeFrame,
    });
    const weightSpeedFrame = this.#resolveWeightSpeedFrame({
      fishWeightKg: fightDebug?.fishWeightKg,
      fishTensionKg: fightDebug?.fishTensionKg,
      rodMaxLoadKg: fightDebug?.rodMaxLoadKg,
      maxTackleLoadKg: fightDebug?.maxTackleLoadKg,
      config: aimCfg,
    });
    const weightSpeedRatio = weightSpeedFrame.ratio;
    const loadSpeedRatio = this.#resolveLoadSpeedRatio({
      loadReserveRatio: fightDebug?.rodControlLoadReserveRatio,
      config: aimCfg,
    });

    const previousOffset = this.#offsetPx;
    let targetOffsetPx = 0;
    let mode = "return";
    let drivenByInput = false;
    let speedPxPerSecond = Math.max(
      0,
      Number(aimCfg.baseAimSpeedPxPerSecond) ||
        Number(visualCfg.baseAimSpeedPxPerSecond) ||
        120,
    );

    if (active && direction !== 0 && inputRatio > 0) {
      mode = lineModeFrame.mode;
      drivenByInput = true;
      targetOffsetPx = direction * maxOffsetPx * inputRatio;
      speedPxPerSecond *=
        directionFrame.speedMultiplier * weightSpeedRatio * loadSpeedRatio;
    } else {
      speedPxPerSecond *= Math.max(
        0,
        Number(aimCfg.returnSpeedMultiplier) ||
          Number(visualCfg.returnSpeedMultiplier) ||
          0.75,
      );
    }

    this.#offsetPx = this.#approachBySpeed(
      this.#offsetPx,
      targetOffsetPx,
      speedPxPerSecond,
      dtSec,
    );

    this.#offsetPx = Math.max(
      -maxOffsetPx,
      Math.min(maxOffsetPx, this.#offsetPx),
    );
    const strokeRatio = maxOffsetPx > 0
      ? this.#clamp01(Math.abs(this.#offsetPx) / maxOffsetPx)
      : 0;
    this.#frame = {
      offsetPx: this.#offsetPx,
      deltaPx: this.#offsetPx - previousOffset,
      maxOffsetPx,
      strokeRatio,
      atLimit: strokeRatio >= 0.999,
      targetOffsetPx,
      inputRatio,
      weightSpeedRatio,
      weightLoadRatio: weightSpeedFrame.loadRatio,
      effectiveFishLoadKg: weightSpeedFrame.effectiveFishLoadKg,
      weightLoadLimitKg: weightSpeedFrame.loadLimitKg,
      weightCurvePower: weightSpeedFrame.curvePower,
      weightSpeedMinRatio: weightSpeedFrame.minRatio,
      weightSpeedMaxRatio: weightSpeedFrame.maxRatio,
      loadSpeedRatio,
      lineSpeedRatio: lineModeFrame.speedMultiplier,
      directionSpeedRatio: directionFrame.speedMultiplier,
      directionSpeedMode: directionFrame.mode,
      fishMoveX: directionFrame.fishMoveX,
      fishMoveDirectionX: directionFrame.fishMoveDirectionX,
      aimSpeedPxPerSecond: speedPxPerSecond,
      drivenByInput,
      mode,
      freeLineMode: lineModeFrame.freeLineMode,
      lineMode: lineModeFrame.lineMode,
    };
    return this.#offsetPx;
  }

  resolveScreenX({
    baseX,
    canvasWidth,
    playableLeft,
    playableRight,
    config,
  } = {}) {
    const visualCfg = config?.rodVisual || {};
    const aimCfg = config?.rodAim || {};
    const padding = Math.max(
      0,
      Number(aimCfg.edgePaddingPx) || Number(visualCfg.edgePaddingPx) || 16,
    );
    const width = Math.max(1, Number(canvasWidth) || 1);
    let minX = padding;
    let maxX = Math.max(minX, width - padding);

    const clampToPlayable = aimCfg.clampToPlayableZone !== undefined
      ? aimCfg.clampToPlayableZone !== false
      : visualCfg.clampToPlayableZone !== false;
    if (clampToPlayable) {
      if (Number.isFinite(Number(playableLeft))) {
        minX = Math.max(minX, Number(playableLeft) + padding);
      }
      if (Number.isFinite(Number(playableRight))) {
        maxX = Math.min(maxX, Number(playableRight) - padding);
      }
    }

    const resolvedBase = Number.isFinite(Number(baseX))
      ? Number(baseX)
      : width / 2;
    const rawX = resolvedBase + this.#offsetPx;
    const clampedX = Math.max(minX, Math.min(maxX, rawX));
    this.#clamped = Math.abs(clampedX - rawX) > 0.001;
    return clampedX;
  }

  getOffsetPx() {
    return this.#offsetPx;
  }

  isClamped() {
    return this.#clamped;
  }

  getFrame() {
    return this.#frame;
  }

  reset() {
    this.#offsetPx = 0;
    this.#clamped = false;
    this.#frame = this.#createFrame();
  }

  #resolveControlDirection({ active, inputDirection, fightDebug }) {
    if (!active) return 0;
    const requestedDirection = Math.sign(Number(inputDirection) || 0);
    if (requestedDirection === 0) return 0;

    const blockedReason =
      fightDebug?.rodControlBlockedReason ||
      fightDebug?.rodControlMovementBlockReason ||
      "none";
    if (blockedReason === "wrong_direction") return 0;

    const directionFactor = Number(fightDebug?.rodControlDirectionFactor);
    if (Number.isFinite(directionFactor) && directionFactor <= 0) return 0;

    const physicalDirection = Math.sign(
      Number(fightDebug?.rodControlDirectionX) || 0,
    );
    if (physicalDirection !== 0 && requestedDirection !== physicalDirection) {
      return 0;
    }
    return physicalDirection || requestedDirection;
  }

  #resolveDirectionSpeedFrame({
    fightDebug,
    lineModeFrame,
  }) {
    const fishMoveX = this.#firstFiniteNumber(
      fightDebug?.fishVelocityX,
      fightDebug?.fishMoveX,
      fightDebug?.targetVelocityX,
      fightDebug?.forces?.fX,
      fightDebug?.rodControlFishVelocityX,
      0,
    );
    const fishMoveDirectionX = Math.sign(fishMoveX);
    return {
      mode: lineModeFrame?.lineMode || "line_state",
      fishMoveX,
      fishMoveDirectionX,
      speedMultiplier: lineModeFrame?.speedMultiplier ?? 1,
    };
  }

  #resolveLineMode({ fightDebug, visualCfg, aimCfg }) {
    const canRelease = !!fightDebug?.lineCanRelease ||
      Number(fightDebug?.lineRemainingMeters) > 0;
    const didSlip = !!fightDebug?.reelSlip ||
      !!fightDebug?.shouldSlipDrag ||
      Number(fightDebug?.lineReleasedThisFrameMeters) > 0;

    if (didSlip) {
      return {
        mode: "drag_slip_aim",
        lineMode: "drag_slip",
        freeLineMode: true,
        speedMultiplier: Math.max(
          0,
          Number(aimCfg.dragSlipAimMultiplier) || 1.3,
        ),
      };
    }

    if (canRelease && visualCfg.freeLineUsesInputDrivenVisual !== false) {
      return {
        mode: "free_line_aim",
        lineMode: "free_line",
        freeLineMode: true,
        speedMultiplier: Math.max(
          0,
          Number(aimCfg.freeLineAimMultiplier) || 1,
        ),
      };
    }

    return {
      mode: "tight_line_aim",
      lineMode: "tight_line",
      freeLineMode: false,
      speedMultiplier: Math.max(
        0,
        Number(aimCfg.tightLineAimMultiplier) || 0.35,
      ),
    };
  }

  #resolveWeightSpeedFrame({
    fishWeightKg,
    fishTensionKg,
    rodMaxLoadKg,
    maxTackleLoadKg,
    config,
  }) {
    const minRatio = this.#clamp01(config?.fishLoadMinSpeedRatio ?? 0.5);
    const maxRatio = Math.max(minRatio, Number(config?.fishLoadMaxSpeedRatio) || 1.1);
    const curvePower = Math.max(0.1, Number(config?.fishLoadCurvePower) || 1.0);
    const fishWeight = Math.max(0, Number(fishWeightKg) || 0);
    const fishTension = Math.max(0, Number(fishTensionKg) || 0);
    const effectiveFishLoadKg = Math.max(fishWeight, fishTension);
    const loadLimitKg = Math.max(
      0,
      Number(rodMaxLoadKg) || Number(maxTackleLoadKg) || 0,
    );

    if (effectiveFishLoadKg <= 0 || loadLimitKg <= 0) {
      return {
        ratio: maxRatio,
        loadRatio: 0,
        effectiveFishLoadKg,
        loadLimitKg,
        curvePower,
        minRatio,
        maxRatio,
      };
    }

    const loadRatio = this.#clamp01(effectiveFishLoadKg / loadLimitKg);
    const curvedLoadRatio = Math.pow(loadRatio, curvePower);
    const ratio = maxRatio - (maxRatio - minRatio) * curvedLoadRatio;

    return {
      ratio: this.#clamp(ratio, minRatio, maxRatio),
      loadRatio,
      effectiveFishLoadKg,
      loadLimitKg,
      curvePower,
      minRatio,
      maxRatio,
    };
  }

  #resolveLoadSpeedRatio({ loadReserveRatio, config }) {
    const minRatio = this.#clamp01(config?.minimumLoadSpeedRatio ?? 0.35);
    const parsed = Number(loadReserveRatio);
    if (!Number.isFinite(parsed)) return 1;
    return minRatio + (1 - minRatio) * this.#clamp01(parsed);
  }

  #approachBySpeed(current, target, speedPxPerSecond, dtSec) {
    const dt = Math.max(0, Number(dtSec) || 0);
    if (dt <= 0) return current;
    const maxStep = Math.max(0, Number(speedPxPerSecond) || 0) * dt;
    const delta = target - current;
    if (Math.abs(delta) <= maxStep) return target;
    return current + Math.sign(delta) * maxStep;
  }

  #firstFiniteNumber(...values) {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
  }

  #clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return min;
    return Math.max(min, Math.min(max, parsed));
  }

  #clamp01(value) {
    return this.#clamp(value, 0, 1);
  }

  #createFrame() {
    return {
      offsetPx: 0,
      deltaPx: 0,
      maxOffsetPx: 0,
      strokeRatio: 0,
      atLimit: false,
      targetOffsetPx: 0,
      inputRatio: 0,
      weightSpeedRatio: 1,
      weightLoadRatio: 0,
      effectiveFishLoadKg: 0,
      weightLoadLimitKg: 0,
      weightCurvePower: 1,
      weightSpeedMinRatio: 0.5,
      weightSpeedMaxRatio: 1.1,
      loadSpeedRatio: 1,
      lineSpeedRatio: 1,
      directionSpeedRatio: 1,
      directionSpeedMode: "line_state",
      fishMoveX: 0,
      fishMoveDirectionX: 0,
      aimSpeedPxPerSecond: 0,
      drivenByInput: false,
      mode: "return",
      freeLineMode: false,
      lineMode: "tight_line",
    };
  }
}
