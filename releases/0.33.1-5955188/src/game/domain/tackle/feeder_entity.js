import { WaterEntity } from "./water_entity.js";

export class FeederEntity extends WaterEntity {
  _sinkingTimer = 0;
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingStartAngle = 90;

  cast(x, y, targetDepth, isOverDepth, rigConfig, distanceRatio) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();

    this._targetHookDepth = targetDepth;
    this._currentHookDepth = 0.1;
    this._weightedTackleConfig = rigConfig;

    const stats = rigConfig?.effectiveStats || rigConfig || {};
    const weightCfg =
      stats.weights && stats.weight ? stats.weights[stats.weight] : stats;
    const speedMult = weightCfg.speedMult || stats.speedMult || 1.5;
    this._weightedTackleHeightScale =
      weightCfg.heightScale || stats.heightScale || 1.0;
    this._isSinking = true;
    this._sinkingTotalTime = (targetDepth / speedMult) * 1000;
    this._sinkingTimer = this._sinkingTotalTime;

    this._sinkingStartAngle = this._chance(0.5) ? 90 : -90;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  _processMechanics(dt, input, reelPower, pullDirection) {
    if (input.isPulling && pullDirection) {
      this._applyPassiveRetrieve(dt, pullDirection, input.idleRetrieveParams);
      return;
    }

    if (!this._isSinking) return;

    this._sinkingTimer -= dt;
    let progress =
      1.0 - Math.max(0, this._sinkingTimer / this._sinkingTotalTime);

    this._currentHookDepth = this._lerp(0.1, this._targetHookDepth, progress);
    this._currentAngle = this._lerp(this._sinkingStartAngle, 0, progress);

    if (this._sinkingTimer <= 0) {
      this._isSinking = false;
      this._currentHookDepth = this._targetHookDepth;
      this._currentAngle = 0;
    }
  }

  isBottomLocked() {
    return !this._isSinking;
  }

  getEffectiveHookDepth(bottomDepth) {
    const depth = Math.max(0, bottomDepth || 0);
    return this.isBottomLocked()
      ? depth
      : Math.min(this._currentHookDepth, depth);
  }

  getEffectiveLineLength(bottomDepth) {
    return this.getEffectiveHookDepth(bottomDepth);
  }

  _afterPhysicsUpdate(checkWater) {
    if (this._isSinking || !checkWater) return;
    const cell = checkWater(this._position.x, this._position.y);
    if (!cell) return;
    this._syncToBottomDepth(cell.depth);
  }

  _syncToBottomDepth(bottomDepth) {
    const depth = Math.max(0, bottomDepth || 0);
    this._targetHookDepth = depth;
    this._currentHookDepth = depth;
  }

  getChumBonus(elapsedMs, chumConfig) {
    if (!chumConfig) return { bonus: 1.0, targets: [] };

    const rampUpTime = Math.max(0, chumConfig.rampUpTimeMs || 0);
    const peakDuration = Math.max(0, chumConfig.peakDurationMs || 0);
    const totalTime = Math.max(
      1,
      chumConfig.totalBonusTimeMs || rampUpTime + peakDuration || 300000,
    );
    const peakStartTime = Math.min(rampUpTime, totalTime);
    const peakEndTime = Math.min(peakStartTime + peakDuration, totalTime);
    const maxBonus = Math.max(1.0, chumConfig.maxBonus ?? 1.0);
    const targets = chumConfig.targetFishes || [];

    if (elapsedMs >= totalTime) {
      return { bonus: 1.0, targets: [], isExpired: true };
    }

    if (peakStartTime > 0 && elapsedMs < peakStartTime) {
      const progress = elapsedMs / peakStartTime;
      const bonus = 1.0 + (maxBonus - 1.0) * progress;
      return { bonus, targets };
    }

    if (elapsedMs < peakEndTime) {
      return { bonus: maxBonus, targets };
    }

    const decayDuration = Math.max(1, totalTime - peakEndTime);
    const decayProgress = (elapsedMs - peakEndTime) / decayDuration;
    const bonus = maxBonus - (maxBonus - 1.0) * decayProgress;
    return { bonus: Math.max(1.0, bonus), targets };
  }
}
