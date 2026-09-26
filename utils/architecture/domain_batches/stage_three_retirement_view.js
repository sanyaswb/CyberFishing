"use strict";

const fs = require("node:fs");
const path = require("node:path");

const MIGRATION_DIRECTORY = "architecture/migration";

// Read-only view for live checks of earlier batches: activations and bridges that later batches
// retired are still part of the earlier batch's contract, recorded in the retired ledger and the
// immutable execution plans rather than in the active runtime contract and bridge registry.
class StageThreeRetirementView {
  constructor({ projectRoot, runtimeContract }) {
    this.projectRoot = path.resolve(projectRoot);
    this.runtimeContract = runtimeContract;
  }

  retiredActivations() {
    return (this.runtimeContract.retiredActivations || []).map((record) => record.activation);
  }

  isRetired(activationId) {
    return this.retiredActivations().some((activation) => activation.id === activationId);
  }

  // The owner's full activation contract set: active plus retired, sorted by id.
  activationsOwnedBy(owner) {
    return [...this.runtimeContract.activationPositions, ...this.retiredActivations()]
      .filter((activation) => activation.owner === owner)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  // Distinct ESM modules published by active and retired activations; retired modules stay in
  // the cumulative graph for their importers.
  static activationModuleCount(runtimeContract) {
    return new Set([...runtimeContract.activationPositions,
      ...(runtimeContract.retiredActivations || []).map((record) => record.activation)]
      .map((activation) => activation.targetModule)).size;
  }

  // Classic sources that later migrated: they are activation shims or retired placeholders now.
  migratedSources() {
    return new Set([...this.runtimeContract.activationPositions, ...this.retiredActivations()]
      .map((activation) => activation.sourceProvider));
  }

  // Bridge records retired by recorded execution plans (their classic source migrated).
  retiredBridgeRecords() {
    const directory = path.join(this.projectRoot, MIGRATION_DIRECTORY);
    return fs.readdirSync(directory)
      .filter((name) => /^stage_3_batch_\d{3}_execution_plan\.json$/u.test(name)).sort()
      .flatMap((name) => JSON.parse(fs.readFileSync(path.join(directory, name)))
        .compatibility.registryTransition.retiredBridgeRecords || []);
  }
}

module.exports = { StageThreeRetirementView };
