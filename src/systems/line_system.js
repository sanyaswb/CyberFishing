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
  #distanceMeters;
  #lineMaxLoadKg;
  #lineDurability;
  #durabilityLossPerPercent;
  #isFullyExtended = false;
  #lineExtensionRatio = 0;
  #initialized = false;
  #lastReleasedMeters = 0;
  #lastRecoveredMeters = 0;
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

    this.#baseReachMeters = reachModel.baseReachMeters;
    this.#reelLineMeters = reachModel.reserveMeters;
    this.#totalLengthMeters = reachModel.maxReachMeters;
    this.#maxRemainingMeters = this.#hasReel
      ? Math.max(0, this.#totalLengthMeters - this.#baseReachMeters)
      : 0;

    // Reel rigs start from the rod base reach and can release the rest of the
    // equipped line. Pole rigs have fixed line and cannot actively spool/recover.
    this.#releasedMeters = this.#hasReel
      ? Math.min(this.#totalLengthMeters, this.#baseReachMeters)
      : this.#totalLengthMeters;
    this.#remainingMeters = Math.max(
      0,
      this.#totalLengthMeters - this.#releasedMeters,
    );
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
        this.#releasedMeters = Math.min(
          this.#totalLengthMeters,
          Math.max(this.#baseReachMeters, this.#distanceMeters),
        );
      }
      this.#initialized = true;
    }

    this.#refreshState();
    return this.getState();
  }

  releaseForDistance(control = 0) {
    this.#lastReleasedMeters = 0;
    const availableToRelease = Math.max(
      0,
      this.#totalLengthMeters - this.#releasedMeters,
    );
    if (!this.#hasReel || availableToRelease <= 0) {
      this.#refreshState();
      return 0;
    }

    const excess = this.#distanceMeters - this.#releasedMeters;
    if (excess <= 0) {
      this.#refreshState();
      return 0;
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
      const cfg = this.#config.drag || {};
      const minReleaseAtFullDrag = cfg.yEscapeSpeedAtFullDrag ?? 0.02;
      const clampedDrag = this.#clamp01(control);
      releaseRatio = 1 - clampedDrag * (1 - minReleaseAtFullDrag);
    }

    const released = Math.min(
      availableToRelease,
      excess * this.#clamp01(releaseRatio),
    );
    this.#releasedMeters += released;
    this.#lastReleasedMeters = released;
    this.#refreshState();
    return released;
  }

  recoverSlack({ hasReel, inputRecover, reel, tensionKg, dtSec }) {
    this.#lastRecoveredMeters = 0;
    if (!hasReel || !inputRecover || !reel) return 0;

    const speed = Math.max(
      0,
      Number(reel.getRetrieveSpeedMetersPerSec?.()) || 0,
    );
    if (speed <= 0) return 0;

    const limit = Math.max(
      0.001,
      Number(reel.getEffectiveMaxLoadKg?.()) ||
        Number(reel.getMaxLoadKg?.()) ||
        1,
    );
    const efficiency = this.#clamp01(1 - (Number(tensionKg) || 0) / limit);
    const amount = speed * efficiency * Math.max(0, Number(dtSec) || 0);

    const nextReleased = Math.max(
      Math.min(this.#baseReachMeters, this.#totalLengthMeters),
      this.#distanceMeters,
      this.#releasedMeters - amount,
    );
    const recovered = Math.max(0, this.#releasedMeters - nextReleased);

    this.#releasedMeters = nextReleased;
    this.#lastRecoveredMeters = recovered;
    this.#refreshState();
    return recovered;
  }

  applyRetrieve(args) {
    return this.recoverSlack({
      hasReel: args?.hasReel,
      inputRecover: args?.inputRecover ?? args?.inputRetrieve,
      reel: args?.reel,
      tensionKg: args?.tensionKg,
      dtSec: args?.dtSec,
    });
  }

  constrainPosition(position, velocity, rodTipPosition) {
    const maxDistancePx = this.#releasedMeters * this.#pixelsPerMeter;
    if (maxDistancePx <= 0) return false;

    const dx = position.x - rodTipPosition.x;
    const dy = position.y - rodTipPosition.y;
    const distancePx = Math.hypot(dx, dy);
    if (distancePx <= maxDistancePx || distancePx <= 0) return false;

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
    return true;
  }

  getEffectiveLineMaxLoadKg() {
    const durabilityLoss =
      (100 - Math.max(0, Math.min(100, this.#lineDurability))) *
      this.#durabilityLossPerPercent;
    return this.#lineMaxLoadKg * Math.max(0.1, 1 - durabilityLoss);
  }

  getState() {
    return {
      hasReel: this.#hasReel,
      baseReachMeters: this.#baseReachMeters,
      reelLineMeters: this.#reelLineMeters,
      totalLengthMeters: this.#totalLengthMeters,
      releasedMeters: this.#releasedMeters,
      remainingMeters: this.#remainingMeters,
      maxRemainingMeters: this.#maxRemainingMeters,
      distanceMeters: this.#distanceMeters,
      slackMeters: Math.max(0, this.#releasedMeters - this.#distanceMeters),
      isFullyExtended: this.#isFullyExtended,
      lineExtensionRatio: this.#lineExtensionRatio,
      effectiveLineMaxLoadKg: this.getEffectiveLineMaxLoadKg(),
      lastReleasedMeters: this.#lastReleasedMeters,
      lastRecoveredMeters: this.#lastRecoveredMeters,
    };
  }

  #refreshState() {
    const minReleased = this.#hasReel
      ? Math.min(this.#baseReachMeters, this.#totalLengthMeters)
      : 0;
    this.#releasedMeters = Math.max(
      minReleased,
      Math.min(this.#totalLengthMeters, this.#releasedMeters),
    );

    // User-facing reserve: meters still available to release right now.
    // Max reserve is tracked separately as totalLine - baseReachMeters.
    this.#remainingMeters = Math.max(
      0,
      this.#totalLengthMeters - this.#releasedMeters,
    );
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

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
