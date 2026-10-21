export class ChumZone {
  constructor(id, x, y, baitConfig, deployRealTimeMs, isDelivered = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.baitId = baitConfig.id;
    this.baitConfig = baitConfig;
    this.deployRealTimeMs = deployRealTimeMs;
    this.isDelivered = isDelivered;
    this.isExpired = false;
    this.currentBonus = 1.0;


    this.baseRadius = baitConfig.radius || 150;
  }

  updateState(realTimeNow, timeScale) {

    if (!this.isDelivered) return 0;

    const realElapsedMs = realTimeNow - this.deployRealTimeMs;
    const gameElapsedMs = realElapsedMs * timeScale;

    const cfg = this.baitConfig;
    const peakStartTime = cfg.rampUpTimeMs;
    const peakEndTime = peakStartTime + cfg.peakDurationMs;
    const totalTime = cfg.totalBonusTimeMs;
    const expireTime = totalTime + cfg.minBonusDurationHours * 3600000;

    if (gameElapsedMs >= expireTime) {
      this.isExpired = true;
      return 0;
    }

    if (gameElapsedMs < peakStartTime) {
      return 1.0 + (cfg.maxBonus - 1.0) * (gameElapsedMs / peakStartTime);
    } else if (gameElapsedMs < peakEndTime) {
      return cfg.maxBonus;
    } else if (gameElapsedMs < totalTime) {
      const progress =
        (gameElapsedMs - peakEndTime) / (totalTime - peakEndTime);
      return cfg.maxBonus - (cfg.maxBonus - cfg.minBonus) * progress;
    } else {
      return cfg.minBonus;
    }
  }


  getMultiplierAt(targetX, targetY, targetFishId, waterMetric) {
    if (this.isExpired || !this.isDelivered) return 1.0;

    if (
      targetFishId !== null &&
      !this.baitConfig.targetFishes.includes(targetFishId)
    ) {
      return 1.0;
    }


    const isInside = waterMetric.surfaceDistanceBasePixels(this.x, this.y, targetX, targetY) <= this.baseRadius;

    if (isInside) {
      return this.currentBonus;
    }
    return 1.0;
  }


  checkOverlap(otherZone, waterMetric) {
    const dist = waterMetric.surfaceDistanceBasePixels(this.x, this.y, otherZone.x, otherZone.y,
      (this.y + otherZone.y) / 2);
    const effectiveRadius = Math.max(this.baseRadius, otherZone.baseRadius);

    return dist < effectiveRadius * 0.6;
  }
}
