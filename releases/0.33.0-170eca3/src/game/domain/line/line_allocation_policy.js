import { finiteOr } from "../../../engine/math/number_normalization.js";

export class LineAllocationPolicy {
  #lineConfig;
  #messages;

  // Player-facing texts are injected by composition.
  constructor(lineConfig = {}, { messages = null } = {}) {
    this.#lineConfig = lineConfig || {};
    this.#messages = messages;
  }

  resolve({ lineItem, equipment } = {}) {
    const rod = equipment?.rod;
    const reel = equipment?.reel;
    if (!rod) {
      return this.#invalid(this.#messages.lineRodRequired);
    }

    const rodNeedsReel = this.rodRequiresReel(rod);
    if (rodNeedsReel && !reel) {
      return this.#invalid(this.#messages.lineReelRequired);
    }

    const sourceLength = this.getLineLengthMeters(lineItem);
    const minimumLength = this.getMinimumLineLengthMeters(rod);
    const maximumLength = this.getMaximumLineLengthMeters({ rod, reel });

    if (sourceLength < minimumLength) {
      return this.#invalid(
        this.#messages.lineTooShortForRod(minimumLength),
        { sourceLengthMeters: sourceLength, minimumLengthMeters: minimumLength },
      );
    }

    if (
      rodNeedsReel &&
      Number.isFinite(maximumLength) &&
      maximumLength > 0 &&
      maximumLength < minimumLength
    ) {
      return this.#invalid(
        this.#messages.reelTooSmallForLine(minimumLength, maximumLength),
        {
          sourceLengthMeters: sourceLength,
          minimumLengthMeters: minimumLength,
          maximumLengthMeters: maximumLength,
        },
      );
    }

    const equipLength = Number.isFinite(maximumLength) && maximumLength > 0
      ? Math.min(sourceLength, maximumLength)
      : sourceLength;
    const remainingLength = Math.max(0, sourceLength - equipLength);

    return {
      isValid: true,
      reason: remainingLength > 0.001
        ? this.#messages.lineWillBeCut(equipLength)
        : null,
      rodRequiresReel: rodNeedsReel,
      sourceLengthMeters: sourceLength,
      minimumLengthMeters: minimumLength,
      maximumLengthMeters: maximumLength,
      equipLengthMeters: equipLength,
      remainingLengthMeters: remainingLength,
      shouldSplit: remainingLength > 0.001,
    };
  }

  /**
   * Resolves winding a loose reel before a rod is selected. Rod-specific
   * minimum length is intentionally deferred until that prepared reel is
   * equipped.
   */
  resolveForReel({ lineItem, reel } = {}) {
    if (!reel) {
      return this.#invalid(this.#messages.windingReelMissing);
    }
    const sourceLength = this.getLineLengthMeters(lineItem);
    if (sourceLength <= 0) {
      return this.#invalid(this.#messages.lineLengthUnavailable);
    }
    const maximumLength = finiteOr(
      reel?.effectiveStats?.lineCapacityMeters,
      Infinity,
    );
    if (Number.isFinite(maximumLength) && maximumLength <= 0) {
      return this.#invalid(this.#messages.reelCapacityUnavailable);
    }
    const equipLength = Number.isFinite(maximumLength)
      ? Math.min(sourceLength, maximumLength)
      : sourceLength;
    const remainingLength = Math.max(0, sourceLength - equipLength);
    return {
      isValid: true,
      reason: remainingLength > 0.001
        ? this.#messages.lineWillBeWound(equipLength)
        : null,
      rodRequiresReel: true,
      sourceLengthMeters: sourceLength,
      minimumLengthMeters: 0,
      maximumLengthMeters: maximumLength,
      equipLengthMeters: equipLength,
      remainingLengthMeters: remainingLength,
      shouldSplit: remainingLength > 0.001,
      deferredRodValidation: true,
    };
  }

  getLineLengthMeters(lineItem) {
    return finiteOr(
      lineItem?.effectiveStats?.lengthMeters,
      0,
    );
  }

  getMinimumLineLengthMeters(rod) {
    const rodLength = this.#rodLengthMeters(rod);
    if (this.rodRequiresReel(rod)) {
      const multiplier = finiteOr(
        this.#lineConfig.rodLengthReserveMultiplier,
        2,
      );
      return Math.max(0, rodLength * multiplier);
    }

    const multiplier = finiteOr(
      this.#lineConfig.noReelMinRodLengthMultiplier,
      2,
    );
    return Math.max(0, rodLength * multiplier);
  }

  getMaximumLineLengthMeters({ rod, reel } = {}) {
    if (this.rodRequiresReel(rod)) {
      return finiteOr(
        reel?.effectiveStats?.lineCapacityMeters,
        Infinity,
      );
    }

    const rodLength = this.#rodLengthMeters(rod);
    const rodLengthMultiplier = finiteOr(
      this.#lineConfig.noReelRodLengthMultiplier,
      2,
    );
    const extraMeters = finiteOr(
      this.#lineConfig.noReelExtraLengthMeters,
      0,
    );
    return Math.max(0, (rodLength * rodLengthMultiplier) + extraMeters);
  }

  rodRequiresReel(rod) {
    if (!rod) return null;
    return rod.effectiveStats?.hasReel ?? rod.variant !== "pole";
  }

  #invalid(reason, data = {}) {
    return { isValid: false, reason, ...data };
  }

  #rodLengthMeters(rod) {
    return finiteOr(
      rod?.effectiveStats?.lengthMeters,
      0,
    );
  }
}
