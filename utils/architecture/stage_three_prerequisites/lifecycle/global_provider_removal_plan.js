"use strict";

const assert = require("node:assert/strict");

const REMOVAL_KEYS = Object.freeze(["currentPath", "mechanism", "reason", "symbol"]);
const identity = provider => `${provider.currentPath}\u0000${provider.symbol}\u0000${provider.mechanism}`;

// Reviewed removals from the exact global provider baseline: only providers of classic files the same
// prerequisite transition edits, each with its reason. The baseline changes by exactly these entries (no
// other entry is added, changed or removed), and every removed provider must no longer be observed, so a
// global that still exists can never leave the baseline.
class PrerequisiteGlobalProviderRemovalPlan {
  #removals;

  constructor(removals, { editedPaths }) {
    assert(Array.isArray(removals) && removals.length > 0, "global provider removals must be a non-empty list");
    const edited = new Set(editedPaths);
    const seen = new Set();
    this.#removals = removals.map(removal => {
      assert(removal && typeof removal === "object" && Object.keys(removal).sort().join() === REMOVAL_KEYS.join(),
        `global provider removal needs exactly ${REMOVAL_KEYS.join(", ")}`);
      assert(edited.has(removal.currentPath), `global provider removal outside the transition's source edits: ${removal.currentPath}`);
      assert(typeof removal.symbol === "string" && removal.symbol, "invalid symbol");
      assert(typeof removal.reason === "string" && removal.reason.trim().length > 0,
        `global provider removal needs a reason: ${removal.symbol}`);
      assert(!seen.has(identity(removal)), `duplicated global provider removal: ${removal.symbol}`);
      seen.add(identity(removal));
      return Object.freeze({ ...removal });
    });
  }

  // The baseline without exactly the reviewed providers (every one must be in it).
  apply(baseline) {
    const removed = new Set(this.#removals.map(identity));
    const existing = new Set(baseline.providers.map(identity));
    for (const removal of this.#removals) {
      assert(existing.has(identity(removal)), `global provider is not in the baseline: ${removal.symbol}`);
    }
    return { ...baseline, providers: baseline.providers.filter(provider => !removed.has(identity(provider))) };
  }

  // The published baseline differs from the old one by exactly the removals, and no removed provider is
  // still observed in its file.
  verify(oldBaseline, newBaseline, manifest) {
    const newKeys = new Map(newBaseline.providers.map(provider => [identity(provider), provider]));
    const removed = new Set(this.#removals.map(identity));
    for (const provider of oldBaseline.providers) {
      if (removed.has(identity(provider))) continue;
      assert.deepEqual(newKeys.get(identity(provider)), provider,
        `baseline entry changed or removed: ${provider.currentPath} ${provider.symbol}`);
    }
    assert.equal(newBaseline.providers.length, oldBaseline.providers.length - removed.size,
      "the baseline changes by other entries than the reviewed removals");
    for (const removal of this.#removals) {
      const module = manifest.modules.find(item => item.currentPath === removal.currentPath);
      const observed = (module?.observed?.providers?.items || []).some(provider =>
        provider.symbol === removal.symbol && provider.mechanism === removal.mechanism);
      assert(!observed, `a removed global provider is still observed: ${removal.currentPath} ${removal.symbol}`);
    }
    return true;
  }

  records() {
    return this.#removals.map(removal => ({ ...removal }));
  }
}

module.exports = { PrerequisiteGlobalProviderRemovalPlan };
