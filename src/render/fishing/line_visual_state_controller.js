class LineVisualStateController {
  #frame = {
    lengthRatio: 1,
    dropOffset: 0,
    straightFactor: 0,
  };
  #lastNow = 0;
  #castStartTime = null;

  update({
    state,
    nowMs,
    castStartTime,
    inputPulling,
    hookDepth,
    castDistanceRatio,
    tensionRatio,
    sinkRate,
    lineConfig,
  }) {
    if (state === "waiting" && this.#castStartTime !== castStartTime) {
      this.#castStartTime = castStartTime;
      this.#frame.lengthRatio = 1;
      this.#frame.dropOffset = 0;
      this.#frame.straightFactor = 0;
      this.#lastNow = nowMs;
    }

    const elapsed = Math.max(0, nowMs - castStartTime);
    let targetRatio = 1;
    let targetDrop = 0;
    if (state === "waiting" || state === "biting") {
      const minDelay = lineConfig.distanceDelayMinMs ?? 1500;
      const maxDelay = lineConfig.distanceDelayMaxMs ?? 5000;
      const distanceDelay =
        minDelay + castDistanceRatio * (maxDelay - minDelay);
      const duration =
        (hookDepth / Math.max(0.001, sinkRate)) * 1000 + distanceDelay;
      const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
      const ease =
        1 - Math.pow(1 - progress, lineConfig.shrinkEasePower ?? 4);
      targetRatio =
        1 - ease * (1 - (lineConfig.shrinkPercent || 0) / 100);
      targetDrop = ease * (lineConfig.sinkDropPx || 120);
      if (inputPulling) {
        targetRatio = 1;
        targetDrop = 0;
      }
    } else if (state === "playing") {
      const depthRatio = Math.min(1, hookDepth / 10);
      const snapDuration =
        (lineConfig.snapDurationMs ?? 300) *
        (1 +
          depthRatio *
            ((lineConfig.snapDepthMaxMultiplier ?? 2) - 1));
      const progress =
        snapDuration > 0 ? Math.min(1, elapsed / snapDuration) : 1;
      const ease = 1 - Math.pow(1 - progress, 3);
      const startRatio = (lineConfig.shrinkPercent || 0) / 100;
      targetRatio = startRatio + ease * (1 - startRatio);
      targetDrop = (lineConfig.sinkDropPx || 120) * (1 - ease);
    }

    const dtSec =
      this.#lastNow > 0
        ? Math.min(0.1, Math.max(0, (nowMs - this.#lastNow) / 1000))
        : 0;
    this.#lastNow = nowMs;
    this.#frame.lengthRatio = this.#approach(
      this.#frame.lengthRatio,
      targetRatio,
      targetRatio > this.#frame.lengthRatio
        ? lineConfig.pullExtendSpeed ?? 12
        : lineConfig.pullReleaseSpeed ?? 4,
      dtSec,
    );
    this.#frame.dropOffset = this.#approach(
      this.#frame.dropOffset,
      targetDrop,
      targetDrop < this.#frame.dropOffset
        ? lineConfig.pullStraightenSpeed ?? 14
        : lineConfig.pullSlackSpeed ?? 5,
      dtSec,
    );

    const targetStraight =
      state === "playing"
        ? RenderMath.clamp(tensionRatio)
        : inputPulling
          ? 1
          : 0;
    this.#frame.straightFactor = this.#approach(
      this.#frame.straightFactor,
      targetStraight,
      targetStraight > this.#frame.straightFactor
        ? lineConfig.pullStraightenSpeed ?? 14
        : lineConfig.pullSlackSpeed ?? 5,
      dtSec,
    );
    return this.#frame;
  }

  #approach(current, target, speed, dtSec) {
    if (dtSec <= 0) return current;
    const alpha = 1 - Math.exp(-Math.max(0, speed) * dtSec);
    return current + (target - current) * alpha;
  }
}
