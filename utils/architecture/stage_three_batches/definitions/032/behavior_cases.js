"use strict";

const snapshot = value => JSON.parse(JSON.stringify(value));
const attempt = action => {
  try { return { value: snapshot(action()) }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};

// Batch 032: effective rarity prefers the instance rarity fact over the authored definition profile.
const EXECUTABLE_CASES = Object.freeze({
  EffectiveItemRarityResolver: Object.freeze({
    "instance-over-definition-rarity-and-cache-identity": Resolver => {
      const resolver = new Resolver();
      const authored = fields => ({ mode: "authored", tier: 2, maxTier: 5, isUnique: false, ...fields });
      const definition = { rarityProfile: authored() };
      const fromDefinition = resolver.resolve({ definition });
      return {
        results: [fromDefinition, resolver.resolve({ definition, instanceState: { rarity: authored({ tier: 4 }) } }),
          resolver.resolve({ definition, instanceState: { rarity: null } }), resolver.resolve({ definition: {} }),
          resolver.resolve(), resolver.resolve({ instanceState: {} })].map(snapshot),
        cachedIdentity: fromDefinition === resolver.resolve({ definition }),
        errors: [attempt(() => resolver.resolve({ definition: { rarityProfile: authored({ tier: 9 }) } })),
          attempt(() => resolver.resolve({ instanceState: { rarity: "legendary" } }))],
      };
    },
    "injected-and-invalid-item-rarity-resolver": Resolver => {
      const calls = [];
      const injected = new Resolver({ itemRarityResolver: { resolve: source => { calls.push(snapshot(source)); return { mode: "stub" }; } } });
      return { result: injected.resolve({ definition: { rarityProfile: { mode: "x" } } }), calls,
        invalid: [attempt(() => new Resolver({ itemRarityResolver: {} })), attempt(() => new Resolver({ itemRarityResolver: null }))] };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    EffectiveItemRarityResolver: ["instance-over-definition-rarity-and-cache-identity",
      "injected-and-invalid-item-rarity-resolver"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "one-exact-earlier-batch-import-bound-to-the-cumulative-instance",
    "one-owner-created-composition-identity-preserved",
    "reviewed-global-this-exposure-moved-to-the-exact-activation-shim",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "two-exact-classic-consumer-relationships-and-one-retired-bridge",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
