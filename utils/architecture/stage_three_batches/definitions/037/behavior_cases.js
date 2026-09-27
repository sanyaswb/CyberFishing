"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value === undefined ? null : value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const descriptorFactory = values => Object.freeze({ kind: "descriptor", ...values });
const FISH = [{ id: "carp", name: "Короп", baitMultipliers: { worm: 1.5, corn: 0.8, dough: 2 } },
  { id: "pike", name: "Щука", baitMultipliers: { minnow: 3 } }, { id: "", name: "Nobody" }, null];
const BAITS = ["worm", "corn", "minnow", "none", "", { baitId: "dough", freshnessPercent: 40 }, { itemId: "worm" }];
const FRESHNESS = { minimum: 0, maximum: 100, defaultCurrent: 100, instanceStatePath: "instanceState.freshness",
  statPath: "gameplayStats.freshness", metricLabel: "Свіжість", lossPerMinute: 2, minimumMultiplier: 0.5 };

// Batch 037: bait effectiveness, item freshness and item progression resolution.
const EXECUTABLE_CASES = Object.freeze({
  BaitEffectivenessResolver: Object.freeze({
    "fish-bait-pairs-best-match-and-multipliers": Resolver => {
      const resolver = new Resolver({ descriptorFactory });
      return FISH.flatMap(fish => BAITS.map(bait => ({
        descriptor: snapshot(resolver.resolve(fish, bait)),
        multiplier: resolver.resolveMultiplier(fish, typeof bait === "string" ? bait : bait.baitId),
        best: snapshot(resolver.resolveBestMatch(fish, BAITS)),
        bestMultiplier: resolver.resolveBestMultiplier(fish, BAITS),
      })));
    },
    "knowledge-and-collaborator-contract": Resolver => {
      const hidden = new Resolver({ descriptorFactory, knowledgePolicy: { isDiscovered: ({ baitId }) => baitId !== "corn" } });
      return { hidden: BAITS.map(bait => snapshot(hidden.resolve(FISH[0], bait))),
        invalid: [attempt(() => new Resolver({ gradePolicy: {} })), attempt(() => new Resolver({ knowledgePolicy: {} }))] };
    },
  }),
  ItemFreshnessResolver: Object.freeze({
    "freshness-profiles-items-and-exposure": Resolver => {
      const resolver = new Resolver({ profileProvider: item => item?.profile === undefined ? FRESHNESS : item.profile,
        descriptorFactory });
      const items = [{}, { instanceState: { freshness: 60 } }, { gameplayStats: { freshness: 120 } },
        { instanceState: { freshness: "x" } }, { profile: null }, { profile: { minimum: 3, maximum: 1 } }];
      return items.flatMap(item => [0, 30000, 3600000].map(exposureMs => snapshot(resolver.resolve(item, undefined, { exposureMs }))));
    },
    "explicit-config-and-decay-policy": Resolver => {
      const decayPolicy = { resolve: ({ percent, exposureMs }) => Math.max(0, percent - exposureMs / 1000) };
      const resolver = new Resolver({ profileProvider: () => FRESHNESS, decayPolicy, descriptorFactory });
      return [snapshot(resolver.resolve({ instanceState: { freshness: 80 } }, { ...FRESHNESS, lossPerMinute: 5 }, { exposureMs: 20000 })),
        resolver.resolve({}, null), Object.getPrototypeOf(Resolver).name];
    },
  }),
  ItemProgressionResolver: Object.freeze({
    "groups-capabilities-cache-and-invalidation": Resolver => {
      const calls = [];
      const config = { revision: 3, groups: {
        rod: { rating: { statPath: "effectiveStats.power" }, ratingTier: { tiers: [] }, quality: { statPath: "effectiveStats.grade" } },
        reel: { capacity: { statPath: "effectiveStats.capacity" }, quality: { statPath: "effectiveStats.grade" } },
        empty: {},
      } };
      const resolver = new Resolver({
        configProvider: () => config,
        ratingResolver: { resolve: ({ item, groupId }) => { calls.push(["rating", groupId]);
          return Object.freeze({ available: true, value: item.effectiveStats.power }); } },
        ratingTierResolver: { resolve: rating => Object.freeze({ available: true, tier: rating.value > 5 ? "high" : "low" }) },
        qualityResolver: { resolve: ({ item }) => Object.freeze({ available: item.effectiveStats.grade !== undefined,
          reason: item.effectiveStats.grade === undefined ? "grade_missing" : null, grade: item.effectiveStats.grade }) },
        capacityResolver: { resolve: ({ item, context }) => Object.freeze({ available: true,
          capacity: item.effectiveStats.capacity, load: context.load || 0 }) },
        baselineRegistry: { invalidate: () => calls.push(["baseline-invalidate"]) },
        effectiveStatsResolver: { resolve: ({ definition }) => Object.freeze({ ...(definition.gameplayStats || {}) }) },
      });
      const rod = { progressionProfile: { groupId: "rod" }, gameplayStats: { power: 7, grade: 3 } };
      const results = [resolver.resolve(rod), resolver.resolve(rod),
        resolver.resolve({ progressionProfile: { groupId: "reel" }, effectiveStats: { capacity: 120 } }, { load: 30 }),
        resolver.resolve({ progressionProfile: { groupId: "empty" }, gameplayStats: {} }),
        resolver.resolve({ progressionProfile: { groupId: "missing" }, gameplayStats: {} }),
        resolver.resolve({ gameplayStats: {} })];
      const sameCore = results[0] === results[1];
      resolver.invalidate();
      const afterInvalidate = resolver.resolve(rod);
      return { results: results.map(snapshot), sameCore, recomputed: afterInvalidate !== results[0], calls,
        types: results.map(result => result.constructor.name) };
    },
    "constructor-contract": Resolver => [
      attempt(() => new Resolver()), attempt(() => new Resolver({ configProvider: () => ({}) })),
      attempt(() => new Resolver({ configProvider: () => ({}), ratingResolver: { resolve() {} }, ratingTierResolver: {} })),
      attempt(() => new Resolver({ configProvider: () => ({}), ratingResolver: { resolve() {} } })),
    ],
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    BaitEffectivenessResolver: ["fish-bait-pairs-best-match-and-multipliers", "knowledge-and-collaborator-contract"],
    ItemFreshnessResolver: ["freshness-profiles-items-and-exposure", "explicit-config-and-decay-policy"],
    ItemProgressionResolver: ["groups-capabilities-cache-and-invalidation", "constructor-contract"],
  },
  compatibilityCases: [
    "three-representation-only-named-esm-targets-and-three-exact-exports",
    "seven-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "owner-created-composition-identities-preserved",
    "progression-memo-cache-identity-preserved",
    "three-reviewed-global-this-exposures-moved-to-the-exact-activation-shims",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "three-exact-classic-activations-at-their-legacy-positions",
    "three-exact-classic-consumer-relationships-and-seven-retired-bridges",
    "three-consumerless-activations-retired-as-inert-classic-placeholders",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
