"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Batch025ReleaseCheck } = require("./stage-3-batch-025-release-check");
const { ControlledMetadataTransaction } = require("./domain_batches/controlled_metadata_transaction");
const { TRANSITION, RELEASE_PATHS, STATE } = require("./domain_batches/stage_three_batch_025_release_transition");
const { CHECK_DEFINITIONS } = require("../testing/suites/check_manifest");
const { sha, serialize } = require("./domain_batches/stage_three_batch_025_planning");
const { StageThreeApprovedPlanSource } = require("./domain_batches/stage_three_approved_plan_source");

const OUTPUT = "architecture/migration/stage_3_batch_025_release_closure.json";
const REGRESSION = "architecture/migration/stage_3_batch_025_release_regression.json";

class Batch025ReleaseFinalizer {
  run(root = path.resolve(__dirname, "../..")) {
    assert(!fs.existsSync(path.join(root, OUTPUT)), "Release closure must not be rewritten");
    const read = file => fs.readFileSync(path.join(root, file));
    const json = file => JSON.parse(read(file));
    const reference = file => ({ path: file, sha256: sha(read(file)) });
    const verified = new Batch025ReleaseCheck().run(root);
    const accepted = json("architecture/migration/stage_3_batch_025_acceptance_pass.json");
    const browser = json("architecture/migration/stage_3_batch_025_browser_confirmation.json");
    const regression = json(REGRESSION);
    const transition = json(TRANSITION);
    const planPath = "architecture/migration/stage_3_batch_025_execution_plan.json";
    const plan = json(planPath);
    const approved = new StageThreeApprovedPlanSource({ read }).load(json(STATE)).document;
    assert.equal(accepted.verdict, "eligible-for-release-closure");
    assert.equal(browser.supplements.sha256,
      sha(read("architecture/migration/stage_3_batch_025_acceptance_pass.json")));
    assert.deepEqual([browser.console.errors, browser.console.warnings], [0, 0]);
    assert.equal(regression.status, "passed");
    assert.equal(regression.releaseVersion, "0.24.63");
    assert.equal(regression.lockfileChanged, false);
    assert.equal(regression.sourceCopy.sourceBytesUnchanged, true);
    assert.equal(regression.temporaryWorkspaceRemoved, true);
    assert.deepEqual(regression.steps.map(step => step.id), ["npm-ci", "cumulative-build"]);
    for (const step of regression.steps) assert.equal(step.exitCode, 0);
    assert.equal(regression.automatedAcceptance.sha256,
      sha(read("architecture/migration/stage_3_batch_025_automated_acceptance.json")));
    assert.deepEqual(regression.preReleaseSuites.full,
      { passedChecks: CHECK_DEFINITIONS.length, failedChecks: 0 });
    for (const output of regression.runtimeOutput) assert.equal(sha(read(output.path)), output.sha256);
    assert.deepEqual(transition.records.map(item => item.path), RELEASE_PATHS);
    const closure = {
      schemaVersion: 1, kind: "cyber-fishing-stage-3-batch-release-closure",
      status: "verified", batchId: accepted.batchId,
      releaseVersion: "0.24.63", previousReleaseVersion: "0.24.62",
      releasePublicationAllowed: true, completedBatchCount: 25,
      completedDomainModuleCount: approved.batches.slice(0, 25)
        .reduce((count, batch) => count + batch.modules.length, 0),
      runtimeTopology: verified.topology,
      acceptance: {
        automatedEvidence: reference("architecture/migration/stage_3_batch_025_automated_acceptance.json"),
        historicalSummary: reference("architecture/migration/stage_3_batch_025_acceptance_pass.json"),
        browserProof: reference("architecture/migration/stage_3_batch_025_browser_confirmation.json"),
        browserGate: browser.gate,
      },
      releaseTransition: reference(TRANSITION),
      releaseEvidence: [
        ...RELEASE_PATHS.map(reference),
        ...["architecture/migration/module_migration_manifest.json",
          "architecture/guards/migration_bridge_registry.json",
          "architecture/migration/stage_3_compatibility_runtime.json"].map(reference),
      ],
      rollback: {
        atomic: plan.rollback.atomic,
        partialRollbackAllowed: plan.rollback.partialRollbackAllowed,
        fromRelease: plan.rollback.fromRelease,
        toRelease: plan.rollback.toRelease,
        removeBatchId: plan.rollback.removeBatchId,
        preserveCompletedBatchIds: plan.rollback.preserveCompletedBatchIds,
        restoreTopology: plan.rollback.restoreTopology,
        baselineEvidenceReference: reference(planPath),
      },
      finalRegression: {
        status: "passed", evidence: reference(REGRESSION),
        preReleaseSuites: regression.preReleaseSuites,
        node: regression.node, npm: regression.npm,
        lockfileSha256: regression.lockfileSha256,
        lockfileChanged: false, generatedRuntimeByteEquality: true,
        steps: regression.steps.map(item => ({
          id: item.id, exitCode: item.exitCode, passedChecks: item.passedChecks,
          durationMs: item.durationMs, stdoutSha256: item.stdoutSha256,
          stderrSha256: item.stderrSha256,
        })),
      },
      nextStage: `Stage 3.27.0 — Batch 026 Preflight (${approved.batches[25].id})`,
    };
    assert.equal(closure.completedDomainModuleCount, 77);
    const bytes = serialize(closure);
    new ControlledMetadataTransaction({ projectRoot: root }).commit([
      { relativePath: OUTPUT, bytes },
    ], () => assert.deepEqual(read(OUTPUT), bytes));
    new Batch025ReleaseCheck().run(root);
    console.log("Stage 3.26.9 release closure verified: v0.24.63, twenty-five completed batches, 77 migrated Domain modules, exact batch-only rollback.");
    return closure;
  }
}

if (require.main === module) {
  try { new Batch025ReleaseFinalizer().run(); }
  catch (error) { console.error(error.stack); process.exitCode = 1; }
}

module.exports = { Batch025ReleaseFinalizer, OUTPUT };
