class LineSystem {
  #config;
  #pixelsPerMeter;
  #hasReel;
  #totalLengthMeters;
  #releasedMeters;
  #remainingMeters;
  #distanceMeters;
  #lineMaxLoadKg;
  #lineDurability;
  #durabilityLossPerPercent;
  #isFullyExtended = false;
  #lineExtensionRatio = 0;
  #initialized = false;
  #lastReleasedMeters = 0;
  #lastRecoveredMeters = 0;

  constructor({ rod, reel, config, lineStats = null }) {
    this.#config = config || {};
    this.#pixelsPerMeter = Math.max(
      1,
      Number(this.#config.pixelsPerMeter) || 50,
    );
    this.#hasReel = !!reel?.hasReel?.();

    const reelLineStats = this.#hasReel ? reel?.getLineStats?.() || null : null;
    const effectiveLineStats = lineStats || reelLineStats || null;
    const rodLength = Number(rod?.getLengthMeters?.()) || 2;
    const noReelLine = this.#config.line || {};
    const fallbackLength =
      rodLength * (noReelLine.noReelRodLengthMultiplier ?? 2.0) +
      (noReelLine.noReelExtraLengthMeters ?? 1.8);

    this.#totalLengthMeters = this.#hasReel
      ? this.#numberOrDefault(
          effectiveLineStats?.lengthMeters,
          this.#numberOrDefault(reel?.getLineCapacityMeters?.(), 50),
        )
      : this.#numberOrDefault(effectiveLineStats?.lengthMeters, fallbackLength);

    // With a reel, line starts at the current fish distance and can be released/recovered.
    // Without a reel, all fixed line length is available from the start.
    this.#releasedMeters = this.#hasReel ? 0 : this.#totalLengthMeters;
    this.#remainingMeters = Math.max(
      0,
      this.#totalLengthMeters - this.#releasedMeters,
    );
    this.#distanceMeters = 0;

    // IMPORTANT: Rod does not own line max-load. For now, if there is no separate line
    // item, use reel.line stats or a config fallback for no-reel rigs.
    this.#lineMaxLoadKg = this.#numberOrDefault(
      effectiveLineStats?.maxLoadKg,
      this.#numberOrDefault(noReelLine.defaultMaxLoadKg, 8),
    );
    this.#lineDurability = this.#numberOrDefault(
      effectiveLineStats?.durability,
      100,
    );
    this.#durabilityLossPerPercent = this.#numberOrDefault(
      effectiveLineStats?.durabilityMaxLoadLossPerPercent,
      noReelLine.durabilityMaxLoadLossPerPercent ?? 0.001,
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
          Math.max(0.1, this.#distanceMeters),
        );
      }
      this.#initialized = true;
    }

    this.#refreshState();
    return this.getState();
  }

  releaseForDistance(control = 0) {
    this.#lastReleasedMeters = 0;
    if (!this.#hasReel || this.#remainingMeters <= 0) {
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

      // Якщо сила риби вища за поточний ліміт фрикціону — котушка здає ліску,
      // щоб натяг не перевищував dragLimitKg. Якщо фрикціон тримає рибу — ліска не здається.
      releaseRatio = shouldSlip ? slipReleaseRatio : creepRatio;

      // Абсолютно відкритий фрикціон завжди здає всю потрібну ліску.
      if (dragRatio <= 0.0001) releaseRatio = 1;
    } else {
      // Backward compatibility for older calls that only pass dragRatio.
      const cfg = this.#config.drag || {};
      const minReleaseAtFullDrag = cfg.yEscapeSpeedAtFullDrag ?? 0.02;
      const clampedDrag = this.#clamp01(control);
      releaseRatio = 1 - clampedDrag * (1 - minReleaseAtFullDrag);
    }

    const released = Math.min(this.#remainingMeters, excess * this.#clamp01(releaseRatio));
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

    // Recover is NOT a winch. It only picks up already won slack and never pulls
    // released length below the current fish distance.
    const nextReleased = Math.max(
      this.#distanceMeters,
      this.#releasedMeters - amount,
    );
    const recovered = Math.max(0, this.#releasedMeters - nextReleased);

    this.#releasedMeters = nextReleased;
    this.#lastRecoveredMeters = recovered;
    this.#refreshState();
    return recovered;
  }

  // Backward-compatible name used by older callers. Semantically this is slack recovery.
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
      totalLengthMeters: this.#totalLengthMeters,
      releasedMeters: this.#releasedMeters,
      remainingMeters: this.#remainingMeters,
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
    this.#releasedMeters = Math.max(
      0,
      Math.min(this.#totalLengthMeters, this.#releasedMeters),
    );
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
    this.#isFullyExtended = this.#hasReel
      ? this.#remainingMeters <= 0.001 && isAtReleasedLimit
      : isAtReleasedLimit;
  }

  #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
