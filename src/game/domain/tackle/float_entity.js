import { WaterEntity } from "./water_entity.js";

export class FloatEntity extends WaterEntity {
  _motionTiltEnabled = true;
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingVisualElapsed = 0;
  _sinkingDelayTimer = 0;

  cast(x, y, targetDepth, isOverDepth, ballastConfig, distanceRatio) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._motionTiltAngle = 0;
    this._pullImpulseAngle = 0;
    this._pullImpulseScaleY = 1;
    this._pullImpulseSign = 0;
    this._sinkingVisualElapsed = 0;
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();

    this._targetHookDepth = Math.max(
      this._lureRetrieveConfig().defaultSurfaceDepthMeters ?? 0.1,
      Number(targetDepth) || 0,
    );
    this._currentHookDepth = 0.1;
    this._isOverDepth = !!isOverDepth;
    this._weightedTackleConfig = ballastConfig;

    const stats = ballastConfig?.effectiveStats || ballastConfig || {};
    const weightCfg =
      stats.ballastProfiles && stats.ballastWeight
        ? stats.ballastProfiles[stats.ballastWeight]
        : stats;

    const speedMult = weightCfg.speedMult || 1.0;
    this._weightedTackleHeightScale = weightCfg.heightScale || 1.0;

    const pRange = this._config.perspectiveScaleRange || [1.3, 0.7];
    this._perspectiveScale =
      pRange[0] + distanceRatio * (pRange[1] - pRange[0]);

    this._isSinking = true;
    this._sinkingDelayTimer = this._config.sinkingDelayMs || 500;

    const maxDepth = stats.sinkingReferenceDepthMeters || 8.0;
    const depthRatio = Math.max(
      0.1,
      Math.min(1.0, this._targetHookDepth / maxDepth),
    );
    const baseSinkingTime =
      (this._config.sinkingDurationMs || 4000) * depthRatio;

    this._sinkingTotalTime = baseSinkingTime / speedMult;

    const startAngle = this._floatMotionConfig().sinkingStartAngleDeg ?? 90;
    this._sinkingStartAngle = this._chance(0.5) ? startAngle : -startAngle;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  _processMechanics(dt, input, reelPower, pullDirection) {
    const isPulling = !!(input.isPulling && pullDirection);
    if (isPulling) {
      this._redirectSinkingAngleFromPull(pullDirection);
    }

    this._updatePullImpulseTilt(dt, pullDirection, isPulling);

    if (isPulling) {
      this._advanceSinkingVisual(dt);
      this._applyPassiveRetrieve(dt, pullDirection, input.idleRetrieveParams);
      this._syncSinkingAngleToDepth();
      return;
    }

    if (!this._isSinking) return;

    if (this._sinkingDelayTimer > 0) {
      this._sinkingDelayTimer -= dt;
      return;
    }

    const isFishHolding =
      this._isBiting && this._currentColor !== this._baseColor;

    if (!isFishHolding) {
      this._advanceSinkingVisual(dt);

      const depthSpan = Math.max(0, this._targetHookDepth - 0.1);
      const depthPerMs = depthSpan / Math.max(1, this._sinkingTotalTime);
      this._currentHookDepth = Math.min(
        this._targetHookDepth,
        this._currentHookDepth + depthPerMs * dt,
      );

      if (!this._isBiting) {
        this._syncSinkingAngleToDepth();
      }

      if (
        this._currentHookDepth >= this._targetHookDepth - 0.001 &&
        this._getSinkingDepthProgress() >= 1
      ) {
        this._isSinking = false;
        this._currentHookDepth = this._targetHookDepth;
        if (!this._isBiting && !this._isOverDepth) {
          this._currentAngle = 0;
        }
      }
    }
  }

  _redirectSinkingAngleFromPull(pullDirection) {
    if (!this._isSinking && !this._isOverDepth) return;
    const impulseSign = this._getPullImpulseSign(pullDirection);
    if (impulseSign !== 0) {
      this._sinkingStartAngle =
        impulseSign * Math.abs(this._sinkingStartAngle || 90);
      this._pullImpulseSign = impulseSign;
    }

    if (this._isOverDepth) {
      this._currentAngle = this._sinkingStartAngle;
      return;
    }

    this._syncSinkingAngleToDepth();
  }

  _syncSinkingAngleToDepth() {
    if (!this._isSinking) return;
    if (this._isOverDepth) {
      this._currentAngle = this._sinkingStartAngle;
      return;
    }
    const progress = this._getSinkingDepthProgress();
    this._currentAngle = this._sinkingStartAngle * (1 - progress);
  }

  _advanceSinkingVisual(dt) {
    if (!this._isSinking) return;
    this._sinkingVisualElapsed += Math.max(0, dt);
  }

  _getSinkingDepthProgress() {
    const startDepth = 0.1;
    const span = this._targetHookDepth - startDepth;
    const depthProgress =
      span <= 0
        ? 1
        : Math.max(
            0,
            Math.min(1, (this._currentHookDepth - startDepth) / span),
          );

    const minDuration =
      this._floatMotionConfig().minStandUpDurationMs ?? 400;
    if (minDuration <= 0) return depthProgress;

    const timeProgress = Math.max(
      0,
      Math.min(1, this._sinkingVisualElapsed / minDuration),
    );
    return Math.min(depthProgress, timeProgress);
  }

  _updatePullImpulseTilt(dt, pullDirection, isPulling) {
    const cfg = this._floatMotionConfig();
    if (cfg.enabled === false) {
      this._pullImpulseAngle = 0;
      return;
    }

    const dtSec = Math.max(0.001, dt / 1000);
    let targetAngle = 0;
    let targetScaleY = 1;

    if (isPulling) {
      const impulseSign = this._getPullImpulseSign(pullDirection);
      if (impulseSign !== 0) {
        this._pullImpulseSign = impulseSign;
        targetAngle = impulseSign * (cfg.pullImpulseOvershootDeg ?? 14);
      }

      const pullDepth = Math.abs(pullDirection?.y || 0);
      const depthDeadZone = cfg.pullImpulseDepthDeadZone ?? 0.02;
      if (pullDepth > depthDeadZone) {
        const maxDrop = cfg.pullImpulseDepthScaleDrop ?? 0.45;
        targetScaleY = Math.max(0.2, 1 - pullDepth * maxDrop);
      }
    }

    const speed = isPulling
      ? (cfg.pullImpulseResponseSpeed ?? 32)
      : (cfg.pullImpulseDecaySpeed ?? 8);
    const alpha = 1 - Math.exp(-Math.max(0, speed) * dtSec);
    this._pullImpulseAngle += (targetAngle - this._pullImpulseAngle) * alpha;
    this._pullImpulseScaleY +=
      (targetScaleY - this._pullImpulseScaleY) * alpha;
  }

  _getPullImpulseSign(pullDirection) {
    const cfg = this._floatMotionConfig();
    const pullX = pullDirection?.x || 0;
    const deadZone = cfg.pullImpulseLateralDeadZone ?? 0.02;
    return Math.abs(pullX) > deadZone ? -Math.sign(pullX) : 0;
  }
}
