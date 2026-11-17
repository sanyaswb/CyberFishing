import { CastDistanceCalculator } from "../casting/cast_distance_calculator.js";
import { LineSpoolState } from "./line_spool_state.js";
import { clampUnit, finiteOr } from "../../../engine/math/number_normalization.js";

export class LineSystem {
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
    lineLengthLocked: false,
    blockedByDrag: false,
    blockedByHardLimit: false,
    releaseBlockedReason: "none",
  };
  #lastConstraintResult = {
    constrained: false,
    correctionPx: 0,
    hardLimit: false,
  };
  #distanceCalculator;
  // TK-364: God mode infiniteCasting line ({ reserveMeters, poleRetrieveSpeedMetersPerSec, poleMinEfficiency }) or null.
  // A reel gets a spool of at least reserveMeters, so a fish hooked beyond the tackle's normal line is not pulled to it.
  // A pole keeps its line (#poleNormalMeters) and gets a virtual line beyond it: the fish takes it while the player does
  // not pull, the player's pull winds it back (virtual reel) down to the pole's own line, then the pole is as usual.
  #godModeLine = null;
  // TK-364.1: the tackle's own line (before the God mode reserve); a break never loses more than this.
  #ownLineMeters = 0;
  #poleNormalMeters = 0;
  #poleVirtualMeters = 0;
  #virtualReelHolding = false;
  #lastVirtualRecoveredMeters = 0;

  // godModeLine: CONFIG.debug.godMode.infiniteCastingLine while God mode infiniteCasting is on, else null.
  constructor({
    rod,
    reel,
    config,
    lineStats = null,
    castDistanceCalculator = null,
    godModeLine = null,
  }) {
    this.#config = config || {};
    this.#distanceCalculator =
      castDistanceCalculator || new CastDistanceCalculator(this.#config);
    this.#pixelsPerMeter = this.#distanceCalculator.pixelsPerMeter;
    this.#hasReel = !!reel?.hasReel?.();

    const effectiveLineStats = lineStats || null;
    const resolvedLineStats = effectiveLineStats?.effectiveStats || {};
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
    this.#godModeLine = godModeLine;
    this.#ownLineMeters = this.#totalLengthMeters;
    if (godModeLine && this.#hasReel) {
      this.#totalLengthMeters = Math.max(this.#totalLengthMeters, this.#godReserveMeters());
    }
    this.#poleNormalMeters = this.#totalLengthMeters;
    this.#maxRemainingMeters = this.#hasReel ? this.#totalLengthMeters : 0;

    this.#spoolState = new LineSpoolState({
      totalLineMeters: this.#totalLengthMeters,
      releasedLineMeters: this.#hasReel ? 0 : this.#totalLengthMeters,
    });
    this.#releasedMeters = this.#spoolState.releasedLineMeters;
    this.#remainingMeters = this.#spoolState.remainingLineMeters;
    this.#distanceMeters = 0;

    this.#lineMaxLoadKg = finiteOr(
      resolvedLineStats.maxLoadKg,
      finiteOr(lineConfig.defaultMaxLoadKg, 8),
    );
    this.#lineDurability = finiteOr(
      resolvedLineStats.durability,
      100,
    );
    this.#durabilityLossPerPercent = finiteOr(
      resolvedLineStats.durabilityMaxLoadLossPerPercent,
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
      } else if (this.#godModeLine && this.#distanceMeters > this.#poleNormalMeters) {
        // TK-364: the pole's virtual line starts where the fish is (no jump to the pole's line).
        this.#poleVirtualMeters = Math.min(this.#godReserveMeters(), this.#distanceMeters);
      }
      this.#initialized = true;
    }

    this.#refreshState();
    return this.getState();
  }

  releaseForDistance(control = 0) {
    this.#lastReleasedMeters = 0;
    if (this.#releasesVirtualPoleLine()) return this.#releaseVirtualPoleLine();
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
        hasReserveAfterRelease: this.#remainingMeters > 0.001,
        hardLimitReached:
          demandedMeters > 0.000001 &&
          this.#remainingMeters <= 0.001,
        lineLengthLocked: demandedMeters > 0.000001,
        blockedByHardLimit:
          demandedMeters > 0.000001 &&
          this.#remainingMeters <= 0.001,
        releaseBlockedReason:
          demandedMeters > 0.000001
            ? "spool_empty"
            : "none",
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
      const dragRatio = clampUnit(control.dragRatio);
      const shouldSlip = !!control.shouldSlip;
      const slipReleaseRatio = clampUnit(
        control.slipReleaseRatio ?? (shouldSlip ? 1 : 0),
      );
      const creepRatio = clampUnit(control.creepReleaseRatio ?? 0);

      releaseRatio = shouldSlip ? slipReleaseRatio : creepRatio;
      if (dragRatio <= 0.0001) releaseRatio = 1;
    } else {
      const clampedDrag = clampUnit(control);
      releaseRatio = 1 - clampedDrag;
    }

    const released = this.#spoolState.release(
      Math.min(availableToRelease, excess * clampUnit(releaseRatio)),
    );
    this.#lastReleasedMeters = released;
    this.#refreshState();

    const unsatisfied = Math.max(0, excess - released);
    const blockedByHardLimit =
      unsatisfied > 0.000001 && this.#remainingMeters <= 0.001;
    const blockedByDrag =
      unsatisfied > 0.000001 && this.#remainingMeters > 0.001;
    return this.#setReleaseResult({
      releasedMeters: released,
      demandedMeters: excess,
      satisfiedMeters: released,
      unsatisfiedMeters: unsatisfied,
      didSlip: released > 0.000001,
      hasReserveAfterRelease: this.#remainingMeters > 0.001,
      hardLimitReached: blockedByHardLimit,
      lineLengthLocked: unsatisfied > 0.000001,
      blockedByDrag,
      blockedByHardLimit,
      releaseBlockedReason: blockedByHardLimit
        ? "spool_empty"
        : blockedByDrag
          ? "drag_holding"
          : "none",
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
    const efficiency = clampUnit(1 - (Number(tensionKg) || 0) / limit);
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

  // TK-364: whether the player pulls this frame (the pole's virtual reel winds then and the fish takes no line).
  setVirtualReelHolding(holding) {
    this.#virtualReelHolding = !!holding;
  }

  // TK-364: while the player pulls, a pole's virtual line is wound back at poleRetrieveSpeedMetersPerSec — slower under
  // tension (not below poleMinEfficiency), never shorter than the pole's own line. Returns the metres wound.
  recoverVirtualLine({ dtSec, tensionKg }) {
    this.#lastVirtualRecoveredMeters = 0;
    if (this.#hasReel || !this.#virtualReelHolding || this.#poleVirtualMeters <= this.#poleNormalMeters) return 0;
    const speed = Math.max(0, Number(this.#godModeLine.poleRetrieveSpeedMetersPerSec) || 0);
    const limit = Math.max(0.001, Number(this.getEffectiveLineMaxLoadKg()) || 1);
    const minEfficiency = clampUnit(this.#godModeLine.poleMinEfficiency);
    const efficiency = Math.max(minEfficiency, clampUnit(1 - (Number(tensionKg) || 0) / limit));
    const amount = speed * efficiency * Math.max(0, Number(dtSec) || 0);
    const next = Math.max(this.#poleNormalMeters, this.#poleVirtualMeters - amount);
    this.#lastVirtualRecoveredMeters = this.#poleVirtualMeters - next;
    this.#poleVirtualMeters = next <= this.#poleNormalMeters + 0.000001 ? 0 : next;
    this.#refreshState();
    return this.#lastVirtualRecoveredMeters;
  }

  #godReserveMeters() {
    return Math.max(this.#totalLengthMeters, Number(this.#godModeLine?.reserveMeters) || 0);
  }

  #releasesVirtualPoleLine() {
    return !this.#hasReel && this.#godModeLine !== null && !this.#virtualReelHolding &&
      this.#distanceMeters > this.#releasedMeters;
  }

  // TK-364: a pole fish beyond the released line takes virtual line freely while the player does not pull.
  #releaseVirtualPoleLine() {
    const excess = this.#distanceMeters - this.#releasedMeters;
    const before = this.#releasedMeters;
    this.#poleVirtualMeters = Math.min(this.#godReserveMeters(), this.#distanceMeters);
    this.#refreshState();
    const released = Math.max(0, this.#releasedMeters - before);
    this.#lastReleasedMeters = released;
    const unsatisfied = Math.max(0, excess - released);
    return this.#setReleaseResult({
      releasedMeters: released,
      demandedMeters: excess,
      satisfiedMeters: released,
      unsatisfiedMeters: unsatisfied,
      didSlip: released > 0.000001,
      hasReserveAfterRelease: this.#releasedMeters < this.#godReserveMeters() - 0.001,
      hardLimitReached: unsatisfied > 0.000001,
      lineLengthLocked: unsatisfied > 0.000001,
      blockedByHardLimit: unsatisfied > 0.000001,
      releaseBlockedReason: unsatisfied > 0.000001 ? "spool_empty" : "none",
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
    // TK-364.1: God mode's reserve or a pole's virtual line is not on the tackle; only its own line can be lost.
    const released = Math.min(this.#ownLineMeters, Math.max(0, Number(this.#releasedMeters) || 0));
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
    const freeReleasedLineMeters = Math.max(
      0,
      this.#releasedMeters - this.#distanceMeters,
    );
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
      freeReleasedLineMeters,
      recoverableLineMeters: freeReleasedLineMeters,
      actualSlackMeters: 0,
      isFullyExtended: this.#isFullyExtended,
      lineExtensionRatio: this.#lineExtensionRatio,
      effectiveLineMaxLoadKg: this.getEffectiveLineMaxLoadKg(),
      lastReleasedMeters: this.#lastReleasedMeters,
      lastRecoveredMeters: this.#lastRecoveredMeters,
      virtualLineMeters: Math.max(0, this.#poleVirtualMeters - this.#poleNormalMeters),
      lastVirtualRecoveredMeters: this.#lastVirtualRecoveredMeters,
      lastReleaseResult: this.#lastReleaseResult,
      lastConstraintResult: this.#lastConstraintResult,
    };
  }

  #refreshState() {
    if (!this.#hasReel) {
      this.#spoolState.setReleasedLineMeters(this.#totalLengthMeters);
    }
    this.#releasedMeters = Math.max(this.#spoolState.releasedLineMeters, this.#poleVirtualMeters);

    this.#remainingMeters = this.#spoolState.remainingLineMeters;
    this.#lineExtensionRatio =
      this.#releasedMeters > 0
        ? clampUnit(this.#distanceMeters / this.#releasedMeters)
        : 1;

    const isAtReleasedLimit =
      this.#distanceMeters >= this.#releasedMeters * 0.995;
    this.#isFullyExtended = this.#remainingMeters <= 0.001 && isAtReleasedLimit;
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
    this.#lastReleaseResult.lineLengthLocked = !!result.lineLengthLocked;
    this.#lastReleaseResult.blockedByDrag = !!result.blockedByDrag;
    this.#lastReleaseResult.blockedByHardLimit =
      !!result.blockedByHardLimit;
    this.#lastReleaseResult.releaseBlockedReason =
      result.releaseBlockedReason || "none";
    return this.#lastReleaseResult;
  }

  #setConstraintResult(result = {}) {
    this.#lastConstraintResult.constrained = !!result.constrained;
    this.#lastConstraintResult.correctionPx = result.correctionPx ?? 0;
    this.#lastConstraintResult.hardLimit = !!result.hardLimit;
    return this.#lastConstraintResult;
  }
}
