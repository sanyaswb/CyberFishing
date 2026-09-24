"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { fingerprint } = require("./domain_batches/stage_three_pending_target_manifest");
const { StageThreeBatch009ReleaseTransition, TRANSITION, STATE, BATCH, RELEASE_PATHS } =
  require("./domain_batches/stage_three_batch_009_release_transition");

class Batch009ReleaseCheck {
  run(root = path.resolve(__dirname, "../..")) {
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const transition = new StageThreeBatch009ReleaseTransition(root);
    const record = transition.validate(json(TRANSITION));
    assert.deepEqual(record.records.map(item => item.path), RELEASE_PATHS);
    for (const item of record.records) transition.reverse(read(item.path), item);
    const state = json(STATE), approved = json("architecture/migration/stage_3_approved_batches.json");
    const plan = json("architecture/migration/stage_3_batch_009_execution_plan.json");
    assert.equal(state.releaseVersion, "0.24.46");
    assert.deepEqual(state.completedBatchIds, approved.batches.slice(0, 9).map(item => item.id));
    assert.equal(state.completedBatchIds[8], BATCH);
    assert.equal(state.activeBatchId, null);
    assert(!Object.hasOwn(state, "activeBatchPhase"));
    assert.equal(state.compatibilityRuntimeActivated, true);
    const packageJson = json("package.json"), lock = json("package-lock.json");
    assert.equal(packageJson.version, "0.24.46");
    assert.equal(lock.version, packageJson.version);
    assert.equal(lock.packages[""].version, packageJson.version);
    const version = read("src/config/project_version.js").toString();
    assert(version.includes('const CURRENT_PROJECT_VERSION = "0.24.46";'));
    assert(read("index.html").toString().includes("src/config/project_version.js?v=0.24.46"));
    assert(read("CHANGELOG.md").toString().includes("## v0.24.46 - Fish Rarity and Anomaly Domain"));
    assert(read("refactor_Task.txt").toString().includes(
      "**Поточний наступний етап:** `Stage 3.10.0 — Batch 010 Preflight and Dependency/State Audit`"));
    const runtime = json("architecture/migration/stage_3_compatibility_runtime.json");
    const registry = json("architecture/guards/migration_bridge_registry.json");
    const manifest = json("architecture/migration/module_migration_manifest.json");
    const sourceBuild = json("architecture/migration/stage_3_batch_009_source_build_validation.json");
    const output = runtime.output.directory + runtime.output.runtimeFile;
    const html = read("index.html").toString();
    const scripts = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*><\/script>/giu)];
    const actual = {
      projectModuleCount: sourceBuild.report.projectModules.length,
      activationCount: runtime.activationPositions.length,
      bridgeRecordCount: registry.bridges.length,
      physicalClassicScriptCount: scripts.length,
      logicalLegacyPositionCount: plan.scriptTopology.after.logicalLegacyPositionCount,
      moduleScriptCount: scripts.filter(item => /\btype=["']module["']/iu.test(item[1])).length,
      cumulativeRuntimeCount: scripts.filter(item => item[2].split(/[?#]/u)[0] === output).length,
      isolatedIifeCount: scripts.filter(item => item[2].includes("dist/legacy-bridges/")).length,
    };
    assert.deepEqual(actual, {
      projectModuleCount: plan.cumulativeRuntime.afterProjectModuleCount,
      activationCount: plan.cumulativeRuntime.afterActivationCount,
      bridgeRecordCount: plan.compatibility.registryTransition.afterCount,
      physicalClassicScriptCount: plan.scriptTopology.after.physicalClassicScriptCount,
      logicalLegacyPositionCount: plan.scriptTopology.after.logicalLegacyPositionCount,
      moduleScriptCount: 0, cumulativeRuntimeCount: 1, isolatedIifeCount: 0,
    });
    assert.equal(fingerprint(read(output)), sourceBuild.report.runtimeSha256);
    for (const module of plan.scope.modules) {
      const target = manifest.modules.find(item => item.currentPath === module.targetPath);
      assert.equal(target?.architecture.migrationStatus, "verified");
      assert.equal(target?.architecture.targetBoundary, "game-domain");
    }
    assert.deepEqual(plan.rollback.preserveCompletedBatchIds, approved.batches.slice(0, 8).map(item => item.id));
    assert.equal(plan.rollback.removeBatchId, BATCH);
    assert.equal(plan.rollback.fromRelease, "0.24.46");
    assert.equal(plan.rollback.toRelease, "0.24.45");
    const browser = json("architecture/migration/stage_3_batch_009_browser_confirmation.json");
    assert.equal(browser.console.errors, 0);
    assert.equal(browser.console.warnings, 0);
    assert.equal(browser.status, "passed");
    const closurePath = "architecture/migration/stage_3_batch_009_release_closure.json";
    if (fs.existsSync(path.join(root, closurePath))) {
      const closure = json(closurePath);
      assert.equal(closure.status, "verified");
      assert.equal(closure.releasePublicationAllowed, true);
      assert.equal(closure.batchId, BATCH);
      assert.equal(closure.releaseVersion, state.releaseVersion);
      assert.equal(closure.completedBatchCount, state.completedBatchIds.length);
      assert.equal(closure.completedDomainModuleCount,
        approved.batches.slice(0, state.completedBatchIds.length)
          .reduce((count, batch) => count + batch.modules.length, 0));
      assert.deepEqual(closure.runtimeTopology, actual);
      for (const item of [closure.acceptance.automatedEvidence, closure.acceptance.historicalSummary,
        closure.acceptance.browserProof, closure.releaseTransition, ...closure.releaseEvidence,
        closure.rollback.baselineEvidenceReference, closure.finalRegression.evidence]) {
        assert.equal(fingerprint(read(item.path)), item.sha256, `Release closure evidence drift: ${item.path}`);
      }
      assert.equal(closure.acceptance.browserProof.path,
        "architecture/migration/stage_3_batch_009_browser_confirmation.json");
      assert.equal(closure.finalRegression.status, "passed");
      assert.equal(closure.finalRegression.lockfileChanged, false);
      assert.deepEqual(closure.rollback.preserveCompletedBatchIds, plan.rollback.preserveCompletedBatchIds);
      assert.deepEqual(closure.rollback.restoreTopology, plan.rollback.restoreTopology);
      assert.equal(closure.nextStage, "Stage 3.10.0 — Batch 010 Preflight and Dependency/State Audit");
    }
    return { status: "passed", topology: actual, releaseFiles: record.records.length };
  }
}

if (require.main === module) {
  new (require("./domain_batches/stage_three_batch_010_historical_workspace").Batch010HistoricalWorkspace)()
    .run(path.resolve(__dirname, "../.."), root => {
    const result = new Batch009ReleaseCheck().run(root);
    console.log(`Stage 3.9.9 release check PASS: ${result.releaseFiles} exact reversible metadata files, completed prefix 001–009, one cumulative ${result.topology.projectModuleCount}-module runtime.`);
    }).catch(error => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { Batch009ReleaseCheck };
