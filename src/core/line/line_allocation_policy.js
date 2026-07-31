class LineAllocationPolicy {
  #lineConfig;

  constructor(lineConfig = {}) {
    this.#lineConfig = lineConfig || {};
  }

  resolve({ lineItem, equipment } = {}) {
    const rod = equipment?.rod;
    const reel = equipment?.reel;
    if (!rod) {
      return this.#invalid("Спочатку екіпіруйте вудку для ліски.");
    }

    const rodNeedsReel = this.rodRequiresReel(rod);
    if (rodNeedsReel && !reel) {
      return this.#invalid("Для цієї вудки спочатку екіпіруйте котушку.");
    }

    const sourceLength = this.getLineLengthMeters(lineItem);
    const minimumLength = this.getMinimumLineLengthMeters(rod);
    const maximumLength = this.getMaximumLineLengthMeters({ rod, reel });

    if (sourceLength < minimumLength) {
      return this.#invalid(
        `Ліска закоротка: потрібно мінімум ${this.#formatMeters(minimumLength)}м для цієї вудки.`,
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
        `Котушка замала: потрібно мінімум ${this.#formatMeters(minimumLength)}м, а вміщує ${this.#formatMeters(maximumLength)}м.`,
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
        ? `Буде відрізано ${this.#formatMeters(equipLength)}м ліски.`
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

  getLineLengthMeters(lineItem) {
    return this.#numberOrDefault(
      lineItem?.lengthMeters ?? lineItem?.engineStats?.lengthMeters,
      0,
    );
  }

  getMinimumLineLengthMeters(rod) {
    const rodLength = this.#rodLengthMeters(rod);
    if (this.rodRequiresReel(rod)) {
      const multiplier = this.#numberOrDefault(
        this.#lineConfig.rodLengthReserveMultiplier,
        2,
      );
      return Math.max(0, rodLength * multiplier);
    }

    const multiplier = this.#numberOrDefault(
      this.#lineConfig.noReelMinRodLengthMultiplier,
      2,
    );
    return Math.max(0, rodLength * multiplier);
  }

  getMaximumLineLengthMeters({ rod, reel } = {}) {
    if (this.rodRequiresReel(rod)) {
      return this.#numberOrDefault(
        reel?.lineCapacityMeters ?? reel?.engineStats?.lineCapacityMeters,
        Infinity,
      );
    }

    const rodLength = this.#rodLengthMeters(rod);
    const rodLengthMultiplier = this.#numberOrDefault(
      this.#lineConfig.noReelRodLengthMultiplier,
      2,
    );
    const extraMeters = this.#numberOrDefault(
      this.#lineConfig.noReelExtraLengthMeters,
      0,
    );
    return Math.max(0, (rodLength * rodLengthMultiplier) + extraMeters);
  }

  rodRequiresReel(rod) {
    if (!rod) return null;
    return rod.hasReel ?? rod.engineStats?.hasReel ?? rod.type !== "pole";
  }

  #invalid(reason, data = {}) {
    return { isValid: false, reason, ...data };
  }

  #rodLengthMeters(rod) {
    return this.#numberOrDefault(
      rod?.lengthMeters ?? rod?.engineStats?.lengthMeters,
      0,
    );
  }

  #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #formatMeters(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return Number.isInteger(number) ? String(number) : number.toFixed(1);
  }
}
