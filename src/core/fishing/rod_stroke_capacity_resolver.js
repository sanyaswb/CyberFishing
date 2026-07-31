class RodStrokeCapacityResolver {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  resolve({ rodLengthMeters, lineLengthMeters, hasReel = true } = {}) {
    if (hasReel === false) {
      return this.#scaledLength(
        lineLengthMeters,
        this.#config.capacityByLineLengthRatio,
      );
    }

    return this.#scaledLength(
      rodLengthMeters,
      this.#config.capacityByRodLengthRatio,
    );
  }

  #scaledLength(lengthMeters, ratio) {
    const length = Math.max(0, Number(lengthMeters) || 0);
    const parsedRatio = Number(ratio);
    const safeRatio = Number.isFinite(parsedRatio) ? Math.max(0, parsedRatio) : 1;
    return length * safeRatio;
  }
}
