/**
 * Single source of truth for item comparison groups and progression rules.
 * Visual colors intentionally remain in RARITY_VISUAL_CONFIG.
 */
const ITEM_PROGRESSION_CONFIG = (() => {
  const quality = () => ({
    statPath: "engineStats.quality",
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
    revision: 4,
    levelScale: {
      source: "power.normalized",
      distribution: "equal_segments",
      minimum: 1,
      segments: 6,
    },
    qualityLimits: { minSections: 2, maxSections: 12 },
    groups: {
      "rod.spinning": {
        power: numeric("engineStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rod.feeder": {
        power: numeric("engineStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rod.float": {
        power: numeric("engineStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Макс. навантаження",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "reel.drag": {
        power: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
          components: [
            component("engineStats.maxLoadKg", 0.35, 0.5, 5, "Навантаження"),
            component("engineStats.dragMaxKg", 0.25, 0, 4, "Фрикціон"),
            component(
              "engineStats.retrieveSpeedMetersPerSec",
              0.2,
              0.4,
              1.5,
              "Підмотка",
            ),
            component(
              "engineStats.lineCapacityMeters",
              0.15,
              10,
              100,
              "Ємність",
            ),
            component("engineStats.bearingCount", 0.05, 0, 10, "Підшипники"),
          ],
        },
        quality: quality(),
      },
      "reel.no_drag": {
        power: {
          strategyId: "composite",
          metricLabel: "Композитний рейтинг",
          components: [
            component("engineStats.maxLoadKg", 0.45, 0.5, 5, "Навантаження"),
            component(
              "engineStats.retrieveSpeedMetersPerSec",
              0.3,
              0.4,
              1.5,
              "Підмотка",
            ),
            component(
              "engineStats.lineCapacityMeters",
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
        power: {
          strategyId: "derived_stat",
          formulaId: "ratio",
          numeratorPath: "engineStats.maxLoadKg",
          denominatorPath: "engineStats.diameterMm",
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
          statPath: "engineStats.lengthMeters",
          metricLabel: "Ємність",
          metricSuffix: "м",
          inventoryDetailLabel: "Залишок ліски",
          equippedDetailLabel: "На котушці",
        },
        quality: quality(),
      },
      "line.leader": {
        power: {
          strategyId: "derived_stat",
          formulaId: "ratio",
          numeratorPath: "engineStats.maxLoadKg",
          denominatorPath: "engineStats.diameterMm",
          direction: "higher_is_better",
          baseline: fixed(3, 8),
          metricLabel: "Міцність до товщини",
          metricSuffix: "кг/мм",
        },
        quality: quality(),
      },
      "hook.standard": {
        power: numeric("engineStats.maxLoadKg", 0.5, 3, {
          metricLabel: "Міцність гачка",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "rig.feeder": {
        power: numeric("engineStats.rigPower", 0.5, 3, {
          metricLabel: "Сила оснастки",
        }),
        quality: quality(),
      },
      "bait.natural": {
        power: numeric("engineStats.attractionPower", 0.5, 3, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.spinner": {
        power: numeric("engineStats.attractionPower", 1, 10, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.wobbler": {
        power: numeric("engineStats.attractionPower", 1, 10, {
          metricLabel: "Привабливість",
        }),
        quality: quality(),
      },
      "lure.jig": {
        power: numeric("engineStats.jigPower", 1, 10, {
          metricLabel: "Контроль джигу",
        }),
        quality: quality(),
      },
      "float.day": {
        power: numeric("engineStats.sensitivity", 1, 10, {
          metricLabel: "Чутливість",
        }),
        quality: quality(),
      },
      "net.landing": {
        power: numeric("engineStats.maxWeight", 1, 10, {
          metricLabel: "Макс. вага",
          metricSuffix: "кг",
        }),
        quality: quality(),
      },
      "chum.carp": {
        power: numeric("engineStats.maxBonus", 1, 3, {
          metricLabel: "Макс. бонус",
        }),
        quality: quality(),
      },
      "delivery.boat": {
        power: {
          strategyId: "derived_stat",
          formulaId: "upgrade_level_stat",
          tablePath: "engineStats.statsByLevel",
          levelPath: "engineStats.level",
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
