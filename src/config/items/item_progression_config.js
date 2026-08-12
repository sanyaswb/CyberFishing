/**
 * Single source of truth for item comparison groups and progression rules.
 * Visual colors intentionally remain in RARITY_VISUAL_CONFIG.
 */
const ITEM_PROGRESSION_CONFIG = (() => {
  const quality = () => ({
    statPath: "effectiveStats.quality",
    min: 1,
    maxSections: 10,
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
    revision: 5,
    progressionLevelScale: {
      source: "rating.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    },
    qualityLimits: { minSections: 2, maxSections: 12 },
    groups: {
      "rod.spinning": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rod.feeder": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rod.float": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "reel.drag": {
        rating: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
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
        quality: quality(),
      },
      "reel.no_drag": {
        rating: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
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
        quality: quality(),
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
        },
        capacity: {
          strategyId: "line_capacity",
          statPath: "effectiveStats.lengthMeters",
          metricLabel: "Ємність",
          metricSuffix: "м",
          inventoryDetailLabel: "Залишок ліски",
          equippedDetailLabel: "На котушці",
        },
        quality: quality(),
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
        },
        quality: quality(),
      },
      "hook.standard": {
        rating: numeric("effectiveStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Міцність гачка",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rig.feeder": {
        rating: numeric("effectiveStats.rigPower", 0.5, 3, {
          metricLabel: "Сила оснастки",
        }),
        quality: quality(),
      },
      "bait.natural": {
        rating: numeric("effectiveStats.attractionPower", 0.5, 3, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.spinner": {
        rating: numeric("effectiveStats.attractionPower", 1, 10, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.wobbler": {
        rating: numeric("effectiveStats.attractionPower", 1, 10, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.jig": {
        rating: numeric("effectiveStats.jigPower", 1, 10, {
          metricLabel: "Контроль джигу",
        }),
        quality: quality(),
      },
      "float.day": {
        rating: numeric("effectiveStats.sensitivity", 1, 10, {
          metricLabel: "Чутливість",
        }),
        quality: quality(),
      },
      "net.landing": {
        rating: numeric("effectiveStats.maxWeight", 1, 10, {
          metricLabel: "Макс. вага",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "chum.carp": {
        rating: numeric("effectiveStats.maxBonus", 1, 3, {
          metricLabel: "Макс. бонус",
        }),
        quality: quality(),
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
        },
        quality: quality(),
      },
    },
  });
})();
