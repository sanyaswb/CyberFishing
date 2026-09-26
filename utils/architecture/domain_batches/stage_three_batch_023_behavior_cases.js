"use strict";

const assert = require("node:assert/strict");

// Every case also records the inherited contract: the strategy id, frozen results and that the
// class still extends the shared completed-prefix superclass instance it was given.
const shape = (Strategy, results) => {
  const strategy = new Strategy();
  assert(results.every(Object.isFrozen));
  return { id: strategy.id, superclass: Object.getPrototypeOf(Strategy).name,
    staticNormalize: Strategy.normalizeValue(5, 0, 10, "lower_is_better"), results };
};

const item = { stats: { drag: "7.5", gear: 5.2, weight: null, bad: "x" },
  upgrades: { table: { 0: { drag: 4 }, 2: { drag: 9.5 } }, level: 2 } };

const BATCH_023_EXECUTABLE_CASES = Object.freeze({
  DerivedStatMetricStrategy: Object.freeze({
    "ratio-upgrade-level-and-unsupported-formulas": Strategy => {
      const strategy = new Strategy();
      return shape(Strategy, [
        strategy.evaluate({ item, ratingConfig: { formulaId: "ratio",
          numeratorPath: "stats.drag", denominatorPath: "stats.gear" } }),
        strategy.evaluate({ item, ratingConfig: { formulaId: "ratio",
          numeratorPath: "stats.drag", denominatorPath: "stats.weight" } }),
        strategy.evaluate({ item: { a: 1, b: 0 }, ratingConfig: { formulaId: "ratio",
          numeratorPath: "a", denominatorPath: "b" } }),
        strategy.evaluate({ item, ratingConfig: { formulaId: "upgrade_level_stat",
          tablePath: "upgrades.table", upgradeLevelPath: "upgrades.level", statKey: "drag" } }),
        strategy.evaluate({ item, ratingConfig: { formulaId: "upgrade_level_stat",
          tablePath: "upgrades.table", upgradeLevelPath: "upgrades.level", statKey: "gear" } }),
        strategy.evaluate({ item, ratingConfig: { formulaId: "unknown" } }),
        strategy.evaluate(),
      ]);
    },
  }),
  NumericStatMetricStrategy: Object.freeze({
    "stat-path-values-and-missing-metrics": Strategy => {
      const strategy = new Strategy();
      return shape(Strategy, [
        strategy.evaluate({ item, ratingConfig: { statPath: "stats.drag" } }),
        strategy.evaluate({ item, ratingConfig: { statPath: "stats.gear" } }),
        strategy.evaluate({ item, ratingConfig: { statPath: "stats.bad" } }),
        strategy.evaluate({ item, ratingConfig: { statPath: "stats.missing" } }),
        strategy.evaluate({ item: null, ratingConfig: {} }),
        strategy.evaluate(),
      ]);
    },
  }),
  TargetRangeMetricStrategy: Object.freeze({
    "target-falloff-normalization-and-invalid-ranges": Strategy => {
      const strategy = new Strategy();
      const range = { minimum: 4, maximum: 6, falloffMinimum: 2, falloffMaximum: 10 };
      const at = value => strategy.evaluate({ item: { stats: { v: value } },
        ratingConfig: { statPath: "stats.v", targetRange: range } });
      return shape(Strategy, [
        at(5), at(3), at(1), at(4), at(6), at(8), at(12), at("7.25"),
        strategy.evaluate({ item: { stats: { v: 5 } }, ratingConfig: { statPath: "stats.v",
          targetRange: { ...range, falloffMinimum: 5 } } }),
        strategy.evaluate({ item: { stats: { v: 5 } }, ratingConfig: { statPath: "stats.v",
          targetRange: { minimum: 4 } } }),
        strategy.evaluate({ item: { stats: {} }, ratingConfig: { statPath: "stats.v", targetRange: range } }),
        strategy.evaluate(),
      ]);
    },
  }),
});

module.exports = { BATCH_023_EXECUTABLE_CASES };
