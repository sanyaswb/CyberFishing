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
    if (cfg.enabled === false) {
      this.#offsetPx = this.#approach(this.#offsetPx, 0, 12, dtSec);
      this.#clamped = false;
      return this.#offsetPx;
    }

    const visualCfg = cfg.rodVisual || {};
    const direction = Math.sign(
      Number(fightDebug?.rodControlInputDirectionX) ||
        Number(inputState?.rodControlDirectionX) ||
        0,
    );
    const inputRatio = this.#clamp01(
      fightDebug?.rodControlInputRatio ??
        inputState?.rodControlInputRatio,
    );
    const active = !!inputState?.rodControlActive;
    const couplingMode =
      fightDebug?.rodControlCouplingMode ||
      (active ? "tight_line" : "free");
    const width = Math.max(0, Number(canvasWidth) || 0);
    const maxOffset = Math.max(
      Number(visualCfg.fallbackMaxOffsetPx) || 80,
      width * Math.max(0, Number(visualCfg.maxOffsetScreenRatio) || 0.08),
    );
    const previousOffset = this.#offsetPx;
    const fishDriven =
      active &&
      couplingMode === "tight_line" &&
      fightDebug?.rodControlVisualDrivenByFish !== false;
    const inputDriven =
      active &&
      couplingMode === "drag_slip" &&
      fightDebug?.rodControlVisualDrivenByInput !== false;

    if (fishDriven && direction !== 0) {
      const appliedMovePx = Math.max(
        0,
        Number(fightDebug?.rodControlMovePx) || 0,
      );
      const followRatio = Math.max(
        0,
        Number(visualCfg.followFishMovementRatio) || 1,
      );
      this.#offsetPx += direction * appliedMovePx * followRatio;
    } else if (inputDriven && direction !== 0) {
      const target = direction * maxOffset * inputRatio;
      this.#offsetPx = this.#approach(
        this.#offsetPx,
        target,
        Number(visualCfg.dragSlipResponsiveness) || 10,
        dtSec,
      );
    } else if (!active || couplingMode === "free") {
      this.#offsetPx = this.#approach(
        this.#offsetPx,
        0,
        Number(visualCfg.returnSmoothing) || 5,
        dtSec,
      );
    }

    this.#offsetPx = Math.max(-maxOffset, Math.min(maxOffset, this.#offsetPx));
    const strokeRatio = maxOffset > 0
      ? this.#clamp01(Math.abs(this.#offsetPx) / maxOffset)
      : 0;
    this.#frame = {
      offsetPx: this.#offsetPx,
      deltaPx: this.#offsetPx - previousOffset,
      maxOffsetPx: maxOffset,
      strokeRatio,
      atLimit: strokeRatio >= this.#clamp01(
        config?.reelHold?.limitRatio ?? 0.98,
      ),
      couplingMode,
      drivenByFish: fishDriven,
      drivenByInput: inputDriven,
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
    const minCanvasX = padding;
    const maxCanvasX = Math.max(minCanvasX, width - padding);
    let minX = minCanvasX;
    let maxX = maxCanvasX;

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
      couplingMode: "free",
      drivenByFish: false,
      drivenByInput: false,
    };
  }
}
