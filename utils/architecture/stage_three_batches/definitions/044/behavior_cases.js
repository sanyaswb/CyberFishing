"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value, (_key, item) => {
  if (item === undefined) return "#undefined";
  if (typeof item === "number" && !Number.isFinite(item)) return `#${String(item)}`;
  return item;
}));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: error.name }; }
};
const methods = Type => Object.getOwnPropertyNames(Type.prototype).sort();

// A catalog with two progression groups, a build bucket and items with and without effective stats.
const itemDb = {
  rods: {
    rod_a: { id: "rod_a", progressionProfile: { groupId: "rods" }, effectiveStats: { power: 3 } },
    rod_b: { id: "rod_b", progressionProfile: { groupId: "rods" }, gameplayStats: { power: 7 } },
    rod_c: { id: "rod_c", progressionProfile: { groupId: "rods" }, effectiveStats: { power: "x" } },
  },
  reels: { reel_a: { id: "reel_a", progressionProfile: { groupId: "reels" }, effectiveStats: { power: 4 } } },
  builds: { build_a: { id: "build_a", progressionProfile: { groupId: "rods" }, effectiveStats: { power: 99 } } },
  broken: null,
};
const strategy = { id: "power", evaluate: ({ item }) => {
  const raw = Number(item.effectiveStats?.power);
  return Number.isFinite(raw) ? { available: true, rawValue: raw } : { available: false };
} };
const harness = Registry => {
  const log = [];
  const resolved = [];
  const registry = new Registry({ itemDb, strategyRegistry: { get: () => strategy },
    logger: { warn: message => log.push(message) },
    effectiveStatsResolver: { resolve: ({ definition }) => { resolved.push(definition.id); return { ...definition.gameplayStats }; } } });
  return { registry, log, resolved };
};
const catalog = { baseline: { mode: "catalog" }, statPath: "power", formulaId: "linear" };
const fallback = { baseline: { mode: "catalog", fallback: { minimum: 1, maximum: 5 } }, statPath: "power" };

const EXECUTABLE_CASES = Object.freeze({
  ItemCatalogBaselineRegistry: Object.freeze({
    "fixed-catalog-fallback-and-unavailable-baselines": Registry => {
      const { registry, log, resolved } = harness(Registry);
      const configs = [undefined, {}, { baseline: null }, { baseline: { mode: "fixed", minimum: 2, maximum: 9 } },
        { baseline: { mode: "fixed", minimum: 5, maximum: 5 } }, { baseline: { mode: "fixed", minimum: "a", maximum: 2 } },
        { baseline: { mode: "other" } }, catalog, fallback, { baseline: { mode: "catalog" }, statPath: "none" }];
      const results = configs.map(ratingConfig => attempt(() => registry.resolve({ groupId: "rods", ratingConfig, strategy })));
      const reels = [attempt(() => registry.resolve({ groupId: "reels", ratingConfig: catalog, strategy })),
        attempt(() => registry.resolve({ groupId: "reels", ratingConfig: fallback, strategy })),
        attempt(() => registry.resolve({ groupId: "missing", ratingConfig: catalog, strategy })),
        attempt(() => registry.resolve())];
      return { methods: methods(Registry), results, reels, log, resolved,
        constructorErrors: [attempt(() => new Registry()), attempt(() => new Registry({ strategyRegistry: {} })),
          attempt(() => new Registry({ strategyRegistry: { get: () => null }, itemDb: null }).resolve({ groupId: "rods",
            ratingConfig: catalog, strategy }))] };
    },
    "cache-identity-key-and-invalidation": Registry => {
      const { registry, resolved } = harness(Registry);
      const first = registry.resolve({ groupId: "rods", ratingConfig: catalog, strategy });
      const again = registry.resolve({ groupId: "rods", ratingConfig: catalog, strategy });
      const otherMetric = registry.resolve({ groupId: "rods", ratingConfig: catalog, strategy, metricKey: "power" });
      const evaluations = resolved.length;
      registry.invalidate();
      const afterInvalidate = registry.resolve({ groupId: "rods", ratingConfig: catalog, strategy });
      return { cached: again === first, separateKey: otherMetric !== first, frozen: Object.isFrozen(first),
        evaluations, afterInvalidate: [afterInvalidate !== first, snapshot(afterInvalidate), resolved.length],
        fixedNotCached: registry.resolve({ groupId: "rods", ratingConfig: { baseline: { mode: "fixed", minimum: 1, maximum: 2 } } }) !==
          registry.resolve({ groupId: "rods", ratingConfig: { baseline: { mode: "fixed", minimum: 1, maximum: 2 } } }),
        separateInstances: harness(Registry).registry.resolve({ groupId: "rods", ratingConfig: catalog, strategy }) !== first };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemCatalogBaselineRegistry: ["fixed-catalog-fallback-and-unavailable-baselines", "cache-identity-key-and-invalidation"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-instance-cache-collection-identity-preserved",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "one-exact-classic-consumer-relationship",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
