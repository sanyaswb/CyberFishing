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

    // Читаємо єдиний радіус
    this.baseRadius = baitConfig.radius || 150;
  }

  updateState(realTimeNow, timeScale) {
    // ... (Цей метод залишається без змін, він працює ідеально)
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

  // ЗАМІНА: Замість top/bottom отримуємо проектор
  getMultiplierAt(targetX, targetY, targetFishId, projector) {
    if (this.isExpired || !this.isDelivered) return 1.0;

    if (
      targetFishId !== null &&
      !this.baitConfig.targetFishes.includes(targetFishId)
    ) {
      return 1.0;
    }

    // 1. Отримуємо нову тригонометричну перспективу
    const perspective = projector.getPerspective(this.y);

    // 2. ДИНАМІЧНИЙ РАДІУС (Точна копія логіки з рендерера)
    // Масштабуємо фізичний радіус вдалині та сплющуємо його
    const currentRadX = this.baseRadius * perspective.scale;
    const currentRadY = currentRadX * perspective.squashY;

    const dx = targetX - this.x;
    const dy = targetY - this.y;

    const isInside =
      (dx * dx) / (currentRadX * currentRadX) +
        (dy * dy) / (currentRadY * currentRadY) <=
      1;

    if (isInside) {
      return this.currentBonus;
    }
    return 1.0;
  }

  // ЗАМІНА: Тепер враховує перспективу при накладанні
  checkOverlap(otherZone, projector) {
    const perspective = projector.getPerspective(this.y);

    const dx = this.x - otherZone.x;
    // Нормалізуємо Y через новий squashY, перетворюючи еліпс назад у коло для перевірки
    const dy = (this.y - otherZone.y) / perspective.squashY;

    const dist = Math.hypot(dx, dy);

    // Масштаб впливає на те, наскільки великою зона здається фізично
    const effectiveRadius =
      Math.max(this.baseRadius, otherZone.baseRadius) * perspective.scale;

    return dist < effectiveRadius * 0.6;
  }
}
