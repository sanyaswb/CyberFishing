class LineSystem {
  #config;
  #pixelsPerMeter;
  #hasReel;
  #baseReachMeters;
  #reelLineMeters;
  #totalLengthMeters;
  #releasedMeters;
  #remainingMeters;
  #maxRemainingMeters;
  #spoolState;
  #distanceMeters;
  #lineMaxLoadKg;
  #lineDurability;
  #durabilityLossPerPercent;
  #isFullyExtended = false;
  #lineExtensionRatio = 0;
  #initialized = false;
  #lastReleasedMeters = 0;
  #lastRecoveredMeters = 0;
  #lastReleaseResult = {
    releasedMeters: 0,
    demandedMeters: 0,
    satisfiedMeters: 0,
    unsatisfiedMeters: 0,
    didSlip: false,
    hasReserveAfterRelease: false,
    hardLimitReached: false,
  };
  #lastConstraintResult = {
    constrained: false,
    correctionPx: 0,
    hardLimit: false,
  };
  #distanceCalculator;

  constructor({
    rod,
    reel,
    config,
    lineStats = null,
    castDistanceCalculator = null,
  }) {
    this.#config = config || {};
    this.#distanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator(this.#config);
    this.#pixelsPerMeter = this.#distanceCalculator.pixelsPerMeter;
    this.#hasReel = !!reel?.hasReel?.();

    const effectiveLineStats = lineStats || null;
    const lineConfig = this.#config.line || {};
    const reachModel = this.#distanceCalculator.getLineReachModel({
      rod,
      reel,
      hasReel: this.#hasReel,
      lineStats: effectiveLineStats,
    });

    this.#baseReachMeters = this.#hasReel ? 0 : reachModel.baseReachMeters;
    this.#reelLineMeters = reachModel.lineLengthMeters;
    this.#totalLengthMeters = reachModel.maxReachMeters;
    this.#maxRemainingMeters = this.#hasReel ? this.#totalLengthMeters : 0;

    this.#spoolState = new LineSpoolState({
      totalLineMeters: this.#totalLengthMeters,
      releasedLineMeters: this.#hasReel ? 0 : this.#totalLengthMeters,
    });
    this.#releasedMeters = this.#spoolState.releasedLineMeters;
    this.#remainingMeters = this.#spoolState.remainingLineMeters;
    this.#distanceMeters = 0;

    this.#lineMaxLoadKg = this.#numberOrDefault(
      effectiveLineStats?.maxLoadKg,
      this.#numberOrDefault(lineConfig.defaultMaxLoadKg, 8),
    );
    this.#lineDurability = this.#numberOrDefault(
      effectiveLineStats?.durability,
      100,
    );
    this.#durabilityLossPerPercent = this.#numberOrDefault(
      effectiveLineStats?.durabilityMaxLoadLossPerPercent,
      lineConfig.durabilityMaxLoadLossPerPercent ?? 0.001,
    );
  }

  updateDistance(fishPosition, rodTipPosition) {
    const distancePx = Math.hypot(
      fishPosition.x - rodTipPosition.x,
      fishPosition.y - rodTipPosition.y,
    );
    this.#distanceMeters = distancePx / this.#pixelsPerMeter;

    if (!this.#initialized) {
      if (this.#hasReel) {
        this.#spoolState.setReleasedLineMeters(Math.min(
          this.#totalLengthMeters,
          this.#distanceMeters,
        ));
      }
      this.#initialized = true;
    }

    this.#refreshState();
    return this.getState();
  }

  releaseForDistance(control = 0) {
    this.#lastReleasedMeters = 0;
    const availableToRelease = this.#spoolState.remainingLineMeters;
    if (!this.#hasReel || availableToRelease <= 0) {
      this.#refreshState();
      const demandedMeters = Math.max(
        0,
        this.#distanceMeters - this.#releasedMeters,
      );
      return this.#setReleaseResult({
        demandedMeters,
        unsatisfiedMeters: demandedMeters,
        hardLimitReached:
          demandedMeters > 0.000001 &&
          this.#remainingMeters <= 0.001,
      });
    }

    const excess = this.#distanceMeters - this.#releasedMeters;
    if (excess <= 0) {
      this.#refreshState();
      return this.#setReleaseResult({
        hasReserveAfterRelease: this.#remainingMeters > 0.001,
      });
    }

    let releaseRatio = 0;
    if (typeof control === "object" && control !== null) {
      const dragRatio = this.#clamp01(control.dragRatio);
      const shouldSlip = !!control.shouldSlip;
      const slipReleaseRatio = this.#clamp01(
        control.slipReleaseRatio ?? (shouldSlip ? 1 : 0),
      );
      const creepRatio = this.#clamp01(control.creepReleaseRatio ?? 0);

      releaseRatio = shouldSlip ? slipReleaseRatio : creepRatio;
      if (dragRatio <= 0.0001) releaseRatio = 1;
    } else {
      const clampedDrag = this.#clamp01(control);
      releaseRatio = 1 - clampedDrag;
    }

    const released = this.#spoolState.release(
      Math.min(availableToRelease, excess * this.#clamp01(releaseRatio)),
    );
    this.#lastReleasedMeters = released;
    this.#refreshState();

    const unsatisfied = Math.max(0, excess - released);
    return this.#setReleaseResult({
      releasedMeters: released,
      demandedMeters: excess,
      satisfiedMeters: released,
      unsatisfiedMeters: unsatisfied,
      didSlip: released > 0.000001,
      hasReserveAfterRelease: this.#remainingMeters > 0.001,
      hardLimitReached: unsatisfied > 0.000001 && this.#remainingMeters <= 0.001,
    });
  }

  recoverLineCredit({
    hasReel,
    inputRecover,
    reel,
    tensionKg,
    dtSec,
    loadLimitKg = null,
    maxRecoverMeters = null,
  }) {
    this.#lastRecoveredMeters = 0;
    if (!hasReel || !inputRecover || !reel) return 0;

    const speed = Math.max(
      0,
      Number(reel.getRetrieveSpeedMetersPerSec?.()) || 0,
    );
    if (speed <= 0) return 0;

    const reelLimit = Math.max(
      0.001,
      Number(reel.getEffectiveMaxLoadKg?.()) ||
        Number(reel.getMaxLoadKg?.()) ||
        1,
    );
    const lineLimit = Math.max(0.001, Number(this.getEffectiveLineMaxLoadKg()) || reelLimit);
    const configuredLoadLimit = Number(loadLimitKg);
    const limit = Number.isFinite(configuredLoadLimit) && configuredLoadLimit > 0
      ? Math.max(0.001, configuredLoadLimit)
      : Math.min(reelLimit, lineLimit);
    const efficiency = this.#clamp01(1 - (Number(tensionKg) || 0) / limit);
    const rawAmount = speed * efficiency * Math.max(0, Number(dtSec) || 0);
    const configuredMaxRecover = Number(maxRecoverMeters);
    const hasMaxRecover =
      maxRecoverMeters !== null &&
      maxRecoverMeters !== undefined &&
      Number.isFinite(configuredMaxRecover) &&
      configuredMaxRecover >= 0;
    const amount =
      hasMaxRecover
        ? Math.min(rawAmount, configuredMaxRecover)
        : rawAmount;

    const recovered = this.#spoolState.recover(amount, this.#distanceMeters);
    this.#lastRecoveredMeters = recovered;
    this.#refreshState();
    return recovered;
  }

  recoverReleasedLine({ meters, minReleasedMeters = null } = {}) {
    this.#lastRecoveredMeters = 0;
    if (!this.#hasReel) {
      this.#refreshState();
      return 0;
    }

    const minimum = minReleasedMeters === null || minReleasedMeters === undefined
      ? this.#distanceMeters
      : Math.max(0, Number(minReleasedMeters) || 0);
    const recovered = this.#spoolState.recover(
      Math.max(0, Number(meters) || 0),
      minimum,
    );
    this.#lastRecoveredMeters = recovered;
    this.#refreshState();
    return recovered;
  }

  recoverSlack(args) {
    // Deprecated compatibility alias. This recovers pump credit / released line,
    // not physical loose line.
    return this.recoverLineCredit(args || {});
  }

  applyRetrieve(args) {
    return this.recoverLineCredit({
      hasReel: args?.hasReel,
      inputRecover: args?.inputRecover ?? args?.inputRetrieve,
      reel: args?.reel,
      tensionKg: args?.tensionKg,
      dtSec: args?.dtSec,
      loadLimitKg: args?.loadLimitKg,
      maxRecoverMeters: args?.maxRecoverMeters,
    });
  }

  constrainPosition(position, velocity, rodTipPosition) {
    const maxDistancePx = this.#releasedMeters * this.#pixelsPerMeter;
    if (maxDistancePx <= 0) return this.#setConstraintResult();

    const dx = position.x - rodTipPosition.x;
    const dy = position.y - rodTipPosition.y;
    const distancePx = Math.hypot(dx, dy);
    const tolerancePx = this.#constraintTolerancePx();
    if (distancePx <= maxDistancePx + tolerancePx || distancePx <= 0) {
      return this.#setConstraintResult();
    }

    const nx = dx / distancePx;
    const ny = dy / distancePx;
    position.x = rodTipPosition.x + nx * maxDistancePx;
    position.y = rodTipPosition.y + ny * maxDistancePx;

    const outwardVelocity = velocity.x * nx + velocity.y * ny;
    if (outwardVelocity > 0) {
      velocity.x -= nx * outwardVelocity;
      velocity.y -= ny * outwardVelocity;
    }

    this.updateDistance(position, rodTipPosition);
    return this.#setConstraintResult({
      constrained: true,
      correctionPx: distancePx - maxDistancePx,
      hardLimit: this.#remainingMeters <= 0.001,
    });
  }

  getEffectiveLineMaxLoadKg() {
    const durabilityLoss =
      (100 - Math.max(0, Math.min(100, this.#lineDurability))) *
      this.#durabilityLossPerPercent;
    return this.#lineMaxLoadKg * Math.max(0.1, 1 - durabilityLoss);
  }

  calculateBreakLossMeters({ rng = null } = {}) {
    const released = Math.max(0, Number(this.#releasedMeters) || 0);
    if (released <= 0) return 0;

    const preserved = this.#randomRange(rng, 0, released);
    return Math.max(0, released - preserved);
  }

  #randomRange(rng, min, max) {
    if (rng && typeof rng.range === "function") {
      const value = Number(rng.range(min, max));
      if (Number.isFinite(value)) return Math.max(min, Math.min(max, value));
    }

    const roll = rng && typeof rng.next === "function" ? rng.next() : Math.random();
    return min + Math.max(0, Math.min(1, Number(roll) || 0)) * (max - min);
  }

  getState() {
    return {
      hasReel: this.#hasReel,
      baseReachMeters: this.#baseReachMeters,
      reelLineMeters: this.#reelLineMeters,
      totalLineMeters: this.#totalLengthMeters,
      totalLengthMeters: this.#totalLengthMeters,
      releasedMeters: this.#releasedMeters,
      remainingMeters: this.#remainingMeters,
      canReleaseLine: this.#remainingMeters > 0.001,
      spoolEmpty: this.#remainingMeters <= 0.001,
      maxRemainingMeters: this.#maxRemainingMeters,
      distanceMeters: this.#distanceMeters,
      recoverableLineMeters: Math.max(0, this.#releasedMeters - this.#distanceMeters),
      actualSlackMeters: 0,
      // Deprecated compatibility alias. In the current fight loop this value is
      // pump credit / recoverable line, not physical loose line.
      slackMeters: Math.max(0, this.#releasedMeters - this.#distanceMeters),
      isFullyExtended: this.#isFullyExtended,
      lineExtensionRatio: this.#lineExtensionRatio,
      effectiveLineMaxLoadKg: this.getEffectiveLineMaxLoadKg(),
      lastReleasedMeters: this.#lastReleasedMeters,
      lastRecoveredMeters: this.#lastRecoveredMeters,
      lastReleaseResult: this.#lastReleaseResult,
      lastConstraintResult: this.#lastConstraintResult,
    };
  }

  #refreshState() {
    if (!this.#hasReel) {
      this.#spoolState.setReleasedLineMeters(this.#totalLengthMeters);
    }
    this.#releasedMeters = this.#spoolState.releasedLineMeters;

    this.#remainingMeters = this.#spoolState.remainingLineMeters;
    this.#lineExtensionRatio =
      this.#releasedMeters > 0
        ? this.#clamp01(this.#distanceMeters / this.#releasedMeters)
        : 1;

    const isAtReleasedLimit =
      this.#distanceMeters >= this.#releasedMeters * 0.995;
    this.#isFullyExtended = this.#remainingMeters <= 0.001 && isAtReleasedLimit;
  }

  #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #constraintTolerancePx() {
    const explicit = Number(this.#config.line?.constraintTolerancePx);
    if (Number.isFinite(explicit) && explicit >= 0) return explicit;
    return 0.5;
  }

  #setReleaseResult(result = {}) {
    this.#lastReleaseResult.releasedMeters = result.releasedMeters ?? 0;
    this.#lastReleaseResult.demandedMeters = result.demandedMeters ?? 0;
    this.#lastReleaseResult.satisfiedMeters = result.satisfiedMeters ?? 0;
    this.#lastReleaseResult.unsatisfiedMeters = result.unsatisfiedMeters ?? 0;
    this.#lastReleaseResult.didSlip = !!result.didSlip;
    this.#lastReleaseResult.hasReserveAfterRelease =
      result.hasReserveAfterRelease ?? this.#remainingMeters > 0.001;
    this.#lastReleaseResult.hardLimitReached = !!result.hardLimitReached;
    return this.#lastReleaseResult;
  }

  #setConstraintResult(result = {}) {
    this.#lastConstraintResult.constrained = !!result.constrained;
    this.#lastConstraintResult.correctionPx = result.correctionPx ?? 0;
    this.#lastConstraintResult.hardLimit = !!result.hardLimit;
    return this.#lastConstraintResult;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
