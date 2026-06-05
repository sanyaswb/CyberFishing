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
    const enabled = cfg.enabled !== false;
    const active = enabled && !!inputState?.rodControlActive;
    const direction = active
      ? Math.sign(Number(inputState?.rodControlDirectionX) || 0)
      : 0;
    const inputRatio = active
      ? this.#clamp01(inputState?.rodControlInputRatio)
      : 0;
    const width = Math.max(0, Number(canvasWidth) || 0);
    const maxOffsetPx = Math.max(
      Number(visualCfg.fallbackMaxOffsetPx) || 55,
      width * Math.max(
        0,
        Number(visualCfg.maxOffsetScreenRatio) || 0.05,
      ),
    );
    const weightSpeedRatio = this.#resolveWeightSpeedRatio({
      fishWeightKg: fightDebug?.fishWeightKg,
      rodMaxLoadKg: fightDebug?.rodMaxLoadKg,
      config: visualCfg.weightSpeed,
    });
    const targetOffsetPx =
      direction * maxOffsetPx * inputRatio;
    const responsiveness = active
      ? Number(visualCfg.moveResponsiveness) || 8
      : Number(visualCfg.returnResponsiveness) ||
        Number(visualCfg.returnSmoothing) ||
        5;
    const previousOffset = this.#offsetPx;

    this.#offsetPx = this.#approach(
      this.#offsetPx,
      targetOffsetPx,
      responsiveness * weightSpeedRatio,
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
      drivenByInput: active,
    };
    return this.#offsetPx;
  }

  resolveScreenX({
    baseX,
    canvasWidth,
    playableLeft = null,
    playableRight = null,
    config,
  }) {
    const visualCfg = config?.rodVisual || {};
    const padding = Math.max(0, Number(visualCfg.edgePaddingPx) || 16);
    const width = Math.max(1, Number(canvasWidth) || 1);
    let minX = padding;
    let maxX = Math.max(minX, width - padding);

    if (visualCfg.clampToPlayableZone !== false) {
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

  #resolveWeightSpeedRatio({
    fishWeightKg,
    rodMaxLoadKg,
    config,
  }) {
    const maxLoad = Math.max(0, Number(rodMaxLoadKg) || 0);
    if (maxLoad <= 0) return 1;
    const weightRatio = Math.max(
      0,
      (Number(fishWeightKg) || 0) / maxLoad,
    );
    const fullSpeedAt = this.#clamp01(
      config?.fullSpeedMaxWeightRatio ?? 0.3,
    );
    const minimumSpeedAt = Math.max(
      fullSpeedAt + 0.000001,
      Number(config?.minimumSpeedWeightRatio) || 1,
    );
    const minimumSpeed = this.#clamp01(
      config?.minimumSpeedRatio ?? 0.5,
    );
    if (weightRatio <= fullSpeedAt) return 1;
    if (weightRatio >= minimumSpeedAt) return minimumSpeed;
    const progress =
      (weightRatio - fullSpeedAt) /
      (minimumSpeedAt - fullSpeedAt);
    return 1 + (minimumSpeed - 1) * progress;
  }

  #approach(current, target, speed, dtSec) {
    const dt = Math.max(0, Number(dtSec) || 0);
    if (dt <= 0) return current;
    const alpha = 1 - Math.exp(-Math.max(0, Number(speed) || 0) * dt);
    return current + (target - current) * alpha;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
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
      drivenByInput: false,
    };
  }
}
