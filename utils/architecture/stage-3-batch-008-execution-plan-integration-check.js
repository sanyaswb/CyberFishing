"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  BATCH_008_EXECUTION_PROFILE,
} = require("./domain_batches/stage_three_batch_008_execution_profile");
const {
  StageThreeBatchExecutionPlanValidator,
} = require("./domain_batches/stage_three_batch_execution_plan");
const {
  PATHS,
  ROLLBACK_FILE_PATHS,
} = require("./generate-stage-3-batch-008-execution-plan");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const { StageThreeBatch008HistoricalInputs } = require("./domain_batches/stage_three_batch_008_historical_inputs");
const { StageThreeBatchExecutionPlanBuilder } = require("./domain_batches/stage_three_batch_execution_plan");
const { runtimeFacts } = require("./generate-stage-3-batch-008-audit");
const PROTECTED_PATHS = Object.freeze([
  "src",
  "index.html",
  "architecture/guards/migration_bridge_registry.json",
  "architecture/migration/module_migration_manifest.json",
  "architecture/migration/stage_3_compatibility_runtime.json",
  "architecture/migration/stage_3_execution_state.json",
  "dist/stage-3-compat-runtime",
]);

class StageThreeBatch008ExecutionPlanIntegrationCheck {
  run() {
    const before = this.#snapshotProtectedPaths();
    const persistedBytes = this.#read(PATHS.output);
    const persisted = new StageThreeBatchExecutionPlanValidator(
      BATCH_008_EXECUTION_PROFILE,
    ).validate(JSON.parse(persistedBytes.toString("utf8")));
    const prebuild = this.#json("architecture/migration/stage_3_batch_008_prebuild_contract.json");
    assert.equal(this.#sha256(persistedBytes), prebuild.evidence.executionPlan.sha256,
      "prebuild contract does not pin the accepted execution plan");
    assert.equal(persisted.status, "execution-plan-verified");
    assert.equal(persisted.verdict, "eligible-for-focused-test-matrix");
    assert.equal(persisted.runtimeMigrationAllowed, false);
    assert.deepEqual(persisted.scope.modules.map(({ currentPath, targetPath, exports }) => ({
      currentPath,
      targetPath,
      exports,
    })), BATCH_008_EXECUTION_PROFILE.expectedTargets);
    assert.deepEqual(persisted.lifecycle.preState, {
      releaseVersion: "0.24.44",
      status: "migration-active",
      completedBatchIds: persisted.rollback.preserveCompletedBatchIds,
      activeBatchId: null,
      compatibilityRuntimeActivated: true,
      projectModuleCount: 31,
      activationCount: 32,
      bridgeRecordCount: 57,
    });
    assert.equal(persisted.lifecycle.openState.activeBatchId, persisted.batchId);
    assert.equal(persisted.lifecycle.openState.activeBatchPhase, "prebuild");
    assert.equal(persisted.lifecycle.openState.projectModuleCount, 31);
    assert.equal(persisted.lifecycle.openState.activationCount, 32);
    assert.equal(persisted.lifecycle.openState.bridgeRecordCount, 57);
    assert.equal(persisted.lifecycle.runtimeActiveState.activeBatchPhase, "runtime-active");
    assert.equal(persisted.lifecycle.runtimeActiveState.projectModuleCount, 34);
    assert.equal(persisted.lifecycle.runtimeActiveState.activationCount, 35);
    assert.equal(persisted.lifecycle.runtimeActiveState.bridgeRecordCount, 60);
    assert.equal(persisted.lifecycle.completedState.releaseVersion, "0.24.45");
    assert.equal(persisted.lifecycle.completedState.completedBatchIds.length, 8);
    assert.equal(persisted.lifecycle.completedState.activeBatchId, null);
    assert.equal(persisted.lifecycle.completedState.activeBatchPhase, undefined);
    assert.deepEqual(persisted.compatibility.activations.map((record) => record.id),
      BATCH_008_EXECUTION_PROFILE.expectedActivationIds);
    assert.deepEqual(persisted.compatibility.plannedBridgeRecords.map((record) => record.id),
      BATCH_008_EXECUTION_PROFILE.expectedBridgeIds);
    assert.deepEqual(persisted.compatibility.registryTransition, {
      beforeCount: 57,
      addCount: 3,
      afterCount: 60,
      operation: "exact-set-union-by-canonical-id",
    });
    assert.deepEqual(persisted.cumulativeRuntime.expectedDependencyEdges, []);
    assert.equal(persisted.cumulativeRuntime.beforeProjectModuleCount, 31);
    assert.equal(persisted.cumulativeRuntime.afterProjectModuleCount, 34);
    assert.equal(persisted.cumulativeRuntime.beforeActivationCount, 32);
    assert.equal(persisted.cumulativeRuntime.afterActivationCount, 35);
    assert.equal(persisted.rollback.atomic, true);
    assert.equal(persisted.rollback.partialRollbackAllowed, false);
    assert.equal(persisted.rollback.fromRelease, "0.24.45");
    assert.equal(persisted.rollback.toRelease, "0.24.44");
    assert.equal(persisted.rollback.removeBatchId, persisted.batchId);
    assert.equal(persisted.sourceEvidence.scmCheckpoint.tag, "v0.24.44");
    assert.equal(persisted.sourceEvidence.scmCheckpoint.tagType, "tag");
    this.#verifyCurrentPrebuildState(persisted, prebuild);
    this.#verifySourceFingerprints(persisted);
    this.#verifyRollbackFingerprints(persisted);
    this.#rebuild(persisted, persistedBytes);
    assert.deepEqual(this.#snapshotProtectedPaths(), before,
      "Stage 3.8.1 execution-plan projection changed source/runtime state");

    console.log(
      "Stage 3.8.1 atomic execution plan passed: exact v0.24.44 fingerprints, " +
      "pre/open/runtime-active/completed lifecycle, 31→34 modules, 32→35 activations, " +
      "57→60 bridges and batch-008-only rollback are deterministic and read-only.",
    );
  }

