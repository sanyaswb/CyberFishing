class DistanceUnitConverter {
  #pixelsPerMeter;

  constructor(config = {}) {
    const physicsConfig = config?.physics || config || {};
    this.#pixelsPerMeter = Math.max(
      1,
      Number(physicsConfig.pixelsPerMeter) || 50,
    );
  }

  get pixelsPerMeter() {
    return this.#pixelsPerMeter;
  }

  metersToPixels(meters) {
    const value = Number(meters);
    if (!Number.isFinite(value)) return 0;
    return value * this.#pixelsPerMeter;
  }

  pixelsToMeters(pixels) {
    const value = Number(pixels);
    if (!Number.isFinite(value)) return 0;
    return value / this.#pixelsPerMeter;
  }
}

class CastDistanceCalculator {
  #config;
  #converter;
  #lineConfig;

  constructor(config = {}) {
    this.#config = config || {};
    const physicsConfig = this.#config.physics || this.#config || {};
    this.#converter = new DistanceUnitConverter(physicsConfig);
    this.#lineConfig = physicsConfig.line || {};
  }

  get pixelsPerMeter() {
    return this.#converter.pixelsPerMeter;
  }

  metersToPixels(meters) {
    return this.#converter.metersToPixels(meters);
  }

  pixelsToMeters(pixels) {
    return this.#converter.pixelsToMeters(pixels);
  }

