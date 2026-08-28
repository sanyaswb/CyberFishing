"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";

class StageThreeBatch006ObservationCheck {
  run() {
    const evidence = this.#json(
      "architecture/migration/stage_3_batch_006_observation_reconciliation.json",
    );
    const manifest = this.#json(
      "architecture/migration/module_migration_manifest.json",
    );
    const approved = this.#json(
      "architecture/migration/stage_3_approved_batches.json",
    );
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);
    assert.equal(evidence.status, "verified");
    assert.equal(evidence.batchId, BATCH_ID);
    assert.equal(evidence.targetCount, 6);
    assert.equal(evidence.activationCount, 6);
    assert.equal(evidence.bridgeRelationshipCount, 7);
    assert.equal(evidence.observations.compatibilityTransportUnresolvedCount, 6);
    assert.equal(evidence.observations.preexistingUnresolvedCount, 19);
    assert.equal(evidence.observations.totalUnresolvedCount, 25);
    assert.equal(evidence.observations.speculativeEdgeCount, 0);
    assert.equal(evidence.observations.ambiguousCount, 0);
    assert.equal(evidence.controlledGlobalTransitions.length, 6);
    assert.match(evidence.fingerprints.manifestSha256, /^[a-f0-9]{64}$/u);
    assert.match(evidence.fingerprints.registrySha256, /^[a-f0-9]{64}$/u);
    assert.match(evidence.fingerprints.runtimeContractSha256, /^[a-f0-9]{64}$/u);
    assert.equal(manifest.preliminaryMigration, undefined);
    const byPath = new Map(manifest.modules.map((record) => [record.currentPath, record]));
    const batchSources = new Set(batch.modules.map((record) => record.currentPath));
    const batchUnresolved = manifest.modules.flatMap((record) =>
      record.analysis.dependencies.unresolved.map((item) => ({
        source: record.currentPath,
        ...item,
      }))).filter((record) => batchSources.has(record.source));
    assert.equal(batchUnresolved.length, 6);
    assert(batchUnresolved.every((record) =>
      record.symbol === "__CYBER_FISHING_COMPAT_RUNTIME__" &&
      record.mechanism === "global-this-property" &&
      record.resolution === "unresolved"));
    for (const moduleRecord of batch.modules) {
      const source = byPath.get(moduleRecord.currentPath);
      const target = byPath.get(moduleRecord.targetPath);
      assert.deepEqual(source.architecture.roles, ["compatibility-bridge"]);
      assert.equal(source.analysis.dependencies.unresolved.length, 1);
      assert.equal(source.analysis.dependencies.unresolved[0].symbol,
        "__CYBER_FISHING_COMPAT_RUNTIME__");
      assert.equal(target.architecture.migrationStatus, "verified");
      assert.equal(target.architecture.targetBoundary, "game-domain");
      assert.equal(target.analysis.dependencies.items.length, 0);
      assert.equal(target.analysis.dependencies.unresolved.length, 0);
      assert.equal(target.analysis.dependencies.ambiguous.length, 0);
    }
    console.log(
      "Stage 3.6.7 observation reconciliation passed: six verified game-domain targets, six exact transport-only unresolved shims, seven reverse-consumer relationships and six controlled global transitions.",
    );
  }

  #json(relativePath) {
    return JSON.parse(this.#bytes(relativePath).toString("utf8"));
  }

  #bytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch006ObservationCheck().run();
