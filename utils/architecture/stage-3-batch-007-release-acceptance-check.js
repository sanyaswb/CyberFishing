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
const BATCH_ID = "stage-3.candidate-007-fishing-bb8b3939";
const RELEASE_VERSION = "0.24.44";
const PREVIOUS_RELEASE_VERSION = "0.24.43";

class StageThreeBatch007ReleaseAcceptanceCheck {
  run() {
    const closure = this.#json("architecture/migration/stage_3_batch_007_release_closure.json");
    const accepted = this.#json("architecture/migration/stage_3_batch_007_acceptance_pass.json");
    const state = this.#json("architecture/migration/stage_3_execution_state.json");
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const plan = this.#json("architecture/migration/stage_3_batch_007_execution_plan.json");

    this.#verifyClosure(closure, accepted);
    const atReleaseBoundary = this.#verifyLifecycle(state, approved);
    if (atReleaseBoundary) {
      this.#verifyReleaseMetadata(state);
      this.#verifyRuntimeTopology(closure);
      this.#verifyReleaseEvidence(closure);
    }
    this.#verifyRollback(closure, plan);

    console.log(
      "Stage 3.7.9 release acceptance passed: v0.24.44, completed prefix 001–007, " +
        "31-module cumulative runtime, 32 activations, 57 bridges, exact batch-007 rollback " +
        "and Stage 3.8.0 handoff verified.",
    );
  }

