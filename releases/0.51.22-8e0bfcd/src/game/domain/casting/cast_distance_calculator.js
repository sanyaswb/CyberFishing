import { DistanceUnitConverter } from "./distance_unit_converter.js";
import { FloatTackleLineBudgetPolicy } from "../fishing/float_tackle_line_budget_policy.js";
import { clampUnitFinite, finiteOr } from "../../../engine/math/number_normalization.js";

export class CastDistanceCalculator {
  #config;
  #physicsConfig;
  #converter;
  #lineConfig;
  #floatLineBudgetPolicy;

  constructor(config = {}) {
    this.#config = config || {};
    this.#physicsConfig = this.#resolvePhysicsConfigAdapter(this.#config);
    const physicsConfig =
      this.#physicsConfig?.getLineSystemConfig?.() ||
      this.#config ||
      {};
    this.#converter = new DistanceUnitConverter(physicsConfig);
    this.#lineConfig =
      this.#physicsConfig?.getLineConfig?.() || physicsConfig.line || {};
    this.#floatLineBudgetPolicy = new FloatTackleLineBudgetPolicy(
      this.#config.casting?.floatDepth || {},
    );
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
    const rodLength = finiteOr(
      this.#readNumber(rod, "lengthMeters", "getLengthMeters"),
      2.0,
    );
    if (hasReel) {
      const multiplier = finiteOr(
        this.#lineConfig.rodLengthReserveMultiplier,
        2.0,
      );
      return Math.max(0, rodLength * multiplier);
    }

    const multiplier = finiteOr(
      this.#lineConfig.noReelMinRodLengthMultiplier,
      2.0,
    );
    return Math.max(0, rodLength * multiplier);
  }

  getLineMeters(lineStats = null) {
    return Math.max(
      0,
      finiteOr(lineStats?.effectiveStats?.lengthMeters, 0),
    );
  }

  getEquippedLineStats(equipment) {
    if (!equipment) return null;
    return equipment.line || null;
  }

  getMaxCastDistanceMeters(equipment, fallbackMeters = null, options = {}) {
    const lineStats = this.getEquippedLineStats(equipment);
    const lineMeters = this.getLineMeters(lineStats);
    if (lineMeters > 0) {
      const budget = this.getFloatLineBudget(
        equipment,
        options?.selectedDepthMeters,
      );
      return budget?.applies ? budget.maxCastDistanceMeters : lineMeters;
    }

    const rod = equipment?.rod || null;
    const legacyPixels = this.#readNumber(rod, "maxDistance", "getMaxDistance");
    if (Number.isFinite(legacyPixels)) {
      return this.pixelsToMeters(legacyPixels);
    }

    return finiteOr(fallbackMeters, 0);
  }

  getMaxCastDistancePx(equipment, fallbackPx = Infinity, options = {}) {
    const fallbackMeters = Number.isFinite(Number(fallbackPx))
      ? this.pixelsToMeters(Number(fallbackPx))
      : null;
    const meters = this.getMaxCastDistanceMeters(
      equipment,
      fallbackMeters,
      options,
    );
    if (!Number.isFinite(meters)) return fallbackPx;
    return this.metersToPixels(meters);
  }

  getEffectiveCastDistancePx(
    equipment,
    castPowerCoefficient = 1,
    options = {},
  ) {
    const power =
      castPowerCoefficient === null || castPowerCoefficient === undefined
        ? this.getBuildCastPowerCoefficient(equipment)
        : clampUnitFinite(castPowerCoefficient);
    return this.getMaxCastDistancePx(equipment, 0, options) * power;
  }

  getBuildCastPowerCoefficient(equipment, fallback = null) {
    const castingPowerConfig = this.#getCastingPowerConfig();
    const fallbackCoefficient = finiteOr(
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
    const rodLengthMeters = finiteOr(
      this.#readNumber(rod, "lengthMeters", "getLengthMeters"),
      0,
    );
    const rodLengthCoefficient =
      Number.isFinite(explicitRodCoefficient)
        ? explicitRodCoefficient
        : finiteOr(
            castingPowerConfig.rodLengthCoefficientPerMeter,
            0,
          ) * rodLengthMeters;

    const reel = equipment?.reel || null;
    const bearingCount = this.#isReelAvailable(reel)
      ? finiteOr(this.#readNumber(reel, "bearingCount"), 0)
      : 0;
    const reelCoefficient =
      finiteOr(castingPowerConfig.reelBearingCoefficient, 0) *
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

  describe(equipment, castPowerCoefficient = null, options = {}) {
    const lineStats = this.getEquippedLineStats(equipment);
    const lineBudget = this.getFloatLineBudget(
      equipment,
      options?.selectedDepthMeters,
    );
    const maxDistanceMeters = this.getMaxCastDistanceMeters(
      equipment,
      0,
      options,
    );
    const maxDistancePx = this.metersToPixels(maxDistanceMeters);
    const power =
      castPowerCoefficient === null || castPowerCoefficient === undefined
        ? this.getBuildCastPowerCoefficient(equipment)
        : clampUnitFinite(castPowerCoefficient);
    const effectiveDistancePx = maxDistancePx * power;
    const baseReachMeters = this.getRodBaseReachMeters(
      equipment?.rod,
      this.#isReelAvailable(equipment?.reel),
    );
    return {
      pixelsPerMeter: this.pixelsPerMeter,
      lineLengthMeters: this.getLineMeters(lineStats),
      selectedDepthMeters: lineBudget?.selectedDepthMeters ?? null,
      depthLineCostMeters: lineBudget?.depthLineCostMeters ?? 0,
      maxDepthMeters: lineBudget?.maxDepthMeters ?? null,
      isFloatDepthLimited: !!lineBudget?.applies,
      requiredLineMeters: baseReachMeters,
      reserveMeters: Math.max(0, maxDistanceMeters - baseReachMeters),
      maxDistanceMeters,
      maxDistancePx,
      castPowerCoefficient: power,
      effectiveDistanceMeters: this.pixelsToMeters(effectiveDistancePx),
      effectiveDistancePx,
    };
  }

  getFloatLineBudget(equipment, selectedDepthMeters = null) {
    return this.#floatLineBudgetPolicy?.resolve?.({
      equipment,
      selectedDepthMeters,
    }) || null;
  }

  #isReelAvailable(reel) {
    if (!reel) return false;
    if (typeof reel.hasReel === "function") return reel.hasReel();
    const power = Number(reel.effectiveStats?.basePower ?? 0);
    const capacity = Number(reel.effectiveStats?.lineCapacityMeters ?? 0);
    return power > 0 || capacity > 0;
  }

  #readNumber(source, propertyName, getterName) {
    if (!source) return NaN;
    if (typeof source[getterName] === "function") {
      return Number(source[getterName]());
    }
    return Number(source.effectiveStats?.[propertyName]);
  }

  #clampCastPower(value) {
    const castingPowerConfig = this.#getCastingPowerConfig();
    const min = finiteOr(castingPowerConfig.minCoefficient, 0);
    const max = finiteOr(castingPowerConfig.maxCoefficient, 1);
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return clampUnitFinite(0);
    return Math.max(min, Math.min(max, parsed));
  }

  #getCastingPowerConfig() {
    return (
      this.#physicsConfig?.getCastingPowerConfig?.() ||
      this.#config.castingPower ||
      {}
    );
  }

  // Composition passes a config carrying its FightPhysicsConfigAdapter (CONFIG or ConfigProvider).
  #resolvePhysicsConfigAdapter(config) {
    if (config?.fightPhysicsConfig) return config.fightPhysicsConfig;
    return null;
  }
}
