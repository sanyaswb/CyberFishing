import { WaterEntity } from "./water_entity.js";

// The float rig: after the cast it lies on the water and stands up as the shot sinks to the selected depth; over the
// bottom (over-depth) it keeps lying. Its drawn lean and submersion are not written here: getPoseSignals() hands the
// intended lean, the load and the forces to FloatPoseAnimator (spec 127), which adds them up through damped springs.
export class FloatEntity extends WaterEntity {
  _isSinking = false;
  _sinkingTotalTime = 0;
  _sinkingVisualElapsed = 0;
  _sinkingDelayTimer = 0;
  _castSerial = 0;
  _restDraft = 0;
  _linePull = { x: 0, y: 0 };
  _poseSignals = {
    castSerial: 0, angleDeg: 0, scaleY: 1, isBiteTilt: false, load: 1, lyingSide: 1, restDraft: 0, windDeg: 0,
    lineX: 0, lineY: 0, waterX: 0, waterY: 0,
  };

  cast(x, y, targetDepth, isOverDepth, ballastConfig) {
    this._position.set(x, y);
    this._velocity.set(0, 0);
    this._sinkingVisualElapsed = 0;
    this._isHooked = false;
    this._isBiting = false;
    this.stopBite();
    this._castSerial += 1;
    this._linePull.x = 0;
    this._linePull.y = 0;

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
    // Share of the body under water at rest: heavier ballast sinks the same float deeper (spec 127).
    this._restDraft = Math.max(0, Math.min(1, Number(weightCfg.restDraft) || 0));

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

    const startAngle = this._floatPoseConfig().lyingAngleDeg ?? 90;
    this._sinkingStartAngle = this._chance(0.5) ? startAngle : -startAngle;
    this._currentAngle = this._sinkingStartAngle;
    this._currentScaleY = 1.0;
  }

  // The intended lean and submersion, the load and the forces of this frame, in a reused record. Line pull and water
  // velocity are in the update plane (ground base pixels on a perspective water; spec 053), x sideways, y toward the
  // shore; the line pull is a unit share along the line toward the rod.
  getPoseSignals() {
    const signals = this._poseSignals;
    signals.castSerial = this._castSerial;
    signals.angleDeg = this._currentAngle;
    signals.scaleY = this._currentScaleY;
    signals.isBiteTilt = this._isBiting && !this._isOverDepth;
    signals.load = this._isOverDepth ? 0 : this._isSinking ? this._getSinkingDepthProgress() : 1;
    signals.lyingSide = this._sinkingStartAngle < 0 ? -1 : 1;
    signals.restDraft = this._restDraft;
    signals.windDeg = this._isHooked ? 0 : this._targetWindAngle;
    signals.lineX = this._linePull.x;
    signals.lineY = this._linePull.y;
    signals.waterX = this._waterVelocity.x;
    signals.waterY = this._waterVelocity.y;
    return signals;
  }

  // The line pulls the float's bottom toward the rod while the player retrieves; a sideways rod move pulls it to
  // that side (spec 100 floatTilt).
  _recordPoseInputs(input, pullDirection) {
    const lateral = Math.sign(Number(input?.castRodDeltaX) || 0);
    const isPulling = !!(input?.isPulling && pullDirection);
    this._linePull.x = lateral !== 0 ? lateral : isPulling ? pullDirection.x : 0;
    this._linePull.y = lateral !== 0 ? 0 : isPulling ? pullDirection.y : 0;
  }

  _processMechanics(dt, input, reelPower, pullDirection) {
    const isPulling = !!(input.isPulling && pullDirection);
    if (isPulling) {
      this._redirectSinkingAngleFromPull(pullDirection);
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

  // A pull turns a lying float to the side away from the pull, as the line drags its bottom.
  _redirectSinkingAngleFromPull(pullDirection) {
    if (!this._isSinking && !this._isOverDepth) return;
    const pullX = pullDirection?.x || 0;
    const deadZone = this._floatPoseConfig().pullLateralDeadZone ?? 0.02;
    const impulseSign = Math.abs(pullX) > deadZone ? -Math.sign(pullX) : 0;
    if (impulseSign !== 0) {
      this._sinkingStartAngle =
        impulseSign * Math.abs(this._sinkingStartAngle || 90);
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
      this._floatPoseConfig().minStandUpDurationMs ?? 400;
    if (minDuration <= 0) return depthProgress;

    const timeProgress = Math.max(
      0,
      Math.min(1, this._sinkingVisualElapsed / minDuration),
    );
    return Math.min(depthProgress, timeProgress);
  }
}
