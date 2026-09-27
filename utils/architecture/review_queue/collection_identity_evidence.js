"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { StageThreeStateIdentityReview } = require("../domain_batches/stage_three_state_identity_review");
const {
  StageThreeCompatibilityTestLoader,
} = require("../../testing/runtime/stage_three_compatibility_test_loader");

const sha = value => crypto.createHash("sha256").update(value).digest("hex");

// The reviewed collection of the review-queue state-identity finding and the persistence round
// trip that proves the owner keeps one authoritative collection across restore.
const REVIEWED_COLLECTION = Object.freeze({
  currentPath: "src/core/assemblies/assembly_state_repository.js",
  className: "AssemblyStateRepository",
  collection: Object.freeze({ owner: "AssemblyStateRepository#states", field: "#states", scope: "instance",
    collection: "Map", allowedOperations: Object.freeze(["delete", "get", "has", "set", "values"]),
    replacement: "atomic-local" }),
  cacheLifetime: "instance-lifetime-authoritative-store",
  // Classic activation shim of the completed-prefix AssemblyState export the repository reads.
  providers: Object.freeze(["src/core/assemblies/assembly_state.js"]),
});

const ROUND_TRIP = `(() => {
  const snapshots = [
    { rootInstanceId: "rod-a", profileId: "float", status: "DRAFT", refillSignatures: {} },
    { rootInstanceId: "rod-b", profileId: "spinning", status: "PREPARED", refillSignatures: { "hook.bait": { itemId: "worm", quantity: 1 } } },
  ];
  const repository = new AssemblyStateRepository({ states: snapshots });
  const saved = JSON.parse(JSON.stringify(repository.createSnapshot()));
  const restored = new AssemblyStateRepository();
  const identity = restored;
  restored.restoreSnapshot(saved);
  const roundTrip = JSON.stringify(restored.toSnapshot()) === JSON.stringify(saved);
  const listA = restored.list();
  const listB = restored.list();
  listA.length = 0;
  const listsAreCopies = listA !== listB && restored.list().length === 2;
  const before = JSON.stringify(restored.toSnapshot());
  let duplicateError = null;
  try { restored.restoreSnapshot([saved[0], saved[0]]); } catch (error) { duplicateError = error.name + ": " + error.message; }
  const failedRestoreKeptState = JSON.stringify(restored.toSnapshot()) === before;
  restored.create({ rootInstanceId: "rod-c", profileId: "feeder" });
  restored.remove("rod-a");
  const ownerMutationsAfterRestore = restored.list().map(state => state.rootInstanceId).sort().join(",") === "rod-b,rod-c";
  restored.restoreSnapshot(null);
  const emptyRestore = restored.list().length === 0 && restored.has("rod-b") === false;
  return JSON.stringify({ savedShape: saved, roundTrip, ownerIdentityPreserved: identity === restored,
    listsAreCopies, duplicateError, failedRestoreKeptState, ownerMutationsAfterRestore, emptyRestore });
})()`;

// Freeze evidence for the review-queue collection-identity finding: the static identity proof with
// the atomic local replacement rule and a focused persistence round trip in the cumulative runtime.
class StageThreeCollectionIdentityEvidence {
  constructor({ root, identityReview = new StageThreeStateIdentityReview() }) {
    this.root = path.resolve(root);
    this.identityReview = identityReview;
  }

  build() {
    const { currentPath, className, collection, cacheLifetime } = REVIEWED_COLLECTION;
    const source = fs.readFileSync(path.join(this.root, currentPath), "utf8");
    const proof = this.identityReview.review({ source, currentPath, className,
      collections: [{ ...collection, allowedOperations: [...collection.allowedOperations] }] });
    const context = vm.createContext({ console });
    const loader = new StageThreeCompatibilityTestLoader({ projectRoot: this.root, context });
    loader.loadRuntime();
    loader.loadAll([...REVIEWED_COLLECTION.providers, currentPath]);
    const roundTrip = JSON.parse(vm.runInContext(ROUND_TRIP, context, { filename: "collection-identity#round-trip" }));
    const checks = {
      roundTrip: roundTrip.roundTrip,
      ownerIdentityPreserved: roundTrip.ownerIdentityPreserved,
      listsAreCopies: roundTrip.listsAreCopies,
      duplicateRestoreRejected: typeof roundTrip.duplicateError === "string" &&
        roundTrip.duplicateError.startsWith("RangeError:"),
      failedRestoreKeptState: roundTrip.failedRestoreKeptState,
      ownerMutationsAfterRestore: roundTrip.ownerMutationsAfterRestore,
      emptyRestore: roundTrip.emptyRestore,
    };
    for (const [name, passed] of Object.entries(checks)) assert.equal(passed, true, `round trip failed: ${name}`);
    return {
      finding: `collection-identity-unproven:${collection.owner}`,
      currentPath,
      className,
      sourceSha256: sha(source),
      cacheLifetime,
      proof: proof.collections[0],
      persistenceRoundTrip: { checks, savedShape: roundTrip.savedShape, duplicateError: roundTrip.duplicateError },
      verdict: "proven",
    };
  }
}

module.exports = { StageThreeCollectionIdentityEvidence, REVIEWED_COLLECTION };
