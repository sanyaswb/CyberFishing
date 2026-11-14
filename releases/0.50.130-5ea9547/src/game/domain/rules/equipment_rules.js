import { normalizeDistance } from "../../../engine/math/normalize_distance.js";

/** @typedef {{ getEquipped: () => object }} IEquipmentQueries */
export class EquipmentRules {
  #castDistanceCalculator;
  #config;
  #messages;

  // Composition injects the presentation rule messages (INVENTORY_RULE_MESSAGES) for the rod kind names.
  constructor(castDistanceCalculator = null, config = null, messages = null) {
    // Composition injects the runtime config.
    this.#config = config || {};
    this.#messages = messages;
    this.#castDistanceCalculator = castDistanceCalculator;
  }

  isSpinning(equipment) {
    return equipment?.rod?.variant === "spinning";
  }

  isFeeder(equipment) {
    return equipment?.rod?.variant === "feeder";
  }

  isFloatRod(equipment) {
    const variant = equipment?.rod?.variant;
    return variant === "float" || variant === "pole";
  }

  getRodKind(equipment) {
    const rod = equipment?.rod;
    if (!rod) return "none";
    if (rod.variant === "spinning") return "spinning";
    if (rod.variant === "feeder") return "feeder";
    if (rod.variant === "float" || rod.variant === "pole") {
      return this.requiresReel(equipment) ? "bolognese" : "pole";
    }
    return rod.variant || "unknown";
  }

  getRodDisplayName(equipment) {
    const labels = this.#messages.rodKinds;
    return labels[this.getRodKind(equipment)] || labels.unknown;
  }

  requiresReel(equipment) {
    const rod = equipment?.rod;
    if (!rod) return false;
    return rod.effectiveStats?.hasReel ?? rod.variant !== "pole";
  }

  hasEquippedLine(equipment) {
    return (Number(equipment?.line?.effectiveStats?.lengthMeters) || 0) > 0;
  }

  canSelectDepth(equipment) {
    if (!equipment?.rod) return false;
    if (this.isFeeder(equipment)) return false;
    const firstBait = equipment.baits?.[0];
    return (
      (this.isSpinning(equipment) && firstBait?.variant === "jig") ||
      (this.isFloatRod(equipment) && !!equipment.float)
    );
  }

  getMaxCastDistance(
    equipment,
    fallback = Infinity,
    selectedDepthMeters = null,
  ) {
    const distance = this.#castDistanceCalculator.getMaxCastDistancePx(
      equipment,
      fallback,
      { selectedDepthMeters },
    );
    return normalizeDistance(distance, fallback);
  }

  getEffectiveCastDistance(
    equipment,
    fallback = Infinity,
    castPowerCoefficient = null,
    selectedDepthMeters = null,
  ) {
    const power =
      castPowerCoefficient === null || castPowerCoefficient === undefined
        ? this.getCastPowerCoefficient(equipment)
        : castPowerCoefficient;
    const distance = this.#castDistanceCalculator.getEffectiveCastDistancePx(
      equipment,
      power,
      { selectedDepthMeters },
    );
    return normalizeDistance(distance, fallback);
  }

  getCastPowerCoefficient(equipment = null, fallback = null) {
    const castingConfig = this.#config?.casting || {};
    const castingPowerConfig =
      this.#config?.fightPhysicsConfig?.getCastingPowerConfig?.() ||
      {};
    const fallbackValue =
      fallback ??
      castingPowerConfig.fallbackCoefficient ??
      castingConfig.inventoryPreviewPowerCoefficient ??
      castingConfig.powerCoefficient ??
      castingConfig.castPowerCoefficient ??
      fallback;
    return this.#castDistanceCalculator.getBuildCastPowerCoefficient(
      equipment,
      fallbackValue,
    );
  }

  getCastDistanceInfo(
    equipment,
    castPowerCoefficient = null,
    selectedDepthMeters = null,
  ) {
    return this.#castDistanceCalculator.describe(equipment, castPowerCoefficient, {
      selectedDepthMeters,
    });
  }

  getFloatLineBudget(equipment, selectedDepthMeters = null) {
    return this.#castDistanceCalculator.getFloatLineBudget(
      equipment,
      selectedDepthMeters,
    );
  }

  getMaxHookDepth(equipment, config) {
    const firstBait = equipment?.baits?.[0];
    if (this.isSpinning(equipment) && firstBait?.variant === "jig") {
      return firstBait.effectiveStats?.maxDepth ?? 8.0;
    }
    if (this.isFloatRod(equipment) && equipment?.float) {
      const budget = this.getFloatLineBudget(equipment);
      if (budget?.applies) return budget.maxDepthMeters;
    }
    return (
      config.fightPhysicsConfig?.getLureRetrieveConfig?.()
        ?.defaultSurfaceDepthMeters ??
      0.1
    );
  }
}