  getRodBaseReachMeters(rod, hasReel = true) {
    const rodLength = this.#numberOrDefault(
      this.#readNumber(rod, "lengthMeters", "getLengthMeters"),
      2.0,
    );
    const multiplierKey = hasReel
      ? "rodLengthReserveMultiplier"
      : "noReelRodLengthMultiplier";
    const multiplier = this.#numberOrDefault(
      this.#lineConfig[multiplierKey],
      2.0,
    );
    return Math.max(0, rodLength * multiplier);
  }

  getLineMeters(lineStats = null) {
    return Math.max(0, this.#numberOrDefault(lineStats?.lengthMeters, 0));
  }

  getEquippedLineStats(equipment) {
    if (!equipment) return null;
    return equipment.line || null;
  }

  getMaxCastDistanceMeters(equipment, fallbackMeters = null) {
    const lineStats = this.getEquippedLineStats(equipment);
    const lineMeters = this.getLineMeters(lineStats);
    if (lineMeters > 0) return lineMeters;

    const rod = equipment?.rod || null;
    const legacyPixels = this.#readNumber(rod, "maxDistance", "getMaxDistance");
    if (Number.isFinite(legacyPixels)) {
      return this.pixelsToMeters(legacyPixels);
    }

    return this.#numberOrDefault(fallbackMeters, 0);
  }

  getMaxCastDistancePx(equipment, fallbackPx = Infinity) {
    const fallbackMeters = Number.isFinite(Number(fallbackPx))
      ? this.pixelsToMeters(Number(fallbackPx))
      : null;
    const meters = this.getMaxCastDistanceMeters(equipment, fallbackMeters);
    if (!Number.isFinite(meters)) return fallbackPx;
    return this.metersToPixels(meters);
  }

  getEffectiveCastDistancePx(equipment, castPowerCoefficient = 1) {
    const power =
      castPowerCoefficient === null || castPowerCoefficient === undefined
        ? this.getBuildCastPowerCoefficient(equipment)
        : this.#clamp01(castPowerCoefficient);
    return this.getMaxCastDistancePx(equipment, 0) * power;
  }

  getBuildCastPowerCoefficient(equipment, fallback = null) {
    const castingPowerConfig =
      this.#config.physics?.castingPower || this.#config.castingPower || {};
    const fallbackCoefficient = this.#numberOrDefault(
      fallback ??
        castingPowerConfig.fallbackCoefficient ??
        this.#config.casting?.inventoryPreviewPowerCoefficient ??
        this.#config.casting?.powerCoefficient ??
        this.#config.casting?.castPowerCoefficient,
      1,
    );

    const rod = equipment?.rod || null;
    if (!rod) return this.#clampCastPower(fallbackCoefficient);

    const explicitRodCoefficient = this.#readNumber(
      rod,
      "castPowerCoefficient",
      "getCastPowerCoefficient",
    );
    const rodLengthMeters = this.#numberOrDefault(
      this.#readNumber(rod, "lengthMeters", "getLengthMeters"),
      0,
    );
    const rodLengthCoefficient =
      Number.isFinite(explicitRodCoefficient)
        ? explicitRodCoefficient
        : this.#numberOrDefault(
            castingPowerConfig.rodLengthCoefficientPerMeter,
            0,
          ) * rodLengthMeters;

    const reel = equipment?.reel || null;
    const bearingCount = this.#isReelAvailable(reel)
      ? this.#numberOrDefault(this.#readNumber(reel, "bearingCount"), 0)
      : 0;
    const reelCoefficient =
      this.#numberOrDefault(castingPowerConfig.reelBearingCoefficient, 0) *
      bearingCount;

    return this.#clampCastPower(rodLengthCoefficient + reelCoefficient);
  }

  getLineReachModel({ rod, reel, hasReel = null, lineStats = null }) {
    const resolvedHasReel =
      hasReel === null || hasReel === undefined
        ? this.#isReelAvailable(reel)
        : !!hasReel;
    const effectiveLineStats = lineStats || null;
    const baseReachMeters = this.getRodBaseReachMeters(rod, resolvedHasReel);
    const lineMeters = this.getLineMeters(effectiveLineStats);
    const reserveMeters = Math.max(0, lineMeters - baseReachMeters);

    return {
      pixelsPerMeter: this.pixelsPerMeter,
      baseReachMeters,
      reelLineMeters: reserveMeters,
      lineLengthMeters: lineMeters,
      reserveMeters,
      maxReachMeters: lineMeters,
      maxReachPx: this.metersToPixels(lineMeters),
      hasReel: resolvedHasReel,
    };
  }

  describe(equipment, castPowerCoefficient = null) {
    const lineStats = this.getEquippedLineStats(equipment);
    const maxDistanceMeters = this.getMaxCastDistanceMeters(equipment, 0);
    const maxDistancePx = this.metersToPixels(maxDistanceMeters);
    const power =
      castPowerCoefficient === null || castPowerCoefficient === undefined
        ? this.getBuildCastPowerCoefficient(equipment)
        : this.#clamp01(castPowerCoefficient);
    const effectiveDistancePx = maxDistancePx * power;
    const baseReachMeters = this.getRodBaseReachMeters(
      equipment?.rod,
      this.#isReelAvailable(equipment?.reel),
    );
    return {
      pixelsPerMeter: this.pixelsPerMeter,
      lineLengthMeters: this.getLineMeters(lineStats),
      requiredLineMeters: baseReachMeters,
      reserveMeters: Math.max(0, maxDistanceMeters - baseReachMeters),
      maxDistanceMeters,
      maxDistancePx,
      castPowerCoefficient: power,
      effectiveDistanceMeters: this.pixelsToMeters(effectiveDistancePx),
      effectiveDistancePx,
    };
  }

  #isReelAvailable(reel) {
    if (!reel) return false;
    if (typeof reel.hasReel === "function") return reel.hasReel();
    const power = Number(reel.basePower ?? reel.engineStats?.basePower ?? 0);
    const capacity = Number(
      reel.lineCapacityMeters ?? reel.engineStats?.lineCapacityMeters ?? 0,
    );
    return power > 0 || capacity > 0;
  }

  #readNumber(source, propertyName, getterName) {
    if (!source) return NaN;
    if (typeof source[getterName] === "function") {
      return Number(source[getterName]());
    }
    return Number(source[propertyName] ?? source.engineStats?.[propertyName]);
  }

  #numberOrDefault(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  #clamp01(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(1, parsed));
  }

  #clampCastPower(value) {
    const castingPowerConfig =
      this.#config.physics?.castingPower || this.#config.castingPower || {};
    const min = this.#numberOrDefault(castingPowerConfig.minCoefficient, 0);
    const max = this.#numberOrDefault(castingPowerConfig.maxCoefficient, 1);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return this.#clamp01(0);
    return Math.max(min, Math.min(max, parsed));
  }
}
