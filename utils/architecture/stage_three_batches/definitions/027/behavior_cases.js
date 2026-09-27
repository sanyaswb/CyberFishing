"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const strategy = id => ({ id, evaluate: () => id });
const qualities = [undefined, null, 0, 1, 2.5, 5, 7, 10, 11, -3, "6", Number.NaN];

// Batch 027: item metric strategy registry, three quality modifiers and the authored rarity strategy.
// Every case runs on the classic baseline and the ESM target with the same completed-prefix imports.
const EXECUTABLE_CASES = Object.freeze({
  ItemMetricStrategyRegistry: Object.freeze({
    "registration-lookup-duplicates-and-frozen-ids": Registry => {
      const registry = new Registry([strategy("power"), strategy("capacity")]);
      const chained = registry.register(strategy("rating")) === registry;
      const ids = registry.ids;
      return {
        chained, ids: [...ids], frozen: Object.isFrozen(ids), freshIds: registry.ids !== ids,
        get: [registry.get("power")?.id, registry.get(null), registry.get(undefined), registry.get("missing")],
        has: [registry.has("capacity"), registry.has(""), registry.has(0)],
        duplicate: attempt(() => registry.register(strategy("power"))),
        invalid: [attempt(() => registry.register(null)), attempt(() => registry.register({ id: "x" })),
          attempt(() => registry.register({ id: "", evaluate() {} }))],
        empty: [...new Registry().ids],
        identity: registry.get("rating") === registry.get("rating"),
      };
    },
  }),
  EnvironmentalCompensationModifier: Object.freeze({
    "coefficients-ranges-and-injected-grade-policy": Modifier => {
      const modifier = new Modifier();
      const ranges = [undefined, [0.2, 0.8], [0.5], [null, 0.3], ["0.4", "0.9"], [Number.NaN, Number.POSITIVE_INFINITY]];
      const results = qualities.map(quality => ranges.map(range => modifier.getCoefficient(quality, range)));
      const injected = new Modifier({ gradePolicy: { normalizeToUnit: quality => Number(quality) / 100 } });
      return { results, injected: [injected.getCoefficient(50), injected.getCoefficient(100, [0, 1])] };
    },
  }),
  HookQualityModifier: Object.freeze({
    "power-bonus-and-injected-grade-policy": Modifier => {
      const modifier = new Modifier();
      const injected = new Modifier({ gradePolicy: { normalize: quality => Number(quality) * 2 } });
      return { bonus: qualities.map(quality => modifier.getPowerBonus(quality)),
        injected: [injected.getPowerBonus(3), injected.getPowerBonus(0)] };
    },
  }),
  NetQualityModifier: Object.freeze({
    "catch-chance-bonus-and-injected-grade-policy": Modifier => {
      const modifier = new Modifier();
      const injected = new Modifier({ gradePolicy: { normalize: quality => Number(quality) } });
      return { bonus: qualities.map(quality => modifier.getCatchChanceBonusPercent(quality)),
        injected: [injected.getCatchChanceBonusPercent(4.26), injected.getCatchChanceBonusPercent(9)] };
    },
  }),
  AuthoredItemRarityStrategy: Object.freeze({
    "authored-descriptors-validation-and-cache-identity": Strategy => {
      const rarity = new Strategy();
      const profile = fields => ({ mode: "authored", tier: 2, maxTier: 5, isUnique: false, ...fields });
      const first = rarity.resolve(profile());
      const second = rarity.resolve(profile());
      const unique = rarity.resolve(profile({ isUnique: true, uniqueId: "  crown  " }));
      return {
        supports: [rarity.supports(profile()), rarity.supports({ mode: "rolled" }), rarity.supports(null)],
        descriptors: [first, unique, rarity.resolve(profile({ tier: 1, maxTier: 1 })),
          rarity.resolve(profile({ tier: 5, maxTier: 5 }))].map(snapshot),
        cachedIdentity: first === second, distinctUnique: unique !== first,
        isDescriptorFrozen: Object.isFrozen(first),
        errors: [
          attempt(() => rarity.resolve({ mode: "rolled" })),
          attempt(() => rarity.resolve(profile({ tier: 0 }))),
          attempt(() => rarity.resolve(profile({ tier: 1.5 }))),
          attempt(() => rarity.resolve(profile({ maxTier: "5" }))),
          attempt(() => rarity.resolve(profile({ tier: 6 }))),
          attempt(() => rarity.resolve(profile({ isUnique: "no" }))),
          attempt(() => rarity.resolve(profile({ isUnique: true, uniqueId: "   " }))),
          attempt(() => rarity.resolve(profile({ uniqueId: "crown" }))),
        ],
      };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    ItemMetricStrategyRegistry: ["registration-lookup-duplicates-and-frozen-ids"],
    EnvironmentalCompensationModifier: ["coefficients-ranges-and-injected-grade-policy"],
    HookQualityModifier: ["power-bonus-and-injected-grade-policy"],
    NetQualityModifier: ["catch-chance-bonus-and-injected-grade-policy"],
    AuthoredItemRarityStrategy: ["authored-descriptors-validation-and-cache-identity"],
  },
  compatibilityCases: [
    "five-representation-only-named-esm-targets-and-five-exact-exports",
    "five-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "three-owner-created-grade-policy-composition-identities-preserved",
    "three-reviewed-global-this-exposures-moved-to-the-exact-activation-shims",
    "imported-superclass-of-the-authored-rarity-strategy-preserved",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "five-exact-classic-activations-at-their-legacy-positions",
    "six-exact-classic-consumer-relationships-and-five-retired-bridges",
    "three-consumerless-activations-retired-as-inert-classic-placeholders",
    "registry-and-descriptor-cache-collection-identity-preserved",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
