"use strict";

const assert = require("node:assert/strict");

const ADDITION_KEYS = Object.freeze(["availability", "currentPath", "mechanism", "removalCondition", "symbol"]);
const MECHANISMS = Object.freeze(["global-lexical", "global-this-property"]);
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const identity = provider => `${provider.currentPath}\u0000${provider.symbol}\u0000${provider.mechanism}`;
const order = (left, right) => compare(left.currentPath, right.currentPath) || compare(left.symbol, right.symbol) ||
  compare(left.mechanism, right.mechanism);

// Reviewed additions to the exact global provider baseline: only providers of classic files the same
// prerequisite transition creates, each with its removal condition. The baseline changes by exactly
// these entries (no other entry is added, changed or removed), and every addition must be observed
// as a provider of its file, so an undeclared or stale global is refused.
class PrerequisiteGlobalProviderAdditionPlan {
  #additions;

  constructor(additions, { createdPaths }) {
    assert(Array.isArray(additions) && additions.length > 0, "global provider additions must be a non-empty list");
    const created = new Set(createdPaths);
    const seen = new Set();
    this.#additions = additions.map(addition => {
      assert(addition && typeof addition === "object" && Object.keys(addition).sort().join() === ADDITION_KEYS.join(),
        `global provider addition needs exactly ${ADDITION_KEYS.join(", ")}`);
      assert(created.has(addition.currentPath),
        `global provider addition outside the files this transition creates: ${addition.currentPath}`);
      assert(typeof addition.symbol === "string" && /^[A-Za-z_$][\w$]*$/u.test(addition.symbol), "invalid symbol");
      assert(MECHANISMS.includes(addition.mechanism), `invalid mechanism: ${addition.mechanism}`);
      assert.equal(addition.availability, "program-init", "a classic global provider is available at program init");
      assert(typeof addition.removalCondition === "string" && addition.removalCondition.trim().length > 0,
        `global provider addition needs a removal condition: ${addition.symbol}`);
      assert(!seen.has(identity(addition)), `duplicated global provider addition: ${addition.symbol}`);
      seen.add(identity(addition));
      return Object.freeze({ ...addition });
    });
  }

  // The baseline with exactly the reviewed additions (sorted like the baseline itself).
  apply(baseline) {
    const existing = new Set(baseline.providers.map(identity));
    for (const addition of this.#additions) {
      assert(!existing.has(identity(addition)), `global provider is already in the baseline: ${addition.symbol}`);
    }
    const added = this.#additions.map(({ removalCondition, ...provider }) => provider);
    return { ...baseline, providers: [...baseline.providers, ...added].sort(order) };
  }

  // The published baseline differs from the old one by exactly the additions, and the providers
  // observed in the created files are exactly the additions.
  verify(oldBaseline, newBaseline, manifest) {
    const oldKeys = new Map(oldBaseline.providers.map(provider => [identity(provider), provider]));
    const newKeys = new Map(newBaseline.providers.map(provider => [identity(provider), provider]));
    for (const [key, provider] of oldKeys) {
      assert.deepEqual(newKeys.get(key), provider, `baseline entry changed or removed: ${provider.currentPath} ${provider.symbol}`);
    }
    const added = [...newKeys.keys()].filter(key => !oldKeys.has(key)).sort();
    assert.deepEqual(added, this.#additions.map(identity).sort(), "the baseline changes by other entries than the reviewed additions");
    const paths = new Set(this.#additions.map(addition => addition.currentPath));
    const observed = manifest.modules.filter(module => paths.has(module.currentPath))
      .flatMap(module => module.observed.providers.items.map(provider => ({ currentPath: module.currentPath, ...provider })));
    assert.deepEqual(observed.map(identity).sort(), this.#additions.map(identity).sort(),
      "the created files provide other globals than the reviewed additions");
    for (const addition of this.#additions) {
      const provider = observed.find(item => identity(item) === identity(addition));
      assert.equal(provider.availability, addition.availability, `availability differs: ${addition.symbol}`);
    }
    return true;
  }

  records() {
    return this.#additions.map(addition => ({ ...addition }));
  }
}

module.exports = { PrerequisiteGlobalProviderAdditionPlan };
