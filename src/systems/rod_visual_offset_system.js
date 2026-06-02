class RodVisualOffsetSystem {
  #offsetPx = 0;
  #clamped = false;

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
    const active =
      !!fightDebug?.rodControlActive ||
      !!inputState?.rodControlActive;
    const direction = Math.sign(
      Number(fightDebug?.rodControlInputDirectionX) ||
        Number(fightDebug?.rodControlDirectionX) ||
        Number(inputState?.rodControlDirectionX) ||
        0,
    );
    const ratio = Math.max(
      0,
      Math.min(
        1,
        Number(fightDebug?.rodControlVisualRatio) ||
          Number(inputState?.rodControlInputRatio) ||
          0,
      ),
    );
    const width = Math.max(0, Number(canvasWidth) || 0);
    const maxOffset = Math.max(
      Number(visualCfg.fallbackMaxOffsetPx) || 80,
      width * Math.max(0, Number(visualCfg.maxOffsetScreenRatio) || 0.08),
    );
    const target = active && direction !== 0
      ? direction * maxOffset * ratio
      : 0;
    const speed = active
      ? Number(visualCfg.moveSmoothing) || 14
      : Number(visualCfg.returnSmoothing) || 8;
    this.#offsetPx = this.#approach(this.#offsetPx, target, speed, dtSec);
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

  reset() {
    this.#offsetPx = 0;
    this.#clamped = false;
  }

  #approach(current, target, speed, dtSec) {
    const dt = Math.max(0, Number(dtSec) || 0);
    if (dt <= 0) return current;
    const alpha = 1 - Math.exp(-Math.max(0, Number(speed) || 0) * dt);
    return current + (target - current) * alpha;
  }
}