  #verifySourceFingerprints(plan) {
    for (const [key, evidence] of Object.entries(plan.sourceEvidence)) {
      if (!evidence.path) continue;
      if (key === "executionState") continue;
      assert.equal(evidence.sha256, this.#sha256(new StageThreeBatch008HistoricalInputs(PROJECT_ROOT).bytes(evidence.path)),
        `stale source evidence: ${evidence.path}`);
    }
    for (const module of plan.scope.modules) {
      assert.equal(module.sourceSha256, this.#sha256(this.#read(module.currentPath)),
        `stale classic provider fingerprint: ${module.currentPath}`);
    }
    new StageThreeBatch008HistoricalInputs(PROJECT_ROOT).verifyTargets();
  }

  #verifyRollbackFingerprints(plan) {
    const records = plan.rollback.baselineEvidence.files;
    assert.deepEqual(records.map((record) => record.path), [...ROLLBACK_FILE_PATHS]
      .sort((left, right) => left.localeCompare(right)));
    for (const record of records) {
      assert.equal(record.sha256, this.#sha256(new StageThreeBatch008HistoricalInputs(PROJECT_ROOT).bytes(record.path)),
        `stale rollback file fingerprint: ${record.path}`);
    }
    const runtime = plan.rollback.baselineEvidence.runtimeOutput;
    const currentFiles = this.#walk(this.#absolute(runtime.path)).map((file) => ({
      path: path.relative(PROJECT_ROOT, file).replaceAll("\\", "/"),
      sha256: this.#sha256(this.#read(path.relative(PROJECT_ROOT, file).replaceAll("\\", "/"))),
    })).filter((item) => runtime.files.some((expected) => expected.path === item.path));
    assert.deepEqual(runtime.files, currentFiles, "current dist fingerprint set differs");
    assert.equal(runtime.fingerprint,
      this.#sha256(Buffer.from(JSON.stringify(currentFiles), "utf8")),
    "current dist aggregate fingerprint differs");
  }

  #verifyCurrentPrebuildState(plan, prebuild) {
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    assert.equal(state.activeBatchId, plan.batchId);
    assert.equal(state.activeBatchPhase, "prebuild");
    assert.deepEqual(state.completedBatchIds, plan.lifecycle.preState.completedBatchIds);
    const before = { ...state, activeBatchId: null };
    delete before.activeBatchPhase;
    const beforeBytes = Buffer.from(`${JSON.stringify(before, null, 2)}\n`, "utf8");
    assert.equal(this.#sha256(beforeBytes), plan.sourceEvidence.executionState.sha256,
      "current prebuild state does not reverse to execution-plan PRE evidence");
    assert.equal(this.#sha256(beforeBytes), prebuild.evidence.executionStateBefore.sha256,
      "current prebuild state does not reverse to prebuild-open evidence");
  }

  #rebuild(plan, persistedBytes) {
    const inputs = new StageThreeBatch008HistoricalInputs(PROJECT_ROOT);
    const evidence = plan.sourceEvidence;
    const read = (key) => JSON.parse(inputs.bytes(evidence[key].path));
    const { spawnSync } = require("node:child_process");
    const git = process.platform === "win32" ? "C:/Program Files/Git/cmd/git.exe" : "git";
    if (fs.existsSync(this.#absolute(".git"))) {
      for (const [args, expected] of [
        [["rev-list", "-n", "1", evidence.scmCheckpoint.tag], evidence.scmCheckpoint.commitSha],
        [["cat-file", "-t", evidence.scmCheckpoint.tag], "tag"],
      ]) {
        const result = spawnSync(git, args, { cwd: PROJECT_ROOT, encoding: "utf8" });
        assert.equal(result.status, 0);
        assert.equal(result.stdout.trim(), expected, "Frozen SCM checkpoint changed");
      }
    }
    const rebuilt = new StageThreeBatchExecutionPlanBuilder(BATCH_008_EXECUTION_PROFILE).build({
      audit: read("audit"), auditSha256: evidence.audit.sha256,
      approvedPlan: read("approvedPlan"), approvedPlanSha256: evidence.approvedPlan.sha256,
      executionState: read("executionState"), executionStateSha256: evidence.executionState.sha256,
      runtimeContract: read("runtimeContract"), runtimeContractSha256: evidence.runtimeContract.sha256,
      manifestSha256: evidence.manifest.sha256,
      bridgeRegistry: read("bridgeRegistry"), bridgeRegistrySha256: evidence.bridgeRegistry.sha256,
      scmCheckpoint: evidence.scmCheckpoint,
      runtimeFacts: runtimeFacts({ runtimeContract: read("runtimeContract"),
        bridgeRegistry: read("bridgeRegistry"), indexBytes: inputs.bytes("index.html") }),
      rollbackEvidence: plan.rollback.baselineEvidence,
    });
    assert.deepEqual(Buffer.from(`${JSON.stringify(rebuilt, null, 2)}\n`), persistedBytes,
      "Atomic plan no longer reproduces from the exact historical inputs");
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

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath).toString("utf8"));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch008ExecutionPlanIntegrationCheck().run();
