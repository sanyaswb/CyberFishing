"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};

// Batch 030: hook power (grade x weight plus the quality bonus) and item rarity resolution.
const EXECUTABLE_CASES = Object.freeze({
  HookPowerPolicy: Object.freeze({
    "power-from-grade-weight-and-quality": Policy => {
      const policy = new Policy();
      const inputs = [undefined, {}, { hookPowerGrade: 5, weight: 2, qualityGrade: 1 },
        { hookPowerGrade: 5, weight: 2, qualityGrade: 10 }, { hookPowerGrade: -3, weight: 4, qualityGrade: 7 },
        { hookPowerGrade: "8", weight: "0.5", qualityGrade: "6" }, { hookPowerGrade: Number.NaN, weight: 3, qualityGrade: 0 }];
      return inputs.map(input => policy.resolve(input));
    },
    "injected-and-invalid-quality-modifier": Policy => {
      const injected = new Policy({ qualityModifier: { getPowerBonus: quality => Number(quality) * 0.1 } });
      return { injected: [injected.resolve({ hookPowerGrade: 2, weight: 3, qualityGrade: 4 }), injected.resolve()],
        invalid: [attempt(() => new Policy({ qualityModifier: {} })), attempt(() => new Policy({ qualityModifier: null }))] };
    },
  }),
  ItemRarityResolver: Object.freeze({
    "authored-rarity-through-owned-registry-and-cache-identity": Resolver => {
      const resolver = new Resolver();
      const profile = fields => ({ mode: "authored", tier: 2, maxTier: 5, isUnique: false, ...fields });
      const first = resolver.resolve(profile());
      return {
        descriptors: [first, resolver.resolve(profile({ tier: 5 })),
          resolver.resolve(profile({ isUnique: true, uniqueId: "crown" }))].map(snapshot),
        cachedIdentity: first === resolver.resolve(profile()),
        errors: [attempt(() => resolver.resolve(null)), attempt(() => resolver.resolve("authored")),
          attempt(() => resolver.resolve({ mode: "rolled" })), attempt(() => resolver.resolve(profile({ tier: 9 })))],
      };
    },
    "injected-strategy-registry": Resolver => {
      const calls = [];
      const resolver = new Resolver({ strategyRegistry: { resolve: profile => { calls.push(snapshot(profile)); return { mode: "stub" }; } } });
      return { result: resolver.resolve({ mode: "any", tier: 1 }), calls };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    HookPowerPolicy: ["power-from-grade-weight-and-quality", "injected-and-invalid-quality-modifier"],
    ItemRarityResolver: ["authored-rarity-through-owned-registry-and-cache-identity", "injected-strategy-registry"],
  },
  compatibilityCases: [
    "two-representation-only-named-esm-targets-and-two-exact-exports",
    "three-exact-imports-including-two-earlier-batch-exports-bound-to-the-cumulative-instances",
    "three-owner-created-composition-identities-preserved",
    "reviewed-global-this-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-per-target-without-top-level-effects",
    "two-exact-classic-activations-at-their-legacy-positions",
    "five-exact-classic-consumer-relationships-and-three-retired-bridges",
    "hook-quality-modifier-activation-retired-as-inert-classic-placeholder",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
