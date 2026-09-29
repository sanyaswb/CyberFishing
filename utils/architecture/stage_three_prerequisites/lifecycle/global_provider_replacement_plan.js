"use strict";

const assert = require("node:assert/strict");
const { PrerequisiteGlobalProviderAdditionPlan } = require("./global_provider_addition_plan");
const { PrerequisiteGlobalProviderRemovalPlan } = require("./global_provider_removal_plan");

const PAIR_KEYS = Object.freeze(["add", "remove"]);
const identity = provider => `${provider.currentPath}\u0000${provider.symbol}\u0000${provider.mechanism}`;

// Exact global-provider replacements (owner decision 2026-09-29): a transition may add and remove
// global providers together only as declared pairs, "remove X, add Y". The removed provider belongs to a
// file the transition edits or deletes and is neither observed nor consumed anywhere afterwards; the
// added one belongs to a file it creates and is observed exactly; the baseline changes by exactly the
// pairs (old - removed + added).
class PrerequisiteGlobalProviderReplacementPlan {
  #pairs;
  #removals;
  #additions;

  constructor(pairs, { editedPaths, deletedPaths, createdPaths }) {
    assert(Array.isArray(pairs) && pairs.length > 0, "global provider replacements must be a non-empty list");
    this.#pairs = pairs.map(pair => {
      assert(pair && typeof pair === "object" && Object.keys(pair).sort().join() === PAIR_KEYS.join(),
        "a global provider replacement is exactly { remove, add }");
      return Object.freeze({ remove: Object.freeze({ ...pair.remove }), add: Object.freeze({ ...pair.add }) });
    });
    this.#removals = new PrerequisiteGlobalProviderRemovalPlan(this.#pairs.map(pair => pair.remove),
      { editedPaths: [...editedPaths, ...deletedPaths] });
    this.#additions = new PrerequisiteGlobalProviderAdditionPlan(this.#pairs.map(pair => pair.add), { createdPaths });
  }

  apply(baseline) {
    return this.#additions.apply(this.#removals.apply(baseline));
  }

  verify(oldBaseline, newBaseline, manifest) {
    const oldKeys = new Map(oldBaseline.providers.map(provider => [identity(provider), provider]));
    const newKeys = new Map(newBaseline.providers.map(provider => [identity(provider), provider]));
    const removed = new Set(this.#pairs.map(pair => identity(pair.remove)));
    const added = new Set(this.#pairs.map(pair => identity(pair.add)));
    for (const [key, provider] of oldKeys) {
      if (removed.has(key)) {
        assert(!newKeys.has(key), `a replaced provider stays in the baseline: ${provider.symbol}`);
        continue;
      }
      assert.deepEqual(newKeys.get(key), provider, `baseline entry changed or removed: ${provider.currentPath} ${provider.symbol}`);
    }
    const extra = [...newKeys.keys()].filter(key => !oldKeys.has(key)).sort();
    assert.deepEqual(extra, [...added].sort(), "the baseline changes by other entries than the reviewed replacements");
    for (const pair of this.#pairs) {
      const observed = manifest.modules.some(module => (module.observed?.providers?.items || []).some(provider =>
        provider.symbol === pair.remove.symbol && provider.mechanism === pair.remove.mechanism));
      assert(!observed, `a replaced global provider is still observed: ${pair.remove.symbol}`);
      const consumers = manifest.modules.filter(module => (module.observed?.consumers?.items || [])
        .some(consumer => consumer.symbol === pair.remove.symbol)).map(module => module.currentPath);
      assert.deepEqual(consumers, [], `the replaced global is still referenced: ${pair.remove.symbol} by ${consumers.join(", ")}`);
    }
    const addedOnly = { ...newBaseline, providers: newBaseline.providers.filter(provider => added.has(identity(provider))) };
    const createdPaths = new Set(this.#pairs.map(pair => pair.add.currentPath));
    const observedAdded = manifest.modules.filter(module => createdPaths.has(module.currentPath))
      .flatMap(module => module.observed.providers.items.map(provider => identity({ currentPath: module.currentPath, ...provider })));
    assert.deepEqual(observedAdded.sort(), addedOnly.providers.map(identity).sort(),
      "the created files provide other globals than the reviewed replacements");
    return true;
  }

  records() {
    return this.#pairs.map(pair => ({ remove: { ...pair.remove }, add: { ...pair.add } }));
  }
}

module.exports = { PrerequisiteGlobalProviderReplacementPlan };
