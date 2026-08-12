class FloatTackleLineBudgetPolicy {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  appliesTo(equipment) {
    const rodType = equipment?.rod?.variant;
    const isFloatRod = rodType === "float" || rodType === "pole";
    return isFloatRod && !!equipment?.float;
  }

  resolve({ equipment, selectedDepthMeters = null } = {}) {
    const lineLengthMeters = this.#readMeters(
      equipment?.line,
      "lengthMeters",
    );
    const rodLengthMeters = this.#readMeters(
      equipment?.rod,
      "lengthMeters",
    );
    const minDepthMeters = this.#minimumDepthMeters();
    const applies = this.appliesTo(equipment);

    if (!applies) {
      return {
        applies: false,
        lineLengthMeters,
        rodLengthMeters,
        minDepthMeters,
        maxDepthMeters: minDepthMeters,
        selectedDepthMeters: minDepthMeters,
        depthLineCostMeters: 0,
        maxCastDistanceMeters: lineLengthMeters,
      };
    }

    const maxDepthMeters = Math.max(
      minDepthMeters,
      lineLengthMeters - rodLengthMeters,
    );
    const selectedDepth = this.#clamp(
      selectedDepthMeters,
      minDepthMeters,
      maxDepthMeters,
    );
    const depthLineCostMeters = this.#isSurfaceDepth(selectedDepth)
      ? 0
      : selectedDepth;
    const minimumCastDistanceMeters = Math.min(
      rodLengthMeters,
      lineLengthMeters,
    );

    return {
      applies: true,
      lineLengthMeters,
      rodLengthMeters,
      minDepthMeters,
      maxDepthMeters,
      selectedDepthMeters: selectedDepth,
      depthLineCostMeters,
      maxCastDistanceMeters: Math.max(
        minimumCastDistanceMeters,
        lineLengthMeters - depthLineCostMeters,
      ),
    };
  }

  #minimumDepthMeters() {
    return Math.max(
      0,
      this.#numberOrDefault(this.#config.minimumDepthMeters, 0.1),
    );
  }

  #isSurfaceDepth(depthMeters) {
    const tolerance = Math.max(
      0,
      this.#numberOrDefault(this.#config.surfaceDepthToleranceMeters, 0.001),
    );
    return depthMeters <= this.#minimumDepthMeters() + tolerance;
  }

  #readMeters(source, propertyName) {
    return Math.max(
      0,
      this.#numberOrDefault(
        source?.effectiveStats?.[propertyName],
        0,
      ),
    );
  }

  #clamp(value, min, max) {
    const parsed = Number(value);
    const fallback = Number.isFinite(parsed) ? parsed : min;
    return Math.max(min, Math.min(max, fallback));
  }

  #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
