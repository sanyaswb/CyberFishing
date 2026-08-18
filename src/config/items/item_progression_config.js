/**
 * Single source of truth for optional item metric capabilities.
 *
 * A descriptor exists only when its configuration exists in the item group.
 * Matrix candidates must stay absent until a concrete gameplay consumer is
 * confirmed; authored stats alone are not sufficient evidence.
 * Visual colors intentionally remain in RARITY_VISUAL_CONFIG.
 */
const ITEM_PROGRESSION_CONFIG = (() => {
  const quality = (gameplayConsumer) => ({
    statPath: "effectiveStats.quality",
    min: 1,
    maxSections: 10,
    gameplayConsumer,
  });
  const condition = (gameplayConsumer) => ({
    statPath: "effectiveStats.durability",
    instanceStatePath: "statOverrides.durability",
    minimum: 0,
    maximum: 100,
    metricLabel: "Стан",
    gameplayConsumer,
  });
  const fixed = (minimum, maximum) => ({
    mode: "fixed",
    minimum,
    maximum,
  });
  const numeric = (statPath, minimum, maximum, options = {}) => ({
    strategyId: "numeric_stat",
    statPath,
    direction: options.direction || "higher_is_better",
    baseline: fixed(minimum, maximum),
    metricLabel: options.metricLabel || statPath.split(".").pop(),
    metricSuffix: options.metricSuffix || "",
    gameplayConsumer: options.gameplayConsumer,
  });
  const component = (
    statPath,
    weight,
    minimum,
    maximum,
    label,
  ) => ({
    strategyId: "numeric_stat",
    statPath,
    weight,
    direction: "higher_is_better",
    baseline: fixed(minimum, maximum),
    metricLabel: label,
  });
  const deepFreeze = (value, seen = new WeakSet()) => {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    for (const child of Object.values(value)) deepFreeze(child, seen);
    return Object.freeze(value);
  };

  return deepFreeze({
    revision: 7,
    qualityLimits: { minSections: 2, maxSections: 12 },
    groups: {
      "rod.spinning": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
          gameplayConsumer: "Rod.getEffectiveMaxLoadKg",
        }),
        condition: condition("Rod.getEffectiveMaxLoadKg"),
      },
      "rod.feeder": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
          gameplayConsumer: "Rod.getEffectiveMaxLoadKg",
        }),
        condition: condition("Rod.getEffectiveMaxLoadKg"),
      },
      "rod.float": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
          gameplayConsumer: "Rod.getEffectiveMaxLoadKg",
        }),
        condition: condition("Rod.getEffectiveMaxLoadKg"),
      },
      "reel.drag": {
        rating: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
          gameplayConsumer: "ReelSystem",
          components: [
            component("effectiveStats.maxLoadKg", 0.35, 0.5, 5, "Навантаження"),
            component("effectiveStats.dragMaxKg", 0.25, 0, 4, "Фрикціон"),
            component(
              "effectiveStats.retrieveSpeedMetersPerSec",
              0.2,
              0.4,
              1.5,
              "Підмотка",
            ),
            component(
              "effectiveStats.lineCapacityMeters",
              0.15,
              10,
              100,
              "Ємність",
            ),
            component("effectiveStats.bearingCount", 0.05, 0, 10, "Підшипники"),
          ],
        },
        condition: condition("Reel.getEffectiveMaxLoadKg"),
      },
      "reel.no_drag": {
        rating: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
          gameplayConsumer: "ReelSystem",
          components: [
            component("effectiveStats.maxLoadKg", 0.45, 0.5, 5, "Навантаження"),
            component(
              "effectiveStats.retrieveSpeedMetersPerSec",
              0.3,
              0.4,
              1.5,
              "Підмотка",
            ),
            component(
              "effectiveStats.lineCapacityMeters",
              0.25,
              10,
              100,
              "Ємність",
            ),
          ],
        },
        condition: condition("Reel.getEffectiveMaxLoadKg"),
      },
      "line.fishing": {
        rating: {
          strategyId: "derived_stat",
          formulaId: "ratio",
          numeratorPath: "effectiveStats.maxLoadKg",
          denominatorPath: "effectiveStats.diameterMm",
          direction: "higher_is_better",
          baseline: {
            mode: "catalog",
            fallback: { minimum: 3, maximum: 8 },
          },
          metricLabel: "Міцність до товщини",
          metricSuffix: "кг/мм",
          gameplayConsumer: "LineSystem",
        },
        capacity: {
          strategyId: "line_capacity",
          statPath: "effectiveStats.lengthMeters",
          metricLabel: "Ємність",
          metricSuffix: "м",
          inventoryDetailLabel: "Залишок ліски",
          equippedDetailLabel: "На котушці",
          gameplayConsumer: "LineAllocationPolicy",
        },
        condition: condition("LineSystem.getEffectiveMaxLoadKg"),
      },
      "line.leader": {
        rating: {
          strategyId: "derived_stat",
          formulaId: "ratio",
          numeratorPath: "effectiveStats.maxLoadKg",
          denominatorPath: "effectiveStats.diameterMm",
          direction: "higher_is_better",
          baseline: fixed(3, 8),
          metricLabel: "Міцність до товщини",
          metricSuffix: "кг/мм",
          gameplayConsumer: "TackleFailureSelector",
        },
        condition: condition("TackleFailureSelector"),
      },
      "hook.standard": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Міцність гачка",
          metricSuffix: "кг",
          gameplayConsumer: "Hook.getEffectiveMaxLoadKg",
        }),
        quality: quality("HookQualityModifier"),
        condition: condition("Hook.getEffectiveMaxLoadKg"),
      },
      "rig.feeder": {
        quality: quality("EnvironmentalCompensationModifier"),
      },
      "bait.natural": {
        freshness: {
          instanceStatePath: "freshnessState.percent",
          defaultCurrent: 100,
          minimum: 0,
          maximum: 100,
          metricLabel: "Свіжість",
          decayPolicyId: "water_exposure_linear",
          lossPerMinute: 5,
          modifierPolicyId: "linear_floor",
          minimumMultiplier: 0.5,
          gameplayConsumer: "BaitEffectivenessResolver",
        },
      },
      "lure.spinner": {
        quality: quality("EnvironmentalCompensationModifier"),
      },
      "lure.wobbler": {
        quality: quality("EnvironmentalCompensationModifier"),
      },
      "lure.jig": {
        quality: quality("EnvironmentalCompensationModifier"),
      },
      "float.day": {
        quality: quality("EnvironmentalCompensationModifier"),
      },
      "net.landing": {
        rating: numeric("effectiveStats.maxWeight", 1, 10, {
          metricLabel: "Макс. вага",
          metricSuffix: "кг",
          gameplayConsumer: "LandingNet.calculateCatchChance",
        }),
        quality: quality("NetQualityModifier"),
      },
      "chum.carp": {
        rating: numeric("effectiveStats.maxBonus", 1, 3, {
          metricLabel: "Макс. бонус",
          gameplayConsumer: "ChumBonusCalculator",
        }),
      },
      "delivery.boat": {
        rating: {
          strategyId: "derived_stat",
          formulaId: "upgrade_level_stat",
          tablePath: "effectiveStats.statsByLevel",
          upgradeLevelPath: "effectiveStats.upgradeLevel",
          statKey: "speedPxPerSec",
          direction: "higher_is_better",
          baseline: fixed(100, 300),
          metricLabel: "Швидкість поточного upgrade",
          metricSuffix: "px/с",
          gameplayConsumer: "BoatDeliveryController",
        },
      },
    },
  });
})();
