"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_008_execution_profile");
const {
  BATCH_008_PREFLIGHT_PROFILE,
} = require("./domain_batches/stage_three_batch_008_preflight_profile");
const {
  StageThreeBatchPreflightAuditValidator,
} = require("./domain_batches/stage_three_batch_preflight_audit");
const {
  PATHS,
  buildArtifact,
  serialize,
} = require("./generate-stage-3-batch-008-audit");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PROTECTED_PATHS = Object.freeze([
  "src",
  "index.html",
  "architecture/migration/module_migration_manifest.json",
  "architecture/migration/stage_3_approved_batches.json",
  "architecture/migration/stage_3_domain_audit.json",
  "architecture/migration/stage_3_execution_state.json",
  "architecture/migration/stage_3_compatibility_runtime.json",
  "architecture/guards/migration_bridge_registry.json",
  "dist/stage-3-compat-runtime",
]);

class StageThreeBatch008AuditIntegrationCheck {
  run() {
    const before = this.#snapshotProtectedPaths();
    const artifact = buildArtifact({ historicalPrebuild: true });
    assert.deepEqual(this.#read(PATHS.output), serialize(artifact),
      "persisted batch-008 audit differs from mechanical preflight");
    assert.equal(artifact.status, "verified");
    assert.equal(artifact.verdict, "eligible-for-execution-plan");
    const state = JSON.parse(this.#read(PATHS.executionState).toString("utf8"));
    assert.equal(state.activeBatchId, BATCH_008_EXECUTION_PROFILE.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    const beforeState = { ...state, activeBatchId: null };
    delete beforeState.activeBatchPhase;
    assert.equal(
      this.#sha256(Buffer.from(`${JSON.stringify(beforeState, null, 2)}\n`, "utf8")),
      artifact.sourceEvidence.executionState.sha256,
      "preflight execution-state evidence does not match the exact PRE projection",
    );
    assert.equal(artifact.scope.targetCount, 3);
    assert.deepEqual(
      artifact.scope.modules.map(({ currentPath, targetPath, exports }) => ({
        currentPath,
        targetPath,
        exports,
      })),
      BATCH_008_EXECUTION_PROFILE.expectedTargets,
    );
    assert.equal(artifact.closure.existingCumulativeModules.length, 31);
    assert.deepEqual(artifact.closure.newProjectModules,
      BATCH_008_EXECUTION_PROFILE.expectedTargets.map((target) => target.targetPath).sort());
    assert.equal(artifact.closure.resultingProjectModuleCount,
      new Set([
        ...artifact.closure.existingCumulativeModules,
        ...artifact.closure.newProjectModules,
      ]).size);
    assert.equal(artifact.closure.resultingProjectModuleCount, 34);
    assert.equal(artifact.closure.internalEdges.length, 0);
    assert.equal(artifact.closure.alreadyCumulativeDependencies.length, 0);
    assert.equal(artifact.closure.unexpectedDependencies.length, 0);
    assert.deepEqual(Object.values(artifact.boundaries).map((records) => records.length),
      [0, 0, 0, 0, 0, 0]);
    assert.deepEqual(artifact.compatibility.activations.map((record) => record.legacyScriptIndex)
      .sort((left, right) => left - right), [90, 94, 114]);
    assert.equal(artifact.compatibility.consumers.length, 3);
    assert.equal(new Set(artifact.compatibility.consumers.map((record) => record.source)).size, 3);
    assert.equal(artifact.state.reviewed.length, 3);
    assert.equal(artifact.state.unresolved.length, 0);
    assert.equal(artifact.effects.unsafe.length, 0);
    assert.equal(artifact.performance.additionalMigrationAllocationsAllowed, 0);
    assert.equal(artifact.performance.transportLookupsAllowed, 0);
    assert.equal(artifact.prerequisites.frozen.length, 0);
    assert.equal(artifact.prerequisites.newlyDiscovered.length, 0);
    for (const module of artifact.scope.modules) {
      assert.equal(module.sourceSha256, this.#sha256(this.#read(module.currentPath)));
      assert.equal(module.state.ownerIdentity, "preserved");
      assert.equal(module.state.duplicateStateCopies, "forbidden");
      assert.equal(module.performance.additionalMigrationAllocationsAllowed, 0);
      assert.equal(module.performance.transportLookupsAllowed, 0);
    }
    assert.deepEqual(this.#snapshotProtectedPaths(), before,
      "Stage 3.8.0 preflight changed source, runtime or authoritative architecture state");
    console.log(
      "Stage 3.8.0 batch-008 preflight passed: exact three-module depth-zero closure, " +
      "31→34 derived topology, three consumers/activations, reviewed state/allocation contracts, " +
      "zero new prerequisites and zero runtime changes; eligible-for-execution-plan.",
    );
  }

  #snapshotProtectedPaths() {
    const snapshot = {};
    for (const relativePath of PROTECTED_PATHS) {
      const absolutePath = this.#absolute(relativePath);
      if (fs.statSync(absolutePath).isDirectory()) {
        snapshot[relativePath] = this.#walk(absolutePath).map((file) => [
          path.relative(PROJECT_ROOT, file).replaceAll("\\", "/"),
          this.#sha256(fs.readFileSync(file)),
        ]);
      } else {
        snapshot[relativePath] = this.#sha256(fs.readFileSync(absolutePath));
      }
    }
    return snapshot;
  }

  #walk(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const item = path.join(directory, entry.name);
      return entry.isDirectory() ? this.#walk(item) : [item];
    }).sort();
  }

  #absolute(relativePath) {
    return path.join(PROJECT_ROOT, relativePath);
  }

  #read(relativePath) {
    return require("./domain_batches/stage_three_batch_008_cutover_history").historicalCutoverBytes(relativePath, fs.readFileSync(this.#absolute(relativePath)));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch008AuditIntegrationCheck().run();
