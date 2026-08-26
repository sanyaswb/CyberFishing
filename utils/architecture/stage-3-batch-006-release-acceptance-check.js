"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  LegacyScriptOrderReader,
} = require("./migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("./migration/stage_two_runtime_script_alias_resolver");

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const BATCH_ID = "stage-3.candidate-006-fishing-e48e70d8";
const RELEASE_VERSION = "0.24.43";
const PREVIOUS_RELEASE_VERSION = "0.24.42";

class StageThreeBatch006ReleaseAcceptanceCheck {
  run() {
    const packageJson = this.#json("package.json");
    const packageLock = this.#json("package-lock.json");
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const plan = this.#json("architecture/migration/stage_3_batch_006_execution_plan.json");
    const closure = this.#json("architecture/migration/stage_3_batch_006_release_closure.json");
    const batch = approved.batches.find((record) => record.id === BATCH_ID);
    assert(batch);

    this.#verifyClosureEvidence(closure);
    const atReleaseBoundary = this.#verifyCompletedLifecycle({ state, approved });
    if (atReleaseBoundary) {
      this.#verifyReleaseMetadata({ packageJson, packageLock, state });
      this.#verifyRuntimeTopology({ runtime, registry, manifest, batch });
      this.#verifyScriptTopology(runtime);
      for (const record of closure.releaseEvidence) {
        assert.equal(this.#sha256(this.#bytes(record.path)), record.sha256);
      }
    }
    this.#verifyRollback(plan);

    console.log(
      "Stage 3.6.8 release acceptance passed: v0.24.43, completed prefix 001–006, " +
        "25-module cumulative runtime, 26 activations, exact batch-006 rollback and Stage 3.7.0 handoff verified.",
    );
  }

  #verifyClosureEvidence(closure) {
    assert.equal(closure.schemaVersion, 1);
    assert.equal(closure.kind, "cyber-fishing-stage-3-batch-release-closure");
    assert.equal(closure.status, "verified");
    assert.equal(closure.batchId, BATCH_ID);
    assert.equal(closure.releaseVersion, RELEASE_VERSION);
    assert.equal(closure.completedBatchCount, 6);
    assert.equal(closure.completedDomainModuleCount, 16);
    assert.deepEqual(closure.runtimeTopology, {
      projectModuleCount: 25,
      activationCount: 26,
      physicalClassicScriptCount: 426,
      logicalLegacyPositionCount: 424,
      moduleScriptCount: 0,
      cumulativeRuntimeCount: 1,
      isolatedIifeCount: 0,
    });
    assert.equal(closure.acceptance.syntax.status, "passed");
    assert.equal(closure.acceptance.architecture.failedChecks, 0);
    assert.equal(closure.acceptance.quick.failedChecks, 0);
    assert.equal(closure.acceptance.full.failedChecks, 0);
    assert.equal(closure.acceptance.freshInstall.status, "passed");
    assert.equal(closure.acceptance.browserSmoke.status, "passed");
    assert.equal(closure.acceptance.browserSmoke.consoleErrorCount, 0);
    assert.equal(closure.acceptance.browserSmoke.consoleWarningCount, 0);
    assert.equal(closure.releaseEvidence.length, 9);
    assert.deepEqual(
      closure.releaseEvidence.map((record) => record.path),
      [...closure.releaseEvidence.map((record) => record.path)].sort(),
    );
    assert.equal(new Set(closure.releaseEvidence.map((record) => record.path)).size, 9);
    assert.equal(closure.nextStage,
      "Stage 3.7.0 — Batch 007 Preflight and Dependency Audit");
  }

  #verifyReleaseMetadata({ packageJson, packageLock, state }) {
    assert.equal(packageJson.version, RELEASE_VERSION);
    assert.equal(packageLock.version, RELEASE_VERSION);
    assert.equal(packageLock.packages[""].version, RELEASE_VERSION);
    assert.equal(state.releaseVersion, RELEASE_VERSION);
    const projectVersion = this.#read("src/config/project_version.js");
    assert.match(projectVersion, /CURRENT_PROJECT_VERSION\s*=\s*["']0\.24\.43["']/u);
    assert.match(projectVersion, /codename:\s*["']fishing-domain-primitives-ii["']/u);
    assert(this.#read("index.html").includes(
      `src/config/project_version.js?v=${RELEASE_VERSION}`,
    ));
    assert(this.#read("CHANGELOG.md").includes(
      `## v${RELEASE_VERSION} - Fishing Domain Primitives II`,
    ));
    const task = this.#read("refactor_Task.txt");
    assert(task.includes(`**Поточна release-версія:** \`v${RELEASE_VERSION}\``));
    assert(task.includes("Stage 3.7.0 — Batch 007 Preflight and Dependency Audit"));
  }

  #verifyCompletedLifecycle({ state, approved }) {
    assert.equal(state.status, "migration-active");
    assert.deepEqual(
      state.completedBatchIds.slice(0, 6),
      approved.batches.slice(0, 6).map((record) => record.id),
    );
    assert.equal(state.completedBatchIds[5], BATCH_ID);
    assert.equal(state.compatibilityRuntimeActivated, true);
    const nextBatchAuditStarted = fs.existsSync(path.join(
      PROJECT_ROOT,
      "architecture/migration/stage_3_batch_007_audit.json",
    ));
    const atReleaseBoundary = !nextBatchAuditStarted &&
      state.releaseVersion === RELEASE_VERSION &&
      state.completedBatchIds.length === 6 && state.activeBatchId === null;
    if (atReleaseBoundary) assert.equal(state.activeBatchPhase, undefined);
    return atReleaseBoundary;
  }

  #verifyRuntimeTopology({ runtime, registry, manifest, batch }) {
    assert.equal(runtime.status, "migration-active");
    assert.equal(runtime.activationPositions.length, 26);
    assert.equal(runtime.plannedActivationPositions, undefined);
    assert.equal(runtime.activationPositions.filter((record) =>
      record.owner === BATCH_ID).length, 6);
    assert.equal(registry.plannedBridges, undefined);
    assert.equal(registry.bridges.filter((record) =>
      record.owner === BATCH_ID).length, 7);

    const manifestByPath = new Map(manifest.modules.map((record) => [
      record.currentPath,
      record,
    ]));
    for (const module of batch.modules) {
      assert.deepEqual(
        manifestByPath.get(module.currentPath)?.architecture?.roles,
        ["compatibility-bridge"],
      );
      const target = manifestByPath.get(module.targetPath);
      assert.equal(target?.architecture?.migrationStatus, "verified");
      assert.equal(target?.architecture?.targetBoundary, "game-domain");
    }

    const runtimeOutput = path.join(
      PROJECT_ROOT,
      runtime.output.directory,
      runtime.output.runtimeFile,
    );
    assert.equal(fs.existsSync(runtimeOutput), true);
  }

  #verifyScriptTopology(runtime) {
    const indexPath = path.join(PROJECT_ROOT, "index.html");
    const html = this.#read("index.html");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    assert.equal(scripts.length, 426);
    assert.equal(scripts.filter((record) =>
      /\btype=["']module["']/iu.test(record[1])).length, 0);
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    assert.equal(scripts.filter((record) =>
      record[2].split("?")[0] === runtimePath).length, 1);
    assert.equal(scripts.filter((record) =>
      record[2].includes("dist/legacy-bridges/")).length, 0);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(indexPath, {
      scriptAliases: aliases,
    }).read();
    assert.equal(logical.length, 424);
  }

  #verifyRollback(plan) {
    assert.equal(plan.batchId, BATCH_ID);
    assert.equal(plan.rollback.atomic, true);
    assert.equal(plan.rollback.partialRollbackAllowed, false);
    assert.equal(plan.rollback.fromRelease, RELEASE_VERSION);
    assert.equal(plan.rollback.toRelease, PREVIOUS_RELEASE_VERSION);
    assert.equal(plan.rollback.removeBatchId, BATCH_ID);
    assert.equal(plan.rollback.preserveCompletedBatchIds.length, 5);
    assert.deepEqual(plan.rollback.restoreTopology, {
      projectModuleCount: 19,
      activationCount: 20,
      bridgeRecordCount: 41,
      physicalClassicScriptCount: 426,
      logicalLegacyPositionCount: 424,
      moduleScriptCount: 0,
    });
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return this.#bytes(relativePath).toString("utf8");
  }

  #bytes(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

new StageThreeBatch006ReleaseAcceptanceCheck().run();
