"use strict";

const attempt = action => {
  try { return { value: action() }; } catch (error) { return { error: `${error.name}: ${error.message}` }; }
};
const view = state => state === null ? null : { root: state.rootInstanceId, snapshot: state.toSnapshot() };
const rodA = { rootInstanceId: "rod-a", profileId: "float", status: "DRAFT", refillSignatures: {} };
const rodB = { rootInstanceId: "rod-b", profileId: "spinning", status: "PREPARED",
  refillSignatures: { "hook.bait": { itemId: "worm", quantity: 1 } } };

// Batch 033: the assembly state repository owns one Map of AssemblyState records keyed by root id.
const EXECUTABLE_CASES = Object.freeze({
  AssemblyStateRepository: Object.freeze({
    "construction-lookup-and-owner-mutations": Repository => {
      const fromArray = new Repository({ states: [rodA, rodB] });
      const fromObject = new Repository({ states: { second: rodB, first: rodA } });
      const empty = new Repository();
      const created = empty.create({ rootInstanceId: "rod-c", profileId: "feeder" });
      return {
        fromArray: fromArray.toSnapshot(), fromObject: fromObject.toSnapshot(), nullStates: new Repository({ states: null }).list().length,
        has: [fromArray.has("rod-a"), fromArray.has("rod-z")], get: [view(fromArray.get("rod-b")), fromArray.get("rod-z")],
        require: [view(fromArray.require("rod-a")), attempt(() => fromArray.require("rod-z"))],
        created: view(created), createdIsStored: empty.get("rod-c") === created,
        duplicateAdd: attempt(() => empty.add(rodA) && empty.add({ ...rodA })),
        invalidCreate: [attempt(() => empty.create({ rootInstanceId: "", profileId: "x" })), attempt(() => empty.create())],
        removed: view(empty.remove("rod-a")), afterRemove: empty.toSnapshot(), removeMissing: attempt(() => empty.remove("rod-a")),
        duplicateConstruction: attempt(() => new Repository({ states: [rodA, rodA] })),
      };
    },
    "snapshot-restore-atomicity-and-list-copies": Repository => {
      const repository = new Repository({ states: [rodA, rodB] });
      const saved = JSON.parse(JSON.stringify(repository.createSnapshot()));
      const restored = new Repository({ states: [{ rootInstanceId: "old", profileId: "p" }] });
      restored.restoreSnapshot(saved);
      const listA = restored.list();
      listA.pop();
      const listLength = restored.list().length;
      const beforeFailure = restored.toSnapshot();
      const duplicate = attempt(() => restored.restoreSnapshot([saved[0], saved[0]]));
      const invalid = attempt(() => restored.restoreSnapshot([saved[1], { rootInstanceId: "x", profileId: "y", status: "BROKEN" }]));
      const unchanged = JSON.stringify(restored.toSnapshot()) === JSON.stringify(beforeFailure);
      restored.create({ rootInstanceId: "rod-c", profileId: "feeder" });
      const afterCreate = restored.toSnapshot();
      restored.restoreSnapshot(undefined);
      return { saved, restored: beforeFailure, listCopy: [listA.length, listLength, beforeFailure.length],
        duplicate, invalid, unchanged, afterCreate, emptied: restored.toSnapshot(),
        snapshotsAreFresh: repository.toSnapshot() !== repository.toSnapshot() };
    },
  }),
});

const MATRIX = Object.freeze({
  behaviorCases: {
    AssemblyStateRepository: ["construction-lookup-and-owner-mutations", "snapshot-restore-atomicity-and-list-copies"],
  },
  compatibilityCases: [
    "one-representation-only-named-esm-target-and-one-exact-export",
    "two-exact-completed-prefix-imports-bound-to-the-cumulative-instances",
    "four-owner-created-composition-identities-preserved",
    "authoritative-states-map-with-atomic-local-replacement-preserved",
    "one-esm-evaluation-without-top-level-effects",
    "one-exact-classic-activation-at-its-legacy-position",
    "two-exact-classic-consumer-relationships-and-one-retired-bridge",
    "two-consumerless-activations-retired-as-inert-classic-placeholders",
    "review-queue-freeze-extension-adopted-by-the-prebuild",
    "single-cumulative-runtime-and-preserved-prior-activations",
  ],
});

module.exports = { EXECUTABLE_CASES, MATRIX };