  #verifyClosure(closure, accepted) {
    assert.equal(closure.schemaVersion, 1);
    assert.equal(closure.kind, "cyber-fishing-stage-3-batch-release-closure");
    assert.equal(closure.status, "verified");
    assert.equal(closure.batchId, BATCH_ID);
    assert.equal(closure.releaseVersion, RELEASE_VERSION);
    assert.equal(closure.previousReleaseVersion, PREVIOUS_RELEASE_VERSION);
    assert.equal(closure.completedBatchCount, 7);
    assert.equal(closure.completedDomainModuleCount, 22);
    assert.deepEqual(closure.runtimeTopology, {
      projectModuleCount: 31,
      activationCount: 32,
      bridgeRecordCount: 57,
      physicalClassicScriptCount: 426,
      logicalLegacyPositionCount: 424,
      moduleScriptCount: 0,
      cumulativeRuntimeCount: 1,
      isolatedIifeCount: 0,
    });
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(accepted.releaseClosureAllowed, true);
    assert.equal(closure.acceptance.supersedingEvidence.status, "passed");
    assert.equal(
      this.#sha256(closure.acceptance.supersedingEvidence.path),
      closure.acceptance.supersedingEvidence.sha256,
    );
    assert.equal(closure.acceptance.supersedingEvidence.supersededAttemptPreserved, true);
    for (const name of ["architecture", "quick", "full"]) {
      assert.equal(closure.acceptance[name].status, "passed");
      assert.equal(closure.acceptance[name].failedChecks, 0);
    }
    assert.equal(closure.acceptance.freshInstall.status, "passed");
    assert.equal(closure.acceptance.freshInstall.lockfileChanged, false);
    assert.equal(closure.acceptance.freshInstall.architectureQuickFullPassed, true);
    assert.equal(closure.acceptance.finalReleaseRegression.status, "passed");
    assert.equal(closure.acceptance.finalReleaseRegression.npmCi.exitCode, 0);
    for (const name of ["architecture", "quick", "full"]) {
      const result = closure.acceptance.finalReleaseRegression[name];
      assert.equal(result.failedChecks, 0);
      assert(Number.isInteger(result.passedChecks) && result.passedChecks > 0);
      assert.match(result.logSha256, /^[a-f0-9]{64}$/u);
    }
    assert.equal(closure.acceptance.browserSmoke.status, "passed");
    assert(closure.acceptance.browserSmoke.autoRecoveredMeters > 0);
    assert(
      closure.acceptance.browserSmoke.lineReleasedMetersAfter <
        closure.acceptance.browserSmoke.lineReleasedMetersBefore,
    );
    assert.equal(closure.acceptance.browserSmoke.strokeLineDesync, false);
    assert.equal(closure.acceptance.browserSmoke.consoleWarningCount, 0);
    assert.equal(closure.acceptance.browserSmoke.consoleErrorCount, 0);
    assert.equal(closure.releaseEvidence.length, 24);
    const paths = closure.releaseEvidence.map((record) => record.path);
    assert.deepEqual(paths, [...paths].sort());
    assert.equal(new Set(paths).size, paths.length);
    assert(closure.releaseEvidence.every((record) => /^[a-f0-9]{64}$/u.test(record.sha256)));
    assert.equal(
      closure.nextStage,
      "Stage 3.8.0 — Shared Batch Tooling Hardening and Batch 008 Preflight",
    );
  }

  #verifyLifecycle(state, approved) {
    const expectedPrefix = approved.batches.slice(0, 7).map((batch) => batch.id);
    assert.deepEqual(state.completedBatchIds.slice(0, 7), expectedPrefix);
    assert.equal(state.completedBatchIds[6], BATCH_ID);
    assert.equal(state.compatibilityRuntimeActivated, true);
    const atReleaseBoundary = state.releaseVersion === RELEASE_VERSION &&
      state.completedBatchIds.length === 7 && state.activeBatchId === null;
    if (atReleaseBoundary) {
      assert.equal(state.status, "migration-active");
      assert.equal(state.activeBatchPhase, undefined);
    }
    return atReleaseBoundary;
  }

  #verifyReleaseMetadata(state) {
    const packageJson = this.#json("package.json");
    const packageLock = this.#json("package-lock.json");
    const contract = this.#json("architecture/build/package_contract.json");
    assert.equal(packageJson.version, RELEASE_VERSION);
    assert.equal(packageLock.version, RELEASE_VERSION);
    assert.equal(packageLock.packages[""].version, RELEASE_VERSION);
    assert.equal(state.releaseVersion, RELEASE_VERSION);
    assert.equal(contract.stage.current, "3.7");
    assert.equal(contract.stage.cumulativeRuntimeBuild.runtimeInputs, 31);
    assert.equal(contract.stage.cumulativeRuntimeBuild.activationInputs, 32);
    const version = this.#read("src/config/project_version.js");
    assert.match(version, /CURRENT_PROJECT_VERSION\s*=\s*["']0\.24\.44["']/u);
    assert.match(version, /codename:\s*["']fishing-domain-state-and-motion["']/u);
    assert.match(version, /updatedAt:\s*["']2026-09-04["']/u);
    assert(this.#read("index.html").includes(
      `src/config/project_version.js?v=${RELEASE_VERSION}`,
    ));
    assert(this.#read("CHANGELOG.md").includes(
      `## v${RELEASE_VERSION} - Fishing Domain State and Motion`,
    ));
    const task = this.#read("refactor_Task.txt");
    assert(task.includes(`**Поточна release-версія:** \`v${RELEASE_VERSION}\``));
    assert(task.includes("Stage 3.8.0 — Shared Batch Tooling Hardening"));
    assert(!task.includes("**Поточний наступний етап:** `Stage 3.7"));
  }

  #verifyRuntimeTopology(closure) {
    const runtime = this.#json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = this.#json("architecture/guards/migration_bridge_registry.json");
    const manifest = this.#json("architecture/migration/module_migration_manifest.json");
    const approved = this.#json("architecture/migration/stage_3_approved_batches.json");
    const batch = approved.batches[6];
    assert.equal(runtime.activationPositions.length, closure.runtimeTopology.activationCount);
    assert.equal(runtime.activationPositions.filter((item) => item.owner === BATCH_ID).length, 6);
    assert.equal(registry.bridges.length, closure.runtimeTopology.bridgeRecordCount);
    assert.equal(registry.bridges.filter((item) => item.owner === BATCH_ID).length, 9);
    const entries = new Map(manifest.modules.map((entry) => [entry.currentPath, entry]));
    for (const module of batch.modules) {
      assert.deepEqual(entries.get(module.currentPath)?.architecture?.roles, ["compatibility-bridge"]);
      const target = entries.get(module.targetPath);
      assert.equal(target?.architecture?.migrationStatus, "verified");
      assert.equal(target?.architecture?.targetBoundary, "game-domain");
    }
    const runtimeFile = path.join(
      PROJECT_ROOT,
      runtime.output.directory,
      runtime.output.runtimeFile,
    );
    assert.equal(fs.existsSync(runtimeFile), true);
    this.#verifyScriptTopology(runtime, closure.runtimeTopology);
  }

  #verifyScriptTopology(runtime, topology) {
    const html = this.#read("index.html");
    const scripts = [...html.matchAll(
      /<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu,
    )];
    assert.equal(scripts.length, topology.physicalClassicScriptCount);
    assert.equal(scripts.filter((match) => /\btype=["']module["']/iu.test(match[1])).length, 0);
    const runtimePath = `${runtime.output.directory}${runtime.output.runtimeFile}`;
    assert.equal(scripts.filter((match) => match[2].split("?")[0] === runtimePath).length, 1);
    assert.equal(scripts.filter((match) => match[2].includes("dist/legacy-bridges/")).length, 0);
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(PROJECT_ROOT);
    const logical = new LegacyScriptOrderReader(path.join(PROJECT_ROOT, "index.html"), {
      scriptAliases: aliases,
    }).read();
    assert.equal(logical.length, topology.logicalLegacyPositionCount);
  }

  #verifyReleaseEvidence(closure) {
    for (const record of closure.releaseEvidence) {
      assert.equal(this.#sha256(record.path), record.sha256, `Stale release evidence: ${record.path}`);
    }
  }

  #verifyRollback(closure, plan) {
    assert.equal(plan.batchId, BATCH_ID);
    assert.equal(plan.rollback.atomic, true);
    assert.equal(plan.rollback.partialRollbackAllowed, false);
    assert.equal(plan.rollback.fromRelease, RELEASE_VERSION);
    assert.equal(plan.rollback.toRelease, PREVIOUS_RELEASE_VERSION);
    assert.equal(plan.rollback.removeBatchId, BATCH_ID);
    assert.equal(plan.rollback.preserveCompletedBatchIds.length, 6);
    assert.deepEqual(plan.rollback.restoreTopology, closure.rollback.restoreTopology);
    assert.deepEqual(closure.rollback, {
      atomic: true,
      fromRelease: RELEASE_VERSION,
      toRelease: PREVIOUS_RELEASE_VERSION,
      removeBatchId: BATCH_ID,
      preserveCompletedBatchCount: 6,
      restoreTopology: plan.rollback.restoreTopology,
    });
  }

  #json(relativePath) {
    return JSON.parse(this.#read(relativePath));
  }

  #read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
  }

  #sha256(relativePath) {
    return crypto.createHash("sha256")
      .update(fs.readFileSync(path.join(PROJECT_ROOT, relativePath)))
      .digest("hex");
  }
}

new StageThreeBatch007ReleaseAcceptanceCheck().run();
