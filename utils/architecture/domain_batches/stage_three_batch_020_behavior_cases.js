"use strict";

const assert = require("node:assert/strict");

const captureError = action => {
  try {
    action();
  } catch (error) {
    return { name: error.name, message: error.message };
  }
  throw new Error("Expected an error");
};
const attempt = action => {
  try {
    return { value: action() };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
};
const deepFrozen = value => !value || typeof value !== "object" ||
  (Object.isFrozen(value) && Object.values(value).every(deepFrozen));
const item = (overrides = {}) => ({ itemId: "hook_basic", instanceId: "i-1", quantity: 3,
  location: { kind: "INVENTORY" }, buildId: "b", freshnessState: { percent: 80 }, ratingPercent: 40,
  quality: 5, stats: { size: 8, material: "steel", extra: undefined }, tags: ["a", { z: 1, y: 2 }],
  ...overrides });

const signatureCases = () => Object.freeze({
  "ignored-keys-canonical-properties-and-freeze": Policy => {
    const policy = new Policy();
    const signature = policy.create(item());
    assert(deepFrozen(signature));
    return { signature, reordered: policy.create(item({ stats: { material: "steel", size: 8 } })).key,
      matches: [policy.matches(item({ instanceId: "other", quantity: 1 }), signature),
        policy.matches(item({ quality: 6 }), signature), policy.matches(null, signature),
        policy.matches(item({ itemId: "other" }), signature)] };
  },
  "keys-errors-and-static-privacy": Policy => {
    const policy = new Policy();
    return { keys: [policy.toKey({ key: 42 }), policy.toKey({ properties: { b: 1, a: [2, { d: 3, c: 4 }] } }),
      policy.toKey(null)],
    errors: [captureError(() => policy.create(null)), attempt(() => policy.create({}))],
    staticKeys: Object.getOwnPropertyNames(Policy).filter(name =>
      !["length", "name", "prototype"].includes(name)).sort() };
  },
});

const BATCH_020_EXECUTABLE_CASES = Object.freeze({
  RefillCompatibleSignaturePolicy: signatureCases(),
  ExactAssemblyRefillSignaturePolicy: signatureCases(),
  AssemblyPreparationStatus: Object.freeze({
    "frozen-status-table": status => {
      assert(Object.isFrozen(status));
      return { entries: Object.entries(status), frozen: Object.isFrozen(status) };
    },
  }),
  AssemblyState: Object.freeze({
    "lifecycle-refill-signatures-and-snapshot": State => {
      const state = new State({ rootInstanceId: "rod-1", profileId: "spin",
        refillSignatures: { "rod.line": { key: "line", properties: { d: 0.2 } } } });
      const before = { root: state.rootInstanceId, profile: state.profileId, status: state.status,
        draft: state.isDraft, prepared: state.isPrepared };
      const stored = state.getRefillSignature("rod.line");
      stored.key = "mutated";
      state.rememberRefill("rod.line.hook", { key: "hook" }).rememberRefill("rod.reel", { key: "reel" });
      const afterRemember = state.toSnapshot();
      state.clearRefill("rod.line").markPrepared();
      const fromMap = new State({ rootInstanceId: "r", profileId: "p", status: "PREPARED",
        refillSignatures: new Map([["a", { key: "1" }]]) });
      return { before, storedIsCopy: state.getRefillSignature("rod.line"), afterRemember,
        afterClear: state.toSnapshot(), prepared: [state.isDraft, state.isPrepared],
        fromMap: fromMap.toSnapshot(), missing: state.getRefillSignature("nope"),
        keepDescendants: new State({ rootInstanceId: "r", profileId: "p",
          refillSignatures: { a: { k: 1 }, "a.b": { k: 2 } } }).clearRefill("a", { descendants: false }).toSnapshot() };
    },
    "validation-errors": State => [
      captureError(() => new State()),
      captureError(() => new State({ rootInstanceId: "r", profileId: " " })),
      captureError(() => new State({ rootInstanceId: "r", profileId: "p", status: "DONE" })),
      captureError(() => new State({ rootInstanceId: "r", profileId: "p" }).rememberRefill("", {})),
      captureError(() => new State({ rootInstanceId: "r", profileId: "p" }).rememberRefill("a", null)),
      captureError(() => new State({ rootInstanceId: "r", profileId: "p" }).getRefillSignature(3)),
    ],
  }),
});

module.exports = { BATCH_020_EXECUTABLE_CASES };
